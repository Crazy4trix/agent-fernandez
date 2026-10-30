// Sample listings so the site has real content on first run. Every row is flagged
// is_sample = 1 and labelled "Sample" in the admin so it can be replaced or deleted.
// Photography: Unsplash (https://unsplash.com/license), stored locally in public/media/seed.

const W = '640,1200,2000';

const SAMPLES = [
  {
    address: '1180 Alder Way', neighborhood: 'Hillcrest', price: 2450000, beds: 4, baths: 3.5, sqft: 3860,
    lot: '0.42 acres', year_built: 2019, property_type: 'house', status: 'active', featured: 1,
    headline: 'A low, glass-walled house set among old oaks.',
    description: 'The living spaces open fully to the garden on two sides, so the house reads as one long room at dusk. Floors are wide-plank white oak throughout, and a wall of steel windows runs the length of the kitchen and dining room.\n\nThe primary suite sits in its own wing with a dressing room and a stone bath. Two further bedrooms share a bath at the opposite end, and a fourth works well as a study or guest room beside the garage.',
    features: 'Steel-framed windows\nWhite oak floors\nChef\'s kitchen with walk-in pantry\nPrimary suite in a separate wing\nTwo-car garage with EV charging\nMature oaks and irrigated garden',
    photos: [
      ['1600585154340-be6161a56a0c', 'The house at dusk, lit from within, beneath a large oak'],
      ['1600607687939-ce8a6c25118c', 'Living room with a pale sectional, timber wall and full-height glass'],
    ],
  },
  {
    address: '27 Harbor Lane', neighborhood: 'Bayside', price: 3195000, beds: 5, baths: 5, sqft: 4620,
    lot: '0.31 acres', year_built: 2021, property_type: 'house', status: 'active', featured: 1,
    headline: 'Clean white volumes around a sheltered pool terrace.',
    description: 'Built in 2021 and lived in lightly since. The ground floor wraps around the pool, with sliding glass on every side of the living room and a covered terrace for shade in the afternoon.\n\nUpstairs, four bedrooms each have their own bath, and the primary opens to a terrace with water views over the neighboring rooftops.',
    features: 'Heated saltwater pool\nCovered outdoor kitchen\nFloating staircase\nWhole-home audio\nRoof terrace off primary suite\nImpact-rated glazing',
    photos: [
      ['1613490493576-7fde63acd811', 'Two-storey white house with a long pool in the foreground'],
      ['1600573472550-8090b5e0745e', 'Glass-walled living area with a floating staircase overlooking the pool'],
      ['1484154218962-a197022b5858', 'White kitchen with black pendant lights and an island with stools'],
    ],
  },
  {
    address: '412 Linden Street', neighborhood: 'Old Orchard', price: 1285000, beds: 4, baths: 3, sqft: 2940,
    lot: '0.25 acres', year_built: 1928, property_type: 'house', status: 'active', featured: 0,
    headline: 'A 1928 house with its wraparound porch intact.',
    description: 'Renovated in 2022 with a light hand: the original staircase, window casings and porch columns stayed, while the kitchen, baths, wiring and plumbing were replaced.\n\nThe lot is deep and level, with a lawn large enough for a game of catch and a detached garage that could become a studio.',
    features: 'Wraparound porch\nOriginal millwork and staircase\nKitchen renovated 2022\nNew electrical and plumbing\nDetached garage\nDeep, level lawn',
    photos: [
      ['1570129477492-45c003edd2be', 'Grey shingle house with a white wraparound porch and a wide lawn'],
      ['1556912173-3bb406ef7e77', 'Kitchen with white cabinetry, marble counters and a professional range'],
    ],
  },
  {
    address: '9 Cedar Terrace', neighborhood: 'Westridge', price: 1740000, beds: 3, baths: 2.5, sqft: 2480,
    lot: '0.18 acres', year_built: 2016, property_type: 'house', status: 'pending', featured: 0,
    headline: 'Cedar, concrete and a courtyard you enter through.',
    description: 'An architect\'s own house, arranged around a planted entry court that keeps the street at a distance. Inside, the rooms are calm and well proportioned, with deep window seats and long sightlines to the garden.',
    features: 'Architect-designed\nPrivate entry courtyard\nPolished concrete floors with radiant heat\nCedar cladding\nSolar array',
    photos: [
      ['1600566753190-17f0baa2a6c3', 'Modern house with cedar and black cladding behind a planted courtyard'],
      ['1600210492486-724fe5c67fb0', 'Sunlit living room with leather chairs, plants and a gallery wall'],
    ],
  },
  {
    address: '3310 Vista Court', neighborhood: 'Bayside', price: 2180000, beds: 4, baths: 4, sqft: 3350,
    lot: '0.22 acres', year_built: 2018, property_type: 'house', status: 'active', featured: 0,
    headline: 'Indoor and outdoor rooms on one long, level lot.',
    description: 'A pool runs almost the full width of the garden, and the ground floor opens to it through pocketing glass doors. The upper floor has three bedrooms and a deep balcony that shades the terrace below.',
    features: 'Pocketing glass doors\nPool and spa\nBalcony off all upstairs bedrooms\nThree-car garage',
    photos: [
      ['1580587771525-78b9dba3b914', 'Modern house with a long pool and lawn in late afternoon light'],
    ],
  },
  {
    address: '58 Juniper Row', neighborhood: 'Old Orchard', price: 865000, beds: 3, baths: 2, sqft: 1720,
    lot: '0.16 acres', year_built: 1952, property_type: 'house', status: 'active', featured: 0,
    headline: 'A stone-chimneyed cottage on a quiet, tree-lined street.',
    description: 'Well kept by the same family for thirty years. The rooms are bright and simple, with a fireplace in the living room and a sunny kitchen that looks onto the back garden.',
    features: 'Stone fireplace\nUpdated kitchen\nFenced rear garden\nWalk to schools and park',
    photos: [
      ['1583608205776-bfd35f0d9f83', 'Grey cottage with a stone chimney, palms and a broad front lawn'],
      ['1522708323590-d24dbb6b0267', 'Bright open kitchen and living room with a red armchair'],
    ],
  },
  {
    address: '140 Larch Avenue', neighborhood: 'Westridge', price: 1560000, beds: 4, baths: 3, sqft: 2790,
    lot: '0.2 acres', year_built: 2017, property_type: 'house', status: 'sold', featured: 0,
    headline: 'Sold in nine days with multiple offers.',
    description: 'A modern family house with timber cladding and a landscaped front garden.',
    features: '',
    photos: [['1600047509807-ba8f99d2cdde', 'Modern house with timber cladding and a landscaped front path']],
  },
  {
    address: '6 Seawall Drive', neighborhood: 'Bayside', price: 2900000, beds: 5, baths: 4.5, sqft: 4100,
    lot: '0.28 acres', year_built: 2020, property_type: 'house', status: 'sold', featured: 0,
    headline: 'Sold above asking.',
    description: 'A white contemporary house with a pool terrace and roof deck.',
    features: '',
    photos: [['1600596542815-ffad4c1539a9', 'White contemporary house with a pool and roof deck under a blue sky']],
  },
  {
    address: '22 Rowan Place', neighborhood: 'Hillcrest', price: 1320000, beds: 3, baths: 2.5, sqft: 2210,
    lot: '0.14 acres', year_built: 2015, property_type: 'house', status: 'sold', featured: 0,
    headline: 'Sold before reaching the open market.',
    description: 'A gabled modern house with a private, gated front garden.',
    features: '',
    photos: [['1600563438938-a9a27216b4f5', 'Gabled modern house behind a slatted grey fence']],
  },
];

export function seedListings(db) {
  const insertListing = db.prepare(`
    INSERT INTO listings (slug, status, published, featured, address, neighborhood, city, price, beds, baths, sqft,
      lot, year_built, property_type, headline, description, features, is_sample, created_at, updated_at)
    VALUES (?, ?, 1, ?, ?, ?, '', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now', ?), datetime('now', ?))`);
  const insertPhoto = db.prepare('INSERT INTO photos (listing_id, base, ext, widths, alt, sort) VALUES (?, ?, ?, ?, ?, ?)');

  db.exec('BEGIN');
  SAMPLES.forEach((s, i) => {
    const slug = s.address.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const age = `-${i} days`;
    const { lastInsertRowid: id } = insertListing.run(
      slug, s.status, s.featured, s.address, s.neighborhood, s.price, s.beds, s.baths, s.sqft, s.lot,
      s.year_built, s.property_type, s.headline, s.description, s.features, age, age);
    s.photos.forEach(([file, alt], sort) => insertPhoto.run(id, `/media/seed/${file}`, 'webp', W, alt, sort));
  });
  db.exec('COMMIT');
}
