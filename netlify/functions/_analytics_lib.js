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
  computeAttribution,
  parseReferrerDomain,
  scoreBotConfidence,
  isAllowlistedIp,
  clientIp,
};
