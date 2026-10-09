#!/usr/bin/env node
'use strict';

/*
 * The barrel is plastic, and it holds 220 kg.
 *
 *   node scripts/check-packaging-claims.js        (part of `npm test`)
 *
 * WHAT WENT WRONG
 *
 * The site described the bulk format as a wooden barrel in 103 places across
 * both locales, and quoted three different capacities for it at the same time:
 * 50 / 100 / 200 kg chips on the homepage channel card, "typically 50-200kg"
 * on /resources/packaging and in the gated guides, and a 50-200kg row in the
 * print catalogues. None of it was true. The owner corrected it on
 * 2026-09-17: there are no wooden barrels, only plastic, 220 kg (C-76).
 *
 * WHY A CHECK AND NOT JUST AN EDIT
 *
 * A wrong packaging spec does not look wrong. It reads like ordinary product
 * copy, it is repeated in every locale, and it lives in three generators as
 * well as the pages they produce -- which is how a retired export-markets
 * claim survived in scripts/generate-resource-pages.py (since retired, C-95)
 * long after the pages
 * had been cleaned. One re-run would have put "wooden barrels" back. So this
 * asserts the fact itself, on pages and generators alike.
 *
 * It checks two things:
 *   1. no surface anywhere pairs a barrel with wood, in English or Arabic;
 *   2. every capacity given for a barrel reads 220.
 *
 * Numbers are compared with tags stripped: the Arabic guides wrap digits in
 * <span dir="ltr"> to keep them from reordering, and a raw-text search misses
 * those -- one range did survive the first sweep exactly that way.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SKIP_DIRS = new Set(['node_modules', '.git', 'geo', 'docs']);
const EXTS = ['.html', '.js', '.py', '.txt'];

const BARREL = /[Bb]arrels?|براميل|برميل/;
// A capacity written next to a barrel: "220 kg", "220kg", "٢٢٠ كجم".
const CAPACITY = /(\d+(?:\.\d+)?)\s*(?:kg|KG|Kg|كجم|كغ)/g;
// How far from the word "barrel" a number still counts as that barrel's size.
// Wide enough to catch the card note, narrow enough to leave the bucket and
// jar rows that sit beside it alone.
const REACH = 70;

function walk(dir, out) {
  out = out || [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    // This file quotes the wording it forbids, so it cannot inspect itself.
    else if (EXTS.includes(path.extname(entry.name)) && full !== __filename) out.push(full);
  }
  return out;
}

const flatten = (html) => html.replace(/<[^>]+>/g, ' ').replace(/&ndash;/g, '–').replace(/\s+/g, ' ');

let pass = 0, fail = 0;
const t = (name, cond, extra) => {
  cond ? pass++ : fail++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : '   <-- ' + (extra === undefined ? '' : extra)}`);
};

const files = walk(ROOT);
const wooden = [];
const wrongSize = [];
let surfaces = 0;
let sized = 0;

for (const file of files) {
  const raw = fs.readFileSync(file, 'utf8');
  if (!BARREL.test(raw)) continue;
  const rel = path.relative(ROOT, file);
  surfaces++;
  const text = flatten(raw);

  // 1. wood anywhere near a barrel
  let m;
  const woodAll = /[Ww]ooden|خشبي/g;
  while ((m = woodAll.exec(text))) {
    const window = text.slice(Math.max(0, m.index - 90), m.index + 90);
    if (BARREL.test(window)) wooden.push(`${rel}: …${window.trim().slice(0, 100)}…`);
  }

  // 2. a capacity quoted for a barrel that is not 220
  const barrelAll = /[Bb]arrels?|براميل|برميل/g;
  while ((m = barrelAll.exec(text))) {
    const start = m.index + m[0].length;
    const after = text.slice(start, start + REACH);
    CAPACITY.lastIndex = 0;
    let n;
    while ((n = CAPACITY.exec(after))) {
      sized++;
      if (n[1] !== '220') wrongSize.push(`${rel}: "${m[0]}…${n[0]}" in …${after.trim().slice(0, 70)}…`);
    }
  }
}

t(`every surface mentioning a barrel was inspected (${surfaces} file(s))`, surfaces > 0);

t('no barrel is described as wooden, in either language',
  wooden.length === 0,
  wooden.length ? `${wooden.length}\n      ${wooden.slice(0, 5).join('\n      ')}` : '');

t(`every capacity quoted for a barrel reads 220 (${sized} figure(s))`,
  wrongSize.length === 0,
  wrongSize.length ? `${wrongSize.length}\n      ${wrongSize.slice(0, 5).join('\n      ')}` : '');

t('a barrel capacity is actually stated somewhere', sized > 0, `found ${sized}`);

// ---- buckets: 2, 5, 10 and 20 kg (owner, 2026-10-02) ----------------------
// The homepage table said 2 / 5 / 10 / 20 kg while the packaging pages, the
// guides, the catalogue, the Food-Service pages and two articles said
// "typically 1-10 kg". The owner confirmed the homepage. The old range, in
// any spelling, must not come back, and both homepage tables keep all four.
const OLD_BUCKET_RANGE = /\b1\s*[–-]\s*10\s*(kg|كجم)|من 1 إلى 10 كجم/i;
const oldRange = [];
for (const file of files) {
  const rel = path.relative(ROOT, file);
  if (/^scripts\/check-/.test(rel)) continue;
  const text = flatten(fs.readFileSync(file, 'utf8'));
  if (OLD_BUCKET_RANGE.test(text)) oldRange.push(rel);
}
t('no page, guide or catalogue gives buckets as "1-10 kg"; they are 2, 5, 10 and 20 kg',
  oldRange.length === 0, oldRange.join(', '));
const homeTables = ['index.html', 'ar/index.html'].filter((f) => {
  const text = flatten(fs.readFileSync(path.join(ROOT, f), 'utf8'));
  return !/(Plastic Bucket|دلو بلاستيك) 2 kg 5 kg 10 kg 20 kg/.test(text);
});
t('   and both homepage packaging tables list 2, 5, 10 and 20 kg buckets', homeTables.length === 0, homeTables.join(', '));

// ---- no vacuum packing (owner, 2026-10-03 and 2026-10-04; C-151) ---------
// Vacuum pouches / bags / vacuum-sealed packing are not a confirmed format.
// They were on 30-odd pages, the guides and 38 PDFs until Deploy 134.
const VACUUM = /\bvacuum[\s-]*(?:pouch|pouches|bag|bags|seal|sealed|packed|pack|packing)\b|\bretort\s*pouch|أكياس\s*(?:مفر\S*|التفريغ)|مفر[ّ]?غة\s*من\s*الهواء|معب[أا]\s*بالتفريغ/i;
const vacuum = [];
// The one sentence allowed to name vacuum packing is the plain denial in
// llms.txt, which AI search reads (2026-10-09: Google's AI summary still
// listed vacuum packaging). It is removed before matching, so any other
// wording -- an offer, a hedge -- still fails.
const VACUUM_DENIAL = 'Vacuum pouches, vacuum bags and vacuum-sealed packing are not offered.';
// ---- stuffed olives: pepper and carrot only (owner, 2026-10-04; C-152) ----
// The site offered pimiento, almond, garlic and lemon fillings. Only pepper
// and carrot are confirmed, and no pepper variety is named. A filling is
// caught in a stuffing sentence ("stuffed with ... almond") or as a run of
// filling chips ("Almond Garlic"). "almond shape" (Kalamata) and "marinated
// with herbs, garlic and citrus" are not fillings and pass.
const FILL_EN = /\b(?:stuffed|stuffing|filled)\b[^.;:]{0,80}?\b(pimientos?|almonds?|garlic|lemons?)\b/i;
const CHIPS_EN = /\b(?:Pimiento|Almond|Garlic|Lemon)\s+(?:Almond|Garlic|Lemon)\b/;
// (No \b here: in a JavaScript regex \b only sees ASCII letters, so it never
// matches beside an Arabic one. Word edges are spelled out instead.)
const AR_EDGE = '(?=$|[\\s،؛.)/(])';
const FILL_AR = new RegExp(`(?:محشو|محشوة|محشوًا|المحشو|حشو)[^.؛:]{0,80}?(?:^|[\\s(،/])(?:ب?ال)?(?:لوز|ثوم|ليمون)${AR_EDGE}|(?:محشو|محشوة|محشوًا|المحشو)[^.؛:]{0,80}?(?:بالفلفل الأحمر|فلفل أحمر)`);
const CHIPS_AR = new RegExp(`(?:^|\\s)(?:محشو )?(?:ب?ال)?(?:لوز|ثوم|ليمون)\\s+(?:محشو )?(?:ب?ال)?(?:لوز|ثوم|ليمون)${AR_EDGE}`);
const fillings = [];
for (const file of files) {
  const rel = path.relative(ROOT, file);
  if (/^scripts\/check-/.test(rel)) continue;
  const text = flatten(fs.readFileSync(file, 'utf8'));
  const v = text.split(VACUUM_DENIAL).join(' ').match(VACUUM);
  if (v) vacuum.push(`${rel}: "${v[0]}"`);
  for (const re of [FILL_EN, CHIPS_EN, FILL_AR, CHIPS_AR]) {
    const f = text.match(re);
    if (f) fillings.push(`${rel}: "${f[0].slice(-70)}"`);
  }
}
t('no page, guide, catalogue source or generator offers vacuum pouches or vacuum packing, in either language',
  vacuum.length === 0, vacuum.length ? `${vacuum.length}\n      ${vacuum.slice(0, 5).join('\n      ')}` : '');
t('stuffed olives name only pepper and carrot: no almond, garlic, lemon or pimiento filling, in either language',
  fillings.length === 0, fillings.length ? `${fillings.length}\n      ${fillings.slice(0, 6).join('\n      ')}` : '');

console.log(`\npackaging-claims OK -- ${surfaces} surface(s) mention a barrel, none of them wooden, and all ${sized} capacity figure(s) read 220 kg.`);
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
