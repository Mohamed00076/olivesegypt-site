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

## Brand / icon assets

| File | Used as | Source | License / permission | Photographer / owner | Attribution required | Routes | Rollback |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `logo.png`, `assets/logo-*.png` | Header/footer logo, letterhead, business card | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | Nearly every page | Remove `<img>`/schema `logo` reference; site still functions without it |
| `favicon-48.png`, `favicon-96.png`, `icon-192.png`, `icon-512.png`, `apple-touch-icon.png`, `favicon.ico` | Browser tab icon, home-screen icon, `site.webmanifest` icons | UNCONFIRMED (all derived/resized from the same master mark — likely the same origin as `logo.png`, not independently verified) | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | All pages | Revert to a plain-text or generic icon if the mark's rights can't be confirmed |
| `favicon.svg` | *(removed this pass)* | — | — | — | — | — | Was an orphaned placeholder (a plain orange rounded square, `#FF3C00`, not the brand's actual green/gold mark) linked from only one page; deleted rather than fixed since it wasn't serving its purpose anywhere |

## Product / catalog photography

| File | Depicts | Source | License / permission | Photographer / owner | Attribution required | Routes | Rollback |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `assets/olive-aggizi-*.jpg` | "Aggizi Green Olives" | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | `/`, `/catalog/` | Swap file or fall back to no image |
| `assets/olive-manzanilla-*.jpg` | "Manzanilla Green Olives" | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | `/`, `/catalog/` | Swap file or fall back to no image |
| `assets/olive-black-*.jpg` | "Natural Black Olives" | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | `/`, `/catalog/` | Swap file or fall back to no image |
| `assets/olive-hamed-*.jpg` | "Hamed Green Olives" | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | `/catalog/` | Swap file or fall back to no image |
| `assets/olive-toffahi-*.jpg` | "Toffahi Green Olives" | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | `/catalog/` | Swap file or fall back to no image |
| `assets/olive-stuffed-new-*.png` | "Stuffed Green Olives" | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | `/`, `/catalog/` | Swap file or fall back to no image |
| `assets/product-artichoke-*.png` | "Marinated Artichoke Hearts" | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | `/`, `/catalog/` | Swap file or fall back to no image |
| `assets/product-jalapeno-*.png` | "Sliced Jalapeño Peppers" | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | `/`, `/catalog/` | Swap file or fall back to no image |
| `assets/product-oxidized-black-*.png` | "Oxidized Black Olives" | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | `/catalog/` | Swap file or fall back to no image |
| `assets/product-pepperoncini-*.png` | "Pepperoncini Peppers" | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | `/catalog/` | Swap file or fall back to no image |
| `assets/product-olives-*.png` | Generic hero olive-jar image | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | `/` (hero) | Swap file or fall back to no image |
| `assets/pack-glass-jar-*.png`, `pack-tin-can-*.png`, `pack-bucket-*.png`, `pack-barrel-*.png` | Packaging-format illustrations | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | `/` (packaging section) | Swap file or fall back to no image |
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
