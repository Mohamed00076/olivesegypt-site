#!/usr/bin/env node
'use strict';

// Builds every gated PDF: the seven guides and the export catalogue, in both
// locales -- sixteen files under netlify/functions/_guides/. The list, and
// what each is built from, is scripts/guide-pdfs.js.
//
// Prints each source with headless Chromium, the same producer as the
// original catalogue (Skia/PDF via HeadlessChrome), then records every PDF's
// fingerprint in scripts/guide-pdfs.json. scripts/check-guide-pdfs.js fails
// `npm test` when a source has changed since, so a stale PDF cannot ship
// unnoticed again.
//
// Kept under its original name, which the catalogue made it known by, and
// which check-script-integrity.js keys its Playwright exception to.
//
// Not wired into netlify.toml or `npm install` -- a manual maintainer tool,
// run whenever a guide or catalogue source, or anything it references,
// changes. Playwright is deliberately NOT a project dependency (it would pull
// a full Chromium download into every `npm install`, including Netlify's
// build); install it separately wherever you run this:
//
//   npm install --no-save playwright && npx playwright install --with-deps chromium
//
// Then, from the repo root, with a local static server serving it (so each
// source's absolute /assets/* paths resolve):
//
//   python3 -m http.server 8899 &
//   node scripts/generate-export-catalog-pdf.js
//
// Environment, all optional:
//   PORT          the local server's port (default 8899)
//   ONLY          comma-separated slugs to build, e.g. ONLY=buyers-guide or
//                 ONLY=export-catalog -- both locales of each
//   CHROMIUM_PATH a Chromium binary to use instead of Playwright's own

const fs = require('fs');
const path = require('path');
const { ROOT, MANIFEST, SITE, JOBS, RENDER, BLOCKED_SCRIPTS, fingerprint, sha256, countPages } = require('./guide-pdfs');

const PORT = process.env.PORT || 8899;
const ONLY = process.env.ONLY ? process.env.ONLY.split(',').map((s) => s.trim()).filter(Boolean) : null;

(async () => {
  // Loaded here, not at the top, so nothing that only reads this file's
  // neighbours needs Playwright installed.
  const { chromium } = require('playwright');

  const jobs = ONLY ? JOBS.filter((j) => ONLY.includes(j.slug)) : JOBS;
  if (!jobs.length) throw new Error(`ONLY=${process.env.ONLY} matches no PDF. Known: ${[...new Set(JOBS.map((j) => j.slug))].join(', ')}`);

  const manifestPath = path.join(ROOT, MANIFEST);
  const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : {};

  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const page = await browser.newPage();
  // A consent banner in the PDF, or a visit counted in analytics, would both
  // be wrong. Nothing else is fetched from anywhere but the local server.
  await page.route(BLOCKED_SCRIPTS, (route) => route.abort());

  for (const job of jobs) {
    const render = RENDER[job.kind];
    await page.goto(`http://127.0.0.1:${PORT}/${job.source}`, { waitUntil: 'networkidle' });
    if (render.css) await page.addStyleTag({ content: render.css });

    // A relative link in a PDF has no site to be relative to, and printing
    // from the local server would bake in http://127.0.0.1. Point every link
    // at the live site instead.
    await page.evaluate((site) => {
      for (const a of document.querySelectorAll('a[href]')) {
        const href = a.getAttribute('href');
        if (href.startsWith('/') && !href.startsWith('//')) a.setAttribute('href', site + href);
      }
    }, SITE);
    await page.evaluate(() => document.fonts.ready);

    // The catalogue is laid out as fixed A4 pages. One whose content outgrows
    // its page does not get clipped -- it spills a few lines onto a page of
    // their own, which is how both catalogues came to be 10 pages against a
    // designed 9 (and a Downloads page promising 9). Refuse to write that.
    const designed = job.kind === 'catalog' ? await page.locator('.pdf-page').count() : null;

    const outPath = path.join(ROOT, job.out);
    const pdf = await page.pdf(render.pdf);
    const pages = countPages(pdf);
    if (designed !== null && pages !== designed) {
      throw new Error(`${job.source} is laid out as ${designed} pages but printed as ${pages}: ` +
        'a page\'s content is taller than A4. Tighten that page and run this again. Nothing was written for it.');
    }
    fs.writeFileSync(outPath, pdf);

    manifest[job.out] = Object.assign({ source: job.source }, fingerprint(job), { pdf: sha256(pdf) });
    console.log(`Wrote ${job.out} (${pages} page${pages === 1 ? '' : 's'})`);
  }

  await browser.close();

  const sorted = Object.fromEntries(Object.keys(manifest).sort().map((k) => [k, manifest[k]]));
  fs.writeFileSync(manifestPath, JSON.stringify(sorted, null, 2) + '\n');
  console.log(`Recorded ${jobs.length} fingerprint(s) in ${MANIFEST}`);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
