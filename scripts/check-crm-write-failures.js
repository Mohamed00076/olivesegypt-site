#!/usr/bin/env node
'use strict';

/*
 * Every CRM write says so when it gets no reply.
 *
 *   node scripts/check-crm-write-failures.js        (part of `npm test`)
 *
 * CRM.fetchJson rejects when the connection drops or the server answers with
 * an error page instead of JSON (a function timeout, for one). Until
 * 2026-09-27 most write actions caught that and did nothing: saving a buyer,
 * creating a document, the CSV import, a Kanban move (the card snapped back),
 * adding a note, and voiding a document -- which also said nothing when the
 * server refused. Staff were left to guess whether anything had happened.
 *
 * This finds EVERY write call on every CRM page -- not a list of known ones --
 * and requires its promise chain to end in a .catch that reports through
 * CRM.noReplyMessage, which says the outcome is unknown and gives the safe
 * next step. A new write added without one fails here.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');

let pass = 0, fail = 0;
const t = (name, cond, extra) => {
  cond ? pass++ : fail++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : '   <-- ' + (extra === undefined ? '' : extra)}`);
};

// Handled elsewhere, by name and with a reason, rather than loosening the rule.
const EXCEPTIONS = {
  'crm/buyer/index.html DELETE':
    'the buyer Delete is fixed in PR #160, whose own check (check-deleted-buyers.js) asserts its no-reply message',
};

function pages(dir) {
  const out = [];
  for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...pages(rel));
    else if (e.name === 'index.html') out.push(rel);
  }
  return out;
}

// The statement starting at `from`: scan to the `;` at depth 0, skipping strings.
function statementAt(src, from) {
  let depth = 0;
  for (let i = from; i < src.length; i++) {
    const c = src[i];
    if (c === "'" || c === '"' || c === '`') {
      for (i++; i < src.length && src[i] !== c; i++) if (src[i] === '\\') i++;
      continue;
    }
    if (c === '(' || c === '{' || c === '[') depth++;
    else if (c === ')' || c === '}' || c === ']') depth--;
    else if (c === ';' && depth === 0) return src.slice(from, i + 1);
  }
  return src.slice(from);
}

let found = 0;
for (const rel of pages('crm').sort()) {
  const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const re = /CRM\.fetchJson\([^;]*?method: '(POST|PATCH|PUT|DELETE)'/g;
  let m;
  while ((m = re.exec(src))) {
    // Walk back to the start of the statement the call belongs to -- past
    // continuation lines of a multi-line ternary (`? a` / `: b`).
    let lineStart = src.lastIndexOf('\n', m.index) + 1;
    while (/^\s*[?:]/.test(src.slice(lineStart, src.indexOf('\n', lineStart)))) {
      lineStart = src.lastIndexOf('\n', lineStart - 2) + 1;
    }
    const stmt = statementAt(src, lineStart);
    const line = src.slice(0, m.index).split('\n').length;
    const key = `${rel} ${m[1]}`;
    found++;
    if (EXCEPTIONS[key]) {
      t(`${rel}:${line} ${m[1]} -- exempt: ${EXCEPTIONS[key]}`, true);
      continue;
    }
    // A write kept in a variable (var req = ...) is finished further down.
    const v = stmt.match(/^\s*var (\w+) =/);
    const chain = v ? statementAt(src, src.indexOf(`${v[1]}.then(`, lineStart)) : stmt;
    t(`${rel}:${line} ${m[1]} reports a request that got no reply`,
      /\.catch\(function \((\w+)\)[\s\S]*CRM\.noReplyMessage\(\1,/.test(chain),
      'no .catch reporting through CRM.noReplyMessage -- a dropped request here says nothing');
  }
}
t(`every write call on every CRM page was examined (${found} found)`, found >= 8, `${found} found`);

// ---- the helper itself -------------------------------------------------------
{
  const sandbox = { window: {}, document: { addEventListener() {}, readyState: 'complete' } };
  vm.createContext(sandbox);
  try { vm.runInContext(fs.readFileSync(path.join(ROOT, 'assets/crm.js'), 'utf8'), sandbox); } catch (e) { /* DOM wiring */ }
  const CRM = sandbox.window.CRM || {};
  t('CRM.noReplyMessage exists', typeof CRM.noReplyMessage === 'function');
  if (typeof CRM.noReplyMessage === 'function') {
    const msg = CRM.noReplyMessage(new TypeError('Failed to fetch'), 'Saving', 'Try again.');
    t('   it says the outcome is unknown, rather than claiming a failure',
      /did not get a reply from the server, so it is not known whether it went through\. Try again\.$/.test(msg), msg);
    t('   and stays quiet for the sign-in redirect, which is not a failure',
      CRM.noReplyMessage(new Error('unauthorized'), 'Saving', 'x') === null);
  }
}

// ---- the actions where the next step matters ----------------------------------
{
  const kanban = fs.readFileSync(path.join(ROOT, 'crm/kanban/index.html'), 'utf8');
  t('a Kanban move with no reply reloads the board from the server instead of guessing',
    /reloadBoard\(\)\.then\(function \(\) \{ window\.alert\(msg\); \}/.test(kanban));
  const buyer = fs.readFileSync(path.join(ROOT, 'crm/buyer/index.html'), 'utf8');
  t('creating a buyer warns against adding it twice; editing says saving again is harmless',
    /so it is not added twice/.test(buyer) && /saving them again does no harm/.test(buyer));
  const view = fs.readFileSync(path.join(ROOT, 'crm/document/view/index.html'), 'utf8');
  t('voiding a document reports the server\'s refusal, not only success',
    /if \(result\.ok\) \{ window\.location\.reload\(\); return; \}\s*window\.alert\(\(result\.data && result\.data\.error\)/.test(view));
}

const ok = fail === 0;
console.log(`\ncrm-write-failures ${ok ? 'OK' : 'FAILED'} -- every CRM write says so when it gets no reply.`);
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(ok ? 0 : 1);
