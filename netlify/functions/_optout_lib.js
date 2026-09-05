'use strict';

/*
 * Contact opt-outs -- the record behind the "you can unsubscribe at any
 * time" promise on every lead form.
 *
 * Background: that sentence was on the forms from the beginning, and until
 * now there was nothing behind it. No page, no endpoint, no column -- a
 * promise the site could not keep (docs/downloads-and-gating.md §4). This is
 * the thing it now points at.
 *
 * Two tables, because the current state and the history answer different
 * questions:
 *
 *   contact_opt_outs        one row per address: are they opted out right now?
 *   contact_opt_out_events  append-only: when, from where, and by which action
 *
 * The events table is the one that matters if anyone ever disputes what was
 * agreed to and when. Rows are never deleted from it, including when someone
 * opts back in.
 *
 * Deliberately NOT verified by email. Anyone can opt out any address from the
 * public form. That is a real trade-off and it was chosen on purpose:
 *   - the harm of an unwanted opt-out is that a sales email does not go out,
 *     which is recoverable and visible in the events table;
 *   - the harm of a verification step is that the promise on the form is not
 *     honoured until someone completes a second action, which is the failure
 *     this exists to fix;
 *   - and there is no outbound mail to a lead's own address today, so a
 *     confirmation link could not be delivered anyway.
 * Opting out is bounded and reversible. Keeping someone on a list they asked
 * to leave is not.
 */

const MAX_EMAIL = 320;

function normaliseEmail(v) {
  return String(v == null ? '' : v).trim().toLowerCase().slice(0, MAX_EMAIL);
}

function looksLikeEmail(v) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v);
}

async function ensureOptOutSchema(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS contact_opt_outs (
      email       text PRIMARY KEY,
      status      text NOT NULL,
      updated_at  timestamptz NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS contact_opt_out_events (
      id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      email       text NOT NULL,
      action      text NOT NULL,
      source_page text,
      client_ip   text,
      created_at  timestamptz NOT NULL DEFAULT now()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS contact_opt_out_events_email_idx ON contact_opt_out_events (email)`;
}

/** True when this address has asked not to be contacted and has not since asked to be. */
async function isOptedOut(sql, email) {
  const e = normaliseEmail(email);
  if (!e) return false;
  const rows = await sql`SELECT status FROM contact_opt_outs WHERE email = ${e}`;
  return !!rows[0] && rows[0].status === 'unsubscribed';
}

/*
 * Idempotent: opting out twice is one row and two events, and never an
 * error. Someone clicking again because they were not sure it worked is
 * the normal case, not an edge case.
 */
async function setStatus(sql, email, status, sourcePage, clientIp) {
  const e = normaliseEmail(email);
  await sql`
    INSERT INTO contact_opt_outs (email, status, updated_at)
    VALUES (${e}, ${status}, now())
    ON CONFLICT (email) DO UPDATE SET status = EXCLUDED.status, updated_at = now()
  `;
  await sql`
    INSERT INTO contact_opt_out_events (email, action, source_page, client_ip)
    VALUES (${e}, ${status === 'unsubscribed' ? 'unsubscribe' : 'resubscribe'}, ${sourcePage || null}, ${clientIp || null})
  `;
  return e;
}

const unsubscribe = (sql, email, sourcePage, clientIp) =>
  setStatus(sql, email, 'unsubscribed', sourcePage, clientIp);

const resubscribe = (sql, email, sourcePage, clientIp) =>
  setStatus(sql, email, 'resubscribed', sourcePage, clientIp);

module.exports = {
  MAX_EMAIL,
  normaliseEmail,
  looksLikeEmail,
  ensureOptOutSchema,
  isOptedOut,
  unsubscribe,
  resubscribe,
};
