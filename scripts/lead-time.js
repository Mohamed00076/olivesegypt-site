'use strict';

/*
 * The indicative lead time: one wording, everywhere it is published.
 *
 * Owner decision 2026-10-25 (C-181, superseding C-179): 4–6 weeks, order to
 * vessel -- indicative, confirmed during quotation, never a guarantee. The
 * Arabic label and value are the owner's choice of the same day.
 *
 * The pages, the PDF sources and the CRM editor are hand-written HTML with no
 * build step, so nothing here writes them. scripts/check-lead-time.js holds
 * every one of them to this file, and fails on the retired range anywhere
 * outside the history files.
 */

const LEAD_TIME = {
  en: { label: 'Indicative lead time', value: '4–6 weeks, order to vessel' },
  ar: { label: 'مدة التجهيز الاسترشادية', value: '4–6 أسابيع من الطلب إلى الشحن' },
};

// Said wherever the figure stands without the company profile's own
// "Terms shown are current and indicative; exact terms are confirmed during
// quotation" note beside it (owner, 2026-10-25: the export catalogue).
const QUALIFIER = {
  en: 'confirmed during quotation',
  ar: 'تقديرية، وتؤكد أثناء عرض السعر',
};

// Every place the figure is stated. `qualifier`: the place must also carry
// QUALIFIER. `hint`: an input's example text, which states the value only.
const STATEMENTS = [
  { file: 'company-profile/index.html', lang: 'en' },
  { file: 'ar/company-profile/index.html', lang: 'ar' },
  { file: 'scripts/pdf-sources/documents/company-profile-en.html', lang: 'en' },
  { file: 'scripts/pdf-sources/documents/company-profile-ar.html', lang: 'ar' },
  { file: 'scripts/export-catalog-source.html', lang: 'en', qualifier: true },
  { file: 'scripts/export-catalog-source-ar.html', lang: 'ar', qualifier: true },
  { file: 'crm/document/index.html', lang: 'en', hint: true },
];

// The retired 3–4 weeks, in any digits, dash or words.
const RETIRED = new RegExp([
  '[3٣]\\s*(?:[-–—‒―‐‑~]|to|إلى|الى)\\s*[4٤]\\s*(?:weeks?|wks?|semanas|أسابيع|اسابيع)',
  '(?:weeks?|أسابيع)\\s*[3٣]\\s*(?:[-–—‒―‐‑~]|إلى)\\s*[4٤](?!\\d)',
  'three\\s*(?:to|-|–)\\s*four\\s*weeks',
  'ثلاث(?:ة)?\\s*(?:إلى|الى|-|–)\\s*أربع(?:ة)?\\s*أسابيع',
].join('|'), 'i');

// Records of what was said before: the only files that may quote it.
const HISTORY = [
  'docs/deployment-record.md',
  'docs/claim-and-evidence-register.csv',
  'docs/system-health-audit-log.md',
];

module.exports = { LEAD_TIME, QUALIFIER, STATEMENTS, RETIRED, HISTORY };
