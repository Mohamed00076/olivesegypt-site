#!/usr/bin/env node
'use strict';

/*
 * Internal working material never reaches the deploy artifact.
 *
 *   node scripts/check-publish-exclusions.js        (part of `npm test`)
 *
 * WHAT WENT WRONG
 *
 * netlify.toml sets `publish = "."`, so the publish directory is the whole
 * repository. robots.txt disallows 28 specific paths and none of them was
 * /docs or /scripts, so olivesegypt.com/docs/security-audit-2026-09.md was
 * fetchable and crawlable -- a full security and functional audit of the
 * public site and both internal apps, served from the company's own domain,
 * next to an access inventory, counsel questions, a data-flow inventory and
 * the claim register. Four root-level UI audits and a defect register were
 * served the same way.
 *
 * Nobody put them there on purpose. `publish = "."` publishes whatever exists,
 * so every internal document written since has been shipped by default, and
 * would have gone on being shipped.
 *
 * WHAT THIS ASSERTS
 *
 * It runs the real pruner against a real copy of the tracked tree, in a
 * temporary directory, and checks the result: the internal paths are gone and
 * the site is intact. Asserting the contents of a list would only prove the
 * list says what it says; this proves the script does what the list means.
 *
 * It also fails on a NEW root-level .md or .csv that is neither pruned nor
 * named below as published on purpose -- which is the case that created this
 * defect, an internal document appearing at the root and being served because
 * nothing said otherwise.
 *
 * WHAT IS NOT PRUNED, AND WHY
 *
 *   netlify/            the function bundler reads it after the build command
 *                       runs. Deleting it would break every function. Whether
 *                       Netlify ALSO serves it as static files is unresolved at
 *                       the time of writing; if it does, that needs its own fix.
 *   package.json        the function bundler resolves dependencies through it.
 *   package-lock.json   same.
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PRUNER = 'scripts/prune-publish.js';

// Must be gone from the artifact. Spot checks inside the pruned directories,
// not just the directories themselves.
const MUST_BE_ABSENT = [
  'docs', 'docs/security-audit-2026-09.md', 'docs/app-access-inventory.md',
  'docs/g0-counsel-questions.md', 'docs/g1-data-flow-inventory.md',
  'docs/claim-and-evidence-register.csv', 'docs/deployment-record.md',
  'scripts', 'scripts/build-geo.js', 'scripts/prune-publish.js',
  'contrast-audit.md', 'mobile-nav-overlap-audit.md',
  'part3-product-pages-audit.md', 'responsive-layout-audit.md',
  'ui-remediation-register.csv',
];

// Must survive it. A pruner that removed the site would also pass a test that
// only checked for absence.
const MUST_SURVIVE = [
  'index.html', 'ar/index.html', 'catalog/index.html', 'contact/index.html',
  'products/aggizi-green-olives/index.html', 'resources/faq/index.html',
  'assets/index-Dw0yUE42.css', 'assets/logo-BJ1TOn9V.png',
  'robots.txt', 'sitemap.xml', 'site.webmanifest', 'favicon.ico',
  'netlify/functions/auth-login.js', 'package.json',
  // On this list because deleting it took the site down on 2026-09-23.
  // Netlify reads redirects and headers from netlify.toml after the build
  // command runs, so pruning it stripped every rule from the deploy: the CRM
  // lost /api/*, and /api/crm/auth/me returned Netlify's own 404 page. It is
  // kept unfetchable by a forced 404 rule instead, asserted below.
  'netlify.toml',
];

// Root-level documents that are served on purpose. Anything else with these
// extensions has to be pruned or added here with a reason.
const PUBLISHED_BY_DESIGN = new Map([
  ['llms.txt', 'written to be read at the domain, like robots.txt'],
  ['README.md', 'repository readme; served today, and whether it should be is the owner\'s call rather than this check\'s'],
]);

let pass = 0, fail = 0;
const t = (name, cond, extra) => {
  cond ? pass++ : fail++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : '   <-- ' + (extra === undefined ? '' : extra)}`);
};
const show = (l) => `${l.length}: ${l.slice(0, 8).join(', ')}${l.length > 8 ? ' …' : ''}`;

// ---- the build command still calls the pruner, and calls it last ----------

{
  const toml = fs.readFileSync(path.join(ROOT, 'netlify.toml'), 'utf8');
  const cmd = (toml.match(/^\s*command\s*=\s*"([^"]+)"/m) || [])[1] || '';
  t('netlify.toml still runs the pruner', cmd.includes(PRUNER), cmd || 'no build command');
  t('and runs it after the rest of the build',
    cmd.indexOf(PRUNER) > cmd.indexOf('build-geo.js'),
    cmd);
  t('publish is still the repository root, which is why this is needed',
    /publish\s*=\s*"\."/.test(toml),
    'publish changed -- if it is now a built directory, this check needs rethinking, not deleting');

  // netlify.toml survives the prune now, so the only thing keeping it off the
  // site is this rule. Deleting it instead is what broke production on
  // 2026-09-23, so both halves are asserted: the pruner must not list it, and
  // the rule must exist.
  t('the pruner no longer deletes netlify.toml',
    !/^\s*'netlify\.toml',/m.test(fs.readFileSync(path.join(ROOT, 'scripts/prune-publish.js'), 'utf8')),
    'pruning netlify.toml strips every redirect and header from the deploy -- it took the CRM down once already');
  t('and netlify.toml is blocked by a forced 404 instead',
    /from\s*=\s*"\/netlify\.toml"[\s\S]{0,120}?status\s*=\s*404[\s\S]{0,60}?force\s*=\s*true/.test(toml),
    'no forced 404 rule for /netlify.toml -- the file would be fetchable at the domain');
}

// ---- run the real pruner against a real copy -----------------------------

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pubprune-'));
try {
  const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 })
    .toString('utf8').split('\0').filter(Boolean);
  t(`the tracked tree can be copied (${tracked.length} files)`, tracked.length > 100);

  for (const rel of tracked) {
    const dest = path.join(tmp, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(path.join(ROOT, rel), dest);
  }

  let ran = true, err = '';
  try {
    execFileSync('node', [path.join(tmp, PRUNER)], { stdio: 'pipe' });
  } catch (e) {
    ran = false;
    err = (e.stderr ? e.stderr.toString() : e.message).trim().split('\n').slice(-2).join(' ');
  }
  t('the pruner runs against the artifact copy', ran, err);

  if (ran) {
    const present = MUST_BE_ABSENT.filter((rel) => fs.existsSync(path.join(tmp, rel)));
    const gone = MUST_SURVIVE.filter((rel) => !fs.existsSync(path.join(tmp, rel)));
    t(`every internal path is absent from the artifact (${MUST_BE_ABSENT.length} checked)`,
      present.length === 0, show(present));
    t(`and the site is intact (${MUST_SURVIVE.length} checked)`, gone.length === 0, show(gone));

    // A new internal document at the root would be served unless it is pruned.
    const leftover = fs.readdirSync(tmp, { withFileTypes: true })
      .filter((e) => e.isFile() && /\.(md|csv)$/i.test(e.name))
      .map((e) => e.name)
      .filter((n) => !PUBLISHED_BY_DESIGN.has(n));
    t('no unaccounted .md or .csv is left at the publish root', leftover.length === 0,
      leftover.length ? `${show(leftover)} — prune it, or name it in PUBLISHED_BY_DESIGN with a reason` : '');
  }
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

if (fail === 0) {
  console.log(`\npublish-exclusions OK -- the pruner removes ${MUST_BE_ABSENT.length} internal path(s) from a real copy of the tree and leaves the site standing.`);
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
