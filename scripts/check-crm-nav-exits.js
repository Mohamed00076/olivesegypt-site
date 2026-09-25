#!/usr/bin/env node
'use strict';

/*
 * A page in the CRM navigation must lead back into the CRM.
 *
 * Four of the five entries in CRM.NAV are /crm/ pages. They all render the
 * shared CRM header, so wherever you are you can reach every other one.
 *
 * The fifth, Letterhead, is not a CRM page at all. It lives at /letterhead,
 * a public URL, and it is a print sheet: no CRM script, no shared header,
 * because a CRM header would print. What it had instead was a back link to
 * "/" -- the public homepage.
 *
 * Nothing on the website links to /letterhead and robots.txt disallows it, so
 * the only people who ever arrive are staff who clicked Letterhead in the CRM
 * nav. That link therefore did one thing: take a member of staff, mid-task,
 * out of the tool they were working in and onto the marketing site, with no
 * way back except the browser's own Back button.
 *
 * So: any nav destination outside /crm/ has to offer a link back into /crm/.
 * That keeps the print sheets free of CRM chrome -- which is why they are
 * built this way -- while making sure the exit is not one-way.
 *
 * This reads the real CRM.NAV out of assets/crm.js rather than keeping a
 * second copy, so a nav entry added later is covered without anyone
 * remembering to add it here.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CRM_JS = path.join(ROOT, 'assets/crm.js');

let pass = 0, fail = 0;
const t = (name, cond, extra) => {
  cond ? pass++ : fail++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : '   <-- ' + (extra === undefined ? '' : extra)}`);
};

// ---- the real nav ---------------------------------------------------------

const crmSrc = fs.readFileSync(CRM_JS, 'utf8');
const navBlock = crmSrc.match(/CRM\.NAV\s*=\s*\[([\s\S]*?)\];/);

t('CRM.NAV can be read out of assets/crm.js', !!navBlock,
  'the shape changed -- this check needs updating, not deleting');

if (!navBlock) {
  console.log('\n' + `${pass} passed, ${fail} failed`);
  process.exit(1);
}

const entries = [...navBlock[1].matchAll(/\[\s*'([^']+)'\s*,\s*'([^']+)'\s*\]/g)]
  .map((m) => ({ href: m[1], label: m[2] }));

t(`the nav has entries (${entries.length})`, entries.length >= 4, String(entries.length));

const inside = entries.filter((e) => e.href.startsWith('/crm/'));
const outside = entries.filter((e) => !e.href.startsWith('/crm/'));

t(`most of the nav is inside the CRM (${inside.length} of ${entries.length})`,
  inside.length >= entries.length - 2,
  entries.map((e) => `${e.label}=${e.href}`).join(', '));

// ---- every exit must lead back -------------------------------------------

const stranded = [];
const missing = [];

for (const entry of outside) {
  // '/letterhead' -> letterhead/index.html
  const rel = entry.href.replace(/^\/+|\/+$/g, '');
  const file = path.join(ROOT, rel, 'index.html');

  if (!fs.existsSync(file)) {
    missing.push(`${entry.label} -> ${entry.href} (no ${rel}/index.html)`);
    continue;
  }

  const src = fs.readFileSync(file, 'utf8');
  // A link back into the CRM, anywhere on the page.
  if (!/href="\/crm\/?"/.test(src) && !/href="\/crm\//.test(src)) {
    stranded.push(`${entry.label} -> ${entry.href}`);
  }
}

t('every nav destination outside /crm/ exists as a page',
  missing.length === 0, missing.join('; '));

t('and every one of them links back into the CRM',
  stranded.length === 0,
  `${stranded.join('; ')} -- staff who click this in the nav have no way back except the browser's Back button`);

// ---- and the one we know about stays fixed -------------------------------

/*
 * Both letterheads, not just the English one. The Arabic sheet had the same
 * fault and was missed on the first pass, because it writes its back link with
 * a right arrow -- correct for an RTL page, where right is backwards -- and a
 * search for the left one did not find it. Checking the pair by name here
 * means neither can drift back on its own.
 */
for (const [rel, homepage] of [['letterhead', '/'], ['ar/letterhead', '/ar/']]) {
  const file = path.join(ROOT, rel, 'index.html');
  if (!fs.existsSync(file)) continue;
  const src = fs.readFileSync(file, 'utf8');
  const toolbarLink = /<a href="([^"]+)" class="text-sm font-semibold text-primary">/.exec(src);

  t(`/${rel} sends its back link to the CRM, not to ${homepage}`,
    !!toolbarLink && toolbarLink[1] === '/crm/',
    toolbarLink ? `points at ${toolbarLink[1]}` : 'no toolbar link found at all');

  t(`   and /${rel} is still a print sheet, with no CRM script loaded`,
    !/assets\/crm\.js/.test(src),
    'crm.js was added -- the CRM header would print, which is why these pages never had one');
}

const ok = fail === 0;
console.log(
  `\ncrm-nav-exits ${ok ? 'OK' : 'FAILED'} -- ${entries.length} nav entr(ies), ` +
  `${outside.length} outside /crm/, all of them leading back.`
);
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(ok ? 0 : 1);
