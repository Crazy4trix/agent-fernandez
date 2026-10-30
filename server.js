import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { writeFileSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { PORT, UPLOAD_DIR, site } from './src/config.js';
import {
  db, publicListings, featuredListings, listingBySlug, listingById, allListings, uniqueSlug,
} from './src/db.js';
import {
  HttpError, securityHeaders, clientIp, parseCookies, setCookie, parseBody, checkOrigin,
  wantsJson, sendHtml, sendJson, redirect, rateLimiter,
} from './src/http.js';
import { serveStatic } from './src/static.js';
import {
  authenticate, createSession, sessionFromToken, destroySession, safeEqual, upsertUser,
  formStamp, checkFormStamp, SESSION_COOKIE,
} from './src/auth.js';
import { validateInquiry, validateListing } from './src/forms.js';
import { sendInquiryEmails } from './src/email.js';
import * as pages from './src/views/pages.js';
import * as admin from './src/views/admin.js';
import { absolute } from './src/views/layout.js';

// First-run admin account from the environment (see README). Re-running with a new
// password updates it and signs out existing sessions.
if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
  if (process.env.ADMIN_PASSWORD.length < 12) {
    console.error('ADMIN_PASSWORD must be at least 12 characters. Admin account not created.');
  } else {
    upsertUser(process.env.ADMIN_EMAIL, process.env.ADMIN_PASSWORD);
  }
}

const inquiryLimit = rateLimiter({ windowMs: 10 * 60 * 1000, max: 5 });
const loginLimit = rateLimiter({ windowMs: 15 * 60 * 1000, max: 5 });

// ---------- Public ----------

const pageFor = { buyer: pages.buyPage, seller: pages.sellPage, general: pages.contactPage };

async function handleInquiry(req, res, kind) {
  const body = await parseBody(req);
  const json = wantsJson(req);

  // Spam traps: honeypot field filled, or the form was submitted implausibly fast/stale.
  // Respond as if it succeeded so bots learn nothing.
  if (body.website || !checkFormStamp(body.stamp)) {
    return json ? sendJson(req, res, { ok: true }) : redirect(res, '/contact?sent=1');
  }

  let listing = null;
  if (kind === 'listing') {
    listing = listingById(Number(body.listing_id));
    if (!listing || !listing.published) throw new HttpError(404, 'That listing is no longer available.');
  }

  const { values, errors, details } = validateInquiry(kind, body);
  if (!Object.keys(errors).length && !inquiryLimit.hit(clientIp(req))) {
    errors._form = 'Too many messages from this connection. Wait a few minutes and try again, or email Kevin directly.';
  }
  if (Object.keys(errors).length) {
    if (json) return sendJson(req, res, { ok: false, errors }, 422);
    const stamp = formStamp();
    const page = kind === 'listing'
      ? pages.listingPage({ listing, stamp, values, errors })
      : pageFor[kind]({ stamp, values, errors });
    return sendHtml(req, res, page, 422);
  }

  const { lastInsertRowid: id } = db.prepare(`INSERT INTO inquiries (kind, listing_id, name, email, phone, message, details)
    VALUES (?, ?, ?, ?, ?, ?, ?)`).run(kind, listing?.id ?? null, values.name, values.email, values.phone, values.message, JSON.stringify(details));
  sendInquiryEmails({ id, kind, ...values, details }, listing);

  if (json) return sendJson(req, res, { ok: true });
  const back = { buyer: '/buy', seller: '/sell', general: '/contact', listing: listing && `/listings/${listing.slug}` }[kind];
  return redirect(res, `${back}?sent=1`);
}

function readFilters(url) {
  const show = url.searchParams.get('show') === 'sold' ? 'sold' : 'available';
  const type = url.searchParams.get('type') || '';
  const beds = Math.max(0, Math.min(10, parseInt(url.searchParams.get('beds'), 10) || 0));
  const maxPrice = Math.max(0, parseInt(url.searchParams.get('max'), 10) || 0);
  return { show, type, beds, maxPrice };
}

const sentValues = (url) => (url.searchParams.get('sent') === '1' ? { _sent: true } : {});

async function publicRoutes(req, res, url) {
  const p = url.pathname;
  if (req.method === 'GET' || req.method === 'HEAD') {
    if (p === '/') {
      const sold = publicListings({ show: 'sold' }).slice(0, 3);
      return sendHtml(req, res, pages.homePage({ featured: featuredListings(5), sold, stamp: formStamp() }));
    }
    if (p === '/listings') {
      const filters = readFilters(url);
      const listings = publicListings(filters);
      if (url.searchParams.get('partial') === '1') return sendHtml(req, res, pages.listingResults(listings, filters));
      return sendHtml(req, res, pages.listingsPage({ listings, filters }));
    }
    const m = p.match(/^\/listings\/([a-z0-9-]+)$/);
    if (m) {
      const listing = listingBySlug(m[1]);
      if (!listing) return null;
      return sendHtml(req, res, pages.listingPage({ listing, stamp: formStamp(), values: sentValues(url) }));
    }
    if (p === '/buy') return sendHtml(req, res, pages.buyPage({ stamp: formStamp(), values: sentValues(url) }));
    if (p === '/sell') return sendHtml(req, res, pages.sellPage({ stamp: formStamp(), values: sentValues(url) }));
    if (p === '/contact') return sendHtml(req, res, pages.contactPage({ stamp: formStamp(), values: sentValues(url) }));
    if (p === '/privacy') return sendHtml(req, res, pages.privacyPage());
    if (p === '/robots.txt') {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.end(`User-agent: *\nDisallow: /admin\nSitemap: ${absolute('/sitemap.xml')}\n`);
    }
    if (p === '/sitemap.xml') {
      const urls = ['/', '/listings', '/buy', '/sell', '/contact', '/privacy',
        ...[...publicListings(), ...publicListings({ show: 'sold' })].filter((l) => !l.is_sample).map((l) => `/listings/${l.slug}`)];
      res.setHeader('Content-Type', 'application/xml; charset=utf-8');
      return res.end(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `<url><loc>${absolute(u)}</loc></url>`).join('\n')}\n</urlset>\n`);
    }
    if (p === '/healthz') { res.setHeader('Content-Type', 'text/plain'); return res.end('ok'); }
  }
  if (req.method === 'POST') {
    const m = p.match(/^\/inquire\/(buyer|seller|listing|general)$/);
    if (m) { checkOrigin(req); return handleInquiry(req, res, m[1]); }
  }
  return null;
}

// ---------- Admin ----------

function requireSession(req) {
  return sessionFromToken(parseCookies(req)[SESSION_COOKIE]);
}

function checkCsrf(req, body, session) {
  const token = req.headers['x-csrf-token'] || body._csrf;
  if (!safeEqual(token, session.csrf)) throw new HttpError(403, 'Your session form expired. Reload the page and try again.');
}

const newCount = () => db.prepare("SELECT COUNT(*) AS n FROM inquiries WHERE status = 'new'").get().n;
const flashFrom = (url) => ({
  created: 'Listing created. Add photos below, then publish when it’s ready.',
  saved: 'Changes saved.', deleted: 'Listing deleted.', photo: 'Photos updated.',
}[url.searchParams.get('done')] || '');

const IMAGE_SIGNATURES = {
  webp: (b) => b.length > 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP',
  jpg: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
};

async function uploadPhoto(req, res, session, listing) {
  const body = await parseBody(req, 12 * 1024 * 1024);
  checkCsrf(req, body, session);
  const ext = body.ext === 'jpg' ? 'jpg' : 'webp';
  const alt = String(body.alt || '').trim().slice(0, 200);
  const images = body.images && typeof body.images === 'object' ? body.images : {};
  const widths = Object.keys(images).map(Number).filter((w) => [640, 1200, 2000].includes(w)).sort((a, b) => a - b);
  if (!widths.length) throw new HttpError(400, 'No image data received.');

  const name = randomBytes(12).toString('hex');
  const written = [];
  try {
    for (const w of widths) {
      const buf = Buffer.from(String(images[w]), 'base64');
      if (!IMAGE_SIGNATURES[ext](buf) || buf.length > 5 * 1024 * 1024) throw new HttpError(400, 'That file isn’t a supported image.');
      const file = path.join(UPLOAD_DIR, `${name}-${w}.${ext}`);
      writeFileSync(file, buf, { flag: 'wx' });
      written.push(file);
    }
  } catch (err) {
    written.forEach((f) => { try { unlinkSync(f); } catch {} });
    throw err;
  }
  const sort = db.prepare('SELECT COALESCE(MAX(sort), -1) + 1 AS s FROM photos WHERE listing_id = ?').get(listing.id).s;
  db.prepare('INSERT INTO photos (listing_id, base, ext, widths, alt, sort) VALUES (?, ?, ?, ?, ?, ?)')
    .run(listing.id, `/media/uploads/${name}`, ext, widths.join(','), alt || listing.address, sort);
  db.prepare("UPDATE listings SET updated_at = datetime('now') WHERE id = ?").run(listing.id);
  return sendJson(req, res, { ok: true });
}

function removePhotoFiles(photo) {
  if (!photo.base.startsWith('/media/uploads/')) return; // seed and content photos live in the repository
  for (const w of photo.widths.split(',')) {
    try { unlinkSync(path.join(UPLOAD_DIR, `${path.basename(photo.base)}-${w}.${photo.ext}`)); } catch {}
  }
}

function saveListing(id, data) {
  const cols = ['address', 'neighborhood', 'city', 'status', 'property_type', 'price', 'beds', 'baths', 'sqft', 'lot',
    'year_built', 'headline', 'description', 'features', 'listing_firm', 'licensee_owned', 'published', 'featured'];
  const vals = cols.map((c) => data[c]);
  if (id) {
    db.prepare(`UPDATE listings SET ${cols.map((c) => `${c} = ?`).join(', ')}, is_sample = 0, updated_at = datetime('now') WHERE id = ?`).run(...vals, id);
    return id;
  }
  const slug = uniqueSlug(data.address);
  return Number(db.prepare(`INSERT INTO listings (slug, ${cols.join(', ')}) VALUES (?, ${cols.map(() => '?').join(', ')})`).run(slug, ...vals).lastInsertRowid);
}

async function adminRoutes(req, res, url) {
  const p = url.pathname;

  if (p === '/admin/login') {
    if (req.method === 'GET') return sendHtml(req, res, admin.loginPage({ stamp: formStamp() }));
    if (req.method === 'POST') {
      checkOrigin(req);
      const body = await parseBody(req);
      const email = String(body.email || '').trim().slice(0, 200);
      const key = `${clientIp(req)}|${email.toLowerCase()}`;
      const fail = (error, status = 401) => sendHtml(req, res, admin.loginPage({ error, email, stamp: formStamp() }), status);
      if (loginLimit.blocked(key)) return fail('Too many attempts. Wait 15 minutes and try again.', 429);
      const user = authenticate(email, String(body.password || '').slice(0, 200));
      if (!user) {
        loginLimit.hit(key);
        return fail('That email and password don’t match. Check both and try again.');
      }
      loginLimit.reset(key);
      const { token, maxAge } = createSession(user.id);
      setCookie(res, SESSION_COOKIE, token, { maxAge });
      return redirect(res, '/admin');
    }
  }

  const session = requireSession(req);
  if (!session) {
    if (req.method === 'GET') return redirect(res, '/admin/login');
    throw new HttpError(401, 'Your session has ended. Sign in again.');
  }

  let body = {};
  if (req.method === 'POST') {
    checkOrigin(req);
    if (/^\/admin\/listings\/\d+\/photos$/.test(p)) {
      const listing = listingById(Number(p.split('/')[3]));
      if (!listing) return null;
      return uploadPhoto(req, res, session, listing);
    }
    body = await parseBody(req, 256 * 1024);
    checkCsrf(req, body, session);
  }

  if (p === '/admin/logout' && req.method === 'POST') {
    destroySession(parseCookies(req)[SESSION_COOKIE]);
    setCookie(res, SESSION_COOKIE, '', { maxAge: 0 });
    return redirect(res, '/admin/login');
  }

  if (p === '/admin' && req.method === 'GET') {
    return sendHtml(req, res, admin.dashboardPage({ session, listings: allListings(), newCount: newCount(), flash: flashFrom(url) }));
  }

  if (p === '/admin/listings/new' && req.method === 'GET') {
    return sendHtml(req, res, admin.listingFormPage({ session, newCount: newCount() }));
  }

  if (p === '/admin/listings' && req.method === 'POST') {
    const { values, data, errors } = validateListing(body);
    if (Object.keys(errors).length) return sendHtml(req, res, admin.listingFormPage({ session, values, errors, newCount: newCount() }), 422);
    const id = saveListing(null, data);
    return redirect(res, `/admin/listings/${id}?done=created`);
  }

  let m = p.match(/^\/admin\/listings\/(\d+)$/);
  if (m) {
    const listing = listingById(Number(m[1]));
    if (!listing) return null;
    if (req.method === 'GET') return sendHtml(req, res, admin.listingFormPage({ session, listing, newCount: newCount(), flash: flashFrom(url) }));
    if (req.method === 'POST') {
      const { values, data, errors } = validateListing(body);
      if (Object.keys(errors).length) return sendHtml(req, res, admin.listingFormPage({ session, listing, values, errors, newCount: newCount() }), 422);
      saveListing(listing.id, data);
      return redirect(res, `/admin/listings/${listing.id}?done=saved`);
    }
  }

  m = p.match(/^\/admin\/listings\/(\d+)\/delete$/);
  if (m && req.method === 'POST') {
    const listing = listingById(Number(m[1]));
    if (!listing) return null;
    listing.photos.forEach(removePhotoFiles);
    db.prepare('DELETE FROM listings WHERE id = ?').run(listing.id);
    return redirect(res, '/admin?done=deleted');
  }

  m = p.match(/^\/admin\/photos\/(\d+)\/(alt|move|delete)$/);
  if (m && req.method === 'POST') {
    const photo = db.prepare('SELECT * FROM photos WHERE id = ?').get(Number(m[1]));
    if (!photo) return null;
    if (m[2] === 'alt') {
      db.prepare('UPDATE photos SET alt = ? WHERE id = ?').run(String(body.alt || '').trim().slice(0, 200), photo.id);
    } else if (m[2] === 'delete') {
      removePhotoFiles(photo);
      db.prepare('DELETE FROM photos WHERE id = ?').run(photo.id);
    } else {
      const siblings = db.prepare('SELECT id FROM photos WHERE listing_id = ? ORDER BY sort, id').all(photo.listing_id).map((r) => r.id);
      const i = siblings.indexOf(photo.id);
      const j = i + (body.dir === '-1' ? -1 : 1);
      if (j >= 0 && j < siblings.length) {
        [siblings[i], siblings[j]] = [siblings[j], siblings[i]];
        const update = db.prepare('UPDATE photos SET sort = ? WHERE id = ?');
        siblings.forEach((id, sort) => update.run(sort, id));
      }
    }
    db.prepare("UPDATE listings SET updated_at = datetime('now') WHERE id = ?").run(photo.listing_id);
    return redirect(res, `/admin/listings/${photo.listing_id}?done=photo#photos-title`);
  }

  if (p === '/admin/inquiries' && req.method === 'GET') {
    const filter = ['new', 'replied', 'archived'].includes(url.searchParams.get('status')) ? url.searchParams.get('status') : 'new';
    const inquiries = db.prepare(`SELECT i.*, l.address AS listing_address FROM inquiries i LEFT JOIN listings l ON l.id = i.listing_id
                                  WHERE i.status = ? ORDER BY i.created_at DESC, i.id DESC LIMIT 200`).all(filter);
    const counts = Object.fromEntries(db.prepare('SELECT status, COUNT(*) AS n FROM inquiries GROUP BY status').all().map((r) => [r.status, r.n]));
    return sendHtml(req, res, admin.inquiriesPage({ session, inquiries, filter, newCount: newCount(), counts }));
  }

  m = p.match(/^\/admin\/inquiries\/(\d+)\/status$/);
  if (m && req.method === 'POST') {
    const status = ['new', 'replied', 'archived'].includes(body.status) ? body.status : 'new';
    const current = db.prepare('SELECT status FROM inquiries WHERE id = ?').get(Number(m[1]));
    if (!current) return null;
    db.prepare('UPDATE inquiries SET status = ? WHERE id = ?').run(status, Number(m[1]));
    return redirect(res, `/admin/inquiries?status=${current.status}`);
  }

  return null;
}

// ---------- Server ----------

const server = createServer(async (req, res) => {
  securityHeaders(res);
  let url;
  try {
    url = new URL(req.url, 'http://localhost');
  } catch {
    res.statusCode = 400;
    return res.end();
  }
  try {
    if ((req.method === 'GET' || req.method === 'HEAD') && serveStatic(req, res, url)) return;
    const handled = url.pathname === '/admin' || url.pathname.startsWith('/admin/')
      ? await adminRoutes(req, res, url)
      : await publicRoutes(req, res, url);
    if (handled === null && !res.headersSent) {
      if (!['GET', 'HEAD', 'POST'].includes(req.method)) {
        res.statusCode = 405;
        return res.end();
      }
      return sendHtml(req, res, pages.notFoundPage(), 404);
    }
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500;
    if (status === 500) console.error(err);
    if (res.headersSent) return res.end();
    const message = status === 500 ? 'The server couldn’t complete that request.' : err.message;
    if (wantsJson(req)) return sendJson(req, res, { ok: false, errors: { _form: message } }, status);
    return sendHtml(req, res, pages.errorPage(message), status);
  }
});

server.listen(PORT, () => {
  console.log(`${site.brand} running at http://localhost:${PORT}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => { db.close(); process.exit(0); }));
}
