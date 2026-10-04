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
| `assets/olive-black-*.jpg` *(deleted 2026-09-28)* | "Natural Black Olives" | Owner-confirmed | Owned by Triple Company | Triple Company for Industrial Development | No | None: replaced by `illus-natural-black*.svg`, see the 2026-09-28 note below | Do not restore: it carries a stock-photo watermark |
| `assets/olive-hamed-*.jpg` *(deleted 2026-09-28)* | "Hamed Green Olives" | Owner-confirmed | Owned by Triple Company | Triple Company for Industrial Development | No | None: the product was withdrawn ("not confirmed available") and both files (`.jpg`, `.webp`) deleted | Restore from git history if the product returns |
| `assets/olive-toffahi-*.jpg` | "Toffahi Green Olives" | Owner-confirmed | Owned by Triple Company | Triple Company for Industrial Development | No | `/catalog/`, `/catalog/print` | Swap file or fall back to no image |
| ~~`assets/olive-stuffed-new-*.png`~~ | *(removed — AI-generated, see above)* | — | — | — | — | — | Replaced with `photo-pending.svg` |
| ~~`assets/product-artichoke-*.png`~~ | *(removed — AI-generated, see above)* | — | — | — | — | — | Replaced with `photo-pending.svg` |
| ~~`assets/product-jalapeno-*.png`~~ | *(removed — AI-generated, see above)* | — | — | — | — | — | Replaced with `photo-pending.svg` |
| ~~`assets/product-oxidized-black-*.png`~~ | *(removed — AI-generated, see above)* | — | — | — | — | — | Replaced with `photo-pending.svg` |
| ~~`assets/product-pepperoncini-*.png`~~ | *(removed — AI-generated, see above)* | — | — | — | — | — | Replaced with `photo-pending.svg` |
| ~~`assets/product-olives-*.png`~~ | *(removed — AI-generated, see above)* | — | — | — | — | — | Replaced with `photo-pending.svg` |
| ~~`assets/pack-glass-jar-*.png`, `pack-tin-can-*.png`, `pack-bucket-*.png`, `pack-barrel-*.png`~~ | *(removed — AI-generated, see above)* | — | — | — | — | — | Replaced with `photo-pending.svg` |
| `assets/photo-pending.svg` | Neutral "photography pending" placeholder (self-made 2026-09-01) | Made for this site, 2026-09-01 | N/A — original graphic, no external source | Claude, as part of this project | None | `/` no longer (the hero slot moved to `red-peppers-sliced.jpg` on 2026-10-02; the 4 packaging-format slots to line icons on 2026-10-03, see `scripts/site_icons.py`); also used in the B2B export catalog PDF's cover slot only (the 5 product slots there now use their per-product illustration, see below) | Delete and revert to no-image styling if a different placeholder treatment is preferred |
| `assets/illus-jalapeno.svg` | **Superseded 2026-10-02 by the owner's photograph; retained as the rollback path, not in use.** Per-product "photography pending" illustration — sliced jalapeño rings (self-made this pass) | Made for this site, this pass | N/A — original graphic, no external source | Claude, as part of this project | None | `/`, `/catalog/`, `/catalog/print`, `/products/sliced-jalapeno-peppers`, B2B export catalog PDF | Delete and revert to `photo-pending.svg` or no-image styling |
| `assets/illus-artichoke.svg` | Per-product "photography pending" illustration — artichoke heart (self-made this pass) | Made for this site, this pass | N/A — original graphic, no external source | Claude, as part of this project | None | `/`, `/catalog/`, `/catalog/print`, `/products/marinated-artichoke-hearts`, B2B export catalog PDF | Delete and revert to `photo-pending.svg` or no-image styling |
| `assets/illus-pepperoncini.svg` | Per-product "photography pending" illustration — pepperoncini peppers (self-made this pass) | Made for this site, this pass | N/A — original graphic, no external source | Claude, as part of this project | None | `/catalog/`, `/catalog/print`, `/products/pepperoncini-peppers`, B2B export catalog PDF | Delete and revert to `photo-pending.svg` or no-image styling |
| `assets/illus-oxidized-black.svg` | **Superseded 2026-10-02 by the owner's photograph; retained as the rollback path, not in use.** Per-product "photography pending" illustration — oxidized black olive cluster (self-made this pass) | Made for this site, this pass | N/A — original graphic, no external source | Claude, as part of this project | None | `/catalog/`, `/catalog/print`, `/products/oxidized-black-olives`, B2B export catalog PDF | Delete and revert to `photo-pending.svg` or no-image styling |
| `assets/illus-stuffed.svg` | Per-product "photography pending" illustration — stuffed green olives on a pick (self-made this pass) | Made for this site, this pass | N/A — original graphic, no external source | Claude, as part of this project | None | `/`, `/catalog/`, `/catalog/print`, `/products/pepper-stuffed-green-olives`, B2B export catalog PDF | Delete and revert to `photo-pending.svg` or no-image styling |
| `assets/olive-kalamata.jpg` | Kalamata Olives product photograph. Source file was a 671×310 screenshot, so it is upscaled roughly 10% at its largest rendered size; the fruit reads burgundy rather than the "deep purple-black" of the approved copy. Both were put to the owner on 2026-09-05, who confirmed the photograph is Kalamata regardless and directed no change to the image or the wording (claim C-18). | Supplied by the site owner, 2026-09-05 | Owner-confirmed; supplied for use on this site | Triple Company for Industrial Development | No | `/catalog`, `/catalog/print`, `/downloads`, `/products/kalamata-olives` and the four Arabic equivalents; both B2B export catalogue PDFs | Revert to `illus-kalamata.svg` / `illus-kalamata-ar.svg`, which remain in the repo |
| `assets/olive-oxidized-black.jpg` (+ `.webp`) | Oxidized Black Olives product photograph (pitted, in brine). Cropped to the product only -- no barrels, lids, bucket labels or other equipment in frame, so it shows no facility (C-38) -- then levels and gamma adjusted evenly across the three colour channels, a white-balance correction capped at +/-8% per channel, mild contrast, saturation within +/-8%, clarity and sharpening, resized to 1200x800 (3:2). Nothing added, removed or recoloured in the product itself. Source 960x1280 phone photo; crop 960x640, enlarged 1.25x. | Supplied by the site owner, 2026-10-02 | The owner states that the company owns the photograph ("i own those photos", 2026-10-02) | Triple Company for Industrial Development | No | `/products/oxidized-black-olives`, `/catalog`, `/catalog/print`, `/downloads` and the four Arabic equivalents; both export catalogue PDFs; both product-catalogue PDFs; the Oxidized Black and all-in-one spec sheets, both languages | Revert to `illus-oxidized-black.svg` / `illus-oxidized-black-ar.svg`, which remain in the repo |
| `assets/jalapeno-sliced.jpg` (+ `.webp`) | Sliced Jalapeño Peppers product photograph (rings in brine). Cropped to the product only -- no barrels, lids, bucket labels or other equipment in frame, so it shows no facility (C-38) -- then levels and gamma adjusted evenly across the three colour channels, a white-balance correction capped at +/-8% per channel, mild contrast, saturation within +/-8%, clarity and sharpening, resized to 1200x800 (3:2). Nothing added, removed or recoloured in the product itself. Source 960x1280 phone photo; crop 960x640, enlarged 1.25x. | Supplied by the site owner, 2026-10-02 | The owner states that the company owns the photograph ("i own those photos", 2026-10-02) | Triple Company for Industrial Development | No | `/products/sliced-jalapeno-peppers`, `/`, `/catalog`, `/catalog/print`, `/downloads` and the Arabic equivalents; both export catalogue PDFs; both product-catalogue PDFs; the Sliced Jalapeño and all-in-one spec sheets, both languages | Revert to `illus-jalapeno.svg` / `illus-jalapeno-ar.svg`, which remain in the repo |
| `assets/red-peppers-sliced.jpg` (+ `.webp`) | Home-page hero photograph: sliced red peppers in brine. Cropped to the product only -- no barrel, rim, lid, bucket label or other equipment in frame, so it shows no facility (C-38) and no supplier or importer label -- then a light edge-preserving clean-up of JPEG compression blocks (non-local means, strength 3), levels applied at half strength with the same black and white points for all three colour channels, a white-balance correction taken from the clean bucket rim and capped at +/-8% per channel, mild contrast (+3%), saturation reduced 6%, clarity, a Lanczos enlargement to 1120x1120 (1:1) and light sharpening. Nothing added, removed or recoloured in the product itself; no AI upscaling, so no detail is invented. Source 960x1280 phone photo (a messaging-app copy); crop 690x690, re-cut 2026-10-02 from the first 540x720 crop to use about 28% more of the photo's real width. The variety is not identified on the site: the alt text says only what is visible. | Supplied by the site owner for the home page, 2026-10-02 | The owner states that the company owns the photograph ("yes the company own the photo of red pepper", 2026-10-02; C-148) | Triple Company for Industrial Development | No | `/` and `/ar/` (hero slot, md and wider; the slot is hidden on phones) | Revert the two `<picture>` elements to `photo-pending.svg` / `photo-pending-ar.svg`, which remain in use elsewhere |
| `assets/illus-kalamata.svg` | **Superseded 2026-09-05 by `olive-kalamata.jpg`; retained as the rollback path, not in use.** Per-product "photography pending" illustration — cluster of almond-shaped Kalamata olives (self-made 2026-09-04, added with the Kalamata product). **Was missing from this register until 2026-09-05** — the only one of the six product illustrations with no row. Logged here as a correction; its status is unchanged, not newly approved. | Made for this site | N/A — original graphic, no external source | Claude, as part of this project | None | `/catalog/`, `/catalog/print`, `/downloads`, `/products/kalamata-olives`, B2B export catalog PDF | Delete and revert to the English variant or no-image styling |
| `assets/photo-pending-ar.svg` | Arabic variant of `photo-pending.svg` — identical artwork, caption set in Arabic ("صورة المنتج قيد التجهيز") instead of English (self-made 2026-09-05) | Made for this site | N/A — original graphic, no external source | Claude, as part of this project | None | `/ar/` no longer (hero moved to `red-peppers-sliced.jpg` on 2026-10-02; packaging slots to line icons on 2026-10-03), Arabic B2B export catalog PDF cover | Delete and revert to the English variant or no-image styling |
| `assets/illus-kalamata-ar.svg` | **Superseded 2026-09-05 by `olive-kalamata.jpg`; retained as the rollback path, not in use.** Arabic variant of `illus-kalamata.svg` — identical artwork, caption set in Arabic ("صورة المنتج قيد التجهيز") instead of English (self-made 2026-09-05) | Made for this site | N/A — original graphic, no external source | Claude, as part of this project | None | `/ar/catalog/`, `/ar/catalog/print`, `/ar/downloads`, `/ar/products/kalamata-olives`, Arabic B2B export catalog PDF | Delete and revert to the English variant or no-image styling |
| `assets/illus-artichoke-ar.svg` | Arabic variant of `illus-artichoke.svg` — identical artwork, caption set in Arabic ("صورة المنتج قيد التجهيز") instead of English (self-made 2026-09-05) | Made for this site | N/A — original graphic, no external source | Claude, as part of this project | None | `/ar/`, `/ar/catalog/`, `/ar/catalog/print`, `/ar/downloads`, `/ar/products/marinated-artichoke-hearts`, Arabic B2B export catalog PDF | Delete and revert to the English variant or no-image styling |
| `assets/illus-jalapeno-ar.svg` | **Superseded 2026-10-02 by the owner's photograph; retained as the rollback path, not in use.** Arabic variant of `illus-jalapeno.svg` — identical artwork, caption set in Arabic ("صورة المنتج قيد التجهيز") instead of English (self-made 2026-09-05) | Made for this site | N/A — original graphic, no external source | Claude, as part of this project | None | `/ar/`, `/ar/catalog/`, `/ar/catalog/print`, `/ar/downloads`, `/ar/products/sliced-jalapeno-peppers`, Arabic B2B export catalog PDF | Delete and revert to the English variant or no-image styling |
| `assets/illus-oxidized-black-ar.svg` | **Superseded 2026-10-02 by the owner's photograph; retained as the rollback path, not in use.** Arabic variant of `illus-oxidized-black.svg` — identical artwork, caption set in Arabic ("صورة المنتج قيد التجهيز") instead of English (self-made 2026-09-05) | Made for this site | N/A — original graphic, no external source | Claude, as part of this project | None | `/ar/catalog/`, `/ar/catalog/print`, `/ar/downloads`, `/ar/products/oxidized-black-olives`, Arabic B2B export catalog PDF | Delete and revert to the English variant or no-image styling |
| `assets/illus-pepperoncini-ar.svg` | Arabic variant of `illus-pepperoncini.svg` — identical artwork, caption set in Arabic ("صورة المنتج قيد التجهيز") instead of English (self-made 2026-09-05) | Made for this site | N/A — original graphic, no external source | Claude, as part of this project | None | `/ar/catalog/`, `/ar/catalog/print`, `/ar/downloads`, `/ar/products/pepperoncini-peppers`, Arabic B2B export catalog PDF | Delete and revert to the English variant or no-image styling |
| `assets/illus-stuffed-ar.svg` | Arabic variant of `illus-stuffed.svg` — identical artwork, caption set in Arabic ("صورة المنتج قيد التجهيز") instead of English (self-made 2026-09-05) | Made for this site | N/A — original graphic, no external source | Claude, as part of this project | None | `/ar/`, `/ar/catalog/`, `/ar/catalog/print`, `/ar/downloads`, `/ar/products/pepper-stuffed-green-olives`, Arabic B2B export catalog PDF | Delete and revert to the English variant or no-image styling |
| ~~`assets/hero-olive-grove-*.png`~~ (+ `.webp`, `-sm.webp`) | **Removed 2026-10-03.** Decorative olive-grove background behind the homepage hero, of UNCONFIRMED ownership. At 8% opacity under a cream fade it changed no pixel by more than 2/255; replaced at the owner's choice by `hero-green-olives-texture.webp` (below). | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | none (deleted) | Restore from git history only once ownership is established |
| `assets/hero-green-olives-texture.webp` | Homepage hero background texture (`/`, `/ar/`): the owner's green olives photograph, resized to 960x640, blurred (2.2px), colour reduced to 55%, shown at 16% opacity and fading out before the hero photograph. 20 KB. | Derived from `scripts/og-card-green-olives.jpg`, the owner's photograph supplied 2026-10-02 | The owner states the company owns it ("i own those photos", 2026-10-02); chosen by the owner for this use ("go with B", 2026-10-03) | Triple Company for Industrial Development | No | `/`, `/ar/` hero background (screen only) | Remove the `.tc-hero-texture` div; the hero reads the same without it |
| `assets/*-600.jpg`, `assets/*-600.webp`, `assets/olive-kalamata.webp`, `assets/hero-olive-grove-sm.webp` | Smaller copies made 2026-10-03 for page speed: 600px-wide versions of the six product photographs used on the catalogue, downloads and home cards; a WebP of the Kalamata photograph; an 800px WebP of the hero background texture. Resized and re-encoded only, nothing else changed. | Derived from the files they copy | Same as the file each copies (the product photographs: owner-confirmed; the hero texture: still **UNCONFIRMED**, see its own row) | Same as the source | No | Web pages only; the PDFs keep the full-size originals | Delete them and the `srcset` attributes; the originals remain |
| `opengraph.jpg` | Social-share card, 1200x630 (used as `og:image`/`twitter:image` on every page). **Replaced 2026-10-02.** Left panel: the site logo (`assets/logo-BJ1TOn9V.png`) on a cream tile; the approved header tagline "Egyptian Table Olive Export" (C-91); the legal name in English and Arabic; olivesegypt.com. Right panel: the three photographs the owner supplied together on 2026-10-02, chosen by the owner for the card ("use the last 3 photos i uploaded"), cropped by the layout only -- green olives (`scripts/og-card-green-olives.jpg`, edited as recorded for the other two and kept out of `assets/` because it is not used on the site, at the owner's request), `olive-oxidized-black.jpg`, `jalapeno-sliced.jpg`. Site colours and the site's self-hosted fonts (Playfair Display, Plus Jakarta Sans, Noto Naskh Arabic, OFL). Built as HTML and rendered in Chromium. No product is named and no new claim is made. **What it replaced:** a 1280x720 screenshot of the old homepage carrying the retired tagline (C-91), "EST. 2010" (against the site's own "newly established"), "Shipping certified, traceable containers", and stock-style jars of unconfirmed origin; 32 pages also declared it as 1200x630, which it was not. | Made for this site from the owner's photographs and logo, 2026-10-02 | Composite of company-owned assets (the owner states the company owns all three photographs, "i own those photos", 2026-10-02) | Triple Company for Industrial Development | No | Every page (same image reused everywhere) | Re-render from `scripts/og-card.html` (instructions in the file). Reverting to the previous file would bring back its retired wording |
| `scripts/site_icons.py` (inline SVG icons) | 21 line icons on the homepage, /solutions, /resources, /resources/why-egyptian-olives and /resources/export-markets, in both languages, in place of the emoji used there until 2026-10-03 (map pin, clipboard, package, tag, ship, store, utensils, factory, handshake, message, file, file-pen, check, banknote, earth, network, help, trending-up, award, map, globe). Icon shapes unchanged; colours set by the site stylesheet. | Lucide, lucide-static 0.460.0 (https://lucide.dev), via the npm registry, 2026-10-03 | ISC licence: free use, modification and distribution, with the copyright notice kept with the source (recorded in `scripts/site_icons.py`) | Lucide Contributors | No | The pages named here | Revert `scripts/site_icons.py` and the pages to bring back the emoji |
| `scripts/site_icons.py` `PACK_ICONS` (4 inline SVG icons) | Glass jar, tin can, plastic bucket and plastic barrel, on the homepage packaging cards in both languages, in place of the "photography pending" placeholder until there are photographs | Drawn for this site, 2026-10-03, in the Lucide style; not Lucide icons | Original | Triple Company for Industrial Development (made for the site) | No | `/`, `/ar/` packaging cards | Revert to `photo-pending.svg` / `photo-pending-ar.svg` |
| `scripts/pdf-fonts/Amiri-Regular.ttf`, `scripts/pdf-fonts/Amiri-Bold.ttf` (with `OFL.txt`) | The Arabic letters (and word spaces) in the 21 Arabic PDFs - spec sheets, product catalogue, company profile, the gated guides and the export catalogue - in place of the build machine's system font and the variable Noto Naskh Arabic, so the text copies out of the PDFs whole and in reading order (2026-10-03). Build-only: `scripts/` is pruned from the deploy, so no page loads these files and the site's own fonts are unchanged. | Amiri 1.002, the unmodified static Regular and Bold from the google/fonts repository (https://github.com/google/fonts/tree/main/ofl/amiri), 2026-10-03 | SIL Open Font License 1.1; licence kept beside the files. Embedded in the PDFs as subsets, which the OFL permits | The Amiri Project Authors (https://github.com/aliftype/amiri) | No | The 21 Arabic PDFs | Revert `scripts/guide-pdfs.js` and rebuild the Arabic PDFs |
| `scripts/pdf-fonts/static/*.woff2` (52 files, with `OFL.txt`) | Static copies of the site's three variable web fonts (Plus Jakarta Sans, Playfair Display, Noto Naskh Arabic), one per subset file and weight, used only when the 42 PDFs are built, so the fonts embed as TrueType instead of Type3 (2026-10-04). Same outlines at the same weights; the PDFs look the same. Build-only: `scripts/` is pruned from the deploy. | Made by `scripts/make-pdf-static-fonts.py` from the self-hosted files in `assets/fonts/` (themselves unmodified Google Fonts files) | SIL Open Font License 1.1. Each instance is a Modified Version, so each is renamed (TC PDF Sans / Serif / Naskh): Playfair Display reserves its name. Copyright and licence fields are kept, and the OFL text is beside the files | The Plus Jakarta Sans, Playfair Display and Noto Project Authors (see `assets/fonts/OFL.txt`) | No | The 42 PDFs | Revert `scripts/guide-pdfs.js` and rebuild the PDFs |
| `assets/fonts/arabic-sans.woff2` (source: `scripts/font-sources/notosansarabic-*.woff2`); `assets/fonts/arabic-naskh.woff2` *(retired 2026-10-04)* | The Arabic pages' one web font (Phase 1, 2026-10-04): Noto Sans Arabic for Arabic text and headings alike, preloaded by the 49 Arabic pages only. The Noto Naskh Arabic headings subset added earlier the same day was retired for a single Arabic font (owner: fewer files). | Subset made by `scripts/make-arabic-web-fonts.py`: standard Arabic plus the word space, weight axis 400-700, about 17 KB, from Google Fonts' Noto Sans Arabic (fetched 2026-10-04, kept unmodified in `scripts/font-sources/`) | SIL Open Font License 1.1 (`assets/fonts/OFL.txt`). A subset is a Modified Version; Noto reserves no font name, so it keeps its own | The Noto Project Authors (https://github.com/notofonts/arabic) | No | The 49 Arabic pages | Revert the stylesheet rule and the preload line; the device font returns |
| `assets/logo-header.png` | The page-header logo (Phase 1, 2026-10-04) on the 111 public pages, in place of the 38 KB original: the same artwork at 52x64 (twice the 32px header box), lossless, 4.9 KB | Made by `scripts/make-logo-header.py` from `assets/logo-BJ1TOn9V.png` | Same status as the original logo (row above: UNCONFIRMED) | Same as the original logo | Same as the original logo | Every public page header | Point the header `<img>` back at `assets/logo-BJ1TOn9V.png` (236x289) |
| `assets/olive-toffahi-SpdiHPHF-800.webp`, `assets/olive-manzanilla-vwgGqjiA-800.webp`, `assets/olive-oxidized-black-800.webp`, `assets/jalapeno-sliced-800.webp` | An 800px size of four card photographs (Phase 1, 2026-10-04), listed in the cards' srcset between the 600px and 1200px files, so a phone no longer downloads the 1200px file for a 176px-tall crop | Made by `scripts/make-card-image-sizes.py` (WebP, quality 78) from the same JPEGs as the other sizes | Same as each source photograph (rows above) | Same as each source photograph | Same as each source photograph | The catalogue, homepage and downloads cards that use these photographs | Remove the 800w entries from the srcset; the 600w and 1200w files are untouched |
| `assets/industrial-olives-CAiQk-rL.png` *(deleted 2026-10-04)* | Never used: no page, stylesheet, script or function referenced it (checked across every tracked file on 2026-10-04; only this register and the deployment record named it). 1408x768 palette PNG, 593,247 bytes, SHA-256 `3fd0aa50add97748fdf1f360827ff873cefd92b8bf94ccdbe60c85efde30d0cb`. Came in with the original site build (commit `a32133a`, 2026-08-04). | UNCONFIRMED (origin unknown) | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | None | Deleted in the Phase 1 performance work (owner, 2026-10-04): published dead weight. Restore, if ever wanted, with `git show 3e6ad6d:assets/industrial-olives-CAiQk-rL.png > assets/industrial-olives-CAiQk-rL.png` -- but its rights are unconfirmed, so it may not be used on the site until its source and permission are recorded |
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

## 2026-09-28 — Hamed photographs deleted

Hamed Green Olives were withdrawn from the range at the owner's request (C-131).
`assets/olive-hamed-DhlKuQ55.jpg` and `.webp` were used only by the Hamed
product pages, its catalogue card and spec-sheet thumbnail, and its row in the
catalogue PDFs, all of which are removed, so both files are deleted. They are
recoverable from git history. The mentions of `olive-hamed-*` in the sections
above describe the site before that date.

The note above about the "Page 8A" / "Page 8B" footers is also out of date:
since 2026-09-28 (Deploy 71) those pages are numbered 8 and 9.

## 2026-09-28 — Natural Black photograph withdrawn: stock watermark

`assets/olive-black-CzV0ukvu.jpg` (and its `.webp`), the Natural Black Olives
photograph, carries a faint watermark across its middle that reads as
"dreamstime", a stock-photo site's preview mark. It was found while checking
the new spec-sheet PDFs. The inspection of 2026-09-03 above looked for
generation artefacts and did not record it, and the table listed the photo as
owner-confirmed and owned.

The owner decided, the same day, to take it down: "put photo pending, am
working on bringing in real photos soon".
- **Replacement:** everywhere it appeared, the product now shows
  `illus-natural-black.svg` / `illus-natural-black-ar.svg`. That covers the
  homepage, both catalogues, the print catalogues and spec sheets, the
  Downloads thumbnails, the product pages (including their Product schema
  image) and the export catalogue PDFs.
- **The illustration:** a copy of the oxidized-black illustration, the same
  "photography pending" artwork as the other placeholder products.
- **The photo files:** deleted.

Six products now await real photography: Natural Black, Stuffed,
Oxidized Black, Sliced Jalapeño, Marinated Artichoke and Pepperoncini.

## 2026-10-02 — Oxidized Black and Sliced Jalapeño: real photographs

The owner supplied three of their own photographs ("i own those photos"). Two are
in use: Oxidized Black Olives and Sliced Jalapeño Peppers now show real
photographs everywhere their "photography pending" illustration was -- product
pages (with WebP, as the other photographed products), both catalogues, the
print catalogues, Downloads, the homepage (jalapeño), the Product schema image,
and the ten PDFs built from those sources. The edits are listed in each row
above; the product's own appearance is unchanged. The photographs were taken
where the product is stored, so each crop holds only the product: no barrels,
lids, bucket markings or other equipment (C-38).

The third, green olives, is held back at the owner's request ("leave the green
olives for now"); it was also only 520px wide.

Four products now await real photography: Natural Black, Stuffed,
Marinated Artichoke and Pepperoncini.


## 2026-10-04 — Visual upgrade, Phase 2: homepage hero and illustration labels

**Homepage hero.** The hero no longer shows a photograph (brief: "a light hero
visual built from SVG and CSS ... No photograph"). In its place is an inline
SVG drawn for this site: an olive branch in front of two upright bars, in the
olive and gold of the Triple Company logo, which it is drawn after. Source:
the company's own logo; made for this site; no external source; no people,
facility or supplier shown. It is markup inside `index.html` and
`ar/index.html`, not a file.

Now referenced by no page, kept as files for rollback:

- `assets/red-peppers-sliced.jpg` (+ `.webp`): the owner-chosen hero
  photograph (2026-10-02, C-148). Rights unchanged (row above). Rollback:
  restore the hero `<picture>` from `git show 465f909:index.html` (and
  `ar/index.html`).
- `assets/hero-green-olives-texture.webp`: the blurred hero background
  texture. Rights unchanged (row above). Same rollback.

**Illustration labels.** Every illustration (`assets/illus-*.svg`, both
languages) and the generic `assets/photo-pending.svg` / `-ar.svg` drew the
words "Product photography pending" / "صورة المنتج قيد التجهيز" into the
image. That text is removed; the drawing is moved down to the centre of the
canvas; nothing else in the artwork changes. Each image now describes itself
as an illustration (e.g. "Illustration of natural black olives" /
"رسم توضيحي: زيتون أسود طبيعي"), and so does every `alt` that shows one. The
file names, including `photo-pending*.svg`, are kept so no reference changes;
they are not shown to buyers.

The export catalogue cover's caption, "Cover photography pending — real
product photography to be added before final print." (and the Arabic), now
reads "The illustrations in this catalogue are drawings, not product
photographs." / "الرسوم التوضيحية في هذا الكتالوج رسومات وليست صورًا
فوتوغرافية للمنتجات." The 14 PDFs that carry these images were rebuilt.

Found while doing this, not changed: `illus-natural-black.svg` (and `-ar`) is
the same drawing as `illus-oxidized-black.svg`, and its label read "Oxidized
Black Olives". The label now says natural black olives; the drawing itself is
still the oxidized-black one.

## 2026-10-04 — Natural Black Olives: its own illustration

`assets/illus-natural-black.svg` (and `-ar`) was the same drawing as
`illus-oxidized-black.svg`: round, uniform, glossy jet-black olives. The owner
asked for a distinct one (2026-10-04). Redrawn for this site in the same flat
style, palette and canvas as the other illustrations: oval, matte olives in
uneven plum-to-brown, a little wrinkled, hanging from a branch with leaves,
since natural black olives ripen on the tree and are not uniform in colour.
Made for this site; no external source; no AI generation. Its description is
unchanged ("Illustration of natural black olives" / "رسم توضيحي: زيتون أسود
طبيعي"). It is still an illustration, not a photograph, and is used where the
old drawing was: the product page, the homepage and catalogue cards, the print
catalogue, Downloads, and 8 PDFs (both product catalogues, the natural-black
and combined spec sheets, both export catalogues); their text is unchanged.
Rollback: `git show fe92b3b:assets/illus-natural-black.svg` (and `-ar`).
