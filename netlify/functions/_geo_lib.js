'use strict';

/*
 * Section J Phase 2 -- country resolution (via the GeoLite2-Country
 * database fetched at build time by scripts/build-geo.js) and
 * device-type/browser parsing from a User-Agent string. Both are
 * read-only, self-hosted, no external network call at request time.
 *
 * The .mmdb reader is opened once and cached across warm invocations of
 * the same function container (same pattern Umami's own detect.ts uses
 * for its own MaxMind lookup). If the file is missing (a build without
 * network access to the mirror, or before the first successful build-geo
 * run), country resolution simply returns null -- never throws, never
 * blocks an event write.
 */

const path = require('path');
const maxmind = require('maxmind');
const { UAParser } = require('ua-parser-js');

const MMDB_PATH = path.resolve(__dirname, '..', '..', 'geo', 'GeoLite2-Country.mmdb');

let lookupPromise = null;
let lookupFailed = false;

function getLookup() {
  if (lookupFailed) return Promise.resolve(null);
  if (!lookupPromise) {
    lookupPromise = maxmind.open(MMDB_PATH).catch((err) => {
      lookupFailed = true;
      console.warn('[_geo_lib] GeoLite2-Country.mmdb not available -- country resolution disabled this run:', err && err.message);
      return null;
    });
  }
  return lookupPromise;
}

// Resolves an IP to a two-letter ISO country code, or null. The IP
// passed in is never persisted by this function or its caller -- see
// analytics-collect.js, which reads it transiently for this one lookup
// (and the internal-IP-allowlist check) and never writes it to storage.
async function resolveCountry(ip) {
  if (!ip) return null;
  const lookup = await getLookup();
  if (!lookup) return null;
  try {
    const result = lookup.get(ip);
    return (result && result.country && result.country.iso_code) || null;
  } catch {
    return null;
  }
}

// Coarse device type (mobile/tablet/desktop) + browser name from the
// request's own User-Agent header -- never trusts a client-supplied
// value for this, since the header is already authoritative and free.
function parseUserAgent(userAgent) {
  if (!userAgent) return { deviceType: null, browser: null };
  try {
    const r = UAParser(userAgent);
    const deviceType = (r.device && r.device.type) || 'desktop';
    const browser = (r.browser && r.browser.name) || null;
    return { deviceType, browser };
  } catch {
    return { deviceType: null, browser: null };
  }
}

module.exports = { resolveCountry, parseUserAgent, MMDB_PATH };
