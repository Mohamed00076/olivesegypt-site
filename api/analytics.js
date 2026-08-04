'use strict';

const { parseCookies, verifySession, COOKIE_NAME } = require('./_lib');

// ---------------------------------------------------------------------------
// /api/analytics — owner-only proxy in front of the self-hosted Umami instance.
//
// The admin dashboard (admin/analytics/index.html) is the only client. It calls
//   GET /api/analytics?report=<type>&range=<7d|30d|90d>
// and expects clean JSON. This function:
//   1. Auth-gates on the tc_session cookie (same path as api/auth/me.js). No
//      valid session -> 401, no data. Analytics is owner-only.
//   2. Logs in to Umami once with the UMAMI_* env creds, caches the bearer JWT
//      in module scope, and re-logs-in on a 401 (the token has no expiry; it is
//      only invalidated by a password change / APP_SECRET rotation).
//   3. Proxies the matching Umami stats endpoint and returns its JSON.
//
// The Umami token and credentials NEVER leave this function — only computed
// stats are returned to the client.
// ---------------------------------------------------------------------------

const RANGES = { '7d': 7, '30d': 30, '90d': 90 };

// report -> how to build the upstream Umami request.
const REPORTS = {
  summary: null, // special-cased: /stats + derived bounceRate/avgDuration
  timeseries: { path: 'pageviews' },
  country: { path: 'metrics', metric: 'country' },
  referrer: { path: 'metrics', metric: 'referrer' },
  pages: { path: 'metrics', metric: 'path' },
  browser: { path: 'metrics', metric: 'browser' },
  device: { path: 'metrics', metric: 'device' },
  os: { path: 'metrics', metric: 'os' },
};

// Cached Umami bearer, shared across warm invocations of this instance.
let cachedToken = null;

function umamiConfig() {
  const url = (process.env.UMAMI_URL || '').replace(/\/+$/, '');
  return {
    url,
    username: process.env.UMAMI_USERNAME || '',
    password: process.env.UMAMI_PASSWORD || '',
    websiteId: process.env.UMAMI_WEBSITE_ID || '',
  };
}

// Log in to Umami and return a fresh bearer token. Throws on failure.
async function umamiLogin(cfg) {
  const r = await fetch(`${cfg.url}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: cfg.username, password: cfg.password }),
  });
  if (!r.ok) {
    const body = await r.text().catch(() => '');
    throw new Error(`umami login ${r.status}: ${body.slice(0, 200)}`);
  }
  const data = await r.json().catch(() => null);
  if (!data || typeof data.token !== 'string' || !data.token) {
    throw new Error('umami login: no token in response');
  }
  return data.token;
}

// GET an authenticated Umami endpoint, transparently re-logging-in once on a
// 401 (stale/rotated token). Returns the parsed JSON body.
async function umamiGet(cfg, pathAndQuery) {
  if (!cachedToken) cachedToken = await umamiLogin(cfg);

  const doFetch = (token) =>
    fetch(`${cfg.url}${pathAndQuery}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

  let r = await doFetch(cachedToken);
  if (r.status === 401) {
    // Token was invalidated (password change / APP_SECRET rotation). Re-login
    // once and retry. A second 401 is a real auth failure -> surface it.
    cachedToken = await umamiLogin(cfg);
    r = await doFetch(cachedToken);
  }
  if (!r.ok) {
    const body = await r.text().catch(() => '');
    throw new Error(`umami ${r.status} on ${pathAndQuery}: ${body.slice(0, 200)}`);
  }
  const data = await r.json().catch(() => null);
  if (data == null) throw new Error(`umami: non-JSON response on ${pathAndQuery}`);
  return data;
}

// Umami v3.2.0 may wrap each summary stat as { value, prev } instead of a bare
// number. Accept either shape.
function numval(v) {
  if (v && typeof v === 'object' && 'value' in v) return Number(v.value) || 0;
  return Number(v) || 0;
}

function buildSummary(raw) {
  const pageviews = numval(raw.pageviews);
  const visitors = numval(raw.visitors);
  const visits = numval(raw.visits);
  const bounces = numval(raw.bounces);
  const totaltime = numval(raw.totaltime); // seconds

  // Guard divide-by-zero (a fresh site with no visits). bounceRate is a 0..1
  // fraction; avgDuration is seconds/visit.
  const bounceRate = visits > 0 ? bounces / visits : 0;
  const avgDuration = visits > 0 ? totaltime / visits : 0;

  return {
    pageviews,
    visitors,
    visits,
    bounces,
    totaltime,
    bounceRate,
    avgDuration,
  };
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, private');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // --- Auth gate: owner-only. Same verification as api/auth/me.js. ----------
  const SESSION_SECRET = process.env.SESSION_SECRET;
  const token = SESSION_SECRET ? parseCookies(req)[COOKIE_NAME] : null;
  const session = token ? verifySession(token, SESSION_SECRET) : null;
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // --- Parse the request ----------------------------------------------------
  const q = req.query || {};
  const report = typeof q.report === 'string' ? q.report : 'summary';
  if (!Object.prototype.hasOwnProperty.call(REPORTS, report)) {
    return res.status(400).json({ error: 'Unknown report' });
  }

  // Time window: explicit startAt/endAt (epoch ms) win; else derive from range.
  let startAt;
  let endAt = Number(q.endAt);
  if (!Number.isFinite(endAt) || endAt <= 0) endAt = Date.now();
  const startParam = Number(q.startAt);
  if (Number.isFinite(startParam) && startParam > 0) {
    startAt = startParam;
  } else {
    const range = typeof q.range === 'string' ? q.range : '30d';
    const days = RANGES[range] || RANGES['30d'];
    startAt = endAt - days * 24 * 60 * 60 * 1000;
  }
  if (startAt >= endAt) {
    return res.status(400).json({ error: 'Invalid time range' });
  }

  const limit = Math.min(Math.max(Number(q.limit) || 10, 1), 50);

  // --- Config check ---------------------------------------------------------
  const cfg = umamiConfig();
  if (!cfg.url || !cfg.username || !cfg.password || !cfg.websiteId) {
    console.error('[analytics] UMAMI_* env vars not fully configured');
    return res.status(503).json({ error: 'Analytics not configured' });
  }

  const id = encodeURIComponent(cfg.websiteId);
  const window = `startAt=${startAt}&endAt=${endAt}`;

  // --- Proxy ----------------------------------------------------------------
  try {
    if (report === 'summary') {
      const raw = await umamiGet(cfg, `/api/websites/${id}/stats?${window}`);
      return res.status(200).json(buildSummary(raw || {}));
    }

    if (report === 'timeseries') {
      // unit auto-scales with range: <= 7d -> hour, else day. Keeps the line
      // chart legible without swamping it with points.
      const spanDays = (endAt - startAt) / (24 * 60 * 60 * 1000);
      const unit = spanDays <= 7 ? 'hour' : 'day';
      const data = await umamiGet(
        cfg,
        `/api/websites/${id}/pageviews?${window}&unit=${unit}&timezone=UTC`
      );
      const pv = Array.isArray(data && data.pageviews) ? data.pageviews : [];
      const se = Array.isArray(data && data.sessions) ? data.sessions : [];
      return res.status(200).json({ unit, pageviews: pv, sessions: se });
    }

    // metrics: country | referrer | path | browser | device | os
    const spec = REPORTS[report];
    const data = await umamiGet(
      cfg,
      `/api/websites/${id}/metrics?type=${spec.metric}&${window}&limit=${limit}`
    );
    const rows = Array.isArray(data) ? data : [];
    return res.status(200).json(rows);
  } catch (err) {
    // Umami unreachable / login failed / bad upstream response. Return a clean
    // 502 (bad upstream) — never a 500 crash-loop. Reset the cached token so a
    // transient auth error self-heals on the next request.
    cachedToken = null;
    console.error('[analytics] upstream error:', err && err.message ? err.message : err);
    return res.status(502).json({ error: 'Analytics upstream unavailable' });
  }
};
