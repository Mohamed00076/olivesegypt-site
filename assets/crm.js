/* Buyer CRM shared utilities (Section H). No dependency on assets/
   analytics.js or assets/consent.js -- this is an internal tool behind
   its own authentication, not part of the public site's visitor
   tracking/consent surface (see docs/g1-data-flow-inventory.md, which
   scopes G1 to visitor-facing data flows; CRM staff usage is a
   different, internal system). */
(function (window) {
  'use strict';

  var CRM = window.CRM = {};

  CRM.STAGES = [
    'Lead', 'Contacted', 'Qualifying', 'Sample Requested', 'Sample Sent',
    'Negotiation', 'Contract Signed', 'Shipment Prepared', 'Exported/Completed',
    'Lost/Stalled',
  ];
  // Same list, same order, as REGIONS in netlify/functions/_crm_lib.js --
  // scripts/check-enquiry-intake.js fails if they drift.
  CRM.REGIONS = [
    'Africa', 'Middle East', 'Asia', 'EU', 'Europe (non-EU)',
    'North America', 'South America', 'Oceania', 'Unassigned',
  ];
  // The products the website sells, in the site's order (scripts/products.js).
  CRM.PRODUCTS = [
    ['green-olives', 'Green Olives'],
    ['stuffed-green-olives', 'Stuffed Green Olives'],
    ['natural-black-olives', 'Natural Black Olives'],
    ['oxidized-black-olives', 'Oxidized Black Olives'],
    ['sliced-jalapeno-peppers', 'Sliced Jalapeño Peppers'],
    ['marinated-artichoke-hearts', 'Marinated Artichoke Hearts'],
    ['pepperoncini-peppers', 'Pepperoncini Peppers'],
  ];
  // Products no longer offered. A buyer already tagged with one keeps the tag,
  // shown with this label, but it cannot be chosen for a new buyer or put on
  // a new document; no record is rewritten. Hamed: withdrawn 2026-09-28, "not
  // confirmed available". The cultivar products and Kalamata: retired
  // 2026-10-10, when the range moved to olive types.
  CRM.WITHDRAWN_PRODUCTS = [
    ['hamed-green-olives', 'Hamed Green Olives (withdrawn)'],
    ['aggizi-green-olives', 'Aggizi Green Olives (legacy: now Green Olives)'],
    ['toffahi-green-olives', 'Toffahi Green Olives (legacy: now Green Olives)'],
    ['manzanilla-green-olives', 'Manzanilla Green Olives (legacy: now Green Olives)'],
    ['pepper-stuffed-green-olives', 'Stuffed Green Olives (legacy id)'],
    ['kalamata-olives', 'Kalamata Olives (not supplied)'],
  ];

  CRM.escapeHtml = function (s) {
    var d = document.createElement('div');
    d.textContent = s === null || s === undefined ? '' : String(s);
    return d.innerHTML;
  };

  // Every CRM page calls this before rendering anything. A 401 here is
  // the deny-by-default gate (Rule 22) -- no page renders CRM data
  // without a confirmed session first.
  CRM.requireAuth = function () {
    return fetch('/api/crm/auth/me', { credentials: 'same-origin' })
      .then(function (res) {
        if (res.status === 401) {
          window.location.href = '/crm/login/?next=' + encodeURIComponent(window.location.pathname);
          return Promise.reject(new Error('unauthorized'));
        }
        return res.json();
      })
      .then(function (data) {
        CRM.user = data.user;
        return data.user;
      });
  };

  CRM.logout = function () {
    fetch('/api/crm/auth/logout', { method: 'POST', credentials: 'same-origin' }).then(function () {
      window.location.href = '/crm/login/';
    });
  };

  CRM.fetchJson = function (url, opts) {
    opts = opts || {};
    opts.credentials = 'same-origin';
    if (opts.body && typeof opts.body !== 'string') opts.body = JSON.stringify(opts.body);
    if (opts.body) opts.headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
    return fetch(url, opts).then(function (res) {
      if (res.status === 401) {
        window.location.href = '/crm/login/?next=' + encodeURIComponent(window.location.pathname);
        return Promise.reject(new Error('unauthorized'));
      }
      return res.json().then(function (data) { return { ok: res.ok, status: res.status, data: data }; });
    });
  };

  /*
   * A request that ended without a readable reply.
   *
   * CRM.fetchJson rejects when the connection drops or the server answers
   * with an error page instead of JSON -- a function timeout, for one. Four
   * pages caught that and said nothing: the Save button came back, a Kanban
   * card snapped back, and staff were left to guess (found 2026-09-27).
   *
   * Guessing either way is wrong. The server may have finished the change and
   * only the reply was lost, so "it failed" would be as untrue as silence. The
   * message says what is actually known -- nothing -- and the one safe next
   * step, which differs by action: saving an edit again does no harm, but
   * creating a buyer, a document or an import twice does.
   *
   * Returns null for the sign-in redirect, which is not a failure to report.
   */
  CRM.noReplyMessage = function (err, what, nextStep) {
    if (err && err.message === 'unauthorized') return null;
    return what + ' did not get a reply from the server, so it is not known whether it went through. ' + nextStep;
  };

  /*
   * Four places, not ten links.
   *
   * The nav had grown to Dashboard, Buyers, Kanban, New Quotation, New
   * Invoice, New Letter, Documents, Add Buyer, Letterhead and Log Out. Three
   * of those were the same action with a different document type, two were
   * two views of the same buyer list, and Add Buyer duplicated a button that
   * already sits on the Buyers page. The owner's word for it was "some stuff
   * seems to repeat".
   *
   * A navigation bar should answer "where do I go", and a page should answer
   * "what can I do here". So the bar now names the four places this CRM has,
   * and every create action lives as a button on the page it belongs to:
   * Add Buyer on Buyers, the three New Document buttons on Documents. Kanban
   * becomes a view toggle on Buyers rather than a separate destination,
   * because it is the same records in a different shape.
   */
  CRM.NAV = [
    ['/crm/', 'Dashboard'],
    ['/crm/inquiries/', 'Enquiries'],
    ['/crm/buyers/', 'Buyers'],
    ['/crm/documents/', 'Documents'],
    ['/letterhead/', 'Letterhead'],
    // Arabic letterhead, on the owner's instruction 2026-09-25: "yes it
    // belong it to navigation i need arabic letterhead sometimes".
    //
    // Worth noting against the rule above, which says a language variant is
    // the same place rather than a different one, and would put this on the
    // letterhead page as an Arabic/English toggle instead of in the bar. The
    // owner was asked and chose the bar. Recording the tension rather than
    // pretending the rule was not there: a letterhead addressed to an Arabic
    // correspondent is a different sheet to reach for, not a different view
    // of the same one, which is a fair reading.
    ['/ar/letterhead/', 'Letterhead (AR)'],
  ];

  CRM.renderNav = function (active) {
    var html = '<div class="crm-header"><div class="crm-brand">Triple Company &middot; Buyer CRM</div><div class="crm-nav">';
    CRM.NAV.forEach(function (l) {
      html += '<a href="' + l[0] + '"' + (active === l[1] ? ' class="active"' : '') + '>' + l[1] + '</a>';
    });
    html += '<button type="button" id="crm-logout-btn">Log Out</button></div></div>';
    document.body.insertAdjacentHTML('afterbegin', html);
    var btn = document.getElementById('crm-logout-btn');
    if (btn) btn.addEventListener('click', CRM.logout);
    CRM.envBadge();
  };

  /*
   * Not the live site? Say so, above everything (owner, 2026-10-20).
   *
   * The address says whether this is olivesegypt.com; only the server can
   * say which database the copy is using, because a deploy preview stays on
   * the LIVE database until Netlify's variables are set for previews (step
   * L1 of the staging sheet). So the badge asks crm-environment.js, which
   * looks for the 'staging' label the staging database carries:
   *   label found  -> STAGING, test database (amber);
   *   no label     -> PREVIEW connected to the LIVE database (red);
   *   no answer    -> PREVIEW, database unknown, treat it as live (red).
   * Never shown on the live site, which makes no extra request for it.
   */
  CRM.LIVE_HOSTS = ['olivesegypt.com', 'www.olivesegypt.com'];
  CRM.envBadge = function () {
    if (CRM.LIVE_HOSTS.indexOf(window.location.hostname) !== -1) return null;
    if (document.getElementById('crm-env-badge')) return document.getElementById('crm-env-badge');
    var el = document.createElement('div');
    el.id = 'crm-env-badge';
    el.className = 'crm-ui-env crm-ui-env-live';
    el.setAttribute('role', 'status');
    el.textContent = 'PREVIEW \u00b7 not the live site \u00b7 checking which database it uses\u2026';
    document.body.insertBefore(el, document.body.firstChild);
    function say(kind, text) { el.className = 'crm-ui-env crm-ui-env-' + kind; el.textContent = text; }
    fetch('/api/crm/environment', { credentials: 'same-origin' }).then(function (res) {
      return res.json().then(function (d) { return { ok: res.ok, d: d }; });
    }).then(function (r) {
      if (r.ok && r.d && r.d.database === 'staging') say('staging', 'STAGING \u00b7 test database \u00b7 not the live site');
      else if (r.ok) say('live', 'PREVIEW \u00b7 connected to the LIVE database \u00b7 changes here change real records');
      else say('live', 'PREVIEW \u00b7 not the live site \u00b7 its database could not be checked: treat it as live');
    }).catch(function () {
      say('live', 'PREVIEW \u00b7 not the live site \u00b7 its database could not be checked: treat it as live');
    });
    return el;
  };

  CRM.stageBadgeClass = function (stage) {
    if (stage === 'Lost/Stalled') return 'crm-badge crm-badge-danger';
    if (stage === 'Exported/Completed') return 'crm-badge crm-badge-warn';
    return 'crm-badge';
  };

  /*
   * "20 Oct 2026" everywhere in the CRM (owner, 2026-10-20). The browser's
   * own format printed 10/20/2026 for an American locale and 20/10/2026 for
   * an Egyptian one -- 10/11/2026 is two different days depending on whose
   * laptop it is. Display only: what is stored and sent is unchanged.
   *
   * A date with no time (a due date, "2026-10-17", or the same at midnight
   * UTC as the database driver sends it) is shown as that calendar day; a
   * timestamp is shown as the day it was where the reader is.
   */
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  CRM.fmtDate = function (iso) {
    if (!iso) return '';
    var s = String(iso);
    var m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:T00:00:00(?:\.0+)?Z)?$/);
    if (m) return Number(m[3]) + ' ' + MONTHS[Number(m[2]) - 1] + ' ' + m[1];
    var d = new Date(s);
    if (isNaN(d.getTime())) return s;
    return d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear();
  };

  /* ---------------------------------------------------------------------
   * Saying that something failed, on the page (2026-10-20).
   *
   * Before this, a page that could not load its data either showed nothing
   * (Kanban, the buyer list), said something untrue ("Nothing received yet"
   * when the enquiries had failed to load), printed the server's own words
   * ("Server error"), or used the browser's pop-up, which is easy to dismiss
   * and offers no way forward. Now a failure is a banner in the page, in
   * plain words, read out by screen readers, with Retry where retrying makes
   * sense. Styles: assets/crm-ui.css, which the sign-in pages do not load.
   * --------------------------------------------------------------------- */

  // The server's short codes are for programs, not people.
  var RAW_ERRORS = /^(server error|validation failed|not found|unauthori[sz]ed|forbidden|method not allowed|server not configured|bad request|internal server error)\.?$/i;

  /*
   * A sentence for a person, from a fetch result or a thrown error. Our own
   * functions answer with full sentences when there is something useful to
   * say ("Q-2026-000041 is void, so nothing can be issued from it."); those
   * are kept. Codes and anything from a 5xx are replaced.
   */
  CRM.plainError = function (resultOrErr, fallback) {
    var r = resultOrErr || {};
    if (r instanceof Error || r.ok === undefined) {
      return 'The server did not answer. Check your connection and try again.';
    }
    var msg = r.data && typeof r.data.error === 'string' ? r.data.error.trim() : '';
    if (r.status >= 500 || !msg || RAW_ERRORS.test(msg)) {
      return fallback || (r.status >= 500
        ? 'Something went wrong on the server. It has been recorded, and nothing was changed.'
        : 'The server could not do this.');
    }
    return msg;
  };

  /*
   * A failed load is recorded where failures are recorded (crm_failures, the
   * dashboard's "Something failed" box, and the alert email), exactly once:
   *   - no reply, or a reply that was not the function's own JSON (a timeout,
   *     a deploy in progress, a dropped connection): the server never saw it
   *     fail, so the page reports it;
   *   - a 5xx from one of our functions: that function already recorded it in
   *     its own catch, so the page does not report it again;
   *   - any other refusal of a load (4xx other than signing in): reported, as
   *     a page asking for something the server will not give is a fault.
   * Never throws, never retries, and a failure to report is only logged.
   */
  CRM.reportLoadFailure = function (what, resultOrErr) {
    try {
      var r = resultOrErr || {};
      if (r.message === 'unauthorized') return;
      var kind, status = null;
      if (r instanceof Error || r.ok === undefined) kind = 'no-reply';
      else if (r.status >= 500) return;
      else if (r.status === 401) return;
      else { kind = 'refused'; status = r.status; }
      fetch('/api/crm/client-failure', {
        method: 'POST', credentials: 'same-origin', keepalive: true,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page: window.location.pathname, what: what, kind: kind, status: status }),
      }).catch(function () { console.warn('[crm] could not record a failed load'); });
    } catch (e) { /* reporting must never become a second failure */ }
  };

  function banner(kind, message, retry) {
    var el = document.createElement('div');
    el.className = 'crm-ui-banner crm-ui-banner-' + kind;
    el.setAttribute('role', kind === 'error' ? 'alert' : 'status');
    el.setAttribute('aria-live', kind === 'error' ? 'assertive' : 'polite');
    var text = document.createElement('p');
    text.textContent = message;
    el.appendChild(text);
    if (retry) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'crm-ui-banner-retry';
      btn.textContent = 'Retry';
      btn.addEventListener('click', function () { el.remove(); retry(); });
      el.appendChild(btn);
    }
    return el;
  }

  /*
   * A load failed: put a banner at the top of `container` (replacing any
   * earlier one there), record the failure, and offer Retry.
   *   what:  what could not be loaded, for a person ("the buyer list")
   *   key:   a short name for the record ("buyers-list"), see crm-client-failure.js
   */
  CRM.loadError = function (container, opts) {
    var o = opts || {};
    if (o.error && o.error.message === 'unauthorized') return null;
    CRM.reportLoadFailure(o.key || 'unknown', o.error);
    var reason = CRM.plainError(o.error);
    var msg = (o.what ? o.what.charAt(0).toUpperCase() + o.what.slice(1) + ' could not be loaded. ' : '') + reason;
    return CRM.showError(container, msg, o.retry);
  };

  // Any other failure (a save, a move, a void): a banner, no record -- the
  // function that refused it has already recorded anything worth recording.
  CRM.showError = function (container, message, retry) {
    if (!container) return null;
    CRM.clearBanner(container);
    var el = banner('error', message, retry);
    container.insertBefore(el, container.firstChild);
    return el;
  };
  // Something needs attention soon but nothing failed (amber).
  CRM.showWarning = function (container, message) {
    if (!container) return null;
    CRM.clearBanner(container);
    var el = banner('warning', message, null);
    container.insertBefore(el, container.firstChild);
    return el;
  };
  CRM.showNotice = function (container, message) {
    if (!container) return null;
    CRM.clearBanner(container);
    var el = banner('notice', message, null);
    container.insertBefore(el, container.firstChild);
    return el;
  };
  CRM.clearBanner = function (container) {
    if (!container) return;
    Array.prototype.forEach.call(container.querySelectorAll(':scope > .crm-ui-banner'), function (b) { b.remove(); });
  };

  /*
   * "Are you sure?" in the page, not the browser's pop-up (2026-10-20).
   * Resolves true only for an explicit Confirm. Escape, Cancel, or a click
   * outside the panel resolve false. The server's own confirmation rules
   * (confirmed=1 and the like) are unchanged -- this replaces only the
   * question, not the check.
   *
   * opts: { title, message, confirm: 'Delete', danger: true,
   *         typeToConfirm: 'Example Foods GmbH' }  -- the last for Erase:
   *         Confirm stays disabled until the name is typed exactly.
   */
  /*
   * The control that was last pressed. Focus goes back to it when a dialog
   * closes. document.activeElement is not enough: Safari on an iPhone does
   * not focus a button when it is tapped, so a dialog opened by a tap would
   * hand focus back to the page instead of the button.
   */
  var lastPressed = null;
  function notePressed(e) {
    var t = e.target && e.target.closest ? e.target.closest('button, a[href], input, select, textarea, [tabindex]') : null;
    if (t) lastPressed = t;
  }
  document.addEventListener('pointerdown', notePressed, true);
  document.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') notePressed(e); }, true);

  CRM.ask = function (opts) {
    var o = opts || {};
    return new Promise(function (resolve) {
      var back = document.createElement('div');
      back.className = 'crm-ui-dialog-back';
      var box = document.createElement('div');
      box.className = 'crm-ui-dialog';
      box.setAttribute('role', 'alertdialog');
      box.setAttribute('aria-modal', 'true');
      var id = 'crm-ui-dialog-' + Date.now();
      box.setAttribute('aria-labelledby', id + '-t');
      box.setAttribute('aria-describedby', id + '-m');
      var h = document.createElement('h2'); h.id = id + '-t'; h.textContent = o.title || 'Are you sure?';
      var p = document.createElement('p'); p.id = id + '-m'; p.textContent = o.message || '';
      box.appendChild(h); box.appendChild(p);
      /*
       * checkbox: { label, detail, checked } -- a choice made as part of the
       * confirmation (Erase: "Also delete the files uploaded to this buyer").
       * With one, a Confirm resolves { checked: true|false } instead of true.
       */
      var check = null;
      if (o.checkbox) {
        var cl = document.createElement('label'); cl.className = 'crm-ui-dialog-check';
        check = document.createElement('input'); check.type = 'checkbox'; check.checked = o.checkbox.checked !== false;
        var ct = document.createElement('span'); ct.textContent = o.checkbox.label || '';
        cl.appendChild(check); cl.appendChild(ct); box.appendChild(cl);
        if (o.checkbox.detail) {
          var cd = document.createElement('div'); cd.className = 'crm-ui-dialog-check-detail'; cd.setAttribute('dir', 'auto');
          cd.textContent = o.checkbox.detail; box.appendChild(cd);
        }
      }
      /*
       * reason: { label, maxlength } -- a short required answer (moving a
       * buyer to Lost/Stalled asks why). Confirm stays disabled until it is
       * filled in, and a Confirm resolves { reason: '...' }.
       */
      var reasonInput = null;
      if (o.reason) {
        var rl = document.createElement('label');
        rl.setAttribute('for', id + '-r');
        rl.textContent = o.reason.label || 'Reason';
        reasonInput = document.createElement('input');
        reasonInput.id = id + '-r'; reasonInput.type = 'text'; reasonInput.setAttribute('dir', 'auto');
        reasonInput.maxLength = o.reason.maxlength || 300;
        if (o.reason.value) reasonInput.value = o.reason.value;
        box.appendChild(rl); box.appendChild(reasonInput);
      }
      var input = null;
      if (o.typeToConfirm) {
        var lab = document.createElement('label');
        lab.setAttribute('for', id + '-i');
        lab.textContent = o.typeLabel || ('Type ' + o.typeToConfirm + ' to confirm');
        input = document.createElement('input');
        input.id = id + '-i'; input.type = 'text'; input.autocomplete = 'off'; input.spellcheck = false;
        input.setAttribute('dir', 'auto');
        box.appendChild(lab); box.appendChild(input);
      }
      var row = document.createElement('div'); row.className = 'crm-ui-dialog-actions';
      var cancel = document.createElement('button'); cancel.type = 'button'; cancel.className = 'crm-btn crm-btn-secondary'; cancel.textContent = o.cancel || 'Cancel';
      var ok = document.createElement('button'); ok.type = 'button';
      ok.className = 'crm-btn ' + (o.danger ? 'crm-ui-btn-danger' : 'crm-btn-primary');
      ok.textContent = o.confirm || 'Confirm';
      row.appendChild(cancel); row.appendChild(ok); box.appendChild(row);
      back.appendChild(box);
      var before = document.activeElement && document.activeElement !== document.body ? document.activeElement : lastPressed;
      function norm(v) { return String(v || '').trim().replace(/\s+/g, ' ').toLowerCase(); }
      function sync() {
        ok.disabled = (input ? norm(input.value) !== norm(o.typeToConfirm) : false) || (reasonInput ? !reasonInput.value.trim() : false);
      }
      function done(v) {
        document.removeEventListener('keydown', onKey, true);
        back.remove();
        if (before && before.focus && document.contains(before)) { try { before.focus(); } catch (e) { /* gone */ } }
        resolve(v);
      }
      function onKey(e) {
        if (e.key === 'Escape') { e.preventDefault(); done(false); }
        if (e.key === 'Tab') {
          // Keep focus inside the panel while it is open.
          var f = Array.prototype.filter.call(box.querySelectorAll('button, input'), function (x) { return !x.disabled; });
          if (!f.length) return;
          var i = f.indexOf(document.activeElement);
          if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
          else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
        }
      }
      cancel.addEventListener('click', function () { done(false); });
      function yes() {
        if (!check && !reasonInput) return true;
        var v = {};
        if (check) v.checked = !!check.checked;
        if (reasonInput) v.reason = reasonInput.value.trim();
        return v;
      }
      ok.addEventListener('click', function () { if (!ok.disabled) done(yes()); });
      back.addEventListener('click', function (e) { if (e.target === back) done(false); });
      if (reasonInput) {
        reasonInput.addEventListener('input', sync);
        reasonInput.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !ok.disabled) done(yes()); });
      }
      if (input) { input.addEventListener('input', sync); input.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !ok.disabled) done(yes()); }); }
      document.addEventListener('keydown', onKey, true);
      sync();
      document.body.appendChild(back);
      (reasonInput || input || cancel).focus();
    });
  };

  /*
   * The rules for moving a buyer to a stage, the same whichever way it is
   * moved: dragging a Kanban card, a card's "Move to" menu, or the buyer
   * page's "Move stage" (2026-10-20). Until now none of them had a rule.
   *   Lost/Stalled        asks why; the answer is saved as the buyer's
   *                       Lost / Stalled Reason, in the same request.
   *   Exported/Completed  asks to confirm, since the stage is only for an
   *                       export that has genuinely been completed.
   * Resolves the extra fields to send with current_stage ({} for none),
   * or null if the move was cancelled. Since 2026-10-21 the server enforces
   * the same two rules (_crm_lib.js stageRuleError), so a request that
   * skipped this question is refused there.
   */
  /*
   * A reason typed for a move that then did not go through -- refused by the
   * server, or no reply -- is kept for this page view and offered again the
   * next time that buyer is moved to Lost/Stalled, so nothing typed is lost
   * (owner, 2026-10-21). CRM.stageMoveSaved forgets it once a move is saved.
   */
  var typedReasons = {};
  CRM.stageMoveSaved = function (companyName) { delete typedReasons[companyName || 'this buyer']; };

  /*
   * The server's own words for a refusal it explained field by field (the
   * stage rules, a validation failure); otherwise CRM.plainError.
   */
  CRM.refusalText = function (result, fallback) {
    var d = (result && result.data) || {};
    if (d.reasons && d.fields && d.fields.length && d.reasons[d.fields[0]]) return d.reasons[d.fields[0]];
    return CRM.plainError(result, fallback);
  };

  CRM.stageMoveCheck = function (companyName, toStage) {
    var who = companyName || 'this buyer';
    if (toStage === 'Lost/Stalled') {
      return CRM.ask({ title: 'Move ' + who + ' to Lost/Stalled?',
        message: 'Say why. The reason is kept with the buyer, as their Lost / Stalled Reason.',
        reason: { label: 'Reason', maxlength: 300, value: typedReasons[who] || '' }, confirm: 'Move to Lost/Stalled' }).then(function (v) {
        if (v && v.reason) typedReasons[who] = v.reason;
        return v && v.reason ? { lost_reason: v.reason } : null;
      });
    }
    if (toStage === 'Exported/Completed') {
      return CRM.ask({ title: 'Move ' + who + ' to Exported/Completed?',
        message: 'Use this stage only once this buyer\u2019s export has genuinely been completed.',
        confirm: 'Move to Exported/Completed' }).then(function (v) {
        // The server refuses this move without it (_crm_lib.js stageRuleError).
        return v ? { confirm_stage: 'Exported/Completed' } : null;
      });
    }
    return Promise.resolve({});
  };
})(window);
