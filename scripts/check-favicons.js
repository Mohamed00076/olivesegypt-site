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

// ---- 3. each family carries its own artwork ------------------------------
//
// There are deliberately two.
//
// The full logo is a tall lockup: two colour bars, an olive, and fine
// branches. It resolves from about 96px up. Below roughly 48px the branches
// collapse and it reads as a smudge -- which is what the tab showed once the
// red placeholder was replaced with the real thing.
//
// So the small icons are a 96x96 crop of that same artwork, centred on the
// olive at the top of the mark: the one element with enough mass to survive
// 16 pixels. Nothing is drawn, moved or recoloured; favicon-mark.png is a
// window onto icon-512.png and nothing else. The large icons stay the
// complete logo, because at 180px and up the whole lockup is the point.
//
// Two families means a mismatch between them is now normal, so the drift
// check runs inside each family rather than across them. Comparing the tab
// icon to the app icon would fail on a difference that is intentional --
// which is how a check earns the reputation of something to be silenced.
const FAMILIES = [
  { name: 'small (tab and bookmark)', reference: 'assets/favicon-mark.png',
    members: ['favicon-48.png'], ico: 'favicon.ico' },
  { name: 'large (home screen and app)', reference: 'icon-512.png',
    members: ['favicon-96.png', 'icon-192.png', 'apple-touch-icon.png'], ico: null },
];

// 0-255 per channel. The same artwork at 16px and 96px lands well under this;
// two different pictures came in above 120 when this was tested.
const DRIFT_LIMIT = 24;

for (const family of FAMILIES) {
  const referencePath = path.join(ROOT, family.reference);
  if (!fs.existsSync(referencePath)) {
    problems.push(`${family.reference} is missing, so the ${family.name} icons cannot be verified`);
    continue;
  }
  const referenceImg = decodePng(fs.readFileSync(referencePath), family.reference);
  const reference = signature(referenceImg);

  if (flatness(referenceImg) > FLAT_LIMIT) {
    problems.push(`${family.reference} is a flat fill, so it cannot be the reference for anything`);
  }

  for (const rel of family.members) {
    if (!decoded.has(rel)) continue;   // missing, already reported
    const diff = meanDifference(signature(decoded.get(rel)), reference);
    if (diff > DRIFT_LIMIT) {
      problems.push(
        `${rel} does not look like ${family.reference} (mean channel difference ` +
        `${diff.toFixed(1)}, limit ${DRIFT_LIMIT}) -- the ${family.name} icons have drifted apart`
      );
    }
  }

  if (!family.ico) continue;

  const icoPath = path.join(ROOT, family.ico);
  if (!fs.existsSync(icoPath)) {
    problems.push(`${family.ico} is missing; browsers request it from the site root whether or not it is linked`);
    continue;
  }
  const entries = readIco(fs.readFileSync(icoPath), family.ico);
  if (entries.length === 0) {
    problems.push(`${family.ico} contains no images`);
  }
  for (const entry of entries) {
    const label = `${family.ico} (${entry.width}x${entry.height})`;
    if (entry.blob.readUInt32BE(0) !== 0x89504e47) {
      // A BMP-packed .ico is legal and browsers read it; this check simply
      // cannot compare one, and skipping in silence is how the bug survived.
      problems.push(`${label} is not PNG-packed, so its artwork cannot be verified here`);
      continue;
    }
    const img = decodePng(entry.blob, label);

    const flat = flatness(img);
    if (flat > FLAT_LIMIT) {
      problems.push(`${label} is ${(flat * 100).toFixed(0)}% a single colour -- this is the red-square placeholder bug`);
    }

    const diff = meanDifference(signature(img), reference);
    if (diff > DRIFT_LIMIT) {
      problems.push(
        `${label} does not look like ${family.reference} (mean channel difference ` +
        `${diff.toFixed(1)}, limit ${DRIFT_LIMIT}) -- the tab icon has drifted from the logo`
      );
    }
  }
}

// ---- 4. the small mark is a crop of the logo, not a separate drawing -----
//
// The whole justification for a second piece of artwork is that it is not a
// second piece of artwork -- it is a window onto the first. That claim has to
// be enforced, or "crop of the logo" quietly becomes "whatever someone drew
// that looks vaguely similar". So: slide the mark's 96x96 footprint over
// icon-512.png and require an exact-enough match somewhere in it.
{
  const MARK = 'assets/favicon-mark.png';
  const SOURCE = 'icon-512.png';
  const markPath = path.join(ROOT, MARK);
  const sourcePath = path.join(ROOT, SOURCE);

  if (fs.existsSync(markPath) && fs.existsSync(sourcePath)) {
    const mark = decodePng(fs.readFileSync(markPath), MARK);
    const source = decodePng(fs.readFileSync(sourcePath), SOURCE);
    const markSig = signature(mark);

    // lift a mark-sized window out of the source and signature it the same way
    const windowAt = (left, top) => {
      const win = { width: mark.width, height: mark.height, channels: source.channels,
                    pixels: Buffer.alloc(mark.width * mark.height * source.channels) };
      for (let y = 0; y < mark.height; y++) {
        source.pixels.copy(
          win.pixels, y * mark.width * source.channels,
          ((top + y) * source.width + left) * source.channels,
          ((top + y) * source.width + left + mark.width) * source.channels
        );
      }
      return meanDifference(signature(win), markSig);
    };

    // Coarse sweep, then refine pixel by pixel around the best hit. A single
    // pass at step 1 would be ~174k windows; this is a few hundred and still
    // lands on the exact origin.
    let best = Infinity;
    let bestAt = [0, 0];
    const search = (step, x0, y0, x1, y1) => {
      for (let top = Math.max(0, y0); top <= Math.min(y1, source.height - mark.height); top += step) {
        for (let left = Math.max(0, x0); left <= Math.min(x1, source.width - mark.width); left += step) {
          const diff = windowAt(left, top);
          if (diff < best) { best = diff; bestAt = [left, top]; }
        }
      }
    };
    search(4, 0, 0, source.width, source.height);
    search(1, bestAt[0] - 4, bestAt[1] - 4, bestAt[0] + 4, bestAt[1] + 4);

    // A genuine crop lands at essentially zero. Anything drawn by hand, even
    // in the same style, does not come close.
    if (best > 2) {
      problems.push(
        `${MARK} is not a crop of ${SOURCE} (closest window differs by ${best.toFixed(1)}) -- ` +
        `the small icons must be the company's own logo, not separate artwork`
      );
    } else {
      console.log(`  ${MARK} matches ${SOURCE} at ${bestAt.join(',')} (difference ${best.toFixed(2)})`);
    }
  }
}

if (problems.length === 0) {
  const sizes = readIco(fs.readFileSync(path.join(ROOT, 'favicon.ico')), 'favicon.ico')
    .map((e) => `${e.width}x${e.height}`)
    .join(', ');
  console.log(
    `favicons OK -- ${referenced.size} referenced icon(s) all present, none is a flat fill, ` +
    `favicon.ico (${sizes}) and favicon-48.png carry the cropped olive mark, and the 96/192/512/apple ` +
    `icons carry the full logo. Both families internally consistent.`
  );
  process.exit(0);
}
console.error(`favicons FAILED -- ${problems.length} problem(s):\n`);
problems.forEach((p) => console.error('  ' + p));
process.exit(1);
