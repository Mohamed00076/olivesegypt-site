#!/usr/bin/env node
'use strict';

/*
 * No committed file names a path on somebody's machine.
 *
 *   node scripts/check-absolute-paths.js        (part of `npm test`)
 *
 * WHAT WENT WRONG
 *
 * generate-resource-pages.py read its header and footer at import time from two
 * files under an ephemeral per-session scratchpad directory outside the
 * repository. The absolute path was committed on 2026-09-01 and worked only
 * while the one container that wrote those files was alive; on any fresh
 * checkout the script raised FileNotFoundError before generating anything.
 *
 * It survived eighteen days, and nothing caught it. The suite did not run the
 * script, so the broken read never executed. Nobody else ran it either -- no
 * build step, no CI, no npm script -- so it never failed in front of anyone.
 * It was found by running the generator to check something unrelated, and
 * confirmed only by reading its first fifteen lines. That is not a discovery
 * method; it is luck, and the script was retired on 2026-09-19 (C-95).
 *
 * WHAT THIS ASSERTS
 *
 * No tracked file that can run or configure anything contains a filesystem path
 * rooted in a machine-specific location. Those paths are wrong by construction:
 * they describe one checkout, one container, one laptop. A repository that
 * names one cannot be cloned and used.
 *
 * WHAT IS FINE, AND IS THE POINT
 *
 * Asking the operating system for a temporary directory at run time --
 * os.tmpdir(), fs.mkdtempSync(), tempfile -- is correct and stays correct
 * everywhere. check-generator-parity.js does exactly that, three lines from a
 * comment about this defect. The fault was never using a temporary directory;
 * it was writing one machine's answer into a file.
 *
 * WHAT IS NOT CHECKED, AND WHY
 *
 * Web-absolute paths (/assets/..., /resources/...) are URLs, not filesystem
 * paths, and the site is built from them. Only the roots below are flagged.
 *
 * Windows drive paths are flagged in their backslash form only, for the reason
 * given beside that pattern: the first draft of this check flagged `mailto:/`,
 * a CSS `left:/` inside a regex and six other innocent lines, and a check that
 * cries wolf gets deleted rather than obeyed.
 *
 * Documentation is not scanned. docs/deployment-record.md quotes the two
 * original lines verbatim, which is the record doing its job, and a path in a
 * markdown file cannot be executed. The boundary is therefore what can run or
 * configure something, listed in SCANNED below.
 *
 * Prose inside a scanned file is NOT exempt. The comment in
 * check-generator-parity.js was reworded to describe the path rather than quote
 * it, the same way the docstrings there were reworded for the C-91 tagline
 * rule. A rule with an exemption for comments is a rule somebody routes around
 * by adding a comment.
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SELF = 'scripts/check-absolute-paths.js';

// Files that can run or configure something. A path in any of these reaches a
// program; a path in a .md or .csv reaches a reader.
const SCANNED = new Set(['.js', '.mjs', '.cjs', '.py', '.sh', '.json', '.toml', '.yml', '.yaml', '.html', '.css']);

// Roots that describe one machine. Kept short and explicit: each one is a place
// that exists on the author's computer and nowhere the code will actually run.
const ROOTS = [
  { re: /\/home\/[A-Za-z0-9_.-]/, what: '/home/…' },
  { re: /\/root\/[A-Za-z0-9_.-]/, what: '/root/…' },
  { re: /\/tmp\/[A-Za-z0-9_.-]/, what: '/tmp/…' },
  { re: /\/Users\/[A-Za-z0-9_.-]/, what: '/Users/…' },
  { re: /\/var\/folders\/[A-Za-z0-9_.-]/, what: '/var/folders/…' },
  { re: /\/private\/var\/[A-Za-z0-9_.-]/, what: '/private/var/…' },
  // Backslash form only. `C:/…` is indistinguishable from an ordinary
  // `label:/path` without more context than this check has -- the first draft
  // flagged `mailto:/`, `purged:/` and a CSS `left:/` in a regex -- and a
  // pattern that cries wolf is one somebody deletes.
  //
  // One or two backslashes, because a Windows path inside a JS or JSON string
  // literal is always written doubled ("C:\\Users\\x"). The first version
  // required exactly one and let the doubled form through -- caught by the
  // negative test that injected it, which is the only reason this line is right.
  { re: /(?<![A-Za-z0-9_])[A-Za-z]:\\{1,2}[A-Za-z0-9_.-]/, what: 'a Windows drive path' },
];

// A file may name one of these only with a reason written here. Empty is the
// intended state: the one candidate, a comment in check-generator-parity.js,
// was reworded instead of listed, because an exemption for prose is an
// exemption anybody can claim by writing a comment.
const ALLOWED = new Map();

let pass = 0, fail = 0;
const t = (name, cond, extra) => {
  cond ? pass++ : fail++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : '   <-- ' + (extra === undefined ? '' : extra)}`);
};

let tracked;
try {
  tracked = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 })
    .toString('utf8').split('\0').filter(Boolean);
} catch (e) {
  t('the tracked file list is readable', false, (e.message || '').split('\n')[0]);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(1);
}
t(`the tracked file list is readable (${tracked.length} file(s))`, tracked.length > 0);

const hits = [];
let scanned = 0;

for (const rel of tracked) {
  if (rel === SELF) continue;                         // holds the patterns themselves
  if (rel.startsWith('node_modules/')) continue;
  if (!SCANNED.has(path.extname(rel).toLowerCase())) continue;

  const full = path.join(ROOT, rel);
  let text;
  try { text = fs.readFileSync(full, 'utf8'); } catch { continue; }
  if (text.includes('\0')) continue;                  // not really text
  scanned++;

  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    for (const root of ROOTS) {
      if (!root.re.test(lines[i])) continue;
      if (ALLOWED.get(rel) === root.what) continue;
      hits.push(`${rel}:${i + 1} names ${root.what} — ${lines[i].trim().slice(0, 70)}`);
    }
  }
}

const show = (l) => `${l.length}:\n      ${l.slice(0, 8).join('\n      ')}${l.length > 8 ? '\n      …' : ''}`;

t(`enough files to be worth scanning (${scanned} of ${tracked.length} tracked)`, scanned > 20, `only ${scanned}`);
t('no runnable file names a path on somebody\'s machine', hits.length === 0, hits.length ? show(hits) : '');

// The point of the rule, stated as a test so it cannot quietly stop being true:
// the correct way to get a temporary directory is to ask for one.
{
  const parity = path.join(ROOT, 'scripts', 'check-generator-parity.js');
  const src = fs.existsSync(parity) ? fs.readFileSync(parity, 'utf8') : '';
  t('the suite still gets its temp directory from the OS rather than a literal',
    /os\.tmpdir\(\)/.test(src) && /mkdtemp/.test(src),
    'check-generator-parity.js no longer calls os.tmpdir() + mkdtemp');
}

if (fail === 0) {
  console.log(`\nabsolute-paths OK -- ${scanned} runnable file(s) scanned, none names a machine-specific path.`);
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
