#!/usr/bin/env node
'use strict';

/*
 * Withdrawing analytics consent removes the visit counter's two entries.
 *
 *   node scripts/check-consent-withdrawal.js        (part of `npm test`)
 *
 * WHAT WENT WRONG
 *
 * Withdrawing consent switched Google Analytics off and expired its cookies,
 * but left the counter's local-storage entries (tc-analytics-visitor and
 * tc-analytics-session, assets/analytics.js) in the browser. They were no
 * longer used, but a visitor who accepted again later got the old visitor ID
 * back, which linked their new visits to the ones from before they withdrew.
 *
 * WHAT THIS ASSERTS
 *
 * The real assets/consent.js and assets/analytics.js run, in the order the
 * pages load them, against a small stand-in for the browser. Each "page" is
 * a fresh run sharing one localStorage, as page loads do. The banner and
 * settings buttons are pressed through their own click handlers.
 *
 *   1. Accept creates both entries; Settings with analytics off deletes them,
 *      and they stay deleted on the next page.
 *   2. Entries left over from an earlier Accept, with the banner showing again
 *      (no saved choice), are deleted when the visitor presses Reject.
 *   3. Accepting again later creates a new random ID, not the old one.
 *   4. A saved "no" clears leftover entries on page load (withdrawals made
 *      before the fix); a saved "yes" keeps its ID.
 *   5. Nothing is stored before a choice.
 *
 * No network, no browser: fetch and sendBeacon are stubs that record calls.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { webcrypto } = require('crypto');

const ROOT = path.join(__dirname, '..');
const CONSENT_JS = fs.readFileSync(path.join(ROOT, 'assets', 'consent.js'), 'utf8');
const ANALYTICS_JS = fs.readFileSync(path.join(ROOT, 'assets', 'analytics.js'), 'utf8');
const VISITOR = 'tc-analytics-visitor';
const SESSION = 'tc-analytics-session';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function makeStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
    clear: () => m.clear(),
    key: (i) => [...m.keys()][i] || null,
    get length() { return m.size; },
    keys: () => [...m.keys()],
  };
}

// Just enough DOM for consent.js: elements with ids, listeners, classes.
// innerHTML is not parsed as HTML; every tag carrying an id becomes a child
// element, which is all the scripts look elements up by.
function makePage(storage, pathname, hostname) {
  hostname = hostname || 'localhost';
  const listeners = {};
  class El {
    constructor(tag) {
      this.tagName = String(tag).toUpperCase();
      this.id = '';
      this.className = '';
      this.style = {};
      this.attrs = {};
      this.children = [];
      this.parent = null;
      this.checked = false;
      this.on = {};
      const self = this;
      this.classList = {
        add: (c) => { if (!self.classList.contains(c)) self.className = (self.className + ' ' + c).trim(); },
        remove: (c) => { self.className = self.className.split(/\s+/).filter((x) => x && x !== c).join(' '); },
        contains: (c) => self.className.split(/\s+/).includes(c),
        toggle: (c, force) => { const on = force === undefined ? !self.classList.contains(c) : !!force; on ? self.classList.add(c) : self.classList.remove(c); return on; },
      };
    }
    set innerHTML(html) {
      this.children = [];
      const re = /<(\w+)\b([^>]*?)\bid="([^"]+)"([^>]*)>/g;
      let m;
      while ((m = re.exec(html))) {
        const el = new El(m[1]);
        el.id = m[3];
        el.checked = /\schecked\b/.test(m[2] + m[4]);
        el.disabled = /\sdisabled\b/.test(m[2] + m[4]);
        this.appendChild(el);
      }
    }
    get innerHTML() { return ''; }
    appendChild(c) { c.parent = this; this.children.push(c); return c; }
    insertBefore(c, ref) { c.parent = this; const i = this.children.indexOf(ref); i < 0 ? this.children.push(c) : this.children.splice(i, 0, c); return c; }
    get firstChild() { return this.children[0] || null; }
    remove() { if (this.parent) this.parent.children = this.parent.children.filter((x) => x !== this); this.parent = null; }
    addEventListener(t, f) { (this.on[t] = this.on[t] || []).push(f); }
    removeEventListener() {}
    click() { (this.on.click || []).forEach((f) => f({ target: this, preventDefault() {} })); }
    focus() { document.activeElement = this; }
    setAttribute(k, v) { this.attrs[k] = String(v); if (k === 'id') this.id = String(v); }
    getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
    contains(x) { for (let n = x; n; n = n.parent) if (n === this) return true; return false; }
    querySelector() { return null; }
    querySelectorAll() { return []; }
    getBoundingClientRect() { return { x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 }; }
    get offsetHeight() { return 0; }
  }
  const head = new El('head');
  const body = new El('body');
  const all = (n, out) => { out.push(n); n.children.forEach((c) => all(c, out)); return out; };
  const document = {
    readyState: 'loading',
    head, body,
    activeElement: body,
    referrer: '',
    visibilityState: 'visible',
    cookie: '',
    documentElement: { lang: 'en', getAttribute: (k) => (k === 'lang' ? 'en' : null), classList: new El('html').classList },
    createElement: (t) => new El(t),
    getElementById: (id) => [...all(head, []), ...all(body, [])].find((e) => e.id === id) || null,
    querySelector: () => null,
    querySelectorAll: () => [],
    contains: (x) => head.contains(x) || body.contains(x),
    addEventListener: (t, f) => { (listeners[t] = listeners[t] || []).push(f); },
  };
  const sent = [];
  const window = {
    document,
    localStorage: storage,
    sessionStorage: makeStorage(),
    location: { pathname, hostname, href: 'https://' + hostname + pathname, origin: 'https://' + hostname },
    navigator: { language: 'en', webdriver: false, sendBeacon: (u, b) => { sent.push(u); return true; } },
    crypto: webcrypto,
    matchMedia: () => ({ matches: false, addEventListener() {}, addListener() {} }),
    addEventListener() {},
    removeEventListener() {},
    fetch: (u) => { sent.push(String(u)); return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) }); },
    setTimeout, clearTimeout, URL, URLSearchParams, Date, JSON, Math, Promise, console,
  };
  window.window = window;
  vm.createContext(window);
  window.navigator = window.navigator;
  vm.runInContext('var navigator = window.navigator; var document = window.document;', window);
  vm.runInContext(CONSENT_JS, window, { filename: 'consent.js' });
  vm.runInContext(ANALYTICS_JS, window, { filename: 'analytics.js' });
  document.readyState = 'interactive';
  (listeners.DOMContentLoaded || []).forEach((f) => f());
  const byId = (id) => {
    const el = document.getElementById(id);
    if (!el) throw new Error(`no #${id} on the page`);
    return el;
  };
  return {
    banner: () => !!document.getElementById('tc-consent-banner'),
    click: (id) => byId(id).click(),
    setToggle: (on) => { byId('tc-consent-analytics-toggle').checked = on; },
    openSettings: () => byId('tc-consent-reopen').click(),
    sent,
    trackerScripts: () => head.children.filter((e) => e.tagName === 'SCRIPT').map((e) => String(e.src).replace(/\?.*$/, '')),
  };
}

const results = [];
function check(label, ok, detail) {
  results.push({ label, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${!ok && detail ? ' -- ' + detail : ''}`);
}
const entries = (s) => s.keys().filter((k) => k === VISITOR || k === SESSION).sort();
const visitorId = (s) => { try { return JSON.parse(s.getItem(VISITOR)).id; } catch (e) { return null; } };

// 1. Accept, then Settings with analytics off.
{
  const s = makeStorage();
  let p = makePage(s, '/');
  check('no entries before a choice', entries(s).length === 0 && p.banner(), entries(s).join(','));
  p.click('tc-consent-accept');
  p = makePage(s, '/catalog/');
  check('Accept creates both counter entries', entries(s).join() === [SESSION, VISITOR].join(), entries(s).join(','));
  check('the visitor ID is a random UUID', UUID.test(visitorId(s) || ''), visitorId(s));
  p.openSettings();
  p.setToggle(false);
  p.click('tc-consent-modal-save');
  check('Settings with analytics off deletes both entries', entries(s).length === 0, entries(s).join(','));
  makePage(s, '/resources/packaging/');
  check('  and they stay deleted on the next page', entries(s).length === 0, entries(s).join(','));
}

// 2. Reject after an earlier Accept: the banner is back with old entries present.
{
  const s = makeStorage();
  let p = makePage(s, '/');
  p.click('tc-consent-accept');
  makePage(s, '/catalog/');
  const before = entries(s).length;
  s.removeItem('tc-consent'); // the saved choice is gone (for example, a new policy version)
  p = makePage(s, '/');
  check('with no saved choice the banner shows again and leftovers are untouched until a choice', p.banner() && before === 2 && entries(s).length === 2, `banner ${p.banner()}, entries ${entries(s).join(',')}`);
  p.click('tc-consent-reject');
  check('Reject after an earlier Accept deletes both entries', entries(s).length === 0, entries(s).join(','));
}

// 3. A later Accept creates a new random ID.
{
  const s = makeStorage();
  let p = makePage(s, '/');
  p.click('tc-consent-accept');
  p = makePage(s, '/catalog/');
  const first = visitorId(s);
  p.openSettings(); p.setToggle(false); p.click('tc-consent-modal-save');
  p = makePage(s, '/catalog/');
  p.openSettings(); p.setToggle(true); p.click('tc-consent-modal-save');
  makePage(s, '/contact/');
  const second = visitorId(s);
  check('accepting again later creates a new random ID, not the old one', !!first && !!second && first !== second && UUID.test(second), `${first} -> ${second}`);
}

// 4. Saved choices on page load.
{
  const s = makeStorage();
  s.setItem('tc-consent', JSON.stringify({ analytics: false, policy_version: '2026-10-11', consent_version: '1.0' }));
  s.setItem(VISITOR, JSON.stringify({ id: 'left-over' }));
  s.setItem(SESSION, JSON.stringify({ id: 'left-over', lastSeen: 0 }));
  const p = makePage(s, '/');
  check('a saved "no" clears entries left by an earlier withdrawal', entries(s).length === 0 && !p.banner(), entries(s).join(','));
}
{
  const s = makeStorage();
  s.setItem('tc-consent', JSON.stringify({ analytics: true, policy_version: '2026-10-11', consent_version: '1.0' }));
  s.setItem(VISITOR, JSON.stringify({ id: 'kept' }));
  makePage(s, '/');
  check('a saved "yes" keeps its visitor ID', visitorId(s) === 'kept', visitorId(s));
}

// 6. Only the live site reports. A deploy preview or local copy behaves the
//    same in the browser (choice saved, counter entries kept) but loads no
//    tracker and sends nothing to /api/consent or /api/analytics-collect.
for (const host of ['olivesegypt.com', 'www.olivesegypt.com']) {
  const s = makeStorage();
  let p = makePage(s, '/', host);
  p.click('tc-consent-accept');
  const scripts = p.trackerScripts();
  p = makePage(s, '/catalog/', host);
  check(`on ${host}, Accept loads Umami and Google Analytics and records the choice and the visit`,
    scripts.some((u) => u.includes('umami')) && scripts.some((u) => u.includes('googletagmanager')) &&
    p.sent.includes('/api/analytics-collect'),
    `scripts ${scripts.join(',')}; sent ${p.sent.join(',')}`);
}
for (const host of ['deploy-preview-373--stirring-manatee-ca2643.netlify.app', 'localhost', '127.0.0.1']) {
  const s = makeStorage();
  let p = makePage(s, '/', host);
  p.click('tc-consent-accept');
  const sentOnChoice = p.sent.slice();
  const scripts = p.trackerScripts();
  p = makePage(s, '/catalog/', host);
  check(`on ${host}, Accept loads no tracker and sends nothing, but the choice and counter entries are kept`,
    scripts.length === 0 && sentOnChoice.length === 0 && p.sent.length === 0 &&
    JSON.parse(s.getItem('tc-consent')).analytics === true && entries(s).length === 2,
    `scripts ${scripts.join(',')}; sent ${sentOnChoice.concat(p.sent).join(',')}; entries ${entries(s).join(',')}`);
}

const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed} passed, ${failed} failed`);
if (failed) process.exit(1);
