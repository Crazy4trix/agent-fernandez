import { readFileSync, statSync, createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { ROOT, UPLOAD_DIR } from './config.js';
import { compress } from './http.js';

const PUBLIC = path.join(ROOT, 'public');

const TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.woff2': 'font/woff2',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

// Content hashes for cache-busting: asset('css/site.css') -> /assets/css/site.css?v=1a2b3c4d
const hashes = new Map();
export function asset(file) {
  if (!hashes.has(file)) {
    const digest = createHash('sha1').update(readFileSync(path.join(PUBLIC, file))).digest('hex').slice(0, 10);
    hashes.set(file, digest);
  }
  return `/assets/${file}?v=${hashes.get(file)}`;
}

function resolveInside(base, rel) {
  const full = path.resolve(base, '.' + path.posix.normalize('/' + rel));
  return full.startsWith(base + path.sep) ? full : null;
}

// Serves /assets/*, /media/seed/* and /media/uploads/*. Returns false when the path isn't static.
export function serveStatic(req, res, url) {
  let file;
  let immutable = false;
  if (url.pathname.startsWith('/assets/')) {
    file = resolveInside(PUBLIC, url.pathname.slice('/assets/'.length));
    immutable = url.searchParams.has('v') || url.pathname.startsWith('/assets/fonts/');
  } else if (url.pathname.startsWith('/media/seed/')) {
    file = resolveInside(path.join(PUBLIC, 'media/seed'), url.pathname.slice('/media/seed/'.length));
    immutable = true;
  } else if (url.pathname.startsWith('/media/uploads/')) {
    file = resolveInside(UPLOAD_DIR, url.pathname.slice('/media/uploads/'.length));
    immutable = true; // upload filenames are random and never reused
  } else if (url.pathname === '/favicon.svg') {
    file = path.join(PUBLIC, 'favicon.svg');
  } else {
    return false;
  }

  let stat;
  try { stat = file && statSync(file); } catch { stat = null; }
  const type = file && TYPES[path.extname(file).toLowerCase()];
  if (!stat || !stat.isFile() || !type) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('Not found');
    return true;
  }

  res.setHeader('Content-Type', type);
  res.setHeader('Cache-Control', immutable ? 'public, max-age=31536000, immutable' : 'public, max-age=3600');
  const etag = `"${stat.size.toString(36)}-${stat.mtimeMs.toString(36)}"`;
  res.setHeader('ETag', etag);
  if (req.headers['if-none-match'] === etag) {
    res.statusCode = 304;
    res.end();
    return true;
  }
  if (/^text\/|svg/.test(type)) {
    res.end(compress(req, res, readFileSync(file)));
  } else {
    res.setHeader('Content-Length', stat.size);
    if (req.method === 'HEAD') res.end();
    else createReadStream(file).pipe(res);
  }
  return true;
}
