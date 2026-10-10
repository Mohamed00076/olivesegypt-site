'use strict';

/*
 * Phase 3 -- the one canonical product order.
 *
 * There is no HTML build step here, so the product cards cannot literally
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
 *
 * Owner decision, 2026-09-28: Hamed is withdrawn from the range ("not
 * confirmed available") and removed from every page and document, and
 * Kalamata moves into the place Hamed held, after Toffahi. Ten products.
 */

/*
 * Owner decision, 2026-10-10: the range is restructured by olive type, not
 * cultivar -- seven products. The list now lives in scripts/products.js; this
 * file keeps its old exports for the scripts that read them.
 */
const { PRODUCTS, KEYS, DIRS, COUNT, WITHDRAWN } = require('./products');

const KEY_OF_DIR = Object.fromEntries(PRODUCTS.map((p) => [p.dir, p.key]));

/** Sort any list of keys or directory names into canonical order. */
function rank(idLike) {
  const key = KEY_OF_DIR[idLike] || idLike;
  const i = KEYS.indexOf(key);
  return i === -1 ? Number.MAX_SAFE_INTEGER : i;
}

module.exports = { PRODUCTS, KEYS, DIRS, KEY_OF_DIR, rank, COUNT, WITHDRAWN };
