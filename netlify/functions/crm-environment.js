'use strict';

/*
 * Which database this copy of the CRM is connected to (2026-10-20, owner:
 * "a visible STAGING or PREVIEW badge in the CRM whenever the deploy is not
 * production, so I can tell at a glance that I am not on live data").
 *
 * The page knows from its own address whether it is the live site; what it
 * cannot know is the database. A deploy preview uses the staging database
 * only once Netlify's database variables are set for previews (step L1 of
 * the password-reset staging sheet) -- until then it reads and writes the
 * live one. So the badge asks here.
 *
 * The staging database carries a label: one row, 'staging', in the table
 * deployment_marker (staging sheet, step N3), which must never exist on the
 * live database (step N6). This reads it and reports one of two answers:
 *   'staging'    -- the label is there;
 *   'unlabelled' -- it is not, which on a preview means: treat it as live.
 * It never creates the table and never writes: a check that labelled the
 * live database as it looked would defeat the point.
 *
 * A CRM session is required, like every CRM read.
 */

const { neon } = require('@neondatabase/serverless');
const { reportFailure } = require('./_failure_lib');
const { requireCrmSession, json } = require('./_crm_lib');

function connectionString() {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_URL_UNPOOLED ||
    ''
  );
}

exports.handler = async (event) => {
  const session = requireCrmSession(event);
  if (!session) return json(401, { ok: false, error: 'Unauthorized' }, { 'Cache-Control': 'no-store, private' });
  if (event.httpMethod !== 'GET') return json(405, { ok: false, error: 'Method not allowed' }, { Allow: 'GET' });

  const cs = connectionString();
  if (!cs) return json(500, { ok: false, error: 'Server not configured' });
  const sql = neon(cs);
  try {
    const present = (await sql`SELECT to_regclass('public.deployment_marker') IS NOT NULL AS present`)[0].present;
    let database = 'unlabelled';
    if (present) {
      const rows = await sql`SELECT environment FROM deployment_marker WHERE environment = 'staging' LIMIT 1`;
      if (rows.length) database = 'staging';
    }
    return json(200, { ok: true, database }, { 'Cache-Control': 'no-store, private' });
  } catch (err) {
    console.error('[crm-environment] error:', err?.message ?? err);
    await reportFailure(sql, { source: 'crm-environment', method: 'GET', actor: session.sub }, err);
    return json(500, { ok: false, error: 'Server error' });
  }
};
