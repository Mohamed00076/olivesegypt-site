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

const REGIONS = new Set(['Africa', 'Middle East', 'Asia', 'EU', 'North America']);
const STAGES = new Set([
  'Lead', 'Contacted', 'Qualifying', 'Sample Requested', 'Sample Sent',
  'Negotiation', 'Contract Signed', 'Shipment Prepared', 'Exported/Completed',
  'Lost/Stalled',
]);

const EXPORT_COLUMNS = [
  'id', 'company_name', 'country_region', 'contact_name', 'contact_title', 'contact_email',
  'contact_phone', 'contact_whatsapp', 'lead_source', 'current_stage', 'packaging_format',
  'estimated_volume', 'target_price', 'quoted_price', 'incoterm', 'certifications_required',
  'certification_gap', 'next_action', 'next_action_due', 'assigned_to', 'created_at', 'updated_at',
];

// CSV-injection mitigation: neutralize any cell whose content, once
// coerced to a string, starts with a character a spreadsheet app would
// interpret as the start of a formula (=, +, -, @) by prefixing a
// single quote so it's forced to render as plain text on open.
function csvCell(value) {
  let s = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  if (/[",\n\r]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function toCsv(rows) {
  const header = EXPORT_COLUMNS.join(',');
  const lines = rows.map((r) => EXPORT_COLUMNS.map((c) => csvCell(r[c])).join(','));
  return [header].concat(lines).join('\r\n');
}

// Minimal RFC4180-ish CSV parser: handles quoted fields, embedded commas,
// embedded newlines inside quotes, and doubled-quote escaping.
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field); field = '';
    } else if (c === '\n') {
      row.push(field); field = ''; rows.push(row); row = [];
    } else if (c === '\r') {
      // skip; \n (if present) handles the row break
    } else {
      field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.length > 1 || (r.length === 1 && r[0] !== ''));
}

function str(v) { return typeof v === 'string' ? v : v == null ? '' : String(v); }
function clean(v, cap) { return str(v).trim().slice(0, cap); }

async function ensureSchema(sql) {
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

async function handleExport(event, sql, actor) {
  const qs = event.queryStringParameters || {};
  if (qs.confirmed !== '1') {
    return json(400, { ok: false, error: 'Export requires explicit confirmation (confirmed=1)' });
  }
  const rows = await sql`SELECT * FROM buyers WHERE deleted_at IS NULL ORDER BY company_name ASC`;
  const csv = toCsv(rows);

  await sql`INSERT INTO crm_audit_log (actor, action, record_type, record_id, details) VALUES (${actor}, 'export', 'buyers_bulk', NULL, ${'rows=' + rows.length})`;

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="crm-buyers-export.csv"',
      'Cache-Control': 'no-store, private',
    },
    body: csv,
  };
}

// Validate + sanitize a parsed CSV row into a safe insertable buyer
// object, or return null with a reason if the row can't be imported.
function validateImportRow(headerMap, rawRow) {
  const get = (name) => (headerMap[name] !== undefined ? clean(rawRow[headerMap[name]], 2000) : '');

  const company_name = get('company_name');
  const country_region = get('country_region');
  if (company_name.length < 2) return { error: 'company_name required' };
  if (!REGIONS.has(country_region)) return { error: 'country_region must be one of: ' + Array.from(REGIONS).join(', ') };

  let current_stage = get('current_stage') || 'Lead';
  if (!STAGES.has(current_stage)) current_stage = 'Lead';

  const contact_email = get('contact_email');
  if (contact_email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contact_email)) {
    return { error: 'contact_email is not a valid email address' };
  }

  return {
    row: {
      company_name, country_region, current_stage,
      contact_name: get('contact_name') || null,
      contact_title: get('contact_title') || null,
      contact_email: contact_email || null,
      contact_phone: get('contact_phone') || null,
      contact_whatsapp: get('contact_whatsapp') || null,
      lead_source: get('lead_source') || null,
      packaging_format: get('packaging_format') || null,
      estimated_volume: get('estimated_volume') || null,
      target_price: get('target_price') || null,
      quoted_price: get('quoted_price') || null,
      incoterm: get('incoterm') || null,
      certifications_required: get('certifications_required') || null,
      next_action: get('next_action') || null,
      notes: get('notes') || null,
    },
  };
}

async function handleImport(event, sql, actor) {
  const body = readJsonBody(event) || {};
  const csvText = typeof body.csv === 'string' ? body.csv.slice(0, 2_000_000) : '';
  if (!csvText.trim()) return json(400, { ok: false, error: 'No CSV content provided' });

  const parsed = parseCsv(csvText);
  if (parsed.length < 2) return json(400, { ok: false, error: 'CSV must contain a header row and at least one data row' });

  const header = parsed[0].map((h) => h.trim().toLowerCase());
  const headerMap = {};
  header.forEach((h, i) => { headerMap[h] = i; });

  const results = { imported: 0, skipped: [] };

  for (let i = 1; i < parsed.length; i++) {
    const rawRow = parsed[i];
    const { row, error } = validateImportRow(headerMap, rawRow);
    if (error) {
      results.skipped.push({ line: i + 1, reason: error });
      continue;
    }
    const inserted = await sql`
      INSERT INTO buyers (
        created_by, assigned_to, company_name, country_region, contact_name, contact_title,
        contact_email, contact_phone, contact_whatsapp, lead_source, current_stage,
        packaging_format, estimated_volume, target_price, quoted_price, incoterm,
        certifications_required, next_action, notes
      ) VALUES (
        ${actor}, ${actor}, ${row.company_name}, ${row.country_region}, ${row.contact_name}, ${row.contact_title},
        ${row.contact_email}, ${row.contact_phone}, ${row.contact_whatsapp}, ${row.lead_source}, ${row.current_stage},
        ${row.packaging_format}, ${row.estimated_volume}, ${row.target_price}, ${row.quoted_price}, ${row.incoterm},
        ${row.certifications_required}, ${row.next_action}, ${row.notes}
      )
      RETURNING id
    `;
    const newId = inserted[0].id;
    await sql`INSERT INTO buyer_stage_history (buyer_id, from_stage, to_stage, changed_by) VALUES (${newId}, NULL, ${row.current_stage}, ${actor})`;
    results.imported += 1;
  }

  await sql`INSERT INTO crm_audit_log (actor, action, record_type, record_id, details) VALUES (${actor}, 'import', 'buyers_bulk', NULL, ${'imported=' + results.imported + ' skipped=' + results.skipped.length})`;

  return json(200, { ok: true, ...results });
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

  try {
    await ensureSchema(sql);
    if (event.httpMethod === 'GET') return await handleExport(event, sql, actor);
    if (event.httpMethod === 'POST') return await handleImport(event, sql, actor);
    return json(405, { ok: false, error: 'Method not allowed' }, { Allow: 'GET, POST' });
  } catch (err) {
    console.error('[crm-csv] error:', err?.message ?? err);
    return json(500, { ok: false, error: 'Server error' });
  }
};
