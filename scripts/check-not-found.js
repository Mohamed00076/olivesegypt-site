#!/usr/bin/env node
'use strict';

/*
 * An address that does not exist answers 404, and no link on the site leads
 * to one.
 *
 *   node scripts/check-not-found.js        (part of `npm test`)
 *
 * netlify.toml ended with an SPA fallback, `/*` to /index.html with a 200,
 * left from before the site became static pages. Every mistyped or retired
 * address returned the homepage as a success -- a soft 404 that hid broken
 * links from the owner and from search engines (system health audit, run 1,
 * B5). It is gone: Netlify now answers anything with no file and no rule with
 * /404.html and a real 404.
 *
 * That makes a broken internal link visible to visitors, so this also crawls
 * every link on every page -- including the gated guides -- and resolves it
 * the way Netlify does: forced rules first, then a file, then other rules.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

let pass = 0, fail = 0;
const t = (name, cond, extra) => {
  cond ? pass++ : fail++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : '   <-- ' + (extra === undefined ? '' : extra)}`);
};
const show = (l) => `${l.length}: ${l.slice(0, 6).join(' | ')}${l.length > 6 ? ' …' : ''}`;

// ---- the rules -------------------------------------------------------------------
const toml = read('netlify.toml');
const rules = toml.split('[[redirects]]').slice(1).map((b) => ({
  from: (b.match(/from\s*=\s*"([^"]+)"/) || [])[1],
  to: (b.match(/to\s*=\s*"([^"]+)"/) || [])[1],
  status: (b.match(/status\s*=\s*(\d+)/) || [, '301'])[1],
  force: /force\s*=\s*true/.test(b),
})).filter((r) => r.from);

t('there is no catch-all rule', !rules.some((r) => r.from === '/*'),
  'a /* rule turns every unknown address into a success -- the soft 404 this check exists to prevent');
const notFoundRules = rules.filter((r) => r.status === '404' || r.status === '410');
const wrongBody = notFoundRules.filter((r) => r.to !== '/404.html');
t(`every 404 and 410 rule shows the not-found page, not the homepage (${notFoundRules.length})`, wrongBody.length === 0,
  show(wrongBody.map((r) => `${r.from} -> ${r.to}`)));

// ---- the page --------------------------------------------------------------------
const page = fs.existsSync(path.join(ROOT, '404.html')) ? read('404.html') : '';
t('404.html exists at the publish root, where Netlify looks for it', !!page);
t('   it is not indexed', /<meta name="robots" content="noindex, follow"/.test(page));
t('   it claims no canonical address, alternates or structured data',
  !/rel="canonical"|rel="alternate"|application\/ld\+json/.test(page));
t('   it says what happened, in English and Arabic', /<h1[^>]*>Page not found<\/h1>/.test(page) && /lang="ar" dir="rtl"/.test(page) && /الصفحة غير موجودة/.test(page));
// The same three ways on in each language: homepage, catalogue, contact. The
// Arabic block offered only its homepage until the owner asked, on
// 2026-09-28, for it to match the English.
const arBlock = (page.match(/<div lang="ar" dir="rtl"[\s\S]*?<\/a><\/div><\/div>/) || [''])[0];
const enBlock = arBlock ? page.slice(page.indexOf('<main'), page.indexOf(arBlock)) : page;
const waysOn = (html, pre) => ['', 'catalog', 'contact'].map((r) => `${pre}/${r}`)
  .filter((href) => !html.includes(`href="${href}"`));
const enMissing = waysOn(enBlock, ''), arMissing = waysOn(arBlock, '/ar');
t('   and offers the homepage, catalogue and contact in each language, in that language',
  enMissing.length === 0 && arMissing.length === 0, [...enMissing, ...arMissing].join(', '));
t('   every asset and link it uses is absolute, so it works at any depth',
  ![...page.matchAll(/(?:href|src)="([^"#]+)"/g)].map((m) => m[1]).some((u) => !/^(\/|https?:|mailto:|tel:|data:)/.test(u)),
  [...page.matchAll(/(?:href|src)="([^"#]+)"/g)].map((m) => m[1]).filter((u) => !/^(\/|https?:|mailto:|tel:|data:)/.test(u)).slice(0, 4).join(', '));

// ---- every internal link resolves ---------------------------------------------------
const exists = (p) => {
  const full = path.join(ROOT, decodeURIComponent(p).replace(/^\//, ''));
  return (fs.existsSync(full) && fs.statSync(full).isFile()) || fs.existsSync(path.join(full, 'index.html'));
};
const match = (from, p) => (from.endsWith('*') ? p.startsWith(from.slice(0, -1)) : p.replace(/\/$/, '') === from.replace(/\/$/, ''));
function resolve(p) {
  for (const r of rules) if (r.force && match(r.from, p)) return r.status;
  if (exists(p)) return 'file';
  for (const r of rules) if (!r.force && match(r.from, p)) return r.status;
  return '404';
}
const pages = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    const rel = path.relative(ROOT, full);
    if (e.isDirectory()) {
      if (['node_modules', '.git', 'docs', 'scripts', 'geo'].includes(e.name)) continue;
      if (rel.startsWith('netlify') && !rel.startsWith(path.join('netlify', 'functions', '_guides')) && rel !== 'netlify' && rel !== path.join('netlify', 'functions')) continue;
      walk(full);
    } else if (e.name.endsWith('.html')) pages.push(rel);
  }
})(ROOT);
let links = 0;
const broken = [];
for (const rel of pages) {
  for (const m of read(rel).matchAll(/(?:href|src|action)="([^"]+)"/g)) {
    let u = m[1].replace(/&amp;/g, '&');
    if (u.startsWith('https://olivesegypt.com')) u = u.slice('https://olivesegypt.com'.length) || '/';
    if (!u.startsWith('/') || u.startsWith('//')) continue;
    const p = u.split('#')[0].split('?')[0] || '/';
    links++;
    const r = resolve(p);
    if (r === '404' || r === '410') broken.push(`${rel} -> ${p} (${r})`);
  }
}
t(`every internal link on ${pages.length} pages resolves (${links} links)`, pages.length > 100 && links > 5000 && broken.length === 0, show(broken));

// ---- the bare product folder goes to the catalogue ----------------------------------
// /products and /ar/products have no page; since 2026-10-02 they redirect to the
// catalogue rather than answering 404. The ten product pages beneath them must
// still be served from their own files.
const target = (p) => (rules.find((r) => r.force && match(r.from, p)) || {}).to;
const bare = [['/products', '/catalog'], ['/products/', '/catalog'], ['/ar/products', '/ar/catalog'], ['/ar/products/', '/ar/catalog']]
  .filter(([p, to]) => resolve(p) !== '301' || target(p) !== to).map(([p]) => p);
t('/products and /ar/products redirect permanently to the catalogue', bare.length === 0, bare.join(', '));
const productDirs = ['products', 'ar/products'].flatMap((d) => fs.readdirSync(path.join(ROOT, d)).map((s) => `/${d}/${s}`));
const notServed = productDirs.filter((p) => resolve(p) !== 'file' && resolve(p) !== '410');
t(`   while every product page beneath them is still served (${productDirs.length})`, productDirs.length >= 20 && notServed.length === 0, notServed.join(', '));

const ok = fail === 0;
console.log(`\nnot-found ${ok ? 'OK' : 'FAILED'} -- an unknown address answers 404, and no link on the site leads to one.`);
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(ok ? 0 : 1);
