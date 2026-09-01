'use strict';

/*
 * Section J Phase 1 -- admin-only reporting over the site's own custom
 * event pipeline (analytics_sessions / analytics_events). Read-only.
 * Gated behind the same tc_session admin cookie as /api/analytics,
 * /api/inquiries, and /api/consent -- no new auth system.
 *
 * All storage is UTC (timestamptz); display-layer conversion to
 * Africa/Cairo happens in the dashboard, not here -- this endpoint
 * returns ISO-8601 UTC strings and lets the client convert.
 */

const { neon } = require('@neondatabase/serverless');
const { parseCookies, verifySession, COOKIE_NAME, json } = require('./_lib');
const { ensureSchema, auditLog } = require('./_analytics_lib');
const { CLASSIFICATION_DISCLOSURE, ensureSchema: ensureB2bSchema } = require('./_b2b_lib');

function connectionString() {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_URL_UNPOOLED ||
    ''
  );
}

const RANGES = { '7d': 7, '30d': 30, '90d': 90 };

function requireAdmin(event) {
  const SESSION_SECRET = process.env.SESSION_SECRET;
  const token = SESSION_SECRET ? parseCookies(event.headers)[COOKIE_NAME] : null;
  return token ? verifySession(token, SESSION_SECRET) : null;
}

function isoUtc(col) {
  return `to_char(${col} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;
}

async function getThreshold(sql) {
  const rows = await sql`SELECT value FROM analytics_settings WHERE key = 'bot_confidence_threshold'`;
  const v = rows[0] && Number(rows[0].value);
  return Number.isFinite(v) ? v : 70;
}

// A session counts as bot-suppressed for KPI purposes if a human hasn't
// overridden it to false, and either an admin has confirmed it (override
// true) or its computed confidence meets the threshold.
function botSuppressedSql(threshold) {
  return `(bot_override IS TRUE OR (bot_override IS NULL AND bot_confidence IS NOT NULL AND bot_confidence >= ${threshold}))`;
}

async function getFunnelDefinitions(sql) {
  const rows = await sql`SELECT value FROM analytics_settings WHERE key = 'funnel_definitions'`;
  const defs = rows[0] && rows[0].value;
  return Array.isArray(defs) ? defs : [];
}

// Multi-path funnels (Phase 3 item 8): the stage list is no longer
// hardcoded -- it comes from a named definition in analytics_settings
// (see _analytics_lib.js's seeded defaults), so different genuinely
// different conversion paths can be selected, not just one fixed path
// with a source/country filter bolted on.
async function reportFunnel(sql, { startAt, endAt, source, country, funnelId }) {
  const threshold = await getThreshold(sql);
  const suppressed = botSuppressedSql(threshold);

  const definitions = await getFunnelDefinitions(sql);
  const definition = definitions.find((d) => d.id === funnelId) || definitions[0];
  if (!definition || !Array.isArray(definition.stages) || !definition.stages.length) {
    return { stages: [], filter: { source: source || null, country: country || null }, funnel_id: null, funnel_name: null, note: 'No funnel definition configured.' };
  }

  const params = [startAt, endAt, source || null, country || null];
  const stageClauses = definition.stages.map((stage) => {
    const eventTypes = String(stage.event_type || '').split(',').map((s) => s.trim()).filter(Boolean);
    params.push(eventTypes);
    const typeParamIdx = params.length;
    let clause = `e.event_type = ANY($${typeParamIdx}::text[])`;
    if (stage.source_page_prefix) {
      params.push(stage.source_page_prefix + '%');
      clause += ` AND e.source_page LIKE $${params.length}`;
    }
    return `bool_or(${clause})`;
  });

  const rows = await sql.query(
    `
    WITH scoped_sessions AS (
      SELECT s.session_id, s.attribution_source
      FROM analytics_sessions s
      WHERE s.started_at >= $1 AND s.started_at < $2
        AND s.is_internal = false
        AND NOT ${suppressed}
        AND ($3::text IS NULL OR s.attribution_source = $3)
        AND ($4::text IS NULL OR s.country = $4)
    ),
    stages AS (
      SELECT
        ss.session_id,
        ${stageClauses.map((c, i) => `${c} AS reached_${i}`).join(',\n        ')}
      FROM scoped_sessions ss
      JOIN analytics_events e ON e.session_id = ss.session_id
      GROUP BY ss.session_id
    )
    SELECT
      ${definition.stages.map((s, i) => `count(*) FILTER (WHERE reached_${i}) AS stage_${i}`).join(',\n      ')}
    FROM stages
    `,
    params,
  );

  const r = rows[0] || {};
  return {
    stages: definition.stages.map((s, i) => ({ stage: s.label, count: Number(r['stage_' + i]) || 0 })),
    filter: { source: source || null, country: country || null },
    funnel_id: definition.id,
    funnel_name: definition.name,
    available_funnels: definitions.map((d) => ({ id: d.id, name: d.name })),
    note: 'Country is resolved from a self-hosted, country-level-only GeoLite2 database (no city data -- see docs/j2-acceptance-criteria.md) and is null for sessions from before Phase 2 shipped or where resolution failed. Excludes sessions flagged internal or bot-suppressed at the current threshold -- see bot settings.',
  };
}

async function reportHotLeads(sql, { startAt, endAt }) {
  const threshold = await getThreshold(sql);
  const suppressed = botSuppressedSql(threshold);

  // Hot-lead definition (documented here and in the dashboard, not left
  // implicit): a session containing at least one specification_download
  // AND at least one of {whatsapp_click, email_click, contact_form_submit}.
  const rows = await sql.query(
    `
    WITH scoped_sessions AS (
      SELECT s.session_id, s.visitor_id, s.started_at, s.entry_page, s.attribution_source, s.org_name, s.org_resolution_type
      FROM analytics_sessions s
      WHERE s.started_at >= $1 AND s.started_at < $2
        AND s.is_internal = false
        AND NOT ${suppressed}
    ),
    flagged AS (
      SELECT
        ss.session_id, ss.visitor_id, ss.started_at, ss.entry_page, ss.attribution_source, ss.org_name, ss.org_resolution_type,
        bool_or(e.event_type = 'specification_download') AS had_download,
        bool_or(e.event_type IN ('whatsapp_click', 'email_click', 'contact_form_submit')) AS had_contact
      FROM scoped_sessions ss
      JOIN analytics_events e ON e.session_id = ss.session_id
      GROUP BY ss.session_id, ss.visitor_id, ss.started_at, ss.entry_page, ss.attribution_source, ss.org_name, ss.org_resolution_type
    )
    SELECT session_id, visitor_id, ${isoUtc('started_at')} AS started_at, entry_page, attribution_source, org_name, org_resolution_type
    FROM flagged
    WHERE had_download AND had_contact
    ORDER BY started_at DESC
    LIMIT 200
    `,
    [startAt, endAt],
  );

  return {
    definition: 'A session with at least one spec-sheet download AND at least one contact action (WhatsApp click, email click, or contact form submit).',
    rows,
    org_disclosure: CLASSIFICATION_DISCLOSURE,
  };
}

async function reportAttribution(sql, { startAt, endAt, model }) {
  const threshold = await getThreshold(sql);
  const suppressed = botSuppressedSql(threshold);

  if (model === 'last_touch') {
    const rows = await sql.query(
      `
      SELECT s.attribution_source AS source, count(DISTINCT e.session_id)::int AS conversions
      FROM analytics_sessions s
      JOIN analytics_events e ON e.session_id = s.session_id AND e.event_type = 'contact_form_submit'
      WHERE s.started_at >= $1 AND s.started_at < $2 AND s.is_internal = false AND NOT ${suppressed}
      GROUP BY s.attribution_source
      ORDER BY conversions DESC
      `,
      [startAt, endAt],
    );
    return { model: 'last_touch', rows, note: 'Attributes each conversion to the session it happened in.' };
  }

  // first_touch (primary, per spec): attribute each converting visitor's
  // conversion to THAT VISITOR's earliest-ever session's source, not the
  // source of the session the conversion actually happened in.
  const rows = await sql.query(
    `
    WITH first_sessions AS (
      SELECT DISTINCT ON (visitor_id) visitor_id, attribution_source
      FROM analytics_sessions
      WHERE is_internal = false AND NOT ${suppressed}
      ORDER BY visitor_id, started_at ASC
    ),
    converters AS (
      SELECT DISTINCT s.visitor_id
      FROM analytics_sessions s
      JOIN analytics_events e ON e.session_id = s.session_id AND e.event_type = 'contact_form_submit'
      WHERE s.started_at >= $1 AND s.started_at < $2 AND s.is_internal = false AND NOT ${suppressed}
    )
    SELECT fs.attribution_source AS source, count(*)::int AS conversions
    FROM converters c
    JOIN first_sessions fs ON fs.visitor_id = c.visitor_id
    GROUP BY fs.attribution_source
    ORDER BY conversions DESC
    `,
    [startAt, endAt],
  );
  return {
    model: 'first_touch',
    rows,
    note: '"First touch" means the first observed visit for the same browser/device identifier while that identifier remains available -- NOT literally the first-ever visit. Clearing storage, private browsing, a different device, browser anti-tracking, or withdrawing consent can and will create a separate history for what is really the same visitor. Consent withdrawal stops attributing that visitor going forward; it does not retroactively alter historical aggregate reports already computed.',
  };
}

async function reportBotReview(sql) {
  const threshold = await getThreshold(sql);
  const rows = await sql.query(
    `
    SELECT session_id, visitor_id, ${isoUtc('started_at')} AS started_at, entry_page,
           attribution_source, bot_confidence, bot_reason_codes, bot_detection_version, bot_override
    FROM analytics_sessions
    WHERE bot_confidence IS NOT NULL
      AND bot_confidence BETWEEN $1 AND $2
      AND bot_override IS NULL
    ORDER BY started_at DESC
    LIMIT 100
    `,
    [Math.max(0, threshold - 15), Math.min(100, threshold + 15)],
  );
  return { threshold, rows };
}

async function reportDemographics(sql, { startAt, endAt }) {
  const threshold = await getThreshold(sql);
  const suppressed = botSuppressedSql(threshold);

  const scope = `
    FROM analytics_sessions
    WHERE started_at >= $1 AND started_at < $2 AND is_internal = false AND NOT ${suppressed}
  `;

  const [countryRows, deviceRows, browserRows, languageRows] = await Promise.all([
    sql.query(`SELECT country AS x, count(*)::int AS y ${scope} AND country IS NOT NULL GROUP BY country ORDER BY y DESC LIMIT 20`, [startAt, endAt]),
    sql.query(`SELECT device_type AS x, count(*)::int AS y ${scope} AND device_type IS NOT NULL GROUP BY device_type ORDER BY y DESC LIMIT 20`, [startAt, endAt]),
    sql.query(`SELECT browser AS x, count(*)::int AS y ${scope} AND browser IS NOT NULL GROUP BY browser ORDER BY y DESC LIMIT 20`, [startAt, endAt]),
    sql.query(`SELECT browser_language AS x, count(*)::int AS y ${scope} AND browser_language IS NOT NULL GROUP BY browser_language ORDER BY y DESC LIMIT 20`, [startAt, endAt]),
  ]);

  const [unresolved] = await sql.query(`SELECT count(*)::int AS n ${scope} AND country IS NULL`, [startAt, endAt]);

  return {
    countries: countryRows,
    devices: deviceRows,
    browsers: browserRows,
    languages: languageRows,
    unresolved_country_sessions: unresolved ? unresolved.n : 0,
    note: 'Country is resolved from a self-hosted, country-level-only GeoLite2 database at session start -- no city/region data (Netlify Functions\' 50MB bundle limit ruled that out; see docs/j2-acceptance-criteria.md). A session with an unresolved country (bad/missing IP, or the geo database wasn\'t available at build time) is counted separately below, not silently dropped from the total.',
  };
}

// Live-visitor feed (Phase 3 item 7). "Active" is precisely: a session
// whose last_seen_at (already updated on every event and every
// engagement signal) falls within a configurable interval --
// live_feed_active_minutes in analytics_settings, no separate heartbeat
// mechanism needed since every event already refreshes last_seen_at.
// "Expire" means drop out of this view once the interval passes, not
// delete -- same "flag/filter, never remove" stance as everywhere else.
//
// Deliberately excludes anything sensitive: no raw IP (never stored
// anywhere in this pipeline to begin with), no full referrer URL with
// query params (only referrer_domain is ever stored), no contact-form
// contents or free-text event payloads (this pipeline never stores
// those fields at all -- see the fixed EVENT_TYPES/target_id shape in
// _analytics_lib.js). Every access is written to analytics_audit_log by
// the caller, not by this function -- see the handler below.
async function reportLiveFeed(sql) {
  const rows = await sql`
    SELECT key, value FROM analytics_settings WHERE key = 'live_feed_active_minutes'
  `;
  const minutes = rows[0] ? Number(rows[0].value) : 5;

  const sessions = await sql.query(
    `
    SELECT
      s.session_id, s.entry_page, s.attribution_source, s.country, s.device_type, s.browser,
      s.org_name, s.org_resolution_type, s.is_internal, s.bot_confidence, s.bot_override,
      ${isoUtc('s.started_at')} AS started_at, ${isoUtc('s.last_seen_at')} AS last_seen_at,
      (SELECT e.event_type FROM analytics_events e WHERE e.session_id = s.session_id ORDER BY e.occurred_at DESC LIMIT 1) AS last_event_type
    FROM analytics_sessions s
    WHERE s.last_seen_at >= now() - ($1::numeric * interval '1 minute')
    ORDER BY s.last_seen_at DESC
    LIMIT 100
    `,
    [minutes],
  );

  return {
    active_within_minutes: minutes,
    sessions,
    org_disclosure: CLASSIFICATION_DISCLOSURE,
    note: 'Never shows raw IP addresses, full referrer URLs, contact-form contents, or any free-text event payload -- this pipeline does not store those fields at all. Every load of this view is written to the audit log.',
  };
}

async function reportSearchConsole(sql, { startAt, endAt }) {
  const settingRows = await sql`SELECT key, value FROM analytics_settings WHERE key IN ('search_console_enabled', 'search_console_lookback_days')`;
  const settings = {};
  settingRows.forEach((r) => { settings[r.key] = r.value; });
  const enabled = settings.search_console_enabled === true || settings.search_console_enabled === 'true';

  const runs = await sql`
    SELECT ${isoUtc('started_at')} AS started_at, ${isoUtc('finished_at')} AS finished_at,
           status, attempt_count, source_start_date, source_end_date, rows_upserted, error_details
    FROM search_console_import_runs
    ORDER BY started_at DESC
    LIMIT 20
  `;

  const topQueries = await sql.query(
    `
    SELECT query, sum(clicks)::int AS clicks, sum(impressions)::int AS impressions,
           CASE WHEN sum(impressions) > 0 THEN round((sum(clicks)::numeric / sum(impressions)) * 100, 1) ELSE 0 END AS ctr,
           round(avg(position), 1) AS avg_position
    FROM search_console_performance
    WHERE date >= $1 AND date < $2 AND query <> ''
    GROUP BY query
    ORDER BY clicks DESC
    LIMIT 25
    `,
    [startAt.toISOString().slice(0, 10), endAt.toISOString().slice(0, 10)],
  );

  return {
    enabled,
    lookback_days: settings.search_console_lookback_days || 16,
    runs,
    top_queries: topQueries,
    timezone_note: "Dates come from Search Console's Search Analytics API in its own reporting timezone (Pacific Time, per Google's documented behavior) -- not UTC and not the Africa/Cairo display convention used everywhere else in this dashboard.",
    note: enabled
      ? 'Search Console import is enabled and runs daily on a rolling lookback window, upserted by the complete (date, query, page, device) key so late corrections are captured, never appended as duplicates.'
      : 'Search Console import is disabled. Nothing has been fetched from your Search Console property, and nothing will be, until you enable it here after completing the setup in the README.',
  };
}

async function reportOverview(sql, { startAt, endAt }) {
  const threshold = await getThreshold(sql);
  const suppressed = botSuppressedSql(threshold);

  const [totals] = await sql.query(
    `
    SELECT
      count(*)::int AS total_sessions,
      count(*) FILTER (WHERE is_internal)::int AS internal_sessions,
      count(*) FILTER (WHERE bot_confidence IS NULL)::int AS unknown_bot_sessions,
      count(*) FILTER (WHERE ${suppressed})::int AS bot_suppressed_sessions
    FROM analytics_sessions
    WHERE started_at >= $1 AND started_at < $2
    `,
    [startAt, endAt],
  );

  const errorRows = await sql`
    SELECT count(*)::int AS n FROM analytics_ingest_errors WHERE occurred_at >= now() - interval '7 days'
  `;

  const sourceRows = await sql.query(
    `
    SELECT DISTINCT attribution_source AS source
    FROM analytics_sessions
    WHERE started_at >= $1 AND started_at < $2 AND is_internal = false
    ORDER BY attribution_source
    LIMIT 100
    `,
    [startAt, endAt],
  );

  const countryRows = await sql.query(
    `
    SELECT DISTINCT country
    FROM analytics_sessions
    WHERE started_at >= $1 AND started_at < $2 AND is_internal = false AND country IS NOT NULL
    ORDER BY country
    LIMIT 100
    `,
    [startAt, endAt],
  );

  return {
    ...totals,
    sources: sourceRows.map((r) => r.source),
    countries: countryRows.map((r) => r.country),
    ingest_errors_7d: errorRows[0] ? errorRows[0].n : 0,
    bot_confidence_threshold: threshold,
    timezone_note: 'All timestamps stored and returned in UTC. This dashboard displays them converted to Africa/Cairo by default.',
    known_limitation: 'Ingest-error counts only capture failures this server actually received and then failed to store (e.g. a database error). A request that never reaches this endpoint at all -- blocked before send, a network failure -- is invisible to any server-side count.',
  };
}

exports.handler = async (event) => {
  const session = requireAdmin(event);
  if (!session) {
    return json(401, { error: 'Unauthorized' }, { 'Cache-Control': 'no-store, private' });
  }
  if (event.httpMethod !== 'GET') {
    return json(405, { error: 'Method not allowed' }, { Allow: 'GET' });
  }

  const cs = connectionString();
  if (!cs) return json(500, { error: 'Server not configured' });
  const sql = neon(cs);

  const q = event.queryStringParameters || {};
  const report = typeof q.report === 'string' ? q.report : 'overview';

  let endAt = new Date();
  const range = typeof q.range === 'string' ? q.range : '30d';
  const days = RANGES[range] || RANGES['30d'];
  const startAt = new Date(endAt.getTime() - days * 24 * 60 * 60 * 1000);

  try {
    await ensureSchema(sql);
    await ensureB2bSchema(sql);

    if (report === 'overview') return json(200, await reportOverview(sql, { startAt, endAt }), { 'Cache-Control': 'no-store, private' });
    if (report === 'funnel') return json(200, await reportFunnel(sql, { startAt, endAt, source: q.source || null, country: q.country || null, funnelId: q.funnel_id || null }), { 'Cache-Control': 'no-store, private' });
    if (report === 'hot_leads') return json(200, await reportHotLeads(sql, { startAt, endAt }), { 'Cache-Control': 'no-store, private' });
    if (report === 'attribution') return json(200, await reportAttribution(sql, { startAt, endAt, model: q.model === 'last_touch' ? 'last_touch' : 'first_touch' }), { 'Cache-Control': 'no-store, private' });
    if (report === 'bot_review') return json(200, await reportBotReview(sql), { 'Cache-Control': 'no-store, private' });
    if (report === 'demographics') return json(200, await reportDemographics(sql, { startAt, endAt }), { 'Cache-Control': 'no-store, private' });
    if (report === 'live_feed') {
      // Sensitive-data view -- every access is audit-logged, not just
      // writes, per Rule 22's own reading applied consistently across
      // this whole engagement (see the CRM's crm_audit_log for the same
      // stance).
      await auditLog(sql, session.sub, 'view_live_feed', null);
      return json(200, await reportLiveFeed(sql), { 'Cache-Control': 'no-store, private' });
    }
    if (report === 'search_console') return json(200, await reportSearchConsole(sql, { startAt, endAt }), { 'Cache-Control': 'no-store, private' });

    return json(400, { error: 'Unknown report' });
  } catch (err) {
    console.error('[analytics-report] error:', err?.message ?? err);
    return json(500, { error: 'Report unavailable' });
  }
};
