#!/usr/bin/env node
'use strict';

/*
 * The redesigned downloads' HTML sources (owner's PDF redesign brief,
 * 2026-10-12): A4, read on a phone first, no buttons.
 *
 *   node scripts/build-pdf-sources.js           write the sources
 *   node scripts/build-pdf-sources.js --check   fail if any is out of date
 *                                               (scripts/check-pdf-sources.js)
 *
 * Every sentence and figure on a spec sheet is read from the printable
 * catalogue (catalog/print, ar/catalog/print), the page the sheets used to be
 * printed from, so the two cannot say different things: change a product
 * there and the --check fails until this is run again. Only the design is
 * new, plus what the brief removes ("Request a Quote" and every other link
 * but the letterhead's email and phone).
 *
 * The sources are written to scripts/pdf-sources/, which the deploy prunes,
 * and printed by scripts/generate-export-catalog-pdf.js like every other PDF.
 *
 * Phase A builds one sheet, Green Olives, in both languages (SPEC_SHEETS).
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = 'scripts/pdf-sources';
const DESIGN = '/scripts/pdf-design/sheet.css';
const FONTS = '/assets/fonts/fonts.css';
const LOGO = '/assets/logo-BJ1TOn9V.png';

// The revision date printed on the redesigned documents.
const REVISED = '2026-10-13';

// Phase A: one product. Phase B adds the rest.
const SPEC_SHEETS = ['green'];

// The photographs each sheet carries (owner, 2026-10-13: the whole set uses
// photographs; no mixed sets). One photo by default; a second, with
// captions under both, is an optional slot any sheet can use (Green Olives:
// whole and pitted). Files live in scripts/pdf-design/photos/, prepared by
// scripts/prepare-pdf-photos.py: square, at least 300 ppi at the size they
// print, JPEG quality 85, no EXIF or GPS. A photo not supplied yet (file
// absent) is drawn as a neutral panel for working drafts, never captioned
// "pending", and the generator refuses to print a sheet that has one.
const PHOTO_DIR = 'scripts/pdf-design/photos';
const PHOTOS = {
  green: [
    { file: 'green-olives-whole.jpg', caption: { en: 'Whole green olives', ar: 'زيتون أخضر كامل' } },
    { file: 'green-olives-pitted.jpg', caption: { en: 'Pitted green olives', ar: 'زيتون أخضر منزوع النواة' } },
  ],
  stuffed: [{ file: 'stuffed-green-olives.jpg' }],
  black_natural: [{ file: 'natural-black-olives.jpg' }],
  oxidized_black: [{ file: 'oxidized-black-olives.jpg' }],
  jalapeno: [{ file: 'sliced-jalapeno-peppers.jpg' }],
  artichoke: [{ file: 'marinated-artichoke-hearts.jpg' }],
  pepperoncini: [{ file: 'pepperoncini-peppers.jpg' }],
};

/** The photo block: one or two squares, captioned when the sheet gives captions. */
function photosHtml(locale, key) {
  const list = PHOTOS[key];
  const cell = (ph) => {
    const have = fs.existsSync(path.join(ROOT, PHOTO_DIR, ph.file));
    const pic = have ? `<img src="/${PHOTO_DIR}/${ph.file}" alt="${ph.caption ? ph.caption[locale] : ''}" />`
      : '<div class="photo-panel" aria-hidden="true"></div>';
    return `<figure class="photo">${pic}${ph.caption ? `<figcaption>${ph.caption[locale]}</figcaption>` : ''}</figure>`;
  };
  return `<div class="hero-photos${list.length > 1 ? ' pair' : ''}">${list.map(cell).join('')}</div>`;
}

// The few words the new layout adds. Everything else comes from the catalogue.
const T = {
  en: {
    dir: 'ltr', kind: 'Product Specification Sheet', revised: 'Revised', page: 'Page',
    titleSuffix: ' — Product Specification Sheet | Triple Company for Industrial Development',
    brine: 'Brine specification', param: 'Parameter', spec: 'Specification',
    wordmark: 'TRIPLE COMPANY', tagline: 'for Industrial Development',
    address: ['Ouroba Square (<span class="ar-inline" lang="ar" dir="rtl">ميدان العروبة</span>), 5th Settlement,', 'New Cairo, Cairo, Egypt'],
    legal: 'Triple Company for Industrial Development',
  },
  ar: {
    dir: 'rtl', kind: 'ورقة مواصفات المنتج', revised: 'آخر تحديث', page: 'صفحة',
    titleSuffix: ' — ورقة مواصفات المنتج | الشركة الثلاثية للتنمية الصناعية',
    brine: 'مواصفات المحلول الملحي', param: 'البند', spec: 'المواصفة',
    wordmark: 'الشركة الثلاثية', tagline: 'للتنمية الصناعية',
    address: ['ميدان العروبة، التجمع الخامس،', 'القاهرة الجديدة، القاهرة، مصر'],
    legal: 'الشركة الثلاثية للتنمية الصناعية',
  },
};
const EMAIL = 'sales@olivesegypt.com';
const PHONE = { href: '+201006045961', text: '+20 100 604 5961' };

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const one = (re, s, what) => {
  const m = s.match(re);
  if (!m) throw new Error(`build-pdf-sources: could not find ${what}`);
  return m[1].trim();
};
const all = (re, s) => [...s.matchAll(re)].map((m) => m[1].trim());

/** One product's facts, exactly as the printable catalogue states them. */
function productFrom(locale, key) {
  const src = read(locale === 'en' ? 'catalog/print/index.html' : 'ar/catalog/print/index.html');
  const block = one(new RegExp(`(<section class="spec-card" data-slug="${key}"[\\s\\S]*?</section>)`), src, `${locale} ${key} card`);
  const labelled = (label) => {
    const re = new RegExp(`<h3 class="spec-full-label">([^<]*)</h3>\\s*([\\s\\S]*?)(?=<h3 class="spec-full-label"|<div class="stat-row"|$)`, 'g');
    const parts = [...block.matchAll(re)];
    if (!parts[label]) throw new Error(`build-pdf-sources: ${locale} ${key} has no label #${label}`);
    return { label: parts[label][1].trim(), body: parts[label][2] };
  };
  const formats = labelled(0);
  const calibers = labelled(1);
  const packaging = labelled(2);
  const bestFor = labelled(3);
  const stats = [...block.matchAll(/<p class="stat-label">([^<]*)<\/p><p class="stat-value"( dir="ltr")?>([\s\S]*?)<\/p>/g)]
    .map((m) => ({ label: m[1].trim(), value: m[3].trim(), ltr: Boolean(m[2]) }));
  const closing = one(/<p class="text-sm text-muted-foreground mt-8">([\s\S]*?)<a /, src, `${locale} closing sentence`);
  return {
    key,
    type: one(/<span class="spec-badge[^"]*">([^<]*)<\/span>/, block, `${locale} ${key} type`),
    name: one(/<h2[^>]*>([^<]*)<\/h2>/, block, `${locale} ${key} name`),
    lede: one(/<p class="text-sm text-muted-foreground mt-2">([\s\S]*?)<\/p>/, block, `${locale} ${key} description`),
    formats: { label: formats.label, items: all(/<span class="chip-format">([^<]*)<\/span>/g, formats.body) },
    calibers: { label: calibers.label, items: all(/<span class="chip">([^<]*)<\/span>/g, calibers.body), ltr: /dir="ltr"/.test(calibers.body) },
    packaging: { label: packaging.label, text: one(/<p[^>]*>([\s\S]*?)<\/p>/, packaging.body, `${locale} ${key} packaging`) },
    bestFor: { label: bestFor.label, items: all(/<li>([\s\S]*?)<\/li>/g, bestFor.body) },
    stats,
    closing,
  };
}

/*
 * Numbers in Arabic text, isolated left to right. Unmarked, a range such as
 * "140-360" at the end of an Arabic sentence was laid out, and extracted, as
 * "360-140" (found in the Phase A proof). Only text outside a tag is touched,
 * and a number already inside <span dir="ltr"> is left as it is.
 */
function isolateNumbers(locale, html) {
  if (locale !== 'ar') return html;
  let inLtr = 0;
  return html.split(/(<[^>]+>)/).map((part) => {
    if (part.startsWith('<')) {
      if (/^<span dir="ltr">$/.test(part)) inLtr++;
      else if (part === '</span>' && inLtr) inLtr--;
      return part;
    }
    return inLtr ? part : part.replace(/\d[\d.,\/\u2013%-]*\d%?|\d%?/g, (n) => `<span dir="ltr">${n}</span>`);
  }).join('');
}

/*
 * The packaging sentence as chips: its list of containers, without the
 * qualifier that follows them. The sentence itself is printed in full
 * beneath, unchanged.
 */
function packagingChips(locale, text) {
  if (locale === 'en') {
    const list = text.split(/, subject to/)[0];
    return list.split(/,\s*(?:or\s+)?/).map((s) => s.replace(/^or\s+/, '')).map((s) => s.charAt(0).toUpperCase() + s.slice(1));
  }
  const list = text.split(/،\s*حسب/)[0];
  return list.split(/،\s*/).map((s) => s.replace(/^أو\s+/, ''));
}

function masthead(locale) {
  const t = T[locale];
  return `<header class="masthead">
  <div class="brand">
    <img src="${LOGO}" alt="" width="236" height="289" />
    <div><div class="wordmark">${t.wordmark}</div><div class="tagline">${t.tagline}</div></div>
  </div>
  <div class="contact">
    ${t.address.join('<br/>')}<br/>
    <span dir="ltr"><a href="mailto:${EMAIL}">${EMAIL}</a> &middot; <a href="tel:${PHONE.href}">${PHONE.text}</a></span>
  </div>
</header>`;
}

function foot(locale, n, total) {
  const t = T[locale];
  return `<footer class="foot"><span>${t.legal}</span><span>${t.revised} <span dir="ltr">${REVISED}</span></span>` +
    `<span>${t.page} <span dir="ltr">${n} / ${total}</span></span><span>olivesegypt.com</span></footer>`;
}

function specSheetHtml(locale, key) {
  const t = T[locale];
  const p = productFrom(locale, key);
  const ltr = (s, on) => (on ? `<span dir="ltr">${s}</span>` : isolateNumbers(locale, s));
  const iso = (s) => isolateNumbers(locale, s);
  const chips = packagingChips(locale, p.packaging.text).map(iso);
  return `<!DOCTYPE html>
<!-- Written by scripts/build-pdf-sources.js from ${locale === 'en' ? 'catalog/print/index.html' : 'ar/catalog/print/index.html'}. Do not edit: edit the catalogue and rebuild. -->
<html lang="${locale}" dir="${t.dir}">
<head>
<meta charset="UTF-8" />
<title>${p.name}${t.titleSuffix}</title>
<link rel="stylesheet" href="${FONTS}" />
<link rel="stylesheet" href="${DESIGN}" />
</head>
<body>
<section class="pdf-page">
${masthead(locale)}
<div class="doc-line"><span class="doc-kind">${t.kind}</span><span>${t.revised} <span dir="ltr">${REVISED}</span></span></div>
<div class="hero">
  <div class="hero-text">
    <span class="pill">${p.type}</span>
    <h1>${p.name}</h1>
    <p class="lede">${iso(p.lede)}</p>
  </div>
  ${photosHtml(locale, key)}
</div>
<div class="glance">
  <div class="card"><p class="label">${p.formats.label}</p><ul>${p.formats.items.map((s) => `<li>${iso(s)}</li>`).join('')}</ul></div>
  <div class="card"><p class="label">${p.calibers.label}</p><p class="card-value">${p.calibers.items.map((s) => ltr(s, p.calibers.ltr)).join(', ')}</p></div>
  <div class="card"><p class="label">${p.bestFor.label}</p><ul>${p.bestFor.items.map((s) => `<li>${iso(s)}</li>`).join('')}</ul></div>
</div>
<div class="section">
  <h2>${t.brine}</h2>
  <table class="spec">
    <thead><tr><th scope="col">${t.param}</th><th scope="col">${t.spec}</th></tr></thead>
    <tbody>${p.stats.map((s) => `<tr><th scope="row">${s.label}</th><td>${ltr(s.value, s.ltr)}</td></tr>`).join('')}</tbody>
  </table>
</div>
<div class="section">
  <h2>${p.packaging.label}</h2>
  <ul class="chips">${chips.map((c) => `<li>${c}</li>`).join('')}</ul>
  <p class="body">${iso(p.packaging.text)}</p>
</div>
<p class="note">${iso(p.closing)}</p>
${foot(locale, 1, 1)}
</section>
</body>
</html>
`;
}

/** Every source this builder owns: { path, html }. */
function sources() {
  const out = [];
  for (const key of SPEC_SHEETS) {
    const dir = require('./products').PRODUCTS.find((p) => p.key === key).dir;
    for (const locale of ['en', 'ar']) {
      out.push({ path: `${OUT_DIR}/spec-sheets/${dir}-${locale}.html`, html: specSheetHtml(locale, key) });
    }
  }
  return out;
}

if (require.main === module) {
  const check = process.argv.includes('--check');
  const stale = [];
  for (const s of sources()) {
    const file = path.join(ROOT, s.path);
    const now = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
    if (now === s.html) continue;
    if (check) { stale.push(s.path); continue; }
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, s.html);
    console.log(`wrote ${s.path}`);
  }
  if (check) {
    if (stale.length) {
      console.error(`pdf-sources FAILED -- out of date with the catalogue: ${stale.join(', ')}\n  run: node scripts/build-pdf-sources.js, then rebuild those PDFs`);
      process.exit(1);
    }
    console.log(`pdf-sources OK -- ${sources().length} source(s) match the catalogue they are read from.`);
  }
}

module.exports = { PHOTOS, PHOTO_DIR, sources, SPEC_SHEETS, OUT_DIR, REVISED, productFrom, packagingChips, isolateNumbers };
