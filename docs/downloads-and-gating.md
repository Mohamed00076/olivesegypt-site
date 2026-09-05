# Downloads and gating — Phase 8 verification

Verification pass, not a redesign. Findings first; the one that needs a
decision is §3.

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

## 3. The gate does not actually gate — decision needed

The three "gated" guides are ordinary static HTML pages at predictable URLs:

```
/downloads/buyers-guide            /ar/downloads/buyers-guide
/downloads/origin-comparison-guide /ar/downloads/origin-comparison-guide
/downloads/pricing-packaging-guide /ar/downloads/pricing-packaging-guide
```

The form does not unlock anything server-side. On a successful `POST /api/leads`
the client-side script simply sets the download link's `href` and unhides it
(`assets/gated-download.js`). The guide pages themselves check nothing — no
token, no referrer test, no session. **Anyone with the URL reads the guide
without ever filling the form**, and the URLs are guessable from the pattern.

The only thing standing between them and a search engine is six `Disallow`
lines in `robots.txt`, which is a crawling request, not access control — the
same distinction this project already applied to `/admin` and `/crm`.

This is not a security problem: the guides are marketing collateral, not
confidential data. It is a *measurement* problem — lead capture is optional in
practice, so the lead numbers understate real readership by an unknown amount.

Three honest options, for you to pick:

1. **Leave it.** Accept the gate as a prompt rather than a barrier. Cheapest,
   and arguably the right call for marketing collateral.
2. **Make it real.** Serve the guides through a function that requires a
   short-lived signed token issued by `/api/leads`. Roughly a day's work and
   it changes the URLs.
3. **Drop the gate.** Publish the guides and keep the form as an optional
   "send me updates" signup. Honest, and removes a friction point.

I have not changed this. It is a product decision, not a defect fix.

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
  promises one. That is a promise the site cannot currently keep.
- `leads_staging` has no retention policy. The analytics tables have a daily
  purge (`analytics-retention`, 395 days); leads have none.

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
