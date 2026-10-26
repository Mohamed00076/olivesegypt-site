#!/usr/bin/env node
'use strict';

// Prints the sample CRM documents (scripts/crm-sample-documents.js) through
// the real document page, with the CRM's API answered by the made-up data,
// into docs/crm-samples/, and records what each print was made from.
//
// A manual maintainer tool, not part of `npm test` (which only checks the
// prints): Playwright is not a project dependency. Install it separately,
// then from the repo root, with a local static server serving it:
//
//   python3 -m http.server 8899 &
//   node scripts/print-crm-samples.js
//
// Environment, optional: PORT (default 8899); CHROMIUM_PATH, a Chromium to
// use instead of Playwright's own.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { ROOT, OUT_DIR, MANIFEST, INPUTS, SAMPLES } = require('./crm-sample-documents');

const PORT = process.env.PORT || 8899;
const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

(async () => {
  const { chromium } = require('playwright');
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  fs.mkdirSync(path.join(ROOT, OUT_DIR), { recursive: true });
  const inputs = {};
  for (const f of INPUTS) inputs[f] = sha256(fs.readFileSync(path.join(ROOT, f)));
  const manifest = {};
  for (const s of SAMPLES) {
    const page = await browser.newPage();
    await page.route('**/api/crm/**', (route) => {
      const url = route.request().url();
      if (url.includes('/auth/me')) return route.fulfill({ json: { ok: true, user: { email: 'zz@example.test', role: 'admin' } } });
      if (url.includes('/documents')) return route.fulfill({ json: Object.assign({ ok: true }, s.doc) });
      return route.fulfill({ json: { ok: true } });
    });
    await page.goto(`http://localhost:${PORT}/crm/document/view/?id=1`, { waitUntil: 'networkidle' });
    await page.waitForFunction((n) => document.title.startsWith(n), s.doc.doc_number);
    await page.evaluate(() => document.fonts.ready);
    const out = `${OUT_DIR}/${s.name}.pdf`;
    await page.pdf({ path: path.join(ROOT, out), format: 'A4', printBackground: true, preferCSSPageSize: true, tagged: true });
    manifest[out] = { language: s.doc.language, title: await page.title(), inputs, pdf: sha256(fs.readFileSync(path.join(ROOT, out))) };
    console.log(`Wrote ${out}`);
    await page.close();
  }
  await browser.close();
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`Recorded ${Object.keys(manifest).length} sample(s) in ${path.relative(ROOT, MANIFEST)}`);
})().catch((e) => { console.error(e); process.exit(1); });
