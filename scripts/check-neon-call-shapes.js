#!/usr/bin/env node
'use strict';

/*
 * Every method called on a Neon query handle must actually exist on one.
 *
 * `neon()` returns a function. You query with it as a tagged template, or you
 * call it directly with text and parameters. It has exactly one property:
 * `transaction`. It has no `query`.
 *
 * Three functions called `await sql.query(text, params)` anyway, from
 * 2026-09-01 until 2026-09-25: the buyer update in crm-buyers.js (so every
 * CRM edit and every Kanban drag), fifteen calls across analytics-report.js
 * (so the whole /admin/analytics report), and the purge and count in
 * analytics-retention.js (so no analytics row was ever actually deleted by
 * the retention job).
 *
 * `sql.query` is undefined, so each one threw TypeError. A TypeError carries
 * no SQLSTATE, and describeDbError's fallback branch reported every one of
 * them to staff as "the database could not be reached" -- pointing at Neon,
 * which was healthy throughout. That is the second half of why this lasted
 * three and a half weeks: the symptom named the wrong system.
 *
 * Grepping for `sql.query` would only catch the mistake already made. So this
 * loads the real driver, builds a real handle, and checks every method the
 * code calls on a handle against it. A different wrong method -- sql.end,
 * sql.unsafe, sql.begin, all of which exist in other Postgres clients -- fails
 * here too, before it reaches a page.
 *
 * No query runs and no connection opens: building a handle from a syntactically
 * valid URL is local work, and nothing here awaits anything.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const FUNCTIONS = path.join(ROOT, 'netlify/functions');

let pass = 0, fail = 0;
const t = (name, cond, extra) => {
  cond ? pass++ : fail++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : '   <-- ' + (extra === undefined ? '' : extra)}`);
};

// ---- a real handle, from the real driver ---------------------------------

let neon;
try {
  ({ neon } = require('@neondatabase/serverless'));
} catch (err) {
  console.log(`FAIL  the Neon driver can be loaded   <-- ${err.message}`);
  console.log('\n0 passed, 1 failed');
  process.exit(1);
}

const sql = neon('postgresql://user:pass@example.neon.tech/db');

t('the driver loads and builds a query handle', typeof sql === 'function', typeof sql);
t('the handle is callable, which is the parameterised form the code must use',
  typeof sql === 'function', typeof sql);
t('and it has no .query property, which is the trap this check exists for',
  sql.query === undefined,
  'the driver grew a .query -- that is fine, but this check and its comment are now out of date');

// ---- what the code calls on it -------------------------------------------

const files = fs.readdirSync(FUNCTIONS)
  .filter((f) => f.endsWith('.js'))
  .map((f) => path.join(FUNCTIONS, f));

t(`there are functions to scan (${files.length})`, files.length > 10, String(files.length));

const offences = [];
const seen = new Set();

for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
  const rel = path.relative(ROOT, file);
  // Only files that actually build a handle this way are in scope.
  if (!/\bneon\s*\(/.test(src)) continue;

  for (const m of src.matchAll(/\bsql\.([A-Za-z_$][\w$]*)\s*\(/g)) {
    const method = m[1];
    seen.add(method);
    if (typeof sql[method] !== 'function') {
      const line = src.slice(0, m.index).split('\n').length;
      offences.push(`${rel}:${line} sql.${method}(…)`);
    }
  }
}

t('every method called on a query handle exists on a real one',
  offences.length === 0,
  `${offences.length}: ${offences.slice(0, 6).join('; ')}${offences.length > 6 ? ' …' : ''}`);

t(`and the ones called are all real (${[...seen].sort().join(', ') || 'none'})`,
  [...seen].every((mth) => typeof sql[mth] === 'function'),
  [...seen].filter((mth) => typeof sql[mth] !== 'function').join(', '));

// ---- and the message a bug in this code produces -------------------------

{
  const { describeDbError } = require(path.join(FUNCTIONS, '_crm_lib.js'));

  const bug = new TypeError('sql.query is not a function');
  const described = describeDbError(bug, null);
  t('a bug in our own code is not reported as a database failure',
    !/could not be reached/.test(described.error),
    `still says: ${described.error}`);
  t('and it says whose fault it is',
    /bug in its own code/.test(described.error), described.error);

  const outage = Object.assign(new Error('connect ETIMEDOUT'), { name: 'Error' });
  const described2 = describeDbError(outage, 'reading buyers');
  t('while a real unreachable database still reports as one',
    /could not be reached/.test(described2.error), described2.error);

  const sqlstate = Object.assign(new Error('relation "buyers" does not exist'), { code: '42P01' });
  const described3 = describeDbError(sqlstate, 'reading buyers');
  t('and a SQLSTATE error is unchanged',
    /a table this page needs does not exist/.test(described3.error), described3.error);
}

const ok = fail === 0;
console.log(
  `\nneon-call-shapes ${ok ? 'OK' : 'FAILED'} -- ${seen.size} distinct method(s) called on a query handle, ` +
  'all present on a real one.'
);
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(ok ? 0 : 1);
