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

  TC.trackEvent = function (name, payload) {
    payload = payload || {};
    if (!TC.consent.analytics) return; // default-denied: no-op until Section G grants consent
    if (typeof window.umami === 'undefined' || typeof window.umami.track !== 'function') return;
    var fullPayload = {};
    for (var k in payload) if (Object.prototype.hasOwnProperty.call(payload, k)) fullPayload[k] = payload[k];
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
    } else if (/^mailto:/.test(href)) {
      TC.trackEvent('email_click', { source_page: sourcePage });
    } else if (/^\/catalog\/print|^\/downloads/.test(href)) {
      TC.trackEvent('specification_download', { source_page: sourcePage, target: href });
    }
  }, true);
})(window);
