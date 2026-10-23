#!/usr/bin/env node
'use strict';

/*
 * The buyer page's Email button warns when the buyer's address has used the
 * website's unsubscribe page (owner, 2026-10-20).
 *
 *   node scripts/check-buyer-optout-flag.js        (part of `npm test`)
 *
 * The owner's conditions: "It must not expose the opt-out list, and it must
 * be a read-only check." So this holds that
 *   - the buyer read answers one yes/no, email_opted_out, for the address on
 *     that buyer's own record -- nothing about any other address, no dates;
 *   - the check only reads: no INSERT, UPDATE or DELETE touches the opt-out
 *     tables, and it never creates them (if nobody has ever unsubscribed,
 *     the table does not exist and the answer is no);
 *   - the address is compared the way the unsubscribe page stores it
 *     (trimmed, lower case), and "resubscribed" counts as no;
 *   - the page warns, and asks before opening the email, but does not block.
 */

const fs = require('fs');
const path = require('path');
const Module = require('module');

const ROOT = path.join(__dirname, '..');
const FN = path.join(ROOT, 'netlify', 'functions');

let pass = 0, fail = 0;
const t = (name, cond, extra) => {
  cond ? pass++ : fail++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : '   <-- ' + (extra === undefined ? '' : extra)}`);
};

process.env.DATABASE_URL = 'postgres://stub';
process.env.CRM_SESSION_SECRET = 'test-secret-not-a-real-one';

// Fictitious records only.
const BUYERS = {
  1: { id: 1, company_name: 'Opted Out Foods (fake)', contact_email: '  Buyer.One@Example.TEST ', current_stage: 'Lead', deleted_at: null },
  2: { id: 2, company_name: 'Still Subscribed Ltd (fake)', contact_email: 'two@example.test', current_stage: 'Lead', deleted_at: null },
  3: { id: 3, company_name: 'Came Back GmbH (fake)', contact_email: 'three@example.test', current_stage: 'Lead', deleted_at: null },
  4: { id: 4, company_name: 'No Email Co (fake)', contact_email: null, current_stage: 'Lead', deleted_at: null },
};
const OPT_OUTS = { 'buyer.one@example.test': 'unsubscribed', 'three@example.test': 'resubscribed', 'someone.else@example.test': 'unsubscribed' };
let tableExists = true;
let statements = [];
const sql = (strings, ...vals) => {
  const q = (Array.isArray(strings) ? strings.join('?') : String(strings)).replace(/\s+/g, ' ').trim();
  const params = Array.isArray(strings) ? vals : (vals[0] || []);
  statements.push({ q, params });
  if (/to_regclass\('public\.contact_opt_outs'\)/.test(q)) return Promise.resolve([{ present: tableExists }]);
  if (/FROM contact_opt_outs/.test(q)) {
    if (!tableExists) return Promise.reject(new Error('relation "contact_opt_outs" does not exist'));
    const st = OPT_OUTS[params[0]];
    return Promise.resolve(st ? [{ status: st }] : []);
  }
  if (/^SELECT \* FROM buyers WHERE id = /.test(q)) return Promise.resolve(BUYERS[params[0]] ? [BUYERS[params[0]]] : []);
  return Promise.resolve([]);
};
sql.query = (text, params) => sql(text, params);
const neonId = require.resolve('@neondatabase/serverless');
require.cache[neonId] = new Module(neonId, null);
require.cache[neonId].filename = neonId;
require.cache[neonId].loaded = true;
require.cache[neonId].exports = { neon: () => sql };

const fx = require('./_session_fixtures');

fx.install(FN);

const { signCrmSession, CRM_COOKIE_NAME } = require(path.join(FN, '_crm_lib.js'));
const cookie = `${CRM_COOKIE_NAME}=${signCrmSession('staff', fx.crmClaims('staff'))}`;
const buyers = require(path.join(FN, 'crm-buyers.js')).handler;
const get = async (id) => {
  statements = [];
  const r = await buyers({ httpMethod: 'GET', headers: { cookie }, queryStringParameters: { id: String(id) }, body: null });
  return { status: r.statusCode, data: JSON.parse(r.body || '{}'), statements: statements.slice() };
};
const optOutWrites = (st) => st.filter((s) => /^(INSERT INTO|UPDATE|DELETE FROM|CREATE TABLE IF NOT EXISTS|CREATE INDEX IF NOT EXISTS) contact_opt_out/i.test(s.q));

(async () => {
  let r = await get(1);
  t('a buyer whose address unsubscribed reads email_opted_out: true', r.status === 200 && r.data.email_opted_out === true, JSON.stringify(r.data.email_opted_out));
  const look = r.statements.filter((s) => /FROM contact_opt_outs/.test(s.q));
  t('   compared as the unsubscribe page stores it (trimmed, lower case)', look.length === 1 && look[0].params[0] === 'buyer.one@example.test', JSON.stringify(look));
  t('   one row, for that address only', /WHERE email = \? LIMIT 1/.test(look[0] ? look[0].q : ''));
  t('   and the reply carries no other address, status or date from the list',
    !JSON.stringify(r.data).includes('someone.else') && !/opt_out|unsubscribed|updated_at/.test(Object.keys(r.data).filter((k) => k !== 'email_opted_out').join(',')));
  t('   nothing is written to, or created in, the opt-out tables', optOutWrites(r.statements).length === 0, JSON.stringify(optOutWrites(r.statements)));

  r = await get(2);
  t('an address not on the list reads false', r.data.email_opted_out === false);
  r = await get(3);
  t('an address that unsubscribed and then came back reads false', r.data.email_opted_out === false);
  r = await get(4);
  t('a buyer with no email reads false, without looking anything up', r.data.email_opted_out === false && !r.statements.some((s) => /contact_opt_outs/.test(s.q)));

  tableExists = false;
  r = await get(1);
  t('if nobody has ever unsubscribed (no table yet) the answer is false, not an error', r.status === 200 && r.data.email_opted_out === false, JSON.stringify(r));
  t('   and the table is not created by this read', optOutWrites(r.statements).length === 0 && !r.statements.some((s) => /FROM contact_opt_outs/.test(s.q)));
  tableExists = true;

  const unsigned = await buyers({ httpMethod: 'GET', headers: {}, queryStringParameters: { id: '1' }, body: null });
  t('without a CRM session nothing is answered', unsigned.statusCode === 401 && !/opted/.test(unsigned.body));

  const src = fs.readFileSync(path.join(FN, 'crm-buyers.js'), 'utf8');
  t('crm-buyers.js never writes to the opt-out tables', !/(INSERT INTO|UPDATE|DELETE FROM)\s+contact_opt_out/i.test(src) && !/ensureOptOutSchema|unsubscribe\(|resubscribe\(/.test(src));
  t('   and has no route that lists them', !/FROM contact_opt_outs(?! WHERE email = \$\{e\} LIMIT 1)/.test(src));

  // ---- the page -----------------------------------------------------------
  const page = fs.readFileSync(path.join(ROOT, 'crm/buyer/index.html'), 'utf8');
  t('the buyer page reads email_opted_out', /b\.email_opted_out/.test(page));
  t('   shows a warning line', /id="quick-optout"/.test(page) && /Unsubscribed: ' \+ email \+ ' used the website\\u2019s unsubscribe page/.test(page));
  t('   and Email asks before opening the mail app, rather than blocking it',
    /title: 'This address has unsubscribed'/.test(page) && /if \(yes\) window\.location\.href = 'mailto:' \+ email/.test(page));
  t('   quoting what the unsubscribe page told them',
    /about our products, guides and market updates/.test(page) &&
    /about our products, guides and market updates/.test(fs.readFileSync(path.join(ROOT, 'unsubscribe/index.html'), 'utf8')));

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail) {
    console.log('\nbuyer-optout-flag FAILED -- the check must be one read-only yes/no for the buyer\'s own address.');
    process.exit(1);
  }
})().catch((e) => { console.error(e); process.exit(1); });
