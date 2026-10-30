import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { DATA_DIR } from './config.js';
import { seedListings } from './seed.js';

export const db = new DatabaseSync(path.join(DATA_DIR, 'site.db'));

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    csrf TEXT NOT NULL,
    expires_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS listings (
    id INTEGER PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending', 'sold')),
    published INTEGER NOT NULL DEFAULT 0,
    featured INTEGER NOT NULL DEFAULT 0,
    address TEXT NOT NULL,
    neighborhood TEXT NOT NULL DEFAULT '',
    city TEXT NOT NULL DEFAULT '',
    price INTEGER NOT NULL,
    beds INTEGER NOT NULL DEFAULT 0,
    baths REAL NOT NULL DEFAULT 0,
    sqft INTEGER,
    lot TEXT NOT NULL DEFAULT '',
    year_built INTEGER,
    property_type TEXT NOT NULL DEFAULT 'house',
    headline TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    features TEXT NOT NULL DEFAULT '',
    is_sample INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS photos (
    id INTEGER PRIMARY KEY,
    listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    base TEXT NOT NULL,
    ext TEXT NOT NULL DEFAULT 'webp',
    widths TEXT NOT NULL,
    alt TEXT NOT NULL DEFAULT '',
    sort INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS inquiries (
    id INTEGER PRIMARY KEY,
    kind TEXT NOT NULL CHECK (kind IN ('buyer', 'seller', 'listing', 'general')),
    listing_id INTEGER REFERENCES listings(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL DEFAULT '',
    message TEXT NOT NULL DEFAULT '',
    details TEXT NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'replied', 'archived')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS photos_listing ON photos (listing_id, sort);
  CREATE INDEX IF NOT EXISTS inquiries_status ON inquiries (status, created_at);
`);

const count = db.prepare('SELECT COUNT(*) AS n FROM listings').get().n;
if (count === 0) seedListings(db);

export function photosFor(listingIds) {
  if (!listingIds.length) return new Map();
  const rows = db
    .prepare(`SELECT * FROM photos WHERE listing_id IN (${listingIds.map(() => '?').join(',')}) ORDER BY sort, id`)
    .all(...listingIds);
  const map = new Map();
  for (const row of rows) {
    if (!map.has(row.listing_id)) map.set(row.listing_id, []);
    map.get(row.listing_id).push(row);
  }
  return map;
}

function withPhotos(listings) {
  const map = photosFor(listings.map((l) => l.id));
  for (const l of listings) l.photos = map.get(l.id) || [];
  return listings;
}

export const PROPERTY_TYPES = { house: 'House', condo: 'Condo', townhouse: 'Townhouse', land: 'Land' };
export const STATUSES = { active: 'For sale', pending: 'Under contract', sold: 'Sold' };

export function publicListings({ show = 'available', type = '', beds = 0, maxPrice = 0 } = {}) {
  const where = ['published = 1'];
  const args = [];
  if (show === 'sold') where.push("status = 'sold'");
  else where.push("status IN ('active', 'pending')");
  if (PROPERTY_TYPES[type]) { where.push('property_type = ?'); args.push(type); }
  if (beds > 0) { where.push('beds >= ?'); args.push(beds); }
  if (maxPrice > 0) { where.push('price <= ?'); args.push(maxPrice); }
  const rows = db
    .prepare(`SELECT * FROM listings WHERE ${where.join(' AND ')}
              ORDER BY featured DESC, CASE status WHEN 'active' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END, created_at DESC, id DESC`)
    .all(...args);
  return withPhotos(rows);
}

export function featuredListings(limit = 4) {
  const rows = db
    .prepare(`SELECT * FROM listings WHERE published = 1 AND status IN ('active', 'pending')
              ORDER BY featured DESC, created_at DESC, id DESC LIMIT ?`)
    .all(limit);
  return withPhotos(rows);
}

export function listingBySlug(slug) {
  const row = db.prepare('SELECT * FROM listings WHERE slug = ? AND published = 1').get(slug);
  return row ? withPhotos([row])[0] : null;
}

export function listingById(id) {
  const row = db.prepare('SELECT * FROM listings WHERE id = ?').get(id);
  return row ? withPhotos([row])[0] : null;
}

export function allListings() {
  return withPhotos(db.prepare('SELECT * FROM listings ORDER BY updated_at DESC, id DESC').all());
}

export function slugify(text) {
  return String(text)
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'listing';
}

export function uniqueSlug(base, exceptId = 0) {
  let slug = slugify(base);
  const taken = db.prepare('SELECT 1 FROM listings WHERE slug = ? AND id != ?');
  for (let i = 2; taken.get(slug, exceptId); i++) slug = `${slugify(base)}-${i}`;
  return slug;
}
