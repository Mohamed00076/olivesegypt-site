# Email delivery — configuration and runbook

Covers every outbound email the site sends. Written for Phase 7.
**No secret values appear here, or should ever be added here — variable names only.**

## 1. What sends email

| Trigger | Function | Recipients | Reply-To |
| --- | --- | --- | --- |
| Contact / sample / quote forms (8 forms, `/api/inquiries`) | `netlify/functions/inquiries.js` | `NOTIFY_EMAIL` (may be several) | the enquirer |
| Gated guide downloads (6 forms, `/api/leads`) | `netlify/functions/leads.js` | `NOTIFY_EMAIL` — **off unless `LEADS_NOTIFY` is on** | the enquirer |
| CRM password reset | `netlify/functions/crm-auth-forgot.js` | the CRM user's own address | — |

All three go through `netlify/functions/_email_lib.js`, which talks to Resend's
HTTP API directly. There is no SDK dependency.

## 2. Environment variables (set these in Netlify, not in the repo)

| Name | Required | Notes |
| --- | --- | --- |
| `RESEND_API_KEY` | for any send at all | Without it every send is skipped and logged as `status=skipped`. |
| `NOTIFY_EMAIL` | for owner notifications | **Comma- or semicolon-separated for several mailboxes.** A single address still works exactly as before. |
| `NOTIFY_FROM_EMAIL` | **effectively yes — see §3** | The sender. Must be on a domain verified in Resend. |
| `NOTIFY_DRY_RUN` | no | `1` / `true` / `yes` logs what would be sent and sends nothing. The staging adapter for testing the call path without real delivery. |
| `LEADS_NOTIFY` | no | `1` / `true` / `yes` turns on gated-guide notifications. Off by default — see §5. |

To route the three internal mailboxes, set `NOTIFY_EMAIL` to the three
addresses separated by commas. Keeping them in an environment variable rather
than in code is deliberate: recipient lists do not belong in a source
repository, and this way changing them needs no deploy.

## 3. The one thing most likely to be broken

`NOTIFY_FROM_EMAIL` defaults to Resend's sandbox sender,
`onboarding@resend.dev`. **That sandbox sender can only deliver to the address
the Resend account itself is registered under.** Every other recipient is
rejected by the API.

So if `NOTIFY_FROM_EMAIL` is unset:

- notifications reach at most one mailbox, whichever one matches the Resend account;
- routing to several mailboxes cannot work at all;
- CRM password-reset emails to any other user fail.

The library now logs a loud warning when it detects this combination
(sandbox sender + more than one recipient) instead of failing quietly.

**Fix:** verify `olivesegypt.com` in Resend, then set `NOTIFY_FROM_EMAIL` to an
address on it. SPF, DKIM and DMARC only become meaningful once that verified
domain exists — until then, no authentication records apply to mail claiming
to be from this site.

## 4. Logging policy

Every send logs exactly one line:

```
[email] form=<type> recipients=<count> status=sent message_id=<provider id>
[email] form=<type> recipients=<count> status=failed reason=<status + provider detail>
[email] form=<type> status=skipped reason=<which variable is missing>
```

`form` is the form type (`inquiry`, `inquiry:quote`, `lead:buyers_guide`, …) and
`message_id` is Resend's id, so a specific message can be traced end to end.

**Never logged:** message bodies, recipient addresses, the API key, or any
visitor's personal data. An inquiry body contains the buyer's own message and
contact details; function logs are not the place for it. The tests in
`scripts/check-email-lib.js` assert each of these.

## 5. Why gated-guide notifications are off by default

`leads.js` writes to `leads_staging` and its file header records a standing
constraint: it is *"a local/staging test adapter only until the owner approves
a real lead destination… Do not repoint this at a production destination
without that approval."*

Sending these leads to a live inbox is that step. The capability is built and
tested, but gated behind `LEADS_NOTIFY` so switching it on is a deliberate
decision rather than a side effect of this change. The database write is
unchanged either way.

## 6. How to test without sending real mail

1. Set `NOTIFY_DRY_RUN=1` in a Netlify deploy-preview context.
2. Submit a form with **test data only** — never a real person's details.
3. Look for `status=dry-run` in the function log. That proves the whole call
   path executes: validation, database write, recipient resolution, payload
   construction.
4. Remove `NOTIFY_DRY_RUN`, then send one real message to a mailbox you own.

`node scripts/check-email-lib.js` (part of `npm test`) covers the library's
behaviour offline, with `fetch` stubbed — no key needed and nothing sent.

## 7. Still missing

Known gaps, not addressed by this pass:

- **Bounce and suppression handling.** No webhook endpoint exists, so a hard
  bounce is invisible.
- **Delivery history.** Nothing records which notification was sent for which
  inquiry; the provider's dashboard is the only record.
- **DMARC policy.** Cannot exist until the sending domain is verified (§3).
- **`product_interest` values are display copy.** The Arabic and English forms
  submit different strings for the same product, and those strings change when
  display wording changes. Giving the `<option>` elements stable `value`
  attributes would decouple stored data from copy.
