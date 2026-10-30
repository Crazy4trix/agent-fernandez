import { readFileSync, mkdirSync, existsSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const env = process.env;

export const PORT = Number(env.PORT) || 3000;
export const PRODUCTION = env.NODE_ENV === 'production';
export const DATA_DIR = path.resolve(ROOT, env.DATA_DIR || 'data');
export const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
// Only trust X-Forwarded-* headers when running behind a known reverse proxy.
export const TRUST_PROXY = env.TRUST_PROXY === '1';
// Secure cookies require HTTPS; on by default in production.
export const COOKIE_SECURE = env.COOKIE_SECURE ? env.COOKIE_SECURE === '1' : PRODUCTION;

mkdirSync(UPLOAD_DIR, { recursive: true });

export const site = JSON.parse(readFileSync(path.join(ROOT, 'config/site.json'), 'utf8'));
if (env.SITE_URL) site.siteUrl = env.SITE_URL;

// Secret used to sign form timestamps. Persisted so restarts don't invalidate open forms.
function loadSecret() {
  if (env.SESSION_SECRET) return env.SESSION_SECRET;
  const file = path.join(DATA_DIR, 'secret.key');
  if (!existsSync(file)) writeFileSync(file, randomBytes(32).toString('hex'), { mode: 0o600 });
  return readFileSync(file, 'utf8').trim();
}
export const SECRET = loadSecret();
