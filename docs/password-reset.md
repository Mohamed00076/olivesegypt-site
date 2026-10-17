# Sign-in and password reset: owner guide

Release 1 (branch `claude/auth-release-1`). One account opens both the CRM
and `/admin/analytics`; analytics needs the account to be marked admin.
Everything here is done in the Neon and Netlify dashboards; nothing needs a
terminal except the emergency script.

**This repository is public.** Never paste a connection string, a password or
a hash into an issue, a pull request or a commit.

---

## 1. Check your accounts (read-only, safe on the live database)

Neon → your project → **SQL Editor** → paste → **Run**. It changes nothing.

```sql
SELECT id,
       username,
       display_name,
       email,
       CASE
         WHEN email IS NULL OR email = '' THEN 'no email: cannot use Forgot password'
         WHEN split_part(lower(email), '@', 1) IN ('sales','info','contact','admin','noreply','no-reply')
           THEN 'shared mailbox: reset email will be blocked'
         ELSE 'ok'
       END AS reset_email_status
FROM crm_users
ORDER BY id;
```

## 2. Staging

### 2a. The staging database

1. Neon → your project → **Branches** → **Create branch**.
2. Name `staging`; parent: your production branch; data: **Schema only**.
   - If "Schema only" is not offered, do **not** copy the live data. Instead
     create a separate free Neon **project** named `olivesegypt-staging`
     (Neon → New Project) and use its connection string below. The site
     creates its tables itself on first use.
3. On the staging branch (or project): **Connect** → copy the connection
   string (it begins `postgresql://`). Treat it like a password.
4. Still on staging: **SQL Editor** → run once:

```sql
CREATE TABLE IF NOT EXISTS deployment_marker (environment text PRIMARY KEY);
INSERT INTO deployment_marker VALUES ('staging') ON CONFLICT DO NOTHING;
```

This label is how the code knows it is allowed to change this database from
a preview. Never create it on the live database.

### 2b. Netlify settings for staging

Netlify → your site → **Site configuration → Environment variables**. For
each variable: **Edit → "Different value for each deploy context"**. Leave
**Production** exactly as it is.

| Variable | Deploy Previews | Branch deploys |
|---|---|---|
| `DATABASE_URL` (and `POSTGRES_URL`, `POSTGRES_URL_NON_POOLING`, `DATABASE_URL_UNPOOLED` if they exist) | staging connection string | staging connection string |
| `DEPLOY_ENV` (new) | `staging` | `staging` |
| `APP_BASE_URL` (new) | leave empty | the branch-deploy address from 2c |
| `NOTIFY_EMAIL` | your own personal address | your own personal address |
| `ADMIN_FALLBACK_LOGIN` (new) | `off` | `off` (you switch it on for one test) |

For **Production**: set `APP_BASE_URL` to `https://olivesegypt.com`; leave
`DEPLOY_ENV` unset (or `production`); `ADMIN_FALLBACK_LOGIN` `off`.

Google Analytics and Umami never load on a preview or branch deploy, and the
public forms never send from one (deploys 254 and 256): only
`olivesegypt.com` reports. Nothing extra is needed for that.

### 2c. Turn on branch deploys for the release branch

They are off today (only deploy previews have ever run). Netlify → **Site
configuration → Build & deploy → Continuous deployment → Branches and deploy
contexts → Configure** → Branch deploys: **Let me add individual branches** →
add `claude/auth-release-1` → Save. Its address will be
`https://claude-auth-release-1--stirring-manatee-ca2643.netlify.app`; put
that in `APP_BASE_URL` for Branch deploys, then **Deploys → Trigger deploy**
on that branch so the settings take effect.

### 2d. Your test account on staging (personal email)

On the **staging** SQL Editor (never the live one), with your own personal
email address in place of the example:

```sql
CREATE TABLE IF NOT EXISTS crm_users (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now(),
  username text NOT NULL UNIQUE, password_hash text NOT NULL, display_name text);
ALTER TABLE crm_users ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE crm_users ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;
INSERT INTO crm_users (username, password_hash, display_name, email, is_admin)
VALUES ('owner-test', 'no-password-yet', 'Owner (staging test)', 'your.personal.address@gmail.com', true);
```

The account has no usable password yet: you give it one with **Forgot
password?**, which is the first thing to test. For the Outlook test, add a
second account the same way (`owner-test-2`, your Outlook address).

## 3. Manual tests on staging

On `https://claude-auth-release-1--stirring-manatee-ca2643.netlify.app`:

1. **Forgot password.** `/crm/forgot-password/` → `owner-test` → the page
   says "If that account exists…". The email arrives within a minute.
   - Note whether it landed in **Inbox** or **Spam**. In Gmail: open it →
     ⋮ → **Show original** → SPF, DKIM and DMARC should each say **PASS**.
   - Repeat with `owner-test-2` for Outlook (… → **View message source**,
     look for `spf=pass`, `dkim=pass`, `dmarc=pass`).
2. **The link.** It opens `/crm/reset-password/`, and the address bar no
   longer shows the code. Try `password123456` → refused as too common. Try
   two different passwords → "do not match". Then set a real one → "Password
   changed… Sign in with your new password". You are **not** signed in.
3. **"Password changed" email** arrives.
4. **Reuse.** Open the same link again → "invalid, already used or expired".
5. **Expiry.** Request a new link, wait 31 minutes, open it → refused.
6. **Supersede.** Request two links; the first one is refused.
7. **Someone else's name.** Request a reset for `nobody-at-all` → the same
   message, and no email.
8. **Sign in.** `/crm/login/` with the new password works.
9. **Analytics.** `/admin/analytics` → sign in with `owner-test` → the
   dashboard opens. With an account that is not admin → "does not have
   access to analytics".
10. **Fallback.** Set `ADMIN_FALLBACK_LOGIN` = `on` for Branch deploys,
    redeploy, sign in to analytics with the old Netlify username and password
    → works, and an alert email reaches `NOTIFY_EMAIL`. Set it back to `off`
    and redeploy → the old login is refused.
11. **Emergency script.** On your computer (needs Node.js): `node
    scripts/auth-emergency-reset.js` → paste the printed SQL into the staging
    SQL Editor → sign in with it → you are sent to "Change Password" straight
    away; nothing else in the CRM opens until you do.
12. **Throttle.** Request 6 resets in a few minutes → the 6th sends nothing
    (same message). After a few such tests an alert email may arrive: that is
    expected.

Tell me the results of 1 (Inbox or Spam, and the three PASS lines) for both
providers.

## 4. Going live (after your approval of the deployment request)

| Step | Who | What |
|---|---|---|
| 0 | You | Neon → **Branches → Create branch** `backup-2026-MM-DD` from production, **current data**. Instant, free, full copy |
| a | You | On the live database, mark your account admin (below) |
| b | You | Staging tests in section 3 all pass |
| c | Me | Merge (deploy). Everyone signs in once more |
| d | You, a week or two later | Delete `ADMIN_USERNAME` and `ADMIN_PASSWORD_HASH` from Netlify |

Step a, on the live SQL Editor, with your real CRM username:

```sql
ALTER TABLE crm_users ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;
UPDATE crm_users SET is_admin = true WHERE username = 'your-crm-username';
```

## 5. Emergency: locked out of everything

`node scripts/auth-emergency-reset.js` on your computer (it asks for the
username and the new password, hidden; nothing is saved). Paste the block it
prints into the Neon SQL Editor and click Run. Sign in; you will be asked to
choose a new password straight away. If analytics is the problem, the script
can also grant admin access.

## 6. Rollback

Revert the merge in GitHub (or ask me). The new columns and the
`auth_events` table stay and are ignored; old passwords and accounts keep
working. If analytics sign-in is the problem, set `ADMIN_FALLBACK_LOGIN` to
`on` and redeploy while the revert goes out.
