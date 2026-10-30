import { PROPERTY_TYPES } from './db.js';

export const BUYER_BUDGETS = ['Under $750k', '$750k–$1.25M', '$1.25M–$2M', '$2M–$3.5M', 'Over $3.5M'];
export const TIMELINES = ['As soon as possible', 'Within 3 months', '3–6 months', '6–12 months', 'Just exploring'];
export const FINANCING = ['Pre-approved for a mortgage', 'Paying cash', 'Not yet pre-approved'];

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const str = (v, max) => String(Array.isArray(v) ? v[0] : (v ?? '')).trim().slice(0, max);

// Validates a public inquiry. Returns { values, errors, details } where details are kind-specific extras.
export function validateInquiry(kind, body) {
  const values = {
    name: str(body.name, 120),
    email: str(body.email, 200),
    phone: str(body.phone, 40),
    message: str(body.message, 4000),
  };
  const errors = {};
  const details = {};

  if (!values.name) errors.name = 'Enter your name.';
  if (!values.email) errors.email = 'Enter your email address so Kevin can reply.';
  else if (!EMAIL.test(values.email)) errors.email = 'Enter an email address like name@example.com.';
  if (values.phone && !/^[0-9+().\-\s]{7,}$/.test(values.phone)) errors.phone = 'Enter a phone number using digits, spaces or dashes, or leave it blank.';

  const pick = (field, options, label) => {
    const v = str(body[field], 100);
    values[field] = v;
    if (v && !options.includes(v)) errors[field] = `Choose one of the listed ${label}.`;
    if (v) details[field] = v;
  };

  if (kind === 'buyer') {
    pick('budget', BUYER_BUDGETS, 'price ranges');
    pick('timeline', TIMELINES, 'timelines');
    pick('financing', FINANCING, 'options');
    values.areas = str(body.areas, 200);
    if (values.areas) details.areas = values.areas;
    values.beds = str(body.beds, 2);
    if (values.beds && !/^[1-6]$/.test(values.beds)) errors.beds = 'Choose a number of bedrooms.';
    else if (values.beds) details.beds = values.beds;
  } else if (kind === 'seller') {
    values.property_address = str(body.property_address, 200);
    if (!values.property_address) errors.property_address = 'Enter the address of the home you’re thinking of selling.';
    else details.property_address = values.property_address;
    pick('property_type', Object.values(PROPERTY_TYPES), 'property types');
    pick('timeline', TIMELINES, 'timelines');
  } else if (kind === 'listing') {
    values.tour = body.tour === 'yes' ? 'yes' : '';
    if (values.tour) details.tour = 'Requested a private showing';
  } else if (kind === 'general') {
    if (!values.message) errors.message = 'Write a short message so Kevin knows how to help.';
  }

  return { values, errors, details };
}

const int = (v) => {
  const n = Number(String(v ?? '').replace(/[$,\s]/g, ''));
  return Number.isFinite(n) ? Math.round(n) : NaN;
};

// Validates the admin listing form.
export function validateListing(body) {
  const v = {
    address: str(body.address, 160),
    neighborhood: str(body.neighborhood, 80),
    city: str(body.city, 80),
    status: str(body.status, 20),
    property_type: str(body.property_type, 20),
    price: str(body.price, 20),
    beds: str(body.beds, 3),
    baths: str(body.baths, 4),
    sqft: str(body.sqft, 8),
    lot: str(body.lot, 60),
    year_built: str(body.year_built, 4),
    headline: str(body.headline, 160),
    description: str(body.description, 8000),
    features: str(body.features, 2000),
    published: body.published === '1' ? 1 : 0,
    featured: body.featured === '1' ? 1 : 0,
  };
  const errors = {};
  if (!v.address) errors.address = 'Enter the street address.';
  if (!['active', 'pending', 'sold'].includes(v.status)) errors.status = 'Choose a status.';
  if (!PROPERTY_TYPES[v.property_type]) errors.property_type = 'Choose a property type.';
  const price = int(v.price);
  if (!(price > 0)) errors.price = 'Enter the price in dollars, for example 1250000.';
  const beds = v.beds === '' ? 0 : int(v.beds);
  if (!(beds >= 0 && beds <= 50)) errors.beds = 'Enter a whole number of bedrooms.';
  const baths = v.baths === '' ? 0 : Number(v.baths);
  if (!(baths >= 0 && baths <= 50) || (baths * 2) % 1 !== 0) errors.baths = 'Enter bathrooms in halves, for example 2.5.';
  const sqft = v.sqft === '' ? null : int(v.sqft);
  if (sqft !== null && !(sqft > 0 && sqft < 1e6)) errors.sqft = 'Enter interior area in square feet, or leave it blank.';
  const year = v.year_built === '' ? null : int(v.year_built);
  if (year !== null && !(year >= 1600 && year <= new Date().getFullYear() + 3)) errors.year_built = 'Enter a four-digit year, or leave it blank.';

  const data = { ...v, price, beds, baths, sqft, year_built: year };
  return { values: v, data, errors };
}
