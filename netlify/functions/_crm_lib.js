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

module.exports = {
  CRM_COOKIE_NAME,
  CRM_SESSION_TTL_SECONDS,
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
