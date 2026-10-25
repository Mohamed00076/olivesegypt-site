#!/usr/bin/env node
'use strict';

/*
 * npm test: every scripts/check-*.js, one after another (owner, 2026-10-25).
 *
 *   npm test                  (or: node scripts/run-checks.js)
 *
 * Until 2026-10-25 the checks were one long `&&` line in package.json, so any
 * two pull requests that each added a check edited the same line and
 * conflicted, however unrelated they were. Now a check is part of npm test by
 * existing: name it scripts/check-<what>.js and nothing else needs editing.
 *
 * A check that must not run here is named in NOT_IN_NPM_TEST, with why.
 *
 * Every check runs, even after one fails, so a run reports all failures at
 * once; the run fails if any did. Each check's own output is shown as it runs.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const DIR = __dirname;

const NOT_IN_NPM_TEST = {
  // Reads the live site; runs on GitHub after each merge and daily
  // (.github/workflows/live-check.yml).
  'check-live.js': 'needs the live site',
  // Needs a running server and Playwright (npm run check:locale-switch).
  'check-locale-switch.js': 'needs a local server and a browser',
};

const checks = fs.readdirSync(DIR).filter((f) => /^check-[a-z0-9-]+\.js$/.test(f) && !(f in NOT_IN_NPM_TEST)).sort();
for (const f of Object.keys(NOT_IN_NPM_TEST)) {
  if (!fs.existsSync(path.join(DIR, f))) {
    console.error(`run-checks: ${f} is listed in NOT_IN_NPM_TEST but does not exist -- remove it from the list.`);
    process.exit(1);
  }
}

const failed = [];
const started = Date.now();
for (const f of checks) {
  console.log(`\n> node scripts/${f}`);
  const r = spawnSync(process.execPath, [path.join(DIR, f)], { stdio: 'inherit' });
  if (r.status !== 0) failed.push(`${f} (${r.signal ? `killed by ${r.signal}` : `exit ${r.status}`})`);
}

const secs = Math.round((Date.now() - started) / 1000);
if (failed.length) {
  console.error(`\nnpm test FAILED -- ${failed.length} of ${checks.length} checks failed:\n  ${failed.join('\n  ')}`);
  process.exit(1);
}
console.log(`\nnpm test OK -- all ${checks.length} checks passed in ${secs} s (not run here: ${Object.keys(NOT_IN_NPM_TEST).join(', ')}).`);
