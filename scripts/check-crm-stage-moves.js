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
  if (/^\s*INSERT INTO buyers\b/i.test(q)) return Promise.resolve([{ id: 900 + statements.length }]);
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
const csv = require(path.join(FN, 'crm-csv.js')).handler;

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
  const send = (kanban.match(/function sendMove\(buyer, newStage, fromMenu, extra\) \{[\s\S]*?\n        \}\n/) || [''])[0];
  t('the Kanban has one function that moves a buyer', !!move && !!send);
  t('   which applies the stage rules first, and sends nothing if they are cancelled',
    /CRM\.stageMoveCheck\(buyer\.company_name, newStage\)/.test(move) && /if \(!extra\) \{[\s\S]*?return;/.test(move) && /sendMove\(buyer, newStage, fromMenu, extra\)/.test(move) && !/fetchJson/.test(move));
  t('   then sends PATCH /api/crm/buyers?id=N with current_stage (and only what the rules add)',
    /var body = Object\.assign\(\{ current_stage: newStage \}, extra\);/.test(send) &&
    /CRM\.fetchJson\('\/api\/crm\/buyers\?id=' \+ buyer\.id, \{ method: 'PATCH', body: body \}\)/.test(send));
  t('   a drop on a column calls it', /addEventListener\('drop'[\s\S]*?moveBuyer\(buyer, stage\);/.test(kanban));
  const menu = (kanban.match(/function moveMenu\(r\) \{[\s\S]*?\n        \}\n/) || [''])[0];
  t('   and so does each card\'s "Move to" menu -- the same function, not a copy', /moveBuyer\(r, sel\.value, true\)/.test(menu) && !/fetchJson/.test(menu));
  t('   which offers every stage except the one the card is in', /CRM\.STAGES\.forEach/.test(menu) && /if \(stage === r\.current_stage\) return;/.test(menu));
  t('   and is labelled for a screen reader', /<label|createElement\('label'\)/.test(menu) && /aria-label/.test(menu));
  t('there is no other PATCH on the Kanban page', (kanban.match(/method: 'PATCH'/g) || []).length === 1);

  const page = read('crm/buyer/index.html');
  const panel = (page.match(/getElementById\('move-panel'\)\.addEventListener\('submit'[\s\S]*?\n        \}\);/) || [''])[0];
  t('the buyer page\'s "Move stage" applies the same rules, then sends the same request',
    /CRM\.stageMoveCheck\(current\.company_name, to\)/.test(panel) && /if \(!extra\)/.test(panel) &&
    /var body = Object\.assign\(\{ current_stage: to \}, extra\);/.test(panel) &&
    /CRM\.fetchJson\('\/api\/crm\/buyers\?id=' \+ encodeURIComponent\(buyerId\), \{ method: 'PATCH', body: body \}\)/.test(panel));
  t('   its menu starts on the current stage, "(now)", with Move off until another is chosen',
    /id="move-btn" disabled/.test(page) && /' \(now\)'/.test(page) && /getElementById\('move-btn'\)\.disabled = !e\.target\.value/.test(page));

  // The reason given for Lost/Stalled is shown where it is seen (owner, 2026-10-21).
  t('the buyer page shows "Lost/Stalled: <reason>" under the name', /Lost\/Stalled: ' \+ CRM\.escapeHtml\(b\.lost_reason\)/.test(page));
  t('   and "Reason: …" beside the latest move to Lost/Stalled in Stage History, as a label only',
    /i === lastLost && reason/.test(page) && /Buyer\\u2019s current Lost\/Stalled reason: /.test(page) && !/(UPDATE|DELETE FROM) buyer_stage_history/.test(page));
  t('   and the Kanban card in Lost/Stalled shows it too, from the list, which now carries lost_reason',
    /r\.current_stage === 'Lost\/Stalled' && r\.lost_reason/.test(kanban) &&
    /next_action_due, certification_gap, lost_reason, deleted_at/.test(read('netlify/functions/crm-buyers.js')));
  t('Exported/Completed asks a plain yes-or-no question',
    /'Has ' \+ who \+ '\\u2019s export been completed\?'/.test(read('assets/crm.js')) && /cancel: 'No, go back', confirm: 'Yes, mark as exported', confirmClass: 'crm-ui-btn-confirm-export'/.test(read('assets/crm.js')) &&
    /Use this only after a shipment has actually left Egypt\./.test(read('assets/crm.js')) && /\.crm-ui-btn-confirm-export \{ background: #b8923a/.test(read('assets/crm-ui.css')));

  // ---- the rules themselves, run with a stand-in for the in-page question ----
  {
    const crmSrc = read('assets/crm.js');
    const m = crmSrc.match(/  var typedReasons = \{\};[\s\S]*?CRM\.stageMoveCheck = function \(companyName, toStage\) \{[\s\S]*?\n  \};/);
    t('one set of stage rules, in assets/crm.js', !!m);
    const asked = [];
    let answer = null;
    const CRM = { ask: (o) => { asked.push(o); return Promise.resolve(answer); } };
    const check = m ? require('vm').runInNewContext('(function (CRM) { ' + m[0] + ' return CRM.stageMoveCheck; })', { Promise })(CRM) : null;
    if (check) {
      let r = await check('Test Co (fake)', 'Contacted');
      t('   an ordinary stage asks nothing and adds nothing', asked.length === 0 && JSON.stringify(r) === '{}');
      answer = { reason: 'Chose a cheaper supplier (test)' };
      r = await check('Test Co (fake)', 'Lost/Stalled');
      t('   Lost/Stalled asks for a reason, required, and sends it as lost_reason',
        asked.length === 1 && asked[0].reason && asked[0].reason.maxlength === 300 && r && r.lost_reason === 'Chose a cheaper supplier (test)', JSON.stringify(r));
      answer = false;
      r = await check('Test Co (fake)', 'Lost/Stalled');
      t('   cancelling it moves nothing', r === null);
      answer = true;
      r = await check('Test Co (fake)', 'Exported/Completed');
      t('   Exported/Completed asks to confirm', asked.length === 3 && !asked[2].reason && /genuinely been completed/.test(asked[2].message) && JSON.stringify(r) === '{"confirm_stage":"Exported/Completed"}', JSON.stringify(r));
      answer = false;
      r = await check('Test Co (fake)', 'Exported/Completed');
      t('   and cancelling it moves nothing', r === null);
      // Nothing typed is lost (owner, 2026-10-21): a reason for a move that did not go through is offered again.
      asked.length = 0;
      answer = { reason: 'Typed once (test)' };
      await check('Keep Co (fake)', 'Lost/Stalled');
      answer = false;
      await check('Keep Co (fake)', 'Lost/Stalled');
      t('a reason typed for a move that was not saved is offered again next time', asked[1].reason.value === 'Typed once (test)', JSON.stringify(asked[1].reason));
      CRM.stageMoveSaved('Keep Co (fake)');
      await check('Keep Co (fake)', 'Lost/Stalled');
      t('   and forgotten once a move is saved', asked[2].reason.value === '');
      await check('Other Co (fake)', 'Lost/Stalled');
      t('   and never offered for a different buyer', asked[3].reason.value === '');
    }
  }
  t('   so unsaved edits in the details form are not sent with it', !/collectForm/.test(panel));
  t('   and afterwards it reloads the logs, not the form', /refreshLogs\(\)/.test(panel) && !/loadExisting\(\)/.test(panel));
  t('a refusal shows the server\'s own reason, on the Kanban and the buyer page',
    /CRM\.refusalText\(result, /.test(send) && /CRM\.refusalText\(result, /.test(panel));
  t('   a saved move forgets the kept reason (Kanban, Move stage, details form)',
    /CRM\.stageMoveSaved\(buyer\.company_name\)/.test(send) && /CRM\.stageMoveSaved\(current\.company_name\)/.test(panel) && (page.match(/CRM\.stageMoveSaved\(/g) || []).length === 2);
  t('   and the details form is never refilled or cleared on a refusal',
    /saveErrorText\(result\.data \|\| \{\}\) \+ ' Your changes are still in the form\.'/.test(page));

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

  r = await patch({ current_stage: 'Lost/Stalled', lost_reason: 'Chose a cheaper supplier (test)' });
  t('a move to Lost/Stalled with its reason is one request, one new history row',
    r.status === 200 && history.length === 4 && history[3].to_stage === 'Lost/Stalled' && r.statements.filter(touchesHistory).length === 1 &&
    r.statements.some((x) => /^UPDATE buyers SET/.test(x.q) && /lost_reason = \$/.test(x.q)), JSON.stringify(r.data));

  // ---- the server enforces the rules, whatever sends the request (2026-10-21) ----
  const writes = (st) => st.filter((x) => /^(INSERT|UPDATE|DELETE)\b/i.test(x.q));
  const refused = (rr, field) => rr.status === 400 && rr.data.stage_rule === true && rr.data.fields && rr.data.fields[0] === field &&
    typeof rr.data.reasons[field] === 'string' && writes(rr.statements).length === 0;
  buyer.current_stage = 'Negotiation';
  const rowsBefore = history.length;
  r = await patch({ current_stage: 'Lost/Stalled' });
  t('server refuses a move to Lost/Stalled with no reason', refused(r, 'lost_reason'), JSON.stringify(r.data) + ' ' + JSON.stringify(writes(r.statements)));
  t('   and writes nothing: no UPDATE, no history row, no audit entry', writes(r.statements).length === 0 && history.length === rowsBefore && buyer.current_stage === 'Negotiation');
  r = await patch({ current_stage: 'Lost/Stalled', lost_reason: '   ' });
  t('   a blank reason is no reason', refused(r, 'lost_reason'));
  r = await patch({ current_stage: 'Lost/Stalled', lost_reason: 42 });
  t('   nor is a number', refused(r, 'lost_reason'));
  r = await patch({ current_stage: 'Exported/Completed' });
  t('server refuses a move to Exported/Completed with no confirmation', refused(r, 'current_stage'), JSON.stringify(r.data));
  r = await patch({ current_stage: 'Exported/Completed', confirm_stage: true });
  t('   "true" is not the confirmation; it must name the stage', refused(r, 'current_stage'));
  r = await patch({ current_stage: 'Exported/Completed', confirm_stage: 'Lost/Stalled' });
  t('   nor is another stage\'s name', refused(r, 'current_stage'));
  t('   none of those refused moves added a history row', history.length === rowsBefore && buyer.current_stage === 'Negotiation');
  // A whole-form save, as the folded details form sends it.
  const form = { company_name: 'Test Olive Importers (fake)', country_region: 'EU', notes: 'edited', lost_reason: '' };
  r = await patch({ ...form, current_stage: 'Lost/Stalled' });
  t('the details form is held to it too: Lost/Stalled with the reason box empty is refused', refused(r, 'lost_reason'));
  r = await patch({ ...form, current_stage: 'Lost/Stalled', lost_reason: 'Went with a local packer (test)' });
  t('   and saves with a reason: one new history row', r.status === 200 && history.length === rowsBefore + 1 && history[history.length - 1].to_stage === 'Lost/Stalled', JSON.stringify(r.data));
  r = await patch({ ...form, current_stage: 'Lost/Stalled', notes: 'edited again', lost_reason: '' });
  t('editing other fields of a buyer already in Lost/Stalled is not a move, so is not refused', r.status === 200 && history.length === rowsBefore + 1, JSON.stringify(r.data));
  r = await patch({ current_stage: 'Exported/Completed', confirm_stage: 'Exported/Completed' });
  t('a confirmed move to Exported/Completed is accepted: one new history row', r.status === 200 && history.length === rowsBefore + 2 && history[history.length - 1].to_stage === 'Exported/Completed', JSON.stringify(r.data));
  r = await patch({ current_stage: 'Contacted' });
  t('an ordinary move needs nothing extra', r.status === 200 && history.length === rowsBefore + 3);
  t('   every row before these is exactly as it was', JSON.stringify(history.slice(0, 2)) === before);

  // Creating a buyer straight into one of those stages.
  const create = async (b) => {
    statements = [];
    const rr = await buyers({ httpMethod: 'POST', headers: { cookie }, queryStringParameters: {}, body: JSON.stringify(b) });
    return { status: rr.statusCode, data: JSON.parse(rr.body || '{}'), statements: statements.slice() };
  };
  const base = { company_name: 'New Test Buyer (fake)', country_region: 'EU' };
  r = await create({ ...base, current_stage: 'Lost/Stalled' });
  t('creating a buyer in Lost/Stalled without a reason is refused, nothing written', refused(r, 'lost_reason'), JSON.stringify(r.data));
  r = await create({ ...base, current_stage: 'Exported/Completed' });
  t('creating one in Exported/Completed without confirmation is refused', refused(r, 'current_stage'));
  r = await create({ ...base, current_stage: 'Lost/Stalled', lost_reason: 'Old contact, no longer trading (test)' });
  const ins = r.statements.find((x) => /^INSERT INTO buyers/.test(x.q));
  t('   with a reason it is created, and the reason is saved (it was dropped before)',
    r.status === 200 && ins && /lost_reason/.test(ins.q) && ins.params.includes('Old contact, no longer trading (test)'), JSON.stringify(r.data));
  r = await create({ ...base });
  t('   an ordinary new buyer (Lead) needs nothing extra', r.status === 200);

  // CSV import.
  statements = [];
  const imp = await csv({ httpMethod: 'POST', headers: { cookie }, queryStringParameters: { action: 'import' }, body: JSON.stringify({ csv:
    'company_name,country_region,current_stage,lost_reason\n' +
    'Csv Lead Co (fake),EU,Lead,\n' +
    'Csv Lost No Reason (fake),EU,Lost/Stalled,\n' +
    'Csv Lost With Reason (fake),EU,Lost/Stalled,Stopped importing (test)\n' +
    'Csv Exported (fake),EU,Exported/Completed,\n' }) });
  const ib = JSON.parse(imp.body || '{}');
  t('CSV import: the Lead row and the Lost/Stalled row with a reason are imported', ib.ok && ib.imported === 2, imp.body);
  t('   a Lost/Stalled row without a reason is skipped, saying why', (ib.skipped || []).some((x) => x.line === 3 && /needs a reason: add a lost_reason column/.test(x.reason)));
  t('   an Exported/Completed row is skipped, saying how to do it instead', (ib.skipped || []).some((x) => x.line === 5 && /needs confirming by a person/.test(x.reason)));
  t('   and the imported reason is saved', statements.some((x) => /^INSERT INTO buyers/.test(x.q) && x.params.includes('Stopped importing (test)')));

  // The automatic website-enquiry intake never puts a buyer in either stage.
  const intake = require(path.join(FN, '_crm_intake.js'));
  t('the website-enquiry intake never moves a buyer to Lost/Stalled or Exported/Completed',
    Object.values(intake.PLAN).every((pl) => !['Lost/Stalled', 'Exported/Completed'].includes(pl.stage)) &&
    intake.forwardMove('Shipment Prepared', 'Lead') === null && intake.forwardMove('Lost/Stalled', 'Sample Requested') === null);

  const rowsNow = history.length;
  const unsigned = await buyers({ httpMethod: 'PATCH', headers: {}, queryStringParameters: { id: '7' }, body: JSON.stringify({ current_stage: 'Lead' }) });
  t('a move without a CRM session is refused', unsigned.statusCode === 401 && history.length === rowsNow);

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
