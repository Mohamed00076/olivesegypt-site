#!/usr/bin/env node
'use strict';

/*
 * Every figure on an Arabic page is the figure on its English twin.
 *
 *   node scripts/check-figure-parity.js        (part of `npm test`)
 *
 * On 2026-10-09 the Phase 4c Arabic pass compared the two languages by hand
 * and found the Arabic production table on /ar/resources/why-egyptian-olives
 * giving Spain's year-over-year change as "−28%", where the English page, the
 * claim register (C-128) and the source give "+28%". It had been live for
 * weeks; nothing checked that the two languages state the same numbers. This
 * does, for every page pair, the gated guides and the two catalogue sources:
 *
 *   - every figure in the Arabic text must appear in the English text: the
 *     Arabic must not state a number the English does not;
 *   - every figure in the English text must appear in the Arabic text, except
 *     whole numbers up to 10, which Arabic often writes as words ("عشرة
 *     منتجات", "العاشر من رمضان"), and the few listed in WORDED below;
 *   - a percentage keeps its sign, so "+28%" and "−28%" are different figures.
 *
 * Arabic-Indic digits and the Arabic decimal and thousands separators are read
 * as their Western equivalents; thousands separators are ignored. A number
 * joined to an Arabic letter ("و4.2", "and 4.2") still counts. Only the visible
 * text is read: <main> on a page (the whole <body> of a guide), without
 * scripts, styles, icons or the aria-hidden anti-spam field.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

// English figures the Arabic writes in words, page by page, with the words.
const WORDED = {
  'contact/index.html': { 24: '"WhatsApp available 24/7" is "متاح على مدار الساعة"' },
};

function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name === 'index.html') out.push(p);
  }
  return out;
}

const pairs = [];
for (const ar of walk(path.join(ROOT, 'ar'), []).sort()) {
  const en = path.join(ROOT, path.relative(path.join(ROOT, 'ar'), ar));
  if (fs.existsSync(en)) pairs.push([en, ar]);
}
const guides = path.join(ROOT, 'netlify', 'functions', '_guides');
for (const f of fs.readdirSync(path.join(guides, 'ar')).filter((f) => f.endsWith('.html')).sort()) {
  pairs.push([path.join(guides, 'en', f), path.join(guides, 'ar', f)]);
}
pairs.push([path.join(ROOT, 'scripts', 'export-catalog-source.html'), path.join(ROOT, 'scripts', 'export-catalog-source-ar.html')]);

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', nbsp: ' ', minus: '-', ndash: '–', mdash: '—', times: '×', middot: '·', sim: '~', rarr: ' ', larr: ' ' };

function text(file) {
  const html = fs.readFileSync(file, 'utf8');
  const part = (html.match(/<main\b[\s\S]*?<\/main>/) || html.match(/<body\b[\s\S]*?<\/body>/) || [html])[0];
  return part
    .replace(/<(svg|script|style)\b[\s\S]*?<\/\1>/g, ' ')
    .replace(/<div\b[^>]*aria-hidden="true"[^>]*>(?:(?!<div\b)[\s\S])*?<\/div>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#([0-9]+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&([a-z]+);/gi, (m, n) => ENT[n.toLowerCase()] || ' ')
    .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
    .replace(/٫/g, '.').replace(/٬/g, ',').replace(/[−–](?=\d)/g, '-');
}

function figures(t) {
  const out = new Set();
  for (const m of t.matchAll(/(?<![0-9A-Za-z.])([+-]?)(\d[\d,]*(?:\.\d+)?)(\s?%)?/g)) {
    const n = m[2].replace(/,/g, '');
    out.add(m[3] ? `${m[1]}${n}%` : n);
  }
  return out;
}

const problems = [];
for (const [en, ar] of pairs) {
  const relEn = path.relative(ROOT, en);
  const relAr = path.relative(ROOT, ar);
  if (!fs.existsSync(en)) { problems.push(`${relAr}: no English twin at ${relEn}`); continue; }
  const e = figures(text(en));
  const a = figures(text(ar));
  const worded = WORDED[relEn] || {};
  const arOnly = [...a].filter((x) => !e.has(x));
  const enOnly = [...e].filter((x) => !a.has(x) && !(/^\d+$/.test(x) && +x <= 10) && !(x in worded));
  if (arOnly.length) problems.push(`${relAr}: states ${arOnly.join(', ')}, which ${relEn} does not`);
  if (enOnly.length) problems.push(`${relAr}: does not state ${enOnly.join(', ')}, which ${relEn} does`);
}

if (problems.length) {
  console.error(`figure-parity: ${problems.length} page(s) whose Arabic and English figures differ:\n  ` + problems.join('\n  '));
  process.exit(1);
}
console.log(`figure-parity OK -- ${pairs.length} English/Arabic pairs (pages, gated guides, the export catalogue) state the same figures, signs included.`);
