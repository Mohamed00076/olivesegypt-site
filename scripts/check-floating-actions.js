#!/usr/bin/env node
'use strict';

/*
 * The WhatsApp button and the Read Our Insights tab, on every browsing page.
 *
 *   node scripts/check-floating-actions.js        (part of `npm test`)
 *
 * WHAT WENT WRONG
 *
 * The owner reported seeing the WhatsApp button on the Arabic homepage and
 * nowhere else in Arabic. That was exact: it was on 1 of 41 Arabic pages. In
 * English it was on 29 of 41, and the Read Our Insights tab on 17 of 41 with
 * none at all in Arabic.
 *
 * Nothing had removed them. They were added page by page, so any page written
 * later, or written by a generator, simply never got them --
 * generate-product-pages.py emitted neither, which is exactly why all 11
 * English product pages and /company-profile were missing both. A contact
 * route that is present on most pages and absent on the rest does not look
 * broken from any single page, which is how it survived this long.
 *
 * WHAT THIS ASSERTS
 *
 * Every page that carries the site chrome carries both. Printable sheets are
 * excluded by design and named here rather than inferred: their print CSS
 * hides `header, footer, .no-print` and nothing else, so a floating button
 * added to one would be printed onto the sheet.
 *
 * The generators are checked too. A generator that stops emitting them puts
 * the site back where it started on its next run, which is how a retired
 * claim (C-73) and a missing heading (C-81) both happened before.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const FAB = 'bg-[#25D366]';
const TAB = 'floating-blog-link';

// Printable stationery: no site chrome, and their print CSS would put a
// floating button on the paper.
const PRINTABLE = new Set([
  'catalog/print/index.html', 'ar/catalog/print/index.html',
  'business-card/index.html', 'ar/business-card/index.html',
  'letterhead/index.html', 'ar/letterhead/index.html',
]);
const SKIP_DIRS = new Set(['node_modules', '.git', 'geo', 'assets', 'crm', 'admin', 'docs', 'netlify', 'scripts']);

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name === 'index.html') out.push(full);
  }
  return out;
}

let pass = 0, fail = 0;
const t = (name, cond, extra) => {
  cond ? pass++ : fail++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : '   <-- ' + (extra === undefined ? '' : extra)}`);
};

const noFab = [], noTab = [], onPrintable = [];
let en = 0, ar = 0;

for (const file of walk(ROOT)) {
  const rel = path.relative(ROOT, file).split(path.sep).join('/');
  const html = fs.readFileSync(file, 'utf8');

  if (PRINTABLE.has(rel)) {
    if (html.includes(FAB) || html.includes(TAB)) onPrintable.push(rel);
    continue;
  }
  if (!html.includes('</footer>')) continue;   // no site chrome, nothing to carry

  rel.startsWith('ar/') ? ar++ : en++;
  if (!html.includes(FAB)) noFab.push(rel);
  if (!html.includes(TAB)) noTab.push(rel);

  // the Arabic pages must point at the Arabic blog, not the English one
  if (rel.startsWith('ar/') && html.includes(TAB) && !html.includes('href="/ar/media#blog"')) {
    noTab.push(rel + ' (points at the English blog)');
  }
}

const show = (list) => `${list.length}: ${list.slice(0, 6).join(', ')}${list.length > 6 ? ' …' : ''}`;

t(`both locales are covered (${en} English, ${ar} Arabic browsing pages)`, en > 0 && ar > 0, `en=${en} ar=${ar}`);
t('every browsing page carries the WhatsApp button', noFab.length === 0, noFab.length ? show(noFab) : '');
t('every browsing page carries the Read Our Insights tab', noTab.length === 0, noTab.length ? show(noTab) : '');
t('no printable sheet carries a floating action', onPrintable.length === 0, onPrintable.length ? show(onPrintable) : '');

// The consent controls share the bottom of the screen with the WhatsApp
// bubble, and the bubble is pinned with a PHYSICAL `right-6` on every page.
// The reopen pill was pinned with inset-inline-start, which follows the
// reading direction -- left in English, right in Arabic -- so in Arabic the
// two landed in the same corner and overlapped on all 41 pages the moment
// the banner was dismissed. Nothing here could see that, because every check
// in this suite reads markup and that collision only exists once the browser
// resolves a logical property against `dir`. What is checkable is the cause:
// a logical inline property positioning something into the bubble's corner.
{
  const consent = fs.readFileSync(path.join(ROOT, 'assets', 'consent.js'), 'utf8');
  const reopen = (consent.match(/#tc-consent-reopen\{[^}]*\}/) || [''])[0];
  t('the cookie reopen pill is found in consent.js', reopen.length > 0);
  t('it is pinned with a physical left, not a direction-following one',
    /(^|[;{])left:/.test(reopen) && !/inset-inline/.test(reopen),
    reopen.slice(0, 90));
  t('the WhatsApp bubble is still pinned physically right',
    fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').includes('flex flex-col items-end gap-3 right-6'));
}

// The generators write pages too. If one stops emitting these, the next run
// silently undoes all of the above.
for (const gen of ['scripts/generate-product-pages.py']) {
  const src = fs.readFileSync(path.join(ROOT, gen), 'utf8');
  t(`${gen} still emits the WhatsApp button`, src.includes(FAB));
  t(`${gen} still emits the insights tab`, src.includes(TAB));
}

console.log(`\nfloating-actions OK -- ${en + ar} browsing page(s) carry both, ${PRINTABLE.size} printable sheet(s) carry neither.`);
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
