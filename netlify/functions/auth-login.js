'use strict';

const {
  verifyPassword,
  safeEqualStr,
  signSession,
  sessionCookie,
  readJsonBody,
  SESSION_TTL_SECONDS,
  json,
} = require('./_lib');

const attempts = new Map();
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

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { ok: false, error: 'Method not allowed' }, { Allow: 'POST' });
  }

  const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
  const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH;
  const SESSION_SECRET = process.env.SESSION_SECRET;

  if (!ADMIN_USERNAME || !ADMIN_PASSWORD_HASH || !SESSION_SECRET) {
    return json(500, { ok: false, error: 'Server not configured' });
  }

  const ip =
    (event.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    'unknown';

  if (rateLimited(ip)) {
    return json(429, { ok: false, error: 'Too many attempts. Please try again later.' });
  }

  const body = readJsonBody(event) || {};
  const username = typeof body.username === 'string' ? body.username : '';
  const password = typeof body.password === 'string' ? body.password : '';

  const userOk = safeEqualStr(username, ADMIN_USERNAME);
  const passOk = verifyPassword(password, ADMIN_PASSWORD_HASH);

  if (!userOk || !passOk) {
    return json(200, { ok: false, error: 'Incorrect username or password. Please try again.' });
  }

  const token = signSession(ADMIN_USERNAME, SESSION_SECRET);
  return json(200, { ok: true, user: { username: ADMIN_USERNAME } }, {
    'Set-Cookie': sessionCookie(token, SESSION_TTL_SECONDS),
  });
};
