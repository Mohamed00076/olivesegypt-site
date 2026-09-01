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
 */

exports.handler = async () => {
  const hookUrl = process.env.NETLIFY_BUILD_HOOK_URL;
  if (!hookUrl) {
    console.log('[geo-refresh] NETLIFY_BUILD_HOOK_URL not set -- skipping (geo database will only refresh on your next normal deploy).');
    return { statusCode: 200, body: 'skipped: no build hook configured' };
  }

  try {
    const res = await fetch(hookUrl, { method: 'POST' });
    if (!res.ok) {
      console.error('[geo-refresh] build hook returned', res.status);
      return { statusCode: 200, body: `build hook returned ${res.status}` };
    }
    console.log('[geo-refresh] triggered a fresh deploy to refresh the geo database.');
    return { statusCode: 200, body: 'triggered' };
  } catch (err) {
    console.error('[geo-refresh] failed to reach build hook:', err && err.message);
    return { statusCode: 200, body: 'failed, see function logs' };
  }
};
