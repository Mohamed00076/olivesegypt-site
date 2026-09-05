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

if (problems.length === 0) {
  console.log(`product-order OK -- ${CHECKS.length} surfaces match the canonical ${COUNT}-product order.`);
  process.exit(0);
}

console.error(`product-order FAILED -- ${problems.length} problem(s):\n`);
problems.forEach((p) => console.error('  ' + p + '\n'));
process.exit(1);
