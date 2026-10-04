#!/usr/bin/env node
'use strict';

/*
 * The performance budget (owner, approved 2026-10-04).
 *
 *   node scripts/check-performance-budget.js        (part of `npm test`)
 *
 * The visual upgrade must not make the site slower. The owner approved a
 * budget measured on a phone's first visit, set against the 2026-10-04
 * baseline (local lab, Lighthouse mobile: pages 166-362 KB) so it passed on
 * day one, with targets tightened as each phase lands:
 *
 *   first-visit weight   homepage 500 KB (a WARNING above 350 KB, not a
 *                        failure); /catalog 450 KB; every other page 400 KB
 *   requests             30 per page
 *   one image            150 KB for a page's priority image
 *                        (fetchpriority="high"), 100 KB for any other
 *   font families        2 web families per script (Latin, Arabic)
 *   font files           English pages 2, Arabic pages 4
 *   font bytes           English pages 90 KB, Arabic pages 140 KB
 *
 * There is no browser here, so this works out from the files what a phone
 * (412 CSS px wide at 1.75x, as Lighthouse's mobile profile) downloads before
 * it scrolls: the HTML, stylesheets and scripts, Brotli-compressed as Netlify
 * serves them; each image not marked loading="lazy", at the candidate that
 * phone would pick from its <picture>/srcset/sizes; background images the
 * stylesheet gives a class the page uses; and every font file whose
 * unicode-range covers a character the page contains, for the web families
 * the page's language names. It reads the same, page by page, as
 * Lighthouse's transfer sizes to within a few KB.
 *
 * Load times (LCP at or under 2.5 s, CLS at or under 0.1, TBT at or under
 * 200 ms on mobile) need a browser, so they are measured per phase with
 * Lighthouse in the local lab and reported, not checked here.
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.join(__dirname, '..');
const KB = 1024;
const BUDGET = {
  home: { fail: 500 * KB, warn: 350 * KB },
  catalog: { fail: 450 * KB },
  page: { fail: 400 * KB },
  requests: 30,
  priorityImage: 150 * KB,
  image: 100 * KB,
  familiesPerScript: 2,
  fontFiles: { en: 2, ar: 4 },
  fontBytes: { en: 90 * KB, ar: 140 * KB },
};
const PHONE = { width: 412, dpr: 1.75 };

const read = (rel) => fs.readFileSync(path.join(ROOT, rel.replace(/^\//, '')));
const exists = (rel) => fs.existsSync(path.join(ROOT, rel.replace(/^\//, '')));
const brotli = (buf) => zlib.brotliCompressSync(buf, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 } }).length;
// Shared files (the stylesheet, the scripts) are compressed once, not per page.
const compressed = new Map();
const brotliFile = (rel) => { if (!compressed.has(rel)) compressed.set(rel, brotli(read(rel))); return compressed.get(rel); };
const attr = (tag, name) => { const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*"([^"]*)"`, 'i')); return m ? m[1] : null; };

// ---- what a phone picks from a srcset ------------------------------------
function mediaMatches(media) {
  if (!media) return true;
  return media.split(/\s+and\s+/).every((part) => {
    const m = part.match(/\((min|max)-width:\s*([\d.]+)px\)/);
    if (!m) return true;
    return m[1] === 'min' ? PHONE.width >= Number(m[2]) : PHONE.width <= Number(m[2]);
  });
}
function slotWidth(sizes) {
  if (!sizes) return PHONE.width;
  for (const entry of sizes.split(',').map((s) => s.trim())) {
    const m = entry.match(/^(\([^)]*\)(?:\s+and\s+\([^)]*\))*)\s+(.+)$/);
    const [media, size] = m ? [m[1], m[2]] : [null, entry];
    if (!mediaMatches(media)) continue;
    if (/vw$/.test(size)) return PHONE.width * parseFloat(size) / 100;
    if (/px$/.test(size)) return parseFloat(size);
    return PHONE.width;
  }
  return PHONE.width;
}
function pick(srcset, sizes) {
  const cands = srcset.split(',').map((s) => s.trim().split(/\s+/)).filter((c) => c[0]);
  if (cands.length === 1 || !cands.every((c) => /w$/.test(c[1] || ''))) return cands[0][0];
  const need = slotWidth(sizes) * PHONE.dpr;
  const sorted = cands.map((c) => [c[0], parseInt(c[1], 10)]).sort((a, b) => a[1] - b[1]);
  return (sorted.find((c) => c[1] >= need) || sorted[sorted.length - 1])[0];
}

// ---- stylesheets: background images and font faces ----------------------
const STYLESHEETS = ['assets/index-Dw0yUE42.css', 'assets/fonts/fonts.css'];
const cssText = STYLESHEETS.map((f) => read(f).toString('utf8')).join('\n');
// A background image tied to one class: ".tc-hero-texture{...url(/assets/x)}".
const classBackgrounds = [];
for (const m of cssText.matchAll(/\.([A-Za-z0-9_-]+)(?:::?[a-z-]+)?\s*\{[^}]*?url\((\/assets\/[^)'"]+)\)/g)) {
  classBackgrounds.push({ cls: m[1], url: m[2] });
}
function ranges(spec) {
  if (!spec) return [[0, 0x10ffff]];
  return spec.split(',').map((r) => r.trim().replace(/^U\+/i, '')).map((r) => {
    if (r.includes('?')) return [parseInt(r.replace(/\?/g, '0'), 16), parseInt(r.replace(/\?/g, 'F'), 16)];
    const [a, b] = r.split('-');
    return [parseInt(a, 16), parseInt(b || a, 16)];
  });
}
const faces = [];
for (const [, body] of cssText.matchAll(/@font-face\s*\{([^}]*)\}/g)) {
  const family = ((body.match(/font-family\s*:\s*([^;]+)/) || [])[1] || '').trim().replace(/^["']|["']$/g, '');
  const url = (body.match(/url\((\/[^)'"]+\.woff2)\)/) || [])[1];
  if (!family || !url) continue; // local() fallbacks download nothing
  // Italic faces download only for italic text, which the site does not set
  // in its web families (Lighthouse sees two font files on English pages).
  if (/font-style\s*:\s*italic/.test(body)) continue;
  faces.push({ family, url, ranges: ranges((body.match(/unicode-range\s*:\s*([^;]+)/) || [])[1]) });
}
const webFamilies = new Set(faces.map((f) => f.family));
// The families a page's language names, from the stylesheet's font variables.
function stackFor(lang) {
  const take = (selector) => {
    const block = (cssText.match(new RegExp(`${selector}\\s*\\{([^}]*)\\}`, 'g')) || []).join('\n');
    const vars = {};
    for (const m of block.matchAll(/--app-font-(sans|serif|mono)\s*:\s*([^;]+)/g)) vars[m[1]] = m[2];
    return vars;
  };
  const root = Object.assign({}, ...[...cssText.matchAll(/:root\s*\{([^}]*)\}/g)].map((m) => {
    const v = {};
    for (const n of m[1].matchAll(/--app-font-(sans|serif|mono)\s*:\s*([^;]+)/g)) v[n[1]] = n[2];
    return v;
  }));
  const vars = lang === 'ar' ? Object.assign({}, root, take('html\\[lang="ar"\\]')) : root;
  const fams = new Set();
  for (const value of Object.values(vars)) {
    for (const f of value.split(',').map((s) => s.trim().replace(/^["']|["']$/g, ''))) if (webFamilies.has(f)) fams.add(f);
  }
  return fams;
}
const SCRIPT = { latin: (cp) => cp < 0x0600 || cp > 0x08ff && cp < 0xfb50 || cp > 0xfeff, arabic: (cp) => cp >= 0x0600 && cp <= 0x08ff || cp >= 0xfb50 && cp <= 0xfeff };

// ---- one page ------------------------------------------------------------
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', mdash: '—', ndash: '–', middot: '·', rarr: '→', larr: '←', ntilde: 'ñ', times: '×', hellip: '…' };
function measure(rel) {
  const htmlBuf = read(rel);
  const html = htmlBuf.toString('utf8');
  const lang = (html.match(/<html[^>]*\slang="([a-z]+)/) || [])[1] === 'ar' ? 'ar' : 'en';
  const items = [{ kind: 'html', url: rel, bytes: brotli(htmlBuf) }];
  const seen = new Set();
  const add = (kind, url, bytes, extra) => { if (seen.has(url)) return; seen.add(url); items.push(Object.assign({ kind, url, bytes }, extra)); };

  for (const tag of html.match(/<link\b[^>]*>/g) || []) {
    const href = attr(tag, 'href');
    if (/rel="stylesheet"/.test(tag) && href && href.startsWith('/') && exists(href)) add('css', href, brotliFile(href));
  }
  for (const tag of html.match(/<script\b[^>]*\ssrc="[^"]*"[^>]*>/g) || []) {
    const src = attr(tag, 'src');
    if (src.startsWith('/') && exists(src)) add('js', src, brotliFile(src));
    else add('js', src, 0);
  }
  // Images: each <picture> as one choice; a lone <img> on its own.
  const body = html.slice(html.indexOf('<body'));
  const pictures = body.match(/<picture\b[\s\S]*?<\/picture>/g) || [];
  const loose = body.replace(/<picture\b[\s\S]*?<\/picture>/g, '').match(/<img\b[^>]*>/g) || [];
  const choose = (sources, img) => {
    if (/\sloading="lazy"/.test(img)) return null;
    for (const s of sources) {
      if (!mediaMatches(attr(s, 'media'))) continue;
      const type = attr(s, 'type');
      if (type && !/webp|avif|png|jpe?g|gif|svg/.test(type)) continue;
      return pick(attr(s, 'srcset'), attr(s, 'sizes'));
    }
    const srcset = attr(img, 'srcset');
    return srcset ? pick(srcset, attr(img, 'sizes')) : attr(img, 'src');
  };
  const consider = (url, img) => {
    if (!url || url.startsWith('data:')) return;
    if (url.startsWith('/') && exists(url)) add('image', url, read(url).length, { priority: /fetchpriority="high"/.test(img) });
  };
  for (const pic of pictures) {
    const img = (pic.match(/<img\b[^>]*>/) || [''])[0];
    consider(choose(pic.match(/<source\b[^>]*>/g) || [], img), img);
  }
  for (const img of loose) consider(choose([], img), img);
  const classes = new Set((body.match(/\sclass="([^"]*)"/g) || []).flatMap((c) => c.slice(8, -1).split(/\s+/)));
  for (const bg of classBackgrounds) if (classes.has(bg.cls) && exists(bg.url)) add('image', bg.url, read(bg.url).length, { priority: false });

  // Fonts: the files whose range covers a character on the page.
  const text = body.replace(/<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ')
    .replace(/&([a-z]+);/g, (m, e) => ENTITIES[e] || ' ').replace(/&#x([0-9a-f]+);/gi, (m, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (m, d) => String.fromCodePoint(Number(d)));
  const chars = new Set([...text].map((c) => c.codePointAt(0)));
  const families = stackFor(lang);
  for (const face of faces) {
    if (!families.has(face.family)) continue;
    if (![...chars].some((cp) => face.ranges.some(([a, b]) => cp >= a && cp <= b))) continue;
    add('font', face.url, read(face.url).length, { family: face.family });
  }
  return { rel, lang, items, families };
}

// ---- run ------------------------------------------------------------------
let pass = 0, fail = 0;
const warnings = [];
const t = (name, ok, details) => {
  ok ? pass++ : fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (!ok && details && details.length) details.slice(0, 10).forEach((d) => console.log('      ' + d));
};

const pages = [...read('sitemap.xml').toString('utf8').matchAll(/<loc>https:\/\/olivesegypt\.com([^<]*)<\/loc>/g)]
  .map((m) => m[1] || '/')
  .map((u) => ({ url: u, file: (u === '/' ? '' : u.replace(/^\//, '').replace(/\/?$/, '/')) + 'index.html' }))
  .filter((p) => exists(p.file));

const over = { weight: [], requests: [], image: [], fontFiles: [], fontBytes: [] };
const report = [];
const familiesByScript = { latin: new Set(), arabic: new Set() };
for (const p of pages) {
  const r = measure(p.file);
  const total = r.items.reduce((a, i) => a + i.bytes, 0);
  const fonts = r.items.filter((i) => i.kind === 'font');
  const fontBytes = fonts.reduce((a, i) => a + i.bytes, 0);
  const kind = /^\/(ar\/)?$/.test(p.url) ? 'home' : /^\/(ar\/)?catalog\/?$/.test(p.url) ? 'catalog' : 'page';
  report.push({ url: p.url, kb: Math.round(total / KB), requests: r.items.length, fonts: fonts.length, fontKb: Math.round(fontBytes / KB) });
  if (total > BUDGET[kind].fail) over.weight.push(`${p.url}: ${Math.round(total / KB)} KB (limit ${BUDGET[kind].fail / KB} KB)`);
  else if (BUDGET[kind].warn && total > BUDGET[kind].warn) warnings.push(`${p.url}: ${Math.round(total / KB)} KB is over the ${BUDGET[kind].warn / KB} KB homepage warning threshold (limit ${BUDGET[kind].fail / KB} KB)`);
  if (r.items.length > BUDGET.requests) over.requests.push(`${p.url}: ${r.items.length} requests`);
  for (const img of r.items.filter((i) => i.kind === 'image')) {
    const limit = img.priority ? BUDGET.priorityImage : BUDGET.image;
    if (img.bytes > limit) over.image.push(`${p.url}: ${img.url} ${Math.round(img.bytes / KB)} KB (limit ${limit / KB} KB)`);
  }
  if (fonts.length > BUDGET.fontFiles[r.lang]) over.fontFiles.push(`${p.url}: ${fonts.length} font files (${fonts.map((f) => path.basename(f.url)).join(', ')})`);
  if (fontBytes > BUDGET.fontBytes[r.lang]) over.fontBytes.push(`${p.url}: ${Math.round(fontBytes / KB)} KB of fonts`);
  for (const f of fonts) {
    const face = faces.find((x) => x.url === f.url);
    familiesByScript[face.ranges.some(([a, b]) => a <= 0x0627 && b >= 0x0627) ? 'arabic' : 'latin'].add(f.family);
  }
}

t(`the budget was measured on every sitemap page (${pages.length})`, pages.length > 0);
t('every page is within its first-visit weight (homepage 500 KB, /catalog 450 KB, others 400 KB)', over.weight.length === 0, over.weight);
t(`no page makes more than ${BUDGET.requests} requests on a first visit`, over.requests.length === 0, over.requests);
t('no image a phone loads is over 100 KB (150 KB for a page\'s priority image)', over.image.length === 0, over.image);
t(`no more than ${BUDGET.familiesPerScript} web font families per script (Latin: ${[...familiesByScript.latin].join(', ') || 'none'}; Arabic: ${[...familiesByScript.arabic].join(', ') || 'none'})`,
  familiesByScript.latin.size <= BUDGET.familiesPerScript && familiesByScript.arabic.size <= BUDGET.familiesPerScript);
t(`font files per page within ${BUDGET.fontFiles.en} (English) and ${BUDGET.fontFiles.ar} (Arabic)`, over.fontFiles.length === 0, over.fontFiles);
t(`font bytes per page within ${BUDGET.fontBytes.en / KB} KB (English) and ${BUDGET.fontBytes.ar / KB} KB (Arabic)`, over.fontBytes.length === 0, over.fontBytes);

const heaviest = [...report].sort((a, b) => b.kb - a.kb).slice(0, 4).map((r) => `${r.url} ${r.kb} KB`).join(', ');
for (const w of warnings) console.log(`WARN  ${w}`);
console.log(`\nperformance-budget ${fail ? 'FAILED' : 'OK'} -- heaviest first visits: ${heaviest}.`);
if (process.argv.includes('--table')) console.table(report);
console.log(`\n${pass} passed, ${fail} failed${warnings.length ? `, ${warnings.length} warning(s)` : ''}`);
process.exit(fail ? 1 : 0);
