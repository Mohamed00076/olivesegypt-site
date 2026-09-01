'use strict';

const { neon } = require('@neondatabase/serverless');
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

// Controlled vocabularies -- kept in sync with the rest of the site.
// Kalamata excluded per Rule 12 until cleared (see catalog/products).
const PRODUCTS = [
  'aggizi-green-olives', 'toffahi-green-olives', 'hamed-green-olives',
  'manzanilla-green-olives', 'natural-black-olives', 'pepper-stuffed-green-olives',
  'oxidized-black-olives', 'marinated-artichoke-hearts', 'pepperoncini-peppers',
  'sliced-jalapeno-peppers',
];
const REGIONS = new Set(['Africa', 'Middle East', 'Asia', 'EU', 'North America']);
const STAGES = [
  'Lead', 'Contacted', 'Qualifying', 'Sample Requested', 'Sample Sent',
  'Negotiation', 'Contract Signed', 'Shipment Prepared', 'Exported/Completed',
  'Lost/Stalled',
];
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

async function ensureSchema(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS buyers (
      id                       bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      created_at               timestamptz NOT NULL DEFAULT now(),
      updated_at               timestamptz NOT NULL DEFAULT now(),
      deleted_at               timestamptz,
      created_by               text,
      assigned_to              text,
      company_name             text NOT NULL,
      country_region           text NOT NULL,
      contact_name             text,
      contact_title            text,
      contact_email            text,
      contact_phone            text,
      contact_whatsapp         text,
      lead_source              text,
      current_stage            text NOT NULL DEFAULT 'Lead',
      product_interest         jsonb NOT NULL DEFAULT '[]',
      packaging_format         text,
      estimated_volume         text,
      target_price             text,
      quoted_price             text,
      incoterm                 text,
      certifications_required  text,
      certification_gap        boolean NOT NULL DEFAULT false,
      next_action              text,
      next_action_due          date,
      notes                    text,
      lost_reason              text
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS buyer_stage_history (
      id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      buyer_id     bigint NOT NULL,
      from_stage   text,
      to_stage     text NOT NULL,
      changed_at   timestamptz NOT NULL DEFAULT now(),
      changed_by   text
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS crm_audit_log (
      id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      occurred_at  timestamptz NOT NULL DEFAULT now(),
      actor        text NOT NULL,
      action       text NOT NULL,
      record_type  text NOT NULL,
      record_id    bigint,
      details      text
    )
  `;
}

async function audit(sql, actor, action, recordType, recordId, details) {
  await sql`
    INSERT INTO crm_audit_log (actor, action, record_type, record_id, details)
    VALUES (${actor}, ${action}, ${recordType}, ${recordId}, ${details || null})
  `;
}

function validateBuyerInput(body, forCreate) {
  const errors = [];
  const companyName = clean(body.company_name, MAX.company_name);
  const countryRegion = clean(body.country_region, MAX.country_region);
  const currentStage = clean(body.current_stage, MAX.current_stage) || 'Lead';

  if (forCreate && companyName.length < 2) errors.push('company_name');
  if (forCreate && !REGIONS.has(countryRegion)) errors.push('country_region');
  if (body.current_stage !== undefined && !STAGE_SET.has(currentStage)) errors.push('current_stage');

  let productInterest = [];
  if (Array.isArray(body.product_interest)) {
    productInterest = body.product_interest.filter((p) => PRODUCTS.includes(p));
  }

  if (body.contact_email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean(body.contact_email, MAX.contact_email))) {
    errors.push('contact_email');
  }

  return { errors, companyName, countryRegion, currentStage, productInterest };
}

async function handleList(event, sql) {
  const qs = event.queryStringParameters || {};
  const stage = qs.stage && STAGE_SET.has(qs.stage) ? qs.stage : null;
  const region = qs.region && REGIONS.has(qs.region) ? qs.region : null;
  const search = qs.search ? `%${clean(qs.search, 200)}%` : null;
  const includeDeleted = qs.include_deleted === '1';

  const rows = await sql`
    SELECT id, created_at, updated_at, created_by, assigned_to, company_name, country_region,
           contact_name, contact_email, current_stage, product_interest, next_action,
           next_action_due, certification_gap, deleted_at
    FROM buyers
    WHERE (${includeDeleted}::boolean OR deleted_at IS NULL)
      AND (${stage}::text IS NULL OR current_stage = ${stage})
      AND (${region}::text IS NULL OR country_region = ${region})
      AND (${search}::text IS NULL OR company_name ILIKE ${search} OR contact_name ILIKE ${search} OR contact_email ILIKE ${search})
    ORDER BY updated_at DESC
    LIMIT 1000
  `;
  return json(200, rows);
}

async function handleGet(event, sql, id, actor) {
  const rows = await sql`SELECT * FROM buyers WHERE id = ${id} LIMIT 1`;
  if (!rows[0]) return json(404, { ok: false, error: 'Not found' });

  const activity = await sql`SELECT id, created_at, created_by, entry FROM buyer_activity_log WHERE buyer_id = ${id} ORDER BY created_at DESC LIMIT 500`;
  const stageHistory = await sql`SELECT id, from_stage, to_stage, changed_at, changed_by FROM buyer_stage_history WHERE buyer_id = ${id} ORDER BY changed_at ASC`;

  // Rule 22: audit log of access to sensitive records -- reads included, not just writes.
  await audit(sql, actor, 'read', 'buyer', id, null);

  return json(200, { ...rows[0], activity_log: activity, stage_history: stageHistory });
}

async function handleCreate(event, sql, actor) {
  const body = readJsonBody(event) || {};
  const { errors, companyName, countryRegion, currentStage, productInterest } = validateBuyerInput(body, true);
  if (errors.length) return json(400, { ok: false, error: 'Validation failed', fields: errors });

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
  const existingRows = await sql`SELECT current_stage FROM buyers WHERE id = ${id} LIMIT 1`;
  if (!existingRows[0]) return json(404, { ok: false, error: 'Not found' });
  const previousStage = existingRows[0].current_stage;

  const body = readJsonBody(event) || {};
  const { errors, productInterest } = validateBuyerInput(body, false);
  if (errors.length) return json(400, { ok: false, error: 'Validation failed', fields: errors });

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

  await sql.query(`UPDATE buyers SET ${setClauses.join(', ')} WHERE id = $${i}`, values);

  if (updates.current_stage && updates.current_stage !== previousStage) {
    await sql`INSERT INTO buyer_stage_history (buyer_id, from_stage, to_stage, changed_by) VALUES (${id}, ${previousStage}, ${updates.current_stage}, ${actor})`;
  }

  await audit(sql, actor, 'update', 'buyer', id, Object.keys(updates).join(','));
  return json(200, { ok: true });
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
  const rows = await sql`SELECT id FROM buyers WHERE id = ${id} AND deleted_at IS NULL LIMIT 1`;
  if (!rows[0]) return json(404, { ok: false, error: 'Not found' });

  // Soft delete -- preserves buyer_activity_log/buyer_stage_history for
  // append-only auditability and so historical conversion-rate reporting
  // stays accurate even for deleted/lost records.
  await sql`UPDATE buyers SET deleted_at = now(), updated_at = now() WHERE id = ${id}`;
  await audit(sql, actor, 'delete', 'buyer', id, null);
  return json(200, { ok: true });
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
  const id = qs.id ? parseInt(qs.id, 10) : null;

  try {
    await ensureSchema(sql);

    if (event.httpMethod === 'GET' && id) return await handleGet(event, sql, id, actor);
    if (event.httpMethod === 'GET') return await handleList(event, sql);
    if (event.httpMethod === 'POST') return await handleCreate(event, sql, actor);
    if (event.httpMethod === 'PATCH' && id) return await handleUpdate(event, sql, id, actor);
    if (event.httpMethod === 'DELETE' && id) return await handleDelete(event, sql, id, actor);

    return json(405, { ok: false, error: 'Method not allowed' }, { Allow: 'GET, POST, PATCH, DELETE' });
  } catch (err) {
    console.error('[crm-buyers] error:', err?.message ?? err);
    return json(500, { ok: false, error: 'Server error' });
  }
};

module.exports.PRODUCTS = PRODUCTS;
module.exports.REGIONS = Array.from(REGIONS);
module.exports.STAGES = STAGES;
