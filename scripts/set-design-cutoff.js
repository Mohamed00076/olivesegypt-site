#!/usr/bin/env node
'use strict';

/*
 * Sets the document page's DESIGN_CUTOFF for the deploy, reprints the sample
 * documents and runs their checks. The last commit before the merge.
 *
 *   NODE_PATH=<playwright's node_modules> CHROMIUM_PATH=<chromium> \
 *     node scripts/set-design-cutoff.js 2026-10-28T10:15Z
 *
 * The cutoff is the minute the deploy goes live, in UTC (owner, 2026-10-26).
 * Pick the minute the deploy is expected to be live, rounded UP: a document
 * created between the cutoff and the moment the new page is live would be
 * issued by the old page and printed by the new one under the other rule. A
 * cutoff a little late is harmless (those documents keep the old rule for
 * good); one that is early is not. No document is created on live between
 * the merge and the cutoff (owner: "no new documents on live").
 *
 * Then:
 *   1. writes `var DESIGN_CUTOFF = '<minute>:00Z';` into
 *      crm/document/view/index.html (nothing else changes);
 *   2. reprints docs/crm-samples/ with scripts/print-crm-samples.js, serving
 *      the repo on PORT (default 8899) for the print;
 *   3. runs check-crm-document-values.js and check-crm-document-pdfs.js.
 * It changes files only; committing and pushing are left to the person
 * running it. Exits non-zero, with the reason, on any failure.
 */

const fs = require('fs');
const path = require('path');
const { spawn, execFileSync } = require('child_process');
const { SAMPLES } = require('./crm-sample-documents');

const ROOT = path.join(__dirname, '..');
const PAGE = 'crm/document/view/index.html';
const LINE = /var DESIGN_CUTOFF = '[^']*';/;
const PORT = process.env.PORT || 8899;
const die = (m) => { console.error(`set-design-cutoff: ${m}`); process.exit(1); };

const arg = process.argv[2] || '';
const m = arg.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::00)?Z$/);
if (!m) die(`give the deploy minute in UTC, e.g. 2026-10-28T10:15Z (got "${arg}")`);
const cutoff = `${m[1]}T${m[2]}:${m[3]}:00Z`;
const at = new Date(cutoff);
if (isNaN(at)) die(`${arg} is not a real time`);
if (at < new Date() && !process.argv.includes('--past')) {
  die(`${cutoff} is in the past; the cutoff is the minute the deploy goes live (pass --past only to re-run for a deploy already made)`);
}

// The samples must sit on both sides, or check-crm-document-values cannot
// prove anything (it fails if they do not).
const dates = SAMPLES.map((s) => new Date(s.doc.created_at));
const before = dates.filter((d) => d < at).length;
const after = dates.length - before;
if (!before || !after) {
  die(`the sample documents are dated ${[...new Set(SAMPLES.map((s) => s.doc.created_at))].join(' and ')}; ` +
    `${cutoff} leaves ${before} before and ${after} after. Move ISSUED in scripts/crm-sample-documents.js past the cutoff first.`);
}

const file = path.join(ROOT, PAGE);
const page = fs.readFileSync(file, 'utf8');
if ((page.match(new RegExp(LINE, 'g')) || []).length !== 1) die(`${PAGE} must hold exactly one DESIGN_CUTOFF line`);
fs.writeFileSync(file, page.replace(LINE, `var DESIGN_CUTOFF = '${cutoff}';`));
console.log(`${PAGE}: DESIGN_CUTOFF = ${cutoff} (${before} sample documents before it, ${after} after)`);

(async () => {
  const server = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: ROOT, stdio: 'ignore' });
  try {
    for (let i = 0; ; i++) {
      try { await fetch(`http://localhost:${PORT}/${PAGE}`); break; } catch (e) {
        if (i > 50) throw new Error(`no server on port ${PORT}`);
        await new Promise((r) => setTimeout(r, 100));
      }
    }
    execFileSync('node', ['scripts/print-crm-samples.js'], { cwd: ROOT, stdio: 'inherit', env: { ...process.env, PORT: String(PORT) } });
  } catch (e) {
    die(`printing the samples failed: ${e.message}`);
  } finally {
    server.kill();
  }
  for (const c of ['check-crm-document-values.js', 'check-crm-document-pdfs.js']) {
    try { execFileSync('node', [`scripts/${c}`], { cwd: ROOT, stdio: 'inherit' }); } catch (e) { die(`${c} failed`); }
  }
  console.log(`set-design-cutoff: done. Look at the reprinted samples, run npm test, then commit "${PAGE}" and docs/crm-samples/.`);
})();
