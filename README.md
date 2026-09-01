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
   DATABASE_URL=postgres://... node scripts/crm-create-user.js <username> <password> ["Display Name"]
   ```
   Requires a password of at least 12 characters. Re-run any time to reset a
   password.
3. (Optional) Seed realistic fictional sample buyers so the dashboard and
   kanban board aren't empty on first use:
   ```bash
   DATABASE_URL=postgres://... node scripts/crm-seed.js
   ```
   Only inserts if the `buyers` table is currently empty — pass `--force` to
   insert anyway.
4. Visit `/crm/login/` and sign in.

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
