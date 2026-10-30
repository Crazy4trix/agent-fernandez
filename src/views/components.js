import { html } from '../html.js';
import { STATUSES, PROPERTY_TYPES } from '../db.js';

export const money = (n) => '$' + Number(n).toLocaleString('en-US');
const num = (n) => Number(n).toLocaleString('en-US');
const plural = (n, one, many) => `${n % 1 === 0 ? n : n} ${n === 1 ? one : many}`;

export function factsLine(l) {
  const parts = [];
  if (l.property_type === 'land') parts.push(l.lot || 'Land');
  else {
    if (l.beds) parts.push(plural(l.beds, 'bedroom', 'bedrooms'));
    if (l.baths) parts.push(plural(l.baths, 'bath', 'baths'));
    if (l.sqft) parts.push(`${num(l.sqft)} sq ft`);
  }
  return parts.join(', ');
}

// Georgia advertising disclosures that must travel with every ad for a listing.
export function disclosures(l) {
  const lines = [];
  if (l.listing_firm) lines.push(`Listing courtesy of ${l.listing_firm}.`);
  if (l.licensee_owned) lines.push('The seller holds a Georgia real estate license.');
  return lines;
}

export const place = (l) => [l.neighborhood, l.city].filter(Boolean).join(', ');

export function photoUrl(p, width) {
  return `${p.base}-${width}.${p.ext}`;
}

export function picture(p, { sizes = '100vw', priority = false, className = '' } = {}) {
  const widths = p.widths.split(',').map(Number).sort((a, b) => a - b);
  const fallback = widths.find((w) => w >= 1200) || widths[widths.length - 1];
  return html`<img class="${className}" src="${photoUrl(p, fallback)}"
    srcset="${widths.map((w) => `${photoUrl(p, w)} ${w}w`).join(', ')}" sizes="${sizes}"
    width="1200" height="800" alt="${p.alt}" decoding="async"
    ${priority ? html`fetchpriority="high"` : html`loading="lazy"`}>`;
}

export function noPhoto(className = '') {
  return html`<div class="no-photo ${className}"><span>Photos coming soon</span></div>`;
}

export function statusNote(l) {
  if (l.status === 'active') return '';
  return html`<span class="status status-${l.status}">${STATUSES[l.status]}</span>`;
}

// A listing presented like a mounted print with a gallery label beneath it.
export function listingCard(l, { sizes, headingLevel = 3, priority = false } = {}) {
  const cover = l.photos[0];
  const H = headingLevel === 2 ? 'h2' : 'h3';
  const heading = html`<${H} class="card-address"><a href="/listings/${l.slug}">${l.address}</a></${H}>`;
  return html`<article class="card">
    <a class="card-photo" href="/listings/${l.slug}" tabindex="-1" aria-hidden="true">
      ${cover ? picture(cover, { sizes, priority }) : noPhoto()}
    </a>
    <div class="card-label">
      <div class="card-title">
        ${heading}
        <p class="card-place">${place(l)}${l.status !== 'active' ? html` <span class="sep">/</span> ${STATUSES[l.status]}` : ''}${l.is_sample ? html` <span class="sep">/</span> <span class="sample">Sample listing</span>` : ''}</p>
      </div>
      <p class="card-price">${money(l.price)}</p>
      <p class="card-facts">${factsLine(l)}</p>
      ${disclosures(l).length ? html`<p class="card-disclosure">${disclosures(l).join(' ')}</p>` : ''}
    </div>
  </article>`;
}

export function particulars(l) {
  const rows = [
    ['Price', money(l.price)],
    ['Status', STATUSES[l.status]],
    ['Type', PROPERTY_TYPES[l.property_type]],
    l.property_type !== 'land' && l.beds ? ['Bedrooms', l.beds] : null,
    l.property_type !== 'land' && l.baths ? ['Bathrooms', l.baths] : null,
    l.sqft ? ['Interior', `${num(l.sqft)} sq ft`] : null,
    l.lot ? ['Lot', l.lot] : null,
    l.year_built ? ['Built', l.year_built] : null,
  ].filter(Boolean);
  return html`<dl class="particulars">${rows.map(([k, v]) => html`<div><dt>${k}</dt><dd>${v}</dd></div>`)}</dl>`;
}

// Form field with label, optional hint, inline error and the ARIA wiring between them.
export function field({ name, label, type = 'text', value = '', error, required = false, autocomplete, hint, options, rows, inputmode, className = '' }) {
  const id = `f-${name}`;
  const described = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || null;
  const common = html`id="${id}" name="${name}" ${required ? html`required aria-required="true"` : ''}
    ${error ? html`aria-invalid="true"` : ''} ${described ? html`aria-describedby="${described}"` : ''}`;
  let control;
  if (options) {
    control = html`<select ${common}>
      <option value="">${required ? 'Choose one' : 'No preference'}</option>
      ${options.map((o) => {
        const [v, text] = Array.isArray(o) ? o : [o, o];
        return html`<option value="${v}" ${String(value) === String(v) ? html`selected` : ''}>${text}</option>`;
      })}
    </select>`;
  } else if (type === 'textarea') {
    control = html`<textarea ${common} rows="${rows || 5}" maxlength="4000">${value}</textarea>`;
  } else {
    control = html`<input ${common} type="${type}" value="${value}"
      ${autocomplete ? html`autocomplete="${autocomplete}"` : ''} ${inputmode ? html`inputmode="${inputmode}"` : ''}>`;
  }
  return html`<div class="field ${className} ${error ? 'has-error' : ''}" data-field="${name}">
    <label for="${id}">${label}${required ? '' : html` <span class="optional">(optional)</span>`}</label>
    ${hint ? html`<p class="hint" id="${id}-hint">${hint}</p>` : ''}
    ${control}
    <p class="error" id="${id}-error" ${error ? '' : html`hidden`}>${error || ''}</p>
  </div>`;
}

// Hidden spam traps shared by every public form.
export function antiSpam(stamp) {
  return html`<input type="hidden" name="stamp" value="${stamp}">
    <div class="trap" aria-hidden="true">
      <label for="f-website">Leave this field empty</label>
      <input id="f-website" name="website" type="text" tabindex="-1" autocomplete="off">
    </div>`;
}

export function formAlert(errors) {
  if (!errors || !Object.keys(errors).length) return html`<div class="form-alert" role="alert" tabindex="-1" hidden></div>`;
  const n = Object.keys(errors).length;
  return html`<div class="form-alert" role="alert" tabindex="-1">${errors._form || `Check the ${n === 1 ? 'highlighted field' : `${n} highlighted fields`} and send again.`}</div>`;
}
