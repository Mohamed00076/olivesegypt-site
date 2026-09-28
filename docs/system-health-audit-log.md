# System Health Audit Log

An append-only record of full audits of the website, the CRM and the
analytics system. Each run adds one dated entry at the bottom. **No entry is
ever edited or deleted**; a later run records what changed.

## How this log works

- **One entry per run**, holding: the date, the commit audited, whether the
  live site could be reached, a status for every numbered item in Parts A to E,
  and a comparison with the previous run.
- **Statuses:** `pass`, `fail`, `needs-attention`, `not run` (with the reason).
- **REGRESSION** marks an item that passed in an earlier audit and fails now.
  Regressions rank above long-standing known issues: something that was right
  broke again, unnoticed.
- **Outstanding across N audits** is called out in a run's summary for any
  `needs-attention` item left unresolved for three or more consecutive runs.
- **Cadence:** monthly at minimum; also after any batch of deploys touching
  authentication, the database schema, environment variables, or a previously
  flagged area (the docs/scripts exposure, CRM writes, consent gating). A
  lighter security-only pass (Parts A and C) can run in between.
- **Nothing runs this automatically.** The repository has no CI
  (`.github/workflows` does not exist) and the Netlify build runs no tests. A
  run happens only when someone asks for one. The run index below makes gaps
  in the cadence visible rather than assumed away.

## Run index

| Run | Date | Commit audited | Live site reachable? | pass | needs-attention | fail | not run | Regressions |
|---|---|---|---|---|---|---|---|---|
| 1 | 2026-09-28 | `ff07532` | No (egress policy) | 16 | 12 | 2 | 2 | 3 (B4, B6, E3) |

---

## Run 1 — 2026-09-28

**Commit audited:** `ff07532` (main after Deploy 57).
**Mode:** read-only diagnosis. Nothing on the site, the CRM or any database was
changed; nothing was deployed. This log is the only file written.
**Previous run:** none in this log. Where an item overlaps the 2026-09-02
security audit (`docs/security-audit-2026-09.md`), that audit is the baseline
for the comparison.

### Limits of this run

- **The live site could not be reached.** This environment's network policy
  refuses `olivesegypt.com`, `www.olivesegypt.com` and
  `stirring-manatee-ca2643.netlify.app` (`host_not_allowed`). Every item that
  asks for a live test was instead tested against the real code: the real
  handlers, the real Neon driver, PostgreSQL 16 and Chromium, using dummy
  records in a throwaway local database. Each such item says so. The live
  commands at the end of this entry close the gap.
- **No production data was read.** Items asking for a spot check of real data
  (C5, D5) were exercised on local data only.
- **No access to Search Console or the Netlify or Neon dashboards.**

### Urgent findings (reported separately during the run)

1. **Conditional authorization bypass between the CRM and the analytics admin
   (C2 / E2).** If `CRM_SESSION_SECRET` is unset in Netlify, the CRM falls back
   to `SESSION_SECRET`. Both apps sign sessions with the same function, and
   neither checks which app a token was issued for. Tested with it unset: a CRM
   user's token, placed in the admin cookie, returned 200 from
   `analytics-report`, `analytics-settings`, `kpi-definitions` and
   `analytics-privacy` (which deletes visitor data). The admin token also worked
   as a CRM session. With distinct secrets, every crossover returned 401.
   Exploiting it needs an existing CRM login and hand-copying a cookie.
   Whether production is affected depends on one Netlify value this run cannot
   see. The fallback has existed since `a6b25d8` (2026-09-01), so it is **not a
   regression**. The 2026-09-02 audit's "separate signing secrets" finding
   assumed the environment was set correctly.

Not classed as urgent, but ranked first among the dependency findings: the
Umami fork pins Next.js 16.3.0, which is under two critical RCE advisories
(E1).

### Item status

#### Part A — Website security and exposure

| # | Status | Evidence |
|---|---|---|
| A1 | needs-attention | **docs/, scripts/ and the five root audit files are pruned** (the real pruner run against a real copy of the tree; `check-publish-exclusions` passes). **Published but not meant to be public:** `.gitignore`, `package.json`, `package-lock.json` and `README.md`. README is on the "published by design" list pending the owner's call; it lists env var names but no values. **New:** `geo/GeoLite2-Country.mmdb` (about 8–9 MB) is downloaded into the publish root at build time, and is neither pruned nor blocked. It is probably downloadable from the domain (a bandwidth cost, and a question under MaxMind's licence). Whether Netlify also serves `node_modules/` is unverified. Live: not run. |
| A2 | needs-attention | In config: a `/netlify/*` rule forces 404, and so does one for `/netlify.toml`. Last live observation (owner, 2026-09-24): `/netlify/functions/auth-login.js` serves the homepage, not the source; the status code was never established. Live re-test blocked this run. |
| A3 | pass | No credential patterns (Resend, Stripe, AWS, Google, GitHub, Slack, private keys, Neon `npg_`, connection strings with passwords, JWTs) in any published file, both export-catalog PDFs, or the 14 gated guides. No source maps published. Ten client JS files scanned by name. |
| A4 | pass | All 12 CRM pages and the admin page carry `noindex, nofollow`. `X-Robots-Tag: noindex, nofollow` is set for `/admin/*`, `/crm/*` and `/api/*`. robots.txt disallows `/crm` and `/admin`. Minor: four stale robots.txt rules (`/dashboard`, `/login`, `/quotation`, `/invoice`). |
| A5 | pass | `check-absolute-paths` passes (4/4). The only machine-path text in tracked files is a historical description inside register row C-95. |
| A6 | not run | Blocked by egress. DNS only: the apex resolves to 75.2.60.5 (Netlify's load balancer) and `www` to Netlify hosts. HTTPS validity and the www/non-www redirect need the live commands below. |

#### Part B — Website content and claim integrity

| # | Status | Evidence |
|---|---|---|
| B1 | needs-attention | Scanned the visible text, meta tags and JSON-LD of 104 documents (52 Arabic, including the gated guides and both PDFs). **None found:** factory-ownership claims (Arabic hits are "منشأتنا الشريكة", our *partner* facility), completed-export claims, company certification claims (ISO/HACCP appear only as advice to buyers), testimonials, "Olives Egypt" as a brand, or "Export Specialist". **Needs attention (not regressions):** `/media` and `/ar/media` still say "2025/26 Harvest Season Now Open", a year stale. The same pages carry "New Brining Line Lifts Capacity Past 2000 MT"; the owner confirmed 2000 MT in triage on 2026-09-02 (`438eb8e`), but it has no claim-register row. The FAO/IOC market statistics (Egypt 23% of world production, +45% growth, "Africa's leading exporter") have been on /resources since 2026-09-01/03 with no register row. |
| B2 | pass | `check-identity-strings` passes: 117 pages and 60 generators, approved names only. "Export Specialist": 0 hits. Both PDFs carry the legal name; the Arabic one was verified after normalising its pre-shaped letters. |
| B3 | needs-attention | 128 JSON-LD blocks on 101 pages, **all parse**. No page carries `offers`, so there is no Merchant Listing exposure. Repeated `Product` nodes appear only in the 11-item product lists (legitimate). Minor: the homepage list names all 11 products, but only some are visible on the page; and "Stuffed Green Olives Export" in JSON-LD differs from the visible "Stuffed Green Olives" (since 2026-08-04). |
| B4 | **fail — REGRESSION** | **Web pages: correct.** The price-offer values from #133–#135 (jars 320–1050 ml, cans 65 mm/A9/A10/A12, 4 kg PET pail for jalapeño only, Red jalapeño, 140–360) are in both languages. **Barrel: untouched.** 66 files mention a barrel, and none changed its barrel wording between `6d3f763` (before #133) and HEAD. **Not propagated:** (1) the four gated guides (Packaging Overview and Pricing & Packaging Guide, EN and AR) still say "Common sizes from 300g to 1.7kg", the figure #133 corrected on the web pages; (2) both export-catalog PDFs predate the change (see B6). |
| B5 | pass | 115 pages, 7,270 internal links resolved with Netlify's real precedence (file first, forced rules, then the catch-all counted as broken): **0 broken, 0 soft-404s.** 0 real locale mismatches; the 44 raw hits are each Arabic page's `hreflang` and language-switch link to its own English twin. **Long-standing:** the non-forced `/*` → `/index.html` 200 catch-all (since 2026-08-24, flagged 2026-09-24) makes any mistyped URL return the homepage with 200. |
| B6 | **fail — REGRESSION** | Only two PDFs exist (the English and Arabic export catalogs, gated). Both open (10 pages each) and have selectable text; Arabic is stored as pre-shaped letters, so text search inside it is weak. **Both are stale.** They were created 2026-09-17/18 and never regenerated after #133–#135. They still carry per-variety caliber grades including the withdrawn 101/110, have no 140–360, and have none of the new jar or can sizes, the pail or Red jalapeño. The English one still says jars run "300g to 1.7kg". The cover says "Revised 2026-09-06". The company profile and spec sheets are printable HTML, not PDFs; their sources are current. |
| B7 | not run | No Search Console access from this environment. Owner to check. |

#### Part C — CRM security and data integrity

| # | Status | Evidence |
|---|---|---|
| C1 | pass (local) | Every function (33, behind 26 API routes) was called with no cookie, using GET, POST, PATCH, PUT and DELETE, against a database stub that records every query. **All CRM, KPI and analytics-reporting endpoints returned 401 with 0 data queries.** Public endpoints (forms, logins, collector, guide) behave as designed. Known and accepted since 2026-09-02: the three scheduled functions answer any caller (geo-refresh has a cooldown). Live: not run. |
| C2 | needs-attention (**urgent, conditional**) | 27 authorization checks: 26 pass. Cross-app access is refused with distinct secrets. Forged, expired, tampered and cross-signed cookies are refused. Delete, erase, enquiry delete and both exports require `confirmed=1`. The admin session can export the Market Brief list; that is by design (it may already read leads) and the export is audited under that user's name. The CRM has a single staff role. **Conditional bypass:** see urgent finding 1. |
| C3 | pass (local, real DB) | 24/24. Create, edit, stage change, note and delete each give a real confirmation and land in the database. With a fault on each, each returns an error message, writes a `crm_failures` row for the dashboard, and sends an alert email (dry-run adapter). With the database fully down, the email still goes out. Faulted writes do not half-happen. All 17 logging error handlers report. **Caveat:** the email reaches a person only if `NOTIFY_EMAIL` and `RESEND_API_KEY` are set (C4). |
| C4 | needs-attention | **`LEADS_NOTIFY` is not the enquiry switch.** It gates only gated-guide download emails (`leads.js`). Contact-form enquiries need `NOTIFY_EMAIL` plus `RESEND_API_KEY`, and `NOTIFY_FROM_EMAIL` to reach more than the Resend account's own address. Staging adapter with a dummy enquiry: `status=dry-run recipients=2`, Reply-To to the enquirer (tested in `check-email-lib`). With `NOTIFY_EMAIL` unset: `status=skipped`. Production values are not visible here; last recorded as unset (outstanding item 10, open since Deploy 11). |
| C5 | needs-attention | The validation is live in code: `check-company-name-quality` passes 16/16, and it applies on create, edit and pipeline intake. A re-scan of real records needs production data; the owner can open `/crm/data-quality`. |
| C6 | pass | No default follow-up date on manual create or CSV import (the import brings in no dates). Deploys 28–31 recorded that none ever existed. Pipeline intake deliberately sets tomorrow, paired with a visible next action (owner-approved). |
| C7 | pass (minor note) | Both exports pass every cell through `csvCell`. Leading `= + - @` are neutralised. Leading TAB and CR are not prefixed (OWASP lists both); low risk, because stored inputs are trimmed. Exports need a session, `confirmed=1`, and are audited. |
| C8 | pass | No credentials in client code. Across the repository and history, the only matches are test fixtures (user `user`, placeholder hosts). One canary Neon-style password in `scripts/check-crm-errors.js`: owner to confirm it doesn't match the real one. |

#### Part D — Analytics security and accuracy

| # | Status | Evidence |
|---|---|---|
| D1 | needs-attention | All analytics and KPI endpoints return 401 unauthenticated (C1 sweep). Login works in code: a wrong password gets 200 with `ok:false` and no cookie; the right one gets a session cookie. **"`/admin/analytics` cannot be signed into"** was carried from 2026-09-17 to Deploy 26, then dropped from the record with no resolution recorded. Probably `ADMIN_USERNAME` / `ADMIN_PASSWORD_HASH` in Netlify. Owner to confirm. |
| D2 | pass (local browser) | Fresh visitor: banner shown, **0 tracking requests** before a choice (two pages). After Reject: 0 on later pages, stored `analytics=false`, no visitor ID created; the only API call records the choice. After Accept: collection and the Umami script start. Withdrawing in Manage preferences: 0 collection afterwards. **Separate finding:** Google Fonts (`fonts.googleapis.com`) loads on 105 pages before any choice, sending each visitor's IP address to Google. `/privacy` does not list Google. Present since 2026-08-04. |
| D3 | pass | `consent_id` appears only in `consent.js` (created, stored, returned). No client code stores or reads it. The analytics visitor ID is a separate random UUID. |
| D4 | needs-attention (in progress) | Since Deploy 35 an enquiry stores the analytics session it came from, with consent only; disclosed via #157 (C-112). **No report joins enquiries to how the visitor arrived**, so search-to-enquiry attribution is still unanswered. |
| D5 | pass (local, real DB) | Deduplication: the same event sent twice was stored once. Bot scoring: a crawler with the webdriver flag scored 93 against a threshold of 70; an interacting human scored 0. KPI Manager (`kpi-roundtrip-check.js`): a correction adds version 2, keeps version 1, leaves exactly one current version, and audits both. Real production data not spot-checked. |
| D6 | pass | No Search Console key, MaxMind key or Umami credentials in client code; those are server-side environment values. The Umami script URL and website ID are client-side by design (public in any Umami install). |

#### Part E — Cross-cutting infrastructure

| # | Status | Evidence |
|---|---|---|
| E1 | needs-attention | **Site:** `npm audit`, 0 vulnerabilities across 46 packages (the same as 2026-09-02). **Umami fork** (3.3.1, synced 2026-08-20): `pnpm audit --prod` finds 45 advisories (3 critical, 31 high, 9 moderate, 2 low). Critical: Next.js 16.3.0, fixed in 16.3.3. GHSA-p293-qw3h-jr36 (RCE on Windows hosts) does not apply on Netlify. GHSA-2xp9-vwfh-vxw4 (RCE via AVIF in Next's `sharp` image optimizer) is likely not reachable, because the Netlify Next.js plugin normally handles images; unverified. Also critical: shell-quote, build-time only. Nothing upgraded. |
| E2 | needs-attention | 27 environment variables read (names only). **Admin:** `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH`, `SESSION_SECRET`. **CRM:** `CRM_SESSION_SECRET` (falls back to `SESSION_SECRET`; see urgent finding), `URL`, `DEPLOY_PRIME_URL`. **Database:** `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `POSTGRES_URL`, `POSTGRES_URL_NON_POOLING`; the first one set wins, so a stale alias could shadow the intended one. **Email:** `NOTIFY_EMAIL`, `NOTIFY_FROM_EMAIL`, `RESEND_API_KEY`, `NOTIFY_DRY_RUN`, `LEADS_NOTIFY`. **Analytics:** `UMAMI_URL`, `UMAMI_USERNAME`, `UMAMI_PASSWORD`, `UMAMI_WEBSITE_ID`, `ANALYTICS_INTERNAL_IP_ALLOWLIST`, `ANALYTICS_RETENTION_DRY_RUN`, `GSC_SERVICE_ACCOUNT_EMAIL`, `GSC_SERVICE_ACCOUNT_PRIVATE_KEY`, `GSC_SITE_URL`. **Build:** `NETLIFY_BUILD_HOOK_URL`. Which are set in production is not visible from here. |
| E3 | **needs-attention — REGRESSION** | 45 of 46 `check-*.js` guards are in `npm test`, all pass, none duplicated or missing. The `exit(0)` calls are success exits, not bypasses. **REGRESSION:** `check-locale-switch.js` (manual browser check since 2026-09-05, never in `npm test`) now fails 2 of 36 twice in a row: switching language at the bottom of `/` and `/contact` lands at the top of the Arabic page. Guards run only when someone runs `npm test`; the Netlify build runs none. |
| E4 | pass | Every commit on every branch (470) scanned for secret patterns. Matches are test fixtures only (see C8). |
| E5 | pass (caveat) | **Website:** the last three code deploys (`f78c681`, `0ce9e76`, `ff07532`) each revert cleanly with `-m 1` in a throwaway worktree. A notes-only deploy conflicts only with later notes. **Schema:** 59 additive DDL statements; the one relaxation (`crm_documents.buyer_id DROP NOT NULL`) doesn't break older code, so a code rollback needs no migration. **Data:** Neon point-in-time restore and its retention window can only be checked in the Neon console. Erased buyers and deleted enquiries are recoverable only through it. |

### Comparison with the previous audit (2026-09-02)

| Item | 2026-09-02 | 2026-09-28 | Change |
|---|---|---|---|
| Dependencies (site) | 0 vulnerabilities / 46 | 0 / 46 | unchanged |
| Secrets in history | clean | clean (470 commits) | unchanged |
| Session separation | "verified clean" | conditional bypass if `CRM_SESSION_SECRET` is unset | latent since 2026-09-01; newly found, not a regression |
| Broken links | 0 of 62 hrefs | 0 of 7,270 links | unchanged |
| JSON-LD parses | yes | yes (128 blocks) | unchanged |
| X-Robots-Tag on private routes | fixed | present | unchanged |
| Scheduled functions reachable | accepted (geo-refresh cooldown) | same | unchanged |
| Export catalog PDFs match the site | matched (rebuilt Deploy 10) | stale since #133–#135 | **REGRESSION** |
| Locale-switch scroll | passed (2026-09-05) | 2 of 36 fail | **REGRESSION** |
| Umami dependencies | not audited | 45 advisories | first audit |

**Outstanding across N audits:** not applicable in run 1. For reference, open
for many deploys already: enquiry notifications unset (since Deploy 11),
Section D never run against production, the admin sign-in item dropped without
resolution, and the soft-404 catch-all.

### Prioritised action list (by real risk and cost, not by ease)

Nothing here has been fixed. Each item needs separate approval.

1. **Confirm `CRM_SESSION_SECRET` is set and differs from `SESSION_SECRET`**
   (owner, one minute), then approve a code fix binding each token to its app.
2. **Enquiry emails:** set `NOTIFY_EMAIL`, `RESEND_API_KEY` and
   `NOTIFY_FROM_EMAIL`. A buyer's enquiry currently reaches no one unless
   someone opens the CRM; this also switches on the failure alerts.
3. **Update the Umami fork** to a release with Next.js 16.3.3 or later (and its
   dependencies). It is a public instance with an admin login.
4. **Stale downloads (REGRESSION):** regenerate both export-catalog PDFs, and
   correct "300g to 1.7kg" in the four gated guides. Buyers are receiving
   withdrawn caliber grades and a wrong jar range.
5. **Google Fonts before consent, undisclosed:** self-host the fonts or
   disclose them. A privacy-counsel question, alongside C-55.
6. **Close the remaining root exposure:** 404 rules for `/geo/*`,
   `/package.json`, `/package-lock.json` and `/.gitignore`; decide on
   `README.md`.
7. **Live verification pass:** allow the three hosts in the environment's
   network settings, or run the commands below (A1, A2, A6, C1 live; D1
   sign-in; B7 Search Console).
8. **Confirm the `/admin/analytics` sign-in works** (dropped item).
9. **Content upkeep:** replace the stale harvest teaser; add register rows for
   the 2000 MT capacity teaser and the FAO/IOC statistics.
10. **Soft-404 catch-all:** decide whether unknown URLs should return 404.
11. **Locale-switch scroll (REGRESSION, minor):** fix, and treat the manual
    check as part of this audit.
12. **Minor:** `csvCell` TAB/CR prefix, the JSON-LD product-name mismatch,
    stale robots.txt rules, the PDF cover date.
13. **Attribution report (D4):** a feature decision for the owner.

### Live commands for the owner (safe: read-only, change nothing)

```
curl -sI https://olivesegypt.com/docs/deployment-record.md          # expect 404
curl -sI https://olivesegypt.com/scripts/prune-publish.js           # expect 404
curl -sI https://olivesegypt.com/netlify/functions/auth-login.js    # expect 404
curl -sI https://olivesegypt.com/netlify.toml                       # expect 404
curl -sI https://olivesegypt.com/geo/GeoLite2-Country.mmdb          # expect 404 (A1 finding)
curl -sI https://olivesegypt.com/package.json                       # expect 404 (A1 finding)
curl -sI https://olivesegypt.com/node_modules/isbot/package.json    # expect 404
curl -sI http://olivesegypt.com/        # expect 301 to https
curl -sI https://www.olivesegypt.com/   # expect 301 to the apex (or the reverse, but one only)
curl -s -o /dev/null -w '%{http_code}\n' https://olivesegypt.com/api/crm/buyers   # expect 401
curl -s -o /dev/null -w '%{http_code}\n' https://olivesegypt.com/api/analytics-report   # expect 401
curl -s -o /dev/null -w '%{http_code}\n' -X DELETE 'https://olivesegypt.com/api/crm/buyers?id=999999999'   # expect 401 (no confirmation, nonexistent id: harmless even if auth were broken)
```

---
