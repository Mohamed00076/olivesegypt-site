#!/usr/bin/env node
'use strict';

/*
 * An issued document says, when printed again, what it said when issued.
 *
 *   node scripts/check-crm-document-values.js        (part of `npm test`)
 *
 * Owner, 2026-10-25: "Issued documents are records: their numbers, lines,
 * totals and text must not change ... prove a re-render keeps every value
 * identical." The document page renders each document from its stored row,
 * so a change to the page reaches every document ever issued. The page's
 * DESIGN_CUTOFF splits them:
 *
 *   - issued BEFORE it: the printed text is exactly what it was, word for
 *     word, number for number;
 *   - issued from it on: the same, except what the owner changed on
 *     2026-10-25 and nothing else -- no "Minimum order" / "Prices" rows the
 *     document never stored, dates as "18 October 2026", and the Arabic
 *     comma between the signatory's role and the company.
 *
 * docs/crm-samples/before/ holds each sample's text as the page printed it
 * before these rules; docs/crm-samples/<name>.txt is the current print's
 * (both written by scripts/print-crm-samples.js). The samples are dated on
 * both sides of the cutoff.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { ROOT, OUT_DIR, MANIFEST, SAMPLES } = require('./crm-sample-documents');

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const problems = [];
const fail = (m) => problems.push(m);

const page = read('crm/document/view/index.html');
const cutoffText = (page.match(/var DESIGN_CUTOFF = '([^']+)';/) || [])[1];
const cutoff = new Date(cutoffText);
if (!cutoffText || isNaN(cutoff)) {
  console.error('crm-document-values: crm/document/view/index.html has no valid DESIGN_CUTOFF');
  process.exit(1);
}
const manifest = JSON.parse(read(path.relative(ROOT, MANIFEST)));

// The owner's changes of 2026-10-25, applied to what a document said before.
const MONTHS = 'January|February|March|April|May|June|July|August|September|October|November|December';
const DROPPED_ROWS = [
  'Minimum order\nFull container load (FCL)\nPrices\nPer unit shown\n',
  'الحد الأدنى للطلب\nحاوية كاملة (FCL)\nالأسعار\nللوحدة المبينة\n',
];
function asRedesigned(text, doc) {
  let t = text.replace(new RegExp(`\\b(${MONTHS}) (\\d{1,2}), (\\d{4})\\b`, 'g'), '$2 $1 $3');
  if (doc.doc_type === 'quotation') for (const rows of DROPPED_ROWS) t = t.split(rows).join('');
  if (doc.language === 'ar') t = t.split(', الشركة الثلاثية للتنمية الصناعية').join('، الشركة الثلاثية للتنمية الصناعية');
  return t;
}

let before = 0, after = 0;
for (const s of SAMPLES) {
  const name = `${OUT_DIR}/${s.name}`;
  const cur = path.join(ROOT, `${name}.txt`);
  const old = path.join(ROOT, OUT_DIR, 'before', `${s.name}.txt`);
  if (!fs.existsSync(cur)) { fail(`${name}.txt: missing -- run scripts/print-crm-samples.js`); continue; }
  if (!fs.existsSync(old)) { fail(`${OUT_DIR}/before/${s.name}.txt: missing -- the text this sample printed before`); continue; }
  const now = fs.readFileSync(cur, 'utf8');
  const was = fs.readFileSync(old, 'utf8');
  const entry = manifest[`${name}.pdf`];
  if (!entry || entry.text !== sha256(now)) fail(`${name}.txt: not the text of the recorded print -- reprint`);

  const issuedBefore = new Date(s.doc.created_at) < cutoff;
  const want = issuedBefore ? was : asRedesigned(was, s.doc);
  if (issuedBefore) before++; else after++;
  if (now !== want) {
    const a = want.split('\n'), b = now.split('\n');
    const i = a.findIndex((l, k) => l !== b[k]);
    fail(`${name}: issued ${issuedBefore ? 'before' : 'after'} the cutoff, its text changed at line ${i + 1}: ` +
      `"${(a[i] || '(end)').slice(0, 60)}" became "${(b[i] || '(end)').slice(0, 60)}"`);
  }
  if (!issuedBefore && s.doc.language === 'en' && new RegExp(`\\b(${MONTHS}) \\d{1,2}, \\d{4}\\b`).test(now)) {
    fail(`${name}: a US-style date on a document issued after the cutoff`);
  }
}
if (!before || !after) fail(`the samples must be dated on both sides of DESIGN_CUTOFF (${cutoffText}): ${before} before, ${after} after`);

if (problems.length) {
  console.error(`crm-document-values: ${problems.length} problem(s):\n  ` + problems.join('\n  '));
  process.exit(1);
}
console.log(`crm-document-values OK -- ${before} documents issued before ${cutoffText} print word for word as before; ` +
  `${after} issued after differ only by the owner's changes (no unstored terms, "18 October 2026", the Arabic comma).`);
