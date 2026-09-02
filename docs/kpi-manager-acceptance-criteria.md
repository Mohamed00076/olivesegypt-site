# Section J2 — KPI Manager: Acceptance Criteria & Manual Verification

Per the spec's own requirement: "Acceptance criteria required for every
numbered feature before it's marked done: database schema changes
(migration script); API endpoints added/modified; UI components
added/modified; tests written and what they cover; a manual verification
method I can personally run to confirm the feature works as described."

This covers J2's delivery-order steps 1–4 (schema confirmed and built,
manual-entry KPIs implemented and tested, dashboard view built) plus the
authorization/audit-log requirement (step 5). **Automated (analytics-
sourced) KPIs — step 3, "implement automated KPIs only for events that
already exist and are live in J1" — are not built in this pass.** Creating
a KPI with `data_source` other than `manual` is accepted (as metadata) but
forced `is_active = false`, per J2's own instruction to flag rather than
build against a calculation path that doesn't exist yet.

Every table is created automatically (`CREATE TABLE IF NOT EXISTS`) the
first time any KPI function runs — same pattern as every other table in
this repo. There's no separate migration file or manual SQL step.

---

## Two deviations from J2's literal spec, confirmed with the site owner before writing code

1. **No `users` table exists** for `/admin/analytics` (a single hardcoded
   admin identity via `ADMIN_USERNAME`/`ADMIN_PASSWORD_HASH`, not a
   database row — `crm_users` is a different app's login, not this one).
   `owner_user_id`/`entered_by_user_id`/`created_by_user_id` became
   `owner_actor`/`entered_by_actor`/`created_by_actor`: plain text, same
   convention already used by `analytics_audit_log`/`crm_audit_log`.
2. **`bigint GENERATED ALWAYS AS IDENTITY`, not UUID**, matching every
   other table in this database. J2's own conceptual migration says to
   "adjust to whatever database the existing analytics app actually
   uses."

One addition beyond J2's literal table list: `kpi_definitions` carries
`current_target_value`/`current_warning_threshold`. J2 defers the full
`kpi_targets` history table as optional ("only if future-scheduled
targets are needed"), but *something* has to be the source that gets
snapshotted into `kpi_values.target_value` at entry/correction time —
these two columns are that source. Editing them only affects periods
entered from that point forward; every already-recorded `kpi_values` row
keeps its own snapshot regardless of later edits.

---

## Confirmed schema (4 core tables)

`kpi_definitions`, `kpi_periods`, `kpi_values`, `kpi_calculation_runs`
(unused until automated KPIs exist, but created now per the delivery
order so a second migration pass isn't needed later). Full DDL in
`netlify/functions/_kpi_lib.js`'s `ensureSchema()`. `kpi_notes` and
`kpi_targets` are both explicitly optional in the spec and not built —
`kpi_values.note` covers a single note per period for v1.

## Which KPIs are manual vs. automated, and why

**Manual** (`data_source = 'manual'`) is the only kind this phase
actually supports end-to-end: create the definition, enter/correct a
value each period through `/admin/analytics`'s new KPI Manager card.

**Automated** (`analytics`/`crm`/`csv`) can be *defined* now (so the
metadata — name, description, target — doesn't have to wait), but:
- The API forces `is_active = false` on creation and returns a `warning`
  field saying so, rather than silently accepting a KPI with no way to
  ever get a real value.
- `POST /api/kpi-values` (manual entry) explicitly refuses to write
  against a non-manual KPI (`400`, tested — see below).
- **No automated KPI counts anything yet**, so the consent-compliance
  question ("does this only aggregate events legitimately captured under
  Section G's consent framework?") doesn't yet apply to anything real —
  there is nothing being automatically calculated to check. This will
  need re-verifying, per-KPI, whenever an actual automated calculation is
  built against a specific J1 event type.

## Endpoints

- `GET/POST/PATCH /api/kpi-definitions` — create, list, update (including
  archive/restore), all admin-session-gated, all logged.
- `GET/POST /api/kpi-values` — manual entry/correction, and history
  (`?kpi_id=`) or current-values-across-all-KPIs (no param).
- `GET /api/kpi-dashboard` — aggregated view: each active KPI's
  definition, current period's value, and up to 12 periods of trend —
  what the UI actually renders.

## UI

A new "KPI Manager" card in `/admin/analytics/index.html` (same page,
same login, same design system — not a separate route): a "+ New KPI"
form, one card per active KPI showing current value vs. target with a
status badge, an inline entry field for manual KPIs, and an archive
button. No separate authentication was added.

## Authorization & audit logging

Every write (create, update, archive, restore, manual entry, correction)
requires the same `tc_session` admin cookie as the rest of
`/admin/analytics`, and every one logs to `analytics_audit_log` — the
existing table (reused, not duplicated), with `actor` set from the
session's username.

## Tests

**33 automated checks**, run against the real handler code
(`kpi-definitions.js`, `kpi-values.js`, `kpi-dashboard.js`) with an
in-memory fake standing in for `@neondatabase/serverless` (same
technique used for J1's phases — no live Postgres connection needed to
prove the logic). All 33 passed. Covered:

- Unauthenticated request → `401`.
- Creating a manual KPI → `is_active = true`.
- Creating an `analytics`-sourced KPI → forced `is_active = false` +
  warning returned.
- **First entry → version 1, `is_current = true`.**
- **Correction → version 2, `corrected: true`, `supersedes_id` points at
  version 1, status recomputed.**
- **Version 1 preserved unchanged after the correction** (same
  `actual_value`), `is_current` flipped to `false`.
- Exactly one `is_current = true` row per KPI/period, always.
- A real `0` stored as `0`, never coerced to/confused with `null`; a
  `null` actual_value computed as `status = 'no_data'`, never `0`.
- Manual-entry endpoint rejects a write against a non-manual KPI (`400`).
- Dashboard reflects the *corrected* value, not the original.
- **`analytics_audit_log` actually received rows** for
  `kpi_definition_create`, `kpi_value_entry`, and `kpi_value_correction`,
  each with the session's actor name.
- Archive removes a KPI from the dashboard; restore brings it back.
- Structural check: no email/phone/contact-shaped column exists anywhere
  in `kpi_values` — nothing CRM-shaped could have been duplicated in even
  by accident.

This test script isn't committed (throwaway, like J1's equivalent
development-time tests) — the pure period-boundary/status-calculation
logic in `_kpi_lib.js` was also checked directly and matches expectations
(e.g. a Wednesday resolves to the correct Monday–Sunday week and calendar
month in Africa/Cairo).

## Manual verification you can run yourself

`scripts/kpi-roundtrip-check.js` — same pattern as
`scripts/db-roundtrip-check.js` and `scripts/crm-create-user.js`: run it
yourself, locally, with your own `DATABASE_URL`:

```
DATABASE_URL='postgres://...neon.tech/db?sslmode=require' node scripts/kpi-roundtrip-check.js
```

It creates one real test KPI, enters a value, corrects it, checks both
versions exist correctly against your actual database, checks the audit
log, and **deletes everything it created** at the end (success or
failure). Nothing about your real KPIs is touched.

For the full UI: once deployed, open `/admin/analytics/`, scroll to "KPI
Manager," click "+ New KPI," fill in a test one (`data_source: manual`),
save a value for the current period, then save a different value again —
the second save should say "Corrected (new version saved)" rather than
silently replacing the number.

## Confirmation: no CRM contact data or raw analytics rows duplicated

`kpi_values`/`kpi_definitions`/`kpi_periods`/`kpi_calculation_runs` store
only aggregated numbers, status, and provenance metadata
(`source_record_count`, `calculation_version` — both present in the
schema, unused until automated KPIs populate them). No query anywhere in
`kpi-definitions.js`/`kpi-values.js`/`kpi-dashboard.js` reads from
`crm_buyers`, `crm_activity`, `analytics_sessions`, or
`analytics_events`. `kpi_notes` (the table for free-text business
commentary) wasn't built in this pass, so there's currently no field
anywhere in the KPI schema a name/email/phone could even be typed into.
