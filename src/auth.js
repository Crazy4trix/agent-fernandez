import { scryptSync, randomBytes, timingSafeEqual, createHash, createHmac } from 'node:crypto';
import { db } from './db.js';
import { SECRET } from './config.js';

const SESSION_HOURS = 8;
export const SESSION_COOKIE = 'af_session';

// scrypt with N=2^15 — roughly 50–100 ms per hash on a modern server.
const SCRYPT = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export function hashPassword(password) {
  const salt = randomBytes(16);
  const key = scryptSync(password, salt, 64, SCRYPT);
  return `scrypt$${salt.toString('hex')}$${key.toString('hex')}`;
}

export function verifyPassword(password, stored) {
  const [scheme, saltHex, keyHex] = String(stored).split('$');
  if (scheme !== 'scrypt' || !saltHex || !keyHex) return false;
  const expected = Buffer.from(keyHex, 'hex');
  const actual = scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length, SCRYPT);
  return timingSafeEqual(actual, expected);
}

// A fixed hash to verify against when the email is unknown, so response time
// doesn't reveal which accounts exist.
const DUMMY_HASH = hashPassword(randomBytes(16).toString('hex'));

export function authenticate(email, password) {
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(String(email).trim());
  const ok = verifyPassword(String(password), user ? user.password_hash : DUMMY_HASH);
  return ok && user ? user : null;
}

export function upsertUser(email, password) {
  const hash = hashPassword(password);
  db.prepare(`INSERT INTO users (email, password_hash) VALUES (?, ?)
              ON CONFLICT(email) DO UPDATE SET password_hash = excluded.password_hash`).run(email.trim(), hash);
  // Changing a password signs out every existing session for that account.
  db.prepare('DELETE FROM sessions WHERE user_id = (SELECT id FROM users WHERE email = ?)').run(email.trim());
}

const sha256 = (value) => createHash('sha256').update(value).digest('hex');

export function createSession(userId) {
  const token = randomBytes(32).toString('base64url');
  const csrf = randomBytes(24).toString('base64url');
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now());
  db.prepare('INSERT INTO sessions (token_hash, user_id, csrf, expires_at) VALUES (?, ?, ?, ?)')
    .run(sha256(token), userId, csrf, Date.now() + SESSION_HOURS * 3600 * 1000);
  return { token, maxAge: SESSION_HOURS * 3600 };
}

export function sessionFromToken(token) {
  if (!token) return null;
  const row = db.prepare(`SELECT s.token_hash, s.csrf, s.expires_at, u.id AS user_id, u.email
                          FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?`).get(sha256(token));
  if (!row || row.expires_at < Date.now()) return null;
  return row;
}

export function destroySession(token) {
  if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(token));
}

export function safeEqual(a, b) {
  const x = Buffer.from(String(a ?? ''));
  const y = Buffer.from(String(b ?? ''));
  return x.length === y.length && timingSafeEqual(x, y);
}

// Signed "form issued at" stamp: rejects bots that post instantly or replay stale forms.
export function formStamp() {
  const t = Date.now().toString(36);
  return `${t}.${createHmac('sha256', SECRET).update(t).digest('base64url').slice(0, 22)}`;
}

export function checkFormStamp(stamp, { minMs = 2500, maxMs = 1000 * 3600 * 24 } = {}) {
  const [t, sig] = String(stamp || '').split('.');
  if (!t || !sig) return false;
  if (!safeEqual(sig, createHmac('sha256', SECRET).update(t).digest('base64url').slice(0, 22))) return false;
  const age = Date.now() - parseInt(t, 36);
  return age >= minMs && age <= maxMs;
}
