'use strict';

/*
 * Section J Phase 3, item 5 -- Search Console integration. Uses
 * google-auth-library's JWT client for service-account auth (the
 * standard pattern for automated/server-to-server access -- avoids an
 * interactive OAuth consent flow, which this static-site-plus-functions
 * architecture has no clean way to host a callback for). Read-only scope
 * only (webmasters.readonly) -- this file never calls anything but the
 * Search Analytics query endpoint, never the Indexing API or anything
 * that could submit/change your live indexing state (Rule 14).
 *
 * Fully disabled unless GSC_SERVICE_ACCOUNT_EMAIL, GSC_SERVICE_ACCOUNT_
 * PRIVATE_KEY, and GSC_SITE_URL are all set AND the search_console_
 * enabled setting is explicitly turned on in the dashboard -- see
 * search-console-import.js, which checks the enabled flag before this
 * file's client is even constructed.
 */

const { JWT } = require('google-auth-library');

const SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';
const MAX_ROWS_PER_REQUEST = 25000; // Search Console API's own documented cap

function configured() {
  return !!(process.env.GSC_SERVICE_ACCOUNT_EMAIL && process.env.GSC_SERVICE_ACCOUNT_PRIVATE_KEY && process.env.GSC_SITE_URL);
}

function getClient() {
  // Netlify env vars can't hold real newlines cleanly -- the private key
  // is expected with literal "\n" sequences, unescaped here same as any
  // standard service-account JSON key pasted into a single-line env var.
  const key = String(process.env.GSC_SERVICE_ACCOUNT_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  return new JWT({
    email: process.env.GSC_SERVICE_ACCOUNT_EMAIL,
    key,
    scopes: [SCOPE],
  });
}

// Fetches one page of Search Analytics rows for [startDate, endDate]
// (inclusive, 'YYYY-MM-DD', in Search Console's own reporting timezone --
// see the note in search-console-import.js on what that actually means),
// dimensioned by date/query/page/device, paginating via startRow.
async function fetchSearchAnalytics({ startDate, endDate, startRow = 0 }) {
  if (!configured()) throw new Error('Search Console is not configured (missing env vars)');
  const client = getClient();
  const siteUrl = encodeURIComponent(process.env.GSC_SITE_URL);

  const res = await client.request({
    url: `https://www.googleapis.com/webmasters/v3/sites/${siteUrl}/searchAnalytics/query`,
    method: 'POST',
    data: {
      startDate,
      endDate,
      dimensions: ['date', 'query', 'page', 'device'],
      rowLimit: MAX_ROWS_PER_REQUEST,
      startRow,
    },
  });

  return Array.isArray(res.data && res.data.rows) ? res.data.rows : [];
}

module.exports = { configured, fetchSearchAnalytics, SCOPE, MAX_ROWS_PER_REQUEST };
