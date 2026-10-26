'use strict';

/*
 * Sample CRM documents, printed by the real document page with made-up data,
 * so the printed result can be checked without a database or a login.
 *
 * Owner's document-design spec (2026-10-25): the printed documents must be
 * tagged PDFs in their own language, with a title, static embedded fonts and
 * a correct Arabic text layer. Those are properties of the printed file, not
 * of the page source, so a set of real prints is kept here:
 *
 *   scripts/print-crm-samples.js        prints them (a maintainer tool,
 *                                       like generate-export-catalog-pdf.js)
 *   scripts/check-crm-document-pdfs.js  checks them, and fails when the page
 *                                       or its fonts changed after the print
 *
 * The prints go in docs/crm-samples/, which is never published. Fake data
 * only (owner's rules): the buyer is "ZZ Test", the phone +00 000 000 000,
 * the email zz@example.test. No real buyer, figure or bank account.
 */

const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = 'docs/crm-samples';
const MANIFEST = path.join(ROOT, OUT_DIR, 'manifest.json');

// What a print depends on: change any of these and the samples are stale.
const INPUTS = [
  'crm/document/view/index.html',
  'assets/fonts/doc-fonts.css',
  'assets/fonts/doc/plus-jakarta-sans-latin-400-normal.woff2',
  'assets/fonts/doc/plus-jakarta-sans-latin-600-normal.woff2',
  'assets/fonts/doc/plus-jakarta-sans-latin-700-normal.woff2',
  'assets/fonts/doc/plus-jakarta-sans-latin-800-normal.woff2',
  'assets/fonts/doc/plus-jakarta-sans-latin-ext-400-normal.woff2',
  'assets/fonts/doc/plus-jakarta-sans-latin-ext-600-normal.woff2',
  'assets/fonts/doc/plus-jakarta-sans-latin-ext-700-normal.woff2',
  'assets/fonts/doc/plus-jakarta-sans-latin-ext-800-normal.woff2',
  'assets/fonts/doc/amiri-arabic-400-normal.woff2',
  'assets/fonts/doc/amiri-arabic-700-normal.woff2',
  'assets/logo-BJ1TOn9V.png',
  'scripts/crm-sample-documents.js',
];

const BUYER = {
  en: { buyer_company_name: 'ZZ Test Importer', buyer_contact_name: 'ZZ Test', buyer_address: 'Test Street 1, Test City', buyer_country: 'ZZ' },
  ar: { buyer_company_name: 'شركة ZZ Test للاستيراد', buyer_contact_name: 'ZZ Test', buyer_address: 'شارع الاختبار 1', buyer_country: 'ZZ' },
};

function lines(lang, n) {
  const items = lang === 'ar'
    ? [['زيتون أخضر كامل في محلول ملحي', 'دلو 10 كجم'], ['زيتون أسود مؤكسد مقطع في محلول ملحي', 'دلو 5 كجم'], ['زيتون أسود مؤكسد منزوع النواة في برطمانات زجاجية', 'كرتونة']]
    : [['Green olives, whole, in brine', '10 kg bucket'], ['Oxidized black olives, sliced, in brine', '5 kg bucket'], ['Oxidized black olives, pitted, in glass jars', 'carton']];
  return Array.from({ length: n }, (_, i) => ({
    description: items[i % 3][0], unit: items[i % 3][1], quantity: 100 + i * 10, unit_price: 10 + (i % 3) * 2.25,
  }));
}

function priced(lang, type, n, extra) {
  const li = lines(lang, n);
  const total = li.reduce((s, l) => s + l.quantity * l.unit_price, 0);
  return Object.assign({
    id: 1, buyer_id: null, doc_type: type, language: lang, created_at: '2026-10-18T09:00:00Z',
    currency: 'USD', incoterm: 'FOB Alexandria', payment_terms: lang === 'ar' ? 'دفعة مقدمة 30% بالتحويل البنكي · 70% مقابل صورة بوليصة الشحن' : '30% T/T deposit · 70% against B/L copy',
    lead_time: lang === 'ar' ? '4–6 أسابيع من الطلب إلى الشحن' : '4–6 weeks, order to vessel',
    signatory_name: 'ZZ Test', signatory_title: lang === 'ar' ? 'المبيعات' : 'Sales',
    notes: lang === 'ar' ? 'مستند اختبار ببيانات وهمية.' : 'TEST DOCUMENT, fake data.',
    line_items: li, subtotal: total, total, voided_at: null,
  }, BUYER[lang], extra || {});
}

const SAMPLES = [
  { name: 'quotation-en', doc: priced('en', 'quotation', 3, { doc_number: 'Q-2026-900001', valid_until: '2026-11-17' }) },
  { name: 'quotation-ar', doc: priced('ar', 'quotation', 3, { doc_number: 'Q-2026-900002', valid_until: '2026-11-17' }) },
  { name: 'quotation-en-1-line', doc: priced('en', 'quotation', 1, { doc_number: 'Q-2026-900003', valid_until: '2026-11-17' }) },
  { name: 'quotation-en-25-lines', doc: priced('en', 'quotation', 25, { doc_number: 'Q-2026-900004', valid_until: '2026-11-17' }) },
  { name: 'quotation-en-void', doc: priced('en', 'quotation', 3, { doc_number: 'Q-2026-900005', valid_until: '2026-11-17', voided_at: '2026-10-19T09:00:00Z' }) },
  { name: 'proforma-en', doc: priced('en', 'proforma', 3, { doc_number: 'PI-2026-900001', valid_until: '2026-11-17', bank_details: 'Beneficiary: ZZ Test\nBank: ZZ Test Bank\nAccount: 0000 0000 0000' }) },
  { name: 'invoice-en', doc: priced('en', 'invoice', 3, { doc_number: 'INV-2026-900001', due_date: '2026-11-18' }) },
  { name: 'invoice-ar', doc: priced('ar', 'invoice', 3, { doc_number: 'INV-2026-900002', due_date: '2026-11-18' }) },
  {
    name: 'packing-en',
    doc: Object.assign({
      id: 1, doc_type: 'packing', language: 'en', doc_number: 'PL-2026-900001', created_at: '2026-10-18T09:00:00Z',
      currency: 'USD', signatory_name: 'ZZ Test', signatory_title: 'Sales', voided_at: null, line_items: [], subtotal: 0, total: 0,
      packing_items: [{ description: 'Green olives, whole, in brine', packing: '10 kg bucket', packages: 400, net_kg: 4000, gross_kg: 4400 }],
      shipment: { container_no: 'ZZZU 000000-0', seal_no: 'ZZ000000', port_loading: 'Alexandria', port_discharge: 'Test Port' },
    }, BUYER.en),
  },
  {
    name: 'letter-en',
    doc: Object.assign({
      id: 1, doc_type: 'letter', language: 'en', doc_number: 'L-2026-900001', created_at: '2026-10-18T09:00:00Z',
      subject: 'Samples for your order (test letter)', salutation: 'Dear ZZ Test,',
      body: 'This is a test letter with fake data.\n\nIt shows the letter layout: subject, salutation, body, closing, signature, enclosures and copies.',
      closing: 'Kind regards,', signatory_name: 'ZZ Test', signatory_title: 'Sales', enclosures: 'Specification sheets (3)', cc: 'ZZ Test',
      voided_at: null, line_items: [], subtotal: 0, total: 0, currency: 'USD',
    }, BUYER.en),
  },
  {
    name: 'letter-ar',
    doc: Object.assign({
      id: 1, doc_type: 'letter', language: 'ar', doc_number: 'L-2026-900002', created_at: '2026-10-18T09:00:00Z',
      subject: 'عينات لطلبكم (خطاب اختبار)', salutation: '',
      body: 'هذا خطاب اختبار ببيانات وهمية، يبيّن شكل الخطاب: الموضوع والنص والختام والتوقيع والمرفقات والنسخ.\n\nالشركة الثلاثية للتنمية الصناعية.',
      closing: 'مع أطيب التحيات،', signatory_name: 'ZZ Test', signatory_title: 'المبيعات', enclosures: 'مواصفات المنتجات (3)', cc: 'ZZ Test',
      voided_at: null, line_items: [], subtotal: 0, total: 0, currency: 'USD',
    }, BUYER.ar),
  },
];

module.exports = { ROOT, OUT_DIR, MANIFEST, INPUTS, SAMPLES };
