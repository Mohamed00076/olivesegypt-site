'use strict';

/*
 * The company-name review pass. READ ONLY, on purpose.
 *
 * This endpoint finds records whose company_name looks wrong and reports them.
 * It changes nothing and offers no way to change anything: the owner's
 * instruction was explicit -- "do NOT silently auto-correct or delete existing
 * bad data ... present the full list to me for review before changing
 * anything" -- and guessing what "Dr" was meant to say would replace a visible
 * problem with an invisible one.
 *
 * Fixing a record is therefore an ordinary edit on that buyer's own page, made
 * by a person who knows which company it is. This page only tells them where
 * to look.
 *
 * It applies exactly the same rules the API now enforces on save, from
 * _crm_lib.js, so the list here and the refusals there can never disagree.
 * Records created before those rules existed are precisely what this is for.
 */

const { neon } = require('@neondatabase/serverless');
const {
  requireCrmSession, json, describeDbError, dbStep,
  classifyCompanyName, findNearDuplicates,
} = require('./_crm_lib');

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
  if (!session) {
    return json(401, { ok: false, error: 'Unauthorized' }, { 'Cache-Control': 'no-store, private' });
  }
  if (event.httpMethod !== 'GET') {
    return json(405, { ok: false, error: 'Method not allowed' }, { Allow: 'GET' });
  }

  const cs = connectionString();
  if (!cs) return json(500, { ok: false, error: 'Server not configured' });
  const sql = neon(cs);

  try {
    const rows = await dbStep('reading buyers for the company-name review', () => sql`
      SELECT id, company_name, contact_name, contact_title, country_region,
             current_stage, created_at, updated_at
      FROM buyers
      WHERE deleted_at IS NULL
      ORDER BY company_name ASC
      LIMIT 2000
    `);

    const flagged = [];
    for (const row of rows) {
      const verdict = classifyCompanyName(row.company_name);
      if (verdict.severity === 'ok') continue;
      flagged.push({
        id: row.id,
        company_name: row.company_name,
        contact_name: row.contact_name,
        contact_title: row.contact_title,
        country_region: row.country_region,
        current_stage: row.current_stage,
        updated_at: row.updated_at,
        severity: verdict.severity,
        code: verdict.code,
        reason: verdict.reason,
      });
    }

    // Duplicates are a property of the set, not of any one record, so they are
    // computed over everything rather than per row.
    const duplicates = findNearDuplicates(rows).map((g) => ({
      key: g.key,
      members: g.members.map((m) => ({
        id: m.id, company_name: m.company_name, current_stage: m.current_stage,
      })),
    }));

    const counts = flagged.reduce((acc, f) => {
      acc[f.code] = (acc[f.code] || 0) + 1;
      return acc;
    }, {});

    return json(200, {
      ok: true,
      data: {
        scanned: rows.length,
        flagged,
        duplicates,
        counts,
        // So the page can say plainly that nothing here has been changed.
        read_only: true,
        summary: {
          reject: flagged.filter((f) => f.severity === 'reject').length,
          review: flagged.filter((f) => f.severity === 'review').length,
          duplicate_groups: duplicates.length,
        },
      },
    }, { 'Cache-Control': 'no-store, private' });
  } catch (err) {
    const described = describeDbError(err, err && err.crmStep);
    console.error(
      `[crm-data-quality] error: step=${described.step || 'unknown'} code=${described.code || 'none'} ${err && err.message ? err.message : err}`
    );
    return json(500, { ok: false, ...described });
  }
};
