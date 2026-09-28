'use strict';

// CRM-specific session helpers. Deliberately separate from _lib.js's
// COOKIE_NAME/sessionCookie() (used by the existing /admin/analytics
// dashboard) per the explicit decision: a fully separate authentication
// system for the CRM, sharing no session, no cookie, and no user table
// with any other app or dashboard. The underlying crypto primitives
// (scrypt password verification, HMAC session signing) are reused from
// _lib.js because they're generic, cookie-name-agnostic helpers already
// written and proven in this repo -- not "authentication code copied
// between the two apps" in the sense the operating rules warn against
// (that rule is about olivesegypt-site vs. the separate umami-olivesegypt
// codebase, which this file has no connection to at all).

const { hashPassword, verifyPassword, signSession, verifySession, parseCookies, readJsonBody, json, parseId, INVALID_ID_ERROR, COOKIE_NAME: ADMIN_COOKIE_NAME } = require('./_lib');

const crypto = require('crypto');

const CRM_COOKIE_NAME = 'tc_crm_session';

/*
 * The key CRM sessions are signed with: always DERIVED, never a raw secret.
 *
 * CRM_SESSION_SECRET falls back to SESSION_SECRET, the analytics admin's key,
 * and both apps sign with the same function. Until 2026-09-28 the fallback was
 * used as-is, so with CRM_SESSION_SECRET unset -- or set to the same value --
 * a CRM user's token was a valid admin session, and an admin token a valid CRM
 * one: tested, a CRM token opened analytics-report, analytics-settings,
 * kpi-definitions and analytics-privacy (system health audit, run 1, C2).
 *
 * Deriving with a fixed label separates the two whatever is configured, the
 * same way _guide_token.js keeps guide tokens apart from both sessions. The
 * admin key is left as it is, so the admin stays signed in; CRM users sign in
 * once more after this deploys.
 */
const CRM_KEY_LABEL = 'olivesegypt:crm-session:v1';
function crmSessionKey() {
  const secret = process.env.CRM_SESSION_SECRET || process.env.SESSION_SECRET;
  if (!secret) return null;
  return crypto.createHmac('sha256', secret).update(CRM_KEY_LABEL).digest('hex');
}
function signCrmSession(username) {
  const key = crmSessionKey();
  if (!key) throw new Error('signCrmSession: no CRM_SESSION_SECRET or SESSION_SECRET');
  return signSession(username, key);
}
const CRM_SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

function crmSessionCookie(value, maxAgeSeconds) {
  const attrs = [
    `${CRM_COOKIE_NAME}=${value}`,
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    'Path=/',
    `Max-Age=${maxAgeSeconds}`,
  ];
  return attrs.join('; ');
}

function clearCrmSessionCookie() {
  return `${CRM_COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

function getCrmSession(event, secret) {
  const token = parseCookies(event.headers)[CRM_COOKIE_NAME];
  return token ? verifySession(token, secret) : null;
}

// Deny-by-default authorization gate (Rule 22): every CRM function
// should call this first and bail out on null before touching any data.
function requireCrmSession(event) {
  const key = crmSessionKey();
  if (!key) return null;
  return getCrmSession(event, key);
}

/*
 * ---------------------------------------------------------------------------
 * Saying what actually went wrong.
 *
 * Every CRM endpoint ends in the same catch: log err.message to a place the
 * owner does not read, and answer "Server error". So every distinct failure --
 * a missing table, a missing column, a revoked privilege, a database that has
 * hit its connection limit -- arrives on screen as the same four characters,
 * and the only way to tell them apart is to open the function logs.
 *
 * That cost a full round trip on a broken buyer page: a table was missing, the
 * fix shipped, the page still failed, and nothing anywhere could say whether
 * the second failure was the same cause or a different one.
 *
 * So: name the failure, but never quote the database verbatim.
 *
 * WHAT MAY BE SHOWN, AND WHY
 *
 * These endpoints already require a CRM session, so the reader is staff, not
 * the public. Even so, only two classes of message are passed through: a
 * missing table and a missing column. Those name our own schema, which staff
 * can read on any page anyway, and they are exactly the ones worth seeing,
 * because they say precisely what to fix.
 *
 * Everything else gets a category and no message. A connection failure in
 * particular can carry the database host inside its text, and a hostname is
 * not something to print on a web page because a page was slow.
 * ---------------------------------------------------------------------------
 */

// The SQLSTATEs worth distinguishing, and what each means in plain words.
const DB_ERROR_CODES = {
  '42P01': { what: 'a table this page needs does not exist', quote: true },
  '42703': { what: 'a column this page needs does not exist', quote: true },
  '42501': { what: 'the database user is not allowed to do that', quote: false },
  '23502': { what: 'a required value was empty', quote: false },
  '23505': { what: 'that would duplicate something that must be unique', quote: false },
  '22P02': { what: 'a value had the wrong type', quote: false },
  '53300': { what: 'the database refused a new connection -- too many open', quote: false },
  '57P03': { what: 'the database is not accepting connections yet', quote: false },
  '08006': { what: 'the connection to the database failed', quote: false },
};

/*
 * A fault in this code, not in the database.
 *
 * These are the errors the JavaScript engine raises when a program is wrong:
 * a misspelt method, a value that was never there. They carry no SQLSTATE, so
 * without this they fell into the "could not be reached" branch below and a
 * one-line mistake was reported to staff as a database outage.
 *
 * That is not hypothetical. `await sql.query(...)` was written in three
 * functions against a driver whose query handle has no `query` property --
 * the parameterised form is calling the handle itself. Every buyer update,
 * every Kanban drag, the whole analytics report and the retention purge threw
 * `TypeError: sql.query is not a function` from 2026-09-01, and all of them
 * said "the database could not be reached". Anybody reading that goes looking
 * at Neon, which was fine the whole time.
 *
 * Checked by name rather than with instanceof: these functions are bundled,
 * and an error crossing a realm boundary can fail an instanceof against the
 * local constructor while still being exactly this kind of mistake.
 */
const OUR_BUG_NAMES = new Set([
  'TypeError', 'ReferenceError', 'SyntaxError', 'RangeError',
]);

function isOurBug(err) {
  return !!(err && !err.code && err.name && OUR_BUG_NAMES.has(err.name) && err.message);
}

/*
 * Turn a thrown error into something safe to put on a screen.
 *
 * `step` is the label the caller attached with dbStep(), so the answer names
 * the operation that failed and not merely the fact that one did.
 */
function describeDbError(err, step) {
  const code = (err && err.code) || null;
  const known = code && DB_ERROR_CODES[code];

  const parts = [];
  if (known) parts.push(known.what);
  else if (code) parts.push(`the database refused the request (${code})`);
  else if (isOurBug(err)) parts.push(`this page has a bug in its own code, not a database problem - ${String(err.message).slice(0, 200)}`);
  else parts.push('the database could not be reached');

  if (known && known.quote && err.message) {
    // Postgres's own wording for these two is short and names the object:
    // relation "buyer_activity_log" does not exist. Nothing else is quoted.
    parts.push(`- ${String(err.message).slice(0, 200)}`);
  }
  if (step) parts.push(`(while ${step})`);

  return { error: parts.join(' '), code: code || null, step: step || null };
}

/*
 * Label a query so a failure knows which one it was. Without this the step is
 * guesswork: handleGet runs four queries and the catch sees only the last
 * error, with nothing to say which of the four raised it.
 */
async function dbStep(step, run) {
  try {
    return await run();
  } catch (err) {
    if (err && !err.crmStep) err.crmStep = step;
    throw err;
  }
}

/* ---------------------------------------------------------------------------
 * COMPANY NAMES
 *
 * company_name is the spine of the CRM: search, deduplication, every report,
 * and every quotation and invoice addressed to a company all hang off it. It
 * was accepting anything two characters or longer, and the records show what
 * that let through -- "Dr" as a company, alongside people's names ("Mr masud",
 * "Mr khalid algatin") in the field meant for their employer.
 *
 * TWO SEVERITIES, AND THE LINE BETWEEN THEM IS THE DESIGN
 *
 *   reject  Refused on save. Only where being wrong is close to impossible:
 *           too short to be a name at all, a personal title on its own, or a
 *           value opening with a title and a person's name.
 *   review  Flagged on the data-quality page, never blocked. Signals that are
 *           usually right and sometimes wrong -- a single bare word, or two
 *           records that look like one company typed two ways.
 *
 * "Olivex" is a single bare word and a perfectly good company name. Refusing it
 * to catch "Abdelrahman" would train staff to fight the form, and a field
 * people fight is a field people fill with junk. So the machine blocks only
 * what it cannot be wrong about and asks a person about the rest.
 *
 * Arabic titles and company words are here for the same reason the rest of the
 * site is bilingual: the buyers are in Egypt, the Gulf and North Africa, and a
 * rule that reads only Latin script would miss half of them.
 * ------------------------------------------------------------------------- */

const PERSONAL_TITLES = [
  'mr', 'mrs', 'ms', 'miss', 'dr', 'doctor', 'prof', 'professor',
  'eng', 'engineer', 'sir', 'madam', 'mme', 'sheikh', 'shaikh', 'hajj', 'haji',
  'السيد', 'السيدة', 'الأستاذ', 'الاستاذ', 'الدكتور', 'المهندس', 'الشيخ',
];

// A word that marks the value as an organisation rather than a person.
const COMPANY_WORDS = [
  'ltd', 'limited', 'llc', 'inc', 'incorporated', 'co', 'company', 'corp',
  'corporation', 'gmbh', 'sarl', 'sa', 'sae', 'bv', 'nv', 'as', 'ab', 'oy',
  'plc', 'pte', 'pvt', 'spa', 'srl', 'group', 'holding', 'holdings',
  'trading', 'trade', 'import', 'imports', 'export', 'exports', 'foods',
  'food', 'industries', 'industry', 'industrial', 'agro', 'farms',
  'international', 'global', 'enterprises', 'establishment', 'supermarket',
  'markets', 'distribution', 'distributors', 'logistics', 'factory',
  'شركة', 'مؤسسة', 'مجموعة', 'مصنع', 'للتجارة', 'للاستيراد', 'للتصدير',
];

function companyWords(value) {
  return String(value || '').trim().toLowerCase()
    .replace(/[.,'"()]/g, '')
    .split(/\s+/)
    .filter(Boolean);
}

/** Lower-cased, punctuation and legal suffixes stripped, spaces collapsed. */
function normaliseCompanyName(value) {
  return String(value === null || value === undefined ? '' : value)
    .toLowerCase()
    .replace(/[.,'"()\[\]&/\\-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .filter((w) => !COMPANY_WORDS.includes(w))
    .join(' ')
    .trim();
}

/**
 * What is wrong with a company name, if anything.
 *
 * Returns { severity: 'ok' | 'review' | 'reject', code, reason }. The reason is
 * written for whoever has to fix it, so it says what to do rather than which
 * rule fired.
 */
function classifyCompanyName(value) {
  const raw = String(value === null || value === undefined ? '' : value).trim();
  const w = companyWords(raw);

  if (!raw) {
    return { severity: 'reject', code: 'empty', reason: 'A company name is required.' };
  }
  /*
   * The title rules run before the length rule, and the length rule refuses
   * only a single character.
   *
   * The floor started at three characters, which caught "Dr" -- but it caught
   * it for the wrong reason, told the person "too short" when the real fault
   * was that they had typed a title, and refused BP, 3M, LG and GE along with
   * it. The title rules recognise "Dr", "Mr", "Ms" and the Arabic forms on
   * their own, without any help from a length check, so ordering them first
   * both frees up the short names and gives the person the message that
   * actually tells them what to do.
   *
   * The cost, accepted deliberately: a careless two-character entry like "qq"
   * is no longer refused at the form. It is still flagged on the review page.
   * Blocking real companies to catch that is the worse trade.
   */
  if (w.length && w.every((x) => PERSONAL_TITLES.includes(x))) {
    return {
      severity: 'reject', code: 'title_only',
      reason: `"${raw}" is a personal title, not a company. Put the title in Contact Title and the company here.`,
    };
  }
  if (w.length > 1 && PERSONAL_TITLES.includes(w[0])) {
    return {
      severity: 'reject', code: 'starts_with_title',
      reason: `"${raw}" looks like a person's name. Put it in Contact Name and enter their company here.`,
    };
  }
  if (raw.length < 2) {
    return {
      severity: 'reject', code: 'too_short',
      reason: `"${raw}" is a single character. Enter the company's name.`,
    };
  }
  if (w.length === 1 && !COMPANY_WORDS.includes(w[0]) && /^[a-z؀-ۿ]+$/.test(w[0])) {
    return {
      severity: 'review', code: 'single_word',
      reason: `"${raw}" is a single word with nothing marking it as a company. It may well be right — check whether it is the company or a person.`,
    };
  }
  return { severity: 'ok', code: null, reason: '' };
}

/**
 * Records whose names normalise to the same thing: one company entered twice,
 * differently. Returns groups of two or more, and never a judgement about which
 * spelling is right -- that is a person's call.
 */
function findNearDuplicates(rows) {
  const groups = new Map();
  for (const row of rows || []) {
    const key = normaliseCompanyName(row.company_name);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return [...groups.entries()]
    .filter(([, members]) => members.length > 1)
    .map(([key, members]) => ({ key, members }));
}

/*
 * The pipeline, in order. Order matters: the website enquiry intake only ever
 * moves a buyer FORWARD along this list, and the dashboard and Kanban lay
 * their columns out by it.
 */
const STAGES = [
  'Lead', 'Contacted', 'Qualifying', 'Sample Requested', 'Sample Sent',
  'Negotiation', 'Contract Signed', 'Shipment Prepared', 'Exported/Completed',
  'Lost/Stalled',
];

/*
 * Buyer regions. The first five were the original list. It could not hold
 * the UK, Russia, Brazil or Australia -- all real olive import markets -- so
 * the owner chose to add the missing real regions rather than force those
 * buyers into a wrong one. 'Unassigned' is for a country the website intake
 * cannot place with certainty; staff set the real region by hand.
 *
 * assets/crm.js carries the same list for the dropdowns;
 * scripts/check-enquiry-intake.js fails if the two drift.
 */
const REGIONS = [
  'Africa', 'Middle East', 'Asia', 'EU', 'Europe (non-EU)',
  'North America', 'South America', 'Oceania', 'Unassigned',
];

/*
 * The buyer tables, created once for every endpoint that reads or writes
 * them: crm-buyers.js, and inquiries.js, which adds website enquiries to the
 * pipeline. Moved here from crm-buyers.js unchanged.
 */
async function ensureBuyerTables(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS buyers (
      id                       bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      created_at               timestamptz NOT NULL DEFAULT now(),
      updated_at               timestamptz NOT NULL DEFAULT now(),
      deleted_at               timestamptz,
      created_by               text,
      assigned_to              text,
      company_name             text NOT NULL,
      country_region           text NOT NULL,
      contact_name             text,
      contact_title            text,
      contact_email            text,
      contact_phone            text,
      contact_whatsapp         text,
      lead_source              text,
      current_stage            text NOT NULL DEFAULT 'Lead',
      product_interest         jsonb NOT NULL DEFAULT '[]',
      packaging_format         text,
      estimated_volume         text,
      target_price             text,
      quoted_price             text,
      incoterm                 text,
      certifications_required  text,
      certification_gap        boolean NOT NULL DEFAULT false,
      next_action              text,
      next_action_due          date,
      notes                    text,
      lost_reason              text
    )
  `;
  /*
   * crm-buyers.js's handleGet reads this table, so the buyer tables must include it.
   *
   * It did not, and the result was that opening any buyer record returned
   * "Server error" -- since the CRM was first built. The table is also
   * created by crm-activity.js, but that function runs only when an activity
   * entry is POSTed, and an entry can only be added from a buyer's page,
   * which could not load until the table existed. A deadlock, not a race.
   *
   * The definition below is character-for-character the one in
   * crm-activity.js. Both use IF NOT EXISTS, so whichever function runs first
   * on a new database creates the table and the other accepts it; if the two
   * definitions drifted, the shape of the table would depend on which
   * endpoint a person happened to reach first. scripts/check-crm-schema.js
   * runs each handler against a database containing only what its own
   * ensureSchema creates, so this cannot silently come undone again.
   */
  await sql`
    CREATE TABLE IF NOT EXISTS buyer_activity_log (
      id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      buyer_id     bigint NOT NULL,
      created_at   timestamptz NOT NULL DEFAULT now(),
      created_by   text,
      entry        text NOT NULL
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS buyer_stage_history (
      id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      buyer_id     bigint NOT NULL,
      from_stage   text,
      to_stage     text NOT NULL,
      changed_at   timestamptz NOT NULL DEFAULT now(),
      changed_by   text
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS crm_audit_log (
      id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      occurred_at  timestamptz NOT NULL DEFAULT now(),
      actor        text NOT NULL,
      action       text NOT NULL,
      record_type  text NOT NULL,
      record_id    bigint,
      details      text
    )
  `;
}


// CSV-injection mitigation (moved here from crm-csv.js, 2026-09-27, when a
// second export needed it): neutralize any cell whose content, once
// coerced to a string, starts with a character a spreadsheet app would
// interpret as the start of a formula (=, +, -, @) by prefixing a
// single quote so it's forced to render as plain text on open.
function csvCell(value) {
  let s = value === null || value === undefined ? '' : String(value);
  // OWASP's list: = + - @, and a leading TAB or CR, which some spreadsheet
  // apps strip before evaluating (system health audit, run 1, C7).
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  if (/[",\n\r]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
  return s;
}

/*
 * Either session may read what the website collects from visitors.
 *
 * Enquiries (inquiries.js) and guide-download / private-label requests
 * (leads.js) are read by both the CRM and the /admin/analytics dashboard.
 * CRM staff already see the full buyers table, which holds the same class of
 * personal data about the same people, so this is consistent with the access
 * they have rather than a widening of it. Deny-by-default: no valid session of
 * either kind returns null, and the caller answers 401 before reading a row.
 *
 * Moved here from inquiries.js when leads.js needed the same rule, so the two
 * cannot drift apart.
 */
function requireReaderSession(event) {
  const adminSecret = process.env.SESSION_SECRET;
  if (adminSecret) {
    const token = parseCookies(event.headers)[ADMIN_COOKIE_NAME];
    const session = token ? verifySession(token, adminSecret) : null;
    if (session) return session;
  }
  return requireCrmSession(event);
}

/*
 * Permanently delete one thing a visitor sent: an enquiry, or a guide
 * download / brief / market-brief signup.
 *
 * The owner chose "gone for good" over hidden (2026-09-27): these rows are
 * someone's personal details, and the two reasons to delete one -- a test
 * entry, or a visitor asking for their data to be deleted, as /privacy
 * promises -- both want it gone, not kept out of sight.
 *
 * CRM staff only, and only with confirmed=1, like every other delete here.
 * The row and its audit entry go in ONE statement, so nothing can be deleted
 * without a record of who deleted what and when. The audit entry carries the
 * date received and the kind of request -- never the person's details, since
 * the point is that those are gone.
 *
 * Deliberately NOT touched: contact_opt_outs (someone who unsubscribed must
 * stay unsubscribed after their request is deleted), and any buyer the
 * enquiry created -- that is a separate record with its own delete.
 */
const SUBMISSION_KINDS = {
  inquiry: { table: 'inquiries', kindColumn: 'request_type' },
  lead: { table: 'leads_staging', kindColumn: 'segment' },
};

async function deleteSubmission(event, sql, kind) {
  const k = SUBMISSION_KINDS[kind];
  if (!k) throw new Error(`deleteSubmission: unknown kind ${kind}`);
  const session = requireCrmSession(event);
  if (!session) return json(401, { ok: false, error: 'Unauthorized' }, { 'Cache-Control': 'no-store, private' });
  const qs = event.queryStringParameters || {};
  if (qs.confirmed !== '1') {
    return json(400, { ok: false, error: 'Deletion requires explicit confirmation (confirmed=1)' });
  }
  const id = parseId(qs.id);
  if (!id) return json(400, { ok: false, error: INVALID_ID_ERROR });

  await ensureBuyerTables(sql);   // crm_audit_log, on a new database
  // Table and column come from SUBMISSION_KINDS above, never from the request.
  const gone = await sql(
    `WITH gone AS (DELETE FROM ${k.table} WHERE id = $1 RETURNING id, created_at, ${k.kindColumn} AS kind)
     INSERT INTO crm_audit_log (actor, action, record_type, record_id, details)
     SELECT $2, 'delete', $3, id,
            'received ' || to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') || ', ' || COALESCE(kind, 'unspecified')
     FROM gone
     RETURNING record_id`,
    [id, session.sub || 'unknown', kind]
  );
  if (!gone[0]) return json(404, { ok: false, error: 'Not found -- it may already have been deleted.' });
  return json(200, { ok: true });
}

module.exports = {
  CRM_COOKIE_NAME,
  CRM_SESSION_TTL_SECONDS,
  crmSessionKey,
  signCrmSession,
  DB_ERROR_CODES,
  describeDbError,
  dbStep,
  hashPassword,
  verifyPassword,
  signSession,
  verifySession,
  parseCookies,
  readJsonBody,
  json,
  crmSessionCookie,
  clearCrmSessionCookie,
  getCrmSession,
  requireCrmSession,
  PERSONAL_TITLES,
  COMPANY_WORDS,
  normaliseCompanyName,
  classifyCompanyName,
  findNearDuplicates,
  requireReaderSession,
  deleteSubmission,
  parseId,
  INVALID_ID_ERROR,
  csvCell,
  STAGES,
  REGIONS,
  ensureBuyerTables,
};
