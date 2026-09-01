'use strict';

const { neon } = require('@neondatabase/serverless');
const { requireCrmSession, json } = require('./_crm_lib');

// Converted = ever reached one of these stages. See docs/h-crm-schema.md
// for the full conversion-rate definition this implements: based on
// unique buyer records (not stage transitions, not a current-snapshot),
// counting a buyer once regardless of how many times it moved backward
// or was reopened, with Lost/Stalled buyers kept in the denominator
// (not excluded) so the rate isn't survivorship-biased.
const CONVERTED_STAGES = ['Contract Signed', 'Shipment Prepared', 'Exported/Completed'];

function connectionString() {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_URL_UNPOOLED ||
    ''
  );
}

exports.handler = async (event) => {
  const session = requireCrmSession(event);
  if (!session) {
    return json(401, { ok: false, error: 'Unauthorized' }, { 'Cache-Control': 'no-store, private' });
  }
  if (event.httpMethod !== 'GET') {
    return json(405, { ok: false, error: 'Method not allowed' }, { Allow: 'GET' });
  }

  const cs = connectionString();
  if (!cs) return json(500, { ok: false, error: 'Server not configured' });
  const sql = neon(cs);

  const qs = event.queryStringParameters || {};
  const days = Math.min(Math.max(parseInt(qs.days, 10) || 365000, 1), 365000); // effectively "all time" by default

  try {
    const byStage = await sql`
      SELECT current_stage AS stage, count(*)::int AS count
      FROM buyers WHERE deleted_at IS NULL
      GROUP BY current_stage
    `;

    const byRegion = await sql`
      SELECT country_region AS region, count(*)::int AS count
      FROM buyers WHERE deleted_at IS NULL
      GROUP BY country_region
    `;

    const overdue = await sql`
      SELECT id, company_name, next_action, next_action_due, assigned_to
      FROM buyers
      WHERE deleted_at IS NULL AND next_action_due IS NOT NULL AND next_action_due < CURRENT_DATE
        AND current_stage NOT IN ('Lost/Stalled', 'Exported/Completed')
      ORDER BY next_action_due ASC
      LIMIT 200
    `;

    const upcoming = await sql`
      SELECT id, company_name, next_action, next_action_due, assigned_to
      FROM buyers
      WHERE deleted_at IS NULL AND next_action_due IS NOT NULL
        AND next_action_due >= CURRENT_DATE AND next_action_due <= CURRENT_DATE + 7
        AND current_stage NOT IN ('Lost/Stalled', 'Exported/Completed')
      ORDER BY next_action_due ASC
      LIMIT 200
    `;

    const stalled = await sql`
      SELECT id, company_name, current_stage, updated_at, assigned_to
      FROM buyers
      WHERE deleted_at IS NULL
        AND (
          current_stage = 'Lost/Stalled'
          OR (current_stage NOT IN ('Lost/Stalled', 'Exported/Completed') AND updated_at < now() - interval '14 days')
        )
      ORDER BY updated_at ASC
      LIMIT 200
    `;

    const totalRows = await sql`
      SELECT count(*)::int AS n FROM buyers
      WHERE deleted_at IS NULL AND created_at >= now() - (${days} || ' days')::interval
    `;
    const convertedRows = await sql`
      SELECT count(DISTINCT b.id)::int AS n
      FROM buyers b
      JOIN buyer_stage_history h ON h.buyer_id = b.id
      WHERE b.deleted_at IS NULL
        AND b.created_at >= now() - (${days} || ' days')::interval
        AND h.to_stage = ANY(${CONVERTED_STAGES})
    `;
    const total = totalRows[0].n;
    const converted = convertedRows[0].n;
    const conversionRate = total > 0 ? converted / total : null;

    const avgTimePerStage = await sql`
      SELECT to_stage AS stage, avg(EXTRACT(EPOCH FROM (next_changed_at - changed_at)) / 86400)::numeric(10,1) AS avg_days
      FROM (
        SELECT buyer_id, to_stage, changed_at,
               LEAD(changed_at) OVER (PARTITION BY buyer_id ORDER BY changed_at) AS next_changed_at
        FROM buyer_stage_history
      ) t
      WHERE next_changed_at IS NOT NULL
      GROUP BY to_stage
    `;

    return json(200, {
      by_stage: byStage,
      by_region: byRegion,
      overdue_followups: overdue,
      upcoming_followups: upcoming,
      stalled_leads: stalled,
      conversion_rate: {
        definition: 'unique buyers created in period that ever reached Contract Signed, Shipment Prepared, or Exported/Completed; Lost/Stalled buyers remain in the denominator',
        period_days: days,
        converted,
        total,
        rate: conversionRate,
      },
      avg_time_per_stage_days: avgTimePerStage,
    }, { 'Cache-Control': 'no-store, private' });
  } catch (err) {
    console.error('[crm-dashboard] error:', err?.message ?? err);
    return json(500, { ok: false, error: 'Server error' });
  }
};
