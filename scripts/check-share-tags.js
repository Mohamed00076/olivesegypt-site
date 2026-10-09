#!/usr/bin/env node
'use strict';

/*
 * Every indexed page tells a link preview what to show: the Open Graph tags
 * (Facebook, WhatsApp, LinkedIn) and the X/Twitter tags, the same title,
 * description and image in both.
 *
 *   node scripts/check-share-tags.js        (part of `npm test`)
 *
 * On 2026-10-09, 56 indexed pages -- most of the Arabic site, the ten English
 * product pages and the English company profile -- carried the Open Graph
 * tags but none of the twitter: ones, so a link shared on X from them got
 * the small plain card. They now carry twitter:card (summary_large_image),
 * twitter:title, twitter:description and twitter:image, copied from the
 * page's og: tags; the product generator writes them, and the solutions
 * generator fills them from its Arabic and English shells.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SKIP = new Set(['node_modules', '.git', 'netlify', 'scripts', 'assets', 'docs', 'admin', 'crm']);

function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) { if (!SKIP.has(e.name) && !e.name.startsWith('.')) walk(path.join(dir, e.name), out); }
    else if (e.name === 'index.html') out.push(path.join(dir, e.name));
  }
  return out;
}

const meta = (html, attr, key) => {
  const m = html.match(new RegExp(`<meta ${attr}="${key}" content="([^"]*)"`));
  return m ? m[1] : null;
};

const problems = [];
let checked = 0;
for (const file of walk(ROOT, []).sort()) {
  const html = fs.readFileSync(file, 'utf8');
  if (/<meta name="robots" content="[^"]*noindex/.test(html)) continue;
  const rel = path.relative(ROOT, file);
  checked++;
  for (const [og, tw] of [['og:title', 'twitter:title'], ['og:description', 'twitter:description'], ['og:image', 'twitter:image']]) {
    const a = meta(html, 'property', og);
    const b = meta(html, 'name', tw);
    if (a === null) problems.push(`${rel}: no ${og}`);
    else if (b === null) problems.push(`${rel}: no ${tw}`);
    else if (a !== b) problems.push(`${rel}: ${tw} differs from ${og}`);
  }
  if (meta(html, 'name', 'twitter:card') !== 'summary_large_image') problems.push(`${rel}: twitter:card is not summary_large_image`);
}

if (problems.length) {
  console.error(`share-tags: ${problems.length} problem(s):\n  ` + problems.join('\n  '));
  process.exit(1);
}
console.log(`share-tags OK -- all ${checked} indexed pages carry Open Graph and X tags with the same title, description and image.`);
