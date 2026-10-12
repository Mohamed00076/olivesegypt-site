#!/usr/bin/env node
'use strict';

/*
 * Publishes /deployed-commit.txt: the git commit this deploy was built from.
 *
 *   node scripts/write-deploy-marker.js   (netlify.toml build command, before prune-publish.js)
 *
 * The live check (scripts/check-live.js, on GitHub Actions) reads it to know
 * that the site it is checking is the commit just merged, and its daily run
 * fails if the live site is behind main -- a deploy that failed or never ran.
 * Netlify sets COMMIT_REF during a build. The repository is public, so the
 * commit id discloses nothing new.
 */

const fs = require('fs');
const path = require('path');

const ref = process.env.COMMIT_REF || 'unknown';
fs.writeFileSync(path.join(__dirname, '..', 'deployed-commit.txt'), ref + '\n');
console.log(`write-deploy-marker: deployed-commit.txt = ${ref}`);
