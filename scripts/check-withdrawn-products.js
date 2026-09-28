#!/usr/bin/env node
'use strict';

/*
 * A withdrawn product is gone from everything a visitor or buyer can see.
 *
 *   node scripts/check-withdrawn-products.js        (part of `npm test`)
 *
 * On 2026-09-28 the owner withdrew Hamed Green Olives ("not confirmed
 * available") and asked for it to be removed "from the product list and from
 * any document and page on this website". It was in about seventy files: the
 * product pages, both catalogues, the print catalogues, the spec-sheet list,
 * the forms, the company profile, the private-label pages, page metadata on
 * eighteen pages, four gated guides, both catalogue PDF sources, llms.txt and
 * the sitemap. A product that comes back in one of those by copy and paste
 * would be offered again without anyone deciding to.
 *
 * For each product in WITHDRAWN (scripts/product-order.js) this fails if:
 *   - any published file names it (whole word, English or Arabic): pages,
 *     the gated guides and catalogue PDF sources, llms.txt, the sitemap and
 *     public scripts. The CRM's own code is exempt: it keeps the product as a
 *     withdrawn tag on records that already carry it.
 *   - a page or image for it still exists
 *   - its old addresses do not answer 410 in netlify.toml
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { WITHDRAWN } = require('./product-order');

const ROOT = path.join(__dirname, '..');
let pass = 0, fail = 0;
const t = (name, cond, extra) => {
  cond ? pass++ : fail++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : '   <-- ' + (extra === undefined ? '' : extra)}`);
};

const tracked = execSync('git ls-files', { cwd: ROOT }).toString().split('\n').filter(Boolean);
// What is published or handed to a buyer. docs/ and scripts/ are pruned from
// the site, except the two catalogue PDF sources, which are what the PDFs say.
const EXEMPT = new Set(['assets/crm.js']);
const published = tracked.filter((f) =>
  (/\.(html|txt|xml|js|json|webmanifest)$/.test(f) &&
    !f.startsWith('docs/') && !f.startsWith('scripts/') && !f.startsWith('crm/') &&
    !f.startsWith('admin/') && !(f.startsWith('netlify/') && !f.startsWith('netlify/functions/_guides/')) &&
    !/^[^/]+\.md$/.test(f) && !EXEMPT.has(f) && f !== 'package.json' && f !== 'package-lock.json') ||
  /^scripts\/export-catalog-source(-ar)?\.html$/.test(f));

const toml = fs.readFileSync(path.join(ROOT, 'netlify.toml'), 'utf8');

for (const w of WITHDRAWN) {
  const word = new RegExp(`(^|[^\\p{L}])(${w.names.join('|')})(?![\\p{L}])|${w.dir}|olive-${w.key}-`, 'iu');
  const named = [];
  for (const f of published) {
    const text = fs.readFileSync(path.join(ROOT, f), 'utf8');
    const m = text.match(word);
    if (m) {
      const line = text.slice(0, m.index).split('\n').length;
      named.push(`${f}:${line}`);
    }
  }
  t(`${w.dir}: no page, guide, catalogue source, sitemap or public script names it (${published.length} files)`,
    named.length === 0, named.join(', '));

  const leftovers = tracked.filter((f) =>
    f.startsWith(`products/${w.dir}/`) || f.startsWith(`ar/products/${w.dir}/`) || f.startsWith(`assets/olive-${w.key}-`));
  t(`${w.dir}: no page or image for it remains`, leftovers.length === 0, leftovers.join(', '));

  for (const from of [`/products/${w.dir}`, `/ar/products/${w.dir}`]) {
    const rule = toml.split('[[redirects]]').find((b) => b.includes(`from = "${from}"`)) || '';
    t(`${from} answers 410 Gone`, /status = 410/.test(rule) && /force = true/.test(rule), rule.trim() || 'no rule');
  }
}

const ok = fail === 0;
console.log(`\nwithdrawn-products ${ok ? 'OK' : 'FAILED'} -- ${WITHDRAWN.map((w) => w.dir).join(', ')} gone from every public surface.`);
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(ok ? 0 : 1);
