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
 * Google Analytics (added 2026-10-11, owner instruction) is loaded by the
 * same rule and the same single Analytics choice: gtag.js is injected only
 * after consent, never by a static tag. Unlike Umami it sets cookies (_ga,
 * _ga_<id>) and sends data to Google, so withdrawal also has to switch it
 * off and remove those cookies -- see disableGoogleAnalytics below.
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

  // Changing this re-asks every visitor: a consent stored under another
  // version reads as no consent at all (readStoredConsent below), so the
  // banner returns and nothing that depends on analytics consent runs until
  // they answer again.
  //
  // 2026-09-27: bumped because analytics consent now does something it did
  // not when most visitors gave it -- a consenting visitor's enquiry is linked
  // to their visit's analytics record (TC.currentSessionId, disclosed on
  // /privacy and /ar/privacy). The owner chose to re-ask everyone and to link
  // only consent given under the text that says so; this bump is how that is
  // enforced, with no further code. The earlier privacy change (button
  // presses, 2026-09-17) did not bump it.
  //
  // 2026-10-11: bumped again because Analytics consent now also loads Google
  // Analytics, which sets cookies and sends visit data to Google -- neither
  // was true of any consent given before today, so nobody's earlier "Accept"
  // is carried over to it.
  var POLICY_VERSION = '2026-10-11';
  var CONSENT_VERSION = '1.0';
  var STORAGE_KEY = 'tc-consent';
  var UMAMI_SRC = 'https://umami-olivesegypt.netlify.app/script.js';
  var UMAMI_WEBSITE_ID = '88799e3f-ddb2-4eb2-b162-878676480474';
  var GA_SRC = 'https://www.googletagmanager.com/gtag/js';
  var GA_MEASUREMENT_ID = 'G-2GS8BNCXXQ';

  // Only the live site reports anywhere. Deploy previews and local copies
  // run the same code, and a choice made while checking one used to reach
  // the real Google Analytics, Umami and consent register. Off the live
  // hosts the banner, the choice and its storage behave exactly as live;
  // nothing is sent. assets/analytics.js applies the same rule.
  var LIVE_HOST = /^(www\.)?olivesegypt\.com$/.test(window.location.hostname);

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
    if (!TC.consent.analytics || !LIVE_HOST) return;
    if (document.querySelector('script[data-tc-umami]')) return; // already injected this page load
    var s = document.createElement('script');
    s.defer = true;
    s.src = UMAMI_SRC;
    s.setAttribute('data-website-id', UMAMI_WEBSITE_ID);
    s.setAttribute('data-tc-umami', '1');
    document.head.appendChild(s);
  }

  function loadGoogleAnalyticsIfConsented() {
    if (!TC.consent.analytics || !LIVE_HOST) return;
    if (document.querySelector('script[data-tc-ga]')) return; // already injected this page load
    window['ga-disable-' + GA_MEASUREMENT_ID] = false;
    window.dataLayer = window.dataLayer || [];
    // gtag.js reads the queued `arguments` objects themselves, so this must
    // stay a plain function pushing `arguments` -- not an array or a spread.
    window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', GA_MEASUREMENT_ID);
    var s = document.createElement('script');
    s.async = true;
    s.src = GA_SRC + '?id=' + GA_MEASUREMENT_ID;
    s.setAttribute('data-tc-ga', '1');
    document.head.appendChild(s);
  }

  // Withdrawal. Not loading gtag.js on the next page is not enough for Google
  // Analytics the way it is for Umami: a copy already running on this page
  // would keep sending, and the _ga cookies it set would sit in the browser
  // until two years after the last visit (gtag renews them on every page
  // load by default). So: tell any running copy to stop, and expire the
  // cookies on every domain scope gtag.js may have written them to.
  function disableGoogleAnalytics() {
    window['ga-disable-' + GA_MEASUREMENT_ID] = true;
    try {
      var host = window.location.hostname;
      var bare = host.replace(/^www\./, '');
      var scopes = ['', '; domain=' + host, '; domain=.' + host, '; domain=' + bare, '; domain=.' + bare];
      var names = document.cookie.split(';').map(function (c) { return c.split('=')[0].trim(); })
        .filter(function (n) { return n === '_ga' || n.indexOf('_ga_') === 0; });
      names.forEach(function (n) {
        scopes.forEach(function (scope) {
          document.cookie = n + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/' + scope;
        });
      });
    } catch (e) {
      // Cookie access can be blocked; the disable flag above still applies.
    }
  }

  // Without analytics consent the visit counter's two entries
  // (assets/analytics.js) must not exist. Withdrawal used to leave them
  // behind, so accepting again later revived the old visitor ID and linked
  // the new visits to the old ones. Also run on every page load where the
  // saved choice is "no", which clears entries left by a withdrawal made
  // before this fix.
  function clearCounterIds() {
    try {
      window.localStorage.removeItem('tc-analytics-visitor');
      window.localStorage.removeItem('tc-analytics-session');
    } catch (e) {
      // Storage unavailable: nothing can be stored there either.
    }
  }

  function logConsentServerSide(mechanism, analytics) {
    if (!LIVE_HOST) return;
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
      loadGoogleAnalyticsIfConsented();
    } else {
      disableGoogleAnalytics();
      clearCounterIds();
    }
    // Withdrawal: if analytics is false, we simply never inject Umami on
    // this or any future page load again (each full page load re-checks
    // storage from scratch) -- there is no client-side routing on this
    // static site, so there is nothing further to "un-fire". Google
    // Analytics needs the extra step above.
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
  // The reopen pill follows the reading direction, and the WhatsApp bubble
  // is mirrored to match it in the stylesheet ([dir="rtl"] rule beside the
  // .tc-social-* block). Both controls therefore sit at opposite ends of
  // their own inline axis, in both languages. What must never come back is
  // the mix: one control logical and the other physical, which is how they
  // ended up in the same Arabic corner (C-87).
  var STYLE = '' +
    '#tc-consent-banner,#tc-consent-modal-overlay{position:fixed;left:0;right:0;z-index:9999;font-family:inherit;}' +
    '#tc-consent-banner{bottom:0;background:#1c2416;color:#e9e7dd;padding:10px 16px;box-shadow:0 -2px 12px rgba(0,0,0,.25);border-top:1px solid #c9a84c;}' +
    '#tc-consent-banner .tc-row{display:flex;flex-wrap:wrap;align-items:center;gap:8px 16px;max-width:1100px;margin:0 auto;}' +
    '#tc-consent-banner p{margin:0;font-size:13px;line-height:1.45;flex:1 1 320px;}' +
    // Reject and Accept share one class, so they can never differ in weight.
    // Choose opens the detail panel and reads as a link beside them.
    '.tc-actions{display:flex;align-items:center;gap:8px;flex:1 1 auto;justify-content:flex-end;}' +
    '.tc-actions .tc-btn-choice{flex:1 1 0;min-width:96px;max-width:160px;}' +
    '.tc-btn-choice{min-height:44px;background:#e9e7dd;color:#1c2416;border-color:#e9e7dd;}' +
    '.tc-btn-link{min-height:44px;background:transparent;color:#e9e7dd;text-decoration:underline;text-underline-offset:3px;padding:9px 8px;}' +
    '#tc-consent-banner a{color:#c9a84c;text-decoration:underline;}' +
    '.tc-btn{font-size:13px;font-weight:600;border-radius:6px;padding:9px 16px;cursor:pointer;border:1px solid transparent;white-space:nowrap;}' +
    '.tc-btn-primary{background:#c9a84c;color:#1c2416;}' +
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
    '#tc-consent-reopen{position:fixed;inset-inline-start:16px;bottom:16px;z-index:9998;background:#1c2416;color:#e9e7dd;border:1px solid #c9a84c;border-radius:999px;padding:9px 14px;font-size:12px;font-weight:600;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.25);}' +
    '#tc-consent-reopen.tc-in-footer{display:none;}' +
    '#tc-consent-footer-link{background:none;border:0;padding:0;font:inherit;cursor:pointer;}' +
    '.dark #tc-consent-modal{background:hsl(var(--card));color:hsl(var(--card-foreground));}' +
    '.dark .tc-modal-subtext{color:hsl(var(--muted-foreground));}' +
    '.dark .tc-cat{border-top-color:hsl(var(--card-border));}' +
    '.dark .tc-cat-desc{color:hsl(var(--muted-foreground));}' +
    '.dark .tc-btn-modal-secondary{color:hsl(var(--card-foreground));border-color:hsl(var(--card-border));}';

  /*
   * Every visible string, per locale.
   *
   * This file used to contain no Arabic and never read the page language, so
   * an Arabic visitor was asked for analytics consent in English. Consent
   * that the person cannot read is not meaningfully given.
   *
   * The privacy link is per-locale for the same reason: pointing an Arabic
   * reader at the English /privacy page to explain what is collected has the
   * same problem in miniature.
   */
  var STRINGS = {
    en: {
      bannerLabel: 'Cookie consent',
      // Names everything Accept turns on and what each keeps in the browser:
      // Google Analytics sets cookies; our own counter (Umami plus the
      // site's /api/analytics-collect pipeline) sets none, but keeps a
      // visit ID in local storage (assets/analytics.js, VISITOR_KEY).
      body: 'May we measure visits? Google Analytics sets cookies; our counter stores an ID in your browser. ',
      privacy: 'Privacy',
      privacyHref: '/privacy/',
      reject: 'Reject',
      manage: 'Settings',
      accept: 'Accept',
      // The panel says what the banner says, in a little more detail, and
      // uses the banner's names: "our counter", "Settings".
      reopen: 'Cookie settings',
      reopenFooter: 'Cookie settings',
      modalTitle: 'Cookie settings',
      modalSubtext: "Choose what we're allowed to use. You can change this anytime.",
      necessary: 'Needed for the site',
      necessaryDesc: 'Forms, navigation, and remembering your choices here. Always on.',
      necessaryAria: 'Needed for the site (always on)',
      analytics: 'Analytics',
      analyticsDesc: 'Measures visits. Google Analytics sets cookies and sends visit data to Google; our counter stores an ID in your browser. Off unless you turn it on.',
      cancel: 'Cancel',
      save: 'Save'
    },
    ar: {
      bannerLabel: 'الموافقة على الكوكيز',
      body: 'هل نقيس الزيارات؟ تضع Google Analytics الكوكيز، ويحفظ عدّادنا معرّفًا في متصفحك. ',
      privacy: 'سياسة الخصوصية',
      privacyHref: '/ar/privacy/',
      reject: 'رفض',
      manage: 'الإعدادات',
      accept: 'قبول',
      reopen: 'إعدادات الكوكيز',
      reopenFooter: 'إعدادات الكوكيز',
      modalTitle: 'إعدادات الكوكيز',
      modalSubtext: 'اختر ما يُسمح لنا باستخدامه. ويمكنك تغيير ذلك في أي وقت.',
      necessary: 'لازم لعمل الموقع',
      necessaryDesc: 'النماذج والتنقل وتذكّر اختياراتك هنا. مفعّل دائمًا.',
      necessaryAria: 'لازم لعمل الموقع (مفعّل دائمًا)',
      analytics: 'التحليلات',
      analyticsDesc: 'تقيس الزيارات. تضع Google Analytics الكوكيز وترسل بيانات الزيارة إلى Google، ويحفظ عدّادنا معرّفًا في متصفحك. معطّل ما لم تفعّله أنت.',
      cancel: 'إلغاء',
      save: 'حفظ'
    },
    // The Portuguese (Brazil) pages under /pt-br/ (owner, 2026-10-25): draft
    // wording, awaiting a Brazilian reader and counsel's LGPD review.
    pt: {
      bannerLabel: 'Consentimento de cookies',
      body: 'Podemos medir as visitas? O Google Analytics usa cookies; nosso contador guarda um identificador no seu navegador. ',
      privacy: 'Privacidade',
      privacyHref: '/pt-br/privacidade/',
      reject: 'Recusar',
      manage: 'Configurações',
      accept: 'Aceitar',
      reopen: 'Configurações de cookies',
      reopenFooter: 'Configurações de cookies',
      modalTitle: 'Configurações de cookies',
      modalSubtext: 'Escolha o que podemos usar. Você pode mudar isso quando quiser.',
      necessary: 'Necessários para o site',
      necessaryDesc: 'Formulários, navegação e a memória das suas escolhas aqui. Sempre ativos.',
      necessaryAria: 'Necessários para o site (sempre ativos)',
      analytics: 'Análise',
      analyticsDesc: 'Mede as visitas. O Google Analytics usa cookies e envia dados da visita ao Google; nosso contador guarda um identificador no seu navegador. Desativado, a menos que você o ative.',
      cancel: 'Cancelar',
      save: 'Salvar'
    }
  };
  var PAGE_LANG = (document.documentElement.lang || '').toLowerCase();
  var T = STRINGS[PAGE_LANG === 'ar' ? 'ar' : PAGE_LANG.slice(0, 2) === 'pt' ? 'pt' : 'en'];

  function injectStyle() {
    if (document.getElementById('tc-consent-style')) return;
    var style = document.createElement('style');
    style.id = 'tc-consent-style';
    style.textContent = STYLE;
    document.head.appendChild(style);
  }

  // The WhatsApp FAB sits bottom-right, exactly where the banner's
  // Settings button lands -- push it up out of the way while the
  // banner is visible, and put it back once the banner is gone.
  //
  // The height has to be re-read, not measured once. The banner is a single
  // row on a wide window and wraps to several on a narrow one: 73px at
  // 1280 against 195px at 390. Measuring once at insertion and never again
  // left the button stranded at the old offset the moment the window was
  // resized or a phone was turned, and the banner then covered it -- which
  // is exactly how this was reported, as a button that overlaps the cookie
  // notice sometimes and not others.
  var fabWatch = null;

  function fab() {
    return document.querySelector('.fixed.bottom-6.right-6');
  }

  // The insights tab is vertically centred, so on a short viewport with a
  // wrapped banner its lower edge runs into the banner: 390x780 puts a 195px
  // banner straight through it. Lift it just clear when that happens, and
  // let it fall back to centred when the banner goes.
  function tab() {
    return document.querySelector('[data-testid="floating-blog-link"]');
  }

  function positionTab(bannerHeight) {
    var el = tab();
    if (!el) return;
    el.style.top = '';
    el.style.bottom = '';
    el.style.transform = '';
    el.style.visibility = '';
    if (!bannerHeight) return;

    // On a phone the tab is a 256px slab pinned to the same edge as the
    // WhatsApp bubble, and the banner takes a third of the screen. There is
    // no position that clears both: lifting it out of the banner drops it
    // onto the bubble. So while the banner is up on a narrow viewport the
    // tab steps aside entirely, and comes back the moment a choice is made.
    // The banner is a one-time interruption; the tab is not worth fighting
    // it for.
    if (window.innerWidth < 640) {
      el.style.visibility = 'hidden';
      return;
    }

    // Below 1366px, and on touch screens, the tab is a round icon held 92px
    // from the bottom, just above the WhatsApp bubble (the stylesheet, since
    // 2026-10-10). The bubble rises by the banner's height, so the icon rises
    // with it; lifting it to clear the banner instead put it on the bubble.
    if (window.matchMedia && window.matchMedia('(max-width: 1365px), (hover: none)').matches) {
      el.style.bottom = (92 + bannerHeight) + 'px';
      return;
    }

    var box = el.getBoundingClientRect();
    var limit = window.innerHeight - bannerHeight - 8;
    if (box.bottom > limit) {
      el.style.top = Math.max(8, limit - box.height) + 'px';
      el.style.transform = 'none';
    }
  }

  // The floating "Request a Quote" button (assets/site-nav.js) sits in the
  // opposite bottom corner, at the same height as the bubble, so the banner
  // would cover it in exactly the same way. It moves with the bubble.
  function quoteFab() {
    return document.getElementById('tc-quote-fab');
  }

  // Room at the foot of the page while the banner is up, so the last links
  // can scroll above it rather than stay underneath (owner, 2026-10-23).
  function bannerRoom(h) {
    var spacer = document.getElementById('tc-consent-room');
    if (!h) { if (spacer) spacer.remove(); return; }
    if (!spacer) {
      spacer = document.createElement('div');
      spacer.id = 'tc-consent-room';
      spacer.setAttribute('aria-hidden', 'true');
      document.body.appendChild(spacer);
    }
    spacer.style.height = h + 'px';
  }

  function positionFab() {
    var banner = document.getElementById('tc-consent-banner');
    var h = banner ? banner.offsetHeight : 0;
    bannerRoom(h);
    var el = fab();
    if (el) el.style.bottom = h ? (24 + h) + 'px' : '';
    var q = quoteFab();
    if (q) {
      q.style.bottom = h ? (28 + h) + 'px' : '';
      // Icon only while the banner is up on a phone or tablet: the full
      // label covered the text above the banner. site-nav.js keeps it so.
      if (h) q.classList.toggle('tc-quote-fab--compact', window.matchMedia('(max-width: 1023.98px)').matches);
    }
    positionTab(h);
  }
  // site-nav.js adds the quote button after this file has run; it calls this
  // so the button starts clear of a banner that is already up.
  TC.positionFloating = positionFab;

  function shiftFabForBanner() {
    positionFab();
    if (fabWatch) return;
    fabWatch = positionFab;
    window.addEventListener('resize', fabWatch);
    window.addEventListener('orientationchange', fabWatch);
    // The banner's own text can reflow after it is inserted -- a webfont
    // arriving is enough -- so watch the element itself where the browser
    // supports it, rather than trusting one measurement.
    if (typeof ResizeObserver === 'function') {
      var banner = document.getElementById('tc-consent-banner');
      if (banner) {
        var ro = new ResizeObserver(positionFab);
        ro.observe(banner);
      }
    }
  }

  function restoreFabPosition() {
    if (fabWatch) {
      window.removeEventListener('resize', fabWatch);
      window.removeEventListener('orientationchange', fabWatch);
      fabWatch = null;
    }
    var el = fab();
    if (el) el.style.bottom = '';
    var q = quoteFab();
    if (q) {
      q.style.bottom = '';
      q.classList.remove('tc-quote-fab--compact');
    }
    positionTab(0);
    bannerRoom(0);
  }

  // Keyboard (owner, 2026-10-23): when the banner is answered from the
  // keyboard, focus would go down with the banner and the next Tab would
  // start from nowhere. It moves to the first thing after the banner -- the
  // top of the page, since the banner is the first thing in it -- without
  // scrolling.
  var FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';
  function removeBanner() {
    var b = document.getElementById('tc-consent-banner');
    var hadFocus = b && b.contains(document.activeElement);
    if (b) b.remove();
    restoreFabPosition();
    if (hadFocus) {
      var list = document.body.querySelectorAll(FOCUSABLE);
      for (var i = 0; i < list.length; i++) {
        var el = list[i];
        if (el.offsetWidth || el.offsetHeight || el.getClientRects().length) {
          try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); }
          break;
        }
      }
    }
  }

  // On a phone the floating pill joined the WhatsApp bubble and the insights
  // tab on the bottom of every screen, covering content (owner's mobile
  // check, 2026-09-28). So the same control also sits in the footer, beside
  // Privacy, styled like its neighbours, and the pill is hidden wherever the
  // footer one was placed -- below 640px from 2026-09-28, and at every width
  // from 2026-10-02, when the floating "Request a Quote" button took the
  // pill's corner on desktop (owner's choice). Pages without that footer row
  // (the printable sheets, the business card) keep the pill at every width.
  function addFooterControl() {
    if (document.getElementById('tc-consent-footer-link')) return true;
    // One privacy link per language; the Portuguese footer's goes to its own
    // policy (2026-10-27), and the settings link sits beside it there too.
    var privacy = document.querySelector('footer a[href="/privacy/"], footer a[href="/ar/privacy/"], footer a[href="/pt-br/privacidade/"]');
    if (!privacy || !privacy.parentNode) return false;
    var btn = document.createElement('button');
    btn.id = 'tc-consent-footer-link';
    btn.type = 'button';
    btn.className = privacy.className;
    btn.textContent = T.reopenFooter;
    btn.addEventListener('click', openPreferencesModal);
    privacy.parentNode.insertBefore(btn, privacy.nextSibling);
    return true;
  }

  function showReopenControl() {
    if (document.getElementById('tc-consent-reopen')) return;
    var btn = document.createElement('button');
    btn.id = 'tc-consent-reopen';
    btn.type = 'button';
    btn.textContent = T.reopen;
    btn.addEventListener('click', openPreferencesModal);
    if (addFooterControl()) btn.className = 'tc-in-footer';
    document.body.appendChild(btn);
  }

  // The panel is a modal dialog, so the keyboard has to behave like one:
  // Escape closes it, Tab stays inside it, and focus goes back to whatever
  // opened it (the banner's Choose button or the footer link).
  var modalOpener = null;

  function closeModal() {
    var overlay = document.getElementById('tc-consent-modal-overlay');
    if (!overlay) return;
    overlay.remove();
    if (modalOpener && document.contains(modalOpener)) modalOpener.focus();
    modalOpener = null;
  }

  function trapModalKeys(e) {
    if (e.key === 'Escape') { e.preventDefault(); closeModal(); return; }
    if (e.key !== 'Tab') return;
    var items = document.getElementById('tc-consent-modal').querySelectorAll('input:not([disabled]),button');
    var first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  function openPreferencesModal() {
    var opener = document.activeElement;
    closeModal();
    modalOpener = opener;
    var stored = readStoredConsent();
    var analyticsChecked = stored ? stored.analytics === true : false;

    var overlay = document.createElement('div');
    overlay.id = 'tc-consent-modal-overlay';
    overlay.innerHTML =
      '<div id="tc-consent-modal" role="dialog" aria-modal="true" aria-labelledby="tc-consent-modal-title">' +
        '<h2 id="tc-consent-modal-title">' + T.modalTitle + '</h2>' +
        '<p class="tc-modal-subtext">' + T.modalSubtext + '</p>' +
        '<div class="tc-cat">' +
          '<div><div class="tc-cat-label">' + T.necessary + '</div><div class="tc-cat-desc">' + T.necessaryDesc + '</div></div>' +
          '<input type="checkbox" checked disabled aria-label="' + T.necessaryAria + '"/>' +
        '</div>' +
        '<div class="tc-cat">' +
          '<div><div class="tc-cat-label">' + T.analytics + '</div><div class="tc-cat-desc">' + T.analyticsDesc + '</div></div>' +
          '<input type="checkbox" id="tc-consent-analytics-toggle"' + (analyticsChecked ? ' checked' : '') + ' aria-label="' + T.analytics + '"/>' +
        '</div>' +
        '<div class="tc-modal-actions">' +
          '<button type="button" class="tc-btn tc-btn-modal-secondary" id="tc-consent-modal-cancel">' + T.cancel + '</button>' +
          '<button type="button" class="tc-btn tc-btn-primary" id="tc-consent-modal-save">' + T.save + '</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);
    overlay.addEventListener('keydown', trapModalKeys);
    document.getElementById('tc-consent-analytics-toggle').focus();

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
    banner.setAttribute('aria-label', T.bannerLabel);
    banner.innerHTML =
      '<div class="tc-row">' +
        '<p>' + T.body + '<a href="' + T.privacyHref + '">' + T.privacy + '</a></p>' +
        '<div class="tc-actions">' +
          '<button type="button" class="tc-btn tc-btn-choice" id="tc-consent-reject">' + T.reject + '</button>' +
          '<button type="button" class="tc-btn tc-btn-choice" id="tc-consent-accept">' + T.accept + '</button>' +
          '<button type="button" class="tc-btn tc-btn-link" id="tc-consent-manage">' + T.manage + '</button>' +
        '</div>' +
      '</div>';
    // First in the page, so a keyboard meets it before anything it covers
    // (owner, 2026-10-23); it is drawn at the bottom of the screen either way.
    document.body.insertBefore(banner, document.body.firstChild);
    shiftFabForBanner();

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
      if (stored.analytics !== true) clearCounterIds();
      loadUmamiIfConsented();
      loadGoogleAnalyticsIfConsented();
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
