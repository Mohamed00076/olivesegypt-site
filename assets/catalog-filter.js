'use strict';

// Catalogue filtering: the existing variety-category row, plus Part B's
// buyer-intent chips.
//
// The category row (All Varieties / Green / Black / Specialty) was already in
// the markup on both /catalog and /ar/catalog, with data-filter attributes,
// aria-pressed, and an active-button style. None of it did anything: no
// script anywhere in the repository ever bound to those buttons. Clicking
// "Black Olives" left all eleven cards on screen and left aria-pressed at
// "false", so a screen reader was told the button had not been pressed --
// which was true. This file is what that markup was always waiting for.
//
// Two independent axes:
//
//   category     single-select, one variety group at a time (existing markup)
//   buyer intent multi-select; a product matches if it carries ANY selected
//                chip. AND across chips would empty the grid almost
//                immediately -- only three products are in "bulk and
//                industrial" -- and a filter that usually returns nothing
//                teaches buyers not to use it.
//
// The two axes combine with AND: "black olives that are retail-ready".
//
// Progressive enhancement. Without JavaScript every card is visible and the
// chip row stays hidden (it is marked hidden in the HTML and revealed here),
// so nobody is shown controls that cannot work. The category row is left
// visible either way because it was already visible.
(function () {
  var grid = document.querySelector('[data-catalog-grid]');
  if (!grid) return;

  var cards = [].slice.call(grid.querySelectorAll('[data-product]'));
  if (!cards.length) return;

  var categoryBtns = [].slice.call(document.querySelectorAll('[data-filter]'));
  var chips = [].slice.call(document.querySelectorAll('[data-facet-chip]'));
  var chipRow = document.querySelector('[data-facet-row]');
  var countEl = document.querySelector('[data-catalog-count]');
  var emptyEl = document.querySelector('[data-catalog-empty]');
  var clearBtn = document.querySelector('[data-facet-clear]');

  var LANG = document.documentElement.lang === 'ar' ? 'ar' : 'en';
  var COUNT_LABEL = {
    en: function (n) { return n === 1 ? '1 product' : n + ' products'; },
    ar: function (n) {
      if (n === 1) return 'منتج واحد';
      if (n === 2) return 'منتجان';
      if (n <= 10) return n + ' منتجات';
      return n + ' منتجًا';
    }
  }[LANG];

  var category = 'all';
  var active = [];   // selected facet ids

  function facetsOf(card) {
    return (card.getAttribute('data-facets') || '').split(/\s+/).filter(Boolean);
  }

  function matches(card) {
    if (category !== 'all' && card.getAttribute('data-category') !== category) return false;
    if (!active.length) return true;
    var have = facetsOf(card);
    for (var i = 0; i < active.length; i++) {
      if (have.indexOf(active[i]) !== -1) return true;
    }
    return false;
  }

  function apply() {
    var shown = 0;
    cards.forEach(function (card) {
      var ok = matches(card);
      // display rather than the hidden attribute or a utility class: this
      // has to hold regardless of what the prebuilt stylesheet contains.
      card.style.display = ok ? '' : 'none';
      if (ok) shown += 1;
    });

    if (countEl) countEl.textContent = COUNT_LABEL(shown);
    if (emptyEl) emptyEl.style.display = shown === 0 ? '' : 'none';
    if (clearBtn) clearBtn.style.display = (active.length || category !== 'all') ? '' : 'none';

    categoryBtns.forEach(function (b) {
      var on = b.getAttribute('data-filter') === category;
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.classList.toggle('is-active', on);
    });
    chips.forEach(function (c) {
      var on = active.indexOf(c.getAttribute('data-facet-chip')) !== -1;
      c.setAttribute('aria-pressed', on ? 'true' : 'false');
      c.classList.toggle('is-active', on);
    });
  }

  categoryBtns.forEach(function (b) {
    b.addEventListener('click', function () {
      category = b.getAttribute('data-filter') || 'all';
      apply();
    });
  });

  chips.forEach(function (c) {
    c.addEventListener('click', function () {
      var id = c.getAttribute('data-facet-chip');
      var i = active.indexOf(id);
      if (i === -1) active.push(id); else active.splice(i, 1);
      apply();
    });
  });

  if (clearBtn) {
    clearBtn.addEventListener('click', function () {
      active = [];
      category = 'all';
      apply();
    });
  }

  if (chipRow) chipRow.hidden = false;
  apply();
})();
