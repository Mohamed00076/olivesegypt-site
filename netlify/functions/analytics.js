'use strict';

const { parseCookies, verifySession, COOKIE_NAME, json } = require('./_lib');

const RANGES = { '7d': 7, '30d': 30, '90d': 90 };

const REPORTS = {
  summary: null,
  timeseries: { path: 'pageviews' },
  country: { path: 'metrics', metric: 'country' },
  referrer: { path: 'metrics', metric: 'referrer' },
  pages: { path: 'metrics', metric: 'path' },
  browser: { path: 'metrics', metric: 'browser' },
  device: { path: 'metrics', metric: 'device' },
  os: { path: 'metrics', metric: 'os' },
};

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

async function umamiGet(cfg, pathAndQuery) {
  if (!cachedToken) cachedToken = await umamiLogin(cfg);

  const doFetch = (token) =>
    fetch(`${cfg.url}${pathAndQuery}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

  let r = await doFetch(cachedToken);
  if (r.status === 401) {
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

function numval(v) {
  if (v && typeof v === 'object' && 'value' in v) return Number(v.value) || 0;
  return Number(v) || 0;
}

function buildSummary(raw) {
  const pageviews = numval(raw.pageviews);
  const visitors = numval(raw.visitors);
  const visits = numval(raw.visits);
  const bounces = numval(raw.bounces);
  const totaltime = numval(raw.totaltime);
  const bounceRate = visits > 0 ? bounces / visits : 0;
  const avgDuration = visits > 0 ? totaltime / visits : 0;
  return { pageviews, visitors, visits, bounces, totaltime, bounceRate, avgDuration };
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return json(405, { error: 'Method not allowed' }, { Allow: 'GET' });
  }

  const SESSION_SECRET = process.env.SESSION_SECRET;
  const token = SESSION_SECRET ? parseCookies(event.headers)[COOKIE_NAME] : null;
  const session = token ? verifySession(token, SESSION_SECRET) : null;
  if (!session) {
    return json(401, { error: 'Unauthorized' }, { 'Cache-Control': 'no-store, private' });
  }

  const q = event.queryStringParameters || {};
  const report = typeof q.report === 'string' ? q.report : 'summary';
  if (!Object.prototype.hasOwnProperty.call(REPORTS, report)) {
    return json(400, { error: 'Unknown report' });
  }

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
    return json(400, { error: 'Invalid time range' });
  }

  const limit = Math.min(Math.max(Number(q.limit) || 10, 1), 50);

  const cfg = umamiConfig();
  if (!cfg.url || !cfg.username || !cfg.password || !cfg.websiteId) {
    console.error('[analytics] UMAMI_* env vars not fully configured');
    return json(503, { error: 'Analytics not configured' });
  }

  const id = encodeURIComponent(cfg.websiteId);
  const window = `startAt=${startAt}&endAt=${endAt}`;

  try {
    if (report === 'summary') {
      const raw = await umamiGet(cfg, `/api/websites/${id}/stats?${window}`);
      return json(200, buildSummary(raw || {}), { 'Cache-Control': 'no-store, private' });
    }

    if (report === 'timeseries') {
      const spanDays = (endAt - startAt) / (24 * 60 * 60 * 1000);
      const unit = spanDays <= 7 ? 'hour' : 'day';
      const data = await umamiGet(cfg, `/api/websites/${id}/pageviews?${window}&unit=${unit}&timezone=UTC`);
      const pv = Array.isArray(data && data.pageviews) ? data.pageviews : [];
      const se = Array.isArray(data && data.sessions) ? data.sessions : [];
      return json(200, { unit, pageviews: pv, sessions: se }, { 'Cache-Control': 'no-store, private' });
    }

    const spec = REPORTS[report];
    const data = await umamiGet(cfg, `/api/websites/${id}/metrics?type=${spec.metric}&${window}&limit=${limit}`);
    const rows = Array.isArray(data) ? data : [];
    return json(200, rows, { 'Cache-Control': 'no-store, private' });
  } catch (err) {
    cachedToken = null;
    console.error('[analytics] upstream error:', err?.message ?? err);
    return json(502, { error: 'Analytics upstream unavailable' });
  }
};
