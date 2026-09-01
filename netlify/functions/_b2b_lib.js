'use strict';

/*
 * Section J Phase 3 -- self-built, free-only reverse IP -> organization
 * lookup via RDAP (Registration Data Access Protocol), the modern
 * successor to WHOIS. No paid data-broker APIs anywhere in this file.
 *
 * Uses IANA's own official RDAP bootstrap files (data.iana.org/rdap/
 * ipv4.json, ipv6.json) to determine which Regional Internet Registry
 * (ARIN/RIPE/APNIC/AFRINIC/LACNIC) is authoritative for a given IP block,
 * then queries that registry's RDAP service directly -- the documented,
 * correct way to do this (not guessing across all five, not depending on
 * a third-party bootstrap proxy). The bootstrap files themselves are
 * small, official, and cached for 24h per warm function container to
 * avoid re-fetching them constantly.
 *
 * Respects each registry's rate-limiting/fair-use expectations (verified
 * via research, not assumed -- see docs/j3-acceptance-criteria.md) by:
 *  - caching every result in the ip_org_cache table so the same IP is
 *    never re-queried within the cache TTL, keyed by a one-way hash of
 *    the IP (never the raw IP -- same pattern as consent_log's
 *    device_hash), matching this pipeline's "never persist raw IP"
 *    discipline everywhere else;
 *  - a short request timeout on every RDAP call so a slow/unresponsive
 *    registry can never hang the visitor-facing collect endpoint;
 *  - exactly one live query per uncached IP, no retries, no polling.
 *
 * resolution_type is an honest, probabilistic classification, never a
 * verified company identity -- see classifyOrg()'s own comment, and the
 * disclosure text every UI surface showing this data must render
 * alongside it (CLASSIFICATION_DISCLOSURE below).
 */

const crypto = require('crypto');

const BOOTSTRAP_URLS = {
  v4: 'https://data.iana.org/rdap/ipv4.json',
  v6: 'https://data.iana.org/rdap/ipv6.json',
};
const BOOTSTRAP_TTL_MS = 24 * 60 * 60 * 1000;
const RDAP_TIMEOUT_MS = 3000;
const CACHE_TTL_DAYS = 30;

// This is the exact, unedited language every UI surface displaying
// org_name/resolution_type must show alongside it -- not a paraphrase.
const CLASSIFICATION_DISCLOSURE =
  'This only reliably identifies dedicated/corporate network infrastructure. ' +
  'Residential and mobile-carrier IPs resolve to the ISP, not the visiting company. ' +
  'ASN/network registration data is never verified company identity -- treat it as a probabilistic signal, not a fact.';

let bootstrapCache = { v4: null, v6: null, fetchedAt: 0 };

function ipToLong(ip) {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) return null;
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

function ipInCidr(ip, cidr) {
  const [base, bitsStr] = cidr.split('/');
  const bits = Number(bitsStr);
  const ipLong = ipToLong(ip);
  const baseLong = ipToLong(base);
  if (ipLong === null || baseLong === null) return false;
  if (bits === 0) return true;
  const mask = bits === 32 ? 0xffffffff : (~((1 << (32 - bits)) - 1)) >>> 0;
  return (ipLong & mask) === (baseLong & mask);
}

async function fetchWithTimeout(url, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function loadBootstrap() {
  const now = Date.now();
  if (bootstrapCache.v4 && now - bootstrapCache.fetchedAt < BOOTSTRAP_TTL_MS) {
    return bootstrapCache;
  }
  try {
    const [v4, v6] = await Promise.all([
      fetchWithTimeout(BOOTSTRAP_URLS.v4, RDAP_TIMEOUT_MS),
      fetchWithTimeout(BOOTSTRAP_URLS.v6, RDAP_TIMEOUT_MS),
    ]);
    bootstrapCache = { v4, v6, fetchedAt: now };
  } catch (err) {
    console.warn('[_b2b_lib] Could not refresh IANA RDAP bootstrap data:', err && err.message);
    // Keep whatever we had (even if stale/empty) rather than throwing --
    // a bootstrap-fetch hiccup must never break event ingestion.
  }
  return bootstrapCache;
}

// Only IPv4 is supported for the CIDR match today (ipToLong is IPv4-only)
// -- an IPv6 visitor simply resolves to "unknown", not an error.
async function findRdapBase(ip) {
  if (ip.includes(':')) return null; // IPv6 -- not implemented, fails soft
  const boot = await loadBootstrap();
  if (!boot.v4 || !Array.isArray(boot.v4.services)) return null;
  for (const [cidrs, urls] of boot.v4.services) {
    for (const cidr of cidrs) {
      if (ipInCidr(ip, cidr)) return urls[0];
    }
  }
  return null;
}

// Heuristic-only classification -- never treated as verified identity.
// Looks for common ISP/mobile-carrier vocabulary in the org/network name;
// anything else with a real org name is called "corporate" (dedicated
// allocation, not proof of who's actually behind the visit); no usable
// name at all is "unknown".
function classifyOrg(name) {
  if (!name) return 'unknown';
  const n = name.toLowerCase();
  if (/\b(mobile|cellular|wireless|lte|4g|5g)\b/.test(n)) return 'mobile';
  if (/\b(isp|broadband|cable|dsl|fiber|residential|dynamic|telecom|telecommunications|communications)\b/.test(n)) return 'isp';
  return 'corporate';
}

function extractOrgName(rdap) {
  if (!rdap) return null;
  if (typeof rdap.name === 'string' && rdap.name.trim()) return rdap.name.trim().slice(0, 300);
  const entities = Array.isArray(rdap.entities) ? rdap.entities : [];
  for (const e of entities) {
    const vcard = e.vcardArray && e.vcardArray[1];
    if (Array.isArray(vcard)) {
      const fn = vcard.find((v) => v[0] === 'fn');
      if (fn && fn[3]) return String(fn[3]).trim().slice(0, 300);
    }
  }
  return null;
}

function hashIp(ip) {
  return crypto.createHash('sha256').update('ip-org-cache:' + ip).digest('hex').slice(0, 32);
}

async function ensureSchema(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS ip_org_cache (
      ip_hash          text PRIMARY KEY,
      org_name         text,
      resolution_type  text NOT NULL,
      resolved_at      timestamptz NOT NULL DEFAULT now(),
      expires_at       timestamptz NOT NULL
    )
  `;
}

async function resolveOrg(sql, ip) {
  if (!ip) return { orgName: null, resolutionType: 'unknown' };
  const ipHash = hashIp(ip);

  const cached = await sql`
    SELECT org_name, resolution_type FROM ip_org_cache
    WHERE ip_hash = ${ipHash} AND expires_at > now()
  `;
  if (cached[0]) {
    return { orgName: cached[0].org_name, resolutionType: cached[0].resolution_type };
  }

  let orgName = null;
  let resolutionType = 'unknown';
  try {
    const base = await findRdapBase(ip);
    if (base) {
      const rdap = await fetchWithTimeout(`${base.replace(/\/$/, '')}/ip/${ip}`, RDAP_TIMEOUT_MS);
      orgName = extractOrgName(rdap);
      resolutionType = classifyOrg(orgName);
    }
  } catch (err) {
    // A failed/timed-out RDAP lookup resolves to "unknown", not an error
    // that blocks the event write.
    resolutionType = 'unknown';
  }

  const expiresAt = new Date(Date.now() + CACHE_TTL_DAYS * 24 * 60 * 60 * 1000);
  try {
    await sql`
      INSERT INTO ip_org_cache (ip_hash, org_name, resolution_type, expires_at)
      VALUES (${ipHash}, ${orgName}, ${resolutionType}, ${expiresAt})
      ON CONFLICT (ip_hash) DO UPDATE SET
        org_name = EXCLUDED.org_name, resolution_type = EXCLUDED.resolution_type,
        resolved_at = now(), expires_at = EXCLUDED.expires_at
    `;
  } catch {
    // Cache-write failure shouldn't lose the resolved value for this call.
  }

  return { orgName, resolutionType };
}

module.exports = { resolveOrg, ensureSchema, CLASSIFICATION_DISCLOSURE, classifyOrg, extractOrgName };
