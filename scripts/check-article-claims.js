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
 *   - a minimum order stated as anything but the 20ft container, or any
 *     tonnage below the container's 16 MT
 *   - wording that claims an event, certification history or ownership the
 *     register does not support (recertification, a certification held or
 *     renewed by us, our own factory, plant, line, groves or farms)
 *   - any named trade show, or any trade-show attendance, that no
 *     verified-approved register row names (none does: Triple Company has
 *     never exhibited, and Gulfood was never attended -- owner, 2026-10-02)
 *   - "certified supplier" phrasing applied to ourselves
 *   - the generic "a reputable / reliable exporter" voice in place of the
 *     company
 *   - an article body that never names Triple Company
 *   - an article, the blog index or the media index dated before
 *     4 August 2026, the day the site and its articles were first published
 *     (owner, 2026-10-02: the template dates are replaced, not removed),
 *     and an article with no date at all
 *   - an article no register row covers: every article is routed through
 *     docs/claim-and-evidence-register.csv, named in the where_it_appears
 *     field of a verified-approved row, so a new one cannot go live
 *     without being read against it
 * and, on every page, on a trial order offered below the container
 * ("smaller trial quantities may be possible"; owner, 2026-10-02: there is
 * no trial order), a reply promised in "one business day" when the reply
 * time is 24 hours (C-115), and the "a approved" typo.
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
  [/\b(exhibit(ed|ing)? at|visit (us|our (booth|stand)) at|our (booth|stand)\b|we (attended|will attend|are attending|took part in|participated in) (the |a )?\S+ (trade )?(show|fair|expo|exhibition))|زورونا في|جناحنا|شاركنا في معرض|نشارك في معرض|سنشارك في معرض/i, 'trade-show attendance no register row supports'],
  [/\bour (own )?(factory|factories|plant|processing (line|plant|facility)|brining line|production (line|facility)|facility|olive groves|groves|farms?|orchards?)\b|(?<!(n't|not|never|nor) )\bwe (own|operate|run) (a|an|the|our)\b|\b(owned|operated) by (us|Triple Company)|\bin-house (processing|brining|factory)|مصنعنا|منشأتنا|مزارعنا|بساتيننا|خط (التخليل|الإنتاج|المعالجة) الخاص بنا|(?<!لا )(?<!ولا )(?<![\u0600-\u06FF])(نمتلك|نملك) (مصنع|منشأة|خط)/i, 'ownership of processing; the partner facility does the processing (C-36)'],
  [/\b(certified since|renew(ed|al of) (our|its) certif|our (ISO|HACCP|BRC|IFS|FSSC)\b|we are (ISO|HACCP|BRC|IFS|FSSC)\b|we (hold|have been awarded|were awarded|obtained) (an? |the )?(ISO|HACCP|BRC|IFS|FSSC|certif))|(ISO ?\d{4,5}|HACCP|BRC|IFS|FSSC ?22000)[- ]certified (exporter|company|supplier|since)|حاصلون على شهادة|حصلنا على شهادة|شهادتنا|تجديد شهاد/i, 'a certification held by us or a certification history; any certificate is the partner facility\'s, and none is published yet'],
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
  // the article itself: the Arabic headlines end "| الشركة الثلاثية للتنمية الصناعية", which would pass any body
  const own = body((read(f).match(/<article[\s\S]*?<\/article>/) || [''])[0].replace(/^/, '<main>') + '</main>');
  if (!/Triple Company|الشركة الثلاثية/.test(own)) unnamed.push(f);
  for (const s of text.split(/\n|(?<=[.؟!])\s/)) {
    if (/minimum order|MOQ|الحد الأدنى للطلب|الحد الأدنى لطلب/i.test(s) && /\d[\d.,–-]*\s*(MT|metric|tons?|tonnes?|kg|كجم|طن|ft|قدم)/i.test(s) && !/20ft|20 قدمًا/.test(s)) moq.push(`${f}: "${s.trim().slice(0, 120)}"`);
  }
}
t('no article states a minimum order, event, certification history or ownership the register does not support',
  bad.length === 0, bad.join(' | '));
t('   and every minimum order an article states is the 20ft container', moq.length === 0, moq.join(' | '));
t('every article names Triple Company in its own body', unnamed.length === 0, unnamed.join(', '));

// ---- named trade shows: only one a verified-approved register row names ----
const REGISTER = path.join(ROOT, 'docs/claim-and-evidence-register.csv');
const registerRows = (() => {
  // where_it_appears and classification are columns 3 and 4; quoted fields may hold commas
  const rows = [];
  for (const line of fs.readFileSync(REGISTER, 'utf8').split('\n').slice(1)) {
    if (!line.trim()) continue;
    const cells = [];
    let cur = '', q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (q) { if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
      else if (c === '"') q = true; else if (c === ',') { cells.push(cur); cur = ''; } else cur += c;
    }
    cells.push(cur);
    rows.push({ id: cells[0], claim: cells[1] || '', where: cells[2] || '', status: cells[3] || '' });
  }
  return rows;
})();
const approved = registerRows.filter((r) => r.status === 'verified-approved');
const SHOWS = /\b(Gulfood|SIAL|Anuga|ThaiFex|Fancy Food Show|PLMA|Biofach|Food ?Africa|Foodex|Prodexpo|Saudi Food Show|Africa Food Show|Food ?Expo|Fruit Logistica|Alimentaria|IFE|Speciality & Fine Food Fair|World Food [A-Z][a-z]+|Gulfhost|Salon du [A-Z][a-z]+)\b|جلفود|سيال|أنوجا|معرض الخليج للأغذية/gi;
const unregisteredShows = [];
for (const f of articles) {
  for (const m of body(read(f)).matchAll(SHOWS)) {
    const name = m[0];
    if (!approved.some((r) => r.claim.toLowerCase().includes(name.toLowerCase()))) unregisteredShows.push(`${f}: "${name}"`);
  }
}
t('no article names a trade show that no verified-approved register row names', unregisteredShows.length === 0, unregisteredShows.join(' | '));

// ---- dates: nothing before the site's first publication --------------------
const FIRST_PUBLISHED = Date.UTC(2026, 7, 4);
const EN_MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const AR_MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const MONTH = new RegExp(`(?:(\\d{1,2})\\s+)?(${EN_MONTHS.join('|')}|${AR_MONTHS.join('|')})(?:\\s+(\\d{1,2}),?)?\\s+(20\\d\\d)`, 'gi');
const datesIn = (text) => [...text.matchAll(MONTH)].map((m) => {
  const name = m[2].toLowerCase();
  const month = EN_MONTHS.includes(name) ? EN_MONTHS.indexOf(name) : AR_MONTHS.indexOf(m[2]);
  // a month with no day counts from its last day, so "July 2026" is early and "August 2026" is not
  const day = Number(m[1] || m[3]) || new Date(Date.UTC(Number(m[4]), month + 1, 0)).getUTCDate();
  return { text: m[0], at: Date.UTC(Number(m[4]), month, day) };
});
const DATED = [...articles, ...tracked.filter((f) => /^(ar\/)?media\/(blog\/)?index\.html$/.test(f))];
const early = [];
const undated = [];
for (const f of DATED) {
  const html = read(f);
  const main = (html.match(/<main[\s\S]*<\/main>/) || [''])[0].replace(/<[^>]+>/g, ' ');
  const found = [...datesIn(main), ...[...html.matchAll(/"date(?:Published|Modified|Created)"\s*:\s*"(\d{4})-(\d{2})-(\d{2})/g)]
    .map((m) => ({ text: m[0], at: Date.UTC(+m[1], +m[2] - 1, +m[3]) }))];
  for (const d of found) if (d.at < FIRST_PUBLISHED) early.push(`${f}: "${d.text.trim()}"`);
  if (articles.includes(f) && found.length === 0) undated.push(f);
}
t('no article, blog index or media index is dated before 4 August 2026, the site\'s first publication', early.length === 0, early.join(' | '));
t('   and every article still carries its date', undated.length === 0, undated.join(', '));

// ---- every article is routed through the register --------------------------
const unrouted = articles.filter((f) => {
  const slug = f.match(/media\/([^/]+)\//)[1];
  return !approved.some((r) => r.where.includes(slug));
});
t('every article is named in a verified-approved register row, so its facts were read against the register',
  unrouted.length === 0, unrouted.join(', '));

// ---- no page offers a trial order below the container ----------------------
const TRIAL = /smaller trial quantit|trial (quantities|quantity|orders?|shipments?|pallets?) (may be|might be|are|is|can be) (possible|available|offered|accepted)|(?<!no )(?<!not )trial orders? (from|of) \d|الكميات التجريبية الأصغر ممكنة|كميات تجريبية (أصغر )?(ممكنة|متاحة)|(?<!لا )تتوفر طلبات تجريبية/i;
const pages = tracked.filter((f) => !/^(docs|scripts|crm|admin|letterhead|ar\/letterhead)\//.test(f));
const guides = execSync('git ls-files "netlify/functions/_guides/*.html"', { cwd: ROOT }).toString().trim().split('\n').filter(Boolean);
const trial = [...pages, ...guides, 'llms.txt'].filter((f) => {
  try { return TRIAL.test(read(f).replace(/&ndash;/g, '–')); } catch (e) { return false; }
});
t('no page, guide or llms.txt offers a trial order below the 20ft container', trial.length === 0, trial.join(', '));

// ---- tonnage below the container in an article ----------------------------
const lowTonnage = [];
for (const f of articles) {
  for (const m of body(read(f)).matchAll(/(\d+(?:[.,]\d+)?)\s*(?:[–-]\s*\d+(?:[.,]\d+)?\s*)?(?:MT\b|metric tons?|tonnes?\b|tons?\b|طنًا|طن\b|أطنان)/gi)) {
    if (parseFloat(m[1].replace(',', '')) < 16) lowTonnage.push(`${f}: "${m[0]}"`);
  }
}
t('no article states a tonnage below the 20ft container\'s 16 MT', lowTonnage.length === 0, lowTonnage.join(' | '));

// ---- one reply time: 24 hours (C-115) --------------------------------------
// The articles' CTA and /media (and its Inquiries page) said "one business day"
// until 2026-10-02, beside the 24 hours promised on every form.
const slowReply = [...pages, ...guides].filter((f) => /one business day|يوم عمل واحد/i.test(read(f)));
t('no page or guide promises a reply in "one business day"; the reply time is 24 hours (C-115)', slowReply.length === 0, slowReply.join(', '));

const typo = tracked.filter((f) => !/^(docs|scripts)\//.test(f) && /\ba approved\b/.test(read(f)));
t('no page carries the "a approved" typo', typo.length === 0, typo.join(', '));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
