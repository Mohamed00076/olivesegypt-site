#!/usr/bin/env node
'use strict';

/*
 * No public page contacts a third party before the visitor chooses.
 *
 *   node scripts/check-self-hosted-fonts.js        (part of `npm test`)
 *
 * Every page loaded its fonts from fonts.googleapis.com and fonts.gstatic.com,
 * so each visitor's IP address went to Google before the consent banner was
 * answered, and /privacy does not name Google (system health audit, run 1,
 * D2; present since 2026-08-04). The fonts are now served from
 * /assets/fonts/: the same files and @font-face rules Google serves, with the
 * addresses changed.
 *
 * This holds it there. No published page, generator or catalogue source may
 * reference Google's font hosts; every page that had fonts loads the local
 * stylesheet; every file that stylesheet names exists; the licence travels
 * with the files; and the Content-Security-Policy no longer allows the hosts.
 * More generally, no public page may load any resource from another host by a
 * static tag. The one exception is named below with its reason.
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
const show = (l) => `${l.length}: ${l.slice(0, 6).join(', ')}${l.length > 6 ? ' …' : ''}`;

// Static third-party loads allowed, by page, with the reason.
const EXTERNAL_ALLOWED = new Map([
  ['admin/analytics/index.html cdn.jsdelivr.net', 'Chart.js on the owner-only dashboard, behind login; never a visitor page'],
]);

const tracked = execFileSync('git', ['ls-files'], { cwd: ROOT }).toString().split('\n').filter(Boolean);
// Internal notes may mention the old hosts; everything that ships or generates a page may not.
const SHIPPING = tracked.filter((f) => /\.(html|css|js|py|toml)$/.test(f) && !f.startsWith('docs/') &&
  !/^scripts\/check-/.test(f) && f !== 'mobile-nav-overlap-audit.md');

const googleRefs = SHIPPING.filter((f) => /fonts\.(googleapis|gstatic)\.com/.test(read(f)));
t('nothing that ships or generates a page references Google\'s font hosts', googleRefs.length === 0, show(googleRefs));

const pages = tracked.filter((f) => f.endsWith('.html') && !f.startsWith('docs/'));
const withFonts = pages.filter((f) => /\/assets\/fonts\/fonts\.css/.test(read(f)));
t(`pages load the self-hosted stylesheet (${withFonts.length})`, withFonts.length >= 100, withFonts.length);
const gen = read('scripts/generate-product-pages.py');
t('   and so does the product-page generator', /\/assets\/fonts\/fonts\.css/.test(gen));

const css = read('assets/fonts/fonts.css');
const urls = [...css.matchAll(/url\(([^)]+)\)/g)].map((m) => m[1]);
const missing = urls.filter((u) => !u.startsWith('/assets/fonts/') || !fs.existsSync(path.join(ROOT, u)));
t(`every font file the stylesheet names is here (${urls.length} references)`, urls.length > 0 && missing.length === 0, show(missing));
const families = [...new Set([...css.matchAll(/font-family: '([^']+)'/g)].map((m) => m[1]))].sort();
t('   covering the five families the pages use', ['Great Vibes', 'Noto Naskh Arabic', 'Playfair Display', 'Plus Jakarta Sans', 'Space Mono'].every((f) => families.includes(f)), families.join(', '));
const ofl = fs.existsSync(path.join(ROOT, 'assets/fonts/OFL.txt')) ? read('assets/fonts/OFL.txt') : '';
t('   with the Open Font License for each family beside them',
  ['Plus Jakarta Sans', 'Playfair Display', 'Noto Naskh Arabic', 'Space Mono', 'Great Vibes'].every((f) => ofl.includes(f)) && /SIL OPEN FONT LICENSE/i.test(ofl));

const csp = (read('netlify.toml').match(/Content-Security-Policy = "([^"]+)"/) || [])[1] || '';
t('the Content-Security-Policy no longer allows Google\'s font hosts', !!csp && !/fonts\.(googleapis|gstatic)\.com/.test(csp), csp.slice(0, 120));
t('   and fonts and styles are same-origin only', /font-src 'self';/.test(csp) && /style-src 'self' 'unsafe-inline';/.test(csp), csp.slice(0, 200));

// No public page loads anything from another host by a static tag.
const external = [];
for (const f of pages) {
  const s = read(f);
  for (const m of s.matchAll(/<(link|script|img|iframe|source|video|audio)\b[^>]*?\b(?:href|src)="(?:https?:)?\/\/([^/"]+)[^"]*"[^>]*>/g)) {
    if (m[1] === 'link' && /rel="(canonical|alternate)"/.test(m[0])) continue;
    const key = `${f} ${m[2]}`;
    if (!EXTERNAL_ALLOWED.has(key)) external.push(key);
  }
}
t('no page loads a resource from another host by a static tag (one named exception)', external.length === 0, show(external));

const ok = fail === 0;
console.log(`\nself-hosted-fonts ${ok ? 'OK' : 'FAILED'} -- no public page contacts a third party before the visitor chooses.`);
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(ok ? 0 : 1);
