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
  // The width at which the full menu replaces the drawer: 1024px, except on
  // English pages, whose labels need 1200px (see the stylesheet's header rules).
  var ar = (document.documentElement.getAttribute('lang') || '').slice(0, 2) === 'ar';
  var mq = window.matchMedia('(min-width: ' + (ar ? 1024 : 1200) + 'px)');

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
 * contact page, which is where it leads.
 *
 * The link is /contact?intent=quote: the form shows the quote badge, and
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
  var ar = (document.documentElement.getAttribute('lang') || '').slice(0, 2) === 'ar';
  if (/^\/(ar\/)?contact(\/|\/index\.html)?$/.test(window.location.pathname)) return;
  var label = ar ? 'اطلب عرض سعر' : 'Request a Quote';
  var a = document.createElement('a');
  a.id = 'tc-quote-fab';
  a.href = (ar ? '/ar' : '') + '/contact?intent=quote';
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
  function setCompact(on) { a.classList.toggle('tc-quote-fab--compact', !!on && narrow.matches); }
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
