'use strict';

const { json } = require('./_crm_lib');
const { currentCrmSession } = require('./_sessions');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return json(405, { ok: false, error: 'Method not allowed' }, { Allow: 'GET' });
  }
  const session = await currentCrmSession(event);
  if (!session) {
    return json(401, { ok: false, error: 'Unauthorized' }, { 'Cache-Control': 'no-store, private' });
  }
  return json(200, { ok: true, user: { username: session.sub } }, { 'Cache-Control': 'no-store, private' });
};
