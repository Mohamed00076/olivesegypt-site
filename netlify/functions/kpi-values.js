'use strict';

/*
 * Section J2 -- KPI Manager: manual value entry, correction, and history.
 * Append-only per J2's core design principle: a correction never
 * overwrites a row, it supersedes it (old row's is_current -> false,
 * new row inserted with version+1 and supersedes_id pointing back).
 *
 * This phase (delivery order step 2) only accepts entries for
 * data_source = 'manual' KPIs -- automated (analytics-sourced) KPIs are
 * a later phase, once J1's events are confirmed consent-compliant for
 * the specific thing being counted.
 */

const { neon } = require('@neondatabase/serverless');
const { parseCookies, verifySession, COOKIE_NAME, readJsonBody, json } = require('./_lib');
const { ensureSchema: ensureAnalyticsSchema, auditLog } = require('./_analytics_lib');
const { ensureSchema, currentPeriod, getOrCreatePeriod, computeStatus } = require('./_kpi_lib');

function connectionString() {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_URL_UNPOOLED ||
    ''
  );
}

function requireAdmin(event) {
  const SESSION_SECRET = process.env.SESSION_SECRET;
  const token = SESSION_SECRET ? parseCookies(event.headers)[COOKIE_NAME] : null;
  return token ? verifySession(token, SESSION_SECRET) : null;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

async function handleGet(sql, qs) {
  const kpiId = qs && qs.kpi_id ? Number(qs.kpi_id) : null;
  if (kpiId && !Number.isFinite(kpiId)) return json(400, { ok: false, error: 'kpi_id must be a number' });

  if (kpiId) {
    // Full version history for one KPI (all periods, all versions) --
    // the "test correction showing version 1 -> version 2" view.
    const rows = await sql`
      SELECT v.*, p.period_start, p.period_end, p.frequency AS period_frequency
      FROM kpi_values v
      JOIN kpi_periods p ON p.id = v.period_id
      WHERE v.kpi_id = ${kpiId}
      ORDER BY p.period_start DESC, v.version DESC
    `;
    return json(200, { ok: true, values: rows });
  }

  // Current value only, across all active (non-archived) KPIs -- the
  // dashboard's own summary endpoint (kpi-dashboard.js) builds on this
  // shape but adds trend history; this is the flat list.
  const rows = await sql`
    SELECT v.*, p.period_start, p.period_end, p.frequency AS period_frequency, d.name AS kpi_name
    FROM kpi_values v
    JOIN kpi_periods p ON p.id = v.period_id
    JOIN kpi_definitions d ON d.id = v.kpi_id
    WHERE v.is_current = true AND d.archived_at IS NULL
    ORDER BY d.display_order ASC, d.name ASC
  `;
  return json(200, { ok: true, values: rows });
}

async function handlePost(sql, body, actor) {
  const kpiId = Number(body.kpi_id);
  if (!Number.isFinite(kpiId)) return json(400, { ok: false, error: 'kpi_id is required' });

  const defRows = await sql`SELECT * FROM kpi_definitions WHERE id = ${kpiId} LIMIT 1`;
  const def = defRows[0];
  if (!def) return json(404, { ok: false, error: 'KPI definition not found' });
  if (def.archived_at) return json(400, { ok: false, error: 'This KPI is archived' });
  if (def.data_source !== 'manual') {
    return json(400, { ok: false, error: `This KPI's data_source is "${def.data_source}", not "manual" -- manual entry only applies to manual KPIs. Automated calculation for this data_source isn't built yet.` });
  }

  let actualValue = null;
  if (body.actual_value !== null && body.actual_value !== undefined && body.actual_value !== '') {
    const n = Number(body.actual_value);
    if (!Number.isFinite(n)) return json(400, { ok: false, error: 'actual_value must be a number, or null/omitted for "no data yet"' });
    actualValue = n;
  }
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 2000) || null : null;

  // Period: explicit period_start/period_end (for backfill/correction of
  // a past period), or default to "now" in this KPI's own frequency.
  let period;
  if (body.period_start || body.period_end) {
    if (!DATE_RE.test(body.period_start || '') || !DATE_RE.test(body.period_end || '')) {
      return json(400, { ok: false, error: 'period_start and period_end must both be given as YYYY-MM-DD' });
    }
    if (body.period_end < body.period_start) return json(400, { ok: false, error: 'period_end must not be before period_start' });
    period = await getOrCreatePeriod(sql, def.frequency, body.period_start, body.period_end);
  } else {
    period = await currentPeriod(sql, def.frequency);
  }
  if (!period) return json(500, { ok: false, error: 'Could not resolve reporting period' });

  // Snapshot the KPI's *current* target/threshold at write time -- never
  // a live reference from the dashboard's read path (see _kpi_lib.js).
  const targetValue = def.current_target_value;
  const warningThreshold = def.current_warning_threshold;
  const status = computeStatus(def.direction, actualValue, targetValue, warningThreshold);

  const existingRows = await sql`
    SELECT * FROM kpi_values WHERE kpi_id = ${kpiId} AND period_id = ${period.id} AND is_current = true LIMIT 1
  `;
  const existing = existingRows[0];

  let newRow;
  let action;
  if (!existing) {
    const rows = await sql`
      INSERT INTO kpi_values
        (kpi_id, period_id, actual_value, target_value, warning_threshold, status,
         value_type, source, calculated_at, entered_by_actor, note, version, is_current)
      VALUES
        (${kpiId}, ${period.id}, ${actualValue}, ${targetValue}, ${warningThreshold}, ${status},
         'manual', 'manual entry', now(), ${actor}, ${note}, 1, true)
      RETURNING *
    `;
    newRow = rows[0];
    action = 'kpi_value_entry';
  } else {
    // Correction: supersede, don't overwrite. Order matters -- clear the
    // old row's is_current first, since the partial unique index only
    // allows one is_current=true row per (kpi_id, period_id).
    await sql`UPDATE kpi_values SET is_current = false WHERE id = ${existing.id}`;
    const rows = await sql`
      INSERT INTO kpi_values
        (kpi_id, period_id, actual_value, target_value, warning_threshold, status,
         value_type, source, calculated_at, entered_by_actor, note, version, is_current, supersedes_id)
      VALUES
        (${kpiId}, ${period.id}, ${actualValue}, ${targetValue}, ${warningThreshold}, ${status},
         'manual', 'manual correction', now(), ${actor}, ${note}, ${existing.version + 1}, true, ${existing.id})
      RETURNING *
    `;
    newRow = rows[0];
    action = 'kpi_value_correction';
  }

  await auditLog(
    sql, actor, action,
    `kpi_id=${kpiId} name=${JSON.stringify(def.name)} period=${period.period_start}..${period.period_end} ` +
    `version=${newRow.version} actual_value=${actualValue === null ? 'NULL' : actualValue} status=${status}` +
    (existing ? ` (supersedes id=${existing.id}, was actual_value=${existing.actual_value === null ? 'NULL' : existing.actual_value})` : '')
  );

  return json(existing ? 200 : 201, { ok: true, value: newRow, period, corrected: !!existing });
}

exports.handler = async (event) => {
  const session = requireAdmin(event);
  if (!session) return json(401, { error: 'Unauthorized' }, { 'Cache-Control': 'no-store, private' });

  const cs = connectionString();
  if (!cs) return json(500, { error: 'Server not configured' });
  const sql = neon(cs);

  try {
    await ensureAnalyticsSchema(sql);
    await ensureSchema(sql);

    if (event.httpMethod === 'GET') return await handleGet(sql, event.queryStringParameters);
    if (event.httpMethod === 'POST') return await handlePost(sql, readJsonBody(event) || {}, session.sub);

    return json(405, { error: 'Method not allowed' }, { Allow: 'GET, POST' });
  } catch (err) {
    console.error('[kpi-values] error:', err?.message ?? err);
    return json(500, { ok: false, error: 'Server error' });
  }
};
