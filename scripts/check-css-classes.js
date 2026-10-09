#!/usr/bin/env node
'use strict';

/*
 * Every class a public page uses is defined by a stylesheet it loads.
 *
 *   node scripts/check-css-classes.js        (part of `npm test`)
 *
 * The site has no build step: its stylesheet is a Tailwind bundle compiled
 * once, from the pages as they were then. Classes written into pages later
 * were never compiled, so they did nothing and nothing said so. On 2026-10-09,
 * 25 such utilities were found. The homepage's "How We Work" steps showed in
 * 2 columns instead of 5 (md:grid-cols-5), with no connecting line and the
 * button pressed against the last step (left-[10%], right-[10%], mt-14). The
 * business card and About pages had no width limit (max-w-md,
 * max-w-screen-md), the mobile menu's sub-items no indent (ps-4, on every
 * page), and the privacy page no section spacing (space-y-12). They are now
 * defined in the screen-only block of assets/index-Dw0yUE42.css.
 *
 * A class counts as defined if assets/index-Dw0yUE42.css, assets/rtl.css
 * (Arabic pages), another assets/*.css file or the page's own <style> has a
 * selector for it. Names that are hooks rather than styles are listed in HOOKS
 * with the reason; an icon's lucide-<name> class is a label only.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SKIP = new Set(['node_modules', '.git', 'netlify', 'scripts', 'assets', 'docs', 'admin', 'crm']);

const HOOKS = {
  'tc-drawer-trigger': 'the mobile menu script finds the button by it',
  'tc-catalog-filters-meta': 'names the catalogue count row for the filter script',
  'pkg-info': 'names the catalogue packaging note for the filter script',
  'tc-caliber': 'wraps the packaging page caliber scale; its parts (tc-caliber-bar, -seg) carry the styles',
  'hover-elevate': 'shadcn/ui marker kept from the original components; no style intended',
  'active-elevate-2': 'shadcn/ui marker kept from the original components; no style intended',
  'from-primary/50': 'print catalogue divider (catalog/print): defining it would change the printed PDFs',
  'via-border': 'print catalogue divider (catalog/print): defining it would change the printed PDFs',
};

function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) { if (!SKIP.has(e.name) && !e.name.startsWith('.')) walk(path.join(dir, e.name), out); }
    else if (e.name === 'index.html') out.push(path.join(dir, e.name));
  }
  return out;
}

const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const shared = fs.readdirSync(path.join(ROOT, 'assets')).filter((f) => f.endsWith('.css') && f !== 'rtl.css')
  .map((f) => read(path.join('assets', f))).join('\n');
const rtl = read('assets/rtl.css');

// The class as it appears in a selector: Tailwind escapes these characters.
const selector = (c) => '.' + c.replace(/[:/[\].%#()&,>+~*!@'"=]/g, (ch) => '\\' + ch);
const BOUNDARY = /[\s,{:.>+~[)\\]/;
function defines(css, c) {
  const s = selector(c);
  let i = css.indexOf(s);
  while (i !== -1) {
    const next = css[i + s.length];
    if (next === undefined || BOUNDARY.test(next) && !(next === '\\' && css[i + s.length + 1] !== ':')) return true;
    i = css.indexOf(s, i + 1);
  }
  return false;
}

const pages = walk(ROOT, []).concat([path.join(ROOT, '404.html')]).sort();
const missing = new Map();
for (const file of pages) {
  const html = fs.readFileSync(file, 'utf8');
  const rel = path.relative(ROOT, file);
  const own = (html.match(/<style\b[^>]*>[\s\S]*?<\/style>/g) || []).join('\n');
  const css = shared + (rel.startsWith('ar' + path.sep) ? rtl : '') + own;
  for (const m of html.matchAll(/\bclass="([^"]*)"/g)) {
    for (const raw of m[1].split(/\s+/).filter(Boolean)) {
      const c = raw.replace(/&amp;/g, '&');
      if (c.startsWith('lucide') || c in HOOKS || defines(css, c)) continue;
      if (!missing.has(c)) missing.set(c, new Set());
      missing.get(c).add(rel);
    }
  }
}

if (missing.size) {
  const lines = [...missing].map(([c, ps]) => `${c}  (${ps.size} page${ps.size > 1 ? 's' : ''}, e.g. ${[...ps][0]})`);
  console.error(`css-classes: ${missing.size} class(es) used on public pages but defined by no stylesheet, so they do nothing:\n  ` + lines.join('\n  ')
    + '\n  Define each in the screen-only block of assets/index-Dw0yUE42.css (Tailwind v4 values), or list a deliberate hook in HOOKS.');
  process.exit(1);
}
console.log(`css-classes OK -- every class on ${pages.length} public pages is defined by a stylesheet the page loads (icon labels and ${Object.keys(HOOKS).length} listed hooks aside).`);
