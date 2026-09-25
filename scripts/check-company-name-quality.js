#!/usr/bin/env node
'use strict';

/*
 * The company-name rules, and the promise that the review page only reports.
 *
 * company_name is the spine of the CRM, and it was accepting anything two
 * characters or longer. The records show what that let through: "Dr" as a
 * company, and people's names in the field meant for their employer.
 *
 * Three things have to hold, and none of them shows on the page:
 *
 *   1. The rules classify the real values correctly -- including the ones they
 *      must NOT reject. "Olivex" is a single bare word and a good company
 *      name; a rule that refuses it to catch "Abdelrahman" would teach staff
 *      to fight the form, and a field people fight fills with junk.
 *   2. Only the reject severity blocks a save. Review-level signals are for a
 *      person to judge, never for the API to refuse.
 *   3. The review page and its endpoint stay read-only. The owner's
 *      instruction was explicit: present the list, change nothing. A "fix all"
 *      added later would replace a visible problem with an invisible one.
 *
 * The rules are required from _crm_lib.js rather than restated here, so this
 * tests what ships.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const lib = require(path.join(ROOT, 'netlify/functions/_crm_lib.js'));

let pass = 0, fail = 0;
const t = (name, cond, extra) => {
  cond ? pass++ : fail++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : '   <-- ' + (extra === undefined ? '' : extra)}`);
};

// ---- 1. the rules, against the values that prompted them -----------------

const EXPECT = [
  // The real bad data, from the owner's own screens.
  ['Dr', 'reject', 'too_short'],
  ['Mr masud', 'reject', 'starts_with_title'],
  ['Mr khalid algatin', 'reject', 'starts_with_title'],
  // Arabic, because the buyers are not all writing in Latin script.
  ['السيد محمد', 'reject', 'starts_with_title'],
  ['الدكتور', 'reject', 'title_only'],
  // Flagged for a person, never refused.
  ['Abdelrahman', 'review', 'single_word'],
  ['Olivex', 'review', 'single_word'],
  // Must pass untouched: real company names, in both scripts.
  ['Alianz Foods Pvt. Ltd.', 'ok', null],
  ['Aggizi Foods', 'ok', null],
  ['شركة النيل للتجارة', 'ok', null],
  ['Nile Food Industries', 'ok', null],
  ['3M', 'reject', 'too_short'],
];

for (const [value, severity, code] of EXPECT) {
  const got = lib.classifyCompanyName(value);
  t(`${JSON.stringify(value)} -> ${severity}${code ? ' (' + code + ')' : ''}`,
    got.severity === severity && got.code === code,
    `got ${got.severity} (${got.code})`);
}

t('every rejection explains itself to whoever has to fix it',
  EXPECT.filter(([, s]) => s !== 'ok')
    .every(([v]) => (lib.classifyCompanyName(v).reason || '').length > 25),
  'a flagged record with no reason is a puzzle, not a task');

t('nothing throws on rubbish input',
  ['', null, undefined, '   ', 123, {}].every((v) => {
    try { return !!lib.classifyCompanyName(v).severity; } catch (e) { return false; }
  }), 'classifyCompanyName threw');

// ---- 2. duplicates are found, and only real ones -------------------------

{
  const groups = lib.findNearDuplicates([
    { id: 1, company_name: 'Alianz Foods Pvt. Ltd.' },
    { id: 2, company_name: 'alianz foods' },
    { id: 3, company_name: 'Nile Trading Co' },
    { id: 4, company_name: 'Delta Exports' },
  ]);
  t('one company entered two ways is grouped',
    groups.length === 1 && groups[0].members.length === 2,
    JSON.stringify(groups.map((g) => g.key)));
  t('and unrelated companies are not',
    !groups.some((g) => g.members.some((m) => m.id === 3 || m.id === 4)),
    'a false duplicate would invite a wrong merge');
}

// ---- 3. only reject blocks a save ----------------------------------------

{
  const src = fs.readFileSync(path.join(ROOT, 'netlify/functions/crm-buyers.js'), 'utf8');
  t('crm-buyers.js uses the shared classifier',
    /classifyCompanyName\(/.test(src) && /require\('\.\/_crm_lib'\)/.test(src),
    'a second copy of the rules would drift from the review page');
  t("and blocks only on the 'reject' severity",
    /severity === 'reject'/.test(src),
    "blocking on 'review' would refuse legitimate single-word company names");
  t('and hands back the reason, not just the field name',
    /reasons:\s*fieldReasons/.test(src),
    'the form would say "Validation failed" and leave the person guessing');
}

// ---- 4. the review pass writes nothing -----------------------------------

{
  const fn = path.join(ROOT, 'netlify/functions/crm-data-quality.js');
  t('the data-quality endpoint exists', fs.existsSync(fn));
  if (fs.existsSync(fn)) {
    const src = fs.readFileSync(fn, 'utf8');
    t('   it is GET only',
      /event\.httpMethod !== 'GET'/.test(src), 'a write method would make it more than a report');
    t('   it issues no UPDATE, INSERT or DELETE',
      !/\b(UPDATE|INSERT\s+INTO|DELETE\s+FROM)\b/i.test(src.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')),
      'the owner asked for a list to review, not a cleanup that runs itself');
    t('   and it requires a CRM session like every other endpoint',
      /requireCrmSession\(/.test(src), 'buyer records behind an unauthenticated endpoint');
  }

  const page = path.join(ROOT, 'crm/data-quality/index.html');
  t('the review page exists', fs.existsSync(page));
  if (fs.existsSync(page)) {
    const src = fs.readFileSync(page, 'utf8');
    t('   it offers no bulk fix',
      !/method:\s*'(PATCH|POST|PUT|DELETE)'/.test(src),
      'a Fix All button is exactly what was asked not to exist');
    t('   it links each record to its own page for a human to correct',
      /\/crm\/buyer\/\?id=/.test(src), 'nowhere to go and fix it');
    t('   and it says so before listing anything',
      /changes nothing/.test(src), 'the absence of a bulk fix should not have to be inferred');
  }
}

// ---- 5. the route is wired ------------------------------------------------

{
  const toml = fs.readFileSync(path.join(ROOT, 'netlify.toml'), 'utf8');
  t('/api/crm/data-quality is routed to the function',
    /from = "\/api\/crm\/data-quality"/.test(toml) && /to = "\/\.netlify\/functions\/crm-data-quality"/.test(toml),
    'the page would get the SPA fallback and try to parse HTML as JSON');
}

const ok = fail === 0;
console.log(
  `\ncompany-name-quality ${ok ? 'OK' : 'FAILED'} -- ${EXPECT.length} classification(s) checked, ` +
  'reject blocks, review does not, and the review pass writes nothing.'
);
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(ok ? 0 : 1);
