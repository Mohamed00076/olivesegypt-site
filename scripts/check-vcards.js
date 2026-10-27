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
 *   - Mohamed's card is published only with his written agreement
 *     (MOHAMED_AGREED, given 2026-10-27) and only at the place the owner
 *     approves (MOHAMED_PUBLIC_PATH; until then it stays in docs/); nothing
 *     links to it, and mohamed@ appears nowhere but in the card itself;
 *   - the company card carries no TITLE and no department in ORG;
 *   - every published card is served as text/vcard; charset=utf-8, as an
 *     attachment, with X-Robots-Tag: noindex (netlify.toml), and robots.txt
 *     disallows it.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const SELF = 'scripts/check-vcards.js';

const MOHAMED_AGREED = true;           // written agreement, owner 2026-10-27 (withdrawal: remove the file)
const MOHAMED_PUBLIC_PATH = null;      // the approved published path; null until the owner approves one
const APPROVED_PHOTOS = new Set();     // file names, on the owner's approval
const FIELDS = new Set(['BEGIN', 'VERSION', 'PRODID', 'N', 'FN', 'ORG', 'TITLE', 'EMAIL', 'TEL', 'ADR', 'URL', 'REV', 'END']);
const EMAILS = { company: ['sales@olivesegypt.com'], mohamed: ['mohamed@olivesegypt.com'] };
const PHONE = '+20 100 604 5961';
const ADR = ';;Ouroba Square\\, 5th Settlement;New Cairo;Cairo;;Egypt';
const MOHAMED_EMAIL = 'mohamed@olivesegypt.com';
const PENDING = {};

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
    t(`${f}: published only with his agreement, at the approved path (else kept in docs/)`,
      f.startsWith('docs/') || (MOHAMED_AGREED && MOHAMED_PUBLIC_PATH !== null && f === MOHAMED_PUBLIC_PATH), f);
  } else {
    const org = (fields.find((x) => x.name === 'ORG') || {}).value || '';
    t(`${f}: a company card: no TITLE, no department in ORG`, !fields.some((x) => x.name === 'TITLE') && !/(^|[^\\]);/.test(org), org);
  }

  // A published card (anything outside docs/) is served as a download, kept
  // out of search.
  if (!f.startsWith('docs/')) {
    const url = '/' + f;
    const toml = fs.readFileSync(path.join(ROOT, 'netlify.toml'), 'utf8');
    const block = (toml.split('[[headers]]').find((b) => new RegExp(`for = "${url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`).test(b)) || '');
    t(`${f}: served as text/vcard; charset=utf-8, as an attachment, noindex`,
      /Content-Type = "text\/vcard; charset=utf-8"/.test(block) && /Content-Disposition = "attachment/.test(block) && /X-Robots-Tag = "noindex"/.test(block),
      block ? 'a header is missing in its netlify.toml block' : `no [[headers]] block for "${url}" in netlify.toml`);
    const robots = fs.readFileSync(path.join(ROOT, 'robots.txt'), 'utf8');
    t(`${f}: robots.txt disallows it`, robots.split('\n').some((l) => l.trim() === `Disallow: ${url}`));
  }

  for (const [rule, broken] of Object.entries(problems)) {
    t(`${f}: "${rule}" still awaits approval (else remove it from PENDING)`, broken);
  }
}

// Nothing outside docs/ links Mohamed's card or shows his address -- with or
// without his agreement: the card is shared by hand (owner, 2026-10-27). The
// card itself, and its serving rules once it has an approved path, are the
// only exceptions.
{
  const mohamedCards = cards.filter((f) => /Mohamed Abdullah/.test(fs.readFileSync(path.join(ROOT, f), 'utf8'))).map((f) => path.basename(f));
  const leaks = [];
  for (const f of tracked) {
    if (f.startsWith('docs/') || f === SELF || f === MOHAMED_PUBLIC_PATH || /\.(png|jpe?g|webp|gif|ico|woff2?|ttf|mmdb|gz)$/i.test(f)) continue;
    if (MOHAMED_PUBLIC_PATH && (f === 'netlify.toml' || f === 'robots.txt')) continue;
    let src;
    try { src = fs.readFileSync(path.join(ROOT, f)); } catch (e) { continue; }
    const s = f.endsWith('.pdf') ? src.toString('latin1') : src.toString('utf8');
    if (s.includes(MOHAMED_EMAIL) || mohamedCards.some((c) => s.includes(c))) leaks.push(f);
  }
  t('nothing outside docs/ links Mohamed\'s card or shows mohamed@ (only the card itself may)', leaks.length === 0, leaks.join(', '));
}

console.log(`\nvcards ${fail ? 'FAILED' : 'OK'} -- ${cards.length} vCard(s): well formed, approved fields only, Mohamed's card unpublished.`);
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
