'use strict';

/*
 * Documents a buyer has that the CRM did not issue (2026-10-20).
 *
 * The owner's words: "i have quotations and other documents that i would like
 * to add to my existing buyers that are not issued by me". A quotation sent
 * before the CRM existed, a supplier's invoice, a signed contract: they belong
 * on the buyer's record next to the ones the CRM issued, but they are files,
 * not documents this system wrote, so they live in their own table and are
 * never mixed into crm_documents' numbering.
 *
 * Stored in the same Neon database as everything else, as bytea, so they
 * share its backups and access rules and need no new service or key. That
 * sets the size: a Netlify function takes at most 6 MB in and gives at most
 * 6 MB out, base64 adds a third, so a file is capped at 4 MB.
 *
 * What is accepted is decided from the file's own first bytes, never from its
 * name or the type the browser claims: PDF, PNG, JPEG, WebP, and Word and
 * Excel files (.docx, .xlsx). Nothing that a browser would run -- no HTML, no
 * SVG -- and a file is always served with nosniff and a sandboxing CSP, so
 * even a PDF opened in a tab cannot act on this site. Word and Excel files
 * download rather than open.
 *
 * Every request needs a CRM session. Uploading, opening and deleting are each
 * written to crm_audit_log, with the file's kind and size, never its content.
 *
 * A buyer's erasure (crm-buyers.js handleErase) keeps these, as it keeps the
 * quotations and invoices the CRM issued: they are business records, which
 * /privacy says are kept for a quotation or order placed.
 */

const { neon } = require('@neondatabase/serverless');
const { reportFailure } = require('./_failure_lib');
const { requireCrmSession, readJsonBody, json, parseId, INVALID_ID_ERROR } = require('./_crm_lib');

function connectionString() {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_URL_UNPOOLED ||
    ''
  );
}

const MAX_BYTES = 4 * 1024 * 1024;
const KINDS = new Set(['quotation', 'invoice', 'other']);
const MAX = { title: 200, reference: 100, issued_by: 200, note: 1000, filename: 200 };

function str(v) { return typeof v === 'string' ? v : v == null ? '' : String(v); }
function clean(v, cap) { return str(v).trim().slice(0, cap); }
function optional(v, cap) { const s = clean(v, cap); return s.length ? s : null; }

/*
 * The file's type, from its bytes. Word and Excel files are zip archives, so
 * for those the name's extension says which; a zip with any other name is
 * refused rather than guessed at.
 */
function sniff(buf, filename) {
  const ext = (filename.match(/\.([a-z0-9]+)$/i) || [])[1];
  const lower = ext ? ext.toLowerCase() : '';
  if (buf.length >= 5 && buf.slice(0, 5).toString('latin1') === '%PDF-') return { type: 'application/pdf', ext: 'pdf', inline: true };
  if (buf.length >= 8 && buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { type: 'image/png', ext: 'png', inline: true };
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { type: 'image/jpeg', ext: 'jpg', inline: true };
  if (buf.length >= 12 && buf.slice(0, 4).toString('latin1') === 'RIFF' && buf.slice(8, 12).toString('latin1') === 'WEBP') return { type: 'image/webp', ext: 'webp', inline: true };
  if (buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04) {
    if (lower === 'docx') return { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', ext: 'docx', inline: false };
    if (lower === 'xlsx') return { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ext: 'xlsx', inline: false };
  }
  return null;
}

// A name safe to put in a header: no path, no quotes or control characters.
function safeName(name, ext) {
  let base = clean(name, MAX.filename).replace(/^.*[\\/]/, '').replace(/[\u0000-\u001f\u007f"\\;]/g, '').trim();
  if (!base) base = 'document';
  if (!new RegExp('\\.' + ext + '$', 'i').test(base)) base += '.' + ext;
  return base;
}

async function ensureSchema(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS crm_buyer_files (
      id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      buyer_id      bigint NOT NULL,
      kind          text NOT NULL,
      title         text,
      reference     text,
      doc_date      date,
      issued_by     text,
      amount        numeric(14,2),
      currency      text,
      note          text,
      filename      text NOT NULL,
      content_type  text NOT NULL,
      size_bytes    integer NOT NULL,
      data          bytea NOT NULL,
      uploaded_by   text NOT NULL,
      uploaded_at   timestamptz NOT NULL DEFAULT now()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS crm_buyer_files_buyer_idx ON crm_buyer_files (buyer_id)`;
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
    VALUES (${actor}, ${action}, 'buyer_file', ${recordId}, ${details || null})
  `;
}

// The list for one buyer: everything but the file itself.
async function handleList(sql, buyerId) {
  const rows = await sql`
    SELECT id, buyer_id, kind, title, reference, doc_date, issued_by, amount, currency, note,
           filename, content_type, size_bytes, uploaded_by, uploaded_at
    FROM crm_buyer_files WHERE buyer_id = ${buyerId} ORDER BY uploaded_at DESC LIMIT 500
  `;
  return json(200, rows, { 'Cache-Control': 'no-store, private' });
}

async function handleDownload(sql, id, actor) {
  /*
   * The bytes cross the driver as base64 text both ways (encode/decode in
   * SQL), so nothing depends on how the HTTP driver handles bytea.
   */
  const rows = await sql`SELECT id, kind, filename, content_type, size_bytes, encode(data, 'base64') AS data_b64 FROM crm_buyer_files WHERE id = ${id} LIMIT 1`;
  const f = rows[0];
  if (!f) return json(404, { ok: false, error: 'Not found' });
  const buf = Buffer.from(String(f.data_b64 || '').replace(/\s+/g, ''), 'base64');
  // Re-checked on the way out, so a row written any other way is not served as something it is not.
  const kind = sniff(buf, f.filename);
  if (!kind) return json(415, { ok: false, error: 'This file is not of a type that can be opened here.' });
  await audit(sql, actor, 'open', f.id, `${f.kind}, ${f.size_bytes} bytes`);
  const name = safeName(f.filename, kind.ext);
  return {
    statusCode: 200,
    headers: {
      'Content-Type': kind.type,
      'Content-Disposition': `${kind.inline ? 'inline' : 'attachment'}; filename="${name.replace(/[^\x20-\x7e]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(name)}`,
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "sandbox; default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'",
      'Cache-Control': 'no-store, private',
    },
    isBase64Encoded: true,
    body: buf.toString('base64'),
  };
}

async function handleUpload(event, sql, actor) {
  const raw = event.isBase64Encoded && event.body ? Buffer.from(event.body, 'base64').toString('utf8') : event.body;
  const body = readJsonBody({ body: raw }) || {};

  const buyerId = parseId(body.buyer_id);
  if (!buyerId) return json(400, { ok: false, error: INVALID_ID_ERROR });
  const kind = clean(body.kind, 20);
  if (!KINDS.has(kind)) return json(400, { ok: false, error: 'Validation failed', fields: ['kind'] });

  const b64 = str(body.data_base64);
  // Checked before decoding: base64 is 4 characters for every 3 bytes.
  if (!b64 || b64.length > Math.ceil(MAX_BYTES / 3) * 4 + 4) {
    return json(413, { ok: false, error: 'The file is larger than 4 MB. Save a smaller copy (for example, export the PDF at a lower quality) and try again.' });
  }
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) return json(400, { ok: false, error: 'Validation failed', fields: ['data_base64'] });
  const buf = Buffer.from(b64, 'base64');
  if (!buf.length) return json(400, { ok: false, error: 'Validation failed', fields: ['data_base64'] });
  if (buf.length > MAX_BYTES) {
    return json(413, { ok: false, error: 'The file is larger than 4 MB. Save a smaller copy (for example, export the PDF at a lower quality) and try again.' });
  }
  const filename = clean(body.filename, MAX.filename);
  const type = sniff(buf, filename);
  if (!type) {
    return json(415, { ok: false, error: 'Only PDF, PNG, JPEG, WebP, Word (.docx) and Excel (.xlsx) files can be uploaded.' });
  }

  const title = optional(body.title, MAX.title);
  if (kind === 'other' && !title) return json(400, { ok: false, error: 'Validation failed', fields: ['title'] });
  const reference = optional(body.reference, MAX.reference);
  const issuedBy = optional(body.issued_by, MAX.issued_by);
  const note = optional(body.note, MAX.note);
  let docDate = optional(body.doc_date, 10);
  if (docDate && !/^\d{4}-\d{2}-\d{2}$/.test(docDate)) return json(400, { ok: false, error: 'Validation failed', fields: ['doc_date'] });
  let amount = null;
  let currency = null;
  if (body.amount !== undefined && body.amount !== null && body.amount !== '') {
    amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount < 0 || amount > 1e12) return json(400, { ok: false, error: 'Validation failed', fields: ['amount'] });
    amount = Math.round(amount * 100) / 100;
    currency = clean(body.currency, 3).toUpperCase() || 'USD';
    if (!/^[A-Z]{3}$/.test(currency)) return json(400, { ok: false, error: 'Validation failed', fields: ['currency'] });
  }

  // The buyer must exist and not be deleted: a file is never filed against nobody.
  const buyer = (await sql`SELECT id, deleted_at FROM buyers WHERE id = ${buyerId} LIMIT 1`)[0];
  if (!buyer || buyer.deleted_at) return json(404, { ok: false, error: 'Buyer not found' });

  const rows = await sql`
    INSERT INTO crm_buyer_files (
      buyer_id, kind, title, reference, doc_date, issued_by, amount, currency, note,
      filename, content_type, size_bytes, data, uploaded_by
    ) VALUES (
      ${buyerId}, ${kind}, ${title}, ${reference}, ${docDate}, ${issuedBy}, ${amount}, ${currency}, ${note},
      ${safeName(filename, type.ext)}, ${type.type}, ${buf.length}, decode(${buf.toString('base64')}, 'base64'), ${actor}
    )
    RETURNING id
  `;
  const id = rows[0].id;
  await audit(sql, actor, 'upload', id, `${kind} for buyer ${buyerId}, ${type.ext}, ${buf.length} bytes`);
  return json(200, { ok: true, id });
}

/*
 * Deleting removes the file for good, after confirmation, and leaves an audit
 * entry. An uploaded file is a copy of something that exists elsewhere, so a
 * wrong upload is simply removed rather than kept hidden.
 */
async function handleDelete(event, sql, id, actor) {
  const qs = event.queryStringParameters || {};
  if (qs.confirmed !== '1') return json(400, { ok: false, error: 'Deleting requires explicit confirmation (confirmed=1)' });
  const rows = await sql`DELETE FROM crm_buyer_files WHERE id = ${id} RETURNING id, kind, buyer_id, size_bytes`;
  if (!rows[0]) return json(404, { ok: false, error: 'Not found -- it may already have been deleted.' });
  await audit(sql, actor, 'delete', id, `${rows[0].kind} for buyer ${rows[0].buyer_id}, ${rows[0].size_bytes} bytes`);
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
  const id = qs.id ? parseId(qs.id) : null;
  if (qs.id && !id) return json(400, { ok: false, error: INVALID_ID_ERROR });
  const buyerId = qs.buyer_id ? parseId(qs.buyer_id) : null;
  if (qs.buyer_id && !buyerId) return json(400, { ok: false, error: INVALID_ID_ERROR });

  try {
    await ensureSchema(sql);

    if (event.httpMethod === 'GET' && id) return await handleDownload(sql, id, actor);
    if (event.httpMethod === 'GET' && buyerId) return await handleList(sql, buyerId);
    if (event.httpMethod === 'GET') return json(400, { ok: false, error: INVALID_ID_ERROR });
    if (event.httpMethod === 'POST') return await handleUpload(event, sql, actor);
    if (event.httpMethod === 'DELETE' && id) return await handleDelete(event, sql, id, actor);

    return json(405, { ok: false, error: 'Method not allowed' }, { Allow: 'GET, POST, DELETE' });
  } catch (err) {
    console.error('[crm-buyer-files] error:', err?.message ?? err);
    await reportFailure(sql, { source: 'crm-buyer-files', method: event.httpMethod, actor }, err);
    return json(500, { ok: false, error: 'Server error' });
  }
};
