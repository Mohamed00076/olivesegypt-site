# Deployment Record (retroactive)

This document exists because the formal process in `03-production-deployment.md`
— a written "PRODUCTION DEPLOYMENT REQUEST" per deploy, approved *before*
merging, followed by a Section D post-launch monitoring pass on the live
site — was **not followed** for any of the three deploys below. Approval was
real but informal (chat messages like "deploy it," "merge the PR when you
think it's ready," "merge it to main like before"), not approval of a
written request containing the fields that file requires.

This document is written after the fact, honestly, as the record that
process would have produced if it had been followed at the time. Where a
required field's work was genuinely done, it's reported. Where it wasn't
done, that's stated plainly rather than backfilled with something that
looks like it was.

**Status of Section D (post-launch monitoring) for all three deploys below:
not done, and not currently possible.** Section D requires checking the
*actual production site*. Production's reachability is itself unresolved —
`olivesegypt.com` returned a Vercel `DEPLOYMENT_NOT_FOUND` error when last
checked, most likely because the domain's DNS still points at an old Vercel
setup rather than this Netlify site (see the parked domain/DNS item).
Nothing below should be read as "verified live" — everything here was
verified against source code, the Netlify deploy-preview build, and (for
this document itself) direct visual inspection of two AI-generated images —
never against the actual production domain.

---

## Deploy 1 — Initial site rebuild (PR #1)

- **Merge commit:** `94b49b749d00fa1534d426b09e1688779e1c130e`
- **Merged:** 2026-09-01
- **Covers:** Phases A2, B, C, E, G, H, I, J (Phases 0-3), and F (reviewed,
  closed with no build — see `docs/j0-analytics-audit.md` and the
  conversation record for F's segment-capability matrix)
- **41 commits**, earliest `ee76c52` ("Remove Vercel deployment path, use
  Netlify only") through `94b49b7` itself.

### Complete changed-file list (133 files)

```
 .gitignore                                         |   4 +
 README.md                                          | 282 ++++++++++-
 admin/analytics/index.html                         | 513 ++++++++++++++++++-
 api/_lib.js                                        | 162 ------
 api/analytics.js                                   | 211 --------
 api/auth/login.js                                  |  78 ---
 api/auth/logout.js                                 |  17 -
 api/auth/me.js                                     |  32 --
 api/inquiries.js                                   | 236 ---------
 assets/analytics.js                                | 330 ++++++++++++
 assets/consent.js                                  | 249 +++++++++
 assets/crm.css                                     | 106 ++++
 assets/crm.js                                      | 103 ++++
 assets/hero-olive-grove-CfDaoiNm.png               | Bin 379743 -> 337047 bytes
 assets/hero-olive-grove-CfDaoiNm.webp              | Bin 0 -> 211122 bytes
 assets/industrial-olives-CAiQk-rL.png              | Bin 736600 -> 593247 bytes
 assets/logo-BJ1TOn9V.png                           | Bin 17672 -> 15119 bytes
 assets/logo-BJ1TOn9V.webp                          | Bin 0 -> 14172 bytes
 assets/olive-aggizi-BuhWRZTd.webp                  | Bin 0 -> 35404 bytes
 assets/olive-black-CzV0ukvu.jpg                    | Bin 36975 -> 34202 bytes
 assets/olive-black-CzV0ukvu.webp                   | Bin 0 -> 25436 bytes
 assets/olive-hamed-DhlKuQ55.webp                   | Bin 0 -> 159154 bytes
 assets/olive-harvest-Ca7G4M1A.jpg                  | Bin 60491 -> 54295 bytes
 assets/olive-manzanilla-vwgGqjiA.webp              | Bin 0 -> 21014 bytes
 assets/olive-stuffed-new-DaolBs_S.png              | Bin 222722 -> 139118 bytes
 assets/olive-stuffed-new-DaolBs_S.webp             | Bin 0 -> 20832 bytes
 assets/olive-toffahi-SpdiHPHF.jpg                  | Bin 161098 -> 114503 bytes
 assets/olive-toffahi-SpdiHPHF.webp                 | Bin 0 -> 87084 bytes
 assets/pack-barrel-F3kESlJ-.png                    | Bin 276690 -> 159303 bytes
 assets/pack-barrel-F3kESlJ-.webp                   | Bin 0 -> 31254 bytes
 assets/pack-bucket-CIj_f92p.png                    | Bin 207859 -> 149871 bytes
 assets/pack-bucket-CIj_f92p.webp                   | Bin 0 -> 36042 bytes
 assets/pack-glass-jar-BuC1ebgY.png                 | Bin 286940 -> 203069 bytes
 assets/pack-glass-jar-BuC1ebgY.webp                | Bin 0 -> 32318 bytes
 assets/pack-tin-can-0lFY_SVX.png                   | Bin 229222 -> 152464 bytes
 assets/pack-tin-can-0lFY_SVX.webp                  | Bin 0 -> 28316 bytes
 assets/product-artichoke-BcJmf6HG.png              | Bin 474200 -> 344676 bytes
 assets/product-artichoke-BcJmf6HG.webp             | Bin 0 -> 120054 bytes
 assets/product-jalapeno-DryjKuRg.png               | Bin 403570 -> 262676 bytes
 assets/product-jalapeno-DryjKuRg.webp              | Bin 0 -> 88858 bytes
 assets/product-olives-Czu-4B66.png                 | Bin 507865 -> 327511 bytes
 assets/product-olives-Czu-4B66.webp                | Bin 0 -> 97576 bytes
 assets/product-oxidized-black-DxiA-pgL.png         | Bin 247218 -> 184468 bytes
 assets/product-oxidized-black-DxiA-pgL.webp        | Bin 0 -> 69788 bytes
 assets/product-pepperoncini-DGyo-dAO.png           | Bin 337696 -> 242912 bytes
 assets/product-pepperoncini-DGyo-dAO.webp          | Bin 0 -> 74754 bytes
 assets/triple-company.vcf                          |  11 +
 business-card/index.html                           |  88 ++++
 catalog/index.html                                 | 541 +++++++++++---------
 catalog/print/index.html                           | 127 +++++
 company-profile/index.html                         | 165 ++++++
 contact/index.html                                 | 273 +++++-----
 crm/buyer/index.html                               | 365 ++++++++++++++
 crm/buyers/index.html                              | 228 +++++++++
 crm/index.html                                     | 102 ++++
 crm/kanban/index.html                              | 117 +++++
 crm/login/index.html                               |  87 ++++
 docs/asset-rights-register.md                      |  63 +++
 docs/g0-counsel-questions.md                       |  27 +
 docs/g1-data-flow-inventory.md                     | 228 +++++++++
 docs/j0-analytics-audit.md                         | 404 +++++++++++++++
 docs/j1-acceptance-criteria.md                     | 240 +++++++++
 docs/j2-acceptance-criteria.md                     | 134 +++++
 docs/j3-acceptance-criteria.md                     | 271 ++++++++++
 downloads/index.html                               | 316 ++++++------
 favicon.ico                                        | Bin 0 -> 927 bytes
 favicon.svg                                        |   3 -
 how-we-work/index.html                             | 204 +++-----
 index.html                                         | 561 ++++++++++++---------
 letterhead/index.html                              |  69 +++
 llms.txt                                           |  27 +-
 media/choosing-a-trusted-olive-exporter/index.html | 196 ++-----
 media/egyptian-olive-prices-2026/index.html        | 196 ++-----
 media/green-vs-black-vs-oxidized-olives/index.html | 196 ++-----
 media/health-benefits-of-table-olives/index.html   | 196 ++-----
 media/how-to-import-egyptian-table-olives/index.html | 196 ++-----
 media/index.html                                   | 204 +++-----
 media/olive-export-packaging-guide/index.html      | 196 ++-----
 media/olives-in-everyday-cooking/index.html        | 196 ++-----
 netlify.toml                                       | 113 +++++
 netlify/functions/_analytics_lib.js                | 419 +++++++++++++++
 netlify/functions/_b2b_lib.js                      | 201 ++++++++
 netlify/functions/_crm_lib.js                      |  62 +++
 netlify/functions/_geo_lib.js                      |  69 +++
 netlify/functions/_gsc_lib.js                      |  65 +++
 netlify/functions/analytics-collect.js             | 259 ++++++++++
 netlify/functions/analytics-privacy.js             | 125 +++++
 netlify/functions/analytics-report.js              | 447 ++++++++++++++++
 netlify/functions/analytics-retention.js           |  66 +++
 netlify/functions/analytics-settings.js            | 155 ++++++
 netlify/functions/consent.js                       | 144 ++++++
 netlify/functions/crm-activity.js                  |  74 +++
 netlify/functions/crm-auth-login.js                |  99 ++++
 netlify/functions/crm-auth-logout.js               |  10 +
 netlify/functions/crm-auth-me.js                   |  14 +
 netlify/functions/crm-buyers.js                    | 305 +++++++++++
 netlify/functions/crm-csv.js                       | 220 ++++++++
 netlify/functions/crm-dashboard.js                 | 130 +++++
 netlify/functions/geo-refresh.js                   |  42 ++
 netlify/functions/inquiries.js                     |  47 +-
 netlify/functions/leads.js                         | 202 ++++++++
 netlify/functions/search-console-import.js         | 132 +++++
 package-lock.json                                  | 429 +++++++++++++++-
 package.json                                       |   6 +-
 privacy/index.html                                 | 245 +++++++++
 products/aggizi-green-olives/index.html            | 140 +++++
 products/hamed-green-olives/index.html             | 139 +++++
 products/manzanilla-green-olives/index.html        | 139 +++++
 products/marinated-artichoke-hearts/index.html     | 140 +++++
 products/natural-black-olives/index.html           | 139 +++++
 products/oxidized-black-olives/index.html          | 140 +++++
 products/pepper-stuffed-green-olives/index.html    | 139 +++++
 products/pepperoncini-peppers/index.html           | 139 +++++
 products/sliced-jalapeno-peppers/index.html        | 139 +++++
 products/toffahi-green-olives/index.html           | 140 +++++
 resources/certifications/index.html                | 172 +++++++
 resources/export-markets/index.html                | 172 +++++++
 resources/faq/index.html                           | 232 +++++++++
 resources/index.html                               | 154 ++++++
 resources/packaging/index.html                     | 175 +++++++
 resources/pricing/index.html                       | 182 +++++++
 resources/why-egyptian-olives/index.html           | 183 +++++++
 robots.txt                                         |   2 +-
 sample/index.html                                  | 284 +++++------
 scripts/build-geo.js                               |  87 ++++
 scripts/crm-create-user.js                         |  82 +++
 scripts/crm-seed.js                                | 219 ++++++++
 scripts/db-roundtrip-check.js                      |   8 +-
 scripts/generate-product-pages.py                  | 282 +++++++++++
 scripts/generate-resource-pages.py                 | 489 ++++++++++++++++++
 site.webmanifest                                   |  15 +
 sitemap.xml                                        | 236 +++++----
 vercel.json                                        |  19 -
 133 files changed, 13937 insertions(+), 3080 deletions(-)
```

### Staging URL and test method

Netlify deploy-preview URL for PR #1 (`stirring-manatee-ca2643` project,
deploy-preview subdomain). Test method: Netlify's automated build (confirms
the site builds and every static route resolves); no secrets are exposed by
this method since the preview runs the same environment variables as
production, scoped to Netlify's own preview infrastructure.

**Not done:** any manual click-through of the deploy preview by a human,
before or after merge.

### Evidence-register summary (from `evidence-needed.md`)

- **Certificates (ISO 22000, HACCP, EU 852/2004, FDA/FSMA)** — none
  provided. Per Rule 3/A1, all certificate-dependent copy was replaced with
  the neutral placeholder rather than published. Still true today — no
  certificate documents have been provided in any session to date.
- **Export history** — resolved. Copy changed to "preparing for
  international export" / "developing buyer relationships" language
  sitewide; no completed-shipment claim remains (re-verified by scan this
  session, see below).
- **Processing facility relationship** — resolved via A2's approved neutral
  framing ("partner processing facility"). The facility's general location
  (10th of Ramadan Industrial Zone) is published in the Organization
  schema, the FAQ, and `llms.txt`; you confirmed this can stay published.
- **Unsourced statistics** ("~2000 tons/year," "15+ years founders'
  experience," fabricated stats) — removed.
- **Kalamata** — removed from all public product listings and CRM code
  (one comment in `crm-buyers.js` documents the exclusion; not a live
  reference).
- **The 4 unresolved sitemap URLs + the SPA-bundle-only document routes**
  — resolved by the rebuild itself: none of the 4 phantom `/media/` URLs
  were carried into the new site (confirmed absent from current sitemap
  and repo), and the old SPA bundle plus everything only reachable through
  it (`/dashboard`, `/login`, `/quotation`, `/invoice`) no longer exists —
  replaced by the CRM system built in this same deploy.

### Claim-removal and manual semantic-review results

**No separate machine-readable claim-removal register file was ever
produced**, despite A2 explicitly calling for one ("Deliver a
machine-readable claim-removal register: URL, source file, claim found,
classification, correction, verification method"). This is a real gap —
the removals happened (see below) but weren't tracked in the dedicated
register format the spec asked for.

What *was* done: an automated case-insensitive scan across all `.html`
files for the specific claims A2 named, re-run again this session against
the current repo state as a check:

| Claim | Found in current repo? |
| --- | --- |
| "Kalamata" (public pages) | No (one code comment only, not public-facing) |
| "Olives Egypt" as brand name | No |
| "Export Manager" (job title) | No |
| "15+ years" / "15 years" experience | No |
| Thomas K. / Fatima A. / Marc D. testimonials | No |
| "HACCP-controlled conditions" | No |
| "3 processing lines" / "6 varieties exported" / "2,000+ tons" / "Exported to 3 export markets" | No |

No manual semantic review (a human or model reading full page copy for
*implied* rather than literal completed-export language) was separately
logged as its own artifact; the automated scan above is what exists.

### Route/redirect/sitemap/robots/canonical/hreflang/schema/PDF/form/privacy/analytics/performance results

- **Routes/sitemap**: `sitemap.xml` was rewritten as part of this deploy;
  not independently diffed against the A0 canonical-route table until this
  session (see Deploy 3 below, which closed out that gap).
- **Robots.txt**: changed (`robots.txt | 2 +-`); not independently
  re-verified against production.
- **Canonical/hreflang**: hreflang block present in page `<head>`s per
  source; not tested live.
- **JSON-LD**: validated as well-formed JSON for `index.html` and
  `catalog/index.html` this session (Deploy 2's work required this); not
  validated for every other page, and not checked for duplicate emission
  across layouts as Section D calls for.
- **PDFs**: `company-profile`, `letterhead`, `business-card`,
  `catalog/print` were rebuilt as static HTML pages generating printable
  output client-side; the actual rendered PDF output has not been visually
  inspected by a human or by me.
- **Forms**: `contact` and `sample` forms route to `netlify/functions/inquiries.js`
  / `leads.js`; integration-tested with a mocked database connection during
  development, not tested against the live form on production.
- **Privacy/consent**: `assets/consent.js` and the consent banner were
  tested locally during development (`test_consent*.js` in the working
  scratch files); not re-tested against production.
- **Analytics**: the custom event pipeline (`analytics-collect.js` etc.)
  was integration-tested against a mocked database this session; the B2B/
  RDAP lookup and Search Console paths were tested only with mocked
  `fetch` responses, since this sandbox's network egress is restricted —
  documented as an open verification gap in `docs/j3-acceptance-criteria.md`.
- **Performance**: not tested.

### Staging-vs-production diff plan

Same Netlify site serves both the deploy preview and production — same
build command, same environment variables, same functions bundle. The only
structural difference is the domain the response is served under. No
routes, HTML, metadata, JSON-LD, redirects, or assets are expected to
differ between preview and production for this deploy. What's *not*
confirmed: whether production is actually resolving to this Netlify site
at all right now (the parked domain/DNS issue).

### Rollback

```
git revert -m 1 94b49b749d00fa1534d426b09e1688779e1c130e
```
Reverts to the pre-rebuild site (commit `d7e5efd`). No separate backup
manifest was produced; git history is the only backup.

### Exact production action taken

Merged PR #1 (`claude/olivesegypt-analytics-kpi-crm-gbqn14` → `main`) via
GitHub's merge API, method "merge" (creates a merge commit). Approval:
"merge the PR when you think it's ready" (informal, not tied to a written
request).

---

## Deploy 2 — Remove AI-generated product/packaging images (PR #2)

- **Merge commit:** `85c4dd7eb072ba08fd10e9198448dc8968d48a07`
- **Merged:** 2026-09-01

### Complete changed-file list (25 files)

```
 assets/index-CM_6xm-Z.js                    | 233 ----------------------------
 assets/olive-stuffed-new-DaolBs_S.png       | Bin 139118 -> 0 bytes
 assets/olive-stuffed-new-DaolBs_S.webp      | Bin 20832 -> 0 bytes
 assets/pack-barrel-F3kESlJ-.png             | Bin 159303 -> 0 bytes
 assets/pack-barrel-F3kESlJ-.webp            | Bin 31254 -> 0 bytes
 assets/pack-bucket-CIj_f92p.png             | Bin 149871 -> 0 bytes
 assets/pack-bucket-CIj_f92p.webp            | Bin 36042 -> 0 bytes
 assets/pack-glass-jar-BuC1ebgY.png          | Bin 203069 -> 0 bytes
 assets/pack-glass-jar-BuC1ebgY.webp         | Bin 32318 -> 0 bytes
 assets/pack-tin-can-0lFY_SVX.png            | Bin 152464 -> 0 bytes
 assets/pack-tin-can-0lFY_SVX.webp           | Bin 28316 -> 0 bytes
 assets/photo-pending.svg                    |  13 ++
 assets/product-artichoke-BcJmf6HG.png       | Bin 344676 -> 0 bytes
 assets/product-artichoke-BcJmf6HG.webp      | Bin 120054 -> 0 bytes
 assets/product-jalapeno-DryjKuRg.png        | Bin 262676 -> 0 bytes
 assets/product-jalapeno-DryjKuRg.webp       | Bin 88858 -> 0 bytes
 assets/product-olives-Czu-4B66.png          | Bin 327511 -> 0 bytes
 assets/product-olives-Czu-4B66.webp         | Bin 97576 -> 0 bytes
 assets/product-oxidized-black-DxiA-pgL.png  | Bin 184468 -> 0 bytes
 assets/product-oxidized-black-DxiA-pgL.webp | Bin 69788 -> 0 bytes
 assets/product-pepperoncini-DGyo-dAO.png    | Bin 242912 -> 0 bytes
 assets/product-pepperoncini-DGyo-dAO.webp   | Bin 74754 -> 0 bytes
 catalog/index.html                          |   6 +-
 docs/asset-rights-register.md               |  79 +++++++++-
 index.html                                  |   2 +-
 25 files changed, 87 insertions(+), 246 deletions(-)
```

### Staging URL and test method

`https://deploy-preview-2--stirring-manatee-ca2643.netlify.app` — Netlify
build succeeded (`state: success`, checked via GitHub's combined-status
API before merge). Visual verification of the replacement placeholder
(`photo-pending.svg`) was done by rendering it locally (via `cairosvg`,
both at native size and simulating the `object-cover` crop used on the
site) before it was ever committed — not by viewing the deploy preview
itself in a browser.

### Evidence-register summary

Not evidence-register-driven — this was a corrective action after the site
owner confirmed a set of product/packaging images were AI-generated, with
two independently confirmed by direct visual inspection (garbled label
text on `product-olives-*`, an impossible mirrored reflection on
`pack-glass-jar-*`).

### Claim-removal / semantic review

N/A (image asset, not a text claim). `docs/asset-rights-register.md` was
updated with the full finding.

### Route/schema/etc. results

JSON-LD validated as well-formed JSON for both `index.html` and
`catalog/index.html` after removing the `"image"` field from 4 `Product`
entries (checked with `python3 -m json.loads` against each extracted
`<script type="application/ld+json">` block — all valid).

### Staging-vs-production diff plan

Same as Deploy 1 — single Netlify site, no expected drift beyond the
domain-resolution question.

### Rollback

```
git revert -m 1 85c4dd7eb072ba08fd10e9198448dc8968d48a07
```

### Exact production action taken

Merged PR #2 via GitHub's merge API, method "merge". Approval: "merge it
to main like last time" (informal).

---

## Deploy 3 — Close out A0 route-audit items (PR #3)

- **Merge commit:** `dcb764cffee4a30d50c6fd7be47d231ad952dd32`
- **Merged:** 2026-09-02

### Complete changed-file list (1 file)

```
 netlify.toml | 34 ++++++++++++++++++++++++++++++++++
 1 file changed, 34 insertions(+)
```

### Staging URL and test method

`https://deploy-preview-3--stirring-manatee-ca2643.netlify.app` — Netlify
build succeeded (`state: success`).

### Evidence-register summary

Directly resolves item 6 of `evidence-needed.md` (the 4 unmatched sitemap
URLs) and the A0 canonical-route table's "NEEDS HUMAN REVIEW" rows — see
the route audit performed this session:

- `vercel.json` / `api/` — confirmed absent from the repo (resolved by
  Deploy 1's rebuild, not by this deploy).
- `/dashboard`, `/login`, `/quotation`, `/invoice` — confirmed absent
  (superseded by `/crm/` in Deploy 1).
- `?lang=fr` / `?lang=ar` — confirmed absent (the SPA bundle that rendered
  this is gone as of Deploy 1).
- The 4 phantom `/media/` article paths — confirmed absent from the
  current sitemap and repo; this deploy adds explicit `410` redirects for
  all four so a search engine or old inbound link gets a clean "gone"
  signal instead of a silent 200 + homepage.

### Route/redirect results

Verified directly: `grep` confirmed none of the 4 paths exist as real
content or sitemap entries before adding the redirects; `netlify.toml`
syntax reviewed manually (TOML, no automated linter run). Not verified:
the actual HTTP response code for these paths on production (Section D
gap, same as the other two deploys).

### Staging-vs-production diff plan

Same as Deploy 1.

### Rollback

```
git revert dcb764cffee4a30d50c6fd7be47d231ad952dd32
```
(Single-parent commit — no `-m 1` needed.)

### Exact production action taken

Merged PR #3 via GitHub's merge API, method "merge". Approval: "yes merge
it to main like before" (informal).

---

## Deploy 4 — Arabic localization rollout (PRs #43–#50)

- **Merge commits (8, in merge order):**
  `0a70b82f081789b221dc86530b0750f3ad9f0bca` (#43),
  `1855a5375af93aa5fbcf092b957c094fc9eb60bf` (#44),
  `49b3e8ba50f62bcfc382ec5b51b14d86bd8fa2ec` (#50),
  `4e9169c45aa4aefddc24f922fce7eebf9dcec4e9` (#45),
  `849a27fdb3deeb6913d17222748e2530529bef97` (#46),
  `1a7f88c0b7591af92f84a459af937d6317291e5b` (#47),
  `dd9772c9ae8c3486191f58ea31ab5b023f662c54` (#48),
  `8798d5842af66879550e1b9f9b34d6f14c05580b` (#49)
- **Merged:** 2026-09-04, 16:08–16:14 (UTC+3), all eight in one session
- **Covers:** full Arabic (`/ar/`) localization of the site per explicit
  request ("i want to add arabic lang to my website... a real arabic
  content that is also seo and aeo optimized... make sure its added to
  all pages, also make all my catalogues product sheets company profile
  all the downloadable pdfs, arabic version") — every page, both product
  catalogs, all 11 product spec sheets, company profile, contact/sample
  forms, all `/resources/*` and `/media/*` content, the downloads hub and
  its 3 gated buyer guides, the business card, the letterhead, and the
  downloadable B2B export-catalog PDF now have a live Arabic counterpart.
  Approval for this batch of eight: **explicit, written, following the
  form this document's title names** — the user sent the literal message
  "PRODUCTION DEPLOYMENT REQUEST" as a standalone instruction, not folded
  into a merge request or informal chat approval like Deploys 1–3.
  Individual PR merges themselves were separately authorized in three
  rounds ("merge 43 44 50", "merge 45 46", "merge 47 48 49").

### Complete changed-file list (57 files, diffed `ab731a2..8798d58`)

```
 ar/business-card/index.html                        |  93 +++++
 ar/catalog/print/index.html                        | 419 +++++++++++++++++++++
 ar/contact/index.html                              |   2 +-
 ar/downloads/buyers-guide/index.html               | 122 ++++++
 ar/downloads/index.html                            | 118 ++++++
 ar/downloads/origin-comparison-guide/index.html    |  99 +++++
 ar/downloads/pricing-packaging-guide/index.html    | 101 +++++
 ar/how-we-work/index.html                          |   2 +-
 ar/index.html                                      |   2 +-
 ar/letterhead/index.html                           |  71 ++++
 ar/media/choosing-a-trusted-olive-exporter/index.html | 129 +++++++
 ar/media/egyptian-olive-prices-2026/index.html     | 129 +++++++
 ar/media/green-vs-black-vs-oxidized-olives/index.html | 129 +++++++
 ar/media/health-benefits-of-table-olives/index.html | 129 +++++++
 ar/media/how-to-import-egyptian-table-olives/index.html | 129 +++++++
 ar/media/index.html                                | 137 +++++++
 ar/media/olive-export-packaging-guide/index.html   | 129 +++++++
 ar/media/olives-in-everyday-cooking/index.html     | 129 +++++++
 ar/privacy/index.html                              | 144 +++++++
 ar/resources/certifications/index.html             | 129 +++++++
 ar/resources/export-markets/index.html             | 129 +++++++
 ar/resources/faq/index.html                        | 136 +++++++
 ar/resources/index.html                            | 117 ++++++
 ar/resources/packaging/index.html                  | 132 +++++++
 ar/resources/pricing/index.html                    | 152 ++++++++
 ar/resources/why-egyptian-olives/index.html        | 161 ++++++++
 ar/sample/index.html                               | 226 +++++++++++
 assets/gated-download.js                           |  25 +-
 business-card/index.html                           |   3 +
 catalog/print/index.html                           |   3 +
 downloads/buyers-guide/index.html                  |   3 +
 downloads/index.html                               |   6 +-
 downloads/origin-comparison-guide/index.html       |   3 +
 downloads/pricing-packaging-guide/index.html       |   3 +
 downloads/triple-company-export-catalog-2026-ar.pdf | Bin 0 -> 815245 bytes
 letterhead/index.html                              |   4 +
 media/choosing-a-trusted-olive-exporter/index.html |   4 +-
 media/egyptian-olive-prices-2026/index.html        |   4 +-
 media/green-vs-black-vs-oxidized-olives/index.html |   4 +-
 media/health-benefits-of-table-olives/index.html   |   4 +-
 media/how-to-import-egyptian-table-olives/index.html |   4 +-
 media/index.html                                   |   4 +-
 media/olive-export-packaging-guide/index.html      |   4 +-
 media/olives-in-everyday-cooking/index.html        |   4 +-
 privacy/index.html                                 |   3 +-
 resources/certifications/index.html                |   3 +-
 resources/export-markets/index.html                |   3 +-
 resources/faq/index.html                           |   3 +-
 resources/index.html                               |   3 +-
 resources/packaging/index.html                     |   3 +-
 resources/pricing/index.html                       |   3 +-
 resources/why-egyptian-olives/index.html           |   3 +-
 robots.txt                                         |   6 +
 sample/index.html                                  |   4 +-
 scripts/export-catalog-source-ar.html              | 359 ++++++++++++++++++
 scripts/generate-export-catalog-pdf.js             |  17 +-
 sitemap.xml                                        | 288 ++++++++++++--
 57 files changed, 4101 insertions(+), 74 deletions(-)
```

### Staging URL and test method

No Netlify deploy-preview build succeeded for any of the 8 PRs before
merge — every one hit the same account-wide Netlify build-credit
exhaustion documented on every PR this session (`netlify/stirring-manatee
-ca2643/deploy-preview: failure`, standing comment posted on each PR
explaining this is a billing issue, not a code issue). The user confirmed
separately, after all 8 merges, that "the netlify issue is sorted" — this
was **not** independently re-verified against a live deploy-preview
build for any of these 8 PRs before or after that confirmation; no new
deploy-preview run was triggered or observed for this batch.

Test method actually used, in place of a deploy-preview build, for every
file in this batch:
- HTML tag-balance check (Python `HTMLParser`, stack-based) on every
  new/touched file.
- `xml.dom.minidom.parse()` on `sitemap.xml` after every batch (final:
  65 URLs).
- `json.loads()` on every `<script type="application/ld+json">` block.
- `node -c` syntax check on `assets/gated-download.js`.
- Playwright (headless Chromium, local `python3 -m http.server`) screen-
  shots of every new Arabic page at production-representative viewport
  widths, checking `document.documentElement.scrollWidth` against the
  viewport width to catch the RTL horizontal-overflow bug (see below).
- One full end-to-end form submission (Pricing & Packaging Guide gated
  form) against a **mocked** `/api/leads` response, on both the English
  and Arabic `/downloads` pages, to confirm the localized JS status
  text — not tested against the real Netlify Function.
- The Arabic export-catalog PDF was rendered via the actual production
  generation script (`scripts/generate-export-catalog-pdf.js`, headless
  Chromium via Playwright, same settings as the English file) and
  visually inspected page-by-page (PyMuPDF render to PNG) — this is the
  one deliverable in this deploy that got genuine rendered-output
  inspection, closing part of Outstanding item 3 below.

**Not done, same gap as every prior deploy:** any of this tested against
an actual Netlify deploy-preview or production build. Everything above
is source-level and local-render verification only.

### Evidence-register summary

Not evidence-register-driven — this is a translation batch, not a new
factual claim. Every fact translated into Arabic (product specs,
company-profile paragraphs, commercial terms, the Confirmed/TODO badge
split on the privacy page, the Egypt-production statistics with their
FAO/IOC sourcing caveat) is the same value already live and approved in
English (or, for the FAQ/stats/product-spec content, already shipped in
Arabic on an earlier page and reused verbatim here for consistency) — no
new certificate, statistic, or completed-export claim was introduced.

One pre-existing discrepancy was carried through unchanged and flagged,
not resolved: `media/egyptian-olive-prices-2026` (English, not touched by
this deploy) still uses "indicative FOB reference ranges" language that
`resources/pricing` dropped earlier in the engagement for being stale;
the Arabic translation matches the current live English rather than
silently correcting it.

### Claim-removal / semantic review

N/A — translation of already-approved content, not new copy. No new
entries for the claim-removal register (which, per the Outstanding list
below, still doesn't exist as a dedicated tracked file).

### Route/redirect/sitemap/robots/canonical/hreflang/schema/PDF/form/privacy/analytics/performance results

- **Sitemap**: 52 → 65 URLs (18 → 24 under `/ar/`, plus the pre-existing
  English pairs' hreflang blocks completed). Parses as valid XML; not
  independently re-diffed against the A0 canonical-route table this
  round (that closeout was Deploy 3's).
- **Robots.txt**: 6 new `Disallow: /ar/...` lines added, mirroring each
  existing English noindex rule 1:1 (`/ar/letterhead`,
  `/ar/business-card`, `/ar/catalog/print`, and the 3
  `/ar/downloads/*-guide` paths). Not re-verified against production.
- **Canonical/hreflang**: every new Arabic page and its English
  counterpart carry reciprocal `en`/`ar`/`x-default` hreflang; validated
  in source, not tested live.
- **JSON-LD**: every new Arabic page's `Organization` +
  `BreadcrumbList` (and, for articles, `Article`) blocks parse as valid
  JSON; not checked for duplicate emission across layouts.
- **PDFs**: the Arabic export-catalog PDF is a genuinely rendered binary,
  visually inspected (see above) — the first PDF deliverable in this
  project's history to get that. `ar/catalog/print`, `ar/business-card`,
  `ar/letterhead` remain client-side-printable HTML, same as their
  English counterparts always have been — their actual rendered PDF
  output has still never been inspected by anyone, English or Arabic.
- **Forms**: the Arabic sample form and the 3 Arabic gated-guide forms
  post to the same existing Netlify Functions (`/api/inquiries`,
  `/api/leads`) with unchanged field `id`/`name` attributes and
  backend-facing values — integration-tested only via a mocked fetch
  response (see Staging URL section above), not against the live
  functions.
- **Privacy/consent**: the Arabic privacy page translates the existing
  Key Facts table (14 rows, Confirmed/TODO badges) exactly — no badge
  was moved from TODO to Confirmed or vice versa. Not re-tested against
  production.
- **Analytics**: unaffected — no changes to `assets/analytics.js` or any
  analytics Netlify Function in this deploy.
- **Performance**: not tested.

### RTL-specific verification (new for this deploy, no English-deploy equivalent)

A real bug was found and fixed during this rollout, worth recording
here since it's a defect class specific to Arabic/RTL pages that
wouldn't show up in any English-focused test: any element hidden
off-screen via `position:absolute;left:-9999px` (the honeypot-field
pattern used on every form) inflates `document.documentElement
.scrollWidth` to ~11000px specifically under `dir="rtl"` — confirmed
empirically (LTR unaffected at 1280px; RTL with `left:-9999px` blew up
to 11279px; RTL with `right:-9999px` stayed correctly at 1280px). Fixed
on the page it was first found (`ar/contact`, a prior deploy) and
applied proactively to every honeypot field built in this deploy
(`ar/sample`, all 3 gated-guide forms on `ar/downloads`). Verified via
`scrollWidth` check on every new Arabic page — all reported the correct
viewport width, none showed the bug.

### Staging-vs-production diff plan

Same as every prior deploy — one Netlify site serves both preview and
production from the same build. No routes, HTML, metadata, JSON-LD, or
assets are expected to differ between them for this deploy. What's
**still not confirmed, and could not be checked from this session**:
whether `olivesegypt.com` actually resolves to this Netlify site at
all. This session's network egress is blocked for `olivesegypt.com`
specifically (`EGRESS_BLOCKED` from both a direct `curl` and a
`WebFetch` attempt made during this deployment) — that block is this
sandbox's own network policy, not evidence about the domain's DNS state
one way or the other. The parked-domain/DNS question Deploy 1 raised has
not been re-checked by anyone, human or model, since that record was
written.

### Rollback

```
git revert -m 1 8798d5842af66879550e1b9f9b34d6f14c05580b
git revert -m 1 dd9772c9ae8c3486191f58ea31ab5b023f662c54
git revert -m 1 1a7f88c0b7591af92f84a459af937d6317291e5b
git revert -m 1 849a27fdb3deeb6913d17222748e2530529bef97
git revert -m 1 4e9169c45aa4aefddc24f922fce7eebf9dcec4e9
git revert -m 1 49b3e8ba50f62bcfc382ec5b51b14d86bd8fa2ec
git revert -m 1 1855a5375af93aa5fbcf092b957c094fc9eb60bf
git revert -m 1 0a70b82f081789b221dc86530b0750f3ad9f0bca
```
In reverse merge order (most recent first) since each merge commit has
two parents. Reverting all 8 removes every `/ar/` page and the Arabic
PDF; the pre-existing English site is untouched either way since no
English content was altered beyond hreflang/switcher-link additions and
one missing-dropdown-option bugfix each on `sample`, `contact`, and
`company-profile` (the latter two from earlier deploys, not this one).

### Exact production action taken

Merged PRs #43, #44, #50 (independent, no shared base), then #45 → #46
(rebasing #46's PR base from `claude/arabic-sample-privacy` to `main`
after #45 merged), then #47 → #48 → #49 (same rebase-then-merge pattern
down the stack), all via GitHub's merge API, method "merge". Approval:
three explicit written instructions naming PR numbers ("merge 43 44
50", "merge 45 46", "merge 47 48 49"), followed by a separate, later,
standalone written instruction — "PRODUCTION DEPLOYMENT REQUEST" — with
no new code changes attached to it. No additional production action
exists to take in response to that request beyond what merging already
did: this repository's Netlify site auto-builds from `main` on every
push (`netlify.toml` `[build]` block, unchanged across all 4 deploys in
this record), so every one of the 8 merges above already queued a
production build attempt at merge time. This session has no Netlify
API or dashboard access and cannot confirm whether those build attempts
(a) ran after the billing block was lifted, (b) succeeded, or (c) are
what's currently being served at the production domain. If any of the
8 build attempts is still sitting in a failed state from before the
billing fix, Netlify does not auto-retry a failed build on its own —
a fresh push or a manual "Trigger deploy" from the Netlify dashboard
would be needed, and only the site owner can do the latter from here.

---

## Companion repo (`umami-olivesegypt`)

No commits were made to this repository in any session covered by this
record. It remains at the upstream `umami-software/umami` state as of the
last sync. It is not part of the changed-file scope of any deploy above.

## Outstanding, unresolved by this document

1. **Section D has never been run against actual production**, for any
   deploy, because production's own reachability is unconfirmed (parked
   domain/DNS issue). Still true after Deploy 4 — this session's network
   egress to `olivesegypt.com` is itself blocked (sandbox policy, not
   evidence about the domain), so even that limited check couldn't be
   attempted this time.
2. **No dedicated claim-removal register file** exists for A2, despite
   being explicitly required. The removals themselves are verified (see
   Deploy 1's table above); the tracking artifact is not.
3. **PDF-generation output** — **partially resolved by Deploy 4**: the
   Arabic export-catalog PDF was rendered and visually inspected
   page-by-page, the first PDF in this project to get that. The English
   export-catalog PDF, and all four of `company-profile`, `letterhead`,
   `business-card`, `catalog/print` (both languages), remain unverified
   as rendered output — only checked as source HTML.
4. **Certificates remain unverified** — nothing certificate-dependent has
   been published, per A1/Rule 3, and that has not changed since
   `evidence-needed.md` was written.
5. **Whether the Netlify production build for any/all of the 8 Deploy 4
   merges actually succeeded is unconfirmed** — this session has no
   Netlify API or dashboard access. The site owner should check the
   Netlify dashboard directly and, if the latest production deploy shows
   failed or stale, trigger a fresh one manually.
