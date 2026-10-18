'use strict';

/*
 * Release 2 of the password reset: a session is only as good as its account.
 *
 * A session cookie is signed, so nobody can forge one -- but until now a
 * signed cookie stayed valid for its full 7 days whatever happened to the
 * account. A password reset or change raises crm_users.session_version
 * (release 1); from here on, every function that reads a session also reads
 * that number and refuses a session carrying an older one. So a reset signs
 * the account out everywhere, at once.
 *
 *   currentCrmSession(event, opts)   the CRM cookie (tc_crm_session)
 *   currentAdminSession(event)       the analytics cookie (tc_session)
 *   currentReaderSession(event)      either: enquiries and leads
 *
 * Each returns the session or null, and every caller answers null with its
 * own 401. A session is refused when:
 *   - it is not validly signed (as before), or carries "must change
 *     password" outside the change-password endpoint (as before)
 *   - it has no account id and session number: issued before release 1,
 *     so everyone signs in once more after this deploys
 *   - its account no longer exists, has another username, or has a newer
 *     session number
 *   - analytics only: the account is no longer marked admin, or must change
 *     its password first
 *   - the account cannot be read (database down): refused, never waved
 *     through, and reported through the failure alert
 *
 * The analytics emergency fallback session (ADMIN_FALLBACK_LOGIN, no
 * database) carries no account; it is accepted only while the fallback is
 * switched on, for the ADMIN_USERNAME it was issued to. Switching the
 * fallback off ends those sessions too.
 *
 * Tests replace lookup.accountRow (scripts/_session_fixtures.js).
 */

const { neon } = require('@neondatabase/serverless');
const { parseCookies, verifySession, COOKIE_NAME } = require('./_lib');
const crmLib = require('./_crm_lib');
const { reportFailure } = require('./_failure_lib');

function connectionString() {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_URL_UNPOOLED ||
    ''
  );
}

const lookup = {
  async accountRow(uid) {
    const cs = connectionString();
    if (!cs) throw new Error('no database configured');
    const sql = neon(cs);
    const rows = await sql`
      SELECT username, session_version, is_admin, must_change_password
        FROM crm_users WHERE id = ${uid}`;
    return rows[0] || null;
  },
};

function fallbackOn() {
  return String(process.env.ADMIN_FALLBACK_LOGIN || '').trim().toLowerCase() === 'on';
}

// Does this signed session still belong to its account as it is now?
async function matchesAccount(session, { admin }) {
  const uid = session.uid, sv = session.sv;
  if (!Number.isSafeInteger(uid) || uid <= 0 || !Number.isSafeInteger(sv)) return false;
  let row;
  try {
    row = await lookup.accountRow(uid);
  } catch (err) {
    console.error('[sessions] could not read the account; session refused:', String((err && err.message) || err).slice(0, 200));
    const cs = connectionString();
    await reportFailure(cs ? neon(cs) : null, { source: 'session-check', step: 'checking a session against its account' }, err);
    return false;
  }
  if (!row) return false;
  if (row.username !== session.sub) return false;
  if (Number(row.session_version) !== sv) return false;
  if (admin && (row.is_admin !== true || row.must_change_password === true)) return false;
  return true;
}

async function currentCrmSession(event, opts) {
  const session = crmLib.requireCrmSession(event, opts);
  if (!session) return null;
  return (await matchesAccount(session, { admin: false })) ? session : null;
}

async function currentAdminSession(event) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) return null;
  const token = parseCookies(event.headers)[COOKIE_NAME];
  const session = token ? verifySession(token, secret) : null;
  if (!session) return null;
  if (session.fb === 1) {
    return fallbackOn() && process.env.ADMIN_USERNAME && session.sub === process.env.ADMIN_USERNAME ? session : null;
  }
  if (session.adm !== 1) return null;
  return (await matchesAccount(session, { admin: true })) ? session : null;
}

// Enquiries and leads are read from both apps (see _crm_lib.js
// requireReaderSession for why); each session is checked as its own app's.
async function currentReaderSession(event) {
  return (await currentAdminSession(event)) || (await currentCrmSession(event));
}

module.exports = { currentCrmSession, currentAdminSession, currentReaderSession, lookup };
