'use strict';

/*
 * Serves the three gated guides, in both locales, and only to a visitor
 * holding a valid token from POST /api/leads.
 *
 * The guide HTML no longer sits in the published directory at all -- it
 * lives in _guides/ inside the functions bundle, so there is no static
 * copy for anyone to reach around this check. netlify.toml rewrites the
 * six guide routes here with force = true.
 *
 * A token arrives either in the tc_guide cookie (preferred) or as ?t= on
 * the URL (the fallback for browsers that refuse first-party cookies --
 * see _guide_token.js for why both exist). Either one must name the same
 * guide that is being requested.
 *
 * Refusals are a 403 carrying a real page in the visitor's language, not
 * a bare status line: someone who lands on a stale link deserves to know
 * the guide still exists and how to get it, and search engines already
 * ignore these routes (noindex + robots.txt Disallow).
 */

const fs = require('fs');
const path = require('path');
const { parseCookies } = require('./_lib');
const { GUIDES, COOKIE_NAME, verifyGuideToken } = require('./_guide_token');

// route slug -> the segment whose token opens it
const SLUG_TO_SEGMENT = Object.fromEntries(
  Object.entries(GUIDES).map(([segment, slug]) => [slug, segment])
);

const TEXT = {
  en: {
    lang: 'en', dir: 'ltr',
    title: 'Guide not unlocked',
    heading: 'This guide opens after you request it',
    body: 'Request the guide on the downloads page and it will open straight away. Links expire after a while, so an older one may simply have timed out.',
    cta: 'Go to Downloads & Documents',
    href: '/downloads',
    unavailable: 'This guide is temporarily unavailable. Please email sales@olivesegypt.com and we will send it to you directly.',
  },
  ar: {
    lang: 'ar', dir: 'rtl',
    title: 'الدليل غير مُتاح بعد',
    heading: 'يُفتح هذا الدليل بعد طلبه',
    body: 'اطلب الدليل من صفحة التنزيلات وسيُفتح مباشرة. تنتهي صلاحية الروابط بعد فترة، لذا قد يكون الرابط القديم قد انتهت مدته فحسب.',
    cta: 'الانتقال إلى التنزيلات والوثائق',
    href: '/ar/downloads',
    unavailable: 'هذا الدليل غير متاح مؤقتًا. يرجى مراسلتنا على sales@olivesegypt.com وسنرسله إليك مباشرة.',
  },
};

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function noticePage(locale, message, ctaVisible) {
  const t = TEXT[locale] || TEXT.en;
  const rtl = locale === 'ar' ? '<link rel="stylesheet" href="/assets/rtl.css">' : '';
  return `<!DOCTYPE html>
<html lang="${t.lang}" dir="${t.dir}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow">
<title>${esc(t.title)} | Triple Company for Industrial Development</title>
<link rel="icon" type="image/x-icon" href="/favicon.ico">
<link rel="stylesheet" crossorigin href="/assets/index-Dw0yUE42.css">
${rtl}
</head>
<body>
<main class="container mx-auto px-4 py-16 max-w-screen-sm text-center">
<h1 class="font-serif text-2xl font-bold text-primary mb-4">${esc(t.heading)}</h1>
<p class="text-muted-foreground mb-8">${esc(message)}</p>
${ctaVisible ? `<a href="${t.href}" class="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground">${esc(t.cta)}</a>` : ''}
</main>
</body>
</html>`;
}

function htmlResponse(statusCode, body, extraHeaders) {
  return {
    statusCode,
    headers: Object.assign(
      {
        'Content-Type': 'text/html; charset=utf-8',
        // Never let a shared cache hold a guide that was handed out
        // against one visitor's token.
        'Cache-Control': 'private, no-store, max-age=0',
        'X-Robots-Tag': 'noindex, nofollow',
      },
      extraHeaders || {}
    ),
    body,
  };
}

/*
 * The requested path is the source of truth for which guide and which
 * locale. Netlify passes the original path through on a 200 rewrite; the
 * ?g= parameter the rewrite rules also set is only a fallback for the
 * case where that ever stops being true.
 */
function resolveRequest(event) {
  const qs = event.queryStringParameters || {};
  const raw = String(event.path || '').replace(/\/+$/, '');
  const locale = /^\/ar(\/|$)/.test(raw) ? 'ar' : 'en';
  const slug = raw.split('/').filter(Boolean).pop() || '';
  const segment = SLUG_TO_SEGMENT[slug] || (GUIDES[qs.g] ? qs.g : null);
  return { locale, segment };
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET' && event.httpMethod !== 'HEAD') {
    return { statusCode: 405, headers: { Allow: 'GET, HEAD' }, body: 'Method not allowed' };
  }

  const { locale, segment } = resolveRequest(event);
  const t = TEXT[locale];

  if (!segment) {
    return htmlResponse(404, noticePage(locale, t.body, true));
  }

  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    // Fail closed. A gate that opens itself when it is misconfigured is
    // the bug this whole change exists to remove -- so the guide stops
    // being served and the log says why, loudly, rather than quietly
    // reverting to the old ungated behaviour.
    console.error('[guide] SESSION_SECRET is not set -- guides cannot be unlocked. Refusing to serve ungated.');
    return htmlResponse(503, noticePage(locale, t.unavailable, false));
  }

  const qs = event.queryStringParameters || {};
  const fromCookie = parseCookies(event.headers)[COOKIE_NAME];
  const granted = verifyGuideToken(fromCookie, secret) || verifyGuideToken(qs.t, secret);

  if (granted !== segment) {
    return htmlResponse(403, noticePage(locale, t.body, true));
  }

  const file = path.join(__dirname, '_guides', locale, `${GUIDES[segment]}.html`);
  let html;
  try {
    html = fs.readFileSync(file, 'utf8');
  } catch (err) {
    console.error('[guide] could not read', file, err?.message ?? err);
    return htmlResponse(500, noticePage(locale, t.unavailable, false));
  }

  return htmlResponse(200, event.httpMethod === 'HEAD' ? '' : html);
};
