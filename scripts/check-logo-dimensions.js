#!/usr/bin/env node
'use strict';

/*
 * The header logo's declared dimensions match the file on disk.
 *
 *   node scripts/check-logo-dimensions.js        (part of `npm test`)
 *
 * WHAT WENT WRONG
 *
 * assets/logo-BJ1TOn9V.png was a 512x512 canvas with the mark occupying only
 * 224x277 of it, so the visible mark rendered at about 17px in the 32px box
 * the header gives it. #116 cropped the canvas to the artwork -- 236x289 --
 * and changed nothing else, because nothing else needed changing.
 *
 * What it also did not change was the 105 pages that declare the image
 * width="512" height="512". Those numbers had described the file; after the
 * crop they described nothing. Nobody noticed, because every one of those
 * pages also gives the image an explicit CSS box (h-8 w-8, h-16 w-16, or a
 * width/height pair in a document stylesheet), so the attributes never reach
 * layout and a wrong value looks exactly like a right one.
 *
 * WHAT THIS ASSERTS
 *
 * The intrinsic size is read out of the PNG header on every run, so the file
 * is the source of truth and re-cropping the logo fails this check until the
 * markup follows. Declaring the size is optional -- the PDF sources declare
 * no dimensions on any image, which is a convention, not a defect -- but
 * declaring it wrongly is not.
 *
 * The generator is checked too. generate-product-pages.py emitted no
 * dimensions at all while the 11 pages it had produced carried them, so its
 * output and the shipped pages disagreed about the same image.
 *
 * WHAT THIS DELIBERATELY DOES NOT ASSERT
 *
 * Only this one asset. Fourteen product-photo tags elsewhere declare a
 * display size rather than an intrinsic one (96x96 and 80x80 thumbnails,
 * plus three tags in ar/catalog that carry one photo's dimensions on
 * another's file). Whether those declarations are meant to be intrinsic sizes
 * is a decision about them, not about this logo, and a check that guessed
 * would either fail on purpose or encode the guess.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const ASSET = 'assets/logo-BJ1TOn9V.png';
const SRC = '/assets/logo-BJ1TOn9V.png';

// The families that declare no dimensions on any image at all. Named, so that
// a page silently losing its attributes is a failure rather than a new member.
const NO_DIMENSIONS_BY_CONVENTION = new Set([
  'scripts/export-catalog-source.html',
  'scripts/export-catalog-source-ar.html',
]);

const SKIP_DIRS = new Set(['node_modules', '.git', 'geo', 'assets']);

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith('.html')) out.push(full);
  }
  return out;
}

// PNG: 8-byte signature, then the IHDR chunk, whose width and height are two
// big-endian uint32s at offsets 16 and 20.
function pngSize(file) {
  const head = Buffer.alloc(24);
  const fd = fs.openSync(file, 'r');
  try { fs.readSync(fd, head, 0, 24, 0); } finally { fs.closeSync(fd); }
  if (head.slice(0, 8).toString('hex') !== '89504e470d0a1a0a') return null;
  if (head.slice(12, 16).toString('ascii') !== 'IHDR') return null;
  return { w: head.readUInt32BE(16), h: head.readUInt32BE(20) };
}

let pass = 0, fail = 0;
const t = (name, cond, extra) => {
  cond ? pass++ : fail++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : '   <-- ' + (extra === undefined ? '' : extra)}`);
};

const real = pngSize(path.join(ROOT, ASSET));
t(`${ASSET} is a readable PNG`, real !== null, 'could not read an IHDR chunk');
if (real === null) { console.log(`\n${pass} passed, ${fail} failed`); process.exit(1); }

const tag = /<img\b[^>]*>/gi;
const attr = (t_, n) => { const m = t_.match(new RegExp(`\\b${n}="([^"]*)"`)); return m ? m[1] : null; };

const wrong = [], bare = [];
let declared = 0, tags = 0;

for (const file of walk(ROOT)) {
  const rel = path.relative(ROOT, file).split(path.sep).join('/');
  const html = fs.readFileSync(file, 'utf8');
  for (const m of html.match(tag) || []) {
    if (attr(m, 'src') !== SRC) continue;
    tags++;
    const w = attr(m, 'width'), h = attr(m, 'height');
    if (w === null && h === null) {
      if (!NO_DIMENSIONS_BY_CONVENTION.has(rel)) bare.push(rel);
      continue;
    }
    declared++;
    if (Number(w) !== real.w || Number(h) !== real.h) wrong.push(`${rel} (${w}x${h})`);
  }
}

const show = (list) => `${list.length}: ${[...new Set(list)].slice(0, 6).join(', ')}${list.length > 6 ? ' …' : ''}`;

t(`the logo is declared on enough surfaces to be worth checking (${tags} tag(s), ${declared} with dimensions)`,
  declared > 50, `only ${declared} declared`);
t(`every declaration matches the file (${real.w}x${real.h})`, wrong.length === 0, show(wrong));
t('no page outside the PDF sources has dropped its dimensions', bare.length === 0, show(bare));

// The generator writes 10 of the pages counted above. If it emits the image
// without dimensions, or with stale ones, its next run disagrees with the
// pages it produced last time -- which is how this divergence started.
for (const gen of ['scripts/generate-product-pages.py']) {
  const src = fs.readFileSync(path.join(ROOT, gen), 'utf8');
  const m = src.match(new RegExp(`<img[^>]*${SRC.replace(/[/.]/g, '\\$&')}[^>]*>`));
  t(`${gen} emits the logo`, m !== null);
  if (m) {
    t(`${gen} declares the real dimensions`,
      Number(attr(m[0], 'width')) === real.w && Number(attr(m[0], 'height')) === real.h,
      m[0].slice(0, 120));
  }
}

if (fail === 0) {
  console.log(`\nlogo-dimensions OK -- ${declared} declaration(s) of ${ASSET} all read ${real.w}x${real.h}, matching the file.`);
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
