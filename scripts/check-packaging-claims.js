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
 * claim survived in scripts/generate-resource-pages.py long after the pages
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

console.log(`\npackaging-claims OK -- ${surfaces} surface(s) mention a barrel, none of them wooden, and all ${sized} capacity figure(s) read 220 kg.`);
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
