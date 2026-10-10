'use strict';

const { neon } = require('@neondatabase/serverless');
const { reportFailure } = require('./_failure_lib');
const {
  requireCrmSession, readJsonBody, json, describeDbError, dbStep, classifyCompanyName,
  STAGES, REGIONS: REGION_LIST, ensureBuyerTables, parseId, INVALID_ID_ERROR,
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

// Controlled vocabularies -- kept in sync with the rest of the site.
//
// The products the website sells, in the site's order (scripts/products.js).
// Since 2026-10-10 the range is by olive type, not cultivar, and Kalamata is
// not supplied. scripts/check-crm-products.js fails if this list and the
// site's products drift apart.
const PRODUCTS = [
  'green-olives', 'stuffed-green-olives', 'natural-black-olives',
  'oxidized-black-olives', 'sliced-jalapeno-peppers', 'marinated-artichoke-hearts',
  'pepperoncini-peppers',
];
// No longer offered. A buyer already tagged keeps the tag through an edit; a
// new buyer cannot be given it, and no record is rewritten. Hamed: withdrawn
// 2026-09-28, "not confirmed available". The cultivar products and Kalamata:
// retired 2026-10-10 when the range moved to olive types (the cultivar tags
// now mean Green Olives; Kalamata is not supplied). assets/crm.js carries the
// same list, with labels, for the pages.
const WITHDRAWN_PRODUCTS = [
  'hamed-green-olives', 'aggizi-green-olives', 'toffahi-green-olives',
  'manzanilla-green-olives', 'pepper-stuffed-green-olives', 'kalamata-olives',
];
// Stages and regions live in _crm_lib.js, shared with the CSV import and the
// website enquiry intake, so the three cannot disagree about what is valid.
const REGIONS = new Set(REGION_LIST);
const STAGE_SET = new Set(STAGES);

const MAX = {
  company_name: 300, country_region: 40, contact_name: 200, contact_title: 150,
  contact_email: 320, contact_phone: 60, contact_whatsapp: 60, lead_source: 150,
  current_stage: 40, packaging_format: 150, estimated_volume: 150, target_price: 100,
  quoted_price: 100, incoterm: 20, certifications_required: 500, next_action: 300,
  notes: 8000, lost_reason: 300,
};

function str(v) { return typeof v === 'string' ? v : v == null ? '' : String(v); }
function clean(v, cap) { return str(v).trim().slice(0, cap); }
function optional(v, cap) { const s = clean(v, cap); return s.length ? s : null; }

// The buyer tables are defined once, in _crm_lib.js, because the enquiry
// endpoint now creates buyers too -- two copies of a CREATE TABLE would let
// the table's shape depend on which endpoint a new database met first.
async function ensureSchema(sql) {
  await ensureBuyerTables(sql);
}

async function audit(sql, actor, action, recordType, recordId, details) {
  await sql`
    INSERT INTO crm_audit_log (actor, action, record_type, record_id, details)
    VALUES (${actor}, ${action}, ${recordType}, ${recordId}, ${details || null})
  `;
}

function validateBuyerInput(body, forCreate) {
  const errors = [];
  const fieldReasons = {};
  const companyName = clean(body.company_name, MAX.company_name);
  const countryRegion = clean(body.country_region, MAX.country_region);
  const currentStage = clean(body.current_stage, MAX.current_stage) || 'Lead';

  // Only the reject severity blocks a save. A review-level signal is for the
  // data-quality page to raise with a person; refusing "Olivex" here to catch
  // "Abdelrahman" would teach staff to fight the form. See _crm_lib.js.
  //
  // On an update the field is only judged when it is actually being changed,
  // so an existing bad name does not lock its own record out of every other
  // correction -- including the one that fixes the name.
  if (forCreate || body.company_name !== undefined) {
    const verdict = classifyCompanyName(companyName);
    if (verdict.severity === 'reject') {
      errors.push('company_name');
      fieldReasons.company_name = verdict.reason;
    }
  }
  // Checked on an edit too, when the region is being sent. It was checked only
  // on create, so an edit could store any text at all -- or null, which the
  // NOT NULL column then refused as a database error. A Kanban drag sends only
  // the stage, so it is not judged here, and an old record with an odd region
  // stays movable; the region is judged when someone actually saves one.
  if ((forCreate || body.country_region !== undefined) && !REGIONS.has(countryRegion)) {
    errors.push('country_region');
    fieldReasons.country_region = 'Choose a region from the list.';
  }
  if (body.current_stage !== undefined && !STAGE_SET.has(currentStage)) errors.push('current_stage');

  let productInterest = [];
  if (Array.isArray(body.product_interest)) {
    productInterest = body.product_interest.filter((p) =>
      PRODUCTS.includes(p) || (!forCreate && WITHDRAWN_PRODUCTS.includes(p)));
  }

  if (body.contact_email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean(body.contact_email, MAX.contact_email))) {
    errors.push('contact_email');
  }

  return { errors, fieldReasons, companyName, countryRegion, currentStage, productInterest };
}

async function handleList(event, sql) {
  const qs = event.queryStringParameters || {};
  const stage = qs.stage && STAGE_SET.has(qs.stage) ? qs.stage : null;
  const region = qs.region && REGIONS.has(qs.region) ? qs.region : null;
  const search = qs.search ? `%${clean(qs.search, 200)}%` : null;

  // Deleted buyers are never listed -- there is no "include deleted" option.
  // See handleGet: a deleted buyer is kept in the database, not in the CRM.
  const rows = await sql`
    SELECT id, created_at, updated_at, created_by, assigned_to, company_name, country_region,
           contact_name, contact_email, current_stage, product_interest, next_action,
           next_action_due, certification_gap, deleted_at
    FROM buyers
    WHERE deleted_at IS NULL
      AND (${stage}::text IS NULL OR current_stage = ${stage})
      AND (${region}::text IS NULL OR country_region = ${region})
      AND (${search}::text IS NULL OR company_name ILIKE ${search} OR contact_name ILIKE ${search} OR contact_email ILIKE ${search})
    ORDER BY updated_at DESC
    LIMIT 1000
  `;
  return json(200, rows);
}

async function handleGet(event, sql, id, actor) {
  /*
   * Four queries, each labelled. A buyer page that fails says which of the
   * four failed rather than "Server error", which is the whole of what was
   * knowable before and the reason a broken page took two attempts to fix.
   */
  const rows = await dbStep('reading the buyer record',
    () => sql`SELECT * FROM buyers WHERE id = ${id} LIMIT 1`);
  if (!rows[0]) return json(404, { ok: false, error: 'Not found' });
  /*
   * A deleted buyer is no longer viewable in the CRM (owner decision,
   * 2026-09-27, outstanding item 12). It stays in the database and can be
   * recalled from there -- docs/recall-deleted-buyer.md -- but the CRM
   * answers only that it was deleted, and when: no name, no contact details,
   * no activity log (which holds a copy of the original message), no stage
   * history. 410, not 404, so the page can say "deleted" rather than "Not
   * found" -- the confusion that made deleted buyers visible in the first place.
   *
   * no-store: a 410 may be cached by browsers by default, and was -- after a
   * restore from the database the page kept saying "deleted" (found testing).
   */
  if (rows[0].deleted_at) {
    return json(410, {
      ok: false, deleted: true, deleted_on: new Date(rows[0].deleted_at).toISOString().slice(0, 10),
      error: deletedMessage(rows[0], 'Its details are no longer shown in the CRM.'),
    }, { 'Cache-Control': 'no-store, private' });
  }

  const activity = await dbStep('reading the activity log',
    () => sql`SELECT id, created_at, created_by, entry FROM buyer_activity_log WHERE buyer_id = ${id} ORDER BY created_at DESC LIMIT 500`);
  const stageHistory = await dbStep('reading the stage history',
    () => sql`SELECT id, from_stage, to_stage, changed_at, changed_by FROM buyer_stage_history WHERE buyer_id = ${id} ORDER BY changed_at ASC`);

  // Rule 22: audit log of access to sensitive records -- reads included, not just writes.
  await dbStep('writing the audit entry',
    () => audit(sql, actor, 'read', 'buyer', id, null));

  return json(200, { ...rows[0], activity_log: activity, stage_history: stageHistory });
}

async function handleCreate(event, sql, actor) {
  const body = readJsonBody(event) || {};
  const { errors, fieldReasons, companyName, countryRegion, currentStage, productInterest } = validateBuyerInput(body, true);
  if (errors.length) return json(400, { ok: false, error: 'Validation failed', fields: errors, reasons: fieldReasons });

  const rows = await sql`
    INSERT INTO buyers (
      created_by, assigned_to, company_name, country_region, contact_name, contact_title,
      contact_email, contact_phone, contact_whatsapp, lead_source, current_stage,
      product_interest, packaging_format, estimated_volume, target_price, quoted_price,
      incoterm, certifications_required, certification_gap, next_action, next_action_due, notes
    ) VALUES (
      ${actor}, ${optional(body.assigned_to, 100) || actor}, ${companyName}, ${countryRegion},
      ${optional(body.contact_name, MAX.contact_name)}, ${optional(body.contact_title, MAX.contact_title)},
      ${optional(body.contact_email, MAX.contact_email)}, ${optional(body.contact_phone, MAX.contact_phone)},
      ${optional(body.contact_whatsapp, MAX.contact_whatsapp)}, ${optional(body.lead_source, MAX.lead_source)},
      ${currentStage}, ${JSON.stringify(productInterest)}::jsonb,
      ${optional(body.packaging_format, MAX.packaging_format)}, ${optional(body.estimated_volume, MAX.estimated_volume)},
      ${optional(body.target_price, MAX.target_price)}, ${optional(body.quoted_price, MAX.quoted_price)},
      ${optional(body.incoterm, MAX.incoterm)}, ${optional(body.certifications_required, MAX.certifications_required)},
      ${body.certification_gap === true}, ${optional(body.next_action, MAX.next_action)},
      ${body.next_action_due ? clean(body.next_action_due, 10) : null}, ${optional(body.notes, MAX.notes)}
    )
    RETURNING id
  `;
  const id = rows[0].id;

  await sql`INSERT INTO buyer_stage_history (buyer_id, from_stage, to_stage, changed_by) VALUES (${id}, NULL, ${currentStage}, ${actor})`;
  await audit(sql, actor, 'create', 'buyer', id, null);

  return json(200, { ok: true, id });
}

async function handleUpdate(event, sql, id, actor) {
  const existingRows = await sql`SELECT current_stage, deleted_at FROM buyers WHERE id = ${id} LIMIT 1`;
  if (!existingRows[0]) return json(404, { ok: false, error: 'Not found' });
  if (existingRows[0].deleted_at) {
    return json(409, {
      ok: false, already_deleted: true,
      error: deletedMessage(existingRows[0], 'It can no longer be viewed or edited in the CRM.'),
    });
  }
  const previousStage = existingRows[0].current_stage;

  const body = readJsonBody(event) || {};
  const { errors, fieldReasons, productInterest } = validateBuyerInput(body, false);
  if (errors.length) return json(400, { ok: false, error: 'Validation failed', fields: errors, reasons: fieldReasons });

  const fields = [
    'assigned_to', 'company_name', 'country_region', 'contact_name', 'contact_title',
    'contact_email', 'contact_phone', 'contact_whatsapp', 'lead_source', 'current_stage',
    'packaging_format', 'estimated_volume', 'target_price', 'quoted_price', 'incoterm',
    'certifications_required', 'next_action', 'next_action_due', 'notes', 'lost_reason',
  ];
  const updates = {};
  for (const f of fields) {
    if (body[f] !== undefined) updates[f] = body[f] === null ? null : clean(body[f], MAX[f] || 500);
  }
  if (body.product_interest !== undefined) updates.product_interest = productInterest;
  if (body.certification_gap !== undefined) updates.certification_gap = body.certification_gap === true;

  if (Object.keys(updates).length === 0) return json(400, { ok: false, error: 'No fields to update' });

  // Build a safe, parameterized UPDATE from the allowlisted fields above.
  const setClauses = [];
  const values = [];
  let i = 1;
  for (const [k, v] of Object.entries(updates)) {
    if (k === 'product_interest') {
      setClauses.push(`product_interest = $${i}::jsonb`);
      values.push(JSON.stringify(v));
    } else if (k === 'certification_gap') {
      setClauses.push(`certification_gap = $${i}::boolean`);
      values.push(v);
    } else if (k === 'next_action_due') {
      setClauses.push(`next_action_due = $${i}::date`);
      values.push(v);
    } else {
      setClauses.push(`${k} = $${i}`);
      values.push(v);
    }
    i += 1;
  }
  setClauses.push(`updated_at = now()`);
  values.push(id);

  await sql(`UPDATE buyers SET ${setClauses.join(', ')} WHERE id = $${i}`, values);

  if (updates.current_stage && updates.current_stage !== previousStage) {
    await sql`INSERT INTO buyer_stage_history (buyer_id, from_stage, to_stage, changed_by) VALUES (${id}, ${previousStage}, ${updates.current_stage}, ${actor})`;
  }

  await audit(sql, actor, 'update', 'buyer', id, Object.keys(updates).join(','));
  return json(200, { ok: true });
}

/*
 * A deleted buyer is kept (soft delete, below) but is not a live record.
 *
 * It was treated as one everywhere except the list. Its page still opened at
 * /crm/buyer/?id=N looking exactly like a live buyer -- Save and Delete
 * offered, nothing saying otherwise -- and the Enquiries inbox's "In pipeline"
 * link still led there. A second Delete then answered "Not found", which read
 * as a failure when the first delete had worked; and Save quietly edited a
 * record that no list, board or report would ever show again. Found
 * 2026-09-27 when the owner deleted test123 and was shown exactly that.
 *
 * So both write paths now say what actually happened, in words staff can act
 * on, and the page renders a deleted record read-only (crm/buyer/index.html).
 */
function deletedMessage(row, what) {
  const when = row.deleted_at ? new Date(row.deleted_at).toISOString().slice(0, 10) : 'an earlier date';
  return `This buyer was deleted on ${when}. ${what}`;
}

async function handleDelete(event, sql, id, actor) {
  const qs = event.queryStringParameters || {};
  // Rule 22: explicit confirmation step required before any bulk delete
  // or bulk export -- enforced server-side too, not just a client
  // dialog, since a single record delete is still a real destructive
  // action worth the same guard.
  if (qs.confirmed !== '1') {
    return json(400, { ok: false, error: 'Deletion requires explicit confirmation (confirmed=1)' });
  }
  const rows = await sql`SELECT id, deleted_at FROM buyers WHERE id = ${id} LIMIT 1`;
  if (!rows[0]) return json(404, { ok: false, error: 'Not found' });
  if (rows[0].deleted_at) {
    return json(409, {
      ok: false, already_deleted: true,
      error: deletedMessage(rows[0], 'Nothing more to do: it no longer appears anywhere in the CRM.'),
    });
  }

  // Soft delete -- preserves buyer_activity_log/buyer_stage_history for
  // append-only auditability and so historical conversion-rate reporting
  // stays accurate even for deleted/lost records.
  await sql`UPDATE buyers SET deleted_at = now(), updated_at = now() WHERE id = ${id}`;
  await audit(sql, actor, 'delete', 'buyer', id, null);
  return json(200, { ok: true });
}

/*
 * Erase: for a buyer who asked for their data to be deleted.
 *
 * Owner decision, 2026-09-27 (outstanding item 12): an ordinary delete hides
 * a buyer from the CRM but keeps it recallable (handleDelete, above); "if
 * buyer requested to be deleted then delete fully". /privacy promises that
 * anyone can ask for their information to be deleted, and until now the CRM
 * could not do it.
 *
 * Removed, in one statement so it cannot half-happen:
 *   - the buyer record
 *   - its activity log, which holds a copy of the original message
 *   - its stage history
 *   - the website enquiries linked to it, which hold the message itself
 * Kept:
 *   - quotations, invoices and letters already issued (crm_documents): business
 *     records, which /privacy says are kept for a quotation or order placed
 *   - the opt-out list: an unsubscribed address stays unsubscribed
 *   - the audit log, which never held their details, plus one entry for this
 *     erasure recording who, when, and how many rows -- again, no details.
 * Works on a live buyer and on one already hidden by an ordinary delete.
 */
async function handleErase(event, sql, id, actor) {
  const qs = event.queryStringParameters || {};
  if (qs.confirmed !== '1') {
    return json(400, { ok: false, error: 'Erasing requires explicit confirmation (confirmed=1)' });
  }
  const hasInquiries = (await sql`SELECT to_regclass('public.inquiries') IS NOT NULL AS present`)[0].present;
  const enquiriesCte = hasInquiries
    ? 'q AS (DELETE FROM inquiries WHERE buyer_id IN (SELECT id FROM b) RETURNING 1),'
    : 'q AS (SELECT 1 WHERE false),';
  const rows = await sql(
    `WITH b AS (DELETE FROM buyers WHERE id = $1 RETURNING id),
     a AS (DELETE FROM buyer_activity_log WHERE buyer_id IN (SELECT id FROM b) RETURNING 1),
     h AS (DELETE FROM buyer_stage_history WHERE buyer_id IN (SELECT id FROM b) RETURNING 1),
     ${enquiriesCte}
     counts AS (SELECT (SELECT count(*) FROM a) AS notes, (SELECT count(*) FROM h) AS stage_changes,
                       (SELECT count(*) FROM q) AS enquiries)
     INSERT INTO crm_audit_log (actor, action, record_type, record_id, details)
     SELECT $2, 'erase', 'buyer', b.id,
            'deletion request: removed ' || counts.notes || ' note(s), ' || counts.stage_changes ||
            ' stage change(s), ' || counts.enquiries || ' linked enquiry(ies)'
     FROM b, counts
     RETURNING details`,
    [id, actor || 'unknown']
  );
  if (!rows[0]) return json(404, { ok: false, error: 'Not found -- it may already have been erased.' });
  return json(200, { ok: true, erased: rows[0].details });
}

exports.handler = async (event) => {
  const session = requireCrmSession(event);
  if (!session) {
    return json(401, { ok: false, error: 'Unauthorized' }, { 'Cache-Control': 'no-store, private' });
  }
  const actor = session.sub;

  const cs = connectionString();
  if (!cs) return json(500, { ok: false, error: 'Server not configured' });
  const sql = neon(cs);

  const qs = event.queryStringParameters || {};
  const id = qs.id ? parseId(qs.id) : null;
  // An id that is there but malformed is refused -- never read as its leading
  // digits ("5abc" is not buyer 5), and a GET is not quietly given the list.
  if (qs.id && !id) return json(400, { ok: false, error: INVALID_ID_ERROR });

  try {
    await dbStep('preparing the database tables', () => ensureSchema(sql));

    if (event.httpMethod === 'GET' && id) return await handleGet(event, sql, id, actor);
    if (event.httpMethod === 'GET') return await handleList(event, sql);
    if (event.httpMethod === 'POST') return await handleCreate(event, sql, actor);
    if (event.httpMethod === 'PATCH' && id) return await handleUpdate(event, sql, id, actor);
    if (event.httpMethod === 'DELETE' && id && qs.erase === '1') return await handleErase(event, sql, id, actor);
    if (event.httpMethod === 'DELETE' && id) return await handleDelete(event, sql, id, actor);

    return json(405, { ok: false, error: 'Method not allowed' }, { Allow: 'GET, POST, PATCH, DELETE' });
  } catch (err) {
    const described = describeDbError(err, err?.crmStep);
    console.error(
      `[crm-buyers] error: step=${described.step || 'unknown'} code=${described.code || 'none'} ${err?.message ?? err}`
    );
    await reportFailure(sql, { source: 'crm-buyers', method: event.httpMethod, step: described.step, actor }, err);
    // The reader here is signed-in staff, and the message is filtered by
    // describeDbError -- see the note in _crm_lib.js about what it will and
    // will not repeat from the database.
    return json(500, { ok: false, ...described });
  }
};

module.exports.PRODUCTS = PRODUCTS;
module.exports.WITHDRAWN_PRODUCTS = WITHDRAWN_PRODUCTS;
module.exports.REGIONS = Array.from(REGIONS);
module.exports.STAGES = STAGES;
