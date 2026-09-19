#!/usr/bin/env node
'use strict';

/*
 * Every declared image size is the size of the file it describes.
 *
 *   node scripts/check-image-dimensions.js        (part of `npm test`)
 *
 * WHAT WENT WRONG, TWICE
 *
 * The logo. #116 cropped assets/logo-BJ1TOn9V.png from a 512x512 canvas to
 * its 236x289 artwork -- the mark had been filling 44% of the width and 54%
 * of the height, so it rendered at about 17px in the 32px box the header
 * gives it -- and 105 tags went on declaring 512x512 for a file that was no
 * longer either.
 *
 * The product photographs, which had been wrong for longer. Ten thumbnails
 * declared their DISPLAY size (96x96 on the printable catalogues, 80x80 on
 * the downloads pages) rather than the size of the file, and three tags in
 * ar/catalog declared 800x515 -- the real size of olive-black -- on the
 * aggizi, toffahi and hamed photographs, which are 800x533, 1200x800 and
 * 1200x1800. The English catalogue had all three right, so the Arabic page
 * was a copy whose numbers were never updated.
 *
 * None of it ever showed. Every one of those tags also carries CSS that pins
 * both axes -- h-8 w-8, h-10 w-10, .spec-thumb, w-full h-full inside a fixed
 * h-44 box -- so the attributes never reach layout and object-fit uses the
 * real intrinsic ratio regardless of what the markup claims. A wrong value
 * looked exactly like a right one for as long as anyone cared to look.
 *
 * WHAT THIS ASSERTS
 *
 * One rule, for every raster image the site serves itself: if a tag declares
 * width and height, they are the file's own dimensions. Declaring nothing is
 * allowed -- the PDF sources declare nothing on any image, which is a
 * convention rather than a gap -- but declaring something untrue is not.
 *
 * Sizes are read out of the file headers on every run, so the assets are the
 * source of truth: re-cropping an image fails this check until the markup
 * follows it.
 *
 * SVGs are skipped. Their intrinsic size is a viewBox or a percentage and
 * often neither, so there is no single number to compare against and a check
 * that guessed one would be asserting its own guess.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const LOGO = '/assets/logo-BJ1TOn9V.png';

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

// PNG: 8-byte signature, then IHDR, whose width and height are two big-endian
// uint32s at offsets 16 and 20.
function pngSize(buf) {
  if (buf.slice(0, 8).toString('hex') !== '89504e470d0a1a0a') return null;
  if (buf.slice(12, 16).toString('ascii') !== 'IHDR') return null;
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

// JPEG: walk the segments to the start-of-frame marker, which carries height
// then width as big-endian uint16s.
function jpegSize(buf) {
  if (buf.readUInt16BE(0) !== 0xffd8) return null;
  let i = 2;
  while (i < buf.length - 9) {
    if (buf[i] !== 0xff) { i++; continue; }
    const marker = buf[i + 1];
    const isSOF = (marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) ||
                  (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf);
    if (isSOF) return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue; }
    i += 2 + buf.readUInt16BE(i + 2);
  }
  return null;
}

const sizeCache = new Map();
function intrinsic(src) {
  if (sizeCache.has(src)) return sizeCache.get(src);
  const ext = path.extname(src).toLowerCase();
  let size = null;
  if (ext === '.png' || ext === '.jpg' || ext === '.jpeg') {
    const file = path.join(ROOT, src.replace(/^\//, ''));
    if (fs.existsSync(file)) {
      const buf = fs.readFileSync(file);
      size = ext === '.png' ? pngSize(buf) : jpegSize(buf);
    }
  }
  sizeCache.set(src, size);
  return size;
}

let pass = 0, fail = 0;
const t = (name, cond, extra) => {
  cond ? pass++ : fail++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : '   <-- ' + (extra === undefined ? '' : extra)}`);
};

const TAG = /<img\b[^>]*>/gi;
const attr = (tag, name) => { const m = tag.match(new RegExp(`\\b${name}="([^"]*)"`)); return m ? m[1] : null; };

const wrong = [], unreadable = [], logoBare = [];
let declared = 0, assets = new Set(), logoTags = 0;

for (const file of walk(ROOT)) {
  const rel = path.relative(ROOT, file).split(path.sep).join('/');
  const html = fs.readFileSync(file, 'utf8');
  for (const tag of html.match(TAG) || []) {
    const src = attr(tag, 'src');
    if (!src || /^(https?:)?\/\//.test(src) || src.startsWith('data:')) continue;

    if (src === LOGO) {
      logoTags++;
      if (attr(tag, 'width') === null && attr(tag, 'height') === null &&
          !NO_DIMENSIONS_BY_CONVENTION.has(rel)) logoBare.push(rel);
    }

    const w = attr(tag, 'width'), h = attr(tag, 'height');
    if (w === null && h === null) continue;

    const real = intrinsic(src);
    if (real === null) {
      if (/\.(png|jpe?g)$/i.test(src)) unreadable.push(`${rel} (${src})`);
      continue;                       // SVG and the like: nothing to compare
    }
    declared++;
    assets.add(src);
    if (Number(w) !== real.w || Number(h) !== real.h) {
      wrong.push(`${rel} (${src} declared ${w}x${h}, file is ${real.w}x${real.h})`);
    }
  }
}

const show = (list) => `${list.length}: ${[...new Set(list)].slice(0, 4).join('; ')}${list.length > 4 ? ' …' : ''}`;

t(`enough declarations to be worth checking (${declared} tag(s) across ${assets.size} asset(s))`,
  declared > 50, `only ${declared}`);
t('every declared size matches the file it describes', wrong.length === 0, show(wrong));
t('every raster image a tag declares could actually be read', unreadable.length === 0, show(unreadable));
t(`the logo still declares its size outside the PDF sources (${logoTags} tag(s))`,
  logoBare.length === 0, show(logoBare));

// The generator writes 10 of the pages counted above. If it emits an image
// without dimensions, or with stale ones, its next run disagrees with the
// pages it produced last time -- which is how the logo divergence started.
for (const gen of ['scripts/generate-product-pages.py']) {
  const src = fs.readFileSync(path.join(ROOT, gen), 'utf8');
  const m = src.match(new RegExp(`<img[^>]*${LOGO.replace(/[/.]/g, '\\$&')}[^>]*>`));
  t(`${gen} emits the logo`, m !== null);
  if (m) {
    const real = intrinsic(LOGO);
    t(`${gen} declares the logo's real dimensions`,
      real !== null && Number(attr(m[0], 'width')) === real.w && Number(attr(m[0], 'height')) === real.h,
      m[0].slice(0, 120));
  }
}

if (fail === 0) {
  console.log(`\nimage-dimensions OK -- ${declared} declaration(s) across ${assets.size} asset(s) all match their files.`);
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
