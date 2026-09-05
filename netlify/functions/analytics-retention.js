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
 *
 * ---- Guards (added 2026-09-05) ----
 *
 * This function deletes data that cannot be recovered, unattended, once
 * a day, driven by a number an admin can type into a form. Before these
 * guards its only check was `days >= 1`, so a mistyped 1 in the admin UI
 * would silently destroy thirteen months of analytics on the next
 * nightly run, with no cap, no dry run, no record, and nothing to notice
 * it by afterwards -- the audit log recorded the *setting change* but
 * nothing recorded the purge that acted on it.
 *
 * Four things stand between a typo and that outcome now:
 *
 *   1. MIN_RETENTION_DAYS -- a floor no setting can go below. The admin
 *      form now refuses to store a value under it and this refuses to act
 *      on one, so a row that predates the floor (or is edited straight in
 *      the database) is declined here rather than obeyed.
 *   2. MAX_DELETES_PER_RUN -- a run deletes at most this many rows per
 *      table. A correct steady-state run removes one day's rows and
 *      never approaches it. Hitting the cap means either a genuine
 *      backlog (the next run continues) or something wrong -- and either
 *      way the damage is bounded to one cap's worth per night.
 *   3. ANALYTICS_RETENTION_DRY_RUN -- counts what it would delete and
 *      deletes nothing. The way to check a policy change before it runs
 *      for real.
 *   4. Every run writes to analytics_audit_log, including the ones that
 *      refuse. Function logs rotate; this does not.
 */

const { neon } = require('@neondatabase/serverless');
const { ensureSchema, auditLog, MIN_RETENTION_DAYS } = require('./_analytics_lib');

const DEFAULT_RETENTION_DAYS = 395;

// MIN_RETENTION_DAYS lives in _analytics_lib.js because the admin form
// validates against the same number -- see the note there. It is not a legal
// figure: it is a floor low enough never to obstruct a real policy (the
// shortest anyone has proposed here is ~13 months) and high enough that no
// plausible typo wipes the useful history.

// Per table, per run. The daily steady state is a single day of rows.
const MAX_DELETES_PER_RUN = 50000;

const ACTOR = 'system:retention';

function connectionString() {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_URL_UNPOOLED ||
    ''
  );
}

function isDryRun() {
  const v = String(process.env.ANALYTICS_RETENTION_DRY_RUN || '').toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

// Recorded and logged the same way whether the run acted or refused, so a
// refusal is visible in the same place someone goes looking for a purge.
async function record(sql, outcome, detail) {
  console.log(`[analytics-retention] ${outcome}: ${detail}`);
  await auditLog(sql, ACTOR, `retention_${outcome}`, detail);
  return { statusCode: 200, body: `${outcome}: ${detail}` };
}

async function readRetentionDays(sql) {
  const rows = await sql`SELECT value FROM analytics_settings WHERE key = 'data_retention_days'`;
  return rows[0] ? Number(rows[0].value) : DEFAULT_RETENTION_DAYS;
}

/*
 * Deleting by primary key from a bounded SELECT rather than issuing a bare
 * DELETE ... WHERE occurred_at < cutoff. The subquery is what makes
 * MAX_DELETES_PER_RUN real: an unbounded DELETE has no way to stop, so a
 * bad cutoff takes the whole table in one statement.
 */
async function purge(sql, table, timeColumn, idColumn, days, limit) {
  // Table and column names are module constants, never request data; the
  // two values that vary are bound parameters.
  const rows = await sql.query(
    `DELETE FROM ${table} WHERE ${idColumn} IN (
       SELECT ${idColumn} FROM ${table}
       WHERE ${timeColumn} < now() - ($1::numeric * interval '1 day')
       ORDER BY ${timeColumn}
       LIMIT $2
     ) RETURNING ${idColumn}`,
    [days, limit]
  );
  return rows.length;
}

async function countOlderThan(sql, table, timeColumn, days) {
  const rows = await sql.query(
    `SELECT count(*)::int AS n FROM ${table}
     WHERE ${timeColumn} < now() - ($1::numeric * interval '1 day')`,
    [days]
  );
  return (rows[0] && rows[0].n) || 0;
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

    const days = await readRetentionDays(sql);

    if (!Number.isFinite(days) || days < 1) {
      return await record(sql, 'refused', `data_retention_days is not a usable number (${JSON.stringify(days)}); nothing deleted`);
    }
    if (days < MIN_RETENTION_DAYS) {
      // Deliberately not clamped up to the floor and run anyway: acting on
      // a setting nobody meant to type is the failure mode, whatever value
      // it is acted on with.
      return await record(
        sql, 'refused',
        `data_retention_days=${days} is below the ${MIN_RETENTION_DAYS}-day floor; nothing deleted. ` +
        `Set a value of at least ${MIN_RETENTION_DAYS} in /admin/analytics, or lower MIN_RETENTION_DAYS in this function if that is genuinely intended.`
      );
    }

    if (isDryRun()) {
      const events = await countOlderThan(sql, 'analytics_events', 'occurred_at', days);
      const sessions = await countOlderThan(sql, 'analytics_sessions', 'started_at', days);
      return await record(
        sql, 'dry-run',
        `would delete ${events} event(s) and ${sessions} session(s) older than ${days} days ` +
        `(cap ${MAX_DELETES_PER_RUN} per table per run); nothing deleted`
      );
    }

    const deletedEvents = await purge(sql, 'analytics_events', 'occurred_at', 'id', days, MAX_DELETES_PER_RUN);
    const deletedSessions = await purge(sql, 'analytics_sessions', 'started_at', 'session_id', days, MAX_DELETES_PER_RUN);
    const deletedCache = await sql`DELETE FROM ip_org_cache WHERE expires_at < now() RETURNING ip_hash`;

    const capped = [];
    if (deletedEvents >= MAX_DELETES_PER_RUN) capped.push('analytics_events');
    if (deletedSessions >= MAX_DELETES_PER_RUN) capped.push('analytics_sessions');

    let detail =
      `purged ${deletedEvents} event(s), ${deletedSessions} session(s) older than ${days} days; ` +
      `${deletedCache.length} expired org-cache row(s)`;
    if (capped.length) {
      // Worth saying out loud: a capped run means rows were left behind on
      // purpose, and the next run picks them up. Silence here would read as
      // "the purge is complete" when it is not.
      detail += `. Hit the ${MAX_DELETES_PER_RUN}-row cap on ${capped.join(' and ')} -- older rows remain and the next run continues.`;
      console.warn(`[analytics-retention] cap reached on ${capped.join(', ')}`);
    }

    return await record(sql, 'purged', detail);
  } catch (err) {
    console.error('[analytics-retention] error:', err?.message ?? err);
    return { statusCode: 500, body: 'error, see function logs' };
  }
};

module.exports.MAX_DELETES_PER_RUN = MAX_DELETES_PER_RUN;
module.exports.DEFAULT_RETENTION_DAYS = DEFAULT_RETENTION_DAYS;
