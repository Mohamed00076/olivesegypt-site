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
 * The cover's olive branch: a line drawing in the site's olive and gold
 * (the product illustrations' palette), decoration only -- no words, hidden
 * from screen readers, and mirrored in Arabic by the stylesheet.
 */
const BRANCH = `<svg class="cover-art" viewBox="0 0 240 150" aria-hidden="true" focusable="false">
  <path d="M8,138 C60,118 110,92 150,60 C178,38 204,22 234,12" stroke="#c9a84c" stroke-width="2.6" fill="none" stroke-linecap="round"/>
  <g fill="#8fa86a">
    <ellipse cx="44" cy="112" rx="20" ry="5.5" transform="rotate(-38 44 112)"/>
    <ellipse cx="62" cy="132" rx="20" ry="5.5" transform="rotate(12 62 132)"/>
    <ellipse cx="92" cy="86" rx="21" ry="5.5" transform="rotate(-52 92 86)"/>
    <ellipse cx="118" cy="104" rx="20" ry="5.5" transform="rotate(4 118 104)"/>
    <ellipse cx="146" cy="44" rx="20" ry="5.5" transform="rotate(-60 146 44)"/>
    <ellipse cx="176" cy="62" rx="20" ry="5.5" transform="rotate(-6 176 62)"/>
    <ellipse cx="200" cy="14" rx="18" ry="5" transform="rotate(-28 200 14)"/>
    <ellipse cx="218" cy="36" rx="17" ry="5" transform="rotate(14 218 36)"/>
  </g>
  <g>
    <ellipse cx="100" cy="118" rx="9" ry="11.5" fill="#b9c77a" transform="rotate(-14 100 118)"/>
    <ellipse cx="160" cy="80" rx="9" ry="11.5" fill="#a3b665" transform="rotate(10 160 80)"/>
    <ellipse cx="186" cy="40" rx="8" ry="10.5" fill="#c3cf86" transform="rotate(-8 186 40)"/>
  </g>
</svg>`;

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
function block(locale, html) {
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
        items.push(`<div class="unit">${p}${list(els[i + 1])}</div>`);
        i++;
      } else items.push(p);
      continue;
    }
    if (el.tag === 'ul') { items.push(list(el)); continue; }
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
function list(el) {
  const lis = children(el.inner).filter((c) => c.tag === 'li');
  if (hasClass(el, 'driver-cards')) {
    return `<div class="cards">${lis.map((li) => {
      const m = li.inner.match(/^\s*<strong[^>]*>([\s\S]*?)<\/strong>\s*([\s\S]*)$/);
      if (!m) fail('a price driver has no title');
      return `<div class="card"><h3>${inline(m[1]).replace(/[.:]\s*$/, '')}</h3><p>${inline(m[2])}</p></div>`;
    }).join('')}</div>`;
  }
  const cls = /grid-cols-2/.test(el.attrs) ? 'list cols-2' : 'list';
  return `<ul class="${cls}">${lis.map((li) => `<li>${inline(li.inner)}</li>`).join('')}</ul>`;
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
  return `<table class="spec doc-table">${inline(clean)}</table>`;
}

/** One document's source: { title, html }. */
function documentHtml(locale, d) {
  const src = read(d.source(locale));
  const main = one(/<main[^>]*>([\s\S]*?)<\/main>/, src, `${d.source(locale)} <main>`);
  const title = inline(one(/<h1[^>]*>([\s\S]*?)<\/h1>/, main, `${d.slug} title`));
  const dateLine = one(/<\/h1>\s*<p class="text-muted-foreground mb-8">([^<]*)<\/p>/, main, `${d.slug} date line`);
  const sections = [...main.matchAll(/<section class="(?:spec-card|profile-section)">([\s\S]*?)<\/section>/g)].map((m) => m[1]);
  if (!sections.length) fail(`${d.source(locale)} has no sections`);
  const tail = main.slice(main.lastIndexOf('</section>'));
  const closings = [...tail.matchAll(/<p class="text-sm text-muted-foreground mt-8">([\s\S]*?)<\/p>/g)]
    .map((m) => closing(m[1])).filter(Boolean);

  let flow = sections.map((s) => block(locale, s)).join('\n') +
    closings.map((c) => `\n<div class="block closing"><p class="note">${c}</p></div>`).join('');
  flow = isolateNumbers(locale, flow);
  if (locale === 'en') flow = markInlineArabic(flow);
  const date = isolateNumbers(locale, dateLine);
  const pageOne = `<div class="cover">
${masthead(locale)}
<div class="doc-head"><h1>${title}</h1><p class="doc-date">${date}</p></div>
${BRANCH}
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
  const limit = () => body.parentElement.querySelector('.foot').getBoundingClientRect().top - 2;
  const fits = () => {
    const last = body.lastElementChild;
    return !last || last.getBoundingClientRect().bottom <= limit();
  };
  const layout = () => {
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
      if (i === 0) part.remove();
      if (i === items.length) return;
      const rest = blk.cloneNode(false);
      if (i === 0 && head) rest.appendChild(head); else rest.classList.add('cont');
      items.slice(i).forEach((it) => rest.appendChild(it));
      if (!body.children.length) { body.appendChild(rest); return; } // too tall for any page: the generator refuses it
      newPage(false);
      place(rest);
    };
    newPage(true);
    for (const blk of [...tpl('flow').cloneNode(true).children]) place(blk);
    // How full the last page is, from the top of its content to its foot.
    const top = body.getBoundingClientRect().top;
    const last = body.lastElementChild.getBoundingClientRect().bottom;
    return { count: pages.children.length, fill: (last - top) / (limit() - top) };
  };
  // One fixed type scale for every document (owner, 2026-10-13): a short
  // last page stays short rather than the type growing or shrinking to fill
  // it. Its fill is recorded for the report.
  //
  // One exception (owner, 2026-10-13): a document whose last page holds only
  // a few lines (under a quarter of the page) is laid out again with tighter
  // spacing between sections and items -- the type is never resized -- and
  // kept that way only if that removes the page.
  pages.classList.remove('tight');
  let result = layout();
  if (result.count > 1 && result.fill < 0.25) {
    const before = result.count;
    pages.classList.add('tight');
    result = layout();
    if (result.count >= before) { pages.classList.remove('tight'); result = layout(); }
  }
  document.documentElement.dataset.fill = result.fill.toFixed(2);
  document.documentElement.dataset.tight = pages.classList.contains('tight') ? '1' : '0';
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

if (require.main === module) {
  const check = process.argv.includes('--check');
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

module.exports = { DOCUMENTS, OUT_DIR, sources, documentHtml };
