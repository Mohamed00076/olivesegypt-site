'use strict';

// Shared handler for gated PDF download forms (Part C: pricing/packaging
// guide, origin/comparison guide, buyer's guide). Reuses the exact same
// backend as the homepage "Get the Market Brief" form (POST /api/leads,
// see netlify/functions/leads.js) -- same staging table, same validation,
// same honeypot + rate limiting. Only the `segment` value and the
// post-success behavior differ: instead of a plain thank-you message,
// a successful submit reveals a link to the requested guide page.
//
// That reveal is presentation only. The gate itself is server-side: the
// guide pages are no longer static files, and the function serving them
// requires a short-lived signed token that only a successful POST
// /api/leads issues. Nothing here decides whether a guide opens.
//
// Markup contract, scoped per-<form> so more than one of these can live
// on the same page (e.g. the /downloads hub) without id collisions:
//
//   <form data-gated-download="pricing_guide" data-guide-url="/downloads/pricing-packaging-guide/">
//     <input data-field="email" type="email" required />
//     <input data-field="company_name" type="text" required />
//     <input data-field="country_region" type="text" required />
//     <select data-field="buyer_type" required>...</select>
//     <input data-field="website" type="text" tabindex="-1" autocomplete="off" />  (honeypot, hidden off-screen)
//     <input data-field="consent" type="checkbox" required />
//     <button type="submit" data-role="submit">...</button>
//     <p data-role="status" class="hidden" role="status" aria-live="polite"></p>
//     <div data-role="download-reveal" class="hidden">
//       <a data-role="download-link" target="_blank" rel="noopener noreferrer">...</a>
//     </div>
//   </form>
(function () {
  var STRINGS = {
    en: {
      success: 'Thank you — your guide is ready below.',
      rateLimited: 'Too many requests — please try again in a little while.',
      generic: 'Something went wrong. Please try again, or email sales@olivesegypt.com directly.',
      network: 'Network error — please try again, or email sales@olivesegypt.com directly.'
    },
    ar: {
      success: 'شكرًا لك — الدليل جاهز أدناه.',
      rateLimited: 'عدد كبير جدًا من الطلبات — يرجى المحاولة مرة أخرى بعد قليل.',
      generic: 'حدث خطأ ما. يرجى المحاولة مرة أخرى، أو مراسلتنا مباشرة على sales@olivesegypt.com.',
      network: 'خطأ في الشبكة — يرجى المحاولة مرة أخرى، أو مراسلتنا مباشرة على sales@olivesegypt.com.'
    }
  };
  var LANG = (document.documentElement.lang === 'ar') ? 'ar' : 'en';
  var T = STRINGS[LANG];

  function field(form, name) {
    return form.querySelector('[data-field="' + name + '"]');
  }

  function initForm(form) {
    var segment = form.getAttribute('data-gated-download');
    var guideUrl = form.getAttribute('data-guide-url');
    if (!segment || !guideUrl) return;

    var submitBtn = form.querySelector('[data-role="submit"]');
    var status = form.querySelector('[data-role="status"]');
    var reveal = form.querySelector('[data-role="download-reveal"]');
    var link = form.querySelector('[data-role="download-link"]');

    function showStatus(kind, text) {
      if (!status) return;
      status.textContent = text;
      status.classList.remove('hidden');
      status.style.color = kind === 'error' ? '#b91c1c' : '#15803d';
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (status) status.classList.add('hidden');

      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      var emailEl = field(form, 'email');
      var companyEl = field(form, 'company_name');
      var countryEl = field(form, 'country_region');
      var buyerTypeEl = field(form, 'buyer_type');
      var consentEl = field(form, 'consent');
      var websiteEl = field(form, 'website');

      var payload = {
        email: emailEl ? emailEl.value.trim() : '',
        company_name: companyEl ? companyEl.value.trim() : '',
        country_region: countryEl ? countryEl.value.trim() : '',
        buyer_type: buyerTypeEl ? buyerTypeEl.value : '',
        consent: !!(consentEl && consentEl.checked),
        source_page: location.pathname,
        segment: segment,
        website: websiteEl ? websiteEl.value : ''
      };

      if (submitBtn) submitBtn.disabled = true;

      fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (data) {
          return { ok: res.ok, data: data };
        });
      }).then(function (result) {
        if (submitBtn) submitBtn.disabled = false;
        if (result.ok && result.data && result.data.ok) {
          showStatus('success', T.success);
          // The guide is served by a function that requires a signed
          // token (netlify/functions/guide.js). The main carrier is an
          // HttpOnly cookie set on this same response, which this script
          // cannot see and does not need to; the token echoed in the
          // JSON is the fallback for browsers that refuse first-party
          // cookies, and rides on the link instead.
          if (link) {
            var href = guideUrl;
            if (result.data.guide_token) {
              href += (href.indexOf('?') >= 0 ? '&' : '?') + 't=' + encodeURIComponent(result.data.guide_token);
            }
            link.setAttribute('href', href);
          }
          if (reveal) reveal.classList.remove('hidden');
          form.querySelectorAll('input, select, button[type="submit"]').forEach(function (el) {
            el.disabled = true;
          });
        } else if (result.data && result.data.error === 'Too many requests. Please try again later.') {
          showStatus('error', T.rateLimited);
        } else {
          showStatus('error', T.generic);
        }
      }).catch(function () {
        if (submitBtn) submitBtn.disabled = false;
        showStatus('error', T.network);
      });
    });
  }

  function init() {
    var forms = document.querySelectorAll('form[data-gated-download]');
    forms.forEach(initForm);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
