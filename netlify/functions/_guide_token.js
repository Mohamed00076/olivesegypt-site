'use strict';

/*
 * Short-lived signed tokens that unlock the three gated guides.
 *
 * Background: until now the "gate" was decoration. The three guide pages
 * were ordinary static HTML at guessable URLs, and the form only revealed
 * a link on the client side -- anyone who typed the URL read the guide
 * without ever filling anything in (docs/downloads-and-gating.md §3).
 * The guide HTML now lives in _guides/ and is served only by guide.js,
 * which requires one of these tokens.
 *
 * Two tokens are issued per successful lead, deliberately with different
 * lifetimes:
 *
 *   - the cookie token (24h) is HttpOnly and cannot leave the browser it
 *     was set in, so a longer window costs nothing;
 *   - the URL token (1h) travels in a link that can be copied, pasted
 *     into a chat, or landed in someone's history, so it dies quickly.
 *
 * The URL token exists only because a cookie-only gate breaks for anyone
 * whose browser blocks first-party cookies -- they would fill the form,
 * be handed a link, and be refused by it. That reads as a broken site,
 * not as a gate.
 *
 * Key separation: these are signed with a key *derived* from
 * SESSION_SECRET, not with SESSION_SECRET itself. Admin and CRM sessions
 * (_lib.js signSession) use the raw secret with the same HMAC-SHA256 and
 * the same payload.signature shape, so without this derivation a guide
 * token and a session token would be structurally interchangeable. They
 * are not meant to be.
 */

const crypto = require('crypto');

const COOKIE_NAME = 'tc_guide';
const COOKIE_TTL_SECONDS = 24 * 60 * 60;
const URL_TTL_SECONDS = 60 * 60;
const KEY_CONTEXT = 'tc-guide-token-v1';

// Which segment (the value POST /api/leads already records) unlocks which
// guide. One token unlocks one guide -- filling the buyer's-guide form
// does not hand over the pricing guide.
const GUIDES = {
  buyers_guide: 'buyers-guide',
  origin_guide: 'origin-comparison-guide',
  pricing_guide: 'pricing-packaging-guide',
};

function b64url(buf) {
  return Buffer.from(buf).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlToBuf(str) {
  let s = String(str).replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return Buffer.from(s, 'base64');
}

function guideKey(secret) {
  return crypto.createHmac('sha256', String(secret)).update(KEY_CONTEXT).digest();
}

function sign(payloadB64, secret) {
  return crypto.createHmac('sha256', guideKey(secret)).update(payloadB64).digest();
}

function signGuideToken(segment, secret, ttlSeconds) {
  if (!secret || !GUIDES[segment]) return null;
  const now = Math.floor(Date.now() / 1000);
  const payloadB64 = b64url(JSON.stringify({ g: segment, exp: now + ttlSeconds }));
  return payloadB64 + '.' + b64url(sign(payloadB64, secret));
}

/*
 * Returns the segment the token unlocks, or null. Null covers every
 * failure the same way -- wrong shape, bad signature, expired, unknown
 * segment -- because the caller has nothing useful to do with the
 * difference and a visitor has nothing to learn from it.
 */
function verifyGuideToken(token, secret) {
  if (typeof token !== 'string' || !secret) return null;
  const dot = token.indexOf('.');
  if (dot <= 0) return null;
  const payloadB64 = token.slice(0, dot);
  const sigB64 = token.slice(dot + 1);
  if (!payloadB64 || !sigB64) return null;

  const expected = sign(payloadB64, secret);
  const given = b64urlToBuf(sigB64);
  if (given.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(given, expected)) return null;

  let payload;
  try {
    payload = JSON.parse(b64urlToBuf(payloadB64).toString('utf8'));
  } catch {
    return null;
  }
  if (!payload || typeof payload !== 'object') return null;
  if (!Number.isFinite(payload.exp) || payload.exp <= Math.floor(Date.now() / 1000)) return null;
  if (!GUIDES[payload.g]) return null;
  return payload.g;
}

// Path=/ because the Arabic guides live under /ar/downloads and the
// English ones under /downloads; one cookie has to cover both. HttpOnly
// keeps it out of reach of any script on the page, and Secure means it
// never travels over plain HTTP.
function guideCookie(token) {
  return [
    `${COOKIE_NAME}=${token}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    `Max-Age=${COOKIE_TTL_SECONDS}`,
  ].join('; ');
}

module.exports = {
  GUIDES,
  COOKIE_NAME,
  COOKIE_TTL_SECONDS,
  URL_TTL_SECONDS,
  signGuideToken,
  verifyGuideToken,
  guideCookie,
};
