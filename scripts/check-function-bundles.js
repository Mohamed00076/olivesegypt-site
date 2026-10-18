#!/usr/bin/env node
'use strict';

/*
 * Every function, packaged the way Netlify packages it, loads on its own.
 *
 *   npm run test:bundles        (before every production deploy; not in `npm test`)
 *
 * Runs Netlify's own function bundler (@netlify/zip-it-and-ship-it, the
 * version below, fetched by npx -- nothing is added to package.json) over
 * netlify/functions with the included_files from netlify.toml. Then, for each
 * function's package, in a separate Node process with an empty environment:
 *
 *   - the function's module loads from inside the package
 *   - a real function exposes its entry point: `handler` (the older format)
 *     or a default export (the newer one); the shared _ helper files are
 *     deployed too, without one, and only need to load
 *   - every npm package its own code names is inside the package
 *
 * Why: on 2026-10-17 the bundler left @neondatabase/serverless out of the
 * newer-format crm-auth-forgot, which would have failed on Netlify with
 * "Cannot find module". Nothing in `npm test` packages functions, so only
 * this would have seen it. It needs the network (npx) and takes a minute or
 * two, which is why it is a deployment step and not part of `npm test`.
 *
 * Netlify's build uses its own copy of the bundler, which may be a newer
 * version; the staging deploy remains the final proof.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { builtinModules } = require('module');

const BUNDLER = '@netlify/zip-it-and-ship-it@16.3.1';
const ROOT = path.join(__dirname, '..');
const FN = path.join(ROOT, 'netlify', 'functions');

function includedFiles() {
  const toml = fs.readFileSync(path.join(ROOT, 'netlify.toml'), 'utf8');
  const section = toml.split(/^\[functions\]\s*$/m)[1] || '';
  const m = /^\s*included_files\s*=\s*\[([^\]]*)\]/m.exec(section.split(/^\[/m)[0]);
  return m ? [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]) : [];
}

const builtin = new Set(builtinModules);
function packagesNamed(dir) {
  const names = new Set();
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { if (e.name !== 'node_modules') walk(p); continue; }
      if (!/\.(m?js|cjs)$/.test(e.name) || /^___netlify-(bootstrap|telemetry)/.test(e.name)) continue;
      const src = fs.readFileSync(p, 'utf8');
      for (const m of src.matchAll(/(?:require\(\s*|\bfrom\s+|\bimport\s+|\bimport\(\s*)["']([^"'./][^"']*)["']/g)) {
        const spec = m[1].replace(/^node:/, '');
        const name = spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0];
        if (!builtin.has(spec) && !builtin.has(name)) names.add(name);
      }
    }
  };
  walk(dir);
  return [...names].sort();
}

function loadInIsolation(dir, file) {
  const probe = `import(${JSON.stringify('file://' + path.join(dir, file))})` +
    `.then((m) => { const d = m.default; console.log('RESULT ' + (typeof d === 'function' ? 'default' : typeof (d && d.handler) === 'function' || typeof m.handler === 'function' ? 'handler' : 'none')); })` +
    `.catch((e) => { console.log('RESULT error ' + String(e && e.message || e).split('\\n')[0]); });`;
  const r = spawnSync(process.execPath, ['-e', probe], { cwd: dir, env: { PATH: process.env.PATH }, encoding: 'utf8', timeout: 60000 });
  const line = (r.stdout || '').split('\n').find((l) => l.startsWith('RESULT ')) || 'RESULT error no answer (' + String(r.stderr || '').trim().split('\n').pop() + ')';
  return line.slice(7);
}

function main() {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'fn-bundles-'));
  try {
    const config = { '*': { includedFiles: includedFiles() } };
    console.log(`Packaging netlify/functions with ${BUNDLER} (included_files: ${config['*'].includedFiles.join(', ') || 'none'}) ...`);
    const r = spawnSync('npx', ['--yes', BUNDLER, FN, out, '--archive-format', 'none', '--config', JSON.stringify(config)],
      { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 600000 });
    let results;
    try { results = JSON.parse(r.stdout); } catch {
      console.log('FAIL  the bundler did not run:\n' + String(r.stderr || r.stdout || r.error).slice(0, 2000));
      process.exit(1);
    }

    let bad = 0;
    const rows = [];
    for (const f of results.sort((a, b) => a.name.localeCompare(b.name))) {
      const dir = f.path;
      const entry = path.join(dir, f.entryFilename || '');
      const lambda = fs.existsSync(entry) ? /getLambdaHandler\('([^']+)'\)/.exec(fs.readFileSync(entry, 'utf8')) : null;
      const main = lambda ? lambda[1] : f.entryFilename;
      const helper = f.name.startsWith('_');
      const loaded = loadInIsolation(dir, main);
      const pkgs = packagesNamed(dir);
      const missing = pkgs.filter((p) => !fs.existsSync(path.join(dir, 'node_modules', p, 'package.json')));
      const problems = [];
      if (loaded.startsWith('error')) problems.push('does not load: ' + loaded.slice(6));
      else if (!helper && loaded === 'none') problems.push('no entry point (handler or default export)');
      if (missing.length) problems.push('missing package(s): ' + missing.join(', '));
      if (problems.length) bad++;
      rows.push(`${problems.length ? 'FAIL' : 'PASS'}  ${f.name} (format ${f.runtimeAPIVersion || 1}, ${f.bundler})${pkgs.length ? ' -- packages: ' + pkgs.join(', ') : ''}${problems.length ? '   <-- ' + problems.join('; ') : ''}`);
    }
    rows.forEach((l) => console.log(l));
    console.log(`\nfunction-bundles ${bad ? 'FAILED' : 'OK'} -- ${results.length} packaged, ${bad} with a problem.`);
    process.exit(bad ? 1 : 0);
  } finally {
    fs.rmSync(out, { recursive: true, force: true });
  }
}

main();
