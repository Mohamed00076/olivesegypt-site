#!/usr/bin/env node
'use strict';

/*
 * A failing CRM page must say what failed -- and no more than that.
 *
 *   node scripts/check-crm-errors.js        (part of `npm test`)
 *
 * WHY THIS EXISTS
 *
 * Every CRM endpoint answered "Server error" for every possible fault. A
 * missing table, a missing column, a revoked privilege and an exhausted
 * connection pool were indistinguishable on screen, and the only way to tell
 * them apart was to open Netlify's function logs.
 *
 * That is not a theoretical cost. A buyer page broke; a missing table was
 * found and fixed; the page still broke; and nothing anywhere could say
 * whether the second failure had the same cause as the first. One round trip
 * lost entirely to a message that said nothing.
 *
 * So these assertions run in both directions, because a diagnostic that leaks
 * is worse than one that is silent:
 *
 *   - a missing table names the table
 *   - a missing column names the column
 *   - each failure names the step it happened in, not merely that one did
 *   - a connection failure is described but NEVER quoted, because its text
 *     can carry the database host
 *   - an unknown fault still says something useful, and still quotes nothing
 *   - none of it reaches anyone without a CRM session
 */

const path = require('path');
const Module = require('module');

const ROOT = path.join(__dirname, '..');
const FN = path.join(ROOT, 'netlify', 'functions');

// A hostname and a password, planted in the errors below. If either ever
// appears in a response body, this test fails: those are the strings that
// must never reach a browser, whoever is looking at it.
const SECRET_HOST = 'ep-secret-frost-12345.eu-central-1.aws.neon.tech';
const SECRET_PASSWORD = 'npg_SuperSecretPassword';

function pgError(code, message) {
  const e = new Error(message);
  e.code = code;
  return e;
}

const FAULTS = {
  missing_table: () => pgError('42P01', 'relation "buyer_activity_log" does not exist'),
  missing_column: () => pgError('42703', 'column "certification_gap" does not exist'),
  no_privilege: () => pgError('42501', `permission denied for table buyers`),
  too_many: () => pgError('53300', `sorry, too many clients already at ${SECRET_HOST}`),
  unreachable: () => pgError('08006', `could not connect to ${SECRET_HOST} as user with password ${SECRET_PASSWORD}`),
  unknown: () => new Error(`connect ETIMEDOUT ${SECRET_HOST}:5432`),
};

// Which query the fault should strike. null means "the first one".
let failOn = null;
let failWith = null;

function fakeSql(strings) {
  const q = Array.isArray(strings) ? strings.join('?') : String(strings);
  if (failWith && (!failOn || new RegExp(failOn, 'i').test(q))) {
    return Promise.reject(failWith());
  }
  if (/FROM buyers WHERE id/i.test(q)) {
    return Promise.resolve([{ id: 1, company_name: 'Olive Importers BV', country_region: 'EU' }]);
  }
  return Promise.resolve([]);
}
fakeSql.query = () => Promise.resolve([]);

const neonId = require.resolve('@neondatabase/serverless');
require.cache[neonId] = new Module(neonId, null);
require.cache[neonId].filename = neonId;
require.cache[neonId].loaded = true;
require.cache[neonId].exports = { neon: () => fakeSql };

const SECRET = 'test-secret-not-a-real-one';
process.env.DATABASE_URL = `postgres://user:${SECRET_PASSWORD}@${SECRET_HOST}/db`;
process.env.CRM_SESSION_SECRET = SECRET;

const { signSession, CRM_COOKIE_NAME } = require(path.join(FN, '_crm_lib.js'));
const buyers = require(path.join(FN, 'crm-buyers.js'));
const COOKIE = `${CRM_COOKIE_NAME}=${signSession('staff', SECRET)}`;

let pass = 0, fail = 0;
const t = (name, cond, extra) => {
  cond ? pass++ : fail++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : '   <-- ' + (extra === undefined ? '' : extra)}`);
};

function get(id) {
  return buyers.handler({
    httpMethod: 'GET',
    headers: { cookie: COOKIE },
    queryStringParameters: id ? { id: String(id) } : {},
  });
}

// Silence the function's own console.error; the log line is not what is
// under test here and it makes the output unreadable.
const realError = console.error;

(async () => {
  console.error = () => {};

  // ---- each fault is named -------------------------------------------
  {
    failOn = 'SELECT .*FROM buyer_activity_log';
    failWith = FAULTS.missing_table;
    const res = await get(1);
    const body = JSON.parse(res.body);
    t('a missing table names the table', /buyer_activity_log/.test(body.error), body.error);
    t('   and the step it failed in', /reading the activity log/.test(body.error), body.error);
    t('   and carries the SQLSTATE', body.code === '42P01', body.code);
    t('   the status is still 500', res.statusCode === 500, res.statusCode);
  }
  {
    failOn = 'FROM buyers WHERE id';
    failWith = FAULTS.missing_column;
    const res = await get(1);
    const body = JSON.parse(res.body);
    t('a missing column names the column', /certification_gap/.test(body.error), body.error);
    t('   and the step', /reading the buyer record/.test(body.error), body.error);
  }
  {
    failOn = 'INSERT INTO crm_audit_log';
    failWith = FAULTS.no_privilege;
    const res = await get(1);
    const body = JSON.parse(res.body);
    t('a privilege fault is described', /not allowed/.test(body.error), body.error);
    t('   named to the audit write', /writing the audit entry/.test(body.error), body.error);
    t('   and the database is NOT quoted', !/permission denied/.test(body.error), body.error);
  }
  {
    failOn = 'CREATE TABLE';
    failWith = FAULTS.missing_table;
    const res = await get(1);
    const body = JSON.parse(res.body);
    t('a fault while preparing the schema says so', /preparing the database tables/.test(body.error), body.error);
  }

  // ---- and nothing leaks ---------------------------------------------
  for (const [name, fault] of [
    ['too many connections', FAULTS.too_many],
    ['an unreachable database', FAULTS.unreachable],
    ['an unrecognised fault', FAULTS.unknown],
  ]) {
    failOn = null;
    failWith = fault;
    const res = await get(1);
    const raw = res.body;
    const body = JSON.parse(raw);
    t(`${name}: the host is never printed`, !raw.includes(SECRET_HOST), raw);
    t(`   nor the password`, !raw.includes(SECRET_PASSWORD), raw);
    t(`   but it still says something useful`, typeof body.error === 'string' && body.error.length > 10, body.error);
  }

  // ---- the list path is covered too ----------------------------------
  {
    failOn = 'FROM buyers';
    failWith = FAULTS.missing_column;
    const res = await get(null);
    const body = JSON.parse(res.body);
    t('the buyers list reports faults the same way', res.statusCode === 500 && /certification_gap/.test(body.error), body.error);
  }

  // ---- none of it is public ------------------------------------------
  {
    failOn = null;
    failWith = FAULTS.missing_table;
    const res = await buyers.handler({
      httpMethod: 'GET', headers: {}, queryStringParameters: { id: '1' },
    });
    const body = JSON.parse(res.body);
    t('no session gets no diagnosis at all', res.statusCode === 401 && body.error === 'Unauthorized', res.body);
    t('   and no step or code', body.step === undefined && body.code === undefined, res.body);
  }

  // ---- a healthy request is untouched --------------------------------
  {
    failOn = null;
    failWith = null;
    const res = await get(1);
    t('a working buyer page still returns 200', res.statusCode === 200, res.statusCode);
    const body = JSON.parse(res.body);
    t('   with the record, and no diagnostic fields', body.company_name === 'Olive Importers BV' && !body.code, res.body);
  }

  console.error = realError;
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
})().catch((err) => {
  console.error = realError;
  console.error('check-crm-errors CRASHED:', err && err.stack ? err.stack : err);
  process.exit(1);
});
