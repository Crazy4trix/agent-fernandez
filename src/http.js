import { gzipSync, brotliCompressSync, constants as zlib } from 'node:zlib';
import { TRUST_PROXY, COOKIE_SECURE, PRODUCTION } from './config.js';

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

const CSP = [
  "default-src 'self'",
  "img-src 'self' data: blob:",
  "style-src 'self'",
  "script-src 'self'",
  "font-src 'self'",
  "connect-src 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
].join('; ');

export function securityHeaders(res) {
  res.setHeader('Content-Security-Policy', CSP);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), interest-cohort=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  if (PRODUCTION) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
}

export function clientIp(req) {
  if (TRUST_PROXY) {
    const fwd = req.headers['x-forwarded-for'];
    if (fwd) return String(fwd).split(',')[0].trim();
  }
  return req.socket.remoteAddress || 'unknown';
}

export function parseCookies(req) {
  const out = {};
  for (const part of String(req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export function setCookie(res, name, value, { maxAge, path = '/' } = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`, `Path=${path}`, 'HttpOnly', 'SameSite=Strict'];
  if (COOKIE_SECURE) parts.push('Secure');
  if (maxAge !== undefined) parts.push(`Max-Age=${maxAge}`);
  const prev = res.getHeader('Set-Cookie') || [];
  res.setHeader('Set-Cookie', [...[].concat(prev), parts.join('; ')]);
}

export async function readBody(req, limit) {
  const declared = Number(req.headers['content-length'] || 0);
  if (declared > limit) throw new HttpError(413, 'Request is too large.');
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new HttpError(413, 'Request is too large.');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

// Parses urlencoded or JSON bodies into a plain object of strings (arrays for repeated keys).
export async function parseBody(req, limit = 64 * 1024) {
  const type = String(req.headers['content-type'] || '').split(';')[0].trim();
  const text = await readBody(req, limit);
  if (type === 'application/json') {
    try { return JSON.parse(text || '{}'); } catch { throw new HttpError(400, 'Request body is not valid JSON.'); }
  }
  if (type === 'application/x-www-form-urlencoded' || type === '') {
    const out = {};
    for (const [k, v] of new URLSearchParams(text)) {
      if (k in out) out[k] = [].concat(out[k], v);
      else out[k] = v;
    }
    return out;
  }
  throw new HttpError(415, 'Unsupported content type.');
}

// Rejects cross-site POSTs whose Origin doesn't match the Host (defence in depth on top of SameSite cookies).
export function checkOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return;
  let host;
  try { host = new URL(origin).host; } catch { throw new HttpError(403, 'Cross-site request blocked.'); }
  const expected = (TRUST_PROXY && req.headers['x-forwarded-host']) || req.headers.host;
  if (host !== expected) throw new HttpError(403, 'Cross-site request blocked.');
}

export const wantsJson = (req) => String(req.headers.accept || '').includes('application/json');

function compress(req, res, body) {
  if (body.length < 1024) return body;
  const accept = String(req.headers['accept-encoding'] || '');
  res.setHeader('Vary', 'Accept-Encoding');
  if (/\bbr\b/.test(accept)) {
    res.setHeader('Content-Encoding', 'br');
    return brotliCompressSync(body, { params: { [zlib.BROTLI_PARAM_QUALITY]: 5 } });
  }
  if (/\bgzip\b/.test(accept)) {
    res.setHeader('Content-Encoding', 'gzip');
    return gzipSync(body);
  }
  return body;
}

export function sendHtml(req, res, page, status = 200) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(compress(req, res, Buffer.from(String(page))));
}

export function sendJson(req, res, data, status = 200) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(compress(req, res, Buffer.from(JSON.stringify(data))));
}

export function redirect(res, location, status = 303) {
  res.statusCode = status;
  res.setHeader('Location', location);
  res.end();
}

export { compress };

// Fixed-window in-memory rate limiter. Fine for a single-process site.
export function rateLimiter({ windowMs, max }) {
  const hits = new Map();
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
  }, windowMs).unref();
  return {
    hit(key) {
      const now = Date.now();
      let entry = hits.get(key);
      if (!entry || entry.reset < now) hits.set(key, (entry = { count: 0, reset: now + windowMs }));
      entry.count++;
      return entry.count <= max;
    },
    reset(key) { hits.delete(key); },
    blocked(key) {
      const entry = hits.get(key);
      return !!entry && entry.reset > Date.now() && entry.count >= max;
    },
  };
}
