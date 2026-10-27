'use strict';

/*
 * Shared primary-navigation behaviour: the three desktop dropdowns and the
 * mobile drawer.
 *
 * Replaces the per-page inline drawer script that was previously duplicated
 * across the site. One file, loaded everywhere, so the next change to nav
 * behaviour is one edit rather than 88.
 *
 * Dropdowns are click-driven, not hover-driven. Hover menus are unusable on
 * touch devices and awkward with a keyboard, and this site's traffic is
 * substantially mobile. A click opens; Escape, an outside click, or opening a
 * sibling closes. Focus moves into the panel on open and returns to the
 * trigger on Escape.
 *
 * Everything is defensive: pages without a nav, or a drawer, or any dropdown
 * simply get nothing. There is no build step here, so this file loads on
 * pages that may not have every element.
 */

(function () {
  // The width at which the full menu replaces the drawer, in both languages.
  // From 1024 to 1199px English shows it on a second header row (see the
  // stylesheet's header rules).
  var mq = window.matchMedia('(min-width: 1024px)');

  /* ---- desktop dropdowns ------------------------------------------------- */

  var triggers = [].slice.call(document.querySelectorAll('.tc-nav-trigger'));

  function panelFor(trigger) {
    var id = trigger.getAttribute('aria-controls');
    return id ? document.getElementById(id) : null;
  }

  function closeDropdown(trigger, returnFocus) {
    var panel = panelFor(trigger);
    if (!panel || panel.hasAttribute('hidden')) return;
    panel.setAttribute('hidden', '');
    trigger.setAttribute('aria-expanded', 'false');
    if (returnFocus) trigger.focus();
  }

  function closeAllDropdowns(except, returnFocus) {
    triggers.forEach(function (t) {
      if (t !== except) closeDropdown(t, returnFocus && t === except);
    });
  }

  function openDropdown(trigger) {
    var panel = panelFor(trigger);
    if (!panel) return;
    closeAllDropdowns(trigger, false);
    panel.removeAttribute('hidden');
    trigger.setAttribute('aria-expanded', 'true');
    var first = panel.querySelector('a');
    if (first) first.focus();
  }

  triggers.forEach(function (trigger) {
    var panel = panelFor(trigger);
    if (!panel) return;

    trigger.addEventListener('click', function (e) {
      e.preventDefault();
      if (panel.hasAttribute('hidden')) openDropdown(trigger);
      else closeDropdown(trigger, true);
    });

    // Down-arrow opens and lands on the first item, the conventional
    // keyboard affordance for a disclosure menu.
    trigger.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        openDropdown(trigger);
      }
    });

    // Leaving the group by keyboard closes it, so a tab-through does not
    // leave a panel hanging open behind the rest of the page.
    var group = trigger.closest('.tc-nav-item') || trigger.parentNode;
    group.addEventListener('focusout', function (e) {
      if (!group.contains(e.relatedTarget)) closeDropdown(trigger, false);
    });

    panel.addEventListener('click', function (e) {
      if (e.target.closest('a')) closeDropdown(trigger, false);
    });
  });

  /* ---- mobile drawer ----------------------------------------------------- */

  var menuBtn = document.getElementById('mobile-menu-toggle');
  var menuPanel = document.getElementById('mobile-menu-panel');

  function closeDrawer(returnFocus) {
    if (!menuPanel || menuPanel.hasAttribute('hidden')) return;
    menuPanel.setAttribute('hidden', '');
    menuBtn.setAttribute('aria-expanded', 'false');
    if (returnFocus) menuBtn.focus();
  }

  if (menuBtn && menuPanel) {
    menuBtn.addEventListener('click', function () {
      if (menuPanel.hasAttribute('hidden')) {
        menuPanel.removeAttribute('hidden');
        menuBtn.setAttribute('aria-expanded', 'true');
        var first = menuPanel.querySelector('a');
        if (first) first.focus();
      } else {
        closeDrawer(false);
      }
    });

    menuPanel.addEventListener('click', function (e) {
      if (e.target.closest('a')) closeDrawer(false);
    });

    // Collapsible groups inside the drawer, so the mobile menu mirrors the
    // desktop grouping instead of presenting one flat list of every link.
    [].slice.call(menuPanel.querySelectorAll('.tc-drawer-trigger')).forEach(function (t) {
      var sub = document.getElementById(t.getAttribute('aria-controls'));
      if (!sub) return;
      t.addEventListener('click', function () {
        var open = !sub.hasAttribute('hidden');
        if (open) sub.setAttribute('hidden', '');
        else sub.removeAttribute('hidden');
        t.setAttribute('aria-expanded', open ? 'false' : 'true');
      });
    });
  }

  /* ---- shared dismissal -------------------------------------------------- */

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    var openTrigger = triggers.filter(function (t) {
      return t.getAttribute('aria-expanded') === 'true';
    })[0];
    if (openTrigger) {
      closeDropdown(openTrigger, true);
      return;
    }
    closeDrawer(true);
  });

  document.addEventListener('click', function (e) {
    triggers.forEach(function (t) {
      var panel = panelFor(t);
      if (!panel || panel.hasAttribute('hidden')) return;
      if (t.contains(e.target) || panel.contains(e.target)) return;
      closeDropdown(t, false);
    });
    if (menuPanel && !menuPanel.hasAttribute('hidden')) {
      if (!menuPanel.contains(e.target) && !menuBtn.contains(e.target)) closeDrawer(false);
    }
  });

  // Crossing the breakpoint with something open would otherwise leave a panel
  // stranded in a layout that no longer shows it.
  if (mq.addEventListener) {
    mq.addEventListener('change', function () {
      triggers.forEach(function (t) { closeDropdown(t, false); });
      closeDrawer(false);
    });
  }
})();

/*
 * The floating "Request a Quote" button (owner, 2026-10-02).
 *
 * It sits in the bottom corner opposite the WhatsApp bubble: bottom-left in
 * English, bottom-right in Arabic, where the bubble is mirrored to the left.
 * Its CSS uses inset-inline-start, so the page's own direction decides the
 * corner. It appears only where the WhatsApp bubble does -- every browsing
 * page, never a printable sheet, the CRM or the admin -- and not on the
 * contact page, which is where it leads. It shows on phones only, below
 * 768px (owner, 2026-10-02): from there up the header carries its own
 * "Request a Quote" button, and the stylesheet hides this one.
 *
 * The link is /contact/?intent=quote: the form shows the quote badge, and
 * records the page the visitor came from through the referrer, as the
 * header button's enquiries already are.
 *
 * The cookie-preferences pill used to hold this corner on desktop; it now
 * lives in the footer at every width (assets/consent.js). The footer gets
 * room at its foot so the button never sits on its last row of links.
 */
(function () {
  if (!document.querySelector('.fixed.bottom-6.right-6')) return;
  if (document.getElementById('tc-quote-fab')) return;
  var lang = (document.documentElement.getAttribute('lang') || '').slice(0, 2).toLowerCase();
  var ar = lang === 'ar';
  var pt = lang === 'pt';
  if (/^\/(ar\/)?contact(\/|\/index\.html)?$/.test(window.location.pathname)) return;
  var label = ar ? 'اطلب عرض سعر' : pt ? 'Solicitar cotação' : 'Request a Quote';
  var a = document.createElement('a');
  a.id = 'tc-quote-fab';
  // The Portuguese pages have their own quote form, on /pt-br/.
  a.href = pt ? '/pt-br/#cotacao' : (ar ? '/ar' : '') + '/contact/?intent=quote';
  a.setAttribute('aria-label', label);
  // a paper plane ("send"), then the label; the icon is decorative
  a.innerHTML = '<svg class="tc-quote-fab-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"/><path d="m21.854 2.147-10.94 10.939"/></svg>';
  var span = document.createElement('span');
  span.className = 'tc-quote-fab-label';
  span.textContent = label;
  a.appendChild(span);
  document.body.appendChild(a);
  document.documentElement.classList.add('tc-has-quote-fab');
  // The cookie banner, when it is up, lifts the floating buttons clear of
  // itself; this one may have arrived after that first measurement.
  if (window.TC && typeof window.TC.positionFloating === 'function') window.TC.positionFloating();

  /*
   * Below 1024px -- phones and tablets, where it would otherwise sit on what
   * the reader is looking at -- the button shrinks to its round icon while
   * the page scrolls down, and opens back to the full label when the reader
   * scrolls up, pauses for a moment, or is near the top of the page.
   * Desktop always shows the full label. The link, its target and its
   * aria-label never change, so a tap on the icon does exactly what a tap on
   * the label does.
   */
  var narrow = window.matchMedia('(max-width: 1023.98px)');
  var lastY = window.pageYOffset;
  var idle = null;
  // While the cookie banner is up the button stays a round icon (owner
  // decision 2026-10-16), so its label never sits over the text above the
  // banner; consent.js sets that state and lifts it once a choice is made.
  // Its accessible name is the aria-label above, so it is unchanged.
  function setCompact(on) {
    var held = !!document.getElementById('tc-consent-banner');
    a.classList.toggle('tc-quote-fab--compact', (held || !!on) && narrow.matches);
  }
  window.addEventListener('scroll', function () {
    var y = window.pageYOffset;
    if (y < 200) setCompact(false);
    else if (y > lastY + 6) setCompact(true);
    else if (y < lastY - 6) setCompact(false);
    lastY = y;
    if (idle) clearTimeout(idle);
    idle = setTimeout(function () { setCompact(false); }, 1200);
  }, { passive: true });
  if (narrow.addEventListener) narrow.addEventListener('change', function () { if (!narrow.matches) setCompact(false); });

  /*
   * One gentle pulse, five seconds after the first page of a visit loads, to
   * draw the eye once. Not on every page (sessionStorage), and never for a
   * visitor whose device asks for reduced motion (the stylesheet has no
   * animation for them).
   */
  var pulsed = false;
  try { pulsed = window.sessionStorage.getItem('tc-quote-pulsed') === '1'; } catch (e) {}
  if (!pulsed) {
    setTimeout(function () {
      a.classList.add('tc-quote-fab--pulse');
      try { window.sessionStorage.setItem('tc-quote-pulsed', '1'); } catch (e) {}
      setTimeout(function () { a.classList.remove('tc-quote-fab--pulse'); }, 2000);
    }, 5000);
  }
})();

/*
 * The "Read Our Insights" tab steps aside for the footer (owner, 2026-10-02).
 *
 * The tab is pinned to the middle of the right edge (the left on Arabic
 * pages), so at the end of a page it sat over the footer's Contact column --
 * WhatsApp at 1100-1280px, "Request a Sample" at 1440px. Once the footer's
 * top rises past the tab's bottom edge the tab fades out, and comes back
 * when the reader scrolls up. While faded it is out of the tab order and
 * hidden from screen readers; the footer has its own blog link. Inline
 * styles only, so this cannot collide with consent.js, which moves and
 * hides the tab by `top`, `transform` and `visibility` around the cookie
 * banner.
 */
(function () {
  var tab = document.querySelector('[data-testid="floating-blog-link"]');
  var footer = document.querySelector('footer');
  if (!tab || !footer) return;
  tab.style.transition = (tab.style.transition ? tab.style.transition + ', ' : '') + 'opacity 0.2s';
  var tucked = false;
  var queued = false;
  function update() {
    queued = false;
    // while tucked the tab keeps its place, so its box is still the measure
    var reach = footer.getBoundingClientRect().top < tab.getBoundingClientRect().bottom + 8;
    if (reach === tucked) return;
    tucked = reach;
    tab.style.opacity = reach ? '0' : '';
    tab.style.pointerEvents = reach ? 'none' : '';
    if (reach) { tab.setAttribute('aria-hidden', 'true'); tab.setAttribute('tabindex', '-1'); }
    else { tab.removeAttribute('aria-hidden'); tab.removeAttribute('tabindex'); }
  }
  function queue() { if (!queued) { queued = true; window.requestAnimationFrame(update); } }
  window.addEventListener('scroll', queue, { passive: true });
  window.addEventListener('resize', queue);
  update();
})();

/*
 * Keyboard focus never ends up hidden (owner, 2026-10-23).
 *
 * The cookie banner, the WhatsApp bubble and the floating "Request a Quote"
 * button are fixed to the bottom of the screen. When Tab moved to a link or
 * a field underneath one of them the browser scrolled it into view -- behind
 * the banner -- and on a phone a keyboard user could not see where they
 * were. Now, whenever focus lands on something one of them covers, the page
 * scrolls just enough to lift it clear, never past the top bar; and
 * something under the sticky top bar is brought down below it. Mouse and
 * touch use are untouched: this answers only to focus moving.
 */
(function () {
  // (the insights tab counts only on phones and tablets, where it is an icon near the bottom)
  var COVERS = ['#tc-consent-banner', '.fixed.bottom-6.right-6', '#tc-quote-fab', '#tc-consent-reopen', '[data-testid="floating-blog-link"]'];
  function covers() {
    var out = [];
    COVERS.forEach(function (sel) {
      var el = document.querySelector(sel);
      if (!el) return;
      var cs = window.getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || cs.position !== 'fixed') return;
      out.push(el);
    });
    return out;
  }
  function topLimit() {
    var h = document.querySelector('header');
    if (!h) return 0;
    var pos = window.getComputedStyle(h).position;
    return pos === 'sticky' || pos === 'fixed' ? Math.max(0, h.getBoundingClientRect().bottom) : 0;
  }
  function keepClear(el) {
    if (!el || !el.getBoundingClientRect || el === document.body) return;
    var list = covers();
    for (var i = 0; i < list.length; i++) if (list[i].contains(el)) return;
    var r = el.getBoundingClientRect();
    if (!r.width && !r.height) return;
    var bottom = window.innerHeight;
    list.forEach(function (c) {
      var b = c.getBoundingClientRect();
      if (!b.width || b.top < window.innerHeight / 2) return;
      if (b.left < r.right && b.right > r.left) bottom = Math.min(bottom, b.top - 8);
    });
    var top = topLimit();
    if (r.top < top) {
      // under the sticky top bar (Shift+Tab, or a tall box): bring its top just below the bar
      window.scrollBy(0, r.top - top - 8);
      return;
    }
    if (r.bottom <= bottom) return;
    var by = Math.min(r.bottom - bottom, r.top - top - 8);
    if (by > 0) window.scrollBy(0, by);
  }
  document.addEventListener('focusin', function (e) {
    var el = e.target;
    window.requestAnimationFrame(function () { keepClear(el); });
  });
})();

/*
 * The floating buttons in one labelled region (owner, 2026-10-23).
 *
 * The WhatsApp bubble, the "Request a Quote" button and the insights tab sat
 * outside every page region, so a screen reader listing the page's regions
 * never offered them. They now share one, "Quick links", at the end of the
 * page. They are fixed to the screen, so where they sit in the page changes
 * nothing on screen; the scripts that move them find them by id or class,
 * as before.
 */
(function () {
  var items = [document.querySelector('.fixed.bottom-6.right-6'), document.getElementById('tc-quote-fab'),
    document.querySelector('[data-testid="floating-blog-link"]')].filter(Boolean);
  if (!items.length || document.getElementById('tc-quick-links')) return;
  var ar = (document.documentElement.getAttribute('lang') || '').slice(0, 2) === 'ar';
  var region = document.createElement('div');
  region.id = 'tc-quick-links';
  region.setAttribute('role', 'region');
  region.setAttribute('aria-label', ar ? 'روابط سريعة' : 'Quick links');
  items.forEach(function (el) { region.appendChild(el); });
  document.body.appendChild(region);
})();

/*
 * Keyboard focus, every public page (owner, 2026-10-23).
 *
 * The site had no focus style of its own, so each browser drew its default:
 * black on a desktop, amber on Android (2.2:1 on the cream page), and
 * nothing visible on the WhatsApp bubble. One ring now, in two tones: a dark
 * olive outline with a thin white band inside it, so whichever the
 * background -- cream page, olive band, dark footer, the cookie banner --
 * one of the two stands out (dark olive on cream 13:1, white on the footer
 * 12:1). Dark mode swaps the tones. Components that draw their own ring
 * (focus-visible:ring-*) keep it. Added here rather than to the site
 * stylesheet, which the gated PDFs are built from; it is screen-only.
 */
(function () {
  if (document.getElementById('tc-focus-style')) return;
  var style = document.createElement('style');
  style.id = 'tc-focus-style';
  style.textContent =
    '@media screen{' +
    ':focus-visible{outline:3px solid #26301a;outline-offset:2px;box-shadow:0 0 0 2px #ffffff;}' +
    'html.dark :focus-visible{outline-color:#f7f2e4;box-shadow:0 0 0 2px #1c2416;}' +
    '#tc-quote-fab:focus-visible{outline:3px solid #26301a;outline-offset:2px;box-shadow:0 0 0 2px #ffffff;}' +
    'html.dark #tc-quote-fab:focus-visible{outline-color:#f7f2e4;box-shadow:0 0 0 2px #1c2416;}' +
    // the privacy page's wide table scrolls sideways on a phone; its box takes focus
    '.tc-scroll-region:focus-visible{outline-offset:-3px;box-shadow:none;}' +
    '}';
  document.head.appendChild(style);
})();

/*
 * The header fits whatever text size the reader uses (owner, 2026-10-23).
 *
 * The desktop header is one row that never wraps. With the browser's
 * "larger text" setting (text zoom, not page zoom) its links ran 500 to
 * 1,000px off the right edge; with wider letter spacing the phone header
 * grew 25px too wide and pushed the menu button off screen. Now the row is
 * measured: if it does not fit, the page uses the phone header (the menu
 * button and its drawer) at any width; if even that does not fit, the
 * company name may wrap onto two lines and the quote button's label may
 * wrap too. At normal sizes nothing changes. Screen only.
 */
(function () {
  var row = document.querySelector('header .container');
  if (!row) return;
  var html = document.documentElement;
  var style = document.createElement('style');
  style.id = 'tc-header-fit-style';
  style.textContent =
    '@media screen{' +
    'html.tc-header-compact header .tc-nav{display:none!important;}' +
    'html.tc-header-compact #mobile-menu-toggle{display:inline-flex!important;}' +
    'html.tc-header-compact #mobile-menu-panel:not([hidden]){display:block!important;}' +
    'html.tc-header-tight header .container{height:auto!important;min-height:4rem;}' +
    'html.tc-header-tight header .container .whitespace-nowrap{white-space:normal!important;}' +
    'html.tc-header-tight header .container a:first-child{flex-shrink:1!important;min-width:0;}' +
    '#tc-quote-fab:not(.tc-quote-fab--compact) .tc-quote-fab-label{max-width:24em;}' +
    '}';
  document.head.appendChild(style);
  function overflows() { return row.scrollWidth > row.clientWidth + 1; }
  var queued = false;
  function fit() {
    queued = false;
    html.classList.remove('tc-header-compact', 'tc-header-tight');
    if (!overflows()) return;
    html.classList.add('tc-header-compact');
    if (overflows()) html.classList.add('tc-header-tight');
  }
  function queue() { if (!queued) { queued = true; window.requestAnimationFrame(fit); } }
  fit();
  window.addEventListener('resize', queue);
  window.addEventListener('load', queue);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(queue);
  // text size or spacing can change without the window changing size
  if (typeof ResizeObserver === 'function') {
    var ro = new ResizeObserver(queue);
    [].forEach.call(row.children, function (c) { ro.observe(c); });
  }
})();
