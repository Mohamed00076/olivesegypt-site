# Section J Phase 2 — Acceptance Criteria & Manual Verification

Same format as `docs/j1-acceptance-criteria.md`: schema, endpoints, UI,
tests, and a manual verification method for each Phase 2 feature. Commit:
see the Phase 2 commit on `claude/olivesegypt-analytics-kpi-crm-gbqn14`.

## The one real constraint this phase ran into

Phase 2's spec asked for "country/city via MaxMind GeoLite2." I looked
into actually building city-level resolution and hit a hard technical
wall: the **GeoLite2-City** database is ~60MB uncompressed, and Netlify
Functions have a **50MB unzipped bundle limit** (same as the AWS Lambda
runtime underneath) — confirmed by actually downloading and measuring
the file, not assumed. That size doesn't fit no matter how the rest of
the function is packaged.

**GeoLite2-Country** is a different, much smaller database (~8-9MB
uncompressed, confirmed the same way) with no city/region data, only
country. After flagging this to you, you chose: ship country-level now,
skip city-level rather than chase a workaround (Netlify Blobs, storing
the file outside the function bundle) whose own free-tier limits I
couldn't fully verify. That's what's built. If city-level ever becomes
important, the two real options are (a) a workaround like Netlify Blobs
once its limits are actually confirmed, or (b) moving geo resolution to
a different hosting target that doesn't have this bundle-size ceiling.

**Data source**: a free, unofficial GitHub-hosted redistribution mirror
(`github.com/GitSquared/node-geolite2-redist`) — the same fallback
`umami-olivesegypt`'s own build step uses when no MaxMind account is
configured. No account, no license key, no 90-day re-verification. The
tradeoff (also already flagged and chosen by you): not officially
sanctioned by MaxMind, so its update cadence and long-term availability
aren't guaranteed the way a licensed account's would be.

---

## Country resolution

**Schema**: `analytics_sessions.country` (text, two-letter ISO code,
nullable). Added via `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` in
`_analytics_lib.js`'s `ensureSchema()` so this backfills cleanly onto the
Phase 1 table that already exists — no separate migration step.

**Build step**: `scripts/build-geo.js`, run automatically by
`netlify.toml`'s new `[build] command` before every deploy. Downloads,
extracts, and writes `geo/GeoLite2-Country.mmdb` (gitignored, never
committed). Exits 0 even on failure — a geo-data hiccup must never fail
the whole site build; country resolution just returns null until the
next successful run.

**Endpoints**: Resolved server-side in `POST /api/analytics-collect`,
via `netlify/functions/_geo_lib.js`'s `resolveCountry(ip)` — opens and
caches the `.mmdb` reader once per warm function container. The request
IP is read transiently for this one lookup (and the existing internal-
IP-allowlist check) and is **never written to the database** — only the
resolved two-letter code is stored, matching the same pattern already
used for `is_internal`.

**UI**: Dashboard's new "Geography & Devices" card (By Country rank
list), and a new country filter dropdown on the Funnel card (populated
from the range's actual distinct resolved countries), alongside the
existing source filter. Verified with a mock-server Playwright run that
the dropdown populates correctly, that selecting a country actually
changes the funnel's rendered counts, and that selecting a source
**and** a country together sends both filters in the same request
(rewrote the two separate per-dropdown change listeners from Phase 1
into one `refreshFunnel()` that reads both current values, specifically
because adding a second filter alongside the existing one would
otherwise have had each selection silently drop the other).

**Tests**: Verified in two layers. First, the `maxmind` npm package
directly against the real, freshly-downloaded database file: `8.8.8.8`
→ `US`, a real Egyptian IP range → `EG`. Second, the actual
`analytics-collect.js` request handler end-to-end (real `_geo_lib.js`,
real `_analytics_lib.js`, real downloaded `.mmdb` file — only the
Postgres layer was a fake in-memory stand-in, since I don't have a live
database in this session): a request from `8.8.8.8` with a Windows
Chrome User-Agent produced a stored session with `country: "US"`,
`device_type: "desktop"`, `browser: "Chrome"`; a second request from an
Egyptian IP with an iPhone Safari User-Agent and `browser_language:
"ar-EG"` produced `country: "EG"`, `device_type: "mobile"`, `browser:
"Mobile Safari"`, `browser_language: "ar-EG"`. A third check confirmed a
later, non-new event on an existing session does **not** re-resolve or
overwrite that session's stored country/device/browser, even when sent
from a different apparent IP — matching the "captured once at session
start" design.

**Manual verification** (needs a real deploy):
1. Check the deploy log for a `[build-geo] wrote .../GeoLite2-Country.mmdb (N MB, ...)` line — confirms the build step actually ran and fetched a real file, not that it silently skipped.
2. Visit the live site from a normal connection, accept cookies, browse a page or two.
3. On `/admin/analytics/`, the "Geography & Devices" card's "By Country" list should show your own country with at least 1 session.
4. In the Funnel card, select your country from the new country dropdown — the funnel should still show your session's activity; select a different country you didn't visit from — it should show 0 everywhere.
5. If you want to confirm the constraint itself rather than take my word for it: try changing `scripts/build-geo.js`'s `db` target to `'GeoLite2-City'` and re-run the build locally (`node scripts/build-geo.js`) — the resulting file should be dramatically larger, and a Netlify deploy with it bundled would fail (I did not actually push a broken deploy to prove this negatively — the 50MB Lambda/Netlify Functions limit is Netlify's own documented, non-negotiable platform limit, not something I'm claiming from a local test).

---

## Device type & browser language

**Schema**: `analytics_sessions.device_type`, `.browser`, `.browser_language`
(all text, nullable). Same `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`
backfill as country.

**Endpoints**: `device_type`/`browser` are parsed **server-side** from
the request's real `User-Agent` header (via `ua-parser-js`, the same
library `umami-olivesegypt`'s own fork uses) — never trusted from a
client-supplied value, since the header is already authoritative and
free to read. `browser_language` comes from `navigator.language`,
captured client-side once at session start (like the UTM fields), since
that's genuinely more accurate than trying to infer it server-side from
`Accept-Language`.

**UI**: Same "Geography & Devices" card — "By Device" and "By Browser"
rank lists.

**Tests**: Verified `ua-parser-js` directly against three realistic
User-Agent strings (iPhone Safari, Windows Chrome, Android Chrome) before
wiring it in — correctly returned `mobile`/`Mobile Safari`,
`desktop`/`Chrome`, `mobile`/`Mobile Chrome` respectively.

**Manual verification**:
1. Visit the site from both a phone and a desktop browser (or use your
   browser's device-emulation mode for a quick check).
2. On the dashboard's "By Device" list, you should see both `desktop`
   and `mobile` (or `laptop`/`tablet` depending on what Chrome reports
   for the specific screen size) with real counts.
3. "By Browser" should show your actual browser names, not a generic
   fallback.

---

## What's still not done (Phase 3, per the spec's phased order)

B2B reverse-IP/ASN lookup, the live-visitor feed, and Search Console
integration (separately gated by Rule 14 regardless of anything else).
