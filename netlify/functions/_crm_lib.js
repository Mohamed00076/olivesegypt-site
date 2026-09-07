'use strict';

// CRM-specific session helpers. Deliberately separate from _lib.js's
// COOKIE_NAME/sessionCookie() (used by the existing /admin/analytics
// dashboard) per the explicit decision: a fully separate authentication
// system for the CRM, sharing no session, no cookie, and no user table
// with any other app or dashboard. The underlying crypto primitives
// (scrypt password verification, HMAC session signing) are reused from
// _lib.js because they're generic, cookie-name-agnostic helpers already
// written and proven in this repo -- not "authentication code copied
// between the two apps" in the sense the operating rules warn against
// (that rule is about olivesegypt-site vs. the separate umami-olivesegypt
// codebase, which this file has no connection to at all).

const { hashPassword, verifyPassword, signSession, verifySession, parseCookies, readJsonBody, json } = require('./_lib');

const CRM_COOKIE_NAME = 'tc_crm_session';
const CRM_SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

function crmSessionCookie(value, maxAgeSeconds) {
  const attrs = [
    `${CRM_COOKIE_NAME}=${value}`,
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    'Path=/',
    `Max-Age=${maxAgeSeconds}`,
  ];
  return attrs.join('; ');
}

function clearCrmSessionCookie() {
  return `${CRM_COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

function getCrmSession(event, secret) {
  const token = parseCookies(event.headers)[CRM_COOKIE_NAME];
  return token ? verifySession(token, secret) : null;
}

// Deny-by-default authorization gate (Rule 22): every CRM function
// should call this first and bail out on null before touching any data.
function requireCrmSession(event) {
  const SESSION_SECRET = process.env.CRM_SESSION_SECRET || process.env.SESSION_SECRET;
  if (!SESSION_SECRET) return null;
  return getCrmSession(event, SESSION_SECRET);
}

/*
 * ---------------------------------------------------------------------------
 * Saying what actually went wrong.
 *
 * Every CRM endpoint ends in the same catch: log err.message to a place the
 * owner does not read, and answer "Server error". So every distinct failure --
 * a missing table, a missing column, a revoked privilege, a database that has
 * hit its connection limit -- arrives on screen as the same four characters,
 * and the only way to tell them apart is to open the function logs.
 *
 * That cost a full round trip on a broken buyer page: a table was missing, the
 * fix shipped, the page still failed, and nothing anywhere could say whether
 * the second failure was the same cause or a different one.
 *
 * So: name the failure, but never quote the database verbatim.
 *
 * WHAT MAY BE SHOWN, AND WHY
 *
 * These endpoints already require a CRM session, so the reader is staff, not
 * the public. Even so, only two classes of message are passed through: a
 * missing table and a missing column. Those name our own schema, which staff
 * can read on any page anyway, and they are exactly the ones worth seeing,
 * because they say precisely what to fix.
 *
 * Everything else gets a category and no message. A connection failure in
 * particular can carry the database host inside its text, and a hostname is
 * not something to print on a web page because a page was slow.
 * ---------------------------------------------------------------------------
 */

// The SQLSTATEs worth distinguishing, and what each means in plain words.
const DB_ERROR_CODES = {
  '42P01': { what: 'a table this page needs does not exist', quote: true },
  '42703': { what: 'a column this page needs does not exist', quote: true },
  '42501': { what: 'the database user is not allowed to do that', quote: false },
  '23502': { what: 'a required value was empty', quote: false },
  '23505': { what: 'that would duplicate something that must be unique', quote: false },
  '22P02': { what: 'a value had the wrong type', quote: false },
  '53300': { what: 'the database refused a new connection -- too many open', quote: false },
  '57P03': { what: 'the database is not accepting connections yet', quote: false },
  '08006': { what: 'the connection to the database failed', quote: false },
};

/*
 * Turn a thrown error into something safe to put on a screen.
 *
 * `step` is the label the caller attached with dbStep(), so the answer names
 * the operation that failed and not merely the fact that one did.
 */
function describeDbError(err, step) {
  const code = (err && err.code) || null;
  const known = code && DB_ERROR_CODES[code];

  const parts = [];
  if (known) parts.push(known.what);
  else if (code) parts.push(`the database refused the request (${code})`);
  else parts.push('the database could not be reached');

  if (known && known.quote && err.message) {
    // Postgres's own wording for these two is short and names the object:
    // relation "buyer_activity_log" does not exist. Nothing else is quoted.
    parts.push(`- ${String(err.message).slice(0, 200)}`);
  }
  if (step) parts.push(`(while ${step})`);

  return { error: parts.join(' '), code: code || null, step: step || null };
}

/*
 * Label a query so a failure knows which one it was. Without this the step is
 * guesswork: handleGet runs four queries and the catch sees only the last
 * error, with nothing to say which of the four raised it.
 */
async function dbStep(step, run) {
  try {
    return await run();
  } catch (err) {
    if (err && !err.crmStep) err.crmStep = step;
    throw err;
  }
}

module.exports = {
  CRM_COOKIE_NAME,
  CRM_SESSION_TTL_SECONDS,
  DB_ERROR_CODES,
  describeDbError,
  dbStep,
  hashPassword,
  verifyPassword,
  signSession,
  verifySession,
  parseCookies,
  readJsonBody,
  json,
  crmSessionCookie,
  clearCrmSessionCookie,
  getCrmSession,
  requireCrmSession,
};
