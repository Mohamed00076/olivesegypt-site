# Staging tests only you can run

Before you start, two conditions:
- **Smoke test:** it has passed (`docs/staging-setup.md` S1), and 15 minutes have passed since it finished.
- **Staging address:** `https://claude-auth-release-1--stirring-manatee-ca2643.netlify.app`.

**Why the order matters:** forgot-password allows 5 requests per 15 minutes from your connection and 3 per account per hour. Any request past those limits gets the normal answer, but no email is sent. The order below uses exactly 5, so do not add extra requests.

If an expected email does not arrive within 2 minutes:
1. Check Resend → **Emails** first.
2. If the email is not listed there, wait 15 minutes before trying again.

## A. Inbox delivery (Gmail, then Outlook)

- [ ] **A1. Request the Gmail email.** Open `/crm/forgot-password/`, enter `owner-test`, and send. The page says "If that account exists…".
- [ ] **A2. Check it in Resend.** Resend → **Emails** → the newest row is to your Gmail address and shows **Delivered**.
- [ ] **A3. Check it in Gmail.**
  1. Note whether it arrived in **Inbox**, Spam or Promotions.
  2. Open it → **⋮** → **Show original**. Check that SPF, DKIM and DMARC each say **PASS**, and that DKIM shows `olivesegypt.com`.
  3. Check the link starts with the staging address and contains `/crm/reset-password/#token=`.
  4. Don't open the link yet.
- [ ] **A4. Repeat for Outlook.** Request a reset for `owner-test-2`. In Outlook.com:
  1. Note **Inbox** or **Junk Email**.
  2. Open the message → **…** → **View** → **View message source**. In `Authentication-Results`, find `spf=pass`, `dkim=pass` and `dmarc=pass`.
  3. Check Resend shows **Delivered**.

## B. The reset link (the Gmail one, within 30 minutes)

- [ ] **B1. The link hides itself.** Open the link. The page is "Choose a new password", and the address bar no longer shows the code.
- [ ] **B2. A common password is refused.** Type `password123456` twice → "one of the most common ones".
- [ ] **B3. Mismatched passwords are refused.** Type two different passwords → "do not match".
- [ ] **B4. A good password works.** Set a real password of 12 or more characters. You see "Password changed… sign in", and you are **not** signed in.
- [ ] **B5. The "changed" email arrives.** A "password changed" email reaches Gmail, and Resend shows Delivered.
- [ ] **B6. The link works only once.** Open the same link again → "invalid, already used or expired".
- [ ] **B7. CRM sign-in works.** Sign in at `/crm/login/` as `owner-test` with the new password. The CRM opens.
- [ ] **B8. Analytics sign-in works.** Sign in at `/admin/analytics` as `owner-test`. The dashboard opens.

## C. Expiry and replaced links (uses your last 3 requests)

- [ ] **C1. Expiry.** Request a link for `owner-test-2`. Wait **31 minutes** and open it → refused.
- [ ] **C2. Replaced link.** Request two links for `owner-test`, one after the other. The **first** is refused; the **second** works. Set a password with the second.

## D. Emergency script rehearsal (staging only)

- [ ] **D1. Generate the SQL.** On your computer, in the repository, run `node scripts/auth-emergency-reset.js`. Enter:
  - Username: `owner-test`
  - A temporary password (12+ characters)
  - Admin: **y**
- [ ] **D2. Run it on staging.** In Neon, open the SQL Editor, **check that the branch selector says staging**, paste the whole printed block and click Run. It finishes without an error.
- [ ] **D3. You are forced to change the password.** Sign in at `/crm/login/` with the temporary password. You land on **Change password**. If you type `/crm/` into the address bar instead, the CRM does not open: you are sent to the sign-in page.
- [ ] **D4. Change it.** Change the password. You are signed out, the new password signs you in, and a "password changed" email arrives.
- [ ] **D5. Check the audit records.** On staging, run:

  ```
  SELECT occurred_at, app, event, detail FROM auth_events ORDER BY id DESC LIMIT 15;
  ```

  You should see `emergency_reset` and `password_changed`, plus the earlier `reset_*` and `login_*` rows.
- [ ] **D6. Rehearse the "wrong name" case.** Run the script again with the username `nobody-at-all` and paste the output into staging. Neon shows "No CRM user named nobody-at-all. Nothing was changed."

## Report back (copy, fill in, paste)

```
Smoke test: PASS/FAIL (summary block attached)
Gmail:   Inbox/Spam/Promotions   SPF __  DKIM __  DMARC __   Resend: Delivered/other
Outlook: Inbox/Junk              spf __  dkim __  dmarc __   Resend: Delivered/other
B1-B8: all OK / failed at __ (what you saw)
C1-C2: OK / failed at __
D1-D6: OK / failed at __
Login felt slow? yes/no
```
