# Private application access — Phase 9 inventory

**This repository is public** (`github.com/Mohamed00076/olivesegypt-site`,
visibility `public`). Everything below is written on that basis: no
credential, no session secret, no private hostname and no environment-variable
*value* appears here, and none should ever be added.

## 1. What actually exists

The task listed four apps. There are **two** private UIs in this repository,
not four:

| Named in the task | Reality |
| --- | --- |
| Analytics App | `/admin/analytics` — exists |
| KPI Manager | **not a separate app.** Built into `/admin/analytics` (119 `kpi` references in that one page), served by `kpi-dashboard.js`, `kpi-definitions.js`, `kpi-values.js` |
| CRM App | `/crm` — exists, with `/crm/login`, `/crm/buyers`, `/crm/buyer`, `/crm/kanban`, `/crm/document`, `/crm/document/view`, `/crm/forgot-password`, `/crm/reset-password` |
| Website Dashboard | **does not exist.** The old `/dashboard` route belonged to the pre-rebuild SPA bundle and was removed in Deploy 1 |

A third system, Umami, lives in the companion repository `umami-olivesegypt`
and is deployed separately. Its address is held in `UMAMI_URL` and is
deliberately **not recorded here** — it is the one private URL in this system
that is not already derivable from public repository contents.

These route paths are already public: they are directory names in a public
repository, so writing them down adds nothing an observer could not read
directly. Their protection is authentication, not obscurity — see §3.

## 2. Exposure controls

| Control | State |
| --- | --- |
| `robots.txt` | `Disallow: /admin` and `Disallow: /crm` present |
| `sitemap.xml` | zero `admin` or `crm` entries |
| Public navigation, header, footer | no link to either |
| `X-Robots-Tag: noindex, nofollow` header | applied to `/admin/*`, `/crm/*` and `/api/*` in `netlify.toml` |

`robots.txt` carries four stale rules — `/dashboard`, `/login`, `/quotation`,
`/invoice` — for routes that no longer exist. Harmless, but they advertise
historical route names to anyone reading the file. Not changed.

## 3. Server-side authorisation — enforced

Every function that returns private data checks a session server-side and
returns 401 without one. `robots.txt` is not being relied on:

| Guard | Functions |
| --- | --- |
| `verifySession` | `analytics`, `analytics-report`, `analytics-settings`, `analytics-privacy`, `auth-me`, `crm-auth-reset`, `kpi-dashboard`, `kpi-definitions`, `kpi-values` |
| `requireCrmSession` | `crm-activity`, `crm-auth-me`, `crm-buyers`, `crm-csv`, `crm-dashboard`, `crm-documents` |
| None, correctly | `auth-login`, `auth-logout`, `crm-auth-login`, `crm-auth-logout`, `crm-auth-forgot` — these *are* the login surface |

Three functions carry no guard because they are **scheduled**, declared in
`netlify.toml` and absent from the `/api/*` redirect map, so they have no
public HTTP route: `geo-refresh` (@weekly), `analytics-retention` (@daily),
`search-console-import` (@daily).

That is sound, but it rests on Netlify not exposing scheduled functions over
HTTP. It is worth being explicit about, because `analytics-retention`
**deletes data**: if a scheduled function ever became externally invocable, an
anonymous request could trigger a retention purge. A shared-secret check inside
that function would cost little and remove the dependency on that platform
behaviour. Not added here — flagging it as a decision.

`analytics-collect` is intentionally public and POST-only: it is the ingest
endpoint the site's own pages call.

Secrets are referenced by name only throughout — `SESSION_SECRET`,
`CRM_SESSION_SECRET`, `ADMIN_PASSWORD_HASH`, `DATABASE_URL`, `RESEND_API_KEY`,
`GSC_SERVICE_ACCOUNT_PRIVATE_KEY`, `UMAMI_PASSWORD`. No value appears in any
client-side file.

## 4. Secret scan — clean

Because the repository is public, both the working tree and the full commit
history were scanned for Resend keys (`re_…`), OpenAI-style keys (`sk-…`),
GitHub tokens (`ghp_…`), AWS keys (`AKIA…`), PEM private-key blocks and live
Postgres connection strings.

**Result: nothing found, in the working tree or in any commit.** The
`postgres://` matches are all documentation placeholders written literally as
`postgres://...`. `.gitignore` covers `.env` and `.env.*`.

## 5. Not done

- **No launcher/bookmark page was created.** The task makes that conditional on
  your explicit approval, and a page whose whole purpose is to concentrate
  links to private applications is exactly the kind of thing to confirm first
  rather than assume. Say the word and I will build it — as an authenticated
  page behind the existing session check, not a public one.
- **Live URLs were not confirmed by visiting them.** Outbound access to
  `olivesegypt.com` is blocked by policy in the environment this was written
  in, so the deployed addresses can only be confirmed by you or from Netlify.
