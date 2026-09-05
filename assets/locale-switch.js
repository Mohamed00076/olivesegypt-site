'use strict';

/*
 * Phase 2 -- language persistence and scroll restoration.
 *
 * Two jobs, both scoped tightly to a *deliberate* language switch:
 *
 *   1. Remember which locale the visitor explicitly chose.
 *   2. When they switch language, put them back where they were reading on
 *      the equivalent page, rather than at the top of it.
 *
 * The switch record lives in sessionStorage and is written only by a click
 * on the language switcher (the one anchor carrying hreflang="en"/"ar"), so
 * an ordinary navigation, a refresh, a search-engine landing or a brand new
 * session never restores anything -- there is simply no record to act on.
 * The record is consumed and deleted on first use, so a refresh right after
 * a switch does not silently re-scroll.
 *
 * Deliberately NOT done here: automatic redirection based on the stored
 * preference or on navigator.language. See the note above resolveLocale().
 *
 * Every storage access is wrapped: Safari private mode throws on
 * sessionStorage, and a visitor with site data blocked must still get a
 * working language switcher.
 */

(function () {
  var SWITCH_KEY = 'tc:lang-switch';
  var PREF_KEY = 'tc:locale';

  // A switch record is only meaningful for the navigation it was written
  // for. A minute is long enough for a slow connection and short enough
  // that a record can never survive into an unrelated visit.
  var MAX_AGE_MS = 60000;

  function readStore(store, key) {
    try {
      return window[store].getItem(key);
    } catch (e) {
      return null;
    }
  }

  function writeStore(store, key, value) {
    try {
      window[store].setItem(key, value);
    } catch (e) {
      /* private mode, or site data blocked -- the switcher still works */
    }
  }

  function removeStore(store, key) {
    try {
      window[store].removeItem(key);
    } catch (e) {
      /* as above */
    }
  }

  /** '/ar/catalog/' and '/ar/catalog' are the same route. */
  function normalise(path) {
    var p = String(path || '').split('?')[0].split('#')[0];
    p = p.replace(/\/+$/, '');
    return p === '' ? '/' : p;
  }

  /*
   * The locale actually in force, by the agreed priority:
   *
   *   1. explicit current selection -- the locale of the page being viewed,
   *      which is what <html lang> already states;
   *   2. same-page locale mapping -- the switcher's own href, handled by the
   *      reciprocal links Phase 1 established;
   *   3. stored preference -- what this function exposes;
   *   4. default locale -- English.
   *
   * navigator.language is deliberately absent. It is a browser setting, not
   * a choice about this site, and letting it act would be exactly the
   * "browser language overrides an explicit selection" failure. Nothing here
   * redirects: on a static, CDN-cached site a locale redirect risks serving
   * the wrong cached variant and splitting how search engines see each URL,
   * and a visitor arriving on a specific page from a search result asked for
   * that page. The preference is recorded and readable; acting on it is a
   * separate decision.
   */
  function resolveLocale() {
    var current = document.documentElement.getAttribute('lang');
    if (current === 'ar' || current === 'en') return current;
    var stored = readStore('localStorage', PREF_KEY);
    if (stored === 'ar' || stored === 'en') return stored;
    return 'en';
  }

  /*
   * The id of the section heading nearest the top of the viewport. Used when
   * the two locales' pages differ in height -- an Arabic page is often
   * shorter than its English counterpart -- so that "where I was reading"
   * survives even when the pixel offset does not.
   */
  function nearestAnchorId() {
    var candidates = document.querySelectorAll('main [id], section[id], h2[id], h3[id]');
    var best = null;
    var bestTop = -Infinity;
    for (var i = 0; i < candidates.length; i += 1) {
      var top = candidates[i].getBoundingClientRect().top;
      if (top <= 80 && top > bestTop) {
        bestTop = top;
        best = candidates[i].id;
      }
    }
    return best;
  }

  function maxScroll() {
    return Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  }

  /* ---- 1. capture, on a real switcher click ---------------------------- */

  /*
   * 55 pages carry a sticky header, so the switcher is reachable from
   * anywhere and the scroll position at click time is the reading position.
   * The other 25 (product pages, /ar/catalog, company-profile) have a static
   * header: to reach the switcher at all the visitor must first scroll back
   * to the top, which zeroes that position before the click ever fires.
   *
   * So remember the last non-zero position and when it was left. If the click
   * arrives at the very top but the visitor was reading further down moments
   * ago, that is the position worth restoring. Two seconds is long enough to
   * cover scrolling up to the header and short enough that someone who
   * deliberately went to the top and stayed there is not sent back down.
   */
  var lastY = 0;
  var lastYAt = 0;
  var RECENT_MS = 2000;

  window.addEventListener(
    'scroll',
    function () {
      var y = Math.round(window.pageYOffset || 0);
      if (y > 0) {
        lastY = y;
        lastYAt = Date.now();
      }
    },
    { passive: true }
  );

  function readingPosition() {
    var y = Math.round(window.pageYOffset || 0);
    if (y > 0) return y;
    if (lastY > 0 && Date.now() - lastYAt <= RECENT_MS) return lastY;
    return 0;
  }

  document.addEventListener(
    'click',
    function (event) {
      var link = event.target && event.target.closest
        ? event.target.closest('a[hreflang="en"], a[hreflang="ar"]')
        : null;
      if (!link) return;

      var target = link.getAttribute('href');
      var lang = link.getAttribute('hreflang');
      if (!target || (lang !== 'en' && lang !== 'ar')) return;

      var max = maxScroll();
      var y = readingPosition();
      writeStore('localStorage', PREF_KEY, lang);
      writeStore(
        'sessionStorage',
        SWITCH_KEY,
        JSON.stringify({
          from: normalise(window.location.pathname),
          to: normalise(target),
          y: y,
          ratio: max > 0 ? y / max : 0,
          anchor: nearestAnchorId(),
          ts: Date.now()
        })
      );
    },
    true
  );

  /* ---- 2. restore, once, on the page that was switched to -------------- */

  function readSwitchRecord() {
    var raw = readStore('sessionStorage', SWITCH_KEY);
    if (!raw) return null;
    var rec;
    try {
      rec = JSON.parse(raw);
    } catch (e) {
      removeStore('sessionStorage', SWITCH_KEY);
      return null;
    }
    // Consume it whatever happens next: a record must never survive to
    // affect a second page load.
    removeStore('sessionStorage', SWITCH_KEY);
    if (!rec || typeof rec.ts !== 'number') return null;
    if (Date.now() - rec.ts > MAX_AGE_MS) return null;
    if (rec.to !== normalise(window.location.pathname)) return null;
    return rec;
  }

  function restore(rec) {
    if (!rec) return;
    if (!rec.y && !rec.anchor) return; // they were at the top; nothing to do

    var max = maxScroll();

    // The pixel offset first, whenever the counterpart page is long enough to
    // honour it. Anchors are only a better guide when the structure genuinely
    // differs: several pages carry an id on an element near the very top of
    // the document, and preferring anchors unconditionally made those land
    // the reader back at the top -- measurably worse than the offset they
    // came from.
    if (rec.y > 0 && rec.y <= max) {
      window.scrollTo(0, rec.y);
      return;
    }

    // Target page is shorter, so the offset cannot be honoured. A stable
    // section anchor is the best available answer.
    if (rec.anchor) {
      var el = document.getElementById(rec.anchor);
      if (el) {
        el.scrollIntoView({ block: 'start' });
        return;
      }
    }

    // No shared anchor either: keep the reading position proportional rather
    // than dumping them at the bottom.
    if (typeof rec.ratio === 'number' && rec.ratio > 0 && max > 0) {
      window.scrollTo(0, Math.round(max * rec.ratio));
    }
  }

  var pending = null;

  function run() {
    if (pending === null) pending = readSwitchRecord();
    restore(pending);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
  // Images and webfonts change the document height after DOMContentLoaded,
  // so settle the position once more when everything has actually landed.
  window.addEventListener('load', function () {
    requestAnimationFrame(run);
  });

  // Exposed for the test harness and for any later decision about acting on
  // the stored preference. Reading it has no side effects.
  window.__tcLocale = { resolve: resolveLocale, PREF_KEY: PREF_KEY, SWITCH_KEY: SWITCH_KEY };
})();
