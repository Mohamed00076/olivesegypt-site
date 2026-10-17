'use strict';

/*
 * Shared sign-in and password-reset code for the CRM and /admin/analytics.
 *
 * One user store: both apps sign in with a crm_users account; analytics
 * needs is_admin. Everything a password or a reset link touches lives here,
 * so the two apps cannot drift apart:
 *
 *   - password hashing (scrypt, OWASP's N=2^15 / r=8 / p=3 equivalent),
 *     verification of old and new hashes, quiet upgrade of old ones
 *   - the new-password rules (12 to 128 characters, not a common password,
 *     not built from the username or the site's own words)
 *   - reset tokens (256 random bits, only their SHA-256 stored, 30 minutes,
 *     single use, compared in constant time)
 *   - the client IP (Netlify's own header only) and its keyed hash
 *   - the reset-link base address (APP_BASE_URL, https only, never a
 *     request header)
 *   - the database guard: schema changes run only when the deploy and the
 *     database agree on whether this is staging (see prepare())
 *   - the audit trail (auth_events), the database-backed rate limits that
 *     count from it, and the alert email to the owner
 *
 * Nothing here logs a password, a token or an email address.
 *
 * Handlers call these through the module object (auth.createStore(...),
 * emailLib.sendEmail(...)), never through destructured copies, so the tests
 * in scripts/check-password-reset.js can replace the database and the mail
 * with fakes.
 */

const crypto = require('crypto');
const { promisify } = require('util');
const COMMON_PASSWORDS = require('./_common_passwords');

const scryptAsync = promisify(crypto.scrypt);

// ---------------------------------------------------------------------------
// Hashing.
//
// OWASP Password Storage Cheat Sheet (read 2026-10-17): scrypt with
// N=2^17, r=8, p=1, or an equivalent that trades memory for parallelism;
// N=2^15 needs p=3. N=2^15 with r=8 needs 32 MiB per hash, which is
// exactly Node's default scrypt memory cap, and Node refuses it ("memory
// limit exceeded") -- so the cap is raised explicitly. Measured on Node 22:
// about 0.3 s per hash.
//
// Stored as scrypt2$N$r$p$salt$hash (hex). The older format,
// scrypt:salt:hash, used Node's defaults (N=2^14, r=8, p=1); it still
// verifies, and is replaced by the new one at the next successful sign-in.
const HASH = { N: 32768, r: 8, p: 3, keylen: 32, saltBytes: 16 };
const HASH_MAXMEM = 64 * 1024 * 1024;
const LEGACY = { N: 16384, r: 8, p: 1 };
// Upper bounds on parameters read back from the database, so a tampered row
// cannot make a sign-in allocate unbounded memory.
const LIMITS = { N: 1 << 17, r: 16, p: 16 };

async function hashPassword(password) {
  const salt = crypto.randomBytes(HASH.saltBytes);
  const hash = await scryptAsync(String(password), salt, HASH.keylen, {
    N: HASH.N, r: HASH.r, p: HASH.p, maxmem: HASH_MAXMEM,
  });
  return `scrypt2$${HASH.N}$${HASH.r}$${HASH.p}$${salt.toString('hex')}$${hash.toString('hex')}`;
}

function parseHash(stored) {
  if (typeof stored !== 'string') return null;
  if (stored.startsWith('scrypt2$')) {
    const p = stored.split('$');
    if (p.length !== 6) return null;
    const [N, r, par] = [Number(p[1]), Number(p[2]), Number(p[3])];
    if (![N, r, par].every(Number.isSafeInteger)) return null;
    if (N < 2 || N > LIMITS.N || (N & (N - 1)) !== 0 || r < 1 || r > LIMITS.r || par < 1 || par > LIMITS.p) return null;
    const salt = Buffer.from(p[4], 'hex');
    const hash = Buffer.from(p[5], 'hex');
    if (salt.length < 16 || hash.length !== 32) return null;
    return { N, r, p: par, salt, hash, legacy: false };
  }
  const p = stored.split(':');
  if (p.length === 3 && p[0] === 'scrypt') {
    const salt = Buffer.from(p[1], 'hex');
    const hash = Buffer.from(p[2], 'hex');
    if (salt.length === 0 || hash.length !== 32) return null;
    return { ...LEGACY, salt, hash, legacy: true };
  }
  return null;
}

// A correctly-sized hash at today's cost, used when the username does not
// exist so that a wrong username takes as long as a wrong password.
const DUMMY_HASH = `scrypt2$${HASH.N}$${HASH.r}$${HASH.p}$${'00'.repeat(16)}$${'00'.repeat(32)}`;

/** { ok, needsRehash } -- never throws. */
async function verifyPassword(password, stored) {
  const h = parseHash(stored) || parseHash(DUMMY_HASH);
  let derived;
  try {
    derived = await scryptAsync(String(password), h.salt, h.hash.length, {
      N: h.N, r: h.r, p: h.p, maxmem: HASH_MAXMEM * 2,
    });
  } catch {
    return { ok: false, needsRehash: false };
  }
  const ok = parseHash(stored) !== null && crypto.timingSafeEqual(derived, h.hash);
  const needsRehash = ok && (h.legacy || h.N < HASH.N || h.p < HASH.p || h.r !== HASH.r);
  return { ok, needsRehash };
}

// ---------------------------------------------------------------------------
// New-password rules.
const PASSWORD_MIN = 12;
const PASSWORD_MAX = 128;
const SITE_WORDS = new Set([
  'olive', 'olives', 'olivesegypt', 'egypt', 'egyptian', 'triple', 'triplecompany',
  'company', 'password', 'passw', 'crm', 'admin', 'analytics', 'welcome', 'qwerty',
]);

/** null when acceptable, otherwise the message to show. */
function passwordProblem(password, username) {
  if (typeof password !== 'string' || password.length === 0) return 'Choose a new password.';
  const length = Array.from(password).length;
  if (length < PASSWORD_MIN) return `Choose a password of at least ${PASSWORD_MIN} characters.`;
  if (length > PASSWORD_MAX) return `Choose a password of at most ${PASSWORD_MAX} characters.`;
  const lower = password.toLowerCase();
  if (COMMON_PASSWORDS.has(lower)) return 'That password is one of the most common ones. Choose a different one.';
  if (/^(.)\1+$/u.test(password)) return 'That password is too easy to guess. Choose a different one.';
  const user = String(username || '').toLowerCase();
  if (user.length >= 3 && lower.includes(user)) return 'Do not use your username in your password.';
  // A site word padded with digits or symbols ("Olivesegypt2026!", "admin!!!!1234").
  const letters = lower.replace(/[^\p{L}]/gu, '');
  if (SITE_WORDS.has(letters) || (user.length >= 3 && letters === user.replace(/[^\p{L}]/gu, ''))) {
    return 'That password is too easy to guess. Choose a different one.';
  }
  return null;
}

// ---------------------------------------------------------------------------
// Reset tokens.
const RESET_TTL_MINUTES = 30;

function tokenHash(token) {
  return crypto.createHash('sha256').update(String(token), 'utf8').digest('hex');
}

/** 32 random bytes, base64url (43 characters). Only the hash is stored. */
function newResetToken() {
  const token = crypto.randomBytes(32).toString('base64url');
  return { token, hash: tokenHash(token) };
}

// New tokens are base64url; links mailed before this release carried 64 hex
// characters and stay usable until they expire.
function wellFormedToken(token) {
  return typeof token === 'string' && (/^[A-Za-z0-9_-]{43}$/.test(token) || /^[0-9a-f]{64}$/.test(token));
}

function sameHash(a, b) {
  const x = Buffer.from(String(a || ''), 'hex');
  const y = Buffer.from(String(b || ''), 'hex');
  return x.length === 32 && y.length === 32 && crypto.timingSafeEqual(x, y);
}

// ---------------------------------------------------------------------------
// The client, the base address, the mailbox.

/** Netlify's own client-IP header only; never X-Forwarded-For, which a client can set. */
function clientIp(event) {
  const h = (event && event.headers) || {};
  const ip = h['x-nf-client-connection-ip'];
  return typeof ip === 'string' && ip.trim() ? ip.trim() : 'unknown';
}

/** A keyed, truncated hash of the IP: enough to count, not enough to recover. */
function ipHash(ip) {
  const secret = process.env.CRM_SESSION_SECRET || process.env.SESSION_SECRET || '';
  const key = crypto.createHmac('sha256', secret || 'no-secret').update('olivesegypt:auth-ip:v1').digest();
  return crypto.createHmac('sha256', key).update(String(ip)).digest('hex').slice(0, 32);
}

/** The configured https origin for links in emails, or null. Never a request header. */
function appBaseUrl() {
  const raw = String(process.env.APP_BASE_URL || '').trim();
  if (!raw) return null;
  let u;
  try { u = new URL(raw); } catch { return null; }
  if (u.protocol !== 'https:' || u.username || u.password || (u.pathname !== '/' && u.pathname !== '') || u.search || u.hash) return null;
  return u.origin;
}

// Role mailboxes reach several people; a reset link must reach one.
const ROLE_MAILBOXES = new Set(['sales', 'info', 'contact', 'admin', 'noreply', 'no-reply']);
function isRoleMailbox(email) {
  const local = String(email || '').toLowerCase().split('@')[0].split('+')[0].trim();
  return ROLE_MAILBOXES.has(local);
}
function usableEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) && !isRoleMailbox(email);
}

// ---------------------------------------------------------------------------
// The database: one place for every query the sign-in and reset code runs.
function createStore(sql) {
  return {
    async readMarker() {
      const t = await sql`SELECT to_regclass('public.deployment_marker') AS t`;
      if (!t[0] || !t[0].t) return null;
      const m = await sql`SELECT environment FROM deployment_marker LIMIT 1`;
      return m[0] ? String(m[0].environment) : null;
    },

    // Additive only, and repeatable: every statement is IF NOT EXISTS.
    async ensureSchema() {
      await sql`
        CREATE TABLE IF NOT EXISTS crm_users (
          id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
          created_at     timestamptz NOT NULL DEFAULT now(),
          username       text NOT NULL UNIQUE,
          password_hash  text NOT NULL,
          display_name   text
        )`;
      await sql`ALTER TABLE crm_users ADD COLUMN IF NOT EXISTS email text`;
      await sql`ALTER TABLE crm_users ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false`;
      await sql`ALTER TABLE crm_users ADD COLUMN IF NOT EXISTS session_version integer NOT NULL DEFAULT 1`;
      await sql`ALTER TABLE crm_users ADD COLUMN IF NOT EXISTS password_changed_at timestamptz`;
      await sql`ALTER TABLE crm_users ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false`;
      await sql`
        CREATE TABLE IF NOT EXISTS crm_password_resets (
          id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
          created_at   timestamptz NOT NULL DEFAULT now(),
          user_id      bigint NOT NULL,
          token_hash   text NOT NULL UNIQUE,
          expires_at   timestamptz NOT NULL,
          used_at      timestamptz
        )`;
      await sql`ALTER TABLE crm_password_resets ADD COLUMN IF NOT EXISTS invalidated_at timestamptz`;
      await sql`ALTER TABLE crm_password_resets ADD COLUMN IF NOT EXISTS ip_hash text`;
      await sql`CREATE INDEX IF NOT EXISTS crm_password_resets_user ON crm_password_resets (user_id)`;
      await sql`
        CREATE TABLE IF NOT EXISTS auth_events (
          id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
          occurred_at  timestamptz NOT NULL DEFAULT now(),
          app          text NOT NULL,
          event        text NOT NULL,
          user_id      bigint,
          ip_hash      text,
          detail       text
        )`;
      await sql`CREATE INDEX IF NOT EXISTS auth_events_recent ON auth_events (app, event, occurred_at)`;
    },

    async userByUsername(username) {
      const r = await sql`
        SELECT id, username, display_name, email, password_hash, is_admin, session_version, must_change_password
        FROM crm_users WHERE username = ${username} LIMIT 1`;
      return r[0] || null;
    },

    async userById(id) {
      const r = await sql`
        SELECT id, username, display_name, email, password_hash, is_admin, session_version, must_change_password
        FROM crm_users WHERE id = ${id} LIMIT 1`;
      return r[0] || null;
    },

    async countEvents({ app, events, minutes, ipHash: ipH = null, userId = null }) {
      const r = await sql`
        SELECT count(*)::int AS n FROM auth_events
        WHERE app = ${app}
          AND event = ANY(${events})
          AND occurred_at > now() - make_interval(mins => ${minutes})
          AND (${ipH}::text IS NULL OR ip_hash = ${ipH})
          AND (${userId}::bigint IS NULL OR user_id = ${userId})`;
      return r[0] ? r[0].n : 0;
    },

    async recordEvent({ app, event, userId = null, ipHash: ipH = null, detail = null }) {
      await sql`
        INSERT INTO auth_events (app, event, user_id, ip_hash, detail)
        VALUES (${app}, ${event}, ${userId}, ${ipH}, ${detail})`;
    },

    // A new link cancels every earlier unused one for the same account.
    async issueResetToken({ userId, tokenHash: h, ipHash: ipH, minutes }) {
      await sql.transaction([
        sql`UPDATE crm_password_resets SET invalidated_at = now()
            WHERE user_id = ${userId} AND used_at IS NULL AND invalidated_at IS NULL`,
        sql`INSERT INTO crm_password_resets (user_id, token_hash, expires_at, ip_hash)
            VALUES (${userId}, ${h}, now() + make_interval(mins => ${minutes}), ${ipH})`,
      ]);
    },

    async activeReset(h) {
      const r = await sql`
        SELECT id, user_id, token_hash FROM crm_password_resets
        WHERE token_hash = ${h} AND used_at IS NULL AND invalidated_at IS NULL AND expires_at > now()
        LIMIT 1`;
      return r[0] || null;
    },

    // One statement, so two submissions of the same link cannot both win:
    // only the one that claims the unused token changes the password. It
    // also signs the account out everywhere (session_version) and cancels
    // any other open link.
    async completeReset({ resetId, passwordHash }) {
      const r = await sql`
        WITH claimed AS (
          UPDATE crm_password_resets SET used_at = now()
          WHERE id = ${resetId} AND used_at IS NULL AND invalidated_at IS NULL AND expires_at > now()
          RETURNING user_id
        ), changed AS (
          UPDATE crm_users SET password_hash = ${passwordHash}, password_changed_at = now(),
                 must_change_password = false, session_version = session_version + 1
          WHERE id = (SELECT user_id FROM claimed)
          RETURNING id
        ), others AS (
          UPDATE crm_password_resets SET invalidated_at = now()
          WHERE user_id = (SELECT user_id FROM claimed) AND id <> ${resetId}
            AND used_at IS NULL AND invalidated_at IS NULL
          RETURNING id
        )
        SELECT id FROM changed`;
      return r.length === 1;
    },

    async changePassword({ userId, passwordHash }) {
      const r = await sql`
        WITH changed AS (
          UPDATE crm_users SET password_hash = ${passwordHash}, password_changed_at = now(),
                 must_change_password = false, session_version = session_version + 1
          WHERE id = ${userId}
          RETURNING id
        ), others AS (
          UPDATE crm_password_resets SET invalidated_at = now()
          WHERE user_id = ${userId} AND used_at IS NULL AND invalidated_at IS NULL
          RETURNING id
        )
        SELECT id FROM changed`;
      return r.length === 1;
    },

    // Upgrading an old hash at sign-in: same password, so no sign-out.
    async rehash({ userId, oldHash, newHash }) {
      await sql`UPDATE crm_users SET password_hash = ${newHash} WHERE id = ${userId} AND password_hash = ${oldHash}`;
    },
  };
}

// ---------------------------------------------------------------------------
// The database guard.
//
// Netlify does not tell functions which deploy they belong to (only URL,
// SITE_NAME and SITE_ID are available at runtime), so the deploy says it
// itself: DEPLOY_ENV=staging on Deploy Previews and Branch deploys. The
// database says it too: the staging branch carries a deployment_marker row
// 'staging', which a wrong setting cannot fake. The two must agree before
// any schema change runs; if they do not, sign-in and reset answer
// "temporarily unavailable" and change nothing.
function deployEnv() {
  return String(process.env.DEPLOY_ENV || '').trim().toLowerCase() === 'staging' ? 'staging' : 'production';
}

let schemaReady = false;
async function prepare(store) {
  if (schemaReady) return { ok: true };
  const marker = await store.readMarker();
  const env = deployEnv();
  if (env === 'staging' && marker !== 'staging') {
    return { ok: false, reason: 'DEPLOY_ENV is staging but the database is not labelled staging' };
  }
  if (env === 'production' && marker === 'staging') {
    return { ok: false, reason: 'a production deploy is pointing at the staging database' };
  }
  await store.ensureSchema();
  schemaReady = true;
  return { ok: true };
}
function resetPreparedForTests() { schemaReady = false; }

// ---------------------------------------------------------------------------
// Audit, limits, alerts.

/** Never throws: an audit write that fails must not become a second failure. */
async function audit(store, row) {
  try {
    await store.recordEvent(row);
  } catch (err) {
    console.error('[auth] audit write failed:', String((err && err.message) || err).slice(0, 120));
  }
}

const LIMITS_PER = {
  forgotPerIp15: 5,
  forgotPerIpDay: 20,
  forgotPerAccountHour: 3,
  resetPerIp15: 10,
  loginPerIp15: 10,
  loginFailuresPerAccount15: 10,
  changeFailuresPerIp15: 10,
};
const ALERT = { accountFailuresHour: 10, accountThrottledHour: 5, siteEventsHour: 50 };
const FAILURE_EVENTS = ['login_failed', 'reset_failed', 'change_failed'];
const THROTTLE_EVENTS = ['login_throttled', 'reset_throttled', 'change_throttled'];

async function countSafe(store, q) {
  try { return await store.countEvents(q); } catch { return 0; }
}

/**
 * After a failure or a throttle: email the owner if one account, or the site
 * as a whole, crosses a threshold -- at most one alert an hour.
 */
async function maybeAlert(store, emailLib, { app, userId }) {
  try {
    const reasons = [];
    if (userId != null) {
      const f = await countSafe(store, { app, events: FAILURE_EVENTS, minutes: 60, userId });
      if (f >= ALERT.accountFailuresHour) reasons.push(`${f} failed attempts on account #${userId} in the last hour`);
      const t = await countSafe(store, { app, events: THROTTLE_EVENTS, minutes: 60, userId });
      if (t >= ALERT.accountThrottledHour) reasons.push(`${t} throttled requests for account #${userId} in the last hour`);
    }
    const all = await countSafe(store, { app, events: FAILURE_EVENTS.concat(THROTTLE_EVENTS), minutes: 60 });
    if (all >= ALERT.siteEventsHour) reasons.push(`${all} failed or throttled sign-in and reset events in the last hour (${app})`);
    if (reasons.length === 0) return false;
    const recent = await countSafe(store, { app: 'all', events: ['alert_sent'], minutes: 60 });
    if (recent > 0) return false;
    await audit(store, { app: 'all', event: 'alert_sent', detail: app });
    await emailLib.sendNotification(
      'Sign-in alert: repeated failures on olivesegypt.com',
      [
        'Repeated failed or throttled sign-in or password-reset attempts:',
        '',
        ...reasons.map((r) => '- ' + r),
        '',
        'If this was not you, consider resetting the affected password. Details are in the auth_events table.',
      ].join('\n'),
      { formType: 'auth-alert' }
    );
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Timing: the forgot-password answer takes the same time whether or not the
// account exists, because the slow parts (a database write, an email) happen
// only when it does. Tests shorten these.
const timing = { floorMs: 1500, jitterMs: 250 };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function padTo(startedAt) {
  const target = timing.floorMs + (timing.jitterMs > 0 ? crypto.randomInt(0, timing.jitterMs + 1) : 0);
  const left = target - (Date.now() - startedAt);
  if (left > 0) await sleep(left);
}

const NO_STORE = { 'Cache-Control': 'no-store, private' };

function changedEmailText() {
  return [
    'The password for your olivesegypt.com account (CRM and analytics) was just changed,',
    'and every device that was signed in has been signed out.',
    '',
    "If this was you, there is nothing to do. If it wasn't, request a new reset link from",
    'the sign-in page straight away and tell the site owner.',
  ].join('\n');
}

module.exports = {
  HASH, LEGACY, DUMMY_HASH, hashPassword, verifyPassword, parseHash,
  PASSWORD_MIN, PASSWORD_MAX, passwordProblem,
  RESET_TTL_MINUTES, newResetToken, tokenHash, wellFormedToken, sameHash,
  clientIp, ipHash, appBaseUrl, isRoleMailbox, usableEmail,
  createStore, deployEnv, prepare, resetPreparedForTests,
  audit, countSafe, maybeAlert, LIMITS_PER, ALERT,
  timing, padTo, sleep, NO_STORE, changedEmailText,
};
