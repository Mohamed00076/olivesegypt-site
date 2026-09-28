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
 * the source references, every font or image those stylesheets load, and how
 * it is printed (the settings below, the blocked scripts and prepareForPdf).
 * Change any of them and the check fails until the PDFs are regenerated.
 *
 * Requires nothing outside Node, so the check can load it in `npm test`.
 */

const crypto = require('crypto');
const { PRODUCTS } = require('./product-order');
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
 * The letterhead. Owner, 2026-09-28: the downloaded files had "no logo no
 * nothing"; treat them as official paper. Every page of every document below
 * (except the export catalogue, which carries its own branded header and
 * footer) gets the masthead and foot of /letterhead and /ar/letterhead --
 * logo, TRIPLE COMPANY / for Industrial Development, the head-office address,
 * email and phone, a green rule -- and a foot with the legal name, the page
 * number and the website. Same words as those pages, so nothing here is new
 * copy.
 *
 * Chromium draws page headers and footers outside the page, where neither the
 * site's fonts nor embedded ones load: the text came out invisible, or in
 * whatever system font the machine had. So the generator draws the masthead
 * and foot below in an ordinary page, with the site's own fonts, captures
 * each as a high-resolution image, and places the images on every page. Only
 * the page number is live text. The result is the same on any machine that
 * rebuilds the PDFs.
 *
 * Widths: A4 is 210mm; the 2cm side margins leave 170mm, drawn at 643px.
 */
const LETTERHEAD_FILES = {
  logo: 'assets/logo-BJ1TOn9V.png',
  fonts: 'assets/fonts/fonts.css',
};
const COLOUR = { primary: '#4c5926', muted: '#78756d', border: '#dddad5' };
const LETTERHEAD_WIDTH_PX = 643;

const LETTERHEAD_TEXT = {
  en: {
    dir: 'ltr', wordmark: 'TRIPLE COMPANY', tagline: 'for Industrial Development',
    address: ['Ouroba Square (ميدان العروبة), 5th Settlement,', 'New Cairo, Cairo, Egypt'],
    legal: 'Triple Company for Industrial Development',
  },
  ar: {
    dir: 'rtl', wordmark: 'الشركة الثلاثية', tagline: 'للتنمية الصناعية',
    address: ['ميدان العروبة، التجمع الخامس،', 'القاهرة الجديدة، القاهرة، مصر'],
    legal: 'الشركة الثلاثية للتنمية الصناعية',
  },
};
const CONTACT_LINE = 'sales@olivesegypt.com &middot; +20 100 604 5961';

/**
 * The letterhead as an ordinary page, to be drawn with the site's fonts and
 * captured: #masthead and #foot are the two images. The foot leaves its
 * middle empty for the live page number.
 */
function letterheadSheet(locale) {
  const t = LETTERHEAD_TEXT[locale];
  const rtl = t.dir === 'rtl';
  const arabic = "'Noto Naskh Arabic'";
  // Plus Jakarta Sans has no Arabic, so Arabic text falls through to Naskh
  // while email, phone and web address keep the same face in both languages.
  const sans = `'Plus Jakarta Sans', ${arabic}, sans-serif`;
  const wordmark = rtl
    ? `<div style="font-family:${arabic},serif;font-weight:700;font-size:19px;line-height:1.25;color:${COLOUR.primary};">${t.wordmark}</div>
       <div style="font-family:${arabic},sans-serif;font-size:10.5px;color:${COLOUR.muted};">${t.tagline}</div>`
    : `<div style="font-family:'Playfair Display',Georgia,serif;font-weight:700;font-size:18px;line-height:1.1;color:${COLOUR.primary};letter-spacing:0.02em;">${t.wordmark}</div>
       <div style="font-size:7.5px;text-transform:uppercase;letter-spacing:0.18em;color:${COLOUR.muted};margin-top:3px;">${t.tagline}</div>`;
  return `<!DOCTYPE html><html lang="${locale}" dir="${t.dir}"><head><meta charset="UTF-8">
<link rel="stylesheet" href="/${LETTERHEAD_FILES.fonts}">
<style>
  html, body { margin: 0; padding: 0; background: transparent; }
  .bar { width: ${LETTERHEAD_WIDTH_PX}px; box-sizing: border-box; font-family: ${sans}; }
</style></head><body>
<div id="masthead" class="bar" style="display:flex;justify-content:space-between;align-items:center;gap:18px;padding:4px 0 8px;border-bottom:2px solid ${COLOUR.primary};">
  <div style="display:flex;align-items:center;gap:11px;">
    <img src="/${LETTERHEAD_FILES.logo}" style="width:38px;height:46px;object-fit:contain;" />
    <div>${wordmark}</div>
  </div>
  <div style="text-align:${rtl ? 'left' : 'right'};font-size:9px;line-height:1.65;color:${COLOUR.muted};">
    ${t.address.join('<br/>')}<br/><span dir="ltr">${CONTACT_LINE}</span>
  </div>
</div>
<div id="foot" class="bar" style="display:flex;justify-content:space-between;align-items:center;padding:7px 0 2px;border-top:1px solid ${COLOUR.border};font-size:8.5px;letter-spacing:0.03em;color:${COLOUR.muted};">
  <span>${t.legal}</span><span dir="ltr">olivesegypt.com</span>
</div>
</body></html>`;
}

/** The page templates, around the two captured images (PNG buffers). */
function letterheadTemplates(masthead, foot) {
  const img = (buf) => `data:image/png;base64,${Buffer.from(buf).toString('base64')}`;
  const box = 'width:100%;box-sizing:border-box;padding:0 2cm;-webkit-print-color-adjust:exact;print-color-adjust:exact;';
  return {
    headerTemplate: `<div style="${box}margin-top:0.75cm;"><img src="${img(masthead)}" style="width:100%;display:block;" /></div>`,
    footerTemplate: `<div style="${box}margin-bottom:0.65cm;position:relative;">` +
      `<img src="${img(foot)}" style="width:100%;display:block;" />` +
      `<div dir="ltr" style="position:absolute;left:0;right:0;bottom:1px;text-align:center;font-family:sans-serif;font-size:7px;color:${COLOUR.muted};">` +
      '<span class="pageNumber"></span> / <span class="totalPages"></span></div></div>',
  };
}

// Room for the letterhead: a taller top margin for the masthead, a bottom one
// for the foot. Applied after each page's own @page rule, so it wins.
const LETTERHEAD_PAGE = `@page { margin: 3.2cm 2cm 2.3cm 2cm; }`;

/*
 * Print adjustments for the guides. Their own print rules keep each section
 * whole, which in a PDF leaves a first page holding only the title whenever
 * the first section is longer than what is left of it. So sections may break
 * between questions, and each question, list item and table row stays
 * together instead. The site header stays hidden: the letterhead replaces it.
 */
const GUIDE_PDF_CSS = `
  ${LETTERHEAD_PAGE}
  main { padding-top: 0 !important; padding-bottom: 0 !important; }
  .spec-card { break-inside: auto !important; page-break-inside: auto !important; }
  h1, h2, h3 { break-after: avoid; page-break-after: avoid; }
  .qa-item, li, tr, figure { break-inside: avoid; page-break-inside: avoid; }
`;

/*
 * The public documents printed from site pages: the company profile and the
 * full product catalogue (/catalog/print). Their print rules already hide the
 * site header, footer and buttons. The profile's own "Page N" footer is a
 * fixed element Chromium numbers as page 1 throughout, so it gives way to the
 * letterhead's; and the address a page prints after each link, for paper,
 * goes, since the PDF's links are clickable.
 */
const PAGE_PDF_CSS = `
  ${LETTERHEAD_PAGE}
  main { padding-top: 0 !important; padding-bottom: 0 !important; }
  .print-footer { display: none !important; }
  a[href]:after { content: none !important; }
`;

const LETTERHEAD_PDF = { format: 'A4', printBackground: true, preferCSSPageSize: true, displayHeaderFooter: true };

/**
 * How a job is printed: page settings, the CSS added before printing, and the
 * letterhead sheet (null for the export catalogue). The generator captures the
 * sheet and adds the templates; the sheet's HTML is part of the fingerprint.
 */
function renderFor(job) {
  if (job.kind === 'catalog') {
    // Unchanged from the catalogue's original generator: the source carries
    // its own branded layout, edge to edge.
    return { pdf: { format: 'A4', printBackground: true, margin: { top: 0, bottom: 0, left: 0, right: 0 } }, css: '', letterhead: null };
  }
  return {
    pdf: LETTERHEAD_PDF,
    css: job.kind === 'guide' ? GUIDE_PDF_CSS : PAGE_PDF_CSS,
    letterhead: letterheadSheet(job.locale),
  };
}

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
  // Public, not gated: the Downloads page offers it to everyone, so it is
  // published beside that page rather than kept in the functions bundle.
  {
    locale, slug: 'company-profile', kind: 'profile', public: true,
    source: locale === 'en' ? 'company-profile/index.html' : 'ar/company-profile/index.html',
    out: locale === 'en' ? 'downloads/company-profile-en.pdf' : 'ar/downloads/company-profile-ar.pdf',
  },
  // The full product catalogue: every product's specification, as the
  // printable /catalog/print page shows it. Public, like the profile.
  {
    locale, slug: 'product-catalog', kind: 'print', public: true,
    source: locale === 'en' ? 'catalog/print/index.html' : 'ar/catalog/print/index.html',
    out: locale === 'en' ? 'downloads/product-catalog-en.pdf' : 'ar/downloads/product-catalog-ar.pdf',
  },
  // One specification sheet per product: the same page's single-product view
  // (?product=<key>). Public. ONLY=spec-sheets builds all twenty.
  ...PRODUCTS.map(({ key, dir }) => ({
    locale, slug: `spec-${dir}`, group: 'spec-sheets', kind: 'print', public: true,
    source: locale === 'en' ? 'catalog/print/index.html' : 'ar/catalog/print/index.html',
    query: `?product=${key}`,
    out: `${locale === 'en' ? '' : 'ar/'}downloads/spec-sheets/${dir}-${locale}.pdf`,
  })),
  // All ten sheets in one file, one product per page (?product=all).
  {
    locale, slug: 'spec-sheets-all', group: 'spec-sheets', kind: 'print', public: true,
    source: locale === 'en' ? 'catalog/print/index.html' : 'ar/catalog/print/index.html',
    query: '?product=all',
    out: `${locale === 'en' ? '' : 'ar/'}downloads/spec-sheets/all-spec-sheets-${locale}.pdf`,
  },
]);

/** Where a product's spec sheet PDF is published, as a site path. */
const specSheetHref = (dir, locale) => `/${locale === 'en' ? '' : 'ar/'}downloads/spec-sheets/${dir}-${locale}.pdf`;

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

// Chromium writes each page as an uncompressed '/Type /Page' dictionary, so
// pages can be counted without a PDF library. '/Type /Pages' is the page tree,
// not a page, and is excluded.
const countPages = (buf) => (Buffer.from(buf).toString('latin1').match(/\/Type\s*\/Page(?![A-Za-z])/g) || []).length;

/*
 * Run in the page just before printing: points every relative link at the live
 * site, since a PDF has no site to be relative to and printing from the local
 * server would otherwise bake in http://127.0.0.1. Lives here rather than in
 * the generator so that changing it changes every PDF's fingerprint.
 */
function prepareForPdf(site) {
  // Images below the fold wait to be scrolled to (loading="lazy"), and a
  // page printed before they arrive has empty frames where the photos go --
  // two pages of the combined spec sheets did. Load them all now; the
  // generator then waits for every one before printing.
  for (const img of document.querySelectorAll('img[loading="lazy"]')) img.loading = 'eager';
  for (const a of document.querySelectorAll('a[href]')) {
    const href = a.getAttribute('href');
    if (href.startsWith('/') && !href.startsWith('//')) a.setAttribute('href', site + href);
  }
}

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

/*
 * The local files a stylesheet pulls in through url() -- the woff2 files in
 * assets/fonts/fonts.css above all, since a changed font reflows every page.
 * Relative urls resolve against the stylesheet; data: and remote urls are
 * not files in this repository and are skipped.
 */
function cssAssetsOf(css, cssPath) {
  const out = new Set();
  for (const m of css.matchAll(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g)) {
    const ref = m[2].trim().split(/[?#]/)[0];
    if (!ref || /^(data:|[a-z]+:|\/\/)/i.test(ref)) continue;
    out.add(ref.startsWith('/') ? ref.slice(1) : path.posix.join(path.posix.dirname(cssPath), ref));
  }
  return [...out].sort();
}

// Everything that decides how a job prints, beyond its files: the print
// settings and CSS, the script block list, the site links are pointed at, and
// the page preparation itself.
// Includes the letterhead sheet's HTML. The logo and fonts it draws with are
// fingerprinted as files (see fingerprint below).
const renderKey = (job) => sha256(JSON.stringify({
  settings: renderFor(job), blocked: BLOCKED_SCRIPTS.source, site: SITE, prepare: prepareForPdf.toString(),
}));

/** What a job's PDF depends on, each with its hash. A missing file hashes as 'missing'. */
function fingerprint(job, root = ROOT) {
  const read = (rel) => {
    try { return fs.readFileSync(path.join(root, rel)); } catch (e) { return null; }
  };
  const html = read(job.source);
  const direct = html ? assetsOf(html.toString('utf8')) : [];
  const viaCss = direct.filter((f) => f.endsWith('.css')).flatMap((f) => {
    const css = read(f);
    return css ? cssAssetsOf(css.toString('utf8'), f) : [];
  });
  // The letterhead is drawn with the logo and the site's fonts.
  const letterhead = renderFor(job).letterhead ? [LETTERHEAD_FILES.logo, LETTERHEAD_FILES.fonts,
    ...cssAssetsOf((read(LETTERHEAD_FILES.fonts) || '').toString('utf8'), LETTERHEAD_FILES.fonts)] : [];
  const files = [...new Set([job.source, ...direct, ...viaCss, ...letterhead])];
  const inputs = {};
  for (const f of files) {
    const buf = read(f);
    inputs[f] = buf ? sha256(buf) : 'missing';
  }
  return { inputs, render: renderKey(job) };
}

module.exports = {
  ROOT, MANIFEST, SITE, GUIDE_SLUGS, JOBS, specSheetHref, renderFor, letterheadTemplates, LETTERHEAD_FILES, BLOCKED_SCRIPTS,
  prepareForPdf, assetsOf, cssAssetsOf, fingerprint, sha256, countPages,
};
