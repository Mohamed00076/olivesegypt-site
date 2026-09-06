#!/usr/bin/env node
'use strict';

/*
 * Where the site says fruit comes from must be one list, not two.
 *
 *   node scripts/check-sourcing-regions.js        (part of `npm test`)
 *
 * The site had been naming Hamed's origin as the North Coast and Toffahi's as
 * "Fayoum & Giza" on the product pages and catalogue cards for months. When
 * /resources/supply-network was written it stated the sourcing regions the
 * owner had confirmed -- Fayoum, the Nile Delta and the Western Desert -- and
 * the two lists silently contradicted each other: the site named origins it
 * did not claim to source from.
 *
 * Nothing detected it, because no check connected a product's origin line to
 * the sourcing statement. This one does, in both directions:
 *
 *   - every region named as a product origin is in the confirmed list
 *   - every confirmed region is actually named on the supply-network page,
 *     in both locales, so the page cannot quietly narrow
 *
 * "Egypt" on its own is fine and common on the product cards -- it names the
 * country, not a region -- so it is not treated as a region claim.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const { EN, AR, COUNT } = require('./sourcing-regions');

const problems = [];
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

// ---- 1. the supply-network page names every confirmed region -------------
for (const [file, names, label] of [
  ['resources/supply-network/index.html', EN, 'English'],
  ['ar/resources/supply-network/index.html', AR, 'Arabic'],
]) {
  const html = read(file);
  const main = html.slice(html.indexOf('<main'), html.indexOf('</main>'));
  const missing = names.filter((n) => !main.includes(n));
  if (missing.length) {
    problems.push(`${file}: the ${label} sourcing statement does not name ${missing.join(', ')}`);
  }
}

// ---- 2. no product claims an origin outside the confirmed list ----------
//
// The catalogue card carries a short origin line next to a globe icon; the
// product page repeats it. Both are read, so neither can drift alone.
const ORIGIN_LINE = /<span class="text-xs text-muted-foreground">([^<]*Egypt[^<]*)<\/span>/g;

for (const locale of ['', 'ar/']) {
  const file = `${locale}catalog/index.html`;
  const html = read(file);
  const names = locale === 'ar/' ? AR : EN;

  for (const m of html.matchAll(ORIGIN_LINE)) {
    const line = m[1].trim();
    // strip the country and any parenthetical, leaving the region names
    const stripped = line
      .replace(/,?\s*Egypt\b/g, '')
      .replace(/\([^)]*\)/g, '')
      .replace(/^\s*مصر\s*/, '')
      .trim();
    if (!stripped || stripped === '-') continue;   // "Egypt" alone: a country, not a region

    // the line may name more than one region, e.g. "Fayoum & Giza"
    const claimed = stripped.split(/\s*(?:&|و|,|\/)\s*/).map((x) => x.trim()).filter(Boolean);
    for (const c of claimed) {
      if (!names.some((n) => c === n || c.includes(n) || n.includes(c))) {
        problems.push(
          `${file}: a product card gives its origin as "${line}", and "${c}" is not one of the ` +
          `${COUNT} confirmed sourcing regions (${names.join(', ')})`
        );
      }
    }
  }
}

if (problems.length === 0) {
  console.log(
    `sourcing-regions OK -- ${COUNT} confirmed regions (${EN.join(', ')}), all named on both ` +
    `supply-network pages, and every product origin falls inside that list.`
  );
  process.exit(0);
}
console.error(`sourcing-regions FAILED -- ${problems.length} problem(s):\n`);
problems.forEach((p) => console.error('  ' + p));
process.exit(1);
