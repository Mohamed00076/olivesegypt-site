#!/usr/bin/env node
'use strict';

/*
 * The homepage's "Who Are You Sourcing For?" cards each lead somewhere of
 * their own, and somewhere that answers what the card says.
 *
 *   node scripts/check-buyer-path-cards.js        (part of `npm test`)
 *
 * Until 2026-09-28 two of the six cards (Retail, Food-Service) went to the
 * same catalogue page; Private-Label went to the packaging page although the
 * site has a private-label page with a brief form; Manufacturer went to an
 * article about Egypt's olive market; and Local / Egypt went to the plain
 * contact form rather than its local-pricing entry. The owner spotted it.
 *
 * This holds, on / and /ar/:
 *   - six cards, no two with the same destination (address and section)
 *   - each destination is a page that exists, and a #section on it is an id
 *     that page carries
 *   - the Arabic cards lead to the Arabic twins of the English destinations
 *   - the Local card sets the local-pricing intent, which the contact form
 *     records against the enquiry
 */

const fs = require('fs');
const path = require('path');
const { pageFile } = require('./locale-routes');

const ROOT = path.join(__dirname, '..');
let pass = 0, fail = 0;
const t = (name, cond, extra) => {
  cond ? pass++ : fail++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : '   <-- ' + (extra === undefined ? '' : extra)}`);
};

function cards(rel) {
  const html = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const i = html.indexOf('grid grid-cols-2 lg:grid-cols-3 gap-5');
  if (i === -1) return [];
  const section = html.slice(i, html.indexOf('</section>', i));
  return [...section.matchAll(/<a href="([^"]+)" class="group rounded-2xl[\s\S]*?<h3[^>]*>([^<]+)<\/h3>/g)]
    .map((m) => ({ href: m[1], title: m[2] }));
}

const sets = { en: cards('index.html'), ar: cards('ar/index.html') };

for (const [loc, list] of Object.entries(sets)) {
  const where = loc === 'ar' ? '/ar/' : '/';
  t(`${where}: six buyer-path cards`, list.length === 6, list.length);

  const seen = {};
  list.forEach((c) => { (seen[c.href] = seen[c.href] || []).push(c.title); });
  const dupes = Object.entries(seen).filter(([, v]) => v.length > 1);
  t(`${where}: no two cards lead to the same place`, dupes.length === 0,
    dupes.map(([h, v]) => `${v.join(' and ')} both go to ${h}`).join('; '));

  const broken = [];
  for (const c of list) {
    const [pathAndQuery, frag] = c.href.split('#');
    const route = pathAndQuery.split('?')[0];
    const file = pageFile(route.length > 1 ? route.replace(/\/$/, '') : route);
    if (!fs.existsSync(file)) { broken.push(`${c.title}: no page at ${route}`); continue; }
    if (frag && !new RegExp(`\\bid="${frag}"`).test(fs.readFileSync(file, 'utf8'))) {
      broken.push(`${c.title}: ${route} has no section #${frag}`);
    }
  }
  t(`${where}: every card leads to a page that exists, and to a section it has`, broken.length === 0, broken.join('; '));

  const local = list[5];
  t(`${where}: the Local / Egypt card opens the contact form set to local pricing`,
    !!local && local.href === `${loc === 'ar' ? '/ar' : ''}/contact?intent=local_pricing`, local && local.href);
}

const mirrored = sets.en.map((c, i) => [c.href, sets.ar[i] && sets.ar[i].href])
  .filter(([en, ar]) => ar !== (en === '/' ? '/ar/' : `/ar${en}`));
t('the Arabic cards lead to the Arabic twins of the English destinations, in the same order',
  sets.en.length === sets.ar.length && mirrored.length === 0, mirrored.map(([e, a]) => `${e} vs ${a}`).join('; '));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
