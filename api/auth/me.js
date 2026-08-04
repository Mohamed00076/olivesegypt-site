'use strict';

const { parseCookies, verifySession, COOKIE_NAME } = require('../_lib');

// Client contract (from bundle):
//   fetch('/api/auth/me').then(r => r.json())
//     .then(n => n.authenticated && n.user ? authenticated : unauthenticated)
//     .catch(() => unauthenticated)
// Always return 200 + valid JSON so r.json() never throws. Authenticated needs
// { authenticated:true, user:{...truthy...} }. `user` fields are never rendered
// by the app (only truthiness is checked), but we return { username } for
// correctness. Unauthenticated returns { authenticated:false, user:null }.
module.exports = async (req, res) => {
  const SESSION_SECRET = process.env.SESSION_SECRET;
  // Never cache auth state.
  res.setHeader('Cache-Control', 'no-store, private');

  const unauth = () => res.status(200).json({ authenticated: false, user: null });

  if (!SESSION_SECRET) return unauth();

  const cookies = parseCookies(req);
  const token = cookies[COOKIE_NAME];
  if (!token) return unauth();

  const payload = verifySession(token, SESSION_SECRET);
  if (!payload) return unauth();

  return res
    .status(200)
    .json({ authenticated: true, user: { username: payload.sub } });
};
