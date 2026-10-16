#!/usr/bin/env node
'use strict';

/*
 * Only the live site sends anything.
 *
 *   node scripts/check-preview-sends.js        (part of `npm test`)
 *
 * WHAT WENT WRONG
 *
 * Deploy previews and local copies run the same page scripts as the live
 * site. A choice made while checking a preview reached the real Google
 * Analytics, Umami and consent register, and a form filled in on a preview
 * created a real CRM record and notification email.
 *
 * WHAT THIS ASSERTS
 *
 * Every public page script that calls the site's own /api, or loads a
 * tracker, carries the live-host rule (olivesegypt.com, www.olivesegypt.com)
 * and checks it before its first send. A new script that posts to /api
 * without it fails here until it is either guarded or listed below with a
 * reason.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const LIVE = /\/\^\(www\\\.\)\?olivesegypt\\\.com\$\/\.test\(window\.location\.hostname\)/;

// Scripts that may send without the rule, and why.
const EXEMPT = {
  'crm.js': 'the staff CRM; every call needs a signed-in session, and blocking it would make CRM changes impossible to check on a preview',
};

const results = [];
function check(label, ok, detail) {
  results.push(ok);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${!ok && detail ? ' -- ' + detail : ''}`);
}

const dir = path.join(ROOT, 'assets');
const scripts = fs.readdirSync(dir).filter((f) => f.endsWith('.js')).sort();
let guarded = 0;
for (const f of scripts) {
  const src = fs.readFileSync(path.join(dir, f), 'utf8');
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const sends = /fetch\(\s*['"]\/api\/|sendBeacon\(\s*['"]\/api\/|umami-olivesegypt|googletagmanager/.test(code);
  if (!sends) continue;
  if (EXEMPT[f]) { check(`${f} is exempt: ${EXEMPT[f]}`, true); continue; }
  const rule = code.search(LIVE);
  const firstSend = code.search(/fetch\(\s*['"]\/api\/|sendBeacon\(\s*['"]\/api\/|s\.src = (UMAMI_SRC|GA_SRC)/);
  check(`${f} sends only from the live site`, rule !== -1 && (firstSend === -1 || rule < firstSend),
    rule === -1 ? 'no live-host rule' : 'the rule comes after the first send');
  guarded++;
}
check('the scripts that send were found', guarded >= 5, `${guarded} found`);

const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed} passed, ${failed} failed`);
if (failed) process.exit(1);
