'use strict';

/*
 * When a CRM operation fails, tell a person -- not only the log.
 *
 * Every CRM function already wrote its failures to Netlify's function log with
 * console.error. Nobody reads that log unprompted, which is how eighteen broken
 * calls ran from 2026-09-01 to 2026-09-24 with every one of them logged. A log
 * line is evidence for someone who is already looking; this is what makes
 * someone look.
 *
 * Two channels, because each one covers a failure the other cannot:
 *
 *   1. A row in crm_failures, shown on the CRM dashboard ("something failed")
 *      for seven days. Works with no setup at all. It cannot record the one
 *      failure that matters most -- the database itself being unreachable --
 *      because recording it needs the database.
 *
 *   2. An email through the site's existing notification path (_email_lib.js,
 *      the same one enquiries use). That one needs no database, so it covers
 *      the outage the table cannot. It delivers only once NOTIFY_EMAIL and
 *      RESEND_API_KEY are set in Netlify; until then it is logged as skipped,
 *      exactly like enquiry notifications. Throttled per function instance, so
 *      an outage produces one email every quarter hour, not one per click.
 *
 * Never throws, and never changes the response the caller is about to send:
 * reporting a failure must not become a second failure.
 */

const { sendNotification } = require('./_email_lib');

const EMAIL_EVERY_MS = 15 * 60 * 1000;
const KEEP_DAYS = 90;
let lastEmailAt = 0;
let suppressed = 0;

// A connection string must never reach a table, a screen or an inbox, whatever
// a driver chooses to put in an error message.
function scrub(text) {
  return String(text == null ? '' : text)
    .replace(/postgres(?:ql)?:\/\/\S+/gi, '[connection string removed]')
    .slice(0, 400);
}

async function ensureFailureTable(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS crm_failures (
      id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      occurred_at  timestamptz NOT NULL DEFAULT now(),
      source       text NOT NULL,
      method       text,
      step         text,
      code         text,
      message      text,
      actor        text
    )
  `;
}

/*
 * ctx: { source: 'crm-buyers', method: 'PATCH', step?: string, actor?: string }
 */
async function reportFailure(sql, ctx, err) {
  const c = ctx || {};
  const row = {
    source: String(c.source || 'unknown').slice(0, 60),
    method: c.method ? String(c.method).slice(0, 10) : null,
    step: c.step ? String(c.step).slice(0, 120) : null,
    code: (err && err.code) ? String(err.code).slice(0, 20) : null,
    message: scrub((err && err.message) || err),
    actor: c.actor ? String(c.actor).slice(0, 100) : null,
  };

  let recorded = false;
  if (sql) {
    try {
      await ensureFailureTable(sql);
      await sql`
        INSERT INTO crm_failures (source, method, step, code, message, actor)
        VALUES (${row.source}, ${row.method}, ${row.step}, ${row.code}, ${row.message}, ${row.actor})
      `;
      recorded = true;
      // Kept for a quarter: long enough to see a pattern, short enough that
      // the table never needs a job of its own.
      await sql`DELETE FROM crm_failures WHERE occurred_at < now() - (${KEEP_DAYS} || ' days')::interval`;
    } catch (e) {
      console.error(`[failure-alert] could not record the failure (the database may be the problem): ${scrub(e && e.message)}`);
    }
  }

  try {
    const now = Date.now();
    if (now - lastEmailAt < EMAIL_EVERY_MS) {
      suppressed += 1;
    } else {
      const also = suppressed ? `\n\n${suppressed} further failure(s) since the last alert from this server were not emailed separately.` : '';
      suppressed = 0;
      lastEmailAt = now;
      await sendNotification(
        `CRM failure: ${row.source}${row.method ? ' ' + row.method : ''}`,
        [
          'A CRM operation on olivesegypt.com failed.',
          '',
          `Where: ${row.source}${row.method ? ' (' + row.method + ')' : ''}`,
          row.step ? `While: ${row.step}` : null,
          row.actor ? `Signed-in user: ${row.actor}` : null,
          row.code ? `Database code: ${row.code}` : null,
          `Error: ${row.message}`,
          '',
          recorded
            ? 'It is also listed on the CRM dashboard for seven days.'
            : 'It could NOT be recorded on the CRM dashboard -- the database itself may be unreachable.',
          'The full detail is in the Netlify function log for ' + row.source + '.',
        ].filter((l) => l !== null).join('\n') + also,
        { formType: 'failure-alert' }
      );
    }
  } catch (e) {
    console.error(`[failure-alert] could not send the alert email: ${scrub(e && e.message)}`);
  }
  return recorded;
}

async function recentFailures(sql, days) {
  await ensureFailureTable(sql);
  const d = days || 7;
  const count = await sql`
    SELECT count(*)::int AS n FROM crm_failures WHERE occurred_at > now() - (${d} || ' days')::interval
  `;
  const latest = await sql`
    SELECT occurred_at, source, method, step, code, message
    FROM crm_failures WHERE occurred_at > now() - (${d} || ' days')::interval
    ORDER BY occurred_at DESC LIMIT 5
  `;
  return { days: d, count: (count[0] && count[0].n) || 0, latest };
}

// For tests: the throttle is per instance, so reset it between cases.
function _resetThrottle() { lastEmailAt = 0; suppressed = 0; }

module.exports = { reportFailure, recentFailures, ensureFailureTable, scrub, EMAIL_EVERY_MS, _resetThrottle };
