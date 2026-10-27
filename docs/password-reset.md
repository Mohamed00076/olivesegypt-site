# Password reset: role mailboxes

The CRM and `/admin/analytics` password reset (#382, a draft; `netlify/functions/_auth_lib.js` there) never sends a reset link to a role mailbox, because a role mailbox reaches several people and a reset link must reach one (`ROLE_MAILBOXES`, `isRoleMailbox`).

| Address | Reset link allowed? | Why |
|---|---|---|
| `sales@`, `info@`, `contact@`, `admin@`, `noreply@`, `no-reply@` | no | role mailboxes (already in the list on #382) |
| `legal@` | **no**: add `legal` to `ROLE_MAILBOXES` at #382's next update (owner, 2026-10-27) | a role mailbox for privacy and data requests |
| `mohamed@` | **yes** | Mohamed's own mailbox: his CRM login and password-reset address |

#382 is not changed now (owner: do not touch #382 or #383). This file records the change for its next update.
