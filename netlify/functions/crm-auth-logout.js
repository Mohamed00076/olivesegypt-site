'use strict';

const { clearCrmSessionCookie, json } = require('./_crm_lib');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { ok: false, error: 'Method not allowed' }, { Allow: 'POST' });
  }
  return json(200, { ok: true }, { 'Set-Cookie': clearCrmSessionCookie() });
};
