#!/usr/bin/env node
'use strict';

/*
 * Keyboard use of the public site (owner, 2026-10-23: "fix All").
 *
 *   node scripts/check-site-keyboard.js        (part of `npm test`)
 *
 * Holds the fixes from the public-site keyboard walkthrough:
 *   A  the cookie banner is first in the page, focus never stays hidden under
 *      it, and answering it from the keyboard leaves focus at the top of the
 *      page instead of nowhere;
 *   B  one visible focus ring on every public page, two-toned so it shows on
 *      light and dark backgrounds, screen-only (not in the stylesheet the
 *      gated PDFs are built from);
 *   C  the WhatsApp bubble gets it too (no rule of its own removes it);
 *   D  after the banner, Tab starts from the top, not the floating button;
 *   E  focus is lifted clear of the floating buttons and the sticky top bar;
 *   F  the privacy page's sideways-scrolling table is reachable by keyboard;
 *   H  the floating buttons share one labelled region; the home page's
 *      announcement strip and the letterheads have their regions.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

let pass = 0, fail = 0;
const t = (name, cond, extra) => {
  cond ? pass++ : fail++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : '   <-- ' + (extra === undefined ? '' : extra)}`);
};

const consent = read('assets/consent.js');
const nav = read('assets/site-nav.js');
const css = read('assets/index-Dw0yUE42.css');

// A, D
t('A: the cookie banner is inserted first in the page, so a keyboard meets it first',
  /document\.body\.insertBefore\(banner, document\.body\.firstChild\);/.test(consent) && !/document\.body\.appendChild\(banner\)/.test(consent));
t('A: while the banner is up the page has room at its foot to scroll the last links above it',
  /function bannerRoom\(h\)/.test(consent) && /bannerRoom\(h\);/.test(consent) && /bannerRoom\(0\);/.test(consent));
t('D: answering the banner from the keyboard moves focus to the top of the page, without scrolling',
  /var hadFocus = b && b\.contains\(document\.activeElement\);/.test(consent) && /el\.focus\(\{ preventScroll: true \}\)/.test(consent));

// B, C
t('B: one focus ring for every public page: dark olive outline, white band inside',
  /':focus-visible\{outline:3px solid #26301a;outline-offset:2px;box-shadow:0 0 0 2px #ffffff;\}'/.test(nav));
t('B: dark mode swaps the two tones', /'html\.dark :focus-visible\{outline-color:#f7f2e4;box-shadow:0 0 0 2px #1c2416;\}'/.test(nav));
t('B: screen only, and not in the stylesheet the gated PDFs are built from',
  /'@media screen\{' \+/.test(nav) && !/#26301a/.test(css));
t('C: the quote button\'s own ring is the same two-tone ring', /'#tc-quote-fab:focus-visible\{outline:3px solid #26301a;/.test(nav));
const pages = ['index.html', 'ar/index.html', 'catalog/index.html', 'contact/index.html'];
t('C: the WhatsApp bubble carries no class that removes the ring',
  pages.every((f) => { const m = read(f).match(/<a href="https:\/\/wa\.me\/[^"]*"[^>]*>/); return m && !/outline-none/.test(m[0]); }));

// E
t('E: focus moving onto something the banner, the floating buttons or the sticky top bar covers scrolls it clear',
  /document\.addEventListener\('focusin'/.test(nav) && /function keepClear\(el\)/.test(nav) &&
  ['#tc-consent-banner', '.fixed.bottom-6.right-6', '#tc-quote-fab', '[data-testid="floating-blog-link"]'].every((s) => nav.includes(`'${s}'`)) &&
  /if \(r\.top < top\)/.test(nav));

// F
for (const f of ['privacy/index.html', 'ar/privacy/index.html']) {
  t(`F: ${f}: the wide table's scroll box takes keyboard focus and is named by its heading`,
    /<h2 id="key-facts"[^>]*>[^<]+<\/h2><div class="overflow-x-auto rounded-xl border border-border tc-scroll-region" tabindex="0" role="region" aria-labelledby="key-facts">/.test(read(f)));
}

// H
t('H: the floating buttons share one labelled region ("Quick links", Arabic "روابط سريعة")',
  /region\.setAttribute\('role', 'region'\);/.test(nav) && /ar \? 'روابط سريعة' : 'Quick links'/.test(nav));
t('H: the home page announcement strip is a labelled region, in both languages',
  /py-2 px-4" role="region" aria-label="Announcement">/.test(read('index.html')) && /py-2 px-4" role="region" aria-label="إعلان">/.test(read('ar/index.html')));
for (const f of ['letterhead/index.html', 'ar/letterhead/index.html']) {
  const s = read(f);
  t(`H: ${f}: the sheet is the main region and its own header and footer are not page landmarks`,
    /<div class="sheet" role="main">/.test(s) && /<header class="doc-head" role="none">/.test(s) && /<footer class="doc-foot" role="none">/.test(s) && /role="region" aria-label="[^"]+">/.test(s));
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) {
  console.log('\nsite-keyboard FAILED -- see docs in this file for what each check holds.');
  process.exit(1);
}
console.log('site-keyboard OK -- focus is visible on every public page and never left under the banner or the floating buttons.');
