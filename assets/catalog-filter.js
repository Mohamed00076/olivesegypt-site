'use strict';

// Catalogue filtering by variety category.
//
// The category row (All Varieties / Green / Black / Specialty) was already in
// the markup on both /catalog and /ar/catalog, with data-filter attributes,
// aria-pressed, and an active-button style. None of it did anything: no
// script anywhere in the repository ever bound to those buttons. Clicking
// "Black Olives" left all eleven cards on screen and left aria-pressed at
// "false", so a screen reader was told the button had not been pressed --
// which was true. This file is what that markup was always waiting for.
//
// Single-select: one variety group at a time.
//
// Part B also added a second row of buyer-intent chips ("Filter by what you
// need"). The owner removed it on 2026-09-28: it took a lot of the screen,
// on mobile above all, for little use.
//
// Progressive enhancement. Without JavaScript every card is visible; the
// category row is visible either way because it always was.
(function () {
  var grid = document.querySelector('[data-catalog-grid]');
  if (!grid) return;

  var cards = [].slice.call(grid.querySelectorAll('[data-product]'));
  if (!cards.length) return;

  var categoryBtns = [].slice.call(document.querySelectorAll('[data-filter]'));
  var countEl = document.querySelector('[data-catalog-count]');
  var emptyEl = document.querySelector('[data-catalog-empty]');

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

  function matches(card) {
    return category === 'all' || card.getAttribute('data-category') === category;
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

    categoryBtns.forEach(function (b) {
      var on = b.getAttribute('data-filter') === category;
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.classList.toggle('is-active', on);
    });
  }

  categoryBtns.forEach(function (b) {
    b.addEventListener('click', function () {
      category = b.getAttribute('data-filter') || 'all';
      apply();
    });
  });

  apply();
})();
