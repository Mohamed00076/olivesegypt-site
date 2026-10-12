#!/usr/bin/env node
'use strict';

/*
 * The live site, checked from outside: what a visitor and Google actually get.
 *
 *   node scripts/check-live.js            (GitHub Actions: .github/workflows/live-check.yml)
 *   node scripts/check-live.js --wait     (first waits until the live sitemap
 *                                          matches this checkout, i.e. the
 *                                          latest merge has deployed)
 *
 * Not part of `npm test`: it needs the network, and the sessions that build
 * this site cannot reach olivesegypt.com. GitHub's runners can, so this runs
 * there after every merge to main and once a day, and writes its findings to
 * the run summary.
 *
 * Each line is OK, FAIL or PENDING. FAIL is something on the site that is
 * wrong and fails the run. PENDING is a step that waits on the owner's own
 * accounts (DNS at GoDaddy, Netlify domain settings), reported every run
 * without failing it until it is done.
 *
 * It only reads. It submits no form and sends no email: enquiry delivery is
 * confirmed by the owner with one test enquiry.
 */

const fs = require('fs');
const path = require('path');

const BASE = (process.env.LIVE_BASE || 'https://olivesegypt.com').replace(/\/$/, '');
const ROOT = path.join(__dirname, '..');
const results = [];
const ok = (name, detail = '') => results.push(['OK', name, detail]);
const fail = (name, detail = '') => results.push(['FAIL', name, detail]);
const pending = (name, detail = '') => results.push(['PENDING', name, detail]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url, opts = {}) {
  const res = await fetch(url, { redirect: 'manual', headers: { 'user-agent': 'olivesegypt-live-check' }, ...opts });
  const body = opts.method === 'HEAD' ? '' : await res.text();
  return { status: res.status, location: res.headers.get('location') || '', headers: res.headers, body };
}

const localSitemap = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
const urls = [...localSitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].replace('https://olivesegypt.com', BASE));
const norm = (s) => s.replace(/\s+/g, ' ').trim();

async function liveCommit() {
  try { const r = await get(BASE + '/deployed-commit.txt', { cache: 'no-store' }); return r.status === 200 ? r.body.trim() : null; }
  catch (e) { return null; }
}

// The commit to expect: GITHUB_SHA is the merge being checked (push) or the
// tip of main (schedule, manual run). Without it, fall back to the sitemap.
async function checkDeployed(wait) {
  const want = process.env.GITHUB_SHA;
  const deadline = Date.now() + (wait ? 15 * 60 * 1000 : 0);
  for (;;) {
    const have = await liveCommit();
    if (want && have && have === want) return ok('The live site is the latest commit on main', have.slice(0, 7));
    if (want && have === null) break; // no marker yet (deploys before this one): use the sitemap
    if (Date.now() >= deadline) {
      if (!want) break;
      return fail('The live site is the latest commit on main', `live ${String(have).slice(0, 7)}, main ${want.slice(0, 7)}: the latest deploy failed or has not run (Netlify → Deploys)`);
    }
    await sleep(30000);
  }
  for (;;) {
    let same = false;
    try { const r = await get(BASE + '/sitemap.xml'); same = r.status === 200 && norm(r.body) === norm(localSitemap); } catch (e) { /* retry */ }
    if (same) return ok('Live sitemap matches main', 'no deploy marker yet, so compared by sitemap');
    if (Date.now() >= deadline) return fail('Live sitemap matches main', 'the live sitemap differs from main: the latest merge may not have deployed');
    await sleep(30000);
  }
}

async function pool(items, n, fn) {
  const out = []; let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k]); } }));
  return out;
}

async function main() {
  await checkDeployed(process.argv.includes('--wait'));

  // Every sitemap page: 200 at its own address, canonical pointing at itself.
  const pages = await pool(urls, 6, async (u) => {
    try {
      const r = await get(u);
      const canon = (r.body.match(/<link rel="canonical" href="([^"]*)"/) || [])[1] || '';
      return { u, status: r.status, canon: canon.replace('https://olivesegypt.com', BASE) };
    } catch (e) { return { u, status: 'error ' + e.message, canon: '' }; }
  });
  const notOk = pages.filter((p) => p.status !== 200);
  const badCanon = pages.filter((p) => p.status === 200 && p.canon !== p.u);
  if (notOk.length) fail('Every sitemap page answers 200', notOk.slice(0, 8).map((p) => `${p.u} → ${p.status}`).join('; '));
  else ok('Every sitemap page answers 200', `${pages.length} pages`);
  if (badCanon.length) fail('Every page names itself as canonical', badCanon.slice(0, 8).map((p) => `${p.u} says ${p.canon || '(none)'}`).join('; '));
  else ok('Every page names itself as canonical', `${pages.length} pages`);

  // The slash-less form of each page redirects once, permanently, to it (#337).
  const slashless = urls.filter((u) => u.endsWith('/') && new URL(u).pathname !== '/' && new URL(u).pathname !== '/ar/');
  const redirs = await pool(slashless, 6, async (u) => {
    const from = u.replace(/\/$/, '');
    try { const r = await get(from, { method: 'HEAD' }); return { from, u, status: r.status, loc: new URL(r.location || 'x:', from).href }; }
    catch (e) { return { from, u, status: 'error', loc: '' }; }
  });
  const badRedir = redirs.filter((r) => ![301, 308].includes(r.status) || r.loc !== r.u);
  if (badRedir.length) fail('/page redirects to /page/', badRedir.slice(0, 8).map((r) => `${r.from} → ${r.status} ${r.loc}`).join('; '));
  else ok('/page redirects to /page/', `${redirs.length} pages, one permanent redirect each`);

  // HTTPS and www.
  try {
    const r = await get(BASE.replace('https://', 'http://') + '/', { method: 'HEAD' });
    if ([301, 308].includes(r.status) && r.location.startsWith('https://')) ok('http:// redirects to https://');
    else fail('http:// redirects to https://', `HTTP ${r.status} ${r.location}`);
  } catch (e) { fail('http:// redirects to https://', e.message); }
  if (BASE === 'https://olivesegypt.com') {
    try {
      const r = await get('https://www.olivesegypt.com/', { method: 'HEAD' });
      if ([301, 308].includes(r.status) && /^https:\/\/olivesegypt\.com\/?$/.test(r.location)) ok('www.olivesegypt.com redirects to olivesegypt.com');
      else if (r.status === 200) pending('www.olivesegypt.com redirects to olivesegypt.com', 'www loads but does not redirect: set olivesegypt.com as the primary domain in Netlify');
      else pending('www.olivesegypt.com redirects to olivesegypt.com', `HTTP ${r.status} ${r.location}`);
    } catch (e) {
      pending('www.olivesegypt.com redirects to olivesegypt.com', `does not load (${(e.cause && e.cause.code) || e.message}): GoDaddy CNAME www → stirring-manatee-ca2643.netlify.app, and Netlify domain alias www.olivesegypt.com`);
    }
  }

  // Security headers, and Google Analytics only after consent.
  const home = await get(BASE + '/');
  const csp = home.headers.get('content-security-policy') || '';
  if (!csp) fail('Content-Security-Policy header', 'missing');
  else if (!/googletagmanager\.com/.test(csp)) fail('Content-Security-Policy header', 'present, but does not allow Google Analytics (googletagmanager.com)');
  else ok('Content-Security-Policy header', 'present, allows Google Analytics');
  for (const h of ['strict-transport-security', 'x-content-type-options', 'referrer-policy']) {
    if (home.headers.get(h)) ok(`${h} header`); else fail(`${h} header`, 'missing');
  }
  if (/<script[^>]+googletagmanager\.com\/gtag\/js/.test(home.body)) fail('Google Analytics waits for consent', 'the homepage loads gtag.js before any choice');
  else ok('Google Analytics waits for consent', 'no gtag.js in the page as served; consent.js adds it after Accept');

  // Internal material is not published (scripts/prune-publish.js).
  for (const p of ['/docs/deployment-record.md', '/scripts/prune-publish.js', '/.github/workflows/live-check.yml']) {
    const r = await get(BASE + p, { method: 'HEAD' });
    if (r.status === 404) ok(`${p} is not published`); else fail(`${p} is not published`, `HTTP ${r.status}`);
  }

  // A retired address still lands on its olive type; an unknown one is a 404.
  const old = await get(BASE + '/products/aggizi-green-olives', { method: 'HEAD' });
  if (old.status === 301 && /\/products\/green-olives\/?$/.test(old.location)) ok('Retired cultivar address redirects to its type');
  else fail('Retired cultivar address redirects to its type', `HTTP ${old.status} ${old.location}`);
  const nf = await get(BASE + '/this-page-does-not-exist/', { method: 'HEAD' });
  if (nf.status === 404) ok('Unknown address answers 404'); else fail('Unknown address answers 404', `HTTP ${nf.status}`);

  // Umami: the tracker that consent.js loads after Accept must be reachable by
  // a visitor. On 2026-10-12 the Umami site was found behind Netlify's
  // team-login protection: every address, script.js included, answered 401
  // with a redirect to app.netlify.com/edge-access, so no visit reached Umami
  // and nothing on the site said so.
  const umamiSrc = (fs.readFileSync(path.join(ROOT, 'assets/consent.js'), 'utf8').match(/UMAMI_SRC = '([^']+)'/) || [])[1];
  if (!umamiSrc) fail('Umami tracker is reachable', 'UMAMI_SRC not found in assets/consent.js');
  else {
    try {
      const r = await get(umamiSrc);
      const js = /javascript/.test(r.headers.get('content-type') || '') && !/edge-access/.test(r.body);
      if (r.status === 200 && js) ok('Umami tracker is reachable', new URL(umamiSrc).host);
      else if (/edge-access/.test(r.body) || r.status === 401) fail('Umami tracker is reachable', `HTTP ${r.status}: the Umami site is behind Netlify's login protection, so no visit is recorded. Netlify → umami site → Site configuration → Access & security → Visitor access → no protection`);
      else fail('Umami tracker is reachable', `HTTP ${r.status} ${r.headers.get('content-type') || ''}`);
    } catch (e) { fail('Umami tracker is reachable', e.message); }
  }

  // Report.
  const icon = { OK: '✅', FAIL: '❌', PENDING: '⏳' };
  const lines = results.map(([lvl, name, d]) => `${icon[lvl]} **${lvl}** ${name}${d ? ` — ${d}` : ''}`);
  const counts = ['OK', 'FAIL', 'PENDING'].map((l) => `${results.filter((r) => r[0] === l).length} ${l}`).join(', ');
  const report = `## Live check of ${BASE}\n\n${counts}\n\n${lines.join('\n')}\n`;
  console.log(report);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, report);
  process.exit(results.some((r) => r[0] === 'FAIL') ? 1 : 0);
}

main().catch((e) => { console.error('live-check crashed:', e); process.exit(2); });
