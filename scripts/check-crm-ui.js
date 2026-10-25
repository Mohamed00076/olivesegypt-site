#!/usr/bin/env node
'use strict';

/*
 * The CRM says when something failed, in the page, and records it
 * (Batch 1 of the owner's CRM audit, 2026-10-20).
 *
 *   node scripts/check-crm-ui.js        (part of `npm test`)
 *
 * What the owner asked for, and what this holds every CRM page to:
 *   - a failed load is a banner in the page, in plain words, read out by
 *     screen readers (role=alert, aria-live), with Retry -- never an empty
 *     page, never "Nothing received yet", never a bare "Server error";
 *   - every failed load is recorded server-side and alerted like other
 *     failures, exactly once: the page reports what the server never saw
 *     (no reply, a refusal), and leaves a 5xx to the function that already
 *     recorded it;
 *   - dates read "20 Oct 2026", the stored values untouched;
 *   - the sign-in, forgot, reset and change-password pages are not touched:
 *     they do not load the new stylesheet or script, and every new style is
 *     scoped to a .crm-ui- class.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const Module = require('module');

const ROOT = path.join(__dirname, '..');
const FN = path.join(ROOT, 'netlify', 'functions');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

let pass = 0, fail = 0;
const t = (name, cond, extra) => {
  cond ? pass++ : fail++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : '   <-- ' + (extra === undefined ? '' : extra)}`);
};

// ---- the helpers, run against a stand-in page -------------------------------
const posted = [];
function el(tag) {
  const node = {
    tagName: tag, children: [], attrs: {}, className: '', textContent: '', type: '', listeners: {},
    setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return this.attrs[k]; },
    appendChild(c) { c.parentNode = this; this.children.push(c); return c; },
    insertBefore(c, ref) { c.parentNode = this; const i = this.children.indexOf(ref); i < 0 ? this.children.push(c) : this.children.splice(i, 0, c); return c; },
    remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter((x) => x !== this); },
    addEventListener(ev, fn) { (this.listeners[ev] = this.listeners[ev] || []).push(fn); },
    click() { (this.listeners.click || []).forEach((f) => f({})); },
    querySelectorAll() { return this.children.filter((c) => /crm-ui-banner/.test(c.className)); },
    get firstChild() { return this.children[0] || null; },
  };
  return node;
}
const box = {
  window: { location: { pathname: '/crm/buyers/' } },
  document: { createElement: el, addEventListener() {}, readyState: 'complete' },
  fetch: (url, opts) => { posted.push({ url, body: JSON.parse(opts.body) }); return Promise.resolve({}); },
  console,
};
box.window.document = box.document;
vm.createContext(box);
try { vm.runInContext(read('assets/crm.js'), box); } catch (e) { /* DOM wiring at the bottom */ }
const CRM = box.window.CRM;

// dates
t('"20 Oct 2026" for a calendar date', CRM.fmtDate('2026-10-20') === '20 Oct 2026', CRM.fmtDate('2026-10-20'));
t('   and for one sent as midnight UTC, without slipping a day', CRM.fmtDate('2026-10-17T00:00:00.000Z') === '17 Oct 2026', CRM.fmtDate('2026-10-17T00:00:00.000Z'));
t('   a timestamp shows its day', /^\d{1,2} (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4}$/.test(CRM.fmtDate('2026-10-20T14:03:00Z')), CRM.fmtDate('2026-10-20T14:03:00Z'));
t('   nothing for nothing, and an unreadable value as it was', CRM.fmtDate(null) === '' && CRM.fmtDate('soon') === 'soon');

// plain words
const res = (status, error) => ({ ok: false, status, data: error === undefined ? {} : { error } });
t('a 5xx never shows the server\'s words', !/Server error/.test(CRM.plainError(res(500, 'Server error'))) && /recorded/.test(CRM.plainError(res(500, 'Server error'))));
t('   nor does a code like "Validation failed" or "Not found"', CRM.plainError(res(400, 'Validation failed'), 'X.') === 'X.' && CRM.plainError(res(404, 'Not found'), 'Y.') === 'Y.');
t('   a sentence the server wrote is kept', CRM.plainError(res(409, 'Q-2026-000041 is void, so nothing can be issued from it.')) === 'Q-2026-000041 is void, so nothing can be issued from it.');
t('   no reply says so', /did not answer/.test(CRM.plainError(new TypeError('Failed to fetch'))));

// recording, exactly once
posted.length = 0;
CRM.reportLoadFailure('buyers-list', new TypeError('Failed to fetch'));
CRM.reportLoadFailure('buyers-list', res(500, 'Server error'));
CRM.reportLoadFailure('buyers-list', res(401, 'Unauthorized'));
CRM.reportLoadFailure('buyers-list', new Error('unauthorized'));
CRM.reportLoadFailure('buyers-list', res(403, 'Forbidden'));
t('a load with no reply is reported', posted[0] && posted[0].url === '/api/crm/client-failure' && posted[0].body.kind === 'no-reply' && posted[0].body.what === 'buyers-list' && posted[0].body.page === '/crm/buyers/', JSON.stringify(posted));
t('   a refused load is reported with its status', posted[1] && posted[1].body.kind === 'refused' && posted[1].body.status === 403, JSON.stringify(posted));
t('   a 5xx is not reported again (the function recorded it), nor is signing in', posted.length === 2, String(posted.length));

// the banner
const container = el('div');
let retried = 0;
const b = CRM.loadError(container, { what: 'the buyer list', key: 'buyers-list', error: res(500, 'Server error'), retry: () => { retried++; } });
t('a failed load puts a banner in the page', b && container.children[0] === b && /crm-ui-banner-error/.test(b.className));
t('   read out by screen readers', b.attrs.role === 'alert' && b.attrs['aria-live'] === 'assertive');
t('   saying what failed, in plain words', /^The buyer list could not be loaded\. /.test(b.children[0].textContent) && !/Server error/.test(b.children[0].textContent), b.children[0].textContent);
const retry = b.children.find((c) => c.tagName === 'button');
t('   with a Retry button that retries', retry && retry.textContent === 'Retry' && (retry.click(), retried === 1) && container.children.length === 0);
CRM.loadError(container, { what: 'a', error: res(500) }); CRM.loadError(container, { what: 'b', error: res(500) });
t('   one banner at a time', container.children.length === 1);
t('   and nothing for the sign-in redirect', CRM.loadError(el('div'), { error: new Error('unauthorized') }) === null);

// ---- every working CRM page uses them -----------------------------------------
const PAGES = {
  'crm/index.html': ['dashboard', 'enquiries'], 'crm/inquiries/index.html': ['enquiries', 'leads'], 'crm/buyers/index.html': ['buyers-list'],
  'crm/buyer/index.html': ['buyer', 'buyer-documents', 'buyer-files'], 'crm/kanban/index.html': ['kanban'],
  'crm/documents/index.html': ['documents-list'], 'crm/document/index.html': ['document-source', 'buyer'],
  'crm/document/view/index.html': ['document'], 'crm/data-quality/index.html': ['data-quality'],
};
const fnSrc = read('netlify/functions/crm-client-failure.js');
for (const [p, keys] of Object.entries(PAGES)) {
  const src = read(p);
  t(`${p}: failed loads are banners, recorded as ${keys.join(', ')}`, keys.every((k) => new RegExp(`key: '${k}'|reportLoadFailure\\('${k}'`).test(src)) && keys.every((k) => fnSrc.includes(`'${k}'`)),
    keys.filter((k) => !src.includes(`'${k}'`)).join(', '));
  t(`   and loads the scoped stylesheet`, src.includes('/assets/crm-ui.css'));
  const code = src.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
  t(`   and never says "Could not load page." with no way forward`, !/Could not load (page|buyers|document)\./.test(code));
}
for (const p of ['crm/login/index.html', 'crm/forgot-password/index.html', 'crm/reset-password/index.html']) {
  const src = read(p);
  t(`${p} is untouched by this work (no crm-ui.css, no CRM script helpers)`, !src.includes('crm-ui.css') && !/CRM\.(ask|loadError|showError)/.test(src));
}
const css = read('assets/crm-ui.css').replace(/\/\*[\s\S]*?\*\//g, '');
const selectors = css.replace(/@media[^{]+\{/g, '').split('}').map((r) => r.split('{')[0].trim()).filter(Boolean);
const unscoped = selectors.filter((sel) => sel.split(',').some((one) => !/\.crm-ui-|table\.crm-ui-cards/.test(one)));
t('every rule in crm-ui.css is scoped to a .crm-ui- class', unscoped.length === 0, unscoped.join(' | '));

// ---- the endpoint that records them -------------------------------------------
(async () => {
  const rows = [];
  const fakeSql = (strings, ...vals) => { const q = strings.join('?'); if (/INSERT INTO crm_failures/.test(q)) rows.push(vals); return Promise.resolve([]); };
  const neonId = require.resolve('@neondatabase/serverless');
  require.cache[neonId] = new Module(neonId, null);
  Object.assign(require.cache[neonId], { filename: neonId, loaded: true, exports: { neon: () => fakeSql } });
  process.env.DATABASE_URL = 'postgres://stub';
  process.env.CRM_SESSION_SECRET = 'test-secret-not-a-real-one';
  delete process.env.RESEND_API_KEY; delete process.env.NOTIFY_EMAIL;
  const { signCrmSession, CRM_COOKIE_NAME } = require(path.join(FN, '_crm_lib.js'));
  const { handler } = require(path.join(FN, 'crm-client-failure.js'));
  const cookie = `${CRM_COOKIE_NAME}=${signCrmSession('staff')}`;
  const quiet = async (fn) => { const e = console.error, l = console.log, w = console.warn; console.error = console.log = console.warn = () => {}; try { return await fn(); } finally { console.error = e; console.log = l; console.warn = w; } };
  const send = (body, c = cookie, method = 'POST') => quiet(() => handler({ httpMethod: method, headers: c ? { cookie: c } : {}, queryStringParameters: {}, body: JSON.stringify(body) }));

  let r = await send({ page: '/crm/buyers/', what: 'buyers-list', kind: 'no-reply', status: null }, null);
  t('the endpoint needs a CRM session', r.statusCode === 401 && rows.length === 0);
  r = await send({}, cookie, 'GET');
  t('   and takes only POST', r.statusCode === 405);
  r = await send({ page: '/crm/buyers/', what: 'buyers-list', kind: 'no-reply', status: null });
  t('a failed load is recorded like any other failure (crm_failures)', r.statusCode === 200 && rows.length === 1 && rows[0][0] === 'crm-page' &&
    rows[0][2] === '/crm/buyers/: buyers-list, no reply from the server' && rows[0][5] === 'staff', JSON.stringify(rows));
  r = await send({ page: '/crm/kanban/', what: 'kanban', kind: 'refused', status: 403 });
  t('   a refusal with its status', r.statusCode === 200 && /kanban, refused by the server \(HTTP 403\)/.test(rows[1] && rows[1][2]), JSON.stringify(rows[1]));
  const before = rows.length;
  const bad = [
    [{ page: '/admin/', what: 'kanban', kind: 'no-reply', status: null }, 'a page outside the CRM'],
    [{ page: '/crm/<script>/', what: 'kanban', kind: 'no-reply', status: null }, 'a path with markup'],
    [{ page: '/crm/x/', what: 'anything I like', kind: 'no-reply', status: null }, 'free text as what failed'],
    [{ page: '/crm/x/', what: 'kanban', kind: 'boom', status: null }, 'an unknown kind'],
    [{ page: '/crm/x/', what: 'kanban', kind: 'refused', status: 500 }, 'a 5xx as a refusal'],
    [{ page: '/crm/x/', what: 'kanban', kind: 'no-reply', status: 200 }, 'a status on no reply'],
  ];
  for (const [body, name] of bad) {
    r = await send(body);
    t('   refused: ' + name, r.statusCode === 400);
  }
  t('   and none of those was recorded', rows.length === before);
  let limited = 0;
  for (let i = 0; i < 40; i++) { r = await send({ page: '/crm/', what: 'dashboard', kind: 'no-reply', status: null }); if (r.statusCode === 429) limited++; }
  t('   at most 30 a minute per instance', limited > 0 && rows.length <= before + 30, `${limited} limited, ${rows.length - before} recorded`);
  t('the route is wired and probed by the live check', /from = "\/api\/crm\/client-failure"/.test(read('netlify.toml')) && read('scripts/check-live.js').includes("'/api/crm/client-failure'"));
  t('the dashboard names it in "Something failed"', /'crm-page': 'A CRM page'/.test(read('crm/index.html')));

  // ---- the STAGING / PREVIEW badge -------------------------------------------
  {
    const env = (marker, cookieOk = true) => {
      const seen = [];
      const envSql = (strings, ...vals) => { const q = strings.join('?'); seen.push(q);
        if (/to_regclass\('public\.deployment_marker'\)/.test(q)) return Promise.resolve([{ present: marker !== null }]);
        if (/FROM deployment_marker/.test(q)) return Promise.resolve(marker === 'staging' ? [{ environment: 'staging' }] : []);
        return Promise.resolve([]); };
      require.cache[neonId].exports = { neon: () => envSql };
      delete require.cache[require.resolve(path.join(FN, 'crm-environment.js'))];
      const h = require(path.join(FN, 'crm-environment.js')).handler;
      return quiet(() => h({ httpMethod: 'GET', headers: cookieOk ? { cookie } : {}, queryStringParameters: {} })).then((r) => ({ r, seen }));
    };
    let x = await env('staging');
    t('the staging database (labelled) reads as staging', x.r.statusCode === 200 && JSON.parse(x.r.body).database === 'staging', x.r.body);
    x = await env(null);
    t('   a database without the label reads as unlabelled, i.e. treat as live', JSON.parse(x.r.body).database === 'unlabelled', x.r.body);
    x = await env('other');
    t('   a marker table without a staging row is not staging', JSON.parse(x.r.body).database === 'unlabelled', x.r.body);
    t('   it never creates the label or writes anything', !x.seen.some((q) => /CREATE|INSERT|UPDATE|DELETE/i.test(q)), x.seen.join(' | '));
    x = await env('staging', false);
    t('   and needs a CRM session', x.r.statusCode === 401);
    t('   wired, and probed by the live check', /from = "\/api\/crm\/environment"/.test(read('netlify.toml')) && read('scripts/check-live.js').includes("'/api/crm/environment'"));

    // the badge, in a stand-in page
    const badge = async (host, reply) => {
      const fetched = [];
      const body = el('body');
      const b2 = { window: { location: { hostname: host, pathname: '/crm/' } }, console,
        document: { createElement: el, addEventListener() {}, readyState: 'complete', body, getElementById: (id) => body.children.find((c) => c.id === id) || null },
        fetch: (u) => { fetched.push(u); return reply ? Promise.resolve({ ok: reply.ok, json: () => Promise.resolve(reply.body) }) : Promise.reject(new TypeError('Failed to fetch')); } };
      b2.window.document = b2.document;
      vm.createContext(b2);
      try { vm.runInContext(read('assets/crm.js'), b2); } catch (e) { /* DOM wiring */ }
      const out = b2.window.CRM.envBadge();
      await new Promise((r) => setTimeout(r, 0)); await new Promise((r) => setTimeout(r, 0));
      return { out, fetched, el: body.children[0] };
    };
    let bg = await badge('olivesegypt.com', { ok: true, body: { database: 'staging' } });
    t('no badge on the live site, and no extra request', bg.out === null && bg.fetched.length === 0);
    bg = await badge('www.olivesegypt.com', null);
    t('   nor on www', bg.out === null && bg.fetched.length === 0);
    bg = await badge('deploy-preview-405--stirring-manatee-ca2643.netlify.app', { ok: true, body: { ok: true, database: 'staging' } });
    t('a preview on the staging database says STAGING, at the top of the page', bg.el && bg.el.id === 'crm-env-badge' && /^STAGING/.test(bg.el.textContent) && /crm-ui-env-staging/.test(bg.el.className), bg.el && bg.el.textContent);
    bg = await badge('deploy-preview-405--stirring-manatee-ca2643.netlify.app', { ok: true, body: { ok: true, database: 'unlabelled' } });
    t('   a preview on an unlabelled database warns it is the LIVE database', /^PREVIEW · connected to the LIVE database/.test(bg.el.textContent) && /crm-ui-env-live/.test(bg.el.className), bg.el.textContent);
    bg = await badge('127.0.0.1', null);
    t('   and when it cannot check, says to treat it as live', /treat it as live/.test(bg.el.textContent) && /crm-ui-env-live/.test(bg.el.className), bg.el.textContent);
    t('the badge is shown by every page with the CRM menu, and by the document sheet', /CRM\.envBadge\(\);\s*\};/.test(read('assets/crm.js')) && /CRM\.envBadge\(\); load\(\);/.test(read('crm/document/view/index.html')));
  }

  // ---- Batch 3 (owner, 2026-10-20): bottom bar, larger text, colours ------
  {
    const js = read('assets/crm.js');
    const css = read('assets/crm-ui.css');
    const bar = (js.match(/CRM\.tabBar = function \(active\) \{[\s\S]*?\n  \};/) || [''])[0];
    t('the phone bar has Dashboard, Enquiries, Buyers, Documents, and More',
      /CRM\.TABS = \['Dashboard', 'Enquiries', 'Buyers', 'Documents'\]/.test(js) && /<span>More<\/span>/.test(bar));
    t('   More holds the rest of the menu (the letterheads) and Log out',
      /if \(CRM\.TABS\.indexOf\(l\[1\]\) !== -1\) return;/.test(bar) && /id="crm-ui-more-logout">Log out</.test(bar) && /addEventListener\('click', CRM\.logout\)/.test(bar));
    t('   the current page is marked for screen readers, and More says whether it is open',
      /aria-current="page"/.test(bar) && /aria-expanded/.test(bar) && /aria-controls="crm-ui-more"/.test(bar) && /e\.key === 'Escape'/.test(bar));
    t('   drawn by every page with the CRM menu, which also marks the page crm-ui-app',
      /document\.body\.classList\.add\('crm-ui-app'\);[\s\S]{0,160}CRM\.tabBar\(active\);/.test(js));
    t('   a tap outside More closes it and puts focus back on More unless the tap went to a field or link',
      /if \(!a \|\| a === document\.body \|\| more\.contains\(a\)\) moreBtn\.focus\(\);/.test(bar));
    t('   Log out is set apart: red, below a rule, with space above',
      /\.crm-ui-more button \{ color: var\(--crm-danger\); border-top: 1px solid var\(--crm-border\);[^}]*margin-top: 6px;/.test(css));
    t('   nothing scrolled into view stops under the bars (scroll padding on the page)',
      /html\.crm-ui-app \{ scroll-padding-bottom: calc\(150px/.test(css) && /document\.documentElement\.classList\.add\('crm-ui-app'\)/.test(js));
    t('   shown under 640px only, replacing the top-bar links there, never printed',
      /\.crm-ui-tabbar \{ display: none; \}/.test(css) && /@media \(max-width: 640px\) \{\s*body\.crm-ui-app \{ padding-bottom/.test(css) &&
      /body\.crm-ui-app \.crm-header \.crm-nav \{ display: none; \}/.test(css) && /@media print \{ \.crm-ui-tabbar \{ display: none !important; \} \}/.test(css));
    t('the document colours: olive #4b5a23, gold #b8923a, cream #f7f2e4, on the working pages only',
      /body\.crm-ui-app \{\s*--crm-primary: #4b5a23;[\s\S]*?--crm-secondary: #b8923a;[\s\S]*?--crm-bg: #f7f2e4;/.test(css) && !/#4b5a23/.test(read('assets/crm.css')));
    t('   with the grey for secondary text darkened to #5f6654, readable on cream (5.3:1)', /--crm-muted: #5f6654;/.test(css));
    t('larger text and 44px targets: buttons, fields and menus at least 44px, fields at 16px',
      /body\.crm-ui-app \.crm-btn \{ min-height: 44px;/.test(css) && /body\.crm-ui-app select \{ min-height: 44px; font-size: 16px; \}/.test(css) && /body\.crm-ui-app \{ font-size: 15px; \}/.test(css));
    const buyer = read('crm/buyer/index.html');
    t('Buyer details says "Tap to edit" while folded, and Save stays in view on a phone',
      /class="crm-ui-fold-open-hint"[^>]*>Tap to edit</.test(buyer) && /<div class="crm-ui-savebar">\s*<button type="submit" class="crm-btn crm-btn-primary" id="save-btn">/.test(buyer) &&
      /\.crm-ui-savebar \{\s*position: sticky;/.test(css) && /\.crm-ui-fold \{ overflow: visible; \}/.test(css));
    t('Buyer details has Cancel: it asks before discarding changes, then folds the form back to the saved record',
      /id="details-cancel">Cancel</.test(buyer) && /confirm: 'Discard changes'/.test(buyer) && /fillForm\(current\); snapshotForm\(\);/.test(buyer) &&
      /fold\.open = false;/.test(buyer) && /if \(isNew\) \{ window\.location\.href = '\/crm\/buyers\/'; return; \}/.test(buyer));
    t('the dialog focuses its safe button by default (Cancel, here "Keep editing"), never the confirm',
      /\(reasonInput \|\| input \|\| cancel\)\.focus\(\);/.test(js) && /cancel: 'Keep editing', confirm: 'Discard changes'/.test(buyer));
    t('every date field shows its date in words underneath ("23 Oct 2026"), for screen readers too',
      /CRM\.dateTexts\(\);\s*document\.body\.classList\.add\('crm-ui-app'\);/.test(js) && /input\[type=date\]/.test(js) &&
      /setAttribute\('aria-live', 'polite'\)/.test(js) && /setAttribute\('aria-describedby'/.test(js) && /'No date chosen'/.test(js) &&
      /CRM\.fmtDate\(input\.value\)/.test(js) && /CRM\.refreshDateTexts\(\);/.test(buyer));
    const signIn = ['crm/login/index.html', 'crm/forgot-password/index.html', 'crm/reset-password/index.html', 'crm/change-password/index.html'].filter((f) => fs.existsSync(path.join(ROOT, f)));
    t(`the sign-in pages (${signIn.length}) still load neither crm-ui.css nor crm.js, so none of this reaches them`,
      signIn.length > 0 && signIn.every((f) => !/crm-ui\.css|assets\/crm\.js/.test(read(f))));
  }

  // ---- Accessibility scan (2026-10-23): what axe found, held here ----------
  {
    const docForm = read('crm/document/index.html');
    t('the Buyers filters have names a screen reader can say',
      /id="stage-filter" aria-label="Filter by stage"/.test(read('crm/buyers/index.html')) && /id="region-filter" aria-label="Filter by region"/.test(read('crm/buyers/index.html')));
    t('every line-item field on a document form is named after its column',
      ['li-desc', 'li-unit', 'li-qty', 'li-price', 'pk-desc', 'pk-packing', 'pk-packages', 'pk-net', 'pk-gross'].every((c) => new RegExp(`class="${c}" aria-label="[^"]+"`).test(docForm)));
    t('the document view\'s sideways-scrolling body can be reached from the keyboard',
      /<div class="doc-body" tabindex="0" role="region" aria-label="Document contents">/.test(read('crm/document/view/index.html')));
    t('status messages on Buyers, Documents and Data quality are announced',
      /id="deleted-status"[^>]*role="status" aria-live="polite"/.test(read('crm/buyers/index.html')) &&
      ['crm/documents/index.html', 'crm/data-quality/index.html'].every((f) => /id="status"[^>]*role="status" aria-live="polite"/.test(read(f))));
    // Owner, 2026-10-23: the small gold labels on the green masthead use the
    // lighter gold #e6c57d (4.5:1); the gold bar and rules stay #b8923a.
    const mastheads = ['letterhead/index.html', 'ar/letterhead/index.html', 'crm/document/view/index.html'];
    t('the masthead\'s small gold labels use #e6c57d, in English and Arabic, letterhead and documents',
      mastheads.every((f) => {
        const s = read(f);
        return /--doc-gold: #b8923a; --doc-gold-on-green: #e6c57d;/.test(s) &&
          /\.doc-trade \{[^}]*color: var\(--doc-gold-on-green\)/.test(s) && /\.doc-contact dt \{[^}]*color: var\(--doc-gold-on-green\)/.test(s) &&
          /\.doc-goldbar \{ height: 5px; background: var\(--doc-gold\); \}/.test(s);
      }));
  }

  console.log(`\ncrm-ui ${fail ? 'FAILED' : 'OK'} -- a failure is said in the page, recorded once, and the sign-in pages are left alone.`);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('check-crm-ui CRASHED:', e && e.stack ? e.stack : e); process.exit(1); });
