'use strict';

const {
  verifyPassword,
  safeEqualStr,
  signSession,
  sessionCookie,
  readJsonBody,
  SESSION_TTL_SECONDS,
} = require('../_lib');

// Best-effort in-memory rate limit. NOTE: serverless instances are ephemeral
// and horizontally scaled, so this only slows brute force within a single warm
// instance — it is NOT a real global limiter. Documented as best-effort only.
// A real limiter needs a shared store (KV/Upstash); out of scope for now.
const attempts = new Map(); // ip -> { count, resetAt }
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 20;

function rateLimited(ip) {
  const now = Date.now();
  const rec = attempts.get(ip);
  if (!rec || rec.resetAt < now) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  rec.count += 1;
  return rec.count > MAX_ATTEMPTS;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
  const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH;
  const SESSION_SECRET = process.env.SESSION_SECRET;

  // Misconfiguration must never be reported as a valid/invalid login.
  if (!ADMIN_USERNAME || !ADMIN_PASSWORD_HASH || !SESSION_SECRET) {
    return res.status(500).json({ ok: false, error: 'Server not configured' });
  }

  const ip =
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    (req.socket && req.socket.remoteAddress) ||
    'unknown';

  if (rateLimited(ip)) {
    return res
      .status(429)
      .json({ ok: false, error: 'Too many attempts. Please try again later.' });
  }

  const body = (await readJsonBody(req)) || {};
  const username = typeof body.username === 'string' ? body.username : '';
  const password = typeof body.password === 'string' ? body.password : '';

  // Evaluate BOTH checks unconditionally so the response time doesn't reveal
  // which field was wrong (blunts user enumeration). verifyPassword always runs
  // a full scrypt derivation regardless of the username result.
  const userOk = safeEqualStr(username, ADMIN_USERNAME);
  const passOk = verifyPassword(password, ADMIN_PASSWORD_HASH);

  if (!userOk || !passOk) {
    // 200 + {ok:false}: the client checks `v.ok && S.ok`, so a 200 guarantees
    // v.json() succeeds and the generic error is shown. Never leak which failed.
    return res
      .status(200)
      .json({ ok: false, error: 'Incorrect username or password. Please try again.' });
  }

  const token = signSession(ADMIN_USERNAME, SESSION_SECRET);
  res.setHeader('Set-Cookie', sessionCookie(token, SESSION_TTL_SECONDS));
  return res.status(200).json({ ok: true, user: { username: ADMIN_USERNAME } });
};
