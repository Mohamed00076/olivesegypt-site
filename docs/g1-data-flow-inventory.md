# G1 — Field-Level Data-Flow Inventory

One row per field collected anywhere on the site or in connected systems, as
required before any consent/tracking code is written. Every "lawful-basis
question" cell is a flag for counsel, not an answer asserted here. Every
"retention period" marked `[TODO: confirm]` is genuinely undecided — no
number has been invented or published anywhere on the site.

Legend — **Consent category**: `strictly necessary` (always on, no consent
needed) / `analytics` (gated behind Analytics consent) / `other`.

## 1. Contact form (`/contact` → `netlify/functions/inquiries.js` → Postgres `inquiries` table)

| Field | Source | Origin | Destination | Purpose | Consent category | Lawful-basis question (for counsel) | Retention | Access role | Deletion behavior | May contain personal data |
|---|---|---|---|---|---|---|---|---|---|---|
| `name` | Client form input | Client | `inquiries.name` | Identify the requester | strictly necessary | Is contract-negotiation necessity (Art. 6-equivalent) the right basis, or is it consent? | `[TODO: confirm]` | Sales team via session-authenticated admin dashboard | `[TODO: confirm deletion/anonymization workflow]` | Yes |
| `email` | Client form input | Client | `inquiries.email` | Respond to the inquiry | strictly necessary | Same as above | `[TODO: confirm]` | Same | `[TODO: confirm]` | Yes |
| `company` | Client form input | Client | `inquiries.company` | Business context for the inquiry | strictly necessary | Same as above | `[TODO: confirm]` | Same | `[TODO: confirm]` | Possibly (sole proprietorships) |
| `country` | Client form input | Client | `inquiries.country` | Export logistics context | strictly necessary | Same as above | `[TODO: confirm]` | Same | `[TODO: confirm]` | Possibly (location) |
| `phone` (optional) | Client form input | Client | `inquiries.phone` | Alternate contact method | strictly necessary | Same as above | `[TODO: confirm]` | Same | `[TODO: confirm]` | Yes |
| `product_interest` | Client `<select>`, fixed catalog values | Client | `inquiries.product_interest` | Route the inquiry | strictly necessary | N/A (not personal) | `[TODO: confirm]` | Same | `[TODO: confirm]` | No |
| `estimated_volume` | Client `<select>`, fixed values | Client | `inquiries.estimated_volume` | Sizing the inquiry | strictly necessary | N/A | `[TODO: confirm]` | Same | `[TODO: confirm]` | No |
| `request_type` | Hardcoded (`"Quote Request"`) | Client | `inquiries.request_type` | Distinguish form source | strictly necessary | N/A | `[TODO: confirm]` | Same | `[TODO: confirm]` | No |
| `message` | Client free-text | Client | `inquiries.message` | Buyer's actual request | strictly necessary | Same as name/email | `[TODO: confirm]` | Same | `[TODO: confirm]` | **Yes — high risk.** Free text; a buyer can type anything, including personal data about third parties. |
| `client_ip` | Request header (`x-nf-client-connection-ip`) | Server | `inquiries.client_ip` | Spam/rate-limit protection only | strictly necessary | Legitimate-interest question for counsel | `[TODO: confirm]` | Same (not surfaced in the current admin dashboard UI) | `[TODO: confirm]` | Yes (IP address) |
| `source_page` | `document.referrer` (fallback: current URL) | Client | `inquiries.source_page` | Preserve which page/product the buyer came from | strictly necessary | N/A (URL, not personal on its own) | `[TODO: confirm]` | Same | `[TODO: confirm]` | Low risk |
| honeypot field (`website`) | Client hidden input | Client | **Not persisted.** Checked server-side; if non-empty, the submission is silently dropped (fake success returned) and nothing is written to the database. | Bot rejection | strictly necessary | N/A | N/A (never stored) | N/A | N/A | No |

## 2. Sample form (`/sample` → same `inquiries.js` function/table)

Same fields and treatment as the Contact form above, with one difference:
the "Shipping Address" and "Additional Notes" fields are composed into the
same `message` column (there is no separate `shipping_address` column) —
**this makes `message` on sample-form rows specifically likely to contain a
postal address**, a more sensitive category of free text than the Contact
form's `message`.

## 3. Market Brief / lead-capture form (`/` homepage → `netlify/functions/leads.js` → Postgres `leads_staging` table)

| Field | Source | Origin | Destination | Purpose | Consent category | Lawful-basis question | Retention | Access role | Deletion behavior | May contain personal data |
|---|---|---|---|---|---|---|---|---|---|---|
| `email` | Client form input | Client | `leads_staging.email` | Send the quarterly market brief | strictly necessary (form is itself the opt-in mechanism) | Is the form's own consent checkbox sufficient basis? | `[TODO: confirm]` | Sales/marketing team (no admin UI reads this table yet) | `[TODO: confirm]` | Yes |
| `company_name` | Client form input | Client | `leads_staging.company_name` | Segment subscribers | strictly necessary | Same | `[TODO: confirm]` | Same | `[TODO: confirm]` | Possibly |
| `country_region` | Client form input | Client | `leads_staging.country_region` | Segment subscribers | strictly necessary | Same | `[TODO: confirm]` | Same | `[TODO: confirm]` | Possibly |
| `buyer_type` | Client `<select>`, fixed values | Client | `leads_staging.buyer_type` | Segment subscribers | strictly necessary | N/A | `[TODO: confirm]` | Same | `[TODO: confirm]` | No |
| `consent` | Client checkbox (required, must be `true`) | Client | `leads_staging.consent` | **This is the marketing-consent record itself** | strictly necessary | What does "consent" mean here vs. the G2 cookie-consent categories — are these the same consent or two different ones? (flag for counsel) | `[TODO: confirm]` | Same | `[TODO: confirm]` | No |
| `source_page` | Hardcoded `"/"` (only entry point today) | Client | `leads_staging.source_page` | Context | strictly necessary | N/A | `[TODO: confirm]` | Same | `[TODO: confirm]` | No |
| `segment` | Hardcoded `"market_report"` | Client | `leads_staging.segment` | Distinguish form variant | strictly necessary | N/A | `[TODO: confirm]` | Same | `[TODO: confirm]` | No |
| `target_market`, `variety`, `format`, `pack_size`, `volume`, `certification_requirements`, `launch_date` | Not sent by any live form today (schema supports the private-label variant for a future consumer) | — | `leads_staging.*` | Reserved for a future private-label lead form | strictly necessary | N/A | `[TODO: confirm]` | Same | `[TODO: confirm]` | Unlikely |
| `client_ip` | Request header | Server | `leads_staging.client_ip` | Spam/rate-limit protection only | strictly necessary | Same as inquiries.client_ip | `[TODO: confirm]` | Same | `[TODO: confirm]` | Yes |
| honeypot field (`website`) | Client hidden input | Client | **Not persisted**, same behavior as the Contact/Sample honeypot | Bot rejection | strictly necessary | N/A | N/A | N/A | N/A | No |

## 4. Analytics events (`assets/analytics.js` → `TC.trackEvent()` → Umami, self-hosted instance)

**Gated behind Analytics consent — see G2.** Every event below was designed,
before this inventory was written, to exclude names, emails, phone numbers,
message bodies, and any other free-text personal data; this inventory
confirms that design rather than approving new fields.

| Event | Payload fields | Destination | Purpose | Consent category | May contain personal data |
|---|---|---|---|---|---|
| `quote_request_submitted` | `source_page`, `product` (fixed catalog value or null), `dedup_key` (derived hash, not a visitor ID — see below) | Umami | Conversion measurement | analytics | No |
| `sample_request_submitted` | Same shape | Umami | Conversion measurement | analytics | No |
| `specification_download` | `source_page`, `target` (URL), `dedup_key` | Umami | Engagement measurement | analytics | No |
| `whatsapp_click` | `source_page`, `dedup_key` | Umami | Engagement measurement | analytics | No |
| `email_click` | `source_page`, `dedup_key` | Umami | Engagement measurement | analytics | No |
| `form_confirmation_viewed` | `source_page`, `form` (fixed string: `"contact"` or `"sample"`), `dedup_key` | Umami | UI-confirmation measurement | analytics | No |

`dedup_key` is a per-event hash of `(event name + source_page + timestamp)`,
regenerated on every call — **it is not, and must never become, a persistent
per-visitor identifier.** Confirmed by code review: nothing in
`assets/analytics.js` stores or reuses a `dedup_key` across events or across
page loads.

`assets/analytics.js` now enforces an explicit payload-key allowlist inside
`TC.trackEvent()` itself (added alongside this inventory) rather than relying
only on caller discipline — any key not in
`{source_page, product, target, form, dedup_key}` is dropped before the
event is sent, so a future caller cannot accidentally leak a name, email, or
message body into an analytics payload.

## 5. Umami base pageview tracking (automatic, once the script is consent-loaded — see G2)

| Field | Source | Destination | Purpose | Consent category | Retention | May contain personal data |
|---|---|---|---|---|---|---|
| URL path | Browser | Umami (self-hosted, `umami-olivesegypt.netlify.app`) | Traffic analytics | analytics | `[TODO: confirm — Umami instance's own retention setting, not verifiable from this codebase]` | No |
| Referrer | Browser | Umami | Traffic-source analytics | analytics | `[TODO: confirm]` | Low risk (could reveal a previous site visited) |
| Browser, OS, device type, screen size, language | Browser (user-agent / client hints) | Umami | Traffic analytics | analytics | `[TODO: confirm]` | Low risk, part of device fingerprint surface |
| Country (IP-derived) | Server-side IP geolocation inside the Umami instance | Umami | Traffic analytics | analytics | `[TODO: confirm]` | Yes (location) |
| Raw IP address | Request | Umami's own server (this codebase never receives or stores it) | Used transiently by Umami to resolve country, per Umami's own design | analytics | `[TODO: confirm — Umami's own IP-handling/retention policy, cannot be verified from outside their instance]` | Yes, if retained by Umami itself |

**Note:** this codebase does not control Umami's internal server-side
behavior; the rows above describe what the Umami *tracker script* is known
to collect from the browser, not an audited guarantee of what the
self-hosted Umami instance stores or for how long. That instance's own
retention configuration is a `[TODO: confirm]` for whoever administers it.

## 6. Consent record (new, built for G2 — `netlify/functions/consent.js` → Postgres `consent_log` table)

| Field | Source | Destination | Purpose | Consent category | Retention | May contain personal data |
|---|---|---|---|---|---|---|
| `consent_id` | Server-generated random token | `consent_log.consent_id` | Unique reference for this consent record | strictly necessary | `[TODO: confirm]` | No |
| `categories` (JSON, e.g. `{"analytics": true}`) | Client banner choice | `consent_log.categories` | What the visitor actually agreed to | strictly necessary | `[TODO: confirm]` | No |
| `policy_version`, `consent_version` | Hardcoded constants in `assets/consent.js` | `consent_log.*` | Prove which policy text the choice applies to | strictly necessary | `[TODO: confirm]` | No |
| `mechanism` (e.g. `"banner_accept_all"`, `"banner_reject"`, `"preferences_updated"`) | Client, which control was used | `consent_log.mechanism` | Audit trail | strictly necessary | `[TODO: confirm]` | No |
| `timestamp` | Server `now()` | `consent_log.created_at` | Audit trail | strictly necessary | `[TODO: confirm]` | No |
| `device_hash` | SHA-256 of `(client IP + User-Agent)`, **truncated, one-way, never the raw IP itself** | `consent_log.device_hash` | Correlate consent events from roughly the same device without storing raw IP indefinitely | strictly necessary | `[TODO: confirm]` | Pseudonymous — treated as if it may be personal data |

`device_hash` is explicitly **not** usable as, and must never be reused as,
an analytics visitor identifier — confirmed by code review that
`assets/consent.js` and `assets/analytics.js` share no identifier.

## 7. Site preference storage (client-side only, `localStorage`)

| Key | Purpose | Consent category | Sent to any server? |
|---|---|---|---|
| `tc-theme` | Remembers light/dark mode choice | strictly necessary (core UI function) | No |
| `tc-consent` (new, added for G2) | Remembers the visitor's own consent choice so the banner doesn't reappear every visit | strictly necessary (storing a person's own consent choice does not itself require consent) | No — read only by the client; the *record* of consent is separately logged server-side (row 6 above) for accountability |

## 8. Admin authentication (internal staff access, not visitor data)

Included for completeness, not because it collects visitor personal data.

| Field | Source | Destination | Purpose | Notes |
|---|---|---|---|---|
| Admin username/password | Login form, internal staff only | Compared against `ADMIN_USERNAME` / `ADMIN_PASSWORD_HASH` environment variables at request time | Access control for `/admin/analytics` | **Never persisted to any database** — no user table exists; credentials live only in Netlify environment variables. |
| `tc_session` cookie | Server-issued on successful login | Client (httpOnly, Secure cookie) | Session for the admin dashboard | HMAC-signed, contains username + issued-at + expiry; no server-side session store; not set for ordinary site visitors, only after admin login. |

## 9. Section J custom event pipeline (`assets/analytics.js` → `TC.logEvent()` → `/api/analytics-collect` → Postgres `analytics_sessions`/`analytics_events` tables, this repo's own database)

Added for Section J Phase 1 (see `docs/j0-analytics-audit.md` for the
architecture decision behind why this exists as a second pipeline
alongside Umami, not instead of it). **Gated behind the exact same
Analytics consent as section 4/5 above** — `TC.logEvent()` no-ops whenever
`TC.consent.analytics` is false, and the visitor ID / session are never
minted until consent is granted.

| Field | Source | Destination | Purpose | Consent category | May contain personal data |
|---|---|---|---|---|---|
| `visitor_id` | Client-generated UUID (`crypto.randomUUID()`), stored in `localStorage` | `analytics_sessions.visitor_id`, `analytics_events.visitor_id` | Persistent non-PII identifier for first-touch attribution across sessions | analytics | No — random, not derived from any personal or device-fingerprint value |
| `session_id` | Client-generated UUID, `localStorage`, rotated after 30 minutes of inactivity | `analytics_sessions.session_id` (primary key) | Groups events into a session for funnel/hot-lead analysis | analytics | No |
| `event_type` | Fixed set: `pageview`, `whatsapp_click`, `email_click`, `specification_download`, `contact_form_submit` | `analytics_events.event_type` | Funnel stage / high-intent action classification | analytics | No |
| `target_id` | For `specification_download`: the `?product=` query value or path, extracted client-side. Otherwise null. | `analytics_events.target_id` | Identifies which spec sheet was downloaded | analytics | No |
| `source_page` | `window.location.pathname` | `analytics_events.source_page` | Which page the action happened on | analytics | No |
| `utm_source/medium/campaign/content/term` | URL query params, read once at session start | `analytics_sessions.utm_*` | Campaign attribution | analytics | No |
| `referrer_domain` | `document.referrer`, hostname only (no path/query), self-referrals dropped | `analytics_sessions.referrer_domain` | Traffic-source attribution | analytics | Low risk (could reveal a previous site visited, same caveat as section 5's Umami referrer field) |
| `is_internal` | Server-side: request IP checked (transiently, never stored) against the `ANALYTICS_INTERNAL_IP_ALLOWLIST` env var | `analytics_sessions.is_internal` (boolean) | Soft-flags admin/office traffic — **flagged, never deleted**, excluded only from default KPI counts | analytics | No — raw IP is never persisted, only the resulting boolean |
| `bot_confidence`, `bot_reason_codes`, `bot_detection_version` | Server-computed (User-Agent header + client-reported `webdriver`/`had_interaction`/`time_on_page_ms` signals sent via a page-exit `sendBeacon` call) | `analytics_sessions.bot_confidence` etc. | 0–100 bot-confidence score with reason codes — see `_analytics_lib.js`; the scoring rules themselves are never sent to the client or echoed in any API response | analytics | No |
| `bot_override` | Admin action in the dashboard's Bot/Internal-Traffic Review panel | `analytics_sessions.bot_override` | Manual false-positive correction | n/a (admin action, not visitor data) | No |

`event_id` (a client-generated UUID, one per event) is the idempotency
key — a `UNIQUE` constraint plus `ON CONFLICT DO NOTHING` makes a
retried/duplicate send a true no-op. Raw IP addresses are never stored
anywhere in this pipeline, matching the pattern already established for
`consent_log`/Umami elsewhere in this inventory. This visitor/session ID
pair is entirely separate from `consent_log.device_hash` (Rule 23 —
enforced by a code comment in `consent.js` and never reused here) and
separate from Umami's own internal session ID (section 5).

---

## Summary for G2

The only fields anywhere on the site that are genuinely optional /
consent-gated today are the **analytics events (section 4)**, **Umami's
own pageview tracking (section 5)**, and **the Section J custom pipeline
(section 9)**. Everything else (form submissions, theme preference, the
consent record itself) is strictly necessary to the function the visitor
is actively using and does not require consent under any reasonable
reading — but is still inventoried above per G1's instruction to cover
every field, not just the consent-gated ones.
