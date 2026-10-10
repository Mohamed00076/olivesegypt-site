#!/usr/bin/env node
'use strict';

/*
 * Phone basics, on every public page.
 *
 *   node scripts/check-mobile-basics.js        (part of `npm test`)
 *
 * Most of the site's visitors are on phones (owner, 2026-09-28). The mobile
 * check that day, in Chromium at 360px and 390px on all 85 public pages in
 * both languages, found:
 *   - 58 pages set maximum-scale=1, which stops pinch-zoom on Android: no way
 *     to enlarge small print or a photo (WCAG 1.4.4)
 *   - 90 form fields at 14px. iPhone Safari zooms the page in whenever a
 *     field under 16px takes focus, and the visitor has to zoom back out.
 *     The zoom block had been hiding that on iPhone; removing it without this
 *     would have exposed it
 *
 * This keeps both fixed: no page limits zoom, and every text field, drop-down
 * and text area is 16px (text-base) below the md breakpoint. It also holds
 * the rest of that check's fixes: 12px minimum text and 24px link targets on
 * phones, the insights tab as an icon and the cookie control in the footer
 * on phones, both catalogues' cards offering a quote and their own spec
 * sheet, no English "lactic" on Arabic pages, and both homepages linking to
 * the FAQ page.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
let pass = 0, fail = 0;
const t = (name, cond, extra) => {
  cond ? pass++ : fail++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : '   <-- ' + (extra === undefined ? '' : extra)}`);
};

const pages = execSync('git ls-files "*.html"', { cwd: ROOT }).toString().trim().split('\n')
  .filter((f) => !/^(crm|admin|netlify|scripts|docs)\//.test(f));
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

const zoomLocked = pages.filter((f) => {
  const m = read(f).match(/<meta name="viewport" content="([^"]*)"/);
  return !m || /maximum-scale|user-scalable\s*=\s*(no|0)/.test(m[1]);
});
t(`all ${pages.length} public pages have a viewport that lets visitors zoom`, zoomLocked.length === 0, zoomLocked.slice(0, 6).join(', '));

const smallFields = [];
for (const f of pages) {
  for (const m of read(f).matchAll(/<(input|select|textarea)\b[^>]*>/g)) {
    const tag = m[0];
    if (/type="(checkbox|radio|hidden|submit)"/.test(tag)) continue;
    if (/tabindex="-1"/.test(tag)) continue; // the off-screen spam-trap fields
    const cls = ((tag.match(/class="([^"]*)"/) || [])[1] || '').split(/\s+/);
    // A field with no size class inherits the page's 16px. One that sets a
    // smaller size must be text-base below md.
    const small = cls.some((c) => /^text-(xs|sm|\[(\d|1[0-5])(\.\d+)?px\])$/.test(c));
    if (small && !cls.includes('text-base')) smallFields.push(`${f} <${m[1]}>`);
  }
}
t('every text field, drop-down and text area is 16px on phones (text-base)', smallFields.length === 0,
  `${smallFields.length}: ${smallFields.slice(0, 5).join(', ')}`);

// ---- the rest of that day's findings --------------------------------------
const css = read('assets/index-Dw0yUE42.css');
const consent = read('assets/consent.js');
const phone = (css.match(/@media screen and \(max-width: 639px\) \{[\s\S]*?\n\}/) || [''])[0];
t('on phones, text set below 12px is raised to 12px (screen only, so PDFs keep their sizes)',
  /\.text-\\\[10px\\\][^{]*\.text-\\\[11px\\\][^{]*\{\s*font-size: 0\.75rem/.test(phone));
t('   and the foot-of-page links and product-page paths are padded to a 24px tap target',
  /footer #tc-consent-footer-link \{\s*padding-block: 4px/.test(phone) && /nav\[aria-label="مسار التصفح"\] a/.test(phone));
t('on phones the insights tab is a round icon above the WhatsApp bubble',
  /@media \(max-width: 639px\) \{\s*a\[data-testid="floating-blog-link"\] \{[^}]*border-radius: 9999px/.test(css));
t('the cookie control also sits in the footer, and the floating pill steps aside for it on phones',
  /function addFooterControl\(/.test(consent) && /#tc-consent-reopen\.tc-in-footer\{display:none;\}/.test(consent));

// Both catalogues: every card offers a quote and its own language's spec sheet.
for (const [f, contact, loc] of [['catalog/index.html', '/contact', 'en'], ['ar/catalog/index.html', '/ar/contact', 'ar']]) {
  const html = read(f);
  const slugs = [...html.matchAll(/data-product="([a-z-]+)"/g)].map((m) => m[1]);
  const pre = loc === 'ar' ? '/ar' : '';
  const missing = slugs.filter((slug) => {
    const seg = html.slice(html.indexOf(`data-product="${slug}"`), (html.indexOf('data-product="', html.indexOf(`data-product="${slug}"`) + 20) + 1 || html.length) - 1);
    return !seg.includes(`href="${contact}"`) || !seg.includes(`href="${pre}/downloads/spec-sheets/${slug}-${loc}.pdf" download`);
  });
  t(`${f}: all ${slugs.length} cards offer a quote and their own spec sheet`, slugs.length === require('./products').COUNT && missing.length === 0, missing.join(', '));
  t('   and no card shows a spec heading icon with nothing under it',
    !/lucide-flask-conical[^>]*>(?:(?!<\/svg>)[\s\S])*<\/svg><\/div><\/div>/.test(html));
}

// "lactic" was fixed on 2026-09-28; "acetic" and "citric" on 2026-10-02
// (owner: the Arabic jalapeño card showed "acetic"), as أسيتيك and ستريك.
const lactic = pages.filter((f) => f.startsWith('ar/') && /\b(lactic|acetic|citric)\b/i.test(read(f)));
t('no Arabic page leaves an acid name ("lactic", "acetic", "citric") in English', lactic.length === 0, lactic.join(', '));

const faq = (f, href) => { const h = read(f); return h.slice(h.indexOf('<main'), h.indexOf('</main>')).includes(`href="${href}"`); };
t('both homepages link to their FAQ page from the FAQ section', faq('index.html', '/resources/faq') && faq('ar/index.html', '/ar/resources/faq'));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
