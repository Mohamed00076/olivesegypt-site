# Responsive Layout Audit — Part 2

**Date:** 2026-09-02
**Scope:** Mobile responsive layout only (Part 2 of the current session's plan). Dark-mode contrast is covered separately in `contrast-audit.md`. Part 2B (mobile header/hamburger-menu behavior) is a later, separate task building on this baseline.

## Methodology

- Repo is a pre-built static site, no build step, no framework — plain HTML files, one Tailwind stylesheet (`assets/index-Dw0yUE42.css`, compiled elsewhere, frozen — no Tailwind CLI in this repo) shared across nearly every page.
- Tested with a real headless browser (Playwright + Chromium) against a local static server of the actual repo content — not visual inspection alone. Every finding below was **measured** (`document.documentElement.scrollWidth` vs `clientWidth`, and a DOM walk for any element wider than or extending past the viewport), not assumed.
- Required viewports tested: 320, 360, 375, 390, 412, 768px, and a 1024–1280px desktop width.
- Both light and dark theme tested (dark via `localStorage.setItem('tc-theme','dark')`, matching the site's own toggle mechanism built earlier this session).
- Pages swept for horizontal overflow: `/`, `/catalog/`, `/products/aggizi-green-olives/`, `/contact/`, `/privacy/`, `/resources/certifications/`, `/resources/faq/`, `/how-we-work/`.

## Finding 1 — `/catalog` filter-row horizontal overflow (primary, named reproduction case)

**Root cause:** the filter-button row (`<div class="flex gap-1 py-2">`, catalog/index.html) is a plain `flex` row with no `flex-wrap` and no `overflow-x-auto`. It holds four filter buttons ("All Varieties," "Green Olives," "Black Olives," "Specialty & Antipasti") plus a trailing `<span class="ml-auto ...">` group ("N varieties" text + a "Download Full Catalog (PDF)" button). None of these have anywhere to go on a narrow viewport, so the row — and with it the whole page — is forced wider than the screen.

**Measured before:** at a 375px viewport, `scrollWidth` = 609px against a 375px `clientWidth` (confirmed via direct DOM measurement, not inferred). Reproduced identically at 320/360/390px.

**Fix:** added two scoped classes (`tc-catalog-filters`, `tc-catalog-filters-meta`) to the row and its trailing group, and a mobile-only (`max-width: 639px`) media query in a new `<style>` block in `catalog/index.html`'s `<head>`:
- The row gets `flex-wrap: wrap` — filter buttons wrap onto additional lines as needed instead of overflowing.
- The trailing meta group gets `flex-basis: 100%` — it's always forced onto its own full-width line rather than fighting the buttons for space that isn't there.
- Scoped to `max-width: 639px` (Tailwind's own `sm` breakpoint in this stylesheet) so desktop's already-correct single-row layout is untouched.

**Measured after:** zero overflow at every required viewport (320/360/375/390/412/768/1024px), confirmed by re-running the same measurement.

**Changed file:** `catalog/index.html`

## Finding 2 — `/products/*` header nav overflow (10 pages)

**Root cause:** the 10 individual product pages share a simpler header than the 22-page "main template" header (confirmed byte-identical across all 10, from earlier this session's work). Its `<nav class="flex gap-4 text-sm font-medium">` (logo + 3 links + theme toggle, all one non-wrapping row) has no responsive treatment at all — no hamburger menu, no wrap, no hide-on-mobile.

**Measured before:** a small but real 4px overflow at 390px (`scrollWidth` 394 vs `clientWidth` 390), traced via a DOM sweep to the header's rightmost button/icon being pushed just past the viewport edge.

**Fix (deliberately minimal — see scope note below):** a mobile-only (`max-width: 639px`) rule appended to the shared `assets/index-Dw0yUE42.css` (already loaded on all 10 pages), targeting the nav's exact class list with `flex-wrap: wrap`. This eliminates the overflow by letting the nav wrap onto a second line rather than force the page wider than the screen.

**Scope note:** this is intentionally *not* a hamburger-menu redesign — turning this header into a proper mobile drawer menu (matching the 22-page header's `hidden lg:flex` pattern) is Part 2B's explicit, separate task once this baseline is approved. This fix only satisfies Part 2's "no horizontal page overflow" requirement for these 10 pages in the meantime.

**Measured after:** zero overflow at every required viewport on `/products/aggizi-green-olives/` (used as the representative page, since all 10 share identical header markup).

**Changed file:** `assets/index-Dw0yUE42.css`

## Finding 3 — "Read Our Insights" floating widget covers hero content

**Root cause:** the widget (`data-testid="floating-blog-link"`, shared across 14 pages) is `position: fixed; top: 50%; transform: translateY(-50%); right: 0` — vertically centered on whatever the *viewport* currently shows, not the page. Confirmed via direct measurement on `/catalog` at a 375px viewport: the widget's bounding box (`top: 423, right: 375`) sits directly over the hero's stat row ("10 product varieties" / "Prepared for export worldwide"), because a viewport-centered fixed element has no scroll-aware way to avoid whatever content happens to be in the middle of the screen.

**Fix:** a mobile-only (`max-width: 639px`) rule appended to `assets/index-Dw0yUE42.css`, overriding the widget's position to anchor near the bottom of the viewport (`bottom: 88px`, `top: auto`, `transform: none`) — stacked just above the WhatsApp button on the same right edge — plus a `max-width: 200px` cap. Anchoring to the bottom keeps it out of the vertical-center "sweet spot" at every scroll position, since content simply scrolls past a bottom-anchored element. Desktop (≥640px) keeps the original centered design untouched.

**Verified via screenshot** (not just measurement): before, the widget visibly overlaps the hero stat row; after, it sits cleanly stacked above the WhatsApp button with no overlap, in both themes. See `part2-after/consent-reopen-{light,dark}.png`.

**Changed file:** `assets/index-Dw0yUE42.css`

## What was *not* found to be broken

- The main product-card grid (`grid gap-6 sm:grid-cols-2 lg:grid-cols-3`) was already correctly responsive — no fix needed.
- The 10 small per-card spec mini-grids (`grid grid-cols-3 gap-2`, showing Salt/Acidity/pH values) use Tailwind's `repeat(3, minmax(0, 1fr))` track sizing by default (confirmed in the compiled stylesheet) — text wraps within its cell rather than forcing the grid wider than its container, so these were not a contributor to the overflow despite the bare (non-responsive-prefixed) class name.
- The catalog hero itself is a single-column, centered layout (`max-w-5xl mx-auto px-4 text-center`) — there is no two-column desktop grid on this page to override for mobile; the "large empty area" symptom originally reported is fully explained by Finding 1's overflow (see below).
- Homepage, contact, privacy, certifications, FAQ, and how-we-work all measured zero horizontal overflow at 320px and 390px, both themes, with no changes needed.

**Note on the originally-reported symptom:** the request described "/catalog... content uses only part of the viewport, leaves a large empty area, or is overlapped by floating controls." The measured root cause (Finding 1) is a **horizontal overflow**, not a two-column/empty-column layout — but the visible symptom matches: an overflowing page can appear to leave dead space or scroll oddly depending on the browser, and the floating-controls overlap (Finding 3) was independently confirmed and fixed. I did not find a separate two-column hero bug on `/catalog` itself.

## Unresolved / out of scope for this pass

- **Content finding, not a layout bug** (recorded separately per the operating rules — see `evidence-needed.md`): while tracing the per-product mini-grids, actual numeric Salt/Acidity/pH values were found published on the catalog page. This wasn't caught in the earlier claims-triage pass (which reported no specific pH/acidity figures existed). Flagging for separate content review — not touched here.
- **Part 2B** (hamburger/mobile-menu redesign for the 22-page header and the 10 product-page headers) — explicitly deferred, per the session's own sequencing.
- Full exhaustive per-page, per-viewport, per-theme screenshot coverage of every page/component named in the original brief (FAQ accordions, resource cards, certification panels, How We Work steps, commercial-term panels individually) was not done — this pass focused on the measurable, reproducible layout defects (horizontal overflow, floating-widget overlap) across a representative sample of 8 pages, not a component-by-component visual audit of all of them. Flagging this honestly rather than claiming coverage that wasn't done.

## Rollback

Two isolated changes:
- `catalog/index.html`: two added classes + one added `<style>` block. Revert by removing both.
- `assets/index-Dw0yUE42.css`: two appended `@media` blocks at the end of the file (product-nav wrap, Insights-widget reposition). Revert by removing the appended blocks (clearly delimited by comments).

No routes, redirects, JSON-LD, consent logic, or analytics behavior touched.
