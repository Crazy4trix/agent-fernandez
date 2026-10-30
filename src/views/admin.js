import { html } from '../html.js';
import { site } from '../config.js';
import { asset } from '../static.js';
import { STATUSES, PROPERTY_TYPES } from '../db.js';
import { money, photoUrl, field, formAlert } from './components.js';

const KIND = { buyer: 'Buyer', seller: 'Seller', listing: 'Listing question', general: 'General' };
const DETAIL = {
  budget: 'Price range', beds: 'Bedrooms', areas: 'Areas', timeline: 'Timeline', financing: 'Financing',
  property_address: 'Property', property_type: 'Type', tour: 'Showing',
};

function shell({ title, body, session, active, newCount = 0 }) {
  return html`<!doctype html>
<html lang="en" class="no-js">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${title} | ${site.brand} admin</title>
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="${asset('css/site.css')}">
<link rel="stylesheet" href="${asset('css/admin.css')}">
<script src="${asset('js/admin.js')}" defer></script>
</head>
<body class="admin">
<a class="skip" href="#main">Skip to content</a>
<header class="admin-header">
  <div class="wrap admin-header-inner">
    <a class="brand" href="/admin"><span class="wordmark">${site.brand}</span> <span class="admin-tag">Admin</span></a>
    ${session ? html`<nav aria-label="Admin">
      <a href="/admin" ${active === 'listings' ? html`aria-current="page"` : ''}>Listings</a>
      <a href="/admin/inquiries" ${active === 'inquiries' ? html`aria-current="page"` : ''}>Inquiries${newCount ? html` <span class="count">${newCount} new</span>` : ''}</a>
      <a href="/" target="_blank" rel="noopener">View site</a>
      <form method="post" action="/admin/logout"><input type="hidden" name="_csrf" value="${session.csrf}"><button type="submit" class="linklike">Sign out</button></form>
    </nav>` : ''}
  </div>
</header>
<main id="main" tabindex="-1" class="wrap admin-main" ${session ? html`data-csrf="${session.csrf}"` : ''}>
${body}
</main>
</body>
</html>`;
}

export function loginPage({ error, email = '', stamp }) {
  return shell({
    title: 'Sign in',
    body: html`<div class="login">
      <h1>Sign in</h1>
      <form method="post" action="/admin/login" novalidate>
        ${error ? html`<div class="form-alert" role="alert">${error}</div>` : ''}
        <input type="hidden" name="stamp" value="${stamp}">
        ${field({ name: 'email', label: 'Email', type: 'email', value: email, required: true, autocomplete: 'username' })}
        ${field({ name: 'password', label: 'Password', type: 'password', required: true, autocomplete: 'current-password' })}
        <button class="button" type="submit">Sign in</button>
      </form>
    </div>`,
  });
}

export function dashboardPage({ session, listings, newCount, flash }) {
  return shell({
    title: 'Listings', session, active: 'listings', newCount,
    body: html`
      <div class="admin-head">
        <h1>Listings</h1>
        <a class="button" href="/admin/listings/new">Add a listing</a>
      </div>
      ${flash ? html`<p class="flash" role="status">${flash}</p>` : ''}
      ${listings.length ? html`<div class="table-wrap"><table class="admin-table">
        <thead><tr><th scope="col"><span class="visually-hidden">Photo</span></th><th scope="col">Address</th><th scope="col">Status</th><th scope="col">Visibility</th><th scope="col" class="num">Price</th><th scope="col">Updated</th></tr></thead>
        <tbody>
        ${listings.map((l) => html`<tr>
          <td class="thumb">${l.photos[0] ? html`<img src="${photoUrl(l.photos[0], 640)}" alt="" width="96" height="64" loading="lazy">` : html`<span class="thumb-empty"></span>`}</td>
          <td><a href="/admin/listings/${l.id}">${l.address}</a>${l.is_sample ? html` <span class="badge">Sample</span>` : ''}${l.featured ? html` <span class="badge">Featured</span>` : ''}</td>
          <td>${STATUSES[l.status]}</td>
          <td>${l.published ? html`<a href="/listings/${l.slug}" target="_blank" rel="noopener">Published</a>` : 'Draft'}</td>
          <td class="num">${money(l.price)}</td>
          <td>${l.updated_at.slice(0, 10)}</td>
        </tr>`)}
        </tbody>
      </table></div>` : html`<div class="empty"><p>No listings yet. Add the first one and it will appear on the site once published.</p></div>`}`,
  });
}

export function listingFormPage({ session, listing, values, errors = {}, newCount, flash }) {
  const v = values || listing || { status: 'active', property_type: 'house', published: 0, featured: 0 };
  const isNew = !listing;
  const statusOptions = Object.entries(STATUSES);
  const typeOptions = Object.entries(PROPERTY_TYPES);
  return shell({
    title: isNew ? 'Add a listing' : listing.address, session, active: 'listings', newCount,
    body: html`
      <p class="crumb"><a href="/admin">All listings</a></p>
      <div class="admin-head">
        <h1>${isNew ? 'Add a listing' : listing.address}</h1>
        ${!isNew && listing.published ? html`<a class="text-link" href="/listings/${listing.slug}" target="_blank" rel="noopener">View on site</a>` : ''}
      </div>
      ${flash ? html`<p class="flash" role="status">${flash}</p>` : ''}
      ${!isNew && listing.is_sample ? html`<p class="flash">This is a sample listing included for design preview. Replace its details with a real home or delete it before launch.</p>` : ''}

      <form class="admin-form" method="post" action="${isNew ? '/admin/listings' : `/admin/listings/${listing.id}`}" novalidate>
        ${formAlert(errors)}
        <input type="hidden" name="_csrf" value="${session.csrf}">
        <fieldset>
          <legend>Location</legend>
          ${field({ name: 'address', label: 'Street address', value: v.address, error: errors.address, required: true })}
          <div class="field-row">
            ${field({ name: 'neighborhood', label: 'Neighborhood or subdivision', value: v.neighborhood, error: errors.neighborhood })}
            ${field({ name: 'city', label: 'City', value: v.city, error: errors.city, hint: 'For example: Newnan, GA' })}
          </div>
        </fieldset>
        <fieldset>
          <legend>Status and price</legend>
          <div class="field-row three">
            ${field({ name: 'status', label: 'Status', options: statusOptions, value: v.status, error: errors.status, required: true })}
            ${field({ name: 'property_type', label: 'Type', options: typeOptions, value: v.property_type, error: errors.property_type, required: true })}
            ${field({ name: 'price', label: 'Price (USD)', value: v.price, error: errors.price, required: true, inputmode: 'numeric' })}
          </div>
          <div class="check"><input type="checkbox" id="f-published" name="published" value="1" ${Number(v.published) ? html`checked` : ''}><label for="f-published">Published (visible on the public site)</label></div>
          <div class="check"><input type="checkbox" id="f-featured" name="featured" value="1" ${Number(v.featured) ? html`checked` : ''}><label for="f-featured">Featured on the home page</label></div>
        </fieldset>
        <fieldset>
          <legend>Particulars</legend>
          <div class="field-row three">
            ${field({ name: 'beds', label: 'Bedrooms', value: v.beds, error: errors.beds, inputmode: 'numeric' })}
            ${field({ name: 'baths', label: 'Bathrooms', value: v.baths, error: errors.baths, inputmode: 'decimal', hint: 'Use .5 for half baths' })}
            ${field({ name: 'sqft', label: 'Interior sq ft', value: v.sqft ?? '', error: errors.sqft, inputmode: 'numeric' })}
          </div>
          <div class="field-row">
            ${field({ name: 'lot', label: 'Lot size', value: v.lot, error: errors.lot, hint: 'For example: 0.42 acres' })}
            ${field({ name: 'year_built', label: 'Year built', value: v.year_built ?? '', error: errors.year_built, inputmode: 'numeric' })}
          </div>
        </fieldset>
        <fieldset>
          <legend>Description</legend>
          ${field({ name: 'headline', label: 'One-line summary', value: v.headline, error: errors.headline, hint: 'Shown under the address. Keep it to one sentence.' })}
          ${field({ name: 'description', label: 'Description', type: 'textarea', rows: 8, value: v.description, error: errors.description, hint: 'Leave a blank line between paragraphs.' })}
          ${field({ name: 'features', label: 'Features', type: 'textarea', rows: 6, value: v.features, error: errors.features, hint: 'One per line.' })}
        </fieldset>
        <div class="form-actions"><button class="button" type="submit">${isNew ? 'Create listing' : 'Save changes'}</button></div>
      </form>

      ${isNew ? html`<p class="fine">You can add photos after the listing is created.</p>` : html`
      <section class="photos-admin" aria-labelledby="photos-title" data-listing="${listing.id}">
        <h2 id="photos-title">Photos</h2>
        <p class="hint">The first photo is the cover. Photos are resized in your browser before upload, so large files from a camera are fine.</p>
        <div class="upload">
          <label class="button button-quiet" for="photo-input">Add photos</label>
          <input id="photo-input" class="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" multiple data-upload>
          <p class="upload-status" role="status" aria-live="polite"></p>
        </div>
        ${listing.photos.length ? html`<ol class="photo-list">
          ${listing.photos.map((p, i) => html`<li>
            <img src="${photoUrl(p, 640)}" alt="" width="240" height="160" loading="lazy">
            <form method="post" action="/admin/photos/${p.id}/alt" class="alt-form">
              <input type="hidden" name="_csrf" value="${session.csrf}">
              <label for="alt-${p.id}">Description for screen readers</label>
              <input id="alt-${p.id}" name="alt" value="${p.alt}" maxlength="200" required>
              <button type="submit" class="linklike">Save</button>
            </form>
            <div class="photo-actions">
              ${i > 0 ? html`<form method="post" action="/admin/photos/${p.id}/move"><input type="hidden" name="_csrf" value="${session.csrf}"><input type="hidden" name="dir" value="-1"><button class="linklike" type="submit">${i === 1 ? 'Make cover' : 'Move earlier'}</button></form>` : html`<span class="badge">Cover</span>`}
              ${i < listing.photos.length - 1 ? html`<form method="post" action="/admin/photos/${p.id}/move"><input type="hidden" name="_csrf" value="${session.csrf}"><input type="hidden" name="dir" value="1"><button class="linklike" type="submit">Move later</button></form>` : ''}
              <form method="post" action="/admin/photos/${p.id}/delete" data-confirm="Delete this photo? This can’t be undone."><input type="hidden" name="_csrf" value="${session.csrf}"><button class="linklike danger" type="submit">Delete</button></form>
            </div>
          </li>`)}
        </ol>` : html`<p class="empty">No photos yet. Listings without photos show a “Photos coming soon” panel.</p>`}
      </section>

      <section class="danger-zone" aria-labelledby="delete-title">
        <h2 id="delete-title">Delete this listing</h2>
        <p>Removes the listing and its photos from the site. Inquiries about it are kept.</p>
        <form method="post" action="/admin/listings/${listing.id}/delete" data-confirm="Delete ${listing.address} and all its photos? This can’t be undone.">
          <input type="hidden" name="_csrf" value="${session.csrf}">
          <button class="button button-danger" type="submit">Delete listing</button>
        </form>
      </section>`}`,
  });
}

export function inquiriesPage({ session, inquiries, filter, newCount, counts }) {
  const tabs = [['new', 'New'], ['replied', 'Replied'], ['archived', 'Archived']];
  return shell({
    title: 'Inquiries', session, active: 'inquiries', newCount,
    body: html`
      <div class="admin-head"><h1>Inquiries</h1></div>
      <nav class="tabs" aria-label="Inquiry status">
        ${tabs.map(([k, l]) => html`<a href="/admin/inquiries?status=${k}" ${filter === k ? html`aria-current="page"` : ''}>${l} <span class="tab-count">${counts[k] || 0}</span></a>`)}
      </nav>
      ${inquiries.length ? html`<ul class="inquiry-list">
        ${inquiries.map((q) => {
          const details = JSON.parse(q.details || '{}');
          return html`<li class="inquiry-item">
            <div class="inquiry-meta">
              <p class="inquiry-kind">${KIND[q.kind]}${q.listing_address ? html`: <a href="/admin/listings/${q.listing_id}">${q.listing_address}</a>` : ''}</p>
              <p class="inquiry-date"><time datetime="${q.created_at.replace(' ', 'T')}Z">${q.created_at.slice(0, 16)} UTC</time></p>
            </div>
            <p class="inquiry-name">${q.name}</p>
            <p><a href="mailto:${q.email}">${q.email}</a>${q.phone ? html` <span class="sep">/</span> <a href="tel:${q.phone.replace(/[^0-9+]/g, '')}">${q.phone}</a>` : ''}</p>
            ${Object.keys(details).length ? html`<dl class="inquiry-details">${Object.entries(details).map(([k, v]) => html`<div><dt>${DETAIL[k] || k}</dt><dd>${v}</dd></div>`)}</dl>` : ''}
            ${q.message ? html`<p class="inquiry-message">${q.message}</p>` : ''}
            <div class="inquiry-actions">
              ${tabs.filter(([k]) => k !== q.status).map(([k]) => html`<form method="post" action="/admin/inquiries/${q.id}/status">
                <input type="hidden" name="_csrf" value="${session.csrf}"><input type="hidden" name="status" value="${k}">
                <button class="button button-quiet button-small" type="submit">${k === 'new' ? 'Mark as new' : k === 'replied' ? 'Mark as replied' : 'Archive'}</button>
              </form>`)}
            </div>
          </li>`;
        })}
      </ul>` : html`<div class="empty"><p>${filter === 'new' ? 'No new inquiries. Messages from the buyer, seller, listing and contact forms will appear here.' : 'Nothing here yet.'}</p></div>`}`,
  });
}
