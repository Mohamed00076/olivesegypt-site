# Triple Company — olivesegypt.com

Marketing site and owner dashboard for Triple Company (Egyptian table-olive export).

## What this is

A pre-built static site (plain HTML/CSS/JS — there is **no build step**) plus a
small set of Node serverless functions under `netlify/functions/`, designed to
run on Netlify.

```
index.html, catalog/, contact/, media/, ...   static pages (pre-built, committed)
assets/                                       hashed JS/CSS/image bundles
netlify/functions/                            serverless functions (Node, Netlify Functions)
  _lib.js                                     shared auth helpers (not routed — leading _)
  auth-login.js, auth-me.js, auth-logout.js   owner login (scrypt + HMAC session cookie)
  inquiries.js                                contact-form submissions -> Postgres
  analytics.js                                owner-only proxy to the Umami instance
  _analytics_lib.js, analytics-collect.js,    site's own custom event pipeline
    analytics-report.js, analytics-settings.js  (funnels, hot leads, bot scoring — see below)
  _crm_lib.js, crm-*.js                       Buyer CRM backend (own auth, see below)
admin/analytics/index.html                    owner dashboard (login-gated)
crm/                                          Buyer CRM frontend (login-gated, own auth)
scripts/crm-create-user.js, crm-seed.js       CRM setup helpers (run locally, not deployed)
netlify.toml                                  redirects (api/* -> functions) + SPA fallback
```

## Requirements to run

- **Netlify**. `netlify.toml` redirects and the `netlify/functions/` directory
  are Netlify-specific — plain GitHub Pages or any static-only host will serve
  the pages but **all `/api/*` routes and the admin dashboard will not work**.
- **A Postgres database** (currently Neon, via `@neondatabase/serverless`).
- **A Umami instance** for analytics — self-hosted from
  [`umami-software/umami`](https://github.com/umami-software/umami), with its own
  separate Postgres database.

## Environment variables

None are committed. All are read from `process.env`. Required in Production:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection string (contact inquiries) |
| `ADMIN_USERNAME` | Dashboard login username |
| `ADMIN_PASSWORD_HASH` | `scrypt:<saltHex>:<hashHex>` — never a plaintext password |
| `SESSION_SECRET` | HMAC key signing the `tc_session` cookie |
| `UMAMI_URL` | Base URL of the Umami instance |
| `UMAMI_USERNAME` / `UMAMI_PASSWORD` | Umami API credentials |
| `UMAMI_WEBSITE_ID` | Umami site ID for olivesegypt.com |

Netlify's Neon integration (if enabled) may also inject `POSTGRES_*` / `PG*` /
`NEON_PROJECT_ID` automatically. For the connection the code tries, in order:
`DATABASE_URL` → `POSTGRES_URL` → `POSTGRES_URL_NON_POOLING` → `DATABASE_URL_UNPOOLED`,
so any one of them being present is enough.

### Generating `ADMIN_PASSWORD_HASH`

```bash
node -e "const c=require('crypto');const s=c.randomBytes(16);const p=process.argv[1];console.log('scrypt:'+s.toString('hex')+':'+c.scryptSync(p,s,32).toString('hex'))" 'YOUR_PASSWORD'
```

### Generating `SESSION_SECRET`

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Local development

```bash
npm install
netlify dev
```

## Deploying

```bash
netlify deploy --prod
```

There is no build command and no output directory to configure — `netlify.toml`
sets `publish = "."` and serves the repo root as-is.

## Buyer CRM (`/crm/`)

An internal, login-gated tool for tracking B2B olive-export buyers through a
fixed pipeline (Lead → Contacted → Qualifying → Sample Requested → Sample
Sent → Negotiation → Contract Signed → Shipment Prepared → Exported/Completed,
plus a Lost/Stalled side-state). It is **independent of the analytics
dashboard** at `/admin/analytics/` — nothing about it is shared with, or
required by, the rest of this site's owner tooling. It has no dependency on
`assets/analytics.js` or `assets/consent.js` and never merges its buyer
records with anonymous visitor analytics.

**No new services.** It reuses this repo's existing Netlify Functions
runtime and existing Neon Postgres database (new tables only:
`buyers`, `buyer_stage_history`, `buyer_activity_log`, `crm_users`,
`crm_audit_log`).

**Authentication is deliberately separate** from the `/admin/analytics/`
dashboard's single hardcoded admin login. The CRM has its own cookie
(`tc_crm_session`, distinct from `tc_session`) and its own real `crm_users`
database table, so it can support more than one user later without changing
the auth model. It shares no session, secret, or password hash with the
analytics dashboard or with the Umami instance.

### Setup

1. Deploy as normal (below) — the CRM's tables are created automatically
   (`CREATE TABLE IF NOT EXISTS ...`) the first time any `crm-*` function runs.
2. Create your own login locally (never typed into chat, never committed):
   ```bash
   DATABASE_URL=postgres://... node scripts/crm-create-user.js <username> <password> ["Display Name"] [email]
   ```
   Requires a password of at least 12 characters. Re-run any time to reset a
   password (existing display name/email are kept if you leave them out).
   The optional `email` is only needed for the self-service "Forgot
   password?" flow below — sign-in itself never uses it.
3. (Optional) Seed realistic fictional sample buyers so the dashboard and
   kanban board aren't empty on first use:
   ```bash
   DATABASE_URL=postgres://... node scripts/crm-seed.js
   ```
   Only inserts if the `buyers` table is currently empty — pass `--force` to
   insert anyway.
4. Visit `/crm/login/` and sign in.

### Password Reset

Previously the *only* way to reset a CRM password was re-running
`scripts/crm-create-user.js` above — fine for the one person running this
project today, but a real gap for any actual multi-user CRM (a locked-out
staff member shouldn't need someone with `DATABASE_URL` access to get them
back in). That script still works and still needs no email setup, so it
stays as the always-available fallback; on top of it there's now a
self-service flow:

1. `/crm/login/` has a "Forgot password?" link → `/crm/forgot-password/`.
2. Enter a username. If that account has a recovery email on file (set via
   `crm-create-user.js`'s optional `[email]` argument above), a one-time
   reset link is emailed to it — reusing Section K's `RESEND_API_KEY`
   (**not** `NOTIFY_EMAIL`, since this goes to the individual user, not the
   site owner). If email isn't configured, or the account has no email on
   file, nothing gets sent — fall back to the script.
   **Sender limitation:** without a verified sending domain, Resend's
   sandbox sender can only deliver to the email address *your own Resend
   account* is registered under — fine for testing with yourself as the
   one CRM user, but for reset emails to actually reach other staff,
   verify a domain in Resend and set `NOTIFY_FROM_EMAIL` to an address on
   it. Until then, other users' reset requests still return the same
   generic success response (see below) but nothing arrives — treat the
   script as the working fallback until a domain is verified.
3. The response is **identical either way** (account found or not, email
   configured or not) — deliberately, so this endpoint can't be used to
   enumerate valid CRM usernames.
4. The link (`/crm/reset-password/?token=...`) expires in 60 minutes and
   works once. Only a SHA-256 hash of the token is ever stored in the new
   `crm_password_resets` table — the raw token exists only in the email and
   the requester's browser, so a database breach alone can't be used to
   replay it.

**Known limitation, stated rather than silently left out:** resetting a
password this way does **not** invalidate that user's other active
sessions. CRM sessions are stateless HMAC-signed cookies (checked by
signature + expiry only, no server-side session table) — real revocation
would need a session store for every login, a materially larger change
than this reset flow. If you suspect a session is compromised specifically
(not just a forgotten password), the only current mitigation is waiting out
its 7-day expiry or rotating `CRM_SESSION_SECRET` (which invalidates
*every* CRM session, not just one).

### Environment variables (CRM-specific)

| Variable | Purpose |
| --- | --- |
| `CRM_SESSION_SECRET` | HMAC key signing the `tc_crm_session` cookie. Falls back to `SESSION_SECRET` if unset, but a **separate** value is recommended so a leaked CRM session secret can't be used against the analytics dashboard, or vice versa. |

`DATABASE_URL` (or `POSTGRES_URL` / `POSTGRES_URL_NON_POOLING` /
`DATABASE_URL_UNPOOLED`) is reused from the table above — no separate
database connection is needed.

### Free-tier limits that apply (verified, not assumed — no new services added, but worth knowing since the CRM adds load to the same shared Neon/Netlify accounts)

- **Neon** (Postgres): 100 compute-hours/month, 0.5 GB storage per project,
  up to 100 projects, 10 branches/project, autoscaling up to 2 CU/8 GB RAM,
  scale-to-zero after 5 minutes idle, no credit card required.
- **Netlify**: 125,000 serverless function invocations/month; bandwidth from
  a shared pool of 300 credits/month at 20 credits/GB (~15 GB); **hard caps
  with no grace period** — the site goes offline until the first of the next
  month if either is exceeded. An internal, staff-only tool like the CRM
  should add negligible load compared to public traffic, but keep an eye on
  the function-invocation count if usage grows.

### Conversion rate definition

The dashboard's conversion rate is **buyer-based, not transition- or
snapshot-based**: the numerator is buyers that ever reached Contract Signed,
Shipment Prepared, or Exported/Completed; the denominator is all buyers
created in the period, *including* ones that later went Lost/Stalled (kept
in the denominator so the rate isn't survivorship-biased). A reopened lead
counts once, by its original creation date. Duplicate records are flagged
for manual merge, not auto-deduplicated. The exact definition string is also
returned by `/api/crm/dashboard` and rendered on the dashboard itself.

### Authorization model

Every CRM read, write, import, export, and delete requires a valid session
(deny-by-default — no route serves CRM data to an unauthenticated request).
Reads of individual buyer records are written to `crm_audit_log`, not just
writes. Bulk delete and bulk export both require an explicit
`?confirmed=1` query parameter enforced **server-side**, in addition to the
confirmation dialogs in the UI. CSV export/import sanitizes every cell
against CSV-injection (a leading `=`, `+`, `-`, or `@` gets a neutralizing
prefix) and validates every imported row server-side — a row that fails
validation is skipped and reported, never partially inserted.

## Custom Analytics Pipeline (Section J, Phase 1–3)

A second, first-party event pipeline living entirely in this repo's own
Neon Postgres — **alongside, not instead of**, the Umami proxy above.
Umami stays the source for pageview/session stats; this pipeline is
where funnels, hot-lead flags, traffic-source attribution, bot/
internal-traffic scoring, country/device/browser demographics (Phase 2),
and — as of Phase 3 — B2B reverse-IP lookup, a live-visitor feed, multi-
path funnels, data-retention/deletion tooling, and an optional Search
Console import all live, because Umami's own schema has no room for the
first few. See `docs/j0-analytics-audit.md` for the full architecture
reasoning, and `docs/j1-acceptance-criteria.md` / `docs/j2-acceptance-criteria.md`
/ `docs/j3-acceptance-criteria.md` for each phase's specifics and how to
verify them yourself.

### Phase 3 additions

- **B2B reverse-IP lookup**: self-built, free-only RDAP (WHOIS's modern
  successor) queries against the official Regional Internet Registries
  (ARIN/RIPE/APNIC/AFRINIC/LACNIC), routed via IANA's own official
  bootstrap files — no paid data-broker API anywhere. Every result is
  cached (keyed by a one-way hash of the IP, never the IP itself) so the
  same IP is never re-queried, and every UI surface showing an
  organization name displays this exact disclosure alongside it: *"This
  only reliably identifies dedicated/corporate network infrastructure.
  Residential and mobile-carrier IPs resolve to the ISP, not the
  visiting company. ASN/network registration data is never verified
  company identity — treat it as a probabilistic signal, not a fact."*
- **Live-visitor feed**: sessions active within a configurable window
  (default 5 minutes — a session's `last_seen_at` already updates on
  every event, no separate heartbeat mechanism needed). Never shows raw
  IPs, full referrer URLs, or any free-text payload (this pipeline
  doesn't store those fields to begin with). Every load of this view is
  written to `analytics_audit_log`.
- **Multi-path funnels**: the funnel is no longer one fixed 4-stage path
  — `analytics_settings.funnel_definitions` holds a few genuinely
  different named conversion paths (Standard, WhatsApp-First, Direct
  Inquiry), selectable from a dropdown, alongside the existing source/
  country filters.
- **Data retention & deletion**: session/event data older than a
  configurable retention window (default 395 days / ~13 months — the
  spec's own suggested starting figure, explicitly pending real legal
  review, not asserted here as a compliance guarantee) is purged daily.
  An admin can also permanently delete a specific visitor's data on
  request from the dashboard — this genuinely deletes the rows (not a
  soft flag) and permanently blocks that `visitor_id` from ever writing
  new data again, with the client told to mint a fresh, unrelated ID
  rather than keep retrying. No cross-device identity stitching is ever
  attempted.
- **Search Console** (optional, off by default): see its own section
  below — nothing about it runs until you've done the account setup
  *and* explicitly enabled it in the dashboard.

**No new paid services**, but Phase 2 does add one new *build step* and
one *optional* free automation:

- **Build step**: `scripts/build-geo.js` runs before every deploy
  (`netlify.toml`'s `[build] command`), downloading a country-level-only
  GeoLite2 database from a free, unofficial GitHub redistribution mirror
  — not a MaxMind-licensed account (see `docs/j0-analytics-audit.md` and
  `docs/j2-acceptance-criteria.md` for why: a real MaxMind account works
  too but comes with a 90-day license-key re-verification chore, and
  **GeoLite2-**City** specifically doesn't fit** — its ~60MB file exceeds
  Netlify Functions' 50MB unzipped bundle limit, which is why this is
  country-level only, not city-level). The file is never committed
  (`.gitignore`'d, re-downloaded fresh on every deploy) and this build
  step never fails the site build itself if the mirror is unreachable —
  it just logs a warning and country resolution returns null until the
  next successful deploy.
- **Optional**: `netlify/functions/geo-refresh.js` is a Netlify
  scheduled function (weekly, declared in `netlify.toml`) that can
  trigger a fresh deploy purely to re-pull the geo database between your
  normal deploys — see the env var below. Entirely optional; nothing
  breaks if you skip it, the database just only refreshes on your actual
  next deploy either way.

New tables (same Neon database, created automatically on first use):
`analytics_sessions`, `analytics_events`, `analytics_settings`,
`analytics_ingest_errors`, `analytics_audit_log`, `ip_org_cache`,
`deleted_visitor_ids`, `search_console_performance`,
`search_console_import_runs`.

### Search Console setup (optional — skip this entirely if you don't want it)

Nothing here runs until you've done this setup **and** explicitly
enabled it via the checkbox in the dashboard's Search Console panel —
until then it's just inactive code. If you'd rather not deal with it,
that's a completely fine, permanent choice; everything else in this
pipeline works independently of it.

1. [Google Cloud Console](https://console.cloud.google.com/) → enable
   the **Search Console API** for any project.
2. IAM & Admin → Service Accounts → create one (no GCP roles needed —
   the "Service account ID" field is just a name you pick).
3. Create and download a JSON key for it.
4. [Search Console](https://search.google.com/search-console) →
   Settings → Users and permissions → Add user → paste the service
   account's email (the `client_email` field in the JSON key, looks like
   `xxx@your-project.iam.gserviceaccount.com` — **not** your own Google
   account email) → grant **Full** access.
5. Set the three env vars below in Netlify, redeploy.
6. In `/admin/analytics/`'s Search Console panel, check "Enabled" and
   save (there's a confirmation prompt — this is the point where it
   starts actually calling Google's API on a daily schedule).

Verified (Rule 18): the Search Analytics API has no paid tier at
all — quota-limited, not billed, capped at 25,000 rows/request and
50,000 page-keyword pairs/property/day, which the import job's
pagination and rolling lookback window are built around. Only the
read-only Search Analytics query endpoint is ever called — never the
Indexing API or anything that could submit or change your live
indexing state.

### Environment variables

| Variable | Purpose |
| --- | --- |
| `ANALYTICS_INTERNAL_IP_ALLOWLIST` | Comma-separated list of IPs/CIDR ranges (e.g. `41.x.x.x,10.0.0.0/8`) to soft-flag as internal/admin traffic. **Unset by default** — until you set this, no session is ever flagged internal, so the dashboard's "Flagged Internal" count will read 0 even for your own office traffic. Flagging never deletes anything; it only excludes flagged sessions from the default KPI/funnel/attribution counts. |
| `NETLIFY_BUILD_HOOK_URL` | *(Phase 2, optional)* A Build Hook URL from Netlify's own UI (Site settings → Build & deploy → Build hooks → Add build hook) that `geo-refresh.js` POSTs to weekly to keep the geo database current between deploys. Unset by default — `geo-refresh.js` just logs and no-ops if it's missing; nothing depends on this running. |
| `GSC_SERVICE_ACCOUNT_EMAIL` | *(Phase 3, optional)* The service account's auto-generated email from the setup above. |
| `GSC_SERVICE_ACCOUNT_PRIVATE_KEY` | *(Phase 3, optional)* The `private_key` field from the downloaded JSON key, pasted as-is (including the `-----BEGIN/END PRIVATE KEY-----` lines). |
| `GSC_SITE_URL` | *(Phase 3, optional)* The exact property string as registered in Search Console, usually `sc-domain:olivesegypt.com`. |

All three `GSC_*` vars must be set **and** the dashboard toggle enabled
before any Search Console call is ever made — either alone leaves the
integration fully inactive.

No other new env vars — `DATABASE_URL` is reused, and there's no separate
auth (this pipeline's admin endpoints sit behind the same `tc_session`
cookie as the rest of `/admin/analytics/`).

### Known limitations

- Bot-detection scoring rules live only in `netlify/functions/_analytics_lib.js`
  and are deliberately never exposed to the client or echoed in any API
  response — the dashboard shows a score and reason codes, not the
  underlying formula.
- Geo resolution is **country-level only, not city-level** — see above.
  A session with no resolved country (bad/missing IP, or the geo
  database wasn't available at the time of that build) is counted
  separately in the dashboard, not silently dropped.
- The geo database comes from an unofficial, free redistribution mirror
  of MaxMind's GeoLite2 data, not a licensed MaxMind account — its
  update cadence and long-term availability aren't guaranteed by
  MaxMind. If that ever becomes a problem, switching to a real MaxMind
  account only requires changing `scripts/build-geo.js`'s download URL
  (and accepting the account/license-key maintenance that comes with it).
- The dashboard's "Ingest Errors" count can only ever see failures this
  server actually received and then failed to store — a request that
  never reaches the server at all is invisible to any server-side count.
- B2B org resolution (Phase 3) only supports IPv4 today — an IPv6
  visitor resolves to "unknown," not an error.
- The RDAP bootstrap-fetch → registry-query chain could not be tested
  against the live internet from this development environment (network
  policy blocks it here) — verified instead via the `maxmind`-equivalent
  approach of exercising the real code against realistic mocked
  responses; see `docs/j3-acceptance-criteria.md` for exactly what was
  and wasn't verified.
- Search Console dates are in Google's own reporting timezone (Pacific
  Time), not UTC and not the Africa/Cairo convention used everywhere
  else in this dashboard — stated on that panel itself, not just here.

## KPI Manager (Section J2)

A "KPI Manager" card inside `/admin/analytics/` — not a separate app,
route, or login. Define business KPIs (name, category, unit, target,
weekly/monthly frequency), enter a value each period, and see status
(on track / warning / off track) against the target. No new environment
variables — it reuses `DATABASE_URL` and the same admin session cookie
as the rest of the dashboard.

**Manual entry only, for now.** A KPI can be defined with
`data_source: analytics/crm/csv`, but it's created inactive with a
warning, since no automated calculation path exists yet for any of
those — only `data_source: manual` (you enter the number yourself each
period) is live. See `docs/kpi-manager-acceptance-criteria.md` for the
full schema, why `owner_user_id`/`entered_by_user_id` became plain-text
`owner_actor`/`entered_by_actor` fields (there's no multi-user `users`
table for this dashboard — one admin login, via
`ADMIN_USERNAME`/`ADMIN_PASSWORD_HASH`), and the 33 automated checks run
against the real endpoint code.

**Core design principle: append-only.** Correcting a period's value never
overwrites it — it creates a new version and marks the old one
superseded, keeping both. `scripts/kpi-roundtrip-check.js` (same pattern
as `scripts/db-roundtrip-check.js`) proves this against your own database
if you want to see it yourself:

```
DATABASE_URL='postgres://...neon.tech/db?sslmode=require' node scripts/kpi-roundtrip-check.js
```

## Inquiries Dashboard & Email Notifications (Section K)

Every submission from the Contact and Sample-Request forms has always
been saved to the `inquiries` table the moment it's submitted
(`netlify/functions/inquiries.js`) — this section adds two ways to
actually *see* that data, since neither existed before:

1. **An "Inquiries" card inside `/admin/analytics/`**, first thing on the
   page. Lists every inquiry newest-first, with a search box (filters by
   name/email/company/country/message client-side), a "Download CSV"
   button, and a "N new since your last visit" note + row highlight (per
   browser, via `localStorage` — not a real read-receipt system, just a
   convenience). Reuses the *existing* `GET /api/inquiries` endpoint,
   which already required the same `tc_session` admin cookie as the rest
   of the dashboard — no new backend route needed for the list itself.
2. **An emailed copy of each new inquiry**, sent via
   [Resend](https://resend.com)'s API (`netlify/functions/_email_lib.js`).
   Optional and off by default — if unconfigured, `inquiries.js` just logs
   and continues; a form submission is never blocked or failed by a
   missing or failed notification email.

### Setting up email notifications (optional)

1. Create a free Resend account (100 emails/day, 3,000/month — far more
   than this site will ever send) and copy an API key from their
   dashboard.
2. In Netlify: Site settings → Environment variables, add:

| Variable | Purpose |
| --- | --- |
| `RESEND_API_KEY` | Your Resend API key. Without this (or without `NOTIFY_EMAIL`), notification emails are silently skipped — nothing else depends on this. |
| `NOTIFY_EMAIL` | The address that should receive a copy of every new inquiry — normally your own. |
| `NOTIFY_FROM_EMAIL` | *(optional)* A "from" address on your own domain, once verified in Resend (e.g. `"Triple Company <inquiries@olivesegypt.com>"`). Left unset, this defaults to Resend's own sandbox sender (`onboarding@resend.dev`), which needs **no domain setup at all** to send to `NOTIFY_EMAIL` — just to your own registered address, which is exactly this use case. |

3. Redeploy (or trigger a new deploy) so the function picks up the new
   environment variables.

No new database table, no new auth — this reuses `DATABASE_URL` and the
`tc_session` cookie already in place for the rest of `/admin/analytics/`.

## Quotation & Invoice Generator (Section L)

The piece Section K explicitly left for later: a real quotation/invoice
generator tied to a specific buyer's data (the old pre-rebuild
`/dashboard/quotation` and `/dashboard/invoice` tools, deliberately
deferred rather than rebuilt when this site was — see commit `24cae36`'s
message for the original note, and Section H below for the CRM this
pairs with).

**How it works:**

1. From a buyer's page in the CRM (`/crm/buyer/?id=...`), a new
   **Documents** card lists every quotation/invoice issued to that buyer,
   with "New Quotation" and "New Invoice" buttons.
2. That opens `/crm/document/` — an editor: the buyer's info is
   read-only (pulled from their CRM record), then currency, incoterm, a
   valid-until date (quotations) or due date (invoices), notes, and a
   dynamic line-items table (description, unit, quantity, unit price —
   subtotal/total computed live as you type).
3. "Create Document" saves it and opens `/crm/document/view/?id=...` —
   the actual document, styled exactly like `/letterhead/` (same logo,
   fonts, layout). "Print / Save as PDF" uses the browser's own print
   dialog — no PDF-generation library or extra cost.

**Design decisions worth knowing:**

- **CRM buyers only** — every document is tied to a real buyer record;
  there's no "one-off, not-yet-a-buyer" path. Add the buyer to the CRM
  first (takes a few seconds) if they aren't in it yet.
- **Immutable once created.** There's deliberately no edit/update
  endpoint — a document is either kept as issued or **voided** (marks it
  `VOID` with a stamp on the printed page, keeps the row and its document
  number for your records; requires an explicit confirmation, same
  pattern as deleting a buyer). This matches how a real invoice/quotation
  should behave: you don't quietly rewrite one after the fact, you void
  it and issue a new one.
- **The buyer's details are snapshotted onto the document at creation
  time** (company name, contact, country) — editing that buyer's CRM
  record later never changes a document already issued to them.
- **Document numbers** are `Q-<year>-<6-digit-id>` / `INV-<year>-<6-digit-id>`
  (e.g. `INV-2026-000007`), derived from the row's own id — guaranteed
  unique with no separate counter/sequence to manage.
- **No tax/discount calculation.** Subtotal and total are the same
  number in this version (server-recomputed from quantity × unit price
  on every line, never trusted from the browser) — add tax, discounts,
  or other terms via the Notes field for now if you need them stated on
  the document.
- Same CRM session/auth as the rest of `/crm/` (`netlify/functions/crm-documents.js`,
  new `crm_documents` table) — no new environment variables, no separate login.

**Not built:** a searchable "all documents across every buyer" list (only
per-buyer, from that buyer's page) — flagging as a possible future
addition rather than building it speculatively now.
