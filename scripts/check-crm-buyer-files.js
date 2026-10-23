#!/usr/bin/env node
'use strict';

/*
 * Files uploaded to a buyer's record: who may, what is accepted, how it is
 * served back.
 *
 *   node scripts/check-crm-buyer-files.js        (part of `npm test`)
 *
 * The owner asked (2026-10-20) to add quotations, invoices and other
 * documents the CRM did not issue to existing buyers. A file upload is the
 * one place in the CRM where someone hands the server bytes it did not write,
 * so the checks here are about exactly that:
 *
 *   - a CRM session for every request, read or write;
 *   - the type decided from the file's own bytes, never its name or the type
 *     the browser claims -- HTML or SVG renamed .pdf is refused;
 *   - 4 MB at most, refused before anything is stored;
 *   - served with nosniff and a sandboxing CSP, PDFs and images inline, Word
 *     and Excel as downloads, under a name that cannot break the header;
 *   - the list never carries the file itself;
 *   - delete only with confirmed=1, and every upload, open and delete
 *     audited without the file's content.
 *
 * @neondatabase/serverless is replaced in require.cache with an in-memory
 * stand-in that understands the handful of statements the function sends.
 */

const path = require('path');
const Module = require('module');

const FN = path.join(__dirname, '..', 'netlify', 'functions');

const db = {
  buyers: new Map([[7, { id: 7, deleted_at: null }], [8, { id: 8, deleted_at: new Date('2026-10-01') }]]),
  files: [],
  audit: [],
};
let nextId = 1;
const statements = [];

function fakeSql(strings, ...vals) {
  const q = Array.isArray(strings) ? strings.join('?') : String(strings);
  statements.push(q);
  if (/^\s*CREATE/i.test(q)) return Promise.resolve([]);
  if (/FROM buyers WHERE id/i.test(q)) {
    const b = db.buyers.get(Number(vals[0]));
    return Promise.resolve(b ? [b] : []);
  }
  if (/INSERT INTO crm_buyer_files/i.test(q)) {
    const cols = q.slice(q.indexOf('(') + 1, q.indexOf(')')).split(',').map((c) => c.trim());
    if (cols.length !== vals.length) throw new Error(`INSERT has ${cols.length} columns but ${vals.length} values`);
    const row = { id: nextId++, uploaded_at: new Date() };
    cols.forEach((c, i) => { row[c] = vals[i]; });
    // data arrives as base64 text for decode(): keep it that way, as Postgres would decode it.
    row.data = Buffer.from(row.data, 'base64');
    db.files.push(row);
    return Promise.resolve([{ id: row.id }]);
  }
  if (/SUM\(size_bytes\)/i.test(q)) {
    return Promise.resolve([{ files: db.files.length, used: String(db.files.reduce((n, f) => n + (f.size_bytes || 0), 0)) }]);
  }
  if (/FROM crm_buyer_files WHERE buyer_id/i.test(q)) {
    return Promise.resolve(db.files.filter((f) => f.buyer_id === vals[0]).map((f) => { const { data, ...rest } = f; return rest; }));
  }
  if (/encode\(data, 'base64'\) AS data_b64 FROM crm_buyer_files WHERE id/i.test(q)) {
    const f = db.files.find((x) => x.id === vals[0]);
    // Postgres wraps encode() output at 76 characters; the function must cope.
    return Promise.resolve(f ? [{ ...f, data: undefined, data_b64: f.data.toString('base64').replace(/(.{76})/g, '$1\n') }] : []);
  }
  if (/DELETE FROM crm_buyer_files WHERE id/i.test(q)) {
    const i = db.files.findIndex((x) => x.id === vals[0]);
    if (i < 0) return Promise.resolve([]);
    const [f] = db.files.splice(i, 1);
    return Promise.resolve([{ id: f.id, kind: f.kind, buyer_id: f.buyer_id, size_bytes: f.size_bytes }]);
  }
  if (/INSERT INTO crm_audit_log/i.test(q)) { db.audit.push(vals); return Promise.resolve([]); }
  return Promise.resolve([]);
}

const neonId = require.resolve('@neondatabase/serverless');
require.cache[neonId] = new Module(neonId, null);
Object.assign(require.cache[neonId], { filename: neonId, loaded: true, exports: { neon: () => fakeSql } });

process.env.DATABASE_URL = 'postgres://stub';
process.env.CRM_SESSION_SECRET = 'test-secret-not-a-real-one';
const fx = require('./_session_fixtures');
fx.install(FN);
const { signCrmSession, CRM_COOKIE_NAME } = require(path.join(FN, '_crm_lib.js'));
const { handler } = require(path.join(FN, 'crm-buyer-files.js'));
const COOKIE = `${CRM_COOKIE_NAME}=${signCrmSession('staff', fx.crmClaims('staff'))}`;

let pass = 0, fail = 0;
const t = (name, cond, extra) => {
  cond ? pass++ : fail++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : '   <-- ' + (extra === undefined ? '' : extra)}`);
};

const call = (method, qs = {}, body, cookie = COOKIE) => handler({
  httpMethod: method, headers: cookie ? { cookie } : {}, queryStringParameters: qs,
  body: body === undefined ? null : JSON.stringify(body),
});
const PDF = Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(300, 0x41)]);
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(50)]);
const ZIP = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(50)]);
const up = (over = {}) => call('POST', {}, { buyer_id: 7, kind: 'quotation', filename: 'Q-old-17.pdf', data_base64: PDF.toString('base64'), ...over });

(async () => {
  // ---- a session for everything -------------------------------------------
  for (const [m, qs, body] of [['GET', { buyer_id: '7' }], ['GET', { id: '1' }], ['POST', {}, {}], ['DELETE', { id: '1', confirmed: '1' }]]) {
    const r = await call(m, qs, body, null);
    t(`${m} ${JSON.stringify(qs)} without a CRM session is refused`, r.statusCode === 401, String(r.statusCode));
  }
  t('   and touched nothing', db.files.length === 0 && db.audit.length === 0);

  // ---- uploading -------------------------------------------------------------
  let r = await up({ reference: 'Q-17/2025', doc_date: '2025-11-03', issued_by: 'Previous agent', amount: '12500.5', currency: 'eur', note: 'Sent before the CRM' });
  let f = db.files[db.files.length - 1];
  t('a PDF quotation uploads', r.statusCode === 200 && JSON.parse(r.body).ok === true, r.body);
  t('   stored with its details', f && f.buyer_id === 7 && f.kind === 'quotation' && f.reference === 'Q-17/2025' &&
    f.doc_date === '2025-11-03' && f.amount === 12500.5 && f.currency === 'EUR' && f.uploaded_by === 'staff', JSON.stringify(f && { ...f, data: undefined }));
  t('   its type from its bytes, and its size', f.content_type === 'application/pdf' && f.size_bytes === PDF.length && f.data.equals(PDF));
  t('   the bytes go to the database through decode(..., base64), not as a driver parameter',
    statements.some((q) => /decode\(\?, 'base64'\)/.test(q)));
  t('   audited, without the content', db.audit.some((a) => a[0] === 'staff' && a[1] === 'upload' && /quotation for buyer 7, pdf, \d+ bytes/.test(a[3])) &&
    !db.audit.some((a) => String(a[3]).includes(PDF.toString('base64').slice(0, 20))));

  r = await up({ kind: 'invoice', filename: 'scan.png', data_base64: PNG.toString('base64') });
  t('a PNG invoice uploads', r.statusCode === 200 && db.files[db.files.length - 1].content_type === 'image/png', r.body);
  r = await up({ kind: 'other', title: 'Signed contract', filename: 'contract.docx', data_base64: ZIP.toString('base64') });
  t('a Word file uploads as another document', r.statusCode === 200 && /wordprocessingml/.test(db.files[db.files.length - 1].content_type), r.body);

  const count = db.files.length;
  const refused = async (name, over, status, re) => {
    const res = await up(over);
    t('refused: ' + name, res.statusCode === status && (!re || re.test(res.body)), `${res.statusCode} ${res.body}`);
  };
  await refused('HTML named .pdf', { data_base64: Buffer.from('<html><script>alert(1)</script></html>').toString('base64') }, 415, /Only PDF/);
  await refused('SVG named .png', { filename: 'x.png', data_base64: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>').toString('base64') }, 415);
  await refused('a zip that is not .docx or .xlsx', { filename: 'files.zip', data_base64: ZIP.toString('base64') }, 415);
  await refused('more than 4 MB', { data_base64: Buffer.concat([Buffer.from('%PDF-'), Buffer.alloc(4 * 1024 * 1024)]).toString('base64') }, 413, /4 MB/);
  await refused('text that is not base64', { data_base64: 'not base64 at all!' }, 400);
  await refused('no file', { data_base64: '' }, 413);
  await refused('an unknown kind', { kind: 'receipt' }, 400, /kind/);
  await refused('another document without a name', { kind: 'other', title: '  ' }, 400, /title/);
  await refused('a buyer id that is not an id', { buyer_id: '7abc' }, 400);
  await refused('a buyer that does not exist', { buyer_id: 99 }, 404);
  await refused('a deleted buyer', { buyer_id: 8 }, 404);
  await refused('a negative amount', { amount: -5 }, 400, /amount/);
  await refused('a date that is not a date', { doc_date: '03/11/2025' }, 400, /doc_date/);
  t('   none of the refused uploads was stored', db.files.length === count, String(db.files.length - count));

  // ---- the list ---------------------------------------------------------------
  r = await call('GET', { buyer_id: '7' });
  const list = JSON.parse(r.body);
  t("a buyer's files are listed", r.statusCode === 200 && list.length === 3, r.body.slice(0, 200));
  t('   without the files themselves', list.every((x) => !('data' in x)) &&
    statements.filter((q) => /WHERE buyer_id/.test(q)).every((q) => !/\bdata\b/.test(q.split('FROM')[0])));
  t('   and not cached', r.headers['Cache-Control'] === 'no-store, private');
  r = await call('GET', { buyer_id: '7x' });
  t('   a malformed buyer id lists nothing', r.statusCode === 400);
  r = await call('GET', {});
  t('   nor does no buyer id', r.statusCode === 400);

  // ---- opening ----------------------------------------------------------------
  const pdfRow = db.files.find((x) => x.content_type === 'application/pdf');
  r = await call('GET', { id: String(pdfRow.id) });
  t('a PDF opens, byte for byte', r.statusCode === 200 && r.isBase64Encoded === true && Buffer.from(r.body, 'base64').equals(PDF));
  t('   inline, as application/pdf', r.headers['Content-Type'] === 'application/pdf' && /^inline;/.test(r.headers['Content-Disposition']), JSON.stringify(r.headers));
  t('   with nosniff and a sandboxing CSP', r.headers['X-Content-Type-Options'] === 'nosniff' && /^sandbox;/.test(r.headers['Content-Security-Policy']));
  t('   not cached', r.headers['Cache-Control'] === 'no-store, private');
  t('   and the opening is audited', db.audit.some((a) => a[1] === 'open' && a[2] === pdfRow.id));
  const docx = db.files.find((x) => /wordprocessingml/.test(x.content_type));
  r = await call('GET', { id: String(docx.id) });
  t('a Word file downloads rather than opens', /^attachment;/.test(r.headers['Content-Disposition']), r.headers['Content-Disposition']);

  r = await up({ filename: 'a"b;\r\nX-Evil: 1/../../q.pdf' });
  const odd = db.files[db.files.length - 1];
  r = await call('GET', { id: String(odd.id) });
  t('a name with quotes, newlines or a path cannot break the header',
    r.statusCode === 200 && !/[\r\n]/.test(r.headers['Content-Disposition']) && /filename="q\.pdf"/.test(r.headers['Content-Disposition']), r.headers['Content-Disposition']);

  // A row that is not what it says (written some other way) is not served as something else.
  db.files.push({ id: nextId++, buyer_id: 7, kind: 'other', filename: 'x.pdf', content_type: 'application/pdf', size_bytes: 10, data: Buffer.from('<html></html>') });
  r = await call('GET', { id: String(nextId - 1) });
  t('a stored file that is not a PDF, PNG, JPEG, WebP, Word or Excel file is not served', r.statusCode === 415, String(r.statusCode));
  db.files.pop();

  r = await call('GET', { id: '999' });
  t('a file that does not exist is a 404', r.statusCode === 404);
  r = await call('GET', { id: '1e1' });
  t('an id that is not an id is refused', r.statusCode === 400);

  // ---- deleting ---------------------------------------------------------------
  const before = db.files.length;
  r = await call('DELETE', { id: String(pdfRow.id) });
  t('deleting without confirmation is refused', r.statusCode === 400 && db.files.length === before, r.body);
  r = await call('DELETE', { id: String(pdfRow.id), confirmed: '1' });
  t('deleting with confirmation removes the file', r.statusCode === 200 && db.files.length === before - 1 && !db.files.some((x) => x.id === pdfRow.id), r.body);
  t('   and is audited', db.audit.some((a) => a[1] === 'delete' && a[2] === pdfRow.id && /quotation for buyer 7/.test(a[3])));
  r = await call('DELETE', { id: String(pdfRow.id), confirmed: '1' });
  t('   a second delete finds nothing', r.statusCode === 404);

  // ---- the total cap and the usage line (2026-10-20) -------------------------
  {
    db.files.length = 0;
    delete process.env.CRM_FILES_TOTAL_MB;
    let r = await call('GET', { usage: '1' }, undefined, null);
    t('usage needs a CRM session', r.statusCode === 401);
    r = await up();
    r = await call('GET', { usage: '1' });
    let u = JSON.parse(r.body).usage;
    t('usage reports files, bytes used and the cap (300 MB by default)', r.statusCode === 200 && u.files === 1 && u.used_bytes === PDF.length &&
      u.cap_bytes === 300 * 1024 * 1024 && u.warn === false, JSON.stringify(u));
    t('   not cached', r.headers['Cache-Control'] === 'no-store, private');
    // A cap of a little over four of these PDFs: the 80% warning, then a refusal.
    process.env.CRM_FILES_TOTAL_MB = String((PDF.length * 4.2) / 1048576);
    await up(); await up(); await up();
    r = await call('GET', { usage: '1' }); u = JSON.parse(r.body).usage;
    t('from 80 percent of the cap, usage says to warn', u.files === 4 && u.share >= 0.8 && u.share < 1 && u.warn === true, JSON.stringify(u));
    const before = db.files.length;
    r = await up();
    t('an upload that would pass the cap is refused, and says how to make room', r.statusCode === 413 && /reached their \d+ MB limit/.test(r.body) && /Delete files/.test(r.body), r.body);
    t('   and nothing is stored', db.files.length === before);
    process.env.CRM_FILES_TOTAL_MB = 'nonsense';
    r = await call('GET', { usage: '1' });
    t('a cap that is not a number falls back to 300 MB', JSON.parse(r.body).usage.cap_bytes === 300 * 1024 * 1024);
    delete process.env.CRM_FILES_TOTAL_MB;

    // What Netlify's 6 MB buffered limit (request and response) really allows.
    const LIMIT = 6 * 1000 * 1000; // the smaller reading of "6 MB"
    const biggest = Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(4 * 1024 * 1024 - 9, 0x20)]);
    const reqBody = JSON.stringify({ buyer_id: 7, kind: 'quotation', title: '', filename: 'x'.repeat(200) + '.pdf', reference: 'R'.repeat(100),
      doc_date: '2026-10-20', issued_by: 'I'.repeat(200), note: 'N'.repeat(1000), amount: 123456.78, currency: 'USD', data_base64: biggest.toString('base64') });
    t('the largest file allowed (4 MB) fits Netlify\'s 6 MB request limit even with every field full', Buffer.byteLength(reqBody) < LIMIT, String(Buffer.byteLength(reqBody)));
    r = await up({ data_base64: biggest.toString('base64') });
    const stored = db.files[db.files.length - 1];
    r = await call('GET', { id: String(stored.id) });
    t('   and opening it fits the 6 MB response limit', r.statusCode === 200 && Buffer.byteLength(r.body) + 1000 < LIMIT, String(Buffer.byteLength(r.body)));
    t('   4 MB is below the practical ceiling of about 4.5 MB (6 MB less base64\'s third)', 4 * 1024 * 1024 < (LIMIT * 3) / 4 - 2000);
  }

  console.log(`\nbuyer-files ${fail ? 'FAILED' : 'OK'} -- uploads are checked by their bytes, capped, served safely and audited.`);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('check-crm-buyer-files CRASHED:', e && e.stack ? e.stack : e); process.exit(1); });
