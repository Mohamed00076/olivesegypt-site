'use strict';

/*
 * A CRM page could not load something: record it like any other failure
 * (2026-10-20, owner: "every failed load also recorded server-side and
 * alerted like other failures").
 *
 * The functions record their own failures in their catch blocks. What they
 * cannot record is a load that never reached them or never came back --
 * a timeout, a deploy in progress, a dropped connection -- or a load they
 * refused. The page reports those here (CRM.reportLoadFailure in
 * assets/crm.js), and this writes them through the same reportFailure as
 * everything else: a row in crm_failures for the dashboard's "Something
 * failed" box, and the throttled alert email.
 *
 * Only what the page knows and nothing a caller can use to write free text:
 * the page path (a CRM path, checked), which load failed (one of a fixed
 * list), how it failed (no reply, or refused with a 4xx status). A CRM
 * session is required, so nobody outside can fill the dashboard with noise,
 * and each function instance takes at most 30 reports a minute.
 */

const { neon } = require('@neondatabase/serverless');
const { reportFailure } = require('./_failure_lib');
const { requireCrmSession, readJsonBody, json } = require('./_crm_lib');

function connectionString() {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_URL_UNPOOLED ||
    ''
  );
}

// The loads the CRM pages make, by the names the pages report them under.
const WHAT = new Set([
  'dashboard', 'enquiries', 'leads', 'buyers-list', 'buyer', 'buyer-documents', 'buyer-files',
  'kanban', 'documents-list', 'document', 'document-source', 'last-bank-details', 'data-quality',
]);
const KINDS = { 'no-reply': 'no reply from the server', refused: 'refused by the server' };
const PER_MINUTE = 30;
let windowStart = 0;
let windowCount = 0;

exports.handler = async (event) => {
  const session = requireCrmSession(event);
  if (!session) return json(401, { ok: false, error: 'Unauthorized' }, { 'Cache-Control': 'no-store, private' });
  if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'Method not allowed' }, { Allow: 'POST' });

  const body = readJsonBody(event) || {};
  const page = typeof body.page === 'string' ? body.page : '';
  const what = typeof body.what === 'string' ? body.what : '';
  const kind = typeof body.kind === 'string' ? body.kind : '';
  const status = body.status == null ? null : Number(body.status);
  if (!/^\/crm\/[a-z/-]{0,40}$/.test(page) || !WHAT.has(what) || !KINDS[kind] ||
      (kind === 'refused' ? !(Number.isInteger(status) && status >= 400 && status <= 499) : status !== null)) {
    return json(400, { ok: false, error: 'Validation failed' });
  }

  const now = Date.now();
  if (now - windowStart > 60000) { windowStart = now; windowCount = 0; }
  if (++windowCount > PER_MINUTE) return json(429, { ok: false, error: 'Too many reports' });

  const cs = connectionString();
  // No database configured: reportFailure still sends the alert email.
  const sql = cs ? neon(cs) : null;
  const step = `${page}: ${what}, ${KINDS[kind]}${status ? ` (HTTP ${status})` : ''}`;
  await reportFailure(sql, { source: 'crm-page', method: 'GET', step, actor: session.sub },
    new Error(`A CRM page could not load ${what}: ${KINDS[kind]}`));
  return json(200, { ok: true });
};
