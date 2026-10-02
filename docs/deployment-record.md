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

**Recording convention (owner decision, 2026-09-27, from Deploy 53 on).** A
deploy that changes only this record or the claim register gets no entry of
its own. It is listed in the table of the next entry written for a real site
change, with its PR, commit and date, so no deploy goes unrecorded. Recording
each notes-only deploy separately would never end: every record's merge is
itself a deploy.

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

## Deploy 11 — The Arabic audit's findings, and two dead forms (PRs #100–#105)

**Date:** 2026-09-17 → 2026-09-18
**Production commit:** `c97dbe1`
**Previous recorded deploy:** `4de48ea` (Deploy 10)
**Delta:** 6 commits, 6 merged pull requests, 32 files changed (+386 / −68)
**Approval:** quotable, per batch — "merge it" (#100), "merge 101 102 103 in that
order", "do batch 2" then "merge 104 then 105". Each batch was deployed only
after its own instruction, and Batch 1's three items were merged in the stated
order.

This is the first deploy written as part of the work it describes since Deploy
5, which is what Deploy 6–10's preamble above asks for.

| PR | Substance |
| --- | --- |
| #100 | Deploys 6 to 10, reconstructed after this record ran ten days behind production. |
| #101 | The Arabic homepage's bottom three product cards had no image at all — 232px against 424px for the top row. The Arabic illustrations had existed since the placeholder work and were already wired on every other Arabic surface; the homepage was the one that was missed. |
| #102 | The Arabic FAQ ran from its last answer straight into the footer, with `/ar/sample` reachable from nowhere in its body. It now closes the way the English one does. |
| #103 | The market-brief form, in both languages. |
| #104 | Batch 2: the Arabic catalogue's 11 spec panels, the English brine-spec heading, and the contact-page address. |
| #105 | The Arabic wording the owner reviewed as a native reader, item by item. |

#### What the audit was, and what it got wrong

Deploy 11 exists because of an owner-requested Arabic cross-page audit of 44
pages against their English twins. Two of its findings did not survive contact
with the files, and both are recorded here because the register entries alone
would not show it:

- **A "missing comma" on both contact pages.** There is none. The head-office
  card breaks the line with a `<br/>`, and the audit's text extraction turned
  that break into a space. Only the country form was ever wrong (C-82).
- **"16 occurrences" of `أنتيباستو`.** There were **26**. The audit counted
  visible text on `/ar` pages and missed the meta descriptions, the JSON-LD
  `category` and `description` fields, the print catalogue and the PDF source
  (C-83).

The audit's own stated baseline was also false: it asserted that the homepage
and `/ar/resources/packaging` had already been reviewed and their issues
addressed. No such work existed, in this session or in git history. Reported
before any of it was acted on.

#### Defects found that were not in the brief

- **The English market-brief form had never captured a lead.** `id="newsletter-form"`,
  five inputs, a Subscribe button — and no page loaded any script bound to it.
  No input carried a `name`; the form had no `action`. Pressing Subscribe
  navigated to `/?` with an empty query string, sent no request anywhere,
  showed no confirmation and cleared the fields. Meanwhile both privacy pages
  told visitors that form collects what they enter, and `leads.js` says in its
  own header that it is the backend "for Section C7 (Market Report signup on
  the homepage)". The backend was built for this form and the form was never
  connected to it. Found while building the Arabic half, fixed in both
  locales, recorded as C-79.
- **The confirmation message was invisible.** The shared handler's success
  green measured **1.06:1** against the olive panel. Recolouring could not fix
  it — at 12px even pure white reaches only 4.49:1 there — so the message now
  sits on its own darkened chip, measured at 9.69:1 / 9.38:1 / 8.71:1 from
  real rendered pixels.
- **`check-product-facets.js` had been passing by accident.** It compared a
  card's badge against an allow-list over a flat 2500-character window from the
  card's opening tag, which on the Arabic catalogue reached into the
  neighbouring card. The artichoke card had been passing on `مخللات` borrowed
  from the card below it, while its own badge was never in the allow-list at
  all. It surfaced only when #104's spec panels made each card longer than the
  window. The window is now bounded to the card.

#### Non-regression added

| Check | Asserts |
| --- | --- |
| `check-lead-fields.js` (extended) | every page carrying a lead form loads the shared handler, and each form has a submit, a status element, an email field and consent — the join no check was making, which is how a dead form sat on the homepage through ten deploys |
| `check-product-facets.js` (fixed) | a badge can only be satisfied by the card that displays it |
| `check-packaging-claims.js` (Deploy 10) | still green here |

The suite is now **21 check scripts**. Both new assertions were proved to fail
on the unfixed code before being committed.

#### Claim register

C-77 through C-83 added, all CLOSED. **C-55 remains the only `needs-review` row
in the register**, unchanged: the six privacy values still waiting on the
owner's lawyer.

C-77, C-78, C-80 and C-83 were each confirmed by the owner reading the Arabic
themselves, one at a time, and three of the four were changed on their
instruction: `هل لديك سؤال آخر؟` for a literal rendering of "Still have a
question?", `معلومات عن المنشأ` for a translation-ism, `تفاصيل الطلب` for
wording that read as "the order's data", and `مقبلات` for the transliterated
loanword. `صادقة` and `الموجز السوقي` were offered for change and deliberately
kept.

#### Testing method

Local throughout, as every deploy since #43: no deploy preview has been green,
and this environment's egress to `olivesegypt.com` and `*.netlify.app` is
blocked by policy. Chromium was used for what static checks cannot see — card
heights, form submissions and their payloads, consent enforcement, honeypot
placement, horizontal overflow at 360px, and contrast measured from rendered
pixels rather than computed styles.

#### Merge conflicts resolved

`ar/index.html` and `ar/catalog/index.html` are effectively one long line each,
so changes to different parts of the same page collide. #101/#103 and
#104/#105 both hit this. Each was resolved the same way: take the merged file
and re-apply the other change to it, then re-verify in a browser that both
changes coexist — never by hand-editing inside a conflict marker.

One of those resolutions was botched and redone: a `git stash` run while a
merge was still in progress cleared `MERGE_HEAD`, so the commit recorded a
single parent. The content was correct but GitHub kept refusing the PR as
conflicted. Re-merged with the parent recorded properly; no resolution was
redone.

#### Rollback

```
git revert c97dbe1 ae67773 fcb8e2e f2756de 3970fe0 583f29a
```

All six are squashes; no `-m 1`. Reverting #103 alone would restore a
market-brief form that discards every lead, so prefer fixing forward on that
one.

#### Known limitations shipped with this deploy

- **`LEADS_NOTIFY` is unset**, so the market-brief form now writes leads to
  `leads_staging` and emails nobody. That switch is the "wire this up to a real
  destination" step C7 reserves for the owner. Until it is set, leads
  accumulate unseen.
- No Netlify build has been confirmed for any of these six merges, as for every
  deploy in this document.
- `/docs/` is served publicly: `netlify.toml` publishes `.` and `robots.txt`
  does not disallow it, so this record and the claim register are reachable at
  `olivesegypt.com/docs/…` and crawlable, though unlinked and absent from the
  sitemap. Raised with the owner at #100 and deliberately left alone.

---

## Deploy 12 — Two contact routes that were only on some pages (PR #107)

**Date:** 2026-09-18
**Production commit:** `f6dfe69`
**Previous recorded deploy:** `f094de1` (Deploy 11)
**Delta:** 1 commit, 1 merged pull request, 70 files changed (+225 / −72) —
41 Arabic pages, 24 English pages, `assets/consent.js`, two scripts,
`package.json`, the claim register
**Approval:** "merge it", after the report below was put to the owner and the
one judgement call in it was flagged rather than assumed.

Reported by the owner, not found by a check: *"in the home page the arabic
lang the whatsapp button is overlapping with the cookies thing,, in all other
pages i dont see the whatsapp icon and the read our insights even at home
page?"* All three parts were exact.

### What was actually there

| | before | after |
| --- | --- | --- |
| WhatsApp button, English | 29 / 41 | 41 / 41 |
| WhatsApp button, Arabic | **1 / 41** | 41 / 41 |
| Read Our Insights tab, English | 17 / 41 | 41 / 41 |
| Read Our Insights tab, Arabic | **0 / 41** | 41 / 41 |

The single Arabic page with the button was the homepage — the one page the
owner had been looking at, which is why the report read as "here but nowhere
else" rather than "missing".

**Nothing had ever removed them.** They were added page by page, so any page
written afterwards simply never got them, and `generate-product-pages.py`
emitted neither — which accounts precisely for all 11 English product pages
and `/company-profile`. The generator now emits both, so a re-run cannot undo
this. That is the third time in three deploys that a generator has been the
thing holding a defect in place (C-73, C-81, now C-84), and the second time it
was caught only because someone looked at the pages rather than the checks.

### The overlap was not what it looked like

Not Arabic-specific, and not intermittent. `consent.js` measured the banner
**once**, synchronously, the instant it was inserted, and never again — no
resize listener, no re-measure. The banner is a single row on a wide window
and wraps to several on a narrow one:

```
/ar/  at 1280px   banner  73px   button bottom:97px    ok
/ar/  → 390px     banner 195px   button bottom:97px    OVERLAP
```

Load wide, then narrow the window or turn a phone, and the button stays at
the old offset while the banner grows over it. English behaved identically.
It is now repositioned on `resize`, on `orientationchange`, and through a
`ResizeObserver` on the banner itself, so a webfont arriving after insertion
cannot strand it either. Verified 1280 → 390 → 1280 in both locales.

### The judgement call, flagged not assumed

"Every single page" was read as every page a buyer browses. The **six
printable sheets** — both catalogue print pages, both business cards, both
letterheads — carry neither floater, because their print CSS hides only
`header, footer, .no-print` and a floating WhatsApp bubble added to one would
be printed onto the sheet. Put to the owner as an open question in C-84
rather than settled here.

### Non-regression added

`scripts/check-floating-actions.js` asserts both floaters on every browsing
page in both locales, that Arabic tabs point at the Arabic blog rather than
the English one, that no printable sheet carries one, and **that the
generator still emits them**. Proved to fail on a single removed tab before
being committed. The suite is now **21 check scripts**.

### Claim register

- **C-84** — the coverage, with the printable-sheet exception left open for
  the owner.
- **C-85** — the Arabic tab wording, `اقرأ مدونتنا` / `تصفّح المدونة`. `مدونة`
  is the site's own word for the blog; `رؤى` was deliberately avoided, having
  been replaced as a translation-ism one day earlier in C-78. Mine, and still
  awaiting a native reader.
- **C-86** — the overlap, CLOSED.

C-55 remains the only `needs-review` row in the register.

### Testing method

Local, in Chromium, as every deploy since #43. What static checks cannot see
was measured: button offset and banner height across 1280 → 390 → 1280 in
both locales, horizontal overflow on all 44 Arabic pages at 360px with the
new side tab in place, and the Arabic tab's rendered text and href.

### Rollback

```
git revert f6dfe69
```

A squash; no `-m 1`. Reverting restores the state the owner reported, so
prefer fixing forward.

### Known limitations shipped with this deploy

- **The Arabic tab wording is unconfirmed.** It is live on 41 pages and is
  mine, not the owner's. C-85 is open.
- **`LEADS_NOTIFY` is still unset** (carried from Deploy 11): the market-brief
  form writes leads to `leads_staging` and emails nobody.
- No Netlify build has been confirmed for this or any of the seven merges
  before it.

---

## Deploy 13 — The corner the two floating controls were sharing (PRs #109, #110)

**Date:** 2026-09-18
**Production commit:** `6464d5e`
**Previous recorded deploy:** `f6dfe69` (Deploy 12, PR #107) — but see the
process note below: Deploy 12's own record did not reach production the way
it should have
**Delta:** 2 commits, 2 merged pull requests, 6 files changed (+209 / −8)
**Approval:** "merge it" twice, each after its own report.

Deploy 12 answered an owner report in three parts. Two of them were right.
The third — *"the cookies thing still overlapping with whatsapp icon on
arabic pages"* — came back, and this deploy is why.

| PR | Substance |
| --- | --- |
| #109 | The cookie pill moved out of the WhatsApp bubble's corner under RTL, plus a phone-width collision between the banner and the insights tab that nobody had reported. |
| #110 | The bubble mirrored to the bottom-left on Arabic pages instead, so both controls follow the reading direction. |

### One report, three attempts

Worth recording as a sequence rather than as a tidy outcome:

1. **Deploy 12 (C-86)** fixed a genuine bug: the banner's height was measured
   once at insertion, so resizing a window or turning a phone left the button
   at a stale offset while the banner grew over it. Reproducible, real, and
   **not what the owner was seeing.**
2. **#109 (C-87)** found the actual cause. The cookie reopen pill was pinned
   with `inset-inline-start`, which follows the reading direction, while the
   bubble is pinned with a physical `right-6` in page markup. In Arabic both
   resolved to the same corner. It appeared only *after* a cookie choice,
   because the pill does not exist until then — **which is the one state
   Deploy 12's verification never entered.** I tested with the banner showing
   and never once clicked accept or reject.
3. **#110 (C-89)** replaced that fix with the arrangement the owner chose:
   mirror the bubble, so Arabic is a mirror of English rather than a mix of
   one physical corner and one logical one.

The lesson, and it cost two extra rounds: **a fix verified only in the state
the fixer had in mind is not verified.** The final sweep runs 108
combinations — nine viewports from 1440×900 down to 320×568, four pages,
three consent states, both locales — because the bug lived in the
combination, not in any one of them. A targeted pass then covered the risk
#110 introduces, the insights tab and the cookie pill sharing a side in
Arabic: no collisions down to 320×568.

### Where the controls sit now

| | WhatsApp bubble | Cookie pill |
| --- | --- | --- |
| Arabic | bottom-left | bottom-right |
| English | bottom-right (unchanged) | bottom-left (unchanged) |

The bubble is pinned with a physical `right-6` in the markup of 82 pages and
the compiled stylesheet carries no logical inset utility to swap it for, so
the mirroring is one hand-written rule in that stylesheet, beside the
`.tc-social-*` additions already there — not an injected style, which would
move the button after first paint.

### A rule that was round-tripped

`check-inquiry-forms.js` required the pill to use a logical offset, from the
RTL work. #109 inverted it; #110 restored it. Both checks now state what they
actually defend — **not that logical or physical is correct, but that the two
controls must not mix the two**, since that is the only arrangement that
lands them in the same corner. A check asserting a property without naming
the failure it prevents invites exactly this.

### Process note: Deploy 12's record reached production without its own approval

The Deploy 12 section of this file was written for PR #108 and approved as a
docs-only change. It is on production — but it arrived inside **#109**,
because that branch was cut from the record branch instead of from `main`.
The content was harmless and the owner had asked for it, but the deployment
gate was bypassed: one approval carried a second change.

#108 is therefore closed rather than merged. Merging it now would revert #109
and #110, since it predates both. Branch from `main`, not from whatever
happens to be checked out.

### Claim register

C-87, C-88 and C-89 added, all CLOSED. **C-84 closed too**, during this
deploy: the owner confirmed that the six printable sheets should not carry
the floating actions, so the exception is now their decision rather than my
reading of "every single page", and the check that enforces it has their
authority behind it. **C-85 closed too**, in the same session: the owner read
the Arabic insights-tab wording and approved both strings unchanged, so
nothing on the 41 pages moves. C-55 remains the only `needs-review` row, and
no claim is now waiting on a native reader — the first time that has been
true since the Arabic work began.

**Correction, made while checking this entry:** C-77 and C-78 were shown as
still awaiting the owner's confirmation. They were not — the owner confirmed
both on 2026-09-18, item by item. Their closures were lost when the register
conflict in #105 was resolved by taking `main`'s file wholesale and appending
only the new row, which silently discarded two edits that lived on the branch.
The code changes had landed; the record of the approvals had not. Both are
restored, and the loss is noted in each row rather than quietly repaired. A
conflict resolution that takes one side wholesale is not a resolution — it is
a choice to discard the other side, and it needs to be read as one.

### Testing method

Local, in Chromium. Measured directly rather than inferred: button and pill
coordinates per viewport, banner height across resize, element visibility and
tab order, and the 108-combination sweep.

### Rollback

```
git revert 6464d5e 1194daa
```

Both are squashes; no `-m 1`. Reverting only `6464d5e` returns to #109's
arrangement — no overlap, but Arabic un-mirrored. Reverting both restores the
overlap the owner reported, so fix forward instead.

### Known limitations shipped with this deploy

- **The Arabic insights-tab wording is unconfirmed** and live on 41 pages.
- **`LEADS_NOTIFY` is still unset**, carried from Deploy 11.
- No Netlify build has been confirmed for this or any deploy in this document.

---

## Deploy 14 — A logo that was mostly empty canvas, and one claim in three places (PRs #111–#118)

**Date:** 2026-09-19
**Production commit:** `ac7315f`
**Previous recorded deploy:** `6464d5e` (Deploy 13, PRs #109 and #110)
**Delta:** 8 commits, 8 merged pull requests, 61 files changed (+221 / −70),
one of them a replaced binary
**Approval:** five instructions across two days, each after its own report —
attributed per pull request below.

### Where the range starts, and why that needed checking

Deploy 13 names `6464d5e` (#110) as its production commit. But Deploy 13's own
entry shipped in **#111**, and the correction inside it shipped in **#112**,
both of which merged after that commit. So both are in this delta, even though
Deploy 13's prose already describes what they say. The boundary is the commit,
not the narrative: `6464d5e..ac7315f`.

This was checked rather than assumed. Deploy 12 and Deploy 13 both nearly
claimed #107, and a record that counts one merge twice is worse than one that
runs behind — a reader has no way to tell which of the two entries is wrong.

### The merges

| PR | Merged | Visitor-facing | Substance | Approval |
| --- | --- | --- | --- | --- |
| #111 | 18 Sep | no | Deploy 13's own entry, and C-84 closed: the owner confirmed the six printable sheets should carry no floating action. | "merge 111 and close 108" |
| #112 | 18 Sep | no | C-77 and C-78 restored after #105's conflict resolution discarded them, each row recording that it was lost once. C-85 closed. | "merge it" |
| #113 | 18 Sep | no | C-90: the Follow-pill trial stays running, read as a press-rate question rather than the design comparison it was set up for. | "leave the pill running, check back in a few weeks" |
| #116 | 19 Sep | **yes** | `assets/logo-BJ1TOn9V.png` cropped to its own artwork. | "merge both and fix the contact wording too" |
| #115 | 19 Sep | **yes** | The header tagline replaced on 57 pages, plus a check that fails if either retired wording reappears. | same instruction |
| #117 | 19 Sep | **yes** | The same claim removed from the contact pages' opening sentence, both locales. | "merge 117" |
| #114 | 19 Sep | **yes** | The partner-facility address given the same country form as the head office, both locales. | "merge 114 and 118" |
| #118 | 19 Sep | no | C-91 closed: the owner read the new Arabic as a native reader and approved both strings unchanged. | same instruction |

Four of the eight change what a visitor sees. The other four are the claim
register and this file catching up — three of them on 18 September, before any
of the next day's site changes existed.

### The logo's box was never the problem

The brief asked for the header icon to be scaled up to roughly match the
cap-height of "TRIPLE COMPANY". Following that literally would have made the
logo **smaller**: that cap-height is about 11px, and the box the header already
gives the image is 32.

The file was the problem. `assets/logo-BJ1TOn9V.png` was a 512×512 canvas with
the mark occupying only 224×277 of it — 44% of the width, 54% of the height —
centred, with 149px of empty transparency on the left and 84px on top. In a
32px box `object-contain` fits the *canvas*, so the visible mark rendered about
17px tall beside a 15px wordmark. Cropping the canvas to the artwork (236×289,
with 6px of padding) puts the mark at about 31px in the same box: an 85% visual
increase with **no layout dimension changed anywhere**. Nothing moves, so
nothing can crowd the theme toggle or the menu button — confirmed at 1280, 768,
390, 360 and 320 in both locales, with a header-overlap check at each width.

The file grew from 15,119 to 38,740 bytes, and that direction is not a mistake:
the old file was small because most of it was empty canvas, which compresses to
almost nothing. A 256-colour version came in at 7,866 bytes with a mean channel
error of 2.1/255, but it shifted alpha on 1.5% of pixels — the anti-aliased
edges — and the owner declined it. A company mark is the wrong place to trade
edge quality for 30KB.

**Owner confirmation, and a gap in where it is recorded.** The owner approved
the result — "the new logo is fine". That approval is recorded here and nowhere
else, because the crop asserts nothing new: same artwork, same aspect ratio,
empty canvas removed. So no register row was opened for it. The favicon crop
*did* get rows (C-58, C-59), on the grounds that "the tab icon shows the
company logo" is a claim about what an image depicts. The two are arguably the
same kind of change, and the asymmetry is noted here rather than resolved —
opening a row after the fact is the owner's call, not something to slip into a
records-only pull request.

### One claim, three places, reviewed once before

"Premium Export Specialists" / "متخصصون في تصدير الزيتون المصري الفاخر" was not
a new find. **C-32 records that the owner reviewed this exact wording on
2026-09-05 and deliberately kept it**, over my note that "specialists" sits
against the site's own FAQ answer — "We are a newly established export
company". That row now reads SUPERSEDED rather than being edited away, because
the fact that it was looked at once and kept is precisely what made it look
unresolved when it came back.

What it is **not** is the alternate-name defect. That was **C-31** — "Triple
Company Export Specialist" in `og:site_name`, emitted by
`generate-resource-pages.py` — found and fixed on 2026-09-05. Re-verified on
the 19th before touching anything: all 57 occurrences of the old tagline were
visible markup, zero in any schema node, `og:`/`twitter:` field or `<title>`,
and no `og:site_name` anywhere contains "Specialist". Two different defects in
the same words, fourteen days apart; conflating them would have produced a fix
for a problem that was already fixed.

The replacement, chosen by the owner from three options — a plain statement of
activity, with no claim about how well it is done:

| | Retired | Live |
| --- | --- | --- |
| English (29 page headers) | Premium Export Specialists | Egyptian Table Olive Export |
| Arabic (28 page headers) | متخصصون في تصدير الزيتون المصري الفاخر | تصدير الزيتون المصري |

It asserts no new fact: Egyptian origin, table olives and export are each
stated throughout the site already. It is also not new wording. A grep for the
English string returns a thirtieth hit —
`netlify/functions/_guides/en/company-overview.html`, which has carried
"Egyptian Table Olive Export · Company Overview" as its subtitle since
2026-09-06. The phrase was already approved site language before it was picked
for the header, which is what Operating Rule 2 asks for; it was found
afterwards, not used as the reason.

**The third place was found only because the second was fixed.** With the
header done, a sweep for the claim turned up the contact pages' opening
sentence — "Get in touch with our export specialists" / "تواصل مع متخصصي
التصدير لدينا" — one word in each locale. Worth recording: each of those pages'
own `og:description` **already said "export team" / "فريق التصدير"**. The
visible sentence had been contradicting the page's own meta description the
whole time, so the neutral wording was already the one going to search engines
and social previews, while the text a visitor actually read made the stronger
claim. No occurrence of the claim, in either language, now remains anywhere on
the site.

### Process note: a pull request that was approved and then left sitting

#114 was approved on 2026-09-18 and merged on the 19th. In between, I moved on
to the header work **without saying that it was still open**. It went four
merges stale, and its one file collided with both #115 and #117, which each
touched `contact/index.html`.

The collision was resolved the way the minified-file conflicts before it were:
take `main`, re-apply the branch's two-word change on top, then verify all
three survive — the new tagline, the "export team" wording, and the partner
facility reading Egypt. That part worked. The part that should not have
happened is the delay. An approval is an instruction with a clock on it, and
the cost of sitting on one is paid in conflicts on files that cannot be merged
automatically.

#114 exists because of something worse than the delay. Batch 2 normalised the
head-office address to "Egypt" / "مصر" and left the partner-facility block on
the same two pages reading "Arab Republic of Egypt" / "جمهورية مصر العربية", so
each contact page carried two country forms at once, in both locales. **C-22
governs only the head-office address, so scoping that change to it was right;
not flagging the mismatch it would leave was not.** It surfaced because the
owner asked for Batch 2's results to be re-verified rather than taking
"finished" at face value. Both blocks on both pages now end Egypt / مصر, and a
direct search for either formal form returns zero.

### Claim register

C-90 and C-91 added. **C-91 is CLOSED** — the owner reviewed the new Arabic as a
native reader and approved both strings unchanged, so nothing on the 28 Arabic
pages moves. C-32 is marked SUPERSEDED by it. C-82 was extended to cover the
partner facility, and C-84 and C-85 closed on the owner's confirmations. The
register stands at 91 claims, with **C-55 the only `needs-review` row** and
nothing waiting on a native reader.

C-90 carries an open action rather than a closure: no Follow-pill count has
been read, and none can be read from here.

### Testing method

`npm test` — now **21 suites**, green on `ac7315f`. One of them grew for this
deploy: `check-identity-strings.js` gained a retired-tagline rule, covering
pages and generators alike. A header subtitle is exactly the kind of text
copied onto a new page from an old one, and the check that would have caught
that did not exist.

The logo was measured, not eyeballed: canvas and ink bounds read out of the PNG
directly, then rendered box and mark dimensions read out of Chromium at five
widths in both locales.

The tagline sweep counted occurrences **by category** — visible markup, schema
nodes, meta fields, `<title>` — rather than in total, because which category
they were in was the whole question.

### Rollback

```
git revert ac7315f 3b8e8c4 4fe8959 153d6e3 07f8ccd 72439d7 9b3caf5 9dc5ba2
```

All eight are squashes; no `-m 1` on any of them. The order matters: #114, #117
and #115 all touch `contact/index.html`, so reverting out of reverse
chronological order will conflict.

**Do not revert #115 or #117 selectively.** Both remove an unverified
capability claim that the owner has since replaced by decision; putting either
back restores the claim. A partial revert of #115 — the pages without the check
— will also fail `npm test`, which is the retired-tagline rule doing exactly
its job. Fix forward instead.

Reverting #116 restores the 512×512 canvas and shrinks the header mark back to
about 17px. It changes no layout dimension in either direction.

### Known limitations shipped with this deploy

- **105 pages declare the logo as `width="512" height="512"` for a file that is
  now 236×289.** Found while writing this entry; not fixed here. The
  consequence today is nil — every one of those images also carries an explicit
  `h-8 w-8` box (two carry `h-16 w-16`), so CSS sets both dimensions and the
  stale attributes never reach layout, and `object-contain` fits the real
  intrinsic ratio rather than the declared one. But the numbers are now wrong,
  and the next person to render that image without a fixed box will get a
  square space reservation for a 0.82:1 file. Flagged rather than folded into a
  records-only change. Separately, `generate-product-pages.py` emits the image
  with no `width`/`height` at all, so a re-run produces pages that differ from
  the hand-written ones in this respect.
- **`LEADS_NOTIFY` is still unset**, carried from Deploy 11 through Deploy 13.
- **`/admin/analytics` still cannot be signed into**, open since 2026-09-17. It
  is the named blocker on C-90: the Follow-pill counts exist only behind that
  login.
- The Arabic insights-tab wording is **no longer** a limitation — carried by
  Deploy 13, closed as C-85 on the owner's review.
- No Netlify build has been confirmed for this or any deploy in this document.
  The owner chose to record this deploy without checking the dashboard first,
  so the entry says "unconfirmed" for the seventh time rather than settling it.

---

## Deploy 15 — Four merges a visitor cannot see (PRs #119–#122)

**Date:** 2026-09-19
**Production commit:** `412bcbb`
**Previous recorded deploy:** `ac7315f` (Deploy 14, PRs #111–#118)
**Delta:** 4 commits, 4 merged pull requests, 109 files changed (+746 / −167)
**Approval:** three instructions — "record deploy 14", "fix the logo dimensions",
"can you fix those two ??" — then "merge 120 121 122 in that order".

### The first deploy in this document that changes nothing anyone can see

That is worth stating plainly, because every earlier entry could be checked by
looking at a page. None of these four can:

| PR | Substance | What a visitor sees |
| --- | --- | --- |
| #119 | Deploy 14's own entry | nothing — documentation |
| #120 | 105 logo tags corrected from 512×512 to 236×289, plus a check | nothing — CSS pins the box, so the attributes never reach layout |
| #121 | The product-page generator rebuilt to match the pages it writes | nothing — zero bytes differ in any of the ten pages |
| #122 | 23 image declarations corrected to their files' real sizes | nothing — same reason as #120 |

So the verification that matters here is not "does the page look right". It is
before-and-after measurement, byte-for-byte comparison, and negative tests
proving each new check fails when the defect returns. Those are recorded below
because they are the only evidence these changes have.

### Where the range starts

`ac7315f..412bcbb`. Deploy 14 names `ac7315f` (#118) as its production commit
and **#119 carries Deploy 14's own entry**, merged after it — so #119 belongs
here, exactly as #111 and #112 belonged to Deploy 14 rather than to the deploy
they described. A record of a deploy is itself a merge, and it lands in the
next one. Checked against every earlier entry rather than assumed: none of
#119 to #122 appears in any of them.

### A crop that left 105 numbers describing nothing

#116, in Deploy 14, cropped `assets/logo-BJ1TOn9V.png` from a 512×512 canvas
to its 236×289 artwork and changed nothing else. It did not change the 105
tags that declared `width="512" height="512"`, and after the crop those
numbers described no file that existed.

**It never showed, and that is the finding rather than an excuse.** Every one
of those tags also carries an explicit CSS box — `h-8 w-8` on 100 of them,
`h-16 w-16` on 2, a `width`/`height` pair in a document stylesheet on 3 — so
the attributes never reach layout, and `object-contain` fits the real
intrinsic ratio rather than the declared one. A wrong value and a right value
render identically. Three days passed; the defect was found while writing
Deploy 14's entry, not by anyone looking at the site.

Measured after the fix, at 1280, 768, 390 and 320 in both locales: box 32×32
with a painted mark of 26×32 on browsing pages, 46×46 on the letterheads,
64×64 on the business cards. Those are the numbers #116 recorded, unchanged,
which is the point — nothing layout-bearing moved in either direction.

### The generator would have undone eleven days of work

While confirming that #120's one-line change to
`scripts/generate-product-pages.py` was consistent, the generator was run. It
rewrote all ten pages it owns: **401 insertions, 611 deletions.** The run was
undone from git within the minute, and the committed diff for those files is
the two logo attributes and nothing else.

The template had drifted from its own output. The shipped pages had gained the
consent, locale-switch, site-nav and analytics scripts, hreflang alternates,
the favicon family, the theme bootstrap, the rebuilt navigation with its
dropdown panels and mobile drawer, the Facebook pill, the theme toggle and the
footer columns. The template still emitted the shape they had before all of
that.

**And one thing the pages had lost, the template had kept**: an
`offers`/`InStock` block in the Product schema. A re-run would have put an
availability claim back into the structured data of ten pages — the single
most consequential item in this deploy, and it would have arrived silently,
inside what looked like a routine regeneration.

It is not an unmaintained generator, which is what makes it instructive. The
WhatsApp button and the insights tab were added to it during Deploy 13's
floating-actions work, and the logo's dimensions in #120. It was edited twice
in two days. Only the parts nobody thought to re-check drifted — and **a
generator that is wrong says nothing until it is run, by which point it has
already overwritten the file it was wrong about.**

The fix goes the only direction it can. The live pages were always the correct
ones, so the template is now derived from
`products/aggizi-green-olives/index.html` and reproduces all ten byte for
byte. Each page's image markup is read back out of the page rather than
assumed — five products carry a photograph with a WebP source, five an
illustration whose alt text says photography is pending — so the image became
a field per product instead of one shape hardcoded for all of them.

Before rebuilding anything, the old code's formats chips, caliber chips,
best-for list, related list and image markup were confirmed still present
verbatim in all ten shipped pages. That is what established the drift was
confined to the chrome and the product-data half of the template was sound.

### One rule for image sizes, and a miscount corrected

The survey that found the logo defect also found 23 tags declaring a size that
was not the file's: ten thumbnails at 96×96 on the printable catalogues, ten
at 80×80 on the downloads pages — both declaring the *display* size — and
three in `ar/catalog` declaring `800x515`, which is the real size of
`olive-black`, on the aggizi, toffahi and hamed photographs (800×533,
1200×800, 1200×1800). The English catalogue has all three right, so the Arabic
page is a copy whose numbers were never updated.

**#120 reported 14 of these. There were 23.** The rows of a summary table were
counted rather than the tags they stood for, and the miscount reached both the
pull request body and C-92. Corrected in #122 with the error left on the
record in the row itself, per the same reasoning that kept C-32 as
SUPERSEDED rather than deleting it: a number that was wrong once is part of
what the register is for.

All 23 are now the files' own sizes. The rule is now one rule — a declared
size is the file's size — and it is enforced for every raster image the site
serves itself, 159 tags across 7 assets.

**SVGs are deliberately outside it.** Their intrinsic size is a `viewBox` or a
percentage and often neither, so there is no single number to compare against
and a check that picked one would be asserting its own guess. The illustration
placeholders are all SVG, so this is not a marginal exception — it is stated
rather than hidden.

### The checks, and why each one exists

The suite went from 21 to 23. Both additions came from this deploy's defects,
and both were proven to fail before being trusted to pass.

| Check | Fails when | Negative tests, all exit 1 |
| --- | --- | --- |
| `check-image-dimensions.js` (widened from `check-logo-dimensions.js`) | any declared size differs from the file, read from PNG `IHDR` and JPEG `SOF` headers on every run | a page put back to 512×512; the generator stripped of its attributes; **the PNG itself re-cropped to 200×200 with the markup untouched** — 105 declarations named; a thumbnail put back to 80×80; one photograph re-encoded at 600×400 — failed on all eight pages that declare it |
| `check-generator-parity.js` | a generator's output differs from what is committed, rendered into a temporary directory — never the working tree | one word changed in the template, failing all ten pages; one character added to a generated page, failing that one |

The third negative test in the first row is the one that matters: it proves the
**file** is the source of truth, not the markup. Re-cropping an asset fails the
suite until the declarations follow it. Every asset touched in a negative test
was restored byte-for-byte, and confirmed so before committing.

The parity check renders into a temporary directory specifically so that
running the suite cannot itself do what the check exists to prevent. It also
asserts in both directions: editing a generated page by hand fails, and so
does editing the template without regenerating. One page, one source of truth.

`generate-product-pages.py` now takes an output root, which is what makes that
possible — and which means the generator can be rendered somewhere harmless by
anyone who wants to see what it would do.

### Process note: three stacked pull requests, rebased rather than merged across

#121 and #122 were opened against their parent branches, because all three
touched `package.json` and the check-script family while no page was touched by
more than one of them. Merging them in that stacked state would have made each
squash re-apply its parent's diff and carry its parent's commits into the
message.

So each branch was rebased onto `main` after its parent merged, the suite
re-run, and the base retargeted before merging. All three were branches with
no other checkout, force-with-lease, and the suite passed on each rebased head
before it was pushed. Recorded because the alternative — merging a stack as a
stack — produces a history where a later commit appears to contain an earlier
one's changes, and nobody reading it later can tell why.

### Claim register

C-92, C-93 and C-94 added, all `defect-fixed` with no action required. **C-92
corrected in #122** — the 14/23 miscount above. Register stands at 94 claims,
with **C-55 the only `needs-review` row** and nothing waiting on a native
reader.

Three defect rows in one deploy is the most this record has carried. Two of
them (C-92, C-94) are the same defect at two scales, and the third (C-93) was
found only because the first was being fixed. None of the three was reported
by anyone using the site, and none of them could have been.

### Testing method

`npm test` — 23 checks, green on `412bcbb`, re-run on `main` after all three
merges rather than trusted from the branches.

Rendered geometry measured in Chromium rather than reasoned about: the logo at
four widths in both locales across five page families, and the five
photo-affected pages at 1280 and 390 **before and after** the change, serving
the committed HTML for the before pass. Every box matched to the pixel and the
two outputs `diff` clean.

Byte-for-byte comparison for the generator, with `cmp`, 10 of 10 — and the
stronger check afterwards: running it in the repository on `main` produces no
diff at all. The run that would have rewritten ten pages that morning is now a
no-op.

### Rollback

```
git revert 412bcbb 27f017b f662f50 83d3c51
```

All four are squashes; no `-m 1` on any of them. Reverting any of them changes
nothing a visitor sees — what it restores is the hazard: stale declarations, a
generator that overwrites ten pages with an older shape and an availability
claim, and a suite two checks smaller. Fix forward.

`412bcbb` and `f662f50` both touch the check-script family and `package.json`,
so revert in the order given.

### Known limitations shipped with this deploy

- **`generate-resource-pages.py` has drifted the same way, and is not fixed.**
  Checked while writing this entry, by reading it rather than running it: the
  script emits no `tc-nav`, no `tc-social-pill`, no `tc-footer-col`, no
  `mobile-menu-toggle`, no `theme-toggle-btn`, no `consent.js` or `site-nav.js`,
  and not the current tagline — every marker that was missing from the product
  generator is missing from this one too. It writes seven pages:
  `/resources/certifications`, `/resources/faq`, `/resources/export-markets`,
  `/resources/why-egyptian-olives`, `/resources/packaging`,
  `/resources/pricing`, and the `/resources` hub.
  **It is also the script that produced the C-31 alternate-name defect**, so
  its output has been wrong in a published way before.
  It was not fixed here for a specific reason: unlike the product generator it
  writes relative to the current working directory with no output-root option,
  so there is no way to render it somewhere harmless without changing it first.
  Testing it means editing it, which makes it its own change rather than a
  verification step in this one. `check-generator-parity.js` takes more entries
  — the generator list is one array at the top — and the work is adding an
  output root, rebuilding the template from the seven shipped pages, and
  registering it.
  **Closed the same day, and the diagnosis above was incomplete.** The script
  did not merely lack an output root: it read its header and footer at import
  time from two files under an ephemeral `/tmp/claude-0/.../scratchpad/` path
  committed on 2026-09-01, so on any fresh checkout it raised
  `FileNotFoundError` before generating anything. **It had not been runnable
  since the container that wrote those files.** That is also the mechanism
  behind the drift described above: the two scratch files were a 1 September
  snapshot of the header and footer, so the script could not have picked up the
  navigation rebuild however often it ran, and five of its seven bodies had
  fallen behind the shipped pages as well. See C-95.
  **Retired 2026-09-19, the same day it was repaired.** The repair made the
  script correct and runnable, and left it holding a second copy of seven pages
  that are edited by hand. On the owner's instruction the question "does
  anything actually run this" was put first, and the answer was nothing —
  no build step, no CI (the repository has no workflows at all), no npm script,
  no runbook. The pages, meanwhile, had been edited directly in 33 commits since
  the script was written. So it was deleted rather than kept behind its own
  parity check, and all nine `/resources` pages were verified byte-identical
  across the deletion. The parity check is back to the one generator something
  runs.
- **The other 21 check scripts print their `… OK --` summary even when a test
  failed**, so a failing run reads "OK" directly above "1 failed". Fixed in
  the two scripts added by this deploy; the rest still do it.
- **`LEADS_NOTIFY` is still unset**, carried since Deploy 11.
- **`/admin/analytics` still cannot be signed into**, open since 2026-09-17,
  and still the named blocker on C-90's Follow-pill counts.
- No Netlify build has been confirmed for this or any deploy in this document.
  With these four merges the count reaches 58.

---

## Deploy 16 — Repairing a tool before asking whether it should exist (PRs #123–#125)

**Date:** 2026-09-19
**Production commit:** `57b0c74`
**Previous recorded deploy:** `412bcbb` (Deploy 15, PRs #119–#122)
**Delta:** 3 commits, 3 merged pull requests, 6 files changed (+299 / −502)
**Approval:** "record deploy 15", then a decision brief on C-95 requiring the
question to be answered and reported before anything was changed, then "merge"
for each.

### The first deploy with a negative line count

−502 against +299, because the middle pull request rebuilt a 488-line script
and the last one deleted it. Both were correct, in that order, and the entry is
mostly about why that is not a contradiction.

It is also the **second consecutive deploy in which nothing a visitor loads
changes at all**: no HTML, no asset, no stylesheet, in either locale. Six files,
all of them a script, a check or a record.

### The merges

| PR | Substance |
| --- | --- |
| #123 | Deploy 15's own entry, and the first flag that `generate-resource-pages.py` had drifted the same way the product generator had. |
| #124 | That script made runnable and true to its seven pages, byte for byte, and registered in the parity check. |
| #125 | That script deleted, because nothing ran it. |

Range checked rather than assumed, as every entry since Deploy 13 has been:
`412bcbb..57b0c74`, with #123 in this delta because it carries Deploy 15's entry
and merged after the commit Deploy 15 names as production. No earlier entry
claims any of the three.

### A script that had not been able to run since 1 September

The finding flagged in Deploy 15 was that the resource generator's chrome had
drifted. That was true and it was the smaller half.

```python
HEADER = open("/tmp/claude-0/.../scratchpad/header_raw.html").read()
FOOTER = open("/tmp/claude-0/.../scratchpad/footer_raw.html").read()
```

Committed on 2026-09-01 in `57ad849`. An **ephemeral, session-scoped path**,
read at import time, so on any fresh checkout the script raised
`FileNotFoundError` before generating anything. It worked while being tested
only because the container that wrote those two files was still alive.

**That is also the drift mechanism, and the reason the drift was total.** The
two scratch files were a 1 September snapshot of the header and footer, so no
number of runs could ever have picked up the navigation rebuild, the Facebook
pill, the theme toggle, the mobile drawer, the footer columns, the consent and
site-nav scripts, or the logo's declared dimensions. A re-run would also have
re-emitted the header tagline C-91 retired, on all seven pages.

Five of the seven bodies had fallen behind as well:

| Page | Shipped `<main>` | In the script |
| --- | --- | --- |
| `/resources/certifications` | 8,174 chars | 3,766 |
| `/resources/why-egyptian-olives` | 7,380 | 5,283 |
| `/resources/pricing` | 7,235 | 5,332 |
| `/resources` (hub) | 4,981 | 4,069 |
| `/resources/packaging` | 5,190 | 5,019 |
| `/resources/faq` | 8,859 | 8,859 |
| `/resources/export-markets` | 4,526 | 4,526 |

**Deploy 15's own diagnosis was incomplete**, having said only that the script
lacked an output root. That entry carries the correction rather than having
been rewritten.

### Why #124 was not wasted work, and why it was still the wrong stopping point

#124 rebuilt the script from the shipped pages: template, header, footer and all
seven bodies derived and verified byte for byte, nothing read from outside the
repository, an output root added, and the parity check extended to cover it —
including a fix to the comparison loop, which had assumed `<slug>/index.html`
and would silently have skipped the `/resources` hub page written beside those
directories.

The derivation is worth recording as a method, because it was mechanical rather
than careful. Aligning all six slug pages line by line produced exactly **15
varying lines** and an assertion that every other line was identical across all
six. That assertion is what made the template trustworthy instead of plausible,
and it immediately caught two details that had been guessed wrong: the
description `<meta>` closes `"/>` while keywords closes `" />`, and the empty
extra-JSON-LD slot is four spaces rather than an empty line.

What #124 did not do was ask whether the script should exist. It ended with a
correct generator holding a second copy of seven pages that are edited by hand
— and a check whose job was to notice when the two disagreed. That is a safety
net over the problem, not a removal of it, and the pull request said so.

### The question that ended it, and how long it took to answer

The owner's instruction was to find out whether anything still ran the script
before touching it, and to report before changing. The audit:

| Candidate runner | Result |
| --- | --- |
| Netlify build | `command = "node scripts/build-geo.js"` — that and nothing else |
| CI | **no `.github/workflows` directory exists at all** |
| npm scripts | none invoke any generator |
| Makefile, shell scripts | none in the repository |
| Runbook or documentation | no `.md` contains a `python3 scripts/generate…` instruction |
| `check-generator-parity.js` | ran it — **only because #124 added that entry, to guard it** |
| `check-identity-strings.js`, `check-packaging-claims.js` | read it as text, never execute it |

And the evidence that settled it: **the seven pages had been edited by hand in
33 commits** since the script was written — the 220 kg barrel correction, the
retired export-markets stat, the header social button, the new tagline, the logo
dimensions.

The script's own history says the same thing from the other side. It was created
on 1 September and finished the same day, and in the eighteen days that followed
it was edited exactly three times: `e61ce0e` for the C-31 `og:site_name` defect,
`7790843` for the retired export-markets claim, and `4de48ea` for the barrel
capacity. **Every one of those came after the same change had already been made
to the pages by hand.** The script never led; it was always being caught up, and
three times out of thirty-three it was.

So the repair had produced a correct tool that nothing used, for pages everyone
edited directly. #125 deleted it.

**The lesson is the sequence, not the outcome.** The tool was fixed before
anyone asked whether it should exist, and answering that took one pass over the
build configuration. A generator earns its place by being run by something;
`check-generator-parity.js` now says so in the comment above its list, so the
next entry added to it has to answer the question first.

### A premise corrected rather than accepted

The alternative to deletion was reworking the script to read each page's own
body from disk at generation time — described in the instruction as the approach
already used for the `/ar/catalog` reuse of product-page data.

**No such mechanism exists.** The site has no HTML build step at all; Netlify's
build command fetches a GeoLite2 database. Nothing under `scripts/` or
`netlify/` reads a page's `<main>` from disk. The `/ar/catalog` spec panels were
*editorial* reuse — already-approved Arabic wording copied from the product
pages under Operating Rule 2, which satisfied the no-invented-content rule and
was not a build-time mechanism.

It changed no outcome, since the deletion path applied. It is recorded because
that path would have been new work rather than a pattern followed, and a record
that lets an incorrect premise stand teaches the wrong thing later.

### A rule that caught its own explanation

`check-identity-strings.js` forbids the retired tagline in any page or
generator. Both docstrings written for #124 quoted that wording to explain the
defect, and the suite failed them for it — correctly.

They were reworded to describe the string and point at C-91 rather than adding a
comment exemption. The rule is worth more absolute than convenient, and the
exact wording belongs in the register row, where it already was.

### Claim register

**C-95** added in #124 and **closed in #125**, `defect-fixed`, action `none`.
The row carries the runner audit, the 33-commit history, the byte-identical
verification, both consequences the owner accepted, and the corrected premise.
Register stands at 95 claims, with **C-55 the only `needs-review` row**.

C-95 is the only row in the register whose `action_required` ever asked the
owner for a decision rather than for evidence, and it was open for about twelve
hours.

### Testing method

`npm test` — 23 checks, green on `57b0c74`, re-run on `main` after each merge
rather than trusted from the branch.

Byte-for-byte comparison twice, for opposite reasons. In #124, that the rebuilt
script reproduced all seven pages. In #125, that **deleting** it changed none of
them: all nine files under `/resources` checked with `sha256sum -c` against a
baseline taken before the first edit. Nine rather than seven, because
`private-label` and `supply-network` live there and were never written by that
script — a distinction worth having made before deleting something that claimed
to own the directory.

Negative tests for the parity check as extended: a one-word template change
failed on six pages, a one-character edit to a shipped page failed on that page,
and the same edit to the hub failed on the hub — the last one written
specifically to prove the loop no longer skips it.

### Rollback

```
git revert 57b0c74 13445aa 9fdb07c
```

All three are squashes; no `-m 1`. Reverting changes nothing a visitor sees, in
any combination. Reverting only `57b0c74` restores the repaired script and its
parity entry — the state after #124, which was correct but was the safety net
rather than the fix. Reverting further restores a script that cannot run on a
fresh checkout.

### Known limitations shipped with this deploy

- **`/resources` can no longer be rebuilt from anything in the repository.**
  Named before the decision and accepted: those seven pages are hand-maintained
  only, which is what they already were in practice since 1 September. The two
  pages in that directory the script never owned, `private-label` and
  `supply-network`, were always in that position.
- **`check-identity-strings.js` and `check-packaging-claims.js` scan one fewer
  generator.** Accepted for the same reason: both still scan the shipped pages,
  which is where a false claim would actually appear and matter. Their
  docstrings now say the script was retired, so a reader does not go looking for
  a file that is not there.
- **`generate-product-pages.py` remains the only generator with a parity
  check**, and now the only page-writing generator at all. `build-geo.js` and
  `generate-export-catalog-pdf.js` produce a database and PDFs rather than
  pages, and neither is covered.
- **`LEADS_NOTIFY` is still unset**, carried since Deploy 11.
- **`/admin/analytics` still cannot be signed into**, open since 2026-09-17, and
  still the named blocker on C-90's Follow-pill counts.
- No Netlify build has been confirmed for this or any deploy in this document.
  With these three merges the count reaches 61.

---

## Deploy 17 — A guard for the way the last defect was found (PRs #126, #127)

**Date:** 2026-09-19
**Production commit:** `8950bc1`
**Previous recorded deploy:** `57b0c74` (Deploy 16, PRs #123–#125)
**Delta:** 2 commits, 2 merged pull requests, 5 files changed (+392 / −6)
**Approval:** "record deploy 16", then "check the umami repo for the same
scratchpad path issue", then "add a check for absolute paths in committed
files", then "merge" for each.

### The merges

| PR | Substance |
| --- | --- |
| #126 | Deploy 16's own entry. |
| #127 | `check-absolute-paths.js`, forbidding a filesystem path rooted on one machine in any file that can run or configure something. Suite 23 → 24. |

`57b0c74..8950bc1`, with #126 in this delta because it carries Deploy 16's entry
and merged after the commit Deploy 16 names as production. No earlier entry
claims either.

### The third consecutive deploy a visitor cannot see

Deploys 15, 16 and 17 changed no HTML, no asset and no stylesheet, in either
locale — checked here rather than asserted: zero files matching `.html`, `.png`,
`.jpg`, `.css` or `.svg` in this whole range diff.

Worth stating as an observation rather than an achievement. Nine merges across
three deploys — four, three and two — have gone into the machinery that checks
the site instead of the site. Some of that was necessary — two of those deploys existed to close
defects the machinery had missed — but a record that goes three deploys without
a visitor-facing change is describing a project that has been working on itself.
The next thing worth doing is probably on a page.

### Guarding the discovery method, not just the defect

The defect behind C-95 was a script reading its header and footer from an
absolute path in an ephemeral per-session scratchpad directory. Deploy 16
recorded how it was fixed. What Deploy 16 could not record is how it was
**found**, because that was luck: the suite never ran the script, so the broken
read never executed; nothing else ran it either; it surfaced because the
generator was run to check something unrelated, and was confirmed by reading
its first fifteen lines.

`check-absolute-paths.js` scans every tracked file that can run or configure
anything — 208 of 277 tracked files, by extension — for `/home/`, `/root/`,
`/tmp/`, `/Users/`, `/var/folders/`, `/private/var/` and Windows drive paths.
Such a path is wrong by construction: it describes one checkout, one container,
one laptop, and a repository that names one cannot be cloned and used.

**What it does not flag, and why each one is a deliberate boundary:**

| Not flagged | Reason |
| --- | --- |
| Web-absolute paths (`/assets/…`) | URLs, not filesystem paths; the whole site is built from them |
| Documentation | This file quotes the original two lines verbatim, which is the record doing its job, and a path in a `.md` cannot be executed |
| `C:/…`, forward-slash form | Indistinguishable from an ordinary `label:/path` |

That last one is not hypothetical caution. The first draft flagged eight
innocent lines, among them `mailto:/`, `purged:/` and a CSS `left:/` inside a
regular expression. **A check that cries wolf gets deleted rather than obeyed**,
so the pattern was narrowed until it was quiet.

### An empty allowlist, on purpose

One file would have needed an exemption: `check-generator-parity.js`, whose
comment quoted the path while explaining the defect. It was **reworded to
describe the path instead of quoting it** — the same decision made in Deploy 15
when the C-91 tagline rule failed two docstrings that quoted the retired wording
to explain why it was retired.

So `ALLOWED` is an empty map, and the docstring says it is meant to stay that
way: *a rule with an exemption for comments is a rule somebody routes around by
adding a comment.* Twice now the cheaper option was to carve out prose, and
twice the rule was kept absolute and the prose changed instead. That is the
precedent worth having, and it only holds while it keeps being chosen.

### The rule's point, written as a test

```js
t('the suite still gets its temp directory from the OS rather than a literal',
  /os\.tmpdir\(\)/.test(src) && /mkdtemp/.test(src), …)
```

Asking the operating system for a temporary directory at run time is correct and
stays correct everywhere, and `check-generator-parity.js` does exactly that,
three lines from a comment about this defect. **The fault was never using a
temporary directory; it was writing one machine's answer into a file.** That
distinction is now asserted rather than assumed, so it cannot quietly stop being
true.

### A negative test that found a gap in the check it was testing

Five negative tests, all exiting 1: the original defect reintroduced verbatim
into the product generator; a `/home/` constant in a serverless function; a
single-backslash Windows path in `netlify.toml`; a doubled-backslash Windows
path in a `package.json` string; and `os.tmpdir()` replaced by a literal, which
failed two tests at once.

**The fourth one failed to fail.** The pattern required exactly one backslash,
so it let `"C:\\Users\\x"` through — which is how a Windows path is *always*
written inside a JavaScript or JSON string literal. It now accepts one or two.

That line is correct only because the test was written before the check was
trusted, which is the entire argument for writing them in that order. A check
whose negative tests are written afterwards tests the code that was written,
not the rule that was meant.

### Both repositories swept first

| Repository | Result |
| --- | --- |
| `umami-olivesegypt` | Clean, and could not have been otherwise: **no commit by the owner or by me** — the authors are the upstream umami maintainers — no scratchpad reference, no absolute host path, working tree clean at upstream v3.3.1 |
| `olivesegypt-site` | The path survives only as elided prose in C-95, this file's Deploy 16 entry, and one docstring |

The umami result was verified rather than reasoned from the deployment record's
own claim that no commit was ever made there. Assuming is how the first one
survived eighteen days.

The site repository was also checked past string-matching, against the
underlying class — *does any committed file read something outside the
repository at run time* — by auditing all 22 file reads under `scripts/` and
`netlify/`. Every one builds its path from `ROOT`, `__dirname`,
`path.resolve(__dirname, …)` or a walk of the repository tree.

### Claim register

**C-96** added, `verified-approved`, no action required. Register stands at 96
claims, with **C-55 the only `needs-review` row**.

### Testing method

`npm test` — 24 checks, green on `8950bc1`, re-run on `main` after the merge
rather than trusted from the branch. Every file touched by a negative test was
restored, and `package.json` re-validated as JSON afterwards.

### Rollback

```
git revert 8950bc1 3bddd10
```

Both are squashes; no `-m 1`. Reverting changes nothing a visitor sees.
Reverting `8950bc1` removes the check and restores the docstring that quoted the
path; reverting both also removes Deploy 16's entry.

### Known limitations shipped with this deploy

- **Nothing checks that runnable code is ever run.** This is the gap the new
  check narrows without closing. `npm test` executes the 24 checks, `git
  ls-files`, and `generate-product-pages.py`; it `require`s `locale-routes.js`,
  `product-order.js`, `product-facets.js` and `sourcing-regions.js`. **Eight
  scripts are never executed or loaded by the suite at all** —
  `admin-password.js`, `build-geo.js`, `crm-create-user.js`, `crm-seed.js`,
  `db-roundtrip-check.js`, `kpi-roundtrip-check.js`, `send-test-email.js`, and
  `build-favicons.py`, plus `generate-export-catalog-pdf.js`. A machine-specific
  path in any of them now fails the suite; a syntax error, a bad import or a
  renamed dependency still would not. `build-geo.js` is the one that matters
  most, since Netlify runs it on every deploy — and nothing local does.
- **The check reads extensions, not content.** A runnable file with an
  unexpected extension, or a path assembled from fragments (`'/ho' + 'me/user'`)
  passes. The first is a real boundary; the second is not worth defending
  against, since anyone doing it is working around the check on purpose.
- **`LEADS_NOTIFY` is still unset**, carried since Deploy 11.
- **`/admin/analytics` still cannot be signed into**, open since 2026-09-17, and
  still the named blocker on C-90's Follow-pill counts. The decision to leave
  the trial running was taken on 2026-09-18 and no count has been read since,
  which is expected this early — but the counts stay unreadable by anyone until
  that login works, whatever the elapsed time.
- No Netlify build has been confirmed for this or any deploy in this document.
  With these two merges the count reaches 63.

---

## Deploy 18 — Parsing what nobody runs (PRs #128, #129)

**Date:** 2026-09-20
**Production commit:** `accebf4`
**Previous recorded deploy:** `8950bc1` (Deploy 17, PRs #126, #127)
**Delta:** 2 commits, 2 merged pull requests, 4 files changed (+354 / −4)
**Approval:** "record deploy 17", then "add the smoke test for the unexercised
scripts", then "merge" for each.

### The merges

| PR | Substance |
| --- | --- |
| #128 | Deploy 17's own entry, which is where the gap this deploy closes was first written down. |
| #129 | `check-script-integrity.js`: 78 scripts parsed, every dependency they name resolved, none of them executed. Suite 24 → 25. |

`8950bc1..accebf4`, with #128 in this delta for the usual reason — it carries
Deploy 17's entry and merged after the commit Deploy 17 names as production.
Neither appears in an earlier entry.

### How long it has been since a visitor could see anything change

Worth measuring precisely rather than gesturing at, because two different things
get called "visitor-facing" and only one of them matters.

**Seven consecutive merges — #123 through #129 — touched no file a visitor
loads at all**: no HTML, no image, no stylesheet, in either locale.

**The last change a visitor could actually perceive was #114**, on 19 September:
the partner-facility country form on the two contact pages. That is eleven
merges ago. Two merges since then did touch HTML — #120 and #122 — but both
changed only declared `width`/`height` attributes, which the Deploy 14 and
Deploy 15 entries established never reach layout, on pages whose rendered
geometry was measured identically before and after.

So the honest figure is eleven merges since anything changed for a reader, and
seven since anything changed in a file they fetch. **All eleven were machinery
or record work**: four record entries, four new checks (`check-image-dimensions`
as `check-logo-dimensions`, `check-generator-parity`, `check-absolute-paths`,
`check-script-integrity`), one check widened from a single asset to all of them,
one generator repaired and one retired.

None of it was busywork — every one closed a defect that had shipped or a gap
that had let one ship — and the record should still say plainly that a project
can spend eleven merges getting better at checking itself without getting better
for anyone using it. **The next thing worth doing is on a page.**

### The gap, and why parsing is the right size of fix

Deploy 17's limitations recorded that nothing checked whether runnable code is
ever run. `npm test` executed the check scripts, `git ls-files` and
`generate-product-pages.py`, and `require`d four helper modules. Nine scripts
were neither executed nor loaded by anything.

`build-geo.js` was the one that mattered. **Netlify runs it on every deploy and
nothing local did**, so a syntax error or a renamed dependency in it would have
been discovered by a failed production build — the same shape as C-95, code
nobody runs until it matters.

The obvious fix is to run them, and it is the wrong one. Several of these
scripts send email, write to the database or download a GeoLite2 archive on
their first line. **A smoke test that ran them would be worse than no smoke
test**, and would breach the standing rule against sending real mail from a test
path. `node --check` and Python's `ast.parse` read and parse without evaluating,
which is the whole trick: everything below is asserted with nothing run.

| Assertion | What it catches |
| --- | --- |
| Every `.js` parses as CommonJS | a syntax error |
| Every `.py` parses | a syntax error |
| Every relative `require()` resolves | a module renamed out from under a caller |
| Every package `require()` is builtin, declared, or tooling-only | an undeclared or renamed dependency |
| Every third-party Python import is stdlib or tooling-only | the same, in Python |
| **The script `netlify.toml` names exists and is one of those parsed** | renaming `build-geo.js` without editing the build command |

That last row is the reason the file exists. It breaks every deploy, and nothing
else in the repository would notice.

The check covers **78 files**, not the nine that were unexercised, so its
coverage cannot narrow as scripts are added or renamed.

### Two dependencies nobody had declared

Found by the new rule on its first run: `generate-export-catalog-pdf.js`
requires `playwright`, and `build-favicons.py` imports `PIL`. Neither is declared
in `package.json` or anywhere else, and there is no `requirements.txt`.

Both are one-off asset builders a maintainer runs with the tool already
installed, and neither is part of the Netlify build. **Declaring Playwright
properly would be worse than the gap**: `devDependencies` are installed on
production deploys, so every deploy would fetch a browser toolchain to render
two PDFs nobody regenerates on deploy.

So they are listed in `TOOLING_ONLY`, keyed to the single file each is allowed
in, with the reason written beside them. The same import anywhere else still
fails. It joins the printable sheets in `check-floating-actions.js` and the PDF
sources in `check-image-dimensions.js` as a named-exception list, and follows the
same rule those set: an exception is a decision with a name and a reason, not a
pattern that quietly happens to pass. `check-absolute-paths.js` has such a list
too, deliberately empty.

### A negative test that proved nothing, and the control that fixed it

Six negative tests. Five were ordinary: a syntax error, a renamed local module,
an undeclared package, an undeclared Python import, and `netlify.toml` pointed
at a file that does not exist, which failed two assertions at once.

The sixth was the one the whole design rests on — **does this check execute
anything?** A `writeFileSync` was injected into `crm-seed.js` so that loading
the file would leave a sentinel on disk.

**The first attempt was worthless.** The line went in before the shebang, which
pushed `#!` to line 2 and made the file unparsable. The check rejected it, the
sentinel was absent, and that proved only that files which cannot be parsed do
not run — which nobody doubted.

Redone with the line after the shebang, so the file parses cleanly: the check
passed 8 of 8, the sentinel stayed absent, **and a genuine `require()` of the
same file created it.** That control is what makes the claim mean anything. A
no-execution test without it is decoration, and it took writing the bad version
first to see that.

### Claim register

**C-97** added, `verified-approved`, no action required. Register stands at 97
claims, with **C-55 the only `needs-review` row**.

### Testing method

`npm test` — 25 checks, green on `accebf4`, re-run on `main` after the merge.
Every file touched by a negative test was restored and `git status` confirmed
clean before committing.

### Rollback

```
git revert accebf4 a9e9be4
```

Both are squashes; no `-m 1`. Reverting changes nothing a visitor sees.
Reverting `accebf4` returns the suite to 24 checks and leaves `build-geo.js`
unexercised again; reverting both also removes Deploy 17's entry.

### Known limitations shipped with this deploy

- **Parsing is not running, and the scripts that cannot safely be run stay
  unrun.** Not caught: a `require()` built at run time from a variable, a module
  that throws on load, a wrong argument, a missing environment variable. The
  docstring says so rather than implying coverage it does not have. Deploy 17's
  gap is narrower, not closed.
- **`build-geo.js` is parsed but still never executed locally**, and it is the
  one script Netlify runs on every deploy. The only proof it works is a
  production build succeeding — which, per the item below, has not been
  confirmed for any deploy in this document.
- **The two tooling-only dependencies are undeclared by decision, not by
  accident**, which means a fresh checkout cannot run either asset builder until
  someone installs Playwright and Pillow by hand. Nothing records that
  requirement except `TOOLING_ONLY` and this entry.
- **`LEADS_NOTIFY` is still unset**, carried since Deploy 11.
- **`/admin/analytics` still cannot be signed into**, open since 2026-09-17, and
  still the named blocker on C-90's Follow-pill counts.
- No Netlify build has been confirmed for this or any deploy in this document.
  With these two merges the count reaches 65.

---

## Deploy 19 — The streak breaks, and a document nobody meant to publish (PRs #130–#135)

**Date:** 2026-09-24
**Production commit:** `0ca7b3b`
**Previous recorded deploy:** `accebf4` (Deploy 18, PRs #128, #129)
**Delta:** 6 commits, 6 merged pull requests, 36 files changed (+552 / −118)
**Approval:** merge instructions given one at a time, each after its own report,
across two sessions three days apart.

### The merges

| PR | Substance | Visitor-facing |
| --- | --- | --- |
| #130 | Deploy 18's own entry. | no |
| #131 | The Netlify build confirmed from the owner's dashboard, after eighteen deploys of assuming it. | no |
| #132 | Internal documents removed from the deploy artifact. | no |
| #133 | Jar and can sizes published from supplier evidence; the jalapeño Red variant. | **yes** |
| #134 | Per-variety calibers replaced by the supplier's 140-360 range. | **yes** |
| #135 | The certifications sentence corrected to match. | **yes** |

`accebf4..0ca7b3b`. #130 is in this delta for the usual reason. One earlier
reference to `4b82c67` exists in outstanding item 5, but it cites the commit as
evidence for the build confirmation rather than claiming it in a delta — checked
before the boundary was set, because that is the double-count trap.

### Twenty-nine visitor-facing files

Deploy 18 measured the streak precisely and ended with *"the next thing worth
doing is on a page."* Eleven merges had passed since a reader could see anything
change. This deploy changes **29 files a visitor loads**, in both languages.

It is worth being accurate about why. Not initiative: the owner brought three
primary-source supplier documents and asked for the site to be corrected against
them. The observation in Deploy 18 was right, and it was not what broke the
streak.

### A security audit, served from the company's own domain

The largest finding of this deploy came from being asked *"what do you think we
should do?"* rather than from a task.

`netlify.toml` sets `publish = "."`, so the publish directory is the whole
repository. `robots.txt` disallows 28 specific paths and **none of them was
`/docs`**. So `olivesegypt.com/docs/security-audit-2026-09.md` was fetchable and
crawlable: a full security and functional audit of the public site and both
internal apps, sitting beside an access inventory, questions put to legal
counsel, a personal-data flow inventory, the claim register and this file. Four
root-level UI audits and `netlify.toml` itself — carrying the CSP, the security
headers and the full redirect map — went the same way.

**Nobody put them there.** `publish = "."` publishes whatever exists, so every
internal document written since the site was built shipped by default and would
have gone on shipping.

The owner asked for the strongest option: not served, not crawlable, not
fetchable under any circumstance. A Netlify publish directory has no exclude
list, so the only way to make a file genuinely unreachable is for it not to be
in the artifact. `scripts/prune-publish.js` runs last in the build and deletes
them; production returns a true 404 because the file is absent, not because a
rule intercepts it. Verified by reproducing the build against a copy of all 280
tracked files and inspecting the result: 16 internal paths gone, 14 sampled site
files present.

**Still open, and the one thing this deploy could not settle:** whether
`netlify/functions/*.js` is served as static source. It cannot be pruned — the
function bundler reads that directory after the build command runs — and this
environment cannot fetch the site to find out. One request to
`olivesegypt.com/netlify/functions/auth-login.js` answers it. Mitigating fact
established meanwhile: `_guide_token.js` derives its key by HMAC from
`SESSION_SECRET`, an environment variable, so the worst case is scheme
disclosure rather than credential exposure.

### Evidence that was not what it said it was

The supplier work began with three PDFs described as received from the supply
partner. They were **Triple Company's own outbound price offers** — its
letterhead, its head-office address, `sales@olivesegypt.com`, signed by the
General Manager, with a blank customer field. Zero occurrences of the named
supplier, its contact or its city in any of the three.

That was reported rather than used. A site citing its own sales document as
evidence for its own claims is circular, and it is the one thing the claim
register exists to prevent. The originals were then supplied, and the two sets
verified line for line: package formats, drained weights and case packs
identical in all three pairs.

One detail worth keeping. The sentence *"Packaging, caliber and case
configuration shown are indicative; exact specification is confirmed at
quotation"* appears only in Triple Company's version. **The supplier states the
packaging data flatly.**

**The supplier is not named anywhere in this repository**, at the owner's
instruction and on recommendation: it is public, and naming the company and its
contact individual would publish a third party's details to competitors. The
owner confirmed the source is the disclosed partner facility and asked that no
attribution appear on any page for now.

### What the evidence corrected, and what it exposed

Published in both languages: glass jars at 320, 370, 467, 720 and 1050 ml with
their case packs; tin cans at 65 mm, A9, A10 and A12; a 4 kg PET pail for sliced
jalapeño **only**, since the olive documents carry no PET line at all. Jalapeño
gained Red as a catalogue variant.

Two defects surfaced:

1. Both packaging pages said jars came in *"common sizes from 300g to 1.7kg"*.
   The largest drained weight the supplier quotes in any jar is **0.615 kg** —
   the published upper bound was nearly three times anything on offer.
2. **Reported wrongly first.** The homepages were recorded as agreeing with the
   new evidence. They did not. Both advertised glass jars at **1.5 L and 3 L**,
   which the supplier does not quote, and tin cans at 400 g, 850 g, 3 kg and
   5 kg, which match no can in the documents. All eight chips were superseded
   rather than incomplete. Checking instead of asserting is the only reason it
   was caught, and the register records the correction rather than the tidy
   version.

Blast radius measured rather than estimated: exactly four files on the site
stated a jar or can size. Every other surface names formats without them.

### A caliber decision, and what it cost

The owner asked twice for the per-variety grades to be replaced by the
supplier's generic 140-360, the second time after being shown the table of what
it would withdraw. **Toffahi, Manzanilla and Stuffed Green each stopped offering
101/110, 111/120 and 121/140** — three grades below the supplier's floor.
Manzanilla went from eight published grades to one range. Nothing published
exceeded 360.

297 caliber pairs across 23 files. That count includes the **product JSON-LD**,
where the range sits inside a description string as prose rather than as markup
— a chips-and-panels reading of "catalogue panels" would have missed it and left
the structured data contradicting the rendered page.

The first propagation pass reported success on seven files and **left 94 pairs
standing in three others**: the print sheets use a `.chip` class rather than the
`.font-mono` spans the product pages use, and Arabic writes the range as
`من X إلى Y`, which the English-shaped pattern did not match. Re-counting after
the run is the only reason that surfaced.

### Two branches whose conflict sides were both incomplete

#133 and #134 both edited the minified homepages, and their conflict sides were
complementary rather than competing:

| | jar `320 ml` | tin `65 mm` | `Caliber: 140-360` | old pairs |
| --- | --- | --- | --- | --- |
| #133's side | yes | yes | no | **8 left** |
| #134's side | no | no | yes | 0 |

**Neither contained both.** Picking a side would have silently dropped the
other, which is how C-77 and C-78 were lost in #105 — and it would have looked
like a clean resolution.

A hand-resolution was attempted and **rejected on evidence, having failed
twice**: it produced the wrong register row order, because the two branches were
cut either side of #132 and their tails differed, and it left **three
Organization JSON-LD blocks** on the homepage where there should be one.
`check-org-schema` caught the second; all three branches pass it individually,
so the splice caused it.

#134 was therefore **rebuilt on top of the merged main by re-running its
replacements**, which are deterministic regex passes and correct by construction
with no splicing. #133's own conflict against main — the register again, #132
having added C-99 after it was cut — was resolved by taking main wholesale and
re-applying the single row on top.

### A consequence flagged, then closed

Replacing the calibers made `/resources/certifications` false in both halves of
one sentence: it cited *"Aggizi at 141/160 through 231/260"* and promised those
ranges were *"published on each product page and in the export catalogue"*. The
example named a grade no page still offered, and the promise pointed at pages
saying something else.

It sat inside the category the owner had asked to leave alone, so #134 flagged
it rather than editing it. #135 closed it on their instruction. C-101 records
the closure **beside** the original flag rather than replacing it, so the
sequence stays legible: change made, consequence reported, owner decided,
consequence fixed.

### Claim register

C-99 through C-101 added; C-101 later closed. The register stands at **101
claims**, with **C-55 the only `needs-review` row**. Three rows in this deploy
record something the evidence did not support and the owner decided anyway — the
withdrawn caliber grades, the retained `Whole` jalapeño, and the unnamed
supplier — each attributed rather than absorbed.

### Testing method

`npm test` — 26 checks, green on `0ca7b3b`, re-run on `main` after every merge
rather than trusted from a branch.

*Corrected 2026-09-24:* this line and the two below it said **25 checks**. The
count went to 26 in this very deploy — PR #132 added
`check-publish-exclusions.js` — and the old number was carried forward into
Deploys 20 and 21 and into several pull request bodies before anyone counted.
Deploy 18 and earlier genuinely ran 25. The suites were green as recorded; only
the figure was stale.

Rendered geometry measured before and after for the packaging change. Build
simulation against a real copy of the tracked tree for the pruner. Byte-for-byte
barrel and bucket verification bounded to each card, after a first attempt whose
700-character window ran past the card and reported a false failure.

### Rollback

```
git revert 0ca7b3b 4811a4a 20b37c0 6d3f763 d1bd4e1 4b82c67
```

All six are squashes; no `-m 1`. Order matters: #133, #134 and #135 touch
overlapping files. Reverting `6d3f763` alone restores the document exposure and
should not be done without replacing it.

### Known limitations shipped with this deploy

- **Whether `netlify/functions/*.js` is served as static source is unresolved.**
  It cannot be pruned without breaking the bundle and cannot be checked from
  here.
- **Caliber pairs remain in twelve files by decision** — the explainer on both
  packaging pages, the how-to-import post, the certifications pages, both
  pricing pages and the four gated guides. They are about calibers rather than
  statements of what is sold.
- **`Whole` jalapeño is published on the owner's judgement**, not on this
  evidence: the supplier documents quote sliced only.
- **`LEADS_NOTIFY` is still unset**, carried since Deploy 11. With the build now
  confirmed, an enquiry submitted today is stored and seen by nobody.
- **`/admin/analytics` still cannot be signed into**, open since 2026-09-17.
- Individual builds for #132 to #135 are unobserved. The mechanism is confirmed
  (see outstanding item 5) but only one publish has ever been watched.

### Amendment, 2026-09-24: this deploy broke production

**PR #132 in the table above took the live site down, and it stayed down for
about a day.** The document exposure it fixed was real and the fix was right in
principle; putting `netlify.toml` on the pruner's delete list alongside `docs/`
and `scripts/` was not. Netlify reads redirects and headers from that file
*after* the build command runs, so deleting it removed every rule from the
deployed site. Deploy 21 below has the full account.

This amendment exists so that nobody reads Deploy 19 as a clean deploy. The
"Known limitations" list above was written on the assumption that the artifact
deployed the way the local simulation said it would, and the one thing the
simulation could not model — what Netlify does with the file after the build —
is exactly what failed.

---

## Deploy 20 — Two records, no visitor-facing change (PRs #136, #137)

**Date:** 2026-09-24
**Production commit:** `b4e4095`
**Previous recorded deploy:** `0ca7b3b` (Deploy 19, PRs #130–#135)
**Delta:** 2 commits, 2 merged pull requests, 2 files changed (+236 / −1), all
of it inside `docs/`
**Approval:** "merge 136" and "merge 137", each given after its own report.

### The merges

| PR | Substance | Visitor-facing |
| --- | --- | --- |
| #136 | The Deploy 19 record | No |
| #137 | The 2026-09-24 Google site-name re-check, against C-60 | No |

Both changed only `docs/`, which `scripts/prune-publish.js` removes from the
deploy artifact. **Nothing a visitor can reach changed in either language.**
Two builds ran and published, as every merge to `main` does; both published the
same site as `0ca7b3b`.

### The site-name re-check

C-60 closed on 2026-09-06 telling the owner to re-check the search result in
two to four weeks, and said that if it still showed the domain, the remaining
lever would be off-site. The owner re-checked on 2026-09-24, 18 days on: Google
still prints `olivesegypt.com` rather than the company name.

Three of the four checks requested could not be run at all, because
`validator.schema.org`, `olivesegypt.com`, `www.olivesegypt.com` and
`search.google.com` are unreachable from this environment. The row says so
plainly rather than presenting offline JSON-LD parsing as equivalent to a
validator run, and it does not claim the www or http redirect behaviour is
verified. **That restraint turned out to matter**: see Deploy 21, where the
unverified www result was reached while every redirect was missing from the
site, making it unreliable evidence rather than merely uncorroborated.

What was verified offline came back clean — exactly one `WebSite` node, four
JSON-LD blocks all parsing, the four naming signals in agreement, one canonical
matching `og:url`, a sitemap with one root entry and no `http://` URLs, and no
occurrence of `www.olivesegypt.com` anywhere in the tree. The external
reference count is one: the reciprocal Facebook profile.

### Claim register

No rows added. C-60's `evidence_source` and `action_required` were amended in
place; the now-spent "re-check in two to four weeks" instruction was replaced
with the three owner-side levers that remain. The register stayed at **101
claims**, with **C-55 the only `needs-review` row**.

### Testing method

`npm test` — 26 checks, green on `b4e4095`, re-run on `main` after the merge.
CSV structure re-validated through the `csv` module: 101 rows before and after,
six columns on every row, no duplicate ids.

### Rollback

```
git revert b4e4095 1d35b76
```

Both are squashes; no `-m 1`. Reverting either only removes documentation.

### Known limitations shipped with this deploy

- **The Google display is unchanged and no guarantee is made that it will
  change**, per Operating Rule 17. The on-site work is finished; the remaining
  levers are off-site and the owner's.
- Everything carried from Deploy 19 was still carried here, including the
  `netlify.toml` defect, which was live throughout this deploy and undetected.

---

## Deploy 21 — The outage, and the first production check in this project's history (PR #138)

**Date:** 2026-09-24
**Production commit:** `80b03b3`
**Previous recorded deploy:** `b4e4095` (Deploy 20, PRs #136, #137)
**Delta:** 1 commit, 1 merged pull request, 3 files changed (+48 / −2)
**Approval:** "merge 138", given after the diagnosis and the fix were reported
and the owner had confirmed the failure against the live domain themselves.

### What happened

PR #132, merged 2026-09-23 as part of Deploy 19, put `netlify.toml` on
`scripts/prune-publish.js`'s delete list. Netlify collects redirects and headers
from that file **after** the build command runs, and `publish = "."` makes the
publish directory the repository root — so deleting it during the build deleted
the only copy Netlify had left to read.

Everything in the file was inoperative for roughly a day:

| Lost | Consequence |
| --- | --- |
| All `/api/*` redirects | CRM and `/admin/analytics` unusable |
| `/netlify/*` forced 404 | Function sources fetchable as static files |
| Gated-download redirects | `/downloads/*` dead in both languages |
| SPA catch-all `/*` | Any non-file route returned Netlify's 404 |
| All security headers | `X-Frame-Options`, CSP, `X-Robots-Tag` not sent |

**This was introduced by this assistant**, in a PR that was implemented without
flagging that `netlify.toml` is load-bearing in a way `docs/` and `scripts/` are
not. It is recorded rather than quietly patched.

### How it surfaced, and what the missing nav bar proved

The owner reported the CRM dashboard at `/crm/` showing "Could not load
dashboard data." The diagnostic detail was not the error — it was **what else
was missing from the screenshot**: no nav bar, no enquiries card.

`CRM.requireAuth` in `assets/crm.js` redirects to the login page on a 401 and
otherwise calls `res.json()`. A 404 HTML body makes that throw a parse error;
the rejection is not the string `'unauthorized'`, so it reaches the page's final
`catch` — and because it threw *inside* `requireAuth`, `CRM.renderNav` and
`renderInbox` never ran. Every element of the screenshot was accounted for
before anything was changed.

### The first time production has been checked directly

`olivesegypt.com/api/crm/auth/me` returned **Netlify's own "Page not found"
page**. Not the homepage — so the SPA catch-all at the end of the file was gone
too, which is what established the loss as total rather than partial.

This is worth marking. Outstanding item 1 has said since Deploy 1 that no
deploy has ever been verified against actual production. This environment's
egress to the domain is still blocked, so the check was run by the owner in a
browser and reported back — but it is the first time in twenty-one deploys that
a production behaviour has been **observed rather than inferred** from source,
from a build log, or from a dashboard icon.

### The fix, and what it is not

`netlify.toml` comes off the prune list and is kept off the published site by a
forced 404 on `/netlify.toml`, reusing the mechanism `/netlify/*` already uses
rather than inventing one.

**This is weaker than what the rest of the prune list gets, and the owner had
explicitly chosen true absence over a 404 for those.** A file that configures
the deploy cannot also be missing from it. The comments in both
`scripts/prune-publish.js` and `netlify.toml` say that plainly instead of
implying the two are equivalent. `docs/`, `scripts/` and the four audit files
are unchanged and still genuinely deleted — that part of PR #132 was sound, and
true absence stays the standard wherever a file is not load-bearing.

### A check that was enforcing the bug

`scripts/check-publish-exclusions.js` previously **asserted `netlify.toml` was
absent**. The regression check written to protect the artifact was holding the
defect in place, and it passed green on every run while production was down.

It now asserts both halves of the fix — the pruner must not list the file, and
the forced 404 rule must exist — and both were proved by injection rather than
by passing:

| Injected fault | Result |
| --- | --- |
| `netlify.toml` put back on the prune list | **2 FAIL** — the new assertion and the site-intact check |
| Forced 404 rule deleted | **1 FAIL** — "the file would be fetchable at the domain" |
| Neither, as merged | **10 passed, 0 failed** |

The lesson is not that the check was wrong to exist. It is that a check
asserting a file's absence is only as good as the reason for that absence, and
nobody wrote down what `netlify.toml` was *for* before adding it to the list.

### Claim register

**C-102 added**, classified `defect-fixed`, carrying the cause, the live
confirmation, the full blast radius, the fix, the honest limit on the forced
404, and the attribution. The register stands at **102 claims**, with **C-55
still the only `needs-review` row**.

### Testing method

`npm test` — 26 checks, green on `80b03b3`, re-run on `main` after the merge.
Two negative tests by injection, listed above. Runtime dependencies of the
remaining pruned paths re-checked: the GeoLite2 database lives at repo-root
`geo/`, which is not on the list, and `netlify/`, `package.json` and
`package-lock.json` were already excluded by design.

### Rollback

```
git revert 80b03b3
```

A squash; no `-m 1`. **Do not revert this one.** Reverting it restores the
outage — it would put `netlify.toml` back on the prune list and strip the
deployed site of every redirect and header again.

### Known limitations shipped with this deploy

- **Recovery is not yet confirmed.** The fix is verified in the repository and
  by build simulation; whether the live site is serving again is the owner's
  check, listed in C-102's `action_required`. The record should not read as
  though recovery were established here.
- **Whether `netlify/functions/*.js` is served as static source is still
  unresolved**, and is now urgent rather than theoretical: the rule protecting
  that path was inoperative for a day.
- **Any conclusion about `www.olivesegypt.com` reached before 2026-09-24 is
  unreliable.** It was investigated while every redirect was missing, so the
  earlier reading — a missing Netlify domain alias — cannot be trusted and
  needs re-testing from a clean baseline.
- **`LEADS_NOTIFY` is still unset**, carried since Deploy 11.
- **`/admin/analytics` still cannot be signed into**, open since 2026-09-17, and
  was additionally unreachable for the duration of this outage.

### Amendment, 2026-09-24: three of the four recovery checks came back clean

Written while recovery was still unconfirmed. The owner has since checked the
live domain:

| Check | Result |
| --- | --- |
| `/crm/` | **Recovered** — redirects to the login page |
| `/api/crm/auth/me` | **Recovered**, proved by the above |
| `/downloads/*` | **Recovered** — a gated form submits again |
| `/netlify/functions/auth-login.js` | **Source not served**; status code still unverified |

The CRM check proves more than it looks. `CRM.requireAuth` in `assets/crm.js`
only redirects to the login page on a **401** — a 404 page would have produced
the error screen again. Landing on login therefore establishes the whole chain:
the redirect rule is restored, the function ran, and it answered with a proper
401. **The outage is over.**

The fourth is a narrower question than it first appeared, and the answer is
reassuring: `/netlify/functions/auth-login.js` serves the homepage, not
JavaScript source, because the rule is written `to = "/index.html", status =
404` — the body of the 404 is `index.html`. What is *not* established is
whether the status line really reads 404, or whether the rule is being bypassed
and the SPA catch-all is answering 200. The two are indistinguishable in a
browser without opening devtools. Either way the source is not exposed, which
is the part that mattered. Serving a whole homepage as a 404 body is a soft-404
pattern worth revisiting on its own; it is not this deploy's to fix.

---

## Deploy 22 — The record catches up (PR #139)

**Date:** 2026-09-24
**Production commit:** `2ef1393`
**Previous recorded deploy:** `80b03b3` (Deploy 21, PR #138)
**Delta:** 1 commit, 1 merged pull request, 2 files changed (+238 / −0)
**Approval:** "merge 139".

Documentation only, entirely inside `docs/`, which `scripts/prune-publish.js`
removes from the artifact. **Nothing a visitor can reach changed.**

C-102 was added for the outage, Deploys 20 and 21 were written up, Deploy 19
gained the amendment saying plainly that it broke production, and outstanding
item 1 was materially changed rather than annotated.

### Claim register

C-102 added. Register at **102 claims**, C-55 the only `needs-review` row.

### Testing method

`npm test` — 26 checks, green on `2ef1393`. Register re-parsed through the
`csv` module: 102 rows, six columns throughout, no duplicate ids. The diff on
the register is `+1 / −0`; a first attempt using `csv.writer` rewrote the whole
file and silently re-quoted seven unrelated rows, which was caught on the diff
shape and redone as a true append.

### Rollback

```
git revert 2ef1393
```

A squash; no `-m 1`. Removes documentation only.

---

## Deploy 23 — A form that blamed itself for the visitor's typo (PR #140)

**Date:** 2026-09-24
**Production commit:** `3e70e84`
**Previous recorded deploy:** `2ef1393` (Deploy 22, PR #139)
**Delta:** 1 commit, 1 merged pull request, 5 files changed (+185 / −8)
**Approval:** "merge 140".

`netlify/functions/leads.js` has always returned the exact fields it refused.
`assets/gated-download.js` threw that list away and showed "Something went
wrong. Please try again" for every failure that was not rate limiting — so a
buyer who mistyped their email was told the **site** was broken.

It surfaced by accident: a test submission using `mnjnmnm@jhjhj`, which has no
dot in the domain and is rejected at `leads.js:256`, looked exactly like the
outage that had just been fixed. That ambiguity was the bug, not a coincidence.

Five fields now carry their own wording in both locales. `source_page` and
`segment` deliberately do not — the page fills those in, so a rejection of
either is our fault, and a per-field message would blame the visitor for our
bug.

### One visitor-facing file, 116 pages

The strings live in the shared script, so both locales pick this up without a
single page file being edited. Only the failure path changes: the success path,
the guide token, the cookie fallback, the reveal, the rate-limit message and
the network-error message are untouched.

### Claim register

**C-103 added**, `defect-fixed`. Register at **103 claims**.

### Testing method

`npm test` — 27 checks, green on `3e70e84`. Thirty-two behavioural tests run
against the shipped file rather than a copy. `check-lead-validation-messages.js`
added, reading the real field names out of `leads.js` rather than keeping a
second list. Three negative tests by injection: a deleted Arabic message, a new
`vat_number` field server-side, and the unconditional generic message restored.

### A figure corrected in this deploy

The suite was **26 checks, not 25**. It went to 26 in Deploy 19 when PR #132
added `check-publish-exclusions.js`, and the stale number was carried into
Deploys 20 and 21 and several pull request bodies. Corrected at all three wrong
places, with a dated note at Deploy 19. Deploy 18's line was left alone: it
genuinely ran 25. The suites were green as recorded; only the figure was stale.

### Rollback

```
git revert 3e70e84
```

A squash; no `-m 1`. Restores the generic-only message.

### Known limitations shipped with this deploy

- **Not observed in a browser.** Verified in code and by test; this environment
  cannot reach the site.

---

## Deploy 24 — The theme was right, its position was not (PR #141)

**Date:** 2026-09-24
**Production commit:** `2eff5c3`
**Previous recorded deploy:** `3e70e84` (Deploy 23, PR #140)
**Delta:** 1 commit, 1 merged pull request, 83 files changed (+2291 / −2168)
**Approval:** "merge 141".

The owner reported that moving between pages kept switching between light and
dark. The theme script was not at fault — it is **byte-identical on all 80
pages** that carry it. Its position was.

It sat as the first element inside `<body>`, which is after the render-blocking
stylesheet in `<head>`. Every navigation therefore parsed the head, applied the
CSS, **painted the page in the light default**, then reached `<body>`, ran the
script, added `.dark` to `<html>` and **repainted**. The flicker was the page
being painted twice with different themes, on every page, every time.

Confirmed on a pretty-printed page — `contact/index.html`, `</head>` at line
90, `<body>` at 91, the script at 95 — and on the minified homepage by byte
offset.

### The large diff is a relocation, not a rewrite

Eighty pages, +2140 / −2140: the same lines, moved. Verified file by file
against the previous commit that with the script excised all 80 documents are
unchanged, that the script body is identical to the committed one, and that it
is still identical across all 80. Only its position moved.

### The generator caught what the pages did not

`scripts/generate-product-pages.py` needed the same move and did not get it at
first. `check-generator-parity.js` failed on all ten product pages — exactly
the drift C-93 exists to catch, and without it the flash would have returned
silently at the next regeneration.

### A check for something nothing else could see

All 80 copies of the script were byte-identical **and all 80 were in the wrong
place**, so no comparison of pages against each other could ever have found
this. `scripts/check-theme-no-flash.js` asserts the script is in `<head>`,
ahead of the first stylesheet, present once, and that the generator template
agrees.

A guard written for the migration itself was wrong and fired on all 80 files,
writing nothing: it compared whole documents before and after, which cannot
pass when the purpose of the change is to move a block. Removed; the remaining
checks already prove relocation-only.

### Claim register

**C-104 added**, `defect-fixed`. Register at **104 claims**, C-55 still the only
`needs-review` row.

### Testing method

`npm test` — 28 checks, green on `2eff5c3`. Three negative tests by injection:
one page restored to the old layout, the generator template restored alone, and
the script duplicated on a page.

### Rollback

```
git revert 2eff5c3
```

A squash; no `-m 1`. Restores the flash on every navigation.

### Known limitations shipped with this deploy

- **Not observed in a browser.** The absence of a flash is a visual property,
  and this is verified structurally rather than seen. If flicker remains, the
  diagnosis is incomplete rather than merely unconfirmed.
- The print and PDF sheets and the CRM and admin tools carry no theme script
  and were deliberately untouched.

---

## Deploy 25 — The record catches up again (PR #142)

**Date:** 2026-09-24
**Production commit:** `2aee35c`
**Previous recorded deploy:** `2eff5c3` (Deploy 24, PR #141)
**Delta:** 1 commit, 1 merged pull request, 2 files changed (+218 / −0)
**Approval:** "merge 142".

Documentation only, entirely inside `docs/`, which the pruner removes from the
artifact. **Nothing a visitor can reach changed.**

Deploys 22, 23 and 24 written up; C-103 and C-104 added; Deploy 21 amended to
record that three of its four recovery checks came back clean; outstanding item
1 updated again.

### Claim register

C-103 and C-104 added, both `defect-fixed`. Register at **104 claims**, C-55 the
only `needs-review` row.

### Testing method

`npm test` — 28 checks, green on `2aee35c`. Register re-parsed: 104 rows, six
columns throughout, no duplicate ids. Diff `+2 / −0` on the register, `+216 / −0`
on this file: append and insert only, nothing reworded.

### Rollback

```
git revert 2aee35c
```

A squash; no `-m 1`. Removes documentation only.

---

## Deploy 26 — Eighteen calls to a method that was never there (PR #143)

**Date:** 2026-09-25
**Production commit:** `d0324cf`
**Previous recorded deploy:** `2aee35c` (Deploy 25, PR #142)
**Delta:** 1 commit (2 before squash), 1 merged pull request, 14 files changed
(+249 / −33)
**Approval:** "merge 143", after the seven flagged doubles were fixed on the
owner's instruction — "fix them all if its a problem in the future".

The owner reported that dragging a Kanban card and saving an edit to an
existing buyer both answered "the database could not be reached". **The
database was healthy throughout.**

`neon()` returns a function. You query with it as a tagged template, or you
call it directly with text and a parameter array. It has exactly one property,
`transaction`. **It has no `query`.** Three functions called
`await sql.query(text, params)` anyway, so every one threw a `TypeError`.

| File | Calls | Broken since 2026-09-01 |
| --- | --- | --- |
| `crm-buyers.js` | 1 | Every buyer update — and so every Kanban drag, which is a PATCH to the same handler |
| `analytics-report.js` | 15 | The entire `/admin/analytics` report |
| `analytics-retention.js` | 2 | `purge()`, which enforces the retention window |

### The retention consequence, which this deploy does not close

`purge()` has been throwing rather than deleting since the day it shipped. **No
analytics row has ever been deleted by the scheduled job**, so personal
analytics data has accumulated past its stated retention period for three and a
half weeks.

The fix makes the job work from this deploy onward. It does nothing about the
backlog that built up, and that is a policy question for whoever holds C-55
rather than something a code change settles. It is recorded here and in C-105
so that it is not quietly absorbed into "fixed".

### Why the symptom named the wrong system

A `TypeError` carries no SQLSTATE, so `describeDbError` fell through to its last
branch and reported all of it as "the database could not be reached" — pointing
staff at the one component that was fine. That is half of why this lasted three
and a half weeks, and it is fixed: an error named `TypeError`, `ReferenceError`,
`SyntaxError` or `RangeError` carrying no code is now reported as a bug in this
code, with its message. A genuine connection failure still reads as one and
SQLSTATE errors are untouched, both asserted.

### Why the suite stayed green through all of it

**All eight test doubles carried a `.query` the real handle does not.** The fakes
accepted exactly what production rejected, so every check passed while the CRM,
the analytics report and the retention job were all broken.

A double more permissive than the object it stands in for cannot fail on the
mistake it most needs to catch. That is the durable lesson of this deploy, and
it is worth more than the eighteen-line fix: the suite was not merely silent
here, it was actively reassuring.

All eight lose it. `check-retention-guards.js`'s double also learns both real
call shapes, and it caught the fix mid-change when parameters came back nested
as `[[395,50000]]`.

### A check that holds both sides to the real driver

`scripts/check-neon-call-shapes.js` does not grep for the name already burned.
It builds a real handle from the real driver and checks **every method the
functions call** and **every method a double offers** against it, so `sql.end`,
`sql.unsafe` and `sql.begin` — all real in other Postgres clients — fail too.
Harness bookkeeping is allowed only when named with a reason; there is one,
`check-crm-documents.js`'s `fakeSql.statements`.

### Claim register

**C-105 added**, `defect-fixed`. Register at **105 claims**, C-55 still the only
`needs-review` row.

### Testing method

`npm test` — 29 checks, green on `d0324cf`. Verified against the installed
driver rather than from memory: `@neondatabase/serverless` 0.10.4,
`typeof sql.query` is `undefined`, the only own key is `transaction`, and the
package's own `index.d.ts` declares no `query` on `NeonQueryFunction`.

Proved by injection throughout: `sql.query` and `sql.unsafe` restored in
production code, `.query` restored on each of the seven remaining doubles in
turn (caught 7 of 7), an invented `.begin` caught with file and line, and the
error-message fix reverted.

### Rollback

```
git revert d0324cf
```

A squash; no `-m 1`. **Reverting restores the outage**: the CRM, the analytics
report and the retention purge all break again.

### Known limitations shipped with this deploy

- **Not observed in a browser.** Verified against the real driver, by test and
  by injection; the CRM and the analytics report have not been seen working.
- **The retention backlog is untouched**, as above.
- `/admin/analytics` sign-in remains a separate open item. This deploy fixes the
  report it renders, not the way in.

---

## Deploy 27 — The record catches up (PR #144)

**Date:** 2026-09-25
**Production commit:** `d7ec0b5`
**Previous recorded deploy:** `d0324cf` (Deploy 26, PR #143)
**Delta:** 1 commit, 1 merged pull request, 2 files changed (+166 / −0)
**Approval:** "merge 144".

Documentation only, inside `docs/`, which the pruner removes from the artifact.
**Nothing a visitor can reach changed.** Deploys 25 and 26 written up, C-105
added, and outstanding items 8 and 9 opened — the retention backlog, and the
fact that the suite passed green throughout a total CRM outage.

### Testing method

`npm test` — 29 checks, green on `d7ec0b5`. Register re-parsed: 105 rows, six
columns, no duplicate ids.

### Rollback

```
git revert d7ec0b5
```

Removes documentation only.

---

## Deploy 28 — A link that took staff out of the tool (PR #145)

**Date:** 2026-09-25
**Production commit:** `5998d0f`
**Previous recorded deploy:** `d7ec0b5` (Deploy 27, PR #144)
**Delta:** 1 commit (2 before squash), 1 merged pull request, 6 files changed
(+173 / −6)
**Approval:** "merge 145", after the Arabic sheet was added to the nav on the
owner's instruction mid-review.

Four of `CRM.NAV`'s five entries were `/crm/` pages carrying the shared header.
Letterhead was not a CRM page at all — a print sheet at a public URL, with no
CRM script because a CRM header would print — and it offered a link to `/`.
Nothing on the website links there and `robots.txt` disallows it, so the only
arrivals were staff who had just clicked Letterhead in the nav. The link did
exactly one thing: take somebody mid-task out of the tool they were working in.

Both sheets now return to the dashboard. `Letterhead (AR)` was added to the nav
on the owner's instruction, noted in the code against the "four places, not ten
links" rule that would have made a language variant a toggle instead.

### A finding first reported wrongly

`/ar/letterhead` was described as having **no** back link. It had one, written
with a right arrow as RTL requires, and a search for the left one missed it.
The Arabic sheet carried the same fault as the English one rather than nothing
at all.

### An existing check was part of why this lasted

`check-locale-links.js` recognised a mapped public route or a plain file, but
**not a directory holding an `index.html`** — so a link into `/crm/` read as
broken although `crm/index.html` is right there. **The honest fix looked like
it broke the build.** A third case was added, and the checker still catches a
genuinely missing route.

### Claim register

**C-106 added**, `defect-fixed`.

### Testing method

`npm test` — 30 checks, green on `5998d0f`. Five negative tests by injection,
including a new nav entry pointing at a print sheet with no way back, which is
what proves this guards the *next* entry rather than only the one already wrong.

### Rollback

```
git revert 5998d0f
```

Restores the back links to the public site and removes the Arabic sheet from
the nav.

---

## Deploy 29 — The company field, and a page that reports rather than fixes (PR #146)

**Date:** 2026-09-25
**Production commit:** `c82cb86`
**Previous recorded deploy:** `5998d0f` (Deploy 28, PR #145)
**Delta:** 1 commit, 1 merged pull request, 8 files changed (+565 / −8)
**Approval:** "merge 146 and 147", after the locations and threshold were
confirmed as the brief required.

Item 2 of the owner's Batch 1. `company_name` accepted anything two characters
or longer, and the records showed what that let through: `Dr` as a company, and
people's names in the field meant for their employer.

Two severities, and the line between them is the design: **reject** refuses on
save only where being wrong is close to impossible; **review** flags for a
person and never blocks. `Olivex` is a single bare word and a good company
name — refusing it to catch `Abdelrahman` would teach staff to fight the form.

`/crm/data-quality` reports and changes nothing: no bulk fix, GET only, no
`UPDATE`, `INSERT` or `DELETE`, all asserted. That was the owner's instruction
and it is also right — guessing what `Dr` was meant to say would replace a
visible problem with an invisible one.

### What this deploy could not do

**The flagged list itself has never been produced.** It needs the live
database, which this environment cannot reach. That is precisely why the owner
asked for the scan as a page: it runs where the data is.

### Claim register

**C-107 added**, `defect-fixed`.

### Testing method

`npm test` — 31 checks, green on `c82cb86`. The check requires the rules from
`_crm_lib.js` rather than restating them. Four negative tests by injection,
including a write added to the review endpoint and a Fix All button on the
page — the two ways the read-only promise could quietly be broken.

### Rollback

```
git revert c82cb86
```

Restores the permissive field and removes the review page.

---

## Deploy 30 — Percentages that stopped implying more than they knew (PR #147)

**Date:** 2026-09-25
**Production commit:** `f8d3425`
**Previous recorded deploy:** `c82cb86` (Deploy 29, PR #146)
**Delta:** 1 commit (2 before squash), 1 merged pull request, 5 files changed
(+296 / −6)
**Approval:** "merge 146 and 147".

Item 4 of Batch 1. A percentage implies a measured rate; "33.3%" off three
buyers is one buyer. Below a floor of 10 the figures now show what they are
drawn from.

Two places are **deliberately exempt**, both named in the check with written
reasons: bar widths, which are a drawing instruction rather than a claim about
a population, and `fmtKpiValue`, which renders figures the owner types in with
a declared unit and has no denominator to threshold.

### The merge conflicted, and the resolution is the point

Deploys 29 and 30 both added a check to the same chain in `package.json`.
Resolved the way this repository resolves these: **take `main`'s file whole,
re-apply this branch's single change on top**, rather than editing inside the
markers or taking one side and losing the other. Verified the result carried
*both* checks rather than one silently winning — which is the failure mode the
pattern exists to prevent.

### A negative test found a hole in the check itself

The first version accepted any `SmallSample` call within three lines, so **a
bare percentage inserted directly above a genuine one passed**. The guard now
walks up only through continuation lines, so it must belong to the same
expression.

### Claim register

**C-108 added**, `defect-fixed`.

### Testing method

`npm test` — 32 checks, green on `f8d3425`.

### Rollback

```
git revert f8d3425
```

Restores bare percentages at any sample size.

---

## Deploy 31 — A rule that looked right and blocked real customers (PR #148)

**Date:** 2026-09-25
**Production commit:** `6b9cae0`
**Previous recorded deploy:** `f8d3425` (Deploy 30, PR #147)
**Delta:** 1 commit, 1 merged pull request, 2 files changed (+53 / −8)
**Approval:** "merge 148", after the limitation was explained in plain terms at
the owner's request.

The company-name floor shipped in Deploy 29 was three characters. It caught
`Dr` — and took **BP, 3M, LG and GE** with it. A buyer from any of those could
not have been saved at all. It also caught `Dr` **for the wrong reason**,
reporting "too short" when the person had typed a title into the company field.

Both faults were one cause: **a length check standing in for a rule about
meaning.** The title rules recognise `Dr`, `Mr`, `Ms`, `dr.` and the Arabic
forms unaided — proved before anything was changed — so they now run first and
the length rule refuses a single character only.

No exception list: an allow-list would need somebody to remember to add `HP`
the day one appears, and this has no such failure mode.

A cost taken deliberately and written into the code: a careless two-character
entry like `qq` is no longer refused at the form, only flagged on the review
page. Blocking real companies to catch that is the worse trade.

### A judgement not to tighten, which turned out to matter

`Egypt future` was raised as a suspect value during the assessment, and the
rules pass it. The owner confirmed 2026-09-25 that **it is a company name**.
Had the rules been contorted to catch it while it looked wrong, they would now
be blocking a genuine customer — the same mistake the three-character floor
made, in the same deploy.

### Claim register

No new row. C-107 carries this, because the rule and its correction are one
claim about one field rather than two.

### Testing method

`npm test` — 32 checks, green on `6b9cae0`. The four short names are now a
regression, and each title is asserted to be refused **as** a title rather than
by something that happens to reject it — rule ordering is easy to undo by
accident. Restoring the three-character floor fails four assertions.

### Rollback

```
git revert 6b9cae0
```

Restores the three-character floor, and with it the block on two-letter
companies.

### Known limitations shipped with Deploys 28 to 31

- **None of it has been observed in a browser.** This environment cannot reach
  the site; everything is verified in code, by test and by injection.
- **Batch 1 items 1 and 3 are not in any of these deploys.** Item 1 is a
  Netlify dashboard change and rests on `NOTIFY_EMAIL` rather than
  `LEADS_NOTIFY`, which was this assistant's error to correct. Item 3 had no
  code in it: there was no default follow-up date to remove.

---

## Deploy 32 — A table that answered a different question from its heading (PR #150)

**Date:** 2026-09-25
**Production commit:** `33cce4d`
**Previous recorded deploy:** `6b9cae0` (Deploy 31, PR #148)
**Delta:** 1 commit, 1 merged pull request, 3 files changed (+164 / −6)
**Approval:** "merge 150", after the owner sent a screenshot of the dashboard's
stage table asking "are these in the right order?" and answered "yes fix all
three".

They were not in order, and the labels described the opposite of the number.

- **Order.** The query has no outer `ORDER BY`, so rows arrived in whatever
  order the aggregate produced, and that could change between runs.
  `stageOrderIndex` had been in `crm/index.html` since it was written and was
  never called. It is now, on a copy of the rows.
- **Label.** Each history row is a move *to* a stage, and `LEAD()` finds the
  next move, so the figure is time **spent in** a stage. The headings said
  "Average Time to Reach Each Stage" / "Avg. Days To Get There", which is a
  different question: one tells you your cycle length, the other where deals
  stall. They now read "Average Time Spent in Each Stage" / "Avg. Days In Stage".
- **Missing stages.** Only stages somebody has already left can appear. That
  is correct, because counting the current stage as zero days would drag every
  average down, but the table now says so rather than looking broken.

### Claim register

**C-109 added**, `defect-fixed`. It was not written at merge time and is
added now.

### Testing method

`npm test` — 33 checks, green on `33cce4d`. `check-stage-table.js` guards the
pairing of query and label, not the pieces separately: if the query ever
measures something else, the new labels would be wrong in the other direction.
Four injected regressions were each caught.

### Rollback

```
git revert 33cce4d
```

---

## Deploys 33 to 37 — One approval, five merges, in the order given

**Date:** 2026-09-26, all five between 12:31:38 and 12:34:25 +0300
**Approval:** "merge 155 then the rest".

| Deploy | PR | Production commit | Files | Lines | Checks on that commit |
|---|---|---|---|---|---|
| 33 | #155 | `e0400c5` | 4 | +90 / −3 | 34 |
| 34 | #151 | `47660b4` | 3 | +129 / −1 | 35 |
| 35 | #152 | `0023eb6` | 5 | +228 / −3 | 36 |
| 36 | #153 | `d80ee36` | 12 | +910 / −100 | 37 |
| 37 | #154 | `6eae97b` | 4 | +141 / −3 | 38 |

Previous recorded deploy: `33cce4d` (Deploy 32).

**The order was the owner's, and it mattered.** #155 had to land before #153,
because #153 tags Kalamata enquiries and until #155 the buyer page had no
Kalamata checkbox, so saving such a buyer would have dropped the tag.

**Every merge after the first conflicted.** All five PRs added a check to the
end of the same `npm test` line. Each was resolved the way this repository
resolves these: take `main`'s `package.json` whole, re-apply the branch's one
change, and assert that no check from either side was lost. Before each push
the full suite ran on the merged tree, not on the branch as reviewed.

**#153 also conflicted in real code.** #152 and #153 both changed
`inquiries.js`: #152 added a `session_id` column and value, and #153 added two
columns and `RETURNING id` to the same insert. Both sides were kept. Because
the combined function had never existed on either branch, it was run against
a real PostgreSQL 16 before pushing, not only against the suite's stubs. That
run passed 27 scenarios, including an enquiry carrying a session id that was
both stored and put into the pipeline, and an Arabic Kalamata request tagged
correctly.

### Deploy 33 — Kalamata back in the CRM (PR #155)

Kalamata was removed from the site on 2026-09-01 and from the CRM with it. It
returned on 2026-09-05, approved field by field (C-01 to C-09), and **the CRM
was never told.** So the public contact form offered Kalamata while staff could
not tag a Kalamata buyer or put it on a document, and `crm-buyers.js` silently
dropped it from any save. The comment excusing the gap cited "Rule 12", which
in this repository's own docs is the rule against machine-translated copy. It
is now at position 2 in both lists, per C-17. Private label, where Kalamata is
still excluded (C-40), is not touched. `check-crm-products.js` holds both CRM
lists to the site's own product set. **C-110.**

### Deploy 34 — Facebook clicks recorded where C-90 said to read them (PR #151)

`assets/analytics.js` fired `facebook_click` into the first-party pipeline,
which answered every one with a 400, because the type was never on its
allowlist. Nothing reported the error. Umami still received the clicks through
the separate `trackEvent` path. **But C-90 names `/admin/analytics` as where
the Follow-pill counts are to be read, and that report held none.** The "check
back in a few weeks" in C-90 therefore starts at this deploy, and C-90 now says
so. `check-event-types.js` fails if the site fires a type the server refuses,
or the server accepts one nothing fires. **C-111.**

### Deploy 35 — An enquiry knows which visit it came from (PR #152)

An enquiry now carries the analytics `session_id` of the visit that sent it,
so a quote or sample request can be tied to how the visitor arrived (organic
search, a referrer, a campaign). There are three rules, each tested by running
code rather than reading it:

1. There is no id without analytics consent.
2. The form never *creates* a session.
3. A malformed id is dropped, never allowed to refuse the enquiry.

The column is deliberately not a foreign key, because sessions are purged on
their own schedule. **Nothing reads it back yet:** attribution is now possible
from this deploy onwards, and no report does it. **C-112, `needs-review`**,
because it links an identified record to a browsing session, and the privacy
notice has not been updated to say so. That sits with whoever holds C-55.

### Deploy 36 — Every website request goes into the pipeline (PR #153)

Quote, sample, catalogue, documents, private-label and local-pricing requests
used to stop in the Enquiries inbox. Each is now added to the pipeline as it
arrives.

**The owner decided three things on 2026-09-26:**
- A quote request is a **Lead flagged "Send quotation"**, with no new stage.
- The missing **real regions** are added: Europe (non-EU), South America and
  Oceania, plus Unassigned.
- A **known buyer** has the request logged and moves **forward only**.

**The assistant decided three things in building it, and these are not yet
confirmed:**
- how transcontinental countries are placed
- the next action is due the day after the enquiry
- the wording of each next action

These are **C-114, `needs-review`**. "Due tomorrow" rests on the site's
promise of a reply within 24 hours, and that promise turned out never to have
been registered. It is **C-115, unverified**.

The enquiry is saved before intake runs, and intake cannot undo it. Every
pipeline write is one statement, so a failure leaves no half-made buyer, and
the inbox shows the reason on that enquiry. Stages, regions and the buyer
tables moved into `_crm_lib.js`, so they are defined once. The move was
confirmed byte-identical apart from one comment line. **C-113.**

**The check this deploy most depended on had a blind spot, now closed.**
`check-crm-schema.js` passed a request whenever it did not return 500. The
enquiry endpoint deliberately returns 200 when intake fails, because the
enquiry itself was saved, so a missing table there would have been invisible.
It now fails on any read of an uncreated table, whatever the status. It also
learned that a `WITH` clause's names are not tables. A second stub, in
`check-inquiries-access.js`, answered `INSERT … RETURNING` with nothing, which
Postgres never does. It now returns the row.

### Deploy 37 — Region checked on edit, and a refusal says why (PR #154)

The region was checked on create only. An edit could store any text as a
region, matching no dropdown or filter, or store null, which the column then
refused as a database error. It is now checked whenever a save sends one. A
Kanban drag sends only the stage, so old records stay movable.

**Found while fixing it:** the buyer page had never shown *why* a save was
refused. It read `data.error || 'Validation failed.' + fields`. The server
always sends `error`, so the field list never appeared, and neither did the
reasons Deploy 29 wrote for the company-name rules. Staff saw "Validation
failed" and nothing else. Each refused field is now named by its label, with
the server's reason. **C-116.**

### Claim register

**C-110 to C-116 added**, with C-109 for Deploy 32 above, and a dated note on
C-90. The register now stands at **116 claims**. **Three rows are
`needs-review`**, where C-55 used to be the only one:
- **C-55:** contact-data retention, unchanged.
- **C-112:** the enquiry-to-session link and the privacy notice.
- **C-114:** the assistant's judgement calls in building intake.

C-115 is `unverified`: the 24-hour reply promise, registered for the first
time.

**Updated 2026-09-27: the owner answered all three.**
- **C-112:** disclose the link, and re-ask everyone. PR #157 does both.
- **C-114:** confirmed, except that Turkey now goes to Unassigned. PR #158
  does this.
- **C-115:** both wordings confirmed as published.

All three rows are now `verified-approved`. **C-117 was added, `needs-review`:**
`/privacy` has never mentioned that a consenting visitor's IP address is used
to look up the owner of their network. This was found while writing the C-112
disclosure. It is pre-existing and was not approved for fixing. The register
now stands at 117 claims, and C-55 and C-117 are the `needs-review` rows.
**Later the same day, the owner answered C-117 too ("yes describe it").** The
disclosure was added to PR #157, so one policy-version bump covers both
changes, and C-117 is now `verified-approved`. **C-55 is again the only
`needs-review` row.**

### Testing method

`npm test` green on every production commit in the table above (34 → 38
checks), run on the merged tree before each push. Every new check was
negative-tested by reverting its fix and confirming the failure:

- Deploy 33: Kalamata missing from both lists, and a wrong label.
- Deploy 34: the original 400 reproduced at `analytics.js:115`.
- Deploy 35: nine injected faults, including removing the consent gate,
  switching to `getSession`, and refusing a bad id.
- Deploy 36: eight injected faults. One of them, removing the explicit
  Lost/Stalled guard, changed nothing, because forward-only already blocks it.
  It was recorded as a redundant guard, not a gap.
- Deploy 37: the old create-only rule (an edit to "Narnia" saved with 200
  again), and the old display.

Deploy 36 was also run by hand against a local PostgreSQL 16, through the real
handler: 25 scenarios on the branch, and 27 on the merged code.

### Rollback

Revert in reverse order, because Deploy 36 builds on Deploy 35's
`inquiries.js`:

```
git revert 6eae97b d80ee36 0023eb6 47660b4 e0400c5
```

Individually:
- **Deploy 37** restores create-only region checking and the bare "Validation
  failed".
- **Deploy 36** stops intake. Buyers it created stay, as normal records. The
  `buyer_id` and `pipeline_note` columns are nullable and can stay. Buyers
  given a new region keep it, which the older code accepts on edit.
- **Deploy 35** stops sending the id. The column can stay.
- **Deploy 34** returns `facebook_click` to a 400.
- **Deploy 33** hides Kalamata from the checkboxes again. Existing tags stay
  in the database.

### Known limitations shipped with Deploys 32 to 37

- **None of it has been observed in a browser or against production data.**
  This environment cannot reach the site. The owner's first sample request is
  the live test: it should appear in `/crm/inquiries` as "In pipeline", and the
  buyer should be in Sample Requested with a next action due the next day.
  **Observed 2026-09-27:** the owner sent a test sample request through the
  production site and reports it working. This is the first sight of intake on
  production. The report was "working fine", not a field-by-field comparison,
  so it is recorded as that.
- **Enquiries from before Deploy 36 are not in the pipeline.** The inbox marks
  them "Received before automatic intake". A back-fill was offered, not done.
- **An anonymous visitor can now cause a CRM record to be created.** They
  cannot choose its stage or fields. The honeypot, the 5-per-hour rate limit
  and the company-name rules all apply first, and every such record is
  `created_by = website`.
- **Gated guide downloads (`leads.js`) have neither the session link nor
  pipeline intake.** Both were out of the scope approved.

---

## Deploys 38 to 40 — The owner's answers, shipped (PRs #157, #158, #156)

**Date:** 2026-09-27, all three between 04:08:04 and 04:08:11 +0300
**Approval:** "merge 157 158 and 156".
**Previous recorded deploy:** `6eae97b` (Deploy 37, PR #154)

| Deploy | PR | Production commit | Files | Lines |
|---|---|---|---|---|
| 38 | #157 | `c8259aa` | 6 | +120 / −8 |
| 39 | #158 | `195d2aa` | 2 | +17 / −7 |
| 40 | #156 | `cb4484f` | 2 | +302 / −1 |

All three branched from `6eae97b` and touch different files, so none
conflicted. This is the first multi-merge batch in this record where that
was true.

### Deploy 38 — What analytics consent now covers, said before it is asked for (PR #157)

**This is the only deploy in this record that a returning visitor will
notice.** `POLICY_VERSION` changed from `2026-09-01` to `2026-09-27`. A consent
stored under another version reads as none, so everyone who had answered the
cookie banner sees it once more.

It carries three owner decisions from 2026-09-27:

1. **C-112: disclose the enquiry link.** A new section on `/privacy` and
   `/ar/privacy` states what a consenting visitor's enquiry is linked to. It
   includes the uncomfortable part: the browser's analytics identifier
   persists, so their *other* visits from that browser can be linked too.
2. **Re-ask everyone, and link only consent given under the new text.** The
   owner chose this from three options. The version bump alone enforces it:
   `TC.currentSessionId()` returns null until the visitor answers again.
   **Links made between Deploy 35 and this deploy were not cleared**, and the
   owner was told so.
3. **C-117: describe the network-owner lookup.** For every consenting
   visitor, the site has been sending their IP address to the regional
   internet registry to learn who the network is registered to. `/privacy`
   never said so, and never listed the registries as a third party. It now
   does both.

**Two sentences that had become untrue were corrected in the same change:**
- "never who pressed it" was no longer true for anyone who goes on to send an
  enquiry.
- The CRM was described as "a separate internal system from the
  form-submission data", which Deploy 36 had made untrue.

**Why decision 3 rode in this PR rather than its own.** It edits the same
paragraph as decision 1, so two PRs would have conflicted. And each is a
change to what consent covers, so shipping them apart would have meant
bumping the version twice and showing every visitor the banner twice.

**The Arabic wording of all of it is the assistant's.** The owner was asked to
read it before merging, and was reminded after. **Whether they did is not
stated.** Until they say so, it has the standing C-72's Arabic had before the
owner reviewed that one, and C-112 and C-117 say so in `action_required`.
**Settled later on 2026-09-27:** the owner read the live `/ar/privacy` and
confirmed it ("its fine"). No change was needed, and C-112 and C-117 now have
no open action.

`check-privacy-disclosures.js` (new) ties the privacy text to the code in both
directions. While `resolveOrg` is called, both pages must describe the lookup
and name the registries. And the pages' storage promises must still match
`_b2b_lib.js`: only a one-way hash is kept, for 30 days. A cache lifetime
changed to 90 days was caught.

### Deploy 39 — Turkey left for a person to judge (PR #158)

C-114 was confirmed by the owner except for Turkey. Turkey is a table-olive
exporter, so an enquiry from there is as likely to come from a competitor or
trading partner as from a buyer. Turkey, Türkiye and تركيا now arrive
Unassigned rather than as Middle East. This is recorded in the code under
its own heading, because Turkey's region is not in doubt the way "Georgia"
is. Brazil is confirmed in South America. Only future enquiries are affected.

### Deploy 40 — The record for Deploys 32 to 37 (PR #156)

Documentation only, inside `docs/`, which the pruner removes from the
artifact. Nothing a visitor can reach changed. It contains:
- Deploys 32 to 37
- C-109 to C-117
- the dated note on C-90
- the owner's answers to C-112, C-114, C-115 and C-117, recorded as they
  came in.

### Claim register

No new rows. **C-112, C-114 and C-117 are updated** now that the PRs they
waited on have merged:
- **C-114:** nothing left to do.
- **C-112 and C-117:** the only open action is the owner's review of the
  Arabic.

The register stands at 117 claims. **C-55 is the only `needs-review` row.**

### Testing method

`npm test` passed with all 39 checks on `cb4484f`, the final tip. Each
branch's own tree was also green before merge:
- #157: 39 checks.
- #158: 38 checks. It branched before the privacy check existed.

`195d2aa` was not run on its own. Its code is identical to `cb4484f`'s, since
Deploy 40 changed only `docs/`, so the tip's run covers it.

**Negative tests, each caught:**
- Deploy 38:
  - the old policy version
  - `main`'s `/privacy`
  - `main`'s `/ar/privacy`
  - a 90-day cache lifetime.
- Deploy 39: Turkey restored to Middle East.

### Rollback

```
git revert cb4484f 195d2aa c8259aa
```

- **Deploy 38:** reverting brings back the undisclosed practices, the two
  untrue sentences and version `2026-09-01`. Visitors who answered under
  `2026-09-27` would be asked once more.
- **Deploy 39:** reverting sends Turkey to Middle East again.
- **Deploy 40:** reverting removes documentation only.

### Known limitations shipped with Deploys 38 to 40

- ~~The re-shown banner has not been seen.~~ **Observed 2026-09-27:** the
  owner opened the site in a browser that had already answered, and the
  banner appeared again.
- ~~The Arabic privacy wording's review status is unknown~~. The owner
  confirmed it the same day (see Deploy 38).
- **Enquiries linked before this deploy stay linked**, under consent given
  before the text described the link. The owner may ask for them to be
  cleared; nobody has.

---

## Deploys 41 to 43 — A diagnosis that started from the wrong error (PRs #160, #161, #162)

**Date:** 2026-09-27, between 04:58:51 and 05:00:21 +0300
**Approval:** "merge 160 161 and 162".
**Previous recorded deploy:** `cb4484f` (Deploy 40, PR #156)

| Deploy | PR | Production commit | Files | Lines | Checks on that commit |
|---|---|---|---|---|---|
| 41 | #160 | `151936e` | 11 | +299 / −25 | 40 |
| 42 | #161 | `4e04db1` | 8 | +212 / −7 | 41 |
| 43 | #162 | `92c4331` | 16 | +402 / −2 | 42 |

`7cc8b26` (#159, the record for Deploys 38 to 40) merged six minutes after
Deploy 43. That makes it Deploy 44. It is documentation only and will be
recorded with the next batch, the same way Deploy 40 was recorded here.

### How it started

The owner sent a brief headed "DIAGNOSE AND FIX: THE DATABASE COULD NOT BE
REACHED ON BUYER/INQUIRY DELETE". Given September's outage, it asked for a
full root cause rather than a patch, and it asked for read-only diagnosis
until the cause was known.

**The diagnosis went down the wrong path first, and that is worth recording.**
The brief's message led to a thorough investigation of the database path:

- The driver version was pinned and correct.
- `sql(text, params)` is valid in 0.10.4, so this was not a September-style
  missing method.
- Every CRM write passed through the **real** Neon driver against a real
  PostgreSQL 16, using a local stand-in for Neon's HTTP endpoint.
- Failure injection showed that three different infrastructure faults all
  produce the identical "could not be reached" message.

None of that was wrong. It was simply about a failure that had not happened.

**The owner's screenshot changed the answer.** It showed a red **"Not found"**
under the delete confirmation dialog, not "could not be reached". In the delete
code, "Not found" means the buyer exists but is **already deleted**. The page
had loaded buyer 12 without error, so buyer 12 existed. The first Delete had
worked.

When the owner said "it's still there", that first read as a contradiction,
because the Buyers list cannot show a deleted buyer. One direct question
settled it: the address came from the page already open, not from the list.
The work was paused while that was asked. It was committed as marked
work-in-progress when a hook required it, with the failing check named in the
commit message.

**Lesson:** the exact text on the screen was worth more than any amount of
investigation of the reported text. Ask for the screenshot first.

### Deploy 41 — A deleted buyer shown as deleted (PR #160)

**Root cause.** A deleted buyer was hidden from the list and treated as live
everywhere else:

- A successful delete showed nothing; it was a bare redirect.
- The Enquiries inbox still said "In pipeline →" and linked to the deleted
  buyer.
- The buyer page opened the deleted record exactly like a live one.
- A second Delete said "Not found".
- Worse, Save and Add Note on a deleted buyer **succeeded silently**, changing
  a record that no list, board or report would ever show. That was reproduced
  with the real driver.

**Fix:**

- **Server:** a delete, edit or note on a deleted buyer now answers 409 with a
  plain reason, e.g. "This buyer was deleted on 2026-09-27…".
- **Buyer page:** a deleted record opens read-only, titled "(deleted)", with a
  lasting notice.
- **Buyers list:** confirms a delete with "Deleted "<name>"…".
- **Enquiries inbox:** says "Buyer deleted <date> · View record" instead of
  "In pipeline →".

**Observed live, 2026-09-27.** The owner opened `/crm/buyer/?id=12`: it showed
"test123 (deleted)", read-only, with no Delete or Save button.

### Deploy 42 — Pages that went silent when a request died (PR #161)

This was one of the Step 3 findings. The owner asked for it to be fixed.

When a request ended without a readable reply (a dropped connection, or a
timeout's HTML error page), most write actions caught the failure and said
nothing. The page gave no sign that anything had gone wrong.

The actions affected, and what staff saw:
- **Saving a buyer:** the button came back, nothing else.
- **Creating a buyer:** the same.
- **Adding a note:** there was no handler at all.
- **Creating a document:** the button came back, nothing else.
- **The CSV import:** the same.
- **A Kanban move:** the card snapped back, which was a guess.
- **Voiding a document:** nothing was said even when the server *refused* the
  void.

`CRM.noReplyMessage` now says the outcome is **unknown**. Saying "it failed"
would be as untrue as silence, because the server may have finished the work.
It then gives the safe next step:

- **After an edit:** saving again is harmless.
- **After creating a buyer, creating a document or an import:** check the list
  first, so nothing is added twice.
- **After a Kanban move:** the board reloads from the server, which knows
  where the card really is.

The two actions the owner had not listed (the note, and voiding) were found by
a check that scans every write call on every page rather than working from a
list. Against `main` it flagged all seven.

The check also had to be corrected once. A negative test showed it missed a
write that is split across a multi-line `? :` expression.

### Deploy 43 — Failures reach a person, not only the log (PR #162)

This was the other Step 3 finding. Every CRM function logged failures to
Netlify and told nobody. `_failure_lib.js` `reportFailure()` is now called from
every error handler that logs a failure:

- all nine CRM functions
- website enquiries
- pipeline intake
- guide-download leads and their opt-out check

It uses two channels, because each covers what the other cannot:

1. **The CRM dashboard.** A "Something failed: N operations in the last 7
   days" card sits above everything else. It works with no setup. It cannot
   record the database itself being down, because recording needs the
   database.
2. **An email** through the existing notification path. It needs no
   database, so it covers that outage, and it says it could not record the
   failure. It is throttled to one email per 15 minutes per function instance.
   **It delivers nothing until `NOTIFY_EMAIL` and `RESEND_API_KEY` are set**
   (see outstanding item 10).

The check scans every error handler. Its first version **silently missed two
functions** that log with template literals. It now names each function, so
a scan that stops seeing one fails.

**Observed live, 2026-09-27.** After the deploy, the owner reports no
"Something failed" card on the dashboard. That means no recorded CRM failure
since the deploy, and no false alarm from the new code. It is evidence the
card stays quiet when nothing fails. It is **not** evidence the card appears
when something does; that was verified locally only.

### The merges

**`package.json`.** Every merge after the first conflicted on the `npm test`
line. Each was resolved by taking `main`'s file whole and re-applying the
branch's one change, with a script that asserts no check from either side was
lost.

**Shared files that merged without conflict.** Several files were changed by
more than one PR:
- `crm/buyer/index.html` by #160 and #161
- `crm-buyers.js`, `crm-activity.js` and `inquiries.js` by #160 and #162

Git merged these automatically. That was not trusted:
- Both PRs' checks were re-run on each combined file.
- Before #162 was pushed, the combined code was run against the real driver
  and PostgreSQL. Every CRM write passed, and the test123 sequence behaved as
  #160 intended.

One assertion in that last run was written so that it could not fail. It was
reported as proving nothing and is not counted here.

### Claim register

**C-118 to C-120 added**, all `defect-fixed`. The register now stands at 120
claims. C-55 is still the only `needs-review` row.

### Testing method

`npm test` passed on each merged branch before its push, and the tip of
`main` passed with 42 checks.

New checks, each negative-tested against `main`'s code:

| Check | Assertions | What it reproduces against `main` |
|---|---|---|
| `check-deleted-buyers.js` | 22 | the owner's `404 "Not found"`, plus the silent edit and silent note |
| `check-crm-write-failures.js` | 15 | all seven silent writes |
| `check-failure-alerts.js` | 45 | a handler that stops reporting |

In Chromium, against the real handlers and PostgreSQL:
- a delete followed by its confirmation, and the inbox link
- all seven actions whose request gets no reply
- a Kanban drag, plus a control drag with the server healthy
- a refused operation reaching the dashboard and the (dry-run) email
- the database down, where the email still goes

### Rollback

```
git revert 92c4331 4e04db1 151936e
```

`crm_failures` can stay if these are reverted, since nothing else reads it.

### Known limitations shipped with Deploys 41 to 43

- **Email alerts reach nobody yet.** They need the same Netlify settings as
  enquiry notifications. The dashboard card is the working channel.
- **The analytics functions (`/admin/analytics`) are not wired into failure
  reporting.** The scope was the CRM and what feeds it.
- **"Could not be reached" still covers three different faults**: a Neon
  outage, a rejected credential and a network drop. This was proposed as a
  follow-up and not taken up. The real cause is in the Netlify function log,
  and now also on the dashboard card when it can be recorded.
- **The dashboard card has been seen live only in its quiet state.** Its
  failure state was verified locally.

---

## Deploys 44 to 47 — Requests that had reached nobody (PRs #159, #163, #164, #165)

**Previous recorded deploy:** `92c4331` (Deploy 43, PR #162)

| Deploy | PR | Production commit | Date (+0300) | Files | Lines | Approval |
|---|---|---|---|---|---|---|
| 44 | #159 | `7cc8b26` | 2026-09-27 05:06:37 | 2 | +149 / −4 | "merge 159 and record deploys 41 42 43" |
| 45 | #163 | `ed49eb0` | 2026-09-27 05:10:14 | 2 | +241 / −0 | "merge 163" |
| 46 | #164 | `000f242` | 2026-09-27 16:16:59 | 8 | +458 / −91 | "merge 164 and 165" |
| 47 | #165 | `b555aa7` | 2026-09-27 16:17:01 | 3 | +31 / −2 | "merge 164 and 165" |

### Deploys 44 and 45 — The record

Documentation only, inside `docs/`, which the pruner removes from the
artifact. Nothing a visitor can reach changed.

- **Deploy 44** records Deploys 38 to 40, with the owner's confirmation of
  the Arabic privacy wording and the two live checks.
- **Deploy 45** records Deploys 41 to 43.

### Deploy 46 — Every request the forms collect, in the CRM (PR #164)

**The owner's question.** Almost a month after setting up the analytics
dashboard, and never having signed in to it, the owner asked whether any
quotations or requests had been sent there that they never received, and
asked for them in the CRM's Enquiries.

**The honest answer came in two parts, and only the second was a
problem.**

1. **Contact and sample enquiries were never hidden.** The dashboard's
   Inquiries panel and the CRM's Enquiries page both read
   `GET /api/inquiries`, the same table.
2. **`leads_staging` was never read by anything.** It holds:
   - private-label briefs: target market, variety, format, pack size,
     volume, certifications, launch date and Incoterm, which amounts to a
     full project request
   - market-brief signups
   - every gated guide download

   That is ten form kinds across `/`, `/downloads` and
   `/resources/private-label`, in both languages. No page and no API read
   the table; only the retention job touched it. The one route to a person
   was an email that is switched off.

   **These requests reached nobody from the day the forms went live until
   this deploy.**

   **How many there are is not known to this record.** This environment has
   no production access. The owner is to read the Enquiries page and report
   what was waiting.

   **What was found, 2026-09-27.** The owner read the page after the deploy
   and sent a screenshot. Every guide download and private-label brief in it
   was the owner's own test submission, four in all. In the part shown, **no
   real buyer's request had been waiting.** The gap was real; its cost, as
   far as can be seen, was nil.

   The screenshot began at 26 September, so newer rows were not in view. One
   older contact-form sample request (3 September) looks like a test but is
   not from the owner's address. Names and addresses are deliberately not
   recorded, because this repository is public.
   **The owner confirmed that one was their own test too.**

**What changed:**

- `leads.js` answers `GET` for a CRM or dashboard session only. The rows
  never include the IP address, and each carries its opt-out status.
- The session rule (`requireReaderSession`) moved into `_crm_lib.js`, so
  enquiries and these requests share one access rule.
- `/crm/inquiries` lists both kinds together, labelled, with every collected
  detail shown when a row is opened.
- An opted-out address is marked "do not contact" and gets no Reply button.
- A market-brief signup is shown as consent to hear about the brief only,
  "not a sales enquiry". This matches its checkbox, which differs from the
  guides' "about this request".
- These requests are read in place, not copied, and not added to the
  pipeline.

**Also in the same PR, at the owner's request: exporting market-brief
subscribers.** The site promises signups a quarterly market report, and
nothing in the system can send one, so the owner will send it by hand.

- **Who is in the file:**
  - market-brief signups with consent
  - minus anyone who has opted out
  - one row per address, using its latest signup
- **Held to the buyer export's rules:**
  - explicit confirmation before it runs
  - an audit entry recording who exported and how many rows
  - formula-injection protection on every cell. `csvCell` moved into
    `_crm_lib.js`, so both exports use one copy.
- **A byte-order mark leads the file**, so Arabic company names open
  correctly in a spreadsheet. The buyer export has no BOM; that was noted,
  not changed.

**The page's intro sentence was corrected in passing.** It said every row
enters the pipeline, and guide downloads and briefs do not.

### Deploy 47 — Every form named on the privacy page (PR #165)

`/privacy` named only the Contact, Sample Request and Market Brief forms.
The owner answered "yes add". The forms section now covers:

- **Contact and Sample Request:** unchanged in substance.
- **The downloads, the private-label brief and the Market Brief signup:**
  - what each collects
  - that each asks for agreement before sending
  - what each is used for.
- **The IP address.** It is kept with every submission, for the
  five-per-hour limit.

**Two corrections came with it:**

1. **The IP address.** Every form had always stored it (`client_ip`) and the
   page never said so. It is stated now, because the rewritten sentence
   would otherwise have been untrue. The owner was told this was beyond the
   literal ask.
2. **The Market Brief field list.** The old text said the Market Brief form
   collects a name, phone and message. It collects none of those. See the
   note on C-79.

`POLICY_VERSION` was not bumped. This describes forms that each carry their
own consent box, not what the analytics consent covers.

**The Arabic is the assistant's.** The owner was asked to review it after
the deploy, and **confirmed it the same day ("its fine")**. C-123 is now
`verified-approved`.

`check-privacy-disclosures.js` reads the brief's project fields from the
table definition, so a field added to the form later must be disclosed too.

### Verification before the merges

The two PRs touch no common file. Their combination was merged locally first
and passed the full suite before either was merged on GitHub.

### Claim register

- **C-121 to C-123 added.**
- **A dated note added to C-79**, whose Market Brief statement Deploy 47
  corrected again.
- The register stands at 123 claims.
- `needs-review` rows: C-55 and C-123, the second only for the Arabic
  review. **Later the same day** the owner confirmed the Arabic, C-123
  became `verified-approved`, and C-55 is again the only `needs-review`
  row.

### Testing method

`npm test` passed with 43 checks on `b555aa7`.

**New and extended checks, each negative-tested:**

| Check | Assertions | Negative tests caught |
|---|---|---|
| `check-leads-visible.js` | 28 | `main`'s `leads.js`; a hidden Incoterm; an ignored opt-out; the export's opt-out exclusion removed; its confirmation removed |
| `check-privacy-disclosures.js` | 13 | `main`'s page (fails four); one dropped field |

**End to end** (real handlers, the Neon driver, PostgreSQL 16 and Chromium),
with requests sent through the real form endpoints:

- **The Enquiries list.** One test address was opted out via
  `/api/unsubscribe`.
  - Every kind showed correctly.
  - With the leads read deliberately broken, the enquiries still showed.
- **The export.** The seeded data held a duplicate, an unsubscribed address,
  a formula, an Arabic name and a guide download.
  - The downloaded file contained exactly the three right rows.
  - The audit log recorded the export.

### Rollback

```
git revert b555aa7 000f242
```

Deploys 44 and 45 are documentation only. Reverting Deploy 46 hides these
requests again; nothing in the data is changed, except that audit entries
for any exports remain.

### Known limitations shipped with Deploys 46 and 47

- **Nothing sends the quarterly market report the site promises.** The
  export supports sending it by hand. Whether a report has ever been sent is
  not known here.
- **Private-label briefs are not added to the pipeline.** That is a separate
  decision, offered and not taken up.
- **The CRM dashboard's Enquiries card still counts contact and sample
  enquiries only.**
- **Email notification is still off** (outstanding item 10). It is the reason
  all of this went unseen.

---

## Deploys 48 and 49 — A delete that cannot be walked back (PRs #166, #167)

**Previous recorded deploy:** `b555aa7` (Deploy 47, PR #165)
**Approval:** "merge 166 and 167".

| Deploy | PR | Production commit | Date (+0300) | Files | Lines |
|---|---|---|---|---|---|
| 48 | #166 | `3c4810c` | 2026-09-27 16:43:01 | 2 | +204 / −1 |
| 49 | #167 | `bb0c1c5` | 2026-09-27 16:43:03 | 8 | +274 / −18 |

The two PRs touch no common file. Their combination was merged locally, and
passed the full suite, before either was merged on GitHub.

### Deploy 48 — The record for Deploys 44 to 47 (PR #166)

Documentation only, inside `docs/`, which is pruned from the published site.
It carries:

- the owner's confirmation of the Arabic privacy wording (C-123 became
  `verified-approved`)
- what the owner's Enquiries page showed: every request surfaced from before
  Deploy 46 was the owner's own test, including the 3 September sample
  request, which the owner confirmed separately
- no names or addresses, because the repository is public.

### Deploy 49 — Deleting an enquiry or request, for good (PR #167)

The owner asked for a delete after seeing the test entries. Asked to choose,
they picked **permanent** deletion over hiding, because it serves both reasons
to delete:
- a test entry
- a visitor asking for their data to be deleted, as `/privacy` promises.

`deleteSubmission()` in `_crm_lib.js` is used by `DELETE /api/inquiries` and
`DELETE /api/leads`:

- **CRM staff only.** The analytics-dashboard session can read these, but
  not delete them.
- **`confirmed=1` is required.** The id must be plain digits.
- **The row and its audit entry go in one SQL statement.** Nothing can be
  deleted without a record of who deleted it and when.
- **The audit entry holds only the date received and the kind of request,**
  never the person's details.
- **Never touched:**
  - the opt-out list: an unsubscribed address stays unsubscribed
  - any buyer the enquiry created. The confirmation dialog says so.

**Found by the change's own check before it shipped.** `parseInt` read an id
like `5; …` as 5, so a malformed request would have deleted record 5. It was
not SQL injection, since the id is always passed as a parameter, but it was
a delete made on a guess. Ids are now accepted as plain digits only.
`crm-buyers.js` and `crm-documents.js` still parse ids the lenient way; see
the known limitations.

### Claim register

- **C-124 added.** The register stands at 124 claims.
- C-55 remains the only `needs-review` row.

### Testing method

`npm test` passed with 44 checks on `bb0c1c5`.

**`check-request-delete.js` (32 assertions) and two fresh-database schema
cases.** Negative tests caught:
- the audit entry split out of the delete statement
- the email written into the audit entry.

**End to end** (real handlers, the Neon driver, PostgreSQL 16, Chromium):
- A test enquiry that had created a buyer, and an opted-out test download,
  were both deleted from the page.
- Both rows were gone.
- The buyer and the opt-out were intact.
- Two audit entries were written, with no personal details.
- A repeat delete answered 404.

### Rollback

```
git revert bb0c1c5
```

This removes the button. **It cannot bring back anything already deleted.**
Deploy 48 is documentation only.

### Known limitations shipped with Deploy 49

- **A full "delete my data" request cannot yet be carried out from the CRM.**
  Deleting an enquiry is permanent. But if the enquiry was added to the
  pipeline:
  - the buyer's delete is a *soft* delete, which keeps the person's name,
    email and phone
  - the buyer's activity log keeps a copy of the original message.

  See outstanding item 12.
- **`crm-buyers.js` and `crm-documents.js` read ids with `parseInt`,** so a
  malformed id acts on its leading number. The CRM pages always send clean
  ids. This was flagged, not changed.

---

## Deploys 50 and 51 — Record ids are digits, or refused (PRs #168, #169)

**Previous recorded deploy:** `bb0c1c5` (Deploy 49, PR #167)
**Approval:** "merge 168 and 169".

| Deploy | PR | Production commit | Date (+0300) | Files | Lines |
|---|---|---|---|---|---|
| 50 | #168 | `ef5877a` | 2026-09-27 20:27:26 | 2 | +121 |
| 51 | #169 | `0ce9e76` | 2026-09-27 20:27:30 | 9 | +202 / −24 |

The two PRs touch no common file. Both were mergeable against the same
`main`, and the full suite passed on the combined result, `0ce9e76`.

### Deploy 50 — The record for Deploys 48 and 49 (PR #168)

Documentation only, inside `docs/`, which is pruned from the published site.
It added C-124 and outstanding item 12: a full "delete my data" request cannot
yet be carried out from the CRM for someone who reached the pipeline.

### Deploy 51 — Malformed ids refused on the CRM and the KPI manager (PR #169)

This resolves the known limitation recorded under Deploy 49. The owner asked
for it to be fixed ("fix this"), and then for the KPI manager to be held to
the same rule ("tighten it the same way").

**What was wrong:**
- **CRM.** Ids were read with `parseInt`, which reads `5abc` or `5; …` as 5.
  A malformed id opened, edited or deleted buyer 5, opened or voided
  document 5, or filed a note or document against buyer 5.
- **KPI manager.** Ids were read with `Number()`, which reads `0x10` as KPI
  16, `1e1` as KPI 10 and `true` as KPI 1.
- **Both.** An id that was malformed and parsed to nothing fell through to a
  list instead of being refused: `?id=abc` returned every buyer,
  `?buyer_id=abc` every buyer's documents, and `?kpi_id=abc` every KPI's
  values.

Every endpoint needed a login, and the id was always passed to the database
as a parameter, so this was never SQL injection. It was acting on a record
nobody named.

**What changed:**
- **One shared rule.** `parseId` in `_lib.js` accepts plain positive whole
  numbers only, as text or as a number, and refuses anything past 2^53, which
  would round to a different record. `_crm_lib.js` uses the same function,
  including for the enquiry delete from Deploy 49, whose behaviour is
  unchanged.
- **Where it applies:**
  - `crm-buyers.js` `?id`
  - `crm-documents.js` `?id`, `?buyer_id` and body `buyer_id`
  - `crm-activity.js` body `buyer_id`
  - `kpi-values.js` `?kpi_id` and body `kpi_id`
  - `kpi-definitions.js` body `id` (edit and archive)
- **A malformed id gets a 400** before any query that names a record. The CRM
  says "Which one? A valid id is required."; the KPI endpoints keep their
  existing messages.
- **A missing id behaves as before.** The list endpoints still list.
- **No page, schema or wording change.** The pages already show a server
  error, so a bad link now shows that message and loads nothing.

### Claim register

- **C-125 added.** The register stands at 125 claims.
- C-55 remains the only `needs-review` row.

### Testing method

`npm test` passed with 45 checks on `0ce9e76`.

**`check-strict-ids.js` (32 assertions)** runs the real handlers with 10
malformed forms per query endpoint and 8 or 9 per body field, checks that a
good id still reaches that record as a number, and checks that there is only
one copy of `parseId`. Negative tests: it failed 9 assertions against the
previous CRM code and 4 against the previous KPI code.

**End to end** (real handlers, the Neon driver, PostgreSQL 16, Chromium),
with dummy records in a throwaway local database:
- **CRM (14/14).** Malformed ids were refused on every path and the buyer was
  untouched. The buyer page and new-document page showed the message, loaded
  no record and offered no Delete button. The real id still opened the buyer,
  its notes and its documents. No script errors.
- **KPI (9/9).** The driver returns a KPI id as the string `"1"`, and the
  admin page sends it back as it is. Entering a value, reading history and
  archiving all still worked with it. `?kpi_id=abc`, `0x1` and `true` were
  refused, and no KPI was archived by them.

### Rollback

```
git revert -m 1 0ce9e76
```

This restores the lenient parsing. Nothing is stored differently, so nothing
needs to be undone in the database. Deploy 50 is documentation only.

### Known limitations shipped with Deploy 51

- **Not yet confirmed on the live site.** The check to do is in the owner's
  hands: open a buyer, change `?id=12` to `?id=12abc`, and expect the message
  with no record loaded.
  **Resolved 2026-09-27:** the owner confirmed the fix on the live site ("id
  fix confirmed on live site").
- **Other analytics settings still use `Number()`,** for retention days,
  thresholds and similar values. They read values, not record ids, and were
  deliberately left out of scope.

---

## Deploy 52 — The record for Deploys 50 and 51 (PR #170)

**Previous recorded deploy:** `0ce9e76` (Deploy 51, PR #169)
**Approval:** "merge 170".

| Deploy | PR | Production commit | Date (+0300) | Files | Lines |
|---|---|---|---|---|---|
| 52 | #170 | `0ad6dd3` | 2026-09-27 20:33:26 | 2 | +106 |

Documentation only, inside `docs/`, which is pruned from the published site.
It carries:

- the entry for Deploy 50 (the record for Deploys 48 and 49) and Deploy 51
  (malformed record ids refused on the CRM and the KPI manager)
- C-125, for Deploy 51. The register stands at 125 claims, and C-55 remains
  the only `needs-review` row. This deploy adds no claim.

`npm test` passed with 45 checks on `0ad6dd3`.

**Rollback:** `git revert -m 1 0ad6dd3`. It removes only these notes.

**Still open from Deploy 51:** the fix is not yet confirmed on the live site.
The check is the owner's: open a buyer, change `?id=12` to `?id=12abc`, and
expect "Which one? A valid id is required." with no record loaded.
**Resolved 2026-09-27, after Deploy 53:** the owner confirmed it on the live
site.

**The last notes-only deploy with its own entry.** Merging this record
becomes Deploy 53. Under the recording convention at the top of this
document, Deploy 53 will be listed in the next entry written for a real site
change.

---

## Deploy 55 — Deleted buyers hidden and recallable; erased on request (PR #173)

**Previous recorded deploy:** `0ad6dd3` (Deploy 52, PR #170)
**Approval:** "merge 171" (Deploy 53); "merge 172 and 173" (Deploys 54 and 55).

| Deploy | PR | Production commit | Date (+0300) | Files | Lines | Kind |
|---|---|---|---|---|---|---|
| 53 | #171 | `7b60df8` | 2026-09-27 20:37:35 | 1 | +39 | Notes only |
| 54 | #172 | `dac2141` | 2026-09-27 21:03:34 | 2 | +5 / −1 | Notes only |
| 55 | #173 | `f78c681` | 2026-09-27 21:03:37 | 7 | +319 / −52 | Site change |

This is the first entry under the recording convention at the top of this
document, so the notes-only Deploys 53 and 54 are listed here rather than
recorded on their own:
- **Deploy 53** recorded Deploy 52 and adopted the convention.
- **Deploy 54** recorded the owner's live confirmation of Deploy 51 (C-125).

#172 and #173 touch no common file. Both were mergeable against the same
`main`, and the full suite passed on the combined result, `f78c681`.

### Deploy 55 — What the owner decided

Outstanding item 12 asked whether a deleted buyer should be erasable. The
owner decided two things on 2026-09-27:
- "deleted buyer should be earasable from bieing viewed on crm but could be
  recalled if needed from code"
- "if buyer requested to be deleted then delete fully"

So the buyer page now has two actions:

| Button | For | Result | Recallable? |
|---|---|---|---|
| **Delete** | A test, a lost lead, a duplicate | Hidden everywhere in the CRM; kept in the database | Yes, with `docs/recall-deleted-buyer.md` |
| **Erase (deletion request)** | The person asked for their data to be deleted | Removed from the database | No |

### Deploy 55 — What changed

**Delete hides the buyer everywhere.** In the database nothing changed:
`deleted_at` is set and the row is kept.
- **Opening a deleted buyer** answers 410 with only the date deleted. No
  name, contact details, notes (which hold a copy of the original message)
  or stage history are sent, and the notes and history are not even read.
- **The 410 is `no-store`.** Browsers may cache a 410 by default. Testing
  showed a restored buyer still reading "deleted" until this was added.
- **The buyer list** no longer has an `include_deleted` option.
- **No document can be issued to a deleted buyer,** since that would copy
  its details back into the CRM.
- **The buyer page** shows "Deleted buyer", the date and one action: Erase.
  The Enquiries inbox's link for a deleted buyer reads "Erase options".

**Recall** is from the Neon SQL Editor, with the four queries in
`docs/recall-deleted-buyer.md`: list, view, see notes and history, and
restore. The restore writes its own audit entry. Reading in the SQL Editor
is not audited, and the guide says so.

**Erase** is for CRM staff only and needs confirmation. It works on a live
buyer or an already-deleted one, in one SQL statement:
- **Removed:** the buyer, its notes, its stage history, and the website
  enquiries linked to it.
- **Kept:** quotations, invoices and letters already issued, and the opt-out
  list.
- **Audit:** one entry recording who erased it and how many rows went, with
  no personal details.

### Claim register

- **C-126 added.** The register stands at 126 claims.
- C-55 remains the only `needs-review` row.

### Testing method

`npm test` passed with 45 checks on `f78c681`.

**`check-deleted-buyers.js`, reworked (45 assertions).** It failed 19
against the previous code. Each of three single faults was caught: the 410
leaking the company name, erase skipping linked enquiries, and a document
allowed for a deleted buyer.

**End to end (36/36)** with real handlers, the Neon driver, PostgreSQL 16
and Chromium, using dummy records sent through the real form endpoints into
a throwaway database:
- **Delete:** the buyer was hidden from the list, the API, the dashboard
  and the buyer page.
- **Recall:** the guide's own four queries listed, showed and restored the
  buyer, and the CRM showed it again with its notes.
- **Erase:** the buyer, notes, history and linked enquiry were gone and the
  message survived nowhere. The opt-out and an issued quotation were kept,
  and the guide could no longer bring the buyer back.

### Rollback

```
git revert -m 1 f78c681
```

Nothing is stored differently. After a revert, buyers deleted in the
meantime show read-only again, as before Deploy 55. **Anything erased stays
erased.** Deploys 53 and 54 are documentation only.

### Known limitations shipped with Deploy 55

- **Not yet confirmed on the live site.** The owner's check, with a test
  buyer: Delete it and expect "Deleted buyer" with only the date and an
  Erase button; then Erase it and expect "Erased … permanently", and "Not
  found" on reopening.
  **Resolved 2026-09-27:** the owner confirmed both on the live site ("delete
  and erase confirmed on live site").
- **Erase keeps issued documents.** A quotation, invoice or letter keeps the
  name and address it was issued to. That matches the `/privacy` wording on
  quotation and order records, and removing invoices may conflict with
  record-keeping duties. Whether Erase should remove them too is for the
  owner, with counsel (C-55).
- **Other requests from the same person are not linked to the buyer.**
  Downloads and Market Brief signups are deleted separately, from the
  Enquiries page. The Erase dialog says so.

---

## Deploys 56 to 71 — The first system health audit, and what it found (PRs #174 to #189)

**Previous recorded deploy:** `f78c681` (Deploy 55, PR #173)
**Approvals, all 2026-09-27/28:** "merge 174"; "merge 175"; the audit brief
(read-only, nothing fixed without approval); "fix all", which approved fixing
the audit's findings; "merge all" (#176 to #187, and Umami #1); "merge
umami 2"; "merge 188"; "merge 189".

| Deploy | PR | Production commit | Date (+0300) | Files | Lines | Kind |
|---|---|---|---|---|---|---|
| 56 | #174 | `5b650a3` | 2026-09-27 21:06:51 | 2 | +125 | Notes only |
| 57 | #175 | `ff07532` | 2026-09-28 00:52:39 | 2 | +5 / −1 | Notes only |
| 58 | #176 | `3733dd7` | 2026-09-28 07:04:54 | 1 | +205 | Notes only |
| 59 | #177 | `b198783` | 2026-09-28 07:04:56 | 15 | +163 / −30 | Site change |
| 60 | #178 | `b91f3c7` | 2026-09-28 07:05:19 | 8 | +22 / −22 | Site change |
| 61 | #179 | `8640409` | 2026-09-28 07:05:22 | 2 | +71 / −6 | Site change |
| 62 | #181 | `e143452` | 2026-09-28 07:05:24 | 3 | +4 / −3 | Site change |
| 63 | #182 | `fc751f0` | 2026-09-28 07:05:27 | 6 | +11 / −8 | Site change |
| 64 | #184 | `b672940` | 2026-09-28 07:05:29 | 1 | +11 / −1 | Site change |
| 65 | #187 | `8a5865a` | 2026-09-28 07:05:32 | 2 | +30 | Site change |
| 66 | #180 | `2999b0a` | 2026-09-28 07:06:48 | 137 | +1,276 / −320 | Site change |
| 67 | #186 | `723d976` | 2026-09-28 07:07:42 | 3 | +91 / −2 | Site change |
| 68 | #183 | `41cb446` | 2026-09-28 07:08:42 | 4 | +188 / −18 | Site change |
| 69 | #185 | `0f64d73` | 2026-09-28 07:09:11 | 4 | +170 / −1 | Site change |
| 70 | #188 | `3d47a23` | 2026-09-28 07:58:30 | 30 | +648 / −77 | Site change |
| 71 | #189 | `e29a1cc` | 2026-09-28 08:01:39 | 7 | +33 / −12 | Site change |

Files and lines are each merge against the `main` it landed on.

**Deploy numbers follow merges, not builds.** Deploys 58 to 69 merged within
five minutes of each other. Netlify may have built fewer than twelve times,
since a newer commit can supersede a queued build. Whatever it built last
carried all of them. The build count is not visible from this environment.

**Notes-only deploys listed here, under the recording convention:**
- **Deploy 56** recorded Deploys 53 to 55 (C-126).
- **Deploy 57** recorded the owner's live confirmation of Deploy 55.
- **Deploy 58** started `docs/system-health-audit-log.md` with run 1: 32 items,
  16 pass, 12 needs attention, 2 fail, 2 not run, 3 regressions, and one urgent
  conditional finding. It audited `ff07532` read-only.

### Umami deploys (`umami-olivesegypt`, a separate Netlify site)

| Deploy | PR | Production commit | Date (+0300) | Files | Lines |
|---|---|---|---|---|---|
| U1 | umami #1 | `cc6bdf6` | 2026-09-28 07:09:18 | 2 | +124 / −146 |
| U2 | umami #2 | `6da67e4` | 2026-09-28 07:35:13 | 2 | +665 / −1,130 |

Both change only `package.json` and `pnpm-lock.yaml`. They are the first
commits made to this repository in any session this record covers.

- **U1:** Next.js 16.3.0 → 16.3.3, for two critical advisories (audit E1).
  One is remote code execution on Windows hosts, which does not apply on
  Netlify. The other is in the AVIF path of Next's image optimiser, which is
  probably not reachable here. Build succeeded, and vitest passed 739/739.
- **U2:** the remaining advisories (43 in production dependencies: 1
  critical, 31 high, 9 moderate, 2 low; 53 in all). The fix is three direct
  bumps, `vite` added as a devDependency, and 20 `pnpm.overrides` pins, each
  scoped to its vulnerable range. `pnpm audit` then reports none. A frozen
  install from empty, `pnpm test` (739/739) and `pnpm build` all succeeded.
  Three pins cross a major version:
  - `d3-color` 3, used by the dashboard map
  - `deepmerge-ts` 8, used by Prisma's config
  - `sharp` 0.35, used for images

  Each was smoke-tested. **Upkeep:** remove the pins once upstream Umami ships
  these versions.

Netlify's deploy previews for U1 and U2 both succeeded. Whether the
production builds succeeded is not visible from here.

### How the batch was merged

"merge all" was carried out in PR order, with `main` merged into a branch
wherever an earlier merge had moved under it. Three branches needed changes
to merge cleanly. Each change was committed on its branch, and the suite
passed before the merge:

- **#180 (fonts):** `assets/fonts/fonts.css` named `fonts.googleapis.com` in
  a comment, which fails `check-self-hosted-fonts`. It had passed on the
  branch only because the check ran before the files were committed. The
  comment now says "Google Fonts".
- **#186 (Umami CSP):** the Content-Security-Policy line changed on both
  sides. The combined line keeps #180's same-origin `style-src` and
  `font-src`, and adds the Umami host to `script-src` and `connect-src`.
  Checked in Chromium under the combined header: Umami loaded for a
  consenting visitor, the six self-hosted fonts loaded, and there were no
  violations.
- **#183 (real 404):** two fixes.
  - `404.html` was built before #180 and still loaded Google Fonts, so it
    now uses the local stylesheet.
  - The six forced-404 rules #179 added pointed at `/index.html`. They now
    show `/404.html`.

### What each site change did

- **Deploy 59 — CRM and admin sessions can no longer stand in for each other
  (#177).** This was the audit's urgent finding (C2). With
  `CRM_SESSION_SECRET` unset, or set equal to `SESSION_SECRET`, a CRM
  token copied into the admin cookie opened the analytics and KPI
  endpoints, and the reverse also worked. The CRM now signs with a key
  derived from its secret under a fixed label. **CRM users must sign in once
  more.** The admin session is unchanged. New check:
  `check-session-separation`.
- **Deploy 60 — Downloads brought up to the supplier evidence (#178).**
  Audit regressions B4 and B6:
  - **Catalogue PDFs:** both still carried the withdrawn per-variety caliber
    grades and the old jar and tin wording. They were regenerated.
  - **Four gated guides** said "300g to 1.7kg" and now use the approved
    320–1050ml and can sizes.
  - **Barrel rows** are untouched.

  Both PDFs came out at 10 pages. They were rendered on a machine that could
  not reach Google Fonts, so they used fallback fonts. Deploy 70 superseded
  them.
- **Deploy 61 — The rest of the publish root blocked (#179).** Audit A1:
  forced 404s for `/geo/*` (the ~8–9 MB GeoLite2 database), `/node_modules/*`,
  `/package.json`, `/package-lock.json`, `/.gitignore` and `/README.md`.
  `check-publish-exclusions` now requires a rule for every unprunable path.
- **Deploy 62 — Content upkeep (#181).** The "2025/26 Harvest Season Now Open"
  card is removed from `/media`, in both languages. C-127 and C-128 were
  registered.
- **Deploy 63 — Three small audit fixes (#182).**
  - `csvCell` also neutralises a leading TAB or CR, which completes OWASP's
    list for spreadsheet export.
  - JSON-LD now names "Stuffed Green Olives" as the page shows it.
  - `robots.txt` drops four rules for routes that do not exist.
- **Deploy 64 — Language switch keeps the reading position (#184).** Audit E3
  regression. Switching language at the bottom of `/` or `/contact` jumped to
  the top, because a hidden form-status element was chosen as the anchor.
  Hidden elements are now skipped, and `check-locale-switch.js` passes 36/36.
- **Deploy 65 — Insights tab mirrored on Arabic pages (#187).** On Arabic
  pages at desktop width, the floating "اقرأ مدونتنا" tab sat over the
  homepage headline. It now sits on the left edge on right-to-left pages.
  English pages are unchanged.
- **Deploy 66 — Fonts served from this domain (#180).** Audit D2: every page
  sent each visitor's IP address to Google before consent. There are 26 woff2
  files in `assets/fonts/` under the SIL Open Font License, with its text in
  `OFL.txt`. The CSP no longer names Google. New check:
  `check-self-hosted-fonts`.
- **Deploy 67 — Umami allowed by the CSP (#186).** Since 2026-09-02 the CSP
  had blocked the Umami script and its beacon. Umami had recorded nothing from
  the live site for almost a month, and nobody noticed. The Umami host is now
  allowed in `script-src` and `connect-src`. Consent gating is unchanged.
  New check: `check-csp-allows`.
- **Deploy 68 — A real 404 (#183).** Audit B5: the catch-all `/*` →
  `/index.html` returned the homepage with a 200 for any unknown address,
  since 2026-08-24. It is removed. `404.html` is bilingual and noindex, and
  every 404 and 410 rule shows it. New check: `check-not-found`, which
  resolves every internal link the way Netlify does.
  **The Arabic wording on `404.html` is new and awaits the owner's review.**
- **Deploy 69 — Enquiries by how the visitor arrived (#185).** Audit D4. There
  is a new `/admin/analytics` card. Enquiries in the period are joined to
  their consented analytics visit and counted by source, with quote and
  sample requests split out. Unlinked enquiries are labelled rather than
  dropped. The card shows counts only, with no personal column. New check:
  `check-enquiries-by-source`.
- **Deploy 70 — Every guide is a PDF (#188).** Owner's request. The Downloads
  page had always offered "PDF Guide", but only the catalogue was a PDF.
  - **Serving:** `guide.js` serves each of the seven guides as a PDF.
  - **Building:** each guide's HTML stays beside its PDF as the source, and
    one generator builds all 16 PDFs.
  - **Freshness:** `check-guide-pdfs` fails when a PDF no longer matches its
    source.
  - **Catalogue:** back to its designed 9 pages, matching "9-page" on the
    Downloads pages. Since #178, both had spilled onto a tenth page.

  C-129 and C-130 were registered.
- **Deploy 71 — Catalogue contents list (#189).** The cover's contents list
  and the page footers numbered the last two pages "8A" and "8B". They are
  now 8 and 9, in both languages. The check now requires the numbering 2 to
  the last page in order, with each footer carrying its own number.

### Claim register

- **Added:** C-127 and C-128 (Deploy 62), C-129 and C-130 (Deploy 70). The
  register stands at 130 claims.
- **C-55** remains the only `needs-review` row.
- **Register defect.** Deploy 70 appended C-129 to a file with no final line
  break, which glued it onto the C-128 row. No claim was lost. PR #190 repairs
  it and adds `check-claim-register`.
- **C-128 status.** On 2026-09-28 the owner confirmed the C-128 figures
  "verified correct". PR #190 records that; until it merges, the deployed
  register still shows C-128 as unverified.

### Testing method

The checks in `npm test` grew from 45 at Deploy 57 to 51 at Deploy 70. The
six new checks are listed per deploy above. The suite passed:
- on each branch before its merge
- on `0f64d73` (Deploy 69, 50 checks)
- on `3d47a23` (Deploy 70, 51 checks)
- on `e29a1cc` (Deploy 71, 51 checks)

The counts for Deploys 58 to 68 are read from each commit's `package.json`.
Their runs on `main` were not captured one by one.

Beyond the suite:
- **Deploy 59:** each new check was also run against the code it replaced
  and failed there.
- **Deploy 66:** each new check was also run against the code it replaced
  and failed there.
- **Deploy 67:** Chromium with the real header, before and after.
- **Deploy 68:** a planted broken link fails `check-not-found`.
- **Deploy 69:** real PostgreSQL through the real form endpoint.
- **Deploy 70:**
  - **Browser:** the real Downloads forms in Chromium, with the real
    `leads.js` and `guide.js` against a throwaway PostgreSQL and test data
    only. Five guides across both languages downloaded byte-identical to the
    committed PDFs.
  - **Visual:** every page of all 16 PDFs was looked at. All pages were seen
    at contact-sheet size, and the first pages at readable size.

Nothing here was checked against the live site: this environment's egress
policy blocks it.

### Rollback

Each deploy reverts on its own with `git revert -m 1 <commit>`. What a revert
brings back:

- **Deploy 59:** the session crossover. CRM users would sign in once more.
- **Deploys 66 and 67:** both edit the CSP line, so revert them together,
  67 first, and read the CSP afterwards.
  - Reverting 66 brings back Google Fonts.
  - Reverting 67 brings back a CSP that blocks Umami.
- **Deploy 68:** the soft-404 catch-all.
- **Deploy 70:** revert 71 first, since both change the catalogue. Reverting
  70 brings back guides served as HTML, and the catalogue PDFs from Deploy 60
  (10 pages each).
- **Deploys 56 to 58:** documentation only.

**U1 and U2:** revert in `umami-olivesegypt`. U2's revert restores the
previous lockfile exactly.

### Known limitations shipped with Deploys 56 to 71

- **Not yet confirmed on the live site:**
  - An unknown address shows the new "not found" page with a 404.
  - A consenting visit appears in Umami's Realtime view.
  - CRM users can sign in again.
  - A guide downloads as a PDF in each language.
  - The catalogue has 9 pages, numbered 2 to 9.
- **Arabic PDFs:** Chromium writes Arabic in visual order. The pages render
  correctly, but copying or searching Arabic text in any of the eight Arabic
  PDFs gives garbled text.
- **`check-locale-switch.js`** still runs by hand. It needs a browser, which
  the Netlify build does not have.
- **Enquiry emails** (outstanding item 10) are unchanged.

**Pending at the time of writing: PR #190.** It closes gaps in the PDF and
gate checks, repairs the register row and records C-128. It will be listed in
the next entry. So will the merge of this record.

## Deploys 72 to 82 — Hamed withdrawn, and every document an official-paper PDF (PRs #190 to #200)

**Previous recorded deploy:** `e29a1cc` (Deploy 71, PR #189)
**Approvals, all 2026-09-28:** "fix 2 to 4" (the pre-record review items
that became #190); "okay record deploy all"; "merge all" (#190, #191);
"okay merge this" (#192); "merge" (#193); "merge" (#194, #195); "yes" to
updating the sitemap dates, then "merge" (#196); "merge" (#197, #198);
"merge" (#199); "deploy alll", given with the answer "is available is the
right one" (#200).

| Deploy | PR | Production commit | Date (+0300) | Files | Lines | Kind |
|---|---|---|---|---|---|---|
| 72 | #190 | `e0aa80d` | 2026-09-28 08:17:10 | 12 | +624 / −63 | Site change |
| 73 | #191 | `6db570a` | 2026-09-28 08:17:13 | 1 | +271 | Notes only |
| 74 | #192 | `89a7a66` | 2026-09-28 08:26:41 | 11 | +215 / −521 | Site change |
| 75 | #193 | `399e8df` | 2026-09-28 08:35:14 | 4 | +93 / −3 | Site change |
| 76 | #194 | `d2df4af` | 2026-09-28 08:58:12 | 86 | +396 / −691 | Site change |
| 77 | #195 | `a788adb` | 2026-09-28 08:58:55 | 2 | +9 / −1 | Site change |
| 78 | #196 | `e746dee` | 2026-09-28 09:11:11 | 3 | +190 / −64 | Site change |
| 79 | #197 | `43c46ec` | 2026-09-28 14:28:23 | 10 | +124 / −12 | Site change |
| 80 | #198 | `421cfce` | 2026-09-28 14:29:38 | 2 | +2 / −2 | Site change |
| 81 | #199 | `a27bd6b` | 2026-09-28 15:07:45 | 93 | +1,609 / −194 | Site change |
| 82 | #200 | `be3181f` | 2026-09-28 15:18:33 | 7 | +19 / −6 | Site change |

Files and lines are each merge against the `main` it landed on. Netlify's
deploy preview succeeded for #199 and #200 before they merged; the others
were not read. Whether each production build succeeded is not visible from
here.

**Notes-only deploys listed here, under the recording convention:**
- **Deploy 73** recorded Deploys 56 to 71.

**No Umami deploys.** `umami-olivesegypt` is unchanged since U2.

### How the merges went

Two branches were behind `main` when merged, and each needed a merge of
`main` into it first. The suite passed on the branch after each:

- **#195 (Arabic catalogue button):** `ar/catalog/index.html` conflicted on
  the count line, which #194 had changed to "10 منتجات". Resolved by taking
  `main`'s page whole and adding the button to it again.
- **#198 (business card):** both Downloads pages conflicted on the Company
  Documents line, which #197 had changed. Resolved the same way.

### What each site change did

- **Deploy 72 — Gaps in the PDF and gate checks closed; the register
  repaired (#190).** The owner's pre-record review, items 2 to 4:
  - `check-guide-gate` covers all eight gated downloads in both languages,
    and fails on a PDF tracked outside `netlify/functions/_guides/`.
  - A PDF's fingerprint now covers the fonts and images its stylesheets
    load, and the page preparation.
  - The register row glued in Deploy 70 is repaired. New check:
    `check-claim-register`.
  - C-128 (FAO/IOC figures) is verified-approved: the owner confirmed them.
- **Deploy 74 — "Filter by what you need" removed (#192).** Owner request:
  the chip row on `/catalog` and `/ar/catalog` went unused and took a lot of
  the screen. On a phone the sticky bar fell from 313px to 121px (English).
  The All / Green / Black / Specialty row stays and still filters.
  `check-product-facets` became `check-product-categories`. C-39 is
  resolved-by-removal.
- **Deploy 75 — The gap between the Downloads cards closed (#193).** An empty
  wrapper left behind on 2026-09-06 held a column of the Company Documents
  grid, so the Business Card sat alone on a second row. Removed in both
  languages. New check: `check-empty-grid-cells`, which found only these two.
- **Deploy 76 — Hamed Green Olives withdrawn; Kalamata takes its place
  (#194).** Owner: Hamed is "not confirmed available". The range is ten
  products, in the order of C-131. Removed from every page, list, form,
  guide, PDF, keyword and the sitemap, in both languages; its two product
  pages answer 410; its photographs are deleted. Counts follow ("11
  varieties" becomes 10). The CRM keeps Hamed on buyers already tagged,
  marked "(withdrawn)", and refuses it on anything new. Also fixed: an
  unknown `?product=` on the print catalogue showed a blank page. New check:
  `check-withdrawn-products`. The owner decided North Coast stays a
  sourcing region (C-37).
- **Deploy 77 — The Arabic catalogue gets its download button (#195).** The
  English bar had "Download Full Catalog (PDF)"; the Arabic had only the
  count. It now carries "تحميل الكتالوج الكامل (PDF)", reusing existing
  wording.
- **Deploy 78 — Sitemap dates tell the truth (#196).** Every `<lastmod>`
  said 4, 5 or 6 September. Each is now the day the page's own content (its
  title, description and `<main>` text) last changed: 63 of 78 dates moved.
  New check: `check-sitemap-lastmod`, with `--write` to set them. Done before
  the owner resubmits the sitemap in Search Console.
- **Deploy 79 — The company profile is a real PDF (#197).** The Downloads
  card said "Download PDF" but opened a web page. `company-profile-en.pdf`
  and `-ar.pdf` are now built by the guides' generator, public, and
  downloaded by the cards and by a button on each profile page. The profile
  pages' print styles now hide the floating insights tab and WhatsApp button.
- **Deploy 80 — "Save to Contacts" on the business card (#198).** The
  Downloads entry said "Download PDF", but there is no business-card PDF. It
  now says "Save to Contacts" / "احفظ في جهات الاتصال" and saves
  `triple-company.vcf` directly.
- **Deploy 81 — Official-paper PDFs (#199).** Owner requests: documents that
  download "without viewing", and look like "official paper".
  - **Letterhead** on every page of the guides, the company profile, the
    product catalogue and the spec sheets, in both languages: the masthead
    and foot of `/letterhead`, drawn with the site's fonts and placed as
    images, with a live page number. The export catalogue keeps its own
    design, unchanged.
  - **New public PDFs:** the product catalogue (`product-catalog-{en,ar}`),
    one spec sheet per product (20), and all ten sheets in one file per
    language (`all-spec-sheets-{en,ar}`, 10 pages). Every link to them
    downloads directly. 42 PDFs in all, each fingerprinted.
  - **Images:** the combined file first printed with empty photo frames
    (lazy loading). The generator now loads every image and refuses to write
    a PDF with a broken one.
  - **Natural Black photograph withdrawn:** it carried a stock-photo
    watermark. The product shows "photography pending" everywhere, like five
    others, and the file is deleted. Recorded in the asset-rights register.
  - **Documents take their own titles**, since the letterhead now carries
    the company name.
- **Deploy 82 — Private-label packaging "is available" (#200).** Owner
  confirmed that the English wording is right. The Arabic company profile
  (and its PDF), the Arabic catalogue's private-label section and
  `llms.txt` said "full service"; they now match. `check-identity-strings`
  had already banned the English phrase but never read `llms.txt`; it now
  scans root `.txt` files and bans both Arabic forms. C-132.

### Arabic wording confirmed by the owner, 2026-09-28

- The Hamed-withdrawal wording (Deploy 76).
- "تنزيل جميع أوراق المواصفات (PDF)" (Deploy 81).
- The new guide titles (Deploy 81).

- The Arabic `404.html` (Deploy 68). The owner also asked for its Arabic
  block to offer the same three buttons as the English (PR #202).

- The two new Arabic sentences of Deploy 82, on `/ar/company-profile` and
  `/ar/catalog`.

No Arabic wording written in Deploys 68 to 82 is still awaiting review.

### Claim register

- **Added:** C-131 (Deploy 76) and C-132 (Deploy 82). The register stands at
  132 claims.
- **Changed:** C-128 verified-approved (Deploy 72); C-39 resolved-by-removal
  (Deploy 74); C-37, C-09, C-17, C-61, C-80 and C-110 annotated (Deploy 76).
- **C-55** remains the only `needs-review` row.

### Testing method

The checks in `npm test` grew from 51 to 55: `check-claim-register`
(Deploy 72), `check-empty-grid-cells` (75), `check-withdrawn-products` (76)
and `check-sitemap-lastmod` (78). `check-product-facets` was replaced by
`check-product-categories` (74). The counts are read from each commit's
`package.json`. The suite passed on each branch before its merge, and on
`main` after Deploys 81 and 82.

The new checks of Deploys 75, 76, 77, 78 and 82 were also shown to fail
on the code they replaced.

Beyond the suite:
- **Chromium, both languages,** for every visible change: the catalogue bar
  at 1280px and 390px (74, 77), the Downloads grid at three widths (75),
  each download button saving its own file (79 to 81).
- **Deploy 76:** a browser pass and a crawl of every internal link.
- **Deploy 81:** five gated guides through the real form, and every page of
  the combined spec-sheet file looked at.
- `check-locale-switch.js`, run by hand: 36/36 (Deploy 74).

Nothing here was checked against the live site: this environment's egress
policy blocks it.

### Rollback

Each deploy reverts on its own with `git revert -m 1 <commit>`, except:

- **Deploy 76** touches 86 files, many of which later deploys also changed.
  Revert 77 to 82 first, or expect conflicts. Reverting it brings Hamed back
  everywhere, including the deleted photographs.
- **Deploy 81:** revert 82 first, since both rebuild the Arabic company
  profile PDF. Reverting 81 brings back the watermarked Natural Black photo
  and PDFs without a letterhead, and links that open pages instead of
  downloading.
- **Deploy 78:** a revert brings back the blanket September dates, and
  `check-sitemap-lastmod` would then fail until `--write` is run.
- **Deploy 73:** documentation only.

### Known limitations shipped with Deploys 72 to 82

- **Not yet confirmed on the live site:**
  - Every download carries the letterhead and saves directly.
  - `/products/hamed-green-olives` answers 410.
  - The Arabic catalogue shows its download button.
- **Six products show "photography pending":** Natural Black, Stuffed
  Green, Oxidized Black, Sliced Jalapeño, Marinated Artichoke Hearts and
  Pepperoncini. The owner is bringing real photographs.
- **Arabic PDFs:** Chromium writes Arabic in visual order, so copying or
  searching Arabic text in any Arabic PDF gives garbled text. That now
  covers 21 Arabic PDFs, up from eight.
- **Search Console:** the sitemap has not yet been resubmitted.
- **Enquiry emails** (outstanding item 10) are unchanged.

**Listed in the next entry:** the merge of this record (notes only).

## Deploys 83 to 85 — The 404 page's Arabic buttons, and buyer cards that lead somewhere of their own (PRs #201 to #203)

**Previous recorded deploy:** `be3181f` (Deploy 82, PR #200)
**Approvals, all 2026-09-28:** "okay for both and merge" (#202 and #201);
"ok for arabic, 2 yes manufacter wording is true, 3 merge" (#203).

| Deploy | PR | Production commit | Date (+0300) | Files | Lines | Kind |
|---|---|---|---|---|---|---|
| 83 | #202 | `7da6081` | 2026-09-28 15:34:14 | 2 | +11 / −2 | Site change |
| 84 | #201 | `b525aa3` | 2026-09-28 15:34:17 | 2 | +205 / −1 | Notes only |
| 85 | #203 | `050b1b8` | 2026-09-28 15:51:31 | 7 | +88 / −5 | Site change |

Files and lines are each merge against the `main` it landed on. Netlify's
deploy preview succeeded for all three before they merged. Whether each
production build succeeded is not visible from here.

**Notes-only deploys listed here, under the recording convention:**
- **Deploy 84** recorded Deploys 72 to 82, and the owner's confirmation of
  the Arabic wording of Deploys 68 and 82 (C-132).

### What each site change did

- **Deploy 83 — The 404 page's Arabic block matches the English (#202).**
  The owner confirmed its Arabic wording and asked for the same buttons as
  the English. It had one, to the Arabic homepage. It now has three:
  الصفحة الرئيسية, تصفّح الكتالوج and تواصل معنا, to `/ar/`, `/ar/catalog`
  and `/ar/contact`. Both new labels are existing site wording.
  `check-not-found` now requires the homepage, catalogue and contact in
  each language's block.
- **Deploy 85 — Each homepage buyer card leads somewhere of its own
  (#203).** The owner reported that most of the "Who Are You Sourcing For?"
  cards went to the same place. In both languages:

  | Card | Was | Now |
  |---|---|---|
  | Importer / Distributor | How We Work | unchanged |
  | Retail | Catalogue | Packaging, Glass Jars section |
  | Food-Service | Catalogue | Packaging, Plastic Buckets section |
  | Private-Label | Packaging | Private Label page |
  | Manufacturer | Why Egyptian Olives | Packaging, Plastic Barrels section |
  | Local / Egypt | Contact form | Contact form set to local pricing |

  The three Packaging sections gained an `id` and a scroll margin, so they
  land below the sticky header. Their text is unchanged, the barrel card's
  included.

  The Local card said "Smaller order sizes, EGP pricing, and direct
  delivery within Egypt". The owner confirmed a 10-ton minimum, EGP
  pricing, and delivery within Egypt only on discussion. It now reads
  "Pricing in EGP from a 10-metric-ton minimum order, with no export
  logistics. Delivery within Egypt can be discussed." The owner approved
  the Arabic. New check: `check-buyer-path-cards`.

### Claim register

- **Added:** C-133 (the Local card) and C-134 (the Manufacturer card's
  "Co-packing and OEM supply", confirmed true by the owner). Neither card's
  claims had been registered before. The register stands at 134 claims.
- **C-55** remains the only `needs-review` row.

### Testing method

The checks in `npm test` grew from 55 to 56 with `check-buyer-path-cards`.
The suite passed on each branch before its merge and on `main` after
Deploys 83, 84 and 85. Both changed checks were also run against `main`
before the change and failed there.

Beyond the suite, in Chromium:
- **Deploy 83:** the 404 page at 390px and 1280px: three Arabic buttons,
  right to left, no sideways overflow, no script errors.
- **Deploy 85:** every card clicked, English at 1280px and Arabic at 390px.
  Each landed on its page. The Packaging sections sat 96px from the top,
  below the 65px header, and the contact page showed the local-pricing
  badge in each language.

Nothing here was checked against the live site: this environment's egress
policy blocks it.

### Rollback

Each deploy reverts on its own with `git revert -m 1 <commit>`.
- **Deploy 83:** the Arabic block goes back to one button.
- **Deploy 85:** Retail and Food-Service share the catalogue again, and the
  Local card says "Smaller order sizes" again, which the owner said is not
  true. If it is reverted, correct that wording separately.
- **Deploy 84:** documentation only.

### Known limitations shipped with Deploys 83 to 85

- **Not yet confirmed on the live site:** the 404 page's Arabic buttons, and
  each homepage card's destination.
- **Enquiry emails** (outstanding item 10) are unchanged.

**Listed in the next entry:** the merge of this record (notes only).

## Deploys 86 and 87 — Section links land right under the header (PRs #204, #205)

**Previous recorded deploy:** `050b1b8` (Deploy 85, PR #203)
**Approvals, both 2026-09-28:** "merge" (#204); "merge" (#205).

| Deploy | PR | Production commit | Date (+0300) | Files | Lines | Kind |
|---|---|---|---|---|---|---|
| 86 | #204 | `e353e90` | 2026-09-28 15:54:33 | 1 | +97 / −2 | Notes only |
| 87 | #205 | `0af6dcb` | 2026-09-28 16:11:26 | 8 | +149 / −47 | Site change |

Files and lines are each merge against the `main` it landed on. Netlify's
deploy preview succeeded for both before they merged. Whether each
production build succeeded is not visible from here.

**Notes-only deploys listed here, under the recording convention:**
- **Deploy 86** recorded Deploys 83 to 85.

### What the site change did

- **Deploy 87 — Section links land right under the header (#205).** The
  owner followed the homepage's Food-Service card and saw the bottom of the
  Tin Cans card above Plastic Buckets, and asked for it fixed "here and
  anywhere else". All 11 in-site section links were measured in Chromium at
  1280px and 390px:
  - **Nine landed too low:** `/media#blog` and the three packaging cards,
    in both languages. They used `scroll-mt-24` (96px) under a 65px header,
    so 7–31px of the content above showed.
  - **Two landed too high:** `/#certificates` and
    `/resources/private-label#brief` (both languages for `#brief`). They had
    no offset, so their top 65px sat behind the header. Nobody had reported
    them.

  One rule now lands every section inside `<main>` at the header's height:
  `main [id] { scroll-margin-top: calc(4rem + 1px) }`. The per-element
  offsets are removed. All 22 cases land exactly at 65px.

  `html { scroll-padding-top }` was tried first and rejected. It made the
  browser treat the sticky header as out of view, so pressing Tab in the
  header scrolled the page up by about 400px. `check-locale-switch.js`
  caught it (2 of 36 failed); with the scoped rule it passes 36/36. New
  check: `check-anchor-offset`.

### Testing method

The checks in `npm test` grew from 56 to 57. The suite passed on the branch
before the merge, and on `main` at `0af6dcb` after it (run later, once this
environment's command tool recovered from an outage). The new check was also run against `main` before the
change, and against the rejected `html` version, and failed on both.

Beyond the suite:
- **Chromium:** the 22 section-link cases, and Tab through the header on
  `/resources/packaging` and `/contact`, where the page stayed put.
- **`check-locale-switch.js`**, run by hand: 36/36.
- **PDFs:** the shared stylesheet is an input to every PDF. All 42 were
  rebuilt and compared page by page with the committed files (text, links
  and pixels) and were identical, so the committed files were kept and only
  their fingerprints recorded.

Nothing here was checked against the live site: this environment's egress
policy blocks it.

### Rollback

`git revert -m 1 0af6dcb`. That brings back the 96px offset on nine links
and none on the other two. It also restores the previous PDF fingerprints,
so `check-guide-pdfs` stays green without rebuilding anything. Deploy 86 is
documentation only.

### Known limitations shipped with Deploys 86 and 87

- **Not yet confirmed on the live site:** each homepage card, and the
  certificates and private-label brief links, landing right under the
  header.
- **Enquiry emails** (outstanding item 10) are unchanged.

**Listed in the next entry:** the merge of this record (notes only).

## Deploys 88 to 90 — The phone check, and the last "11 varieties" (PRs #206 to #208)

**Previous recorded deploy:** `0af6dcb` (Deploy 87, PR #205)
**Approvals, all 2026-09-28:** "fix all" (the eight findings of the phone
check, #208); "merge" (#206, #208, #207).

| Deploy | PR | Production commit | Date (+0300) | Files | Lines | Kind |
|---|---|---|---|---|---|---|
| 88 | #206 | `55b9929` | 2026-09-28 23:08:15 | 2 | +6 / −3 | Site change |
| 89 | #208 | `d4084af` | 2026-09-28 23:08:20 | 75 | +394 / −202 | Site change |
| 90 | #207 | `68a0735` | 2026-09-28 23:08:25 | 1 | +79 / −2 | Notes only |

Files and lines are each merge against the `main` it landed on. Netlify's
deploy preview succeeded for all three before they merged. Whether each
production build succeeded is not visible from here.

**Notes-only deploys listed here, under the recording convention:**
- **Deploy 90** recorded Deploys 86 and 87.

### What each site change did

- **Deploy 88 — "View Full Catalog (10 Varieties)" (#206).** The owner
  spotted the English homepage button still saying 11 after Hamed's
  withdrawal (Deploy 76); the Arabic button already said 10.
  `check-product-order` exists to catch exactly this but matched only a
  lowercase "varieties"; it is now case-blind.
- **Deploy 89 — The phone check (#208).** The owner asked for a full check
  of the phone version in both languages, since most traffic comes from
  phones. All 85 public pages were opened in Chromium at 360px and 390px.
  Nothing was wider than the screen and there were no script errors or
  broken images. Eight findings were fixed, one commit each:
  1. **Pinch-zoom allowed** on the 58 pages that blocked it
     (`maximum-scale=1`).
  2. **Form fields at 16px on phones** (90 fields), so iPhones no longer
     zoom in on a tap.
  3. **Floating buttons:** on phones the insights tab is a round icon above
     WhatsApp, and "Cookie Preferences" moves into the footer beside
     Privacy. `/privacy` says so.
  4. **Arabic catalogue cards** get the quote button and their own spec-sheet
     download, and the private-label band gets "الشهادات", as in English.
     Found on the way, in both languages: the Kalamata card's brine block
     was an icon with nothing under it; it now says it is confirmed during
     quotation, the product page's own position.
  5. **"lactic" → "لاكتيك"** on 12 Arabic spots; the five Arabic spec sheets
     that carried it were rebuilt.
  6. **12px minimum text on phones** (screen only; PDFs unchanged).
  7. **24px link targets on phones:** the foot-of-page row, product-page
     paths, "Back to Media Center", the business card, catalogue links.
  8. **Arabic homepage FAQ button**, as in English.

  All new Arabic labels reuse the site's own wording. New check:
  `check-mobile-basics`. Re-run of the whole phone check afterwards: clean,
  except the consent checkboxes, each inside a label tappable as a whole.

### Owner decisions recorded, 2026-09-28

- **Arabic PDFs: left as they are.** Copying or searching Arabic text in
  them gives the words in reverse order, and the لا pair breaks (الاسم
  extracts as السم). The pages look, print and share correctly. Chromium's
  tagged-PDF option was tested on the company profile and extracted the
  same. The owner decided to leave it: search engines index the Arabic web
  pages, not the PDFs.
- **Pricing example: kept.** `/resources/pricing` and its Arabic twin carry
  a worked example in US dollars, labelled "made-up" throughout. It was
  never in the register; it is now C-135, approved by the owner.
- **C-55** (erasure and issued documents): the owner is checking with a
  lawyer.

### Claim register

- **Added:** C-135 (the pricing example). The register stands at 135 claims.
- **C-55** remains the only `needs-review` row.

### Testing method

The checks in `npm test` grew from 57 to 58. The suite passed on each
branch before its merge and on `main` at `68a0735` after all three.
Each new check or rule was run against `main` before the change and
failed there. Beyond the suite:
- **The phone check itself**, before and after, 85 pages × 2 widths.
- **Chromium:** the Arabic card's download saved `kalamata-olives-ar.pdf`
  and its quote button opened `/ar/contact/`; the footer cookie control
  opened the preferences dialog.
- **`check-locale-switch.js`**, by hand: 36/36.
- **PDFs:** all 42 rebuilt and compared page by page. The five Arabic sheets
  that carried "lactic" changed and no longer contain it; the other 37 were
  identical and kept.

Nothing here was checked against the live site: this environment's egress
policy blocks it.

### Rollback

Each deploy reverts on its own with `git revert -m 1 <commit>`. Reverting
Deploy 89 brings back all eight phone findings and the five Arabic sheets
with "lactic". Deploy 90 is documentation only.

### Known limitations shipped with Deploys 88 to 90

- **Not yet confirmed on the live site:** the phone fixes, and the
  homepage button.
- **Arabic PDF text** copies in reverse word order (above; owner's decision).
- **Enquiry emails** (outstanding item 10) are unchanged; the owner will
  set them later.

**Listed in the next entry:** the merge of this record (notes only).

## Deploys 91 and 92 — The Solutions section (PRs #209, #210)

**Previous recorded deploy:** `68a0735` (Deploy 90, PR #207)
**Approvals:** "merge" (#209, 2026-09-28); the owner's Solutions brief
(2026-09-29), the owner's choices to keep the private-label page where it
is and to build both languages, "rebuild solutions" and "merge" (#210,
2026-10-02).

| Deploy | PR | Production commit | Date (+0300) | Files | Lines | Kind |
|---|---|---|---|---|---|---|
| 91 | #209 | `70c09b9` | 2026-09-29 00:06:17 | 2 | +110 / −2 | Notes only |
| 92 | #210 | `e9cf629` | 2026-10-02 09:35:38 | 103 | +2,518 / −107 | Site change |

Files and lines are each merge against the `main` it landed on. Netlify's
deploy preview succeeded for both before they merged. Whether each
production build succeeded is not visible from here.

**Notes-only deploys listed here, under the recording convention:**
- **Deploy 91** recorded Deploys 88 to 90, and registered C-135.

### What the site change did

- **Deploy 92 — The Solutions section (#210).** Each homepage "Who Are You
  Sourcing For?" card now leads to a page built for that buyer:
  - `/solutions`: the hub, with the six buyer types.
  - `/solutions/importer-distributor`, `/retail` and `/food-service`: built
    only from facts already published (company profile, How We Work,
    Packaging, Export Markets, Supply Network). They link to those pages
    instead of repeating them.
  - `/solutions/manufacturer` and `/solutions/local-egypt`: the owner's
    confirmed copy, word for word (C-137, C-138). The Manufacturer page
    keeps C-36 beside it: our team does formulation, sorting and packaging
    decisions, and the partner facility does the physical processing.
  - Private label keeps `/resources/private-label`, the owner's choice: no
    redirect, so its links, indexing and brief form are unchanged.
  - The same six pages in Arabic under `/ar/solutions`.

  Also:
  - "Solutions" / "الحلول" in the main menu on 81 pages.
  - The homepage Local card corrected. It had implied a 10-ton minimum for
    every format; it now says 10 t for 220 kg barrels and 16–18 MT for
    other packaging (C-138 supersedes C-133).
  - Enquiries from a Solutions page record that page as their source.
  - Cross-links from Packaging, How We Work and Private Label.
  - The 12 pages added to the sitemap.

  The pages are generated by `scripts/generate-solutions-pages.py`, kept
  in the repository. New check: `check-solutions`.

**A lost first attempt.** The section was first built on 2026-09-29 but
never committed. The cloud container was reclaimed while the session was
idle, and the work was lost. It was rebuilt on 2026-10-02 and pushed after
each step, so nothing waits on one container again. Nothing had been
deployed, so nothing live was affected.

### Owner decisions and confirmations

- **Arabic wording:** the owner merged #210 after being asked to review
  the six Arabic pages. That merge is taken as approval of the wording.
- **Local minimums, restated 2026-10-02:** barrels for the local market
  have a 10-metric-ton minimum, and export has a minimum of one full
  container. Both were already on the site.
- **Local segment pages (Section F):** the owner decided not to build
  them for now. `/solutions/local-egypt` stays a standalone page.

### Claim register

- **Added:** C-136 (the section), C-137 (OEM scope) and C-138 (local
  minimums). The register stands at 138 claims.
- **Changed:** C-133 superseded by C-138. C-49's action is closed.
- **C-55** remains the only `needs-review` row.

### Testing method

The checks in `npm test` grew from 58 to 59. The suite passed on the
branch before the merge and on `main` at `e9cf629` after it. The new
check fails on `main` before the change. Beyond the suite:
- **Chromium:** all 12 pages at 390px and 1280px, with no overflow, no
  script errors and no broken images.
- **The full enquiry path:** homepage card → Manufacturer → "Request a
  Quote" → contact form. It showed the intent badge, and on submit sent
  `source_page` as `/solutions/manufacturer`. The API was stubbed, so no
  data was written.
- **PDFs:** the menu change touched the company-profile pages, which are
  PDF sources. Both profile PDFs were rebuilt and compared page by page
  with the committed files. They were identical, so they were kept.

Nothing here was checked against the live site: this environment's egress
policy blocks it.

### Rollback

`git revert -m 1 e9cf629`. That removes the section, the menu item and the
cross-links, and restores the old card links and the old Local card
wording. **The old wording is wrong**, by the owner's own correction, so
correct that card separately if this is reverted. Deploy 91 is
documentation only.

### Known limitations shipped with Deploys 91 and 92

- **Not yet confirmed on the live site:** the Solutions pages, the menu
  item, and an enquiry's source page appearing in the CRM.
- **Search Console:** the sitemap, now with 90 URLs, has not been
  resubmitted.
- **Enquiry emails** (outstanding item 10) are unchanged.

**Listed in the next entry:** the merge of this record (notes only).

## Deploys 93 to 95 — The articles speak as Triple Company, and no trial order (PRs #211 to #213)

**Previous recorded deploy:** `e9cf629` (Deploy 92, PR #210)
**Approvals, all 2026-10-02:** the owner's consolidated brief
("MEDIA/ARTICLE CORRECTIONS + FULL VOICE REWRITE", five decisions
confirmed); "triple company was estabilished in 2025 not 2024"; the
brief "ADD BRINING INVESTMENT TO OUR STORY"; the brief "FIX: HOMEPAGE
PRODUCT COUNT"; "its correct" (Arabic, below); "merge all" (#211, #212,
#213).

| Deploy | PR | Production commit | Date (+0300) | Files | Lines | Kind |
|---|---|---|---|---|---|---|
| 93 | #211 | `5c83d84` | 2026-10-02 11:17:35 | 1 | +110 / −2 | Notes only |
| 94 | #212 | `d2e11ea` | 2026-10-02 11:17:38 | 44 | +294 / −88 | Site change |
| 95 | #213 | `6645306` | 2026-10-02 11:17:41 | 3 | +36 / −9 | Site change |

Files and lines are each merge against the `main` it landed on. Netlify's
deploy preview succeeded for #212 and #213 before they merged. Whether each
production build succeeded is not visible from here.

**Notes-only deploys listed here, under the recording convention:**
- **Deploy 93** recorded Deploys 91 and 92.

### What each site change did

- **Deploy 94 — Articles, trial orders, brining line, dates, founding year
  (#212).** An external audit, read against the 4 August site snapshot,
  found the seven articles written as generic trade advice ("a reputable
  exporter will…") that never named the company, and carrying a
  "trial pallet (100–500 kg)" minimum. The owner's brief settled five
  points:
  1. **No trial order exists.** "Smaller trial quantities may be
     possible…" is gone from the homepage FAQ, `/resources/faq` (with its
     FAQPage JSON-LD), the buyer's guide and company overview (sources and
     PDFs), `llms.txt` and the import guide, in both languages. Each now
     says smaller trial orders are not available and a 1–5 kg sample can
     come first. Minimum: one 20ft container, about 16–18 MT.
  2. **The brining line is real.** The `/media` card carries the owner's
     wording verbatim, with the badge "Investment" / "استثمار" and no date
     (the "September 2025" label is gone). About 2,000 MT is the
     facility's total capacity, not the line's. The same wording, word for
     word, now sits in "Our Story" on `/company-profile`, on page 2 of the
     export catalogue, and in all four PDFs built from them, both
     languages. The article URL `/media/new-brining-line-capacity` still
     answers 410.
  3. **Gulfood was never attended and is not planned.** Nothing to remove:
     no page named it, its URL already answered 410, and it was not in the
     sitemap.
  4. **Real dates.** 42 template dates (February to 2 June 2026) now read
     4 August 2026 / 4 أغسطس 2026: the seven article headers, `/media` and
     `/media/blog`, both languages. None was removed.
  5. **The articles rewritten**, 7 per language (14 pages), in Triple
     Company's own voice and only with registered facts: newly
     established, no export shipment yet; the partner facility in the
     10th of Ramadan, which we do not own; samples confirmed within 24
     hours; the container minimum; Incoterms, currency and payment terms;
     the document set; caliber and brine figures; ten products; packaging
     sizes; Mohamed Abdullah, Sales. Removed with the old text: "issues the
     full set with every container as a matter of routine" (no shipment
     has been made), caliber examples outside the published range, and
     every "reliable / reputable / genuine exporter" sentence. The article
     CTA says "within 24 hours" (C-115) instead of "one business day".

  Also: **founded 2025**, not 2024, on both company-profile pages and in
  `llms.txt` (the schema still has no `foundingDate`, C-25).

  Eight PDFs were rebuilt: the buyer's guide, company overview, company
  profile and export catalogue, each in both languages. The catalogue
  stays at 9 pages (C-130), and page 2 was checked by eye in both
  languages.

  New check: `check-article-claims`. Across every article in both
  languages, it fails on:
  - a minimum other than the container, or a tonnage below 16 MT
  - a certification history, or a certification held by us
  - ownership wording
  - a trade show no verified-approved row names, or any attendance wording
  - a date before 4 August 2026, or a missing date
  - an article whose body never names the company
  - an article no register row covers

  On any page, guide source or `llms.txt`, it fails on a trial order
  below the container.
- **Deploy 95 — "10 Product Varieties" (#213).** The homepage hero stat
  still said 11, in both languages, after Hamed's withdrawal on
  2026-09-28. Deploy 88, recorded as "the last 11 varieties", fixed the
  catalogue button but missed this stat: it sets the number in a `<span>`
  and the label in the next `<p>`, and `check-product-order` read only
  markup, on eight named pages. The Arabic label is now "أصناف", the
  plural that follows 10. The check now reads every public page, guide
  and catalogue source, and `llms.txt`, as text, so a number and its label
  are read together whichever elements hold them. It also reads Arabic
  digits and numbers written as words. It reads 32 product counts on 22
  surfaces, all 10. A sweep of pages, PDFs, schema and `llms.txt` found
  no other 11.

### Owner decisions and confirmations, 2026-10-02

- **The five decisions** above, confirmed in the brief.
- **Founded 2025.**
- **"Our Story"** carries the brining investment, in the card's wording.
- **Arabic approved ("its correct"):** the brining wording, on the card
  and in Our Story, and "أصناف" on the homepage stat.
- **Arabic merged but not separately confirmed:** the seven Arabic
  article bodies and the Arabic no-trial sentence. The owner had been
  asked to review them before "merge all". They are listed as open below.

### Claim register

- **Added:** C-140 (no trial order), C-141 (founded 2025), C-142 (Mohamed
  Abdullah, Sales), C-143 (article dates), C-144 (no trade show claimed).
  The register stands at 144 claims.
- **Changed:**
  - C-127, the brining line: the owner's wording, a 2,000 MT facility
    total, Our Story among its locations, and the Arabic confirmed.
  - C-139, the articles: the full rewrite, and every article routed
    through the register.
- **C-55** remains the only `needs-review` row.

### Testing method

The checks in `npm test` grew from 59 to 60. Before merging, #212 and
#213 were merged together in a throwaway worktree, and the suite passed
there. It passed again on `main` at `6645306` after all three. Beyond the
suite:
- **Bad-article test.** A deliberately bad article in English and
  Arabic, in a throwaway worktree, failed 8 of the 11 article checks. It
  caught the trial pallet, kilogram and 5-ton minimums, recertification,
  "our ISO", Gulfood / جلفود, "Visit us at" / "زورونا في", "our own factory" /
  "نمتلك مصنع", the early dates, a nameless article and an unregistered
  one. The test found two gaps in the check itself, both fixed:
  - JavaScript's `\b` does not work before Arabic letters
  - the Arabic headlines' company suffix let a nameless body pass
- **Planted counts.** In a throwaway worktree, the count check failed on
  all five planted values: "11 Product Varieties", "١١ أصناف", "eleven
  products", "أحد عشر منتجًا" and "11 products" in `llms.txt`.
- **The "before" state.** `main` before the change failed the article
  check on the trial pallet, 40ft, the exporter voice, "certified,
  traceable supplier", the unnamed articles and 23 early dates.
- **Chromium.** The import and choosing articles and `/media` were opened
  at 390px and 1280px in both languages, with no overflow and no script
  errors. Every page shows its date.
- **PDFs.** All 42 match their sources (`check-guide-pdfs`). The text of
  the rebuilt PDFs carries 2025, the brining sentence and the no-trial
  sentence.

Nothing here was checked against the live site: this environment's egress
policy blocks it.

### Rollback

Each deploy reverts on its own with `git revert -m 1 <commit>`:
- **Reverting Deploy 94** brings back the trial wording, "Founded 2024",
  the template dates, the dated "lifts capacity past 2000 MT" card, and
  the generic articles with their trial-pallet minimum. All of these are
  wrong, by the owner's own decisions.
- **Reverting Deploy 95** brings back "11" on the homepage.
- **Deploy 93** is documentation only.

### Known limitations shipped with Deploys 93 to 95

- **Not yet confirmed on the live site:** any of the above.
- **Arabic review open:** the seven Arabic article bodies and the Arabic
  no-trial sentence.
- **`scripts/crm-seed.js`**, a CRM test fixture, still says "Trial order,
  500 units". It is dummy data, not site copy.
- **Search Console:** the sitemap has not been resubmitted.
- **Enquiry emails** (outstanding item 10) are unchanged.

**Listed in the next entry:** the merge of this record (notes only).

## Deploys 96 to 106 — A second audit checked, buckets, /products, Company News, and the floating quote button (PRs #214 to #224)

**Previous recorded deploy:** `6645306` (Deploy 95, PR #213)
**Approvals, all 2026-10-02:** "merge" (#214); "fix 9, keep 10 as it is" (#215,
C-145); bucket sizes "a", "yes" to the /products redirect, "merge all"
(#215, #216, #217); "where is the artical we shuld have here" and "merge"
(#218); the floating quote button, option A ("i changed my mind lets do A"),
then "merge all" (#218, #219); "fix it" for the header and "change the
colour" (#220, "merge"); the insights tab "fix this" (#221, "merge"); the
Facebook pill "fix that" and "do your recommendation" for the button
(#222, #223, "merge"); "keep it only in mobile view" (#224, "merge").

| Deploy | PR | Production commit | Date (+0300) | Files | Lines | Kind |
|---|---|---|---|---|---|---|
| 96 | #214 | `265533c` | 2026-10-02 15:59:43 | 1 | +173 / −2 | Notes only |
| 97 | #215 | `6c4d579` | 2026-10-02 16:37:16 | 7 | +16 / −8 | Site change |
| 98 | #216 | `fb1fa44` | 2026-10-02 16:37:19 | 24 | +57 / −35 | Site change |
| 99 | #217 | `72bd9cf` | 2026-10-02 16:37:21 | 2 | +40 / −0 | Site change |
| 100 | #218 | `74f35a5` | 2026-10-02 17:06:28 | 5 | +26 / −11 | Site change |
| 101 | #219 | `8366f7c` | 2026-10-02 17:06:31 | 8 | +168 / −50 | Site change |
| 102 | #220 | `4ed93ba` | 2026-10-02 17:25:12 | 4 | +116 / −53 | Site change |
| 103 | #221 | `e0a6cba` | 2026-10-02 17:31:33 | 2 | +47 / −0 | Site change |
| 104 | #222 | `affb308` | 2026-10-02 19:08:56 | 4 | +61 / −58 | Site change |
| 105 | #223 | `5b2868d` | 2026-10-02 19:18:59 | 4 | +147 / −60 | Site change |
| 106 | #224 | `a77f662` | 2026-10-02 19:27:06 | 4 | +54 / −44 | Site change |

Files and lines are each merge against the `main` it landed on. Netlify's
deploy preview succeeded for the site changes before they merged. Whether
each production build succeeded is not visible from here.

**Notes-only deploys listed here, under the recording convention:**
- **Deploy 96** recorded Deploys 93 to 95.

### A second external audit, checked before anything was changed

On 2026-10-02 the owner pasted a second external audit. It reported that
`/products` was "a stale clone of the old homepage", that four retired
`/media` posts were still in the sitemap, that `/media` rendered empty, and
that bucket sizes disagreed. Each point was checked against the repository
first:

- **`/products`, the four posts, the empty `/media`:** not true of the
  site as deployed. `/products` had no page and answered 404. The four
  posts already answered 410 and were not in the 90-URL sitemap. `/media`
  is static HTML. All three match the old single-page app's fallback,
  which answered every address with the homepage until the system health
  audit removed it (run 1, B5). The audit's crawl predates that.
- **The owner's own checks of the live site:** `olivesegypt.com/products`
  showed the 404 page, so production is current. `www.olivesegypt.com`
  did not load at all. That is the `www` item below.
- **Buckets:** true, and older than the article rewrite. Fixed in Deploy 98.
- **The audit's drafted `/products` page** was not used. Its brine figures
  matched the product pages, but it added claims no register row supports:
  - that varieties can be mixed in one container
  - "machine-stuffed"
  - "European food service"
  - that sliced and custom calibers are available
  - buckets of 2–20 kg (at the time)

  It would also have duplicated `/catalog`.

### What each site change did

- **Deploy 97: one reply time (#215).** `/media` and `/media/inquiries`,
  in both languages, said media and trade requests get a reply "within one
  business day". They now say 24 hours, like every form, the FAQ and the
  articles (C-115). `check-article-claims` fails on "one business day" or
  "يوم عمل واحد" on any page or guide. The How We Work wording the owner
  chose to keep is registered as C-145: a sample pack within 5–7 business
  days, and T/T deposits, L/C at sight and negotiable terms.
- **Deploy 98: buckets are 2, 5, 10 and 20 kg (#216).** The homepage
  table said so. The packaging pages, Food-Service, two articles, two
  guides and the export catalogue said "typically 1–10 kg". The owner
  confirmed the homepage (C-146). Fourteen places changed across both
  languages, the Solutions generator reproduces its pages byte for byte,
  and six PDFs were rebuilt with their page counts unchanged.
  `check-packaging-claims` fails on the old range anywhere, and on either
  homepage table losing one of the four sizes.
- **Deploy 99: `/products` → `/catalog` (#217).** A permanent redirect
  for `/products` and `/ar/products` (both slash forms), forced. The ten
  product pages beneath are untouched. `check-not-found` asserts both
  redirects and that all 20 product pages are still served from their own
  files.
- **Deploy 100: Company News (#218).** `/media/news` and its Arabic twin
  still showed "Company updates will appear here", while the brining-line
  announcement was on `/media`. Both now carry the same card, word for
  word, plus a pointer to the blog and the catalogue. `check-article-claims`
  requires each news card on `/media` to appear verbatim on `/media/news`.
- **Deploy 101: a floating "Request a Quote" button (#219).** It sits in
  the corner opposite WhatsApp: bottom-left in English, bottom-right in
  Arabic, using `inset-inline-start`. It opens `/contact?intent=quote` and
  is added by `site-nav.js` on every page that has the WhatsApp bubble,
  never on `/contact`. The cookie control left that corner for the footer
  at every width, and `/privacy` and `/ar/privacy` now say so. The Arabic
  had said "bottom-left", which was already wrong on Arabic pages. The
  footer gained room at its foot, and the cookie banner lifts the button
  clear of itself.
- **Deploy 102: the header on laptops, and a gold button (#220).** Since
  "Solutions" joined the menu, the English header needed 1242px, while the
  full menu switched on at 1024px. Any window 1024–1240px wide scrolled
  sideways and cut off the logo, as in the owner's screenshot. The header
  now tightens between 1024 and 1279px, and English keeps the drawer below
  a set width, with the drawer laid out as on a tablet. The button turned
  gold with dark olive text, and it now also hides while the menu drawer
  is open, which #219 had missed.
- **Deploy 103: the insights tab steps aside (#221).** Pinned to the
  middle of the edge, the "Read Our Insights" tab covered the footer's
  WhatsApp link (1100–1280px) or "Request a Sample" (1440px) at the end
  of every page, in both languages. It now fades once the footer reaches
  it, leaves the tab order, and returns when the reader scrolls up.
- **Deploy 104: the Facebook "Follow" pill keeps its label (#222).**
  Deploy 102 had shown the button as an icon only on laptops, which the
  owner saw as the old square icon. The label now shows at every width.
  To make room, English pages show the full menu from 1200px and keep the
  drawer below it. Arabic, which needs 939px, keeps the full menu from
  1024px.
- **Deploy 105: the button's design (#223).** The owner chose the
  recommended combination:
  - **Look:** a gold gradient with a paper-plane icon, a soft glow and a
    top highlight; dark text at 4.7:1 or better.
  - **On phones:** it shrinks to a round icon while scrolling down and
    reopens on scrolling up, after a pause, or near the top.
  - **Pulse:** a single gold pulse five seconds into a visit, once per
    visit, never under reduced motion.

  Testing found two Arabic rendering faults, both fixed before merge:
  - letter-spacing pulled the joined letters apart
  - the label's tight line clipped letters below the baseline
- **Deploy 106: phones only (#224).** The header shows its own "Request a
  Quote" from 768px, so the floating button now shows only below 768px,
  and the footer room is phones-only too. At every width exactly one quote
  button is on screen.

### Owner decisions recorded, 2026-10-02

- **How We Work wording:** kept as it is (C-145).
- **Buckets:** 2, 5, 10 and 20 kg (C-146).
- **`/products`:** a redirect to `/catalog`, not a second product page.
- **Floating quote button:**
  - first declined (option C)
  - then chosen (option A)
  - made gold
  - given the recommended design
  - limited to phones
- **Facebook:** the "Follow" pill with its label, at every width.
- **`www.olivesegypt.com`:** the domain is at GoDaddy. The steps were
  given: add `www` as a Netlify domain alias, and add a `www` CNAME to
  `stirring-manatee-ca2643.netlify.app`. Not yet confirmed done.

### Claim register

- **Added:** C-145 (How We Work wording) and C-146 (bucket sizes). The
  register stands at 146 claims.
- **Changed:**
  - C-115: lists the articles' call to action and the two media pages
  - C-127: lists `/media/news`
- **C-55** remains the only `needs-review` row.

### Testing method

The checks in `npm test` grew from 59 to 60. That was `check-article-claims`
in Deploy 94; the deploys here add rules to existing checks. The suite
passed on each branch before its merge and on `main` at `a77f662` after
all of them. Pairs merged together (#215–#217, #218–#219) were first
merged in a throwaway worktree and tested there. Every new rule or
assertion was run against `main` before its change and failed there.
Beyond the suite:
- **Chromium, header:** all 92 browsing pages at nine widths from 1024 to
  1366px. No sideways scroll, the logo whole, the "Follow" label visible,
  and the full menu or the drawer where intended.
- **Chromium, floating buttons:**
  - 6 pages × 3 widths × light and dark × with and without the cookie
    banner
  - corners, no overlap, every footer link clear
  - a control run with the footer room removed showed the button covering
    Privacy and Cookie Preferences
  - the phone shrink, expand and pulse behaviour, including reduced motion
  - from Deploy 106, one quote button on screen at seven widths
- **PDFs:** the stylesheet is an input to all 42. Each time it changed,
  all 42 were rebuilt and compared page by page (text, links, pixels).
  They were identical every time, so the committed files were kept and
  only the fingerprints recorded. In Deploy 98, six PDFs changed in content
  and were rebuilt.

Nothing here was checked against the live site: this environment's egress
policy blocks it. The owner checked `/products` and `www` by hand.

### Rollback

Each deploy reverts on its own with `git revert -m 1 <commit>`.
- **Deploy 98:** reverting brings back "1–10 kg".
- **Deploy 99:** reverting returns `/products` to a 404.
- **Deploys 101–106 build on each other:** revert newest first. Reverting
  101 alone would leave the later CSS without the button it styles.
- **Deploy 96** is documentation only.

### Known limitations shipped with Deploys 96 to 106

- **`www.olivesegypt.com` does not load.** The DNS steps at GoDaddy are
  with the owner.
- **Not yet confirmed on the live site:** all of the above.
- **Arabic awaiting the owner's review:**
  - the bucket wording ("بأحجام 2 و5 و10 و20 كجم")
  - the `/media/news` pointer line
  - the privacy sentence
  - from earlier, the seven Arabic article bodies and the no-trial sentence
- **Search Console:** the sitemap has not been resubmitted.
- **Enquiry emails** (outstanding item 10) are unchanged.

**Listed in the next entry:** the merge of this record (notes only).

---

## Companion repo (`umami-olivesegypt`)

No commits were made to this repository in any session covered by this
record. It remains at the upstream `umami-software/umami` state as of the
last sync. It is not part of the changed-file scope of any deploy above.
**Changed 2026-09-28 (Deploys U1 and U2).** The first commits to this
repository: Next.js 16.3.3, then patched versions of every package with a
known advisory, using `pnpm.overrides`. Only `package.json` and
`pnpm-lock.yaml` changed; Umami's own code did not. The fork is otherwise
still at the upstream state as of the last sync. See the entry for Deploys 56
to 71.
**Unchanged through Deploy 106 (2026-10-02).**

## Outstanding, unresolved by this document

1. **Section D has never been run against actual production**, for any
   deploy, because production's own reachability is unconfirmed (parked
   domain/DNS issue). Still true after Deploy 4 — this session's network
   egress to `olivesegypt.com` is itself blocked (sandbox policy, not
   evidence about the domain), so even that limited check couldn't be
   attempted this time.
   **Partly overtaken 2026-09-20:** the Netlify dashboard confirms the site
   builds and publishes (see item 5), and its entry carries a domain badge and
   a padlock, which suggests the parked-domain problem this item describes is
   no longer current. That is read off an icon, though, not a request, so it is
   noted rather than claimed — and Section D itself is still not done, because
   nobody has checked the live site's *content* against what was shipped. The
   egress block in this environment is unchanged, so that check stays with the
   owner.
   **Materially changed 2026-09-24 (Deploy 21):** production has now been
   observed directly for the first time. The owner opened
   `olivesegypt.com/api/crm/auth/me` in a browser and it returned Netlify's own
   404 page, which is what identified the outage. That settles the underlying
   question this item has carried since Deploy 1 — **the domain resolves, serves
   from this Netlify site, and is reachable over HTTPS; the parked-domain
   problem is genuinely gone**, established by a request rather than read off an
   icon. It also proved the opposite of what everyone had assumed: the first
   real look at production found it broken. Section D still is not done —
   nobody has compared the live site's *content* against what was shipped — and
   the egress block here is unchanged, so that part stays with the owner. What
   changes is that this item is no longer about whether production can be
   reached at all.
   **Further, 2026-09-24 (Deploys 22–24):** the owner has now checked live
   *behaviour* on four occasions — the CRM login redirect, a gated form
   submission, the `/api/crm/auth/me` response, and `/netlify/functions/`.
   That is still not Section D, which asks whether the live site's **content**
   matches what was shipped, and nobody has done that for any deploy. But the
   checks have become routine rather than unprecedented, and two of this
   session's four bugs were found by them. The remaining obstacle is unchanged:
   this environment's egress to the domain is blocked, so live checks are the
   owner's to run and to report back.
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
   **Partly overtaken 2026-09-28 (Deploy 70).** All 16 gated PDFs,
   including the English catalogue, were rendered and every page looked at.
   All pages were seen at contact-sheet size, and the first pages at readable
   size. `check-guide-pdfs` now fails when a PDF no longer matches its
   source. The four printable pages (`company-profile`, `letterhead`,
   `business-card`, `catalog/print`) are still checked only as source HTML.
   **Narrowed 2026-09-28 (Deploys 79 and 81).** `company-profile` and
   `catalog/print` are now printed to PDF, fingerprinted and checked by
   `check-guide-pdfs`, in both languages. Only `letterhead` and
   `business-card` remain checked as source HTML.
4. **Certificates remain unverified** — nothing certificate-dependent has
   been published, per A1/Rule 3, and that has not changed since
   `evidence-needed.md` was written.
5. **Whether the Netlify production build for any/all of the 8 Deploy 4
   merges actually succeeded is unconfirmed** — this session has no
   Netlify API or dashboard access. The site owner should check the
   Netlify dashboard directly and, if the latest production deploy shows
   failed or stale, trigger a fresh one manually. **The same is true of every
   merge in Deploys 6 to 18** -- 37 in Deploys 6 to 10, six in Deploy 11,
   one in Deploy 12, two in Deploy 13, eight in Deploy 14, four in
   Deploy 15, three in Deploy 16, two in Deploy 17 and two in Deploy 18,
   65 in all --
   for the same reason, and it is the one thing in this document only the
   owner can settle. Updated 2026-09-19 with Deploy 14: the owner elected to
   record that deploy without checking the dashboard first, so the count
   grows rather than closing.

   **SETTLED 2026-09-20, and mostly answered rather than partly.** The owner
   opened the Netlify dashboard and sent its site list. `olivesegypt.com`
   deploys from GitHub and had **published at 00:38** — the same minute
   `4b82c67` (#130) merged, `2026-09-20 00:38:02 +0300`. So merging to `main`
   does trigger a build, the build succeeds, and it goes live in under a
   minute. That is the pipeline this document has assumed for eighteen deploys
   and never confirmed.

   It also makes the count above far less interesting than it looked.
   Production is a static publish of the repository at a commit, and the
   published commit is the tip — so the content of all 65 merges is live now,
   whether or not any individual build along the way failed. What the count was
   really measuring is how long the site might have been *stale* at some past
   moment, not whether anything is missing today.

   **What remains unconfirmed, and it is narrow:** whether any earlier build
   failed, which would mean the site was stale for some window. The dashboard's
   site list shows only the latest publish; the per-site Deploys tab lists every
   build with its commit and status and would settle it. The published commit
   SHA is therefore inferred from the timestamp match rather than read. See
   C-98.

   **Updated 2026-09-24 with Deploy 19.** The count this item used to grow no
   longer applies. The mechanism is settled, so the open question is not whether
   merges build but whether any individual build failed. Six merges have landed
   since the confirmation and none of their publishes was observed — a different
   and much smaller gap than the one this item opened with, and worth stating as
   such rather than growing a number that no longer measures anything.
6. **This record ran ten days behind production.** Deploy 5 was written on
   2026-09-05 and nothing was added until 2026-09-17, while PRs #63 to #98
   merged and built. The claim register kept pace throughout; this file did
   not. Deploys 6 to 10 were reconstructed from git history on 2026-09-17,
   and the preamble to that block says exactly which parts are read from the
   repository and which are not. The gap is cheap to avoid and expensive to
   close after the fact: a deploy entry belongs in the pull request that
   merges, not in a catch-up pass twelve days later.
   **Closed 2026-09-18:** Deploy 11 was written as part of the work it
   describes, in the same session, which is what this item asks for. The
   lesson stands rather than the gap.
7. **Deploys 6 to 10 carry no per-deploy verification tables**, unlike
   Deploys 1 to 5. `npm test` ran at merge time — it is now 25 suites, and
   several of them exist because of defects found during those deploys
   (`check-nav-handlers.js`, `check-crm-schema.js`, `check-crm-errors.js`,
   `check-packaging-claims.js`) — but the output was not captured per
   deploy, and re-running it against each historical commit now would not
   reproduce what was observed then. Numbers that were never observed have
   deliberately not been written down.
8. **Analytics data past its retention window was never deleted, and still
   has not been** (opened 2026-09-25, Deploy 26). `purge()` in
   `analytics-retention.js` threw on every scheduled run from 2026-09-01 to
   2026-09-25 — see C-105 — so the retention job has never removed a single
   row. Deploy 26 fixes the call, which means the job works from now on and
   will begin deleting what is past the window on its next run. What it does
   not do is decide anything about the three and a half weeks of data that
   accumulated in the meantime, or about whether anyone needs to be told that
   a stated retention period was not honoured while it was broken. That is a
   question for whoever holds C-55, alongside the privacy values still with
   the lawyer, and it is recorded here so it is not quietly absorbed into
   "fixed". Nothing about it is settled by any deploy in this document.
9. **The suite passed throughout a total CRM outage** (opened 2026-09-25,
   Deploy 26). Every test double granted a `.query` the real Neon handle does
   not have, so eighteen broken calls were green in CI while the buyer update,
   the whole analytics report and the retention purge all threw in production.
   `check-neon-call-shapes.js` closes this for the Neon driver specifically —
   it holds both the functions and the doubles to a real handle. The general
   question it raises is not closed: every other double in this suite is
   hand-written, and nothing checks that any of them still resembles what it
   stands in for. No audit of the rest has been done, and this item exists so
   that absence is on the record rather than assumed.
   **Two more instances, 2026-09-26 and 27 (Deploys 36 and 41), found by
   accident rather than by audit:**
   - `check-inquiries-access.js`'s double answered `INSERT … RETURNING` with
     nothing, which Postgres never does. It was corrected in Deploy 36.
   - `check-buyer-edit-validation.js`'s double recognised a query only by its
     exact text. Adding `deleted_at` to that query made the double treat
     every buyer as missing. It was corrected in Deploy 41.

   Both were caught because the change under test broke them, which is the
   lucky direction. The unlucky direction, a double that keeps passing after
   the real thing changes, is exactly what this item is about, and it is
   still unaudited.
   **A method that does not depend on doubles now exists:** running the real
   handlers and the real Neon driver against a real PostgreSQL. Deploys 36
   and 41 to 43 were verified that way, by hand. It is not part of `npm
   test`.
10. **An enquiry arrives and no human is told** (promoted to an outstanding
    item 2026-09-25, Deploy 31; carried as a per-deploy limitation since
    Deploy 11, where it kept disappearing). `netlify/functions/inquiries.js`
    already calls `sendNotification` on every saved enquiry, unconditionally,
    with Reply-To set to the enquirer. It is silent because **`NOTIFY_EMAIL`
    and/or `RESEND_API_KEY` are unset** — the send is skipped, logged
    `status=skipped`, and the failure is deliberately swallowed so a buyer
    never sees an error for an enquiry that saved correctly.
    **A correction that matters, and it is this assistant's:** this was
    repeatedly described in conversation as "`LEADS_NOTIFY` is unset", which
    conflated two paths and went into the owner's own work brief.
    `LEADS_NOTIFY` is a boolean switch gating only the **gated-guide
    download** notifications in `leads.js`. Setting it would not deliver a
    single contact-form enquiry. `docs/email-delivery.md` had it right all
    along; the shorthand did not.
    A second trap sits behind it, documented at §3 of that file:
    `NOTIFY_FROM_EMAIL` unset defaults to Resend's sandbox sender, which
    delivers only to the address the Resend account is registered under — so
    routing to two mailboxes fails silently even once `NOTIFY_EMAIL` is set.
    All of these are Netlify dashboard values by deliberate design, so no
    deploy in this document can close this. It is the highest-value open item
    here: every other thing on this list is about accuracy, and this one is
    about a buyer's enquiry reaching a person.
    **Narrowed 2026-09-26 (Deploy 36), not closed.** Every saved enquiry now
    also becomes a pipeline entry with a next action due the following day, so
    an unanswered one appears in the CRM dashboard's overdue list. That reaches
    a person **who opens the CRM**. It is still not a notification: nothing
    reaches anyone who does not look, and the fix above is unchanged.
    **Raised again 2026-09-27 (Deploy 43).** The new failure alerts use the
    same email path, so they are silent for the same reason. Setting the
    three values now switches on two things at once: enquiry notifications
    and failure alerts. A real buyer's quote request arrived on 2026-09-27 and
    reached nobody's inbox. The buyer is deliberately not named here: this
    repository is public.
    **Wider than it looked, 2026-09-27 (Deploy 46).** The gated guide
    downloads, market-brief signups and private-label briefs in
    `leads_staging` had no route to a person at all: no screen, and only
    this email. Deploy 46 puts them on the CRM's Enquiries page. The email
    remains the only route that *notifies*.
    **Unchanged at Deploy 71 (2026-09-28).** The first system health audit
    raised it again (C4). The three values are still unset, and nothing in
    Deploys 56 to 71 could set them.
    **Unchanged at Deploy 106 (2026-10-02).** The owner will set the values later.
11. **Three owner decisions opened by Deploys 35 and 36** (opened 2026-09-26).
    None is a code task, and all three are live now.
    - **C-112 — the privacy notice.** A consenting visitor's enquiry is now
      linked to their analytics session. Whether `/privacy` must say so is a
      question for whoever holds C-55, alongside the retention values already
      with the lawyer.
    - **C-114 — the assistant's calls in building intake:**
      - Egypt → Africa, Turkey → Middle East, Russia → Europe (non-EU),
        Iran → Middle East
      - next action due the following day
      - the wording of each next action

      These were put to the owner and not yet answered.
    - **C-115 — the 24-hour reply promise.** "We respond within 24 hours",
      and on `/sample` "confirmed within 24 hours by a dedicated export account
      manager", appear across the site in both languages and in every form's
      success message. Neither was ever in the register. They are registered
      now as unverified, and nothing on the site was changed. Deploy 36's
      due-date rests on the first; the second also asserts a role the register
      has no evidence for.

    **Answered 2026-09-27, all three.**
    - **C-112:** disclose, and re-ask everyone under the new text (PR #157).
    - **C-114:** confirmed, except Turkey, which goes to Unassigned because it
      is an olive exporter (PR #158).
    - **C-115:** confirmed as published.

    This item closes when #157 and #158 merge. **One new question replaces
    it:** C-117, whether `/privacy` should describe the network-owner lookup
    made from a consenting visitor's IP address. That belongs alongside
    C-55.
    **Answered the same day:** the owner said to describe it, and #157 now does.
    Item 11 closes in full when #157 and #158 merge.
    **CLOSED 2026-09-27 (Deploys 38 and 39).** Both merged. One thread is left
    and recorded on C-112 and C-117 rather than here: whether the owner has
    reviewed the Arabic wording that shipped in Deploy 38. **They have:
    confirmed 2026-09-27. Nothing of item 11 remains.**
12. **A visitor's "delete my data" request cannot yet be carried out in full
    from the CRM** (opened 2026-09-27, Deploy 49). `/privacy` says a visitor
    can ask for their information to be deleted.

    **What the CRM can do now:**
    - Delete the enquiry or request permanently (Deploy 49).
    - Delete a visitor's analytics sessions by visitor ID, from
      `/admin/analytics`.

    **What it cannot do, when the enquiry was added to the pipeline:**
    - The buyer's delete is a **soft** delete. It hides the record and keeps
      the name, email, phone and notes.
    - The buyer's activity log holds a copy of the original message.

    Honouring such a request today would need a database administrator.
    Whether soft-deleted buyers should be erasable, and how that squares with
    keeping sales history (C-55), is a decision for the owner. It is
    recorded here so the promise on `/privacy` is not assumed to be fully
    backed.

    **Decided and built, 2026-09-27 (Deploy 55).** The owner decided that an
    ordinary Delete hides a buyer from the CRM but keeps it recallable, and
    that a buyer who asks to be deleted is erased fully. The buyer page now
    has an Erase button for that, and it no longer needs a database
    administrator. **Still open:** whether Erase should also remove documents
    already issued (see Deploy 55's known limitations), and confirmation on
    the live site.
    **Confirmed on the live site by the owner, 2026-09-27.** Only the
    question of issued documents remains open.
