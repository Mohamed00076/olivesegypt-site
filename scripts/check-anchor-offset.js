#!/usr/bin/env node
'use strict';

/*
 * A link to a section of a page lands that section directly under the sticky
 * header -- nothing of what comes before it showing above it, nothing of it
 * hidden behind the header.
 *
 *   node scripts/check-anchor-offset.js        (part of `npm test`)
 *
 * On 2026-09-28 the owner followed the homepage's Food-Service card to
 * /resources/packaging#plastic-buckets and saw the bottom of the Tin Cans card
 * above it. Every section target that had an offset used scroll-mt-24 (6rem,
 * 96px) under a 65px header, so 15-31px of the previous content showed; the
 * two that had none (/#certificates, /resources/private-label#brief) landed
 * with their top 65px behind the header.
 *
 * The fix is one rule, main [id] { scroll-margin-top }, equal to the
 * header's height. Not html { scroll-padding-top }, which was tried first:
 * it made the browser treat the sticky header as out of view, so Tab through
 * the header scrolled the page up by hundreds of pixels (found by
 * check-locale-switch.js). This holds it in place:
 *   - the stylesheet sets it to the header's height: h-16 (4rem) plus the
 *     1px bottom border, and sets no scroll-padding on html
 *   - every link target is inside <main>, where the rule applies
 *   - every page's sticky header is still that height (h-16, border-b)
 *   - no link target adds its own scroll margin on top, which would open the
 *     gap again
 *   - every in-site link to a #section finds that id on its page
 *
 * Measured in Chromium when it was written: all 11 targets, at 1280px and
 * 390px, land exactly at the header's bottom, and Tab through the header
 * leaves the page where it was.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { pageFile } = require('./locale-routes');

const ROOT = path.join(__dirname, '..');
const CSS = 'assets/index-Dw0yUE42.css';
const OFFSET = 'calc(4rem + 1px)';

let pass = 0, fail = 0;
const t = (name, cond, extra) => {
  cond ? pass++ : fail++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : '   <-- ' + (extra === undefined ? '' : extra)}`);
};

const css = fs.readFileSync(path.join(ROOT, CSS), 'utf8');
const rules = [...css.matchAll(/(^|[}\s])main \[id\]\s*\{[^}]*scroll-margin-top:\s*([^;}]+)/g)].map((m) => m[2].trim());
t(`${CSS} sets main [id] { scroll-margin-top: ${OFFSET} }, once`, rules.length === 1 && rules[0] === OFFSET, rules.join(', ') || 'not set');
t('   and no scroll-padding on html, which scrolls the page when the header takes focus',
  !/(^|[}\s,])(html|:root)\s*\{[^}]*scroll-padding/.test(css));

const pages = execSync('git ls-files "*.html"', { cwd: ROOT }).toString().trim().split('\n');
const headers = pages.map((f) => [f, fs.readFileSync(path.join(ROOT, f), 'utf8')])
  .map(([f, html]) => [f, (html.match(/<header class="([^"]*\bsticky top-0\b[^"]*)"><div class="([^"]*)"/) || [])])
  .filter(([, m]) => m.length);
const offHeight = headers.filter(([, m]) => !/\bborder-b\b/.test(m[1]) || !/\bh-16\b/.test(m[2])).map(([f]) => f);
t(`every sticky header (${headers.length} pages) is h-16 with a 1px bottom border, the height the offset assumes`,
  headers.length > 0 && offHeight.length === 0, offHeight.slice(0, 5).join(', '));

const targets = new Map();
for (const f of pages) {
  for (const m of fs.readFileSync(path.join(ROOT, f), 'utf8').matchAll(/href="(\/[^"#?]*)(?:\?[^"#]*)?#([A-Za-z][\w-]*)"/g)) {
    targets.set(`${m[1]}#${m[2]}`, { route: m[1], id: m[2] });
  }
}
const missing = [], doubled = [], outside = [];
for (const [href, { route, id }] of targets) {
  const r = route.length > 1 ? route.replace(/\/$/, '') : route;
  const file = pageFile(r);
  const html = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  const tag = (html.match(new RegExp(`<[a-z]+\\b[^>]*\\bid="${id}"[^>]*>`)) || [])[0];
  if (!tag) { missing.push(href); continue; }
  const at = html.indexOf(tag);
  if (!(html.lastIndexOf('<main', at) > html.lastIndexOf('</main>', at))) outside.push(href);
  if (/\bscroll-(mt|my|m)-|scroll-margin/.test(tag)) doubled.push(href);
}
t(`every in-site link to a #section (${targets.size}) finds that section on its page`, missing.length === 0, missing.join(', '));
t('   and every one of them is inside <main>, where the offset applies', outside.length === 0, outside.join(', '));
t('   and no target adds its own scroll margin on top of the header offset', doubled.length === 0, doubled.join(', '));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
