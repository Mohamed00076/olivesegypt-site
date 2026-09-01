# Section J Phase 1 — Acceptance Criteria & Manual Verification

Per the spec's own requirement: "Acceptance criteria required for every
numbered feature before it's marked done: database schema changes
(migration script); API endpoints added/modified; UI components
added/modified; tests written and what they cover; a manual verification
method I can personally run to confirm the feature works as described."

This covers Phase 1's four numbered features plus the cross-cutting data-
quality safeguards. Commit: `4fc3fc1` on `claude/olivesegypt-analytics-kpi-crm-gbqn14`.

**Before you can run the manual steps below**, this needs to actually be
deployed with a real `DATABASE_URL` — nothing here has touched production,
and I haven't deployed it myself. Either:
- Push this branch live (Netlify will pick up the new functions and
  `netlify.toml` redirects automatically, no extra config beyond the
  `DATABASE_URL` this repo already has for `inquiries`/`consent_log`/the
  CRM — no new env var is required for Phase 1), or
- Run `netlify dev` locally with your own `DATABASE_URL` pointed at a
  scratch/dev Postgres database (Neon's free tier gives you a second
  branch for exactly this — see `docs/j0-analytics-audit.md`'s verified
  free-tier limits).

Every table below is created automatically (`CREATE TABLE IF NOT
EXISTS`) the first time any of the new functions runs — same pattern as
every other table in this repo (`inquiries`, `consent_log`,
`leads_staging`, the CRM tables). There's no separate migration file or
manual SQL step.

---

## 1. Internal & bot traffic filtering

**Schema**: `analytics_sessions.is_internal` (boolean, default false),
`bot_confidence` (integer, nullable = unknown), `bot_reason_codes`
(jsonb array), `bot_detection_version` (text), `bot_override` (boolean,
nullable = unreviewed). Created in `_analytics_lib.js`'s `ensureSchema()`.

**Endpoints**: `POST /api/analytics-collect` (writes `is_internal` at
session creation from the `ANALYTICS_INTERNAL_IP_ALLOWLIST` env var,
which you need to set for your own office/admin IP if you want this to
do anything — it's empty/unset by default, so nothing is flagged
internal out of the box). Bot confidence is written by the same endpoint
on an `engagement_signal` request (page-exit), scored server-side in
`_analytics_lib.js`'s `scoreBotConfidence()` — never shipped to the
browser. `GET /api/analytics-report?report=overview` exposes counts.
`GET /api/analytics-report?report=bot_review` lists near-threshold
sessions. `PATCH /api/analytics-settings` sets the threshold or a
per-session override.

**UI**: Dashboard's new "Bot / Internal-Traffic Review" card —
threshold input + save button, and a list of near-threshold sessions
with "Confirm human" / "Confirm bot" buttons. Overview KPI row shows
"Flagged Internal," "Bot-Suppressed," and "Unknown Bot Score" counts.

**Tests**: Verified via a mock-server Playwright run — automated
Chromium genuinely sets `navigator.webdriver = true`, and the resulting
session's engagement signal correctly scored `bot_confidence: 35` with
`bot_reason_codes: ["webdriver_flag"]`, confirmed by querying the mock
server's state directly after the run. (The real scorer in
`_analytics_lib.js` weighs `webdriver_flag` at +35, same as the mock's
simplified copy — a genuine human session with no other signals matching
would score 0, not 35.) The manual PATCH override was verified
separately via a direct API call: `bot_override` flipped from `null` to
`false` and stayed there.

**Manual verification** (needs a real deploy):
1. Visit the live site in a normal browser, accept the cookie banner.
2. Browse a couple of pages, wait ~10+ seconds before navigating away or
   closing the tab (so a real "had interaction" / "time on page" signal
   exists).
3. In `/admin/analytics/`, the "Bot / Internal-Traffic Review" card
   should show your session (if its score lands near the threshold) with
   a low confidence number and `no_signals_matched` or similar in the
   reason codes — a real human browsing normally should score low.
4. Set `ANALYTICS_INTERNAL_IP_ALLOWLIST` to your own current public IP in
   Netlify's environment variables, redeploy, revisit the site — the
   Overview KPI's "Flagged Internal" count should increment by one for
   that session. Nothing should ever disappear from the underlying data
   — you can confirm this by querying `analytics_sessions` directly in
   Neon's SQL console and seeing the row still there with `is_internal =
   true`, never deleted.
5. In the review panel, click "Confirm human" on a session — reload the
   dashboard, and that session should no longer appear in the review
   list (its `bot_override` is now locked to `false`).

---

## 2. High-intent actions

**Schema**: `analytics_events` (`event_id` UNIQUE, `session_id`,
`visitor_id`, `event_type`, `target_id`, `source_page`, `is_high_intent`,
`occurred_at`, `created_at`).

**Endpoints**: `POST /api/analytics-collect` with `type: "event"`.

**UI**: `assets/analytics.js`'s click delegation now calls
`TC.logEvent()` alongside the existing `TC.trackEvent()` for WhatsApp
clicks, mailto clicks, and `/catalog/print`/`/downloads` links (the
spec-sheet `?product=` query value is captured as `target_id`).
`contact/index.html` and `sample/index.html` each call `TC.logEvent('contact_form_submit', ...)`
at the exact point they already fire their existing Umami event — after
a confirmed successful `/api/inquiries` response (both forms post there),
never on client-side submit alone.

**Tests**: The mock-server run drove a real click on a `/catalog/print?product=`
link and a real form submission through the actual `contact/index.html`
code (with `/api/inquiries` mocked to return success), and confirmed both
`specification_download` and `contact_form_submit` rows were written with
the right `target_id`/`source_page`. A duplicate resend of the exact same
`event_id` was confirmed to insert nothing new (see "Data quality
safeguards" below).

**Manual verification**:
1. On the live site (cookies accepted), click the WhatsApp floating
   button, then an email link (e.g. `mailto:` on `/contact`), then a
   product's "View Specifications" link from `/downloads` or a product
   page.
2. Query `analytics_events` in Neon's SQL console (or once Phase 3's live
   feed exists, watch it there) — you should see three rows:
   `whatsapp_click`, `email_click`, `specification_download` (the last
   one with `target_id` set to the product slug from the URL).
3. Submit the real Contact form with test data — confirm a
   `contact_form_submit` row appears only after you see the "Thank you"
   success message, not the instant you click Submit.

---

## 3. Traffic source & campaign tracking

**Schema**: `analytics_sessions.utm_source/medium/campaign/content/term`,
`referrer_domain`, `attribution_source` (computed at session creation).

**Endpoints**: Written by `POST /api/analytics-collect` (session
creation only — captured once, at session start, never overwritten for
the life of that session). Read by
`GET /api/analytics-report?report=attribution&model=first_touch|last_touch`.

**UI**: Dashboard's "Attribution" card, with a First-touch/Last-touch
toggle.

**Tests**: Verified UTM precedence and the "Direct" fallback via code
review of `computeAttribution()` (unit-simple: `utmSource || referrerDomain
|| 'Direct'`), and confirmed via the mock run that a real session with no
UTM and no cross-site referrer was recorded with `attribution_source:
"Direct"`. The dashboard's First-touch/Last-touch toggle was exercised
(clicked, re-fetched, rendered without error) but the mock run's sessions
were all separate visitors, not one visitor returning across two
sessions with different sources — so the actual "first-touch vs.
last-touch disagree for the same visitor" case, which is the whole point
of the distinction, is still worth exercising yourself per step 3 below.

**Manual verification**:
1. Visit the site with `?utm_source=test_campaign` appended to the URL.
   Check `analytics_sessions` — that row's `utm_source` should be
   `test_campaign` and `attribution_source` should also read
   `test_campaign`.
2. Visit again in a private/incognito window (a fresh `visitor_id`) via a
   plain link with no UTM, coming from a bookmark or typed URL (no
   referrer) — that session's `attribution_source` should read `Direct`.
3. On the dashboard's Attribution card, toggle between First-touch and
   Last-touch and confirm the numbers can differ for a visitor who came
   in on a campaign link, then converted in a later, direct-navigation
   session — first-touch should credit the original campaign, last-touch
   should credit "Direct."
4. Read the note under the Attribution card and under the Funnel card in
   the dashboard — both should state the exact first-touch definition and
   limitations (storage clearing, private browsing, etc.) verbatim, not
   just in a code comment.

---

## 4. Basic funnel

**Schema**: Computed live from `analytics_sessions` + `analytics_events`
via `sql.query()` joins in `analytics-report.js` — no separate funnel
table; per the spec's technical requirement to "store raw event data,
build aggregations as views/queries on top, never by discarding detail."

**Endpoints**: `GET /api/analytics-report?report=funnel&source=<optional>`.

**UI**: Dashboard's "Funnel" card, four horizontal bars (Landing →
Catalog/Product Page → Spec-Sheet Download → Contact Click), with a
source filter dropdown populated from the range's actual distinct
`attribution_source` values.

**Tests**: The mock run's full funnel journey (home → catalog →
downloads → a spec-sheet click → contact form submit, all in one
session) confirmed all four underlying event types (`pageview` on a
`/catalog` path, `specification_download`, `contact_form_submit`) were
recorded against that session, and confirmed the dashboard renders
exactly four funnel-stage bars. I did not separately assert each stage's
computed *count* through the report endpoint in that run — worth
including in your own manual pass below.

**Manual verification**:
1. In one browser session, visit the homepage, then `/catalog/`, then
   click a spec-sheet download link, then submit the Contact form.
2. On the dashboard's Funnel card (default: all sources, last 30 days),
   all four bars should show at least 1.
3. Change the source filter to a UTM/referrer value your test session
   didn't use — the funnel should show 0 at every stage (this session is
   correctly excluded, not lumped into the wrong bucket).
4. Note the caption: country filtering is explicitly marked as Phase 2,
   not silently missing — Phase 2's geo work hasn't shipped yet.

---

## Data quality safeguards (cross-cutting, not one of the four numbered features)

- **Event dedup**: `analytics_events.event_id` has a real `UNIQUE`
  constraint; ingestion uses `INSERT ... ON CONFLICT (event_id) DO
  NOTHING`. Verified in the mock run: resending an identical payload
  (same `event_id`) left the event count unchanged.
- **Idempotent jobs**: Phase 1 has no scheduled/batch jobs (that's
  Phase 3's Search Console import) — not applicable yet.
- **UTC storage, Cairo-default display**: every timestamp column is
  `timestamptz` (Postgres normalizes to UTC internally); the dashboard
  converts to `Africa/Cairo` at render time
  (`toLocaleString('en-US', {timeZone: 'Africa/Cairo'})`) and states this
  explicitly in the Overview card's on-page note, not just a code
  comment.
- **Visible error count for failed event writes**: the Overview card
  shows "Ingest Errors (7d)," backed by a real `analytics_ingest_errors`
  table written to whenever the server receives a request but a DB
  insert fails. Its stated, on-page limitation: this can only ever count
  failures the server actually received — a request that never reaches
  the server at all (blocked, offline, a network failure before send) is
  invisible to any server-side count, and the dashboard says so rather
  than implying a complete picture.

---

## What I need from you

Nothing is blocking — Phase 1 is done and pushed. This document exists so
you have a concrete way to confirm each piece yourself rather than taking
my word for it, per the spec's own acceptance-criteria requirement.
Flag anything that doesn't check out and I'll fix it before Phase 2
starts.
