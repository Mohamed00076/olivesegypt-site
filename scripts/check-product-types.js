#!/usr/bin/env node
'use strict';

/*
 * The range is sold by olive type, never by cultivar, and never Kalamata.
 *
 *   node scripts/check-product-types.js        (part of `npm test`)
 *
 * Owner decisions, 2026-10-10 (scripts/products.js): we supply green,
 * stuffed green, natural black and oxidized black olives, each in fixed
 * forms; cultivars are not products; Kalamata is not supplied. Before that
 * day the site sold Aggizi, Toffahi, Manzanilla and Kalamata as products,
 * on about 120 files and 28 PDFs, so a copied paragraph or an old card can
 * bring a cultivar back as an offer without anyone deciding to. This fails
 * when one does:
 *
 *   1. a cultivar name (English or Arabic, as written on this site) appears
 *      in published content outside CULTIVAR_PAGES, where it may appear only
 *      as a general fact; and Kalamata appears anywhere published. Redirect
 *      config, internal docs and the CRM's legacy tags are not published
 *      content. File names count too: an image called olive-aggizi.jpg names
 *      a cultivar in the page source.
 *   2. on a CULTIVAR_PAGE, a sentence names a cultivar and also uses supply
 *      wording ("we offer", "our range", "available", "we supply", and the
 *      Arabic equivalents). A heuristic: every hit fails and is listed for
 *      the owner to review; nothing is waved through.
 *   3. a type page states a form its type is not supplied in: pitted or
 *      sliced natural black olives, stuffed with any black olive, or format
 *      chips that differ from the forms matrix.
 *   4. a page states a product count other than the one in products.js
 *      (the old "10 varieties", "ten products", "nine of our ten").
 *
 * Retired addresses are held by check-retired-routes.js; Hamed by
 * check-withdrawn-products.js.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const P = require('./products');

const ROOT = path.join(__dirname, '..');
const problems = [];
const say = (m) => problems.push(m);

const tracked = execSync('git ls-files', { cwd: ROOT }).toString().split('\n').filter(Boolean)
  .filter((f) => fs.existsSync(path.join(ROOT, f)));
// What is published or handed to a buyer (same rule as check-withdrawn-products).
const EXEMPT = new Set(['assets/crm.js']); // the CRM's legacy tags for old records
const published = tracked.filter((f) =>
  (/\.(html|txt|xml|js|json|webmanifest)$/.test(f) &&
    !f.startsWith('docs/') && !f.startsWith('scripts/') && !f.startsWith('crm/') &&
    !f.startsWith('admin/') && !(f.startsWith('netlify/') && !f.startsWith('netlify/functions/_guides/')) &&
    !/^[^/]+\.md$/.test(f) && !EXEMPT.has(f) && f !== 'package.json' && f !== 'package-lock.json') ||
  /^scripts\/export-catalog-source(-ar)?\.html$/.test(f));

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Arabic names may carry the article (العجيزي) or a conjunction (والتفاحي).
const nameRe = (list) => new RegExp(list.map((n) => /[؀-ۿ]/.test(n)
  ? `(?<![\\u0600-\\u06ff])(?:و?ال|و)?${esc(n)}(?![\\u0600-\\u06ff])`
  : `\\b${esc(n)}\\b`).join('|'), 'iu');
const CULTIVAR = nameRe(P.CULTIVARS.flatMap((c) => [c.en, c.ar]));
const NEVER = nameRe(P.NEVER_NAMED.flatMap((c) => [c.en, c.ar]));
const allowed = new Set(P.CULTIVAR_PAGES.flatMap((d) => [`${d}/index.html`]));
const lineOf = (s, i) => s.slice(0, i).split('\n').length;

// ---- 1. names -------------------------------------------------------------
for (const f of published) {
  const s = fs.readFileSync(path.join(ROOT, f), 'utf8');
  const k = s.match(NEVER);
  if (k) say(`${f}:${lineOf(s, k.index)} names Kalamata ("${k[0]}"), which is not supplied`);
  if (!allowed.has(f)) {
    const c = s.match(CULTIVAR);
    if (c) say(`${f}:${lineOf(s, c.index)} names a cultivar ("${c[0]}") outside the cultivar reference pages`);
  }
}
for (const f of tracked) {
  if (f.startsWith('docs/') || f.startsWith('scripts/')) continue;
  if (/aggizi|toffahi|manzanilla|kalamata/i.test(path.basename(f))) say(`${f}: the file name names a cultivar or Kalamata`);
}

// ---- 2. supply wording next to a cultivar, on the allowed pages ----------
const SUPPLY = /\b(we (?:offer|supply|export|stock)|our (?:range|products?|varieties)|available|in stock)\b|نورّد|نورد|نوفّر|نوفر|نقدّم|نقدم|تشكيلتنا|منتجاتنا|متاح|متوفر/iu;
const visible = (html) => (html.match(/<main\b[\s\S]*?<\/main>/) || [''])[0]
  .replace(/<(script|style|svg)\b[\s\S]*?<\/\1>/g, ' ')
  .replace(/<\/(p|li|h\d|td|th|div|section)>/g, '\n').replace(/<[^>]+>/g, ' ')
  .replace(/&[a-z]+;|&#x?[0-9a-f]+;/gi, ' ');
for (const f of allowed) {
  if (!fs.existsSync(path.join(ROOT, f))) { say(`${f}: cultivar reference page is missing`); continue; }
  const html = fs.readFileSync(path.join(ROOT, f), 'utf8');
  for (const sentence of visible(html).split(/(?<=[.!?؟])\s+|\n+/)) {
    if (CULTIVAR.test(sentence) && SUPPLY.test(sentence)) {
      say(`${f}: names a cultivar with supply wording -- for the owner to review: "${sentence.trim().replace(/\s+/g, ' ')}"`);
    }
  }
}

// ---- 3. the forms matrix on the type pages --------------------------------
const W = P.FORM_WORDS;
const noRelated = (html) => {
  // The related-products section names other products ("Sliced Jalapeño
  // Peppers"); everything else on the page is held to the matrix.
  const main = (html.match(/<main\b[\s\S]*?<\/main>/) || [''])[0];
  return main.replace(/<section>\s*<h2[^>]*>(?:Related Products|منتجات ذات صلة)<\/h2>[\s\S]*?<\/section>/, ' ');
};
const META = (html) => [...html.matchAll(/<meta (?:name|property)="(?:description|og:description|twitter:description)" content="([^"]*)"/g)].map((m) => m[1]).join(' ')
  + ' ' + [...html.matchAll(/"description": "([^"]*)"/g)].map((m) => m[1]).join(' ');
const FORM_RE = {
  pitted: /\bpitted\b|منزوع النواة|منزوعة النواة/iu,
  sliced: /\bsliced\b|(?<![؀-ۿ])مقطع|مقطّع|مقطعة|مقطعًا/iu,
  stuffed: /\bstuffed\b|محشو/iu,
};
for (const p of P.PRODUCTS.filter((x) => P.FORMS[x.key])) {
  for (const [pre, lang] of [['', 'en'], ['ar/', 'ar']]) {
    const f = `${pre}products/${p.dir}/index.html`;
    const html = fs.readFileSync(path.join(ROOT, f), 'utf8');
    const text = noRelated(html) + ' ' + META(html);
    const forms = P.FORMS[p.key];
    if (p.category === 'black') {
      for (const form of ['pitted', 'sliced', 'stuffed']) {
        if (!forms.includes(form) && FORM_RE[form].test(text)) say(`${f}: states "${form}" for ${p.en}, which is supplied ${forms.join(', ')} only`);
      }
    }
    // the format chips are exactly the matrix (stuffed: the fillings)
    const row = html.match(/<th scope="row">(?:Available Formats|الصيغ المتاحة)<\/th><td>([\s\S]*?)<\/td>/);
    const chips = row ? [...row[1].matchAll(/<span class="tc-chip">([^<]*)<\/span>/g)].map((m) => m[1].trim()) : [];
    const want = p.key === 'stuffed'
      ? (lang === 'en' ? P.FILLINGS.en.map((x) => x[0].toUpperCase() + x.slice(1)) : ['فلفل', 'جزر'])
      : forms.map((x) => W[x][lang]);
    if (JSON.stringify([...chips].sort()) !== JSON.stringify([...want].sort())) {
      say(`${f}: format chips are [${chips.join(', ')}], the forms matrix says [${want.join(', ')}]`);
    }
  }
}
// No page anywhere offers a stuffed black olive (a statement that black
// olives are NOT stuffed is fine).
const STUFFED_BLACK = /\bstuffed (?:natural |oxidi[sz]ed )?black\b|\bblack olives?,? stuffed\b|(?:أسود|سوداء) محشو|محشو(?:ة)? (?:أسود|سوداء)/iu;
const NEG = /\bnot\b|\bnever\b|(?<![؀-ۿ])(?:لا|لن|ليس|غير)(?![؀-ۿ])/u;
for (const f of published.filter((x) => x.endsWith('.html'))) {
  const t = visible(fs.readFileSync(path.join(ROOT, f), 'utf8'));
  for (const sentence of t.split(/(?<=[.!?؟])\s+|\n+/)) {
    if (STUFFED_BLACK.test(sentence) && !NEG.test(sentence)) say(`${f}: offers a stuffed black olive: "${sentence.trim().replace(/\s+/g, ' ')}"`);
  }
}

// ---- 4. product counts -----------------------------------------------------
const N = P.COUNT;
const WORD = { 7: ['seven', 'سبعة', 'السبعة'] }[N] || [];
const COUNT_RE = /\b(\d+|ten|nine|eleven|eight|six|seven)\s+(products?|product varieties|varieties)\b|\bnine of (?:our|the) ten\b|(\d+|[٠-٩]+)\s+(?:منتجات|أصناف)|(عشرة|تسعة|أحد عشر|ثمانية|ستة|سبعة)\s+منتجات|منتجاتنا\s+(العشرة|التسعة|السبعة)|المنتجات\s+(العشرة|التسعة|السبعة)/giu;
for (const f of published.filter((x) => /\.(html|txt)$/.test(x))) {
  const s = fs.readFileSync(path.join(ROOT, f), 'utf8');
  for (const m of s.matchAll(COUNT_RE)) {
    const raw = m[0];
    const num = (m[1] || m[3] || '').replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
    const word = (m[1] || m[4] || m[5] || m[6] || '').toLowerCase();
    const ok = num === String(N) || WORD.includes(word);
    // "4 olive types" style statements and unrelated numbers ("2 products"
    // in a cart) are not range counts; only flag counts of the range.
    if (!ok) say(`${f}:${lineOf(s, m.index)} states a product count "${raw}"; the range is ${N} (scripts/products.js)`);
  }
}

if (problems.length) {
  console.error(`product-types: ${problems.length} problem(s):\n  ` + problems.join('\n  '));
  process.exit(1);
}
console.log(`product-types OK -- ${published.length} published files: no cultivar named outside ${allowed.size} reference pages, Kalamata nowhere, no cultivar sentence with supply wording, every type page matches the forms matrix, no stuffed black olive offered, and every product count is ${N}.`);
