'use strict';

/*
 * Section J2 -- KPI Manager: aggregated dashboard view. Read-only, same
 * shape convention as crm-dashboard.js (definitions + current value +
 * short trend, joined server-side so the UI does one fetch).
 *
 * What this deliberately does NOT do: copy raw analytics/CRM rows into
 * its response beyond each kpi_values row's own source_record_count --
 * per J2, KPI tables (and by extension this view) store aggregated
 * results and their provenance only.
 */

const { neon } = require('@neondatabase/serverless');
const { parseCookies, verifySession, COOKIE_NAME, json } = require('./_lib');
const { ensureSchema: ensureAnalyticsSchema } = require('./_analytics_lib');
const { ensureSchema } = require('./_kpi_lib');

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

const TREND_PERIODS = 12;

exports.handler = async (event) => {
  const session = requireAdmin(event);
  if (!session) return json(401, { error: 'Unauthorized' }, { 'Cache-Control': 'no-store, private' });
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' }, { Allow: 'GET' });

  const cs = connectionString();
  if (!cs) return json(500, { error: 'Server not configured' });
  const sql = neon(cs);

  try {
    await ensureAnalyticsSchema(sql);
    await ensureSchema(sql);

    const defs = await sql`
      SELECT * FROM kpi_definitions WHERE archived_at IS NULL
      ORDER BY display_order ASC, category ASC, name ASC
    `;

    const kpis = [];
    for (const def of defs) {
      const currentRows = await sql`
        SELECT v.*, p.period_start, p.period_end
        FROM kpi_values v
        JOIN kpi_periods p ON p.id = v.period_id
        WHERE v.kpi_id = ${def.id} AND v.is_current = true
        ORDER BY p.period_end DESC
        LIMIT 1
      `;
      const trendRows = await sql`
        SELECT v.actual_value, v.status, p.period_start, p.period_end
        FROM kpi_values v
        JOIN kpi_periods p ON p.id = v.period_id
        WHERE v.kpi_id = ${def.id} AND v.is_current = true
        ORDER BY p.period_end DESC
        LIMIT ${TREND_PERIODS}
      `;
      kpis.push({
        definition: def,
        current: currentRows[0] || null,
        trend: trendRows.reverse(), // oldest -> newest, ready for a sparkline
      });
    }

    return json(200, { ok: true, kpis });
  } catch (err) {
    console.error('[kpi-dashboard] error:', err?.message ?? err);
    return json(500, { ok: false, error: 'Server error' });
  }
};
