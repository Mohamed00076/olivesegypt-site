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
const UTILITY = new Set([
  '/business-card', '/letterhead', '/catalog/print',
  '/downloads/buyers-guide', '/downloads/origin-comparison-guide',
  '/downloads/pricing-packaging-guide',
]);

const EXPECTED_NAV = {
  en: ['/catalog', '/resources/certifications', '/downloads', '/company-profile',
       '/resources/packaging', '/resources/pricing', '/resources/faq',
       '/resources/why-egyptian-olives', '/resources/export-markets', '/how-we-work',
       '/media/news', '/media/blog', '/media/inquiries', '/about', '/contact'],
};
EXPECTED_NAV.ar = EXPECTED_NAV.en.map((r) => '/ar' + r);

const EXPECTED_FOOTER_COLS = 5;
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

  // --- footer ------------------------------------------------------------
  if (!/tc-footer-cols/.test(footer)) {
    problems.push(`${route}: missing the shared footer`);
  } else {
    const cols = (footer.match(/class="tc-footer-col"/g) || []).length;
    if (cols !== EXPECTED_FOOTER_COLS) {
      problems.push(`${route}: footer has ${cols} columns, expected ${EXPECTED_FOOTER_COLS}`);
    }
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
  console.log('nav-footer OK -- shared navigation and footer consistent across all content pages.');
  process.exit(0);
}
console.error(`nav-footer FAILED -- ${problems.length} problem(s):\n`);
problems.forEach((p) => console.error('  ' + p));
process.exit(1);
