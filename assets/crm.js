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
  CRM.REGIONS = ['Africa', 'Middle East', 'Asia', 'EU', 'North America'];
  CRM.PRODUCTS = [
    ['aggizi-green-olives', 'Aggizi Green Olives'],
    ['toffahi-green-olives', 'Toffahi Green Olives'],
    ['hamed-green-olives', 'Hamed Green Olives'],
    ['manzanilla-green-olives', 'Manzanilla Green Olives'],
    ['natural-black-olives', 'Natural Black Olives'],
    ['pepper-stuffed-green-olives', 'Stuffed Green Olives'],
    ['oxidized-black-olives', 'Oxidized Black Olives'],
    ['marinated-artichoke-hearts', 'Marinated Artichoke Hearts'],
    ['pepperoncini-peppers', 'Pepperoncini Peppers'],
    ['sliced-jalapeno-peppers', 'Sliced Jalapeño Peppers'],
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

  CRM.renderNav = function (active) {
    var links = [
      ['/crm/', 'Dashboard'],
      ['/crm/buyers/', 'Buyers'],
      ['/crm/kanban/', 'Kanban'],
      ['/crm/buyer/?new=1', 'Add Buyer'],
    ];
    var html = '<div class="crm-header"><div class="crm-brand">Triple Company &middot; Buyer CRM</div><div class="crm-nav">';
    links.forEach(function (l) {
      var isActive = active === l[1];
      html += '<a href="' + l[0] + '"' + (isActive ? ' class="active"' : '') + '>' + l[1] + '</a>';
    });
    html += '<button type="button" id="crm-logout-btn">Log Out</button></div></div>';
    document.body.insertAdjacentHTML('afterbegin', html);
    var btn = document.getElementById('crm-logout-btn');
    if (btn) btn.addEventListener('click', CRM.logout);
  };

  CRM.stageBadgeClass = function (stage) {
    if (stage === 'Lost/Stalled') return 'crm-badge crm-badge-danger';
    if (stage === 'Exported/Completed') return 'crm-badge crm-badge-warn';
    return 'crm-badge';
  };

  CRM.fmtDate = function (iso) {
    if (!iso) return '';
    try { return new Date(iso).toLocaleDateString(); } catch (e) { return iso; }
  };
})(window);
