'use strict';

/*
 * The Egyptian growing regions this company sources from.
 *
 * Owner-confirmed 2026-09-06, in two steps. The first answer named Fayoum,
 * the Nile Delta and the Western Desert, which contradicted two origins the
 * site had been publishing for months: Hamed as coming from the North Coast
 * and Toffahi from "Fayoum & Giza". Rather than reconcile that by guessing,
 * it was raised -- and the owner's answer was to add North Coast and Giza to
 * the sourcing list, making the site consistent in the other direction.
 *
 * So this file exists to stop the two halves drifting apart again. The
 * regions named as a product's origin and the regions named on
 * /resources/supply-network as where sourcing happens are the same set, and
 * scripts/check-sourcing-regions.js fails when they are not.
 */

const REGIONS = [
  { id: 'nile_delta', en: 'Nile Delta', ar: 'دلتا النيل' },
  { id: 'fayoum', en: 'Fayoum', ar: 'الفيوم' },
  { id: 'giza', en: 'Giza', ar: 'الجيزة' },
  { id: 'north_coast', en: 'North Coast', ar: 'الساحل الشمالي' },
  { id: 'western_desert', en: 'Western Desert', ar: 'الصحراء الغربية' },
];

const EN = REGIONS.map((r) => r.en);
const AR = REGIONS.map((r) => r.ar);

module.exports = { REGIONS, EN, AR, COUNT: REGIONS.length };
