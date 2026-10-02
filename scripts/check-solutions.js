#!/usr/bin/env node
'use strict';

/*
 * The /solutions/ section: a hub and five buyer pages, in both languages.
 *
 *   node scripts/check-solutions.js        (part of `npm test`)
 *
 * Built 2026-10-02 from the owner's Solutions brief (C-136 to C-138) by
 * scripts/generate-solutions-pages.py. This holds what the brief required:
 *   - all twelve pages exist, each with its own title, description and
 *     canonical, an hreflang pair pointing at each other, and a breadcrumb
 *   - the Manufacturer and Local pages carry the owner-confirmed copy word
 *     for word (C-137, C-138), and the Manufacturer page also says the
 *     partner facility is not ours (C-36), so the two cannot drift apart
 *   - the confirmed Local card copy is on both homepages and both hubs, and
 *     the old flat "10-metric-ton minimum" card wording (C-133) is gone
 *   - every enquiry button goes to the shared /contact form with ?from=
 *     naming its own page, which assets/inquiry-form.js records
 *   - the hub links every buyer page, and private label to
 *     /resources/private-label, which still exists (no redirect was made)
 *   - all twelve are in the sitemap
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SITE = 'https://olivesegypt.com';
const SLUGS = ['', 'importer-distributor', 'retail', 'food-service', 'manufacturer', 'local-egypt'];

let pass = 0, fail = 0;
const t = (name, cond, extra) => {
  cond ? pass++ : fail++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : '   <-- ' + (extra === undefined ? '' : extra)}`);
};
const read = (rel) => { try { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); } catch (e) { return null; } };
const decode = (s) => s.replace(/&#x27;/g, "'").replace(/&amp;/g, '&').replace(/&mdash;/g, '—').replace(/&ndash;/g, '–');
const mainText = (html) => decode((html.match(/<main[\s\S]*<\/main>/) || [''])[0].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '));

const pages = [];
for (const loc of ['en', 'ar']) {
  for (const slug of SLUGS) {
    const route = (loc === 'ar' ? '/ar' : '') + '/solutions' + (slug ? '/' + slug : '');
    pages.push({ loc, slug, route, html: read(route.slice(1) + '/index.html') });
  }
}

const missing = pages.filter((p) => p.html === null).map((p) => p.route);
t('all twelve Solutions pages exist (hub and five buyer pages, both languages)', missing.length === 0, missing.join(', '));
const present = pages.filter((p) => p.html !== null);

const field = (html, re) => (html.match(re) || [])[1];
const seen = { title: new Set(), desc: new Set() };
const headProblems = [];
for (const p of present) {
  const title = field(p.html, /<title>([^<]*)<\/title>/);
  const desc = field(p.html, /<meta name="description" content="([^"]*)"/);
  const canon = field(p.html, /<link rel="canonical" href="([^"]*)"/);
  const twin = p.loc === 'ar' ? p.route.slice(3) : '/ar' + p.route;
  if (!title || seen.title.has(title)) headProblems.push(`${p.route}: title missing or shared`);
  if (!desc || seen.desc.has(desc)) headProblems.push(`${p.route}: description missing or shared`);
  seen.title.add(title); seen.desc.add(desc);
  if (canon !== SITE + p.route) headProblems.push(`${p.route}: canonical is ${canon}`);
  if (!p.html.includes(`hreflang="${p.loc === 'ar' ? 'en' : 'ar'}" href="${SITE}${twin}"`)) headProblems.push(`${p.route}: no hreflang to ${twin}`);
  if (!p.html.includes(`href="${twin}" hreflang=`)) headProblems.push(`${p.route}: the language switch does not lead to ${twin}`);
  if (!/"@type": "BreadcrumbList"/.test(p.html)) headProblems.push(`${p.route}: no breadcrumb`);
  if (/export-markets/.test(p.html.slice(0, p.html.indexOf('<body')))) headProblems.push(`${p.route}: the shell page's address is left in the head`);
}
t('each has its own title, description and canonical, an hreflang pair, a working language switch and a breadcrumb',
  headProblems.length === 0, headProblems.join('; '));

// ---- the owner-confirmed copy, verbatim ------------------------------------
const CONFIRMED = {
  'en manufacturer': [
    'We offer co-packing and OEM supply for buyers who repack, private-label, or process our product further.',
    'This is an active service we currently provide, not a theoretical capability.',
    'Our team works directly on custom brine formulation, specific caliber sorting, and private packaging and labeling requirements for OEM buyers, coordinating execution with our approved partner processing facility.',
    "If you need a specific formulation, sort, or private-label configuration for your own brand or further processing, tell us your requirements and we'll confirm feasibility, specification, and quotation.",
    'We do not own or operate a processing factory',
  ],
  'ar manufacturer': ['هذه خدمة فعلية نقدّمها حاليًا، وليست قدرة نظرية.', 'نحن لا نمتلك مصنع معالجة ولا نُشغّله'],
  'en local-egypt': [
    'We can supply local Egyptian buyers without export logistics.',
    'For bulk orders in 220kg barrels, the minimum order is 10 metric tons (approximately 45 barrels).',
    'For retail-ready formats — glass jar, tin, or bucket — the standard minimum applies, the same as our export container minimum of 16–18 metric tons.',
    'Pricing and delivery arrangements within Egypt are confirmed during quotation.',
  ],
  'ar local-egypt': ['الحد الأدنى للطلب 10 أطنان مترية (نحو 45 برميلًا)', '16–18 طنًا متريًا'],
};
for (const [key, sentences] of Object.entries(CONFIRMED)) {
  const [loc, slug] = key.split(' ');
  const p = present.find((x) => x.loc === loc && x.slug === slug);
  const text = p ? mainText(p.html) : '';
  const absent = sentences.filter((s) => !text.includes(s));
  t(`${loc === 'ar' ? '/ar' : ''}/solutions/${slug} carries the owner-confirmed copy word for word`, !!p && absent.length === 0,
    absent.map((s) => `"${s.slice(0, 60)}…"`).join('; '));
}

const CARD = {
  en: 'Local delivery-within-Egypt orders: 10-metric-ton minimum for bulk 220kg barrel orders; other packaging formats follow the standard 16–18 MT container minimum. Pricing confirmed during quotation.',
  ar: 'طلبات التسليم داخل مصر: حد أدنى 10 أطنان مترية لطلبات البراميل سعة 220 كجم بالجملة؛ وتتبع صيغ التغليف الأخرى الحد الأدنى القياسي للحاوية 16–18 طنًا متريًا. ويُؤكَّد التسعير أثناء عرض السعر.',
};
const cardMissing = [];
for (const [f, loc] of [['index.html', 'en'], ['ar/index.html', 'ar'], ['solutions/index.html', 'en'], ['ar/solutions/index.html', 'ar']]) {
  const h = read(f);
  if (!h || !decode(h).includes(CARD[loc])) cardMissing.push(f);
}
t('the confirmed Local card copy is on both homepages and both hubs', cardMissing.length === 0, cardMissing.join(', '));
const old = ['index.html', 'ar/index.html'].filter((f) => /Pricing in EGP from a 10-metric-ton minimum order|تسعير بالجنيه المصري بحد أدنى للطلب 10 أطنان/.test(read(f) || ''));
t('   and the old card wording, a flat 10-ton minimum for every format, is gone', old.length === 0, old.join(', '));

// ---- enquiries, links, sitemap ---------------------------------------------
const ctaProblems = [];
for (const p of present) {
  const main = (p.html.match(/<main[\s\S]*<\/main>/) || [''])[0];
  const pre = p.loc === 'ar' ? '/ar' : '';
  const own = new RegExp(`href="${pre}/contact\\?intent=(quote|local_pricing)&amp;from=${p.route.replace(/\//g, '\\/')}"`);
  if (!own.test(main)) ctaProblems.push(p.route);
  for (const m of main.matchAll(/href="([^"]*\/contact[^"]*)"/g)) {
    if (!m[1].includes(`from=${p.route}`)) ctaProblems.push(`${p.route} → ${m[1]}`);
  }
}
t("every enquiry button opens the shared contact form, naming its own Solutions page", ctaProblems.length === 0, ctaProblems.join('; '));
const form = read('assets/inquiry-form.js') || '';
t('   and the form records that page as the enquiry source', /function sourcePage\(\)/.test(form) && /payload\.source_page = sourcePage\(\);/.test(form));

const hubProblems = [];
for (const loc of ['en', 'ar']) {
  const pre = loc === 'ar' ? '/ar' : '';
  const hub = present.find((p) => p.loc === loc && p.slug === '');
  const main = hub ? (hub.html.match(/<main[\s\S]*<\/main>/) || [''])[0] : '';
  for (const r of [...SLUGS.filter(Boolean).map((s) => `${pre}/solutions/${s}`), `${pre}/resources/private-label`]) {
    if (!main.includes(`href="${r}"`)) hubProblems.push(`${pre}/solutions → ${r}`);
  }
  if (read(`${pre.slice(1)}${pre ? '/' : ''}resources/private-label/index.html`) === null) hubProblems.push(`${pre}/resources/private-label no longer exists`);
}
t('each hub links all five buyer pages, and private label to /resources/private-label, which still exists',
  hubProblems.length === 0, hubProblems.join('; '));

const sitemap = read('sitemap.xml') || '';
const notInSitemap = pages.filter((p) => !sitemap.includes(`<loc>${SITE}${p.route}</loc>`)).map((p) => p.route);
t('all twelve are in the sitemap', notInSitemap.length === 0, notInSitemap.join(', '));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
