'use strict';

/*
 * The unsubscribe form on /unsubscribe and /ar/unsubscribe.
 *
 * Deliberately small. One field, one button, one outcome message -- a person
 * who has decided to leave should not have to read anything or make a second
 * decision. There is no "are you sure", no reason-picker, and no upsell.
 *
 * If ?email= is present the field is pre-filled but nothing is submitted for
 * the visitor: acting on a URL alone would let a link in a forwarded message
 * opt someone out without a click.
 */
(function () {
  var STRINGS = {
    en: {
      done: 'Done — we have recorded that you do not want to be contacted. You can close this page.',
      invalid: 'Please enter the email address you used, so we can find it.',
      rateLimited: 'Too many requests from this connection. Please try again in a little while, or email sales@olivesegypt.com.',
      generic: 'Something went wrong and your request was not recorded. Please email sales@olivesegypt.com and we will remove you by hand.',
      network: 'Network error — your request was not recorded. Please try again, or email sales@olivesegypt.com.',
      working: 'Recording your request…'
    },
    ar: {
      done: 'تم — سجّلنا رغبتك في عدم التواصل معك. يمكنك إغلاق هذه الصفحة.',
      invalid: 'يرجى إدخال البريد الإلكتروني الذي استخدمته حتى نتمكن من العثور عليه.',
      rateLimited: 'طلبات كثيرة من هذا الاتصال. يرجى المحاولة بعد قليل، أو مراسلتنا على sales@olivesegypt.com.',
      generic: 'حدث خطأ ولم يُسجَّل طلبك. يرجى مراسلتنا على sales@olivesegypt.com وسنزيلك يدويًا.',
      network: 'خطأ في الشبكة — لم يُسجَّل طلبك. يرجى المحاولة مرة أخرى، أو مراسلتنا على sales@olivesegypt.com.',
      working: 'جارٍ تسجيل طلبك…'
    }
  };

  function init() {
    var form = document.getElementById('unsubscribe-form');
    if (!form) return;

    var T = STRINGS[document.documentElement.lang === 'ar' ? 'ar' : 'en'];
    var input = document.getElementById('unsubscribe-email');
    var button = form.querySelector('button[type="submit"]');
    var status = document.getElementById('unsubscribe-status');

    var prefill = new URLSearchParams(location.search).get('email');
    if (prefill && input && !input.value) input.value = prefill;

    function show(kind, text) {
      status.textContent = text;
      status.classList.remove('hidden');
      status.style.color = kind === 'error' ? '#b91c1c' : '#15803d';
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = (input.value || '').trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        show('error', T.invalid);
        input.focus();
        return;
      }

      button.disabled = true;
      show('ok', T.working);

      fetch('/api/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, source_page: location.pathname })
      }).then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (data) {
          return { status: res.status, data: data };
        });
      }).then(function (r) {
        if (r.status === 200 && r.data && r.data.ok) {
          // The form is replaced by the outcome rather than left sitting
          // there looking un-submitted.
          form.querySelectorAll('input, button').forEach(function (el) { el.disabled = true; });
          show('ok', T.done);
          return;
        }
        button.disabled = false;
        if (r.status === 429) show('error', T.rateLimited);
        else if (r.status === 400) show('error', T.invalid);
        else show('error', T.generic);
      }).catch(function () {
        button.disabled = false;
        show('error', T.network);
      });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
