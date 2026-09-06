#!/usr/bin/env node
'use strict';

/*
 * The /catalog filter facets must stay true to the pages.
 *
 *   node scripts/check-product-facets.js        (part of `npm test`)
 *
 * A filter chip is a claim: tick "Foodservice" and the site is telling a
 * buyer these six products suit foodservice. The brief's rule was explicit --
 * every facet must be a genuine attribute already in the product data, not a
 * categorisation invented to populate a chip.
 *
 * The risk is drift, not the initial build. Someone rewrites a "Best For"
 * list six months from now and the chips keep asserting the old reading,
 * because nothing connects the two. So the text-derived facets are
 * re-derived here from the live product pages on every run and compared
 * against scripts/product-facets.js, in both directions: a product that has
 * gained the wording must have gained the facet, and one that has lost it
 * must have lost the facet.
 *
 * Also checked:
 *   - the rendered catalogue cards carry exactly the facets the definition
 *     gives them, in both locales (the grids are hand-maintained copies)
 *   - Kalamata is not in the private-label facet
 *   - no facet is empty, and none matches every product (a filter that
 *     selects everything is not a filter)
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const { PRODUCTS, KEY_OF_DIR, COUNT } = require('./product-order');
const { FACETS, facetsOf, CATEGORY, CATEGORY_BADGES } = require('./product-facets');

const problems = [];

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

// ---- the "Best For" list, as published ----------------------------------
function bestFor(dir) {
  const html = read(`products/${dir}/index.html`);
  const m = html.match(/Best For<\/h2>\s*<ul[^>]*>([\s\S]*?)<\/ul>/);
  if (!m) {
    problems.push(`products/${dir}: no "Best For" list found -- the facets for this product cannot be verified`);
    return null;
  }
  return [...m[1].matchAll(/<li>([\s\S]*?)<\/li>/g)].map((x) => x[1].replace(/<[^>]+>/g, '').trim());
}

for (const { key, dir } of PRODUCTS) {
  const items = bestFor(dir);
  if (!items) continue;
  const text = items.join(' | ');

  for (const facet of FACETS) {
    if (facet.source !== 'best-for') continue;
    const claimed = key in facet.members;
    const actual = facet.match.test(text);

    if (claimed && !actual) {
      problems.push(
        `facet "${facet.id}" claims ${key}, but nothing in that product's "Best For" list matches ` +
        `${facet.match} any more. Published list: ${text}`
      );
    }
    if (!claimed && actual) {
      problems.push(
        `${key} now says something matching ${facet.match} in its "Best For" list, but is not in ` +
        `facet "${facet.id}". Published list: ${text}`
      );
    }
    // the cited evidence must still be the page's own words
    if (claimed && !items.includes(facet.members[key])) {
      problems.push(
        `facet "${facet.id}" cites "${facet.members[key]}" for ${key}, which is no longer one of that ` +
        `product's "Best For" items. Published list: ${text}`
      );
    }
  }
}

// ---- Kalamata stays out of private label --------------------------------
const pl = FACETS.find((f) => f.id === 'private_label');
if (!pl) {
  problems.push('the private_label facet is gone');
} else if ('kalamata' in pl.members) {
  problems.push('Kalamata is in the private-label facet; it is excluded pending separate approval');
} else if (Object.keys(pl.members).length !== COUNT - 1) {
  problems.push(
    `the private-label facet has ${Object.keys(pl.members).length} products; expected ${COUNT - 1} ` +
    `(every product except Kalamata)`
  );
}

// ---- a facet that selects nothing, or everything, is not a filter -------
for (const facet of FACETS) {
  const n = Object.keys(facet.members).length;
  if (n === 0) problems.push(`facet "${facet.id}" has no products`);
  if (n === COUNT && facet.id !== 'private_label') {
    problems.push(`facet "${facet.id}" matches all ${COUNT} products, so it filters nothing`);
  }
  if (!facet.en || !facet.ar) problems.push(`facet "${facet.id}" is missing an English or Arabic label`);
}

// ---- the rendered catalogue grids agree with the definition -------------
//
// Each locale's grid is its own hand-maintained copy of the product list, so
// this is exactly the place a facet gets dropped from one card and nobody
// notices.
for (const locale of ['', 'ar/']) {
  const file = `${locale}catalog/index.html`;
  const html = read(file);
  const cards = [...html.matchAll(/data-product="([a-z0-9-]+)"[^>]*data-facets="([^"]*)"/g)];

  if (cards.length !== COUNT) {
    problems.push(`${file}: found ${cards.length} filterable product card(s), expected ${COUNT}`);
  }
  const seen = new Set();
  for (const [, dir, attr] of cards) {
    const key = KEY_OF_DIR[dir];
    if (!key) {
      problems.push(`${file}: card data-product="${dir}" is not one of the ${COUNT} products`);
      continue;
    }
    seen.add(key);
    const want = facetsOf(key).join(' ');
    if (attr.trim() !== want) {
      problems.push(`${file}: ${dir} carries facets "${attr.trim()}", expected "${want}"`);
    }
  }
  for (const { key, dir } of PRODUCTS) {
    if (!seen.has(key)) problems.push(`${file}: ${dir} has no data-facets attribute`);
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

    // and the badge the buyer actually sees on that card must say the same
    const from = html.indexOf(tag);
    const chunk = html.slice(from, from + 2500);
    const allowed = CATEGORY_BADGES[want][lang];
    if (!allowed.some((b) => chunk.includes(b))) {
      problems.push(
        `${file}: ${dir} is category "${want}" but its card badge is none of ${allowed.join(' / ')} ` +
        `-- the filter and the visible badge would disagree`
      );
    }
  }

  // every facet must have a chip, and no chip may name a facet that does not exist
  const chips = [...html.matchAll(/data-facet-chip="([a-z_]+)"/g)].map((m) => m[1]);
  const wantChips = FACETS.map((f) => f.id);
  const missing = wantChips.filter((id) => !chips.includes(id));
  const extra = chips.filter((id) => !wantChips.includes(id) && id !== 'all');
  if (missing.length) problems.push(`${file}: no filter chip for ${missing.join(', ')}`);
  if (extra.length) problems.push(`${file}: filter chip(s) for unknown facet(s) ${extra.join(', ')}`);
}

if (problems.length === 0) {
  const summary = FACETS.map((f) => `${f.id}:${Object.keys(f.members).length}`).join(' ');
  console.log(
    `product-facets OK -- every text-derived facet re-derived from the published "Best For" lists, ` +
    `both catalogue grids agree with the definition, Kalamata excluded from private label. [${summary}]`
  );
  process.exit(0);
}
console.error(`product-facets FAILED -- ${problems.length} problem(s):\n`);
problems.forEach((p) => console.error('  ' + p));
process.exit(1);
