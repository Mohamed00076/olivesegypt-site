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
//                 ONLY=export-catalog -- both locales of each; ONLY=spec-sheets
//                 builds every product's spec sheet
//   CHROMIUM_PATH a Chromium binary to use instead of Playwright's own

const fs = require('fs');
const path = require('path');
const { ROOT, MANIFEST, SITE, JOBS, renderFor, letterheadTemplates, BLOCKED_SCRIPTS, prepareForPdf, fingerprint, sha256, countPages } = require('./guide-pdfs');

const PORT = process.env.PORT || 8899;
const ONLY = process.env.ONLY ? process.env.ONLY.split(',').map((s) => s.trim()).filter(Boolean) : null;

(async () => {
  // Loaded here, not at the top, so nothing that only reads this file's
  // neighbours needs Playwright installed.
  const { chromium } = require('playwright');

  const jobs = ONLY ? JOBS.filter((j) => ONLY.includes(j.slug) || (j.group && ONLY.includes(j.group))) : JOBS;
  if (!jobs.length) throw new Error(`ONLY=${process.env.ONLY} matches no PDF. Known: ${[...new Set(JOBS.map((j) => j.slug))].join(', ')}`);

  const manifestPath = path.join(ROOT, MANIFEST);
  const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : {};

  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const page = await browser.newPage();
  // A consent banner in the PDF, or a visit counted in analytics, would both
  // be wrong. Nothing else is fetched from anywhere but the local server.
  await page.route(BLOCKED_SCRIPTS, (route) => route.abort());

  // The letterhead, drawn once per language with the site's fonts and
  // captured as images (see letterheadSheet in guide-pdfs.js for why).
  const letterheads = {};
  async function letterheadFor(locale, html) {
    if (letterheads[locale]) return letterheads[locale];
    const sheet = await browser.newPage({ deviceScaleFactor: 4, viewport: { width: 700, height: 300 } });
    const url = `http://127.0.0.1:${PORT}/__letterhead-${locale}`;
    await sheet.route(url, (route) => route.fulfill({ contentType: 'text/html; charset=utf-8', body: html }));
    await sheet.goto(url, { waitUntil: 'networkidle' });
    await sheet.evaluate(() => document.fonts.ready);
    const masthead = await sheet.locator('#masthead').screenshot({ omitBackground: true });
    const foot = await sheet.locator('#foot').screenshot({ omitBackground: true });
    await sheet.close();
    return (letterheads[locale] = letterheadTemplates(masthead, foot));
  }

  for (const job of jobs) {
    const render = renderFor(job);
    const letterhead = render.letterhead ? await letterheadFor(job.locale, render.letterhead) : null;
    const pdfOptions = letterhead && render.masthead === 'first-page'
      ? Object.assign({}, render.pdf, { headerTemplate: letterhead.headerTemplate, footerTemplate: letterhead.footerTemplate })
      : render.pdf;
    await page.goto(`http://127.0.0.1:${PORT}/${job.source}${job.query || ''}`, { waitUntil: 'networkidle' });
    if (render.css) await page.addStyleTag({ content: render.css });
    // The masthead, once: the first thing in the document, so it heads page 1
    // only (see letterheadTemplates in guide-pdfs.js).
    if (letterhead && render.masthead === 'catalogue-cover') {
      // The same masthead, heading the catalogue's cover in place of its own
      // brand line; the rest of the catalogue keeps its section labels.
      await page.evaluate((src) => {
        const eyebrow = document.querySelector('.pdf-page .pdf-eyebrow');
        const box = document.createElement('div');
        box.className = 'tc-pdf-masthead';
        const img = document.createElement('img');
        img.src = src;
        img.alt = '';
        box.appendChild(img);
        eyebrow.replaceWith(box);
      }, letterhead.masthead);
    } else if (letterhead) {
      await page.evaluate((src) => {
        const box = document.createElement('div');
        box.className = 'tc-pdf-masthead';
        const img = document.createElement('img');
        img.src = src;
        img.alt = '';
        box.appendChild(img);
        document.body.insertBefore(box, document.body.firstChild);
      }, letterhead.masthead);
    }

    await page.evaluate(prepareForPdf, SITE);
    // Every image loaded (or failed) before printing; a broken one fails the build.
    const broken = await page.evaluate(async () => {
      const imgs = [...document.images];
      await Promise.all(imgs.map((img) => (img.complete ? null : new Promise((ok) => { img.onload = img.onerror = ok; }))));
      return imgs.filter((img) => img.naturalWidth === 0 && img.getBoundingClientRect().width > 0).map((img) => img.src);
    });
    if (broken.length) throw new Error(`${job.source}${job.query || ''}: image(s) failed to load: ${broken.join(', ')}. Nothing was written for it.`);
    await page.evaluate(() => document.fonts.ready);

    // The catalogue is laid out as fixed A4 pages. One whose content outgrows
    // its page does not get clipped -- it spills a few lines onto a page of
    // their own, which is how both catalogues came to be 10 pages against a
    // designed 9 (and a Downloads page promising 9). Refuse to write that.
    const designed = job.kind === 'catalog' ? await page.locator('.pdf-page').count() : null;

    const outPath = path.join(ROOT, job.out);
    const pdf = await page.pdf(pdfOptions);
    const pages = countPages(pdf);
    if (designed !== null && pages !== designed) {
      throw new Error(`${job.source} is laid out as ${designed} pages but printed as ${pages}: ` +
        'a page\'s content is taller than A4. Tighten that page and run this again. Nothing was written for it.');
    }
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
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
