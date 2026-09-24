#!/usr/bin/env node
'use strict';

/*
 * Removes internal files from the deploy artifact, during the build.
 *
 *   node scripts/prune-publish.js        (runs from netlify.toml's build command)
 *
 * WHY THIS EXISTS
 *
 * netlify.toml sets `publish = "."`, so the publish directory is the whole
 * repository and everything in it is served at olivesegypt.com. robots.txt
 * disallows 28 specific paths and none of them is /docs or /scripts, so
 * /docs/security-audit-2026-09.md was fetchable AND crawlable: a full security
 * and functional audit of the public site and both internal apps, served from
 * the company's own domain, alongside an access inventory, counsel questions,
 * a data-flow inventory and the claim register.
 *
 * There is no exclude list for a Netlify publish directory. The only way to
 * make a file genuinely absent -- not redirected, not blocked, not merely
 * noindexed -- is for it not to be there when the artifact is snapshotted.
 * This script runs after the build command's real work and deletes them, so
 * the deployed site returns a true 404 because the file does not exist.
 *
 * WHAT IS DELIBERATELY NOT PRUNED, AND WHY
 *
 *   netlify/         the function bundler reads this directory AFTER the build
 *                    command runs; deleting it would break every function.
 *                    Whether Netlify also serves it as static files is an open
 *                    question at the time of writing -- if it does, that needs
 *                    its own fix, not this one.
 *   package.json     the function bundler resolves dependencies through it.
 *   package-lock.json  same.
 *   assets/, geo/    published by design.
 *   netlify.toml     THIS FILE MUST SURVIVE THE BUILD. It was on the prune
 *                    list between 2026-09-23 and 2026-09-24 and that took the
 *                    production site down: Netlify collects redirects and
 *                    headers from netlify.toml AFTER the build command runs,
 *                    and publish = "." means the publish directory is the
 *                    repository root, so deleting it here deleted the only
 *                    copy Netlify had left to read. Every redirect vanished
 *                    from the deployed site -- all /api/* routes, the
 *                    /netlify/* guard, the gated-download paths and the SPA
 *                    fallback -- along with every security header. The CRM
 *                    went down and olivesegypt.com/api/crm/auth/me returned
 *                    Netlify's own 404 page. It is kept out of the published
 *                    site by a forced 404 redirect on /netlify.toml instead,
 *                    which is the same mechanism /netlify/* already uses.
 *                    That is a 404 rather than true absence, which is weaker
 *                    than what the rest of this list gets; a file that
 *                    configures the deploy cannot also be missing from it.
 *
 * SAFETY
 *
 * Nothing on the site links to any pruned path -- verified before this was
 * written -- and no function reads one at run time. The script refuses to
 * delete anything not on its own list, and prints what it removed so a build
 * log shows exactly what left the artifact.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

// Everything here is internal working material that has no reason to exist at
// the company's domain. Directories first; scripts/ last, because this file
// lives in it.
const PRUNE = [
  'docs',
  'contrast-audit.md',
  'mobile-nav-overlap-audit.md',
  'part3-product-pages-audit.md',
  'responsive-layout-audit.md',
  'ui-remediation-register.csv',
  'scripts',
];

let removed = 0, missing = 0;

for (const rel of PRUNE) {
  const full = path.join(ROOT, rel);
  if (!fs.existsSync(full)) {
    missing++;
    console.log(`prune-publish: ${rel} not present, nothing to do`);
    continue;
  }
  const stat = fs.statSync(full);
  fs.rmSync(full, { recursive: true, force: true });
  removed++;
  console.log(`prune-publish: removed ${rel}${stat.isDirectory() ? '/' : ''}`);
}

console.log(`prune-publish: ${removed} path(s) removed from the deploy artifact, ${missing} already absent`);
