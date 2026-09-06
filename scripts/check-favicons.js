#!/usr/bin/env node
'use strict';

/*
 * The browser-tab icon must actually be the company's logo.
 *
 *   node scripts/check-favicons.js        (part of `npm test`)
 *
 * On 2026-09-06 the owner asked why the tab showed a red square instead of
 * the logo. favicon.ico was a solid #ff3c00 fill -- every pixel, at all three
 * embedded sizes. It had been that way since 2026-09-01, in a commit whose
 * subject was "favicon & image visibility (diagnostic + mechanical fixes)".
 *
 * Everything around it was correct, which is exactly why it survived. The
 * five PNG icons are the real logo. The manifest is right. The <link> tags
 * are right and in the right order. A check that only asked "does the file
 * exist" -- or "is it a valid .ico" -- passed, because it did exist and it
 * was valid. It was just the wrong picture, and no test in this repo had any
 * opinion about what a picture contained.
 *
 * Nor could anyone see it: at 16px in a tab, on a page nobody reloads with a
 * cleared cache, a wrong favicon is close to invisible to the people who
 * built the site and glaring to a visitor. Google Search Console showed it
 * back to the owner, five days later, which is how it surfaced.
 *
 * So this check reads the pixels:
 *
 *   1. every icon the HTML and the manifest reference exists
 *   2. no icon is a single flat colour -- that is the placeholder signature
 *   3. the artwork inside favicon.ico matches favicon-48.png
 *
 * Rule 3 is the one that would have caught it. The .ico is generated from the
 * same source as the PNGs, so if it ever stops looking like them, it is
 * either a placeholder or a stale build -- and both are bugs.
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.join(__dirname, '..');
const problems = [];

// ---- a minimal PNG reader ------------------------------------------------
//
// Only what these files actually are: 8-bit RGB or RGBA, non-interlaced. Any
// other shape throws rather than being skipped, so this cannot pass by
// quietly declining to read something.
function decodePng(buf, label) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error(`${label}: not a PNG`);
  let off = 8;
  let width = 0, height = 0, depth = 0, colour = 0, interlace = 0;
  const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      depth = data[8];
      colour = data[9];
      interlace = data[12];
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }
    off += 12 + len;
  }
  if (depth !== 8 || (colour !== 2 && colour !== 6) || interlace !== 0) {
    throw new Error(`${label}: unsupported PNG (depth ${depth}, colour type ${colour}, interlace ${interlace})`);
  }

  const channels = colour === 6 ? 4 : 3;
  const stride = width * channels;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const out = Buffer.alloc(height * stride);
  let prev = Buffer.alloc(stride);
  let p = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[p++];
    const line = Buffer.from(raw.subarray(p, p + stride));
    p += stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? line[x - channels] : 0;
      const b = prev[x];
      const c = x >= channels ? prev[x - channels] : 0;
      if (filter === 1) line[x] = (line[x] + a) & 255;
      else if (filter === 2) line[x] = (line[x] + b) & 255;
      else if (filter === 3) line[x] = (line[x] + ((a + b) >> 1)) & 255;
      else if (filter === 4) {
        const pp = a + b - c;
        const pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c);
        line[x] = (line[x] + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255;
      } else if (filter !== 0) {
        throw new Error(`${label}: unknown row filter ${filter}`);
      }
    }
    line.copy(out, y * stride);
    prev = line;
  }
  return { width, height, channels, pixels: out };
}

// ---- the images packed inside an .ico ------------------------------------
function readIco(buf, label) {
  if (buf.readUInt16LE(2) !== 1) throw new Error(`${label}: not an icon file`);
  const count = buf.readUInt16LE(4);
  const entries = [];
  for (let i = 0; i < count; i++) {
    const e = 6 + i * 16;
    const size = buf.readUInt32LE(e + 8);
    const offset = buf.readUInt32LE(e + 12);
    entries.push({
      width: buf[e] || 256,
      height: buf[e + 1] || 256,
      blob: buf.subarray(offset, offset + size),
    });
  }
  return entries;
}

/*
 * Reduce any image to an 8x8 grid of average colours, flattened onto white.
 * Two renderings of the same artwork at different sizes agree closely here;
 * two different pictures do not. Alpha is composited rather than ignored,
 * because a transparent icon and a white one look identical in a tab.
 */
function signature({ width, height, channels, pixels }) {
  const grid = new Array(64 * 3).fill(0);
  const counts = new Array(64).fill(0);
  for (let y = 0; y < height; y++) {
    const gy = Math.min(7, Math.floor((y * 8) / height));
    for (let x = 0; x < width; x++) {
      const gx = Math.min(7, Math.floor((x * 8) / width));
      const i = (y * width + x) * channels;
      const a = channels === 4 ? pixels[i + 3] / 255 : 1;
      const cell = gy * 8 + gx;
      for (let c = 0; c < 3; c++) {
        grid[cell * 3 + c] += pixels[i + c] * a + 255 * (1 - a);
      }
      counts[cell]++;
    }
  }
  return grid.map((v, i) => v / counts[Math.floor(i / 3)]);
}

function meanDifference(a, b) {
  let total = 0;
  for (let i = 0; i < a.length; i++) total += Math.abs(a[i] - b[i]);
  return total / a.length;
}

/* The share of the image taken by its single most common colour. A generated
 * placeholder is one flat fill; real artwork is not. */
function flatness({ width, height, channels, pixels }) {
  const tally = new Map();
  for (let i = 0; i < width * height; i++) {
    const p = i * channels;
    const key = (pixels[p] << 16) | (pixels[p + 1] << 8) | pixels[p + 2];
    tally.set(key, (tally.get(key) || 0) + 1);
  }
  return Math.max(...tally.values()) / (width * height);
}

// ---- 1. everything referenced exists -------------------------------------
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const referenced = new Set();
for (const m of html.matchAll(/<link[^>]*rel="(?:shortcut )?(?:apple-touch-)?icon"[^>]*href="\/([^"]+)"/g)) {
  referenced.add(m[1]);
}
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'site.webmanifest'), 'utf8'));
for (const icon of manifest.icons || []) referenced.add(icon.src.replace(/^\//, ''));

if (referenced.size === 0) {
  problems.push('no icons referenced from index.html or the manifest -- this check would pass vacuously');
}
for (const rel of referenced) {
  if (!fs.existsSync(path.join(ROOT, rel))) {
    problems.push(`${rel} is referenced as an icon but does not exist in the publish directory`);
  }
}

// ---- 2. no icon is a flat fill -------------------------------------------
//
// The threshold is deliberately loose. The logo sits on a white card, so
// white is legitimately about 62% of it; a placeholder is 99-100%.
const FLAT_LIMIT = 0.9;
const decoded = new Map();

for (const rel of [...referenced].filter((r) => r.endsWith('.png')).sort()) {
  // A missing file is already recorded above; reading it here would abort the
  // run with a stack trace and hide every remaining problem.
  if (!fs.existsSync(path.join(ROOT, rel))) continue;
  const img = decodePng(fs.readFileSync(path.join(ROOT, rel)), rel);
  decoded.set(rel, img);
  const flat = flatness(img);
  if (flat > FLAT_LIMIT) {
    problems.push(
      `${rel} is ${(flat * 100).toFixed(0)}% a single colour -- that is a placeholder, not the logo`
    );
  }
}

// ---- 3. favicon.ico shows the same artwork as favicon-48.png -------------
const ICO = 'favicon.ico';
const REFERENCE = 'favicon-48.png';

if (!fs.existsSync(path.join(ROOT, ICO))) {
  problems.push(`${ICO} is missing; browsers request it from the site root whether or not it is linked`);
} else if (!decoded.has(REFERENCE)) {
  problems.push(`${REFERENCE} is not referenced anywhere, so there is nothing to compare ${ICO} against`);
} else {
  const reference = signature(decoded.get(REFERENCE));
  const entries = readIco(fs.readFileSync(path.join(ROOT, ICO)), ICO);

  if (entries.length === 0) {
    problems.push(`${ICO} contains no images`);
  }
  for (const entry of entries) {
    const label = `${ICO} (${entry.width}x${entry.height})`;
    if (entry.blob.readUInt32BE(0) !== 0x89504e47) {
      // A BMP-packed .ico is legal and readable by browsers; this check just
      // cannot compare it, and silently skipping is how the bug survived.
      problems.push(`${label} is not PNG-packed, so its artwork cannot be verified here`);
      continue;
    }
    const img = decodePng(entry.blob, label);

    const flat = flatness(img);
    if (flat > FLAT_LIMIT) {
      problems.push(`${label} is ${(flat * 100).toFixed(0)}% a single colour -- this is the red-square placeholder bug`);
    }

    // 0-255 per channel; the same artwork at 16px vs 48px lands well under 20
    const diff = meanDifference(signature(img), reference);
    if (diff > 24) {
      problems.push(
        `${label} does not look like ${REFERENCE} (mean channel difference ${diff.toFixed(1)}, limit 24) ` +
        `-- the tab icon has drifted from the logo the rest of the site uses`
      );
    }
  }
}

if (problems.length === 0) {
  const sizes = readIco(fs.readFileSync(path.join(ROOT, ICO)), ICO)
    .map((e) => `${e.width}x${e.height}`)
    .join(', ');
  console.log(
    `favicons OK -- ${referenced.size} referenced icon(s) all present, none is a flat fill, and ` +
    `favicon.ico (${sizes}) carries the same artwork as ${REFERENCE}.`
  );
  process.exit(0);
}
console.error(`favicons FAILED -- ${problems.length} problem(s):\n`);
problems.forEach((p) => console.error('  ' + p));
process.exit(1);
