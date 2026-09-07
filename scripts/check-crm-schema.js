#!/usr/bin/env node
'use strict';

/*
 * A CRM endpoint must create every table it reads.
 *
 *   node scripts/check-crm-schema.js        (part of `npm test`)
 *
 * WHAT WENT WRONG
 *
 * Opening any buyer record returned "Server error". crm-buyers.js's
 * handleGet reads buyer_activity_log, but its ensureSchema only creates
 * buyers, buyer_stage_history and crm_audit_log. buyer_activity_log is
 * created by crm-activity.js -- a different function, which runs only when
 * an activity entry is POSTed.
 *
 * That is a deadlock, not a race. You can only add an activity entry from a
 * buyer's page; the buyer's page cannot load until the table exists; the
 * table is not created until an entry is added. So on any database where
 * /api/crm/activity had never succeeded, every buyer record was unreachable
 * -- and had been since the CRM was first built (commit a6b25d8), because
 * crm-buyers.js has never created that table in its history.
 *
 * It survived because nothing here ran against a fresh database. Every
 * offline test stubs the driver with a fake that answers any query, so a
 * missing table is invisible: the stub cheerfully returns rows for a
 * relation Postgres would refuse.
 *
 *
 * WHAT THIS CHECKS
 *
 * The stub below is deliberately strict where the others are permissive. It
 * knows only the tables that the function under test creates through its own
 * ensureSchema, and throws Postgres's own error for anything else:
 *
 *     relation "buyer_activity_log" does not exist
 *
 * So a handler that reads a table it never created fails here exactly as it
 * fails in production, rather than passing against a stub that pretends.
 *
 * ONE DOCUMENTED EXCEPTION, below: crm-documents.js reads `buyers` without
 * creating it. That one cannot deadlock -- a document can only reference a
 * buyer_id that exists, which means the buyers table already does -- so it
 * is allowed by name rather than by loosening the rule for everything.
 */

const path = require('path');
const Module = require('module');

const ROOT = path.join(__dirname, '..');
const FN = path.join(ROOT, 'netlify', 'functions');

const ALLOWED_FOREIGN_READS = {
  // function file -> tables it may read without creating them, and why
  'crm-documents.js': {
    buyers: 'a document can only cite a buyer_id that exists, so the table does too',
  },
  'crm-activity.js': {
    buyers: 'an activity entry is written against a buyer that exists, so the table does too',
  },
};

let pass = 0, fail = 0;
const t = (name, cond, extra) => {
  cond ? pass++ : fail++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : '   <-- ' + (extra === undefined ? '' : extra)}`);
};

/*
 * Every table named in the statement, whether it is being created or used.
 * Deliberately simple: these functions write plain SQL in tagged templates,
 * so there is nothing here to parse beyond the keyword that precedes a name.
 */
function tablesIn(q) {
  const created = [];
  const used = [];
  let m;

  const create = /CREATE TABLE(?:\s+IF NOT EXISTS)?\s+([a-z_][a-z0-9_]*)/gi;
  while ((m = create.exec(q))) created.push(m[1]);

  const use = /\b(?:FROM|JOIN|INSERT INTO|UPDATE|ALTER TABLE)\s+([a-z_][a-z0-9_]*)/gi;
  while ((m = use.exec(q))) used.push(m[1]);

  return { created, used: used.filter((u) => !created.includes(u)) };
}

function makeStrictSql(fileName, seen) {
  const exists = new Set();
  const allowed = ALLOWED_FOREIGN_READS[fileName] || {};

  function sql(strings, ...vals) {
    const q = Array.isArray(strings) ? strings.join('?') : String(strings);
    const { created, used } = tablesIn(q);

    created.forEach((c) => exists.add(c));

    for (const table of used) {
      if (exists.has(table) || allowed[table]) continue;
      seen.missing.push({ table, q: q.trim().replace(/\s+/g, ' ').slice(0, 90) });
      // Exactly what Postgres says, so the handler's catch behaves as it does
      // in production rather than against a friendlier stub.
      const err = new Error(`relation "${table}" does not exist`);
      err.code = '42P01';
      throw err;
    }

    if (/^\s*SELECT/i.test(q.trim())) return Promise.resolve(seen.rows(q));
    if (/RETURNING/i.test(q)) return Promise.resolve([{ id: 1, created_at: new Date('2026-09-07T00:00:00Z') }]);
    return Promise.resolve([]);
  }
  sql.query = () => Promise.resolve([]);
  return sql;
}

const SECRET = 'test-secret-not-a-real-one';
process.env.DATABASE_URL = 'postgres://stub';
process.env.CRM_SESSION_SECRET = SECRET;

let currentSql = null;
const neonId = require.resolve('@neondatabase/serverless');
require.cache[neonId] = new Module(neonId, null);
require.cache[neonId].filename = neonId;
require.cache[neonId].loaded = true;
require.cache[neonId].exports = { neon: () => currentSql };

const { signSession, CRM_COOKIE_NAME } = require(path.join(FN, '_crm_lib.js'));
const COOKIE = `${CRM_COOKIE_NAME}=${signSession('staff', SECRET)}`;

/*
 * The requests a person actually makes, in the order the UI makes them, on a
 * database that has never seen this CRM before. Anything that reads a table
 * its own function did not create will fail here.
 */
const CASES = [
  {
    file: 'crm-buyers.js',
    what: 'open a buyer record',
    event: { httpMethod: 'GET', queryStringParameters: { id: '1' } },
    rows: (q) => (/FROM buyers/i.test(q)
      ? [{ id: 1, company_name: 'Olive Importers BV', country_region: 'EU', current_stage: 'Lead' }]
      : []),
  },
  {
    file: 'crm-buyers.js',
    what: 'list buyers',
    event: { httpMethod: 'GET', queryStringParameters: {} },
    rows: () => [],
  },
  {
    file: 'crm-documents.js',
    what: 'open the documents list',
    event: { httpMethod: 'GET', queryStringParameters: {} },
    rows: () => [],
  },
  {
    file: 'crm-documents.js',
    what: 'open one document',
    event: { httpMethod: 'GET', queryStringParameters: { id: '1' } },
    rows: () => [{ id: 1, doc_type: 'quotation', doc_number: 'Q-2026-000001' }],
  },
  {
    file: 'crm-activity.js',
    what: 'add an activity entry',
    event: { httpMethod: 'POST', queryStringParameters: {}, body: JSON.stringify({ buyer_id: 1, entry: 'Called.' }) },
    rows: () => [],
  },
];

(async () => {
  for (const c of CASES) {
    const seen = { missing: [], rows: c.rows };
    currentSql = makeStrictSql(c.file, seen);

    // Fresh require each time: ensureSchema must stand on its own, not on a
    // table some earlier request in the same process happened to create.
    const id = require.resolve(path.join(FN, c.file));
    delete require.cache[id];
    const fn = require(id);

    const res = await fn.handler(Object.assign({ headers: { cookie: COOKIE } }, c.event));

    const ok = res.statusCode !== 500;
    t(`${c.what} (${c.file}) works on a fresh database`, ok,
      seen.missing.length
        ? `reads a table it never creates: ${seen.missing.map((x) => x.table).join(', ')} -- in: ${seen.missing[0].q}`
        : `status ${res.statusCode}: ${res.body}`);
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
})().catch((err) => {
  console.error('check-crm-schema CRASHED:', err && err.stack ? err.stack : err);
  process.exit(1);
});
