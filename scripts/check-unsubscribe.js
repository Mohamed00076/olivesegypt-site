#!/usr/bin/env node
'use strict';

/*
 * The unsubscribe path, end to end at the module level.
 *
 *   node scripts/check-unsubscribe.js        (part of `npm test`)
 *
 * Offline: the database driver is replaced by a small in-memory store that
 * actually holds rows, so an opt-out can be written and then read back
 * rather than merely "a statement was issued".
 *
 * Every lead form on this site carried the line "I can unsubscribe at any
 * time" from the beginning, with nothing behind it -- no page, no endpoint,
 * no column (docs/downloads-and-gating.md §4). Two kinds of assertion below,
 * and both matter:
 *
 *   - the promise resolves: every consent label links to a page that exists,
 *     in its own locale, and that page carries a working form;
 *   - the endpoint behaves: an opt-out is recorded and readable, opting
 *     someone else back IN is refused, and a person's address never reaches
 *     the logs.
 */

const fs = require('fs');
const path = require('path');
const Module = require('module');

const ROOT = path.join(__dirname, '..');
const FN = path.join(ROOT, 'netlify', 'functions');

// ---- an in-memory stand-in for the two tables ---------------------------
const db = { optOuts: new Map(), events: [] };

function fakeSql(strings, ...vals) {
  const q = Array.isArray(strings) ? strings.join('?') : String(strings);

  if (/^\s*CREATE/i.test(q)) return Promise.resolve([]);

  if (/SELECT status FROM contact_opt_outs/i.test(q)) {
    const row = db.optOuts.get(vals[0]);
    return Promise.resolve(row ? [{ status: row.status }] : []);
  }
  if (/INSERT INTO contact_opt_outs/i.test(q)) {
    db.optOuts.set(vals[0], { status: vals[1], updated_at: new Date() });
    return Promise.resolve([]);
  }
  if (/INSERT INTO contact_opt_out_events/i.test(q)) {
    db.events.push({ email: vals[0], action: vals[1], source_page: vals[2], client_ip: vals[3] });
    return Promise.resolve([]);
  }
  if (/count\(\*\)[\s\S]*contact_opt_out_events/i.test(q)) {
    const ip = vals[1];
    return Promise.resolve([{ n: db.events.filter((e) => e.client_ip === ip).length }]);
  }
  if (/SELECT email, status, updated_at FROM contact_opt_outs/i.test(q)) {
    return Promise.resolve([...db.optOuts.entries()]
      .filter(([, v]) => v.status === 'unsubscribed')
      .map(([email, v]) => ({ email, status: v.status, updated_at: v.updated_at })));
  }
  // leads_staging and anything else this test does not model
  if (/count\(/i.test(q)) return Promise.resolve([{ n: 0 }]);
  return Promise.resolve([]);
}
fakeSql.query = () => Promise.resolve([]);

const neonId = require.resolve('@neondatabase/serverless');
require.cache[neonId] = new Module(neonId, null);
require.cache[neonId].filename = neonId;
require.cache[neonId].loaded = true;
require.cache[neonId].exports = { neon: () => fakeSql };

const SECRET = 'test-secret-not-a-real-one';
process.env.DATABASE_URL = 'postgres://stub';
process.env.SESSION_SECRET = SECRET;

const { signSession, COOKIE_NAME } = require(path.join(FN, '_lib.js'));
const optout = require(path.join(FN, '_optout_lib.js'));
const unsub = require(path.join(FN, 'unsubscribe.js'));

let pass = 0, fail = 0;
const t = (name, cond, extra) => {
  cond ? pass++ : fail++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : '   <-- ' + (extra === undefined ? '' : extra)}`);
};

const ADMIN_COOKIE = `${COOKIE_NAME}=${signSession('admin', SECRET)}`;

function call(method, { body, query, cookie, ip } = {}) {
  return unsub.handler({
    httpMethod: method,
    headers: Object.assign({ 'x-nf-client-connection-ip': ip || '203.0.113.9' }, cookie ? { cookie } : {}),
    queryStringParameters: query || {},
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
const parse = (res) => JSON.parse(res.body);

(async () => {
  // ---- 1. the promise resolves -------------------------------------------
  // Every label that says "unsubscribe" must link to a page that can do it,
  // in its own locale. A label promising something with no link is the exact
  // defect this work exists to close.
  const LABEL_PAGES = [
    ['index.html', '/unsubscribe', '/privacy'],
    ['downloads/index.html', '/unsubscribe', '/privacy'],
    ['ar/downloads/index.html', '/ar/unsubscribe', '/ar/privacy'],
  ];
  for (const [file, unsubHref, privacyHref] of LABEL_PAGES) {
    const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
    const labels = html.split('data-field="consent"').slice(1)
      .concat(html.includes('id="newsletter-consent"') ? [html.split('id="newsletter-consent"')[1]] : [])
      .map((chunk) => chunk.slice(0, 800));
    t(`${file}: found consent label(s)`, labels.length > 0, labels.length);
    const bad = labels.filter((l) => !l.includes(`href="${unsubHref}"`) || !l.includes(`href="${privacyHref}"`));
    t(`   each one links to ${unsubHref} and ${privacyHref}`, bad.length === 0, `${bad.length} of ${labels.length} do not`);
  }

  for (const p of ['unsubscribe/index.html', 'ar/unsubscribe/index.html']) {
    const html = fs.readFileSync(path.join(ROOT, p), 'utf8');
    t(`${p} exists and carries the form the script drives`,
      html.includes('id="unsubscribe-form"') && html.includes('id="unsubscribe-email"') &&
      html.includes('id="unsubscribe-status"'));
    t(`   and loads assets/unsubscribe.js`, html.includes('/assets/unsubscribe.js'));
    // A page whose only job is a one-off action should not be a search result.
    t(`   and is noindex`, /content="noindex/.test(html));
  }

  // Findable without having a form in front of you.
  const footers = ['index.html', 'catalog/index.html', 'contact/index.html'];
  for (const f of footers) {
    const html = fs.readFileSync(path.join(ROOT, f), 'utf8');
    t(`${f} footer links to /unsubscribe`, html.includes('href="/unsubscribe"'));
  }
  const arHtml = fs.readFileSync(path.join(ROOT, 'ar/index.html'), 'utf8');
  t('ar/index.html footer links to /ar/unsubscribe', arHtml.includes('href="/ar/unsubscribe"'));
  t('   and not to the English one', !/href="\/unsubscribe"/.test(arHtml));

  // ---- 2. recording an opt-out -------------------------------------------
  const realLog = console.log;
  let logs = [];
  console.log = (...a) => logs.push(a.join(' '));
  let res = await call('POST', { body: { email: 'Buyer@Example.COM', source_page: '/unsubscribe' } });
  console.log = realLog;

  t('a valid request is accepted', res.statusCode === 200 && parse(res).ok === true, res.body);
  t('   the address is stored lowercased', db.optOuts.has('buyer@example.com'), [...db.optOuts.keys()].join(','));
  t('   an event row is written with the page and the IP',
    db.events.length === 1 && db.events[0].action === 'unsubscribe' &&
    db.events[0].source_page === '/unsubscribe' && db.events[0].client_ip === '203.0.113.9',
    JSON.stringify(db.events[0]));
  t('   the log records the action but never the address',
    logs.some((l) => l.includes('action=unsubscribe')) && !logs.some((l) => l.toLowerCase().includes('buyer@example.com')),
    JSON.stringify(logs));

  t('the library agrees they are opted out', (await optout.isOptedOut(fakeSql, 'buyer@example.com')) === true);
  t('   and a different address is not', (await optout.isOptedOut(fakeSql, 'someone@else.com')) === false);

  // Someone clicking twice because they were not sure it worked is the
  // normal case: idempotent, and never an error.
  res = await call('POST', { body: { email: 'buyer@example.com' } });
  t('unsubscribing twice is still a success', res.statusCode === 200 && parse(res).ok === true);
  t('   with one row and two events', db.optOuts.size === 1 && db.events.length === 2, `${db.optOuts.size}/${db.events.length}`);

  // ---- 3. refusals -------------------------------------------------------
  for (const bad of ['', 'not-an-email', 'a@b', '@example.com']) {
    res = await call('POST', { body: { email: bad } });
    t(`"${bad}" is rejected as an address`, res.statusCode === 400, res.statusCode);
  }
  res = await call('POST', { body: { email: 'x@y.com', action: 'delete_everything' } });
  t('an unknown action is rejected', res.statusCode === 400, res.statusCode);

  // Opting someone back IN is the direction that could undo a person's own
  // choice, so it is not something the public endpoint will do.
  res = await call('POST', { body: { email: 'buyer@example.com', action: 'resubscribe' } });
  t('the public endpoint will not opt anyone back in', res.statusCode === 401, res.statusCode);
  t('   and the opt-out survived the attempt',
    (await optout.isOptedOut(fakeSql, 'buyer@example.com')) === true);

  res = await call('POST', { body: { email: 'buyer@example.com', action: 'resubscribe' }, cookie: ADMIN_COOKIE });
  t('an admin can, for someone who says they never asked', res.statusCode === 200, res.statusCode);
  t('   and the reversal is in the trail, not a deletion',
    db.events.length === 3 && db.events[2].action === 'resubscribe', JSON.stringify(db.events.map((e) => e.action)));

  res = await call('GET', { query: { list: '1' } });
  t('the opt-out list is not public', res.statusCode === 401, res.statusCode);
  res = await call('GET', { query: { list: '1' }, cookie: ADMIN_COOKIE });
  t('an admin can read it', res.statusCode === 200 && Array.isArray(parse(res).opt_outs), res.body);

  res = await call('PUT', { body: {} });
  t('other methods are rejected', res.statusCode === 405, res.statusCode);

  // ---- 4. bulk abuse is bounded ------------------------------------------
  const before = db.events.length;
  let limited = 0;
  for (let i = 0; i < 40; i++) {
    const r = await call('POST', { body: { email: `victim${i}@example.com` }, ip: '198.51.100.1' });
    if (r.statusCode === 429) limited++;
  }
  t('one connection cannot opt out an unlimited number of addresses', limited > 0, `${limited} refused of 40`);
  t('   and the refusals wrote nothing', db.events.length - before === 40 - limited, db.events.length - before);

  // ---- 5. a fresh consented submission lifts an old opt-out --------------
  db.optOuts.clear(); db.events.length = 0;
  await optout.unsubscribe(fakeSql, 'returning@example.com', '/unsubscribe', '203.0.113.9');
  t('setup: the address is opted out', (await optout.isOptedOut(fakeSql, 'returning@example.com')) === true);

  delete require.cache[require.resolve(path.join(FN, 'leads.js'))];
  const leads = require(path.join(FN, 'leads.js'));
  const quiet = console.log; console.log = () => {};
  const leadRes = await leads.handler({
    httpMethod: 'POST',
    headers: { 'x-nf-client-connection-ip': '203.0.113.9' },
    body: JSON.stringify({
      email: 'returning@example.com', company_name: 'Example Imports',
      country_region: 'Spain', buyer_type: 'importer', consent: true,
      source_page: '/downloads', segment: 'buyers_guide',
    }),
  });
  console.log = quiet;
  t('a new consented submission is accepted', leadRes.statusCode === 200, leadRes.body);
  t('   and lifts the earlier opt-out', (await optout.isOptedOut(fakeSql, 'returning@example.com')) === false);
  t('   leaving both facts in the trail, not just the latest',
    db.events.map((e) => e.action).join(',') === 'unsubscribe,resubscribe',
    db.events.map((e) => e.action).join(','));

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('ERROR', e); process.exit(1); });
