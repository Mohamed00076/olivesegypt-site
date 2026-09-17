'use strict';

// Shared handler for every lead form on the site. Two modes, one
// implementation -- the shared-infrastructure rule for this project is that
// a new form is a new declaration, never a new form system.
//
//   data-gated-download="<segment>"  a gated PDF. On success it reveals a
//                                    link to the guide (Part C).
//   data-lead-form="<segment>"       an ordinary enquiry, e.g. the
//                                    private-label brief (Part D). Same
//                                    submit, same errors, no reveal.
//
// Both post to POST /api/leads (netlify/functions/leads.js) -- same staging
// table, same validation, same honeypot, same rate limiting. Only the
// `segment` value and the post-success behaviour differ.
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
//     (optional) data-success-message="..." on the <form> overrides the
//     default confirmation, for forms whose success is not "we have your brief".
//     (optional) data-status-on-dark on the <form> switches the status
//     message to light-on-dark colours, for a form on a dark panel.
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
      sent: 'Thank you — we have your brief and will come back to you.',
      rateLimited: 'Too many requests — please try again in a little while.',
      generic: 'Something went wrong. Please try again, or email sales@olivesegypt.com directly.',
      network: 'Network error — please try again, or email sales@olivesegypt.com directly.'
    },
    ar: {
      success: 'شكرًا لك — الدليل جاهز أدناه.',
      sent: 'شكرًا لك — وصلنا موجزك وسنعاود التواصل معك.',
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
    var gated = form.hasAttribute('data-gated-download');
    var segment = gated ? form.getAttribute('data-gated-download')
                        : form.getAttribute('data-lead-form');
    var guideUrl = form.getAttribute('data-guide-url');
    // a gated form without somewhere to send the visitor is a broken gate,
    // not a plain enquiry form -- refuse to wire it up rather than silently
    // degrade it into one
    if (!segment || (gated && !guideUrl)) return;

    var submitBtn = form.querySelector('[data-role="submit"]');
    var status = form.querySelector('[data-role="status"]');
    var reveal = form.querySelector('[data-role="download-reveal"]');
    var link = form.querySelector('[data-role="download-link"]');

    // The default pair is sized for a light card. The market-brief form sits
    // on the olive gradient panel, where the default green measures 1.06:1
    // against the backdrop -- readable only if you already know what it says.
    //
    // Recolouring alone cannot fix it: that panel is light enough that even
    // pure white reaches only 4.49:1 at this 12px size, just under AA. So a
    // form on a dark panel gets the message on its own darkened chip, and
    // the text is then measured against the chip rather than the panel.
    var onDark = form.hasAttribute('data-status-on-dark');
    var STATUS_COLOR = onDark
      ? { error: '#fee2e2', success: '#dcfce7' }
      : { error: '#b91c1c', success: '#15803d' };

    function showStatus(kind, text) {
      if (!status) return;
      status.textContent = text;
      status.classList.remove('hidden');
      status.style.color = kind === 'error' ? STATUS_COLOR.error : STATUS_COLOR.success;
      if (onDark) {
        status.style.background = 'rgba(0,0,0,0.45)';
        status.style.padding = '8px 10px';
        status.style.borderRadius = '8px';
      }
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

      // Optional fields. Only the ones this particular form actually
      // renders are sent; the endpoint rejects any key outside its allow
      // list, so a typo here fails loudly rather than being dropped.
      var OPTIONAL = ['target_market', 'variety', 'format', 'pack_size',
                      'volume', 'certification_requirements', 'launch_date',
                      'incoterm'];

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

      OPTIONAL.forEach(function (name) {
        var el = field(form, name);
        if (el && el.value.trim()) payload[name] = el.value.trim();
      });

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
          // A form may state its own confirmation: 'we have your brief' is
          // right for the private-label brief and wrong for a subscription.
          showStatus('success', form.getAttribute('data-success-message')
                                || (gated ? T.success : T.sent));
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
    var forms = document.querySelectorAll('form[data-gated-download], form[data-lead-form]');
    Array.prototype.forEach.call(forms, initForm);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
