'use strict';

// Shared auth helpers for the Triple Company dashboard.
// Pure Node built-ins (crypto) — no external deps, no package.json required.
// Files/dirs beginning with "_" are NOT routed as functions by Vercel, so this
// module is import-only and never reachable as an HTTP endpoint.

const crypto = require('crypto');

const COOKIE_NAME = 'tc_session';
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

// ---- small utils -----------------------------------------------------------

function b64url(buf) {
  return Buffer.from(buf).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlToBuf(str) {
  str = String(str).replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return Buffer.from(str, 'base64');
}

// Constant-time string compare that never short-circuits on length.
// Hashing both sides to a fixed width means length differences don't leak and
// timingSafeEqual won't throw on mismatched lengths.
function safeEqualStr(a, b) {
  const ha = crypto.createHash('sha256').update(String(a), 'utf8').digest();
  const hb = crypto.createHash('sha256').update(String(b), 'utf8').digest();
  return crypto.timingSafeEqual(ha, hb);
}

// ---- password verification -------------------------------------------------

// ADMIN_PASSWORD_HASH format: "scrypt:<saltHex>:<hashHex>"
// hash = scryptSync(password, Buffer.from(saltHex,'hex'), 32) with Node defaults
// (N=16384, r=8, p=1). Verify by re-deriving and timing-safe comparing.
function verifyPassword(password, stored) {
  if (typeof stored !== 'string') return false;
  const parts = stored.split(':');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const salt = Buffer.from(parts[1], 'hex');
  const expected = Buffer.from(parts[2], 'hex');
  if (salt.length === 0 || expected.length !== 32) return false;
  let derived;
  try {
    derived = crypto.scryptSync(String(password), salt, expected.length);
  } catch {
    return false;
  }
  // Lengths are equal by construction (both 32), safe to compare directly.
  return crypto.timingSafeEqual(derived, expected);
}

// ---- session token (stateless, HMAC-signed) --------------------------------

function hmac(payloadB64, secret) {
  return crypto.createHmac('sha256', String(secret)).update(payloadB64).digest();
}

function signSession(username, secret) {
  const now = Math.floor(Date.now() / 1000);
  const payload = { sub: username, iat: now, exp: now + SESSION_TTL_SECONDS };
  const payloadB64 = b64url(JSON.stringify(payload));
  const sig = b64url(hmac(payloadB64, secret));
  return payloadB64 + '.' + sig;
}

// Returns the payload object if the token is authentic and unexpired, else null.
function verifySession(token, secret) {
  if (typeof token !== 'string') return null;
  const dot = token.indexOf('.');
  if (dot <= 0) return null;
  const payloadB64 = token.slice(0, dot);
  const sigB64 = token.slice(dot + 1);
  if (!payloadB64 || !sigB64) return null;

  const expectedSig = hmac(payloadB64, secret);
  const givenSig = b64urlToBuf(sigB64);
  // timingSafeEqual throws on length mismatch — guard it.
  if (givenSig.length !== expectedSig.length) return null;
  if (!crypto.timingSafeEqual(givenSig, expectedSig)) return null;

  let payload;
  try {
    payload = JSON.parse(b64urlToBuf(payloadB64).toString('utf8'));
  } catch {
    return null;
  }
  const now = Math.floor(Date.now() / 1000);
  if (!payload || typeof payload.exp !== 'number' || payload.exp < now) return null;
  return payload;
}

// ---- cookies ---------------------------------------------------------------

function parseCookies(req) {
  const header = req.headers && req.headers.cookie;
  const out = {};
  if (!header) return out;
  for (const pair of header.split(';')) {
    const idx = pair.indexOf('=');
    if (idx < 0) continue;
    const k = pair.slice(0, idx).trim();
    const v = pair.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

function sessionCookie(value, maxAgeSeconds) {
  // HttpOnly + Secure + SameSite=Lax + Path=/. olivesegypt.com is HTTPS-only.
  const attrs = [
    `${COOKIE_NAME}=${value}`,
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    'Path=/',
    `Max-Age=${maxAgeSeconds}`,
  ];
  return attrs.join('; ');
}

// ---- request body ----------------------------------------------------------

// Vercel's Node runtime usually pre-parses JSON into req.body, but fall back to
// reading the raw stream so the handler works regardless of runtime behavior.
async function readJsonBody(req) {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'string') {
      try { return JSON.parse(req.body); } catch { return null; }
    }
    if (typeof req.body === 'object') return req.body;
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1_000_000) return null; // 1MB cap — reject oversized bodies
    chunks.push(chunk);
  }
  if (chunks.length === 0) return null;
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return null;
  }
}

module.exports = {
  COOKIE_NAME,
  SESSION_TTL_SECONDS,
  verifyPassword,
  safeEqualStr,
  signSession,
  verifySession,
  parseCookies,
  sessionCookie,
  readJsonBody,
};
