#!/usr/bin/env node
'use strict';

/*
 * A quotation or invoice can be issued without a CRM buyer record.
 *
 *   node scripts/check-crm-documents.js        (part of `npm test`)
 *
 * Until 2026-09-07, crm_documents.buyer_id was NOT NULL and /crm/document
 * refused to load without a ?buyer_id= in the URL. Quoting a company meant
 * creating a CRM buyer for them first, which is backwards: a quotation is
 * usually what you send someone *before* they are a buyer. The owner asked
 * for it to be independent.
 *
 * These are money documents, so the change is tested rather than assumed,
 * in both directions:
 *
 *   - a document with no buyer still records who it is for
 *   - a document with a buyer still copies that buyer's details, unchanged
 *   - a document for nobody at all is refused
 *
 * That last one matters most. Making a required field optional is exactly
 * how you end up able to issue an invoice addressed to no one, and the
 * failure would not surface until a real document printed blank.
 *
 * The database is stubbed the same way scripts/check-unsubscribe.js does it:
 * @neondatabase/serverless is replaced in require.cache before the function
 * under test is loaded, so this runs offline and touches nothing real.
 */

const path = require('path');
const Module = require('module');

const ROOT = path.join(__dirname, '..');
const FN = path.join(ROOT, 'netlify', 'functions');

// ---- an in-memory stand-in for buyers + crm_documents -------------------
const db = {
  buyers: new Map([
    [7, {
      company_name: 'Olive Importers BV',
      contact_name: 'Jan de Vries',
      country_region: 'EU',
      contact_email: 'jan@example.test',
      contact_phone: '+31 10 000 0000',
    }],
  ]),
  documents: [],
  altered: false,
};

let nextId = 100;

function fakeSql(strings, ...vals) {
  const q = Array.isArray(strings) ? strings.join('?') : String(strings);
  // Every statement, kept so the schema migrations can be asserted on
  // directly rather than inferred from their effects.
  fakeSql.statements.push(q);

  if (/^\s*ALTER TABLE crm_documents ALTER COLUMN buyer_id DROP NOT NULL/i.test(q.trim())) {
    db.altered = true;
    return Promise.resolve([]);
  }
  if (/^\s*CREATE|^\s*ALTER/i.test(q.trim())) return Promise.resolve([]);

  if (/FROM buyers WHERE id/i.test(q)) {
    const row = db.buyers.get(Number(vals[0]));
    return Promise.resolve(row ? [row] : []);
  }

  if (/INSERT INTO crm_documents/i.test(q)) {
    /*
     * Map the bound values onto column names by reading the statement,
     * rather than destructuring by position.
     *
     * Positional destructuring broke this test twice: once because
     * doc_number is a literal '' rather than a binding, and again when
     * subject and body were added in the middle of the column list. Both
     * times every assertion silently checked the wrong field. A test that
     * quietly moves its own goalposts when the code changes is worse than
     * no test, so it now derives the mapping from the query itself and
     * fails loudly if the two do not line up.
     */
    const cols = q.slice(q.indexOf('(') + 1, q.indexOf(')')).split(',').map((c) => c.trim());
    const valuesClause = q.slice(q.indexOf('VALUES'));
    const slots = valuesClause.slice(valuesClause.indexOf('(') + 1, valuesClause.lastIndexOf(')')).split(',');

    if (cols.length !== slots.length) {
      throw new Error(`INSERT has ${cols.length} columns but ${slots.length} value slots`);
    }

    const row = { id: nextId++, created_at: new Date('2026-09-07T00:00:00Z'), doc_number: '' };
    let vi = 0;
    slots.forEach((slot, i) => {
      // a '?' marks where a bound value went; anything else is a literal
      row[cols[i]] = slot.includes('?') ? vals[vi++] : slot.trim().replace(/^'|'$/g, '');
    });
    if (vi !== vals.length) {
      throw new Error(`INSERT bound ${vals.length} values but only ${vi} slots consumed them`);
    }

    db.documents.push(row);
    return Promise.resolve([{ id: row.id, created_at: row.created_at }]);
  }
  if (/UPDATE crm_documents SET doc_number/i.test(q)) {
    const doc = db.documents.find((d) => d.id === Number(vals[1]));
    if (doc) doc.doc_number = vals[0];
    return Promise.resolve([]);
  }
  if (/INSERT INTO crm_audit_log/i.test(q)) return Promise.resolve([]);

  return Promise.resolve([]);
}
fakeSql.statements = [];
fakeSql.query = () => Promise.resolve([]);

const neonId = require.resolve('@neondatabase/serverless');
require.cache[neonId] = new Module(neonId, null);
require.cache[neonId].filename = neonId;
require.cache[neonId].loaded = true;
require.cache[neonId].exports = { neon: () => fakeSql };

const SECRET = 'test-secret-not-a-real-one';
process.env.DATABASE_URL = 'postgres://stub';
process.env.CRM_SESSION_SECRET = SECRET;

const { signSession, CRM_COOKIE_NAME } = require(path.join(FN, '_crm_lib.js'));
const docs = require(path.join(FN, 'crm-documents.js'));

const COOKIE = `${CRM_COOKIE_NAME}=${signSession('staff', SECRET)}`;

let pass = 0, fail = 0;
const t = (name, cond, extra) => {
  cond ? pass++ : fail++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : '   <-- ' + (extra === undefined ? '' : extra)}`);
};

const LINE_ITEMS = [{ description: 'Aggizi green olives, 141/160', quantity: 2, unit: 'MT', unit_price: 1500 }];

function create(body, { cookie = COOKIE } = {}) {
  return docs.handler({
    httpMethod: 'POST',
    headers: cookie ? { cookie } : {},
    queryStringParameters: {},
    body: JSON.stringify(body),
  });
}

(async () => {
  // ---- authorisation is still the first gate ---------------------------
  {
    const res = await create({ doc_type: 'quotation', buyer_company_name: 'X', line_items: LINE_ITEMS }, { cookie: null });
    t('no session is refused before anything is written', res.statusCode === 401, res.statusCode);
    t('   and nothing was stored', db.documents.length === 0, db.documents.length);
  }

  // ---- the new path: no buyer record at all ----------------------------
  {
    const res = await create({
      doc_type: 'quotation',
      buyer_company_name: 'Cairo Foods Trading',
      buyer_contact_name: 'Mona Said',
      buyer_country: 'Egypt',
      buyer_address: 'mona@example.test',
      currency: 'usd',
      line_items: LINE_ITEMS,
    });
    const out = JSON.parse(res.body);
    const doc = db.documents[db.documents.length - 1];

    t('a quotation can be issued with no buyer_id', res.statusCode === 200 && out.ok === true, res.body);
    t('   buyer_id is stored as null, not 0 or NaN', doc && doc.buyer_id === null, doc && doc.buyer_id);
    t('   the typed company name is what the document says', doc && doc.buyer_company_name === 'Cairo Foods Trading', doc && doc.buyer_company_name);
    t('   optional recipient details are kept', doc && doc.buyer_contact_name === 'Mona Said' && doc.buyer_country === 'Egypt', doc && doc.buyer_contact_name);
    t('   it still gets a real document number', /^Q-2026-\d{6}$/.test(out.doc_number), out.doc_number);
    t('   currency is still normalised', doc && doc.currency === 'USD', doc && doc.currency);
    t('   the total is still computed server-side', doc && Number(doc.total) === 3000, doc && doc.total);
    t('   the NOT NULL was dropped before inserting', db.altered === true);
  }

  // ---- company name only, everything else omitted ----------------------
  {
    const before = db.documents.length;
    const res = await create({ doc_type: 'invoice', buyer_company_name: 'Sole Trader', line_items: LINE_ITEMS });
    const doc = db.documents[db.documents.length - 1];
    t('a company name alone is enough', res.statusCode === 200 && db.documents.length === before + 1, res.body);
    t('   missing contact details become null, not empty strings',
      doc && doc.buyer_contact_name === null && doc.buyer_country === null && doc.buyer_address === null,
      doc && JSON.stringify([doc.buyer_contact_name, doc.buyer_country, doc.buyer_address]));
    t('   an invoice is numbered INV, not Q', /^INV-2026-\d{6}$/.test(JSON.parse(res.body).doc_number), JSON.parse(res.body).doc_number);
  }

  // ---- a document addressed to nobody is refused -----------------------
  //
  // The whole risk of making buyer_id optional in one line.
  for (const [label, body] of [
    ['no recipient at all', {}],
    ['an empty company name', { buyer_company_name: '' }],
    ['whitespace only', { buyer_company_name: '    ' }],
  ]) {
    const before = db.documents.length;
    const res = await create(Object.assign({ doc_type: 'quotation', line_items: LINE_ITEMS }, body));
    const out = JSON.parse(res.body);
    t(`refused: ${label}`, res.statusCode === 400 && (out.fields || []).includes('buyer_company_name'), res.body);
    t('   and nothing was written', db.documents.length === before, db.documents.length - before);
  }

  // ---- the old path is untouched ---------------------------------------
  {
    const res = await create({ doc_type: 'quotation', buyer_id: 7, line_items: LINE_ITEMS });
    const doc = db.documents[db.documents.length - 1];
    t('a linked buyer still works', res.statusCode === 200, res.body);
    t('   buyer_id is recorded', doc && Number(doc.buyer_id) === 7, doc && doc.buyer_id);
    t('   details still come from the buyer record', doc && doc.buyer_company_name === 'Olive Importers BV', doc && doc.buyer_company_name);
    t('   email and phone are still joined into the address',
      doc && doc.buyer_address === 'jan@example.test · +31 10 000 0000', doc && doc.buyer_address);
    t('   a buyer_company_name in the body cannot override the linked record',
      doc && doc.buyer_company_name !== 'Not This One');
  }

  {
    const res = await create({ doc_type: 'quotation', buyer_id: 7, buyer_company_name: 'Not This One', line_items: LINE_ITEMS });
    const doc = db.documents[db.documents.length - 1];
    t('when both are sent, the buyer record wins', res.statusCode === 200 && doc.buyer_company_name === 'Olive Importers BV', doc.buyer_company_name);
  }

  // ---- bad buyer references still fail ---------------------------------
  {
    const before = db.documents.length;
    const res = await create({ doc_type: 'quotation', buyer_id: 999, line_items: LINE_ITEMS });
    t('an unknown buyer_id is still refused', res.statusCode === 400 && /Buyer not found/.test(res.body), res.body);
    t('   and nothing was written', db.documents.length === before);
  }
  {
    const res = await create({ doc_type: 'quotation', buyer_id: 'abc', line_items: LINE_ITEMS });
    t('a non-numeric buyer_id is still refused', res.statusCode === 400 && /buyer_id/.test(res.body), res.body);
  }

  // ---- letters: the third type ----------------------------------------
  //
  // A letter shares the table but not the shape: no line items, no currency,
  // no totals. What it must not lose is everything that makes a document a
  // document -- a number, a recipient, a date, a permanent record.
  {
    const res = await create({
      doc_type: 'letter',
      buyer_company_name: 'Cairo Foods Trading',
      subject: 'Confirmation of sample dispatch',
      body: 'Dear Ms Said,\n\nThe samples left Alexandria today.\n\nRegards,',
    });
    const out = JSON.parse(res.body);
    const doc = db.documents[db.documents.length - 1];

    t('a letter can be issued with no line items at all', res.statusCode === 200 && out.ok === true, res.body);
    t('   it is numbered in its own series', /^L-2026-\d{6}$/.test(out.doc_number), out.doc_number);
    t('   the body is stored', doc && /samples left Alexandria/.test(doc.body), doc && doc.body);
    t('   the subject is stored', doc && doc.subject === 'Confirmation of sample dispatch', doc && doc.subject);
    t('   it still records who it is for', doc && doc.buyer_company_name === 'Cairo Foods Trading', doc && doc.buyer_company_name);
    t('   line items are empty, not absent', doc && doc.line_items === '[]', doc && doc.line_items);
    t('   the total is zero', doc && Number(doc.total) === 0, doc && doc.total);
  }

  {
    const res = await create({ doc_type: 'letter', buyer_company_name: 'X', body: 'Short note.' });
    const doc = db.documents[db.documents.length - 1];
    t('a subject is optional on a letter', res.statusCode === 200 && doc.subject === null, res.body);
  }

  // an empty letter would issue, take a number, and print blank
  for (const [label, body] of [
    ['no body at all', {}],
    ['an empty body', { body: '' }],
    ['whitespace only', { body: '   \n  ' }],
  ]) {
    const before = db.documents.length;
    const res = await create(Object.assign({ doc_type: 'letter', buyer_company_name: 'X' }, body));
    const out = JSON.parse(res.body);
    t(`a letter is refused with ${label}`, res.statusCode === 400 && (out.fields || []).includes('body'), res.body);
    t('   and nothing was written', db.documents.length === before);
  }

  {
    // the compose form hides these for a letter, so anything arriving is a
    // stale draft rather than intent -- ignored, not rejected
    const res = await create({
      doc_type: 'letter', buyer_company_name: 'X', body: 'Note.',
      line_items: LINE_ITEMS, currency: 'EUR', incoterm: 'FOB Alexandria',
    });
    const doc = db.documents[db.documents.length - 1];
    t('a letter ignores line items left over from a priced draft',
      res.statusCode === 200 && doc.line_items === '[]' && Number(doc.total) === 0, doc.line_items);
    t('   and ignores currency and incoterm', doc.currency === 'USD' && doc.incoterm === null,
      doc.currency + '/' + doc.incoterm);
  }

  {
    const before = db.documents.length;
    const res = await create({ doc_type: 'letter', body: 'Note.' });
    t('a letter still needs a recipient', res.statusCode === 400 && /buyer_company_name/.test(res.body), res.body);
    t('   and nothing was written', db.documents.length === before);
  }

  {
    // the reverse: a priced document must not become body-only
    const res = await create({ doc_type: 'quotation', buyer_company_name: 'X', body: 'Just words.' });
    t('a quotation still requires line items', res.statusCode === 400 && /line_items/.test(res.body), res.body);
  }

  // ---- the structured letter parts -------------------------------------
  //
  // A letter used to be a subject and one free-text box. Each part of a
  // business letter now has its own field; only the body is required, because
  // a short note legitimately has no enclosures and an internal memo may not
  // need a formal close.
  {
    const res = await create({
      doc_type: 'letter',
      buyer_company_name: 'Cairo Foods Trading',
      subject: 'Confirmation of sample dispatch',
      salutation: 'Dear Ms Said,',
      body: 'The samples left Alexandria on 5 September.',
      closing: 'Yours sincerely,',
      signatory_name: 'Mohamed Hassan',
      signatory_title: 'Export Manager',
      enclosures: 'Quotation Q-2026-000001',
      cc: 'accounts@example.test',
    });
    const doc = db.documents[db.documents.length - 1];
    t('every letter part is stored', res.statusCode === 200 &&
      doc.salutation === 'Dear Ms Said,' && doc.closing === 'Yours sincerely,' &&
      doc.signatory_name === 'Mohamed Hassan' && doc.signatory_title === 'Export Manager' &&
      doc.enclosures === 'Quotation Q-2026-000001' && doc.cc === 'accounts@example.test',
      JSON.stringify([doc.salutation, doc.closing, doc.signatory_name, doc.signatory_title, doc.enclosures, doc.cc]));
  }

  {
    // the short-note case: body only
    const res = await create({ doc_type: 'letter', buyer_company_name: 'X', body: 'Short note.' });
    const doc = db.documents[db.documents.length - 1];
    t('all the letter parts are optional', res.statusCode === 200 &&
      doc.salutation === null && doc.closing === null && doc.signatory_name === null &&
      doc.signatory_title === null && doc.enclosures === null && doc.cc === null,
      JSON.stringify([doc.salutation, doc.closing, doc.signatory_name, doc.enclosures]));
    t('   an empty string is stored as null, not as an empty field',
      doc.closing !== '', JSON.stringify(doc.closing));
  }

  {
    // the form sends '' for anything the writer left alone
    const res = await create({
      doc_type: 'letter', buyer_company_name: 'X', body: 'Note.',
      salutation: '', closing: '', signatory_name: '   ', enclosures: '', cc: '',
    });
    const doc = db.documents[db.documents.length - 1];
    t('blank and whitespace-only parts become null', res.statusCode === 200 &&
      doc.salutation === null && doc.signatory_name === null, JSON.stringify([doc.salutation, doc.signatory_name]));
  }

  {
    // a quotation must not pick these up
    const res = await create({
      doc_type: 'quotation', buyer_company_name: 'X', line_items: LINE_ITEMS,
      salutation: 'Dear Sir,', signatory_name: 'Someone', enclosures: 'A thing',
    });
    const doc = db.documents[db.documents.length - 1];
    t('a quotation ignores letter parts', res.statusCode === 200 &&
      doc.salutation === null && doc.signatory_name === null && doc.enclosures === null,
      JSON.stringify([doc.salutation, doc.signatory_name, doc.enclosures]));
  }

  {
    // long values are capped rather than rejected, like every other field
    const res = await create({
      doc_type: 'letter', buyer_company_name: 'X', body: 'Note.',
      signatory_name: 'N'.repeat(500), closing: 'C'.repeat(300),
    });
    const doc = db.documents[db.documents.length - 1];
    t('over-long parts are truncated to their limits',
      res.statusCode === 200 && doc.signatory_name.length === 200 && doc.closing.length === 80,
      JSON.stringify([doc.signatory_name.length, doc.closing.length]));
  }

  // ---- the document's language ----------------------------------------
  //
  // The language is not a display preference: it is stored on the row and it
  // decides which sheet a buyer receives. The failure that matters is silent
  // -- a document that should have gone out in Arabic going out in English,
  // with nothing anywhere to say so -- so an unrecognised value is refused
  // rather than defaulted, and an absent one is English on purpose.
  {
    const res = await create({
      doc_type: 'quotation', buyer_company_name: 'Cairo Distributor', language: 'ar', line_items: LINE_ITEMS,
    });
    const doc = db.documents[db.documents.length - 1];
    t('a document can be issued in Arabic', res.statusCode === 200 && doc.language === 'ar', doc.language);
  }
  {
    const res = await create({
      doc_type: 'letter', buyer_company_name: 'X', body: 'نص الخطاب.', language: 'ar',
    });
    const doc = db.documents[db.documents.length - 1];
    t('   letters too', res.statusCode === 200 && doc.language === 'ar', doc.language);
  }
  {
    await create({ doc_type: 'quotation', buyer_company_name: 'X', line_items: LINE_ITEMS });
    const doc = db.documents[db.documents.length - 1];
    t('a document that says nothing about language is English',
      doc.language === 'en', doc.language);
  }
  {
    // Whatever this was meant to be, printing English silently is the one
    // outcome that must not happen: it sends the wrong document with no trace.
    const res = await create({
      doc_type: 'quotation', buyer_company_name: 'X', language: 'fr', line_items: LINE_ITEMS,
    });
    t('an unsupported language is refused, not quietly defaulted',
      res.statusCode === 400 && /language/.test(res.body), res.body);
  }
  {
    const res = await create({
      doc_type: 'quotation', buyer_company_name: 'X', language: 'AR', line_items: LINE_ITEMS,
    });
    const doc = db.documents[db.documents.length - 1];
    t('   and a capitalised one is accepted, not refused on case',
      res.statusCode === 200 && doc.language === 'ar', res.body);
  }
  {
    const stmts = fakeSql.statements.filter((s) => /ADD COLUMN IF NOT EXISTS language/i.test(s));
    t('the language column is added idempotently, with a default so old rows read English',
      stmts.length > 0 && /DEFAULT 'en'/i.test(stmts[0]) && /NOT NULL/i.test(stmts[0]), stmts[0]);
  }

  // ---- everything else the handler validated, it still validates -------
  {
    const res = await create({ doc_type: 'receipt', buyer_company_name: 'X', line_items: LINE_ITEMS });
    t('an unknown doc_type is refused', res.statusCode === 400 && /doc_type/.test(res.body), res.body);
  }
  {
    const res = await create({ doc_type: 'quotation', buyer_company_name: 'X', line_items: [] });
    t('a document with no line items is refused', res.statusCode === 400 && /line_items/.test(res.body), res.body);
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
})().catch((err) => {
  console.error('check-crm-documents CRASHED:', err && err.stack ? err.stack : err);
  process.exit(1);
});
