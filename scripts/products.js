'use strict';

/*
 * The product range: one source of truth.
 *
 * Owner decisions, 2026-10-10 (catalog restructure brief):
 *   - We supply olives by TYPE, not by cultivar. Green olives: whole, pitted,
 *     sliced. Stuffed green olives: green only, pepper or carrot filling.
 *     Natural black olives: whole only. Oxidized black olives: whole, pitted,
 *     sliced. Black olives are never stuffed. The three pickled vegetables
 *     stay as they are.
 *   - Cultivars (Aggizi, Toffahi, Manzanilla and any others) are not
 *     products. A buyer may ask for one; availability is checked for every
 *     request, and none is promised or singled out. Cultivar names appear only
 *     as general facts on the pages in CULTIVAR_PAGES.
 *   - Kalamata cannot be supplied. It is named nowhere a buyer can read.
 *   - The old cultivar pages redirect (301) to their type; Kalamata's to the
 *     catalogue.
 *
 * There is no HTML build step, so static pages keep their own copies of
 * these lists; the checks named below read this file and fail when a copy
 * drifts:
 *   check-product-order.js      order and count on every list
 *   check-product-types.js      the forms matrix, cultivar and Kalamata names,
 *                               the retired addresses
 *   check-withdrawn-products.js Hamed
 *   check-crm-products.js       the CRM's product lists
 */

// Order is the order every list on the site uses: olive types, then the
// pickled vegetables. key: ?product= and data-slug; dir: the page directory.
const PRODUCTS = [
  { key: 'green', dir: 'green-olives', category: 'green', en: 'Green Olives', ar: 'زيتون أخضر' },
  { key: 'stuffed', dir: 'stuffed-green-olives', category: 'green', en: 'Stuffed Green Olives', ar: 'زيتون أخضر محشو' },
  { key: 'black_natural', dir: 'natural-black-olives', category: 'black', en: 'Natural Black Olives', ar: 'زيتون أسود طبيعي' },
  { key: 'oxidized_black', dir: 'oxidized-black-olives', category: 'black', en: 'Oxidized Black Olives', ar: 'زيتون أسود مؤكسد' },
  { key: 'jalapeno', dir: 'sliced-jalapeno-peppers', category: 'specialty', en: 'Sliced Jalapeño Peppers', ar: 'فلفل هالبينو مقطع' },
  { key: 'artichoke', dir: 'marinated-artichoke-hearts', category: 'specialty', en: 'Marinated Artichoke Hearts', ar: 'قلوب أرضي شوكي متبّلة' },
  { key: 'pepperoncini', dir: 'pepperoncini-peppers', category: 'specialty', en: 'Pepperoncini Peppers', ar: 'فلفل بيبرونشيني' },
];

// The olive types and the forms each is supplied in (owner, 2026-10-10).
// A form not listed here must not be stated for that type.
const FORMS = {
  green: ['whole', 'pitted', 'sliced'],
  stuffed: ['stuffed'],
  black_natural: ['whole'],
  oxidized_black: ['whole', 'pitted', 'sliced'],
};
// What a stuffed olive is filled with (C-152). Add one only on owner
// confirmation (docs/evidence-needed.md).
const FILLINGS = { en: ['pepper', 'carrot'], ar: ['الفلفل', 'الجزر'] };
const FORM_WORDS = {
  whole: { en: 'Whole', ar: 'كامل' },
  pitted: { en: 'Pitted', ar: 'منزوع النواة' },
  sliced: { en: 'Sliced', ar: 'مقطع' },
  stuffed: { en: 'Stuffed', ar: 'محشو' },
};

// Cultivars, for general reference on the CULTIVAR_PAGES only: the ones this
// site once listed as products, Kalamata excluded (owner default, 2026-10-10).
// Hamed is not here: it was withdrawn as "not confirmed available".
const CULTIVARS = [
  { en: 'Aggizi', ar: 'عجيزي', type: 'green' },
  { en: 'Toffahi', ar: 'تفاحي', type: 'green' },
  { en: 'Manzanilla', ar: 'مانزانيلا', type: 'green' },
];
const CULTIVAR_PAGES = [
  'egyptian-table-olives', 'ar/egyptian-table-olives',
  'resources/why-egyptian-olives', 'ar/resources/why-egyptian-olives',
];
// Named nowhere a buyer can read, in any language.
const NEVER_NAMED = [{ en: 'Kalamata', ar: 'كالاماتا' }];

// Retired addresses and ids, and where each now goes.
const RETIRED = [
  { key: 'aggizi', dir: 'aggizi-green-olives', to: 'green-olives' },
  { key: 'toffahi', dir: 'toffahi-green-olives', to: 'green-olives' },
  { key: 'manzanilla', dir: 'manzanilla-green-olives', to: 'green-olives' },
  { key: null, dir: 'pepper-stuffed-green-olives', to: 'stuffed-green-olives' },
  { key: 'kalamata', dir: 'kalamata-olives', to: null }, // the catalogue
];

/*
 * Products no longer sold before this restructure. Nothing public may name
 * them, their old addresses answer 410, and the CRM keeps them only as a tag
 * on records that already carry it.
 */
const WITHDRAWN = [
  // Owner, 2026-09-28: "not confirmed available".
  { key: 'hamed', dir: 'hamed-green-olives', names: ['Hamed', 'حامد'] },
];

const KEYS = PRODUCTS.map((p) => p.key);
const DIRS = PRODUCTS.map((p) => p.dir);
const COUNT = PRODUCTS.length;
const OLIVE_COUNT = Object.keys(FORMS).length;

module.exports = {
  PRODUCTS, KEYS, DIRS, COUNT, OLIVE_COUNT, FORMS, FILLINGS, FORM_WORDS,
  CULTIVARS, CULTIVAR_PAGES, NEVER_NAMED, RETIRED, WITHDRAWN,
};
