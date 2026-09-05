'use strict';

/*
 * The unsubscribe endpoint -- /api/unsubscribe.
 *
 * Every lead form on this site carries the line "I agree to be contacted
 * about this request and understand I can unsubscribe at any time." Until
 * now nothing stood behind the second half of that sentence. This does.
 *
 *   POST { email }                     -> record the opt-out
 *   POST { email, action: 'resubscribe' } -> undo it
 *   GET  ?email=…                      -> current status for one address
 *   GET  ?list=1                       -> every opt-out (admin session only)
 *
 * The public POST is not email-verified; see the note at the top of
 * _optout_lib.js for why that trade-off was made deliberately rather than
 * overlooked. It is rate-limited by IP instead, which bounds the one abuse
 * case that matters (someone opting out addresses in bulk) without putting a
 * second step between a person and a promise the site made them.
 *
 * The admin listing is behind the same tc_session gate as /admin/analytics,
 * because it returns other people's email addresses.
 */

const { neon } = require('@neondatabase/serverless');
const { readJsonBody, json, parseCookies, verifySession, COOKIE_NAME } = require('./_lib');
const {
  normaliseEmail, looksLikeEmail, ensureOptOutSchema, unsubscribe, resubscribe,
} = require('./_optout_lib');

const RATE_LIMIT_WINDOW_MINUTES = 60;
const RATE_LIMIT_MAX_PER_WINDOW = 20;
const MAX_SOURCE_PAGE = 200;

function connectionString() {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_URL_UNPOOLED ||
    ''
  );
}

function clientIp(event) {
  const h = event.headers || {};
  return h['x-nf-client-connection-ip'] || h['client-ip'] ||
    (h['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
}

function isAdmin(event) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) return false;
  const token = parseCookies(event.headers)[COOKIE_NAME];
  return token ? !!verifySession(token, secret) : false;
}

async function overRateLimit(sql, ip) {
  const rows = await sql`
    SELECT count(*)::int AS n FROM contact_opt_out_events
    WHERE created_at > now() - (${RATE_LIMIT_WINDOW_MINUTES} || ' minutes')::interval
      AND client_ip = ${ip}
  `;
  return ((rows[0] && rows[0].n) || 0) >= RATE_LIMIT_MAX_PER_WINDOW;
}

async function handleGet(event, sql) {
  const qs = event.queryStringParameters || {};

  if (qs.list) {
    if (!isAdmin(event)) return json(401, { ok: false, error: 'Not authorised' });
    const rows = await sql`
      SELECT email, status, updated_at FROM contact_opt_outs
      WHERE status = 'unsubscribed' ORDER BY updated_at DESC LIMIT 1000
    `;
    return json(200, { ok: true, count: rows.length, opt_outs: rows });
  }

  // A status lookup returns only what the asker already typed, so it tells
  // an enumerator nothing they did not already supply.
  const email = normaliseEmail(qs.email);
  if (!looksLikeEmail(email)) return json(400, { ok: false, error: 'A valid email address is required' });
  const rows = await sql`SELECT status FROM contact_opt_outs WHERE email = ${email}`;
  return json(200, { ok: true, email, status: rows[0] ? rows[0].status : 'subscribed' });
}

async function handlePost(event, sql) {
  const body = readJsonBody(event);
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return json(400, { ok: false, error: 'Invalid request body' });
  }

  const email = normaliseEmail(body.email);
  if (!looksLikeEmail(email)) {
    return json(400, { ok: false, error: 'A valid email address is required' });
  }

  const action = String(body.action || 'unsubscribe').toLowerCase();
  if (action !== 'unsubscribe' && action !== 'resubscribe') {
    return json(400, { ok: false, error: 'Unknown action' });
  }
  // Opting an address back IN is the direction that could be abused to
  // undo someone else's choice, so it is not something the public form can
  // do -- only a signed-in admin, handling someone who says they never
  // asked to be removed.
  if (action === 'resubscribe' && !isAdmin(event)) {
    return json(401, { ok: false, error: 'Not authorised' });
  }

  const ip = clientIp(event);
  if (action === 'unsubscribe' && !isAdmin(event) && await overRateLimit(sql, ip)) {
    return json(429, { ok: false, error: 'Too many requests. Please try again later.' });
  }

  const sourcePage = String(body.source_page || '').trim().slice(0, MAX_SOURCE_PAGE) || null;
  if (action === 'unsubscribe') await unsubscribe(sql, email, sourcePage, ip);
  else await resubscribe(sql, email, sourcePage, ip);

  // The response says what was recorded without echoing anything the caller
  // did not send, and the log names the action but never the address.
  console.log(`[unsubscribe] action=${action} status=recorded`);
  return json(200, { ok: true, action });
}

exports.handler = async (event) => {
  const method = event.httpMethod;
  if (method !== 'POST' && method !== 'GET') {
    return json(405, { ok: false, error: 'Method not allowed' }, { Allow: 'GET, POST' });
  }

  const cs = connectionString();
  if (!cs) return json(500, { ok: false, error: 'Server not configured' });
  const sql = neon(cs);

  try {
    await ensureOptOutSchema(sql);
    return method === 'GET' ? await handleGet(event, sql) : await handlePost(event, sql);
  } catch (err) {
    console.error('[unsubscribe] db error:', err?.message ?? err);
    return json(500, { ok: false, error: 'Could not record your request' });
  }
};
