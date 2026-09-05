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
