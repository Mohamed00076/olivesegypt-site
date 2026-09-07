'use strict';

/*
 * Section L -- quotation/invoice generator, tied to a real buyer record
 * in the CRM (Section H). This is the piece explicitly deferred when the
 * site was rebuilt (see commit 24cae36's message: "/dashboard/quotation
 * and /dashboard/invoice ... need real dynamic data entry ... a
 * materially different, larger task better paired with Section H's CRM
 * build"). Same CRM session/auth as everything else under /crm/ --
 * requireCrmSession, no separate login.
 *
 * Deliberately no PATCH/update: once created, a document is either kept
 * as issued or voided (never silently edited), the same integrity
 * expectation a real invoice/quotation carries. Voiding sets voided_at
 * and requires explicit confirmation, mirroring crm-buyers.js's delete
 * confirmation pattern -- it never removes the row (doc_number history
 * stays intact for audit).
 *
 * No FK constraint to `buyers` (same pattern crm-activity.js already
 * uses for buyer_id: a plain bigint, not a foreign key) -- this repo's
 * established convention is application-level referential integrity
 * between these Netlify Functions' independently-`ensureSchema`'d
 * tables, not a cross-table DB constraint that would make one function's
 * schema setup depend on another's having already run.
 *
 * The buyer's company/contact/country are snapshotted onto the document
 * at creation time (buyer_company_name etc. below), not read live from
 * `buyers` on every view -- an issued document must not silently change
 * if the buyer's CRM record is edited later.
 *
 * buyer_id is OPTIONAL (2026-09-07). It was NOT NULL, and /crm/document
 * refused to load without a ?buyer_id= in the URL, so quoting a company
 * meant first creating a CRM buyer record for them. The owner asked for the
 * opposite: "make it independent, not related to buyers and adding buyers
 * first". Most quotations go out before anyone is a buyer -- that is what a
 * quotation is for -- and forcing a CRM record first turns a two-minute job
 * into data entry, or worse, pushes the work off the system entirely.
 *
 * So a document now takes either a buyer_id (details copied from that
 * record, as before) or a typed-in company name. Nothing else changes: the
 * snapshot columns were always the source of truth for what a document
 * says, so an unlinked document is not a lesser one -- it simply has no
 * back-reference. Linking one later is a matter of setting buyer_id.
 */

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

const DOC_TYPES = new Set(['quotation', 'invoice', 'letter']);
const DOC_PREFIX = { quotation: 'Q', invoice: 'INV', letter: 'L' };

/*
 * A letter is priced-document-shaped in every way that matters for the
 * record -- it is addressed to someone, it is numbered, it is issued on a
 * date and it must still be readable years later -- and shaped nothing like
 * one in its content: no line items, no currency, no totals. It shares this
 * table rather than getting its own because everything around a document
 * (numbering, the recipient snapshot, voiding, the audit log, the list) is
 * identical, and duplicating that for the sake of two different columns
 * would mean two of everything to keep in step.
 */
const PRICED = new Set(['quotation', 'invoice']);

const MAX = {
  currency: 3, incoterm: 20, notes: 2000,
  line_description: 300, line_unit: 30,
  buyer_company_name: 300, buyer_contact_name: 200, buyer_country: 40, buyer_address: 500,
  subject: 300, body: 20000,
  salutation: 120, closing: 80, signatory_name: 200, signatory_title: 200,
  enclosures: 500, cc: 500,
};

/*
 * The parts of a business letter, in the order they are read.
 *
 * The first version of letters gave you a subject and one free-text box. The
 * owner's objection was that a quotation has a proper filling structure and a
 * letter did not -- and they were right: a blank textarea makes every letter
 * a fresh act of composition, so the salutation gets forgotten, the sign-off
 * is inconsistent, and nobody remembers to note the enclosures.
 *
 * Only body is required. Everything else is optional, because a short note
 * legitimately has no enclosures and an internal memo may not need a formal
 * close -- but each one now has a field asking for it rather than depending
 * on the writer to remember the convention.
 */
const LETTER_FIELDS = ['salutation', 'closing', 'signatory_name', 'signatory_title', 'enclosures', 'cc'];
const MAX_LINE_ITEMS = 50;

function str(v) { return typeof v === 'string' ? v : v == null ? '' : String(v); }
function clean(v, cap) { return str(v).trim().slice(0, cap); }
function optional(v, cap) { const s = clean(v, cap); return s.length ? s : null; }

async function ensureSchema(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS crm_documents (
      id                   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      created_at           timestamptz NOT NULL DEFAULT now(),
      created_by           text NOT NULL,
      buyer_id             bigint NOT NULL,
      doc_type             text NOT NULL,
      doc_number           text NOT NULL UNIQUE,
      buyer_company_name   text NOT NULL,
      buyer_contact_name   text,
      buyer_country        text,
      buyer_address        text,
      currency             text NOT NULL DEFAULT 'USD',
      incoterm             text,
      valid_until          date,
      due_date             date,
      notes                text,
      line_items           jsonb NOT NULL DEFAULT '[]',
      subtotal             numeric(14,2) NOT NULL DEFAULT 0,
      total                numeric(14,2) NOT NULL DEFAULT 0,
      voided_at            timestamptz,
      voided_by            text
    )
  `;
  /*
   * CREATE TABLE IF NOT EXISTS above does nothing to a table that already
   * exists, so an already-deployed crm_documents keeps its NOT NULL until
   * this runs. Dropping a NOT NULL is idempotent in Postgres -- it succeeds
   * whether or not the constraint is still there -- so this is safe on every
   * invocation and needs no version tracking.
   */
  await sql`ALTER TABLE crm_documents ALTER COLUMN buyer_id DROP NOT NULL`;

  // Letters (2026-09-07). ADD COLUMN IF NOT EXISTS is idempotent, and the
  // CREATE above will not add a column to a table that already exists.
  await sql`ALTER TABLE crm_documents ADD COLUMN IF NOT EXISTS subject text`;
  await sql`ALTER TABLE crm_documents ADD COLUMN IF NOT EXISTS body text`;

  // The structured letter parts (2026-09-07). All nullable: only the body is
  // required, so an existing letter written before this simply has none.
  await sql`ALTER TABLE crm_documents ADD COLUMN IF NOT EXISTS salutation text`;
  await sql`ALTER TABLE crm_documents ADD COLUMN IF NOT EXISTS closing text`;
  await sql`ALTER TABLE crm_documents ADD COLUMN IF NOT EXISTS signatory_name text`;
  await sql`ALTER TABLE crm_documents ADD COLUMN IF NOT EXISTS signatory_title text`;
  await sql`ALTER TABLE crm_documents ADD COLUMN IF NOT EXISTS enclosures text`;
  await sql`ALTER TABLE crm_documents ADD COLUMN IF NOT EXISTS cc text`;

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

async function audit(sql, actor, action, recordId, details) {
  await sql`
    INSERT INTO crm_audit_log (actor, action, record_type, record_id, details)
    VALUES (${actor}, ${action}, 'document', ${recordId}, ${details || null})
  `;
}

function validateLineItems(raw) {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_LINE_ITEMS) return null;
  const items = [];
  for (const li of raw) {
    if (!li || typeof li !== 'object') return null;
    const description = clean(li.description, MAX.line_description);
    const unit = optional(li.unit, MAX.line_unit);
    const quantity = Number(li.quantity);
    const unitPrice = Number(li.unit_price);
    if (description.length < 1) return null;
    if (!Number.isFinite(quantity) || quantity <= 0) return null;
    if (!Number.isFinite(unitPrice) || unitPrice < 0) return null;
    items.push({ description, unit, quantity, unit_price: Math.round(unitPrice * 100) / 100 });
  }
  return items;
}

async function handleList(event, sql) {
  const qs = event.queryStringParameters || {};
  const buyerId = qs.buyer_id ? parseInt(qs.buyer_id, 10) : null;
  const rows = buyerId
    ? await sql`SELECT id, created_at, doc_type, doc_number, currency, total, voided_at FROM crm_documents WHERE buyer_id = ${buyerId} ORDER BY created_at DESC LIMIT 500`
    : await sql`SELECT id, created_at, doc_type, doc_number, buyer_company_name, currency, total, voided_at FROM crm_documents ORDER BY created_at DESC LIMIT 500`;
  return json(200, rows);
}

async function handleGet(sql, id, actor) {
  const rows = await sql`SELECT * FROM crm_documents WHERE id = ${id} LIMIT 1`;
  if (!rows[0]) return json(404, { ok: false, error: 'Not found' });
  await audit(sql, actor, 'read', id, null);
  return json(200, rows[0]);
}

async function handleCreate(event, sql, actor) {
  const body = readJsonBody(event) || {};

  const docType = clean(body.doc_type, 20);
  if (!DOC_TYPES.has(docType)) return json(400, { ok: false, error: 'Validation failed', fields: ['doc_type'] });

  /*
   * Two ways to say who a document is for, and exactly one is required.
   *
   *   buyer_id            -- copy the details off an existing CRM record
   *   buyer_company_name  -- type them in, with no CRM record at all
   *
   * The second is the common case: a quotation usually goes out before the
   * recipient is a buyer. Whichever route is taken, the same four snapshot
   * columns get written, so nothing downstream -- the printed sheet, the
   * list, the void flow -- needs to know which was used.
   */
  const hasBuyerId = body.buyer_id !== undefined && body.buyer_id !== null && body.buyer_id !== '';
  let buyerId = null;
  let companyName;
  let contactName;
  let country;
  let buyerAddress;

  if (hasBuyerId) {
    buyerId = parseInt(body.buyer_id, 10);
    if (!Number.isFinite(buyerId)) return json(400, { ok: false, error: 'Validation failed', fields: ['buyer_id'] });

    const buyerRows = await sql`SELECT company_name, contact_name, country_region, contact_email, contact_phone FROM buyers WHERE id = ${buyerId} LIMIT 1`;
    if (!buyerRows[0]) return json(400, { ok: false, error: 'Buyer not found', fields: ['buyer_id'] });
    const buyer = buyerRows[0];

    companyName = clean(buyer.company_name, MAX.buyer_company_name);
    contactName = optional(buyer.contact_name, MAX.buyer_contact_name);
    country = optional(buyer.country_region, MAX.buyer_country);
    buyerAddress = optional(
      [buyer.contact_email, buyer.contact_phone].filter(Boolean).join(' \u00b7 '),
      MAX.buyer_address
    );
  } else {
    // A document has to say who it is for. Everything else about the
    // recipient is optional -- a quotation with just a company name on it is
    // a normal thing to send.
    companyName = clean(body.buyer_company_name, MAX.buyer_company_name);
    if (!companyName) {
      return json(400, { ok: false, error: 'Validation failed', fields: ['buyer_company_name'] });
    }
    contactName = optional(body.buyer_contact_name, MAX.buyer_contact_name);
    country = optional(body.buyer_country, MAX.buyer_country);
    buyerAddress = optional(body.buyer_address, MAX.buyer_address);
  }

  const priced = PRICED.has(docType);

  let lineItems = [];
  let currency = 'USD';
  let incoterm = null;
  let subject = null;
  let letterBody = null;
  const letterParts = {};
  LETTER_FIELDS.forEach(function (f) { letterParts[f] = null; });

  if (priced) {
    lineItems = validateLineItems(body.line_items);
    if (!lineItems) return json(400, { ok: false, error: 'Validation failed', fields: ['line_items'] });

    currency = clean(body.currency, MAX.currency).toUpperCase() || 'USD';
    if (!/^[A-Z]{3}$/.test(currency)) return json(400, { ok: false, error: 'Validation failed', fields: ['currency'] });

    incoterm = optional(body.incoterm, MAX.incoterm);
  } else {
    /*
     * A letter with nothing written in it is the letter equivalent of an
     * invoice addressed to nobody -- it would issue, take a number, and
     * print blank. Subject is optional; plenty of letters do not carry one.
     *
     * Line items, currency and incoterm are ignored rather than rejected if
     * sent: the compose form hides those fields for a letter, so anything
     * arriving here would be a stale draft rather than intent.
     */
    letterBody = clean(body.body, MAX.body);
    if (!letterBody) return json(400, { ok: false, error: 'Validation failed', fields: ['body'] });
    subject = optional(body.subject, MAX.subject);
    LETTER_FIELDS.forEach(function (f) { letterParts[f] = optional(body[f], MAX[f]); });
  }

  const notes = optional(body.notes, MAX.notes);
  const validUntil = docType === 'quotation' && body.valid_until ? clean(body.valid_until, 10) : null;
  const dueDate = docType === 'invoice' && body.due_date ? clean(body.due_date, 10) : null;

  // Recomputed here, never trusted from the client -- the client's
  // running total is a convenience preview only. A letter totals zero.
  const subtotal = Math.round(lineItems.reduce((sum, li) => sum + li.quantity * li.unit_price, 0) * 100) / 100;
  const total = subtotal;

  const rows = await sql`
    INSERT INTO crm_documents (
      created_by, buyer_id, doc_type, doc_number,
      buyer_company_name, buyer_contact_name, buyer_country, buyer_address,
      currency, incoterm, valid_until, due_date, notes, subject, body,
      salutation, closing, signatory_name, signatory_title, enclosures, cc,
      line_items, subtotal, total
    ) VALUES (
      ${actor}, ${buyerId}, ${docType}, '',
      ${companyName}, ${contactName},
      ${country}, ${buyerAddress},
      ${currency}, ${incoterm}, ${validUntil}, ${dueDate}, ${notes}, ${subject}, ${letterBody},
      ${letterParts.salutation}, ${letterParts.closing}, ${letterParts.signatory_name},
      ${letterParts.signatory_title}, ${letterParts.enclosures}, ${letterParts.cc},
      ${JSON.stringify(lineItems)}::jsonb, ${subtotal}, ${total}
    )
    RETURNING id, created_at
  `;
  const id = rows[0].id;
  const year = new Date(rows[0].created_at).getUTCFullYear();
  const docNumber = `${DOC_PREFIX[docType]}-${year}-${String(id).padStart(6, '0')}`;
  await sql`UPDATE crm_documents SET doc_number = ${docNumber} WHERE id = ${id}`;

  await audit(sql, actor, 'create', id, docNumber);

  return json(200, { ok: true, id, doc_number: docNumber });
}

async function handleVoid(event, sql, id, actor) {
  const qs = event.queryStringParameters || {};
  if (qs.confirmed !== '1') {
    return json(400, { ok: false, error: 'Voiding requires explicit confirmation (confirmed=1)' });
  }
  const rows = await sql`SELECT id, voided_at FROM crm_documents WHERE id = ${id} LIMIT 1`;
  if (!rows[0]) return json(404, { ok: false, error: 'Not found' });
  if (rows[0].voided_at) return json(200, { ok: true }); // already voided -- idempotent

  await sql`UPDATE crm_documents SET voided_at = now(), voided_by = ${actor} WHERE id = ${id}`;
  await audit(sql, actor, 'void', id, null);
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

    if (event.httpMethod === 'GET' && id) return await handleGet(sql, id, actor);
    if (event.httpMethod === 'GET') return await handleList(event, sql);
    if (event.httpMethod === 'POST') return await handleCreate(event, sql, actor);
    if (event.httpMethod === 'DELETE' && id) return await handleVoid(event, sql, id, actor); // "delete" == void, see file header

    return json(405, { ok: false, error: 'Method not allowed' }, { Allow: 'GET, POST, DELETE' });
  } catch (err) {
    console.error('[crm-documents] error:', err?.message ?? err);
    return json(500, { ok: false, error: 'Server error' });
  }
};
