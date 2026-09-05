#!/usr/bin/env node
'use strict';

/*
 * Phase 3 test -- every surface that shows a priority product list must match
 * scripts/product-order.js.
 *
 *   node scripts/check-product-order.js        (part of `npm test`)
 *
 * Exists because three different orders were live simultaneously before it
 * did. Without a build step the lists are duplicated per page, so drift is
 * invisible until someone compares them by hand; this compares them on every
 * run instead.
 *
 * Surfaces covered:
 *   - ItemList JSON-LD on /, /catalog, /downloads and their Arabic twins
 *   - the visible product grid on /catalog and /ar/catalog
 *   - the print catalogues, via data-slug
 *   - product count consistency (the visible "11 varieties" claims)
 *   - the export-PDF sources, which are grouped by category on purpose and
 *     are pinned to that grouping rather than to the canonical order
 *   - product identity across locales: same productID, different @id
 */

const fs = require('fs');
const path = require('path');
const { KEYS, DIRS, COUNT } = require('./product-order');

const ROOT = path.join(__dirname, '..');
const problems = [];

function read(rel) {
  const p = path.join(ROOT, rel);
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
}

function compare(where, actual, expected) {
  if (actual === null) return;
  if (actual.length === 0) {
    problems.push(`${where}: no product list found (selector may have gone stale)`);
    return;
  }
  if (actual.length !== expected.length) {
    problems.push(`${where}: ${actual.length} products, expected ${expected.length}\n      got: ${actual.join(', ')}`);
    return;
  }
  const bad = actual.findIndex((v, i) => v !== expected[i]);
  if (bad !== -1) {
    problems.push(
      `${where}: order differs from canonical at position ${bad + 1}\n` +
      `      expected: ${expected.join(', ')}\n` +
      `      actual:   ${actual.join(', ')}`
    );
  }
}

/** ItemList JSON-LD, in itemListElement order, keyed by the @id fragment. */
function itemListOrder(html) {
  const blocks = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g) || [];
  for (const b of blocks) {
    const body = b.replace(/^<script[^>]*>/, '').replace(/<\/script>$/, '');
    let data;
    try {
      data = JSON.parse(body);
    } catch (e) {
      continue;
    }
    if (!data || data['@type'] !== 'ItemList' || !Array.isArray(data.itemListElement)) continue;
    return data.itemListElement.map((e) => {
      const item = e && typeof e.item === 'object' ? e.item : e;
      const id = (item && (item['@id'] || item.url)) || '';
      return id.includes('#') ? id.split('#').pop() : id;
    });
  }
  return null;
}

/** Visible product cards, in DOM order, by their /products/<dir> link. */
function gridOrder(html) {
  const stripped = html.replace(/<script[\s\S]*?<\/script>/g, '');
  const seen = [];
  const re = /\/(?:ar\/)?products\/([a-z-]+)/g;
  let m;
  while ((m = re.exec(stripped)) !== null) {
    if (DIRS.includes(m[1]) && !seen.includes(m[1])) seen.push(m[1]);
  }
  return seen;
}

/** Print catalogue entries, by data-slug. */
function slugOrder(html) {
  const seen = [];
  const re = /data-slug="([a-z_]+)"/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    if (KEYS.includes(m[1]) && !seen.includes(m[1])) seen.push(m[1]);
  }
  return seen;
}

const CHECKS = [
  ['/  (ItemList)', 'index.html', itemListOrder, KEYS],
  ['/ar/  (ItemList)', 'ar/index.html', itemListOrder, KEYS],
  ['/catalog  (ItemList)', 'catalog/index.html', itemListOrder, KEYS],
  ['/downloads  (ItemList)', 'downloads/index.html', itemListOrder, KEYS],
  ['/catalog  (visible grid)', 'catalog/index.html', gridOrder, DIRS],
  ['/ar/catalog  (visible grid)', 'ar/catalog/index.html', gridOrder, DIRS],
  ['/catalog/print', 'catalog/print/index.html', slugOrder, KEYS],
  ['/ar/catalog/print', 'ar/catalog/print/index.html', slugOrder, KEYS],
];

for (const [where, file, fn, expected] of CHECKS) {
  const html = read(file);
  if (html === null) {
    problems.push(`${where}: ${file} not found`);
    continue;
  }
  compare(where, fn(html), expected);
}

// The visible count must agree with the canonical list length.
const COUNT_FILES = [
  'index.html', 'catalog/index.html', 'downloads/index.html', 'catalog/print/index.html',
  'ar/index.html', 'ar/catalog/index.html', 'ar/downloads/index.html', 'ar/catalog/print/index.html',
];
for (const f of COUNT_FILES) {
  const html = read(f);
  if (html === null) continue;
  const wrong = [...html.matchAll(/(\d+)\s*(?:product\s*)?varieties|(\d+)\s*(?:صنفًا|صنف|أصناف)/g)]
    .map((m) => Number(m[1] || m[2]))
    .filter((n) => n !== COUNT);
  if (wrong.length) problems.push(`${f}: states ${[...new Set(wrong)].join(', ')} varieties, expected ${COUNT}`);
}

/*
 * Product identity across locales.
 *
 * Until 2026-09-05 the English and Arabic product pages carried Product nodes
 * with a name, a description and nothing else -- no @id, no identifier, no
 * url, no image. Zero of the eleven pairs shared anything, so to a consumer of
 * structured data the site listed twenty-two unrelated products rather than
 * eleven in two languages (docs/arabic-schema-audit.md §4.1).
 *
 * The fix has two halves that must both hold, and they pull in opposite
 * directions:
 *
 *   - productID is the SAME across a pair. That is what says "one product".
 *   - @id is DIFFERENT across a pair. A shared @id would merge the two into a
 *     single node carrying an English and an Arabic name for one thing, which
 *     is exactly the contradiction the Organization schema spent three pull
 *     requests removing.
 */
const ORIGIN = 'https://olivesegypt.com';

function productNode(html) {
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    let d;
    try { d = JSON.parse(m[1]); } catch { continue; }
    if (d && d['@type'] === 'Product') return d;
  }
  return null;
}

for (const { key, dir } of require('./product-order').PRODUCTS) {
  const pair = {};
  for (const [locale, file] of [['en', `products/${dir}/index.html`], ['ar', `ar/products/${dir}/index.html`]]) {
    const html = read(file);
    if (html === null) { problems.push(`${file}: not found`); continue; }
    const p = productNode(html);
    if (!p) { problems.push(`${file}: no Product schema`); continue; }
    pair[locale] = p;

    const base = locale === 'ar' ? `${ORIGIN}/ar/products/${dir}` : `${ORIGIN}/products/${dir}`;
    if (p.productID !== key) {
      problems.push(`${file}: productID is ${JSON.stringify(p.productID)}, expected ${JSON.stringify(key)}`);
    }
    if (p['@id'] !== `${base}#product`) {
      problems.push(`${file}: @id is ${JSON.stringify(p['@id'])}, expected "${base}#product"`);
    }
    if (p.url !== base) {
      problems.push(`${file}: url is ${JSON.stringify(p.url)}, expected "${base}"`);
    }
    if (p.inLanguage !== locale) {
      problems.push(`${file}: inLanguage is ${JSON.stringify(p.inLanguage)}, expected ${JSON.stringify(locale)}`);
    }
    if (typeof p.image !== 'string' || !p.image.startsWith(`${ORIGIN}/assets/`)) {
      problems.push(`${file}: image is ${JSON.stringify(p.image)}, expected an asset URL`);
    } else {
      const rel = p.image.slice(ORIGIN.length + 1);
      if (!fs.existsSync(path.join(ROOT, rel))) {
        problems.push(`${file}: image ${p.image} is not a file in the publish directory`);
      }
    }
    // A commercial identifier would be a claim about codes this company has
    // not published. productID carries the internal key instead.
    for (const bad of ['sku', 'gtin', 'gtin13', 'mpn']) {
      if (bad in p) problems.push(`${file}: "${bad}" asserts a commercial code that has not been supplied`);
    }
  }

  if (pair.en && pair.ar) {
    if (pair.en.productID !== pair.ar.productID) {
      problems.push(`${dir}: the locales disagree on productID (${pair.en.productID} vs ${pair.ar.productID})`);
    }
    if (pair.en['@id'] === pair.ar['@id']) {
      problems.push(`${dir}: both locales share the @id ${pair.en['@id']}; that merges an English and an Arabic name into one node`);
    }
    if (pair.en.name === pair.ar.name) {
      problems.push(`${dir}: the Arabic page repeats the English product name`);
    }
  }
}

/*
 * The two export-catalogue PDFs are the one deliberate exception to the
 * canonical order, decided by the owner on 2026-09-05: they are grouped by
 * category (Green Olives / Black Olives & Stuffed / Specialty & Peppers)
 * rather than run in the site's priority order, and Kalamata leads the Black
 * Olives section rather than sitting second overall.
 *
 * That is a decision, not drift -- so it is pinned here rather than left to
 * be "corrected" by a later pass that notices the two orders disagree. The
 * check is on the PDF *sources*: the built PDFs are regenerated from them,
 * and Arabic PDF text extraction transposes lam-alef pairs, which makes
 * reading the artefact an unreliable way to assert anything about wording.
 */
const PDF_SOURCES = [
  ['export-catalog-source.html', 'Black Olives &amp; Stuffed Varieties', 'Kalamata Olives', 'Natural Black Olives'],
  ['export-catalog-source-ar.html', 'الزيتون الأسود والأصناف المحشوة', 'زيتون كالاماتا', 'زيتون أسود طبيعي'],
];
for (const [file, sectionHeading, first, second] of PDF_SOURCES) {
  const html = read(path.join('scripts', file));
  if (html === null) {
    problems.push(`scripts/${file}: not found`);
    continue;
  }
  // The same words appear earlier in the cover table of contents, so match
  // the <h1> that opens the section rather than the first occurrence.
  const start = html.indexOf(`<h1 class="pdf-h1">${sectionHeading}</h1>`);
  if (start === -1) {
    problems.push(`scripts/${file}: no "${sectionHeading}" section heading`);
    continue;
  }
  const section = html.slice(start, html.indexOf('<div class="pdf-footer"', start));
  const names = [...section.matchAll(/<p class="product-name">([^<]+)<\/p>/g)].map((m) => m[1].trim());
  if (names[0] !== first) {
    problems.push(`scripts/${file}: the black-olive section leads with "${names[0]}", expected "${first}"`);
  }
  // Also pin the summary table on the specifications page, which is a
  // separate list of the same products and drifted from the sections once
  // before.
  const rows = [...html.matchAll(/<tr><td>([^<]+)<\/td>/g)].map((m) => m[1].trim());
  const iFirst = rows.indexOf(first);
  const iSecond = rows.indexOf(second);
  if (iFirst === -1 || iSecond === -1 || iSecond !== iFirst + 1) {
    problems.push(
      `scripts/${file}: the summary table should list "${first}" immediately before "${second}" ` +
      `(found at ${iFirst} and ${iSecond})`
    );
  }
}

if (problems.length === 0) {
  console.log(
    `product-order OK -- ${CHECKS.length} surfaces match the canonical ${COUNT}-product order, ` +
    `both PDF sources keep Kalamata first in the black-olive section, and all ` +
    `${COUNT} product pairs share a productID while keeping separate @ids.`
  );
  process.exit(0);
}

console.error(`product-order FAILED -- ${problems.length} problem(s):\n`);
problems.forEach((p) => console.error('  ' + p + '\n'));
process.exit(1);
