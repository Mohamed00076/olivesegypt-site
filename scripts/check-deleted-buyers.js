#!/usr/bin/env node
'use strict';

/*
 * A deleted buyer is hidden from the CRM, kept for recall, and erasable.
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
 * Owner decisions, 2026-09-27 (outstanding item 12):
 *   - "deleted buyer should be erasable from being viewed on crm but could be
 *     recalled if needed from code" -- Delete hides it everywhere in the CRM;
 *     the row stays, recallable with docs/recall-deleted-buyer.md;
 *   - "if buyer requested to be deleted then delete fully" -- Erase removes the
 *     buyer, its notes, its stage history and its linked enquiries.
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
  2: { id: 2, current_stage: 'Lead', deleted_at: '2026-09-27T01:22:28.641Z',
       company_name: 'Hidden Test Co', contact_name: 'Hidden Person', contact_email: 'hidden@example.com' },
};
let writes = [];
let queries = [];
const sql = (strings, ...vals) => {
  const q = Array.isArray(strings) ? strings.join('?') : String(strings);
  const params = Array.isArray(strings) ? vals : (vals[0] || []);
  queries.push({ q, params });
  if (/to_regclass\('public\.inquiries'\)/.test(q)) return Promise.resolve([{ present: true }]);
  if (/^\s*WITH b AS \(DELETE FROM buyers/i.test(q)) {
    writes.push('ERASE');
    return Promise.resolve(BUYERS[params[0]] ? [{ details: 'deletion request: removed 1 note(s), 1 stage change(s), 1 linked enquiry(ies)' }] : []);
  }
  if (/^\s*INSERT INTO crm_documents/i.test(q)) writes.push('INSERT INTO crm_documents');
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
const documents = require(path.join(FN, 'crm-documents.js')).handler;

const call = async (h, method, qs, body) => {
  writes = []; queries = [];
  const r = await h({ httpMethod: method, headers: { cookie }, queryStringParameters: qs, body: body ? JSON.stringify(body) : null });
  return { status: r.statusCode, headers: r.headers, data: JSON.parse(r.body || '{}'), writes: writes.slice(), queries: queries.slice() };
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

  // ---- hidden from the CRM ------------------------------------------------
  r = await call(buyers, 'GET', { id: '2' });
  t('opening a deleted buyer says it was deleted, and when (410, not "Not found")',
    r.status === 410 && r.data.deleted === true && r.data.deleted_on === '2026-09-27' && /was deleted on 2026-09-27/.test(r.data.error), JSON.stringify(r.data));
  t('   never cached: a browser holding on to "deleted" would hide a restored buyer',
    /no-store/.test((r.headers || {})['Cache-Control'] || ''), JSON.stringify(r.headers));
  const leaked = JSON.stringify(r.data);
  t('   and nothing else: no name, contact details, notes or stage history',
    !/Hidden Test Co|Hidden Person|hidden@example\.com/.test(leaked) && !('activity_log' in r.data) && !('stage_history' in r.data), leaked);
  t('   its notes and stage history are not even read',
    !r.queries.some((c) => /^\s*SELECT[\s\S]*FROM (buyer_activity_log|buyer_stage_history)/i.test(c.q)), r.queries.map((c) => c.q.slice(0, 50)).join(' | '));
  r = await call(buyers, 'GET', { id: '1' });
  t('a live buyer still opens in full', r.status === 200 && r.data.id === 1 && Array.isArray(r.data.activity_log), JSON.stringify(r.data).slice(0, 120));

  r = await call(buyers, 'GET', { include_deleted: '1', search: 'Hidden' });
  const listQ = (r.queries.find((c) => /FROM buyers\s+WHERE deleted_at IS NULL/.test(c.q)) || {}).q;
  t('the buyer list never includes deleted buyers -- there is no include_deleted option',
    !!listQ && !/include_deleted|includeDeleted/.test(fs.readFileSync(path.join(FN, 'crm-buyers.js'), 'utf8')), r.queries.map((c) => c.q.slice(0, 80)).join(' | '));

  r = await call(documents, 'POST', {}, { doc_type: 'letter', buyer_id: 2 });
  t('a document cannot be issued to a deleted buyer (it would copy its details back)',
    r.status === 409 && r.data.already_deleted === true && !r.writes.includes('INSERT INTO crm_documents'), JSON.stringify(r));

  // ---- erase, for a deletion request ---------------------------------------
  r = await call(buyers, 'DELETE', { id: '2', erase: '1' });
  t('erasing without confirmation is refused, nothing erased', r.status === 400 && !r.writes.includes('ERASE'), JSON.stringify(r));
  r = await call(buyers, 'DELETE', { id: '2', erase: '1', confirmed: '1' });
  const erase = r.queries.find((c) => /WITH b AS \(DELETE FROM buyers/.test(c.q)) || { q: '', params: [] };
  t('erasing a deleted buyer works', r.status === 200 && r.data.ok === true && /deletion request/.test(r.data.erased), JSON.stringify(r.data));
  t('   removing the buyer, its notes, its stage history and its linked enquiries',
    /DELETE FROM buyers WHERE id = \$1/.test(erase.q) && /DELETE FROM buyer_activity_log WHERE buyer_id IN \(SELECT id FROM b\)/.test(erase.q) &&
    /DELETE FROM buyer_stage_history WHERE buyer_id IN \(SELECT id FROM b\)/.test(erase.q) && /DELETE FROM inquiries WHERE buyer_id IN \(SELECT id FROM b\)/.test(erase.q), erase.q);
  t('   in the same statement as its audit entry, which records who but no details',
    /INSERT INTO crm_audit_log[\s\S]*'erase', 'buyer'/.test(erase.q) && erase.params[0] === 2 && erase.params[1] === 'staff' &&
    !/company_name|contact_|email|entry/.test(erase.q.split('INSERT INTO crm_audit_log')[1] || 'x'), JSON.stringify(erase.params));
  t('   and never touching issued documents or the opt-out list', !/crm_documents|contact_opt_outs/.test(erase.q));
  r = await call(buyers, 'DELETE', { id: '1', erase: '1', confirmed: '1' });
  t('a live buyer can be erased directly, without deleting it first', r.status === 200 && r.writes.includes('ERASE'), JSON.stringify(r));
  r = await call(buyers, 'DELETE', { id: '99', erase: '1', confirmed: '1' });
  t('erasing a buyer that is not there answers 404', r.status === 404, JSON.stringify(r));
  r = await call(buyers, 'DELETE', { id: '1', confirmed: '1' });
  t('an ordinary Delete still only hides (no erase)', r.status === 200 && !r.writes.includes('ERASE') && r.writes.includes('UPDATE buyers SET'), JSON.stringify(r.writes));

  // ---- the pages ---------------------------------------------------------
  const page = fs.readFileSync(path.join(ROOT, 'crm/buyer/index.html'), 'utf8');
  t('the buyer page sends a deleted buyer to its own view', /if \(!result\.ok && result\.data\.deleted\) \{ showDeletedBuyer\(result\.data\); return; \}/.test(page));
  t('   and no longer has a read-only view that would need the details', !/function markDeleted/.test(page));
  const m = page.match(/function showDeletedBuyer\(d\) \{[\s\S]*?\n        \}/);
  t('   through a function that exists', !!m);
  if (m) {
    const el = () => ({ style: {}, textContent: '' });
    const card = el();
    const els = { 'delete-btn': el(), 'erase-btn': el(), 'page-title': el(), 'activity-card': el(), 'documents-card': el(),
      'buyer-form': { parentNode: card } };
    let status = null;
    const sandbox = { document: { getElementById: (id) => els[id] }, showStatus: (msg, ok) => { status = { msg, ok }; } };
    vm.createContext(sandbox);
    vm.runInContext('(' + m[0] + ')', sandbox)({ deleted: true, deleted_on: '2026-09-27', error: 'This buyer was deleted on 2026-09-27. Its details are no longer shown in the CRM.' });
    t('   the details card, notes and documents are hidden', card.style.display === 'none' && els['activity-card'].style.display === 'none' && els['documents-card'].style.display === 'none');
    t('   Delete is hidden; Erase is offered', els['delete-btn'].style.display === 'none' && els['erase-btn'].style.display === '');
    t('   a lasting notice says it was deleted, when, and what Erase is for',
      els['page-title'].textContent === 'Deleted buyer' && status && status.ok === false && /deleted on 2026-09-27/.test(status.msg) && /use Erase/.test(status.msg),
      JSON.stringify(status));
  }
  const del = (page.match(/getElementById\('delete-btn'\)\.addEventListener[\s\S]*?\n        \}\);/) || [''])[0];
  t('Delete says it hides but keeps for recall, and points a deletion request to Erase',
    /kept in the database and can be recalled/.test(del) && /Erase \(deletion request\)/.test(del));
  const ers = (page.match(/getElementById\('erase-btn'\)\.addEventListener[\s\S]*?\n        \}\);/) || [''])[0];
  t('Erase asks first, says what is removed, what is kept, and that it cannot be undone',
    /window\.confirm\(msg\)/.test(ers) && /Removed for good/.test(ers) && /Kept: quotations, invoices and letters/.test(ers) &&
    /opt-out list/.test(ers) && /cannot be undone, not even from the database/.test(ers));
  t('   and sends the erase, confirmed', /'&erase=1&confirmed=1', \{ method: 'DELETE' \}/.test(ers));
  t('   and says so on the Buyers list afterwards', /\/crm\/buyers\/\?erased=/.test(ers));
  t('a successful delete leads to a confirmation, not a bare redirect',
    /window\.location\.href = '\/crm\/buyers\/\?deleted=' \+ encodeURIComponent\(name\)/.test(page));
  t('a delete that never completes says so instead of doing nothing',
    /The delete request did not complete/.test(page));
  const list = fs.readFileSync(path.join(ROOT, 'crm/buyers/index.html'), 'utf8');
  t('the Buyers list shows that confirmation, as text (a crafted name cannot inject markup)',
    /get\('deleted'\)/.test(list) && /get\('erased'\)/.test(list) && /el\.textContent = erased !== null/.test(list) && !/innerHTML/.test(list.slice(list.indexOf("get('deleted')"), list.indexOf("get('deleted')") + 900)));
  t('   saying a deleted buyer can be recalled, and an erased one is gone', /can be recalled if needed/.test(list) && /Erased ' \+/.test(list) && /permanently/.test(list));

  const guide = fs.readFileSync(path.join(ROOT, 'docs/recall-deleted-buyer.md'), 'utf8');
  t('the recall guide exists, with the restore query and its audit entry',
    /UPDATE buyers SET deleted_at = NULL/.test(guide) && /INSERT INTO crm_audit_log[\s\S]*'restore', 'buyer'/.test(guide) && /An erased buyer/.test(guide));

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
    t('   linking only to the erase options, not to a record', /Erase options/.test(deletedCell) && !/View record/.test(deletedCell), deletedCell);
    t('   while a live buyer still reads "In pipeline"', /In pipeline/.test(f({ buyer_id: 3, buyer_deleted_on: null })));
  } else {
    t('   the inbox\'s pipelineCell was found', false);
  }

  const ok = fail === 0;
  console.log(`\ndeleted-buyers ${ok ? 'OK' : 'FAILED'} -- a deleted buyer is hidden from the CRM and kept for recall; an erased one is gone.`);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(ok ? 0 : 1);
})().catch((err) => {
  console.error('check-deleted-buyers CRASHED:', err && err.stack ? err.stack : err);
  process.exit(1);
});
