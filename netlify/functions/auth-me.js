'use strict';

const { json } = require('./_lib');
const { currentAdminSession } = require('./_sessions');

exports.handler = async (event) => {
  const SESSION_SECRET = process.env.SESSION_SECRET;
  const unauth = () => json(200, { authenticated: false, user: null }, { 'Cache-Control': 'no-store, private' });

  if (!SESSION_SECRET) return unauth();

  // Checked against its account (_sessions.js): a reset ends it here too.
  const payload = await currentAdminSession(event);
  if (!payload) return unauth();

  return json(200, { authenticated: true, user: { username: payload.sub } }, { 'Cache-Control': 'no-store, private' });
};
