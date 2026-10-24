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
 * Every product's sheet, and the combined file of all seven with a contents
 * page. A sheet is printed only when all its photographs are supplied
 * (READY_SHEETS); until then its source is a working draft.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = 'scripts/pdf-sources';
const DESIGN = '/scripts/pdf-design/sheet.css';
// The look the company profile and guides shipped with (Deploy 241, owner:
// "this one looks better"), carried over to the spec sheets.
const SHEET_LOOK = '/scripts/pdf-design/sheet-look.css';
const FONTS = '/assets/fonts/fonts.css';
const LOGO = '/assets/logo-BJ1TOn9V.png';

// The revision date printed on the redesigned documents.
const REVISED = '2026-10-13';

// Every product, in the site's order (scripts/products.js).
const { PRODUCTS } = require('./products');
const SPEC_SHEETS = PRODUCTS.map((p) => p.key);
const DIR_OF = Object.fromEntries(PRODUCTS.map((p) => [p.key, p.dir]));

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
  // Both the owner's oxidized photographs show pitted olives; the glossier,
  // clearer one is used (owner, 2026-10-13: "do what you think is recommended").
  oxidized_black: [{ file: 'oxidized-black-olives.jpg' }],
  // Captions are the catalogue's own format names (owner, 2026-10-13: both
  // photos for jalapeño).
  jalapeno: [
    { file: 'jalapeno-green-rings.jpg', caption: { en: 'Sliced Green Rings', ar: 'حلقات خضراء مقطعة' } },
    { file: 'jalapeno-red-rings.jpg', caption: { en: 'Sliced Red Rings', ar: 'حلقات حمراء مقطعة' } },
  ],
  artichoke: [{ file: 'marinated-artichoke-hearts.jpg' }],
  pepperoncini: [{ file: 'pepperoncini-peppers.jpg' }],
};

/** A sheet can be printed once every photograph it names is supplied. */
const ready = (key) => PHOTOS[key].every((ph) => fs.existsSync(path.join(ROOT, PHOTO_DIR, ph.file)));
const READY_SHEETS = SPEC_SHEETS.filter(ready);

/**
 * The photo block: one or two squares, captioned when the sheet gives captions.
 * Each frame is a <div>, not a <figure>: Chromium tags a <figure> as a second,
 * undescribed Figure around the photo's own (owner, 2026-10-24, after the PDF
 * accessibility audit). The caption repeats the photo's description, so it is
 * hidden from screen readers, which read the description once.
 */
function photosHtml(locale, key) {
  const list = PHOTOS[key];
  const cell = (ph) => {
    const have = fs.existsSync(path.join(ROOT, PHOTO_DIR, ph.file));
    const pic = have ? `<img src="/${PHOTO_DIR}/${ph.file}" alt="${ph.caption ? ph.caption[locale] : ''}" />`
      : '<div class="photo-panel" aria-hidden="true"></div>';
    return `<div class="photo">${pic}${ph.caption ? `<div class="photo-caption" aria-hidden="true">${ph.caption[locale]}</div>` : ''}</div>`;
  };
  return `<div class="hero-photos${list.length > 1 ? ' pair' : ''}">${list.map(cell).join('')}</div>`;
}

// The few words the new layout adds. Everything else comes from the catalogue.
const T = {
  en: {
    dir: 'ltr', kind: 'Product Specification Sheet', revised: 'Revised', page: 'Page',
    allKind: 'Product Specification Sheets', allTitle: 'Product Specifications | Triple Company for Industrial Development',
    contents: 'Contents', product: 'Product',
    titleSuffix: ' — Product Specification Sheet | Triple Company for Industrial Development',
    brine: 'Brine specification', param: 'Parameter', spec: 'Specification',
    wordmark: 'TRIPLE COMPANY', tagline: 'for Industrial Development',
    address: ['Ouroba Square (<span class="ar-inline" lang="ar" dir="rtl">ميدان العروبة</span>), 5th Settlement,', 'New Cairo, Cairo, Egypt'],
    legal: 'Triple Company for Industrial Development',
  },
  ar: {
    dir: 'rtl', kind: 'ورقة مواصفات المنتج', revised: 'آخر تحديث', page: 'صفحة',
    allKind: 'أوراق مواصفات المنتجات', allTitle: 'مواصفات المنتجات | الشركة الثلاثية للتنمية الصناعية',
    contents: 'المحتويات', product: 'المنتج',
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
    // A range as chips ("140-360"), or, where calibers are not fixed, the
    // catalogue's sentence ("Confirmed during quotation").
    calibers: (() => {
      const chips = all(/<span class="chip">([^<]*)<\/span>/g, calibers.body);
      const text = chips.length ? chips : all(/<p[^>]*>([\s\S]*?)<\/p>/g, calibers.body);
      if (!text.length) throw new Error(`build-pdf-sources: ${locale} ${key} calibers are empty`);
      return { label: calibers.label, items: text, ltr: chips.length > 0 && /dir="ltr"/.test(calibers.body) };
    })(),
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
  // In English a range only needs keeping on one line ("140-\n360" read
  // badly on the natural black sheet).
  if (locale !== 'ar') {
    return html.split(/(<[^>]+>)/).map((part) => (part.startsWith('<') ? part
      : part.replace(/\d+(?:[.,]\d+)?[\u2013-]\d+(?:[.,]\d+)?%?/g, (n) => `<span class="nb">${n}</span>`))).join('');
  }
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

/*
 * Under the chips, only the qualifier that follows the containers ("subject
 * to product and order volume"): the chips already list them, and the full
 * sentence repeated them (owner, 2026-10-14: "a little bit crowded", "do 2").
 * Still read from the catalogue's own sentence.
 */
function packagingQualifier(locale, text) {
  const q = locale === 'en' ? text.split(/,\s*(?=subject to)/)[1] : text.split(/،\s*(?=حسب)/)[1];
  if (!q) throw new Error(`build-pdf-sources: ${locale} packaging sentence has no qualifier: ${text}`);
  return locale === 'en' ? q.charAt(0).toUpperCase() + q.slice(1) : q;
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

const doc = (locale, title, pages) => `<!DOCTYPE html>
<!-- Written by scripts/build-pdf-sources.js from ${locale === 'en' ? 'catalog/print/index.html' : 'ar/catalog/print/index.html'}. Do not edit: edit the catalogue and rebuild. -->
<html lang="${locale}" dir="${T[locale].dir}">
<head>
<meta charset="UTF-8" />
<title>${title}</title>
<link rel="stylesheet" href="${FONTS}" />
<link rel="stylesheet" href="${DESIGN}" />
<link rel="stylesheet" href="${SHEET_LOOK}" />
</head>
<body>
${pages.join('\n')}
<script>
// Fitting (sheet.css): a page whose content reaches its foot tightens its
// spacing a step at a time. The generator still refuses a page that does
// not fit after the last step.
// The generator calls tcFit() again once the PDF's own fonts are applied,
// since those (Amiri above all) set taller lines than the screen fonts.
window.tcFit = () => {
  for (const pg of document.querySelectorAll('.pdf-page')) {
    pg.classList.remove('fit-0', 'fit-1', 'fit-2');
    const over = () => {
      const foot = pg.querySelector('.foot').getBoundingClientRect().top - 2;
      return [...pg.children].some((el) => !el.classList.contains('foot') && el.getBoundingClientRect().bottom > foot);
    };
    for (const step of ['fit-0', 'fit-1', 'fit-2']) { if (!over()) break; pg.classList.add(step); }
  }
};
window.tcFit();
</script>
</body>
</html>
`;

// The type pill names the product's category. Where it only repeats the
// name ("Green Olive" over "Green Olives"), it is left out.
const repeatsName = (type, name) => [type, `${type}s`].includes(name);

/** One product's page. */
function sheetPage(locale, key, n, total, kind) {
  const t = T[locale];
  const p = productFrom(locale, key);
  const ltr = (s, on) => (on ? `<span dir="ltr">${s}</span>` : isolateNumbers(locale, s));
  const iso = (s) => isolateNumbers(locale, s);
  const chips = packagingChips(locale, p.packaging.text).map(iso);
  return `<section class="pdf-page" id="${DIR_OF[key]}">
<div class="sheet-band">
${masthead(locale)}
<div class="doc-line"><span class="doc-kind">${kind}</span><span>${t.revised} <span dir="ltr">${REVISED}</span></span></div>
</div>
<div class="hero">
  <div class="hero-text">
    ${repeatsName(p.type, p.name) ? '' : `<span class="pill">${p.type}</span>`}
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
  <p class="body">${iso(packagingQualifier(locale, p.packaging.text))}</p>
</div>
<p class="note">${iso(p.closing)}</p>
${foot(locale, n, total)}
</section>`;
}

function specSheetHtml(locale, key) {
  const p = productFrom(locale, key);
  return doc(locale, `${p.name}${T[locale].titleSuffix}`, [sheetPage(locale, key, 1, 1, T[locale].kind)]);
}

/*
 * All seven sheets in one file: a contents page first, which doubles as the
 * range at a glance (product, its formats and calibers, and the page it is
 * on, each name a link to its page), then one product per page in the
 * site's order, each laid out exactly as its own sheet.
 */
/*
 * The range at a glance: product, formats, calibers and the page each is on
 * (each name a link to its page), with the catalogue's closing sentence.
 * pageOf(i) is the page product i starts on; n and total number this page.
 */
function contentsPage(locale, kind, pageOf, n, total) {
  const t = T[locale];
  const iso = (s) => isolateNumbers(locale, s);
  const rows = SPEC_SHEETS.map((key, i) => {
    const p = productFrom(locale, key);
    return `<tr><th scope="row"><a href="#${DIR_OF[key]}">${p.name}</a><span class="row-type">${p.type}</span></th>` +
      `<td>${p.formats.items.map(iso).join(', ')}</td>` +
      `<td>${p.calibers.items.map((s) => (p.calibers.ltr ? `<span dir="ltr">${s}</span>` : iso(s))).join(', ')}</td>` +
      `<td class="num"><span dir="ltr">${pageOf(i)}</span></td></tr>`;
  }).join('');
  const first = productFrom(locale, SPEC_SHEETS[0]);
  return `<section class="pdf-page contents-page">
<div class="sheet-band">
${masthead(locale)}
<div class="doc-line"><span class="doc-kind">${kind}</span><span>${t.revised} <span dir="ltr">${REVISED}</span></span></div>
</div>
<h1>${t.contents}</h1>
<table class="spec contents">
  <thead><tr><th scope="col">${t.product}</th><th scope="col">${first.formats.label}</th><th scope="col">${first.calibers.label}</th><th scope="col" class="num">${t.page}</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
<p class="note">${iso(first.closing)}</p>
${foot(locale, n, total)}
</section>`;
}

/*
 * All seven sheets in one file: the contents page first, then one product
 * per page in the site's order, each laid out exactly as its own sheet.
 */
function allSheetsHtml(locale) {
  const t = T[locale];
  const total = SPEC_SHEETS.length + 1;
  return doc(locale, t.allTitle, [contentsPage(locale, t.allKind, (i) => i + 2, 1, total),
    ...SPEC_SHEETS.map((key, i) => sheetPage(locale, key, i + 2, total, t.kind))]);
}

/*
 * The product catalogue (Downloads: "Full Product Catalog"; owner,
 * 2026-10-14: one product per page, "do 3"). A cover with the catalogue's
 * own title, date and summary line from catalog/print, over a photograph of
 * every product with its name; then the contents page and one page per
 * product, as in the combined sheets. Printed only when every photograph
 * is in, like the sheets.
 */
function catalogueHtml(locale) {
  const t = T[locale];
  const src = read(locale === 'en' ? 'catalog/print/index.html' : 'ar/catalog/print/index.html');
  const title = one(/<h1[^>]*>([^<]*)<\/h1>/, src, `${locale} catalogue title`);
  const meta = one(/<p id="doc-meta"[^>]*>([^<]*)<\/p>/, src, `${locale} catalogue summary line`);
  const total = SPEC_SHEETS.length + 2;
  const tiles = SPEC_SHEETS.map((key) => {
    const p = productFrom(locale, key);
    const ph = PHOTOS[key][0];
    const have = fs.existsSync(path.join(ROOT, PHOTO_DIR, ph.file));
    const pic = have ? `<img src="/${PHOTO_DIR}/${ph.file}" alt="" />` : '<div class="photo-panel" aria-hidden="true"></div>';
    // A <div>, like the sheets' photos: the image is decoration, the name is read.
    return `<div class="cat-tile">${pic}<div class="tile-caption">${p.name}</div></div>`;
  }).join('');
  const cover = `<section class="pdf-page cat-cover">
<div class="sheet-band">
${masthead(locale)}
</div>
<div class="cat-title"><h1>${title}</h1><p class="cat-date">${t.revised} <span dir="ltr">${REVISED}</span></p><p class="cat-meta">${isolateNumbers(locale, meta)}</p></div>
<div class="cat-grid">${tiles}</div>
${foot(locale, 1, total)}
</section>`;
  return doc(locale, `${title} | ${t.legal}`, [cover, contentsPage(locale, title, (i) => i + 3, 2, total),
    ...SPEC_SHEETS.map((key, i) => sheetPage(locale, key, i + 3, total, title))]);
}

/** Every source this builder owns: { path, html }. */
function sources() {
  const out = [];
  for (const key of SPEC_SHEETS) {
    for (const locale of ['en', 'ar']) {
      out.push({ path: `${OUT_DIR}/spec-sheets/${DIR_OF[key]}-${locale}.html`, html: specSheetHtml(locale, key) });
    }
  }
  for (const locale of ['en', 'ar']) {
    out.push({ path: `${OUT_DIR}/spec-sheets/all-spec-sheets-${locale}.html`, html: allSheetsHtml(locale) });
  }
  for (const locale of ['en', 'ar']) {
    out.push({ path: `${OUT_DIR}/catalogue/product-catalog-${locale}.html`, html: catalogueHtml(locale) });
  }
  return out;
}

/** Write the sources, or with check set, fail (exit 1) if any is out of date. */
function run(check) {
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

if (require.main === module) run(process.argv.includes('--check'));

module.exports = { run, PHOTOS, PHOTO_DIR, sources, SPEC_SHEETS, READY_SHEETS, OUT_DIR, REVISED, productFrom, packagingChips, isolateNumbers };
