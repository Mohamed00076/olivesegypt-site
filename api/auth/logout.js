'use strict';

const { sessionCookie } = require('../_lib');

// Client contract: `await fetch('/api/auth/logout',{method:'POST'}); navigate('/login')`
// The client ignores the response body entirely — it just awaits the request.
// We clear the cookie (Max-Age=0) and return a success shape.
module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }
  // Overwrite the cookie with an empty, immediately-expiring value. Must match
  // the original attributes (Path, etc.) so the browser replaces it.
  res.setHeader('Set-Cookie', sessionCookie('', 0));
  return res.status(200).json({ ok: true });
};
