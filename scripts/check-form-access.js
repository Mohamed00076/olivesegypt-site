#!/usr/bin/env node
'use strict';

/*
 * Forms and zoom on the public site (owner, 2026-10-23: "fix All").
 *
 *   node scripts/check-form-access.js        (part of `npm test`)
 *
 * Holds the fixes from the forms and zoom checks:
 *   F1  after Send, keyboard focus comes back to the form (or to what comes
 *       next: the guide's link, or the confirmation), not the top of the page;
 *   F2  no field is named only by its placeholder: each has a visible label,
 *       and the placeholder that only repeated it is gone;
 *   F3  required fields carry a visible *;
 *   F4  name, email, company, country and phone carry autofill hints, and
 *       phone fields bring up the number pad;
 *   Z1  the Market Brief's "Quarterly / No spam / Unsubscribe anytime" row
 *       wraps on a narrow screen;
 *   Z2  a header that does not fit (large text) switches to the menu button;
 *   Z3  if even that does not fit (wider spacing), the name may wrap.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

let pass = 0, fail = 0;
const t = (name, cond, extra) => {
  cond ? pass++ : fail++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : '   <-- ' + (extra === undefined ? '' : extra)}`);
};

// ---- F2, F3, F4: the lead and download forms -------------------------------
const LEAD_PAGES = ['index.html', 'ar/index.html', 'resources/private-label/index.html', 'ar/resources/private-label/index.html',
  'downloads/index.html', 'ar/downloads/index.html'];
const AUTO = { email: 'email', company_name: 'organization', country_region: 'country-name' };
for (const f of LEAD_PAGES) {
  const s = read(f);
  const forms = s.match(/<form[^>]*(?:data-lead-form|data-gated-download)=[^>]*>[\s\S]*?<\/form>/g) || [];
  const fields = [];
  for (const form of forms) {
    const re = /(<label class="block"><span class="[^"]*">([^<]*)(<span aria-hidden="true"> \*<\/span>)?<\/span>)?(<(?:input|select)[^>]*data-field="([^"]+)"[^>]*>)/g;
    let m;
    while ((m = re.exec(form))) {
      if (m[5] === 'website' || m[5] === 'consent') continue;
      fields.push({ field: m[5], label: m[2] || '', star: !!m[3], required: /\srequired[\s/>]/.test(m[4]), tag: m[4] });
    }
  }
  t(`${f}: ${forms.length} form(s), ${fields.length} field(s), each with a visible label (F2)`,
    forms.length > 0 && fields.length > 0 && fields.every((x) => x.label.trim()), JSON.stringify(fields.filter((x) => !x.label.trim()).map((x) => x.field)));
  t(`${f}:    every required field shows *, and only those (F3)`, fields.every((x) => x.star === x.required),
    JSON.stringify(fields.filter((x) => x.star !== x.required).map((x) => x.field)));
  t(`${f}:    email, company and country carry autofill hints (F4)`,
    fields.filter((x) => AUTO[x.field]).every((x) => x.tag.includes(`autocomplete="${AUTO[x.field]}"`)));
  t(`${f}:    no labelled field repeats its label as grey placeholder text (owner, 2026-10-23)`, fields.every((x) => !/ placeholder=/.test(x.tag)),
    JSON.stringify(fields.filter((x) => / placeholder=/.test(x.tag)).map((x) => x.field)));
  t(`${f}:    no select is named by an aria-label instead of its visible label`, fields.filter((x) => /^<select/.test(x.tag)).every((x) => !/aria-label=/.test(x.tag)));
}
for (const f of ['index.html', 'ar/index.html']) {
  const s = read(f);
  t(`${f}: the Market Brief's title names the form, and no longer labels the email field`,
    /<form id="newsletter-form" aria-labelledby="newsletter-title" /.test(s) && /<p id="newsletter-title" /.test(s) && !/<label for="newsletter-email"/.test(s));
  t(`${f}: Z1 the "Quarterly / No spam / Unsubscribe anytime" row wraps`, /<div class="flex flex-wrap items-center gap-4 text-sm text-primary-foreground\/70">/.test(s));
}

// ---- F4: the quote and sample forms ----------------------------------------
const WANT = { name: 'name', email: 'email', company: 'organization', country: 'country-name', phone: 'tel' };
for (const f of ['contact/index.html', 'ar/contact/index.html', 'sample/index.html', 'ar/sample/index.html']) {
  const s = read(f);
  const prefix = f.includes('sample') ? 'sample' : 'contact';
  const missing = Object.entries(WANT).filter(([k, v]) => !new RegExp(`id="${prefix}-${k}" autocomplete="${v}"`).test(s)).map(([k]) => k);
  t(`${f}: name, email, company, country and phone carry autofill hints (F4)`, missing.length === 0, missing.join(', '));
  t(`${f}:    the phone field brings up the number pad`, new RegExp(`type="tel" id="${prefix}-phone"`).test(s));
}

// ---- F1: focus after Send ---------------------------------------------------
for (const f of ['assets/inquiry-form.js', 'assets/gated-download.js', 'assets/unsubscribe.js']) {
  const s = read(f);
  t(`${f}: F1 focus returns after Send, only if it was in the form and has not moved on`,
    /var hadFocus = form\.contains\(document\.activeElement\);/.test(s) && /function returnFocus\(el\)/.test(s) &&
    /if \(!el \|\| \(a && a !== document\.body\)\) return;/.test(s) && (s.match(/if \(hadFocus\) returnFocus\(/g) || []).length >= 2);
}
t('assets/gated-download.js: after a guide unlocks, focus goes to its link (or the confirmation)',
  /if \(hadFocus\) returnFocus\(link && reveal \? link : status\);/.test(read('assets/gated-download.js')));

// ---- Z2, Z3: the header ------------------------------------------------------
const nav = read('assets/site-nav.js');
t('Z2 a header that does not fit switches to the menu button and its drawer',
  /html\.tc-header-compact header \.tc-nav\{display:none!important;\}/.test(nav) && /html\.tc-header-compact #mobile-menu-toggle\{display:inline-flex!important;\}/.test(nav) &&
  /html\.tc-header-compact #mobile-menu-panel:not\(\[hidden\]\)\{display:block!important;\}/.test(nav));
t('Z3 and if that still does not fit, the company name may wrap',
  /html\.tc-header-tight header \.container \.whitespace-nowrap\{white-space:normal!important;\}/.test(nav) &&
  /if \(overflows\(\)\) html\.classList\.add\('tc-header-tight'\);/.test(nav));
t('   it is measured again when the window or the text size changes', /new ResizeObserver\(queue\)/.test(nav) && /window\.addEventListener\('resize', queue\);/.test(nav));
t('   and at normal sizes nothing changes: the classes are only added when the row overflows',
  /function overflows\(\) \{ return row\.scrollWidth > row\.clientWidth \+ 1; \}/.test(nav) && /if \(!overflows\(\)\) return;/.test(nav));
t('   the header styles are screen-only and kept out of the stylesheet the gated PDFs are built from',
  /style\.id = 'tc-header-fit-style';/.test(nav) && /'@media screen\{' \+/.test(nav) && !/tc-header-compact/.test(read('assets/index-Dw0yUE42.css')));

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) {
  console.log('\nform-access FAILED -- see the top of this file for what each check holds.');
  process.exit(1);
}
console.log('form-access OK -- every form field has a visible label and autofill hint, focus survives Send, and the header fits any text size.');
