#!/usr/bin/env node
'use strict';

/*
 * The CRM's printed documents keep the owner's design spec (2026-10-25) in
 * their source: static fonts, the colour tokens, and no text too small.
 *
 *   node scripts/check-crm-document-print.js        (part of `npm test`)
 *
 * crm/document/view/ prints every quotation, proforma, invoice, packing list
 * and letter. What the spec asks of it, held here:
 *
 *   1. Fonts: Plus Jakarta Sans and Amiri from STATIC files
 *      (assets/fonts/doc-fonts.css, 'TC Doc Sans' / 'TC Doc Arabic'). The
 *      site's variable fonts embed in a PDF as Type 3 and break the text
 *      layer, so no rule on the page may name them, and no file the
 *      stylesheet serves may carry a variation table.
 *   2. Sizes: nothing under 8 pt; the body 10 pt; the line table at least
 *      9.5 pt; a letter's body 10.4 pt on a 1.7 line height. That includes
 *      the printed footer and running header, which the page writes as CSS.
 *   3. Colours: the spec's tokens, gold never as text on white, and every
 *      text colour pair readable (WCAG AA, 4.5:1).
 *
 * The printed PDFs themselves are checked by check-crm-document-pdfs.js.
 */

const fs = require('fs');
const path = require('path');
const { woff2Tables } = require('./woff2-tables');

const ROOT = path.join(__dirname, '..');
const PAGE = 'crm/document/view/index.html';
const FONTS = 'assets/fonts/doc-fonts.css';
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

const problems = [];
const fail = (m) => problems.push(m);

const page = read(PAGE);
const style = (page.match(/<style>([\s\S]*?)<\/style>/) || ['', ''])[1].replace(/\/\*[\s\S]*?\*\//g, '');
// The CSS the page writes for the printed footer and running header.
const script = page.slice(page.indexOf('function setPrintFooter'), page.indexOf('function setPrintFooter') + 4000);

// ---- 1. fonts ----------------------------------------------------------------
if (!page.includes(`<link href="/${FONTS}" rel="stylesheet">`)) fail(`${PAGE}: does not load /${FONTS}`);
for (const [src, where] of [[style, 'its styles'], [script, 'the printed footer and header']]) {
  for (const m of src.matchAll(/font-family:\s*([^;}]+)/g)) {
    if (/Plus Jakarta Sans|Noto Naskh Arabic/.test(m[1])) fail(`${PAGE}: ${where} name a variable font (${m[1].trim()}); use 'TC Doc Sans' / 'TC Doc Arabic'`);
  }
}
if (!/\.sheet \{[^}]*font-family: 'TC Doc Sans'/.test(style)) fail(`${PAGE}: the sheet is not set in 'TC Doc Sans'`);
if (!/\[dir="rtl"\] \.sheet \{[^}]*font-family: 'TC Doc Arabic'/.test(style)) fail(`${PAGE}: the Arabic sheet is not set in 'TC Doc Arabic'`);
if ((script.match(/'TC Doc Sans', sans-serif/g) || []).length < 2) fail(`${PAGE}: the printed footer and header are not set in 'TC Doc Sans'`);

const fontCss = read(FONTS);
const families = new Set();
for (const face of fontCss.matchAll(/@font-face \{([\s\S]*?)\}/g)) {
  const family = (face[1].match(/font-family: '([^']+)'/) || [])[1];
  const url = (face[1].match(/url\(([^)]+)\)/) || [])[1];
  families.add(family);
  if (!url || !fs.existsSync(path.join(ROOT, url))) { fail(`${FONTS}: ${url || 'a face'} does not exist`); continue; }
  const tables = woff2Tables(fs.readFileSync(path.join(ROOT, url)));
  const varTables = tables.filter((t) => ['fvar', 'gvar', 'CFF2', 'HVAR', 'avar'].includes(t));
  if (varTables.length) fail(`${url}: is a variable font (${varTables.join(', ')}); it would print as Type 3`);
  if (!tables.includes('glyf')) fail(`${url}: has no TrueType outlines`);
}
for (const f of ['TC Doc Sans', 'TC Doc Arabic']) if (!families.has(f)) fail(`${FONTS}: defines no '${f}'`);

// ---- 2. sizes ----------------------------------------------------------------
const pt = (v, unit) => (unit === 'px' ? Number(v) * 0.75 : Number(v));
for (const [src, where] of [[style, 'styles'], [script, 'printed footer or header']]) {
  for (const m of src.matchAll(/font-size:\s*([\d.]+)(px|pt)/g)) {
    if (pt(m[1], m[2]) < 8) fail(`${PAGE}: a ${m[1]}${m[2]} font in its ${where} is under 8 pt`);
  }
}
function sizeOf(selector) {
  const rule = style.match(new RegExp(`(?:^|\\n)\\s*${selector.replace(/[.[\]"]/g, '\\$&')} \\{([^}]*)\\}`));
  const m = rule && rule[1].match(/font-size:\s*([\d.]+)(px|pt)/);
  return m ? pt(m[1], m[2]) : null;
}
const want = [['.sheet', 10, 'the body'], ['.doc-table', 9.5, 'the line table'], ['.doc-letter-body', 10.4, "a letter's body"]];
for (const [sel, min, what] of want) {
  const s = sizeOf(sel);
  if (s === null || s < min) fail(`${PAGE}: ${what} (${sel}) is ${s === null ? 'unset' : s + ' pt'}, not ${min} pt`);
}
if (!/\.doc-letter-body \{[^}]*line-height: 1\.7;/.test(style)) fail(`${PAGE}: a letter's body is not on a 1.7 line height`);

// ---- 3. colours ----------------------------------------------------------------
const TOKENS = { green: '#4b5a23', gold: '#b8923a', 'gold-on-green': '#e6c57d', cream: '#f7f2e4', ink: '#25281c', muted: '#5f6654', line: '#ddd8c4' };
const root = (style.match(/:root \{([^}]*)\}/) || ['', ''])[1];
for (const [k, v] of Object.entries(TOKENS)) {
  if (!new RegExp(`--doc-${k}: ${v};`, 'i').test(root)) fail(`${PAGE}: --doc-${k} is not ${v} (the owner's spec)`);
}
if (/(?:^|[;{\s])color:\s*var\(--doc-gold\)/.test(style)) fail(`${PAGE}: gold is used as a text colour; it is for rules, borders and stripes only`);
function lum(hex) {
  const c = hex.match(/[0-9a-f]{2}/gi).map((h) => parseInt(h, 16) / 255).map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
for (const [fg, bg, what] of [
  ['ink', '#ffffff', 'ink on white'], ['muted', '#ffffff', 'muted on white'], ['muted', 'cream', 'muted on the cream cards'],
  ['green', '#ffffff', 'green on white'], ['green', 'cream', 'green on the cream rows'],
  ['#ffffff', 'green', 'white on green'], ['gold-on-green', 'green', 'the small gold labels on green'],
]) {
  const c = (k) => (k.startsWith('#') ? k : TOKENS[k]);
  const r = ratio(c(fg), c(bg));
  if (r < 4.5) fail(`${what}: contrast ${r.toFixed(2)}:1, under 4.5:1`);
}

if (problems.length) {
  console.error(`crm-document-print: ${problems.length} problem(s):\n  ` + problems.join('\n  '));
  process.exit(1);
}
console.log(`crm-document-print OK -- the documents are set in static Plus Jakarta Sans and Amiri (${families.size} families, ` +
  `no variable file), nothing under 8 pt (body 10, table 9.5, letters 10.4 pt), the spec's colours, every text pair 4.5:1 or better.`);
