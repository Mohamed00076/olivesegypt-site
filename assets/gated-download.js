'use strict';

// Shared handler for gated PDF download forms (Part C: pricing/packaging
// guide, origin/comparison guide, buyer's guide). Reuses the exact same
// backend as the homepage "Get the Market Brief" form (POST /api/leads,
// see netlify/functions/leads.js) -- same staging table, same validation,
// same honeypot + rate limiting. Only the `segment` value and the
// post-success behavior differ: instead of a plain thank-you message,
// a successful submit reveals a link to the requested guide page.
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
          showStatus('success', 'Thank you — your guide is ready below.');
          if (link) link.setAttribute('href', guideUrl);
          if (reveal) reveal.classList.remove('hidden');
          form.querySelectorAll('input, select, button[type="submit"]').forEach(function (el) {
            el.disabled = true;
          });
        } else if (result.data && result.data.error === 'Too many requests. Please try again later.') {
          showStatus('error', 'Too many requests — please try again in a little while.');
        } else {
          showStatus('error', 'Something went wrong. Please try again, or email sales@olivesegypt.com directly.');
        }
      }).catch(function () {
        if (submitBtn) submitBtn.disabled = false;
        showStatus('error', 'Network error — please try again, or email sales@olivesegypt.com directly.');
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
