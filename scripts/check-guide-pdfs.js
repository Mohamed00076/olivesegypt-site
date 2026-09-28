#!/usr/bin/env node
'use strict';

/*
 * Every gated PDF is present, is a PDF, and was built from its source as it
 * stands today.
 *
 *   node scripts/check-guide-pdfs.js        (part of `npm test`)
 *
 * The audit of 2026-09-28 (B6) found both catalogue PDFs stale: their sources
 * had been corrected and nobody regenerated the files, so buyers were handed
 * the old product range for ten days. Every guide became a PDF the same day
 * (owner's request), which made sixteen files that can drift that way.
 *
 * scripts/generate-export-catalog-pdf.js records each PDF's fingerprint in
 * scripts/guide-pdfs.json: its source HTML, the stylesheets and images that
 * source uses, the render settings, and the PDF itself. This recomputes the
 * fingerprint from what is in the repository now and fails when they differ,
 * naming the file that changed. The fix is always the same: regenerate.
 *
 * It also holds the catalogue to its own design and to what the Downloads
 * page says about it: one printed page per .pdf-page section, and that page
 * count in the Downloads page's description. Both catalogues had grown a
 * spill page -- 10 printed pages against a designed and advertised 9.
 */

const fs = require('fs');
const path = require('path');
const { ROOT, MANIFEST, JOBS, GUIDE_SLUGS, fingerprint, sha256, countPages } = require('./guide-pdfs');

let pass = 0, fail = 0;
const t = (name, cond, extra) => {
  cond ? pass++ : fail++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : '   <-- ' + (extra === undefined ? '' : extra)}`);
};

const REGEN = 'regenerate: python3 -m http.server 8899 & node scripts/generate-export-catalog-pdf.js';
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, MANIFEST), 'utf8'));
const read = (rel) => fs.readFileSync(path.join(ROOT, rel));

// ---- the list is complete ----------------------------------------------------
const outs = JOBS.map((j) => j.out).sort();
const recorded = Object.keys(manifest).sort();
t(`all ${JOBS.length} gated PDFs are recorded in ${MANIFEST}, and nothing else is`,
  JSON.stringify(outs) === JSON.stringify(recorded),
  `missing: ${outs.filter((o) => !recorded.includes(o)).join(', ') || 'none'}; unknown: ${recorded.filter((o) => !outs.includes(o)).join(', ') || 'none'}`);

// A guide added to the functions bundle without a PDF job would be served by
// nobody and checked by nothing.
const guideDir = path.join(ROOT, 'netlify', 'functions', '_guides');
const orphans = ['en', 'ar'].flatMap((loc) => fs.readdirSync(path.join(guideDir, loc))
  .filter((f) => f.endsWith('.html') && !GUIDE_SLUGS.includes(f.replace(/\.html$/, '')))
  .map((f) => `${loc}/${f}`));
t('every guide HTML in the functions bundle is the source of a PDF', orphans.length === 0, orphans.join(', '));

// ---- each PDF ------------------------------------------------------------------
const notPdf = [], stale = [], swapped = [], empty = [];
for (const job of JOBS) {
  const entry = manifest[job.out];
  let pdf;
  try { pdf = read(job.out); } catch (e) { notPdf.push(`${job.out} is missing`); continue; }
  if (pdf.subarray(0, 5).toString('latin1') !== '%PDF-' || !pdf.subarray(-1024).toString('latin1').includes('%%EOF')) {
    notPdf.push(`${job.out} is not a complete PDF`);
    continue;
  }
  if (countPages(pdf) < 1) empty.push(job.out);
  if (!entry) continue;

  // Replaced by hand, or regenerated without recording it.
  if (sha256(pdf) !== entry.pdf) swapped.push(job.out);

  const now = fingerprint(job);
  const changed = Object.keys(Object.assign({}, now.inputs, entry.inputs))
    .filter((f) => now.inputs[f] !== entry.inputs[f]);
  if (now.render !== entry.render) changed.push('the render settings in scripts/guide-pdfs.js');
  if (entry.source !== job.source) changed.push(`its source is now ${job.source}`);
  if (changed.length) stale.push(`${job.out} (changed since it was built: ${changed.join(', ')})`);
}
t('every gated PDF exists and is a complete PDF', notPdf.length === 0, notPdf.join(' | '));
t('   and has at least one page', empty.length === 0, empty.join(', '));
t('   and is the file its generator recorded, not a hand-replaced one', swapped.length === 0, `${swapped.join(', ')} -- ${REGEN}`);
t('every gated PDF was built from its source as it stands now', stale.length === 0, `${stale.join(' | ')} -- ${REGEN}`);

// ---- the catalogue: its design, and what the Downloads page promises -----------
for (const job of JOBS.filter((j) => j.kind === 'catalog')) {
  const designed = (read(job.source).toString('utf8').match(/class="pdf-page[\s"]/g) || []).length;
  let printed = -1;
  try { printed = countPages(read(job.out)); } catch (e) { /* reported above */ }
  t(`${job.out}: ${printed} printed page(s) for ${designed} designed -- no page spills over`,
    designed > 0 && printed === designed);

  // The cover lists every page after itself, once, in order, and each page's
  // footer carries its own number. Until 2026-09-28 the last two were
  // numbered "8A" and "8B" in both places -- pages 8 and 9 of the printed
  // catalogue.
  const src = read(job.source).toString('utf8');
  const toc = [...src.matchAll(/class="cover-toc-row"[^>]*><span>[^<]*<\/span><span>([^<]*)<\/span>/g)].map((m) => m[1].trim());
  const want = Array.from({ length: designed - 1 }, (_, i) => String(i + 2));
  t(`   its contents list numbers the pages ${want[0]}-${want[want.length - 1]}, as printed`,
    JSON.stringify(toc) === JSON.stringify(want), toc.join(', '));
  const footers = src.split(/<section class="pdf-page[\s"]/).slice(2)
    .map((page) => ((page.match(/class="pdf-footer">[\s\S]*?<span>([^<]*)<\/span><\/div>/) || [])[1] || '').match(/\d+[A-Za-z]*$/));
  const badFooters = footers.map((m, i) => [i + 2, m ? m[0] : '?']).filter(([n, got]) => String(n) !== got);
  t('   and every page after the cover carries its own number in the footer',
    footers.length === designed - 1 && badFooters.length === 0, badFooters.map(([n, got]) => `page ${n} says ${got}`).join(', '));

  const downloads = read(job.locale === 'ar' ? 'ar/downloads/index.html' : 'downloads/index.html').toString('utf8');
  const claim = downloads.match(job.locale === 'ar' ? /المكوّن من (\d+) صفحات/ : /printable (\d+)-page export catalogue/);
  t(`   the ${job.locale === 'ar' ? 'Arabic' : 'English'} Downloads page describes it as ${claim ? claim[1] : '?'} pages, which it is`,
    !!claim && Number(claim[1]) === printed, claim ? claim[0] : 'page-count wording not found');
}

const ok = fail === 0;
console.log(`\nguide-pdfs ${ok ? 'OK' : 'FAILED'} -- ${JOBS.length} gated PDFs, each current with its source.`);
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(ok ? 0 : 1);
