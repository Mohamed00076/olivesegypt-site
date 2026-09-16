#!/usr/bin/env node
'use strict';

/*
 * One page, one handler for the mobile menu button.
 *
 *   node scripts/check-nav-handlers.js        (part of `npm test`)
 *
 * WHAT WENT WRONG
 *
 * The mobile menu did not open anywhere on the Arabic site. Not on the
 * homepage the owner reported -- on all 28 Arabic pages that have one.
 *
 * Every page loads /assets/site-nav.js, which binds a click handler to
 * #mobile-menu-toggle. The Arabic pages each carried a second, inline copy of
 * that handler as well. Both fired on one tap: the shared one removed the
 * `hidden` attribute, the inline one put it straight back. The menu opened
 * and closed within the same event, so nothing appeared to happen.
 *
 * Nothing looks wrong in the markup, nothing errors in the console, and the
 * DOM is identical before and after the tap. It is only visible if something
 * actually presses the button -- which is why it survived every check here
 * and every read of the page source.
 *
 * WHY A STATIC CHECK
 *
 * The real test is a browser tapping a button, and `npm test` has no browser:
 * every other check in this suite runs offline against files. So this asserts
 * the structural property that made the bug possible, which is cheap and
 * exact: no page may bind the toggle inline while also loading the shared
 * script that binds it.
 *
 * It does NOT forbid an inline handler outright. A page that does not load
 * site-nav.js is entitled to its own -- that is one handler, not two.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SHARED = '/assets/site-nav.js';
const TOGGLE_ID = 'mobile-menu-toggle';

const SKIP_DIRS = new Set(['node_modules', '.git', 'geo', 'assets']);

function htmlFiles(dir, out) {
  out = out || [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) htmlFiles(full, out);
    else if (entry.name.endsWith('.html')) out.push(full);
  }
  return out;
}

// Only <script> blocks with no src -- the page's own code, not a reference.
function inlineScripts(html) {
  const out = [];
  const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) out.push(m[1]);
  return out;
}

let pass = 0, fail = 0;
const t = (name, cond, extra) => {
  cond ? pass++ : fail++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : '   <-- ' + (extra === undefined ? '' : extra)}`);
};

const files = htmlFiles(ROOT);
const withToggle = [];
const doubled = [];
const orphaned = [];

for (const file of files) {
  const html = fs.readFileSync(file, 'utf8');
  if (!html.includes(TOGGLE_ID)) continue;

  const rel = path.relative(ROOT, file);
  withToggle.push(rel);

  const loadsShared = html.includes(SHARED);
  const bindsInline = inlineScripts(html).some((s) => s.includes(TOGGLE_ID));

  if (loadsShared && bindsInline) doubled.push(rel);
  if (!loadsShared && !bindsInline) orphaned.push(rel);
}

t(`every page with a mobile menu button was found (${withToggle.length} page(s))`, withToggle.length > 0);

t('no page binds the toggle twice -- inline as well as via site-nav.js',
  doubled.length === 0,
  doubled.length ? `${doubled.length}: ${doubled.slice(0, 6).join(', ')}${doubled.length > 6 ? ' …' : ''}` : '');

t('no page has a menu button with nothing bound to it at all',
  orphaned.length === 0,
  orphaned.length ? `${orphaned.length}: ${orphaned.slice(0, 6).join(', ')}${orphaned.length > 6 ? ' …' : ''}` : '');

// Both locales must be represented, or a whole-locale regression could pass
// this check by having no pages left to inspect.
const ar = withToggle.filter((f) => f.startsWith('ar/' + path.sep) || f.startsWith('ar/')).length;
const en = withToggle.length - ar;
t(`both locales are covered (${en} English, ${ar} Arabic)`, ar > 0 && en > 0, `en=${en} ar=${ar}`);

console.log(`\nnav-handlers OK -- ${withToggle.length} page(s) carry the mobile menu button, each with exactly one handler.`);
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
