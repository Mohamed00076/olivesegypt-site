#!/usr/bin/env node
'use strict';

/*
 * The claim and evidence register reads as the table it is meant to be.
 *
 *   node scripts/check-claim-register.js        (part of `npm test`)
 *
 * docs/claim-and-evidence-register.csv is where every factual and commercial
 * claim on the site is classified. On 2026-09-28 two new rows were appended
 * to a file with no final line break: C-129 was glued onto the end of C-128,
 * which then read as one 11-column row. Nothing noticed until the file was
 * next opened by hand. A register that silently loses rows is worse than none.
 *
 * Parses the file as CSV (quoted fields may hold commas, quotes and line
 * breaks) and checks its shape, not its content.
 */

const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'docs', 'claim-and-evidence-register.csv');
const HEADER = ['claim_id', 'claim', 'where_it_appears', 'classification', 'evidence_source', 'action_required'];

let pass = 0, fail = 0;
const t = (name, cond, extra) => {
  cond ? pass++ : fail++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : '   <-- ' + (extra === undefined ? '' : extra)}`);
};

// RFC 4180: fields separated by commas, rows by line breaks, a quoted field may
// contain either, and "" inside quotes is one quote.
function parse(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return { rows, unterminatedQuote: quoted };
}

const text = fs.readFileSync(FILE, 'utf8');
const { rows, unterminatedQuote } = parse(text);
const [header, ...claims] = rows;

t('every quoted field is closed', !unterminatedQuote);
t('the file ends with a line break, so the next row appended starts on its own line', text.endsWith('\n'));
t('the header is unchanged', JSON.stringify(header) === JSON.stringify(HEADER), JSON.stringify(header));

const wrongWidth = claims.filter((r) => r.length !== HEADER.length);
t(`every row has exactly ${HEADER.length} fields`, wrongWidth.length === 0,
  wrongWidth.map((r) => `${r[0]} has ${r.length}`).join(', '));

const ids = claims.map((r) => r[0]);
const badIds = ids.filter((id) => !/^C-\d{2,}$/.test(id));
t('every claim id looks like C-<number>', badIds.length === 0, badIds.join(', '));

const nums = ids.map((id) => Number(id.slice(2)));
const seen = new Set(), dupes = [];
for (const n of nums) {
  if (seen.has(n)) dupes.push(n);
  seen.add(n);
}
const max = Math.max(...nums);
const missing = [];
for (let n = 1; n <= max; n++) if (!seen.has(n)) missing.push(n);
t('no claim id is used twice', dupes.length === 0, dupes.map((n) => `C-${n}`).join(', '));
t(`no claim id is missing between C-1 and C-${max}`, missing.length === 0, missing.map((n) => `C-${n}`).join(', '));

const unclassified = claims.filter((r) => !String(r[3] || '').trim());
t('every claim is classified', unclassified.length === 0, unclassified.map((r) => r[0]).join(', '));

const ok = fail === 0;
console.log(`\nclaim-register ${ok ? 'OK' : 'FAILED'} -- ${claims.length} claims, C-1 to C-${max}.`);
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(ok ? 0 : 1);
