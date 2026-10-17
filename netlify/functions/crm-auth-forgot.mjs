// "Forgot password" (/api/crm/auth/forgot), in Netlify's newer function
// format: a default export taking a web Request and Netlify's context, so
// context.waitUntil can finish the account work after the answer is sent.
// The newer format is ES modules only; the work itself is in
// _forgot_core.js, which explains what happens before and after the answer.

import core from './_forgot_core.js';
// Not used here. Netlify's bundler for this format only packs npm packages
// it sees imported from this file; one required only inside the CommonJS
// files above is left out, and the function then fails on Netlify with
// "Cannot find module" (seen with @netlify/zip-it-and-ship-it 16.3.1,
// 2026-10-17). scripts/check-password-reset.js holds this list to the
// packages those files require.
import '@neondatabase/serverless';

export default async (req, context) => {
  const r = await core.handle({
    method: req.method,
    readBody: () => req.text(),
    headers: Object.fromEntries(req.headers),
    contextIp: context && context.ip,
    waitUntil: context && typeof context.waitUntil === 'function' ? (p) => context.waitUntil(p) : null,
  });
  return new Response(r.body, { status: r.statusCode, headers: r.headers });
};
