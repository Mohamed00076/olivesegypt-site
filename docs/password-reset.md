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

## 2. Staging setup

Every Neon, Netlify and Resend step, in order, with exact values and what
each looks like when it worked: **`docs/staging-setup.md`**. It ends with the
smoke test (`node scripts/staging-smoke-test.js <staging address>`).

## 3. Tests only you can run

Inbox delivery in Gmail and Outlook, the reset link, expiry, and the
emergency-script rehearsal, in an order that stays inside the rate limits:
**`docs/staging-owner-tests.md`**, with a report-back block to paste.

## 4. Going live (after your approval of the deployment request)

| Step | Who | What |
|---|---|---|
| 0 | You | Neon → **Branches → Create branch** `backup-2026-MM-DD` from production, **current data**. Instant, free, full copy |
| a | You | On the live database, mark your account admin (below) |
| b | You | Smoke test and the tests in section 3 all pass |
| c | Me | Merge (deploy). Everyone signs in once more |
| d | You, a week or two later | Delete `ADMIN_USERNAME` and `ADMIN_PASSWORD_HASH` from Netlify |

Step a, on the live SQL Editor, with your real CRM username:

```sql
ALTER TABLE crm_users ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;
UPDATE crm_users SET is_admin = true WHERE username = 'your-crm-username';
```

## 4b. Release 2: every session checked against its account

Deployed after Release 1, as its own deployment request.
- **Every gated function:** each of the 20 functions that read a session (plus deleting an enquiry or lead) now checks the session's account id and session number against `crm_users`, so a reset or password change signs that account out everywhere.
- **Analytics also checks:** that the account is still admin.
- **Sessions from before Release 1:** these carry neither number, so they are refused. Everyone signs in once more.
- **If the database can't be read:** the session is refused, never let through, and the failure alert reports it.
- **The emergency fallback login:** its sessions only work while `ADMIN_FALLBACK_LOGIN` is on.
- **Schema:** the columns it reads are created by Release 1 the first time anyone signs in. Release 1 must be live, with one sign-in done, before Release 2 is deployed.

## 5. Emergency: locked out of everything

`node scripts/auth-emergency-reset.js` on your computer (it asks for the
username and the new password, hidden; nothing is saved). Paste the block it
prints into the Neon SQL Editor and click Run. Sign in; you will be asked to
choose a new password straight away. If analytics is the problem, the script
can also grant admin access.

## 6. How long the sign-in records are kept

**Working default, pending counsel (owner decision 2026-10-18): option B.**
- **`auth_events`:** the scrambled IP is removed after 30 days, and the row is deleted after 90 days.
- **Reset-link rows (`crm_password_resets`):** deleted 7 days after they expire or are used.

The questions are rows 14 to 17 of `docs/g0-counsel-questions.md`. **No purge job exists yet**; it will be built once counsel answers. Until then, rows are kept.

## 7. Rollback

Revert the merge in GitHub (or ask me). The new columns and the
`auth_events` table stay and are ignored; old passwords and accounts keep
working. If analytics sign-in is the problem, set `ADMIN_FALLBACK_LOGIN` to
`on` and redeploy while the revert goes out.
