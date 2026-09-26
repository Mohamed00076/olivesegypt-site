#!/usr/bin/env node
'use strict';

/*
 * Every website request lands in the CRM pipeline, in the right place, without
 * trampling what staff have already done.
 *
 *   node scripts/check-enquiry-intake.js        (part of `npm test`)
 *
 * The owner's rules, each checked by RUNNING the intake against a recording
 * database stub, not by reading its source:
 *
 *   - Sample Request -> 'Sample Requested'; Quote Request -> 'Lead' flagged
 *     'Send quotation'; every other request -> 'Lead'.
 *   - A person already in the CRM is not duplicated. Their stage moves only
 *     forward, never out of Lost/Stalled, and their next action is filled
 *     only if they had none.
 *   - A company name or email the CRM would refuse is not added, and the
 *     enquiry says why.
 *   - Intake failing never fails the enquiry: the buyer still gets a success
 *     response and the reason is recorded on the enquiry.
 *
 * And the vocabularies it depends on must agree with the site:
 *
 *   - regions and stages identical in _crm_lib.js and assets/crm.js
 *   - every form request type has a plan
 *   - every product label the forms offer maps to the product page with that
 *     exact heading, in both languages, or is explicitly unmapped
 *   - countries map conservatively: ambiguous names stay Unassigned
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const Module = require('module');

const ROOT = path.join(__dirname, '..');
const FN = path.join(ROOT, 'netlify', 'functions');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

let pass = 0, fail = 0;
const t = (name, cond, extra) => {
  cond ? pass++ : fail++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : '   <-- ' + (extra === undefined ? '' : extra)}`);
};

const lib = require(path.join(FN, '_crm_lib.js'));
const intake = require(path.join(FN, '_crm_intake.js'));
const { regionForCountry, TABLE } = require(path.join(FN, '_country_regions.js'));

// ---- vocabularies agree -------------------------------------------------

{
  const sandbox = { window: {}, document: { addEventListener() {}, readyState: 'complete' } };
  vm.createContext(sandbox);
  try { vm.runInContext(read('assets/crm.js'), sandbox); } catch (e) { /* page wiring needs a DOM */ }
  const CRM = sandbox.window.CRM || {};
  t('CRM pages offer exactly the server\'s regions, in order',
    JSON.stringify(CRM.REGIONS) === JSON.stringify(lib.REGIONS),
    `assets/crm.js ${JSON.stringify(CRM.REGIONS)} vs _crm_lib.js ${JSON.stringify(lib.REGIONS)}`);
  t('CRM pages lay out exactly the server\'s stages, in order',
    JSON.stringify(CRM.STAGES) === JSON.stringify(lib.STAGES),
    `assets/crm.js ${JSON.stringify(CRM.STAGES)} vs _crm_lib.js ${JSON.stringify(lib.STAGES)}`);
  t('the owner\'s added regions are there, and Unassigned for the rest',
    ['Europe (non-EU)', 'South America', 'Oceania', 'Unassigned'].every((r) => lib.REGIONS.includes(r)));
}

{
  const formSrc = read('assets/inquiry-form.js');
  const block = formSrc.match(/var INTENTS = \{([\s\S]*?)\};/);
  const types = block ? [...block[1].matchAll(/:\s*'([^']+)'/g)].map((m) => m[1]) : [];
  t('the form\'s request types were found', types.length >= 6, JSON.stringify(types));
  const missing = types.filter((ty) => !intake.PLAN[ty]);
  t('every request type the forms can send has its own plan', missing.length === 0,
    `no plan for: ${missing.join(', ')} -- it would fall through to a generic Lead`);
  t('Sample Request -> Sample Requested', intake.planFor('Sample Request').stage === 'Sample Requested');
  t('Quote Request -> Lead, flagged Send quotation',
    intake.planFor('Quote Request').stage === 'Lead' && intake.planFor('Quote Request').nextAction === 'Send quotation');
  t('an unknown or forged request type is a plain Lead',
    intake.planFor("x'); DROP TABLE buyers;--").stage === 'Lead' && intake.planFor(null).stage === 'Lead');
  t('every planned stage is a real stage',
    Object.values(intake.PLAN).every((p) => lib.STAGES.includes(p.stage)));
}

// ---- product labels match the product pages ---------------------------

{
  const UNMAPPED = {
    'Multiple varieties / not sure yet': 'not a product',
    'عدة أصناف / غير محدد بعد': 'not a product',
  };
  const heading = (file) => {
    const m = read(file).match(/<h1[^>]*>([^<]*)/);
    return m ? m[1].trim() : null;
  };
  const wrong = [];
  for (const [slug, [en, ar]] of Object.entries(intake.PRODUCT_LABELS)) {
    const hEn = heading(`products/${slug}/index.html`);
    const hAr = heading(`ar/products/${slug}/index.html`);
    if (hEn !== en) wrong.push(`${slug}: page says "${hEn}", intake says "${en}"`);
    if (hAr !== ar) wrong.push(`${slug}: Arabic page says "${hAr}", intake says "${ar}"`);
  }
  t('every product label is the heading of its own product page, in both languages',
    wrong.length === 0, wrong.join('; '));

  const offered = [];
  for (const f of ['contact/index.html', 'sample/index.html', 'ar/contact/index.html', 'ar/sample/index.html']) {
    const src = read(f);
    for (const id of ['contact-product', 'sample-product']) {
      const i = src.indexOf(`id="${id}"`);
      if (i < 0) continue;
      const seg = src.slice(i, src.indexOf('</select>', i));
      for (const m of seg.matchAll(/<option(?![^>]*value="")[^>]*>([^<]*)/g)) offered.push([f, m[1].trim()]);
    }
  }
  t('the forms\' product options were found', offered.length >= 40, `${offered.length} found`);
  const unknown = offered.filter(([, label]) => intake.productsFor(label).length === 0 && !UNMAPPED[label]);
  t('every product a form offers maps to a CRM product, or is knowingly unmapped',
    unknown.length === 0, unknown.map(([f, l]) => `${f}: "${l}"`).join('; '));
}

// ---- countries -----------------------------------------------------------

{
  t('every region in the country table is a real CRM region',
    Object.keys(TABLE).every((r) => lib.REGIONS.includes(r)), Object.keys(TABLE).join(', '));
  const cases = [
    ['Germany', 'EU'], ['The Netherlands', 'EU'], ['Cyprus', 'EU'], ['United Kingdom', 'Europe (non-EU)'],
    ['U.S.A.', 'North America'], ['Mexico', 'North America'], ['Brazil', 'South America'],
    ['Australia', 'Oceania'], ['Côte d’Ivoire', 'Africa'], ['Egypt', 'Africa'], ['Türkiye', 'Middle East'],
    ['Russia', 'Europe (non-EU)'], ['السعودية', 'Middle East'], ['المملكة العربية السعودية', 'Middle East'],
    ['الإمارات', 'Middle East'], ['مصر', 'Africa'], ['ألمانيا', 'EU'], ['سلطنة عُمان', 'Middle East'],
    ['India', 'Asia'], ['Papua New Guinea', 'Oceania'], ['Guinea', 'Africa'],
  ];
  const bad = cases.filter(([c, r]) => regionForCountry(c) !== r).map(([c, r]) => `${c}: ${regionForCountry(c)} (want ${r})`);
  t(`countries typed in English and Arabic reach the right region (${cases.length} tried)`, bad.length === 0, bad.join('; '));
  const ambiguous = ['Georgia', 'عمان', 'Germany / Hamburg', '', 'asdf', 'Europe'];
  const guessed = ambiguous.filter((c) => regionForCountry(c) !== 'Unassigned');
  t('an ambiguous or unknown country is left Unassigned, never guessed',
    guessed.length === 0, guessed.map((c) => `"${c}" -> ${regionForCountry(c)}`).join('; '));
}

// ---- forward-only --------------------------------------------------------

{
  const f = intake.forwardMove;
  t('Lead -> Sample Requested moves forward', f('Lead', 'Sample Requested') === 'Sample Requested');
  t('Qualifying -> Sample Requested moves forward', f('Qualifying', 'Sample Requested') === 'Sample Requested');
  t('Negotiation is never pulled back to Sample Requested', f('Negotiation', 'Sample Requested') === null);
  t('Sample Requested is not re-set onto itself', f('Sample Requested', 'Sample Requested') === null);
  t('Lost/Stalled is never reopened by a web form', f('Lost/Stalled', 'Sample Requested') === null);
  t('a quote request never moves anyone (Lead is the start)', f('Contacted', 'Lead') === null);
}

// ---- the intake, run -----------------------------------------------------

function recordingSql(answer) {
  const calls = [];
  const sql = (strings, ...values) => {
    const text = strings.join('?').replace(/\s+/g, ' ').trim();
    calls.push({ text, values });
    const out = answer(text, values);
    return out instanceof Error ? Promise.reject(out) : Promise.resolve(out || []);
  };
  sql.transaction = () => { throw new Error('not used'); };
  return { sql, calls };
}

const E = (over) => Object.assign({
  name: 'Anna Berg', email: 'anna@example.com', company: 'Nordic Deli Imports ApS', country: 'Denmark',
  phone: null, productInterest: 'Aggizi Green Olives', estimatedVolume: '1 x 20ft container',
  requestType: 'Sample Request', message: 'Please send a sample.',
}, over || {});

const buyerWrites = (calls) => calls.filter((c) => /INSERT INTO buyers|UPDATE buyers/.test(c.text));

(async () => {
  {
    const { sql, calls } = recordingSql((q) => (/RETURNING id/.test(q) && /INSERT INTO buyers/.test(q) ? [{ id: 42 }] : []));
    const r = await intake.addEnquiryToPipeline(sql, 7, E({ country: 'السعودية' }));
    const ins = calls.find((c) => /INSERT INTO buyers/.test(c.text));
    t('a new person becomes a new buyer', r.outcome === 'created' && r.buyerId === 42 && !!ins, JSON.stringify(r));
    const v = ins ? ins.values : [];
    t('   at Sample Requested, for a sample request', v.includes('Sample Requested'), JSON.stringify(v));
    t('   with their region worked out from the country', v.includes('Middle East'), JSON.stringify(v));
    t('   with the product mapped to the CRM\'s own id', v.includes('["aggizi-green-olives"]'), JSON.stringify(v));
    t('   created by "website" and assigned to nobody', v.includes('website') && /VALUES \( \?, NULL,/.test(ins.text));
    t('   due tomorrow, as the form promises a reply within 24 hours', /CURRENT_DATE \+ 1/.test(ins.text));
    t('   with stage history, activity, audit and the link back -- in the same statement',
      ['INSERT INTO buyer_stage_history', 'INSERT INTO buyer_activity_log', 'INSERT INTO crm_audit_log', 'UPDATE inquiries SET buyer_id']
        .every((s) => ins && ins.text.includes(s)), ins && ins.text.slice(0, 200));
  }
  {
    const { sql, calls } = recordingSql((q) => (/RETURNING id/.test(q) && /INSERT INTO buyers/.test(q) ? [{ id: 43 }] : []));
    await intake.addEnquiryToPipeline(sql, 8, E({ requestType: 'Quote Request', country: 'Georgia' }));
    const ins = calls.find((c) => /INSERT INTO buyers/.test(c.text));
    const v = ins ? ins.values : [];
    t('a quote request goes in as a Lead flagged Send quotation', v.includes('Lead') && v.includes('Send quotation'), JSON.stringify(v));
    t('   and an ambiguous country goes in Unassigned, with a note asking for it',
      v.includes('Unassigned') && v.some((x) => typeof x === 'string' && /region not set/.test(x)), JSON.stringify(v));
  }

  for (const [stage, expectMove] of [['Lead', true], ['Negotiation', false], ['Lost/Stalled', false]]) {
    const { sql, calls } = recordingSql((q) => (/SELECT id, current_stage FROM buyers WHERE deleted_at IS NULL/.test(q)
      ? [{ id: 5, current_stage: stage }] : []));
    const r = await intake.addEnquiryToPipeline(sql, 9, E());
    const upd = calls.find((c) => /UPDATE buyers SET/.test(c.text));
    t(`a known buyer at ${stage} is updated, not duplicated`,
      r.outcome === 'updated' && r.buyerId === 5 && !calls.some((c) => /INSERT INTO buyers/.test(c.text)), JSON.stringify(r));
    // The move target is the parameter tested with `::text IS NOT NULL`;
    // found by position in the statement, not by a hard-coded index.
    const at = upd ? upd.text.indexOf('?::text IS NOT NULL') : -1;
    const target = at >= 0 ? upd.values[upd.text.slice(0, at).split('?').length - 1] : undefined;
    t(`   ${expectMove ? 'and moved forward to Sample Requested' : 'and left where they are'}`,
      expectMove ? target === 'Sample Requested' : target === null, `move target ${JSON.stringify(target)}`);
    t('   without overwriting a next action staff already set',
      upd && /next_action = CASE WHEN COALESCE\(buyers\.next_action, ''\) = ''/.test(upd.text), upd && upd.text.slice(0, 300));
    t('   and a stage history row only if the stage really changed',
      upd && /FROM updated WHERE from_stage <> to_stage/.test(upd.text));
  }

  {
    const { sql, calls } = recordingSql(() => []);
    const r = await intake.addEnquiryToPipeline(sql, 10, E({ company: 'Mr Ahmed' }));
    t('a company name the CRM would refuse is not added', r.outcome === 'skipped' && buyerWrites(calls).length === 0, JSON.stringify(r));
    t('   and the enquiry records why', calls.some((c) => /pipeline_note/.test(c.text) && /company name/.test(String(c.values[0]))),
      JSON.stringify(calls.map((c) => c.values)));
  }
  {
    const { sql, calls } = recordingSql(() => []);
    const r = await intake.addEnquiryToPipeline(sql, 11, E({ email: 'anna@localhost' }));
    t('an email the CRM would refuse is not added, and says so',
      r.outcome === 'skipped' && buyerWrites(calls).length === 0 && /email/.test(r.note), JSON.stringify(r));
  }

  // ---- intake failure never fails the enquiry ---------------------------
  {
    process.env.DATABASE_URL = 'postgres://stub';
    const { sql, calls } = recordingSql((q) => {
      if (/count\(\*\)/.test(q)) return [{ n: 0 }];
      if (/INSERT INTO inquiries/.test(q)) return [{ id: 77 }];
      if (/FROM buyers/.test(q)) { const e = new Error('connection reset'); return e; }
      return [];
    });
    const neonId = require.resolve('@neondatabase/serverless');
    require.cache[neonId] = new Module(neonId, null);
    require.cache[neonId].filename = neonId;
    require.cache[neonId].loaded = true;
    require.cache[neonId].exports = { neon: () => sql };
    const fnId = require.resolve(path.join(FN, 'inquiries.js'));
    delete require.cache[fnId];
    const origError = console.error; const origLog = console.log;
    console.error = () => {}; console.log = (...a) => { if (!/^\[email\]/.test(String(a[0]))) origLog(...a); };
    const res = await require(fnId).handler({
      httpMethod: 'POST', headers: {},
      body: JSON.stringify({ name: 'Anna Berg', email: 'anna@example.com', company: 'Nordic Deli Imports ApS',
        country: 'Denmark', message: 'Hello', request_type: 'Sample Request' }),
    });
    console.error = origError; console.log = origLog;
    t('when the pipeline cannot be reached, the buyer still gets a success response',
      res.statusCode === 200 && JSON.parse(res.body).ok === true, `${res.statusCode} ${res.body}`);
    const note = calls.find((c) => /UPDATE inquiries SET pipeline_note/.test(c.text));
    t('   and the enquiry is marked with the reason',
      !!note && /^Not added to pipeline: /.test(note.values[0]) && note.values[1] === 77, note && JSON.stringify(note.values));
  }

  {
    const src = read('netlify/functions/inquiries.js');
    t('the inbox is given each enquiry\'s buyer and note',
      /source_page,\s*buyer_id,\s*pipeline_note\s*FROM inquiries/.test(src));
    const page = read('crm/inquiries/index.html');
    t('and the inbox shows them, distinguishing all three cases',
      /In pipeline &rarr;/.test(page) && /Not added/.test(page) && /Received before automatic intake/.test(page));
  }

  const ok = fail === 0;
  console.log(`\nenquiry-intake ${ok ? 'OK' : 'FAILED'} -- every website request reaches the pipeline, forward only, never at the enquiry's expense.`);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(ok ? 0 : 1);
})().catch((err) => {
  console.error('check-enquiry-intake CRASHED:', err && err.stack ? err.stack : err);
  process.exit(1);
});
