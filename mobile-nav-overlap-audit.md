# Mobile Header/Navigation Overlap Audit — Part 2B

**Date:** 2026-09-02
**Scope:** The mobile hamburger-menu/nav overlap on `/resources` and all 22 shared-header ("main template") pages, per the Part 2B task. Builds on the already-merged Part 2 baseline (`responsive-layout-audit.md`, `contrast-audit.md`) without modifying any of its fixes.

## 0. Confirming Part 2's existing fixes before touching anything

Per the explicit instruction not to silently overwrite Part 2's work, the current (post-merge) state of its three widget-position/appearance fixes was checked first, in the live `main` branch this work started from:

- **Read Our Insights widget** (`[data-testid="floating-blog-link"]` mobile reposition, `assets/index-Dw0yUE42.css`) — present, unchanged.
- **Cookie Preferences reopen control border fix** (`assets/consent.js`, `#tc-consent-reopen` border + `.dark` overrides) — present, unchanged.
- **WhatsApp FAB shift-for-banner logic** (`assets/consent.js`, `shiftFabForBanner`/`restoreFabPosition`) — present, unchanged.

None of these files' existing rules were edited by this task; the only change to `assets/index-Dw0yUE42.css` is a new, separate rule block (see §2), and `assets/consent.js` was not touched at all.

## 1. Root cause

Every one of the 22 shared-header pages already ships a complete hamburger-menu structure: `#mobile-menu-toggle` (a `lg:hidden` icon button) and `#mobile-menu-panel` (a `lg:hidden` nav panel, `hidden` by default, toggled via `aria-expanded`/the `hidden` attribute by a working JS handler). The bug is layout, not logic.

`#mobile-menu-panel` sits, in markup, as a plain sibling of the icon-sized header buttons inside `<div class="flex items-center gap-2 md:gap-3 shrink-0">` — itself inside the header's `h-16` (64px-tall) flex row. With no positioning override, the panel stays in normal flow as an unsized flex item of that row: it's squeezed to whatever width its siblings leave it, and clipped to the 64px band.

**Measured** (Playwright, `/resources/`, 375px viewport, menu opened via the real toggle button, before this fix):

```
position: "static"
display: "block"
width: "169.859px"
rect: { top: -79, bottom: 143, left: 185.14, right: 355 }
```

i.e. ~170px wide (not full-width), and extending both above (`top: -79`) and below the visible header band — overlapping page content and partially off-screen, exactly as reported.

This is the same shared header already confirmed byte-identical (JS toggle logic and markup) across all 22 main-template pages during Part 2, so a single fix applies everywhere.

## 2. Fix

Two new rule blocks appended to the shared `assets/index-Dw0yUE42.css` (loaded on all 22 pages, no per-page markup change needed for the CSS itself):

```css
@media (max-width: 1023px) {
  #mobile-menu-panel:not([hidden]) {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    width: 100%;
    z-index: 50;
    max-height: calc(100vh - 4rem);
    overflow-y: auto;
    box-shadow: 0 8px 16px -4px rgba(0, 0, 0, 0.15);
  }
  #mobile-menu-panel nav > a,
  #mobile-menu-panel nav > div > a {
    min-height: 44px;
    display: flex;
    align-items: center;
  }
  #mobile-menu-panel nav > div > a {
    justify-content: center;
  }
}
```

- `position: absolute` lifts the panel out of the constrained flex row. Its containing block is `<header>`, which is already `position: sticky` (no other ancestor between the panel and `<header>` sets a position) — so `top: 100%; left: 0; right: 0; width: 100%` places it as a full-width drawer immediately below the header, with no markup changes required.
- Scoped to `max-width: 1023px` — this stylesheet's own `lg` breakpoint (confirmed as `64rem`/1024px from the compiled `@media(min-width:64rem){...lg\:hidden...}` rule), matching exactly when the hamburger toggle itself is visible. Desktop nav (`lg:flex`, unaffected) is untouched.
- `bg-background`/`border-t border-border` were already on the panel (unchanged) — it renders solid, not transparent, per the requirement.
- `max-height` + `overflow-y: auto` guard against a future nav list taller than the viewport; not currently triggered (the panel is 222px tall with 5 items).
- The panel's own links measured a 36px tap target (`py-2` padding + text line-height) — under the 44px minimum. The added rule centers each link's content in a 44px-tall flex box without changing its visible padding/text size. The CTA link (`nav > div > a`, one level deeper, already `text-center`) gets `justify-content: center` in its own rule to preserve that centering under `display: flex`.

**JS additions** (inserted into the existing `if (menuBtn && menuPanel) { ... }` block, identical across all 22 pages, right after the existing link-click-closes-menu handler — no existing logic modified):

- Clicking the toggle to *open* the panel moves focus to its first link.
- `Escape` closes the panel and returns focus to the toggle button.
- A click anywhere outside the open panel and the toggle button closes the panel (without touching the existing per-link close-on-click handler already in place).

## 3. Verification

Real Playwright/Chromium testing (`executablePath: '/opt/pw-browsers/chromium'`) against a local static server of the actual repo content, `fonts.googleapis.com`/`fonts.gstatic.com` blocked (sandbox has no network access to them), `waitUntil: 'domcontentloaded'`.

**Pages tested:** `/resources/`, `/`, `/catalog/`, `/contact/`, `/how-we-work/` (representative sample of the 22 shared-header pages — markup for the header/panel/JS block confirmed byte-identical across all 22 before this fix was written, and the fix touches only the shared CSS file plus the identical JS block on every page).

**Viewports:** 320, 360, 390, 412, 768px. **Themes:** light and dark (`.dark` class + `tc-theme` storage key, matching the site's own toggle).

For every (page × viewport × theme) combination — 50 combinations total — with the menu opened via the real toggle button:

- `position: absolute` confirmed (not `static`).
- Panel width equals the viewport width (full-width drawer, not squeezed).
- Panel top ≥ 0 (not clipped off the top of the viewport, unlike the pre-fix `-79px`).
- Zero horizontal overflow (`document.documentElement.scrollWidth` ≤ `clientWidth`), both with the menu open and closed.
- `Escape` closes the panel and returns focus to `#mobile-menu-toggle`.
- A click outside the panel/toggle closes the panel.

**Result: 0 failures across all 50 combinations.**

**Tap targets:** re-checked separately (18 page/viewport/theme combinations at 320/375/412px, both themes) — every link in the open panel (`Products`, `Quality`, `Resources`, `About`, `Request a Quote`) now measures ≥44px tall. 0 failures.

**Hero/content overlap while closed:** confirmed zero overflow and the header sits at its normal sticky position with the panel `hidden` — no layout change to the page at rest. (While the menu is *open*, the drawer intentionally covers the top of the page content beneath it, per the site's own dropdown-drawer pattern for this breakpoint — the same standard behavior as before this fix, just now positioned correctly instead of clipped/squeezed. It does not overlap the WhatsApp FAB, Cookie Preferences reopen control, or Read Our Insights widget, none of which render inside the header.)

**Visible focus:** confirmed via computed style on `#mobile-menu-toggle` after `.focus()` — `outline-style: auto` (browser default focus ring, not suppressed anywhere in the stylesheet; pre-existing, unaffected by this change).

**Reduced motion:** no `transition`/`animation` property was added by this fix, so no `prefers-reduced-motion` handling is needed for it.

**Structural validation (all 22 files):**
- `<div>` open/close tag counts balanced.
- Every JSON-LD `<script type="application/ld+json">` block still parses as valid JSON.
- Every non-JSON-LD inline `<script>` block passes `node --check`.
- `html.parser.HTMLParser().feed()` completes without error.
- `#mobile-menu-panel` and `#mobile-menu-toggle` each still occur exactly once per file.

## 4. Changed files

- `assets/index-Dw0yUE42.css` — one new rule block appended (see §2). No existing rule modified.
- 22 shared-header HTML files — one new block of JS inserted into each page's existing mobile-menu IIFE (see §2 and the file list below). No existing JS logic modified, no markup/attributes changed.

```
catalog/index.html, contact/index.html, downloads/index.html, how-we-work/index.html,
index.html, media/index.html, media/choosing-a-trusted-olive-exporter/index.html,
media/egyptian-olive-prices-2026/index.html, media/green-vs-black-vs-oxidized-olives/index.html,
media/health-benefits-of-table-olives/index.html, media/how-to-import-egyptian-table-olives/index.html,
media/olive-export-packaging-guide/index.html, media/olives-in-everyday-cooking/index.html,
privacy/index.html, resources/index.html, resources/certifications/index.html,
resources/export-markets/index.html, resources/faq/index.html, resources/packaging/index.html,
resources/pricing/index.html, resources/why-egyptian-olives/index.html, sample/index.html
```

## 5. Not covered by this pass

- The 10 `/products/*` pages have a different, simpler header with no hamburger menu at all (Part 2 gave it a minimal overflow-only fix, `flex-wrap`, and explicitly deferred a full drawer redesign). This task's fix targets `#mobile-menu-panel`, which does not exist on those pages — they are unaffected by and out of scope for this change.
- No content, route, consent/privacy logic, analytics, or SEO metadata was touched.
