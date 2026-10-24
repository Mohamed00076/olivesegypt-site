#!/usr/bin/env node
'use strict';

/*
 * The redesigned company profile and buyer guides (owner's PDF redesign
 * brief, 2026-10-12, Phase C): A4, read on a phone first, no buttons.
 *
 *   node scripts/build-pdf-documents.js           write the sources
 *   node scripts/build-pdf-documents.js --check   fail if any is out of date
 *                                                 (scripts/check-pdf-sources.js)
 *
 * Every word is read from the document's existing source -- the guide's HTML
 * in netlify/functions/_guides/, the company profile page -- so the two
 * cannot say different things: change the source and the --check fails until
 * this is run again. Only the design is new, plus what the brief removes:
 * "Request a Quote", "Request a Sample" and every other link but the
 * masthead's email address and phone number. A link inside a sentence ("set
 * out on Quality & Documentation") keeps its words as plain text; a closing
 * line that was only an invitation to click ("Ready to move forward?") goes.
 *
 * The output is one flowing document per source, which the page's own script
 * lays out on fixed A4 pages (sheet.css, document.css): a section that does
 * not fit moves to the next page, or splits between its items, never inside
 * one, so a list, a table or a card set is never split, and a heading never
 * ends a page. The generator runs that layout again once the PDF's fonts are
 * on (tcFit), and refuses a page whose content reaches the foot.
 *
 * Written to scripts/pdf-sources/documents/, which the deploy prunes.
 */

const fs = require('fs');
const path = require('path');
const { FONTS, DESIGN, T, masthead, runningHead, foot, isolateNumbers, markInlineArabic } = require('./pdf-design/parts');
const { GUIDE_SLUGS } = require('./guide-pdfs');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = 'scripts/pdf-sources/documents';
const DOCUMENT_CSS = '/scripts/pdf-design/document.css';

/*
 * The cover's photograph (owner, 2026-10-14: "do 3"): the owner's whole
 * green olives, the same file as the Green Olives spec sheet's, square, in
 * a rounded frame at the band's end. 800 px at 42 mm is 484 ppi. Its alt
 * text is the photograph's existing caption. Its frame is a <div>: a
 * <figure> around it was tagged as a second, undescribed figure in the PDF
 * (owner, 2026-10-23, after the PDF accessibility audit).
 */
const COVER_PHOTO = '/scripts/pdf-design/photos/green-olives-whole.jpg';
const COVER_ALT = { en: 'Whole green olives', ar: 'زيتون أخضر كامل' };

const DOCUMENTS = [
  { slug: 'company-profile', source: (l) => (l === 'en' ? 'company-profile/index.html' : 'ar/company-profile/index.html') },
  ...GUIDE_SLUGS.map((slug) => ({ slug, source: (l) => `netlify/functions/_guides/${l}/${slug}.html` })),
];

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const fail = (msg) => { throw new Error(`build-pdf-documents: ${msg}`); };
const one = (re, s, what) => {
  const m = s.match(re);
  if (!m) fail(`could not find ${what}`);
  return m[1].trim();
};

/** The top-level elements of a fragment, in order (text between them is ignored). */
function children(html) {
  const out = [];
  const re = /<(\/?)([a-z][a-z0-9]*)\b([^>]*?)(\/?)>/gi;
  let depth = 0, start = 0, tag = null, attrs = '', innerStart = 0, m;
  const VOID = /^(br|img|hr|meta|link|input)$/i;
  while ((m = re.exec(html))) {
    const [whole, close, name, a, self] = m;
    if (VOID.test(name) || self) {
      if (depth === 0) out.push({ tag: name.toLowerCase(), attrs: a, inner: '', outer: whole });
      continue;
    }
    if (!close) {
      if (depth === 0) { tag = name.toLowerCase(); attrs = a; start = m.index; innerStart = re.lastIndex; }
      depth++;
    } else {
      depth--;
      if (depth === 0) out.push({ tag, attrs, inner: html.slice(innerStart, m.index), outer: html.slice(start, re.lastIndex) });
    }
  }
  return out;
}
const hasClass = (el, c) => new RegExp(`class="[^"]*\\b${c}\\b`).test(el.attrs);

// Character references, as characters (so a range such as "16&ndash;18" is
// seen as one). &amp;, &lt; and &gt; stay as they are. "&sim;" (the
// profile's "~16-18 MT") is printed as "~": the site's fonts have no "∼",
// and the fallback embedded as a Type3 font.
const NAMED = { ndash: '\u2013', mdash: '\u2014', nbsp: '\u00a0', middot: '\u00b7', rsquo: '\u2019', lsquo: '\u2018',
  ldquo: '\u201c', rdquo: '\u201d', times: '\u00d7', sim: '~', ntilde: '\u00f1', hellip: '\u2026' };
const decode = (s) => s.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&([a-z]+);/g, (whole, name) => NAMED[name] || whole);
const isCta = (href) => /\/(contact|sample)\/$|\.pdf$/.test(href);

/*
 * A run of inline HTML, cleaned: no classes or styles; email and phone links
 * kept; calls to action dropped; every other link reduced to its words.
 */
function inline(html) {
  let s = decode(html);
  s = s.replace(/<a\s+([^>]*)>([\s\S]*?)<\/a>/g, (_, a, text) => {
    const href = (a.match(/href="([^"]*)"/) || [])[1] || '';
    const dir = (a.match(/dir="([^"]*)"/) || [])[1];
    if (/^(mailto|tel):/.test(href)) return `<a href="${href}"${dir ? ` dir="${dir}"` : ''}>${text}</a>`;
    if (isCta(href)) return '\u2063';
    return text;
  });
  s = s.replace(/<(strong|em|span|p|li|h3|dt|dd)\s+([^>]*)>/g, (whole, tag, a) => {
    const dir = (a.match(/dir="([^"]*)"/) || [])[1];
    return dir ? `<${tag} dir="${dir}">` : `<${tag}>`;
  });
  // A span the source used only for styling, now without attributes.
  s = s.replace(/<span>([\s\S]*?)<\/span>/g, '$1');
  return s.replace(/\s+/g, ' ').trim();
}

/** A closing line, without its call to action; null when nothing else is left. */
function closing(html) {
  const raw = decode(html);
  const s0 = raw.replace(/<a\s+([^>]*)>([\s\S]*?)<\/a>/g, (whole, a, text, at) => {
    const href = (a.match(/href="([^"]*)"/) || [])[1] || '';
    if (/^(mailto|tel):/.test(href)) return whole;
    // A call to action, or a link standing alone after a colon ("what is
    // possible for your market: Private Label & OEM").
    if (isCta(href) || /:\s*$/.test(raw.slice(0, at))) return '\u2063';
    return text;
  });
  let s = inline(s0);
  // Removed links, the "or" between them, and the punctuation after them.
  s = s.replace(/\u2063(\s*(or|أو)\s*\u2063)*/g, '\u2063');
  // "Ready to move forward? <links>." -- only an invitation: nothing is left.
  if (/[?؟]\s*\u2063/.test(s)) return null;
  s = s.replace(/\s*:?\s*\u2063\s*/g, '').replace(/\s+([.،])/g, '$1').trim();
  return s || null;
}

/*
 * One section of the source, as a block of the flowing document: its heading
 * and its items, each item a unit the layout keeps whole.
 */
function block(locale, html, ctx = {}) {
  const items = [];
  let heading = null;
  const els = children(html);
  for (let i = 0; i < els.length; i++) {
    const el = els[i];
    if (el.tag === 'h2') { heading = inline(el.inner); continue; }
    if (el.tag === 'a') continue; // the section's own button
    if (el.tag === 'p') {
      const cls = hasClass(el, 'text-xs') ? 'small' : 'body';
      const p = `<p class="${cls}">${inline(el.inner)}</p>`;
      // A paragraph that introduces a list ("prepared for every order:", the
      // profile's "Full specifications ... for each product") stays with it.
      if (els[i + 1] && els[i + 1].tag === 'ul') {
        items.push(`<div class="unit">${p}${list(els[i + 1], ctx, heading)}</div>`);
        i++;
      } else items.push(p);
      continue;
    }
    if (el.tag === 'ul') { items.push(list(el, ctx, heading)); continue; }
    if (el.tag === 'dl') { items.push(facts(el)); continue; }
    if (el.tag === 'table') { items.push(table(el)); continue; }
    if (el.tag === 'div' && hasClass(el, 'qa-item')) {
      const [q, a] = children(el.inner);
      items.push(`<div class="qa"><h3>${inline(q.inner)}</h3><p class="body">${inline(a.inner)}</p></div>`);
      continue;
    }
    if (el.tag === 'div' && hasClass(el, 'stat-grid')) {
      items.push(`<div class="stats">${children(el.inner).map((box) => {
        const [v, l] = children(box.inner);
        return `<div class="stat"><p class="stat-value">${inline(v.inner)}</p><p class="stat-label">${inline(l.inner)}</p></div>`;
      }).join('')}</div>`);
      continue;
    }
    fail(`${locale}: no layout for <${el.tag}${el.attrs}>`);
  }
  if (!heading) fail(`${locale}: a section has no heading`);
  // The caliber sections carry the caliber scale under their explanation.
  if (/calib|عيار|أعيرة/i.test(heading)) {
    const at = items.findIndex((it) => it.startsWith('<p class="body">'));
    if (at >= 0) items.splice(at + 1, 0, caliberScale(locale));
  }
  // The profile's product range (owner, 2026-10-13: it starts on a page of
  // its own rather than at the foot of the one before) is never split.
  const keep = items.some((it) => it.includes('class="list cols-2"'));
  return `<div class="block${keep ? ' keep' : ''}"><h2>${heading}</h2>${items.join('')}</div>`;
}

/*
 * A list. The pricing guide's price drivers (class "driver-cards") are set
 * as four cards; the profile's product range (a grid on the page) in two
 * columns; every other list as a list.
 */
function list(el, ctx = {}, heading = '') {
  const lis = children(el.inner).filter((c) => c.tag === 'li');
  const strongOf = (li) => (li.inner.match(/^\s*<strong[^>]*>([\s\S]*?)<\/strong>\s*([\s\S]*)$/) || []);
  // Numbered steps ("1. Enquiry -- ...") as a timeline: the number in a
  // circle, the step's own words beside it.
  if (lis.length >= 3 && lis.every((li) => /^[0-9\u0660-\u0669]+\.\s/.test((strongOf(li)[1] || '').trim()))) {
    return `<ol class="steps">${lis.map((li) => {
      const [, title, rest] = strongOf(li);
      const m = title.trim().match(/^([0-9\u0660-\u0669]+)\.\s*([\s\S]*)$/);
      return `<li><span class="step-num">${m[1]}</span><div class="step-body"><strong>${inline(m[2])}</strong> ${inline(rest)}</div></li>`;
    }).join('')}</ol>`;
  }
  // "We handle" and "The approved partner facility handles", side by side.
  if (ctx.slug === 'company-overview' && lis.length === 2 && lis.every((li) => strongOf(li)[1])) {
    return `<div class="split">${lis.map((li, n) => {
      const [, title, rest] = strongOf(li);
      return `<div class="split-card">${n ? ICON.factory : ICON.office}<h3>${inline(title)}</h3><p>${inline(rest).replace(/^[\u2014\-\s]+/, '')}</p></div>`;
    }).join('')}</div>`;
  }
  if (hasClass(el, 'driver-cards')) {
    return `<div class="cards">${lis.map((li) => {
      const m = li.inner.match(/^\s*<strong[^>]*>([\s\S]*?)<\/strong>\s*([\s\S]*)$/);
      if (!m) fail('a price driver has no title');
      return `<div class="card"><h3>${inline(m[1]).replace(/[.:]\s*$/, '')}</h3><p>${inline(m[2])}</p></div>`;
    }).join('')}</div>`;
  }
  // A list of four or more paragraph-length points may break between whole
  // points (never inside one); see the layout below.
  const words = lis.map((li) => li.inner.replace(/<[^>]+>/g, '').trim().split(/\s+/).length);
  const long = lis.length >= 4 && words.reduce((a, b) => a + b, 0) / lis.length >= 18;
  const cls = /grid-cols-2/.test(el.attrs) ? 'list cols-2' : long ? 'list long' : 'list';
  // The export checklist's three kinds of document, each with its own mark:
  // prepared for every shipment, confirmed per order, still being
  // established.
  const status = ctx.slug === 'export-documentation-checklist' ? [ICON.check, ICON.clipboard, null, ICON.hourglass][ctx.index] : null;
  const item = (li) => {
    const ic = status || packIcon(strongOf(li)[1] || '');
    return ic ? `<li class="with-icon">${ic}<span>${inline(li.inner)}</span></li>` : `<li>${inline(li.inner)}</li>`;
  };
  return `<ul class="${cls}">${lis.map(item).join('')}</ul>`;
}

/** Labelled facts (the profile's identity and terms) as cards. */
function facts(el) {
  return `<div class="facts">${children(el.inner).map((d) => {
    const [dt, dd] = children(d.inner);
    const ltr = /dir="ltr"/.test(dd.attrs);
    const v = inline(dd.inner);
    return `<div class="fact"><p class="label">${inline(dt.inner)}</p><p class="fact-value">${ltr ? `<span dir="ltr">${v}</span>` : v}</p></div>`;
  }).join('')}</div>`;
}

/** A table, as the design's table. */
function table(el) {
  const clean = el.inner.replace(/<(table|thead|tbody|tr|th|td)\s+([^>]*)>/g, (whole, tag, a) => {
    const scope = (a.match(/scope="([^"]*)"/) || [])[1];
    return scope ? `<${tag} scope="${scope}">` : `<${tag}>`;
  });
  const withIcons = inline(clean).replace(/<th scope="row">([\s\S]*?)<\/th>/g, (whole, label) => {
    const ic = packIcon(label);
    return ic ? `<th scope="row"><span class="row-icon">${ic}</span>${label}</th>` : whole;
  });
  return `<table class="spec doc-table">${withIcons}</table>`;
}

/*
 * Pictures added to the documents (owner, 2026-10-14: "make them look more
 * appealing ... by adding diagrams or images"). Every one draws something
 * the text already says -- a packaging format, the caliber scale, the order
 * steps -- and none carries a claim of its own. Line icons in the site's
 * style (24 x 24, round strokes), hidden from screen readers.
 */
const svg = (body) => `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${body}</svg>`;
const ICON = {
  jar: svg('<rect x="7" y="2.5" width="10" height="3" rx="1"/><path d="M7.5 5.5h9l1 3v11a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2v-11z"/><path d="M6.5 11h11"/><circle cx="12" cy="15.5" r="2"/>'),
  tin: svg('<ellipse cx="12" cy="5" rx="7" ry="2.5"/><path d="M5 5v14c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V5"/><path d="M5 9.5c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5"/>'),
  bucket: svg('<path d="M4.5 7h15l-1.6 13a1.5 1.5 0 0 1-1.5 1.3H7.6A1.5 1.5 0 0 1 6.1 20z"/><path d="M4.5 7c0-2.8 3.4-4.5 7.5-4.5s7.5 1.7 7.5 4.5"/><path d="M8 12.5h8"/>'),
  pail: svg('<rect x="5" y="4" width="14" height="3" rx="1"/><path d="M6 7h12l-1 13a1.5 1.5 0 0 1-1.5 1.4h-7A1.5 1.5 0 0 1 7 20z"/><path d="M9 11.5h6"/>'),
  barrel: svg('<path d="M6 3h12c1.3 2.6 2 5.6 2 9s-.7 6.4-2 9H6c-1.3-2.6-2-5.6-2-9s.7-6.4 2-9z"/><path d="M4.4 8h15.2"/><path d="M4.4 16h15.2"/>'),
  check: svg('<circle cx="12" cy="12" r="9.5"/><path d="m7.5 12.2 3 3 6-6.4"/>'),
  clipboard: svg('<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m8.5 13.5 2.5 2.5 4.5-5"/>'),
  hourglass: svg('<path d="M6 2.5h12M6 21.5h12"/><path d="M7 2.5c0 4.5 5 6 5 9.5s-5 5-5 9.5"/><path d="M17 2.5c0 4.5-5 6-5 9.5s5 5 5 9.5"/>'),
  office: svg('<rect x="4" y="3" width="16" height="18.5" rx="1.5"/><path d="M9 21.5v-4h6v4"/><path d="M8 7h.01M12 7h.01M16 7h.01M8 11h.01M12 11h.01M16 11h.01"/>'),
  factory: svg('<path d="M2.5 21.5v-11l6 3.5v-3.5l6 3.5V5.5h7v16z"/><path d="M6.5 17.5h2M11.5 17.5h2M16.5 17.5h2"/>'),
};

/** The packaging format a label names, if any (EN and AR). */
function packIcon(label) {
  const t = label.replace(/<[^>]+>/g, '').trim();
  if (/^(glass jars?|برطمانات زجاجية)/i.test(t)) return ICON.jar;
  if (/^(tin cans?|علب صفيح)/i.test(t)) return ICON.tin;
  if (/^(plastic buckets?|دِلاء بلاستيكية|دلاء بلاستيكية)/i.test(t)) return ICON.bucket;
  if (/^(plastic barrels?|براميل بلاستيكية)/i.test(t)) return ICON.barrel;
  if (/^(PET pail|وعاء PET)/i.test(t)) return ICON.pail;
  return null;
}

/*
 * The caliber scale: the range we supply (140 to 360, from the text beside
 * it), with olives drawn smaller as the count per kilogram rises. Its two
 * end labels restate "a lower number means larger individual olives".
 */
const CALIBER_WORDS = { en: ['Larger olives', 'Smaller olives'], ar: ['حبات أكبر', 'حبات أصغر'] };
function caliberScale(locale) {
  const sizes = [15, 13, 11, 9.5, 8, 6.8, 5.8];
  let x = 18;
  const olives = sizes.map((r) => { const cx = x + r; x += 2 * r + 9; return `<ellipse cx="${cx}" cy="22" rx="${r}" ry="${(r * 1.18).toFixed(1)}"/>`; }).join('');
  const [big, small] = CALIBER_WORDS[locale];
  return `<figure class="caliber-scale">
<svg viewBox="0 0 ${x + 10} 44" aria-hidden="true" focusable="false"><g fill="#8fa86a" stroke="#4c5926" stroke-width="1.2">${olives}</g></svg>
<div class="scale-bar" aria-hidden="true"></div>
<figcaption><span><b dir="ltr">140</b> ${big}</span><span>${small} <b dir="ltr">360</b></span></figcaption>
</figure>`;
}

/** One document's source: { title, html }. */
function documentHtml(locale, d) {
  const src = read(d.source(locale));
  const main = one(/<main[^>]*>([\s\S]*?)<\/main>/, src, `${d.source(locale)} <main>`);
  const title = inline(one(/<h1[^>]*>([\s\S]*?)<\/h1>/, main, `${d.slug} title`));
  const dateLine = one(/<\/h1>\s*<p class="text-muted-foreground mb-8">([\s\S]*?)<\/p>/, main, `${d.slug} date line`);
  const sections = [...main.matchAll(/<section class="(?:spec-card|profile-section)">([\s\S]*?)<\/section>/g)].map((m) => m[1]);
  if (!sections.length) fail(`${d.source(locale)} has no sections`);
  const tail = main.slice(main.lastIndexOf('</section>'));
  const closings = [...tail.matchAll(/<p class="text-sm text-muted-foreground mt-8">([\s\S]*?)<\/p>/g)]
    .map((m) => closing(m[1])).filter(Boolean);

  // The profile's Contact section repeats the masthead's address, email and
  // phone; in the PDF it stood alone on a last page (owner, 2026-10-14:
  // "approve all"). The web page keeps it.
  const shown = sections.filter((sec) => !(d.slug === 'company-profile' && /<h2[^>]*>\s*(Contact|تواصل معنا)\s*<\/h2>/.test(sec)));
  let flow = shown.map((s, i) => block(locale, s, { slug: d.slug, index: i })).join('\n') +
    closings.map((c) => `\n<div class="block closing"><p class="note">${c}</p></div>`).join('');
  flow = isolateNumbers(locale, flow);
  if (locale === 'en') flow = markInlineArabic(flow);
  const date = isolateNumbers(locale, dateLine);
  const pageOne = `<div class="cover">
${masthead(locale)}
<div class="cover-row">
<div class="doc-head"><h1>${title}</h1><p class="doc-date">${date}</p></div>
<div class="cover-photo"><img src="${COVER_PHOTO}" alt="${COVER_ALT[locale]}" width="800" height="800" /></div>
</div>
</div>`;

  return `<!DOCTYPE html>
<!-- Written by scripts/build-pdf-documents.js from ${d.source(locale)}. Do not edit: edit that file and rebuild. -->
<html lang="${locale}" dir="${T[locale].dir}">
<head>
<meta charset="UTF-8" />
<title>${title.replace(/<[^>]+>/g, '')} | ${T[locale].legal}</title>
<link rel="stylesheet" href="${FONTS}" />
<link rel="stylesheet" href="${DESIGN}" />
<link rel="stylesheet" href="${DOCUMENT_CSS}" />
</head>
<body>
<template id="page-one">${pageOne}</template>
<template id="page-next">${runningHead(locale, title)}</template>
<template id="page-foot">${foot(locale, date, 0, 0)}</template>
<template id="flow">
${flow}
</template>
<main id="pages"></main>
<script>
/*
 * The layout: the flow above, poured onto fixed A4 pages. A block that does
 * not fit splits between its items (the first part keeping the heading) or,
 * if not even its heading and first item fit, moves to the next page. An
 * item is never split. Runs again, from the start, whenever it is called:
 * the generator calls it once the PDF's own fonts are on.
 */
window.tcFit = () => {
  const tpl = (id) => document.getElementById(id).content;
  const pages = document.getElementById('pages');
  let body;
  const newPage = (first) => {
    const pg = document.createElement('section');
    pg.className = 'pdf-page doc-page';
    pg.appendChild(tpl(first ? 'page-one' : 'page-next').cloneNode(true));
    body = document.createElement('div');
    body.className = 'page-body';
    pg.appendChild(body);
    pg.appendChild(tpl('page-foot').cloneNode(true));
    pages.appendChild(pg);
  };
  // Content stops at least 3 mm (11px) above the foot's rule.
  const limit = () => body.parentElement.querySelector('.foot').getBoundingClientRect().top - 11;
  const fits = () => {
    const last = body.lastElementChild;
    return !last || last.getBoundingClientRect().bottom <= limit();
  };
  const layout = (breakBefore = -1) => {
    pages.textContent = '';
    const place = (blk) => {
      body.appendChild(blk);
      if (fits()) return;
      if (blk.classList.contains('keep') && body.children.length > 1) {
        blk.remove();
        newPage(false);
        body.appendChild(blk);
        return;
      }
      const head = blk.querySelector(':scope > h2');
      const items = [...blk.children].filter((c) => c !== head);
      blk.remove();
      const part = blk.cloneNode(false);
      if (head) part.appendChild(head);
      body.appendChild(part);
      let i = 0;
      for (; i < items.length; i++) {
        part.appendChild(items[i]);
        if (!fits()) { items[i].remove(); break; }
      }
      // A long list (class "long") that does not fit breaks between whole
      // points, at least two on each side; every other item moves whole.
      let broke = false;
      if (i < items.length) {
        const it = items[i];
        const ul = it.matches('ul.list.long') ? it : it.matches('.unit') ? it.querySelector(':scope > ul.list.long') : null;
        if (ul && ul.children.length >= 4) {
          const first = it.cloneNode(true);
          const firstUl = first.matches('ul') ? first : first.querySelector(':scope > ul');
          part.appendChild(first);
          // Leave at least two points for the next page, then take off more
          // until what stays fits, keeping at least two here.
          let k = ul.children.length;
          while (k > ul.children.length - 2) { firstUl.lastElementChild.remove(); k--; }
          while (k > 2 && !fits()) { firstUl.lastElementChild.remove(); k--; }
          if (fits() && ul.children.length - k >= 2) {
            const restUl = ul.cloneNode(false);
            restUl.classList.add('cont');
            [...ul.children].slice(k).forEach((li) => restUl.appendChild(li));
            items[i] = restUl;
            broke = true;
          } else first.remove();
        }
      }
      if (i === 0 && !broke) part.remove();
      if (i === items.length) return;
      const rest = blk.cloneNode(false);
      if (i === 0 && head && !broke) rest.appendChild(head); else rest.classList.add('cont');
      items.slice(i).forEach((it) => rest.appendChild(it));
      if (!body.children.length) { body.appendChild(rest); return; } // too tall for any page: the generator refuses it
      newPage(false);
      place(rest);
    };
    newPage(true);
    [...tpl('flow').cloneNode(true).children].forEach((blk, i) => {
      blk.dataset.i = i;
      if (i === breakBefore && body.children.length) newPage(false);
      place(blk);
    });
    // How full the last page is, from the top of its content to its foot.
    const top = body.getBoundingClientRect().top;
    const last = body.lastElementChild.getBoundingClientRect().bottom;
    return { count: pages.children.length, fill: (last - top) / (limit() - top) };
  };
  // One fixed type scale for every document (owner, 2026-10-13): a short
  // last page stays short rather than the type growing or shrinking to fill
  // it. Its fill is recorded for the report.
  //
  // No spacing is squeezed to save a page (owner, 2026-10-14: "a little bit
  // crowded"; the tighter-spacing pass that pulled a short last page back
  // was removed): room on the page comes before the page count.
  let result = layout();
  // A closing line never stands alone on the last page: the section before
  // it moves over to keep it company (it starts that page instead), as long
  // as that leaves something on the page it came from.
  const bodies = [...pages.querySelectorAll('.page-body')];
  const lastBody = bodies[bodies.length - 1];
  if (bodies.length > 1 && [...lastBody.children].every((c) => c.classList.contains('closing'))) {
    const prev = bodies[bodies.length - 2];
    const mover = prev.lastElementChild;
    if (mover && prev.children.length > 1 && mover.dataset.i !== undefined) result = layout(Number(mover.dataset.i));
  }
  document.documentElement.dataset.fill = result.fill.toFixed(2);
  const all = pages.querySelectorAll('.pdf-page');
  all.forEach((pg, n) => { pg.querySelector('.pageno').textContent = (n + 1) + ' / ' + all.length; });
};
window.tcFit();
</script>
</body>
</html>
`;
}

/** Every source this builder owns: { path, html }. */
function sources() {
  return DOCUMENTS.flatMap((d) => ['en', 'ar'].map((locale) => ({
    path: `${OUT_DIR}/${d.slug}-${locale}.html`, html: documentHtml(locale, d),
  })));
}

/*
 * Write the sources, or with check set, write nothing and fail (exit 1) if
 * any is out of date. scripts/check-pdf-sources.js calls run(true): until
 * 2026-10-13 it required this file expecting the --check flag to act, but
 * the block below only runs when this file is started directly, so the
 * check passed even when a source was stale.
 */
function run(check) {
  const stale = [];
  for (const s of sources()) {
    const file = path.join(ROOT, s.path);
    const now = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
    if (now === s.html) continue;
    if (check) { stale.push(s.path); continue; }
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, s.html);
    console.log(`wrote ${s.path}`);
  }
  if (check) {
    if (stale.length) {
      console.error(`pdf-sources FAILED -- out of date with the pages they are read from: ${stale.join(', ')}\n  run: node scripts/build-pdf-documents.js, then rebuild those PDFs`);
      process.exit(1);
    }
    console.log(`pdf-sources OK -- ${sources().length} source(s) match the pages they are read from.`);
  }
}

if (require.main === module) run(process.argv.includes('--check'));

module.exports = { DOCUMENTS, OUT_DIR, sources, documentHtml, run };
