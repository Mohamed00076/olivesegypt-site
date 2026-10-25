#!/usr/bin/env node
'use strict';

/*
 * Every statement of the indicative lead time agrees with scripts/lead-time.js,
 * and the retired range is gone.
 *
 *   node scripts/check-lead-time.js        (part of `npm test`)
 *
 * Owner decision 2026-10-25 (C-181): the lead time went from 3–4 to 4–6 weeks
 * "in every language and everywhere it is published". A range typed by hand
 * on seven separate pages and sources is exactly what drifts, so:
 *
 *   1. the retired range -- any digits, dash or words, in English or Arabic --
 *      appears in no tracked file but the history files;
 *   2. every week range anywhere is the lead time, in its exact wording, and
 *      each place that states it has the label (and, where required, the
 *      "confirmed during quotation" qualifier);
 *   3. in Arabic, the range sits in its own <span dir="ltr">, so "4–6" can
 *      never display or extract as "6–4".
 *
 * Text is compared after decoding entities and removing tags: the English
 * profile writes the dash as &ndash;, and the PDF source wraps the range in
 * a <span class="nb">. The PDFs themselves are printed from the sources and
 * held to them by check-guide-pdfs.js; when pdftotext is installed, their
 * text is scanned for the retired range too.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const L = require('./lead-time');

const ROOT = path.join(__dirname, '..');
const SELF = ['scripts/lead-time.js', 'scripts/check-lead-time.js'];
const BINARY = /\.(png|jpe?g|webp|gif|ico|svg|woff2?|ttf|otf|pdf|zip|mp4)$/i;

const problems = [];
const fail = (msg) => problems.push(msg);

const ENTITIES = { '&ndash;': '–', '&mdash;': '—', '&nbsp;': ' ', '&amp;': '&', '&middot;': '·', '&#x27;': "'", '&quot;': '"' };
function decode(text) {
  return text.replace(/&[a-z#0-9]+;/gi, (e) => ENTITIES[e] || e).replace(/[\s ]+/g, ' ');
}
// What a reader sees: the text with its tags removed.
function plain(text) {
  return decode(text.replace(/<[^>]*>/g, ''));
}
// The same, keeping what the tags' attributes say -- a placeholder, a meta
// description, an alt text -- since a lead time can be stated there too.
function withAttributes(text) {
  return decode(text.replace(/<[^>]*>/g, (tag) => ' ' + (tag.match(/="[^"]*"/g) || []).map((a) => a.slice(2, -1)).join(' ') + ' '));
}

const tracked = execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean);

// ---- 1. the retired range, outside the history files -----------------------
// ---- 2a. every week range is the lead time, in its exact wording -----------
const WEEK_RANGE = /(?<![\d/-])(\d+)\s*[-–—]\s*(\d+)\s*(weeks?\b|أسابيع)/gi;
const EN_VALUE = L.LEAD_TIME.en.value;
const AR_VALUE = L.LEAD_TIME.ar.value;
let scanned = 0;
for (const f of tracked) {
  if (BINARY.test(f) || L.HISTORY.includes(f) || SELF.includes(f)) continue;
  const abs = path.join(ROOT, f);
  if (!fs.existsSync(abs)) continue;
  const text = withAttributes(fs.readFileSync(abs, 'utf8'));
  scanned++;
  const old = text.match(L.RETIRED);
  if (old) fail(`${f}: still states the retired lead time "${old[0]}" (now ${EN_VALUE}, C-181)`);
  // Test fixtures are made-up documents, not statements.
  if (/^scripts\/check-/.test(f)) continue;
  for (const m of text.matchAll(WEEK_RANGE)) {
    const from = text.slice(m.index);
    if (!from.startsWith(EN_VALUE) && !from.startsWith(AR_VALUE)) {
      fail(`${f}: "${from.slice(0, 50).trim()}" -- every week range must read "${EN_VALUE}" or "${AR_VALUE}"`);
    }
  }
}

// ---- 2b. each statement, with its label and qualifier ----------------------
for (const s of L.STATEMENTS) {
  const abs = path.join(ROOT, s.file);
  if (!fs.existsSync(abs)) { fail(`${s.file}: missing (listed in scripts/lead-time.js)`); continue; }
  const text = plain(fs.readFileSync(abs, 'utf8'));
  const want = L.LEAD_TIME[s.lang];
  if (s.hint) {
    if (!withAttributes(fs.readFileSync(abs, 'utf8')).includes(`e.g. ${want.value}`)) fail(`${s.file}: the example does not read "e.g. ${want.value}"`);
    continue;
  }
  const at = text.indexOf(want.value);
  if (at < 0) { fail(`${s.file}: does not state "${want.value}"`); continue; }
  const before = text.slice(Math.max(0, at - 60), at);
  const hasLabel = s.lang === 'en' ? before.toLowerCase().includes(want.label.toLowerCase()) : before.includes(want.label);
  if (!hasLabel) fail(`${s.file}: the lead time is not labelled "${want.label}"`);
  if (s.qualifier && !text.slice(at, at + want.value.length + 60).includes(L.QUALIFIER[s.lang])) {
    fail(`${s.file}: the lead time is not followed by "${L.QUALIFIER[s.lang]}", so it could read as a guarantee`);
  }
}

// ---- 3. Arabic ranges in their own left-to-right isolate -------------------
for (const f of tracked) {
  if (!/\.html$/.test(f) || !(/^ar\//.test(f) || /-ar\.html$/.test(f) || /\/ar\//.test(f))) continue;
  const raw = fs.readFileSync(path.join(ROOT, f), 'utf8');
  for (const m of raw.matchAll(/(\d+\s*[-–—]\s*\d+)\s*(<\/span>)?\s*أسابيع/g)) {
    const isolated = m[2] && raw.slice(Math.max(0, m.index - 20), m.index).endsWith('<span dir="ltr">');
    if (!isolated) fail(`${f}: the Arabic range "${m[1]}" is not in its own <span dir="ltr">, so it can display reversed`);
  }
}

// ---- the PDFs, when pdftotext is here to read them -------------------------
let pdfNote = 'pdftotext not installed: PDF text not scanned (check-guide-pdfs holds them to their sources)';
try {
  execFileSync('pdftotext', ['-v'], { stdio: 'ignore' });
  const pdfs = tracked.filter((f) => f.endsWith('.pdf'));
  for (const f of pdfs) {
    const text = execFileSync('pdftotext', ['-q', path.join(ROOT, f), '-'], { encoding: 'utf8' }).replace(/[\s‎‏‪-‮⁦-⁩]+/g, ' ');
    const old = text.match(L.RETIRED);
    if (old) fail(`${f}: the PDF still states "${old[0]}" -- reprint it (scripts/generate-export-catalog-pdf.js)`);
  }
  pdfNote = `${pdfs.length} PDFs' text scanned`;
} catch (e) {
  if (e.code !== 'ENOENT' && e.status === undefined) throw e;
}

if (problems.length) {
  console.error(`lead-time: ${problems.length} problem(s):\n  ` + problems.join('\n  '));
  process.exit(1);
}
console.log(`lead-time OK -- ${scanned} files carry no retired range; ${L.STATEMENTS.length} statements read ` +
  `"${EN_VALUE}" / "${AR_VALUE}" with their labels, Arabic ranges isolated; ${pdfNote}.`);
