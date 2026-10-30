import { html, raw } from '../html.js';
import { site } from '../config.js';
import { asset } from '../static.js';

// Placeholder values in config/site.json are hidden from the public site until filled in.
export const configured = (v) => (v && !/000-0000/.test(v) ? v : '');

const tel = (phone) => 'tel:' + phone.replace(/[^0-9+]/g, '');

const NAV = [
  ['/listings', 'Homes'],
  ['/buy', 'Buying'],
  ['/sell', 'Selling'],
  ['/contact', 'Contact'],
];

export const absolute = (path) => new URL(path, site.siteUrl).href;

function structuredData() {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'RealEstateAgent',
    name: site.brand,
    url: site.siteUrl,
    email: site.email,
    founder: { '@type': 'Person', name: site.agentName, jobTitle: site.title },
    areaServed: site.market,
    parentOrganization: { '@type': 'Organization', name: site.brokerage },
  };
  if (configured(site.phone)) data.telephone = site.phone;
  // JSON is data, not script, so CSP doesn't block it; '<' is escaped so it can't close the tag.
  return raw(`<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`);
}

export function wordmark(tag = 'span') {
  // Set in capitals by CSS so screen readers announce the words, not letters.
  return html`<${raw(tag)} class="wordmark">${site.brand}</${raw(tag)}>`;
}

export function brokerageLine() {
  return html`${site.agentName}, ${site.title} <span class="sep">/</span> ${site.team} <span class="sep">/</span> ${site.brokerage}`;
}

export function layout({ title, description, path = '/', body, image, home = false, noindex = false, preload }) {
  const fullTitle = home ? title : `${title} | ${site.brand}`;
  const desc = description || `${site.brand}: ${site.agentName}, ${site.title} with ${site.team} at ${site.brokerage}, helping buyers and sellers in ${site.market}.`;
  return html`<!doctype html>
<html lang="en" class="no-js">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${fullTitle}</title>
<meta name="description" content="${desc}">
<link rel="canonical" href="${absolute(path)}">
${noindex ? html`<meta name="robots" content="noindex, nofollow">` : ''}
<meta property="og:site_name" content="${site.brand}">
<meta property="og:type" content="website">
<meta property="og:title" content="${fullTitle}">
<meta property="og:description" content="${desc}">
<meta property="og:url" content="${absolute(path)}">
${image ? html`<meta property="og:image" content="${absolute(image)}"><meta name="twitter:card" content="summary_large_image">` : ''}
<meta name="theme-color" content="#F5F0E6">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preload" href="/assets/fonts/newsreader.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/assets/fonts/albert-sans.woff2" as="font" type="font/woff2" crossorigin>
${preload ? html`<link rel="preload" as="image" href="${preload.href}" imagesrcset="${preload.srcset}" imagesizes="${preload.sizes}" fetchpriority="high">` : ''}
<link rel="stylesheet" href="${asset('css/site.css')}">
<script src="${asset('js/site.js')}" defer></script>
${home ? structuredData() : ''}
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="site-header">
  <div class="wrap header-inner">
    <a class="brand" href="/" ${path === '/' ? html`aria-current="page"` : ''}>${wordmark()}</a>
    <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="site-nav">Menu</button>
    <nav id="site-nav" class="site-nav" aria-label="Main">
      <ul>
        ${NAV.map(([href, label]) => html`<li><a href="${href}" ${path === href || path.startsWith(href + '/') ? html`aria-current="page"` : ''}>${label}</a></li>`)}
      </ul>
    </nav>
  </div>
</header>
<main id="main" tabindex="-1">
${body}
</main>
${footer()}
</body>
</html>`;
}

function footer() {
  const phone = configured(site.phone);
  const bPhone = configured(site.brokeragePhone);
  return html`<footer class="site-footer">
  <div class="wrap footer-grid">
    <div class="footer-brand">
      ${wordmark('p')}
      <p>${site.agentName}, ${site.title}<br>${site.team} at ${site.brokerage}<br>Serving ${site.market}</p>
      <p class="footer-brokerage">${site.brokerageLegalName || site.brokerage}${bPhone ? html` <span class="sep">/</span> <a href="${tel(bPhone)}">${bPhone}</a>` : ''}</p>
    </div>
    <div>
      <h2 class="footer-heading">Contact Kevin</h2>
      <ul class="footer-list">
        ${phone ? html`<li><a href="${tel(phone)}">${phone}</a></li>` : ''}
        <li><a href="mailto:${site.email}">${site.email}</a></li>
        <li><a href="/contact">Send a message</a></li>
      </ul>
    </div>
    <div>
      <h2 class="footer-heading">Explore</h2>
      <ul class="footer-list">
        ${NAV.slice(0, 3).map(([href, label]) => html`<li><a href="${href}">${label}</a></li>`)}
        <li><a href="/privacy">Privacy</a></li>
      </ul>
    </div>
  </div>
  <div class="wrap footer-legal">
    <p class="brokerage">
      ${site.brokerageLegalName || site.brokerage}${bPhone ? html`, ${bPhone}` : ''}${site.brokerageAddress ? html`, ${site.brokerageAddress}` : ''}${site.brokerageLicense ? html`. Georgia firm license ${site.brokerageLicense}` : ''}.
      ${site.agentName}${site.license ? html`, Georgia license ${site.license}` : ''}, is a licensed real estate salesperson affiliated with ${site.brokerage} and a member of ${site.team}.
    </p>
    <p>Equal Housing Opportunity. Information is deemed reliable but not guaranteed and should be independently verified.</p>
    <p>© ${new Date().getFullYear()} ${site.brand}. All rights reserved.</p>
  </div>
</footer>`;
}

export { tel };
