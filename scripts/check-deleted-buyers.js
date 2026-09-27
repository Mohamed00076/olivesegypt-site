#!/usr/bin/env node
'use strict';

/*
 * A deleted buyer is shown as deleted, and cannot be changed.
 *
 *   node scripts/check-deleted-buyers.js        (part of `npm test`)
 *
 * Buyers are soft-deleted: deleted_at is set and the row is kept. Until
 * 2026-09-27 that row was hidden from the list and treated as live everywhere
 * else. Its page opened looking exactly like a live buyer; the Enquiries
 * inbox's "In pipeline" link still led there; a second Delete answered "Not
 * found", which read as the delete failing when the first one had worked; and
 * Save and Add Note quietly changed a record nothing would show again. The
 * owner deleted test123, reached it again, and was told "Not found".
 *
 * Runs the real handlers against a stub holding one live, one deleted and one
 * missing buyer, and records whether any write was attempted.
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

const BUYERS = {
  1: { id: 1, current_stage: 'Lead', deleted_at: null },
  2: { id: 2, current_stage: 'Lead', deleted_at: '2026-09-27T01:22:28.641Z' },
};
let writes = [];
const sql = (strings, ...vals) => {
  const q = Array.isArray(strings) ? strings.join('?') : String(strings);
  const params = Array.isArray(strings) ? vals : (vals[0] || []);
  if (/^\s*(UPDATE buyers|INSERT INTO buyer_activity_log|INSERT INTO buyer_stage_history)/i.test(q)) writes.push(q.trim().split(/\s+/).slice(0, 3).join(' '));
  if (/FROM buyers WHERE id = /i.test(q) && /^\s*SELECT/i.test(q)) {
    const b = BUYERS[params[0]];
    if (!b) return Promise.resolve([]);
    if (/deleted_at IS NULL/i.test(q) && b.deleted_at) return Promise.resolve([]);
    return Promise.resolve([b]);
  }
  return Promise.resolve([]);
};
const neonId = require.resolve('@neondatabase/serverless');
require.cache[neonId] = new Module(neonId, null);
require.cache[neonId].filename = neonId;
require.cache[neonId].loaded = true;
require.cache[neonId].exports = { neon: () => sql };

const { signSession, CRM_COOKIE_NAME } = require(path.join(FN, '_crm_lib.js'));
const cookie = `${CRM_COOKIE_NAME}=${signSession('staff', SECRET)}`;
const buyers = require(path.join(FN, 'crm-buyers.js')).handler;
const activity = require(path.join(FN, 'crm-activity.js')).handler;

const call = async (h, method, qs, body) => {
  writes = [];
  const r = await h({ httpMethod: method, headers: { cookie }, queryStringParameters: qs, body: body ? JSON.stringify(body) : null });
  return { status: r.statusCode, data: JSON.parse(r.body || '{}'), writes: writes.slice() };
};

(async () => {
  let r = await call(buyers, 'DELETE', { id: '1', confirmed: '1' });
  t('deleting a live buyer works', r.status === 200 && r.data.ok && r.writes.includes('UPDATE buyers SET'), JSON.stringify(r));

  r = await call(buyers, 'DELETE', { id: '2', confirmed: '1' });
  t('deleting an already-deleted buyer does not answer "Not found"', r.status !== 404 && r.data.error !== 'Not found', JSON.stringify(r));
  t('   it says it was already deleted, and when', r.status === 409 && r.data.already_deleted === true &&
    /was deleted on 2026-09-27/.test(r.data.error), JSON.stringify(r.data));
  t('   and writes nothing', r.writes.length === 0, r.writes.join(', '));

  r = await call(buyers, 'DELETE', { id: '99', confirmed: '1' });
  t('a buyer that never existed is still "Not found"', r.status === 404 && r.data.error === 'Not found', JSON.stringify(r));

  r = await call(buyers, 'PATCH', { id: '2' }, { notes: 'edited after deletion' });
  t('saving an edit to a deleted buyer is refused, with the reason', r.status === 409 && /was deleted on/.test(r.data.error), JSON.stringify(r));
  t('   and writes nothing', r.writes.length === 0, r.writes.join(', '));

  r = await call(buyers, 'PATCH', { id: '1' }, { current_stage: 'Contacted' });
  t('a live buyer still saves and moves on the Kanban', r.status === 200 && r.data.ok, JSON.stringify(r));

  r = await call(activity, 'POST', {}, { buyer_id: 2, entry: 'note on a deleted buyer' });
  t('a note on a deleted buyer is refused, with the reason', r.status === 409 && /deleted/.test(r.data.error), JSON.stringify(r));
  t('   and writes nothing', r.writes.length === 0, r.writes.join(', '));

  r = await call(activity, 'POST', {}, { buyer_id: 1, entry: 'note on a live buyer' });
  t('a note on a live buyer still works', r.status === 200 && r.data.ok, JSON.stringify(r));

  // ---- the pages ---------------------------------------------------------
  const page = fs.readFileSync(path.join(ROOT, 'crm/buyer/index.html'), 'utf8');
  t('the buyer page renders a deleted record as deleted', /if \(b\.deleted_at\) markDeleted\(b\);/.test(page));
  const m = page.match(/function markDeleted\(b\) \{[\s\S]*?\n        \}/);
  t('   through a function that exists', !!m);
  if (m) {
    const el = () => ({ style: {}, textContent: '', disabled: false });
    const els = { 'delete-btn': el(), 'save-btn': el(), 'page-title': el(), 'activity-form': el() };
    const inputs = [el(), el(), el()];
    els['buyer-form'] = { elements: inputs };
    let status = null;
    const sandbox = {
      document: { getElementById: (id) => els[id] },
      showStatus: (msg, ok) => { status = { msg, ok }; },
      Array,
    };
    vm.createContext(sandbox);
    vm.runInContext('(' + m[0] + ')', sandbox)({ company_name: 'test123', deleted_at: '2026-09-27T01:22:28.641Z' });
    t('   Delete and Save are hidden', els['delete-btn'].style.display === 'none' && els['save-btn'].style.display === 'none');
    t('   every field is read-only, and notes cannot be added',
      inputs.every((i) => i.disabled) && els['activity-form'].style.display === 'none');
    t('   the title and a lasting notice say it was deleted, and when',
      /\(deleted\)$/.test(els['page-title'].textContent) && status && status.ok === false && /deleted on 2026-09-27/.test(status.msg),
      JSON.stringify(status));
  }
  t('a successful delete leads to a confirmation, not a bare redirect',
    /window\.location\.href = '\/crm\/buyers\/\?deleted=' \+ encodeURIComponent\(name\)/.test(page));
  t('a delete that never completes says so instead of doing nothing',
    /The delete request did not complete/.test(page));
  const list = fs.readFileSync(path.join(ROOT, 'crm/buyers/index.html'), 'utf8');
  t('the Buyers list shows that confirmation, as text (a crafted name cannot inject markup)',
    /get\('deleted'\)/.test(list) && /el\.textContent = 'Deleted '/.test(list) && !/deleted-status[^\n]*innerHTML/.test(list));

  const inbox = fs.readFileSync(path.join(ROOT, 'crm/inquiries/index.html'), 'utf8');
  const inq = fs.readFileSync(path.join(FN, 'inquiries.js'), 'utf8');
  t('the Enquiries inbox is told when an enquiry\'s buyer was deleted',
    /LEFT JOIN buyers b ON b\.id = i\.buyer_id/.test(inq) && /AS buyer_deleted_on/.test(inq));
  const cell = inbox.match(/function pipelineCell\(r\) \{[\s\S]*?\n        \}/);
  if (cell) {
    const sb = { encodeURIComponent, esc: (v) => String(v) };
    vm.createContext(sb);
    const f = vm.runInContext('(' + cell[0] + ')', sb);
    const deletedCell = f({ buyer_id: 12, buyer_deleted_on: '2026-09-27' });
    t('   and says "Buyer deleted" rather than "In pipeline" for it',
      /Buyer deleted 2026-09-27/.test(deletedCell) && !/In pipeline/.test(deletedCell), deletedCell);
    t('   while a live buyer still reads "In pipeline"', /In pipeline/.test(f({ buyer_id: 3, buyer_deleted_on: null })));
  } else {
    t('   the inbox\'s pipelineCell was found', false);
  }

  const ok = fail === 0;
  console.log(`\ndeleted-buyers ${ok ? 'OK' : 'FAILED'} -- a deleted buyer is shown as deleted, and cannot be changed.`);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(ok ? 0 : 1);
})().catch((err) => {
  console.error('check-deleted-buyers CRASHED:', err && err.stack ? err.stack : err);
  process.exit(1);
});
