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
// bubble. The bubble is pinned with a physical `right-6` in page markup and
// mirrored for RTL by a rule in the compiled stylesheet; the reopen pill
// follows the reading direction on its own. Both therefore sit at the
// opposite ends of their own inline axis, in both languages.
//
// The failure this guards against is the MIX, not either property: a
// physical bubble with a logical pill resolves to the same Arabic corner,
// which is the overlap the owner reported (C-87). Removing the mirror rule
// while the pill stays logical puts it straight back.
{
  const css = fs.readFileSync(path.join(ROOT, 'assets', 'index-Dw0yUE42.css'), 'utf8');
  const consent = fs.readFileSync(path.join(ROOT, 'assets', 'consent.js'), 'utf8');
  const reopen = (consent.match(/#tc-consent-reopen\{[^}]*\}/) || [''])[0];

  t('the WhatsApp bubble is still pinned physically right in markup',
    fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').includes('flex flex-col items-end gap-3 right-6'));
  t('and the stylesheet mirrors it under rtl, so Arabic gets the other corner',
    /\[dir="rtl"\]\s*\.fixed\.bottom-6\.right-6\s*\{[^}]*left:/.test(css),
    'no [dir="rtl"] mirror rule for the bubble');
  t('the cookie reopen pill follows the reading direction',
    /inset-inline-start:/.test(reopen) && !/(^|[;{])left:/.test(reopen),
    reopen.slice(0, 90));
}

// The generators write pages too. If one stops emitting these, the next run
// silently undoes all of the above.
for (const gen of ['scripts/generate-product-pages.py']) {
  const src = fs.readFileSync(path.join(ROOT, gen), 'utf8');
  t(`${gen} still emits the WhatsApp button`, src.includes(FAB));
  t(`${gen} still emits the insights tab`, src.includes(TAB));
}

// Arabic pages mirror the insights tab onto the left edge, with its accent
// strip on the inner side: on the right it sat on the Arabic hero's headline
// and intro text (2026-09-28).
{
  const css = fs.readFileSync(path.join(ROOT, 'assets/index-Dw0yUE42.css'), 'utf8');
  t('right-to-left pages mirror the insights tab to the left edge, accent inward',
    /\[dir="rtl"\] a\[data-testid="floating-blog-link"\] \{\s*right: auto;\s*left: 0;/.test(css) &&
    /\[dir="rtl"\] a\[data-testid="floating-blog-link"\] > span\[aria-hidden="true"\]:first-child \{\s*left: auto;\s*right: 0;/.test(css));
}
// The floating "Request a Quote" button (owner, 2026-10-02), in the corner
// opposite the WhatsApp bubble. site-nav.js adds it on every page that has
// the bubble -- so every browsing page, and no printable sheet -- except the
// contact page it leads to. Its corner comes from inset-inline-start, the
// same logical property as the cookie pill whose corner it took: bottom-left
// in English, bottom-right in Arabic. A physical left would put it under the
// Arabic bubble, the mix C-87 warns about.
{
  const nav = fs.readFileSync(path.join(ROOT, 'assets', 'site-nav.js'), 'utf8');
  const css = fs.readFileSync(path.join(ROOT, 'assets', 'index-Dw0yUE42.css'), 'utf8');
  const consent = fs.readFileSync(path.join(ROOT, 'assets', 'consent.js'), 'utf8');
  const rule = (css.match(/#tc-quote-fab \{\s*position: fixed;[^}]*\}/) || [''])[0];
  const noNav = [];
  for (const file of walk(ROOT)) {
    const rel = path.relative(ROOT, file).split(path.sep).join('/');
    const html = fs.readFileSync(file, 'utf8');
    if (html.includes(FAB) && !html.includes('/assets/site-nav.js')) noNav.push(rel);
  }
  t('every page with the WhatsApp bubble loads site-nav.js, which adds the quote button', noNav.length === 0, show(noNav));
  t('   it is added only beside the bubble, and not on the contact page',
    /if \(!document\.querySelector\('\.fixed\.bottom-6\.right-6'\)\) return;/.test(nav) && /contact\(\\\/\|\\\/index\\\.html\)\?\$/.test(nav));
  t('   it opens the quote form in the page\'s own language',
    /\(ar \? '\/ar' : ''\) \+ '\/contact\?intent=quote'/.test(nav) && nav.includes("'اطلب عرض سعر'") && nav.includes("'Request a Quote'"));
  t('   its corner follows the reading direction, opposite the bubble',
    /inset-inline-start:/.test(rule) && !/(^|[;{\s])(left|right):/.test(rule), rule.slice(0, 120));
  t('   the footer makes room for it, it is gold with dark text (5.8:1, both themes), and it is never printed',
    /\.tc-has-quote-fab footer \{ padding-bottom:/.test(css) &&
    /background: hsl\(var\(--secondary\)\);\s*color: hsl\(75 40% 14%\);/.test(rule) &&
    /@media print \{ #tc-quote-fab \{ display: none/.test(css));
  t('   the cookie banner lifts it clear, as it does the bubble',
    /q\.style\.bottom = h \? \(28 \+ h\)/.test(consent) && /TC\.positionFloating = positionFab;/.test(consent) && /TC\.positionFloating\(\)/.test(nav));
  t('the cookie pill, whose corner it took, lives in the footer at every width',
    /'#tc-consent-reopen\.tc-in-footer\{display:none;\}'/.test(consent) && !/@media \(max-width:639px\)\{#tc-consent-reopen\.tc-in-footer/.test(consent));
}

// The header between laptop widths (2026-10-02). The English header needs
// 1242px at full size; it tightens from 1024 to 1279px (1182px, with the
// Facebook pill's label kept) and keeps the drawer below 1200px, and site-nav.js switches at the same width. Without
// these, a 1024-1240px window scrolled sideways and cut the logo off.
{
  const css = fs.readFileSync(path.join(ROOT, 'assets', 'index-Dw0yUE42.css'), 'utf8');
  const nav = fs.readFileSync(path.join(ROOT, 'assets', 'site-nav.js'), 'utf8');
  t('the header tightens between 1024 and 1279px, and English keeps the drawer, full width under the header, below 1200px',
    /@media \(min-width: 1024px\) and \(max-width: 1279\.98px\) \{\s*\.tc-nav \{ gap:/.test(css) &&
    /@media \(min-width: 1024px\) and \(max-width: 1199\.98px\) \{\s*html\[lang="en"\] \.tc-nav \{ display: none; \}\s*html\[lang="en"\] #mobile-menu-toggle \{ display: inline-flex; \}[\s\S]*?html\[lang="en"\] #mobile-menu-panel:not\(\[hidden\]\) \{\s*display: block;\s*position: absolute;\s*top: 100%;/.test(css));
  t('   and the Facebook pill keeps its "Follow" label at every desktop width',
    !/@media \(min-width: 1024px\)[^{]*\{[^@]*tc-social-pill-label \{ display: none; \}/.test(css));
  t('   and the menu script switches at the same widths', /\(ar \? 1024 : 1200\)/.test(nav));
  t('the quote button steps aside while the menu drawer is open, as WhatsApp does',
    /body:has\(#mobile-menu-panel:not\(\[hidden\]\)\) \.fixed\.bottom-6\.right-6,\s*body:has\(#mobile-menu-panel:not\(\[hidden\]\)\) #tc-quote-fab \{\s*display: none;/.test(css) &&
    /html\[lang="en"\] body:has\(#mobile-menu-panel:not\(\[hidden\]\)\) #tc-quote-fab \{ display: none; \}/.test(css));
}

// The insights tab steps aside for the footer (2026-10-02): pinned to the
// middle of the edge, it sat over the footer's Contact column at the end of
// every page on desktop. site-nav.js fades it once the footer reaches it.
{
  const nav = fs.readFileSync(path.join(ROOT, 'assets', 'site-nav.js'), 'utf8');
  t('the insights tab fades out when the footer reaches it, and leaves the tab order',
    /footer\.getBoundingClientRect\(\)\.top < tab\.getBoundingClientRect\(\)\.bottom/.test(nav) &&
    /tab\.style\.pointerEvents = reach \? 'none'/.test(nav) && /tab\.setAttribute\('tabindex', '-1'\)/.test(nav));
}

console.log(`\nfloating-actions OK -- ${en + ar} browsing page(s) carry both, ${PRINTABLE.size} printable sheet(s) carry neither.`);
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
