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
 * whatever system font the machine had. So the generator draws the foot
 * below in an ordinary page, with the site's own fonts, captures it as a
 * high-resolution image, and places the image on every page; the page number
 * is live text over it. The masthead is printed inside page 1, where the
 * fonts do load, so it is live text throughout (mastheadHtml). The result is
 * the same on any machine that rebuilds the PDFs.
 *
 * Widths: A4 is 210mm; the 2cm side margins leave 170mm, drawn at 643px.
 */
const LETTERHEAD_FILES = {
  logo: 'assets/logo-BJ1TOn9V.png',
  fonts: 'assets/fonts/fonts.css',
};
const COLOUR = { primary: '#4c5926', muted: '#78756d', border: '#dddad5' };
const LETTERHEAD_WIDTH_PX = 643;

/*
 * Arabic in the Arabic PDFs. The site's own font stacks have no Arabic face
 * except the masthead's Noto Naskh Arabic, so most Arabic text was printed in
 * whatever system font the build machine had (DejaVu Sans here), and the
 * Naskh that was used is a variable font, which Chromium can only embed as a
 * Type3 font with each letter's dots as separate, offset pieces. Copying text
 * out of those PDFs gave reversed, broken fragments. Owner, 2026-10-03: "fix
 * this".
 *
 * Amiri (static Regular and Bold, unmodified, SIL OFL; scripts/pdf-fonts,
 * which the deploy prunes, so the site itself is unchanged) was chosen by
 * measurement: of seven Arabic families printed through this same Chromium,
 * it was the only one whose words came back whole and in reading order.
 * It is mapped onto every family the Arabic sources name, for Arabic
 * characters only, so Latin text, numbers and the layout keep their fonts.
 */
const PDF_ARABIC_FONTS = { regular: 'scripts/pdf-fonts/Amiri-Regular.ttf', bold: 'scripts/pdf-fonts/Amiri-Bold.ttf' };
// The word space is in the range too: left in the Latin face, it split every
// Arabic line into one-word runs, which PDF readers then put back together
// left to right, reversing the word order.
const ARABIC_LETTERS = 'U+0600-06FF, U+0750-077F, U+0870-08FF, U+200C-200F, U+FB50-FDFF, U+FE70-FEFE';
const ARABIC_RANGE = `U+0020, U+00A0, ${ARABIC_LETTERS}`;
// Amiri draws small for its size beside the Latin faces and the system font
// it replaces; this brings its letters back to about the same visual size.
const ARABIC_SIZE_ADJUST = '115%';
// CSS composes a family from faces by unicode-range only among faces whose
// style and weight descriptors are identical, so each Arabic face copies an
// existing face's descriptors exactly: one per face the site's stylesheets
// declare (Great Vibes, a script face never set on Arabic text, aside).
// Weights up to 500 take Amiri Regular, 600 and above Amiri Bold.
const ARABIC_PDF_SOURCES = ['assets/fonts/fonts.css', 'assets/index-Dw0yUE42.css'];
function arabicPdfCss(range) {
  const faces = new Map();
  for (const file of ARABIC_PDF_SOURCES) {
    const css = fs.readFileSync(path.join(ROOT, file), 'utf8');
    for (const [, body] of css.matchAll(/@font-face\s*\{([^}]*)\}/g)) {
      const get = (prop, fallback) => ((body.match(new RegExp(`${prop}\\s*:\\s*([^;]+)`)) || [])[1] || fallback).trim();
      const family = get('font-family', '').replace(/^['"]|['"]$/g, '');
      if (!family || family === 'Great Vibes') continue;
      const style = get('font-style', 'normal');
      const weight = get('font-weight', '400');
      faces.set(`${family}|${style}|${weight}`, { family, style, weight });
    }
  }
  return [...faces.values()].map(({ family, style, weight }) => {
    const file = parseInt(weight, 10) >= 600 ? PDF_ARABIC_FONTS.bold : PDF_ARABIC_FONTS.regular;
    return `@font-face { font-family: '${family}'; src: url(/${file}) format('truetype'); font-style: ${style}; ` +
      `font-weight: ${weight}; size-adjust: ${ARABIC_SIZE_ADJUST}; unicode-range: ${range}; }`;
  }).join('\n');
}
const ARABIC_PDF_CSS = arabicPdfCss(ARABIC_RANGE);
// The English PDFs carry Arabic only in the masthead's address, "(ميدان
// العروبة)": the same faces, without the word space, so English spacing is
// untouched.
const ARABIC_IN_ENGLISH_PDF_CSS = arabicPdfCss(ARABIC_LETTERS);

/*
 * The site's variable web fonts as static instances, for every PDF. Chromium
 * embeds a variable font only as Type3, which some viewers draw less sharply
 * and tools handle worse than TrueType; the same faces at the same weights,
 * pinned (scripts/make-pdf-static-fonts.py), embed as TrueType. Each face in
 * fonts.css that has an instance is declared again with identical
 * descriptors and only its file swapped, so the PDFs look the same.
 */
const STATIC_PDF_FONTS = [];
const STATIC_PDF_CSS = (() => {
  const css = fs.readFileSync(path.join(ROOT, LETTERHEAD_FILES.fonts), 'utf8');
  const out = [];
  for (const [face, body] of css.matchAll(/@font-face\s*\{([^}]*)\}/g)) {
    const src = (body.match(/url\(\/([^)]+)\)/) || [])[1];
    const weight = ((body.match(/font-weight\s*:\s*([^;]+)/) || [])[1] || '').trim();
    if (!src || !/^\d+$/.test(weight)) continue;
    const stem = path.basename(src).replace(/\.[^.]+$/, '');
    const file = `scripts/pdf-fonts/static/${stem}-${weight}.woff2`;
    if (!fs.existsSync(path.join(ROOT, file))) continue;
    STATIC_PDF_FONTS.push(file);
    out.push(face.replace(/url\([^)]+\)\s*format\([^)]*\)/, `url(/${file}) format('woff2')`));
  }
  return out.join('\n');
})();

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

/*
 * The masthead -- logo, wordmark, tagline, head-office address and contact
 * line, over a green rule -- as live HTML. Unlike the foot it sits inside the
 * page (see letterheadTemplates), where the site's fonts load, so the
 * generator places it as real text: selectable, searchable and read by
 * screen readers, where it used to be a picture of the same words (owner,
 * 2026-10-03: each sheet "opens with real, selectable text").
 */
function mastheadHtml(locale) {
  const t = LETTERHEAD_TEXT[locale];
  const rtl = t.dir === 'rtl';
  const arabic = "'Noto Naskh Arabic'";
  // Plus Jakarta Sans has no Arabic, so Arabic text falls through to Naskh
  // while email, phone and web address keep the same face in both languages.
  const sans = `'Plus Jakarta Sans', ${arabic}, sans-serif`;
  const wordmark = rtl
    ? `<div style="font-family:${arabic},serif;font-weight:700;font-size:19px;line-height:1.25;color:${COLOUR.primary};">${t.wordmark}</div>
       <div style="font-family:${arabic},sans-serif;font-size:10.5px;line-height:1.5;color:${COLOUR.muted};">${t.tagline}</div>`
    : `<div style="font-family:'Playfair Display',Georgia,serif;font-weight:700;font-size:18px;line-height:1.1;color:${COLOUR.primary};letter-spacing:0.02em;">${t.wordmark}</div>
       <div style="font-size:7.5px;line-height:1.5;text-transform:uppercase;letter-spacing:0.18em;color:${COLOUR.muted};margin-top:3px;">${t.tagline}</div>`;
  return `<div dir="${t.dir}" lang="${locale}" style="display:flex;justify-content:space-between;align-items:center;gap:18px;padding:4px 0 8px;border-bottom:2px solid ${COLOUR.primary};font-family:${sans};text-align:start;">
  <div style="display:flex;align-items:center;gap:11px;">
    <img src="/${LETTERHEAD_FILES.logo}" alt="" style="width:38px;height:46px;max-width:none;object-fit:contain;" />
    <div>${wordmark}</div>
  </div>
  <div style="text-align:${rtl ? 'left' : 'right'};font-size:9px;line-height:1.65;color:${COLOUR.muted};">
    ${t.address.join('<br/>')}<br/><span dir="ltr">${CONTACT_LINE}</span>
  </div>
</div>`;
}

/**
 * The foot as an ordinary page, to be drawn with the site's fonts and
 * captured as an image: it is printed by a page footer template, outside the
 * page, where those fonts do not load. It leaves its middle empty for the
 * live page number.
 */
function letterheadSheet(locale) {
  const t = LETTERHEAD_TEXT[locale];
  const sans = "'Plus Jakarta Sans', 'Noto Naskh Arabic', sans-serif";
  return `<!DOCTYPE html><html lang="${locale}" dir="${t.dir}"><head><meta charset="UTF-8">
<link rel="stylesheet" href="/${LETTERHEAD_FILES.fonts}">
<style>
  html, body { margin: 0; padding: 0; background: transparent; }
  .bar { width: ${LETTERHEAD_WIDTH_PX}px; box-sizing: border-box; font-family: ${sans}; }
${locale === 'ar' ? ARABIC_PDF_CSS : ''}
</style></head><body>
<div id="foot" class="bar" style="display:flex;justify-content:space-between;align-items:center;padding:7px 0 2px;border-top:1px solid ${COLOUR.border};font-size:8.5px;letter-spacing:0.03em;color:${COLOUR.muted};">
  <span>${t.legal}</span><span dir="ltr">olivesegypt.com</span>
</div>
</body></html>`;
}

/**
 * The page templates, around the captured foot (a PNG buffer).
 *
 * The masthead -- logo, name, address and contact line -- is printed once, at
 * the top of page 1 (owner, 2026-10-02: "just make it once at the top of page
 * 1 i want it to look proffessional"). A page header template repeats on
 * every page and cannot tell page 1 from the rest, so the masthead is not a
 * header template: the generator places it in the document itself, before
 * the first line (mastheadHtml above), and the header template is empty. The
 * slim foot -- company name, website, page number -- stays on every page.
 */
function letterheadTemplates(foot) {
  const img = (buf) => `data:image/png;base64,${Buffer.from(buf).toString('base64')}`;
  const box = 'width:100%;box-sizing:border-box;padding:0 2cm;-webkit-print-color-adjust:exact;print-color-adjust:exact;';
  return {
    headerTemplate: '<span></span>',
    footerTemplate: `<div style="${box}margin-bottom:0.65cm;position:relative;">` +
      `<img src="${img(foot)}" style="width:100%;display:block;" />` +
      `<div dir="ltr" style="position:absolute;left:0;right:0;bottom:1px;text-align:center;font-family:sans-serif;font-size:7px;color:${COLOUR.muted};">` +
      '<span class="pageNumber"></span> / <span class="totalPages"></span></div></div>',
  };
}

// Margins: a bottom one for the foot on every page. Page 1 starts near the top
// edge, where the masthead sits in the flow (0.75cm, where the header used to
// be drawn); later pages, with no masthead, start at 1.6cm. Applied after each
// page's own @page rule, so it wins.
const LETTERHEAD_PAGE = `@page { margin: 1.6cm 2cm 2.3cm 2cm; } @page :first { margin-top: 0.75cm; }
  .tc-pdf-masthead { margin: 0 0 0.9cm 0; break-inside: avoid; page-break-inside: avoid; }`;

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
  /* One line under every PDF title: "Revised <date>" (owner, 2026-10-02).
     The product catalogue's second line stays on the web page only. */
  #doc-meta { display: none !important; }
  /* The same title and date line as the guides: the company profile's web
     page sets a larger title with space above it. */
  main h1 { font-size: 1.875rem !important; line-height: 2.25rem !important; margin-top: 0 !important; margin-bottom: 0.25rem !important; }
  main h1 + p { font-size: 1rem !important; line-height: 1.5rem !important; }
`;

const LETTERHEAD_PDF = { format: 'A4', printBackground: true, preferCSSPageSize: true, displayHeaderFooter: true };

/**
 * How a job is printed: page settings, the CSS added before printing, and the
 * letterhead sheet (null for the export catalogue). The generator captures the
 * sheet and adds the templates; the sheet's HTML is part of the fingerprint.
 */
function renderFor(job) {
  if (job.kind === 'catalog') {
    // The catalogue lays out its own A4 pages, edge to edge, with its own
    // footers (styled like the letterhead's foot). Its cover carries the same
    // masthead as every other PDF (owner, 2026-10-02: one consistent header),
    // placed by the generator in place of the cover's own brand line.
    return { pdf: { format: 'A4', printBackground: true, margin: { top: 0, bottom: 0, left: 0, right: 0 } },
      css: STATIC_PDF_CSS + (job.locale === 'ar' ? ARABIC_PDF_CSS : ARABIC_IN_ENGLISH_PDF_CSS),
      letterhead: letterheadSheet(job.locale), mastheadHtml: mastheadHtml(job.locale), masthead: 'catalogue-cover' };
  }
  return {
    pdf: LETTERHEAD_PDF,
    css: (job.kind === 'guide' ? GUIDE_PDF_CSS : PAGE_PDF_CSS) + STATIC_PDF_CSS + (job.locale === 'ar' ? ARABIC_PDF_CSS : ARABIC_IN_ENGLISH_PDF_CSS),
    letterhead: letterheadSheet(job.locale),
    mastheadHtml: mastheadHtml(job.locale),
    masthead: 'first-page',
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
  // The title a PDF carries is the page's <title>. Pages printed from a
  // print view say so ("(Print)", "(نسخة للطباعة)"), which is right for the
  // web page and wrong for the document a buyer downloads.
  document.title = document.title.replace(/\s*\((?:Print|نسخة للطباعة)\)/, '');
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
// Includes the letterhead sheet's and the masthead's HTML. The logo and fonts it draws with are
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
  const arabic = [PDF_ARABIC_FONTS.regular, PDF_ARABIC_FONTS.bold];
  const files = [...new Set([job.source, ...direct, ...viaCss, ...letterhead, ...arabic, ...STATIC_PDF_FONTS])];
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
