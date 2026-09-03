#!/usr/bin/env node
'use strict';

// Regenerates downloads/triple-company-export-catalog-2026.pdf from
// scripts/export-catalog-source.html by printing it with headless
// Chromium (same producer as the original file -- Skia/PDF via
// HeadlessChrome -- so this is a like-for-like rebuild, not a
// different tool guessing at the old layout).
//
// Not wired into netlify.toml or `npm install` -- this is a manual
// maintainer tool, run only when the source file or its images change.
// Playwright is deliberately NOT a project dependency (it would pull a
// full Chromium download into every `npm install`, including
// Netlify's build); install it separately wherever you run this:
//
//   npm install --no-save playwright && npx playwright install --with-deps chromium
//
// Then, from the repo root, with a local static server serving it (so
// the source file's absolute /assets/* paths resolve):
//
//   python3 -m http.server 8899 &
//   node scripts/generate-export-catalog-pdf.js
//
// Reads PORT from the environment (default 8899).

const path = require('path');
const { chromium } = require('playwright');

const PORT = process.env.PORT || 8899;
const SOURCE_URL = `http://127.0.0.1:${PORT}/scripts/export-catalog-source.html`;
const OUT_PATH = path.join(__dirname, '..', 'downloads', 'triple-company-export-catalog-2026.pdf');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(SOURCE_URL, { waitUntil: 'networkidle' });

  await page.pdf({
    path: OUT_PATH,
    format: 'A4',
    printBackground: true,
    margin: { top: 0, bottom: 0, left: 0, right: 0 },
  });

  await browser.close();
  console.log('Wrote', OUT_PATH);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
