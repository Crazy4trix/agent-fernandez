// End-to-end tests. Run with `npm test`, which starts a throwaway server through the
// webapp-testing skill's with_server.py helper and then runs this file.
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const AXE = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const BASE = process.env.BASE_URL || 'http://localhost:4310';
const ADMIN = { email: 'test@example.com', password: 'correct-horse-battery-staple' };
const SHOTS = path.join(ROOT, 'tests/screenshots');
mkdirSync(SHOTS, { recursive: true });

const results = [];
async function test(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`  ok   ${name}`);
  } catch (err) {
    results.push({ name, ok: false, err });
    console.log(`  FAIL ${name}\n       ${String(err.message).split('\n').join('\n       ')}`);
  }
}
function assert(cond, message) { if (!cond) throw new Error(message); }
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ headless: true });

function trackErrors(page) {
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

async function scrollThrough(page) {
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 80)); }
    window.scrollTo(0, 0);
  });
}

const PUBLIC = ['/', '/listings', '/listings?show=sold', '/listings/1180-alder-way', '/buy', '/sell', '/contact', '/privacy'];

// ---------- Public pages ----------

console.log('\nPublic pages');

await test('every public page loads with one h1, a title and no console errors', async () => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errors = trackErrors(page);
  for (const url of PUBLIC) {
    const res = await page.goto(BASE + url, { waitUntil: 'networkidle' });
    assert(res.status() === 200, `${url} returned ${res.status()}`);
    assert(await page.locator('h1').count() === 1, `${url} should have exactly one h1`);
    assert((await page.title()).includes('Agent Fernandez'), `${url} title lacks brand: ${await page.title()}`);
  }
  assert(!errors.length, `console errors: ${errors.join(' | ')}`);
  await ctx.close();
});

await test('homepage SEO title, description, canonical and structured data', async () => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(BASE + '/');
  assert(await page.title() === 'Agent Fernandez | Newnan, GA Real Estate', `title was "${await page.title()}"`);
  const desc = await page.getAttribute('meta[name="description"]', 'content');
  assert(/Kevin Fernandez/.test(desc) && /Real Brokerage/.test(desc) && /JRB Dream Team/.test(desc), `description lacks brokerage info: ${desc}`);
  assert(await page.getAttribute('link[rel="canonical"]', 'href'), 'missing canonical');
  const ld = JSON.parse(await page.locator('script[type="application/ld+json"]').textContent());
  assert(ld['@type'] === 'RealEstateAgent' && ld.founder.name === 'Kevin Fernandez', 'structured data wrong');
  await ctx.close();
});

await test('branding: wordmark, professional name and brokerage identification', async () => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(BASE + '/');
  const mark = page.locator('.site-header .wordmark');
  assert((await mark.textContent()).trim() === 'Agent Fernandez', 'wordmark text');
  assert(await mark.evaluate((el) => getComputedStyle(el).textTransform) === 'uppercase', 'wordmark should render in capitals');
  const about = await page.locator('.about').textContent();
  assert(about.includes('Kevin Fernandez'), 'About should name Kevin Fernandez');
  const footer = await page.locator('.site-footer').textContent();
  for (const s of ['Kevin Fernandez', 'JRB Dream Team', 'Real Brokerage', 'Equal Housing Opportunity', 'Kevin@jrbdreamteam.com']) {
    assert(footer.includes(s), `footer lacks "${s}"`);
  }
  await ctx.close();
});

await test('security headers are set', async () => {
  const res = await fetch(BASE + '/');
  for (const h of ['content-security-policy', 'x-content-type-options', 'referrer-policy', 'x-frame-options', 'permissions-policy']) {
    assert(res.headers.get(h), `missing ${h}`);
  }
  assert(!/unsafe-inline/.test(res.headers.get('content-security-policy')), 'CSP allows unsafe-inline');
});

await test('static files cannot escape their folders', async () => {
  for (const p of ['/assets/../server.js', '/assets/%2e%2e/server.js', '/media/uploads/../site.db', '/media/seed/../../server.js']) {
    const res = await fetch(BASE + p);
    assert(res.status === 404, `${p} returned ${res.status}`);
  }
});

await test('accessibility: no axe violations on public pages (desktop and mobile)', async () => {
  const problems = [];
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const ctx = await browser.newContext({ viewport, reducedMotion: 'reduce', bypassCSP: true }); // axe is injected inline by the test only
    const page = await ctx.newPage();
    for (const url of PUBLIC) {
      await page.goto(BASE + url, { waitUntil: 'networkidle' });
      await page.addScriptTag({ content: AXE });
      const { violations } = await page.evaluate(() => window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice'] }));
      for (const v of violations) problems.push(`${viewport.width}px ${url}: ${v.id} (${v.nodes.length}) ${v.nodes[0].target.join(' ')}`);
    }
    await ctx.close();
  }
  assert(!problems.length, problems.join('\n'));
});

await test('keyboard: skip link is first and moves focus to main content', async () => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(BASE + '/listings');
  await page.keyboard.press('Tab');
  assert(await page.evaluate(() => document.activeElement.className) === 'skip', 'first tab stop is not the skip link');
  await page.keyboard.press('Enter');
  assert(await page.evaluate(() => document.activeElement.id) === 'main', 'skip link did not move focus');
  await ctx.close();
});

await test('reduced motion turns off the hero animation', async () => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto(BASE + '/');
  const anim = await page.locator('.hero-plate').evaluate((el) => getComputedStyle(el).animationName);
  assert(anim === 'none', `hero animation still ${anim}`);
  await ctx.close();
});

await test('performance: homepage weight and largest contentful paint', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  let bytes = 0;
  page.on('response', async (r) => { try { bytes += (await r.body()).length; } catch {} });
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  const lcp = await page.evaluate(() => new Promise((resolve) => {
    new PerformanceObserver((list) => { const e = list.getEntries(); resolve(e[e.length - 1].startTime); })
      .observe({ type: 'largest-contentful-paint', buffered: true });
  }));
  const cls = await page.evaluate(() => new Promise((resolve) => {
    let total = 0;
    new PerformanceObserver((list) => { for (const e of list.getEntries()) if (!e.hadRecentInput) total += e.value; })
      .observe({ type: 'layout-shift', buffered: true });
    setTimeout(() => resolve(total), 300);
  }));
  console.log(`       initial load ${(bytes / 1024).toFixed(0)} KB (decoded), LCP ${lcp.toFixed(0)} ms locally, CLS ${cls.toFixed(3)}`);
  assert(bytes < 900 * 1024, `homepage initial load is ${(bytes / 1024).toFixed(0)} KB`);
  assert(cls < 0.1, `layout shift ${cls}`);
  await ctx.close();
});

// ---------- Interactions ----------

console.log('\nInteractions');

await test('mobile menu opens, closes with Escape and returns focus', async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/');
  const toggle = page.locator('.menu-toggle');
  assert(await page.locator('#site-nav').isHidden(), 'nav should start hidden on mobile');
  await toggle.click();
  assert(await toggle.getAttribute('aria-expanded') === 'true', 'aria-expanded not set');
  await page.locator('#site-nav a', { hasText: 'Selling' }).waitFor({ state: 'visible' });
  await page.keyboard.press('Escape');
  assert(await toggle.getAttribute('aria-expanded') === 'false', 'Escape did not close');
  assert(await page.evaluate(() => document.activeElement.classList.contains('menu-toggle')), 'focus not returned');
  await ctx.close();
});

await test('listing filters update results in place and keep the URL shareable', async () => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(BASE + '/listings');
  const before = await page.locator('.results .card').count();
  await page.locator('label:has-text("Sold")').click();
  await page.waitForFunction(() => location.search.includes('show=sold'));
  await page.waitForFunction(() => document.querySelector('h1').textContent === 'Recently sold');
  const sold = await page.locator('.results .card').count();
  assert(sold === 3 && before === 6, `expected 6 for sale then 3 sold, got ${before} and ${sold}`);
  await page.locator('label:has-text("For sale")').click();
  await page.selectOption('select[name="max"]', '1000000');
  await page.waitForFunction(() => location.search.includes('max=1000000'));
  await page.waitForFunction(() => document.querySelectorAll('.results .card').length === 1);
  await page.selectOption('select[name="beds"]', '5');
  await page.waitForSelector('.empty');
  assert((await page.locator('.results-count').textContent()).startsWith('0'), 'empty state count');
  await ctx.close();
});

await test('filters work without JavaScript', async () => {
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  const page = await ctx.newPage();
  await page.goto(BASE + '/listings');
  await page.selectOption('select[name="beds"]', '5');
  await page.click('.filters-submit');
  await page.waitForURL(/beds=5/);
  assert(await page.locator('.results .card').count() === 1, 'expected one 5-bedroom home');
  await ctx.close();
});

await test('photo slides: next/previous buttons and arrow keys', async () => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(BASE + '/listings/27-harbor-lane');
  const count = page.locator('[data-current]');
  assert(await page.locator('.slides-btn[data-dir="-1"]').isDisabled(), 'previous should start disabled');
  await page.click('.slides-btn[data-dir="1"]');
  await page.waitForFunction(() => document.querySelector('[data-current]').textContent === '2');
  await page.focus('.slides-track');
  await page.keyboard.press('ArrowRight');
  await page.waitForFunction(() => document.querySelector('[data-current]').textContent === '3');
  assert(await page.locator('.slides-btn[data-dir="1"]').isDisabled(), 'next should be disabled on last photo');
  assert(await count.textContent() === '3', 'counter');
  await ctx.close();
});

// ---------- Inquiry forms ----------

console.log('\nInquiry forms');

await test('buyer form: inline validation errors, then a successful send', async () => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errors = trackErrors(page);
  await page.goto(BASE + '/buy');
  await wait(2600); // forms submitted faster than a person could are treated as spam
  await page.fill('#f-email', 'not-an-email');
  await page.click('button:has-text("Start your home search")');
  await page.waitForSelector('[data-field="name"].has-error');
  assert(await page.getAttribute('#f-name', 'aria-invalid') === 'true', 'aria-invalid missing');
  assert((await page.textContent('#f-email-error')).includes('name@example.com'), 'email error text');
  assert(await page.evaluate(() => document.activeElement.id) === 'f-name', 'focus should move to first invalid field');
  await page.fill('#f-name', 'Jordan Buyer');
  await page.fill('#f-email', 'jordan@example.com');
  await page.selectOption('#f-budget', '$750k–$1.25M');
  await page.selectOption('#f-timeline', 'Within 3 months');
  await page.fill('#f-areas', 'Downtown Newnan');
  await page.click('button:has-text("Start your home search")');
  await page.waitForSelector('.form-sent:not([hidden])');
  assert(await page.locator('form[data-inquiry]').isHidden(), 'form should hide after sending');
  await page.screenshot({ path: path.join(SHOTS, 'buyer-sent.png') });
  // The 422 response is expected; anything else is a real error.
  const real = errors.filter((e) => !/422/.test(e));
  assert(!real.length, real.join(' | '));
  await ctx.close();
});

await test('seller form works without JavaScript, including server-side errors', async () => {
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  const page = await ctx.newPage();
  await page.goto(BASE + '/sell');
  await wait(2600);
  await page.fill('#f-name', 'Sam Seller');
  await page.fill('#f-email', 'sam@example.com');
  await page.click('button:has-text("Request a valuation")');
  await page.waitForSelector('.form-alert:not([hidden])');
  assert((await page.textContent('#f-property_address-error')).includes('address'), 'missing address error');
  assert(await page.inputValue('#f-name') === 'Sam Seller', 'values should be kept after an error');
  await wait(2600);
  await page.fill('#f-property_address', '12 Jackson Street, Newnan, GA');
  await page.click('button:has-text("Request a valuation")');
  await page.waitForURL(/\/sell\?sent=1/);
  assert(await page.locator('.form-sent').isVisible(), 'confirmation not shown');
  await ctx.close();
});

await test('listing inquiry with showing request', async () => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(BASE + '/listings/412-linden-street');
  await wait(2600);
  await page.fill('#f-name', 'Lee Visitor');
  await page.fill('#f-email', 'lee@example.com');
  await page.check('#f-tour');
  await page.click('button:has-text("Ask about this home")');
  await page.waitForSelector('.form-sent:not([hidden])');
  await ctx.close();
});

await test('spam traps: honeypot and instant submissions are silently dropped', async () => {
  const page = await (await browser.newContext()).newPage();
  await page.goto(BASE + '/contact');
  const stamp = await page.inputValue('input[name="stamp"]');
  const post = (body) => fetch(BASE + '/inquire/general', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams(body),
  }).then((r) => r.json());
  const instant = await post({ stamp, name: 'Bot', email: 'bot@example.com', message: 'instant' });
  await wait(2600);
  const honey = await post({ stamp, name: 'Bot', email: 'bot@example.com', message: 'honeypot', website: 'http://spam' });
  assert(instant.ok && honey.ok, 'traps should look successful to bots');
  // Verified as absent from the admin inbox in the admin tests below.
});

await test('cross-site form posts are rejected', async () => {
  const res = await fetch(BASE + '/inquire/general', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Origin: 'https://evil.example' },
    body: 'name=x&email=x@example.com&message=x',
  });
  assert(res.status === 403, `expected 403, got ${res.status}`);
});

// ---------- Admin ----------

console.log('\nListing management');

await test('admin pages require sign-in', async () => {
  for (const p of ['/admin', '/admin/inquiries', '/admin/listings/new', '/admin/listings/1']) {
    const res = await fetch(BASE + p, { redirect: 'manual' });
    assert(res.status === 303 && res.headers.get('location') === '/admin/login', `${p} not protected (${res.status})`);
  }
  const post = await fetch(BASE + '/admin/listings/1/delete', { method: 'POST', redirect: 'manual' });
  assert(post.status === 401, `unauthenticated POST returned ${post.status}`);
});

await test('login: wrong password is rejected and repeated failures are throttled', async () => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  for (let i = 0; i < 5; i++) {
    await page.goto(BASE + '/admin/login');
    await page.fill('#f-email', 'locked@example.com');
    await page.fill('#f-password', 'wrong-password-' + i);
    await page.click('button:has-text("Sign in")');
    await page.waitForSelector('.form-alert');
  }
  await page.fill('#f-password', 'anything');
  const [res] = await Promise.all([page.waitForResponse((r) => r.url().endsWith('/admin/login') && r.request().method() === 'POST'), page.click('button:has-text("Sign in")')]);
  assert(res.status() === 429, `expected 429 after 5 failures, got ${res.status()}`);
  await ctx.close();
});

const adminCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const admin = await adminCtx.newPage();
const adminErrors = trackErrors(admin);

await test('admin signs in with a secure session cookie', async () => {
  await admin.goto(BASE + '/admin/login');
  await admin.fill('#f-email', ADMIN.email);
  await admin.fill('#f-password', ADMIN.password);
  await admin.click('button:has-text("Sign in")');
  await admin.waitForURL(BASE + '/admin');
  const cookie = (await adminCtx.cookies()).find((c) => c.name === 'af_session');
  assert(cookie && cookie.httpOnly && cookie.sameSite === 'Strict', 'session cookie flags');
  assert(await admin.locator('.admin-table tbody tr').count() === 9, 'expected 9 sample listings');
  await admin.screenshot({ path: path.join(SHOTS, 'admin-listings.png'), fullPage: true });
});

await test('inquiries reach the admin inbox; spam does not', async () => {
  await admin.goto(BASE + '/admin/inquiries');
  const text = await admin.locator('.inquiry-list').textContent();
  for (const n of ['Jordan Buyer', 'Sam Seller', 'Lee Visitor']) assert(text.includes(n), `${n} missing from inbox`);
  assert(!text.includes('Bot'), 'spam reached the inbox');
  assert(text.includes('Requested a private showing') && text.includes('412 Linden Street'), 'listing details missing');
  await admin.locator('.inquiry-item', { hasText: 'Jordan Buyer' }).locator('button:has-text("Mark as replied")').click();
  await admin.waitForURL(/status=new/);
  assert(!(await admin.locator('.inquiry-list').textContent()).includes('Jordan Buyer'), 'status change failed');
});

await test('create a listing: validation, then save as draft', async () => {
  await admin.goto(BASE + '/admin/listings/new');
  await admin.click('button:has-text("Create listing")');
  await admin.waitForSelector('.form-alert:not([hidden])');
  assert((await admin.textContent('#f-address-error')).length > 0, 'address error');
  await admin.fill('#f-address', '101 Test Avenue');
  await admin.fill('#f-city', 'Newnan, GA');
  await admin.selectOption('#f-status', 'active');
  await admin.selectOption('#f-property_type', 'house');
  await admin.fill('#f-price', '$675,000');
  await admin.fill('#f-beds', '3');
  await admin.fill('#f-baths', '2.5');
  await admin.fill('#f-headline', 'A test home <script>alert(1)</script>');
  await admin.fill('#f-description', 'First paragraph.\n\nSecond paragraph.');
  await admin.click('button:has-text("Create listing")');
  await admin.waitForURL(/\/admin\/listings\/\d+\?done=created/);
  const res = await fetch(BASE + '/listings/101-test-avenue');
  assert(res.status === 404, 'drafts must not be public');
});

await test('upload, describe, reorder and delete photos', async () => {
  const seed = path.join(ROOT, 'public/media/seed');
  await admin.setInputFiles('[data-upload]', [
    path.join(seed, '1600047509807-ba8f99d2cdde-2000.webp'),
    path.join(seed, '1600210492486-724fe5c67fb0-1200.webp'),
  ]);
  await admin.waitForURL(/done=photo/, { timeout: 20000 });
  assert(await admin.locator('.photo-list li').count() === 2, 'two photos expected');
  const firstAlt = admin.locator('.photo-list li').first().locator('input[name="alt"]');
  await firstAlt.fill('Front of the house with timber cladding');
  await admin.locator('.photo-list li').first().locator('button:has-text("Save")').click();
  await admin.waitForURL(/done=photo/);
  await admin.locator('.photo-list li').nth(1).locator('button:has-text("Make cover")').click();
  await admin.waitForURL(/done=photo/);
  assert(await admin.locator('.photo-list li').nth(1).locator('input[name="alt"]').inputValue() === 'Front of the house with timber cladding', 'reorder failed');
  admin.once('dialog', (d) => d.accept());
  await admin.locator('.photo-list li').first().locator('button:has-text("Delete")').click();
  await admin.waitForURL(/done=photo/);
  assert(await admin.locator('.photo-list li').count() === 1, 'delete failed');
});

await test('publish a listing; content is escaped on the public page', async () => {
  await admin.check('#f-published');
  await admin.click('button:has-text("Save changes")');
  await admin.waitForURL(/done=saved/);
  const page = await (await browser.newContext()).newPage();
  let alerted = false;
  page.on('dialog', (d) => { alerted = true; d.dismiss(); });
  await page.goto(BASE + '/listings/101-test-avenue');
  assert(await page.locator('h1').textContent() === '101 Test Avenue', 'listing not public');
  assert((await page.locator('.listing-price').textContent()) === '$675,000', 'price formatting');
  assert((await page.locator('.lede').textContent()).includes('<script>'), 'headline should show as text');
  assert(!alerted, 'script executed');
  assert(await page.locator('.listing-main > p').count() >= 2, 'paragraphs');
  await page.screenshot({ path: path.join(SHOTS, 'new-listing.png'), fullPage: true });
});

await test('admin writes require a valid CSRF token', async () => {
  const cookies = (await adminCtx.cookies()).map((c) => `${c.name}=${c.value}`).join('; ');
  const res = await fetch(BASE + '/admin/listings/1/delete', {
    method: 'POST', headers: { Cookie: cookies, 'Content-Type': 'application/x-www-form-urlencoded' }, body: '_csrf=wrong', redirect: 'manual',
  });
  assert(res.status === 403, `expected 403, got ${res.status}`);
  const upload = await fetch(BASE + '/admin/listings/1/photos', {
    method: 'POST', headers: { Cookie: cookies, 'Content-Type': 'application/json' }, body: JSON.stringify({ images: { 640: 'AAAA' } }),
  });
  assert(upload.status === 403, `upload without CSRF returned ${upload.status}`);
});

await test('uploads reject files that are not images', async () => {
  const csrf = await admin.locator('[data-csrf]').getAttribute('data-csrf');
  const id = admin.url().match(/listings\/(\d+)/)[1];
  const status = await admin.evaluate(async ({ id, csrf }) => {
    const r = await fetch(`/admin/listings/${id}/photos`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-CSRF-Token': csrf },
      body: JSON.stringify({ ext: 'webp', images: { 640: btoa('<?php echo 1; ?>') } }),
    });
    return r.status;
  }, { id, csrf });
  assert(status === 400, `expected 400, got ${status}`);
});

await test('delete a listing', async () => {
  admin.once('dialog', (d) => d.accept());
  await admin.click('button:has-text("Delete listing")');
  await admin.waitForURL(/done=deleted/);
  const res = await fetch(BASE + '/listings/101-test-avenue');
  assert(res.status === 404, 'deleted listing still public');
});

await test('sign out ends the session', async () => {
  await admin.click('button:has-text("Sign out")');
  await admin.waitForURL(/\/admin\/login/);
  await admin.goto(BASE + '/admin');
  assert(admin.url().endsWith('/admin/login'), 'session still valid');
  const real = adminErrors.filter((e) => !/40[0-9]|422/.test(e));
  assert(!real.length, real.join(' | '));
});

// ---------- Screenshots for visual review ----------

for (const [name, viewport] of [['desktop', { width: 1440, height: 900 }], ['mobile', { width: 390, height: 844 }]]) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  for (const url of ['/', '/listings', '/listings/27-harbor-lane', '/buy', '/sell', '/contact']) {
    await page.goto(BASE + url, { waitUntil: 'networkidle' });
    await scrollThrough(page);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(SHOTS, `${name}${url.replace(/[^a-z0-9]+/g, '-')}.png`), fullPage: true });
  }
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length} passed, ${failed.length} failed. Screenshots in tests/screenshots/`);
process.exit(failed.length ? 1 : 0);
