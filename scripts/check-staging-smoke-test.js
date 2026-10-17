#!/usr/bin/env node
'use strict';

/*
 * scripts/staging-smoke-test.js never runs against the live site.
 *
 *   node scripts/check-staging-smoke-test.js        (part of `npm test`)
 *
 * The smoke test sends wrong passwords until it is rate-limited. Pointed at
 * the live site it would lock the owner out for 15 minutes and could email
 * an alert, so its address check is held here: only a Netlify branch deploy
 * or deploy preview (<name>--<site>.netlify.app) and this computer pass.
 */

const { stagingTarget, EMAIL_ACCOUNTS } = require('./staging-smoke-test');

let pass = 0, fail = 0;
const t = (name, cond, extra) => {
  cond ? pass++ : fail++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : '   <-- ' + (extra === undefined ? '' : extra)}`);
};

const REFUSED = [
  'https://olivesegypt.com',
  'https://www.olivesegypt.com/',
  'https://OLIVESEGYPT.COM/crm/login/',
  'https://olivesegypt.com./',
  'http://olivesegypt.com',
  'https://staging.olivesegypt.com',
  'https://stirring-manatee-ca2643.netlify.app',                 // the site's production address on Netlify
  'https://olivesegypt.com.evil--x.netlify.app.example.com',
  'http://claude-auth-release-1--stirring-manatee-ca2643.netlify.app',   // not https
  'https://user:pw@claude-auth-release-1--stirring-manatee-ca2643.netlify.app',
  'https://example.com',
  'not an address',
];
for (const u of REFUSED) t(`refuses ${u}`, !!stagingTarget(u).error, JSON.stringify(stagingTarget(u)));

const ALLOWED = [
  ['https://claude-auth-release-1--stirring-manatee-ca2643.netlify.app', 'https://claude-auth-release-1--stirring-manatee-ca2643.netlify.app'],
  ['https://claude-auth-release-1--stirring-manatee-ca2643.netlify.app/crm/login/', 'https://claude-auth-release-1--stirring-manatee-ca2643.netlify.app'],
  ['https://deploy-preview-382--stirring-manatee-ca2643.netlify.app', 'https://deploy-preview-382--stirring-manatee-ca2643.netlify.app'],
  ['http://localhost:8888', 'http://localhost:8888'],
];
for (const [u, origin] of ALLOWED) t(`allows ${u}`, stagingTarget(u).origin === origin, JSON.stringify(stagingTarget(u)));

// --send-one-email mails a real inbox: only the two staging test accounts.
for (const u of ['owner-test', 'owner-test-2']) t(`--send-one-email accepts ${u}`, EMAIL_ACCOUNTS.test(u));
for (const u of ['owner', 'admin', 'owner-test-3', 'xowner-test', 'owner-test-2x', 'smoke-nonadmin', ''])
  t(`--send-one-email refuses "${u}"`, !EMAIL_ACCOUNTS.test(u));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
