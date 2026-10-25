#!/usr/bin/env node
'use strict';

/*
 * Every PDF the site hands out keeps the structure a screen reader needs
 * (owner, 2026-10-24, after the PDF accessibility audit of 2026-10-23):
 *
 *   node scripts/check-pdf-structure.js        (part of `npm test`)
 *
 *   1. it is tagged (/MarkInfo /Marked true, with a structure tree);
 *   2. it declares its language, the locale it is printed for (/Lang);
 *   3. it has bookmarks built from its headings (/Outlines, /Count > 0);
 *   4. it has a title, and asks viewers to show it rather than the file name;
 *   5. every figure has a description (/Alt), and no figure sits inside
 *      another (the undescribed <figure> frame around the cover photo,
 *      fixed by #430, and around the spec sheets' photos in #359).
 *
 * Chromium writes these files without object streams, so each object's
 * dictionary is plain text and a few patterns read it; content streams,
 * which are compressed, are never needed.
 *
 * The order of numbers in the Arabic PDFs ("140-360" printed as "360-140")
 * is not read here: that needs the text laid out as it is drawn. It is held
 * at the source instead, by rule 6 of scripts/check-rtl.js, which covers
 * every page and source the Arabic PDFs are printed from.
 */

const fs = require('fs');
const path = require('path');
const { ROOT, JOBS } = require('./guide-pdfs');

// Known gaps, each with the change that closes it. Empty them as they close.
//
// Figures without a description: none (the caliber-scale drawing was the
// last, described 2026-10-24).
const UNDESCRIBED_FIGURES = {};
// Not tagged yet: none (the single spec sheets were the last, 2026-10-24).
const UNTAGGED = new Set([]);

function objects(buf) {
  const text = buf.toString('latin1');
  const objs = new Map();
  for (const m of text.matchAll(/(\d+) 0 obj\s*([\s\S]*?)(?:stream\r?\n|endobj)/g)) objs.set(Number(m[1]), m[2]);
  return objs;
}

const ref = (dict, key) => { const m = dict.match(new RegExp(`/${key} (\\d+) 0 R`)); return m ? Number(m[1]) : null; };
const refs = (value) => [...(value || '').matchAll(/(\d+) 0 R/g)].map((m) => Number(m[1]));
const kids = (dict) => { const m = dict.match(/\/K (\[[^\]]*\]|\d+ 0 R|\d+)/); return m ? refs(m[1]) : []; };
const isFigure = (dict) => /\/S \/Figure\b/.test(dict || '');
const described = (dict) => /\/(Alt|ActualText) ?(\(|<)/.test(dict);

function problemsOf(job, buf) {
  const out = [];
  const objs = objects(buf);
  const catalog = [...objs.values()].find((d) => /\/Type \/Catalog\b/.test(d));
  if (!catalog) return ['no document catalog found (not a Chromium PDF?)'];

  // 1
  const tagged = /\/Marked true/.test(catalog) && ref(catalog, 'StructTreeRoot') !== null;
  if (UNTAGGED.has(job.out)) {
    if (tagged) out.push('is now tagged: take it off the UNTAGGED list in this check');
    return out;
  }
  if (!tagged) return ['is not tagged (no /MarkInfo /Marked true and structure tree)'];

  // 2
  const lang = (catalog.match(/\/Lang \(([^)]*)\)/) || [])[1];
  if (lang !== job.locale) out.push(`declares language ${lang ? `"${lang}"` : 'none'}, not "${job.locale}"`);

  // 3
  const outlines = objs.get(ref(catalog, 'Outlines')) || '';
  const count = Number((outlines.match(/\/Count (-?\d+)/) || [])[1] || 0);
  if (!ref(outlines, 'First') || count === 0) out.push('has no bookmarks');

  // 4
  const trailer = buf.toString('latin1').match(/\/Info (\d+) 0 R/);
  const info = trailer ? objs.get(Number(trailer[1])) || '' : '';
  if (!/\/Title (\([^)]|<)/.test(info)) out.push('has no title');
  if (!/\/DisplayDocTitle true/.test(catalog)) out.push('does not ask viewers to show its title');

  // 5
  let undescribed = 0;
  for (const [n, dict] of objs) {
    if (!isFigure(dict)) continue;
    if (kids(dict).some((k) => isFigure(objs.get(k)))) out.push(`figure ${n} 0 R holds another figure (an undescribed frame around a picture)`);
    else if (!described(dict)) undescribed++;
  }
  const allowed = UNDESCRIBED_FIGURES[job.out] || 0;
  if (undescribed > allowed) out.push(`${undescribed} figure(s) without a description`);
  if (undescribed < allowed) out.push(`${allowed - undescribed} figure(s) newly described: lower UNDESCRIBED_FIGURES in this check`);
  return out;
}

const problems = [];
let tagged = 0;
for (const job of JOBS) {
  const file = path.join(ROOT, job.out);
  if (!fs.existsSync(file)) { problems.push(`${job.out}: missing`); continue; }
  const found = problemsOf(job, fs.readFileSync(file));
  if (!UNTAGGED.has(job.out) && !found.length) tagged++;
  for (const p of found) problems.push(`${job.out}: ${p}`);
}

if (problems.length) {
  console.error(`pdf-structure: ${problems.length} problem(s):\n  ` + problems.join('\n  '));
  process.exit(1);
}
console.log(`pdf-structure OK -- ${tagged} PDFs are tagged, in their own language, with bookmarks and a shown title, and no figure is framed by an undescribed one` +
  (UNTAGGED.size ? `; ${UNTAGGED.size} single spec sheets are not tagged yet` : '') + '.');
