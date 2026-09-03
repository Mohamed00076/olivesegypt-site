'use strict';

/*
 * Section J2 -- KPI Manager: definitions CRUD. Same tc_session admin gate
 * as the rest of /admin/analytics (analytics-settings.js, etc.) -- see
 * _kpi_lib.js's file header for why this is a plain-text actor, not a
 * users-table FK.
 */

const { neon } = require('@neondatabase/serverless');
const { parseCookies, verifySession, COOKIE_NAME, readJsonBody, json } = require('./_lib');
const { ensureSchema: ensureAnalyticsSchema, auditLog } = require('./_analytics_lib');
const { ensureSchema, DIRECTIONS, FREQUENCIES, DATA_SOURCES } = require('./_kpi_lib');

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

function str(v, cap) {
  const s = typeof v === 'string' ? v : v == null ? '' : String(v);
  return s.trim().slice(0, cap || 500);
}
function numOrNull(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined; // undefined signals "invalid"
}

async function handleGet(sql, qs) {
  const includeArchived = qs && (qs.include_archived === '1' || qs.include_archived === 'true');
  const rows = includeArchived
    ? await sql`SELECT * FROM kpi_definitions ORDER BY display_order ASC, category ASC, name ASC`
    : await sql`SELECT * FROM kpi_definitions WHERE archived_at IS NULL ORDER BY display_order ASC, category ASC, name ASC`;
  return json(200, { ok: true, definitions: rows });
}

async function handlePost(sql, body, actor) {
  const name = str(body.name, 200);
  const description = str(body.description, 2000);
  const category = str(body.category, 100);
  const unit = str(body.unit, 50);
  const direction = str(body.direction, 30);
  const frequency = str(body.frequency, 20);
  const dataSource = str(body.data_source, 20);
  const calculationType = str(body.calculation_type, 100);
  const ownerActor = body.owner_actor !== undefined ? str(body.owner_actor, 200) || null : null;
  const displayOrder = Number.isFinite(Number(body.display_order)) ? Math.round(Number(body.display_order)) : 0;

  if (!name) return json(400, { ok: false, error: 'name is required' });
  if (!description) return json(400, { ok: false, error: 'description is required' });
  if (!category) return json(400, { ok: false, error: 'category is required' });
  if (!unit) return json(400, { ok: false, error: 'unit is required' });
  if (!DIRECTIONS.has(direction)) return json(400, { ok: false, error: 'direction must be higher_is_better, lower_is_better, or neutral' });
  if (!FREQUENCIES.has(frequency)) return json(400, { ok: false, error: 'frequency must be weekly or monthly' });
  if (!DATA_SOURCES.has(dataSource)) return json(400, { ok: false, error: 'data_source must be manual, analytics, crm, or csv' });
  if (!calculationType) return json(400, { ok: false, error: 'calculation_type is required' });

  const target = numOrNull(body.current_target_value);
  const warning = numOrNull(body.current_warning_threshold);
  if (target === undefined) return json(400, { ok: false, error: 'current_target_value must be a number' });
  if (warning === undefined) return json(400, { ok: false, error: 'current_warning_threshold must be a number' });

  // Per J2's consent-dependency rule: a KPI sourced from something not yet
  // actually built (analytics-automated, crm-automated, or csv import --
  // none of which exist yet in this phase) is recorded as metadata but
  // forced inactive and flagged, rather than left as if it were live.
  const automatedNotYetBuilt = dataSource !== 'manual';
  const isActive = automatedNotYetBuilt ? false : (body.is_active !== false);

  const rows = await sql`
    INSERT INTO kpi_definitions
      (name, description, category, unit, direction, frequency, data_source, calculation_type,
       owner_actor, current_target_value, current_warning_threshold, is_active, display_order)
    VALUES
      (${name}, ${description}, ${category}, ${unit}, ${direction}, ${frequency}, ${dataSource}, ${calculationType},
       ${ownerActor}, ${target}, ${warning}, ${isActive}, ${displayOrder})
    RETURNING *
  `;
  const def = rows[0];

  await auditLog(sql, actor, 'kpi_definition_create', `id=${def.id} name=${JSON.stringify(name)} data_source=${dataSource}${automatedNotYetBuilt ? ' (forced is_active=false: no calculation path built yet)' : ''}`);

  return json(201, {
    ok: true,
    definition: def,
    ...(automatedNotYetBuilt
      ? { warning: `data_source="${dataSource}" has no automated calculation path yet -- this KPI was created inactive. It will need manual entries, or wait for that phase, before it's meaningful.` }
      : {}),
  });
}

const PATCHABLE_FIELDS = [
  'name', 'description', 'category', 'unit', 'direction', 'frequency',
  'data_source', 'calculation_type', 'owner_actor', 'display_order',
];

async function handlePatch(sql, body, actor) {
  const id = Number(body.id);
  if (!Number.isFinite(id)) return json(400, { ok: false, error: 'id is required' });

  const existingRows = await sql`SELECT * FROM kpi_definitions WHERE id = ${id} LIMIT 1`;
  const existing = existingRows[0];
  if (!existing) return json(404, { ok: false, error: 'KPI definition not found' });

  // Archive / restore (mutually exclusive with other-field edits in one
  // call, to keep the audit-log entry unambiguous about what happened).
  if (body.archive === true) {
    if (existing.archived_at) return json(400, { ok: false, error: 'Already archived' });
    const rows = await sql`UPDATE kpi_definitions SET archived_at = now(), is_active = false, updated_at = now() WHERE id = ${id} RETURNING *`;
    await auditLog(sql, actor, 'kpi_definition_archive', `id=${id} name=${JSON.stringify(existing.name)}`);
    return json(200, { ok: true, definition: rows[0] });
  }
  if (body.restore === true) {
    if (!existing.archived_at) return json(400, { ok: false, error: 'Not archived' });
    const rows = await sql`UPDATE kpi_definitions SET archived_at = NULL, updated_at = now() WHERE id = ${id} RETURNING *`;
    await auditLog(sql, actor, 'kpi_definition_restore', `id=${id} name=${JSON.stringify(existing.name)}`);
    return json(200, { ok: true, definition: rows[0] });
  }

  const changes = {};
  const changeDetails = [];

  for (const field of PATCHABLE_FIELDS) {
    if (body[field] === undefined) continue;
    const val = str(body[field], field === 'description' ? 2000 : 500);
    if (field === 'direction' && !DIRECTIONS.has(val)) return json(400, { ok: false, error: 'invalid direction' });
    if (field === 'frequency' && !FREQUENCIES.has(val)) return json(400, { ok: false, error: 'invalid frequency' });
    if (field === 'data_source' && !DATA_SOURCES.has(val)) return json(400, { ok: false, error: 'invalid data_source' });
    if (['name', 'description', 'category', 'unit', 'calculation_type'].includes(field) && !val) {
      return json(400, { ok: false, error: `${field} cannot be empty` });
    }
    if (field === 'display_order') {
      const n = Number(body.display_order);
      if (!Number.isFinite(n)) return json(400, { ok: false, error: 'display_order must be a number' });
      changes[field] = Math.round(n);
    } else {
      changes[field] = val;
    }
    changeDetails.push(`${field}: ${JSON.stringify(existing[field])} -> ${JSON.stringify(changes[field])}`);
  }

  if (body.current_target_value !== undefined) {
    const t = numOrNull(body.current_target_value);
    if (t === undefined) return json(400, { ok: false, error: 'current_target_value must be a number' });
    changes.current_target_value = t;
    changeDetails.push(`current_target_value: ${existing.current_target_value} -> ${t}`);
  }
  if (body.current_warning_threshold !== undefined) {
    const w = numOrNull(body.current_warning_threshold);
    if (w === undefined) return json(400, { ok: false, error: 'current_warning_threshold must be a number' });
    changes.current_warning_threshold = w;
    changeDetails.push(`current_warning_threshold: ${existing.current_warning_threshold} -> ${w}`);
  }
  if (body.is_active !== undefined) {
    if (typeof body.is_active !== 'boolean') return json(400, { ok: false, error: 'is_active must be true or false' });
    changes.is_active = body.is_active;
    changeDetails.push(`is_active: ${existing.is_active} -> ${body.is_active}`);
  }

  if (Object.keys(changes).length === 0) return json(400, { ok: false, error: 'Nothing to update' });

  // One explicit, literal statement per known column -- same convention
  // as analytics-settings.js's separate handlePatch* functions -- rather
  // than interpolating a column name into the query, which the tagged-
  // template query style used throughout this codebase isn't built for.
  if (changes.name !== undefined) await sql`UPDATE kpi_definitions SET name = ${changes.name}, updated_at = now() WHERE id = ${id}`;
  if (changes.description !== undefined) await sql`UPDATE kpi_definitions SET description = ${changes.description}, updated_at = now() WHERE id = ${id}`;
  if (changes.category !== undefined) await sql`UPDATE kpi_definitions SET category = ${changes.category}, updated_at = now() WHERE id = ${id}`;
  if (changes.unit !== undefined) await sql`UPDATE kpi_definitions SET unit = ${changes.unit}, updated_at = now() WHERE id = ${id}`;
  if (changes.direction !== undefined) await sql`UPDATE kpi_definitions SET direction = ${changes.direction}, updated_at = now() WHERE id = ${id}`;
  if (changes.frequency !== undefined) await sql`UPDATE kpi_definitions SET frequency = ${changes.frequency}, updated_at = now() WHERE id = ${id}`;
  if (changes.data_source !== undefined) await sql`UPDATE kpi_definitions SET data_source = ${changes.data_source}, updated_at = now() WHERE id = ${id}`;
  if (changes.calculation_type !== undefined) await sql`UPDATE kpi_definitions SET calculation_type = ${changes.calculation_type}, updated_at = now() WHERE id = ${id}`;
  if (changes.owner_actor !== undefined) await sql`UPDATE kpi_definitions SET owner_actor = ${changes.owner_actor}, updated_at = now() WHERE id = ${id}`;
  if (changes.display_order !== undefined) await sql`UPDATE kpi_definitions SET display_order = ${changes.display_order}, updated_at = now() WHERE id = ${id}`;
  if (changes.current_target_value !== undefined) await sql`UPDATE kpi_definitions SET current_target_value = ${changes.current_target_value}, updated_at = now() WHERE id = ${id}`;
  if (changes.current_warning_threshold !== undefined) await sql`UPDATE kpi_definitions SET current_warning_threshold = ${changes.current_warning_threshold}, updated_at = now() WHERE id = ${id}`;
  if (changes.is_active !== undefined) await sql`UPDATE kpi_definitions SET is_active = ${changes.is_active}, updated_at = now() WHERE id = ${id}`;

  const rows = await sql`SELECT * FROM kpi_definitions WHERE id = ${id} LIMIT 1`;
  await auditLog(sql, actor, 'kpi_definition_update', `id=${id} name=${JSON.stringify(existing.name)}; ${changeDetails.join('; ')}`);
  return json(200, { ok: true, definition: rows[0] });
}

exports.handler = async (event) => {
  const session = requireAdmin(event);
  if (!session) return json(401, { error: 'Unauthorized' }, { 'Cache-Control': 'no-store, private' });

  const cs = connectionString();
  if (!cs) return json(500, { error: 'Server not configured' });
  const sql = neon(cs);

  try {
    await ensureAnalyticsSchema(sql); // owns analytics_audit_log
    await ensureSchema(sql);

    if (event.httpMethod === 'GET') return await handleGet(sql, event.queryStringParameters);
    if (event.httpMethod === 'POST') return await handlePost(sql, readJsonBody(event) || {}, session.sub);
    if (event.httpMethod === 'PATCH') return await handlePatch(sql, readJsonBody(event) || {}, session.sub);

    return json(405, { error: 'Method not allowed' }, { Allow: 'GET, POST, PATCH' });
  } catch (err) {
    console.error('[kpi-definitions] error:', err?.message ?? err);
    return json(500, { ok: false, error: 'Server error' });
  }
};
