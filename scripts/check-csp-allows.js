#!/usr/bin/env node
'use strict';

/*
 * Every third-party host the site's own scripts use is allowed by the
 * Content-Security-Policy, for what they use it for -- and no other.
 *
 *   node scripts/check-csp-allows.js        (part of `npm test`)
 *
 * The CSP was added on 2026-09-02, a day after assets/consent.js started
 * injecting the Umami tracker for consenting visitors. It allowed neither the
 * tracker's script nor the beacon it sends to its own host, so browsers
 * refused both, and Umami recorded nothing from the live site. Nothing noticed
 * for almost a month (system health audit, run 1). Reproduced in Chromium
 * with the real header: script-src-elem and connect-src violations.
 *
 * This reads every host named in client code -- assets/*.js and the pages'
 * inline scripts -- and requires each to be listed under the directives its
 * use needs. A host nobody has classified fails, so a new third party cannot
 * be added without deciding what the policy should say about it.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

let pass = 0, fail = 0;
const t = (name, cond, extra) => {
  cond ? pass++ : fail++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : '   <-- ' + (extra === undefined ? '' : extra)}`);
};

// Each host client code names, the directives its use needs, and why.
const HOSTS = {
  'umami-olivesegypt.netlify.app': { needs: ['script-src', 'connect-src'], why: 'Umami tracker (consent.js, after analytics consent) and its /api/send beacon' },
  'www.googletagmanager.com': { needs: ['script-src', 'connect-src', 'img-src'], why: 'Google Analytics gtag.js (consent.js, after analytics consent)' },
  'connect.facebook.net': { needs: ['script-src'], why: 'Facebook SDK for the homepage Follow widget, loaded on click' },
  'www.facebook.com': { needs: ['frame-src'], why: 'the Facebook page plugin iframe, on click' },
};

const csp = (read('netlify.toml').match(/Content-Security-Policy = "([^"]+)"/) || [])[1] || '';
const directives = {};
for (const part of csp.split(';')) {
  const [name, ...values] = part.trim().split(/\s+/);
  if (name) directives[name] = values;
}
t('the site-wide Content-Security-Policy is present', !!csp && !!directives['default-src']);

// Hosts named in client code.
const tracked = execFileSync('git', ['ls-files'], { cwd: ROOT }).toString().split('\n').filter(Boolean);
const seen = new Map();
const note = (host, where) => { if (!seen.has(host)) seen.set(host, new Set()); seen.get(host).add(where); };
for (const f of tracked.filter((x) => /^assets\/[^/]+\.js$/.test(x))) {
  for (const m of read(f).matchAll(/https:\/\/([a-z0-9.-]+\.[a-z]{2,})/g)) note(m[1], f);
}
for (const f of tracked.filter((x) => x.endsWith('.html') && !x.startsWith('docs/') && !x.startsWith('scripts/'))) {
  for (const sc of read(f).matchAll(/<script(?![^>]*application\/ld\+json)[^>]*>([\s\S]*?)<\/script>/g)) {
    for (const m of sc[1].matchAll(/https:\/\/([a-z0-9.-]+\.[a-z]{2,})/g)) note(m[1], f);
  }
}

const unclassified = [...seen.keys()].filter((h) => !HOSTS[h] && h !== 'olivesegypt.com');
t(`every third-party host in client code is classified (${seen.size} seen)`, unclassified.length === 0,
  `${unclassified.join(', ')} -- add it to HOSTS with the directives it needs, and to the CSP`);

for (const [host, { needs, why }] of Object.entries(HOSTS)) {
  if (!seen.has(host)) continue;
  const missing = needs.filter((d) => !(directives[d] || []).includes(`https://${host}`));
  t(`${host} is allowed for ${needs.join(' and ')} (${why})`, missing.length === 0, `missing from: ${missing.join(', ')}`);
}
t('the Umami host is really used by consent.js (else its CSP entry should go)',
  /UMAMI_SRC = 'https:\/\/umami-olivesegypt\.netlify\.app\/script\.js'/.test(read('assets/consent.js')));

// gtag.js is fetched from googletagmanager.com but reports to hosts consent.js
// never names (google-analytics.com, regional subdomains, analytics.google.com),
// so the loop above cannot see them. Without these the tag loads and every hit
// is refused -- the same silent failure Umami had.
{
  const consent = read('assets/consent.js');
  const usesGa = /GA_SRC = 'https:\/\/www\.googletagmanager\.com\/gtag\/js'/.test(consent);
  if (usesGa) {
    for (const d of ['connect-src', 'img-src']) {
      t(`Google Analytics can send its hits (${d} allows *.google-analytics.com)`,
        (directives[d] || []).includes('https://*.google-analytics.com'));
    }
    t('   including the regional analytics.google.com endpoints',
      (directives['connect-src'] || []).includes('https://*.analytics.google.com'));
    t('Google Analytics is loaded only behind the consent gate',
      /function loadGoogleAnalyticsIfConsented\(\) \{\s*if \(!TC\.consent\.analytics\) return;/.test(consent)
        && !tracked.filter((x) => x.endsWith('.html')).some((f) => /googletagmanager\.com/.test(read(f))),
      'gtag.js must be injected by consent.js after consent, never by a static tag in a page');
    t('   and withdrawing consent switches it off and removes its cookies',
      /else \{\s*disableGoogleAnalytics\(\);/.test(consent) && /window\['ga-disable-' \+ GA_MEASUREMENT_ID\] = true;/.test(consent));
  } else {
    t('no Google Analytics hosts are left in the CSP once consent.js stops loading it',
      !/google-analytics\.com|googletagmanager\.com/.test(csp));
  }
}

const ok = fail === 0;
console.log(`\ncsp-allows ${ok ? 'OK' : 'FAILED'} -- every third-party host client code uses is allowed for what it is used for.`);
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(ok ? 0 : 1);
