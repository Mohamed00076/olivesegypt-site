#!/usr/bin/env node
'use strict';

/*
 * Every vCard in the repository is well formed, says only approved things,
 * and Mohamed's card stays unpublished until he has agreed.
 *
 *   node scripts/check-vcards.js        (part of `npm test`)
 *
 * Owner, 2026-10-27 (C-192 at the time of writing):
 *   - vCard 3.0, UTF-8 without a byte-order mark, CRLF line endings;
 *   - BEGIN:VCARD first, VERSION:3.0 second, END:VCARD last;
 *   - only the approved fields, email addresses, phone and address, the
 *     address in the approved order (C-22) with its comma escaped;
 *   - Mohamed Abdullah's title is "Representative", not "Sales";
 *   - no PHOTO unless the owner approves one;
 *   - Mohamed's card stays in docs/ (never published) and nothing outside
 *     docs/ links to it or shows mohamed@, until the owner confirms Mohamed's
 *     written agreement (MOHAMED_AGREED below).
 *
 * The company card, assets/triple-company.vcf, predates these rules. Its two
 * deviations wait for the owner's approval (PENDING); the check fails if
 * one of them is fixed and still listed, so the exemption cannot outlive it.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const SELF = 'scripts/check-vcards.js';

const MOHAMED_AGREED = false;          // flip only on the owner's word
const APPROVED_PHOTOS = new Set();     // file names, on the owner's approval
const FIELDS = new Set(['BEGIN', 'VERSION', 'PRODID', 'N', 'FN', 'ORG', 'TITLE', 'EMAIL', 'TEL', 'ADR', 'URL', 'REV', 'END']);
const EMAILS = { company: ['sales@olivesegypt.com'], mohamed: ['mohamed@olivesegypt.com'] };
const PHONE = '+20 100 604 5961';
const ADR = ';;Ouroba Square\\, 5th Settlement;New Cairo;Cairo;;Egypt';
const MOHAMED_EMAIL = 'mohamed@olivesegypt.com';
const PENDING = { 'assets/triple-company.vcf': ['crlf', 'address'] };

let pass = 0, fail = 0;
const t = (name, cond, extra) => {
  cond ? pass++ : fail++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : '   <-- ' + (extra || '')}`);
};

const tracked = execSync('git ls-files', { cwd: ROOT }).toString().trim().split('\n').filter(Boolean);
const cards = tracked.filter((f) => f.endsWith('.vcf'));
t(`the repository holds vCards to check (${cards.length})`, cards.length > 0);

for (const f of cards) {
  const buf = fs.readFileSync(path.join(ROOT, f));
  const text = buf.toString('utf8');
  const pending = new Set(PENDING[f] || []);
  const problems = {};
  const say = (rule, ok, extra) => {
    if (pending.has(rule)) { problems[rule] = !ok; return; }
    t(`${f}: ${rule}`, ok, extra);
  };

  say('UTF-8 without a byte-order mark', !(buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) && Buffer.from(text, 'utf8').equals(buf));
  const lines = text.split('\r\n');
  say('crlf', !/(^|[^\r])\n/.test(text) && text.endsWith('\r\n'), 'a line ends in a bare LF, or the file does not end with CRLF');
  const body = lines.filter((l, i) => !(i === lines.length - 1 && l === ''));
  const plain = text.replace(/\r/g, '').split('\n').filter(Boolean);
  say('BEGIN:VCARD first, VERSION:3.0 second, END:VCARD last',
    plain[0] === 'BEGIN:VCARD' && plain[1] === 'VERSION:3.0' && plain[plain.length - 1] === 'END:VCARD');
  const fields = plain.map((l) => {
    const i = l.indexOf(':');
    return { name: l.slice(0, i).split(';')[0].toUpperCase(), params: l.slice(0, i), value: l.slice(i + 1) };
  });
  const bad = fields.filter((x) => !FIELDS.has(x.name)).map((x) => x.name);
  say('only the approved fields', bad.length === 0, bad.join(', '));
  const photo = fields.some((x) => x.name === 'PHOTO');
  say('no PHOTO (unless approved)', !photo || APPROVED_PHOTOS.has(path.basename(f)));

  const fn = (fields.find((x) => x.name === 'FN') || {}).value || '';
  const isMohamed = /Mohamed Abdullah/.test(fn);
  const emails = fields.filter((x) => x.name === 'EMAIL').map((x) => x.value);
  const allowed = isMohamed ? EMAILS.mohamed : EMAILS.company;
  say('only approved email addresses', emails.length > 0 && emails.every((e) => allowed.includes(e)), emails.join(', '));
  const tels = fields.filter((x) => x.name === 'TEL').map((x) => x.value);
  say('only the approved phone', tels.length > 0 && tels.every((v) => v === PHONE), tels.join(', '));

  // Structured fields: a comma inside a component must be escaped.
  const unescaped = fields.filter((x) => (x.name === 'ADR' || x.name === 'N') && /(^|[^\\]),/.test(x.value)).map((x) => x.name);
  const adrs = fields.filter((x) => x.name === 'ADR').map((x) => x.value);
  say('address', unescaped.length === 0 && adrs.length === 1 && adrs[0] === ADR,
    unescaped.length ? `unescaped comma in ${unescaped.join(', ')}` : `ADR is "${adrs.join(' | ')}", not "${ADR}" (C-22 order)`);

  if (isMohamed) {
    const title = (fields.find((x) => x.name === 'TITLE') || {}).value;
    t(`${f}: Mohamed's title is "Representative"`, title === 'Representative', title);
    if (!MOHAMED_AGREED) t(`${f}: kept in docs/ until Mohamed has agreed`, f.startsWith('docs/'));
  }

  for (const [rule, broken] of Object.entries(problems)) {
    t(`${f}: "${rule}" still awaits approval (else remove it from PENDING)`, broken);
  }
}

// Until Mohamed agrees: nothing outside docs/ names his card or his address.
if (!MOHAMED_AGREED) {
  const mohamedCards = cards.filter((f) => /Mohamed Abdullah/.test(fs.readFileSync(path.join(ROOT, f), 'utf8'))).map((f) => path.basename(f));
  const leaks = [];
  for (const f of tracked) {
    if (f.startsWith('docs/') || f === SELF || /\.(png|jpe?g|webp|gif|ico|woff2?|ttf|mmdb|gz)$/i.test(f)) continue;
    let src;
    try { src = fs.readFileSync(path.join(ROOT, f)); } catch (e) { continue; }
    const s = f.endsWith('.pdf') ? src.toString('latin1') : src.toString('utf8');
    if (s.includes(MOHAMED_EMAIL) || mohamedCards.some((c) => s.includes(c))) leaks.push(f);
  }
  t('nothing outside docs/ links Mohamed\'s card or shows mohamed@ (he has not agreed yet)', leaks.length === 0, leaks.join(', '));
}

console.log(`\nvcards ${fail ? 'FAILED' : 'OK'} -- ${cards.length} vCard(s): well formed, approved fields only, Mohamed's card unpublished.`);
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
