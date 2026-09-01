'use strict';

/*
 * Section J Phase 3 -- scheduled data-retention purge. Runs daily
 * (netlify.toml: @daily), deleting analytics_sessions/analytics_events
 * rows older than the configured data_retention_days setting (default
 * 395 days / ~13 months, the spec's own suggested figure, explicitly
 * pending real legal review -- see docs/j3-acceptance-criteria.md).
 *
 * This is a genuine purge (not a soft-flag) -- the spec's privacy
 * section asks for data to be "purged or fully anonymized" once past
 * the retention window, distinct from the bot/internal "flag, never
 * delete" stance elsewhere in this pipeline, which is about traffic
 * *classification*, not the separate question of how long any of this
 * data is kept at all.
 *
 * ip_org_cache rows already carry their own shorter TTL (30 days,
 * unrelated to session/event retention -- see _b2b_lib.js) and are
 * cleaned up here too, opportunistically.
 */

const { neon } = require('@neondatabase/serverless');
const { ensureSchema } = require('./_analytics_lib');

function connectionString() {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_URL_UNPOOLED ||
    ''
  );
}

exports.handler = async () => {
  const cs = connectionString();
  if (!cs) {
    console.warn('[analytics-retention] Server not configured -- skipping this run.');
    return { statusCode: 200, body: 'skipped: no DATABASE_URL' };
  }
  const sql = neon(cs);

  try {
    await ensureSchema(sql);

    const rows = await sql`SELECT value FROM analytics_settings WHERE key = 'data_retention_days'`;
    const days = rows[0] ? Number(rows[0].value) : 395;
    if (!Number.isFinite(days) || days < 1) {
      console.warn('[analytics-retention] invalid data_retention_days, skipping');
      return { statusCode: 200, body: 'skipped: invalid retention setting' };
    }

    const cutoff = `now() - ($1::numeric * interval '1 day')`;

    const deletedEvents = await sql.query(`DELETE FROM analytics_events WHERE occurred_at < ${cutoff} RETURNING id`, [days]);
    const deletedSessions = await sql.query(`DELETE FROM analytics_sessions WHERE started_at < ${cutoff} RETURNING session_id`, [days]);
    const deletedCache = await sql`DELETE FROM ip_org_cache WHERE expires_at < now() RETURNING ip_hash`;

    const summary = `purged ${deletedEvents.length} event(s), ${deletedSessions.length} session(s) older than ${days} days; ${deletedCache.length} expired org-cache row(s)`;
    console.log('[analytics-retention]', summary);
    return { statusCode: 200, body: summary };
  } catch (err) {
    console.error('[analytics-retention] error:', err?.message ?? err);
    return { statusCode: 500, body: 'error, see function logs' };
  }
};
