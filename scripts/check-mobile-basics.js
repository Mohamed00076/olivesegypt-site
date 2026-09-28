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
 * and text area is 16px (text-base) below the md breakpoint.
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

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
