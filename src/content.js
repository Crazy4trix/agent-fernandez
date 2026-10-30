// Imports the listings kept in content/listings.json into an empty database, so a new
// server starts with the real listings. After that, the admin is the source of truth.
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { ROOT } from './config.js';

const FILE = path.join(ROOT, 'content/listings.json');

export function importContent(db) {
  if (!existsSync(FILE)) return;
  const listings = JSON.parse(readFileSync(FILE, 'utf8'));
  const cols = ['slug', 'status', 'published', 'featured', 'address', 'neighborhood', 'city', 'price', 'beds', 'baths', 'sqft',
    'lot', 'year_built', 'property_type', 'headline', 'description', 'features', 'listing_firm', 'licensee_owned'];
  const insertListing = db.prepare(`INSERT INTO listings (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`);
  const insertPhoto = db.prepare('INSERT INTO photos (listing_id, base, ext, widths, alt, sort) VALUES (?, ?, ?, ?, ?, ?)');
  db.exec('BEGIN');
  for (const l of listings) {
    const { lastInsertRowid: id } = insertListing.run(...cols.map((c) => l[c] ?? null));
    l.photos.forEach((p, sort) => insertPhoto.run(id, `/media/listings/${l.slug}/${p.file}`, 'webp', p.widths, p.alt, sort));
  }
  db.exec('COMMIT');
}
