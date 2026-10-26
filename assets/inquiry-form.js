'use strict';

// Shared handler for the two inquiry forms -- /contact and /sample -- in both
// locales, plus Part F's intent routing.
//
// Why this file exists at all: the English /contact and /sample forms had no
// submit handler of any kind. Their markup was complete -- every field, every
// id, the honeypot, the status element, the submit button -- and no script
// was ever bound to them. The <form> has no action, so clicking Send did a
// default submission that reloaded the page and discarded everything the
// buyer had typed. No POST, no error, no trace. The Arabic pages carried a
// working copy of the handler inline; the English pages had never had one.
// That is the whole reason to have one implementation instead of four
// hand-maintained copies.
//
// Markup contract (already present on all four pages):
//
//   <form id="contact-form"> or <form id="sample-form">
//   #<prefix>-form-status   status element, starts .hidden
//   #<prefix>-submit-btn    submit button
//   #<prefix>-website       honeypot, off-screen
//
// Part F: the request_type recorded against the inquiry comes from ?intent=
// when present, so a "Request a catalogue" link and a "Request quality
// documents" link land on the same form and the same backend but arrive
// distinguishable. Anything not in INTENTS falls back to the form's default,
// so a stray or hand-edited value can never write an arbitrary string into
// the column.
(function () {
  var PAGE_LANG = (document.documentElement.lang || '').toLowerCase();
  var LANG = PAGE_LANG === 'ar' ? 'ar' : PAGE_LANG.slice(0, 2) === 'pt' ? 'pt' : 'en';

  // The stored value is deliberately English in both locales: it is an
  // internal classification read in the admin inquiry list and exported to
  // CSV, not something a visitor sees. 'Quote Request' and 'Sample Request'
  // are the two values already in the table and are unchanged.
  var INTENTS = {
    quote: 'Quote Request',
    sample: 'Sample Request',
    catalog: 'Catalog Request',
    documents: 'Quality Documents Request',
    private_label: 'Private Label Inquiry',
    local_pricing: 'Local Pricing Request (Egypt)'
  };

  var STRINGS = {
    en: {
      sending: 'Sending...',
      contactSuccess: 'Thank you — your request has been received. Our export team will respond within 24 hours.',
      sampleSuccess: 'Thank you — your sample request has been received. Our export team will confirm within 24 hours.',
      generic: 'Something went wrong sending your request. Please try again, or email sales@olivesegypt.com directly.',
      network: 'Network error — please try again, or email sales@olivesegypt.com directly.',
      preview: 'This is a preview copy of the site: nothing was sent. Forms send only from olivesegypt.com.',
      shipping: 'Shipping Address:',
      notes: 'Additional Notes:'
    },
    ar: {
      sending: 'جارٍ الإرسال...',
      contactSuccess: 'شكرًا لك — تم استلام طلبك. سيرد فريق التصدير لدينا خلال 24 ساعة.',
      sampleSuccess: 'شكرًا لك — تم استلام طلب العينة. سيؤكده فريق التصدير لدينا خلال 24 ساعة.',
      generic: 'حدث خطأ أثناء إرسال طلبك. يرجى المحاولة مرة أخرى، أو مراسلتنا مباشرة على sales@olivesegypt.com.',
      network: 'خطأ في الشبكة — يرجى المحاولة مرة أخرى، أو مراسلتنا مباشرة على sales@olivesegypt.com.',
      preview: 'هذه نسخة معاينة من الموقع: لم يُرسل أي شيء. لا تُرسل النماذج إلا من olivesegypt.com.',
      shipping: 'Shipping Address:',
      notes: 'Additional Notes:'
    },
    // /pt-br/ (owner, 2026-10-26): draft wording, awaiting a Brazilian
    // reader. The reply time: 24 hours Sunday to Thursday, two business days
    // for a request that arrives on the Egyptian weekend, Cairo time (C-186).
    // The server's own messages are English, so this page shows its own
    // instead (rate, generic).
    pt: {
      sending: 'Enviando...',
      contactSuccess: 'Obrigado — recebemos sua solicitação. Respondemos em até 24 horas de domingo a quinta-feira (horário do Cairo); se ela chegou na sexta ou no sábado, em até dois dias úteis (domingo a quinta).',
      sampleSuccess: 'Obrigado — recebemos seu pedido de amostra. Confirmamos em até 24 horas de domingo a quinta-feira (horário do Cairo); se ele chegou na sexta ou no sábado, em até dois dias úteis (domingo a quinta).',
      generic: 'Não foi possível enviar sua solicitação. Confira os campos obrigatórios e tente novamente, ou escreva para sales@olivesegypt.com.',
      rate: 'Recebemos vários envios seguidos deste endereço. Tente novamente mais tarde ou escreva para sales@olivesegypt.com.',
      network: 'Erro de conexão — tente novamente ou escreva para sales@olivesegypt.com.',
      preview: 'Esta é uma cópia de pré-visualização do site: nada foi enviado. Os formulários só enviam a partir de olivesegypt.com.',
      shipping: 'Shipping Address:',
      notes: 'Additional Notes:'
    }
  };
  var T = STRINGS[LANG];

  // Only the live site sends. A form filled in on a deploy preview or a
  // local copy used to reach the real CRM and send real notification email;
  // there it now says so and sends nothing. Same rule as consent.js.
  var LIVE_HOST = /^(www\.)?olivesegypt\.com$/.test(window.location.hostname);

  function val(id) {
    var el = document.getElementById(id);
    return el ? el.value.trim() : '';
  }

  // Solutions pages send buyers here as /contact?intent=...&from=/solutions/<page>,
  // so the enquiry records which buyer page it came from even when the browser
  // withholds the referrer. Only a Solutions path is accepted; anything else
  // falls back to the referrer, as before.
  function sourcePage() {
    // The Portuguese page carries its own form, so the referrer would name
    // the page before it. Its own address is what tells the CRM the enquiry
    // came in Portuguese (Option A, owner 2026-10-25: no database change).
    if (/^\/pt-br(\/|$)/.test(window.location.pathname)) return window.location.origin + '/pt-br/';
    var m = /[?&]from=(\/(?:ar\/)?solutions(?:\/[a-z-]+)?)(?:&|$)/.exec(window.location.search);
    if (m) return window.location.origin + m[1];
    return document.referrer || window.location.href;
  }

  function requestType(fallback) {
    var m = /[?&]intent=([a-z_]+)/.exec(window.location.search);
    return (m && INTENTS[m[1]]) || fallback;
  }

  function init(prefix, defaultType, buildPayload, successText, eventName) {
    var form = document.getElementById(prefix + '-form');
    var statusEl = document.getElementById(prefix + '-form-status');
    var submitBtn = document.getElementById(prefix + '-submit-btn');
    if (!form || !statusEl || !submitBtn) return;

    var restore = submitBtn.textContent;

    function showStatus(kind, text) {
      statusEl.textContent = text;
      statusEl.classList.remove('hidden', 'border-destructive/50', 'bg-destructive/10', 'text-destructive',
                                'border-green-600/40', 'bg-green-50', 'text-green-700');
      if (kind === 'error') {
        statusEl.classList.add('border-destructive/50', 'bg-destructive/10', 'text-destructive');
      } else {
        statusEl.classList.add('border-green-600/40', 'bg-green-50', 'text-green-700');
      }
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      statusEl.classList.add('hidden');

      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      if (!LIVE_HOST) {
        showStatus('error', T.preview);
        return;
      }

      var payload = buildPayload();
      payload.request_type = requestType(defaultType);
      payload.source_page = sourcePage();
      payload.website = val(prefix + '-website');

      // Ties this enquiry to the visit that produced it, so it can be
      // attributed to how the visitor arrived. Null without analytics
      // consent, and never creates a session -- see TC.currentSessionId.
      // Guarded because analytics.js may be blocked or not yet loaded, and
      // an enquiry must go through regardless.
      payload.session_id = (window.TC && typeof TC.currentSessionId === 'function')
        ? TC.currentSessionId()
        : null;

      submitBtn.disabled = true;
      submitBtn.textContent = T.sending;

      fetch('/api/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (data) {
          return { ok: res.ok, status: res.status, data: data };
        });
      }).then(function (result) {
        submitBtn.disabled = false;
        submitBtn.textContent = restore;
        if (result.ok && result.data && result.data.ok) {
          if (window.TC && TC.trackEvent) {
            TC.trackEvent(eventName, {
              source_page: payload.source_page,
              product: payload.product_interest || null,
              request_type: payload.request_type
            });
          }
          if (window.TC && TC.logEvent) {
            TC.logEvent(prefix + '_form_submit', { source_page: payload.source_page });
          }
          if (window.TC && TC.trackLead) TC.trackLead(prefix, payload.request_type);
          form.reset();
          showStatus('success', successText);
          if (window.TC && TC.trackEvent) {
            TC.trackEvent('form_confirmation_viewed', { source_page: payload.source_page, form: prefix });
          }
        } else {
          if (LANG === 'pt') showStatus('error', result.status === 429 ? T.rate : T.generic);
          else showStatus('error', (result.data && result.data.error) || T.generic);
        }
      }).catch(function () {
        submitBtn.disabled = false;
        submitBtn.textContent = restore;
        showStatus('error', T.network);
      });
    });
  }

  function start() {
    init('contact', INTENTS.quote, function () {
      return {
        name: val('contact-name'),
        email: val('contact-email'),
        company: val('contact-company'),
        country: val('contact-country'),
        phone: val('contact-phone') || undefined,
        product_interest: val('contact-product') || undefined,
        estimated_volume: val('contact-volume') || undefined,
        message: val('contact-message')
      };
    }, T.contactSuccess, 'quote_request_submitted');

    init('sample', INTENTS.sample, function () {
      // The sample form has no message field of its own; the address and any
      // notes are composed into one, exactly as the Arabic page already did.
      var shipping = val('sample-shipping');
      var notes = val('sample-notes');
      return {
        name: val('sample-name'),
        email: val('sample-email'),
        company: val('sample-company'),
        country: val('sample-country'),
        phone: val('sample-phone') || undefined,
        product_interest: val('sample-product') || undefined,
        message: T.shipping + '\n' + shipping + (notes ? '\n\n' + T.notes + '\n' + notes : '')
      };
    }, T.sampleSuccess, 'sample_request_submitted');

    // Part F: when a visitor arrives with an intent, say so on the page
    // rather than only in the hidden payload -- a form that silently
    // reclassifies your enquiry is worse than one that does not classify it.
    var m = /[?&]intent=([a-z_]+)/.exec(window.location.search);
    var badge = document.querySelector('[data-intent-badge]');
    if (badge && m && INTENTS[m[1]]) {
      var label = badge.getAttribute('data-intent-' + m[1]);
      if (label) {
        badge.textContent = label;
        badge.hidden = false;
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
