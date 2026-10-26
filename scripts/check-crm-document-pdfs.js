#!/usr/bin/env node
'use strict';

/*
 * The sample CRM documents, as printed, have a sound text layer.
 *
 *   node scripts/check-crm-document-pdfs.js        (part of `npm test`)
 *
 * docs/crm-samples/ holds real prints of the document page with made-up data
 * (scripts/crm-sample-documents.js; printed by scripts/print-crm-samples.js):
 * every type, both languages, one line, three, twenty-five, a letter, a void
 * quotation. Owner's spec, 2026-10-25, for each of them:
 *
 *   1. it is current: printed from the page, fonts and logo as they are now
 *      (a changed page means the samples are reprinted and looked at);
 *   2. it is tagged, declares its language, and shows its title;
 *   3. its fonts are embedded as real fonts -- no Type 3, which is what a
 *      variable font becomes, and which breaks copying and search -- and are
 *      the document fonts, Plus Jakarta Sans and Amiri;
 *   4. in Arabic, the company's name comes out of the text layer intact,
 *      «الثلاثية» and not «الثالثية» (needs pdftotext; skipped and said so
 *      where it is not installed).
 *
 * Chromium writes object dictionaries uncompressed, so a few patterns read
 * them, as check-pdf-structure.js does.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { ROOT, OUT_DIR, MANIFEST, INPUTS, SAMPLES } = require('./crm-sample-documents');

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const problems = [];
const fail = (m) => problems.push(m);

if (!fs.existsSync(MANIFEST)) {
  console.error(`crm-document-pdfs: ${path.relative(ROOT, MANIFEST)} is missing -- run scripts/print-crm-samples.js`);
  process.exit(1);
}
const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
const now = {};
for (const f of INPUTS) now[f] = sha256(fs.readFileSync(path.join(ROOT, f)));

let pdftotext = true;
try { execFileSync('pdftotext', ['-v'], { stdio: 'ignore' }); } catch (e) { pdftotext = false; }

for (const s of SAMPLES) {
  const out = `${OUT_DIR}/${s.name}.pdf`;
  const entry = manifest[out];
  const file = path.join(ROOT, out);
  if (!entry || !fs.existsSync(file)) { fail(`${out}: missing -- run scripts/print-crm-samples.js`); continue; }
  const buf = fs.readFileSync(file);

  // 1
  if (sha256(buf) !== entry.pdf) fail(`${out}: not the file that was printed (its fingerprint differs)`);
  const stale = INPUTS.filter((f) => entry.inputs[f] !== now[f]);
  if (stale.length) fail(`${out}: printed before ${stale.join(', ')} changed -- reprint with scripts/print-crm-samples.js and look at the result`);

  const text = buf.toString('latin1');
  // The catalog's whole object: its dictionary nests others (/MarkInfo <<...>>).
  const catalog = [...text.matchAll(/\d+ 0 obj\s*([\s\S]*?)endobj/g)].map((m) => m[1]).find((d) => /\/Type \/Catalog\b/.test(d)) || '';
  // 2
  if (!/\/Marked true/.test(text) || !/\/StructTreeRoot \d+ 0 R/.test(catalog)) fail(`${out}: is not tagged`);
  const lang = (catalog.match(/\/Lang \(([^)]*)\)/) || [])[1];
  if (lang !== s.doc.language) fail(`${out}: declares language ${lang || 'none'}, not ${s.doc.language}`);
  if (!/\/DisplayDocTitle true/.test(catalog)) fail(`${out}: does not ask viewers to show its title`);
  if (!/\/Title (\(|<)/.test(text)) fail(`${out}: has no title`);
  // 3
  if (/\/Subtype \/Type3/.test(text)) fail(`${out}: has a Type 3 font, so its text layer is broken`);
  const fonts = [...new Set([...text.matchAll(/\/BaseFont \/(?:[A-Z]{6}\+)?([A-Za-z0-9-]+)/g)].map((m) => m[1]))];
  const foreign = fonts.filter((f) => !/^(PlusJakartaSans|Amiri)-/.test(f));
  if (foreign.length) fail(`${out}: embeds ${foreign.join(', ')}, not the document fonts`);
  if (s.doc.language === 'ar' && !fonts.some((f) => f.startsWith('Amiri-'))) fail(`${out}: is Arabic but embeds no Amiri`);
  // 4
  if (pdftotext && s.doc.language === 'ar') {
    const t = execFileSync('pdftotext', ['-q', file, '-'], { encoding: 'utf8' });
    if (!t.includes('الثلاثية') || t.includes('الثالثية')) fail(`${out}: «الثلاثية» does not come out of the text layer intact`);
  }
}

if (problems.length) {
  console.error(`crm-document-pdfs: ${problems.length} problem(s):\n  ` + problems.join('\n  '));
  process.exit(1);
}
console.log(`crm-document-pdfs OK -- ${SAMPLES.length} sample documents are current, tagged, in their own language with a shown title, ` +
  `in embedded Plus Jakarta Sans and Amiri with no Type 3` + (pdftotext ? ', and «الثلاثية» reads intact in the Arabic ones.' : '; pdftotext not installed, the Arabic text layer not read.'));
