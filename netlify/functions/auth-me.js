'use strict';

const { parseCookies, verifySession, COOKIE_NAME, json } = require('./_lib');

exports.handler = async (event) => {
  const SESSION_SECRET = process.env.SESSION_SECRET;
  const unauth = () => json(200, { authenticated: false, user: null }, { 'Cache-Control': 'no-store, private' });

  if (!SESSION_SECRET) return unauth();

  const cookies = parseCookies(event.headers);
  const token = cookies[COOKIE_NAME];
  if (!token) return unauth();

  const payload = verifySession(token, SESSION_SECRET);
  if (!payload) return unauth();

  return json(200, { authenticated: true, user: { username: payload.sub } }, { 'Cache-Control': 'no-store, private' });
};
