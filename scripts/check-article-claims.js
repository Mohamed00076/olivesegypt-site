#!/usr/bin/env node
'use strict';

/*
 * The articles hold to the same facts as the rest of the site.
 *
 *   node scripts/check-article-claims.js        (part of `npm test`)
 *
 * The articles under /media came with the site's first upload (4 August
 * 2026), written as generic trade advice and never put through the evidence
 * discipline used for product and resource pages. The September clean-ups
 * removed the company claims among them -- an ISO "recertification", a
 * Gulfood appearance, a harvest teaser -- but the advice itself was never
 * read line by line, so a "trial pallet (100-500 kg)" minimum survived in
 * the import guide, in both languages, against the 1 x 20ft container stated
 * everywhere else. An external audit found it on 2026-10-02, along with a
 * "certified, traceable supplier" line the company cannot claim and a
 * third-person "reputable exporter" voice that never named the company.
 *
 * This reads every article, English and Arabic, and fails on:
 *   - a minimum order stated as anything but the 20ft container
 *   - wording that claims an event, certification history or ownership the
 *     register does not support (recertification, trade-show attendance,
 *     our own factory or plant)
 *   - "certified supplier" phrasing applied to ourselves
 *   - the generic "a reputable / reliable exporter" voice in place of the
 *     company
 *   - an article body that never names Triple Company
 *   - the "a approved" typo, anywhere on the site
 *
 * A new article, or an edit, gets the same review as any page: its company
 * facts must already be in docs/claim-and-evidence-register.csv.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
let pass = 0, fail = 0;
const t = (name, cond, extra) => {
  cond ? pass++ : fail++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : '   <-- ' + (extra === undefined ? '' : extra)}`);
};

const tracked = execSync('git ls-files "*.html"', { cwd: ROOT }).toString().trim().split('\n');
const NOT_ARTICLES = new Set(['blog', 'news', 'inquiries']);
const articles = tracked.filter((f) => {
  const m = f.match(/^(?:ar\/)?media\/([^/]+)\/index\.html$/);
  return m && !NOT_ARTICLES.has(m[1]);
});
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const body = (html) => {
  const main = (html.match(/<main[\s\S]*<\/main>/) || [''])[0];
  // the body of the article, not the "More insights" teasers at its foot
  const cut = main.search(/More insights|مزيد من الرؤى/);
  return (cut > 0 ? main.slice(0, cut) : main)
    .replace(/<(script|style|svg)\b[\s\S]*?<\/\1>/g, ' ')
    .replace(/<\/(p|h[1-6]|li|div|span|summary)>/g, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&mdash;/g, '—').replace(/&ndash;/g, '–').replace(/&#x27;/g, "'").replace(/&amp;/g, '&')
    .replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, '\n');
};

t(`articles found (${articles.length}, both languages)`, articles.length >= 14, articles.length);

const BANNED = [
  [/trial pallet|منصة تجريبية/i, 'a trial-pallet minimum; the minimum order is one 20ft container'],
  [/\b\d{2,3}\s*[–-]\s*\d{3}\s*(kg|كجم)\b[^.]{0,40}(minimum|MOQ|الحد الأدنى)|(minimum order|MOQ|الحد الأدنى للطلب)[^.]{0,80}\b\d{2,3}\s*[–-]\s*\d{3}\s*(kg|كجم)/i, 'a minimum order in kilograms'],
  [/40ft|40 قدمًا/, 'a 40ft container, which no register row supports'],
  [/recertif|إعادة اعتماد/i, 'a certification history the company does not have'],
  [/Gulfood|جلفود/i, 'a trade-show appearance no register row supports'],
  [/\bour (own )?(factory|plant|processing line|brining line)\b|مصنعنا|خط التخليل الخاص بنا/i, 'ownership of processing; the partner facility does the processing (C-36)'],
  [/certified,? traceable supplier|مورد معتمد وقابل للتتبع/i, '"certified" applied to the supplier; certifications are in progress'],
  [/\b(a|an|any) (reputable|reliable|trusted,?) exporter (will|can|is)|reputable (exporters|suppliers)|from a reliable exporter|مصدّر ذي سمعة|مصدّرين ذوي سمعة|من مصدّر موثوق حتى/i, 'the generic exporter voice where the company should speak'],
];
const bad = [];
const unnamed = [];
const moq = [];
for (const f of articles) {
  const text = body(read(f));
  for (const [re, why] of BANNED) {
    const m = text.match(re);
    if (m) bad.push(`${f}: "${m[0]}" (${why})`);
  }
  if (!/Triple Company|الشركة الثلاثية/.test(text)) unnamed.push(f);
  for (const s of text.split(/\n|(?<=[.؟!])\s/)) {
    if (/minimum order|MOQ|الحد الأدنى للطلب|الحد الأدنى لطلب/i.test(s) && /\d[\d.,–-]*\s*(MT|metric|tons?|tonnes?|kg|كجم|طن|ft|قدم)/i.test(s) && !/20ft|20 قدمًا/.test(s)) moq.push(`${f}: "${s.trim().slice(0, 120)}"`);
  }
}
t('no article states a minimum order, event, certification history or ownership the register does not support',
  bad.length === 0, bad.join(' | '));
t('   and every minimum order an article states is the 20ft container', moq.length === 0, moq.join(' | '));
t('every article names Triple Company in its own body', unnamed.length === 0, unnamed.join(', '));

const typo = tracked.filter((f) => !/^(docs|scripts)\//.test(f) && /\ba approved\b/.test(read(f)));
t('no page carries the "a approved" typo', typo.length === 0, typo.join(', '));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
