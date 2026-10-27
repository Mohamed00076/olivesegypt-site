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

## 5. Netlify, the mail host and the owner's manual tests (names only)

- **Mail host (Zoho Mail):** `legal@` will be created as an **alias or group** in Zoho (owner, 2026-10-27). Its **sending permission** (replying *as* legal@) is tested by the owner. Confirm `info@` is read.
- **Netlify:** `NOTIFY_EMAIL` decides who gets form notifications; `NOTIFY_FROM_EMAIL` is the sender.

**Manual tests, run by the owner from outside:**

1. A test mail **to**, and a reply **from**, each of `sales@`, `info@` and `mohamed@` now, and `legal@` once it exists as a Zoho alias or group. Check that each arrives, the reply shows the right sender (for `legal@`, that Zoho lets you send as it), and nothing lands in spam.
2. **Resend:** the dashboard shows olivesegypt.com as **Verified**, and `NOTIFY_FROM_EMAIL` (Netlify → Environment variables) ends in `@olivesegypt.com`. After you confirm, the stale "not verified" note in `docs/email-delivery.md` and `README.md` is corrected.
3. **The contact form:** send one enquiry (fake data, ZZ Test, zz@example.test). The notification arrives, and the reply goes to the enquirer's address.
4. **The unsubscribe page:** unsubscribe zz@example.test. The page confirms it, and the address appears as opted out in the CRM.
5. **Each vCard on an iPhone and an Android phone:** open the link, save the contact, and check name, title (Mohamed: "Representative"; the company card: none), email, phone and the address "Ouroba Square, 5th Settlement, New Cairo, Cairo, Egypt" with no stray backslash.

## 6. SPF, DKIM, DMARC

`docs/email-delivery.md` §3: the sending domain isn't verified in Resend. Notifications go from Resend's sandbox sender, which only delivers to the account owner. SPF and DKIM for olivesegypt.com come with that verification, and DMARC can't be set until then (§7 "Still missing"). The repository holds no DNS records. The owner verifies the mailboxes and DNS.

## 7. vCards

| File | State | Served | Linked from |
|---|---|---|---|
| `assets/triple-company.vcf` (company) | **Rewritten 2026-10-27:** CRLF, the C-22 address with the comma escaped, no TITLE, no department in ORG | `netlify.toml` block: `text/vcard; charset=utf-8`, `Content-Disposition: attachment`, `X-Robots-Tag: noindex`; robots.txt `Disallow: /assets/triple-company.vcf` | `/downloads/` and `/ar/downloads/`, as before |
| `vcard/mohamed-abdullah.vcf` (Mohamed) | vCard 3.0, CRLF, UTF-8 without BOM, title "Representative", C-22 address; **consent given 2026-10-27** | own `netlify.toml` block (as the company card); robots.txt `Disallow: /vcard/`; live with the email PR | nowhere, ever: shared by hand |

`.gitattributes` keeps `*.vcf` byte for byte (`-text`), and the deploy prunes `.gitattributes` itself.

### Mohamed's card: placement (approved 2026-10-27; built on this branch)

- **URL:** `https://olivesegypt.com/vcard/mohamed-abdullah.vcf` (repository path `vcard/mohamed-abdullah.vcf`).
- **Serving:** its own `netlify.toml` block, with `Content-Type: text/vcard; charset=utf-8`, `Content-Disposition: attachment; filename="mohamed-abdullah.vcf"` and `X-Robots-Tag: noindex`. robots.txt has `Disallow: /vcard/` and the file's own line.
- **Not linked** from any page, PDF, sitemap or llms.txt. `check-vcards.js` (`MOHAMED_PUBLIC_PATH`) fails on any link, on mohamed@ anywhere else, or on the card at any other path.
- **Goes live with the email PR**, which waits for "legal mailbox live". If you want the card sooner, it can move to a PR of its own.
- **Message to share it (approved):**
  - English: "Save my contact details: https://olivesegypt.com/vcard/mohamed-abdullah.vcf — Mohamed Abdullah, Representative, Triple Company for Industrial Development"
  - Arabic: «احفظ بيانات التواصل الخاصة بي: https://olivesegypt.com/vcard/mohamed-abdullah.vcf — محمد عبدالله، ممثل، الشركة الثلاثية للتنمية الصناعية»
- **On withdrawal:** delete the file, set `MOHAMED_AGREED = false` and `MOHAMED_PUBLIC_PATH = null`, deploy. The URL then answers 404.

## 8. Password-reset role list (#382, report only)

`ROLE_MAILBOXES` in `_auth_lib.js` on #382 is `sales, info, contact, admin, noreply, no-reply`. Add `legal`. `mohamed` stays allowed as a personal address.

## 9. Translation service in the privacy pages (drafts; not on any page)

**Facts (owner, 2026-10-27):**
- Machine translation; no person reads the message.
- WhatsApp's built-in translation runs on the phone and sends no text to a translation server.
- Email text is pasted into **Google's free Translate website**.
- The mailboxes are on **Zoho Mail**, not Google Workspace.

No claim is made about what Google keeps or trains on.

**Still to choose:** whether names and contact details are removed before pasting. The owner's answer came through as the placeholder "[YES: use Draft A / NO: use Draft B]", so both drafts are kept.

### Draft A: names and contact details removed before pasting

- **English:** "When we reply to you in a language we do not use every day, such as Portuguese, we use machine translation; no translator reads your message. On WhatsApp, the translation is done on our phone and the text is not sent to a translation service. For email, we remove your name and contact details and paste the rest of your message into Google Translate, Google's free translation website, which processes the text on Google's servers, possibly outside Egypt and outside your own country."
- **Portuguese ⚠️:** «Quando respondemos em um idioma que não usamos no dia a dia, como o português, usamos tradução automática; nenhum tradutor lê a sua mensagem. No WhatsApp, a tradução é feita no nosso celular e o texto não é enviado a um serviço de tradução. No e-mail, removemos seu nome e seus dados de contato e colamos o restante da mensagem no Google Tradutor, o site gratuito de tradução do Google, que processa o texto nos servidores do Google, possivelmente fora do Egito e fora do seu país.»
- **Arabic ⚠️:** «عندما نرد عليك بلغة لا نستخدمها يوميًا، مثل البرتغالية، نستخدم الترجمة الآلية؛ ولا يقرأ رسالتك أي مترجم. في واتساب تتم الترجمة على هاتفنا ولا يُرسل النص إلى خدمة ترجمة. أما في البريد الإلكتروني، فنحذف اسمك وبيانات التواصل الخاصة بك ثم نلصق باقي رسالتك في Google Translate، موقع الترجمة المجاني من Google، الذي يعالج النص على خوادم Google، وقد تكون خارج مصر وخارج بلدك.»

### Draft B: the message pasted as it is

- **English:** "When we reply to you in a language we do not use every day, such as Portuguese, we use machine translation; no translator reads your message. On WhatsApp, the translation is done on our phone and the text is not sent to a translation service. For email, we paste the text of your message, which can include your name, company and order details, into Google Translate, Google's free translation website, which processes it on Google's servers, possibly outside Egypt and outside your own country."
- **Portuguese ⚠️:** «Quando respondemos em um idioma que não usamos no dia a dia, como o português, usamos tradução automática; nenhum tradutor lê a sua mensagem. No WhatsApp, a tradução é feita no nosso celular e o texto não é enviado a um serviço de tradução. No e-mail, colamos o texto da sua mensagem, que pode incluir seu nome, empresa e detalhes do pedido, no Google Tradutor, o site gratuito de tradução do Google, que o processa nos servidores do Google, possivelmente fora do Egito e fora do seu país.»
- **Arabic ⚠️:** «عندما نرد عليك بلغة لا نستخدمها يوميًا، مثل البرتغالية، نستخدم الترجمة الآلية؛ ولا يقرأ رسالتك أي مترجم. في واتساب تتم الترجمة على هاتفنا ولا يُرسل النص إلى خدمة ترجمة. أما في البريد الإلكتروني، فنلصق نص رسالتك، الذي قد يتضمن اسمك وشركتك وتفاصيل طلبك، في Google Translate، موقع الترجمة المجاني من Google، الذي يعالجه على خوادم Google، وقد تكون خارج مصر وخارج بلدك.»

Counsel questions 25 (`docs/g0-counsel-questions.md`) and 9 (`docs/pt-br-review.md`, #464).

## 10. Email providers and the privacy pages (report only)

**Named today** on `/privacy` and `/ar/privacy` ("Third parties / sub-processors"):
- Netlify (hosting and functions);
- Neon (database);
- the self-hosted Umami (analytics, with consent);
- Google (Google Analytics, with consent);
- the regional internet registries RIPE NCC, AFRINIC and ARIN (the network lookup, with consent);
- Meta (the Facebook widget, only if clicked);
- couriers, as needed.

#467 adds MaxMind's GeoLite2 (a file held with our code, not a recipient).

**Not named:**
- **Zoho Mail**, which holds every email a buyer sends us and every form notification.
- **Resend**, which carries every form notification (the enquiry's contents) from the site to the mailbox.

**Proposed wording** (for approval; the Zoho region is still a placeholder):
- **English:** "Zoho Mail (our email mailboxes, hosted in [REGION]): it holds the emails you send us and the notifications of your form submissions. Resend (sends those form notifications from this site to our mailbox)."
- **Arabic ⚠️:** «Zoho Mail (صناديق بريدنا الإلكتروني، المستضافة في [المنطقة]): تحفظ رسائل البريد التي ترسلها إلينا وإشعارات النماذج التي تقدّمها. وResend (ترسل إشعارات النماذج تلك من هذا الموقع إلى صندوق بريدنا).»
- **Portuguese ⚠️:** «Zoho Mail (nossas caixas de e-mail, hospedadas em [REGIÃO]): guarda os e-mails que você nos envia e as notificações dos formulários que você envia. Resend (envia essas notificações de formulário deste site para a nossa caixa de e-mail).»

The region: Zoho's data-centre domain (zoho.com, zoho.eu, zoho.in and so on) appears in the Zoho Mail address bar. The owner's answer came through as the placeholder "[FILL IN]".
