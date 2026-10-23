#!/usr/bin/env node
'use strict';

/*
 * A visitor's IP address comes from Netlify's own header only.
 *
 *   node scripts/check-client-ip.js        (part of `npm test`)
 *
 * X-Forwarded-For and client-ip are whatever the caller sends. Every place
 * that rate-limits by IP, or fingerprints a consent record with it, reads
 * x-nf-client-connection-ip through _lib.js netlifyClientIp, and nothing
 * reads the caller-written headers. On Netlify the header is always present
 * and was already read first, so this changed no live behaviour; it keeps a
 * fallback from ever becoming reachable (deployment record, Deploys 261 and
 * the one after).
 */

const fs = require('fs');
const path = require('path');

const FN = path.join(__dirname, '..', 'netlify', 'functions');
let pass = 0, fail = 0;
const t = (name, cond, extra) => {
  cond ? pass++ : fail++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : '   <-- ' + (extra === undefined ? '' : extra)}`);
};

const { netlifyClientIp } = require(path.join(FN, '_lib.js'));
t("Netlify's header is used", netlifyClientIp({ headers: { 'x-nf-client-connection-ip': '203.0.113.5', 'x-forwarded-for': '10.0.0.1' } }) === '203.0.113.5');
t('X-Forwarded-For and client-ip are ignored when it is missing',
  netlifyClientIp({ headers: { 'x-forwarded-for': '10.0.0.1', 'client-ip': '10.0.0.2' } }) === 'unknown');
t('   the fallback can be chosen (the analytics collector uses "")', netlifyClientIp({ headers: {} }, '') === '');
t('   no headers at all is safe', netlifyClientIp({}) === 'unknown' && netlifyClientIp(undefined) === 'unknown');

// The sign-in functions (_auth_lib.js clientIp, password reset release 1)
// follow the same rule and are covered by the scan below.
const strip = (src) => src.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
const readers = [];
for (const f of fs.readdirSync(FN).filter((x) => /\.m?js$/.test(x)).sort()) {
  if (/['"](x-forwarded-for|client-ip)['"]/i.test(strip(fs.readFileSync(path.join(FN, f), 'utf8')))) readers.push(f);
}
t('no function reads X-Forwarded-For or client-ip', readers.length === 0, readers.join(', '));

for (const f of ['consent.js', 'inquiries.js', 'leads.js', 'unsubscribe.js', '_analytics_lib.js']) {
  t(`${f} takes the address from netlifyClientIp`, /netlifyClientIp\(event/.test(strip(fs.readFileSync(path.join(FN, f), 'utf8'))));
}

console.log(`\nclient-ip ${fail ? 'FAILED' : 'OK'} -- addresses come from Netlify's header only.`);
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
