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
 * Each line is OK, WARN, FAIL or PENDING. FAIL is something on the site that is
 * wrong and fails the run. WARN is something to act on soon that is not
 * wrong yet (a certificate with under 21 days left); it is reported every
 * run and does not fail it. PENDING is a step that waits on the owner's own
 * accounts (DNS at GoDaddy, Netlify domain settings), reported every run
 * without failing it until it is done.
 *
 * It only reads. It submits no form and sends no email: enquiry delivery is
 * confirmed by the owner with one test enquiry.
 */

const fs = require('fs');
const path = require('path');
const tls = require('tls');

const BASE = (process.env.LIVE_BASE || 'https://olivesegypt.com').replace(/\/$/, '');
const ROOT = path.join(__dirname, '..');
const results = [];
const ok = (name, detail = '') => results.push(['OK', name, detail]);
const fail = (name, detail = '') => results.push(['FAIL', name, detail]);
const warn = (name, detail = '') => results.push(['WARN', name, detail]);
const pending = (name, detail = '') => results.push(['PENDING', name, detail]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// The certificate a visitor's browser is shown for a host: its expiry date.
function certExpiry(host) {
  return new Promise((resolve, reject) => {
    const sock = tls.connect({ host, port: 443, servername: host, timeout: 15000 }, () => {
      const cert = sock.getPeerCertificate();
      sock.end();
      resolve(new Date(cert.valid_to));
    });
    sock.on('timeout', () => { sock.destroy(); reject(new Error('timed out')); });
    sock.on('error', reject);
  });
}

/*
 * One request, tried a second time if the connection itself fails -- no
 * reply at all, not a wrong one -- or if no reply has come within
 * REQUEST_LIMIT_MS (30 seconds; owner, 2026-10-21). A request with no time
 * limit could wait for ever on a connection that neither answered nor
 * dropped, which is how one run outlasted its own five-minute limit. A dropped connection on the checker's side
 * ("fetch failed" on one random page per run, a different page each time,
 * Deploys 267 to 269) is not the site failing; a second failure is reported
 * as before. Any HTTP status, right or wrong, is answered first time.
 */
const REQUEST_LIMIT_MS = Number(process.env.LIVE_REQUEST_LIMIT_MS) || 30000;
let retried = 0;
async function get(url, opts = {}) {
  for (let attempt = 1; ; attempt++) {
    try {
      // The limit covers the whole reply, body included.
      const res = await fetch(url, { redirect: 'manual', headers: { 'user-agent': 'olivesegypt-live-check' }, signal: AbortSignal.timeout(REQUEST_LIMIT_MS), ...opts });
      const body = opts.method === 'HEAD' ? '' : opts.binary ? Buffer.from(await res.arrayBuffer()) : await res.text();
      return { status: res.status, location: res.headers.get('location') || '', headers: res.headers, body };
    } catch (e) {
      if (attempt >= 2) {
        if (e && e.name === 'TimeoutError') throw new Error(`no reply within ${REQUEST_LIMIT_MS / 1000} seconds, twice`);
        throw e;
      }
      retried++;
      await sleep(2000);
    }
  }
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
    // Reached when there is no commit to compare against -- a run outside
    // GitHub Actions, which sets GITHUB_SHA -- or a site from before the
    // marker existed. It said "no deploy marker yet" in both cases, which
    // read as the site missing its marker when only the expected commit was.
    if (same) return ok('Live sitemap matches main', want ? 'no deploy marker on the live site, so compared by sitemap' : 'no commit to compare against outside GitHub Actions, so compared by sitemap');
    if (Date.now() >= deadline) return fail('Live sitemap matches main', 'the live sitemap differs from main: the latest merge may not have deployed');
    await sleep(30000);
  }
}

async function pool(items, n, fn) {
  const out = []; let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k]); } }));
  return out;
}

/*
 * What a page's HTML says about access, without a browser: [key, detail]
 * for each problem. Kept deliberately simple -- it reads the served markup
 * as scripts/check-*.js read the files -- so a WARN here means "look", and
 * the browser scans in the PR history say how it renders.
 */
function a11yProblems(html, u) {
  const out = [];
  const isAr = /\/ar(\/|$)/.test(new URL(u).pathname);
  const vp = (html.match(/<meta[^>]+name="viewport"[^>]*>/) || [''])[0];
  if (/user-scalable\s*=\s*(no|0)/i.test(vp) || /maximum-scale\s*=\s*1(\.0)?\b/i.test(vp)) out.push(['zoom', 'blocks zoom (viewport)']);
  const htmlTag = (html.match(/<html\b[^>]*>/i) || [''])[0];
  if (isAr ? !(/\blang="ar"/.test(htmlTag) && /\bdir="rtl"/.test(htmlTag)) : !/\blang="en/.test(htmlTag)) out.push(['lang', `<html> says ${htmlTag.replace(/^<html\s*|>$/g, '') || '(nothing)'}`]);
  const body = html.replace(/<(script|style|svg|template|noscript)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<div\b[^>]*aria-hidden="true"[^>]*>(?:(?!<div\b)[\s\S])*?<\/div>/g, ' ');
  // a name can also come from inside: an image's alt, or an inner element's aria-label or title
  const text = (s) => s.replace(/<img\b[^>]*\balt="([^"]+)"[^>]*>/gi, ' $1 ').replace(/<[^>]*\b(?:aria-label|title)="([^"]+)"[^>]*>/gi, ' $1 ')
    .replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, 'x').trim();
  const attr = (tag, a) => { const m = tag.match(new RegExp(`\\b${a}="([^"]*)"`)); return m ? m[1] : null; };
  for (const m of body.matchAll(/<(input|select|textarea)\b[^>]*>/gi)) {
    const tag = m[0]; const type = (attr(tag, 'type') || '').toLowerCase();
    if (['hidden', 'submit', 'button', 'reset', 'image'].includes(type)) continue;
    const id = attr(tag, 'id');
    const before = body.slice(0, m.index);
    const wrapped = before.lastIndexOf('<label') > before.lastIndexOf('</label>');
    const named = (attr(tag, 'aria-label') || '').trim() || attr(tag, 'aria-labelledby') || (attr(tag, 'title') || '').trim() ||
      (id && new RegExp(`<label\\b[^>]*\\bfor="${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`).test(body)) || wrapped;
    if (!named) out.push(['field', `${m[1].toLowerCase()}${id ? '#' + id : ''}${attr(tag, 'placeholder') ? ` ("${attr(tag, 'placeholder')}" only as placeholder)` : ''}`]);
  }
  for (const m of body.matchAll(/<(button|a)\b([^>]*)>([\s\S]*?)<\/\1>/gi)) {
    if (m[1].toLowerCase() === 'a' && !/\bhref=/.test(m[2])) continue;
    if (/aria-hidden="true"/.test(m[2])) continue;
    if (!text(m[3]) && !(attr(m[2], 'aria-label') || '').trim() && !attr(m[2], 'aria-labelledby') && !(attr(m[2], 'title') || '').trim()) out.push(['control', `<${m[1].toLowerCase()}${attr(m[2], 'id') ? '#' + attr(m[2], 'id') : ''}> with no name`]);
  }
  for (const m of body.matchAll(/<img\b[^>]*>/gi)) if (attr(m[0], 'alt') === null) out.push(['img', `img ${attr(m[0], 'src') || ''} has no alt`]);
  if (/<header\b/.test(html) && !/<script[^>]+src="\/assets\/site-nav\.js"/.test(html)) out.push(['focus', 'no site-nav.js']);
  return out;
}

async function main() {
  await checkDeployed(process.argv.includes('--wait'));

  // Every sitemap page: 200 at its own address, canonical pointing at itself.
  const pages = await pool(urls, 6, async (u) => {
    try {
      const r = await get(u);
      const canon = (r.body.match(/<link rel="canonical" href="([^"]*)"/) || [])[1] || '';
      return { u, status: r.status, canon: canon.replace('https://olivesegypt.com', BASE), a11y: r.status === 200 ? a11yProblems(r.body, u) : null };
    } catch (e) { return { u, status: 'error ' + e.message, canon: '' }; }
  });
  const notOk = pages.filter((p) => p.status !== 200);
  const badCanon = pages.filter((p) => p.status === 200 && p.canon !== p.u);
  if (notOk.length) fail('Every sitemap page answers 200', notOk.slice(0, 8).map((p) => `${p.u} → ${p.status}`).join('; '));
  else ok('Every sitemap page answers 200', `${pages.length} pages`);
  if (badCanon.length) fail('Every page names itself as canonical', badCanon.slice(0, 8).map((p) => `${p.u} says ${p.canon || '(none)'}`).join('; '));
  else ok('Every page names itself as canonical', `${pages.length} pages`);

  // Accessibility, from the pages just fetched (no extra requests). Zoom
  // blocked or the wrong language/direction fails; a field, button, link or
  // image a screen reader cannot name warns (owner, 2026-10-23).
  const served = pages.filter((p) => p.a11y);
  const A11Y = [
    ['zoom', 'Pages let visitors zoom', fail], ['lang', 'Pages declare their language and direction', fail],
    ['field', 'Every form field has a name a screen reader can say', warn], ['control', 'Every button and link has a name', warn],
    ['img', 'Every image has alt text (empty for decoration)', warn], ['focus', 'Pages load the site script that draws the focus ring', warn],
  ];
  for (const [key, title, bad] of A11Y) {
    const hits = served.flatMap((p) => p.a11y.filter((x) => x[0] === key).map((x) => `${new URL(p.u).pathname} ${x[1]}`));
    if (hits.length) bad(title, `${hits.length}: ` + hits.slice(0, 6).join('; ') + (hits.length > 6 ? '; …' : ''));
    else ok(title, `${served.length} pages`);
  }

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

  // Private data stays private. Every API route in netlify.toml is either
  // probed here -- a GET with no session and with a forged one, at its /api
  // address and at the /.netlify/functions address that skips the redirect
  // rules, each of which must be refused -- or listed below as not probed,
  // with the reason. Only GETs are sent: nothing is written, deleted or
  // logged into. A route added to netlify.toml and to neither list fails.
  const PROTECTED = ['/api/inquiries', '/api/leads', '/api/consent', '/api/analytics',
    '/api/analytics-report', '/api/analytics-settings', '/api/analytics-privacy', '/api/crm/auth/me',
    '/api/crm/client-failure', '/api/crm/environment',
    '/api/crm/buyers', '/api/crm/activity', '/api/crm/dashboard', '/api/crm/csv', '/api/crm/data-quality',
    '/api/crm/documents', '/api/crm/buyer-files', '/api/kpi-definitions', '/api/kpi-values', '/api/kpi-dashboard'];
  const NOT_PROBED = {
    '/api/auth/me': 'answers {"authenticated":false} to anyone not signed in, by design',
    '/api/unsubscribe': 'public by design; its admin list (?list=1) is probed below',
    '/api/analytics-collect': 'receives consented visits; POST only',
    '/api/auth/login': 'sign-in; POST only', '/api/auth/logout': 'POST only',
    '/api/crm/auth/login': 'sign-in; POST only', '/api/crm/auth/logout': 'POST only',
    '/api/crm/auth/forgot': 'POST only', '/api/crm/auth/reset': 'POST only',
  };
  const toml = fs.readFileSync(path.join(ROOT, 'netlify.toml'), 'utf8');
  const routes = [...toml.matchAll(/from = "(\/api\/[^"]+)"\s*\n\s*to = "(\/\.netlify\/functions\/[^"]+)"/g)].map((m) => ({ api: m[1], fn: m[2] }));
  const unlisted = routes.filter((r) => !PROTECTED.includes(r.api) && !NOT_PROBED[r.api]).map((r) => r.api);
  if (unlisted.length) fail('Every API route is checked for private data', `not in check-live.js: ${unlisted.join(', ')}`);
  const probes = [];
  for (const r of routes.filter((x) => PROTECTED.includes(x.api))) {
    const q = r.api === '/api/leads' ? ['', '?export=market_report'] : [''];
    for (const s of q) probes.push(r.api + s, r.fn + s);
  }
  probes.push('/api/unsubscribe?list=1', (routes.find((r) => r.api === '/api/unsubscribe') || { fn: '/api/unsubscribe' }).fn + '?list=1');
  const FORGED = 'tc_session=eyJhbGciOiJub25lIn0.eyJzdWIiOiJhZG1pbiIsInJvbGUiOiJhZG1pbiJ9.; tc_crm_session=forged.forged.forged';
  const open = (await pool(probes.flatMap((p) => [[p, ''], [p, FORGED]]), 6, async ([p, cookie]) => {
    try { const r = await get(BASE + p, cookie ? { headers: { 'user-agent': 'olivesegypt-live-check', cookie } } : {}); return [401, 403].includes(r.status) ? null : `${p} (${cookie ? 'forged session' : 'no session'}) → HTTP ${r.status}`; }
    catch (e) { return `${p} → ${e.message}`; }
  })).filter(Boolean);
  if (open.length) fail('Private data refuses visitors who are not signed in', open.slice(0, 8).join('; '));
  else ok('Private data refuses visitors who are not signed in', `${probes.length} addresses, each with no session and a forged one`);

  // HTTPS certificates. Netlify renews them by itself; a renewal that fails
  // (a DNS record changed at GoDaddy, a domain removed in Netlify) shows
  // only when browsers start refusing the site. Warn two weeks ahead.
  const hosts = BASE === 'https://olivesegypt.com' ? ['olivesegypt.com', 'www.olivesegypt.com'] : [new URL(BASE).host];
  for (const host of hosts) {
    try {
      const until = await certExpiry(host);
      const days = Math.floor((until - Date.now()) / 86400000);
      const when = until.toISOString().slice(0, 10);
      // OK from 21 days; WARN from 14 to 20, which does not fail the run; FAIL under 14.
      if (days >= 21) ok(`HTTPS certificate for ${host} is current`, `valid to ${when}, ${days} days`);
      else if (days >= 14) warn(`HTTPS certificate for ${host} is current`, `expires ${when}, in ${days} days: not failing yet (it fails under 14 days); if it is not renewed soon, check Netlify → Domain management → HTTPS`);
      else fail(`HTTPS certificate for ${host} is current`, `expires ${when}, in ${days} days: Netlify has not renewed it (Netlify → Domain management → HTTPS → Renew certificate)`);
    } catch (e) { fail(`HTTPS certificate for ${host} is current`, e.message); }
  }

  // Umami itself, not only its tracker file: the address visits are sent to
  // and the heartbeat Umami answers when its app and database are up.
  if (umamiSrc) {
    const umami = new URL(umamiSrc).origin;
    try {
      const r = await get(umami + '/api/heartbeat');
      if (r.status === 200 && /"ok"\s*:\s*true/.test(r.body)) ok('Umami is up', new URL(umami).host);
      else fail('Umami is up', `heartbeat answered HTTP ${r.status}: visits are not being recorded (Netlify → umami site → Deploys and Logs)`);
    } catch (e) { fail('Umami is up', e.message); }
  }

  // The public PDFs as served: each is the file in this checkout, byte for
  // byte, and keeps its structure -- tagged, its language, bookmarks, a shown
  // title, every figure described (scripts/check-pdf-structure.js, the same
  // rules npm test holds the repository to). The gated guides and export
  // catalogue are served by a function after the form, so are left to npm test
  // (owner, 2026-10-25).
  {
    const crypto = require('crypto');
    const { JOBS } = require('./guide-pdfs');
    const { problemsOf } = require('./check-pdf-structure');
    const pub = JOBS.filter((j) => j.public);
    const bad = (await pool(pub, 6, async (job) => {
      try {
        // Through get(), so a dropped connection or a slow reply is retried
        // once like every other request here (a first version fetched
        // directly and failed a run on one 30-second timeout, 2026-10-25).
        const res = await get(`${BASE}/${job.out}`, { binary: true });
        if (res.status !== 200) return `/${job.out}: HTTP ${res.status}`;
        const buf = res.body;
        const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
        if (sha(buf) !== sha(fs.readFileSync(path.join(ROOT, job.out)))) return `/${job.out}: not the file in main`;
        const found = problemsOf(job, buf);
        return found.length ? `/${job.out}: ${found.join('; ')}` : null;
      } catch (e) { return `/${job.out}: ${e.message}`; }
    })).filter(Boolean);
    if (bad.length) fail('Public PDFs are the files in main, tagged and in their language', bad.slice(0, 6).join(' | '));
    else ok('Public PDFs are the files in main, tagged and in their language', `${pub.length} PDFs, with bookmarks and every figure described`);
  }

  // Report.
  const icon = { OK: '✅', WARN: '⚠️', FAIL: '❌', PENDING: '⏳' };
  const lines = results.map(([lvl, name, d]) => `${icon[lvl]} **${lvl}** ${name}${d ? ` — ${d}` : ''}`);
  const counts = ['OK', 'WARN', 'FAIL', 'PENDING'].map((l) => `${results.filter((r) => r[0] === l).length} ${l}`).join(', ');
  // Retries are said, not hidden: many in one run would mean something.
  const retriedNote = retried ? `\n\n${retried} request${retried === 1 ? '' : 's'} retried once after a dropped connection or no reply within ${REQUEST_LIMIT_MS / 1000} seconds.` : '';
  const report = `## Live check of ${BASE}\n\n${counts}${retriedNote}\n\n${lines.join('\n')}\n`;
  console.log(report);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, report);
  process.exit(results.some((r) => r[0] === 'FAIL') ? 1 : 0);
}

main().catch((e) => { console.error('live-check crashed:', e); process.exit(2); });
