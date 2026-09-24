#!/usr/bin/env node
'use strict';

/*
 * The theme must be decided before the browser paints.
 *
 * Every visitor page carries a small inline script that reads the stored
 * preference (or the OS setting) and puts .dark on <html>. For a long time it
 * sat in <body>, after the render-blocking stylesheet. The browser therefore
 * painted the page in the light default, then the script ran and flipped it --
 * a visible flash on every single navigation, reported as the site "changing
 * from light mode to dark mode and back" while moving between pages.
 *
 * Nothing about the script was wrong. Only its position was, and position is
 * the one thing that does not show up when you read the script, diff it, or
 * hash it: all 80 pages carried byte-identical copies in the identical wrong
 * place. So it needs a check of its own.
 *
 * What has to hold, on every page that carries the script:
 *
 *   - it is inside <head>, not <body>
 *   - it comes before the first stylesheet, so the class is on <html> before
 *     any CSS is applied and there is nothing to repaint
 *   - it is still the same script -- one copy, reading the same storage key
 *
 * Pages that deliberately have no theme script are left alone: the CRM and
 * admin tools, and the print/PDF sheets, which are rendered to paper and to
 * PDF rather than browsed.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const MARK = "var KEY = 'tc-theme'";

let pass = 0, fail = 0;
const t = (name, cond, extra) => {
  cond ? pass++ : fail++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : '   <-- ' + (extra === undefined ? '' : extra)}`);
};
const show = (l) => `${l.length}: ${l.slice(0, 6).join(', ')}${l.length > 6 ? ' …' : ''}`;

function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.git') continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (e.name.endsWith('.html')) out.push(full);
  }
  return out;
}

const pages = walk(ROOT, []).sort();
const carrying = pages.filter((p) => fs.readFileSync(p, 'utf8').includes(MARK));

t(`the theme script is on a plausible number of pages (${carrying.length})`,
  carrying.length >= 70,
  'far fewer pages carry it than expected -- has the chrome been split up?');

const inBody = [];
const afterCss = [];
const duplicated = [];

for (const p of carrying) {
  const s = fs.readFileSync(p, 'utf8');
  const rel = path.relative(ROOT, p);

  if ((s.match(new RegExp(MARK.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length !== 1) {
    duplicated.push(rel);
    continue;
  }

  const i = s.indexOf(MARK);
  const scriptStart = s.lastIndexOf('<script', i);
  const headEnd = s.indexOf('</head>');
  if (headEnd === -1 || scriptStart > headEnd) {
    inBody.push(rel);
    continue;
  }

  const css = s.search(/<link[^>]*rel="stylesheet"[^>]*>/);
  if (css !== -1 && scriptStart > css) afterCss.push(rel);
}

t('every copy of the theme script is inside <head>',
  inBody.length === 0,
  `${show(inBody)} -- the page paints light first and then flips, on every navigation`);

t('and every copy runs before the first stylesheet',
  afterCss.length === 0,
  `${show(afterCss)} -- the class lands after the CSS has already been applied`);

t('and no page carries it twice',
  duplicated.length === 0, show(duplicated));

// The generator writes the same chrome, so it has to agree or the next
// regeneration quietly puts the flash back into ten product pages.
{
  const gen = path.join(ROOT, 'scripts/generate-product-pages.py');
  if (fs.existsSync(gen)) {
    const g = fs.readFileSync(gen, 'utf8');
    const gi = g.indexOf(MARK);
    t('the product-page generator carries the theme script too', gi !== -1,
      'the generator stopped emitting it -- generated pages would have no theme at all');
    if (gi !== -1) {
      const gStart = g.lastIndexOf('<script', gi);
      const gHead = g.indexOf('</head>');
      t('and its template puts it in <head> as well',
        gHead !== -1 && gStart < gHead,
        'regenerating the product pages would reintroduce the flash on all ten');
    }
  }
}

const ok = fail === 0;
console.log(
  `\ntheme-no-flash ${ok ? 'OK' : 'FAILED'} -- ${carrying.length} page(s) decide the theme in <head>, ` +
  `before the first stylesheet, so nothing repaints.`
);
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(ok ? 0 : 1);
