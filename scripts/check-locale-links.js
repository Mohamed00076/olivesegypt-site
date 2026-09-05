'use strict';

/*
 * Phase 1 test -- fails the build when internal linking and the locale route
 * map disagree.
 *
 *   node scripts/check-locale-links.js         (npm run check:locale-links)
 *
 * Exits 1 and prints every violation on failure, 0 and a one-line summary on
 * success. No test framework: the repo has no runner and this needs to be
 * runnable from a Netlify build step or a git hook without adding one.
 *
 * Checks, in the order the Phase 1 brief lists them:
 *   1. WRONG-LOCALE   an Arabic page links to an English route that has an
 *                     Arabic counterpart. The one legitimate exception is the
 *                     language switcher, marked by hreflang="en" on the <a>.
 *   2. BROKEN-ROUTE   an href points at a path that is neither a route on disk
 *                     nor a real file.
 *   3. LOCALE-MISMATCH an English page links into /ar/ outside its switcher, or
 *                     an Arabic page's JSON-LD carries an English page URL.
 *   4. TRAILING-SLASH an href disagrees with the site convention (no trailing
 *                     slash, except the '/' and '/ar/' locale roots).
 *   5. LINK-PARITY    an English route has no Arabic counterpart on disk, or
 *                     vice versa.
 *
 * <link rel="alternate|canonical"> tags are excluded throughout: those are
 * *supposed* to point across locales.
 */

const fs = require('fs');
const path = require('path');
const M = require('./locale-routes');

const ROOT = M.ROOT;
const map = M.buildMap(ROOT);
const violations = [];

function add(kind, page, detail) {
  violations.push({ kind, page, detail });
}

function pageFile(route) {
  return path.join(ROOT, route === '/' ? '' : route.slice(1), 'index.html');
}

/** Strip the tags whose job is to point at the other locale. */
function stripCrossLocaleTags(html) {
  return html.replace(/<link\b[^>]*>/gi, '');
}

/** True if an href resolves to something that actually exists on disk. */
function existsOnDisk(route) {
  if (map.set.has(route)) return true;
  const asFile = path.join(ROOT, route.slice(1));
  return fs.existsSync(asFile) && fs.statSync(asFile).isFile();
}

const ANCHOR = /<a\b([^>]*)href="(\/[^"]*)"([^>]*)>/gi;
// Attributes carrying an internal route that is not an href.
const DATA_URL = /\b(data-guide-url)="(\/[^"]*)"/gi;

for (const route of map.routes) {
  const raw = fs.readFileSync(pageFile(route), 'utf8');
  const html = stripCrossLocaleTags(raw);
  const arabicPage = M.isArabic(route);
  const ownCounterpart = arabicPage ? M.toEnglish(route) : M.toArabic(route);

  const seen = [];
  let m;
  ANCHOR.lastIndex = 0;
  while ((m = ANCHOR.exec(html)) !== null) {
    const attrs = m[1] + ' ' + m[3];
    seen.push({ href: m[2], isSwitcher: /hreflang="(en|ar)"/i.test(attrs) });
  }
  DATA_URL.lastIndex = 0;
  while ((m = DATA_URL.exec(html)) !== null) {
    seen.push({ href: m[2], isSwitcher: false, attr: m[1] });
  }

  for (const link of seen) {
    const target = M.routeOf(link.href);
    if (target === null) continue;
    const where = link.attr ? `${link.attr}="${link.href}"` : `href="${link.href}"`;

    // 2. BROKEN-ROUTE
    if (!existsOnDisk(target)) {
      add('BROKEN-ROUTE', route, `${where} -> no page or file at ${target}`);
      continue;
    }

    // 4. TRAILING-SLASH
    const pathOnly = link.href.split('?')[0].split('#')[0];
    if (map.set.has(target) && pathOnly !== M.href(target)) {
      add('TRAILING-SLASH', route, `${where} should be written "${M.href(target)}"`);
    }

    if (arabicPage) {
      // 1. WRONG-LOCALE
      if (!M.isArabic(target)) {
        const arTwin = M.toArabic(target);
        if (link.isSwitcher && target === ownCounterpart) continue; // the EN switcher
        if (map.set.has(arTwin)) {
          add('WRONG-LOCALE', route, `${where} -> use "${M.href(arTwin)}"`);
        }
      }
    } else {
      // 3. LOCALE-MISMATCH (English page reaching into /ar/)
      if (M.isArabic(target) && !(link.isSwitcher && target === ownCounterpart)) {
        add('LOCALE-MISMATCH', route, `${where} -> English page links into the Arabic tree`);
      }
    }
  }

  // 3. LOCALE-MISMATCH inside structured data. Asset URLs and the global
  // '#organization' entity id are locale-neutral by design and are skipped.
  if (arabicPage) {
    const blocks = raw.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi) || [];
    for (const b of blocks) {
      for (const u of b.match(/https:\/\/olivesegypt\.com(\/[^"]*)/g) || []) {
        const p = u.replace('https://olivesegypt.com', '');
        if (M.isArabic(p) || p.startsWith('/#') || /\.(jpg|png|svg|ico|pdf|webp)$/i.test(p)) continue;
        if (map.set.has(M.routeOf(p))) {
          add('LOCALE-MISMATCH', route, `JSON-LD carries English page URL ${p}`);
        }
      }
    }
  }
}

// 5. LINK-PARITY
for (const pair of map.pairs) {
  if (!pair.ar) add('LINK-PARITY', pair.en, 'no Arabic counterpart exists on disk');
}
for (const r of map.routes.filter(M.isArabic)) {
  if (!map.set.has(M.toEnglish(r))) add('LINK-PARITY', r, 'no English counterpart exists on disk');
}

const byKind = violations.reduce((a, v) => ((a[v.kind] = (a[v.kind] || 0) + 1), a), {});

if (violations.length === 0) {
  const arCount = map.routes.filter(M.isArabic).length;
  console.log(
    `locale-links OK -- ${map.routes.length} routes checked ` +
    `(${map.routes.length - arCount} en / ${arCount} ar), 0 violations.`
  );
  process.exit(0);
}

console.error(`locale-links FAILED -- ${violations.length} violation(s):\n`);
for (const kind of Object.keys(byKind).sort()) {
  console.error(`## ${kind} (${byKind[kind]})`);
  for (const v of violations.filter((x) => x.kind === kind)) {
    console.error(`   ${v.page}: ${v.detail}`);
  }
  console.error('');
}
process.exit(1);
