#!/usr/bin/env node
'use strict';

/*
 * Arabic pages read right to left, all the way through.
 *
 *   node scripts/check-rtl.js        (part of `npm test`)
 *
 * The Phase 4c Arabic pass (2026-10-09) checked all Arabic pages, in the
 * markup and rendered in Chromium at 390px and 1280px, and found:
 *   - lines forced left-to-right while holding Arabic words, so an Arabic
 *     reader met the words in the wrong order: the acidity tile on nine
 *     product pages, the Arabic catalogue and its print version
 *     ("0.2–0.4% لاكتيك"), the payment line on How We Work, and the currency
 *     on the Company Profile ("USD أو EUR"). Only the figure is
 *     left-to-right now (<span dir="ltr">), and the sentence is Arabic order;
 *   - commercial terms left in English on the Arabic Company Profile
 *     ("1 × 20ft container", "30% T/T deposit · 70% vs B/L copy") and
 *     "tonnes" in the Arabic production table;
 *   - the articles' closing callout with its accent bar on the left, the
 *     end of an Arabic line, instead of the start (border-l-4, now
 *     border-s-4);
 *   - headings numbered "1. " with Western digits, which right-to-left text
 *     shows as ".1" (fixed in Phase 4b; the site numbers Arabic steps ١. ٢.).
 *
 * This holds each fix:
 *   1. every Arabic page is <html lang="ar" dir="rtl">;
 *   2. no element marked dir="ltr" holds Arabic letters in its own text;
 *   3. no heading or list entry starts with a Western-digit number "N. ";
 *   4. no accent bar is drawn with a physical side (border-l-4, border-r-4);
 *   5. no English word is left in the visible text, other than the terms of
 *      the trade the Arabic copy keeps on purpose (FOB, OEM, pH, kg...),
 *      the English glosses it gives in brackets ("(Co-packing)"), and
 *      addresses. Anything in an aria-hidden block (the forms' off-screen
 *      anti-spam field) is not shown to a reader and is skipped.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}

const pages = walk(path.join(ROOT, 'ar'), []).sort();

// Latin words the Arabic copy keeps on purpose: trade terms, units, names
// of services and organisations. Lower-case comparison.
const KEEP = new Set([
  'fob', 'cif', 'cfr', 'oem', 'b2b', 'moq', 'pdf', 'hs', 'lcl', 'pet', 'l/c', 't/t', 'b/l', 'ph', 'kg', 'ml',
  'mm', 'ft', 'mt', 'l', 'k', 'a', 'b', 'c', 't', 'e', 'ma', 'ioc', 'fao', 'usd', 'eur', 'ip', 'pdpl', 'gdpr',
  'incoterm', 'incoterms', 'umami', 'netlify', 'neon', 'postgres', 'meta', 'search', 'console', 'vcard',
  'ripe', 'ncc', 'afrinic', 'arin', 'apnic', 'lacnic', 'whatsapp', 'facebook', 'linkedin', 'instagram',
  'google', 'olivesegypt.com', 'sales',
]);

const AR = /[؀-ۿ]/;
const problems = [];
let checked = 0;

for (const file of pages) {
  const rel = path.relative(ROOT, file);
  const html = fs.readFileSync(file, 'utf8');
  if (!/<html\b/.test(html)) continue;
  checked++;
  const say = (msg) => problems.push(`${rel}: ${msg}`);

  // 1
  if (!/<html[^>]*\blang="ar"[^>]*\bdir="rtl"|<html[^>]*\bdir="rtl"[^>]*\blang="ar"/.test(html)) {
    say('<html> is not lang="ar" dir="rtl"');
  }

  // 2
  for (const m of html.matchAll(/<(\w+)\b[^>]*\bdir="ltr"[^>]*>([^<]*)/g)) {
    if (AR.test(m[2])) say(`dir="ltr" <${m[1]}> holds Arabic text: "${m[2].trim().slice(0, 50)}"`);
  }

  // 3
  for (const m of html.matchAll(/<(h[1-6]|li|a)\b[^>]*>\s*([0-9]+)\. (?=[؀-ۿ])/g)) {
    say(`<${m[1]}> numbered "${m[2]}. " with a Western digit (use ${'٠١٢٣٤٥٦٧٨٩'[+m[2] % 10]}.)`);
  }

  // 4
  for (const m of html.matchAll(/class="[^"]*(?<![\w-])(border-[lr]-4)(?![\w-])[^"]*"/g)) {
    say(`accent bar on a physical side: ${m[1]} (use border-${m[1][7] === 'l' ? 's' : 'e'}-4)`);
  }

  // 5
  const main = (html.match(/<main\b[\s\S]*?<\/main>/) || [''])[0]
    .replace(/<(svg|script|style)\b[\s\S]*?<\/\1>/g, ' ')
    .replace(/<div\b[^>]*aria-hidden="true"[^>]*>(?:(?!<div\b)[\s\S])*?<\/div>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;|&#x?[0-9a-f]+;/gi, ' ')
    .replace(/\([^()؀-ۿ]*[A-Za-z][^()؀-ۿ]*\)/g, ' ')   // English glosses in brackets
    .replace(/\S+@\S+/g, ' ');
  const stray = new Set();
  for (const w of main.match(/[A-Za-z][A-Za-z./-]*[A-Za-z]|[A-Za-z]/g) || []) {
    if (!KEEP.has(w.toLowerCase()) && !/^[A-Z0-9/]{2,6}$/.test(w)) stray.add(w);
  }
  if (stray.size) say(`English left in the Arabic text: ${[...stray].slice(0, 8).join(', ')}`);
}

if (problems.length) {
  console.error(`rtl: ${problems.length} problem(s) on the Arabic pages:\n  ` + problems.join('\n  '));
  process.exit(1);
}
console.log(`rtl OK -- ${checked} Arabic pages are lang="ar" dir="rtl", hold no Arabic inside a left-to-right element, number no heading with a Western "N. ", draw no accent bar on a physical side, and leave no English word outside the kept trade terms.`);
