#!/usr/bin/env node
'use strict';

/*
 * Every page in the sitemap can be reached by a link from another page.
 *
 *   node scripts/check-inbound-links.js        (part of `npm test`)
 *
 * On 2026-10-10 the new Pickled Vegetables page was reachable only by URL
 * until it was put in the menu ("if it took me time to find it how do you
 * expect visitors to?"). A sweep the next day found the Resources overview,
 * /resources and /ar/resources, in the same state since it was built: the only
 * link to each was the other's language switch. It is now the first item of
 * the Resources menu, as All Products is of Products.
 *
 * This fails when a sitemap page has no <a href> to it from any other page
 * except its own other-language twin (a language switch is not a way in).
 * Header, footer and body links all count; <link> tags (canonical, hreflang)
 * do not.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const norm = (h) => {
  let u = h.split('#')[0].split('?')[0];
  if (u.startsWith('https://olivesegypt.com')) u = u.slice('https://olivesegypt.com'.length) || '/';
  if (u.length > 1) u = u.replace(/\/+$/, '');
  return u;
};
const fileOf = (u) => path.join(ROOT, u === '/' ? 'index.html' : u.slice(1) + '/index.html');
const twin = (u) => (u === '/ar' ? '/' : u.startsWith('/ar/') ? u.slice(3) : u === '/' ? '/ar' : '/ar' + u);

const urls = [...fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8').matchAll(/<loc>https:\/\/olivesegypt\.com([^<]*)<\/loc>/g)]
  .map((m) => norm(m[1] || '/'));
const from = new Map(urls.map((u) => [u, new Set()]));
for (const u of urls) {
  const html = fs.readFileSync(fileOf(u), 'utf8');
  for (const m of html.matchAll(/<a\b[^>]*\bhref="([^"]+)"/g)) {
    const t = norm(m[1]);
    if (t !== u && from.has(t)) from.get(t).add(u);
  }
}

const problems = urls.filter((u) => ![...from.get(u)].some((src) => src !== twin(u)))
  .map((u) => `${u}: no page links to it${from.get(u).size ? ` (only its language twin, ${[...from.get(u)].join(', ')})` : ''}`);
if (problems.length) {
  console.error(`inbound-links: ${problems.length} page(s) a visitor cannot reach by a link:\n  ` + problems.join('\n  '));
  process.exit(1);
}
const fewest = urls.map((u) => [u, from.get(u).size]).sort((a, b) => a[1] - b[1])[0];
console.log(`inbound-links OK -- all ${urls.length} sitemap pages are linked from another page (fewest: ${fewest[0]}, from ${fewest[1]}).`);
