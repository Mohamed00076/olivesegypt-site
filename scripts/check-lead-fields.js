#!/usr/bin/env node
'use strict';

/*
 * The shared lead endpoint, exercised through the private-label brief.
 *
 *   node scripts/check-lead-fields.js        (part of `npm test`)
 *
 * Runs offline: the database driver is stubbed, so leads.js is exercised
 * without a connection string and nothing leaves the machine.
 *
 * Part D added one field to this endpoint -- incoterm -- and one consumer,
 * the private-label brief on /resources/private-label. Both carry a specific
 * risk worth pinning down:
 *
 *   1. The endpoint rejects any key outside its allow list. A field rendered
 *      on the page but never added to that list does not degrade -- the whole
 *      submission 400s and the visitor loses everything they typed. So every
 *      data-field the page renders is checked against what the endpoint
 *      accepts, from the real HTML, in both locales.
 *
 *   2. leads_staging already exists in the deployed database, and
 *      CREATE TABLE IF NOT EXISTS will not add a column to an existing table.
 *      Without an explicit ALTER, incoterm would be accepted by the
 *      validation, written into the INSERT, and fail at the database.
 *
 * Also checked: the honeypot still suppresses the write, consent is still
 * mandatory, and an unknown segment is still refused -- the private-label
 * form must not have loosened any of that.
 */

const fs = require('fs');
const path = require('path');
const Module = require('module');

const ROOT = path.join(__dirname, '..');
const FN = path.join(ROOT, 'netlify', 'functions');

// ---- stub the database driver before anything requires it ----------------
const neonId = require.resolve('@neondatabase/serverless');
let queries = [];
function fakeSql(strings) {
  const text = Array.isArray(strings) ? strings.join('?') : String(strings);
  queries.push(text);
  return Promise.resolve(/count\(/i.test(text) ? [{ n: 0 }] : []);
}
require.cache[neonId] = new Module(neonId, null);
require.cache[neonId].filename = neonId;
require.cache[neonId].loaded = true;
require.cache[neonId].exports = { neon: () => fakeSql };

process.env.DATABASE_URL = 'postgres://stub/stub';
const leads = require(path.join(FN, 'leads.js'));

let pass = 0, fail = 0;
const t = (name, cond, extra) => {
  cond ? pass++ : fail++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : '   <-- ' + (extra === undefined ? '' : extra)}`);
};

const BASE = {
  email: 'buyer@example.com',
  company_name: 'Example Import BV',
  country_region: 'Netherlands',
  buyer_type: 'importer',
  consent: true,
  source_page: '/resources/private-label',
  segment: 'private_label',
};

async function post(body) {
  queries = [];
  const res = await leads.handler({
    httpMethod: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': '198.51.100.7' },
    body: JSON.stringify(body),
  });
  let data = {};
  try { data = JSON.parse(res.body); } catch (e) { /* leave empty */ }
  return { status: res.statusCode, data, queries: queries.slice() };
}

(async () => {
  // ---- 1. the fields the page renders are the fields the endpoint takes --
  const FIELD_RE = /data-field="([a-z_]+)"/g;
  for (const file of ['resources/private-label/index.html', 'ar/resources/private-label/index.html']) {
    const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
    const form = html.slice(html.indexOf('data-lead-form='));
    const rendered = [...new Set([...form.matchAll(FIELD_RE)].map((m) => m[1]))];

    // named explicitly rather than counted: a count passes just as happily
    // when one field is swapped for another
    const EXPECTED = ['email', 'company_name', 'country_region', 'buyer_type', 'variety',
                      'format', 'volume', 'target_market', 'certification_requirements',
                      'incoterm', 'website', 'consent'];
    const missing = EXPECTED.filter((f) => !rendered.includes(f));
    const extra = rendered.filter((f) => !EXPECTED.includes(f));
    t(`${file}: renders exactly the brief's ${EXPECTED.length} fields`,
      !missing.length && !extra.length,
      `missing ${missing.join(',') || 'none'}; unexpected ${extra.join(',') || 'none'}`);

    // 'website' is the honeypot; every other rendered field must be accepted
    const body = { ...BASE };
    for (const f of rendered) {
      if (f === 'website' || f === 'consent') continue;
      if (!(f in body)) body[f] = 'x';
    }
    const out = await post(body);
    t(`${file}: every rendered field is accepted by the endpoint`,
      out.status === 200 && out.data.ok === true,
      `${out.status} ${JSON.stringify(out.data)}`);
  }

  // ---- 2. a field the endpoint does not know is refused outright ---------
  //
  // This is the failure mode the check above exists to prevent: not a
  // silently dropped value, but a 400 that loses the whole submission.
  {
    const out = await post({ ...BASE, preferred_port: 'Rotterdam' });
    t('an unknown field is refused, not silently dropped',
      out.status === 400 && (out.data.fields || []).includes('preferred_port'),
      `${out.status} ${JSON.stringify(out.data)}`);
  }

  // ---- 3. incoterm actually reaches the database -------------------------
  {
    const out = await post({ ...BASE, incoterm: 'FOB Alexandria' });
    const insert = out.queries.find((q) => /INSERT INTO leads_staging/i.test(q));
    t('incoterm is written by the INSERT', !!insert && /incoterm/.test(insert),
      insert ? insert.replace(/\s+/g, ' ').slice(0, 140) : 'no INSERT ran');

    // CREATE TABLE IF NOT EXISTS is a no-op against the table that is already
    // deployed, so the column needs its own statement or every private-label
    // brief fails at the database.
    const alter = out.queries.find((q) => /ALTER TABLE leads_staging/i.test(q));
    t('the column is added to the existing table, not only to CREATE TABLE',
      !!alter && /ADD COLUMN IF NOT EXISTS\s+incoterm/i.test(alter),
      alter ? alter.replace(/\s+/g, ' ') : 'no ALTER ran');
  }

  // ---- 4. the protections the guide forms rely on still hold -------------
  {
    const out = await post({ ...BASE, website: 'http://spam.example' });
    t('the honeypot suppresses the write but looks like success',
      out.status === 200 && out.data.ok === true &&
      !out.queries.some((q) => /INSERT INTO leads_staging/i.test(q)),
      `${out.status}, ${out.queries.length} quer(ies)`);
  }
  {
    const out = await post({ ...BASE, consent: false });
    t('consent is still mandatory', out.status === 400 && (out.data.fields || []).includes('consent'),
      JSON.stringify(out.data));
  }
  {
    const out = await post({ ...BASE, segment: 'something_else' });
    t('an unknown segment is still refused', out.status === 400 && (out.data.fields || []).includes('segment'),
      JSON.stringify(out.data));
  }
  {
    const out = await post({ ...BASE, buyer_type: 'ceo' });
    t('an unknown buyer type is still refused', out.status === 400 && (out.data.fields || []).includes('buyer_type'),
      JSON.stringify(out.data));
  }

  // ---- 5. the private-label page does not leak Kalamata -----------------
  //
  // The one product-level rule on this page, checked on the page itself
  // rather than only in the facet module.
  for (const file of ['resources/private-label/index.html', 'ar/resources/private-label/index.html']) {
    const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
    const main = html.slice(html.indexOf('<main'), html.indexOf('</main>'));
    const links = [...main.matchAll(/href="\/(?:ar\/)?products\/([a-z-]+)"/g)].map((m) => m[1]);

    // no link to it anywhere in the body -- not "not in the grid", which a
    // link placed just outside the grid would slip past
    t(`${file}: the page links to no Kalamata product page`,
      !links.includes('kalamata-olives'), links.join(','));
    t(`${file}: exactly 10 products are offered`, links.length === 10,
      `${links.length}: ${links.join(',')}`);

    // the page must still say why it is absent, rather than quietly omitting it
    t(`${file}: says why Kalamata is not offered`,
      /Kalamata is not on this list|\u0643\u0627\u0644\u0627\u0645\u0627\u062a\u0627 \u0644\u064a\u0633\u062a \u0641\u064a \u0647\u0630\u0647 \u0627\u0644\u0642\u0627\u0626\u0645\u0629/.test(main),
      'no explanation found');
  }

  // ---- 6. every lead form on the site actually has a handler ------------
  //
  // The market-brief form on the homepage carried id="newsletter-form", five
  // inputs and a Subscribe button, and no page loaded a script that bound to
  // it. Nothing on the page had a `name` either, so pressing Subscribe did a
  // native GET to `/?` -- fields discarded, no request to any endpoint, no
  // confirmation. It looked like it worked. It had never captured a lead.
  //
  // Nothing in this suite could see that, because every other check reads
  // either the endpoint or one page's fields. What was missing was the join
  // between them: a form declaring the shared contract, on a page that never
  // loads the shared handler.
  const HANDLER = '/assets/gated-download.js';
  const pagesWithLeadForms = [];
  (function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.') || ['node_modules', 'geo', 'assets', 'scripts', 'docs', 'netlify'].includes(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.html')) {
        const html = fs.readFileSync(full, 'utf8');
        if (/<form[^>]+data-(?:lead-form|gated-download)=/.test(html)) pagesWithLeadForms.push([path.relative(ROOT, full), html]);
      }
    }
  })(ROOT);

  t(`lead forms were found to check (${pagesWithLeadForms.length} page(s))`, pagesWithLeadForms.length > 0);

  const unhandled = pagesWithLeadForms.filter(([, html]) => !html.includes(HANDLER)).map(([f]) => f);
  t('every page with a lead form loads the shared handler', unhandled.length === 0, unhandled.join(', '));

  // A form that declares the contract must carry the parts the handler reads,
  // or it fails silently in a different way: no submit button to bind, or no
  // status element, so the visitor is told nothing either way.
  const incomplete = [];
  for (const [file, html] of pagesWithLeadForms) {
    for (const m of html.matchAll(/<form[^>]+data-(?:lead-form|gated-download)=[^>]*>[\s\S]*?<\/form>/g)) {
      const form = m[0];
      const missing = ['[data-role="submit"]', '[data-role="status"]', 'data-field="email"', 'data-field="consent"']
        .filter((needle) => !form.includes(needle.replace(/^\[|\]$/g, '')));
      if (missing.length) incomplete.push(`${file}: ${missing.join(' ')}`);
    }
  }
  t('every lead form carries a submit, a status element, an email field and consent',
    incomplete.length === 0, incomplete.slice(0, 4).join(' | '));

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
