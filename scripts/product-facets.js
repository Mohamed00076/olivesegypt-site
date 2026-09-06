'use strict';

/*
 * Part B -- the buyer-intent facets used by the /catalog filter.
 *
 * The brief's rule for this work is the whole reason this file exists:
 *
 *   "Each filter should be a genuine attribute already present in the
 *    product data -- do not invent a categorization that isn't actually
 *    true for a given product just to populate a filter."
 *
 * So every assignment below cites the published sentence it comes from, and
 * scripts/check-product-facets.js re-derives the text-based facets from the
 * live pages on every `npm test` run. If someone rewrites a product's "Best
 * For" list, the filter either follows or the test fails -- it cannot
 * silently keep asserting something the page no longer says.
 *
 * What could NOT be derived, and is therefore not offered as a filter:
 *
 *   - Packaging-based segmentation. Every one of the eleven product pages
 *     carries the identical packaging sentence ("Glass jars, tin cans,
 *     plastic buckets, wooden barrels (brine), or vacuum pouches, subject to
 *     product and order volume"). A facet that matches all eleven filters
 *     nothing, so "bulk and industrial" is built from the explicit
 *     bulk/production wording in "Best For" instead, and is deliberately
 *     small.
 *
 *   - Anything regional. The brief rules this out and so does the
 *     export-markets framing: these are markets being engaged, not markets
 *     served.
 */

const { KEYS } = require('./product-order');

/*
 * evidence: the published phrase each membership is read from.
 * source:   'best-for'  -- the product page's "Best For" list
 *           'catalog'   -- the product's catalogue card description or badge
 *           'owner'     -- an owner decision, not page text (private label)
 */
const FACETS = [
  {
    id: 'retail',
    en: 'Retail-ready',
    ar: 'جاهز للبيع بالتجزئة',
    source: 'best-for',
    // matched case-insensitively against the product's "Best For" list
    match: /retail/i,
    members: {
      aggizi: 'Retail glass-jar programs',
      kalamata: 'Retail deli and antipasto programs',
      toffahi: 'Retail programs wanting a sweeter flavor profile',
      black_natural: 'Retail and food-service',
      stuffed: 'European retail',
      oxidized_black: 'Retail cans',
      jalapeno: 'Retail',
      artichoke: 'Retail antipasto programs',
      pepperoncini: 'European and North American retail',
    },
  },
  {
    id: 'foodservice',
    en: 'Foodservice',
    ar: 'خدمات الطعام',
    source: 'best-for',
    // "food service" and "food-service" both occur; nothing else should match
    match: /food[-\s]service/i,
    members: {
      kalamata: 'Mediterranean and Greek-style food service',
      black_natural: 'Retail and food-service',
      stuffed: 'Food-service programs wanting a ready-to-serve stuffed olive',
      oxidized_black: 'Food service',
      jalapeno: 'Nachos, pizza, and Tex-Mex food-service applications',
      artichoke: 'Food service',
    },
  },
  {
    id: 'bulk',
    en: 'Bulk and industrial',
    ar: 'السائب والصناعي',
    source: 'best-for',
    // Only two shapes of wording qualify: explicit bulk supply, and being
    // named as the input to someone else's production run.
    match: /bulk supply|production/i,
    members: {
      aggizi: 'Wholesale bulk supply',
      toffahi: 'Stuffed-olive production',
      manzanilla: 'Stuffed-olive production',
    },
  },
  {
    id: 'specialty',
    en: 'Stuffed and specialty',
    ar: 'المحشو والأصناف الخاصة',
    source: 'catalog',
    // The catalogue already badges the three non-olive lines "Specialty";
    // the stuffed olive is the product that is literally stuffed.
    members: {
      stuffed: 'badge: Green Olive; the product is pitted and stuffed',
      jalapeno: 'badge: Specialty',
      artichoke: 'badge: Specialty',
      pepperoncini: 'badge: Specialty',
    },
  },
  {
    id: 'egyptian',
    en: 'Egyptian varieties',
    ar: 'أصناف مصرية',
    source: 'catalog',
    /*
     * Varieties native to Egypt -- not "grown in Egypt", which is true of
     * everything here. The catalogue descriptions draw this line themselves:
     * Kalamata is "internationally recognized Greek variety, grown and
     * processed in Egypt" and Manzanilla "the internationally recognized
     * Spanish variety, grown and processed in Egypt". Both are therefore
     * out. Natural Black and Oxidized Black are processing styles rather
     * than varieties (the latter explicitly "California-style"), and the
     * stuffed line is a preparation of Manzanilla and Aggizi.
     */
    members: {
      aggizi: "Egypt's signature export variety",
      toffahi: 'A distinctive Egyptian variety from Fayoum',
      hamed: "Large-caliber green olives from Egypt's North Coast",
    },
  },
  {
    id: 'private_label',
    en: 'Private-label',
    ar: 'العلامة الخاصة',
    source: 'owner',
    /*
     * Not page text: an owner decision. Private-label packaging is offered
     * across the range, and Kalamata is the one exclusion -- it stays out of
     * private-label offers pending separate approval, the same rule that
     * keeps it off the /resources/private-label product list.
     */
    members: Object.fromEntries(
      KEYS.filter((k) => k !== 'kalamata').map((k) => [k, 'offered for private label; Kalamata excluded pending approval'])
    ),
  },
];

/*
 * The variety category behind the /catalog "All / Green / Black / Specialty"
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
  hamed: 'green',
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
  specialty: { en: ['Specialty'], ar: ['\u0645\u062e\u0644\u0644\u0627\u062a', '\u0623\u0646\u062a\u064a\u0628\u0627\u0633\u062a\u0648'] },
};

const IDS = FACETS.map((f) => f.id);

/** The facet ids a given product key belongs to, in FACETS order. */
function facetsOf(key) {
  return FACETS.filter((f) => key in f.members).map((f) => f.id);
}

module.exports = { FACETS, IDS, facetsOf, CATEGORY, CATEGORY_BADGES };
