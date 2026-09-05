'use strict';

/*
 * Phase 3 -- the one canonical product order.
 *
 * There is no HTML build step here, so eleven product cards cannot literally
 * be rendered from one array: each surface keeps its own copy of the list.
 * What can be centralised is the *definition*, plus a test that fails when a
 * copy drifts from it (scripts/check-product-order.js).
 *
 * Before this file existed, three different orders were live at once:
 *   - JSON-LD on /, /catalog, /ar/, /downloads and both print catalogues
 *   - a different order in the visible grid on /catalog (positions 8-10)
 *   - a third order in the visible grid on /ar/catalog, where Kalamata sat
 *     7th while every other surface had it 11th
 *
 * Owner decision, 2026-09-05: Kalamata moves to position 2, behind Aggizi,
 * which keeps the lead as "Egypt's signature export variety". The rest of the
 * sequence is the JSON-LD order, which was the majority convention.
 */

// slug used in ?product= and data-slug, then the page directory for each locale.
const PRODUCTS = [
  { key: 'aggizi',         dir: 'aggizi-green-olives' },
  { key: 'kalamata',       dir: 'kalamata-olives' },
  { key: 'toffahi',        dir: 'toffahi-green-olives' },
  { key: 'hamed',          dir: 'hamed-green-olives' },
  { key: 'manzanilla',     dir: 'manzanilla-green-olives' },
  { key: 'black_natural',  dir: 'natural-black-olives' },
  { key: 'stuffed',        dir: 'pepper-stuffed-green-olives' },
  { key: 'oxidized_black', dir: 'oxidized-black-olives' },
  { key: 'jalapeno',       dir: 'sliced-jalapeno-peppers' },
  { key: 'artichoke',      dir: 'marinated-artichoke-hearts' },
  { key: 'pepperoncini',   dir: 'pepperoncini-peppers' },
];

const KEYS = PRODUCTS.map((p) => p.key);
const DIRS = PRODUCTS.map((p) => p.dir);
const KEY_OF_DIR = Object.fromEntries(PRODUCTS.map((p) => [p.dir, p.key]));

/** Sort any list of keys or directory names into canonical order. */
function rank(idLike) {
  const key = KEY_OF_DIR[idLike] || idLike;
  const i = KEYS.indexOf(key);
  return i === -1 ? Number.MAX_SAFE_INTEGER : i;
}

module.exports = { PRODUCTS, KEYS, DIRS, KEY_OF_DIR, rank, COUNT: PRODUCTS.length };
