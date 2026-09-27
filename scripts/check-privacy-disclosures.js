#!/usr/bin/env node
'use strict';

/*
 * What the analytics code does with a visitor's IP address, /privacy says.
 *
 *   node scripts/check-privacy-disclosures.js        (part of `npm test`)
 *
 * For every visitor who accepts Analytics, analytics-collect.js passes their
 * IP address to resolveOrg (_b2b_lib.js), which asks the regional internet
 * registry responsible for it who the network is registered to, and stores
 * that name on the session. This shipped with the B2B work and /privacy never
 * mentioned it -- nor the registries, which receive the address, as a third
 * party. Found 2026-09-27 (C-117) and disclosed on the owner's instruction.
 *
 * The check ties the two together in both directions: while the code makes
 * the lookup, both privacy pages must describe it and name the registries;
 * and the facts they state -- the IP is not kept raw, the hash is kept for 30
 * days -- must still be true of the code.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

let pass = 0, fail = 0;
const t = (name, cond, extra) => {
  cond ? pass++ : fail++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : '   <-- ' + (extra === undefined ? '' : extra)}`);
};

const collect = read('netlify/functions/analytics-collect.js');
const b2b = read('netlify/functions/_b2b_lib.js');
const en = read('privacy/index.html');
const ar = read('ar/privacy/index.html');

const looksUp = /await resolveOrg\(sql, ip\)/.test(collect);
t('the analytics pipeline still makes the network lookup (else this check is moot)', looksUp,
  'resolveOrg is no longer called -- if the lookup is gone, take its disclosure off /privacy too');

if (looksUp) {
  t('/privacy describes looking up who the IP address is registered to',
    /look up which organisation your internet \(IP\) address is registered to/.test(en));
  t('   and names the registries as a third party that receives the address',
    /the regional internet registries \(such as RIPE NCC, AFRINIC and ARIN\), which receive your IP address/.test(en));
  t('/ar/privacy describes the same lookup',
    /نستعلم أيضًا عن الجهة المسجَّل باسمها عنوان الإنترنت \(IP\) الخاص بك/.test(ar));
  t('   and names the registries as a third party',
    /سجلات الإنترنت الإقليمية \(مثل RIPE NCC وAFRINIC وARIN\)/.test(ar) && /إذ تتلقى عنوان IP الخاص بك/.test(ar));

  // The pages make two factual promises about storage; hold the code to them.
  t('what the pages promise is still true: only a one-way hash of the IP is kept',
    /ip_hash\s+text PRIMARY KEY/.test(b2b) && !/\bip\s+text\b/.test(b2b) && !/INSERT INTO ip_org_cache \(ip,/.test(b2b),
    'the cache now stores something other than a hash of the address');
  t('   for 30 days',
    /const CACHE_TTL_DAYS = 30;/.test(b2b) && /up to 30 days/.test(en) && /لمدة تصل إلى 30 يومًا/.test(ar),
    'the cache lifetime and the pages disagree');
  t('   and the lookup is reached only through consented analytics events',
    /if \(!TC\.consent\.analytics\) return;/.test(read('assets/analytics.js')),
    'analytics.js no longer gates its writes on consent');
}

const ok = fail === 0;
console.log(`\nprivacy-disclosures ${ok ? 'OK' : 'FAILED'} -- what the code does with an IP address, the privacy pages say.`);
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(ok ? 0 : 1);
