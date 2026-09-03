'use strict';

/*
 * Section J2 -- KPI Manager. Shared schema and calculation helpers,
 * following the same shape as _analytics_lib.js's ensureSchema/helpers
 * convention in this codebase.
 *
 * Two deliberate deviations from J2's literal spec, both because the
 * things it assumes exist don't, in this codebase, and confirmed with
 * the site owner before writing any of this:
 *
 * 1. There is no shared `users` table. /admin/analytics (where this KPI
 *    Manager lives, per J2's own instruction to extend the existing
 *    dashboard rather than build separately) has exactly one admin
 *    identity, via ADMIN_USERNAME/ADMIN_PASSWORD_HASH env vars -- no
 *    database row at all. (crm_users is a *different* app/login context
 *    -- the Buyer CRM -- not this one.) So owner_user_id/entered_by_
 *    user_id/created_by_user_id become owner_actor/entered_by_actor/
 *    created_by_actor: plain text, the same "actor" convention already
 *    used by analytics_audit_log and crm_audit_log elsewhere in this
 *    codebase.
 * 2. Every existing table here (crm_users, analytics_audit_log, etc.)
 *    uses `bigint GENERATED ALWAYS AS IDENTITY`, not UUID. J2's own
 *    conceptual migration says to "adjust to whatever database the
 *    existing analytics app actually uses" -- so these tables do too.
 *
 * Third addition beyond J2's literal table list: kpi_definitions carries
 * current_target_value/current_warning_threshold. J2 says target_value
 * on kpi_values must always be a snapshot, never a live reference, and
 * makes kpi_targets (a full effective-dated target history) optional
 * ("only if future-scheduled targets are needed"). Since v1 doesn't
 * build kpi_targets, *something* has to be the source that gets
 * snapshotted at entry/correction time -- these two columns are that
 * source. Editing them only affects periods entered from that point on;
 * every already-recorded kpi_values row keeps its own snapshot
 * regardless of later edits here. This is the smallest thing that
 * satisfies the snapshot rule without building the deferred table.
 */

async function ensureSchema(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS kpi_definitions (
      id                        bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      name                      text NOT NULL,
      description               text NOT NULL,
      category                  text NOT NULL,
      unit                      text NOT NULL,
      direction                 text NOT NULL CHECK (direction IN ('higher_is_better','lower_is_better','neutral')),
      frequency                 text NOT NULL CHECK (frequency IN ('weekly','monthly')),
      data_source               text NOT NULL CHECK (data_source IN ('manual','analytics','crm','csv')),
      calculation_type          text NOT NULL,
      owner_actor               text,
      current_target_value      numeric,
      current_warning_threshold numeric,
      is_active                 boolean NOT NULL DEFAULT true,
      display_order             integer NOT NULL DEFAULT 0,
      created_at                timestamptz NOT NULL DEFAULT now(),
      updated_at                timestamptz NOT NULL DEFAULT now(),
      archived_at               timestamptz
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS kpi_periods (
      id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      frequency    text NOT NULL CHECK (frequency IN ('weekly','monthly')),
      period_start date NOT NULL,
      period_end   date NOT NULL,
      timezone     text NOT NULL DEFAULT 'Africa/Cairo',
      created_at   timestamptz NOT NULL DEFAULT now(),
      UNIQUE (frequency, period_start, period_end),
      CHECK (period_end >= period_start)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS kpi_values (
      id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      kpi_id              bigint NOT NULL REFERENCES kpi_definitions(id),
      period_id           bigint NOT NULL REFERENCES kpi_periods(id),
      actual_value        numeric,
      target_value        numeric,
      warning_threshold   numeric,
      status              text NOT NULL CHECK (status IN ('on_track','warning','off_track','no_data','target_not_configured','data_unavailable')),
      value_type          text NOT NULL CHECK (value_type IN ('automated','manual','estimate')),
      source              text NOT NULL,
      calculation_version text,
      source_record_count integer,
      calculated_at       timestamptz,
      entered_by_actor    text,
      note                text,
      version             integer NOT NULL DEFAULT 1,
      is_current          boolean NOT NULL DEFAULT true,
      supersedes_id       bigint REFERENCES kpi_values(id),
      created_at          timestamptz NOT NULL DEFAULT now(),
      UNIQUE (kpi_id, period_id, version)
    )
  `;
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS kpi_values_one_current_per_period
      ON kpi_values (kpi_id, period_id) WHERE is_current = true
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS kpi_values_history_lookup
      ON kpi_values (kpi_id, period_id, created_at DESC)
  `;

  // Not used until automated (analytics-sourced) KPIs are built -- created
  // now per J2's delivery order ("add kpi_calculation_runs once automated
  // analytics-sourced KPIs begin"), so the schema doesn't need a second
  // migration pass when that phase starts.
  await sql`
    CREATE TABLE IF NOT EXISTS kpi_calculation_runs (
      id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      kpi_id              bigint NOT NULL REFERENCES kpi_definitions(id),
      period_id           bigint NOT NULL REFERENCES kpi_periods(id),
      source              text NOT NULL,
      status              text NOT NULL CHECK (status IN ('running','success','failed','no_data')),
      calculation_version text,
      source_record_count integer,
      started_at          timestamptz NOT NULL DEFAULT now(),
      completed_at        timestamptz,
      error_category      text,
      error_message       text
    )
  `;
}

// --- period helpers --------------------------------------------------------

function cairoDateParts(d) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit',
  });
  const parts = fmt.formatToParts(d || new Date());
  const get = (t) => Number(parts.find((p) => p.type === t).value);
  return { year: get('year'), month: get('month'), day: get('day') };
}

function toDateStr(utcMs) {
  return new Date(utcMs).toISOString().slice(0, 10);
}

// Monday-start week. Returns { start, end } as 'YYYY-MM-DD' for the
// Africa/Cairo week containing `refDate` (defaults to now).
function weekBoundsFor(refDate) {
  const { year, month, day } = cairoDateParts(refDate);
  const asUtcMidnight = Date.UTC(year, month - 1, day);
  const dow = new Date(asUtcMidnight).getUTCDay(); // 0=Sun..6=Sat
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const start = asUtcMidnight + mondayOffset * 86400000;
  const end = start + 6 * 86400000;
  return { start: toDateStr(start), end: toDateStr(end) };
}

// Returns { start, end } as 'YYYY-MM-DD' for the Africa/Cairo calendar
// month containing `refDate` (defaults to now).
function monthBoundsFor(refDate) {
  const { year, month } = cairoDateParts(refDate);
  const start = Date.UTC(year, month - 1, 1);
  const end = Date.UTC(year, month, 0); // day 0 of next month = last day of this one
  return { start: toDateStr(start), end: toDateStr(end) };
}

function boundsForFrequency(frequency, refDate) {
  return frequency === 'weekly' ? weekBoundsFor(refDate) : monthBoundsFor(refDate);
}

// Idempotent get-or-create for a period row. Two KPIs of the same
// frequency share the same period row (per the UNIQUE (frequency,
// period_start, period_end) constraint) -- this is deliberate, so the
// dashboard can group all monthly KPIs under one "September 2026" axis.
async function getOrCreatePeriod(sql, frequency, periodStart, periodEnd) {
  const inserted = await sql`
    INSERT INTO kpi_periods (frequency, period_start, period_end)
    VALUES (${frequency}, ${periodStart}, ${periodEnd})
    ON CONFLICT (frequency, period_start, period_end) DO NOTHING
    RETURNING *
  `;
  if (inserted[0]) return inserted[0];
  const existing = await sql`
    SELECT * FROM kpi_periods
    WHERE frequency = ${frequency} AND period_start = ${periodStart} AND period_end = ${periodEnd}
    LIMIT 1
  `;
  return existing[0] || null;
}

async function currentPeriod(sql, frequency) {
  const { start, end } = boundsForFrequency(frequency);
  return getOrCreatePeriod(sql, frequency, start, end);
}

// --- status ------------------------------------------------------------

// Do not represent missing data as 0. Callers must pass actualValue as
// `null` (never 0) when there is genuinely no value yet.
function computeStatus(direction, actualValue, targetValue, warningThreshold) {
  if (actualValue === null || actualValue === undefined) return 'no_data';
  if (targetValue === null || targetValue === undefined) return 'target_not_configured';
  const a = Number(actualValue);
  const t = Number(targetValue);
  const w = warningThreshold === null || warningThreshold === undefined ? null : Number(warningThreshold);

  if (direction === 'higher_is_better') {
    if (a >= t) return 'on_track';
    if (w !== null && a >= w) return 'warning';
    return 'off_track';
  }
  if (direction === 'lower_is_better') {
    if (a <= t) return 'on_track';
    if (w !== null && a <= w) return 'warning';
    return 'off_track';
  }
  // 'neutral': no better/worse direction to compare against, only whether
  // a number was recorded at all -- there's nothing in the spec defining
  // warning/off_track for a directionless KPI, so this reports on_track
  // whenever real data exists rather than inventing a threshold rule.
  return 'on_track';
}

const DIRECTIONS = new Set(['higher_is_better', 'lower_is_better', 'neutral']);
const FREQUENCIES = new Set(['weekly', 'monthly']);
const DATA_SOURCES = new Set(['manual', 'analytics', 'crm', 'csv']);

module.exports = {
  ensureSchema,
  cairoDateParts,
  weekBoundsFor,
  monthBoundsFor,
  boundsForFrequency,
  getOrCreatePeriod,
  currentPeriod,
  computeStatus,
  DIRECTIONS,
  FREQUENCIES,
  DATA_SOURCES,
};
