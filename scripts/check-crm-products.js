#!/usr/bin/env node
'use strict';

/*
 * The CRM can tag a buyer with every product the website sells -- and only
 * those.
 *
 *   node scripts/check-crm-products.js        (part of `npm test`)
 *
 * Kalamata was removed from the site on 2026-09-01 and from the CRM with it.
 * It came back on the site on 2026-09-05, approved field by field (C-01 to
 * C-09), and the CRM was never told: its two product lists stayed at ten, so
 * staff could not tag a Kalamata buyer or put Kalamata on a document, while
 * the public contact form was offering it to buyers.
 *
 * The site's product set is scripts/product-order.js (one entry per page
 * under /products/). This fails if either CRM list -- the server's in
 * crm-buyers.js or the pages' in assets/crm.js -- has a product the site does
 * not, or lacks one it does, or if a CRM label is not the heading of that
 * product's own page.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

let pass = 0, fail = 0;
const t = (name, cond, extra) => {
  cond ? pass++ : fail++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : '   <-- ' + (extra === undefined ? '' : extra)}`);
};

const { DIRS } = require('./product-order');
const site = new Set(DIRS);

const onDisk = fs.readdirSync(path.join(ROOT, 'products'))
  .filter((d) => fs.existsSync(path.join(ROOT, 'products', d, 'index.html')));
t('the canonical product list is exactly the product pages on the site',
  onDisk.length === site.size && onDisk.every((d) => site.has(d)),
  `pages: ${onDisk.sort().join(', ')}`);

process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://stub';
const server = require(path.join(ROOT, 'netlify/functions/crm-buyers.js')).PRODUCTS;

const sandbox = { window: {}, document: { addEventListener() {}, readyState: 'complete' } };
vm.createContext(sandbox);
try { vm.runInContext(read('assets/crm.js'), sandbox); } catch (e) { /* page wiring needs a DOM */ }
const pages = ((sandbox.window.CRM || {}).PRODUCTS || []);

const compare = (label, list) => {
  const missing = [...site].filter((d) => !list.includes(d));
  const extra = list.filter((d) => !site.has(d));
  t(`${label} holds every product on the site`, missing.length === 0, `missing: ${missing.join(', ')}`);
  t(`${label} holds nothing the site does not sell`, extra.length === 0, `extra: ${extra.join(', ')}`);
  t(`${label} lists each product once`, new Set(list).size === list.length, list.join(', '));
};
compare('the server\'s list (crm-buyers.js)', server);
compare('the pages\' list (assets/crm.js)', pages.map((p) => p[0]));

t('Kalamata can be tagged, specifically', server.includes('kalamata-olives') && pages.some((p) => p[0] === 'kalamata-olives'));

const wrong = pages.filter(([dir, label]) => {
  if (!site.has(dir)) return false;
  const m = read(`products/${dir}/index.html`).match(/<h1[^>]*>([^<]*)/);
  return !m || m[1].trim() !== label;
}).map(([dir, label]) => `${dir}: CRM says "${label}"`);
t('every CRM product label is the heading of that product\'s page', wrong.length === 0, wrong.join('; '));

t('the stale "Kalamata excluded" note is gone from the CRM',
  !/Kalamata excluded per Rule 12/.test(read('netlify/functions/crm-buyers.js')));

const ok = fail === 0;
console.log(`\ncrm-products ${ok ? 'OK' : 'FAILED'} -- the CRM can tag every product the site sells, and only those.`);
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(ok ? 0 : 1);
