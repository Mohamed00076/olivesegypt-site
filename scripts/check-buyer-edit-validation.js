#!/usr/bin/env node
'use strict';

/*
 * Editing a buyer is held to the same rules as creating one, and a refusal
 * says what was refused and why.
 *
 *   node scripts/check-buyer-edit-validation.js        (part of `npm test`)
 *
 * The region was validated only on create. An edit could store any text as a
 * region -- which then showed in no dropdown and no region filter -- or null,
 * which the NOT NULL column rejected as a database error. And when a save WAS
 * refused, the buyer page showed "Validation failed" and nothing else: the
 * server's field list and reasons were computed and never displayed.
 *
 * Runs the real handler, PATCH by PATCH, against a stub that records whether
 * an UPDATE was attempted.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const Module = require('module');

const ROOT = path.join(__dirname, '..');
const FN = path.join(ROOT, 'netlify', 'functions');

let pass = 0, fail = 0;
const t = (name, cond, extra) => {
  cond ? pass++ : fail++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : '   <-- ' + (extra === undefined ? '' : extra)}`);
};

const SECRET = 'test-secret-not-a-real-one';
process.env.DATABASE_URL = 'postgres://stub';
process.env.CRM_SESSION_SECRET = SECRET;

let updates = 0;
const sql = (strings, ...vals) => {
  const q = Array.isArray(strings) ? strings.join('?') : String(strings);
  if (/^\s*UPDATE buyers/i.test(q)) updates += 1;
  if (/SELECT current_stage FROM buyers/i.test(q)) return Promise.resolve([{ current_stage: 'Lead' }]);
  return Promise.resolve([]);
};
const neonId = require.resolve('@neondatabase/serverless');
require.cache[neonId] = new Module(neonId, null);
require.cache[neonId].filename = neonId;
require.cache[neonId].loaded = true;
require.cache[neonId].exports = { neon: () => sql };

const { signSession, CRM_COOKIE_NAME } = require(path.join(FN, '_crm_lib.js'));
const COOKIE = `${CRM_COOKIE_NAME}=${signSession('staff', SECRET)}`;
const { handler, REGIONS } = require(path.join(FN, 'crm-buyers.js'));

const patch = async (body) => {
  updates = 0;
  const res = await handler({
    httpMethod: 'PATCH', headers: { cookie: COOKIE }, queryStringParameters: { id: '1' }, body: JSON.stringify(body),
  });
  return { status: res.statusCode, body: JSON.parse(res.body || '{}'), updated: updates > 0 };
};

(async () => {
  let r = await patch({ country_region: 'Narnia' });
  t('an edit to a region not on the list is refused', r.status === 400 && !r.updated, JSON.stringify(r));
  t('   naming the field', (r.body.fields || []).includes('country_region'), JSON.stringify(r.body));
  t('   with a reason a person can act on', /choose a region/i.test((r.body.reasons || {}).country_region || ''), JSON.stringify(r.body));

  r = await patch({ country_region: null });
  t('an edit that blanks the region is refused before the database sees it', r.status === 400 && !r.updated, JSON.stringify(r));

  r = await patch({ country_region: '' });
  t('an empty region is refused', r.status === 400 && !r.updated, JSON.stringify(r));

  r = await patch({ country_region: REGIONS[0], notes: 'x' });
  t(`a real region (${REGIONS[0]}) is accepted`, r.status === 200 && r.updated, JSON.stringify(r));

  r = await patch({ current_stage: 'Contacted' });
  t('a Kanban drag, which sends no region, is not judged on region', r.status === 200 && r.updated, JSON.stringify(r));

  // ---- the page shows what the server said -----------------------------
  const page = fs.readFileSync(path.join(ROOT, 'crm/buyer/index.html'), 'utf8');
  const m = page.match(/function saveErrorText\(d\) \{[\s\S]*?\n        \}/);
  t('the buyer page has a function that words a refused save', !!m, 'saveErrorText is missing');
  t('   and uses it when a save is refused', /showStatus\(saveErrorText\(result\.data \|\| \{\}\), false\)/.test(page));
  if (m) {
    const labels = { company_name: 'Company Name *', country_region: 'Region *' };
    const sandbox = {
      document: { querySelector: (sel) => {
        const k = (sel.match(/for="([^"]+)"/) || [])[1];
        return labels[k] ? { textContent: labels[k] } : null;
      } },
    };
    vm.createContext(sandbox);
    const words = vm.runInContext('(' + m[0] + ')', sandbox);
    const text = words({ error: 'Validation failed', fields: ['company_name', 'country_region'],
      reasons: { company_name: '"Mr Ahmed" looks like a person\'s name.', country_region: 'Choose a region from the list.' } });
    t('   naming each field by its label and giving the server\'s reason',
      text === 'Company Name: "Mr Ahmed" looks like a person\'s name. Region: Choose a region from the list.', text);
    t('   and never just "Validation failed" when fields are known', !/^Validation failed/.test(text), text);
    t('   an unlabelled field still says which one', /contact_email: please check/.test(words({ fields: ['contact_email'] })));
    t('   an error with no fields shows the server\'s error', words({ error: 'Not found' }) === 'Not found');
  }

  const ok = fail === 0;
  console.log(`\nbuyer-edit-validation ${ok ? 'OK' : 'FAILED'} -- edits are held to the create rules, and a refusal says why.`);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(ok ? 0 : 1);
})().catch((err) => {
  console.error('check-buyer-edit-validation CRASHED:', err && err.stack ? err.stack : err);
  process.exit(1);
});
