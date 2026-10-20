#!/usr/bin/env node
'use strict';

/*
 * Moving a buyer's stage, whichever way it is done (Batch 2 of the owner's
 * CRM audit, 2026-10-20).
 *
 *   node scripts/check-crm-stage-moves.js        (part of `npm test`)
 *
 * The owner: a "Move to" menu on each Kanban card "must call the same
 * endpoint as dragging (PATCH /api/crm/buyers?id=..., body current_stage),
 * so stage-change history stays append-only; test this".
 *
 * Three ways to move a stage now exist: drag a Kanban card, the card's
 * "Move to" menu, and the buyer page's "Move stage". This holds that
 *   - all three send the one request: PATCH /api/crm/buyers?id=N with a body
 *     of current_stage and nothing else (the Kanban's two go through the
 *     same function);
 *   - the server answers that request by adding one row to
 *     buyer_stage_history -- from, to, who -- and never by changing or
 *     removing a row already there; a "move" to the stage it is already in
 *     adds nothing;
 *   - nothing anywhere updates buyer_stage_history, and the only statement
 *     that deletes from it is Erase (a deletion request).
 *
 * The real handler runs against a stub database that records every statement.
 */

const fs = require('fs');
const path = require('path');
const Module = require('module');

const ROOT = path.join(__dirname, '..');
const FN = path.join(ROOT, 'netlify', 'functions');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

let pass = 0, fail = 0;
const t = (name, cond, extra) => {
  cond ? pass++ : fail++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : '   <-- ' + (extra === undefined ? '' : extra)}`);
};

process.env.DATABASE_URL = 'postgres://stub';
process.env.CRM_SESSION_SECRET = 'test-secret-not-a-real-one';

// One fake buyer; the stub keeps its stage and its history so a sequence of moves can be followed.
const buyer = { id: 7, current_stage: 'Lead', deleted_at: null, company_name: 'Test Olive Importers (fake)' };
let history = [{ id: 1, from_stage: null, to_stage: 'Lead', changed_by: 'staff' }];
let statements = [];
const sql = (strings, ...vals) => {
  const q = Array.isArray(strings) ? strings.join('?') : String(strings);
  const params = Array.isArray(strings) ? vals : (vals[0] || []);
  statements.push({ q: q.replace(/\s+/g, ' ').trim(), params });
  if (/to_regclass/.test(q)) return Promise.resolve([{ present: true }]);
  if (/^\s*SELECT/i.test(q) && /FROM buyers WHERE id = /i.test(q)) return Promise.resolve(params[0] === buyer.id ? [buyer] : []);
  if (/^\s*UPDATE buyers SET/i.test(q)) {
    const m = q.match(/current_stage = \$(\d+)/);
    if (m) buyer.current_stage = params[Number(m[1]) - 1];
    return Promise.resolve([]);
  }
  if (/^\s*INSERT INTO buyer_stage_history/i.test(q)) {
    history.push({ id: history.length + 1, from_stage: params[1], to_stage: params[2], changed_by: params[3] });
    return Promise.resolve([]);
  }
  return Promise.resolve([]);
};
sql.query = (text, params) => sql(text, params);
const neonId = require.resolve('@neondatabase/serverless');
require.cache[neonId] = new Module(neonId, null);
require.cache[neonId].filename = neonId;
require.cache[neonId].loaded = true;
require.cache[neonId].exports = { neon: () => sql };

const { signCrmSession, CRM_COOKIE_NAME } = require(path.join(FN, '_crm_lib.js'));
const cookie = `${CRM_COOKIE_NAME}=${signCrmSession('staff')}`;
const buyers = require(path.join(FN, 'crm-buyers.js')).handler;

const patch = async (body) => {
  statements = [];
  const r = await buyers({ httpMethod: 'PATCH', headers: { cookie }, queryStringParameters: { id: String(buyer.id) }, body: JSON.stringify(body) });
  return { status: r.statusCode, data: JSON.parse(r.body || '{}'), statements: statements.slice() };
};
// A write to the history (the table's own CREATE IF NOT EXISTS runs on every request and is not one).
const touchesHistory = (s) => /^(INSERT INTO|UPDATE|DELETE FROM|TRUNCATE)\s+buyer_stage_history/i.test(s.q) || /^WITH\b.*buyer_stage_history/i.test(s.q);

(async () => {
  // ---- the pages all send the same request --------------------------------
  const kanban = read('crm/kanban/index.html');
  const move = (kanban.match(/function moveBuyer\(buyer, newStage(?:, fromMenu)?\) \{[\s\S]*?\n        \}\n/) || [''])[0];
  t('the Kanban has one function that moves a buyer', !!move);
  t('   and it sends PATCH /api/crm/buyers?id=N with current_stage alone',
    /CRM\.fetchJson\('\/api\/crm\/buyers\?id=' \+ buyer\.id, \{ method: 'PATCH', body: \{ current_stage: newStage \} \}\)/.test(move));
  t('   a drop on a column calls it', /addEventListener\('drop'[\s\S]*?moveBuyer\(buyer, stage\);/.test(kanban));
  const menu = (kanban.match(/function moveMenu\(r\) \{[\s\S]*?\n        \}\n/) || [''])[0];
  t('   and so does each card\'s "Move to" menu -- the same function, not a copy', /moveBuyer\(r, sel\.value, true\)/.test(menu) && !/fetchJson/.test(menu));
  t('   which offers every stage except the one the card is in', /CRM\.STAGES\.forEach/.test(menu) && /if \(stage === r\.current_stage\) return;/.test(menu));
  t('   and is labelled for a screen reader', /<label|createElement\('label'\)/.test(menu) && /aria-label/.test(menu));
  t('there is no other PATCH on the Kanban page', (kanban.match(/method: 'PATCH'/g) || []).length === 1);

  const page = read('crm/buyer/index.html');
  const panel = (page.match(/getElementById\('move-panel'\)\.addEventListener\('submit'[\s\S]*?\n        \}\);/) || [''])[0];
  t('the buyer page\'s "Move stage" sends the same request, current_stage alone',
    /CRM\.fetchJson\('\/api\/crm\/buyers\?id=' \+ encodeURIComponent\(buyerId\), \{ method: 'PATCH', body: \{ current_stage: to \} \}\)/.test(panel));
  t('   so unsaved edits in the details form are not sent with it', !/collectForm/.test(panel));
  t('   and afterwards it reloads the logs, not the form', /refreshLogs\(\)/.test(panel) && !/loadExisting\(\)/.test(panel));

  // ---- the server: one new row per move, nothing rewritten ----------------
  let r = await patch({ current_stage: 'Contacted' });
  t('a move is accepted', r.status === 200 && r.data.ok, JSON.stringify(r.data));
  const hist = r.statements.filter(touchesHistory);
  t('   and adds exactly one stage-history row', hist.length === 1 && /^INSERT INTO buyer_stage_history/i.test(hist[0].q), JSON.stringify(hist));
  t('   recording from, to and who', history.length === 2 && history[1].from_stage === 'Lead' && history[1].to_stage === 'Contacted' && history[1].changed_by === 'staff',
    JSON.stringify(history));

  const before = JSON.stringify(history.slice(0, 2));
  r = await patch({ current_stage: 'Qualifying' });
  t('a second move adds a second row', history.length === 3 && history[2].from_stage === 'Contacted' && history[2].to_stage === 'Qualifying', JSON.stringify(history));
  t('   and leaves the earlier rows exactly as they were', JSON.stringify(history.slice(0, 2)) === before);
  t('   no move ever updates or deletes a stage-history row',
    r.statements.filter(touchesHistory).every((s) => /^INSERT INTO/i.test(s.q)));

  r = await patch({ current_stage: 'Qualifying' });
  t('a "move" to the stage it is already in adds no row', r.status === 200 && history.length === 3 && !r.statements.some(touchesHistory),
    JSON.stringify(r.statements.map((s) => s.q.slice(0, 60))));

  r = await patch({ current_stage: 'Not a stage' });
  t('an unknown stage is refused and adds no row', r.status === 400 && history.length === 3 && !r.statements.some(touchesHistory), JSON.stringify(r.data));

  const unsigned = await buyers({ httpMethod: 'PATCH', headers: {}, queryStringParameters: { id: '7' }, body: JSON.stringify({ current_stage: 'Lead' }) });
  t('a move without a CRM session is refused', unsigned.statusCode === 401 && history.length === 3);

  // ---- nothing in the code rewrites history -------------------------------
  const fns = fs.readdirSync(FN).filter((f) => f.endsWith('.js'));
  const updates = fns.filter((f) => /UPDATE\s+buyer_stage_history/i.test(read(`netlify/functions/${f}`)));
  t('no function updates buyer_stage_history', updates.length === 0, updates.join(', '));
  const deletes = fns.flatMap((f) => (read(`netlify/functions/${f}`).match(/DELETE FROM buyer_stage_history[^)]*\)/gi) || []).map((m) => `${f}: ${m}`));
  t('the only delete from it is Erase, removing an erased buyer\'s own rows',
    deletes.length === 1 && /^crm-buyers\.js: DELETE FROM buyer_stage_history WHERE buyer_id IN \(SELECT id FROM b\)/.test(deletes[0]), deletes.join(' | '));

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail) {
    console.log('\nstage-moves FAILED -- every way of moving a stage must send the same request, and stage history must only grow.');
    process.exit(1);
  }
})().catch((e) => { console.error(e); process.exit(1); });
