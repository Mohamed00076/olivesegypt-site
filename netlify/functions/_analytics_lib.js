'use strict';

/*
 * Section J Phase 1 -- shared schema, attribution, and bot-scoring helpers
 * for the site's own custom event pipeline. This is deliberately separate
 * from Umami: Umami stays untouched as the pageview/session stats source
 * (read via netlify/functions/analytics.js), while everything Umami's
 * schema has no room for -- bot confidence scoring with reason codes,
 * hot-lead flags, funnels, a live-feed audit log -- lives here, in this
 * repo's own Neon Postgres, per the architecture decision confirmed for
 * Section J Phase 1.
 *
 * Bot-detection scoring rules intentionally live ONLY in this file, never
 * shipped to the browser and never echoed back in an API response --
 * per spec: "Do not expose the detailed detection rules publicly."
 */

const { isbot } = require('isbot');

const BOT_DETECTION_VERSION = 'v1';

const EVENT_TYPES = new Set([
  'pageview',
  'whatsapp_click',
  'email_click',
  'specification_download',
  'contact_form_submit',
]);

// Not a funnel/event row -- a sendBeacon-delivered update to an existing
// session's behavioral bot signals, fired at page-exit (see assets/
// analytics.js). Handled specially in analytics-collect.js.
const ENGAGEMENT_SIGNAL_TYPE = 'engagement_signal';

const MAX = {
  event_id: 100,
  session_id: 100,
  visitor_id: 100,
  source_page: 300,
  target_id: 300,
  utm: 255,
  referrer_domain: 255,
};

function str(v) {
  return typeof v === 'string' ? v : v == null ? '' : String(v);
}
function clean(v, cap) {
  return str(v).trim().slice(0, cap);
}
function optional(v, cap) {
  const s = clean(v, cap);
  return s.length ? s : null;
}

async function ensureSchema(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS analytics_sessions (
      session_id          text PRIMARY KEY,
      visitor_id          text NOT NULL,
      started_at          timestamptz NOT NULL DEFAULT now(),
      last_seen_at        timestamptz NOT NULL DEFAULT now(),
      entry_page          text,
      referrer_domain     text,
      utm_source          text,
      utm_medium          text,
      utm_campaign        text,
      utm_content         text,
      utm_term            text,
      attribution_source  text NOT NULL DEFAULT 'Direct',
      country             text,
      device_type         text,
      browser             text,
      browser_language    text,
      org_name            text,
      org_resolution_type text,
      is_internal         boolean NOT NULL DEFAULT false,
      bot_confidence      integer,
      bot_reason_codes    jsonb NOT NULL DEFAULT '[]',
      bot_detection_version text,
      bot_override        boolean,
      created_at          timestamptz NOT NULL DEFAULT now()
    )
  `;
  // Table may already exist from Phase 1, before these columns existed --
  // backfill on existing deployments rather than assuming a fresh table
  // (same pattern as inquiries.js's client_ip/source_page backfill).
  await sql`ALTER TABLE analytics_sessions ADD COLUMN IF NOT EXISTS country text`;
  await sql`ALTER TABLE analytics_sessions ADD COLUMN IF NOT EXISTS device_type text`;
  await sql`ALTER TABLE analytics_sessions ADD COLUMN IF NOT EXISTS browser text`;
  await sql`ALTER TABLE analytics_sessions ADD COLUMN IF NOT EXISTS browser_language text`;
  await sql`ALTER TABLE analytics_sessions ADD COLUMN IF NOT EXISTS org_name text`;
  await sql`ALTER TABLE analytics_sessions ADD COLUMN IF NOT EXISTS org_resolution_type text`;

  await sql`
    CREATE TABLE IF NOT EXISTS analytics_events (
      id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      event_id       text NOT NULL UNIQUE,
      session_id     text NOT NULL,
      visitor_id     text NOT NULL,
      event_type     text NOT NULL,
      target_id      text,
      source_page    text NOT NULL,
      is_high_intent boolean NOT NULL DEFAULT false,
      occurred_at    timestamptz NOT NULL,
      created_at     timestamptz NOT NULL DEFAULT now()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS analytics_events_session_idx ON analytics_events (session_id)`;
  await sql`CREATE INDEX IF NOT EXISTS analytics_events_type_idx ON analytics_events (event_type, occurred_at)`;
  await sql`CREATE INDEX IF NOT EXISTS analytics_sessions_started_idx ON analytics_sessions (started_at)`;

  await sql`
    CREATE TABLE IF NOT EXISTS analytics_settings (
      key         text PRIMARY KEY,
      value       jsonb NOT NULL,
      updated_at  timestamptz NOT NULL DEFAULT now()
    )
  `;
  await sql`
    INSERT INTO analytics_settings (key, value)
    VALUES ('bot_confidence_threshold', '70'::jsonb)
    ON CONFLICT (key) DO NOTHING
  `;
  // "Active visitor" for the live feed (Phase 3 item 7): a session with
  // an event/heartbeat within this many minutes, configurable.
  await sql`
    INSERT INTO analytics_settings (key, value)
    VALUES ('live_feed_active_minutes', '5'::jsonb)
    ON CONFLICT (key) DO NOTHING
  `;
  // Retention period (Phase 3 privacy requirement) -- 395 days (~13
  // months) is the spec's own suggested figure, explicitly "pending
  // legal review," not something I'm asserting as compliant on my own
  // authority. Configurable via the same settings mechanism as
  // everything else here.
  await sql`
    INSERT INTO analytics_settings (key, value)
    VALUES ('data_retention_days', '395'::jsonb)
    ON CONFLICT (key) DO NOTHING
  `;
  // Multi-path funnels (Phase 3 item 8): a few genuinely different
  // named conversion paths, not just the one fixed Phase 1 path. Each
  // stage matches an event_type, optionally narrowed to a source_page
  // prefix (mirrors the Phase 1 "Catalog / Product Page" stage's own
  // LIKE-prefix logic, generalized). Editable later via the settings
  // endpoint; this is the seeded default set, not a hard limit.
  await sql`
    INSERT INTO analytics_settings (key, value)
    VALUES ('funnel_definitions', ${JSON.stringify([
      {
        id: 'standard',
        name: 'Standard (Landing → Catalog → Download → Contact)',
        stages: [
          { label: 'Landing', event_type: 'pageview' },
          { label: 'Catalog / Product Page', event_type: 'pageview', source_page_prefix: '/catalog' },
          { label: 'Spec-Sheet Download', event_type: 'specification_download' },
          { label: 'Contact Click', event_type: 'whatsapp_click,email_click,contact_form_submit' },
        ],
      },
      {
        id: 'whatsapp_first',
        name: 'WhatsApp-First (Landing → WhatsApp Click)',
        stages: [
          { label: 'Landing', event_type: 'pageview' },
          { label: 'WhatsApp Click', event_type: 'whatsapp_click' },
        ],
      },
      {
        id: 'direct_inquiry',
        name: 'Direct Inquiry (Landing → Product Page → Contact Form, no download)',
        stages: [
          { label: 'Landing', event_type: 'pageview' },
          { label: 'Product Page', event_type: 'pageview', source_page_prefix: '/products' },
          { label: 'Contact Form Submit', event_type: 'contact_form_submit' },
        ],
      },
    ])}::jsonb)
    ON CONFLICT (key) DO NOTHING
  `;
  // Search Console (Phase 3 item 5) -- OFF by default. Nothing about
  // this integration touches your real Search Console property, ever,
  // until you both (a) set the three GSC_* env vars and (b) explicitly
  // flip this to true in the dashboard -- exactly the "explicit
  // confirmation before any feature goes live" the spec asks for.
  await sql`
    INSERT INTO analytics_settings (key, value)
    VALUES ('search_console_enabled', 'false'::jsonb)
    ON CONFLICT (key) DO NOTHING
  `;
  // Rolling lookback window, re-fetched (and upserted, not appended) on
  // every run, because Search Console's own performance data arrives
  // late and gets corrected after the fact -- never trust "yesterday
  // only" for this API.
  await sql`
    INSERT INTO analytics_settings (key, value)
    VALUES ('search_console_lookback_days', '16'::jsonb)
    ON CONFLICT (key) DO NOTHING
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS search_console_performance (
      date         date NOT NULL,
      query        text NOT NULL,
      page         text NOT NULL,
      device       text NOT NULL,
      clicks       integer NOT NULL,
      impressions  integer NOT NULL,
      ctr          numeric NOT NULL,
      position     numeric NOT NULL,
      updated_at   timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (date, query, page, device)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS search_console_performance_date_idx ON search_console_performance (date)`;

  // One row per import attempt -- status/attempt_count/last successful
  // run/source date range/error details, all per spec's explicit ask,
  // so a failing scheduled import is visible in the dashboard, not
  // silently swallowed.
  await sql`
    CREATE TABLE IF NOT EXISTS search_console_import_runs (
      id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      started_at        timestamptz NOT NULL DEFAULT now(),
      finished_at       timestamptz,
      status            text NOT NULL DEFAULT 'running',
      attempt_count     integer NOT NULL DEFAULT 1,
      source_start_date date,
      source_end_date   date,
      rows_upserted     integer,
      error_details     text
    )
  `;

  // Server-observed ingest failures only (a DB error while trying to
  // insert something we DID receive). A client request that never
  // reaches this endpoint at all -- a network failure before send --
  // is invisible to any server-side design; that limitation is
  // documented in the dashboard, not silently implied away.
  await sql`
    CREATE TABLE IF NOT EXISTS analytics_ingest_errors (
      id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      occurred_at  timestamptz NOT NULL DEFAULT now(),
      event_type   text,
      reason       text
    )
  `;

  // Audit log: who (admin) looked at what, and when. Covers live-feed
  // access and privacy-deletion actions -- reads and writes both, same
  // "audit sensitive access, not just changes" stance as the CRM's
  // crm_audit_log.
  await sql`
    CREATE TABLE IF NOT EXISTS analytics_audit_log (
      id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      occurred_at  timestamptz NOT NULL DEFAULT now(),
      actor        text NOT NULL,
      action       text NOT NULL,
      details      text
    )
  `;

  // Visitor-deletion requests (Phase 3 privacy requirement): once a
  // visitor_id is here, analytics-collect.js refuses to write any
  // further event under it and tells the client to mint a fresh one --
  // this is the "invalidated for future correlation" mechanism. The ID
  // itself is a random, non-PII token to begin with (see assets/
  // analytics.js's uuid()), so storing it here (rather than a hash of
  // it) reveals nothing that wasn't already meaningless on its own.
  await sql`
    CREATE TABLE IF NOT EXISTS deleted_visitor_ids (
      visitor_id  text PRIMARY KEY,
      deleted_at  timestamptz NOT NULL DEFAULT now()
    )
  `;
}

async function auditLog(sql, actor, action, details) {
  try {
    await sql`INSERT INTO analytics_audit_log (actor, action, details) VALUES (${actor}, ${action}, ${details || null})`;
  } catch {
    // Never let audit-log failure block the action it's logging.
  }
}

async function logIngestError(sql, eventType, reason) {
  try {
    await sql`INSERT INTO analytics_ingest_errors (event_type, reason) VALUES (${eventType || null}, ${clean(reason, 500)})`;
  } catch {
    // If even the error log fails to write, there is nothing further to
    // do -- never let this take down the response to the client.
  }
}

// ---- Attribution -----------------------------------------------------
//
// UTM precedence over referrer when both are present; referrer is stored
// regardless of which one "wins" attribution. No UTM + no referrer (or a
// same-site referrer) = "Direct" -- never guessed, never backfilled.
function computeAttribution({ utmSource, referrerDomain }) {
  if (utmSource) return utmSource;
  if (referrerDomain) return referrerDomain;
  return 'Direct';
}

function siteHostname() {
  return 'olivesegypt.com';
}

function parseReferrerDomain(referrerUrl) {
  if (!referrerUrl) return null;
  try {
    const u = new URL(referrerUrl);
    const host = u.hostname.replace(/^www\./, '');
    if (host === siteHostname()) return null; // self-referral is not a traffic source
    return host;
  } catch {
    return null;
  }
}

// ---- Bot scoring (server-side only) -----------------------------------
//
// A 0-100 confidence score with reason codes, not a binary classifier.
// Known-bot UA signatures and a client-reported webdriver flag are
// weighted high; low interaction signals are weighted low and only ever
// combined with other evidence, per spec. Returns null confidence
// (reason: insufficient signal) when there isn't enough to say anything,
// rather than forcing a number.
function scoreBotConfidence({ userAgent, webdriver, hadInteraction, timeOnPageMs }) {
  const ua = str(userAgent).trim();
  if (!ua) {
    return { confidence: null, reasonCodes: ['missing_user_agent'], version: BOT_DETECTION_VERSION };
  }

  let score = 0;
  const reasons = [];

  if (isbot(ua)) {
    score += 55;
    reasons.push('known_bot_signature');
  }
  if (ua.length < 10) {
    score += 15;
    reasons.push('malformed_user_agent');
  }
  if (webdriver === true) {
    score += 35;
    reasons.push('webdriver_flag');
  }

  // Behavioral signals only apply once we actually have them (i.e. the
  // page-exit engagement signal has arrived) -- weighted low, and only
  // ever combined with the above, never sole-determinant, per spec.
  if (typeof hadInteraction === 'boolean' && typeof timeOnPageMs === 'number') {
    if (!hadInteraction && timeOnPageMs < 100) {
      score += 10;
      reasons.push('low_interaction_signal');
    } else if (!hadInteraction && timeOnPageMs < 2000) {
      score += 3;
      reasons.push('brief_no_interaction');
    }
  }

  score = Math.max(0, Math.min(100, score));
  if (!reasons.length) reasons.push('no_signals_matched');

  return { confidence: score, reasonCodes: reasons, version: BOT_DETECTION_VERSION };
}

// ---- Internal-traffic soft-flagging (IP allowlist, never hard-delete) --
//
// The IP itself is used transiently for this one comparison and never
// persisted anywhere -- only the resulting boolean is stored, matching
// the pattern already established for consent_log/inquiries in this repo.
function isAllowlistedIp(ip) {
  const raw = process.env.ANALYTICS_INTERNAL_IP_ALLOWLIST || '';
  if (!raw || !ip) return false;
  const entries = raw.split(',').map((s) => s.trim()).filter(Boolean);
  for (const entry of entries) {
    if (entry === ip) return true;
    if (entry.includes('/')) {
      try {
        // Minimal CIDR match (IPv4 only) -- no new dependency for a
        // low-frequency admin-configured allowlist.
        const [base, bits] = entry.split('/');
        const mask = ~((1 << (32 - Number(bits))) - 1);
        const toInt = (s) => s.split('.').reduce((acc, o) => (acc << 8) + Number(o), 0) >>> 0;
        if ((toInt(ip) & mask) === (toInt(base) & mask)) return true;
      } catch {
        // Ignore malformed CIDR entries.
      }
    }
  }
  return false;
}

function clientIp(event) {
  const h = event.headers || {};
  return h['x-nf-client-connection-ip'] || h['client-ip'] || (h['x-forwarded-for'] || '').split(',')[0].trim() || '';
}

module.exports = {
  BOT_DETECTION_VERSION,
  EVENT_TYPES,
  ENGAGEMENT_SIGNAL_TYPE,
  MAX,
  str,
  clean,
  optional,
  ensureSchema,
  logIngestError,
  auditLog,
  computeAttribution,
  parseReferrerDomain,
  scoreBotConfidence,
  isAllowlistedIp,
  clientIp,
};
