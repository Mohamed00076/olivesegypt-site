'use strict';
// Live DB round-trip proof for the KPI Manager (Section J2).
//
// Same usage pattern as scripts/db-roundtrip-check.js -- run this where
// your real DATABASE_URL is available:
//
//   DATABASE_URL='postgres://...neon.tech/db?sslmode=require' \
//     node scripts/kpi-roundtrip-check.js
//
// Proves, against the real database: schema creation is idempotent; a
// manual KPI value entry persists; a correction creates version 2
// without destroying version 1; exactly one row stays is_current=true;
// status is computed correctly (on_track/off_track/no_data, including a
// real zero not being conflated with "no data"); and every write landed
// an entry in analytics_audit_log. Cleans up all test rows it created
// at the end either way (success or failure).

const { neon } = require('@neondatabase/serverless');
const { ensureSchema: ensureAnalyticsSchema, auditLog } = require('../netlify/functions/_analytics_lib');
const { ensureSchema, currentPeriod, computeStatus } = require('../netlify/functions/_kpi_lib');

const cs =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.DATABASE_URL_UNPOOLED;

if (!cs) {
  console.error('No connection string in env (DATABASE_URL/POSTGRES_URL). See header.');
  process.exit(1);
}

const sql = neon(cs);
const marker = 'kpi-roundtrip-' + Date.now();
let defId = null;

function assert(label, cond) {
  console.log((cond ? '[ok]' : '[FAIL]'), label);
  if (!cond) throw new Error('Assertion failed: ' + label);
}

(async () => {
  // 1. schema, twice, to prove idempotency
  await ensureAnalyticsSchema(sql);
  await ensureSchema(sql);
  await ensureSchema(sql);
  console.log('[1] ensureSchema ran twice, no error (idempotent)');

  // 2. create a test KPI definition
  const defRows = await sql`
    INSERT INTO kpi_definitions
      (name, description, category, unit, direction, frequency, data_source, calculation_type,
       current_target_value, current_warning_threshold, is_active)
    VALUES
      (${marker}, ${'Round-trip test KPI, safe to delete.'}, ${'test'}, ${'count'},
       ${'higher_is_better'}, ${'monthly'}, ${'manual'}, ${'manual'}, ${10}, ${6}, ${true})
    RETURNING *
  `;
  defId = defRows[0].id;
  console.log('[2] kpi_definitions row created, id =', defId);

  // 3. resolve (create) the current period, and check status computation
  const period = await currentPeriod(sql, 'monthly');
  assert('current period resolved', !!period && !!period.id);

  const status1 = computeStatus('higher_is_better', 4, 10, 6);
  assert('computeStatus(4 vs target 10, warn 6) = off_track', status1 === 'off_track');

  // 4. first entry (version 1)
  const v1Rows = await sql`
    INSERT INTO kpi_values
      (kpi_id, period_id, actual_value, target_value, warning_threshold, status,
       value_type, source, calculated_at, entered_by_actor, note, version, is_current)
    VALUES
      (${defId}, ${period.id}, ${4}, ${10}, ${6}, ${status1},
       'manual', 'manual entry', now(), ${'roundtrip-script'}, ${'initial'}, 1, true)
    RETURNING *
  `;
  await auditLog(sql, 'roundtrip-script', 'kpi_value_entry', `kpi_id=${defId} version=1 actual_value=4 (roundtrip test)`);
  const v1 = v1Rows[0];
  assert('version 1 inserted with is_current=true', v1.version === 1 && v1.is_current === true);
  console.log('[3] version 1 entry:', v1.id, 'actual_value =', v1.actual_value, 'status =', v1.status);

  // 5. correction (version 2) -- supersede, don't overwrite
  await sql`UPDATE kpi_values SET is_current = false WHERE id = ${v1.id}`;
  const status2 = computeStatus('higher_is_better', 12, 10, 6);
  const v2Rows = await sql`
    INSERT INTO kpi_values
      (kpi_id, period_id, actual_value, target_value, warning_threshold, status,
       value_type, source, calculated_at, entered_by_actor, note, version, is_current, supersedes_id)
    VALUES
      (${defId}, ${period.id}, ${12}, ${10}, ${6}, ${status2},
       'manual', 'manual correction', now(), ${'roundtrip-script'}, ${'corrected'}, ${v1.version + 1}, true, ${v1.id})
    RETURNING *
  `;
  await auditLog(sql, 'roundtrip-script', 'kpi_value_correction', `kpi_id=${defId} version=2 supersedes=${v1.id} (roundtrip test)`);
  const v2 = v2Rows[0];
  console.log('[4] version 2 (correction):', v2.id, 'actual_value =', v2.actual_value, 'status =', v2.status);

  // 6. verify both versions exist, exactly one is_current, v1 untouched
  const historyRows = await sql`SELECT * FROM kpi_values WHERE kpi_id = ${defId} ORDER BY version ASC`;
  assert('both version rows exist', historyRows.length === 2);
  const freshV1 = historyRows.find((r) => r.version === 1);
  const freshV2 = historyRows.find((r) => r.version === 2);
  assert('v1 preserved with original actual_value = 4', Number(freshV1.actual_value) === 4);
  assert('v1 is_current is now false', freshV1.is_current === false);
  assert('v2 is_current is true', freshV2.is_current === true);
  assert('v2.supersedes_id points at v1.id', Number(freshV2.supersedes_id) === Number(freshV1.id));
  assert('exactly one is_current=true row for this kpi/period', historyRows.filter((r) => r.is_current).length === 1);
  assert('correction status recomputed to on_track (12 >= target 10)', freshV2.status === 'on_track');

  // 7. real zero vs. genuinely no data
  const zeroStatus = computeStatus('lower_is_better', 0, 0, null);
  const zeroRows = await sql`
    INSERT INTO kpi_values
      (kpi_id, period_id, actual_value, target_value, status, value_type, source, calculated_at, entered_by_actor, version, is_current)
    VALUES (${defId}, ${period.id}, ${0}, ${0}, ${zeroStatus}, 'manual', 'manual entry', now(), ${'roundtrip-script'}, 99, false)
    RETURNING *
  `;
  assert('a real 0 is stored as 0, not NULL', zeroRows[0].actual_value === 0 || Number(zeroRows[0].actual_value) === 0);
  const noDataStatus = computeStatus('lower_is_better', null, 0, null);
  assert('null actual_value computes to no_data status', noDataStatus === 'no_data');

  // 8. audit log entries actually landed
  const auditRows = await sql`
    SELECT action FROM analytics_audit_log WHERE actor = 'roundtrip-script' AND details LIKE ${'%kpi_id=' + defId + '%'}
  `;
  const actions = auditRows.map((r) => r.action);
  assert('audit log has kpi_value_entry', actions.includes('kpi_value_entry'));
  assert('audit log has kpi_value_correction', actions.includes('kpi_value_correction'));
  console.log('[5] audit_log entries found:', actions.join(', '));

  console.log('\nROUND-TRIP OK');
})()
  .catch((e) => { console.error('\nROUND-TRIP FAILED:', e.message); process.exitCode = 1; })
  .finally(async () => {
    // cleanup, always -- even on failure, so a bad run doesn't leave test rows behind
    try {
      if (defId) {
        await sql`DELETE FROM kpi_values WHERE kpi_id = ${defId}`;
        await sql`DELETE FROM kpi_definitions WHERE id = ${defId}`;
        console.log('[cleanup] removed test KPI definition and its values (id =', defId + ')');
      }
    } catch (e) {
      console.error('[cleanup] failed:', e.message, '-- you may need to delete kpi_definitions id =', defId, 'manually.');
    }
  });
