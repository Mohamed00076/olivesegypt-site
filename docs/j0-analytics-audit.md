# Section J Phase 0 — Analytics & Dashboard Audit

Required before any Section J code changes ("Phase 0 (required before any
code changes): written audit of current database schema, current tracking
script, current backend routes/endpoints, current dashboard components,
dashboard authentication/access control, deployment setup, and known
limitations. Do not implement until I confirm this audit is accurate.").

This audit covers **two separate systems**, because that's how the current
architecture actually works — this is itself the most important finding,
see "Known limitations & open architecture question" at the end.

1. **olivesegypt-site** (this repo) — the marketing site, its own Neon
   Postgres database, and a thin admin-only proxy to Umami's API.
2. **umami-olivesegypt** (`Mohamed00076/umami-olivesegypt`) — a real,
   self-hosted fork of the open-source Umami analytics platform
   (`umami` v3.3.1), deployed separately on Netlify with its own Postgres
   database, and it is where all raw pageview/session/event data actually
   lives today.

Nothing below is proposed or changed — it's a description of what exists
right now, verified by reading the actual source in both repos.

---

## 1. Current database schema

### 1a. olivesegypt-site's own Neon Postgres

No analytics-specific tables exist yet. The tables that do exist (all
`CREATE TABLE IF NOT EXISTS`, defined per-function in
`netlify/functions/`):

| Table | Written by | Purpose |
| --- | --- | --- |
| `inquiries` | `inquiries.js` | Contact/Sample form submissions |
| `leads_staging` | `leads.js` | Market-report / private-label signup leads (explicitly a staging table, not a production destination, per Section C7) |
| `consent_log` | `consent.js` | Accountability record of each consent choice — `device_hash` (one-way, truncated hash of IP+UA) is explicitly documented as **never to be reused as an analytics visitor ID** (Rule 23) |
| `buyers`, `buyer_stage_history`, `buyer_activity_log`, `crm_users`, `crm_audit_log` | `crm-*.js` | Section H's Buyer CRM — unrelated to visitor analytics |

None of these tables store pageviews, sessions, UTM data, or any
visitor-behavior event. There is currently no raw event store in this
repo's own database at all.

### 1b. umami-olivesegypt's Postgres (Prisma schema, `prisma/schema.prisma`)

This is where actual traffic data lives today. The relevant models
(trimmed to fields that matter for Section J; full schema has ~20 models
covering teams/reports/boards/etc. that are irrelevant here):

- **`Website`** — one row for `olivesegypt.com`, referenced by `website_id`
  everywhere below.
- **`Session`** — one row per (roughly) browser+IP+salt-period combination:
  `browser`, `os`, `device`, `screen`, `language`, `country`, `region`,
  `city`, `distinctId` (nullable — see §2), `createdAt`. **No raw IP
  column exists on this table or anywhere else** — only resolved
  geography is ever persisted.
- **`WebsiteEvent`** — one row per pageview or custom event:
  `sessionId`, `visitId`, `urlPath`, `urlQuery`, `pageTitle`,
  `referrerPath/Query/Domain`, **`utmSource/Medium/Campaign/Content/Term`**
  (all five, already parsed from the URL), **`gclid/fbclid/msclkid/ttclid/li_fat_id/twclid`**
  (ad-platform click IDs), `eventType` (pageview / custom event / link /
  pixel / performance), `eventName`, `tag`, `hostname`, plus Core Web
  Vitals (`lcp`, `inp`, `cls`, `fcp`, `ttfb`).
- **`EventData`** — key/value payload attached to a `WebsiteEvent`
  (string/number/date typed) — this is where `window.umami.track(name,
  payload)`'s custom payload keys land.
- **`SessionData`** — key/value data attached to a session via the
  `identify()` API (not currently used by this site — see §2).
- **`SessionLink`** — links a `distinctId` to a session (also part of the
  unused `identify()` path).
- **`SessionReplay`**, **`HeatmapEvent`** — this fork already has
  session-replay and click/scroll heatmap capture models. Not wired up
  from our site (no replay/heatmap script is loaded), but worth knowing
  they exist if ever wanted later — no new service required, it's already
  part of this deployment.
- **`Revenue`** — e-commerce revenue tracking. Not applicable (Section J
  is explicitly out-of-scope for payments).
- Storage backend: **plain Postgres via Prisma**, not ClickHouse — the
  ClickHouse path in this codebase is gated behind a `CLICKHOUSE_URL` env
  var that isn't set. Fine at this traffic volume; worth knowing this has
  a scale ceiling if traffic grows by orders of magnitude, but not a
  concern now.

---

## 2. Current tracking: two separate scripts

### 2a. `assets/consent.js` (Section G) — loads Umami, only after consent

Injects Umami's own hosted tracker
(`https://umami-olivesegypt.netlify.app/script.js`, `data-website-id`)
into `<head>`, but **only** after the visitor grants Analytics consent
(banner accept, or "Analytics" toggle in the preferences modal). Consent
defaults to denied; withdrawing consent simply stops injecting the script
on future page loads (no client-side routing to "un-fire" on this static
site).

### 2b. Umami's own tracker (`umami-olivesegypt`'s `src/tracker/index.ts`)

Once loaded, this auto-fires a pageview on load and listens for outbound
link clicks / hash changes. It POSTs to `/api/send` on the Umami app with:
`url`, `referrer`, `title`, `screen`, `language`, timestamp, and (for
custom events) a `name` + arbitrary `data` object from
`window.umami.track(name, data)`. **No cookie or localStorage value is
used for session identity** — the only `localStorage` key it touches is
`umami.disabled` (a manual opt-out flag), which is what makes Umami's
"no cookies" claim accurate. Session continuity across page loads on a
non-SPA site works differently — see §2d below.

### 2c. `assets/analytics.js` (Section E) — the site's own thin wrapper

`TC.trackEvent(name, payload)` is the only thing any of our own page code
calls. It:
- No-ops entirely if `TC.consent.analytics` is false (default) — same
  consent gate as above, enforced a second time defensively.
- No-ops if `window.umami.track` doesn't exist (script not loaded yet).
- Allowlists payload keys to exactly `{source_page, product, target,
  form, dedup_key}` — anything else is silently dropped before ever
  reaching Umami, per the G1 data-flow inventory's approved field list.
- Adds a `dedup_key` (a simple non-cryptographic hash of name +
  source_page + timestamp) to every event.
- Currently fires exactly **three** events, all via one delegated
  document-level click listener: `whatsapp_click` (any `wa.me/` link),
  `email_click` (any `mailto:` link), `specification_download` (any link
  to `/catalog/print` or `/downloads`).

There is currently **no** PDF/spec-sheet-download event that captures a
SKU/document identifier, no contact-form-submit event, and no hot-lead
logic of any kind — Section J Phase 1 #2 would be new work, not an
extension of something partial.

### 2d. What "session identity" actually means today (important for J's attribution design)

Umami's collect endpoint (`umami-olivesegypt/src/app/api/send/route.ts`)
computes `sessionId = uuid(websiteId, ip, userAgent, monthlySalt)` **on
every request, server-side, with no client-stored token required** — it's
deterministic, not random, so the same IP+browser naturally reproduces the
same `sessionId` across separate page loads within the same salt period
(`SALT_ROTATION`, default monthly) without needing a cookie. A separate
`visitId` is salted hourly and explicitly expires after **30 minutes of
inactivity** — this exactly matches Section J Phase 1 #3's "session
timeout: 30 minutes of inactivity" requirement; it's already built, not
new work.

This has real implications for Section J's attribution model:
- It is **not** a cookie or localStorage-based persistent ID — it's a
  hash of network-layer properties. Two different visitors sharing the
  same public IP and the same browser/OS/version (e.g. two people on the
  same office Wi-Fi) can collide into the same `sessionId`. This is a
  real accuracy limitation to disclose in the dashboard, not just in code
  comments, per J's explicit instruction on documenting the first-touch
  limitation.
- It changes automatically whenever the visitor's IP changes (switching
  networks) or the monthly salt rotates — so it is **not** stable enough
  on its own to be the "first observed visit for the same browser/device
  identifier" persistent ID that Section J Phase 1 #3 defines for
  first-touch attribution.
- Umami does have a separate, unused `identify()` API (`distinctId`,
  backed by `SessionLink`/`SessionData`) meant for exactly this kind of
  durable pseudonymous ID, but nothing on this site calls it today — the
  `distinctId` column is `NULL` on every row we currently have.

**This is an open design decision for Phase 1, not something I'm deciding
here**: either (a) start calling Umami's `identify()` with a
locally-generated UUID persisted in `localStorage` as the "persistent
non-PII visitor ID," or (b) build a fully separate first-party
identifier issued by our own backend, independent of Umami's session
model. Recommendation below.

---

## 3. Current backend routes/endpoints

### olivesegypt-site (`netlify.toml` → `netlify/functions/`)

| Route | Function | Auth | Purpose |
| --- | --- | --- | --- |
| `GET/POST /api/inquiries` | `inquiries.js` | GET: admin session. POST: public (rate-limited, honeypot) | Contact/Sample form |
| `POST /api/leads` | `leads.js` | Public (rate-limited, honeypot, strict field allowlist) | Market-report/private-label leads |
| `GET/POST /api/consent` | `consent.js` | GET: admin session. POST: public | Consent event log |
| `POST /api/auth/login`, `/logout`, `GET /me` | `auth-*.js` | — | Single hardcoded admin login (site-wide) |
| `GET /api/analytics` | `analytics.js` | Admin session (`tc_session` cookie) | **The only current analytics surface** — see below |
| `/api/crm/*` | `crm-*.js` | Separate CRM session (`tc_crm_session`) | Section H, unrelated |

`/api/analytics` is a **read-only, admin-authenticated proxy to Umami's
own REST API**, nothing more:
- Logs into Umami itself server-side using `UMAMI_USERNAME`/`UMAMI_PASSWORD`
  (a real Umami user account, not related to `tc_session`), caches the
  resulting bearer token in the function's warm-container memory, and
  re-logs-in once on a 401.
- Exposes exactly 7 report types, each a near-direct passthrough of one
  Umami API endpoint: `summary` (`/stats`), `timeseries` (`/pageviews`),
  `country`/`referrer`/`pages`/`browser`/`device`/`os` (all
  `/metrics?type=X`).
- Every other query parameter (range presets `7d`/`30d`/`90d`, custom
  `startAt`/`endAt`, `limit` capped at 50) maps directly onto Umami's own
  query params — there is no custom aggregation, filtering, or storage
  happening in this function at all.
- There is **no write path** here — nothing in olivesegypt-site can create
  or modify an analytics event. All ingestion happens entirely on the
  Umami side, out of this repo's control.

### umami-olivesegypt

- `POST /api/send` — the only ingestion endpoint (detailed in §2d above).
  Does its own Zod validation, including a CSV-injection guard on
  `name`/`tag` fields (rejects values starting with `=`, `+`, `-`, `@`,
  tab, or CR) — good practice already present, matching the pattern used
  in this repo's own CRM CSV export.
  - **Binary bot filter**: `isbot(userAgent)` — if true, the event is
    silently discarded (`{beep: 'boop'}` fake-success response, never
    written to any table). Gate-able via `DISABLE_BOT_CHECK` env var but
    otherwise unconditional.
  - **Binary IP block**: `hasBlockedIp(ip)`, driven by an `IGNORE_IP` env
    var (exact match or CIDR) — if matched, returns 403 and **the event
    is never stored**, full stop.
  - Both of these directly conflict with Section J Phase 1 #1's explicit
    requirement ("flag, never hard-delete" for internal traffic; a
    confidence *score* with reason codes, not a binary classifier, for
    bots) — flagged prominently in §6.
- Umami's own full dashboard/admin UI and REST API (users, teams, reports,
  etc.) — not exposed to or used by our site beyond the 7 read-only
  report types `analytics.js` proxies. Not otherwise relevant to Section J.

---

## 4. Current dashboard components

`admin/analytics/index.html` — a single static HTML page (Chart.js 4.4.1
via CDN, no build step, matching the rest of this repo):

- **Gate**: shows a "Sign in as Admin" prompt if `/api/analytics` returns
  401; otherwise shows the dashboard.
- **Range selector**: 7 / 30 / 90 days (hardcoded presets, no custom range
  UI, no rolling/lookback-window configuration).
- **KPI row**: Visitors, Pageviews, Bounce rate, Avg. session duration.
- **Traffic-over-time line chart**: pageviews + visits, hourly buckets if
  range ≤ 7 days else daily.
- **Rank lists**: Visitors by country, Top pages, Top referrers, Browsers
  (simple bar-styled `<li>` lists, XSS-safe via `textContent`).
- **Doughnut chart**: Devices.

That's the entire current feature set — no funnels, no UTM/campaign
breakdown UI, no bot/internal-traffic controls, no hot-lead or high-intent
event views, no B2B/company-identification UI, no live-visitor feed, no
settings panel of any kind. Every one of Section J's Phase 1–3 features is
new UI, not an extension of an existing partial one.

---

## 5. Dashboard authentication / access control

Single mechanism, shared by every current admin surface in this repo
(`/admin/analytics`, `/api/inquiries` GET, `/api/consent` GET):

- One hardcoded administrator, no user table: `ADMIN_USERNAME` +
  `ADMIN_PASSWORD_HASH` (`scrypt:<saltHex>:<hashHex>`) env vars.
- `netlify/functions/_lib.js`: HMAC-SHA256-signed session token
  (`base64url(payload).base64url(signature)`, not a standard JWT but the
  same shape), 7-day TTL, `tc_session` cookie (`HttpOnly`, `Secure`,
  `SameSite=Lax`).
- `SESSION_SECRET` env var signs it.
- This is a **completely separate** system from the CRM's `tc_crm_session`
  (Section H) and from Umami's own internal user/login system (which our
  site never exposes to visitors — `UMAMI_USERNAME`/`UMAMI_PASSWORD` are
  server-side-only credentials `analytics.js` uses to call Umami's API).

Section J's dashboard (Phase 1's settings panel, Phase 3's live-visitor
feed which the spec explicitly requires be "restricted to authenticated
administrators only... per Section H/J's authorization model") would
naturally sit behind this exact same `tc_session` gate — no new auth
system needed, matching what Section I's audit and Section H's build both
already established as the site's standing pattern for admin-only
surfaces.

---

## 6. Deployment setup

### olivesegypt-site
- Netlify: static `publish = "."`, functions in `netlify/functions/`, no
  build step.
- Env vars currently in use (site's own): `DATABASE_URL` (+ 3 fallback
  names), `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH`, `SESSION_SECRET`,
  `CRM_SESSION_SECRET` (Section H), `UMAMI_URL`, `UMAMI_USERNAME`,
  `UMAMI_PASSWORD`, `UMAMI_WEBSITE_ID`.

### umami-olivesegypt
- Also Netlify (`@netlify/plugin-nextjs`), separate site
  (`umami-olivesegypt.netlify.app`), separate Postgres database, separate
  repo/deploy pipeline entirely.
- Geo resolution: **already self-hosted MaxMind GeoLite2-City**
  (`scripts/build-geo.js` downloads the `.mmdb` at build time — from
  MaxMind directly if `MAXMIND_LICENSE_KEY` is set, otherwise from a free
  public redistribution mirror). This is a build-time step in the
  **Umami repo**, not something Section J needs to build — Phase 2's
  "country/city via MaxMind GeoLite2, free, self-hosted" requirement
  appears to already be satisfied end-to-end, including "store resolved
  city/country, not raw IP" (confirmed: no IP column exists anywhere in
  the schema). I have not personally verified a `MAXMIND_LICENSE_KEY` or
  `GEO_DATABASE_URL` is actually set in that site's live Netlify env —
  only that the code path exists and defaults to a free source if not.

---

## 7. Known limitations & open architecture question

**The central question this audit surfaces, which Phase 1 can't sensibly
start without an answer**: Section J's Phase 1–3 asks for things Umami's
schema and endpoints don't natively support as first-class, queryable
fields — a 0–100 bot-confidence score with reason codes and a documented
version, a hot-lead flag joining "PDF download + contact click in the
same session," a B2B reverse-IP/ASN cache, a live-visitor feed with an
audit log of *who viewed it*, a settings panel for adjustable thresholds.
None of that fits into Umami's `WebsiteEvent`/`EventData` model without
either (a) modifying the Umami fork's own schema and app code, or (b)
building all of this new logic as its own system in olivesegypt-site's
own Neon Postgres (new tables, same pattern as `inquiries`/`leads_staging`/
the CRM), treating Umami purely as a pageview/session data source to
*read from* via its existing API — never as the place new custom logic
lives.

**My recommendation, for your decision before Phase 1 starts:** option
(b). Reasons:
- Matches the pattern already established and approved this session for
  every other new feature (CRM, consent log, leads staging) — new tables
  in the same Neon DB, new serverless functions in this repo, zero new
  services (Rule 18).
- Keeps changes entirely inside this repo, which is the one this
  engagement is scoped to modify freely; the Umami fork is a real,
  running third-party-derived app with its own upgrade path — patching
  its internals to add bot-scoring/hot-lead columns means maintaining a
  divergent fork indefinitely.
- Directly resolves the "flag, never hard-delete" conflict in §3: if
  bot/internal-traffic scoring is our own logic on our own custom event
  writes, it can flag without touching Umami's separate hard-drop
  behavior on the pageview side at all (Umami's own pageview counts would
  still silently exclude known bots/`IGNORE_IP` traffic as they do today
  — worth deciding whether that's acceptable for the KPI/traffic-over-time
  numbers, or whether those should eventually move to our own pipeline
  too; I'd treat that as a later, separate decision, not a Phase 1
  blocker).
- Gives Section J's dashboard one consistent internal data source to
  build funnels/attribution/live-feed queries against, rather than
  stitching together two databases in the browser or in every function.

This does mean **some duplication**: high-intent events (PDF download,
WhatsApp/email click, contact submit) would likely need to be written to
*both* our own new event table (for J's custom logic) *and* still fired to
Umami via `TC.trackEvent()` (so they remain visible in Umami's own
timeline/session view, and cost nothing extra to keep doing). I'd
recommend keeping both rather than dropping the existing Umami event
firing, but this is worth your explicit confirmation too.

**Other limitations worth having on record before Phase 1:**

- Umami's `isbot()` check and `IGNORE_IP` block happen **before** any
  session/event row is ever written — today's pageview/visitor KPIs on
  `/admin/analytics` already silently exclude whatever traffic Umami's
  own bot/IP logic decided to drop, with no visibility into how much or
  why. Section J's confidence-scored, visible, reviewable bot detection
  would only apply to the new custom-event pipeline (option b above)
  unless Umami's own hard filters are also revisited later.
- No persistent, cookie-based visitor ID exists anywhere in the current
  system (see §2d) — Phase 1's first-touch attribution needs one built,
  it can't reuse anything that exists today as-is.
- `consent_log.device_hash` must **not** be reused as this new visitor
  ID (Rule 23, already enforced by a code comment in `consent.js`) — a
  new, separate identifier has to be minted specifically for this
  purpose, stored client-side (localStorage, most likely, to survive
  across the static site's full page loads), and must be invalidated on
  a verified deletion/consent-withdrawal request per Section J's own
  text.
- No existing settings/config storage exists anywhere in this repo for
  admin-adjustable thresholds (Phase 1's bot-confidence threshold panel)
  — would be new schema (a small `analytics_settings` key/value table,
  most likely, mirroring `crm_audit_log`'s simplicity).
- Rich Results/Search Console work in Phase 3 is separately gated by
  Rule 14 (no submission/authorization without your explicit go-ahead) —
  already noted in the Phase 3 spec text itself, repeating it here for
  completeness.
- I have not load-tested or traffic-tested any of this — all of the above
  is a static-code read of both repos, not a runtime observation of
  production traffic or actual Netlify env var values.

---

## What I need from you before Phase 1 starts

1. Confirm this audit is accurate (or correct anything I've gotten wrong).
2. Decide the architecture question in §7: build Section J's custom logic
   (bot scoring, hot-lead flags, funnels, live feed, B2B lookup) as new
   tables/functions in **this repo's own Neon Postgres**, reading Umami
   only for pageview/session stats via its existing API — or something
   else.
3. Confirm whether high-intent events should be written to both the new
   table *and* still fired to Umami (my recommendation), or only one.
4. Confirm the persistent visitor-ID approach: a new first-party
   localStorage-based ID minted by our own code (my read of the only
   viable option, since Umami's `identify()` would tie us to Umami's
   session model for something Phase 1 needs regardless of where the
   rest of the logic lives) — flag if you'd rather explore Umami's
   `identify()` API instead.
