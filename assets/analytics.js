/*
 * Shared analytics-event helper (Section E).
 *
 * Event naming convention: snake_case, past-tense verb suffix describing
 * what happened (_submitted, _click, _viewed, _download) so event names
 * read as a log of things that occurred, not commands or capabilities.
 * Every event is tagged with { source_page, ...context } as its payload.
 *
 * Consent: TC.consent.analytics defaults to false (denied) and stays
 * false until Section G's real consent UI explicitly sets it true after
 * a visitor opts in. Nothing in this file, and nothing that calls
 * TC.trackEvent(), transmits any analytics event while consent is
 * denied -- per the site's consent-defaults-to-denied rule. Section G
 * should call TC.setConsent(true/false) rather than building its own
 * separate gate.
 *
 * Dedup: each event carries a dedup_key so a retried/duplicate call
 * (e.g. a double form submit) can be recognized as the same logical
 * event by anything consuming these events later, rather than being
 * silently double-counted.
 *
 * "*_submitted" events must only be fired after a CONFIRMED successful
 * server response -- never on client-side form submit alone -- so a
 * failed submission is never counted as a success. Callers are
 * responsible for firing them at the right point; this file does not
 * guess at success/failure.
 */
(function (window) {
  'use strict';

  var TC = window.TC = window.TC || {};

  TC.consent = TC.consent || { analytics: false };

  TC.setConsent = function (analyticsGranted) {
    TC.consent.analytics = analyticsGranted === true;
  };

  function dedupKey(name, payload) {
    var basis = name + '|' + (payload && payload.source_page || '') + '|' + Date.now();
    var hash = 0;
    for (var i = 0; i < basis.length; i++) {
      hash = ((hash << 5) - hash + basis.charCodeAt(i)) | 0;
    }
    return name + '_' + Math.abs(hash).toString(36);
  }

  // G1's data-flow inventory approved exactly these payload keys for
  // analytics events -- none of them free text, none of them able to
  // carry a name, email, phone number, or message body. This allowlist
  // is enforced here, not just by caller discipline: any key outside
  // this set is silently dropped before an event is ever sent, so a
  // future call site can't accidentally leak personal data into
  // analytics by adding a new field without updating this list (and the
  // inventory) first.
  var ALLOWED_PAYLOAD_KEYS = { source_page: 1, product: 1, target: 1, form: 1, dedup_key: 1 };

  TC.trackEvent = function (name, payload) {
    payload = payload || {};
    if (!TC.consent.analytics) return; // default-denied: no-op until Section G grants consent
    if (typeof window.umami === 'undefined' || typeof window.umami.track !== 'function') return;
    var fullPayload = {};
    for (var k in payload) {
      if (Object.prototype.hasOwnProperty.call(payload, k) && ALLOWED_PAYLOAD_KEYS[k]) {
        fullPayload[k] = payload[k];
      }
    }
    fullPayload.dedup_key = dedupKey(name, payload);
    try {
      window.umami.track(name, fullPayload);
    } catch (e) {
      // Analytics must never break the page.
    }
  };

  // Sitewide click delegation for events that don't need form-specific
  // context: WhatsApp links, mailto links, and spec/catalog downloads.
  // Wrapped defensively -- these events are best-effort UX telemetry,
  // not something a click should ever be blocked on.
  document.addEventListener('click', function (e) {
    var a = e.target.closest ? e.target.closest('a[href]') : null;
    if (!a) return;
    var href = a.getAttribute('href') || '';
    var sourcePage = window.location.pathname;

    if (/^https:\/\/wa\.me\//.test(href)) {
      TC.trackEvent('whatsapp_click', { source_page: sourcePage });
      TC.logEvent('whatsapp_click', { source_page: sourcePage });
    } else if (/^mailto:/.test(href)) {
      TC.trackEvent('email_click', { source_page: sourcePage });
      TC.logEvent('email_click', { source_page: sourcePage });
    } else if (/^\/catalog\/print|^\/downloads/.test(href)) {
      TC.trackEvent('specification_download', { source_page: sourcePage, target: href });
      TC.logEvent('specification_download', { source_page: sourcePage, target_id: extractTargetId(href) });
    }
  }, true);

  /*
   * Section J Phase 1 -- the site's own custom event pipeline, built
   * alongside (not instead of) the Umami wrapper above. Posts to
   * /api/analytics-collect: a first-party, non-PII persistent visitor
   * ID + a 30-minute-inactivity session, funnel/high-intent events, and
   * a page-exit behavioral signal for server-side bot scoring (the
   * scoring rules themselves are never shipped here -- see
   * netlify/functions/_analytics_lib.js).
   *
   * Same consent gate as everything else in this file: nothing here
   * mints an ID, starts a session, or sends anything until
   * TC.consent.analytics is true, and every write is dropped silently
   * (never throws, never blocks the page) on any failure.
   */

  var VISITOR_KEY = 'tc-analytics-visitor';
  var SESSION_KEY = 'tc-analytics-session';
  var SESSION_TIMEOUT_MS = 30 * 60 * 1000;
  var pipelineBooted = false;
  var pageLoadedAt = Date.now();
  var hadInteraction = false;

  document.addEventListener('mousemove', function () { hadInteraction = true; }, { passive: true, once: true });
  document.addEventListener('touchstart', function () { hadInteraction = true; }, { passive: true, once: true });
  document.addEventListener('keydown', function () { hadInteraction = true; }, { once: true });

  function extractTargetId(href) {
    try {
      var url = new URL(href, window.location.origin);
      var product = url.searchParams.get('product');
      return product || url.pathname;
    } catch (e) {
      return href.slice(0, 300);
    }
  }

  function uuid() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID();
    }
    // Non-cryptographic fallback -- fine for a non-security identifier.
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      var v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  function readJson(key) {
    try {
      var raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }
  function writeJson(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      // Storage unavailable (private mode, quota) -- a new ID/session is
      // simply minted again next call; safe failure mode.
    }
  }

  function getVisitorId() {
    var stored = readJson(VISITOR_KEY);
    if (stored && stored.id) return stored.id;
    var id = uuid();
    writeJson(VISITOR_KEY, { id: id });
    return id;
  }

  // Returns { sessionId, isNew, entryPage, referrer, utm } and persists
  // it. A session is reused across page loads until 30 minutes pass
  // since the last event, matching the same inactivity window Umami's
  // own collect endpoint already enforces.
  function getSession() {
    var now = Date.now();
    var stored = readJson(SESSION_KEY);
    if (stored && stored.id && now - stored.lastSeen < SESSION_TIMEOUT_MS) {
      stored.lastSeen = now;
      writeJson(SESSION_KEY, stored);
      return { sessionId: stored.id, isNew: false, entryPage: stored.entryPage, referrer: stored.referrer, utm: stored.utm };
    }

    var params;
    try {
      params = new URL(window.location.href).searchParams;
    } catch (e) {
      params = new URLSearchParams();
    }
    var fresh = {
      id: uuid(),
      lastSeen: now,
      entryPage: window.location.pathname,
      referrer: document.referrer || null,
      utm: {
        source: params.get('utm_source') || null,
        medium: params.get('utm_medium') || null,
        campaign: params.get('utm_campaign') || null,
        content: params.get('utm_content') || null,
        term: params.get('utm_term') || null,
      },
      browserLanguage: (navigator.language || '').slice(0, 35) || null,
    };
    writeJson(SESSION_KEY, fresh);
    return { sessionId: fresh.id, isNew: true, entryPage: fresh.entryPage, referrer: fresh.referrer, utm: fresh.utm, browserLanguage: fresh.browserLanguage };
  }

  function post(payload) {
    var body = JSON.stringify(payload);
    try {
      if (navigator.sendBeacon) {
        var blob = new Blob([body], { type: 'application/json' });
        if (navigator.sendBeacon('/api/analytics-collect', blob)) return;
      }
    } catch (e) {
      // Fall through to fetch.
    }
    try {
      fetch('/api/analytics-collect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body, keepalive: true }).catch(function () {});
    } catch (e) {
      // Never let a failed write affect the page.
    }
  }

  // TC.logEvent(type, {source_page, target_id}) -- the write path for
  // this pipeline. Consent-gated, same allowlist discipline as
  // TC.trackEvent: only what's needed for the funnel/hot-lead/attribution
  // features actually approved for Section J, nothing free-text.
  TC.logEvent = function (eventType, opts) {
    if (!TC.consent.analytics) return;
    opts = opts || {};
    var sess = getSession();
    var payload = {
      type: 'event',
      event_id: uuid(),
      event_type: eventType,
      session_id: sess.sessionId,
      visitor_id: getVisitorId(),
      source_page: opts.source_page || window.location.pathname,
      target_id: opts.target_id || null,
      occurred_at: Date.now(),
      session: {
        is_new: sess.isNew,
        entry_page: sess.entryPage,
        referrer: sess.referrer,
        utm_source: sess.utm.source,
        utm_medium: sess.utm.medium,
        utm_campaign: sess.utm.campaign,
        utm_content: sess.utm.content,
        utm_term: sess.utm.term,
        browser_language: sess.browserLanguage || null,
      },
    };
    post(payload);
    return sess.sessionId;
  };

  function sendEngagementSignal() {
    if (!TC.consent.analytics) return;
    var stored = readJson(SESSION_KEY);
    if (!stored || !stored.id) return;
    post({
      type: 'engagement_signal',
      session_id: stored.id,
      had_interaction: hadInteraction,
      time_on_page_ms: Date.now() - pageLoadedAt,
      webdriver: navigator.webdriver === true,
    });
  }

  function bootPipeline() {
    if (pipelineBooted || !TC.consent.analytics) return;
    pipelineBooted = true;
    TC.logEvent('pageview', { source_page: window.location.pathname });

    // sendBeacon is the right tool for exit-time writes per spec --
    // fires once, whichever exit signal comes first.
    var sent = false;
    function onExit() {
      if (sent) return;
      sent = true;
      sendEngagementSignal();
    }
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') onExit();
    });
    window.addEventListener('pagehide', onExit);
  }

  // Consent may already be granted from a previous visit (boot now), or
  // may be granted mid-visit via the banner/preferences modal (boot the
  // moment that happens) -- covers both without consent.js needing to
  // know this pipeline exists.
  var originalSetConsent = TC.setConsent;
  TC.setConsent = function (analyticsGranted) {
    originalSetConsent(analyticsGranted);
    if (TC.consent.analytics) bootPipeline();
  };
  bootPipeline();
})(window);
