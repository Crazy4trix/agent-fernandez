import { html } from '../html.js';
import { site } from '../config.js';
import { PROPERTY_TYPES } from '../db.js';
import { BUYER_BUDGETS, TIMELINES, FINANCING } from '../forms.js';
import { layout, configured, tel, brokerageLine } from './layout.js';
import { emailEnabled } from '../email.js';
import {
  money, factsLine, place, picture, photoUrl, noPhoto, listingCard, particulars, field, antiSpam, formAlert, disclosures,
} from './components.js';

function portrait({ sizes, priority = false, className = 'portrait' }) {
  if (!site.portrait) return '';
  return html`<img class="${className}" src="${site.portrait}-960.webp"
    srcset="${site.portrait}-480.webp 480w, ${site.portrait}-960.webp 960w" sizes="${sizes}"
    width="960" height="1200" alt="${site.agentName}" decoding="async" ${priority ? html`fetchpriority="high"` : html`loading="lazy"`}>`;
}

const HERO_SIZES = '(min-width: 1440px) 1360px, calc(100vw - 32px)';

function heroPreload(p) {
  const widths = p.widths.split(',').map(Number);
  return { href: photoUrl(p, widths.at(-1)), srcset: widths.map((w) => `${photoUrl(p, w)} ${w}w`).join(', '), sizes: HERO_SIZES };
}

function sentState(kind) {
  const messages = {
    buyer: 'Kevin has your search details and will be in touch',
    seller: 'Kevin has your valuation request and will be in touch',
    listing: 'Kevin has your question about this home and will reply',
    general: 'Kevin has your message and will reply',
  };
  return html`<div class="form-sent" tabindex="-1" hidden>
    <p class="form-sent-title">Message sent.</p>
    <p>${messages[kind]} ${site.responseTime}.${emailEnabled ? ' A confirmation is on its way to your inbox.' : ''}</p>
  </div>`;
}

function inquiryForm({ kind, stamp, values = {}, errors = {}, fields, submit, extraHidden = '' }) {
  const sent = values._sent;
  return html`<div class="inquiry-wrap">
    <form class="inquiry" method="post" action="/inquire/${kind}" novalidate data-inquiry ${sent ? html`hidden` : ''}>
      ${formAlert(errors)}
      ${antiSpam(stamp)}
      ${extraHidden}
      ${fields}
      <div class="form-actions">
        <button class="button" type="submit">${submit}</button>
        <p class="fine">Kevin will only use your details to reply to this inquiry. <a href="/privacy">Privacy</a></p>
      </div>
    </form>
    ${sent ? html`<div class="form-sent" tabindex="-1"><p class="form-sent-title">Message sent.</p><p>Kevin will reply ${site.responseTime}.</p></div>` : sentState(kind)}
  </div>`;
}

const contactFields = (v, e, { messageLabel = 'Message', messageRequired = false, messageHint } = {}) => html`
  <div class="field-row">
    ${field({ name: 'name', label: 'Name', value: v.name, error: e.name, required: true, autocomplete: 'name' })}
    ${field({ name: 'email', label: 'Email', type: 'email', value: v.email, error: e.email, required: true, autocomplete: 'email' })}
  </div>
  ${field({ name: 'phone', label: 'Phone', type: 'tel', value: v.phone, error: e.phone, autocomplete: 'tel', inputmode: 'tel' })}
  ${field({ name: 'message', label: messageLabel, type: 'textarea', value: v.message, error: e.message, required: messageRequired, hint: messageHint, rows: 4 })}`;

// ---------- Home ----------

export function homePage({ featured, sold, stamp }) {
  const hero = featured.find((l) => l.photos.length) || null;
  const heroPhoto = hero && hero.photos[0];
  const rest = featured.filter((l) => l !== hero).slice(0, 4);
  const phone = configured(site.phone);

  const body = html`
  <section class="hero ${heroPhoto ? '' : 'hero-personal'}" aria-labelledby="hero-title">
    <div class="wrap">
      ${heroPhoto ? html`<figure class="hero-plate">
        <a href="/listings/${hero.slug}" tabindex="-1" aria-hidden="true">${picture(heroPhoto, { sizes: HERO_SIZES, priority: true, className: 'hero-img' })}</a>
      </figure>` : site.portrait ? html`<figure class="hero-portrait">${portrait({ sizes: '(min-width: 900px) 34vw, 100vw', priority: true, className: 'hero-img' })}</figure>` : ''}
      <div class="hero-text">
        <h1 id="hero-title">Newnan real estate, represented personally.</h1>
        <div class="hero-side">
          <p class="lede">I’m ${site.agentName}. I help buyers find the right home and sellers present theirs well, with one point of contact from the first conversation to the closing table.</p>
          <p class="actions">
            <a class="button" href="/listings">See homes for sale</a>
            <a class="button button-quiet" href="/sell">Request a valuation</a>
          </p>
        </div>
      </div>
      ${hero ? html`<a class="hero-caption" href="/listings/${hero.slug}">
        <span class="hero-caption-addr">${hero.address}</span>
        <span>${[place(hero), factsLine(hero)].filter(Boolean).join(', ')}${hero.is_sample ? ' (sample listing)' : ''}</span>
        <span class="hero-caption-price">${money(hero.price)}</span>
        ${disclosures(hero).length ? html`<span class="hero-caption-disclosure">${disclosures(hero).join(' ')}</span>` : ''}
      </a>` : ''}
    </div>
  </section>

  ${rest.length ? html`<section class="section" aria-labelledby="current-title">
    <div class="wrap">
      <div class="section-head">
        <h2 id="current-title">Homes for sale now</h2>
        <a class="text-link" href="/listings">All homes</a>
      </div>
      <div class="gallery-grid">
        ${rest.map((l, i) => listingCard(l, { sizes: i % 3 === 0 ? '(min-width: 900px) 56vw, 100vw' : '(min-width: 900px) 40vw, 100vw' }))}
      </div>
    </div>
  </section>` : ''}

  <section class="section band" aria-labelledby="paths-title">
    <div class="wrap">
      <h2 id="paths-title" class="visually-hidden">How Kevin can help</h2>
      <div class="paths">
        <div class="path">
          <h3>Buying in Newnan</h3>
          <p>Tell me what matters: schools, commute to Atlanta, land, a porch, room for family to visit. I’ll set up a search that fits, preview homes before you spend a Saturday on them, and tell you plainly what I think each one is worth.</p>
          <a class="button button-quiet" href="/buy">Start your home search</a>
        </div>
        <div class="path">
          <h3>Selling your home</h3>
          <p>A price backed by recent nearby sales, a short list of preparation worth doing (and what to skip), professional photography, and steady communication from listing day to closing.</p>
          <a class="button button-quiet" href="/sell">Request a valuation</a>
        </div>
      </div>
    </div>
  </section>

  <section class="section about" aria-labelledby="about-title">
    <div class="wrap about-grid">
      <div class="about-side">
        <h2 id="about-title">About Kevin</h2>
        ${heroPhoto && site.portrait ? html`<figure class="about-portrait">${portrait({ sizes: '(min-width: 900px) 24vw, 70vw' })}</figure>` : ''}
      </div>
      <div class="about-body">
        ${site.bio.map((p) => html`<p>${p}</p>`)}
        <p class="about-contact">
          ${phone ? html`<a href="${tel(phone)}">${phone}</a><br>` : ''}
          <a href="mailto:${site.email}">${site.email}</a>
        </p>
        <p class="fine">${brokerageLine()}</p>
      </div>
    </div>
  </section>

  ${sold.length ? html`<section class="section" aria-labelledby="sold-title">
    <div class="wrap">
      <div class="section-head">
        <h2 id="sold-title">Recently sold</h2>
        <a class="text-link" href="/listings?show=sold">All sold homes</a>
      </div>
      <ul class="sold-list">
        ${sold.map((l) => html`<li>
          <a href="/listings/${l.slug}">${l.photos[0] ? picture(l.photos[0], { sizes: '(min-width: 900px) 30vw, 100vw' }) : noPhoto()}</a>
          <p class="sold-addr"><a href="/listings/${l.slug}">${l.address}</a></p>
          <p class="sold-meta">${place(l)}${l.is_sample ? ' (sample)' : ''}. ${l.headline}</p>
        </li>`)}
      </ul>
    </div>
  </section>` : ''}

  <section class="section band" aria-labelledby="contact-title">
    <div class="wrap contact-grid">
      <div>
        <h2 id="contact-title">Talk to Kevin</h2>
        <p>Questions about a home, the market, or timing a move? Send a note and Kevin will reply ${site.responseTime}.</p>
      </div>
      ${inquiryForm({ kind: 'general', stamp, fields: contactFields({}, {}, { messageRequired: true }), submit: 'Send message' })}
    </div>
  </section>`;

  return layout({
    title: `${site.brand} | ${site.market} Real Estate`,
    description: `${site.brand}: ${site.agentName}, ${site.title} with ${site.team} at ${site.brokerage}. Homes for sale and selling services in ${site.market} and Coweta County.`,
    path: '/', home: true, body,
    image: heroPhoto ? photoUrl(heroPhoto, 1200) : null,
    preload: heroPhoto ? heroPreload(heroPhoto) : null,
  });
}

// ---------- Listings ----------

export const MAX_PRICES = [500000, 750000, 1000000, 1500000, 2000000, 3000000];

export function listingResults(listings, filters) {
  const noun = filters.show === 'sold' ? 'sold home' : 'home';
  return html`<div class="results" id="results">
    <p class="results-count" role="status">${listings.length} ${noun}${listings.length === 1 ? '' : 's'}</p>
    ${listings.length ? html`<div class="gallery-grid">
      ${listings.map((l, i) => listingCard(l, { sizes: i % 3 === 0 ? '(min-width: 900px) 56vw, 100vw' : '(min-width: 900px) 40vw, 100vw', headingLevel: 2, priority: i === 0 }))}
    </div>` : html`<div class="empty">
      <p>No homes match these filters. Try a higher price or fewer bedrooms.</p>
      <p>Many homes in Newnan sell before they reach the market. <a href="/buy">Tell Kevin what you’re looking for</a> and he’ll let you know when one fits.</p>
    </div>`}
  </div>`;
}

export function listingsPage({ listings, filters }) {
  const opt = (value, label, current) => html`<option value="${value}" ${String(current) === String(value) ? html`selected` : ''}>${label}</option>`;
  const body = html`
  <div class="wrap page-head">
    <h1>${filters.show === 'sold' ? 'Recently sold' : 'Homes for sale'}</h1>
    <p class="lede">Homes Kevin represents in ${site.market} and nearby. Every one has been visited in person.</p>
  </div>
  <div class="wrap">
    <form class="filters" method="get" action="/listings" data-filters aria-label="Filter homes">
      <fieldset class="segmented">
        <legend class="visually-hidden">Show</legend>
        <label><input type="radio" name="show" value="available" ${filters.show !== 'sold' ? html`checked` : ''}><span>For sale</span></label>
        <label><input type="radio" name="show" value="sold" ${filters.show === 'sold' ? html`checked` : ''}><span>Sold</span></label>
      </fieldset>
      <label class="filter">Type
        <select name="type">${opt('', 'Any type', filters.type)}${Object.entries(PROPERTY_TYPES).map(([v, l]) => opt(v, l, filters.type))}</select>
      </label>
      <label class="filter">Bedrooms
        <select name="beds">${opt('', 'Any', filters.beds || '')}${[1, 2, 3, 4, 5].map((n) => opt(n, `${n} or more`, filters.beds))}</select>
      </label>
      <label class="filter">Price
        <select name="max">${opt('', 'Any price', filters.maxPrice || '')}${MAX_PRICES.map((n) => opt(n, `Up to ${money(n)}`, filters.maxPrice))}</select>
      </label>
      <button class="button button-quiet filters-submit" type="submit">Show homes</button>
    </form>
    ${listingResults(listings, filters)}
  </div>`;
  return layout({
    title: filters.show === 'sold' ? 'Recently sold homes' : `Homes for sale in ${site.market}`,
    path: '/listings', body,
  });
}

export function listingPage({ listing: l, stamp, values = {}, errors = {} }) {
  const photos = l.photos;
  const body = html`
  <article class="listing">
    <div class="wrap">
      <p class="crumb"><a href="/listings">All homes</a></p>
      ${photos.length ? html`<div class="slides" data-slides>
        <div class="slides-track" tabindex="0" role="region" aria-label="Photos of ${l.address}">
          ${photos.map((p, i) => html`<figure class="slide" id="photo-${i + 1}">
            ${picture(p, { sizes: HERO_SIZES, priority: i === 0 })}
          </figure>`)}
        </div>
        ${photos.length > 1 ? html`<div class="slides-controls">
          <button type="button" class="slides-btn" data-dir="-1" aria-label="Previous photo">Previous</button>
          <p class="slides-count" aria-live="polite"><span data-current>1</span> of ${photos.length}</p>
          <button type="button" class="slides-btn" data-dir="1" aria-label="Next photo">Next</button>
        </div>` : ''}
      </div>` : noPhoto('listing-nophoto')}

      <header class="listing-head">
        <div>
          <h1>${l.address}</h1>
          <p class="listing-place">${place(l)}${l.status !== 'active' ? html` <span class="sep">/</span> <strong>${l.status === 'pending' ? 'Under contract' : 'Sold'}</strong>` : ''}</p>
        </div>
        <p class="listing-price">${money(l.price)}</p>
        <p class="ask-jump"><a href="#ask-title">${l.status === 'sold' ? 'Ask about similar homes' : 'Ask about this home'}</a></p>
      </header>
      ${disclosures(l).length ? html`<div class="disclosure">${disclosures(l).map((d) => html`<p>${d}</p>`)}</div>` : ''}
      ${l.is_sample ? html`<p class="sample-note">This is a sample listing shown for design preview. It is not a real property for sale.</p>` : ''}

      <div class="listing-body">
        <div class="listing-main">
          ${l.headline ? html`<p class="lede">${l.headline}</p>` : ''}
          ${l.description.split(/\n\s*\n/).filter(Boolean).map((p) => html`<p>${p}</p>`)}
          ${l.features.trim() ? html`<h2 class="minor">Features</h2>
            <ul class="features">${l.features.split('\n').map((f) => f.trim()).filter(Boolean).map((f) => html`<li>${f}</li>`)}</ul>` : ''}
          <h2 class="minor">Particulars</h2>
          ${particulars(l)}
          <p class="fine">${l.listing_firm
            ? html`Listing courtesy of ${l.listing_firm}. Advertised by ${site.agentName}, ${site.team}, ${site.brokerageLegalName}, ${site.brokeragePhone}.`
            : html`Listed by ${site.agentName}, ${site.team}, ${site.brokerageLegalName}, ${site.brokeragePhone}.`} Information deemed reliable but not guaranteed.</p>
        </div>
        <aside class="listing-aside" aria-labelledby="ask-title">
          <h2 id="ask-title">${l.status === 'sold' ? 'Looking for something similar?' : 'Ask about this home'}</h2>
          <p class="aside-sub">${site.agentName} <span class="sep">/</span> ${site.brokerage}</p>
          ${inquiryForm({
            kind: 'listing', stamp, values, errors,
            extraHidden: html`<input type="hidden" name="listing_id" value="${l.id}">`,
            fields: html`
              ${contactFields(values, errors, { messageLabel: 'Question or note' })}
              ${l.status !== 'sold' ? html`<div class="check">
                <input type="checkbox" id="f-tour" name="tour" value="yes" ${values.tour ? html`checked` : ''}>
                <label for="f-tour">I’d like a private showing</label>
              </div>` : ''}`,
            submit: l.status === 'sold' ? 'Send message' : 'Ask about this home',
          })}
        </aside>
      </div>
    </div>
  </article>`;
  return layout({
    title: `${l.address}${place(l) ? `, ${place(l)}` : ''}`,
    description: `${l.address}: ${factsLine(l)}. ${money(l.price)}. ${l.headline}`,
    path: `/listings/${l.slug}`, body,
    image: photos[0] ? photoUrl(photos[0], 1200) : null,
    noindex: !!l.is_sample,
  });
}

// ---------- Buy / Sell / Contact ----------

export function buyPage({ stamp, values = {}, errors = {} }) {
  const body = html`
  <div class="wrap page-head">
    <h1>Buying a home</h1>
    <p class="lede">The best homes in Newnan and Coweta County often go quickly. A clear brief, a ready pre-approval and an agent who previews homes for you make the difference.</p>
  </div>
  <div class="wrap split">
    <div class="prose">
      <h2>What working together looks like</h2>
      <p>We start with a conversation about how you live now and what needs to change. From there Kevin sets up a search that goes beyond the portals, including homes about to list through the JRB Dream Team network.</p>
      <ul class="plain-list">
        <li>Previews of homes before you visit, with photos of what the listing doesn’t show</li>
        <li>A written opinion of value before every offer, based on recent sales nearby</li>
        <li>Introductions to local lenders, inspectors and attorneys</li>
        <li>One point of contact through inspection, appraisal and closing</li>
      </ul>
    </div>
    <section class="form-panel" aria-labelledby="buy-form-title">
      <h2 id="buy-form-title">Tell Kevin what you’re looking for</h2>
      ${inquiryForm({
        kind: 'buyer', stamp, values, errors,
        fields: html`
          ${contactFields(values, errors, { messageLabel: 'Anything else Kevin should know', messageHint: 'Must-haves, deal-breakers, schools, commute.' })}
          <div class="field-row">
            ${field({ name: 'budget', label: 'Price range', options: BUYER_BUDGETS, value: values.budget, error: errors.budget })}
            ${field({ name: 'beds', label: 'Bedrooms', options: [1, 2, 3, 4, 5, 6].map((n) => [String(n), `${n} or more`]), value: values.beds, error: errors.beds })}
          </div>
          ${field({ name: 'areas', label: 'Areas you’re considering', value: values.areas, error: errors.areas, hint: 'For example: Downtown Newnan, Sharpsburg, Senoia.' })}
          <div class="field-row">
            ${field({ name: 'timeline', label: 'Timeline', options: TIMELINES, value: values.timeline, error: errors.timeline })}
            ${field({ name: 'financing', label: 'Financing', options: FINANCING, value: values.financing, error: errors.financing })}
          </div>`,
        submit: 'Start your home search',
      })}
    </section>
  </div>`;
  return layout({ title: `Buying a home in ${site.market}`, path: '/buy', body });
}

const SELL_STEPS = [
  ['Valuation visit', 'Kevin walks through the home with you and follows up with a written price opinion based on comparable sales.'],
  ['Preparation', 'A short, prioritized list of what to repair, stage or leave alone, with trusted trades if you want them.'],
  ['Photography and launch', 'Professional photography and a listing written for the people most likely to buy it.'],
  ['Offers and negotiation', 'Every offer explained side by side: price, terms, contingencies and certainty of closing.'],
  ['Closing', 'Kevin coordinates inspection, appraisal and the closing attorney so nothing slips.'],
];

export function sellPage({ stamp, values = {}, errors = {} }) {
  const body = html`
  <div class="wrap page-head">
    <h1>Selling your home</h1>
    <p class="lede">A sale goes best with an honest price, a well-prepared home and someone watching every detail. Here’s how Kevin handles it.</p>
  </div>
  <div class="wrap split">
    <div class="prose">
      <h2>From first visit to closing</h2>
      <ol class="steps">
        ${SELL_STEPS.map(([t, d]) => html`<li><h3>${t}</h3><p>${d}</p></li>`)}
      </ol>
    </div>
    <section class="form-panel" aria-labelledby="sell-form-title">
      <h2 id="sell-form-title">Request a valuation</h2>
      ${inquiryForm({
        kind: 'seller', stamp, values, errors,
        fields: html`
          ${field({ name: 'property_address', label: 'Property address', value: values.property_address, error: errors.property_address, required: true, autocomplete: 'street-address' })}
          <div class="field-row">
            ${field({ name: 'property_type', label: 'Property type', options: Object.values(PROPERTY_TYPES), value: values.property_type, error: errors.property_type })}
            ${field({ name: 'timeline', label: 'Timeline', options: TIMELINES, value: values.timeline, error: errors.timeline })}
          </div>
          ${contactFields(values, errors, { messageLabel: 'Anything Kevin should know about the home', messageHint: 'Recent updates, condition, the best time to visit.' })}`,
        submit: 'Request a valuation',
      })}
    </section>
  </div>`;
  return layout({ title: `Selling a home in ${site.market}`, path: '/sell', body });
}

export function contactPage({ stamp, values = {}, errors = {} }) {
  const phone = configured(site.phone);
  const body = html`
  <div class="wrap page-head">
    <h1>Contact</h1>
    <p class="lede">Call, email or send a message here. Kevin replies personally, ${site.responseTime}.</p>
  </div>
  <div class="wrap split">
    <div class="prose contact-card">
      <p class="contact-name">${site.agentName}</p>
      <p>${site.title}, ${site.team}<br>${site.brokerage}</p>
      <p>${phone ? html`<a href="${tel(phone)}">${phone}</a><br>` : ''}<a href="mailto:${site.email}">${site.email}</a></p>
      ${site.office ? html`<p>${site.office}</p>` : ''}
      <p>Serving ${site.serviceArea}.</p>
    </div>
    <section class="form-panel" aria-labelledby="contact-form-title">
      <h2 id="contact-form-title">Send a message</h2>
      ${inquiryForm({ kind: 'general', stamp, values, errors, fields: contactFields(values, errors, { messageRequired: true }), submit: 'Send message' })}
    </section>
  </div>`;
  return layout({ title: 'Contact Kevin Fernandez', path: '/contact', body });
}

export function privacyPage() {
  const body = html`
  <div class="wrap page-head"><h1>Privacy</h1></div>
  <div class="wrap prose narrow">
    <p>This site collects the details you choose to send through its forms: your name, email address, optional phone number, and what you tell ${site.agentName} about your plans. They are used only to reply to you and to help with your purchase or sale.</p>
    <p>Your details are stored securely on this site’s server and in ${site.agentName}’s email. They are not sold or shared with third parties for marketing. If you are referred to a lender, inspector or other professional, that only happens with your permission.</p>
    <p>The site sets no advertising or analytics cookies. A single security cookie is used only when ${site.agentName} signs in to manage listings.</p>
    <p>To see, correct or delete the details you’ve sent, email <a href="mailto:${site.email}">${site.email}</a>.</p>
  </div>`;
  return layout({ title: 'Privacy', path: '/privacy', body });
}

export function notFoundPage() {
  const body = html`<div class="wrap page-head">
    <h1>This page isn’t here</h1>
    <p class="lede">The home may have sold and been removed, or the link may be mistyped.</p>
    <p class="actions"><a class="button" href="/listings">See homes for sale</a> <a class="button button-quiet" href="/">Go to the home page</a></p>
  </div>`;
  return layout({ title: 'Page not found', path: '/404', body, noindex: true });
}

export function errorPage(message) {
  const body = html`<div class="wrap page-head">
    <h1>Something went wrong</h1>
    <p class="lede">${message || 'The server couldn’t complete that request.'} Try again, or email <a href="mailto:${site.email}">${site.email}</a>.</p>
  </div>`;
  return layout({ title: 'Error', path: '/error', body, noindex: true });
}
