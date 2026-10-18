'use strict';

/*
 * Signed-in test users for the checks that only need "someone signed in".
 *
 * Since release 2 every function checks a session against its account
 * (netlify/functions/_sessions.js): the account id and session number it
 * carries must match crm_users. These checks fake that one lookup, so each
 * keeps its own database stand-in exactly as it was, and sign their tokens
 * with the claims a real sign-in issues.
 *
 *   const fx = require('./_session_fixtures');
 *   fx.install(FN);                                   // after stubbing the Neon driver
 *   signCrmSession('staff', fx.crmClaims('staff'))
 *   signSession('owner', SESSION_SECRET, fx.adminClaims('owner'))
 *
 * scripts/check-session-version.js tests the real lookup and every refusal.
 */

const path = require('path');

const ACCOUNTS = {
  staff: { id: 1, username: 'staff', session_version: 1, is_admin: false, must_change_password: false },
  owner: { id: 2, username: 'owner', session_version: 1, is_admin: true, must_change_password: false },
  admin: { id: 3, username: 'admin', session_version: 1, is_admin: true, must_change_password: false },
};

function install(fnDir) {
  const sessions = require(path.join(fnDir || path.join(__dirname, '..', 'netlify', 'functions'), '_sessions.js'));
  sessions.lookup.accountRow = async (uid) => Object.values(ACCOUNTS).find((a) => a.id === uid) || null;
  return sessions;
}
const crmClaims = (name) => ({ uid: ACCOUNTS[name].id, sv: ACCOUNTS[name].session_version });
const adminClaims = (name) => ({ ...crmClaims(name), adm: 1 });

module.exports = { ACCOUNTS, install, crmClaims, adminClaims };
