#!/usr/bin/env node
'use strict';

/*
 * Every <lastmod> in sitemap.xml is the date that page's content last changed.
 *
 *   node scripts/check-sitemap-lastmod.js           (part of `npm test`)
 *   node scripts/check-sitemap-lastmod.js --write   (sets every date)
 *
 * Until 2026-09-28 every date in the sitemap was 4, 5 or 6 September, although
 * the catalogue, the downloads, the homepage and most other pages had changed
 * since -- Hamed withdrawn, guides turned into PDFs, a real 404. Google uses
 * lastmod to decide what to recrawl, but only while the dates prove accurate;
 * a sitemap whose dates never move is read as one that cannot be trusted.
 *
 * "Content" means what a reader or a search result sees of the page itself:
 * its title, its meta description and the text of its <main>. The shared
 * header, navigation and footer are left out, and so are scripts, styles,
 * markup and attributes, so a change like the 28 September font switch --
 * which touched every page and changed nothing anyone reads -- or a new
 * footer link does not restamp every page. The date is that of the newest commit that changed the
 * content (UTC), found by walking the page's history; an uncommitted change
 * counts as today.
 *
 * Needs the repository's full history. A shallow clone fails loudly rather
 * than guessing.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { pageFile } = require('./locale-routes');

const ROOT = path.join(__dirname, '..');
const SITEMAP = path.join(ROOT, 'sitemap.xml');
const SITE = 'https://olivesegypt.com';
const WRITE = process.argv.includes('--write');

const git = (args) => execFileSync('git', args, { cwd: ROOT, env: Object.assign({}, process.env, { TZ: 'UTC' }), maxBuffer: 64 * 1024 * 1024 }).toString();

function decode(s) {
  return s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&mdash;/g, '—').replace(/&ndash;/g, '–')
    .replace(/&middot;/g, '·').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

/** What a reader or a search result sees of a page. */
function content(html) {
  if (html === null) return null;
  const title = (html.match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || '';
  const desc = (html.match(/<meta\s+name="description"\s+content="([^"]*)"/i) || [])[1] || '';
  // The page's own content: <main>. The header, navigation, footer and
  // floating buttons are the same on every page, and a change to them is not
  // a change to this page. Every page in the sitemap has one <main>; a page
  // without one falls back to its whole body.
  const main = html.match(/<main[\s>][\s\S]*<\/main>/i);
  const bodyStart = html.search(/<body[\s>]/i);
  let body = main ? main[0] : bodyStart === -1 ? '' : html.slice(bodyStart);
  body = body.replace(/<(script|style|noscript|svg|template)\b[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ');
  return decode([title, desc, body].join('\n')).replace(/\s+/g, ' ').trim();
}

// The page as it was at a revision, or null where it did not exist yet.
function fileAt(rev, rel) {
  try {
    return execFileSync('git', ['show', `${rev}:${rel}`], { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 }).toString();
  } catch (e) { return null; }
}

const today = new Date().toISOString().slice(0, 10);

/** The date (UTC, YYYY-MM-DD) this page's content last changed. */
function lastChanged(rel) {
  const now = content(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
  if (content(fileAt('HEAD', rel)) !== now) return today;
  const log = git(['log', '--no-merges', '--date=format-local:%Y-%m-%d', '--format=%H %cd', '--', rel])
    .trim().split('\n').filter(Boolean).map((l) => l.split(' '));
  for (const [sha, date] of log) {
    if (content(fileAt(sha, rel)) !== content(fileAt(`${sha}^`, rel))) return date;
  }
  return log.length ? log[log.length - 1][1] : today;
}

if (git(['rev-parse', '--is-shallow-repository']).trim() === 'true') {
  console.error('sitemap-lastmod FAILED -- this is a shallow clone, so page history is incomplete. Fetch the full history (git fetch --unshallow) and run again.');
  process.exit(1);
}

let xml = fs.readFileSync(SITEMAP, 'utf8');
const entries = [...xml.matchAll(/<url>\s*<loc>([^<]+)<\/loc>\s*<lastmod>([^<]+)<\/lastmod>/g)];
const problems = [];
const changes = [];

for (const m of entries) {
  const loc = m[1];
  if (!loc.startsWith(SITE)) { problems.push(`${loc}: not on ${SITE}`); continue; }
  let route = loc.slice(SITE.length) || '/';
  if (route !== '/' && route.endsWith('/')) route = route.slice(0, -1);
  const rel = path.relative(ROOT, pageFile(route));
  if (!fs.existsSync(path.join(ROOT, rel))) { problems.push(`${loc}: no page at ${rel}`); continue; }
  const want = lastChanged(rel);
  if (m[2] !== want) changes.push({ loc, have: m[2], want, whole: m[0] });
}

const urls = (xml.match(/<url>/g) || []).length;
if (entries.length !== urls) problems.push(`${urls - entries.length} <url> entr(ies) have no <lastmod> directly after <loc>`);

if (WRITE && !problems.length) {
  for (const c of changes) xml = xml.replace(c.whole, c.whole.replace(`<lastmod>${c.have}</lastmod>`, `<lastmod>${c.want}</lastmod>`));
  fs.writeFileSync(SITEMAP, xml);
  changes.forEach((c) => console.log(`  ${c.loc.slice(SITE.length) || '/'}  ${c.have} -> ${c.want}`));
  console.log(`sitemap-lastmod: ${changes.length} of ${entries.length} date(s) updated.`);
  process.exit(0);
}

for (const c of changes) {
  problems.push(`${c.loc.slice(SITE.length) || '/'}: lastmod ${c.have}, but its content last changed on ${c.want}`);
}
if (problems.length) {
  console.error(`sitemap-lastmod FAILED -- ${problems.length} problem(s):\n`);
  problems.forEach((p) => console.error('  ' + p));
  console.error('\nRun `node scripts/check-sitemap-lastmod.js --write` (after committing the page changes) to set the dates.');
  process.exit(1);
}
console.log(`sitemap-lastmod OK -- all ${entries.length} dates are the day that page's content last changed.`);
