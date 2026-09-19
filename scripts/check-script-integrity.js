#!/usr/bin/env node
'use strict';

/*
 * Every committed script still parses, and every dependency it names exists.
 *
 *   node scripts/check-script-integrity.js        (part of `npm test`)
 *
 * WHAT WENT WRONG
 *
 * Deploy 17 recorded that nothing checks whether runnable code is ever run.
 * `npm test` executes the check scripts, git ls-files and
 * generate-product-pages.py, and requires four helper modules. Nine scripts
 * were neither executed nor loaded by anything: admin-password.js,
 * build-geo.js, crm-create-user.js, crm-seed.js, db-roundtrip-check.js,
 * kpi-roundtrip-check.js, send-test-email.js, build-favicons.py and
 * generate-export-catalog-pdf.js.
 *
 * build-geo.js is the one that matters. Netlify runs it on every deploy and
 * nothing local did, so a syntax error or a renamed dependency in it would have
 * been discovered by a failed production build. That is the same shape as the
 * defect behind C-95: code nobody runs until it matters.
 *
 * WHAT THIS ASSERTS, WITHOUT RUNNING ANYTHING
 *
 * Nothing here executes a script, and that is the point rather than a
 * limitation. Several of them send email, write to the database or download a
 * GeoLite2 archive on their first line; a smoke test that ran them would be
 * worse than no smoke test. `node --check` and Python's ast.parse both read and
 * parse without evaluating, so:
 *
 *   1. every tracked .js under scripts/ and netlify/ parses as CommonJS;
 *   2. every tracked .py under scripts/ parses;
 *   3. every relative require() resolves to a file that exists;
 *   4. every bare require() is a Node builtin, a dependency declared in
 *      package.json, or named in TOOLING_ONLY below;
 *   5. every third-party Python import is stdlib or named in TOOLING_ONLY;
 *   6. the script netlify.toml names in its build command exists and parses.
 *
 * That last one is the reason this file exists. Renaming build-geo.js without
 * editing netlify.toml breaks every deploy and nothing else would notice.
 *
 * WHAT IT STILL DOES NOT CATCH
 *
 * A require() built at run time from a variable, a module that throws on load,
 * a wrong argument, a missing environment variable. Parsing is not running, and
 * the scripts that cannot safely be run stay unrun. This narrows the gap
 * Deploy 17 described; it does not close it.
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { builtinModules } = require('module');

const ROOT = path.join(__dirname, '..');
const SELF = 'scripts/check-script-integrity.js';

// Dependencies a maintainer installs to run a one-off asset builder, never
// present in the Netlify build and deliberately not in package.json: adding
// Playwright to devDependencies would have every production deploy install a
// browser toolchain to render two PDFs nobody regenerates on deploy.
//
// Each entry names the file that needs it, so an undeclared dependency
// appearing anywhere else still fails.
const TOOLING_ONLY = new Map([
  ['playwright', 'scripts/generate-export-catalog-pdf.js'],
  ['PIL', 'scripts/build-favicons.py'],
]);

const BUILTIN = new Set([...builtinModules, ...builtinModules.map((m) => `node:${m}`)]);

let pass = 0, fail = 0;
const t = (name, cond, extra) => {
  cond ? pass++ : fail++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : '   <-- ' + (extra === undefined ? '' : extra)}`);
};
const show = (l) => `${l.length}:\n      ${l.slice(0, 6).join('\n      ')}${l.length > 6 ? '\n      …' : ''}`;

const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const declared = new Set([...Object.keys(pkg.dependencies || {}), ...Object.keys(pkg.devDependencies || {})]);

const tracked = execFileSync('git', ['ls-files', '-z', 'scripts', 'netlify'], { cwd: ROOT })
  .toString('utf8').split('\0').filter(Boolean);
const jsFiles = tracked.filter((f) => f.endsWith('.js') && f !== SELF);
const pyFiles = tracked.filter((f) => f.endsWith('.py'));

t(`there are scripts to check (${jsFiles.length} JS, ${pyFiles.length} Python)`,
  jsFiles.length > 20 && pyFiles.length > 0);

// ---- 1 & 2: everything parses -------------------------------------------

const unparsable = [];
for (const rel of jsFiles) {
  try {
    execFileSync('node', ['--check', path.join(ROOT, rel)], { stdio: 'pipe' });
  } catch (e) {
    unparsable.push(`${rel}: ${(e.stderr ? e.stderr.toString() : e.message).trim().split('\n').find((l) => /Error/.test(l)) || 'parse failed'}`);
  }
}
const PY_PARSE = 'import ast,sys;ast.parse(open(sys.argv[1],encoding="utf-8").read(),sys.argv[1])';
for (const rel of pyFiles) {
  try {
    execFileSync('python3', ['-c', PY_PARSE, path.join(ROOT, rel)], { stdio: 'pipe' });
  } catch (e) {
    unparsable.push(`${rel}: ${(e.stderr ? e.stderr.toString() : e.message).trim().split('\n').pop()}`);
  }
}
t(`every script parses (${jsFiles.length + pyFiles.length} file(s))`, unparsable.length === 0, show(unparsable));

// ---- 3 & 4: every require() names something that exists ------------------

const REQUIRE = /require\(\s*['"]([^'"]+)['"]\s*\)/g;
const missingLocal = [], undeclared = [];

for (const rel of jsFiles) {
  const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const dir = path.dirname(path.join(ROOT, rel));
  for (const m of src.matchAll(REQUIRE)) {
    const spec = m[1];
    if (spec.startsWith('.')) {
      const base = path.resolve(dir, spec);
      const found = [base, `${base}.js`, `${base}.json`, path.join(base, 'index.js')].some((p) => fs.existsSync(p) && fs.statSync(p).isFile());
      if (!found) missingLocal.push(`${rel} requires ${spec}`);
      continue;
    }
    const top = spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0];
    if (BUILTIN.has(top) || declared.has(top)) continue;
    if (TOOLING_ONLY.get(top) === rel) continue;
    undeclared.push(`${rel} requires "${top}"${TOOLING_ONLY.has(top) ? ` (tooling-only, but allowed for ${TOOLING_ONLY.get(top)})` : ''}`);
  }
}
t('every relative require() resolves to a file that exists', missingLocal.length === 0, show(missingLocal));
t('every package require() is a builtin, declared, or named tooling-only', undeclared.length === 0, show(undeclared));

// ---- 5: Python imports ---------------------------------------------------

const stdlib = new Set(
  execFileSync('python3', ['-c', 'import sys;print("\\n".join(sys.stdlib_module_names))'], { stdio: 'pipe' })
    .toString('utf8').split('\n').map((s) => s.trim()).filter(Boolean)
);
const pyUndeclared = [];
for (const rel of pyFiles) {
  const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  for (const line of src.split('\n')) {
    const m = line.match(/^\s*(?:import\s+([A-Za-z_][\w.]*)|from\s+([A-Za-z_][\w.]*)\s+import)/);
    if (!m) continue;
    const top = (m[1] || m[2]).split('.')[0];
    if (stdlib.has(top)) continue;
    if (TOOLING_ONLY.get(top) === rel) continue;
    pyUndeclared.push(`${rel} imports "${top}"`);
  }
}
t('every third-party Python import is stdlib or named tooling-only', pyUndeclared.length === 0, show(pyUndeclared));

// ---- 6: the script Netlify actually runs --------------------------------

{
  const toml = fs.readFileSync(path.join(ROOT, 'netlify.toml'), 'utf8');
  const cmd = (toml.match(/^\s*command\s*=\s*"([^"]+)"/m) || [])[1] || '';
  const named = [...cmd.matchAll(/(?:^|\s)((?:scripts|netlify)\/[\w./-]+)/g)].map((m) => m[1]);

  t(`netlify.toml names a build script (${cmd || 'no command found'})`, named.length > 0, cmd);
  const absent = named.filter((rel) => !fs.existsSync(path.join(ROOT, rel)));
  t('every script the build command names exists', absent.length === 0, show(absent));
  const unchecked = named.filter((rel) => !jsFiles.includes(rel) && !pyFiles.includes(rel));
  t('and is one of the files checked above', unchecked.length === 0, show(unchecked));
}

if (fail === 0) {
  console.log(`\nscript-integrity OK -- ${jsFiles.length + pyFiles.length} script(s) parse, every dependency they name exists, and none of them was executed.`);
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
