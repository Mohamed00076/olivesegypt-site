# Email addresses and vCards: inventory and proposal (Step 1, read-only)

Internal. `docs/` is removed from every deploy. Taken on `main` at `5e30e45`, 2026-10-27.
Environment variable **names** only; no values.

## 1. What is in the repository today

| Address | Where | Count |
|---|---|---|
| `sales@olivesegypt.com` | 127 files: 49 English and 48 Arabic pages, 18 PDF sources, 3 browser scripts, 1 function, 4 generators or scripts, the CRM document page, the company vCard, the register and the deployment record | 197 |
| `info@olivesegypt.com` | `scripts/send-test-email.js`, an example in a comment | 2 |
| `inquiries@olivesegypt.com` | `README.md`, an example value for `NOTIFY_FROM_EMAIL` (no such mailbox) | 1 |
| `s@olivesegypt.com` | `scripts/check-email-lib.js`, a test fixture | 2 |
| `mohamed@`, `legal@`, `noreply@`, `contact@`, `admin@` | nowhere | 0 |

All 36 tracked PDFs carry only `sales@olivesegypt.com` (40 times in their text layers), in their contact lines.

### Occurrences on the pages, by context

| Context | Count | Class |
|---|---|---|
| Footer, every public page (English and Arabic) | 96 | public contact |
| Body text: contact page, business card, company profile, letterhead | 12 | public contact; document/letterhead |
| Privacy pages: "Contact email" row | 2 | public contact |
| Privacy pages: "Privacy request channel" row and the rights paragraph (mailto + text) | 6 | **privacy contact** |
| Unsubscribe pages: "if you want your data deleted, email…" | 2 | **privacy contact** |
| Unsubscribe pages: "if someone unsubscribed you by mistake, email…" | 2 | public contact |
| Accessibility statement: "email … or message us on WhatsApp" (mailto + text) | 4 | public contact (feedback) |
| Organization structured data on `/` | 1 | structured data |
| Letterhead page heads (print CSS footer line) | 2 | document/letterhead |
| 18 PDF sources: guides, company profile and export catalogue contact lines | 36 | document |

### Scripts, functions and assets

| File | What | Class |
|---|---|---|
| `assets/inquiry-form.js` | error messages "email sales@ directly" (EN, AR) | public contact |
| `assets/gated-download.js` | the same, for guide downloads | public contact |
| `assets/unsubscribe.js` | "email sales@ and we will remove you by hand" and two more (EN, AR) | privacy contact |
| `netlify/functions/guide.js` | "this guide is temporarily unavailable, email sales@" (EN, AR) | public contact |
| `scripts/guide-pdfs.js` (`CONTACT_LINE`), `scripts/pdf-design/parts.js` (`EMAIL`), `scripts/generate-product-pages.py` (footer) | generators | document / public contact |
| `crm/document/view/index.html` | the document footer line and contact block | document (issued documents are records) |
| `assets/triple-company.vcf` | the company card | vCard |
| `scripts/check-email-lib.js`, `scripts/send-test-email.js`, `README.md` | examples and fixtures | test fixture |
| `docs/claim-and-evidence-register.csv`, `docs/deployment-record.md` | history | history record (never changed) |

### Email environment variables (names only)

`NOTIFY_EMAIL` (recipients of form notifications), `NOTIFY_FROM_EMAIL` (sender; unset means Resend's sandbox sender), `LEADS_NOTIFY` (guide-download notifications on or off), `NOTIFY_DRY_RUN`, `RESEND_API_KEY`, `EMAIL_EVERY_MS` (throttle). `GSC_SERVICE_ACCOUNT_EMAIL` is Search Console's, not mail.

Reply-To on form notifications is the enquirer's own address (`docs/email-delivery.md` §1). The CRM password reset goes to the user's own address.

## 2. Proposed address by page type (role map; owner confirms)

| Where | Current | Proposed | Reason |
|---|---|---|---|
| Footers (96 pages), contact page, business card, letterheads, company profile, catalogues, guides and PDFs, form error messages, guide-unavailable message, CRM documents | sales@ | **sales@ (unchanged)** | buyer-facing commercial |
| Organization structured data on `/` | sales@ | **sales@ (unchanged)** | the single structured-data email; buyers are the audience |
| Privacy pages: "Contact email" row (EN, AR) | sales@ | sales@ (unchanged) | it names the general contact |
| Privacy pages: "Privacy request channel" row and the rights paragraph (EN, AR; PT on #454) | sales@ | **legal@** | privacy and data requests |
| Unsubscribe pages: "if you want your data deleted" (EN, AR) | sales@ | **legal@** | a data request |
| Unsubscribe pages: "unsubscribed by mistake" (EN, AR) | sales@ | sales@ (unchanged) | restoring commercial contact |
| `assets/unsubscribe.js` "remove you by hand" messages (EN, AR) | sales@ | **legal@** (owner's call: sales@ is watched more often) | an opt-out request |
| Accessibility statement (EN, AR) | sales@ | **info@** | general feedback |
| Media inquiries page | (footer only) | unchanged | adding info@ to its text would be new copy; owner's call |
| README example sender | inquiries@ | `noreply@olivesegypt.com` (example only) | no inquiries@ mailbox exists |
| Register, deployment record, issued CRM documents | sales@ | **never changed** | history records |

Pages touched: 2 privacy, 2 unsubscribe, 2 accessibility, plus `unsubscribe.js` and the Portuguese privacy page on #454. **No PDF changes**, because no PDF carries a privacy or accessibility address. So there's no reprint and no Arabic text-layer check for this change.

## 3. mohamed@

It appears nowhere in the repository. No public page, PDF or structured data shows it. Its only planned public use is his vCard, after his agreement (§7).

## 4. One source of truth and a guard (proposal)

- `scripts/contacts.js`: `SALES`, `INFO`, `LEGAL`, `PRIVACY_CONTACT = LEGAL` (the one-line switch back to `SALES`), `MOHAMED`.
- The pages are static HTML, so each role-bound address is marked (`data-contact="privacy"` / `"accessibility"`). `node scripts/check-contacts.js --write` rewrites the marked ones from the constants, the way `check-sitemap-lastmod.js --write` sets dates.
- `check-contacts.js` (in `npm test`) fails if:
  - an address on any page, script or PDF source (EN, AR, PT) is not in the approved set;
  - a marked address doesn't match its role's constant;
  - the structured data carries anything but `SALES`;
  - mohamed@ appears anywhere public. `check-vcards.js` already enforces that last rule.

## 5. Netlify and the mail host (owner's side, names only)

- **Mail host:** create `legal@`; confirm `info@` is read.
- **Netlify:** `NOTIFY_EMAIL` decides who gets form notifications (add or route mohamed@ there if wanted); `NOTIFY_FROM_EMAIL` stays unset until the sending domain is verified in Resend.
- **Manual tests (owner):** a test mail to, and a reply from, each of sales@, info@ and mohamed@ now, and legal@ once it exists; the contact form; the unsubscribe page; opening each vCard on an iPhone and an Android phone.

## 6. SPF, DKIM, DMARC

`docs/email-delivery.md` §3: the sending domain isn't verified in Resend. Notifications go from Resend's sandbox sender, which only delivers to the account owner. SPF and DKIM for olivesegypt.com come with that verification, and DMARC can't be set until then (§7 "Still missing"). The repository holds no DNS records. The owner verifies the mailboxes and DNS.

## 7. vCards

| File | State | Served | Linked from |
|---|---|---|---|
| `assets/triple-company.vcf` (company) | LF line endings; address "5th Settlement, Ouroba Square" with an unescaped comma and locality "Cairo"; `TITLE:Sales` | live as `text/vcard; charset=UTF-8` (Netlify's default); no `Content-Disposition`, no `X-Robots-Tag`; not excluded in robots.txt | `/downloads/` and `/ar/downloads/` (a `download` link) |
| `docs/vcards/mohamed-abdullah-DRAFT.vcf` (Mohamed) | vCard 3.0, CRLF, UTF-8 without BOM, title "Representative", address in the C-22 order with the comma escaped | **not published** (docs/ only) | nowhere; `check-vcards.js` fails if anything outside docs/ links it or shows mohamed@ |

`.gitattributes` keeps `*.vcf` byte-for-byte (`-text`), so git never turns CRLF into LF.

## 8. Password-reset role list (#382, report only)

`ROLE_MAILBOXES` in `_auth_lib.js` on #382 is `sales, info, contact, admin, noreply, no-reply`. Add `legal`. `mohamed` stays allowed as a personal address.

## 9. Translation service in the privacy pages (report only)

Proposed English, for the owner's facts:

> If you write to us in a language we do not use every day, such as Portuguese, we may pass your message through a translation service [by machine / by a person] to read and answer it. The service receives the text of your message, which can include your name, company and order details. [It keeps it for … / It does not keep it.] It may handle the text outside Egypt and outside your own country.

The Arabic and Portuguese wording would follow once the owner gives the facts. Counsel questions 25 (`docs/g0-counsel-questions.md`) and 9 (`docs/pt-br-review.md`, #464).
