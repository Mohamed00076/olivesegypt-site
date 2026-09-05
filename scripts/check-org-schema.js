#!/usr/bin/env node
'use strict';

/*
 * The Organization entity: exactly one definition, on the homepage, with the
 * shape the owner approved.
 *
 *   node scripts/check-org-schema.js        (part of `npm test`)
 *
 * Before 2026-09-05 this site carried 53 full Organization definitions -- one
 * per content page -- all claiming the same @id and disagreeing with each
 * other in five distinct ways: different name, description, address, contact
 * point and sameAs list. To a consumer of structured data that is not five
 * organisations, it is one organisation described five contradictory ways.
 * Nothing detected it because each page owns its own copy and no build step
 * regenerates them.
 *
 * So the checks here are mostly about what must NOT be there:
 *   - more than one Organization definition anywhere on the site
 *   - fields the owner explicitly excluded (foundingDate, alternateName,
 *     areaServed) creeping back in
 *   - the WebSite node growing its own copy of the organisation's identity
 *     instead of referencing it by @id
 *   - a logo URL pointing at a file that is not in the publish directory
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const ORG_ID = 'https://olivesegypt.com/#organization';
const ORIGIN = 'https://olivesegypt.com';

// Approved by the owner on 2026-09-05. Anything outside this set needs their
// say-so, not a developer's judgement -- the excluded ones were named
// individually in the instruction.
const ALLOWED_KEYS = new Set([
  '@context', '@type', '@id', 'name', 'url', 'logo', 'description',
  'address', 'email', 'contactPoint', 'sameAs',
]);
const FORBIDDEN_KEYS = ['foundingDate', 'alternateName', 'areaServed'];

const problems = [];
const files = execSync('git ls-files "*index.html"', { cwd: ROOT }).toString().trim().split('\n');

function jsonLd(html) {
  const out = [];
  const re = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    try {
      out.push(JSON.parse(m[1]));
    } catch (e) {
      out.push({ __parseError: e.message });
    }
  }
  return out;
}

/*
 * Every node, at any depth. The first version of this file only looked at
 * top-level nodes, which meant the organisation nodes nested inside an
 * Article's author/publisher were invisible to it -- and those are exactly
 * where an unlinked second copy of the company hides.
 */
function nodes(doc) {
  const out = [];
  (function walk(n) {
    if (Array.isArray(n)) return n.forEach(walk);
    if (!n || typeof n !== 'object') return;
    out.push(n);
    Object.values(n).forEach(walk);
  })(doc);
  return out;
}

// The full definition -- the node that actually describes the company, as
// opposed to a reference that merely names it (an Article's publisher, say).
function isOrgDefinition(n) {
  if (!n || typeof n !== 'object' || n['@id'] !== ORG_ID) return false;
  const t = [].concat(n['@type']);
  if (!(t.includes('Organization') || t.includes('Wholesaler'))) return false;
  return 'description' in n || 'address' in n || 'contactPoint' in n;
}

function isOrganizationNode(n) {
  return n && typeof n === 'object' && [].concat(n['@type']).includes('Organization');
}

// ---- one definition, and it is on the homepage ---------------------------
const definitions = [];
for (const f of files) {
  const html = fs.readFileSync(path.join(ROOT, f), 'utf8');
  for (const doc of jsonLd(html)) {
    if (doc.__parseError) {
      problems.push(`${f}: JSON-LD does not parse -- ${doc.__parseError}`);
      continue;
    }
    for (const n of nodes(doc)) if (isOrgDefinition(n)) definitions.push([f, n]);
  }
}

if (definitions.length !== 1) {
  problems.push(
    `expected exactly 1 Organization definition site-wide, found ${definitions.length}` +
    (definitions.length ? `: ${definitions.map(([f]) => f).join(', ')}` : '')
  );
} else if (definitions[0][0] !== 'index.html') {
  problems.push(`the Organization definition lives in ${definitions[0][0]}, expected index.html`);
}

const org = definitions.length === 1 ? definitions[0][1] : null;

if (org) {
  // ---- type, and the fields the owner ruled out --------------------------
  if (org['@type'] !== 'Organization') {
    problems.push(`@type is ${JSON.stringify(org['@type'])}, expected "Organization"`);
  }
  for (const k of FORBIDDEN_KEYS) {
    if (k in org) problems.push(`"${k}" is present; the owner excluded it explicitly`);
  }
  const extra = Object.keys(org).filter((k) => !ALLOWED_KEYS.has(k));
  if (extra.length) {
    problems.push(`unapproved field(s) added: ${extra.join(', ')} -- these need the owner's approval`);
  }
  for (const k of ['name', 'url', 'logo', 'description', 'address', 'email', 'contactPoint', 'sameAs']) {
    if (!(k in org)) problems.push(`required field "${k}" is missing`);
  }

  // ---- the logo must be a real file in the publish directory -------------
  if (typeof org.logo === 'string') {
    if (!org.logo.startsWith(ORIGIN + '/')) {
      problems.push(`logo "${org.logo}" is not an absolute URL on ${ORIGIN}`);
    } else {
      const rel = org.logo.slice(ORIGIN.length + 1);
      const file = path.join(ROOT, rel);
      if (!fs.existsSync(file)) {
        problems.push(`logo "${org.logo}" does not resolve to a file in the publish directory (${rel})`);
      } else {
        // Google wants a raster logo it can actually read; a stub or an HTML
        // error page saved with a .png name would pass an existence check.
        const head = fs.readFileSync(file).subarray(0, 24);
        const isPng = head.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
        if (!isPng) {
          problems.push(`logo ${rel} is not a PNG`);
        } else {
          const w = head.readUInt32BE(16);
          const h = head.readUInt32BE(20);
          if (w < 112 || h < 112) {
            problems.push(`logo ${rel} is ${w}x${h}; Google's minimum for an Organization logo is 112x112`);
          }
        }
      }
    }
  }

  // Kalamata is on the site but deliberately absent from this description --
  // the owner asked for that, and a later well-meaning edit would undo it.
  if (/kalamata/i.test(org.description || '')) {
    problems.push('the description mentions Kalamata; the owner asked for it to stay out of this text');
  }
}

// ---- every node claiming this @id must agree with the definition --------
//
// A reference that names the company is fine; a reference that names it
// *differently* is the 53-definitions problem in miniature.
if (org) {
  const canonicalLogo = typeof org.logo === 'string' ? org.logo : (org.logo || {}).url;
  for (const f of files) {
    const html = fs.readFileSync(path.join(ROOT, f), 'utf8');
    for (const doc of jsonLd(html)) {
      if (doc.__parseError) continue;
      for (const n of nodes(doc)) {
        if (!n || typeof n !== 'object' || n['@id'] !== ORG_ID || n === org) continue;
        if ('name' in n && n.name !== org.name) {
          problems.push(`${f}: a node claiming the canonical @id calls the company "${n.name}", not "${org.name}"`);
        }
        const l = typeof n.logo === 'string' ? n.logo : (n.logo || {}).url;
        if (l && l !== canonicalLogo) {
          problems.push(`${f}: a node claiming the canonical @id uses logo ${l}, not ${canonicalLogo}`);
        }
      }
    }
  }
}

// ---- Organization nodes with no @id at all ------------------------------
//
// Counted and reported rather than failed: 14 of these exist today, on the
// seven Arabic article pages (author + publisher), naming the company in
// Arabic with no link to the canonical entity. Linking them changes what an
// Arabic page says about the company, which is pending the owner's review of
// the Arabic structured-data audit (docs/arabic-schema-audit.md). When that
// lands, this becomes a hard failure.
const anonymous = [];
for (const f of files) {
  const html = fs.readFileSync(path.join(ROOT, f), 'utf8');
  for (const doc of jsonLd(html)) {
    if (doc.__parseError) continue;
    for (const n of nodes(doc)) {
      if (isOrganizationNode(n) && !n['@id'] && n.name) anonymous.push(f);
    }
  }
}

// ---- WebSite references the organisation, never re-describes it ----------
const IDENTITY_FIELDS = ['logo', 'address', 'contactPoint', 'email', 'telephone', 'sameAs'];
let websites = 0;
for (const f of files) {
  const html = fs.readFileSync(path.join(ROOT, f), 'utf8');
  for (const doc of jsonLd(html)) {
    for (const n of nodes(doc)) {
      if (!n || typeof n !== 'object' || n['@type'] !== 'WebSite') continue;
      websites += 1;
      const pub = n.publisher;
      if (!pub || typeof pub !== 'object' || pub['@id'] !== ORG_ID) {
        problems.push(`${f}: WebSite does not reference the Organization via publisher @id`);
      } else if (Object.keys(pub).length !== 1) {
        problems.push(`${f}: WebSite publisher should be a bare {"@id": ...} reference, not a second copy`);
      }
      const dup = IDENTITY_FIELDS.filter((k) => k in n);
      if (dup.length) {
        problems.push(`${f}: WebSite carries organisation field(s) of its own: ${dup.join(', ')}`);
      }
    }
  }
}
if (websites === 0) problems.push('no WebSite node found on the site');

if (problems.length === 0) {
  console.log(
    `org-schema OK -- one Organization definition (index.html), every node claiming that @id ` +
    `agrees with it, ${websites} WebSite node(s) referencing it, logo resolves in the publish ` +
    `directory.\n              note: ${anonymous.length} Organization node(s) carry no @id ` +
    `(Arabic article author/publisher) -- tracked in docs/arabic-schema-audit.md, pending review.`
  );
  process.exit(0);
}
console.error(`org-schema FAILED -- ${problems.length} problem(s):\n`);
problems.forEach((p) => console.error('  ' + p));
process.exit(1);
