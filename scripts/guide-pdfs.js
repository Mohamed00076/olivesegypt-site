'use strict';

/*
 * The gated PDFs: what each one is built from, and how.
 *
 * Shared by scripts/generate-export-catalog-pdf.js, which builds them, and
 * scripts/check-guide-pdfs.js, which fails `npm test` when a PDF no longer
 * matches its source. The audit of 2026-09-28 (B6) found both catalogue PDFs
 * stale for ten days: the sources had been corrected and nobody regenerated
 * the files. Every guide is now a PDF too (owner, 2026-09-28), so there are
 * sixteen files that can drift the same way, and a fingerprint is cheaper than
 * remembering.
 *
 * A PDF's fingerprint covers its source HTML, every local stylesheet and image
 * the source references, and the render settings below. Change any of them and
 * the check fails until the PDFs are regenerated.
 *
 * Requires nothing outside Node, so the check can load it in `npm test`.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const MANIFEST = 'scripts/guide-pdfs.json';
const SITE = 'https://olivesegypt.com';

// The seven guides. Their HTML stays where it was, in the functions bundle
// beside the PDF; it is the source now, and guide.js serves only the PDF.
const GUIDE_SLUGS = [
  'buyers-guide',
  'origin-comparison-guide',
  'pricing-packaging-guide',
  'company-overview',
  'private-label-brochure',
  'packaging-overview',
  'export-documentation-checklist',
];

/*
 * Print adjustments for the guides, applied only when rendering the PDF.
 *
 * The guides' own print rules were written for a visitor pressing "Print":
 * they hide the site header and keep each section whole. In a PDF that means
 * no logo, and a first page holding only the title whenever the first section
 * is longer than what is left of the page. So: keep the header's logo and name
 * (not its print button), let sections break between questions, and keep each
 * question, list item and table row together instead.
 */
const GUIDE_PDF_CSS = `
  header.no-print { display: block !important; border-bottom: 1px solid hsl(var(--border)); margin-bottom: 1rem; }
  header.no-print > div { height: auto !important; padding: 0 0 0.75rem 0 !important; max-width: none !important; }
  header.no-print button { display: none !important; }
  main { padding-top: 0 !important; padding-bottom: 0 !important; }
  .spec-card { break-inside: auto !important; page-break-inside: auto !important; }
  h1, h2, h3 { break-after: avoid; page-break-after: avoid; }
  .qa-item, li, tr, figure { break-inside: avoid; page-break-inside: avoid; }
`;

// Page numbers only: no words, so nothing here needs translating.
const GUIDE_FOOTER = '<div style="width:100%;font-size:8px;color:#6b7280;text-align:center;font-family:sans-serif;">' +
  '<span class="pageNumber"></span> / <span class="totalPages"></span></div>';

const RENDER = {
  // Unchanged from the catalogue's original generator: the source carries its
  // own page layout, edge to edge.
  catalog: {
    pdf: { format: 'A4', printBackground: true, margin: { top: 0, bottom: 0, left: 0, right: 0 } },
    css: '',
  },
  // The guides' @page rule sets a 2cm margin; the footer sits inside it.
  guide: {
    pdf: {
      format: 'A4', printBackground: true, preferCSSPageSize: true,
      displayHeaderFooter: true, headerTemplate: '<div></div>', footerTemplate: GUIDE_FOOTER,
    },
    css: GUIDE_PDF_CSS,
  },
};

// Scripts that would show a consent banner or count a visit if they ran while
// rendering. The generator refuses them.
const BLOCKED_SCRIPTS = /\/assets\/(consent|analytics|locale-switch)\.js(\?|$)/;

const JOBS = ['en', 'ar'].flatMap((locale) => [
  ...GUIDE_SLUGS.map((slug) => ({
    locale, slug, kind: 'guide',
    source: `netlify/functions/_guides/${locale}/${slug}.html`,
    out: `netlify/functions/_guides/${locale}/${slug}.pdf`,
  })),
  {
    locale, slug: 'export-catalog', kind: 'catalog',
    source: locale === 'en' ? 'scripts/export-catalog-source.html' : 'scripts/export-catalog-source-ar.html',
    out: `netlify/functions/_guides/${locale}/export-catalog.pdf`,
  },
]);

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

// Chromium writes each page as an uncompressed '/Type /Page' dictionary, so
// pages can be counted without a PDF library. '/Type /Pages' is the page tree,
// not a page, and is excluded.
const countPages = (buf) => (Buffer.from(buf).toString('latin1').match(/\/Type\s*\/Page(?![A-Za-z])/g) || []).length;

/** The local stylesheets and images a source pulls in, as repo-relative paths. */
function assetsOf(html) {
  const out = new Set();
  const re = /<(link|img)\b[^>]*?\b(href|src)="(\/[^"?#]+)[^"]*"[^>]*>/gi;
  let m;
  while ((m = re.exec(html))) {
    const tag = m[0];
    if (m[1].toLowerCase() === 'link' && !/rel="stylesheet"/i.test(tag)) continue;
    out.add(m[3].slice(1));
  }
  return [...out].sort();
}

/** What a job's PDF depends on, each with its hash. A missing file hashes as 'missing'. */
function fingerprint(job, root = ROOT) {
  const read = (rel) => {
    try { return fs.readFileSync(path.join(root, rel)); } catch (e) { return null; }
  };
  const html = read(job.source);
  const files = [job.source, ...(html ? assetsOf(html.toString('utf8')) : [])];
  const inputs = {};
  for (const f of files) {
    const buf = read(f);
    inputs[f] = buf ? sha256(buf) : 'missing';
  }
  return { inputs, render: sha256(JSON.stringify(RENDER[job.kind])) };
}

module.exports = {
  ROOT, MANIFEST, SITE, GUIDE_SLUGS, JOBS, RENDER, BLOCKED_SCRIPTS,
  assetsOf, fingerprint, sha256, countPages,
};
