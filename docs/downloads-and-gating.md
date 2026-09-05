# Downloads and gating — Phase 8 verification

Originally a verification pass, not a redesign. §3 recorded the one finding
that needed an owner decision; that decision was taken on 2026-09-05 and §3
now records what was built instead. The remaining open items are in §4.

## 1. Parity — complete

Fifteen downloadable artefacts per locale, matched one for one:

| | English | Arabic |
| --- | --- | --- |
| Full catalogue PDF | `/downloads/triple-company-export-catalog-2026.pdf` | `…-2026-ar.pdf` |
| Print catalogue (all products) | `/catalog/print` | `/ar/catalog/print` |
| Per-product spec sheets | `/catalog/print?product=…` ×11 | `/ar/catalog/print?product=…` ×11 |
| Gated guides | 3 | 3 |

Both catalogue PDFs and both print catalogues are **public and ungated**, in
both languages, as required. The main catalogue is not gated, so it is not
being used as a workaround for the email problem.

The Arabic gated forms used to hand out the *English* guides — their
`data-guide-url` values pointed at `/downloads/…` — fixed in Phase 1. All six
guide pages exist and each locale now reaches its own.

## 2. PDF checks

| Check | English | Arabic |
| --- | --- | --- |
| Pages | 9 | 9 |
| Selectable text | yes (8,941 chars) | yes (8,153 chars) |
| Logo on every page | 9/9 | 9/9 |
| Version marker | "B2B Export Catalog · 2026 Edition" | "كتالوج التصدير للشركات (B2B) · إصدار 2026" |
| Removed claims (HACCP, 15+ years, tonnage, testimonials, "Olives Egypt", ISO) | none | none |
| Honest-disclosure phrasing carried through | 7 × "Confirmed during quotation" | 8 × "تُؤكَّد أثناء عرض السعر" + 3 × "ليست منتجًا مصنَّفًا بالعيار" |
| Placeholder wording | English, correct for an English document | Arabic, fixed in Phase 6 |

Content type is not set in `netlify.toml`; Netlify serves `.pdf` as
`application/pdf` from the extension, which is correct and needs no rule.

**Two known Arabic-PDF issues, both already reported and neither introduced
here:**

- The extractable text layer transposes lam-alef pairs, so copy-paste and
  in-PDF search return garbled Arabic even though the page *renders*
  correctly. The disclosure phrases above had to be verified on fragments
  ("السعر" ×10, "بالعيار" ×3) plus a rendered-image check, because a
  full-phrase text match fails for this reason alone. Cause is Chromium's
  print-to-PDF Arabic text layer, not the source HTML.
- No Latin-script legal name anywhere in the Arabic PDF.

**Neither PDF carries a revision date** beyond "2026 Edition" — no month, no
version number. For a document sent to buyers who may hold several copies over
time, that is worth adding. Not changed here.

## 3. The gate is now a real gate — resolved 2026-09-05

The owner chose option 2 below. What follows is what the section said before
the change, then what replaced it.

### What was wrong

The three "gated" guides were ordinary static HTML pages at predictable URLs:

```
/downloads/buyers-guide            /ar/downloads/buyers-guide
/downloads/origin-comparison-guide /ar/downloads/origin-comparison-guide
/downloads/pricing-packaging-guide /ar/downloads/pricing-packaging-guide
```

The form unlocked nothing server-side. On a successful `POST /api/leads` the
client script set the download link's `href` and unhid it
(`assets/gated-download.js`); the guide pages themselves checked nothing — no
token, no referrer test, no session. Anyone with the URL read the guide
without ever filling the form, and the URLs were guessable from the pattern.
The only thing standing between them and a search engine was six `Disallow`
lines in `robots.txt`, which is a crawling request, not access control.

Three options were offered: leave it, make it real, or drop the gate.

### What replaced it

**The pages are no longer in the published directory.** They moved to
`netlify/functions/_guides/{en,ar}/` and are bundled into the functions
package (`included_files` in `netlify.toml`). There is no static copy to
reach around the check — that is the part that matters, and it is why this is
a move rather than an added redirect.

`netlify/functions/guide.js` serves them. `netlify.toml` rewrites all twelve
paths (three guides × two locales × bare and trailing-slash) to it with
`force = true`.

**A visitor needs a signed token.** `POST /api/leads` issues two on success,
for one guide each:

| | Lifetime | Why |
| --- | --- | --- |
| `tc_guide` cookie | 24h | HttpOnly and Secure — cannot be copied out of the browser, so a longer window costs nothing |
| `?t=` on the link | 1h | Travels in a URL that can be pasted anywhere, so it dies quickly |

The URL token exists only so the gate does not break for anyone whose browser
blocks first-party cookies. Without it they would fill the form, be handed a
link, and be refused by it — which reads as a broken site rather than a gate.

**Tokens are signed with a key derived from `SESSION_SECRET`, not with
`SESSION_SECRET` itself.** Admin and CRM sessions (`_lib.js signSession`) use
the raw secret with the same HMAC-SHA256 and the same `payload.signature`
shape, so without the derivation a guide token and an admin session token
would have been structurally interchangeable.

**It fails closed.** With no `SESSION_SECRET` the function serves 503 and
logs why, rather than reverting to the old ungated behaviour. A lead
submitted in that state is still saved — the visitor's submission is not the
thing that failed — it just does not unlock anything.

**Refusals are a page, not a status line.** A stale or wrong token gets a 403
carrying a short bilingual notice and a link back to `/downloads`, because
the most likely visitor holding one is a real buyer whose hour ran out.

Also added, since the publish directory is the repo root: a `404` rule for
`/netlify/*`, so the function sources themselves — including `_guides/` — are
not served as static files.

### What this does and does not buy

Lead capture is now compulsory rather than optional, so the lead numbers stop
understating readership. It is not confidentiality: someone who fills the form
can still forward what they downloaded, and a URL token is shareable for an
hour. That was never the goal — these are marketing collateral, and the
problem being fixed was measurement.

### Verified by

`scripts/check-guide-gate.js` (in `npm test`, 35 assertions), which runs
offline with the database driver stubbed. It covers the refusals rather than
just the happy path: no token, a token for a *different* guide, an expired
token, a tampered signature, a tampered payload, an admin session token
presented as a guide token, and a missing `SESSION_SECRET`. It also asserts
no static copy has reappeared in the publish root and that all twelve
rewrites carry `force = true`.

## 4. Consent and retention

The consent checkbox is `required` and its label reads, in both locales:

> "I agree to be contacted about this request and understand I can unsubscribe
> at any time." / "أوافق على التواصل معي بخصوص هذا الطلب، وأدرك أنه يمكنني
> إلغاء الاشتراك في أي وقت."

Equivalent wording, and the consent value is stored with the row.

**Gaps:**

- The consent label does not link to the privacy policy, and does not say how
  long the data is kept. `/privacy` and `/ar/privacy` both exist.
- There is no unsubscribe mechanism anywhere in the codebase, though the label
  promises one. That is a promise the site cannot currently keep. **Still
  open as of 2026-09-05** — it needs a decision about where the promise
  should be met (a real unsubscribe endpoint, or a reply-to address named in
  the label), not just a code change.
- `leads_staging` has no retention policy. The analytics tables have a daily
  purge (`analytics-retention`, 395 days); leads have none. Still open — note
  that the analytics purge itself gained a floor, a per-run cap, a dry-run
  mode and an audit row on 2026-09-05, so any leads policy modelled on it
  should copy those guards rather than the shape it had before.

## 5. Duplicate handling and rate limiting

`leads.js` rate-limits by IP **or** email over a rolling window and returns 429,
which `gated-download.js` surfaces in the right language. There is no
deduplication beyond that: the same person requesting two different guides
creates two rows, which is correct, but the same person re-requesting the same
guide after the window also creates another row.

## 6. Sitemap and robots — clean

Cross-checked all 68 sitemap URLs against all 18 `Disallow` rules and against
every page's own `<meta name="robots">`:

- URLs both in the sitemap and disallowed: **0**
- URLs in the sitemap carrying `noindex`: **0**

(The eight "guide" matches in `sitemap.xml` are the public
`/media/olive-export-packaging-guide` article, not the gated guides.)
