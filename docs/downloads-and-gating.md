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

- ~~The consent label does not link to the privacy policy~~ — it now links to
  both `/privacy` and `/unsubscribe` (Arabic to the Arabic pair). It still
  does not state a retention period in the label itself, because
  `leads_staging` still has no retention policy to state; the privacy page it
  links to says what is known.
- ~~There is no unsubscribe mechanism anywhere in the codebase, though the
  label promises one.~~ **Built 2026-09-05** — see §7.
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

## 7. The unsubscribe — built 2026-09-05

Every lead form carried "I can unsubscribe at any time" from the beginning
and nothing anywhere could honour it. There was no page, no endpoint and no
column. That is now the whole of what was built:

| | |
| --- | --- |
| Pages | `/unsubscribe`, `/ar/unsubscribe` — one field, one button, no confirmation step and no reason-picker |
| Endpoint | `POST /api/unsubscribe` → `netlify/functions/unsubscribe.js` |
| Tables | `contact_opt_outs` (current state, one row per address) and `contact_opt_out_events` (append-only trail) |
| Reachable from | the consent label on all 7 forms, the footer of all 76 content pages, and the privacy page's rights section |
| Enforcement helper | `isOptedOut(sql, email)` in `_optout_lib.js`, for whatever sends mail next |

### Three decisions worth stating plainly

**It is not email-verified.** Anyone can opt out any address from the public
form. The harm of an unwanted opt-out is that a sales email does not go out —
recoverable, visible in the events table, and reversible by an admin. The harm
of a verification step is that the promise is not honoured until the person
completes a second action, which is the defect this closes. There is also no
outbound mail to a lead's own address today, so a confirmation link could not
be delivered. Bulk abuse is bounded by an IP rate limit (20/hour).

**Opting someone back IN is admin-only.** That is the direction that could
undo a person's own choice, so the public endpoint refuses it. An admin can do
it for someone who says they never asked to be removed.

**A new consented submission lifts an earlier opt-out.** Someone who ticks the
consent box on a fresh request is asking to be contacted about that request.
Both facts stay in `contact_opt_out_events` — the site neither holds a stale
"do not contact" against a person actively asking for something, nor quietly
forgets they once opted out. The internal notification email says so when it
happens.

### What it does not do

It does not delete anything. An opt-out stops contact; it does not remove a
quotation, sample request or order, which are kept in order to do the work
that was asked for. The privacy page says this, and so does the unsubscribe
page itself.

### Verified by

`scripts/check-unsubscribe.js` (in `npm test`, 43 assertions) against an
in-memory store that actually holds rows, so an opt-out is written and read
back rather than merely "a statement was issued". It asserts the promise
resolves — every consent label links to a page that exists, in its own locale,
carrying a working form — as well as the endpoint's behaviour, including that
a person's address never reaches the logs.

Plus an end-to-end run through a real browser in both locales: the page
renders RTL correctly with no overflow at 390px, a malformed address is
refused by the browser, an address the browser lets through (`a@b`) is caught
by the script, a real submission reaches the store, the form closes afterwards,
the consent label's link loads the page, and `?email=` pre-fills the field
without ever opting anyone out on its own. 18/18.
