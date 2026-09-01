'use strict';

/*
 * Section J Phase 3, item 5 -- scheduled Search Console import (daily,
 * see netlify.toml). Does nothing at all unless search_console_enabled
 * is explicitly true in analytics_settings AND the three GSC_* env vars
 * are set -- both gates checked before any Google API call is made.
 *
 * Rolling lookback window (search_console_lookback_days, default 16),
 * re-fetched and UPSERTED by the full natural key (date, query, page,
 * device) on every run -- never append-only, because Search Console's
 * own performance data arrives late and gets corrected after the fact.
 *
 * Reporting timezone: Search Console's Search Analytics API reports
 * dates in Pacific Time (America/Los_Angeles) by Google's own documented
 * behavior, not UTC and not Cairo time -- stored here exactly as GSC
 * returns them (a plain date, no time-of-day), and the dashboard states
 * this explicitly rather than silently implying they're Cairo-local
 * dates like everything else in this pipeline.
 *
 * Retains attempt_count, last successful run, source date range, and
 * error details per run in search_console_import_runs, per spec.
 */

const { neon } = require('@neondatabase/serverless');
const { ensureSchema } = require('./_analytics_lib');
const { configured, fetchSearchAnalytics, MAX_ROWS_PER_REQUEST } = require('./_gsc_lib');

function connectionString() {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_URL_UNPOOLED ||
    ''
  );
}

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

async function upsertRows(sql, rows) {
  let count = 0;
  for (const r of rows) {
    // keys[] order matches the dimensions requested in _gsc_lib.js:
    // [date, query, page, device].
    const [date, query, page, device] = r.keys || [];
    if (!date || !page || !device) continue;
    await sql`
      INSERT INTO search_console_performance (date, query, page, device, clicks, impressions, ctr, position)
      VALUES (${date}, ${query || ''}, ${page}, ${device}, ${Math.round(r.clicks || 0)}, ${Math.round(r.impressions || 0)}, ${r.ctr || 0}, ${r.position || 0})
      ON CONFLICT (date, query, page, device) DO UPDATE SET
        clicks = EXCLUDED.clicks, impressions = EXCLUDED.impressions,
        ctr = EXCLUDED.ctr, position = EXCLUDED.position, updated_at = now()
    `;
    count += 1;
  }
  return count;
}

exports.handler = async () => {
  const cs = connectionString();
  if (!cs) return { statusCode: 200, body: 'skipped: no DATABASE_URL' };
  const sql = neon(cs);

  await ensureSchema(sql);

  const settingRows = await sql`SELECT key, value FROM analytics_settings WHERE key IN ('search_console_enabled', 'search_console_lookback_days')`;
  const settings = {};
  settingRows.forEach((r) => { settings[r.key] = r.value; });

  // Defensive on the exact JS type jsonb comes back as (should already
  // be a real boolean, but a strict === true check with no fallback
  // would fail closed in a way that's hard to notice -- and "fail
  // closed" here specifically means "don't touch the real GSC
  // property," so this stays conservative on purpose either way.
  const enabled = settings.search_console_enabled === true || settings.search_console_enabled === 'true';
  if (!enabled) {
    console.log('[search-console-import] search_console_enabled is false -- skipping, nothing touched.');
    return { statusCode: 200, body: 'skipped: not enabled' };
  }
  if (!configured()) {
    console.warn('[search-console-import] enabled but GSC_* env vars are missing -- skipping.');
    return { statusCode: 200, body: 'skipped: not configured' };
  }

  const lookbackDays = Number(settings.search_console_lookback_days) || 16;
  const endAt = new Date();
  const startAt = new Date(endAt.getTime() - lookbackDays * 24 * 60 * 60 * 1000);
  const startDate = isoDate(startAt);
  const endDate = isoDate(endAt);

  const [runRow] = await sql`
    INSERT INTO search_console_import_runs (source_start_date, source_end_date)
    VALUES (${startDate}, ${endDate})
    RETURNING id
  `;
  const runId = runRow.id;

  try {
    let startRow = 0;
    let totalUpserted = 0;
    // Paginate defensively -- stop once a page comes back short of a
    // full page, or after a sane cap of pages so a misbehaving response
    // can never turn this into an unbounded loop against Google's API.
    for (let page = 0; page < 20; page++) {
      const rows = await fetchSearchAnalytics({ startDate, endDate, startRow });
      if (!rows.length) break;
      totalUpserted += await upsertRows(sql, rows);
      if (rows.length < MAX_ROWS_PER_REQUEST) break;
      startRow += rows.length;
    }

    await sql`
      UPDATE search_console_import_runs
      SET status = 'success', finished_at = now(), rows_upserted = ${totalUpserted}
      WHERE id = ${runId}
    `;
    console.log(`[search-console-import] imported ${totalUpserted} row(s) for ${startDate}..${endDate}`);
    return { statusCode: 200, body: `imported ${totalUpserted} rows` };
  } catch (err) {
    const message = (err && err.message) || String(err);
    await sql`
      UPDATE search_console_import_runs
      SET status = 'error', finished_at = now(), error_details = ${message.slice(0, 2000)}
      WHERE id = ${runId}
    `;
    console.error('[search-console-import] error:', message);
    return { statusCode: 200, body: 'error, recorded in search_console_import_runs' };
  }
};
