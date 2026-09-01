#!/usr/bin/env node
'use strict';

/*
 * Section J Phase 2 -- downloads the GeoLite2-Country database (country-
 * level only; GeoLite2-City is ~60MB, over Netlify Functions' 50MB
 * unzipped bundle limit, so it isn't an option here -- see
 * docs/j2-acceptance-criteria.md) into geo/GeoLite2-Country.mmdb at build
 * time, from the free, unofficial GitHub-hosted redistribution mirror
 * (github.com/GitSquared/node-geolite2-redist) that umami-olivesegypt's
 * own build step falls back to when no MaxMind account/license key is
 * configured -- no account, no license key, no recurring re-verification.
 *
 * This is a build-time step, not something bundled into git: geo/ is
 * gitignored, and this script runs via netlify.toml's [build] command
 * on every deploy, which is also this pipeline's "scheduled auto-
 * refresh" mechanism when paired with a periodic Netlify scheduled
 * function hitting a build hook (see netlify/functions/geo-refresh.js).
 *
 * Must never fail the whole site build over a geo-data hiccup: any
 * download/extract failure is logged and the script exits 0, leaving
 * geo/ empty. The runtime geo lookup (_geo_lib.js) already treats a
 * missing database as "no country data," not an error.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const zlib = require('zlib');
const { execFileSync } = require('child_process');

const MIRROR_URL = 'https://raw.githubusercontent.com/GitSquared/node-geolite2-redist/master/redist/GeoLite2-Country.tar.gz';
const GEO_DIR = path.resolve(__dirname, '..', 'geo');
const DEST_MMDB = path.join(GEO_DIR, 'GeoLite2-Country.mmdb');
const TMP_TAR = path.join(GEO_DIR, '.download.tar.gz');
const TMP_EXTRACT = path.join(GEO_DIR, '.extract');

function download(url, dest, redirectsLeft = 5) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location && redirectsLeft > 0) {
        res.resume();
        return download(res.headers.location, dest, redirectsLeft - 1).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode} fetching ${url}`));
      }
      const out = fs.createWriteStream(dest);
      res.pipe(out);
      out.on('finish', () => out.close(resolve));
      out.on('error', reject);
    }).on('error', reject);
  });
}

async function main() {
  fs.mkdirSync(GEO_DIR, { recursive: true });

  console.log('[build-geo] downloading GeoLite2-Country from the free redistribution mirror...');
  await download(MIRROR_URL, TMP_TAR);

  fs.rmSync(TMP_EXTRACT, { recursive: true, force: true });
  fs.mkdirSync(TMP_EXTRACT, { recursive: true });
  execFileSync('tar', ['-xzf', TMP_TAR, '-C', TMP_EXTRACT]);

  const entries = fs.readdirSync(TMP_EXTRACT);
  const versionDir = entries.find((e) => e.startsWith('GeoLite2-Country'));
  if (!versionDir) throw new Error('Extracted archive did not contain a GeoLite2-Country directory');

  const mmdbSrc = path.join(TMP_EXTRACT, versionDir, 'GeoLite2-Country.mmdb');
  fs.copyFileSync(mmdbSrc, DEST_MMDB);

  const sizeMb = (fs.statSync(DEST_MMDB).size / (1024 * 1024)).toFixed(1);
  console.log(`[build-geo] wrote ${DEST_MMDB} (${sizeMb} MB, from ${versionDir})`);

  fs.rmSync(TMP_TAR, { force: true });
  fs.rmSync(TMP_EXTRACT, { recursive: true, force: true });
}

main().catch((err) => {
  console.warn('[build-geo] Could not refresh the geo database this build -- continuing without it.');
  console.warn('[build-geo] Reason:', err && err.message ? err.message : err);
  console.warn('[build-geo] Country resolution will simply return null until the next successful build; this is not fatal.');
  // Exit 0 deliberately -- a geo-data hiccup must never fail the site build.
  process.exit(0);
});
