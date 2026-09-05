# Image Asset Rights Register

Required by Section I2. Tracks every non-decorative image asset in use on
olivesegypt.com: its source, license/permission status, photographer or
owner, attribution requirement (if any), the routes it's used on, and a
replacement/rollback path if permission is ever revoked or found invalid.

**Status as of this pass: incomplete by necessity.** For the rows marked
`UNCONFIRMED` below, I (Claude) have no record of where the file actually
came from — there's no prior documentation of it anywhere in this repo, and
nothing in my current context establishes it. I'm not willing to guess a
source/license and write it down as fact. Please fill in the `Source`,
`License / permission`, `Photographer / owner`, and `Attribution required`
columns for each `UNCONFIRMED` row (or tell me and I'll fill them in), and
correct anything below that's wrong.

Until this is resolved, treat every `UNCONFIRMED` image as **not verified
for continued public use** — it's live on the site today because it
predates this register, not because its rights have been checked.

## Removed: AI-generated images presented as product photography

On 2026-09-01 the site owner confirmed that a set of images were AI-generated,
not real photographs. Two of them were independently confirmed by visual
inspection before removal — `product-olives-*.png` (illegible "PREMIUM OLIVE"
label text, a classic generation artifact) and `pack-glass-jar-*.png` (an
impossible ghosted/mirrored olive reflection inside the jar). The rest shared
the same generated-set style (matte cream background, studio bowl/jar
mockups) and are treated as the same finding.

This was a correctness problem, not just a licensing gap: these images were
presented on `/` and `/catalog/` as if they depicted the company's actual
products and packaging — which matters more on a B2B bulk-sourcing site than
it would elsewhere, since buyers reasonably use product photos to judge what
they'd receive. Per the same standard already applied to unverified
certifications, testimonials, and stats elsewhere on this site (00-operating-
rules.md, A2), a synthetic image standing in for a real one without
disclosure isn't acceptable, so all ten were pulled rather than kept or
merely re-labeled.

**Removed files** (both `.png` and `.webp`, deleted from the repo entirely):
`product-olives-Czu-4B66`, `olive-stuffed-new-DaolBs_S`,
`product-artichoke-BcJmf6HG`, `product-jalapeno-DryjKuRg`,
`product-oxidized-black-DxiA-pgL`, `product-pepperoncini-DGyo-dAO`,
`pack-glass-jar-BuC1ebgY`, `pack-tin-can-0lFY_SVX`, `pack-bucket-CIj_f92p`,
`pack-barrel-F3kESlJ-`.

**Replaced with**: `assets/photo-pending.svg`, a plain branded graphic (site
colors, an olive-branch icon, and the text "Product photography pending") —
not a photo, and not presented as one. Wired into the same six `<img>` slots
on `/` and `/catalog/` with honest alt text (e.g. "Marinated Artichoke
Hearts — photography pending"). The four affected `Product` entries in
`/catalog/`'s JSON-LD (`artichoke`, `jalapeno`, `oxidized_black`,
`pepperoncini`) had their `"image"` field removed rather than pointed at the
placeholder, so search engines aren't told a generic "pending" graphic is a
product photo.

**Still real product photography above** (`olive-aggizi-*`, `olive-
manzanilla-*`, `olive-black-*`, `olive-hamed-*`, `olive-toffahi-*`) — visually
inspected during this same pass, no generation artifacts found in any of
them. Ownership of these five confirmed directly by the site owner
(2026-09-03); see the table below.

**Next step**: whenever real photography exists for the six removed
products/packaging shots, send the files and I'll wire them in — following
the same rule as everything else on this site, a real photo needs a known,
confirmed source before it goes live representing an actual product.

**Update, this pass**: five of the six removed product slots (all except the
generic hero image) now show a distinct per-product illustration —
`assets/illus-jalapeno.svg`, `illus-artichoke.svg`, `illus-pepperoncini.svg`,
`illus-oxidized-black.svg`, `illus-stuffed.svg` — instead of the single
generic `photo-pending.svg` graphic. Same rule applied: these are original,
self-made line-art icons (not photos, not AI-generated, not attempting
photorealism), each keeping the same "Product photography pending" text
baked into the graphic and the same honest alt text pattern. This replaces
sameness (one identical graphic for five different products) with
recognizability (a distinct shape per product), not a step toward looking
like real photography. `photo-pending.svg` itself is untouched and still
covers the generic homepage hero slot and the 4 packaging-format slots,
which are out of scope for this pass. Still no real photography for any of
these six — the "send the files" next step above still stands.

## Brand / icon assets

| File | Used as | Source | License / permission | Photographer / owner | Attribution required | Routes | Rollback |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `logo.png`, `assets/logo-*.png` | Header/footer logo, letterhead, business card | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | Nearly every page | Remove `<img>`/schema `logo` reference; site still functions without it |
| `favicon-48.png`, `favicon-96.png`, `icon-192.png`, `icon-512.png`, `apple-touch-icon.png`, `favicon.ico` | Browser tab icon, home-screen icon, `site.webmanifest` icons | UNCONFIRMED (all derived/resized from the same master mark — likely the same origin as `logo.png`, not independently verified) | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | All pages | Revert to a plain-text or generic icon if the mark's rights can't be confirmed |
| `favicon.svg` | *(removed this pass)* | — | — | — | — | — | Was an orphaned placeholder (a plain orange rounded square, `#FF3C00`, not the brand's actual green/gold mark) linked from only one page; deleted rather than fixed since it wasn't serving its purpose anywhere |

## Product / catalog photography

| File | Depicts | Source | License / permission | Photographer / owner | Attribution required | Routes | Rollback |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `assets/olive-aggizi-*.jpg` | "Aggizi Green Olives" | Owner-confirmed | Owned by Triple Company | Triple Company for Industrial Development | No | `/`, `/catalog/`, `/catalog/print` | Swap file or fall back to no image |
| `assets/olive-manzanilla-*.jpg` | "Manzanilla Green Olives" | Owner-confirmed | Owned by Triple Company | Triple Company for Industrial Development | No | `/`, `/catalog/`, `/catalog/print` | Swap file or fall back to no image |
| `assets/olive-black-*.jpg` | "Natural Black Olives" | Owner-confirmed | Owned by Triple Company | Triple Company for Industrial Development | No | `/`, `/catalog/`, `/catalog/print` | Swap file or fall back to no image |
| `assets/olive-hamed-*.jpg` | "Hamed Green Olives" | Owner-confirmed | Owned by Triple Company | Triple Company for Industrial Development | No | `/catalog/`, `/catalog/print` | Swap file or fall back to no image |
| `assets/olive-toffahi-*.jpg` | "Toffahi Green Olives" | Owner-confirmed | Owned by Triple Company | Triple Company for Industrial Development | No | `/catalog/`, `/catalog/print` | Swap file or fall back to no image |
| ~~`assets/olive-stuffed-new-*.png`~~ | *(removed — AI-generated, see above)* | — | — | — | — | — | Replaced with `photo-pending.svg` |
| ~~`assets/product-artichoke-*.png`~~ | *(removed — AI-generated, see above)* | — | — | — | — | — | Replaced with `photo-pending.svg` |
| ~~`assets/product-jalapeno-*.png`~~ | *(removed — AI-generated, see above)* | — | — | — | — | — | Replaced with `photo-pending.svg` |
| ~~`assets/product-oxidized-black-*.png`~~ | *(removed — AI-generated, see above)* | — | — | — | — | — | Replaced with `photo-pending.svg` |
| ~~`assets/product-pepperoncini-*.png`~~ | *(removed — AI-generated, see above)* | — | — | — | — | — | Replaced with `photo-pending.svg` |
| ~~`assets/product-olives-*.png`~~ | *(removed — AI-generated, see above)* | — | — | — | — | — | Replaced with `photo-pending.svg` |
| ~~`assets/pack-glass-jar-*.png`, `pack-tin-can-*.png`, `pack-bucket-*.png`, `pack-barrel-*.png`~~ | *(removed — AI-generated, see above)* | — | — | — | — | — | Replaced with `photo-pending.svg` |
| `assets/photo-pending.svg` | Neutral "photography pending" placeholder (self-made 2026-09-01) | Made for this site, 2026-09-01 | N/A — original graphic, no external source | Claude, as part of this project | None | `/` (hero product slot, aria-labelled generically, and the 4 packaging-format slots — Glass Jar, Tin Can, Plastic Bucket, Plastic Barrel); also used in the B2B export catalog PDF's cover slot only (the 5 product slots there now use their per-product illustration, see below) | Delete and revert to no-image styling if a different placeholder treatment is preferred |
| `assets/illus-jalapeno.svg` | Per-product "photography pending" illustration — sliced jalapeño rings (self-made this pass) | Made for this site, this pass | N/A — original graphic, no external source | Claude, as part of this project | None | `/`, `/catalog/`, `/catalog/print`, `/products/sliced-jalapeno-peppers`, B2B export catalog PDF | Delete and revert to `photo-pending.svg` or no-image styling |
| `assets/illus-artichoke.svg` | Per-product "photography pending" illustration — artichoke heart (self-made this pass) | Made for this site, this pass | N/A — original graphic, no external source | Claude, as part of this project | None | `/`, `/catalog/`, `/catalog/print`, `/products/marinated-artichoke-hearts`, B2B export catalog PDF | Delete and revert to `photo-pending.svg` or no-image styling |
| `assets/illus-pepperoncini.svg` | Per-product "photography pending" illustration — pepperoncini peppers (self-made this pass) | Made for this site, this pass | N/A — original graphic, no external source | Claude, as part of this project | None | `/catalog/`, `/catalog/print`, `/products/pepperoncini-peppers`, B2B export catalog PDF | Delete and revert to `photo-pending.svg` or no-image styling |
| `assets/illus-oxidized-black.svg` | Per-product "photography pending" illustration — oxidized black olive cluster (self-made this pass) | Made for this site, this pass | N/A — original graphic, no external source | Claude, as part of this project | None | `/catalog/`, `/catalog/print`, `/products/oxidized-black-olives`, B2B export catalog PDF | Delete and revert to `photo-pending.svg` or no-image styling |
| `assets/illus-stuffed.svg` | Per-product "photography pending" illustration — stuffed green olives on a pick (self-made this pass) | Made for this site, this pass | N/A — original graphic, no external source | Claude, as part of this project | None | `/`, `/catalog/`, `/catalog/print`, `/products/pepper-stuffed-green-olives`, B2B export catalog PDF | Delete and revert to `photo-pending.svg` or no-image styling |
| `assets/olive-kalamata.jpg` | Kalamata Olives product photograph. Source file was a 671×310 screenshot, so it is upscaled roughly 10% at its largest rendered size; the fruit reads burgundy rather than the "deep purple-black" of the approved copy. Both were put to the owner on 2026-09-05, who confirmed the photograph is Kalamata regardless and directed no change to the image or the wording (claim C-18). | Supplied by the site owner, 2026-09-05 | Owner-confirmed; supplied for use on this site | Triple Company for Industrial Development | No | `/catalog`, `/catalog/print`, `/downloads`, `/products/kalamata-olives` and the four Arabic equivalents; both B2B export catalogue PDFs | Revert to `illus-kalamata.svg` / `illus-kalamata-ar.svg`, which remain in the repo |
| `assets/illus-kalamata.svg` | **Superseded 2026-09-05 by `olive-kalamata.jpg`; retained as the rollback path, not in use.** Per-product "photography pending" illustration — cluster of almond-shaped Kalamata olives (self-made 2026-09-04, added with the Kalamata product). **Was missing from this register until 2026-09-05** — the only one of the six product illustrations with no row. Logged here as a correction; its status is unchanged, not newly approved. | Made for this site | N/A — original graphic, no external source | Claude, as part of this project | None | `/catalog/`, `/catalog/print`, `/downloads`, `/products/kalamata-olives`, B2B export catalog PDF | Delete and revert to the English variant or no-image styling |
| `assets/photo-pending-ar.svg` | Arabic variant of `photo-pending.svg` — identical artwork, caption set in Arabic ("صورة المنتج قيد التجهيز") instead of English (self-made 2026-09-05) | Made for this site | N/A — original graphic, no external source | Claude, as part of this project | None | `/ar/` (hero + 4 packaging slots), Arabic B2B export catalog PDF cover | Delete and revert to the English variant or no-image styling |
| `assets/illus-kalamata-ar.svg` | **Superseded 2026-09-05 by `olive-kalamata.jpg`; retained as the rollback path, not in use.** Arabic variant of `illus-kalamata.svg` — identical artwork, caption set in Arabic ("صورة المنتج قيد التجهيز") instead of English (self-made 2026-09-05) | Made for this site | N/A — original graphic, no external source | Claude, as part of this project | None | `/ar/catalog/`, `/ar/catalog/print`, `/ar/downloads`, `/ar/products/kalamata-olives`, Arabic B2B export catalog PDF | Delete and revert to the English variant or no-image styling |
| `assets/illus-artichoke-ar.svg` | Arabic variant of `illus-artichoke.svg` — identical artwork, caption set in Arabic ("صورة المنتج قيد التجهيز") instead of English (self-made 2026-09-05) | Made for this site | N/A — original graphic, no external source | Claude, as part of this project | None | `/ar/`, `/ar/catalog/`, `/ar/catalog/print`, `/ar/downloads`, `/ar/products/marinated-artichoke-hearts`, Arabic B2B export catalog PDF | Delete and revert to the English variant or no-image styling |
| `assets/illus-jalapeno-ar.svg` | Arabic variant of `illus-jalapeno.svg` — identical artwork, caption set in Arabic ("صورة المنتج قيد التجهيز") instead of English (self-made 2026-09-05) | Made for this site | N/A — original graphic, no external source | Claude, as part of this project | None | `/ar/`, `/ar/catalog/`, `/ar/catalog/print`, `/ar/downloads`, `/ar/products/sliced-jalapeno-peppers`, Arabic B2B export catalog PDF | Delete and revert to the English variant or no-image styling |
| `assets/illus-oxidized-black-ar.svg` | Arabic variant of `illus-oxidized-black.svg` — identical artwork, caption set in Arabic ("صورة المنتج قيد التجهيز") instead of English (self-made 2026-09-05) | Made for this site | N/A — original graphic, no external source | Claude, as part of this project | None | `/ar/catalog/`, `/ar/catalog/print`, `/ar/downloads`, `/ar/products/oxidized-black-olives`, Arabic B2B export catalog PDF | Delete and revert to the English variant or no-image styling |
| `assets/illus-pepperoncini-ar.svg` | Arabic variant of `illus-pepperoncini.svg` — identical artwork, caption set in Arabic ("صورة المنتج قيد التجهيز") instead of English (self-made 2026-09-05) | Made for this site | N/A — original graphic, no external source | Claude, as part of this project | None | `/ar/catalog/`, `/ar/catalog/print`, `/ar/downloads`, `/ar/products/pepperoncini-peppers`, Arabic B2B export catalog PDF | Delete and revert to the English variant or no-image styling |
| `assets/illus-stuffed-ar.svg` | Arabic variant of `illus-stuffed.svg` — identical artwork, caption set in Arabic ("صورة المنتج قيد التجهيز") instead of English (self-made 2026-09-05) | Made for this site | N/A — original graphic, no external source | Claude, as part of this project | None | `/ar/`, `/ar/catalog/`, `/ar/catalog/print`, `/ar/downloads`, `/ar/products/pepper-stuffed-green-olives`, Arabic B2B export catalog PDF | Delete and revert to the English variant or no-image styling |
| `assets/hero-olive-grove-*.png` | Decorative low-opacity background texture | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | `/` (hero background, aria-hidden) | Remove the `background-image` declaration |
| `opengraph.jpg` | Social-share preview image (used as `og:image`/`twitter:image` site-wide) | UNCONFIRMED — and separately, this file is a **raw screenshot of the homepage** (browser chrome visible), not a purpose-built social card. Its dimensions (1280×720) were also mismatched against the declared `og:image:width/height` meta (1200×630) until this pass, now corrected to match the real file. | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | Every page (same image reused everywhere) | Replace with a properly designed 1200×630 card once source art is settled |
| `assets/industrial-olives-*.png` | Not currently used anywhere (unreferenced by any page or stylesheet) | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | none (dead asset) | Safe to delete once confirmed unused, or wire in if it should be used somewhere |
| `assets/olive-harvest-*.jpg` | Not currently used anywhere (unreferenced by any page or stylesheet) | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | none (dead asset) | Safe to delete once confirmed unused, or wire in if it should be used somewhere |

## What changed this pass (mechanical only, no new sourcing)

- Generated a `.webp` sibling for each in-use raster asset above (same
  visual content, smaller file) and wired the ones with a real size win
  into `<picture>` on `/` and `/catalog/` — this is lossy re-encoding of
  the *existing* file, not a new source.
- Recompressed the PNGs in place at identical pixel dimensions.
- Generated `favicon.ico` and `site.webmanifest` from the *existing*
  `favicon-48/96/192/512.png` and `apple-touch-icon.png` files — no new
  imagery, just packaging the already-approved icon set correctly.
- Deleted `favicon.svg` (see the "brand / icon assets" table above).

None of this resolves the `UNCONFIRMED` rows — it only touches encoding,
compression, and packaging of files that already existed.

## What changed 2026-09-01

- Removed the 10 AI-generated image files listed above (site owner confirmed
  they were AI-generated; 2 independently confirmed by visual inspection),
  deleted both `.png` and `.webp` copies, and removed all `<picture>`/`<img>`
  references to them on `/` and `/catalog/`.
- Added `assets/photo-pending.svg` and wired it into the same six visual
  slots with honest "photography pending" alt text.
- Removed the `"image"` field from the 4 affected `Product` entries in
  `/catalog/`'s JSON-LD rather than pointing it at the placeholder.
- This does not touch the still-`UNCONFIRMED` real photography (`olive-
  aggizi-*`, `olive-manzanilla-*`, `olive-black-*`, `olive-hamed-*`,
  `olive-toffahi-*`) or the brand/icon assets — those still need a source
  and license from the site owner.

## What changed 2026-09-03

- Site owner confirmed ownership of the five still-real photos (`olive-
  aggizi-*`, `olive-manzanilla-*`, `olive-black-*`, `olive-hamed-*`,
  `olive-toffahi-*`) — updated from `UNCONFIRMED` to owner-confirmed above.
- The B2B export catalog PDF (`/downloads/`) was rebuilt to match this
  register exactly: it originally used all ten of the now-removed
  AI-generated images (including as the cover photo) before this register's
  2026-09-01 finding was visible on this branch. Rebuilt using only the five
  confirmed-real photos, with `assets/photo-pending.svg` in the other six
  slots (cover + Oxidized Black, Pepper Stuffed, Artichoke, Pepperoncini,
  Jalapeño), matching the live site's own treatment rather than shipping a
  printed document with fake product photography in it.

## What changed 2026-09-03 (later pass — per-product illustrations)

- Replaced the single generic `photo-pending.svg` graphic with five distinct,
  self-made illustrations — one per still-unphotographed product — on
  `/catalog/`, each product's own `/products/*` page, and the 3 of those
  products that appear in the homepage catalog teaser section (`/`). See the
  "Update, this pass" note above for the full explanation and the new rows
  in the Product / catalog photography table.
- `photo-pending.svg` itself was not modified; it still covers the generic
  homepage hero slot and the 4 packaging-format slots, unchanged.
- No `<img>` was added to any JSON-LD `Product.image` field for these five
  products — same discipline as 2026-09-01, since none of this is real
  product photography.
- The B2B export catalog PDF (`/downloads/triple-company-export-catalog-
  2026.pdf`) was not regenerated in this pass and still uses the generic
  `photo-pending.svg` in its unphotographed slots; it is not visually
  inconsistent with the site (both are honest "pending" placeholders), just
  not yet updated to the new per-product graphics.

## What changed 2026-09-03 (later pass — print catalog thumbnails)

- The site owner reported that "Download Full Catalog (PDF)" — the button on
  `/catalog/` and `/downloads/` that opens `/catalog/print` for the visitor
  to print or save as PDF themselves — looked out of date next to the
  redesigned `/catalog/` page. Root cause: `/catalog/print` never had any
  images at all (pure text spec sheets since it was first built), so it read
  as stale next to the photo/illustration grid on `/catalog/`.
- Added a thumbnail image to each of the 10 spec-card entries on
  `/catalog/print` — the same real photo or per-product illustration already
  used for that product elsewhere on the site, not a new asset. Routes
  updated above accordingly. Also added a category badge (Green Olive /
  Black Olive / Specialty) per card, matching `/catalog/`'s existing badge
  taxonomy, and refreshed the revision date shown on the page (2026-09-01 →
  2026-09-03).
- No new image files were introduced in this pass — every `<img>` added to
  `/catalog/print` reuses a file already covered by a row in the table
  above.

## What changed 2026-09-03 (later pass — export catalog PDF regenerated)

- Regenerated `downloads/triple-company-export-catalog-2026.pdf` so its 5
  unphotographed product pages (Oxidized Black Olives, Pepper Stuffed Green
  Olives, Marinated Artichoke Hearts, Pepperoncini Peppers, Sliced Jalapeño
  Peppers) use their per-product illustration instead of the single generic
  `photo-pending.svg` graphic, matching the live site. The 5 products with
  real photography (Aggizi, Toffahi, Hamed, Manzanilla, Natural Black
  Olives) are unchanged. The cover page keeps `photo-pending.svg` — same
  reasoning as the site's own generic hero slot, since a cover isn't
  depicting one specific product.
- This PDF previously had no committed source (it was hand-built and only
  the binary was ever committed, per the 2026-09-03 "B2B export catalog
  PDF" entry above) — meaning nobody could regenerate it without
  reconstructing it from scratch. Fixed by adding
  `scripts/export-catalog-source.html` (the printable HTML source, content
  copied verbatim from the extracted text of the previous PDF — nothing
  new was written) and `scripts/generate-export-catalog-pdf.js` (a
  Playwright script that prints it to PDF, matching the original file's own
  producer — headless Chrome / Skia PDF — so this is a like-for-like
  rebuild tool, not a different pipeline). Playwright is deliberately not
  added to `package.json` (see the script's header comment) so this stays
  a manual maintainer tool and never affects `netlify.toml`'s build command
  or any `npm install`.
- Verified before replacing the committed binary: page count (9, unchanged),
  page size (A4, unchanged), and the text of all 9 pages extracted and
  visually rendered page-by-page — content matches the original word for
  word except the swapped images, and the "Page 8A" / "Page 8B" footer
  numbering (a quirk of the original document) is preserved.
