'use strict';

/*
 * Section J Phase 2 -- "scheduled auto-refresh" for the geo database.
 * scripts/build-geo.js only re-fetches GeoLite2-Country at *build* time,
 * and this site has no other recurring build trigger -- so this
 * scheduled function's only job is to POST to a Netlify Build Hook on a
 * cron schedule, which starts a fresh deploy (re-running build-geo.js
 * and picking up whatever the mirror has published since).
 *
 * Requires NETLIFY_BUILD_HOOK_URL to be set (Site settings -> Build &
 * deploy -> Build hooks -> Add build hook, in Netlify's own UI -- not
 * something settable from this codebase). Entirely optional: if it's
 * unset, this just logs and no-ops. Nothing about the site depends on
 * this running -- the geo database simply stays as fresh as the last
 * successful deploy either way.
 *
 * Schedule is declared in netlify.toml (CommonJS functions use the
 * declarative [functions."geo-refresh"] schedule = "..." form, not an
 * exported config object).
 *
 * Security note (found during audit): this function's URL is reachable
 * directly (no auth) -- Netlify scheduled functions are, unless the
 * handler itself checks something. Undirected, that means anyone who
 * finds `/.netlify/functions/geo-refresh` could trigger a full site
 * rebuild on demand, repeatedly -- a real (if minor) resource/cost-abuse
 * vector, not a data-exposure one. Rather than rely on an unverified
 * Netlify-internal signal to tell a real cron firing apart from a
 * direct call (this session has no way to confirm one exists), this
 * adds its own DB-backed cooldown: the build hook only actually fires
 * if the last successful trigger was more than MIN_INTERVAL_HOURS ago,
 * tracked in the same analytics_settings table everything else in this
 * pipeline already uses. A flood of direct hits degrades to "the same
 * cron schedule this was already going to run on," not "as many
 * rebuilds as someone wants."
 */

const { neon } = require('@neondatabase/serverless');
const { ensureSchema } = require('./_analytics_lib');

const MIN_INTERVAL_HOURS = 20; // schedule is weekly; this just needs to be short of that

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
  const hookUrl = process.env.NETLIFY_BUILD_HOOK_URL;
  if (!hookUrl) {
    console.log('[geo-refresh] NETLIFY_BUILD_HOOK_URL not set -- skipping (geo database will only refresh on your next normal deploy).');
    return { statusCode: 200, body: 'skipped: no build hook configured' };
  }

  const cs = connectionString();
  if (!cs) {
    console.warn('[geo-refresh] Server not configured (no DATABASE_URL) -- cannot check the cooldown, skipping to be safe.');
    return { statusCode: 200, body: 'skipped: no DATABASE_URL for cooldown check' };
  }
  const sql = neon(cs);

  try {
    await ensureSchema(sql);

    const rows = await sql`SELECT value FROM analytics_settings WHERE key = 'geo_refresh_last_triggered_at'`;
    const last = rows[0] ? new Date(JSON.parse(rows[0].value)) : null;
    if (last && Date.now() - last.getTime() < MIN_INTERVAL_HOURS * 3600 * 1000) {
      console.log('[geo-refresh] cooldown active (last triggered', last.toISOString(), ') -- skipping this invocation.');
      return { statusCode: 200, body: 'skipped: cooldown active' };
    }

    const res = await fetch(hookUrl, { method: 'POST' });
    if (!res.ok) {
      console.error('[geo-refresh] build hook returned', res.status);
      return { statusCode: 200, body: `build hook returned ${res.status}` };
    }

    await sql`
      INSERT INTO analytics_settings (key, value, updated_at)
      VALUES ('geo_refresh_last_triggered_at', ${JSON.stringify(new Date().toISOString())}::jsonb, now())
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
    `;

    console.log('[geo-refresh] triggered a fresh deploy to refresh the geo database.');
    return { statusCode: 200, body: 'triggered' };
  } catch (err) {
    console.error('[geo-refresh] failed:', err && err.message);
    return { statusCode: 200, body: 'failed, see function logs' };
  }
};
