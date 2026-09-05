'use strict';

/*
 * Phase 1 -- the one authoritative locale route map for the site.
 *
 * There is no HTML build step here: every page is a standalone file with its
 * header, nav and footer duplicated inline. A hand-maintained list of route
 * pairs would drift from the filesystem the first time a page is added, so
 * the map is *derived* from the filesystem instead -- a directory containing
 * an index.html is a route, and /ar/<x> is the Arabic counterpart of /<x>.
 *
 * Consumed by scripts/check-locale-links.js. Kept separate from it so that
 * anything else needing the map (a future link fixer, a sitemap generator)
 * reads the same source of truth rather than re-deriving it.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

// Directories that are not part of the public bilingual site: build inputs,
// shared assets, the private apps, and the docs/audit files.
const SKIP_DIRS = new Set([
  'node_modules', '.git', 'netlify', 'scripts', 'assets', 'docs', 'admin', 'crm',
]);

const AR_PREFIX = '/ar';

/** Every public route on disk, e.g. '/', '/catalog', '/ar/products/hamed-green-olives'. */
function listRoutes(root = ROOT) {
  const out = [];
  (function walk(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (e) {
      return;
    }
    if (entries.some((e) => e.isFile() && e.name === 'index.html')) {
      const rel = path.relative(root, dir).split(path.sep).join('/');
      out.push(rel === '' ? '/' : '/' + rel);
    }
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      if (SKIP_DIRS.has(e.name) || e.name.startsWith('.')) continue;
      walk(path.join(dir, e.name));
    }
  })(root);
  return out.sort();
}

function isArabic(route) {
  return route === AR_PREFIX || route.startsWith(AR_PREFIX + '/');
}

/**
 * The Arabic counterpart of an English route, whether or not it exists.
 * '/' -> '/ar', '/catalog' -> '/ar/catalog'.
 */
function toArabic(route) {
  if (isArabic(route)) return route;
  return route === '/' ? AR_PREFIX : AR_PREFIX + route;
}

/** The English counterpart of an Arabic route. '/ar' -> '/', '/ar/catalog' -> '/catalog'. */
function toEnglish(route) {
  if (!isArabic(route)) return route;
  return route === AR_PREFIX ? '/' : route.slice(AR_PREFIX.length);
}

/**
 * How a route is written in an href. The site's convention, measured across
 * every page: no trailing slash, except the two locale roots.
 */
function href(route) {
  return route === '/' ? '/' : route === AR_PREFIX ? '/ar/' : route;
}

/** Normalise an href back to a route for comparison: strips query, hash, trailing slash. */
function routeOf(hrefValue) {
  const p = String(hrefValue).split('?')[0].split('#')[0];
  if (!p.startsWith('/')) return null;
  const trimmed = p.replace(/\/+$/, '');
  return trimmed === '' ? '/' : trimmed;
}

function buildMap(root = ROOT) {
  const routes = listRoutes(root);
  const set = new Set(routes);
  const pairs = [];
  for (const en of routes.filter((r) => !isArabic(r))) {
    const ar = toArabic(en);
    pairs.push({ en, ar: set.has(ar) ? ar : null });
  }
  return { routes, set, pairs };
}

module.exports = {
  ROOT, SKIP_DIRS, AR_PREFIX,
  listRoutes, isArabic, toArabic, toEnglish, href, routeOf, buildMap,
};
