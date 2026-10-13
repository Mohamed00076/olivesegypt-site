'use strict';

/*
 * The parts every redesigned download shares (owner's PDF redesign brief,
 * 2026-10-12): the masthead, the foot, the small words the layout adds, and
 * the number handling for Arabic. The documents' builder
 * (scripts/build-pdf-documents.js) uses them; the spec sheets' builder will
 * too when it ships.
 *
 * The masthead and foot are live text. The only links in them, as in the
 * whole of every redesigned document, are the email address and the phone
 * number.
 */

const LOGO = '/assets/logo-BJ1TOn9V.png';
const FONTS = '/assets/fonts/fonts.css';
const DESIGN = '/scripts/pdf-design/sheet.css';
const EMAIL = 'sales@olivesegypt.com';
const PHONE = { href: '+201006045961', text: '+20 100 604 5961' };

const T = {
  en: {
    dir: 'ltr', page: 'Page',
    wordmark: 'TRIPLE COMPANY', tagline: 'for Industrial Development',
    address: ['Ouroba Square (<span class="ar-inline" lang="ar" dir="rtl">ميدان العروبة</span>), 5th Settlement,', 'New Cairo, Cairo, Egypt'],
    legal: 'Triple Company for Industrial Development',
  },
  ar: {
    dir: 'rtl', page: 'صفحة',
    wordmark: 'الشركة الثلاثية', tagline: 'للتنمية الصناعية',
    address: ['ميدان العروبة، التجمع الخامس،', 'القاهرة الجديدة، القاهرة، مصر'],
    legal: 'الشركة الثلاثية للتنمية الصناعية',
  },
};

function masthead(locale) {
  const t = T[locale];
  return `<header class="masthead">
  <div class="brand">
    <img src="${LOGO}" alt="" width="236" height="289" />
    <div><div class="wordmark">${t.wordmark}</div><div class="tagline">${t.tagline}</div></div>
  </div>
  <div class="contact">
    ${t.address.join('<br/>')}<br/>
    <span dir="ltr"><a href="mailto:${EMAIL}">${EMAIL}</a> &middot; <a href="tel:${PHONE.href}">${PHONE.text}</a></span>
  </div>
</header>`;
}

/*
 * The head of every page after the first: the logo and wordmark, small, and
 * the document's own title, over the same rule.
 */
function runningHead(locale, title) {
  const t = T[locale];
  return `<header class="run-head" aria-hidden="true">
  <div class="brand"><img src="${LOGO}" alt="" width="236" height="289" /><span class="wordmark">${t.wordmark}</span></div>
  <span class="run-title">${title}</span>
</header>`;
}

/** The foot: legal name, date line, page n / N, domain. */
function foot(locale, dateLine, n, total) {
  const t = T[locale];
  return `<footer class="foot"><span>${t.legal}</span><span>${dateLine}</span>` +
    `<span>${t.page} <span dir="ltr" class="pageno">${n} / ${total}</span></span><span>olivesegypt.com</span></footer>`;
}

/*
 * Numbers in Arabic text, isolated left to right. Unmarked, a range such as
 * "140-360" at the end of an Arabic sentence was laid out, and extracted, as
 * "360-140" (found in the Phase A proof). Only text outside a tag is touched,
 * and a number already inside <span dir="ltr"> is left as it is. In English
 * a range is only kept on one line.
 */
function isolateNumbers(locale, html) {
  if (locale !== 'ar') {
    return html.split(/(<[^>]+>)/).map((part) => (part.startsWith('<') ? part
      : part.replace(/\d+(?:[.,]\d+)?[–-]\d+(?:[.,]\d+)?%?/g, (n) => `<span class="nb">${n}</span>`))).join('');
  }
  // Elements open around each piece of text, and whether any is left to right.
  const open = [];
  return html.split(/(<[^>]+>)/).map((part) => {
    if (part.startsWith('<')) {
      const m = part.match(/^<(\/?)([a-z0-9]+)/i);
      if (m && !/\/>$/.test(part) && !/^(br|img)$/i.test(m[2])) {
        if (m[1]) open.pop(); else open.push(/\sdir="ltr"/.test(part));
      }
      return part;
    }
    return open.includes(true) ? part : part.replace(/\d[\d.,\/\u2013%-]*\d%?|\d%?/g, (n) => `<span dir="ltr">${n}</span>`);
  }).join('');
}

/*
 * Arabic inside an English document ("Ouroba Square (ميدان العروبة)"), set
 * in the face that keeps its words whole and in order when copied out
 * (guide-pdfs.js, 'TC Arabic Inline').
 */
function markInlineArabic(html) {
  return html.split(/(<[^>]+>)/).map((part) => (part.startsWith('<') ? part
    : part.replace(/[؀-ۿ]+(?:\s+[؀-ۿ]+)*/g, (s) => `<span class="ar-inline" lang="ar" dir="rtl">${s}</span>`))).join('');
}

module.exports = { LOGO, FONTS, DESIGN, EMAIL, PHONE, T, masthead, runningHead, foot, isolateNumbers, markInlineArabic };
