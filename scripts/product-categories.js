'use strict';

/*
 * The variety category of each product: what the /catalog and /ar/catalog
 * "All / Green / Black / Pickled Vegetables" row filters on.
 *
 * Until 2026-09-28 this file was scripts/product-facets.js and also defined
 * Part B's buyer-intent facets ("Filter by what you need": Retail-ready,
 * Foodservice, Bulk and industrial, Stuffed and specialty, Egyptian
 * varieties, Private-label). The owner removed that row from both catalogues
 * that day, so the facets went with it. The categories stay: the row still
 * uses them, and check-product-categories.js still holds them to the badge
 * each card displays.
 */

/*
 * The variety category behind the /catalog "All / Green / Black / Pickled Vegetables"
 * row. This is not a new taxonomy -- it is the badge each product card
 * already displays, written down so the filter and the badge cannot disagree.
 *
 * They did disagree. The row's data-category attributes sat on the card
 * wrappers in the pre-2026-09-05 product order, and when Kalamata was moved
 * to position 2 the card contents moved while the wrapper attributes stayed
 * put. Six of the eleven ended up mislabelled -- Kalamata "green", Manzanilla
 * "black", Oxidized Black "specialty" -- and nothing showed it, because no
 * script had ever been bound to those buttons.
 */
const CATEGORY = {
  aggizi: 'green',
  kalamata: 'black',
  toffahi: 'green',
  manzanilla: 'green',
  black_natural: 'black',
  stuffed: 'green',          // pitted Manzanilla and Aggizi, stuffed
  oxidized_black: 'black',
  jalapeno: 'specialty',
  artichoke: 'specialty',
  pepperoncini: 'specialty',
};

// The badge wording each category is allowed to display, per locale. Arabic
// uses a finer vocabulary than English (a stuffed olive and a pickle get
// their own words), so this is a set per category rather than one string.
const CATEGORY_BADGES = {
  green: { en: ['Green Olive'], ar: ['\u0632\u064a\u062a\u0648\u0646 \u0623\u062e\u0636\u0631', '\u0632\u064a\u062a\u0648\u0646 \u0645\u062d\u0634\u0648'] },
  black: { en: ['Black Olive'], ar: ['\u0632\u064a\u062a\u0648\u0646 \u0623\u0633\u0648\u062f'] },
  // "Pickled Vegetables" group (owner, 2026-10-03; was "Specialty & Antipasti"): each
  // card says what it is -- a pickled pepper, or the artichoke, which is marinated.
  specialty: { en: ['Pickled Pepper', 'Marinated Vegetable'], ar: ['\u0641\u0644\u0641\u0644 \u0645\u062e\u0644\u0644', '\u062e\u0636\u0631\u0648\u0627\u062a \u0645\u062a\u0628\u0651\u0644\u0629'] },
};

module.exports = { CATEGORY, CATEGORY_BADGES };
