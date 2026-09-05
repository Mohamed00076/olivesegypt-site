#!/usr/bin/env node
'use strict';

/*
 * Gated-guide access control.
 *
 *   node scripts/check-guide-gate.js        (part of `npm test`)
 *
 * Runs entirely offline: the database driver is stubbed, so leads.js can be
 * exercised without a connection string and nothing leaves the machine.
 *
 * Why this file exists: docs/downloads-and-gating.md §3 recorded that the
 * three "gated" guides were static HTML at guessable URLs and the form only
 * revealed a link client-side -- the gate recorded a lead from whoever chose
 * to fill it and let everyone else walk straight in. The fix moves the pages
 * into the functions bundle behind a signed token. A gate is worth exactly
 * what its checks are worth, so the interesting cases here are the refusals,
 * not the happy path: wrong guide, expired, tampered, a valid *session*
 * token reused as a guide token, and a missing secret.
 */

const fs = require('fs');
const path = require('path');
const Module = require('module');

const ROOT = path.join(__dirname, '..');
const FN = path.join(ROOT, 'netlify', 'functions');

// ---- stub the database driver before anything requires it ----------------
const neonId = require.resolve('@neondatabase/serverless');
const queries = [];
function fakeSql(strings) {
  const text = Array.isArray(strings) ? strings.join('?') : String(strings);
  queries.push(text);
  return Promise.resolve(/count\(/i.test(text) ? [{ n: 0 }] : []);
}
fakeSql.query = (text) => { queries.push(text); return Promise.resolve([]); };
require.cache[neonId] = new Module(neonId, null);
require.cache[neonId].filename = neonId;
require.cache[neonId].loaded = true;
require.cache[neonId].exports = { neon: () => fakeSql };

const T = require(path.join(FN, '_guide_token.js'));
const { signSession } = require(path.join(FN, '_lib.js'));

const SECRET = 'test-secret-not-a-real-one';
let pass = 0, fail = 0;
const t = (name, cond, extra) => {
  cond ? pass++ : fail++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : '   <-- ' + (extra === undefined ? '' : extra)}`);
};

function freshGuide(env) {
  for (const k of ['SESSION_SECRET']) delete process.env[k];
  Object.assign(process.env, env || {});
  delete require.cache[require.resolve(path.join(FN, 'guide.js'))];
  return require(path.join(FN, 'guide.js'));
}

function get(mod, requestPath, { cookie, query } = {}) {
  return mod.handler({
    httpMethod: 'GET',
    path: requestPath,
    headers: cookie ? { cookie } : {},
    queryStringParameters: query || {},
  });
}

(async () => {
  // ---- 1. no static copy survives in the publish root --------------------
  const leaked = ['downloads', 'ar/downloads'].flatMap((base) =>
    ['buyers-guide', 'origin-comparison-guide', 'pricing-packaging-guide']
      .map((slug) => path.join(ROOT, base, slug, 'index.html'))
      .filter((f) => fs.existsSync(f))
  );
  t('no gated guide is still a static file in the publish root', leaked.length === 0, leaked.join(', '));

  const bundled = ['en', 'ar'].flatMap((loc) =>
    Object.values(T.GUIDES).map((slug) => path.join(FN, '_guides', loc, `${slug}.html`))
  );
  t('all six guides are present in the functions bundle',
    bundled.every((f) => fs.existsSync(f)),
    bundled.filter((f) => !fs.existsSync(f)).join(', '));

  // ---- 2. netlify.toml routes every guide path at the function -----------
  const toml = fs.readFileSync(path.join(ROOT, 'netlify.toml'), 'utf8');
  const wanted = [];
  for (const slug of Object.values(T.GUIDES)) {
    for (const base of ['/downloads', '/ar/downloads']) {
      wanted.push(`${base}/${slug}`, `${base}/${slug}/`);
    }
  }
  const missingRule = wanted.filter((r) => !toml.includes(`from = "${r}"`));
  t('netlify.toml rewrites all 12 guide paths (bare and trailing slash)',
    missingRule.length === 0, missingRule.join(', '));
  // A rule without force = true loses to any file that ever reappears at
  // that path, which is the exact failure being fixed.
  const guideRuleBlock = toml.slice(toml.indexOf('/downloads/buyers-guide'), toml.indexOf('# The publish directory is the repo root'));
  t('every guide rewrite is force = true',
    (guideRuleBlock.match(/force = true/g) || []).length === 12,
    (guideRuleBlock.match(/force = true/g) || []).length);
  t('function sources are not served as static files', toml.includes('from = "/netlify/*"'));

  // ---- 3. token layer ----------------------------------------------------
  const good = T.signGuideToken('buyers_guide', SECRET, 3600);
  t('a freshly signed token verifies to its own guide', T.verifyGuideToken(good, SECRET) === 'buyers_guide');
  t('a token signed with a different secret is refused', T.verifyGuideToken(good, 'other-secret') === null);
  t('an expired token is refused', T.verifyGuideToken(T.signGuideToken('buyers_guide', SECRET, -1), SECRET) === null);
  // Tamper with the FIRST character of the signature, not the last. The
  // last base64url character of a 32-byte signature carries only 4
  // significant bits, so 'A' and 'B' there decode to identical bytes -- an
  // earlier version of this assertion flipped the last character and
  // therefore passed a valid token to verify roughly one run in sixty-four.
  const sigStart = good.indexOf('.') + 1;
  const swapped = good[sigStart] === 'a' ? 'b' : 'a';
  t('a token with a tampered signature is refused',
    T.verifyGuideToken(good.slice(0, sigStart) + swapped + good.slice(sigStart + 1), SECRET) === null);
  t('a token with a tampered payload is refused',
    T.verifyGuideToken('x' + good.slice(1), SECRET) === null);
  t('an unknown segment cannot be signed', T.signGuideToken('not_a_guide', SECRET, 3600) === null);
  t('garbage is refused rather than throwing', T.verifyGuideToken('....', SECRET) === null);
  t('no token is issued without a secret', T.signGuideToken('buyers_guide', '', 3600) === null);

  // Key separation: admin/CRM sessions use the same HMAC-SHA256 and the same
  // payload.signature shape against the raw SESSION_SECRET. Without the
  // derived key in _guide_token.js the two would be interchangeable.
  t('an admin session token does not double as a guide token',
    T.verifyGuideToken(signSession('admin', SECRET), SECRET) === null);

  // ---- 4. the function's refusals ----------------------------------------
  const guide = freshGuide({ SESSION_SECRET: SECRET });

  let res = await get(guide, '/downloads/buyers-guide');
  t('no token -> 403', res.statusCode === 403, res.statusCode);
  t('   the refusal is a real page, not a bare status', /<h1/.test(res.body));
  t('   the refusal is never cached', /no-store/.test(res.headers['Cache-Control']));

  res = await get(guide, '/downloads/buyers-guide', { cookie: `${T.COOKIE_NAME}=${T.signGuideToken('pricing_guide', SECRET, 3600)}` });
  t('a token for another guide -> 403', res.statusCode === 403, res.statusCode);

  res = await get(guide, '/downloads/buyers-guide', { cookie: `${T.COOKIE_NAME}=${T.signGuideToken('buyers_guide', SECRET, -1)}` });
  t('an expired token -> 403', res.statusCode === 403, res.statusCode);

  res = await get(guide, '/ar/downloads/buyers-guide');
  t('an Arabic refusal is served in Arabic', /lang="ar"/.test(res.body) && /dir="rtl"/.test(res.body));

  res = await guide.handler({ httpMethod: 'POST', path: '/downloads/buyers-guide', headers: {}, queryStringParameters: {} });
  t('POST is rejected', res.statusCode === 405, res.statusCode);

  // ---- 5. the function's grants ------------------------------------------
  const cookieOk = `${T.COOKIE_NAME}=${T.signGuideToken('buyers_guide', SECRET, 3600)}`;
  res = await get(guide, '/downloads/buyers-guide', { cookie: cookieOk });
  const real = fs.readFileSync(path.join(FN, '_guides', 'en', 'buyers-guide.html'), 'utf8');
  t('a valid cookie token -> 200 with the guide itself', res.statusCode === 200 && res.body === real, res.statusCode);
  t('   the guide is never cached by a shared cache', /private/.test(res.headers['Cache-Control']));

  res = await get(guide, '/ar/downloads/pricing-packaging-guide', {
    cookie: `${T.COOKIE_NAME}=${T.signGuideToken('pricing_guide', SECRET, 3600)}`,
  });
  t('the Arabic guide is served for an Arabic path',
    res.statusCode === 200 && res.body === fs.readFileSync(path.join(FN, '_guides', 'ar', 'pricing-packaging-guide.html'), 'utf8'));

  res = await get(guide, '/downloads/origin-comparison-guide', {
    query: { t: T.signGuideToken('origin_guide', SECRET, 3600) },
  });
  t('the ?t= fallback works for a cookie-blocked browser', res.statusCode === 200, res.statusCode);

  res = await get(guide, '/downloads/buyers-guide/', { cookie: cookieOk });
  t('the trailing-slash form resolves to the same guide', res.statusCode === 200, res.statusCode);

  // ---- 6. misconfiguration fails closed ----------------------------------
  const noSecret = freshGuide({});
  res = await get(noSecret, '/downloads/buyers-guide', { cookie: cookieOk });
  t('SESSION_SECRET unset -> 503, never an ungated 200', res.statusCode === 503, res.statusCode);
  t('   and the guide body is not in the response', !res.body.includes('B2B Buyer'));

  // ---- 7. leads.js issues the grant --------------------------------------
  process.env.DATABASE_URL = 'postgres://stub';
  process.env.SESSION_SECRET = SECRET;
  delete process.env.LEADS_NOTIFY;
  delete require.cache[require.resolve(path.join(FN, 'leads.js'))];
  const leads = require(path.join(FN, 'leads.js'));

  const post = (over) => leads.handler({
    httpMethod: 'POST',
    headers: { 'x-nf-client-connection-ip': '198.51.100.7' },
    body: JSON.stringify(Object.assign({
      email: 'buyer@example.com', company_name: 'Example Imports',
      country_region: 'Spain', buyer_type: 'importer', consent: true,
      source_page: '/downloads', segment: 'buyers_guide',
    }, over)),
  });

  let out = await post();
  let payload = JSON.parse(out.body);
  t('a guide lead comes back with a URL token', out.statusCode === 200 && !!payload.guide_token, out.body);
  t('   and sets the HttpOnly cookie', /HttpOnly/.test(out.headers['Set-Cookie'] || ''), out.headers['Set-Cookie']);
  t('   the cookie token unlocks the guide it was asked for',
    T.verifyGuideToken((out.headers['Set-Cookie'] || '').split(';')[0].split('=')[1], SECRET) === 'buyers_guide');
  t('   the URL token is the shorter-lived of the two',
    T.URL_TTL_SECONDS < T.COOKIE_TTL_SECONDS);

  out = await post({ segment: 'market_report' });
  payload = JSON.parse(out.body);
  t('a non-guide lead gets no token and no cookie',
    out.statusCode === 200 && !payload.guide_token && !out.headers['Set-Cookie'], out.body);

  // The honeypot's fake success must stay fake: a bot that fills the hidden
  // field is answered with ok:true and nothing else.
  out = await post({ website: 'http://spam.example' });
  payload = JSON.parse(out.body);
  t('a honeypot hit gets no token', payload.ok === true && !payload.guide_token && !out.headers['Set-Cookie']);

  // A lead is a lead even when the gate cannot be operated; it just does not
  // hand out a guide, and guide.js refuses rather than serving ungated.
  delete process.env.SESSION_SECRET;
  const quiet = console.error; console.error = () => {};
  out = await post();
  console.error = quiet;
  payload = JSON.parse(out.body);
  t('with no secret the lead still saves but no token is issued',
    out.statusCode === 200 && payload.ok === true && !payload.guide_token && !out.headers['Set-Cookie'], out.body);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('ERROR', e); process.exit(1); });
