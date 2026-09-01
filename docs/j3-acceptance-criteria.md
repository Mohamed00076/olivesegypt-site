# Section J Phase 3 — Acceptance Criteria & Manual Verification

Same format as `docs/j1-acceptance-criteria.md` and
`docs/j2-acceptance-criteria.md`. Commit: see the Phase 3 commit on
`claude/olivesegypt-analytics-kpi-crm-gbqn14`.

---

## 5. Search Console

**Schema**: `search_console_performance` (natural key `(date, query,
page, device)`, upserted via `ON CONFLICT ... DO UPDATE` — never
append-only, since Search Console's own performance data arrives late
and gets corrected). `search_console_import_runs` (one row per attempt:
status, attempt_count, source date range, rows_upserted,
error_details). Both created via `ensureSchema()`. Settings:
`search_console_enabled` (**default `false`**), `search_console_lookback_days`
(default 16).

**Endpoints/jobs**: `netlify/functions/search-console-import.js`, a
daily scheduled function (`netlify.toml`: `@daily`). Checks
`search_console_enabled` and the three `GSC_*` env vars **before
constructing a Google API client at all** — if either gate fails, it
logs and returns without touching anything. Uses `google-auth-library`'s
`JWT` client (service-account auth, the standard pattern for
server-to-server access — avoids needing to host an OAuth callback,
which this static-site architecture has no clean way to do). Only calls
the read-only `searchAnalytics.query` endpoint — never the Indexing API.
Paginates via `startRow`, respecting the API's own 25,000-row-per-request
cap, capped at 20 pages per run as a defensive ceiling. `GET
/api/analytics-report?report=search_console` (admin) surfaces recent
runs and top queries. `PATCH /api/analytics-settings` toggles
`search_console_enabled`/`search_console_lookback_days`.

**UI**: Dashboard's "Search Console" card — enabled checkbox (with a
`window.confirm()` before saving `true`, since that's the point where it
starts actually calling Google's API), lookback-days input, a table of
recent import runs (status, date range, row count, error if any), and a
top-queries table (clicks/impressions/CTR/avg. position).

**Tests**: Could not test the actual Google API calls — this environment
has no real GSC credentials and no network path to Google's endpoints
from this sandbox either way (same network-policy limitation noted for
the RDAP bootstrap below). What *was* verified: `google-auth-library`
installs cleanly and is small (832KB) — no bundle-size risk, unlike
GeoLite2-City in Phase 2. The `configured()` gate and the
`search_console_enabled` check were verified via a mock-server Playwright
run: the dashboard defaults to disabled, shows a confirmation prompt
before enabling, and correctly renders runs/queries once (mock) data
exists. The disabled→enabled round trip through `analytics-settings.js`
was exercised for real (not mocked) — only the actual Google call itself
is untested.

**Manual verification** (only relevant if you do the setup):
1. Before doing the Google setup at all, confirm the dashboard's Search
   Console card shows "disabled" and an empty runs table — nothing
   should be there yet.
2. Do the setup in the README, set the env vars, redeploy.
3. Check "Enabled," confirm the dialog, save.
4. Wait for the next `@daily` run (or check Netlify's function logs for
   `[search-console-import]` lines) — the runs table should show a
   `success` row with a real row count within a day.
5. If it shows `error` instead, the `error_details` column has the
   actual message — check it against your service-account permissions
   (most common cause: the service account wasn't actually added as a
   Search Console user, or was added to the wrong property format).

---

## 6. B2B intelligence (reverse-IP → organization lookup)

**Schema**: `analytics_sessions.org_name`, `.org_resolution_type`
(nullable text). `ip_org_cache` (`ip_hash` PK — a one-way hash of the
IP, never the IP itself — `org_name`, `resolution_type`, `expires_at`,
30-day TTL).

**Endpoints**: Resolved in `POST /api/analytics-collect`'s
`engagement_signal` handling (same point as bot-confidence scoring —
page-exit, not pageview, keeping the RDAP round trip off the critical
path of a new session's first event). `netlify/functions/_b2b_lib.js`:
fetches IANA's own official RDAP bootstrap files
(`data.iana.org/rdap/ipv4.json`/`ipv6.json`, cached 24h) to find the
authoritative Regional Internet Registry for an IP, then queries that
registry's RDAP service directly — the documented-correct approach, not
a guess-across-five-registries or a third-party bootstrap proxy. A
3-second timeout on every network call; any failure resolves to
`resolution_type: "unknown"`, never an error that blocks the event
write. IPv4 only today (see README's known limitations).

**UI**: Hot Leads and Live Visitors panels both show `org_name` +
`org_resolution_type` where resolved, with `_b2b_lib.js`'s
`CLASSIFICATION_DISCLOSURE` text rendered verbatim alongside — not
paraphrased, not omitted.

**Tests**: `data.iana.org` and every RIR's RDAP host are unreachable
from this development sandbox (confirmed via the environment's own
agent-proxy status — `connect_rejected`, an explicit network policy
denial, not a code failure or a real-world outage). Given that, this was
tested in two layers instead: (1) the CIDR-matching logic
(`ipInCidr`/`findRdapBase`) directly, with synthetic bootstrap data —
confirmed correct matches and correct rejections for out-of-range IPs;
(2) the full `resolveOrg()` flow — bootstrap lookup, RDAP query, org-name
extraction (both the direct `name` field and the vcard-entities fallback
path), classification heuristic, and DB-backed caching — with `global.fetch`
mocked to serve realistic bootstrap/RDAP response shapes, confirming a
correct `corporate` classification for a Google-shaped response, a
correct `mobile` classification for a carrier-shaped response name, an
`unknown` result for an IP outside any mocked range, and a cache hit on
a second lookup of the same IP. **What's specifically unverified**: an
actual live HTTP round trip to IANA or any real registry, and therefore
whether the real bootstrap JSON's structure exactly matches what the
code expects. This is a real, stated gap, not a rounding-error caveat —
verify it yourself per the manual steps below before trusting the
feature.

**Manual verification** (needs a real deploy):
1. Visit the live site from a normal (non-VPN) connection, browse for at
   least a few seconds so the page-exit engagement signal fires.
2. Check `analytics_sessions` for that session (or wait for it to show
   up in the Live Visitors panel) — `org_resolution_type` should be
   something other than the literal string you'd get from a total
   failure ideally `corporate`/`isp`/`mobile` with a real `org_name`, not
   just `unknown` for every single visit (an occasional `unknown` is
   expected and fine; *always* `unknown` would indicate the live
   bootstrap-fetch path isn't working as designed).
3. Read the disclosure text on the Hot Leads or Live Visitors panel and
   confirm it reads as a real caveat, not marketing copy — this was a
   spec requirement, not a nice-to-have.

---

## 7. Live visitor feed

**Schema**: No new columns — reads `analytics_sessions.last_seen_at`
(already updated by every event and every engagement signal — no
separate heartbeat mechanism needed) plus the same fields Phase 1–2
already produce. `analytics_audit_log` (new table): actor, action,
occurred_at, details — one row per load of this view.

**Endpoints**: `GET /api/analytics-report?report=live_feed` (admin-only,
same gate as everything else). "Active" is precisely: `last_seen_at`
within `live_feed_active_minutes` (configurable, default 5) of now.
Sessions past that window simply don't appear in this query's results —
"expiring" from the feed is a query-time filter, never a deletion.
Explicitly excludes anything sensitive by construction, not by
filtering: this pipeline never stores raw IPs, full referrer URLs with
query strings, contact-form contents, or any free-text event payload
anywhere, so there's nothing sensitive for this endpoint to accidentally
leak in the first place.

**UI**: Dashboard's "Live Visitors" card — active-minutes setting,
15-second client-side auto-refresh (togglable checkbox), one row per
active session (entry page, last event type, source, country, device,
browser, org data, internal flag if set, last-seen time).

**Tests**: Verified via mock-server Playwright: the panel renders
sessions with all the expected fields including the org disclosure text,
the auto-refresh checkbox defaults to checked. Audit logging was
verified via the real handler code path in the Phase 1/2 test patterns
(the `auditLog()` call is a direct, simple INSERT — the same function
already exercised working correctly in the privacy-deletion integration
test below).

**Manual verification**:
1. Open the Live Visitors panel with a second browser tab actively
   browsing the site (accepted cookies).
2. Confirm that tab's session appears within the active window.
3. Wait past the configured active-minutes window (or lower it to 1
   minute and wait) without any further activity in that tab — confirm
   the session drops out of the feed.
4. Query `analytics_audit_log` and confirm a `view_live_feed` row exists
   for each time you loaded the panel.

---

## 8. Multi-path funnels

**Schema**: `analytics_settings.funnel_definitions` — a JSON array of
`{id, name, stages: [{label, event_type, source_page_prefix?}]}`.
Seeded with three: Standard (the original Phase 1 path), WhatsApp-First,
Direct Inquiry (no download step).

**Endpoints**: `GET /api/analytics-report?report=funnel&funnel_id=...`
now builds its SQL dynamically from the selected definition's stage
list (parameterized — event types passed as a bound `text[]` array,
source-page prefixes as bound `LIKE` patterns — not string-concatenated)
instead of the fixed 4-stage query from Phase 1. Also returns
`available_funnels` so the UI can populate its selector without a
separate request.

**UI**: A funnel-definition dropdown added to the existing Funnel card,
alongside the source/country filters — all three combine in one request
via a single `refreshFunnel()` (Phase 2 already fixed the
source-vs-country double-listener bug this could have reintroduced; this
just extends the same pattern to a third filter).

**Tests**: The dynamic SQL generation was inspected directly (a mock
`sql.query` capturing the exact generated text/params) to confirm
correct parameter indexing and correct `ANY($n::text[])`/`LIKE`
placement for a multi-stage, mixed (with and without a source-page
prefix) definition — this is a genuinely new query-building pattern in
this codebase (array-typed bound parameters), reviewed carefully but,
like the RDAP calls, not confirmed against a live Postgres connection
from this environment. Playwright confirmed all 3 seeded definitions
appear in the dropdown, switching definitions updates the card's title,
and (from the Phase 2 pass) that combining filters actually sends all of
them together.

**Manual verification**:
1. On the dashboard, switch the funnel dropdown between all three
   definitions and confirm the stage labels genuinely change (not just
   the title) — e.g., WhatsApp-First should show only 2 stages, not 4.
2. Combine a funnel definition with a source and a country filter and
   confirm the counts change sensibly as you adjust each one
   independently.

---

## Privacy & retention (cross-cutting requirement, not one of the 4 numbered items)

**Schema**: `deleted_visitor_ids` (visitor_id PK, deleted_at). Setting:
`data_retention_days` (default 395).

**Endpoints**: `netlify/functions/analytics-privacy.js` — `GET` returns
the current retention policy; `PATCH` updates it (1–3650 days,
audit-logged); `POST` with `action: "delete_visitor"` deletes a
visitor's data, **requiring `?confirmed=1` server-side**, same
defense-in-depth pattern as the CRM's bulk delete/export (not just a
client `confirm()` dialog). `netlify/functions/analytics-retention.js`
— daily scheduled purge of session/event rows older than the retention
window (a real `DELETE`, not a soft flag — deliberately distinct from
the bot/internal "flag, never delete" stance used for traffic
*classification* elsewhere in this pipeline; retention is a different
question). `analytics-collect.js` checks every incoming `visitor_id`
against `deleted_visitor_ids` before writing anything, and returns
`{reset_visitor: true}` if it's blocked — `assets/analytics.js` reads
that signal (via a `fetch`, not `sendBeacon`, specifically for the
event that starts a new session, since `sendBeacon` has no readable
response) and clears its local visitor/session IDs so the browser mints
a genuinely fresh, unrelated one next time.

**UI**: Dashboard's "Privacy & Retention" card — retention-days setting,
and a delete-by-`visitor_id` form (get the ID from the Hot Leads or Live
Visitors panels) with a `window.confirm()` before the (also
server-confirmed) delete call fires.

**Tests**: Fully verified end-to-end against the real handler code
(`analytics-collect.js` and `analytics-privacy.js`, fake in-memory
Postgres) — no network dependency, no untested gap here, unlike RDAP/GSC:
1. Wrote a real event for a test `visitor_id`.
2. Confirmed a delete attempt *without* `confirmed=1` is rejected (400)
   and the event survives untouched.
3. Confirmed a delete attempt *with* `confirmed=1` actually removes the
   session and event rows, and writes an audit-log entry.
4. Confirmed a subsequent write attempt under that same (now-deleted)
   `visitor_id` is silently rejected — no row is written — and the
   response carries `reset_visitor: true`.

Also verified via mock-server Playwright: the retention-days field loads
the correct default (395), the delete form's confirm dialog appears, and
a successful deletion shows the right status message.

**Manual verification**:
1. Note a real `visitor_id` from the Hot Leads panel.
2. Delete it via the Privacy & Retention card.
3. Confirm it's gone from `analytics_sessions`/`analytics_events` (or
   from the dashboard's own reports).
4. If you have access to that same browser/device, revisit the site —
   confirm (via dev tools → Application → Local Storage) that a new,
   different `tc-analytics-visitor` value appears rather than the old
   one being reused.
