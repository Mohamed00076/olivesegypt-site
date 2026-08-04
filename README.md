# Triple Company — olivesegypt.com

Marketing site and owner dashboard for Triple Company (Egyptian table-olive export).

## What this is

A pre-built static site (plain HTML/CSS/JS — there is **no build step**) plus a
small set of Node serverless functions under `api/`, designed to run on Vercel.

```
index.html, catalog/, contact/, media/, ...   static pages (pre-built, committed)
assets/                                       hashed JS/CSS/image bundles
api/                                          serverless functions (Node)
  _lib.js                                     shared auth helpers (not routed — leading _)
  auth/login.js, auth/me.js, auth/logout.js   owner login (scrypt + HMAC session cookie)
  inquiries.js                                contact-form submissions -> Postgres
  analytics.js                                owner-only proxy to the Umami instance
admin/analytics/index.html                    owner dashboard (login-gated)
vercel.json                                   rewrites + SPA fallback
```

## Requirements to run

- **Vercel** (or another host that runs Node serverless functions). `vercel.json`
  rewrites and the `api/` directory are Vercel-specific — plain GitHub Pages or
  any static-only host will serve the pages but **all `api/` routes and the admin
  dashboard will not work**.
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

Vercel's Neon integration also injects `POSTGRES_*` / `PG*` / `NEON_PROJECT_ID`
automatically. For the connection the code tries, in order:
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
vercel dev
```

## Deploying

```bash
vercel --prod
```

There is no build command and no output directory to configure — `vercel.json`
sets `outputDirectory: "."` and serves the repo root as-is.
