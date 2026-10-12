# Downloadable PDFs — redesign (A4, no buttons)

Owner's brief of 2026-10-12. Phased: A (inventory and one spec sheet), B (all
spec sheets and the combined files), C (catalogue, company profile, Pricing &
Packaging Guide and the other guides), D (verification and the deployment
request). Each phase is its own branch and PR, and stops for approval.

## Phase A — inventory (before any change)

36 PDFs, all A4 (595 × 842 pt), all printed with headless Chromium:

- **Spec sheets, combined file and product catalogue:** printed from the web page `catalog/print`.
- **Company profile:** printed from its web page.
- **Seven gated guides:** printed from `netlify/functions/_guides/<locale>/*.html`.
- **Gated export catalogue:** printed from `scripts/export-catalog-source(-ar).html`.

The job list is `scripts/guide-pdfs.js`; fingerprints are in `scripts/guide-pdfs.json`.

None is tagged. None sets a language. None has bookmarks.

| File | Source | KB | Pages | "Request a Quote" | Other links |
|---|---|---|---|---|---|
| `ar/downloads/company-profile-ar.pdf` | (ar/)company-profile page | 164 | 2 | — | /ar/catalog |
| `ar/downloads/product-catalog-ar.pdf` | (ar/)catalog/print | 579 | 2 | yes | /ar/contact |
| `ar/downloads/spec-sheets/all-spec-sheets-ar.pdf` | catalog/print `?product=all` | 671 | 7 | yes | /ar/contact |
| `ar/downloads/spec-sheets/green-olives-ar.pdf` | catalog/print `?product=<key>` | 188 | 1 | yes | /ar/contact |
| `ar/downloads/spec-sheets/marinated-artichoke-hearts-ar.pdf` | catalog/print `?product=<key>` | 145 | 1 | yes | /ar/contact |
| `ar/downloads/spec-sheets/natural-black-olives-ar.pdf` | catalog/print `?product=<key>` | 148 | 1 | yes | /ar/contact |
| `ar/downloads/spec-sheets/oxidized-black-olives-ar.pdf` | catalog/print `?product=<key>` | 303 | 1 | yes | /ar/contact |
| `ar/downloads/spec-sheets/pepperoncini-peppers-ar.pdf` | catalog/print `?product=<key>` | 142 | 1 | yes | /ar/contact |
| `ar/downloads/spec-sheets/sliced-jalapeno-peppers-ar.pdf` | catalog/print `?product=<key>` | 373 | 1 | yes | /ar/contact |
| `ar/downloads/spec-sheets/stuffed-green-olives-ar.pdf` | catalog/print `?product=<key>` | 148 | 1 | yes | /ar/contact |
| `downloads/company-profile-en.pdf` | (ar/)company-profile page | 116 | 2 | — | /catalog |
| `downloads/product-catalog-en.pdf` | (ar/)catalog/print | 546 | 2 | yes | /contact |
| `downloads/spec-sheets/all-spec-sheets-en.pdf` | catalog/print `?product=all` | 611 | 7 | yes | /contact |
| `downloads/spec-sheets/green-olives-en.pdf` | catalog/print `?product=<key>` | 153 | 1 | yes | /contact |
| `downloads/spec-sheets/marinated-artichoke-hearts-en.pdf` | catalog/print `?product=<key>` | 106 | 1 | yes | /contact |
| `downloads/spec-sheets/natural-black-olives-en.pdf` | catalog/print `?product=<key>` | 115 | 1 | yes | /contact |
| `downloads/spec-sheets/oxidized-black-olives-en.pdf` | catalog/print `?product=<key>` | 267 | 1 | yes | /contact |
| `downloads/spec-sheets/pepperoncini-peppers-en.pdf` | catalog/print `?product=<key>` | 105 | 1 | yes | /contact |
| `downloads/spec-sheets/sliced-jalapeno-peppers-en.pdf` | catalog/print `?product=<key>` | 335 | 1 | yes | /contact |
| `downloads/spec-sheets/stuffed-green-olives-en.pdf` | catalog/print `?product=<key>` | 113 | 1 | yes | /contact |
| `netlify/functions/_guides/ar/buyers-guide.pdf` | _guides/ar/buyers-guide.html | 146 | 2 | yes | /ar/contact, /ar/sample |
| `netlify/functions/_guides/ar/company-overview.pdf` | _guides/ar/company-overview.html | 137 | 2 | — | /ar/resources/certifications |
| `netlify/functions/_guides/ar/export-catalog.pdf` | scripts/export-catalog-source(-ar).html | 722 | 9 | yes | — |
| `netlify/functions/_guides/ar/export-documentation-checklist.pdf` | _guides/ar/export-documentation-checklist.html | 127 | 2 | yes | /ar/contact |
| `netlify/functions/_guides/ar/origin-comparison-guide.pdf` | _guides/ar/origin-comparison-guide.html | 133 | 1 | yes | /ar/sample, /ar/contact |
| `netlify/functions/_guides/ar/packaging-overview.pdf` | _guides/ar/packaging-overview.html | 124 | 1 | yes | /ar/contact |
| `netlify/functions/_guides/ar/pricing-packaging-guide.pdf` | _guides/ar/pricing-packaging-guide.html | 145 | 2 | yes | /ar/contact |
| `netlify/functions/_guides/ar/private-label-brochure.pdf` | _guides/ar/private-label-brochure.html | 136 | 2 | — | /ar/resources/private-label |
| `netlify/functions/_guides/en/buyers-guide.pdf` | _guides/en/buyers-guide.html | 100 | 2 | yes | /contact, /sample |
| `netlify/functions/_guides/en/company-overview.pdf` | _guides/en/company-overview.html | 96 | 2 | — | /resources/certifications |
| `netlify/functions/_guides/en/export-catalog.pdf` | scripts/export-catalog-source(-ar).html | 623 | 9 | yes | — |
| `netlify/functions/_guides/en/export-documentation-checklist.pdf` | _guides/en/export-documentation-checklist.html | 93 | 2 | — | /contact |
| `netlify/functions/_guides/en/origin-comparison-guide.pdf` | _guides/en/origin-comparison-guide.html | 96 | 2 | yes | /sample, /contact |
| `netlify/functions/_guides/en/packaging-overview.pdf` | _guides/en/packaging-overview.html | 89 | 1 | yes | /contact |
| `netlify/functions/_guides/en/pricing-packaging-guide.pdf` | _guides/en/pricing-packaging-guide.html | 98 | 2 | yes | /contact |
| `netlify/functions/_guides/en/private-label-brochure.pdf` | _guides/en/private-label-brochure.html | 96 | 2 | — | /resources/private-label |

### Findings that the redesign fixes

- **"pH" prints as "PH"** on every spec sheet: the label is uppercased by CSS.
- **The masthead tagline extracts letter by letter** ("F O R I N D U S T R I A L …"): it is tracked 0.18em.
- **The English masthead's "(ميدان العروبة)" extracts reversed** ("(العروبة ميدان)").
- **A system font fallback:** DejaVu Sans is embedded in 34 of 36 files.
- **Space Mono** is still embedded in eight spec-sheet files, though the site dropped it.
- **The Arabic caliber range reverses:** "الأعيرة 140-360." extracts, and is laid out, as ".360-140". This is in the spec sheets and, from the same unmarked text, on `/ar/catalog/print` too (pre-existing).

### The three market lines (decision 4: kept as worded; C-163 to C-165)

- **Stuffed "for European retail":**
  - Pages: `/catalog`, `/catalog/print`, `/downloads`, `/`.
  - PDFs: the stuffed sheet, the combined sheets, the product catalogue and the export catalogue.
  - Arabic twins of all of these.
- **Pepperoncini "in strong demand across European and North American retail":** the same pages, and the pepperoncini, combined, product-catalogue and export-catalogue PDFs.
- **Jalapeño "A high-demand food-service line":** the same pages, and the jalapeño, combined, product-catalogue and export-catalogue PDFs. pdftotext splits it as "food-\nservice".

### Text the PDFs share with web pages (decision 3e)

- **USD / exchange-rate sentence:**
  - Pricing guide (EN, AR).
  - `/resources/pricing` (EN, AR).
  - `/media/egyptian-olive-prices-2026` (EN and AR, reworded).
- **"Premium end … better value" sentences:** the same three places. The Arabic pricing guide carries only the "better value" half.
- **Caliber sentence ("101/110 to 181/200 … 201/230 and above"):**
  - Pricing guide and **Packaging Overview guide** (EN, AR).
  - `/resources/packaging` (EN, AR), including its caliber chart.
  - `/solutions/retail` and `/solutions/food-service` (EN, AR, and `scripts/generate-solutions-pages.py`).

  These are wider than the two pages the brief names; listed for approval in Phase C.

### Numerals and fonts in the Arabic PDFs

- **Numerals:** Western digits (0–9) throughout, as on the site. The one exception is the Arabic private-label brochure, which has six Arabic-Indic digits (٠–٩). Western digits are kept, and the brochure is flagged, **for the owner's native review**.
- **Fonts:** Amiri Regular and Bold for Arabic (mapped over every family), Plus Jakarta Sans and Playfair Display (static instances) for Latin and numbers. Unchanged by the redesign.

### Where the Pricing & Packaging Guide's title or file name appears (decision 3d)

Not renamed. Awaiting approval of this list and of a new title.

| Where | What |
|---|---|
| `netlify/functions/_guides/en/pricing-packaging-guide.html` | `<title>`, H1 "Egyptian Table Olive Pricing & Packaging Guide", breadcrumb "Pricing & Packaging Guide", canonical / hreflang / og:url |
| `netlify/functions/_guides/ar/pricing-packaging-guide.html` | `<title>`, H1 «دليل تسعير وتغليف زيتون المائدة المصري», breadcrumb «دليل التسعير والتغليف», canonical / hreflang |
| PDF metadata (both) | Title = the `<title>` above |
| `/downloads/` | card heading "Pricing & Packaging Guide"; form `data-gated-download="pricing_guide"`, `data-guide-url="/downloads/pricing-packaging-guide"` |
| `/ar/downloads/` | card heading «دليل التسعير والتغليف»; same form attributes |
| `netlify.toml` | four redirects (`/downloads/pricing-packaging-guide`, with and without `/`, both locales) |
| `robots.txt` | two `Disallow` lines |
| `netlify/functions/_guide_token.js` | `pricing_guide: 'pricing-packaging-guide'` |
| `netlify/functions/leads.js` | segment `pricing_guide` ("guide download") |
| `crm/inquiries/` | label "Pricing guide download" |
| Analytics | `generate_lead` with `form_name: guide_download`, `lead_type: pricing_guide` (the key, not the title) |
| `scripts/guide-pdfs.js`, `guide-pdfs.json`, `locale-routes.js`, `check-guide-gate.js`, `export-catalog-source-ar.html` (comment) | slug |
| `llms.txt`, `sitemap.xml` | not listed (gated) |

## Phase A — one spec sheet: Green Olives, English and Arabic

- **Builder:** `scripts/build-pdf-sources.js` reads the sheet's every sentence and figure from `catalog/print` (`ar/catalog/print`) and writes `scripts/pdf-sources/spec-sheets/green-olives-<locale>.html`.
- **Design:** `scripts/pdf-design/sheet.css` sets the design for downloads only.
- **Printing:** the existing generator prints it as fixed A4 pages (kind `sheet`).
- **Checks:**
  - `check-pdf-sources.js` fails if the sheet drifts from the catalogue.
  - The generator refuses a sheet whose content reaches its foot.
- **Picture:** the homepage's green-olives photograph (owner, 2026-10-12), 800 × 800, about 400 ppi at 50 mm.
- **Unchanged:**
  - the other six sheets
  - the shared letterhead used by quotations, invoices and letters
  - file URLs and the Downloads pages
