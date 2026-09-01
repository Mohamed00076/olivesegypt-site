'use strict';

/*
 * Section J Phase 1 -- public, POST-only ingestion endpoint for the
 * site's own custom event pipeline (see _analytics_lib.js for why this
 * exists alongside, not instead of, Umami). No admin auth -- this is the
 * visitor-facing collector, same security posture as inquiries.js/leads.js
 * (rate-limited, tightly validated, never trusts the client beyond what's
 * cheap to fake anyway).
 *
 * Two request shapes:
 *  - type: "event"    -- a funnel/event row (pageview, whatsapp_click,
 *                         email_click, specification_download,
 *                         contact_form_submit). Upserts the session row.
 *  - type: "engagement" -- a page-exit behavioral signal (sendBeacon),
 *                         updates an existing session's bot-confidence
 *                         fields. Writes no event row.
 *
 * Idempotency: event_id is client-generated and UNIQUE in the DB --
 * INSERT ... ON CONFLICT DO NOTHING makes a retried/duplicate send a
 * true no-op, not just a best-effort dedup window.
 */

const { neon } = require('@neondatabase/serverless');
const {
  EVENT_TYPES,
  ENGAGEMENT_SIGNAL_TYPE,
  MAX,
  clean,
  optional,
  ensureSchema,
  logIngestError,
  computeAttribution,
  parseReferrerDomain,
  scoreBotConfidence,
  isAllowlistedIp,
  clientIp,
} = require('./_analytics_lib');
const { readJsonBody, json } = require('./_lib');
const { resolveCountry, parseUserAgent } = require('./_geo_lib');
const { resolveOrg, ensureSchema: ensureB2bSchema } = require('./_b2b_lib');

function connectionString() {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_URL_UNPOOLED ||
    ''
  );
}

const HIGH_INTENT_TYPES = new Set(['whatsapp_click', 'email_click', 'specification_download', 'contact_form_submit']);

const attempts = new Map();
const WINDOW_MS = 60 * 1000;
const MAX_PER_WINDOW = 60; // generous -- a real page load fires at most a couple of these per minute

function rateLimited(ip) {
  const now = Date.now();
  const rec = attempts.get(ip);
  if (!rec || rec.resetAt < now) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  rec.count += 1;
  return rec.count > MAX_PER_WINDOW;
}

function validEventId(v) {
  // Client-generated (crypto.randomUUID() or a fallback) -- just bound
  // the shape, don't require a specific format.
  return typeof v === 'string' && v.length >= 8 && v.length <= MAX.event_id;
}

async function upsertSession(sql, s) {
  await sql`
    INSERT INTO analytics_sessions (
      session_id, visitor_id, entry_page, referrer_domain,
      utm_source, utm_medium, utm_campaign, utm_content, utm_term,
      attribution_source, country, device_type, browser, browser_language, is_internal
    ) VALUES (
      ${s.sessionId}, ${s.visitorId}, ${s.entryPage}, ${s.referrerDomain},
      ${s.utmSource}, ${s.utmMedium}, ${s.utmCampaign}, ${s.utmContent}, ${s.utmTerm},
      ${s.attributionSource}, ${s.country}, ${s.deviceType}, ${s.browser}, ${s.browserLanguage}, ${s.isInternal}
    )
    ON CONFLICT (session_id) DO UPDATE SET
      last_seen_at = now(),
      is_internal = analytics_sessions.is_internal OR EXCLUDED.is_internal
  `;
}

async function handleEvent(sql, body, ip, userAgent) {
  const eventId = clean(body.event_id, MAX.event_id);
  const sessionId = clean(body.session_id, MAX.session_id);
  const visitorId = clean(body.visitor_id, MAX.visitor_id);
  const eventType = clean(body.event_type, 60);
  const sourcePage = clean(body.source_page, MAX.source_page);

  if (!validEventId(eventId) || !sessionId || !visitorId || !EVENT_TYPES.has(eventType) || !sourcePage) {
    return json(400, { ok: false, error: 'Invalid event payload' });
  }

  // Privacy deletion (Phase 3): once a visitor_id has been deleted on
  // request, refuse to write anything further under it and tell the
  // client to mint a fresh one -- this IS the "invalidated for future
  // correlation" requirement, not just a courtesy. No event is written.
  const deleted = await sql`SELECT 1 FROM deleted_visitor_ids WHERE visitor_id = ${visitorId}`;
  if (deleted[0]) {
    return json(200, { ok: true, reset_visitor: true });
  }

  const targetId = optional(body.target_id, MAX.target_id);
  const occurredAtMs = Number(body.occurred_at);
  const occurredAt = Number.isFinite(occurredAtMs) && occurredAtMs > 0 ? new Date(occurredAtMs) : new Date();

  const sess = body.session || {};
  const isNewSession = sess.is_new === true;
  const utmSource = optional(sess.utm_source, MAX.utm);
  const utmMedium = optional(sess.utm_medium, MAX.utm);
  const utmCampaign = optional(sess.utm_campaign, MAX.utm);
  const utmContent = optional(sess.utm_content, MAX.utm);
  const utmTerm = optional(sess.utm_term, MAX.utm);
  const referrerDomain = parseReferrerDomain(optional(sess.referrer, 2000));
  const entryPage = optional(sess.entry_page, MAX.source_page);
  const attributionSource = computeAttribution({ utmSource, referrerDomain });
  const isInternal = isAllowlistedIp(ip);
  const browserLanguage = optional(sess.browser_language, 35);

  // Country/device/browser are resolved once, at session creation, same
  // as UTM/referrer -- not re-derived on every event in the session.
  // The IP is used here transiently and never persisted (see
  // _geo_lib.js); only the resolved two-letter country code is stored.
  let country = null;
  let deviceType = null;
  let browser = null;
  if (isNewSession) {
    country = await resolveCountry(ip);
    ({ deviceType, browser } = parseUserAgent(userAgent));
  }

  try {
    // The session row is upserted on every event (not just new ones) so
    // last_seen_at / is_internal stay current even for a long-running
    // session that never sends a fresh "is_new" signal.
    await upsertSession(sql, {
      sessionId,
      visitorId,
      entryPage: isNewSession ? entryPage : null,
      referrerDomain: isNewSession ? referrerDomain : null,
      utmSource: isNewSession ? utmSource : null,
      utmMedium: isNewSession ? utmMedium : null,
      utmCampaign: isNewSession ? utmCampaign : null,
      utmContent: isNewSession ? utmContent : null,
      utmTerm: isNewSession ? utmTerm : null,
      attributionSource: isNewSession ? attributionSource : 'Direct',
      country,
      deviceType,
      browser,
      browserLanguage: isNewSession ? browserLanguage : null,
      isInternal,
    });

    await sql`
      INSERT INTO analytics_events (event_id, session_id, visitor_id, event_type, target_id, source_page, is_high_intent, occurred_at)
      VALUES (${eventId}, ${sessionId}, ${visitorId}, ${eventType}, ${targetId}, ${sourcePage}, ${HIGH_INTENT_TYPES.has(eventType)}, ${occurredAt})
      ON CONFLICT (event_id) DO NOTHING
    `;
  } catch (err) {
    await logIngestError(sql, eventType, err?.message || 'insert failed');
    // A failed write must never interrupt the visitor's experience --
    // still respond 200, the error is logged for the dashboard instead.
  }

  return json(200, { ok: true });
}

async function handleEngagement(sql, body) {
  const sessionId = clean(body.session_id, MAX.session_id);
  if (!sessionId) return json(400, { ok: false, error: 'Invalid engagement payload' });

  const webdriver = body.webdriver === true;
  const hadInteraction = body.had_interaction === true;
  const timeOnPageMs = Number(body.time_on_page_ms);

  return { sessionId, webdriver, hadInteraction, timeOnPageMs: Number.isFinite(timeOnPageMs) ? timeOnPageMs : null };
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { ok: false, error: 'Method not allowed' }, { Allow: 'POST' });
  }

  const ip = clientIp(event);
  if (ip && rateLimited(ip)) {
    return json(429, { ok: false, error: 'Too many requests' });
  }

  const cs = connectionString();
  if (!cs) return json(500, { ok: false, error: 'Server not configured' });
  const sql = neon(cs);

  const body = readJsonBody(event);
  if (!body || typeof body !== 'object') {
    return json(400, { ok: false, error: 'Invalid request body' });
  }

  const userAgent = (event.headers && (event.headers['user-agent'] || event.headers['User-Agent'])) || '';

  try {
    await ensureSchema(sql);
    await ensureB2bSchema(sql);

    if (body.type === ENGAGEMENT_SIGNAL_TYPE) {
      const parsed = await handleEngagement(sql, body);
      if (!parsed) return json(400, { ok: false, error: 'Invalid engagement payload' });

      const { confidence, reasonCodes, version } = scoreBotConfidence({
        userAgent,
        webdriver: parsed.webdriver,
        hadInteraction: parsed.hadInteraction,
        timeOnPageMs: parsed.timeOnPageMs,
      });

      // Reverse-IP org lookup happens here, at page-exit, not at the
      // initial pageview write -- keeps the RDAP round trip (which can
      // take a couple of seconds worst-case, first time only, cached
      // after that) off the critical path of every new session's first
      // event. ip is read transiently for this one lookup, same as
      // everywhere else in this pipeline -- see _b2b_lib.js for why only
      // a one-way hash of it, never the raw value, ends up in storage.
      const { orgName, resolutionType } = await resolveOrg(sql, ip);

      try {
        await sql`
          UPDATE analytics_sessions
          SET bot_confidence = ${confidence}, bot_reason_codes = ${JSON.stringify(reasonCodes)}::jsonb,
              bot_detection_version = ${version}, org_name = ${orgName}, org_resolution_type = ${resolutionType},
              last_seen_at = now()
          WHERE session_id = ${parsed.sessionId}
        `;
      } catch (err) {
        await logIngestError(sql, ENGAGEMENT_SIGNAL_TYPE, err?.message || 'engagement update failed');
      }

      return json(200, { ok: true });
    }

    if (body.type === 'event') {
      return await handleEvent(sql, body, ip, userAgent);
    }

    return json(400, { ok: false, error: 'Unknown request type' });
  } catch (err) {
    console.error('[analytics-collect] error:', err?.message ?? err);
    // Still never break the visitor's page over a server-side error.
    return json(200, { ok: true });
  }
};
