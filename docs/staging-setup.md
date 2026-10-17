# Staging setup sheet: password reset, release 1

Do these in order. Each step says what you should see when it has worked.
You do everything in your own browser; nobody needs your tokens, keys or
passwords. **Never paste a connection string, key or password into GitHub.**

Staging address used below:
`https://claude-auth-release-1--stirring-manatee-ca2643.netlify.app`

## Neon (the staging database)

| # | Do this | It worked when |
|---|---|---|
| N1 | Neon → your project → **Branches** → **Create branch**. Name `staging`. Parent: your production branch. Data: **Schema only**. *If "Schema only" is not offered:* **New Project** → name `olivesegypt-staging`, same region. Do not copy live data. | `staging` is in the branch list (or the new project opens). |
| N2 | On staging: **Connect** → copy the connection string. Pick the same kind as the live one: pooled if the live `DATABASE_URL` contains `-pooler`. Keep it to yourself. | You have a `postgresql://…` string whose host differs from the live one. |
| N3 | **SQL Editor**. Check the selector at the top says **staging**. Run:<br>`CREATE TABLE IF NOT EXISTS deployment_marker (environment text PRIMARY KEY);`<br>`INSERT INTO deployment_marker VALUES ('staging') ON CONFLICT DO NOTHING;` | `SELECT * FROM deployment_marker;` shows one row: `staging`. |
| N4 | Still on staging, create your test accounts (no password yet: you set one through Forgot password). Run the SQL below once, with your Gmail address on the first row and your Outlook address on the second. | `SELECT username, email, is_admin FROM crm_users;` shows `owner-test` (Gmail, true) and `owner-test-2` (Outlook, true). |
| N5 | The smoke-test account, which has **no email**, so nothing is ever mailed to it. On your computer, in the repository on branch `claude/auth-release-1`, run `node scripts/crm-create-user.js smoke-nonadmin "Smoke test (not admin)"`. Choose a password (12+ characters) and keep it in your password manager. Answer **N** to admin. Paste the printed SQL into the **staging** SQL Editor and Run. | `SELECT username, email, is_admin FROM crm_users WHERE username='smoke-nonadmin';` shows email NULL, is_admin false. |
| N6 | Safety check on the **live** branch: `SELECT to_regclass('deployment_marker');` | It returns NULL. The label must never exist on live. |

SQL for N4:

```
CREATE TABLE IF NOT EXISTS crm_users (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now(),
  username text NOT NULL UNIQUE, password_hash text NOT NULL, display_name text);
ALTER TABLE crm_users ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE crm_users ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;
INSERT INTO crm_users (username, password_hash, display_name, email, is_admin) VALUES
  ('owner-test',   'no-password-yet', 'Owner test (Gmail)',   'YOUR.GMAIL@gmail.com',     true),
  ('owner-test-2', 'no-password-yet', 'Owner test (Outlook)', 'YOUR.OUTLOOK@outlook.com', true);
```

## Netlify (settings for staging only)

Go to **Site configuration → Environment variables**. For each variable: **Edit** → **Different value for each deploy context**. **Do not change the Production value.**

| # | Variable | Deploy Previews | Branch deploys | It worked when |
|---|---|---|---|---|
| L1 | `DATABASE_URL`, plus `POSTGRES_URL`, `POSTGRES_URL_NON_POOLING` and `DATABASE_URL_UNPOOLED` if they exist | staging string (N2) | staging string (N2) | The variable shows 3 contexts, and Production still has the old value. |
| L2 | `DEPLOY_ENV` (new) | `staging` | `staging` | Production: no value. |
| L3 | `APP_BASE_URL` (new) | (empty) | `https://claude-auth-release-1--stirring-manatee-ca2643.netlify.app` | Production: `https://olivesegypt.com`. You can also set this at go-live. |
| L4 | `NOTIFY_EMAIL` | your personal address | your personal address | Production unchanged. |
| L5 | `ADMIN_FALLBACK_LOGIN` (new) | `off` | `off` | Production `off`. |
| L6 | **Branch deploys:** go to **Build & deploy → Continuous deployment → Branches and deploy contexts → Configure** → Branch deploys: **Let me add individual branches** → `claude/auth-release-1` → Save. | | | The setting lists the branch. |
| L7 | **Deploys → Trigger deploy** for branch `claude/auth-release-1`. Do this again after any variable change: variables only apply to a new deploy. | | | The deploy is labelled "Branch deploy" and is **Published**. The staging address opens `/crm/login/`. |

## Resend (email on staging)

| # | Do this | It worked when |
|---|---|---|
| R1 | Resend → **Domains** → `olivesegypt.com`. | Status **Verified**. The DKIM, SPF and MX records are all green. |
| R2 | Netlify: check that `RESEND_API_KEY` and `NOTIFY_FROM_EMAIL` apply to **Branch deploys**: "All deploy contexts", or a Branch-deploys value. Check that `NOTIFY_DRY_RUN` is unset or not `1` for Branch deploys. If you change any of them, repeat L7. | `NOTIFY_FROM_EMAIL` ends in `@olivesegypt.com`. Do not use the Resend test sender. |
| R3 | After each test email: Resend → **Emails**. | The latest row shows your test address and **Delivered**. "Bounced" or "Delivery delayed" means stop and tell me. |

## Smoke test (your computer)

| # | Do this | It worked when |
|---|---|---|
| S1 | In the repository (branch `claude/auth-release-1`, Node.js 18+, no `npm install` needed): `node scripts/staging-smoke-test.js https://claude-auth-release-1--stirring-manatee-ca2643.netlify.app`. Type the `smoke-nonadmin` password when asked; it stays hidden. | The last block reads `Result: PASS -- 35 passed, 0 failed`. Paste that block back to me. |
| S1+ | *Optional, sends one real email:* add `--send-one-email owner-test-2` to the end of the S1 command. | `Result: PASS -- 37 passed, 0 failed`, an `Email timing:` line, and one reset email to your Outlook address shown as **Delivered** in Resend → Emails. Ignore the email's link. |
| S2 | Wait the 15 minutes the script prints, then follow `docs/staging-owner-tests.md`. | |

Notes on the smoke test:
- **No email:** it never sends one, unless you add `--send-one-email`. That switch accepts only `owner-test` or `owner-test-2`, and sends exactly one email. It takes the place of one of the run's own forgot-password requests, so the run still makes 6, and the first 5 use up the 15-minute allowance as before. It also uses 1 of that account's 3 per hour. Use `owner-test-2`: `owner-test` needs all 3 of its own for the checklist.
- **Live site refused:** it will not run against `olivesegypt.com` or the site's own `stirring-manatee-ca2643.netlify.app` address.
- **At most twice an hour:** a third run can reach the alert threshold and send you one alert email.
- **"Temporarily unavailable" failures:** the database guard refused. Re-check N3, L1, L2 and L7.
