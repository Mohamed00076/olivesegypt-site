/*
 * Consent banner + conditional analytics loader (Section G2).
 *
 * Consent state defaults to UNKNOWN, and unknown behaves as DENIED for all
 * optional tracking -- no non-essential script fires before an explicit
 * choice. This file, not a static <script> tag, is the only thing that
 * ever loads the Umami tracker: the tag that used to load it unconditionally
 * in <head> has been removed sitewide (see the commit that added this
 * file). Umami is injected only after Analytics consent is granted, and on
 * every subsequent full page load this file re-reads the stored choice
 * before deciding whether to inject it again -- so withdrawing consent
 * takes effect from the very next page view, not just in the UI.
 *
 * This file injects its own banner/panel DOM and styles -- no HTML needs
 * to be added to individual pages, so the same file works unmodified
 * across the whole site.
 */
(function (window, document) {
  'use strict';

  var TC = window.TC = window.TC || {};
  TC.consent = TC.consent || { analytics: false };
  TC.setConsent = TC.setConsent || function (analyticsGranted) {
    TC.consent.analytics = analyticsGranted === true;
  };

  var POLICY_VERSION = '2026-09-01';
  var CONSENT_VERSION = '1.0';
  var STORAGE_KEY = 'tc-consent';
  var UMAMI_SRC = 'https://umami-olivesegypt.netlify.app/script.js';
  var UMAMI_WEBSITE_ID = '88799e3f-ddb2-4eb2-b162-878676480474';

  function readStoredConsent() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      if (parsed.policy_version !== POLICY_VERSION) return null; // re-ask if the policy changed
      return parsed;
    } catch (e) {
      return null;
    }
  }

  function writeStoredConsent(analytics) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
        analytics: analytics === true,
        policy_version: POLICY_VERSION,
        consent_version: CONSENT_VERSION,
        timestamp: new Date().toISOString(),
      }));
    } catch (e) {
      // Storage may be unavailable (private mode, quota) -- the banner
      // will just reappear next visit, which is the safe failure mode.
    }
  }

  function loadUmamiIfConsented() {
    if (!TC.consent.analytics) return;
    if (document.querySelector('script[data-tc-umami]')) return; // already injected this page load
    var s = document.createElement('script');
    s.defer = true;
    s.src = UMAMI_SRC;
    s.setAttribute('data-website-id', UMAMI_WEBSITE_ID);
    s.setAttribute('data-tc-umami', '1');
    document.head.appendChild(s);
  }

  function logConsentServerSide(mechanism, analytics) {
    try {
      fetch('/api/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mechanism: mechanism,
          policy_version: POLICY_VERSION,
          consent_version: CONSENT_VERSION,
          categories: { analytics: analytics === true },
        }),
      }).catch(function () {});
    } catch (e) {
      // Logging the choice must never block applying it.
    }
  }

  function applyChoice(mechanism, analytics) {
    TC.setConsent(analytics);
    writeStoredConsent(analytics);
    logConsentServerSide(mechanism, analytics);
    if (analytics) {
      loadUmamiIfConsented();
    }
    // Withdrawal: if analytics is false, we simply never inject Umami on
    // this or any future page load again (each full page load re-checks
    // storage from scratch) -- there is no client-side routing on this
    // static site, so there is nothing further to "un-fire".
  }

  // ---- UI ----------------------------------------------------------

  // Part 2 contrast audit (2026-09-02): real, measured findings (WCAG
  // relative-luminance formula, not eyeballed):
  //  - The banner/reopen-button were a fixed dark surface (#1c2416)
  //    regardless of theme -- fine in light mode (15:1 boundary contrast
  //    against the light page) but only 1.1:1 against a dark-mode page,
  //    i.e. the component's own edge was nearly invisible. Fixed with an
  //    explicit gold border (matches the site's existing --secondary
  //    token) -- 7.7:1 against the dark page, still correct/harmless in
  //    light mode where the boundary already passed on its own.
  //  - The modal was hardcoded pure white regardless of theme -- not a
  //    contrast failure by itself, but jarring in an otherwise
  //    dark-themed page. Now uses the site's existing --card/
  //    --card-foreground tokens (already proven elsewhere on this site)
  //    under `.dark`, so it adapts like every other card-styled surface.
  //  - .tc-btn-secondary was reused unchanged for the modal's "Cancel"
  //    button, but its cream text (#e9e7dd) was designed for the dark
  //    banner background -- against the modal's white background that
  //    measured 1.24:1, a real pre-existing failure (present in light
  //    mode too, not something dark mode introduced) surfaced by this
  //    same audit. Given .tc-btn-secondary/.tc-btn-modal-secondary now
  //    sit on genuinely different backgrounds, they get their own class
  //    instead of one class serving two unrelated surfaces.
  var STYLE = '' +
    '#tc-consent-banner,#tc-consent-modal-overlay{position:fixed;left:0;right:0;z-index:9999;font-family:inherit;}' +
    '#tc-consent-banner{bottom:0;background:#1c2416;color:#e9e7dd;padding:16px 20px;box-shadow:0 -2px 12px rgba(0,0,0,.25);border-top:1px solid #c9a84c;}' +
    '#tc-consent-banner .tc-row{display:flex;flex-wrap:wrap;align-items:center;gap:12px;max-width:1100px;margin:0 auto;}' +
    '#tc-consent-banner p{margin:0;font-size:13px;line-height:1.5;flex:1 1 320px;}' +
    '#tc-consent-banner a{color:#c9a84c;text-decoration:underline;}' +
    '.tc-btn{font-size:13px;font-weight:600;border-radius:6px;padding:9px 16px;cursor:pointer;border:1px solid transparent;white-space:nowrap;}' +
    '.tc-btn-primary{background:#c9a84c;color:#1c2416;}' +
    '.tc-btn-secondary{background:transparent;color:#e9e7dd;border-color:#e9e7dd55;}' +
    '#tc-consent-modal-overlay{top:0;bottom:0;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;padding:20px;}' +
    '#tc-consent-modal{background:#fff;color:#1c2416;border-radius:12px;max-width:480px;width:100%;padding:24px;box-shadow:0 12px 40px rgba(0,0,0,.3);}' +
    '#tc-consent-modal h2{margin:0 0 12px;font-size:18px;}' +
    '.tc-modal-subtext{font-size:13px;color:#555;margin:0 0 4px;}' +
    '.tc-cat{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;padding:12px 0;border-top:1px solid #eee;}' +
    '.tc-cat:first-of-type{border-top:none;}' +
    '.tc-cat-label{font-weight:600;font-size:14px;}' +
    '.tc-cat-desc{font-size:12px;color:#666;margin-top:2px;}' +
    '.tc-modal-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:16px;}' +
    '.tc-btn-modal-secondary{background:transparent;color:#1c2416;border-color:#1c241633;}' +
    '#tc-consent-reopen{position:fixed;left:16px;bottom:16px;z-index:9998;background:#1c2416;color:#e9e7dd;border:1px solid #c9a84c;border-radius:999px;padding:9px 14px;font-size:12px;font-weight:600;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.25);}' +
    '.dark #tc-consent-modal{background:hsl(var(--card));color:hsl(var(--card-foreground));}' +
    '.dark .tc-modal-subtext{color:hsl(var(--muted-foreground));}' +
    '.dark .tc-cat{border-top-color:hsl(var(--card-border));}' +
    '.dark .tc-cat-desc{color:hsl(var(--muted-foreground));}' +
    '.dark .tc-btn-modal-secondary{color:hsl(var(--card-foreground));border-color:hsl(var(--card-border));}';

  function injectStyle() {
    if (document.getElementById('tc-consent-style')) return;
    var style = document.createElement('style');
    style.id = 'tc-consent-style';
    style.textContent = STYLE;
    document.head.appendChild(style);
  }

  // The WhatsApp FAB sits bottom-right, exactly where the banner's
  // "Accept All" button lands -- push it up out of the way while the
  // banner is visible, and put it back once the banner is gone.
  function shiftFabForBanner(bannerHeight) {
    var fab = document.querySelector('.fixed.bottom-6.right-6');
    if (fab) fab.style.bottom = (24 + bannerHeight) + 'px';
  }
  function restoreFabPosition() {
    var fab = document.querySelector('.fixed.bottom-6.right-6');
    if (fab) fab.style.bottom = '';
  }

  function removeBanner() {
    var b = document.getElementById('tc-consent-banner');
    if (b) b.remove();
    restoreFabPosition();
  }

  function showReopenControl() {
    if (document.getElementById('tc-consent-reopen')) return;
    var btn = document.createElement('button');
    btn.id = 'tc-consent-reopen';
    btn.type = 'button';
    btn.textContent = '🍪 Cookie Preferences';
    btn.addEventListener('click', openPreferencesModal);
    document.body.appendChild(btn);
  }

  function closeModal() {
    var overlay = document.getElementById('tc-consent-modal-overlay');
    if (overlay) overlay.remove();
  }

  function openPreferencesModal() {
    closeModal();
    var stored = readStoredConsent();
    var analyticsChecked = stored ? stored.analytics === true : false;

    var overlay = document.createElement('div');
    overlay.id = 'tc-consent-modal-overlay';
    overlay.innerHTML =
      '<div id="tc-consent-modal" role="dialog" aria-modal="true" aria-labelledby="tc-consent-modal-title">' +
        '<h2 id="tc-consent-modal-title">Cookie Preferences</h2>' +
        '<p class="tc-modal-subtext">Choose what we\'re allowed to use. You can change this anytime.</p>' +
        '<div class="tc-cat">' +
          '<div><div class="tc-cat-label">Strictly Necessary</div><div class="tc-cat-desc">Required for the site to function (forms, navigation). Always on.</div></div>' +
          '<input type="checkbox" checked disabled aria-label="Strictly Necessary (always on)"/>' +
        '</div>' +
        '<div class="tc-cat">' +
          '<div><div class="tc-cat-label">Analytics</div><div class="tc-cat-desc">Helps us understand site traffic. Off unless you turn it on.</div></div>' +
          '<input type="checkbox" id="tc-consent-analytics-toggle"' + (analyticsChecked ? ' checked' : '') + ' aria-label="Analytics"/>' +
        '</div>' +
        '<div class="tc-modal-actions">' +
          '<button type="button" class="tc-btn tc-btn-modal-secondary" id="tc-consent-modal-cancel">Cancel</button>' +
          '<button type="button" class="tc-btn tc-btn-primary" id="tc-consent-modal-save">Save Preferences</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);

    document.getElementById('tc-consent-modal-cancel').addEventListener('click', closeModal);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) closeModal(); });
    document.getElementById('tc-consent-modal-save').addEventListener('click', function () {
      var analytics = document.getElementById('tc-consent-analytics-toggle').checked;
      applyChoice('preferences_saved', analytics);
      closeModal();
      removeBanner();
      showReopenControl();
    });
  }

  function showBanner() {
    injectStyle();
    var banner = document.createElement('div');
    banner.id = 'tc-consent-banner';
    banner.setAttribute('role', 'region');
    banner.setAttribute('aria-label', 'Cookie consent');
    banner.innerHTML =
      '<div class="tc-row">' +
        '<p>We use analytics, only with your consent, to understand site traffic. Strictly necessary functions (like this form) always work regardless of your choice. See our <a href="/privacy">Privacy page</a>.</p>' +
        '<button type="button" class="tc-btn tc-btn-secondary" id="tc-consent-reject">Reject Non-Essential</button>' +
        '<button type="button" class="tc-btn tc-btn-secondary" id="tc-consent-manage">Manage Preferences</button>' +
        '<button type="button" class="tc-btn tc-btn-primary" id="tc-consent-accept">Accept All</button>' +
      '</div>';
    document.body.appendChild(banner);
    shiftFabForBanner(banner.offsetHeight);

    document.getElementById('tc-consent-accept').addEventListener('click', function () {
      applyChoice('banner_accept_all', true);
      removeBanner();
      showReopenControl();
    });
    document.getElementById('tc-consent-reject').addEventListener('click', function () {
      applyChoice('banner_reject', false);
      removeBanner();
      showReopenControl();
    });
    document.getElementById('tc-consent-manage').addEventListener('click', openPreferencesModal);
  }

  // ---- Boot ----------------------------------------------------------

  function boot() {
    injectStyle();
    var stored = readStoredConsent();
    if (stored) {
      TC.setConsent(stored.analytics === true);
      loadUmamiIfConsented();
      showReopenControl();
    } else {
      TC.setConsent(false); // unknown behaves as denied until a choice is made
      showBanner();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window, document);
