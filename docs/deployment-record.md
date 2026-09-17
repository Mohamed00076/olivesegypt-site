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
  reference). **Superseded:** Kalamata was reintroduced on 2026-09-04 (PR #38)
  and its product data was approved field by field on 2026-09-05. It is live at
  position 2 as of Deploy 5. This paragraph records the state at Deploy 1 and is
  left unedited for that reason.
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
| "Kalamata" (public pages) | No, at Deploy 1 (one code comment only, not public-facing). Reintroduced 2026-09-04, approved 2026-09-05 — see Deploy 5. |
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

## Deploy 5 — Nine-phase bilingual audit remediation (PRs #51–#62)

**Date:** 2026-09-05
**Production commit:** `687608bd2712995d44bc34c26fe30e6ec00167b1`
**Previous recorded deploy:** `8798d584` (Deploy 4)
**Delta:** 28 commits, 12 merged pull requests, 110 files changed (+4,157 / -1,039)
**Approval:** twelve explicit written merge instructions naming PR numbers, then
a standalone `PRODUCTION DEPLOYMENT REQUEST`, then explicit approval —
"approved, keep it live".

### Correction carried forward from this session

Throughout the session leading to this deploy I repeatedly told the site owner
"nothing is deployed". **That was wrong.** This site auto-builds from `main` on
every push (`netlify.toml` `[build]`, unchanged since Deploy 1), so all twelve
merges queued production builds at merge time. Deploy 4's own entry in this file
states that mechanism plainly; I wrote it and then contradicted it for the rest
of the session. The accurate statement is that merging queues a build this
session cannot observe — not that the work is unpublished. Recorded here because
the owner made merge decisions while holding a belief I had given them.

### What shipped, by phase

| Phase | PR | Substance |
| --- | --- | --- |
| 1 | #53 | Canonical locale route map; **246 wrong-locale links fixed** across 35 pages. The primary "اطلب عرض سعر" CTA on all 34 Arabic pages was landing on the English contact form. Arabic gated forms were serving the English guides. |
| 5 | #54 | Mobile navigation for **25 pages that had none** — all 22 product pages plus `/ar/catalog` and both company-profile pages. Scope gap from the 2026-09-02 fix, which covered only 22 shared-header pages. |
| 6 | #55 | Arabic placeholder imagery. All **seven** placeholder SVGs carried English "Product photography pending"; 35 references across 11 Arabic surfaces, 6 occurrences inside the Arabic PDF. |
| 4 (partial) | #56 | خالبينو to **هالبينو** for jalapeno, 37 occurrences across 13 files plus the Arabic PDF. |
| 7 | #57, #60 | Multi-recipient routing, Reply-To, bounded retries, structured logging, dry-run adapter, 30 offline tests. Root cause identified: the Resend sandbox sender only delivers to the account's own address. |
| 2 | #58 | Language persistence and scroll restoration, scoped to deliberate switches only. |
| 8, 9 | #59 | Verification documents. Found: the gated guides do not gate; the repository is public. |
| 3 | #61, #62 | Kalamata approvals applied field by field; one canonical product order; real photograph. |
| — | #51, #52 | Deploy 4 record; hreflang mapping defects. |

### Defects found that were not in the original brief

- **`/catalog` disagreed with itself** — the visible grid ordered products
  differently from the ItemList JSON-LD on the same page.
- **`/ar/catalog` had Kalamata at position 7** while every other surface had it
  11th. Three different product orders were live simultaneously.
- **Both catalogue PDFs contained only 10 products** — Kalamata was absent from
  the product pages and the quick-matrix table, while the site advertised 11
  varieties. Found on 2026-09-05; the Arabic PDF regenerated in Phase 6 had the
  same gap, checked for placeholder text but never for product count.
- **`lg:inline-flex` is not in the compiled Tailwind stylesheet.** A first pass
  used it and silently hid the language switcher at every width on 25 pages.
- **The dry-run email adapter required an API key**, contradicting its own
  documentation. Caught by writing a script that used it.

### Testing method

No deploy preview was ever green during this work, so none was used. Verification
was local throughout: Playwright at 320/360/375/390/412/768/1024 in both locales,
rendered-image inspection of both PDFs, offline test suites, HTML tag-balance
checks on every changed page, and before/after comparison against `origin/main`
whenever a change might have introduced a regression (which caught a 6px overflow
that had not existed before).

### Route / sitemap / robots / canonical / hreflang / schema / PDF results

| Check | Result |
| --- | --- |
| Locale links | 80 routes (40 en / 40 ar), 0 violations |
| Email library | 30/30 |
| Product order | 8 surfaces match canonical |
| hreflang | 80/80 pages carry exactly 3 tags |
| Canonical | 80/80 pages |
| JSON-LD | 148 blocks, 0 invalid |
| Sitemap vs robots | 68 URLs against 18 rules, 0 conflicts |
| Netlify functions | 35/35 parse |
| PDFs | EN 10p/569KB, AR 10p/861KB, both 11 products |

`netlify.toml`, `robots.txt`, `sitemap.xml`, the shared stylesheet, `consent.js`
and `analytics.js` were **not changed** by this deploy.

### Staging-vs-production diff plan

None available — deploy previews failed on every PR from #43 onward. The
`netlify-plugin-cache` devDependency the owner added (`249f284`, `fe91d69`) is
the likely cause and may have resolved it, but no green preview was ever
observed from this session.

### Rollback

```
git revert -m 1 687608b 47b1e74 58a6ddc c9ce774 1e2caa0 5eb1fc9 \
                e9726e4 60315cd 79ce621 8b4bcc1 c303f70 7b7c195
git push origin main
```

Single-PR revert: `git revert -m 1 <that PR's merge sha>`.

### Backup manifest

All twelve source branches remain on `origin`; none deleted. Three binaries
cannot be reconstructed from text: `assets/olive-kalamata.jpg` (58KB) and both
catalogue PDFs (583KB / 883KB). `assets/illus-kalamata.svg` and
`illus-kalamata-ar.svg` were deliberately retained rather than deleted, as the
rollback path for the photograph.

### Exact production action taken

**None by this session, because none exists.** The site auto-builds from `main`,
so each of the twelve merges queued its own production build. This session has no
Netlify API or dashboard access and outbound egress to `olivesegypt.com` is
blocked by policy, so it cannot confirm whether those builds ran, succeeded, or
are what is currently served. Netlify does not auto-retry a failed build; if any
build is still failed from before the billing fix, a fresh push or a manual
"Trigger deploy" is required, and only the owner can do that.

### Known limitations shipped with this deploy

- Arabic PDF text layer transposes lam-alef pairs — copy-paste and in-PDF search
  return garbled Arabic. Rendering is correct. Chromium print-to-PDF, not the
  source HTML.
- The three gated guides are reachable by direct URL; the form unlocks nothing
  server-side. Not a security issue (marketing collateral) but lead capture is
  optional in practice, so lead numbers understate readership.
- The consent label promises an unsubscribe the site has no mechanism for, links
  to no privacy policy, and states no retention period. `leads_staging` has no
  retention policy.
- The Kalamata photograph is a 671x310 screenshot, upscaled about ten per cent on
  the product page, and reads red/burgundy against approved copy saying "deep
  purple-black".
- Email cannot deliver to more than one mailbox until `olivesegypt.com` is
  verified in Resend and `NOTIFY_FROM_EMAIL` is set.
- `analytics-retention` deletes data and carries no guard; its safety rests on
  Netlify not exposing scheduled functions over HTTP.
- No Latin-script legal name appears anywhere in the Arabic catalogue PDF.

---

## Retroactive record — Deploys 6 to 10 (PRs #63–#99)

**Written 2026-09-17, after the fact, at the owner's request.** Deploys 1 to 5
above were written as part of the work they describe. This block was not: the
record stopped at Deploy 5 on 2026-09-05 and thirty-seven pull requests were
merged over the following twelve days without an entry. Every one of those
merges queued a production build, because the site auto-builds from `main`, so
the record fell ten days behind what was actually being served.

What that means for the five entries below, stated plainly so they are not read
as carrying the same weight as Deploys 1 to 5:

- **Read from the repository, and reliable:** commit ranges, dates, PR numbers,
  commit counts, file counts, diff sizes, rollback SHAs, which claim-register
  rows moved, and what each pull request changed.
- **Partly reconstructed:** the approval wording. Deploy 10's instructions come
  from the session that produced it and are quoted. For Deploys 6 to 9 the
  merges were made on explicit instruction — that is the standing rule, and no
  merge in this repository has been made without one — but the exact wording is
  in sessions whose transcripts this entry cannot reach, so it is not quoted.
- **Not present, deliberately:** the per-deploy verification tables that Deploys
  1 to 5 carry (locale links, hreflang counts, JSON-LD block counts, PDF page
  counts). Those checks ran at merge time as `npm test`, which is why the suite
  exists, but their output was not captured then and has not been re-run against
  each historical commit now. Numbers that were never observed are not recorded
  here as though they had been.

Deploys 6 to 10 share two limitations with every deploy above: **no Netlify
build was ever confirmed** (this environment has no Netlify API or dashboard
access, and egress to `olivesegypt.com` is blocked by sandbox policy), and **no
deploy preview was used**, so verification was local throughout.

---

### Deploy 6 — Navigation, schema, identity and buyer-intent pages (PRs #63–#79)

**Dates:** 2026-09-05 → 2026-09-07
**Production commit:** `8834a12`
**Previous recorded deploy:** `687608bd` (Deploy 5)
**Delta:** 49 commits, 17 merged pull requests, 156 files changed (+9,895 / −4,902)
**Approval:** per-PR merge instructions, wording not recoverable (see preamble).

| PR | Substance |
| --- | --- |
| #63 | Deploy 5's own entry in this record. |
| #64 | Navigation redesign: new routes, a six-item nav with dropdowns, one shared footer — and two unevidenced claims removed on the way. |
| #65 | The gated guides made to actually gate, and the nightly purge guarded. |
| #66 | A real unsubscribe, replacing a consent label that promised one the site could not honour. |
| #67 | One `Organization` schema for the whole site, defined on the homepage. |
| #68 | Sitemap, English `Article` schema, robots meta, and an audit of the Arabic schema. |
| #69 | Every `Organization` node linked to that one entity, and the Arabic company name given a home. |
| #70 | Each product linked to its own translation. |
| #71 | One Facebook URL for the site. |
| #72 | One head-office address, everywhere it belongs. |
| #73 | The `og:site_name` generator fixed; the private-label claim scoped to what is actually offered; **Operating Rule 1 enforced by a check** rather than by memory. |
| #74 | Quality & Documentation restructured into three tiers; the Supply & Processing Network page; and Parts B, D, E and F — buyer-intent filtering on the catalogue, the private-label landing page, four more gated assets in both locales, and intent routing. |
| #75 | The logistics claim scoped, the sourcing regions reconciled, and contact data purged. |
| #76 | A Facebook button back in the shared header, restyled as a tinted square built to take more networks. |
| #77 | The tab icon was a red placeholder square, not the logo. Icons then downscaled in linear light, and that pinned in a check. |
| #78 | Four register actions the owner had answered, closed out. |
| #79 | The site's short name declared in the `WebSite` node, in both locales. |

**Defects found that were not in the brief:** the catalogue filter had never been
wired up; **the English contact and sample forms submitted nowhere**; the gated
guides did not gate; the favicon was a red placeholder.

**Claim register:** created at this deploy — C-01 through C-60.

**Rollback:** all seventeen landed as true merge commits, so each needs `-m 1`:

```
git revert -m 1 8834a12 df64e4a 376d37f c96eaa2 0b132d3 d6a2bce 87a9a19 \
                0b9de43 db2e36d 7741c99 8c1ec17 52ea49d 979e135 573ec83 \
                4a9fbb1 ae4215a 181ccf3
```

---

### Deploy 7 — CRM documents, Arabic documents, and two CRM failures (PRs #80–#90)

**Date:** 2026-09-07
**Production commit:** `d135f7c`
**Previous recorded deploy:** `8834a12` (Deploy 6)
**Delta:** 20 commits, 11 merged pull requests, 30 files changed (+3,153 / −207)
**Approval:** per-PR merge instructions, wording not recoverable (see preamble).

| PR | Substance |
| --- | --- |
| #80 | Recorded *why* every product page is an invalid snippet, so it stops being "fixed". |
| #81 | `scripts/admin-password.js`, the sibling `crm-create-user.js` always had. |
| #82 | Quotations and invoices issued without creating a buyer first. |
| #83 | The printed sheet redesigned, the CRM nav cut to four places, and the word "Letter" dropped from the sheet at the owner's request. |
| #84 | Letters composed from labelled fields instead of one free-text box. |
| #85 | C-14 closed — the Arabic jalapeño term (هالبينو) confirmed. |
| #86 | The "3 export markets" stat removed from Why Egyptian Olives. |
| #87 | Quotations, invoices and letters issued in Arabic. |
| #88 | The CRM and analytics made usable on a phone. |
| #89 | "Server error" when opening a buyer record. |
| #90 | A failing CRM page made to say what actually failed. |

**Defects found that were not in the brief:** `buyer_activity_log` was read by one
function and created by another that was only reachable through the broken page
— #89 shipped the missing table and **the page still failed**, which is what
#90 exists for: rather than guess a third time, CRM failures were made
self-describing, without leaking the database host into a response body. Three
CRM cards were also found styling themselves with an undefined CSS variable.

**Claim register:** C-61 through C-71 added; C-14, C-24, C-51, C-55 and C-56 amended.

**Rollback:** this deploy straddles the change from merge commits to squashes,
so it takes two commands — `-m 1` for #80–#83, plain revert for #84–#90:

```
git revert d135f7c 837fb8d 3ab308e 337cfbf 67f2469 9d02fec d57c2d0
git revert -m 1 99a74b5 6ee9ccf 577446c 3f4325f
```

---

### Deploy 8 — Two closures (PRs #91–#92)

**Date:** 2026-09-11
**Production commit:** `414f8d8`
**Previous recorded deploy:** `d135f7c` (Deploy 7)
**Delta:** 2 commits, 2 merged pull requests, 2 files changed (+31 / −3)
**Approval:** per-PR merge instructions, wording not recoverable (see preamble).

| PR | Substance |
| --- | --- |
| #91 | C-15 closed — the Arabic placeholder caption is in Arabic. |
| #92 | "Saved" after adding a buyer, instead of the Delete button the owner was being offered. |

**Claim register:** C-15 amended and closed.

**Rollback:** `git revert 414f8d8 33779a4` (squashes, no `-m 1` needed)

---

### Deploy 9 — The Arabic mobile menu, and the Follow-pill trial (PRs #93–#94)

**Date:** 2026-09-16
**Production commit:** `ae0185d`
**Previous recorded deploy:** `414f8d8` (Deploy 8)
**Delta:** 2 commits, 2 merged pull requests, 86 files changed (+258 / −427)
**Approval:** per-PR merge instructions, wording not recoverable (see preamble).

| PR | Substance |
| --- | --- |
| #93 | The mobile menu on every Arabic page. |
| #94 | The Facebook button trialled as a Follow pill, at the owner's request, to see which design gets pressed. |

**Defect found that was not in the brief:** the owner reported the menu dead on
the Arabic homepage. It was dead on **all 28 Arabic pages that have one**. Each
carried its own inline copy of a handler that `/assets/site-nav.js` also binds,
so one tap opened and closed the menu inside a single event — nothing errors,
nothing looks wrong in the markup, and the DOM is identical before and after.
`scripts/check-nav-handlers.js` now forbids the structure that allowed it.

**Rollback:** `git revert ae0185d 1a4fbac` (squashes, no `-m 1` needed)

---

### Deploy 10 — Tracking, retired claims, and the barrel (PRs #95–#99)

**Date:** 2026-09-17
**Production commit:** `4de48ea`
**Previous recorded deploy:** `ae0185d` (Deploy 9)
**Delta:** 5 commits, 5 merged pull requests, 67 files changed (+354 / −104)
**Approval:** quotable, from the session that produced it — "merge both and add
the click tracking" (#94/#95), "both fine merge all" (#96/#97), "merge 98"
(#98), and "merge it" (#99).

| PR | Substance |
| --- | --- |
| #95 | Facebook clicks recorded, consent-gated, so the Follow-pill trial can be measured rather than guessed at from dates. |
| #96 | The retired "3 export markets" claim cleared from the generator that writes the resource pages, and a price range the blog implied but the site does not publish. |
| #97 | Arabic letters no longer auto-address every recipient as a man. |
| #98 | Three Arabic wording reviews closed — the owner read them as a native reader and confirmed them. |
| #99 | The barrel is plastic, and it holds 220 kg. |

**Defects found that were not in the brief:**

- **A pre-existing privacy gap.** `whatsapp_click`, `email_click` and
  `specification_download` were already being recorded, and the privacy page
  listed only pages viewed, referrer, browser/device and country — it did not
  mention button presses at all. Corrected in both locales alongside #95.
- **A retired claim living on in a generator.** The "3 export markets" card was
  removed from the published pages in #86 on 2026-09-07; the generator that
  produced them still carried it, under the same source line. One re-run would
  have restored it. The same file also carried an unapproved Arabic company
  name in its structured data that every check had passed over.
- **A wrong packaging spec in 103 places.** The bulk format was described as a
  wooden barrel across both locales, with three different capacities quoted at
  once (50/100/200 kg chips on the homepage, "typically 50–200kg" on the
  packaging pages and in the gated guides, and a 50–200kg row in the print
  catalogues). Corrected on the owner's own words. Both gated catalogue PDFs
  were rebuilt so the change reaches the download and not only the HTML.

**Claim register:** C-72 through C-76 added; C-05 and C-71 amended. C-55 is left
as the only `needs-review` row in the register.

**Rollback:** `git revert 4de48ea b359cdf 9f8d584 7790843 75437be` (squashes, no `-m 1` needed)

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
   as rendered output — only checked as source HTML. Deploy 10 rebuilt **both**
   export-catalog PDFs with the same headless-Chromium producer and read
   the packaging table back out of a real browser to confirm the corrected
   row, but that is one table, not a page-by-page inspection: the English
   catalogue still has never had one, and the other four documents remain
   checked only as source HTML.
4. **Certificates remain unverified** — nothing certificate-dependent has
   been published, per A1/Rule 3, and that has not changed since
   `evidence-needed.md` was written.
5. **Whether the Netlify production build for any/all of the 8 Deploy 4
   merges actually succeeded is unconfirmed** — this session has no
   Netlify API or dashboard access. The site owner should check the
   Netlify dashboard directly and, if the latest production deploy shows
   failed or stale, trigger a fresh one manually. **The same is true of all
   37 merges in Deploys 6 to 10**, for the same reason, and it is the one
   thing in this document only the owner can settle.
6. **This record ran ten days behind production.** Deploy 5 was written on
   2026-09-05 and nothing was added until 2026-09-17, while PRs #63 to #98
   merged and built. The claim register kept pace throughout; this file did
   not. Deploys 6 to 10 were reconstructed from git history on 2026-09-17,
   and the preamble to that block says exactly which parts are read from the
   repository and which are not. The gap is cheap to avoid and expensive to
   close after the fact: a deploy entry belongs in the pull request that
   merges, not in a catch-up pass twelve days later.
7. **Deploys 6 to 10 carry no per-deploy verification tables**, unlike
   Deploys 1 to 5. `npm test` ran at merge time — it is now 20 suites, and
   several of them exist because of defects found during those deploys
   (`check-nav-handlers.js`, `check-crm-schema.js`, `check-crm-errors.js`,
   `check-packaging-claims.js`) — but the output was not captured per
   deploy, and re-running it against each historical commit now would not
   reproduce what was observed then. Numbers that were never observed have
   deliberately not been written down.
