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

const { hashPassword, verifyPassword, signSession, verifySession, parseCookies, readJsonBody, json } = require('./_lib');

const CRM_COOKIE_NAME = 'tc_crm_session';
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
  const SESSION_SECRET = process.env.CRM_SESSION_SECRET || process.env.SESSION_SECRET;
  if (!SESSION_SECRET) return null;
  return getCrmSession(event, SESSION_SECRET);
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
  if (raw.length < 3) {
    return {
      severity: 'reject', code: 'too_short',
      reason: `"${raw}" is too short to be a company name. Enter the company, not an abbreviation or a title.`,
    };
  }
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

module.exports = {
  CRM_COOKIE_NAME,
  CRM_SESSION_TTL_SECONDS,
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
};
