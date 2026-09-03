# Security & Functional Audit — 2026-09-02

Full audit of `olivesegypt-site` (both the public site and the two
internal apps it hosts — the Buyer CRM and the analytics/KPI dashboard),
requested directly, not tied to a specific spec block. Everything below
was actually checked, not assumed — commands and reasoning are noted so
you (or anyone else) can re-run the same checks later.

**Scope note**: `umami-olivesegypt` (the companion analytics fork) was
not touched — no code in this repo modifies it, and this session made
no changes there.

---

## Fixed

### 1. Timing side-channel in CRM login (real, exploitable)

`crm-auth-login.js` was designed to defend against username enumeration
by always running the expensive password hash check, even for a
nonexistent username — using a placeholder hash so a bad username
wouldn't respond measurably faster than a bad password for a real one.

The placeholder (`'scrypt:00:00'`) was the wrong *shape*: `verifyPassword`
rejects an undersized hash before ever calling `scryptSync`, so the
placeholder path actually returned in **~0.08ms**, versus **~48ms** for
a real check — measured directly, not estimated. A ~600x gap is easily
distinguishable over the network, meaning an attacker could enumerate
valid CRM usernames purely by timing responses, defeating the exact
protection the code's own comment says it provides.

**Fixed**: the placeholder is now a correctly-sized dummy hash (16-byte
salt, 32-byte hash, both hex), which does reach `scryptSync` and takes
comparable time (~59ms, measured). Verified with direct timing before
and after.

### 2. Admin analytics dashboard had no way to sign in (functional, not just security)

`/admin/analytics/`'s "sign-in required" gate linked to `/login` — a
route that stopped existing when the site was rebuilt off the old SPA.
Worse: **nothing anywhere in the current site ever called
`/api/auth/login`** — there was no login form at all, anywhere, for this
dashboard. The endpoint itself works correctly (verified directly,
below); it was simply never wired to any UI. Anyone trying to use the
analytics dashboard once the site is live would have hit a dead end.

**Fixed**: replaced the dead link with a real inline login form on the
gate itself (same page, no new route) — submits to `/api/auth/login`,
same pattern already used correctly by `/crm/login/`. Verified the
endpoint itself end-to-end (wrong password rejected, right password
accepted, cookie issued and its signature verifies) and the new form's
JS syntax.

### 3. No security headers anywhere

`netlify.toml` had zero `[[headers]]` blocks — no CSP, no
`X-Frame-Options`, no `X-Content-Type-Options`, no `Referrer-Policy`, no
`Permissions-Policy`.

**Fixed**: added a full baseline set, site-wide. Checked what the site
actually loads externally before writing the CSP (grepped every `.html`
file for external URLs) — only Chart.js from `cdn.jsdelivr.net` and
Google Fonts — so the allowlist is exact, not guessed.

**Honest caveat, stated plainly**: the CSP allows `'unsafe-inline'` for
`script-src` and `style-src`, because every page on this site (forms,
the CRM, the admin dashboard, the consent banner) is built from inline
`<script>` blocks and inline `style=""` attributes throughout — removing
that would mean restructuring every HTML file to external scripts with
nonces, a separate and much larger project, not something to do silently
as part of an audit. **This CSP is not primary XSS defense.** Its real
value here: even if a script ran, it can't load from or send data to an
unknown external host, can't inject via `<object>`/`<embed>`, can't
hijack a `<base>` tag, and the site can't be framed (clickjacking). The
actual primary XSS defense — consistent output-escaping — was checked
separately (see "Verified clean" below).

### 4. No `X-Robots-Tag` on `/admin/`, `/crm/`, `/api/` responses

This was flagged all the way back in the original A0 discovery pass as a
"non-urgent remediation," and then never actually done. HTML pages under
these paths already have `<meta name="robots">`, but JSON API responses
have no HTML to carry that in — so a header-level version is needed to
cover them too.

**Fixed**: added `X-Robots-Tag: noindex, nofollow` for `/admin/*`,
`/crm/*`, and `/api/*`.

### 5. Two small XSS defense-in-depth gaps in this session's own KPI Manager UI

Found while checking the new KPI Manager card added earlier this
session: `def.frequency` and the status label were interpolated into
`innerHTML` without the same `escKpi()` escaping used for every other
field on the same card. Real risk was low — both values are
database `CHECK`-constrained enums (`weekly`/`monthly` and a fixed
status list), not free text — but it didn't match the standard the rest
of this dashboard already holds itself to (its older render functions
use `textContent`/`createElement` throughout, specifically so nothing
needs to rely on a value being constrained elsewhere). Fixed to match.

### 6. `geo-refresh.js` was publicly, repeatedly triggerable

Netlify Scheduled Functions are still reachable at their normal function
URL unless the handler itself checks something — none of this site's
three scheduled functions (`geo-refresh`, `analytics-retention`,
`search-console-import`) did. Of the three, `geo-refresh.js` was the one
with a real consequence: each call POSTs to a Netlify Build Hook,
triggering a full site rebuild. Anyone who found the URL could trigger
unlimited rebuilds — a genuine resource/cost-abuse vector (Netlify build
minutes are metered), not a data-exposure one.

**Fixed**: added a DB-backed cooldown (won't actually fire the build
hook more than once per ~20 hours, tracked in the existing
`analytics_settings` table) rather than relying on an unverified
Netlify-internal signal to tell a real cron firing apart from a direct
call — this session has no way to confirm such a signal exists or
behaves a specific way, so it wasn't relied on.

**Not fixed the same way, and why**: `analytics-retention.js` (the data
purge job) and `search-console-import.js` have the same "reachable
without auth" property, but meaningfully lower impact — the purge is
idempotent (repeated calls just delete the same already-eligible rows,
no accumulating harm), and the Search Console import is already gated
behind an explicit `search_console_enabled` opt-in (off by default) plus
an UPSERT that can't duplicate data. Flagged here for completeness and
symmetry, not given the same code change, to keep this change
proportionate to actual risk rather than defensive-coding everything
uniformly regardless of impact.

---

## Verified clean (checked, not assumed)

- **Dependencies**: `npm audit` — 0 vulnerabilities across 46 packages.
- **SQL injection**: every database call in every function uses
  parameterized tagged-template queries (`` sql`...` ``). Grepped for
  string-concatenated queries and raw `sql()` calls with non-constant
  input — none found.
- **Code execution risk**: no `eval`, `new Function`, `child_process`,
  or `exec`/`execSync` anywhere in the application code.
- **Secrets in git history**: scanned the *entire* commit history (not
  just the current tree) for common secret patterns (connection strings
  with embedded credentials, AWS keys, private key headers, API tokens)
  — nothing found. `.gitignore` correctly excludes `.env`/`.env.*`.
- **Session cookies**: both the admin (`tc_session`) and CRM
  (`tc_crm_session`) cookies are `HttpOnly`, `Secure`, `SameSite=Lax`,
  with separate signing secrets and separate cookie names — a compromise
  of one session type can't be reused against the other.
- **Password hashing**: scrypt, correct per-user random salt, 32-byte
  output, verified with `crypto.timingSafeEqual` (constant-time
  comparison, not `===`).
- **Brute-force protection**: both login endpoints rate-limit at 20
  attempts/15 minutes per IP. Documented limitation: this is in-memory
  and resets on a cold serverless start, so it's real protection against
  a sustained attack from one warm instance, not a hard guarantee across
  a distributed one — a persistent (DB-backed) limiter would close that
  gap but adds its own write load; not built without you weighing in on
  whether it's worth it for a single-admin/small-team tool.
- **Error handling**: every function's catch block logs the real error
  server-side only (`console.error`) and returns a generic message to
  the client — no stack traces or internal details ever reach a
  response body. Checked every function file.
- **CORS**: no `Access-Control-Allow-Origin` header set anywhere, so the
  correct default (same-origin only) applies to every API response.
- **XSS output-escaping**: the CRM (`assets/crm.js`'s `escapeHtml`,
  used consistently across all four CRM pages) and the analytics
  dashboard's pre-existing render functions (hot leads, bot review, live
  feed — all use `textContent`/`createElement`, the safest possible
  pattern) both hold a consistently high standard. One
  hardcoded-static-array false alarm was checked and ruled out
  (`CRM.PRODUCTS` in a checkbox `value=""` — a fixed client-side
  constant, not data from any API).
- **CRM auth gating**: all four CRM pages call the shared
  `CRM.requireAuth()` before rendering anything, redirecting to
  `/crm/login/?next=...` on a 401 — consistent, no page skips it.
- **Build resilience**: `scripts/build-geo.js` is designed to never fail
  the whole site build on a download hiccup (`process.exit(0)` even on
  error) — ran it directly to confirm it also succeeds cleanly end to
  end when the download does work.
- **Broken links**: checked all 33 `sitemap.xml` URLs against real files
  (all present) and all 62 unique internal `href`s site-wide against
  real routes — the one break found (`/login`) is the dashboard-login
  gap fixed above; nothing else broken.
- **Structured data**: every `<script type="application/ld+json">` block
  on every page still parses as valid JSON after all of today's changes.
- **KPI Manager**: re-ran the 33-check integration test from its own PR
  after the escaping fixes above — still all passing.

## Not checked (honest gap, not silently skipped)

- **Production itself** — same limitation as everything else this
  session: the domain isn't confirmed reachable yet, so nothing here was
  verified against the *live* site, only against source code and local
  execution. Once the domain issue is resolved, a live pass (confirming
  headers actually arrive as configured, the new login form works
  end-to-end in a real browser, etc.) is still worth doing.
- **`umami-olivesegypt`** — out of scope, unmodified this session; if
  you want it audited too, that's a separate pass.
