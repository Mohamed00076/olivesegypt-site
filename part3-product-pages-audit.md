# Part 3 — Product Page Images & Breadcrumb Audit

**Date:** 2026-09-02
**Scope:** The 10 `/products/{slug}/` detail pages only. First items completed under Part 3 (technical/UX follow-ups), building on the already-merged Parts 1, 1B, 2, and 2B.

## 1. Read-only findings (before any change)

Checked live state across the site (not assumed):

- **Product-schema `"offers"` removal, favicon/manifest, CRM, Analytics pipeline, KPI Manager, Quotation/Invoice Generator, sitemap.xml/robots.txt, PDPL mentions on `/privacy`:** all already present/complete on `main`. No action needed — most of Part 3's originally-listed items turned out to already be built earlier in this project.
- **`/resources` and `/products` information architecture:** confirmed *not* broken. `/catalog` is the working hub for all 10 product pages (linked from and to consistently), `/resources/index.html` is the working hub for its 6 child pages, and `sitemap.xml` correctly lists both hubs plus every child page — no bare `/products` URL is linked or expected anywhere. No restructure needed.
- **Systems audit (CRM/Analytics/KPI/Quotation functions):** all 28 Netlify functions pass `node --check`; every `/api/*` redirect in `netlify.toml` maps to an existing function; the 3 functions with no redirect (`analytics-retention`, `geo-refresh`, `search-console-import`) are deliberately schedule-triggered (`netlify.toml` `[functions."..."] schedule = ...`), not orphaned. Spot-checked auth-sensitive CRM endpoints for session checks (present) and SQL calls for parameterization (all use the `sql\`...\`` tagged-template form, no string concatenation found). Could not do a live end-to-end DB round-trip test (`scripts/*-roundtrip-check.js` require a real `DATABASE_URL` this sandbox doesn't have) — that remains untested by this pass specifically, though it was not asked for.
- **Homepage UX pass — real finding:** the homepage's "Bulk Olive Supplier Catalog" teaser grid already correctly uses real photos for 5 of the 10 products (`olive-aggizi-*.jpg`, `olive-manzanilla-*.jpg`, `olive-black-*.jpg`, `olive-hamed-*.jpg`, `olive-toffahi-*.jpg`, confirmed present in `assets/`) and the honest `photo-pending.svg` placeholder for the other 5. **But none of the 10 individual `/products/{slug}/` pages displayed any image at all — not the real photo, not even the placeholder** — despite the assets already existing and already being used elsewhere on the site. This is the concrete defect this task fixes.
- **Secondary finding, not fixed by this task (flagged for a separate decision):** the `<img alt>` text on the catalog page's 5 real-photo cards is a bare internal slug (`"aggizi"`, `"toffahi"`, `"hamed"`, `"manzanilla"`, `"black_natural"`) rather than a descriptive name, unlike the homepage's equivalent cards which use full names (`"Aggizi Green Olives"`, etc.). Left untouched — out of the scope approved for this task.

## 2. Fix

### 2a. Product images (all 10 pages)

One new block inserted into each page's `<main>`, right after the title/origin line and before the "Variety Profile" section:

- **5 products with a real photo asset already in `assets/`** (Aggizi, Hamed, Manzanilla, Natural Black, Toffahi) — the same `<picture><source type="image/webp">...<img></picture>` pattern already used on the catalog page, pointed at that product's existing `.jpg`/`.webp` pair, with real intrinsic `width`/`height` attributes read from each file (no invented values) and descriptive `alt` text matching the product's own `<h1>`.
- **5 products with no photo asset yet** (Oxidized Black Olives, Stuffed Green Olives, Marinated Artichoke Hearts, Pepperoncini Peppers, Sliced Jalapeño Peppers) — the same honest `/assets/photo-pending.svg` placeholder already used on the homepage and catalog page, with `alt` text matching the wording already established for that exact product on those pages. No stock photo or fabricated image was used for these — real photography is still needed, and that isn't something fixable in code.

### 2b. Semantic breadcrumb (all 10 pages)

The existing breadcrumb-style line (`Home / Catalog / {Product Name}`, already visible, already matching the page's own `BreadcrumbList` JSON-LD) was upgraded from a plain `<p>` with `/` text separators to a proper `<nav aria-label="Breadcrumb"><ol><li>...</li></ol></nav>` structure. Visible text, styling classes (`text-xs text-muted-foreground mb-4`, `hover:underline`), and reading order are unchanged — this only adds semantics (`aria-current="page"` on the current item) so the existing structured data has a matching accessible UI, not a new feature.

## 3. Verification

- Real Playwright/Chromium load test on all 10 product pages: every page's main image (real photo or placeholder) loads successfully (`img.complete === true`, non-zero `naturalWidth`), zero HTTP 4xx/5xx responses for any asset.
- Screenshots taken in both themes (a real-photo page in light, a placeholder page in dark) — image renders correctly, breadcrumb reads correctly, no layout break.
- Structural validation on all 10 files: `<div>`/`<nav>`/`<ol>`/`<li>`/`<p>`/`<section>` tag-open/close counts balanced, every JSON-LD block still parses, `html.parser.HTMLParser().feed()` clean, exactly one breadcrumb `<nav>` and one image block per file.
- `BreadcrumbList` JSON-LD (unchanged) already matches the new visible breadcrumb text on every page — no mismatch introduced.

## 4. Changed files

10 files, one new `<nav>` block and one new image block inserted into each — no existing markup, JS, styling, or JSON-LD modified:

```
products/aggizi-green-olives/index.html, products/hamed-green-olives/index.html,
products/manzanilla-green-olives/index.html, products/marinated-artichoke-hearts/index.html,
products/natural-black-olives/index.html, products/oxidized-black-olives/index.html,
products/pepper-stuffed-green-olives/index.html, products/pepperoncini-peppers/index.html,
products/sliced-jalapeno-peppers/index.html, products/toffahi-green-olives/index.html
```

## 5. Not covered by this pass

- Catalog page's poor `alt` text on its 5 real-photo cards (flagged in §1, needs a separate approval — this task only touched `/products/*`).
- Any content/route/consent/analytics/SEO-metadata change.
- The remaining, larger Part 3 items the user has not yet prioritized (homepage design-level UX beyond this fix, any deeper systems testing that would need real database credentials).
