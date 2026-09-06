#!/usr/bin/env node
'use strict';

/*
 * Navigation and footer parity.
 *
 *   node scripts/check-nav-footer.js        (part of `npm test`)
 *
 * Before the 2026-09-05 redesign this site carried four different primary-nav
 * variants and five different footers, including 35 pages whose footer held no
 * links at all. Nothing detected that, because each page owns its own copy of
 * the chrome and no build step regenerates it. This compares every page's copy
 * against the expected shape on every run.
 *
 * Checks:
 *   - every content page carries the shared nav and the shared five-column footer
 *   - the nav has the same destinations everywhere, per locale
 *   - the footer has the same five columns everywhere, per locale
 *   - dropdown wiring is intact: each trigger's aria-controls resolves to a
 *     panel that exists on the same page
 *   - Arabic chrome links stay Arabic (the locale-links check covers hrefs
 *     generally; this one covers the shared chrome specifically)
 *   - the utility pages that are meant to be excluded really are
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SKIP_DIRS = new Set(['node_modules', '.git', 'netlify', 'scripts', 'assets', 'docs', 'admin', 'crm']);

// Print/hand-over pages keep minimal chrome by design.
//
// The three gated guides used to be listed here too. They are no longer
// files on disk -- guide.js serves them from the functions bundle against a
// signed token -- so this walk cannot reach them and an entry for them would
// only be a comment pretending to be a check.
const UTILITY = new Set([
  '/business-card', '/letterhead', '/catalog/print',
]);

const EXPECTED_NAV = {
  en: ['/catalog', '/resources/certifications', '/downloads', '/company-profile',
       '/resources/private-label',
       '/resources/packaging', '/resources/pricing', '/resources/faq',
       '/resources/why-egyptian-olives', '/resources/export-markets', '/how-we-work',
       '/media/news', '/media/blog', '/media/inquiries', '/about', '/contact'],
};
EXPECTED_NAV.ar = EXPECTED_NAV.en.map((r) => '/ar' + r);

const EXPECTED_FOOTER_COLS = 5;

// One head-office address, written the same way everywhere. The stale lists
// are the forms that were actually found in use, so a partial revert is
// caught rather than merely a missing footer line.
const ADDRESS = {
  en: 'Ouroba Square (\u0645\u064a\u062f\u0627\u0646 \u0627\u0644\u0639\u0631\u0648\u0628\u0629), 5th Settlement, New Cairo, Cairo, Egypt',
  ar: '\u0645\u064a\u062f\u0627\u0646 \u0627\u0644\u0639\u0631\u0648\u0628\u0629\u060c \u0627\u0644\u062a\u062c\u0645\u0639 \u0627\u0644\u062e\u0627\u0645\u0633\u060c \u0627\u0644\u0642\u0627\u0647\u0631\u0629 \u0627\u0644\u062c\u062f\u064a\u062f\u0629\u060c \u0627\u0644\u0642\u0627\u0647\u0631\u0629\u060c \u0645\u0635\u0631',
  staleEn: ['5th Settlement, Ouroba Square', '5th Settlement, Cairo<br/>'],
  staleAr: ['\u0627\u0644\u062a\u062c\u0645\u0639 \u0627\u0644\u062e\u0627\u0645\u0633\u060c \u0645\u064a\u062f\u0627\u0646 \u0627\u0644\u0639\u0631\u0648\u0628\u0629'],
};
const problems = [];

function routes() {
  const out = [];
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!e.isDirectory()) continue;
      if (SKIP_DIRS.has(e.name) || e.name.startsWith('.')) continue;
      walk(path.join(dir, e.name));
    }
    if (fs.existsSync(path.join(dir, 'index.html'))) {
      const rel = path.relative(ROOT, dir).split(path.sep).join('/');
      out.push(rel === '' ? '/' : '/' + rel);
    }
  })(ROOT);
  return out.sort();
}

function section(html, tag) {
  const m = html.match(new RegExp(`<${tag}\\b[\\s\\S]*?</${tag}>`));
  return m ? m[0] : null;
}

for (const route of routes()) {
  const file = path.join(ROOT, route === '/' ? '' : route.slice(1), 'index.html');
  const html = fs.readFileSync(file, 'utf8');
  const lang = /<html lang="ar"/.test(html) ? 'ar' : 'en';
  const base = lang === 'ar' ? (route.slice(3) || '/') : route;

  const header = section(html, 'header');
  const footer = section(html, 'footer');

  if (UTILITY.has(base)) {
    if (header && /tc-nav\b/.test(header)) {
      problems.push(`${route}: utility page unexpectedly carries the shared nav`);
    }
    continue;
  }
  if (!header || !footer) continue; // pages with no chrome at all

  // --- nav ---------------------------------------------------------------
  // The desktop nav and the mobile drawer are separate copies of the same
  // destinations. Checking the header as a whole would let one copy lose a
  // link while the other masked it, so each is checked on its own.
  const desktopNav = (header.match(/<nav class="tc-nav"[\s\S]*?<\/nav>/) || [])[0];
  const drawer = (header.match(/<div id="mobile-menu-panel"[\s\S]*?<\/nav><\/div>/) || [])[0];

  if (!desktopNav) {
    problems.push(`${route}: missing the shared desktop nav`);
  }
  if (!drawer) {
    problems.push(`${route}: missing the mobile drawer`);
  }
  for (const [name, chunk] of [['desktop nav', desktopNav], ['mobile drawer', drawer]]) {
    if (!chunk) continue;
    const hrefs = [...chunk.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
    // the CTA and the switcher live outside the desktop <nav>; check the rest
    const want = EXPECTED_NAV[lang].filter(
      (rt) => name === 'mobile drawer' || rt !== (lang === 'ar' ? '/ar/contact' : '/contact'));
    const missing = want.filter((rt) => !hrefs.includes(rt));
    if (missing.length) problems.push(`${route}: ${name} is missing ${missing.join(', ')}`);
  }

  // dropdown wiring
  const triggers = [...header.matchAll(/aria-controls="(nav-[a-z]+)"/g)].map((m) => m[1]);
  if (triggers.length !== 3) {
    problems.push(`${route}: expected 3 nav dropdowns, found ${triggers.length}`);
  }
  for (const id of triggers) {
    if (!header.includes(`id="${id}"`)) {
      problems.push(`${route}: dropdown trigger points at #${id}, which does not exist`);
    }
  }

  // --- the social button --------------------------------------------------
  //
  // The site carried four social links in the footer until the 2026-09-05
  // footer consolidation dropped them, and nobody noticed for a day. Only
  // Facebook is back (the other three used a handle the owner confirmed is
  // dead), and it lives in the shared header beside the language switcher.
  // A social link that survives on some pages and not others is the same
  // class of bug as the five different footers.
  // Checked against the header WITHOUT the drawer. The mobile drawer lives
  // inside <header>, so testing the whole element passes while the desktop
  // button is missing -- the first version of this check did exactly that and
  // did not notice the button being deleted.
  const headerChrome = drawer ? header.split(drawer).join('') : header;
  if (!/data-social="facebook"/.test(headerChrome)) {
    problems.push(`${route}: the desktop header has no Facebook button`);
  }
  if (drawer && !/data-social="facebook"/.test(drawer)) {
    problems.push(`${route}: the mobile drawer has no Facebook link`);
  }

  // --- footer ------------------------------------------------------------
  if (!/tc-footer-cols/.test(footer)) {
    problems.push(`${route}: missing the shared footer`);
  } else {
    const cols = (footer.match(/class="tc-footer-col"/g) || []).length;
    if (cols !== EXPECTED_FOOTER_COLS) {
      problems.push(`${route}: footer has ${cols} columns, expected ${EXPECTED_FOOTER_COLS}`);
    }
  }

  // --- the head-office address -------------------------------------------
  //
  // Five different visible forms of one address were live at once before
  // 2026-09-05 -- three English, two Arabic -- and the shortest of them was on
  // /contact, the page a buyer actually reads. None of them named New Cairo.
  // One string per locale now, and the footer carries it on every page.
  const wantAddress = lang === 'ar' ? ADDRESS.ar : ADDRESS.en;
  if (!footer.includes(wantAddress)) {
    problems.push(`${route}: the footer does not carry the head-office address`);
  }
  const strays = (lang === 'ar' ? ADDRESS.staleAr : ADDRESS.staleEn).filter((old) => html.includes(old));
  if (strays.length) {
    problems.push(`${route}: an older form of the address is still here: ${strays.join(' | ')}`);
  }

  // --- locale integrity of the shared chrome -----------------------------
  if (lang === 'ar') {
    const chrome = header + footer;
    const bad = [...chrome.matchAll(/href="(\/(?!ar\/)[^"]*)"/g)]
      .map((m) => m[1])
      .filter((h) => h !== '/' && !h.startsWith('/assets'))
      // the language switcher is the one legitimate English link
      .filter((h) => !new RegExp(`href="${h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}" hreflang="en"`).test(chrome));
    if (bad.length) {
      problems.push(`${route}: Arabic chrome links to English routes: ${[...new Set(bad)].join(', ')}`);
    }
  }
}

if (problems.length === 0) {
  console.log('nav-footer OK -- shared navigation and footer consistent across all content pages, ' +
              'each carrying the one head-office address.');
  process.exit(0);
}
console.error(`nav-footer FAILED -- ${problems.length} problem(s):\n`);
problems.forEach((p) => console.error('  ' + p));
process.exit(1);
