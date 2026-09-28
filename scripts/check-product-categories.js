#!/usr/bin/env node
'use strict';

/*
 * The /catalog category filter files each product under the category its
 * card displays.
 *
 *   node scripts/check-product-categories.js        (part of `npm test`)
 *
 * The category row (All / Green / Black / Specialty) filters on each card's
 * data-category. Each locale's grid is its own hand-maintained copy of the
 * product list, so this is exactly where a card gets filed under one category
 * while its badge says another.
 *
 * Until 2026-09-28 this was check-product-facets.js and also held Part B's
 * buyer-intent chips to the product pages. The owner removed that row from
 * both catalogues; this now also checks it stays removed, with no chip, no
 * facet data on a card, and no script or style for it.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const { PRODUCTS, KEY_OF_DIR, COUNT } = require('./product-order');
const { CATEGORY, CATEGORY_BADGES } = require('./product-categories');

const problems = [];

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

for (const locale of ['', 'ar/']) {
  const file = `${locale}catalog/index.html`;
  const html = read(file);
  const cards = [...html.matchAll(/data-product="([a-z0-9-]+)"/g)];

  if (cards.length !== COUNT) {
    problems.push(`${file}: found ${cards.length} product card(s), expected ${COUNT}`);
  }
  const seen = new Set();
  for (const [, dir] of cards) {
    if (!KEY_OF_DIR[dir]) problems.push(`${file}: card data-product="${dir}" is not one of the ${COUNT} products`);
    else seen.add(KEY_OF_DIR[dir]);
  }
  for (const { key, dir } of PRODUCTS) {
    if (!seen.has(key)) problems.push(`${file}: no card for ${dir}`);
  }

  // every category the row offers exists, and nothing else
  const buttons = [...html.matchAll(/data-filter="([a-z]+)"/g)].map((m) => m[1]);
  const wantButtons = ['all', ...new Set(Object.values(CATEGORY))];
  if (JSON.stringify([...buttons].sort()) !== JSON.stringify([...wantButtons].sort())) {
    problems.push(`${file}: the category row offers ${buttons.join(', ')}; expected ${wantButtons.join(', ')}`);
  }

  // ---- the variety category must match the badge the card displays ------
  //
  // This is the check that would have caught the scrambled data-category
  // attributes: the filter said "green" while the badge on the very same card
  // said "Black Olive". Six cards were in that state, unnoticed for as long
  // as the buttons did nothing.
  const lang = locale === 'ar/' ? 'ar' : 'en';
  for (const [, dir] of cards) {
    const key = KEY_OF_DIR[dir];
    if (!key) continue;
    const want = CATEGORY[key];

    // read the card's own opening tag, so nothing from a neighbouring card
    // can be mistaken for this one's category
    const tag = (html.match(new RegExp(`<div[^>]*data-product="${dir}"[^>]*>`)) || [])[0] || '';
    const own = (tag.match(/data-category="([a-z]+)"/) || [])[1];
    if (own !== want) {
      problems.push(`${file}: ${dir} is filed under category "${own}", expected "${want}"`);
    }

    // and the badge the buyer actually sees on that card must say the same.
    //
    // This window used to be a flat 2500 characters, which on the Arabic
    // catalogue reached past the end of the card and into its neighbour: the
    // artichoke card passed on مخللات borrowed from the card below it, while
    // its own badge said something the list did not contain at all. The
    // accident only ended when Batch 2's spec panels made each card longer
    // than the window. Bound it to the card itself so a badge can only ever
    // be satisfied by the card that displays it.
    const from = html.indexOf(tag);
    const nextCard = html.indexOf('<div class="product-card', from + tag.length);
    const chunk = html.slice(from, nextCard === -1 ? from + 2500 : nextCard);
    const allowed = CATEGORY_BADGES[want][lang];
    if (!allowed.some((b) => chunk.includes(b))) {
      problems.push(
        `${file}: ${dir} is category "${want}" but its card badge is none of ${allowed.join(' / ')} ` +
        `-- the filter and the visible badge would disagree`
      );
    }
  }

  // ---- the buyer-intent row stays removed (owner, 2026-09-28) -----------
  const left = ['data-facet-row', 'data-facet-chip', 'data-facet-clear', 'data-facets=', 'tc-facet-']
    .filter((marker) => html.includes(marker));
  if (left.length) problems.push(`${file}: the removed "filter by what you need" row is back (${left.join(', ')})`);
}

for (const f of ['assets/catalog-filter.js', 'assets/index-Dw0yUE42.css']) {
  if (/facet/i.test(read(f).replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, ''))) {
    problems.push(`${f}: still has code for the removed buyer-intent row`);
  }
}

if (problems.length === 0) {
  console.log(
    `product-categories OK -- both catalogue grids list all ${COUNT} products, each filed under the ` +
    `category its badge shows; the buyer-intent row stays removed.`
  );
  process.exit(0);
}
console.error(`product-categories FAILED -- ${problems.length} problem(s):\n`);
problems.forEach((p) => console.error('  ' + p));
process.exit(1);
