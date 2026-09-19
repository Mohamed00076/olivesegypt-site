#!/usr/bin/env python3
"""Generates the seven /resources pages.

    python3 scripts/generate-resource-pages.py            # writes into the repo
    python3 scripts/generate-resource-pages.py <out-root> # writes into <out-root>/resources

THIS SCRIPT COULD NOT RUN AT ALL BEFORE 2026-09-19.

Its header and footer were read at import time from two files under
/tmp/claude-0/.../scratchpad/ -- an ephemeral, session-specific path that was
committed to the repository on 2026-09-01 and worked only because that one
container happened to still be alive. On any fresh checkout it raised
FileNotFoundError on line 15, before generating anything.

That is also why it drifted so far. Those two scratch files were a snapshot of
the header and footer as they stood on 1 September, so the script could not
have picked up the navigation rebuild, the Facebook pill, the theme toggle, the
mobile drawer, the footer columns, the consent and site-nav scripts, or the
logo's dimensions no matter how often it ran -- and it emitted the header
tagline that C-91 retired on all seven pages, which check-identity-strings.js
has forbidden since. (That rule is why this paragraph describes the string
instead of quoting it: it forbids the wording in any page or generator, prose
about the rule included, and the exact text belongs in the register row.)

Five of the seven bodies had also fallen behind the shipped pages, in some
cases by more than half the page: /resources/certifications had 8,174
characters of main content against this script's 3,766.

Everything below -- template, header, footer, and all seven bodies -- is
derived from the shipped pages as of 2026-09-19 and verified to reproduce them
byte for byte. Nothing here was written by hand, and nothing is read from
outside the repository.

A NOTE ON WHAT THIS SCRIPT IS

It holds a copy of seven pages that are also edited directly. That is a
standing cost, not a clever design: every edit to one of those pages has to be
mirrored here or the two disagree, which is exactly how the drift above
happened twice. scripts/check-generator-parity.js now makes the disagreement
fail the suite immediately instead of surfacing whenever somebody runs this,
which is the smallest fix that works. Retiring the script, or reworking it to
read each page's own body from disk, are both worth considering and are
decisions about tooling rather than repairs to it.
"""
import os
import sys


def esc(s):
    return s.replace("&", "&amp;").replace('"', "&quot;").replace("<", "&lt;").replace(">", "&gt;")


PAGE_TMPL = """<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <script defer src="/assets/consent.js"></script>
    <script defer src="/assets/locale-switch.js"></script>
    <script defer src="/assets/site-nav.js"></script>
    <script defer src="/assets/analytics.js"></script>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1" />
    <title>{title_esc}</title>
    <meta name="keywords" content="{keywords_esc}" />
    <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />
    <meta name="author" content="Triple Company for Industrial Development" />
    <meta name="geo.region" content="EG" />
    <meta name="geo.country" content="Egypt" />
    <meta name="geo.placename" content="Egypt" />
    <meta name="ICBM" content="30.0444, 31.2357" />
    <meta name="DC.language" content="en" />
    <link rel="alternate" hreflang="en" href="https://olivesegypt.com/resources/{slug}" />
    <link rel="alternate" hreflang="ar" href="https://olivesegypt.com/ar/resources/{slug}" />
    <link rel="alternate" hreflang="x-default" href="https://olivesegypt.com/resources/{slug}" />
    <meta property="og:site_name" content="Triple Company for Industrial Development" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="Triple Company premium Egyptian table olives export" />
    <meta property="og:locale" content="en_US" />
<link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Space+Mono&family=Great+Vibes&display=swap" rel="stylesheet">
    <script type="application/ld+json">
{{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {{
      "@type": "ListItem",
      "position": 1,
      "name": "Home",
      "item": "https://olivesegypt.com/"
    }},
    {{
      "@type": "ListItem",
      "position": 2,
      "name": "Resources",
      "item": "https://olivesegypt.com/resources"
    }},
    {{
      "@type": "ListItem",
      "position": 3,
      "name": "{bc_name}",
      "item": "https://olivesegypt.com/resources/{slug}"
    }}
  ]
}}
</script>
{extra_jsonld}
    <link rel="stylesheet" crossorigin href="/assets/index-Dw0yUE42.css">
    <meta name="description" content="{description_esc}"/>
    <meta property="og:title" content="{title_esc}"/>
    <meta property="og:description" content="{description_esc}"/>
    <meta property="og:url" content="https://olivesegypt.com/resources/{slug}"/>
    <meta property="og:type" content="website"/>
    <meta property="og:image" content="https://olivesegypt.com/opengraph.jpg"/>
    <meta name="twitter:card" content="summary_large_image"/>
    <meta name="twitter:title" content="{title_esc}"/>
    <meta name="twitter:description" content="{description_esc}"/>
    <meta name="twitter:image" content="https://olivesegypt.com/opengraph.jpg"/>
    <link rel="canonical" href="https://olivesegypt.com/resources/{slug}"/>
      <link rel="icon" type="image/x-icon" href="/favicon.ico" />
    <link rel="icon" type="image/png" sizes="48x48" href="/favicon-48.png" />
    <link rel="icon" type="image/png" sizes="96x96" href="/favicon-96.png" />
    <link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png" />
    <link rel="icon" type="image/png" sizes="512x512" href="/icon-512.png" />
    <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
    <link rel="manifest" href="/site.webmanifest" />
    <meta name="theme-color" content="#3f4f2b" />
  </head>
<body>
    <script>
      (function () {{
        'use strict';
        var KEY = 'tc-theme';
        function apply(theme) {{
          document.documentElement.classList.toggle('dark', theme === 'dark');
          document.documentElement.style.colorScheme = theme;
        }}
        function getPreferred() {{
          try {{
            var stored = localStorage.getItem(KEY);
            if (stored === 'dark' || stored === 'light') return stored;
          }} catch (e) {{}}
          return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }}
        apply(getPreferred());
        document.addEventListener('DOMContentLoaded', function () {{
          var btn = document.getElementById('theme-toggle-btn');
          if (!btn) return;
          btn.addEventListener('click', function () {{
            var next = document.documentElement.classList.contains('dark') ? 'light' : 'dark';
            apply(next);
            try {{ localStorage.setItem(KEY, next); }} catch (e) {{}}
          }});
        }});
      }})();
    </script>
    
    <div id="root"><div class="flex min-h-screen flex-col"><header class="relative sticky top-0 z-50 w-full border-b border-border bg-background shadow-sm"><div class="container flex h-16 max-w-screen-2xl items-center justify-between gap-4 mx-auto px-4"><a href="/" class="flex items-center gap-2 shrink-0"><img src="/assets/logo-BJ1TOn9V.png" alt="Triple Company for Industrial Development logo" class="h-8 w-8 object-contain shrink-0" width="236" height="289"/><div class="flex flex-col leading-tight min-w-0"><span class="font-serif text-sm sm:text-[15px] font-bold tracking-tight text-primary whitespace-nowrap">TRIPLE COMPANY</span><span class="hidden sm:block text-[9px] font-medium tracking-[0.12em] text-muted-foreground uppercase whitespace-nowrap">Egyptian Table Olive Export</span></div></a><nav class="tc-nav" aria-label="Primary"><div class="tc-nav-item"><a class="tc-nav-link" href="/catalog">Products</a></div><div class="tc-nav-item"><button type="button" class="tc-nav-trigger" aria-expanded="false" aria-controls="nav-quality">Quality &amp; Documents<svg class="tc-nav-caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button><div class="tc-nav-panel" id="nav-quality" hidden><a href="/resources/certifications">Certifications</a><a href="/downloads">Downloads &amp; Documents</a><a href="/company-profile">Company Profile</a></div></div><div class="tc-nav-item"><button type="button" class="tc-nav-trigger" aria-expanded="false" aria-controls="nav-resources">Resources<svg class="tc-nav-caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button><div class="tc-nav-panel" id="nav-resources" hidden><a href="/downloads">Buyer Guides</a><a href="/resources/private-label">Private Label</a><a href="/resources/packaging">Packaging</a><a href="/resources/pricing">Pricing</a><a href="/resources/faq">FAQ</a><a href="/resources/why-egyptian-olives">Why Egyptian Olives</a><a href="/resources/export-markets">Export Markets</a><a href="/how-we-work">How We Work</a></div></div><div class="tc-nav-item"><button type="button" class="tc-nav-trigger" aria-expanded="false" aria-controls="nav-media">Media Center<svg class="tc-nav-caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button><div class="tc-nav-panel" id="nav-media" hidden><a href="/media/news">Company News</a><a href="/media/blog">Olive Trade Blog</a><a href="/media/inquiries">Media Inquiries</a></div></div><div class="tc-nav-item"><a class="tc-nav-link" href="/about">About</a></div></nav><div class="flex items-center gap-2 md:gap-3 shrink-0"><a href="https://www.facebook.com/profile.php?id=61592851801873" target="_blank" rel="noopener noreferrer" data-social="facebook" aria-label="Triple Company for Industrial Development on Facebook" title="Follow us on Facebook" class="tc-social-pill tc-social-fb"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="h-5 w-5" aria-hidden="true"><path d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z"/></svg><span class="tc-social-pill-label">Follow</span></a><a href="/ar/resources/{slug}" hreflang="ar" lang="ar" dir="rtl" class="hidden lg:flex items-center text-xs font-semibold text-muted-foreground hover:text-foreground border border-border rounded-md px-2.5 py-1.5 whitespace-nowrap">AR</a><button id="theme-toggle-btn" type="button" aria-label="Toggle dark mode" title="Toggle dark mode" class="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors border border-transparent h-9 w-9 hover:bg-accent hover:text-accent-foreground"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-moon h-5 w-5 dark:hidden" aria-hidden="true"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"></path></svg><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-sun h-5 w-5 hidden dark:block" aria-hidden="true"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2"></path><path d="M12 20v2"></path><path d="m4.93 4.93 1.41 1.41"></path><path d="m17.66 17.66 1.41 1.41"></path><path d="M2 12h2"></path><path d="M20 12h2"></path><path d="m6.34 17.66-1.41 1.41"></path><path d="m19.07 4.93-1.41 1.41"></path></svg><span class="sr-only">Toggle dark mode</span></button><div class="hidden md:flex items-center gap-2"><a href="/contact" class="inline-flex h-9 items-center justify-center whitespace-nowrap rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground tc-cta-primary shadow transition-colors hover:bg-primary/90">Request a Quote</a></div><button id="mobile-menu-toggle" class="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors border border-transparent h-9 w-9 lg:hidden" type="button" aria-expanded="false" aria-controls="mobile-menu-panel"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-menu h-5 w-5" aria-hidden="true"><path d="M4 5h16"/><path d="M4 12h16"/><path d="M4 19h16"/></svg><span class="sr-only">Toggle menu</span></button><div id="mobile-menu-panel" hidden class="lg:hidden border-t border-border bg-background"><nav class="flex flex-col px-4 py-3" aria-label="Primary"><a href="/catalog" class="py-2 text-sm font-medium text-foreground">Products</a><button type="button" class="tc-drawer-trigger flex items-center justify-between py-2 text-sm font-medium text-foreground" aria-expanded="false" aria-controls="drawer-quality">Quality &amp; Documents<svg class="tc-nav-caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button><div id="drawer-quality" hidden class="flex flex-col"><a href="/resources/certifications" class="py-2 ps-4 text-sm text-muted-foreground">Certifications</a><a href="/downloads" class="py-2 ps-4 text-sm text-muted-foreground">Downloads &amp; Documents</a><a href="/company-profile" class="py-2 ps-4 text-sm text-muted-foreground">Company Profile</a></div><button type="button" class="tc-drawer-trigger flex items-center justify-between py-2 text-sm font-medium text-foreground" aria-expanded="false" aria-controls="drawer-resources">Resources<svg class="tc-nav-caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button><div id="drawer-resources" hidden class="flex flex-col"><a href="/downloads" class="py-2 ps-4 text-sm text-muted-foreground">Buyer Guides</a><a href="/resources/private-label" class="py-2 ps-4 text-sm text-muted-foreground">Private Label</a><a href="/resources/packaging" class="py-2 ps-4 text-sm text-muted-foreground">Packaging</a><a href="/resources/pricing" class="py-2 ps-4 text-sm text-muted-foreground">Pricing</a><a href="/resources/faq" class="py-2 ps-4 text-sm text-muted-foreground">FAQ</a><a href="/resources/why-egyptian-olives" class="py-2 ps-4 text-sm text-muted-foreground">Why Egyptian Olives</a><a href="/resources/export-markets" class="py-2 ps-4 text-sm text-muted-foreground">Export Markets</a><a href="/how-we-work" class="py-2 ps-4 text-sm text-muted-foreground">How We Work</a></div><button type="button" class="tc-drawer-trigger flex items-center justify-between py-2 text-sm font-medium text-foreground" aria-expanded="false" aria-controls="drawer-media">Media Center<svg class="tc-nav-caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button><div id="drawer-media" hidden class="flex flex-col"><a href="/media/news" class="py-2 ps-4 text-sm text-muted-foreground">Company News</a><a href="/media/blog" class="py-2 ps-4 text-sm text-muted-foreground">Olive Trade Blog</a><a href="/media/inquiries" class="py-2 ps-4 text-sm text-muted-foreground">Media Inquiries</a></div><a href="/about" class="py-2 text-sm font-medium text-foreground">About</a><div class="flex gap-2 mt-2 pt-2 border-t border-border"><a href="https://www.facebook.com/profile.php?id=61592851801873" target="_blank" rel="noopener noreferrer" data-social="facebook" aria-label="Triple Company for Industrial Development on Facebook" class="tc-social-wide tc-social-fb flex-1">Facebook</a><a href="/ar/resources/{slug}" hreflang="ar" lang="ar" dir="rtl" class="flex-1 text-center rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground">AR</a><a href="/contact" class="flex-1 text-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground tc-cta-primary">Request a Quote</a></div></nav></div></div></div></header>{main_html}<footer class="w-full border-t border-border py-12 mt-12"><div class="container max-w-screen-2xl mx-auto px-4"><div class="tc-footer-cols"><div class="tc-footer-col"><h3>Products</h3><ul><li><a href="/catalog">Products</a></li><li><a href="/downloads">Full Catalog</a></li><li><a href="/catalog/print">Product Specifications</a></li></ul></div><div class="tc-footer-col"><h3>Quality &amp; Documents</h3><ul><li><a href="/resources/certifications">Certifications</a></li><li><a href="/downloads">Downloads &amp; Documents</a></li><li><a href="/company-profile">Company Profile</a></li></ul></div><div class="tc-footer-col"><h3>Resources</h3><ul><li><a href="/downloads">Buyer Guides</a></li><li><a href="/resources/private-label">Private Label</a></li><li><a href="/resources/faq">FAQ</a></li><li><a href="/how-we-work">How We Work</a></li></ul></div><div class="tc-footer-col"><h3>Media Center</h3><ul><li><a href="/media/news">Company News</a></li><li><a href="/media/blog">Olive Trade Blog</a></li><li><a href="/media/inquiries">Media Inquiries</a></li></ul></div><div class="tc-footer-col"><h3>Contact</h3><ul><li><a href="/contact">Contact</a></li><li><a href="/sample">Request a Sample</a></li><li><a href="https://wa.me/201006045961" rel="noopener" target="_blank">WhatsApp</a></li></ul></div></div><div class="mt-10 pt-6 border-t border-border flex flex-col gap-3"><p class="font-serif font-bold text-primary">Triple Company for Industrial Development</p><p class="text-sm text-muted-foreground max-w-2xl">An Egyptian table-olive supplier based in Cairo, Egypt, preparing for international export via approved partner arrangements.</p><p class="text-sm text-muted-foreground">Ouroba Square (ميدان العروبة), 5th Settlement, New Cairo, Cairo, Egypt</p><p class="text-sm text-muted-foreground"><span dir="ltr">sales@olivesegypt.com</span> &middot; <span dir="ltr">+20 100 604 5961</span></p><div class="flex flex-wrap items-center gap-4 pt-2"><a href="/privacy" class="text-xs text-muted-foreground hover:text-foreground">Privacy</a><a href="/unsubscribe" class="text-xs text-muted-foreground hover:text-foreground">Unsubscribe</a><span class="text-xs text-muted-foreground">&copy; Triple Company for Industrial Development. All rights reserved. Website: olivesegypt.com</span></div></div></div></footer><div class="fixed bottom-6 z-50 flex flex-col items-end gap-3 right-6" dir="ltr"><a href="https://wa.me/201006045961" target="_blank" rel="noopener noreferrer" class="bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-full w-14 h-14 flex items-center justify-center shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 active:scale-95 relative" aria-label="Chat on WhatsApp"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="h-7 w-7" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"></path></svg><span class="absolute inset-0 rounded-full bg-[#25D366] animate-ping opacity-30 pointer-events-none"></span></a></div><a href="/media#blog" aria-label="Read our olive trade blog and insights" data-testid="floating-blog-link" class="group fixed top-1/2 z-40 -translate-y-1/2 right-0 rounded-l-2xl hover:-translate-x-1 block w-64 max-w-[74vw] overflow-hidden border border-border/60 bg-card/95 shadow-2xl ring-1 ring-black/5 backdrop-blur transition-transform duration-300"><span class="pointer-events-none absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-primary to-secondary" aria-hidden="true"></span><div class="min-h-[5.5rem] px-5 py-4 ps-6"><div class="flex items-center gap-3" style="opacity:1;transform:none"><span class="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-book-open h-5 w-5 text-primary" aria-hidden="true"><path d="M12 7v14"></path><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"></path></svg><span class="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-secondary shadow-[0_0_0_3px_var(--card)] motion-safe:animate-pulse" aria-hidden="true"></span></span><span class="flex flex-col"><span class="text-sm font-bold leading-tight text-card-foreground">Read Our Insights</span><span class="mt-0.5 inline-flex items-center gap-1 text-[11px] font-semibold text-primary">Explore the blog<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-arrow-right h-3 w-3 transition-transform group-hover:translate-x-0.5" aria-hidden="true"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg></span></span></div></div></a></div><div role="region" aria-label="Notifications (F8)" tabindex="-1" style="pointer-events:none"><ol tabindex="-1" class="fixed top-0 z-[100] flex max-h-screen w-full flex-col-reverse p-4 sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col md:max-w-[420px]"></ol></div></div>
  </body>
</html>"""

HUB_TMPL = """<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <script defer src="/assets/consent.js"></script>
    <script defer src="/assets/locale-switch.js"></script>
    <script defer src="/assets/site-nav.js"></script>
    <script defer src="/assets/analytics.js"></script>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1" />
    <title>Resources for Buyers | Triple Company for Industrial Development</title>
    <meta name="keywords" content="olive packaging options Egypt, Egyptian table olive price per kg, table olive supplier Africa, how to import olives from Egypt" />
    <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />
    <meta name="author" content="Triple Company for Industrial Development" />
    <meta name="geo.region" content="EG" />
    <meta name="geo.country" content="Egypt" />
    <meta name="geo.placename" content="Egypt" />
    <meta name="ICBM" content="30.0444, 31.2357" />
    <meta name="DC.language" content="en" />
    <link rel="alternate" hreflang="en" href="https://olivesegypt.com/resources" />
    <link rel="alternate" hreflang="ar" href="https://olivesegypt.com/ar/resources" />
    <link rel="alternate" hreflang="x-default" href="https://olivesegypt.com/resources" />
    <meta property="og:site_name" content="Triple Company for Industrial Development" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="Triple Company premium Egyptian table olives export" />
    <meta property="og:locale" content="en_US" />
<link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Space+Mono&family=Great+Vibes&display=swap" rel="stylesheet">
    <script type="application/ld+json">
{{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {{
      "@type": "ListItem",
      "position": 1,
      "name": "Home",
      "item": "https://olivesegypt.com/"
    }},
    {{
      "@type": "ListItem",
      "position": 2,
      "name": "Resources",
      "item": "https://olivesegypt.com/resources"
    }}
  ]
}}
</script>
    <link rel="stylesheet" crossorigin href="/assets/index-Dw0yUE42.css">
    <meta name="description" content="Packaging, pricing, sourcing rationale, documentation status, export markets, and FAQ for B2B buyers evaluating Egyptian table olives."/>
    <meta property="og:title" content="Resources for Buyers | Triple Company for Industrial Development"/>
    <meta property="og:description" content="Packaging, pricing, sourcing rationale, documentation status, export markets, and FAQ for B2B buyers evaluating Egyptian table olives."/>
    <meta property="og:url" content="https://olivesegypt.com/resources"/>
    <meta property="og:type" content="website"/>
    <meta property="og:image" content="https://olivesegypt.com/opengraph.jpg"/>
    <meta name="twitter:card" content="summary_large_image"/>
    <meta name="twitter:title" content="Resources for Buyers | Triple Company for Industrial Development"/>
    <meta name="twitter:description" content="Packaging, pricing, sourcing rationale, documentation status, export markets, and FAQ for B2B buyers evaluating Egyptian table olives."/>
    <meta name="twitter:image" content="https://olivesegypt.com/opengraph.jpg"/>
    <link rel="canonical" href="https://olivesegypt.com/resources"/>
      <link rel="icon" type="image/x-icon" href="/favicon.ico" />
    <link rel="icon" type="image/png" sizes="48x48" href="/favicon-48.png" />
    <link rel="icon" type="image/png" sizes="96x96" href="/favicon-96.png" />
    <link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png" />
    <link rel="icon" type="image/png" sizes="512x512" href="/icon-512.png" />
    <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
    <link rel="manifest" href="/site.webmanifest" />
    <meta name="theme-color" content="#3f4f2b" />
  </head>
<body>
    <script>
      (function () {{
        'use strict';
        var KEY = 'tc-theme';
        function apply(theme) {{
          document.documentElement.classList.toggle('dark', theme === 'dark');
          document.documentElement.style.colorScheme = theme;
        }}
        function getPreferred() {{
          try {{
            var stored = localStorage.getItem(KEY);
            if (stored === 'dark' || stored === 'light') return stored;
          }} catch (e) {{}}
          return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }}
        apply(getPreferred());
        document.addEventListener('DOMContentLoaded', function () {{
          var btn = document.getElementById('theme-toggle-btn');
          if (!btn) return;
          btn.addEventListener('click', function () {{
            var next = document.documentElement.classList.contains('dark') ? 'light' : 'dark';
            apply(next);
            try {{ localStorage.setItem(KEY, next); }} catch (e) {{}}
          }});
        }});
      }})();
    </script>
    
    <div id="root"><div class="flex min-h-screen flex-col"><header class="relative sticky top-0 z-50 w-full border-b border-border bg-background shadow-sm"><div class="container flex h-16 max-w-screen-2xl items-center justify-between gap-4 mx-auto px-4"><a href="/" class="flex items-center gap-2 shrink-0"><img src="/assets/logo-BJ1TOn9V.png" alt="Triple Company for Industrial Development logo" class="h-8 w-8 object-contain shrink-0" width="236" height="289"/><div class="flex flex-col leading-tight min-w-0"><span class="font-serif text-sm sm:text-[15px] font-bold tracking-tight text-primary whitespace-nowrap">TRIPLE COMPANY</span><span class="hidden sm:block text-[9px] font-medium tracking-[0.12em] text-muted-foreground uppercase whitespace-nowrap">Egyptian Table Olive Export</span></div></a><nav class="tc-nav" aria-label="Primary"><div class="tc-nav-item"><a class="tc-nav-link" href="/catalog">Products</a></div><div class="tc-nav-item"><button type="button" class="tc-nav-trigger" aria-expanded="false" aria-controls="nav-quality">Quality &amp; Documents<svg class="tc-nav-caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button><div class="tc-nav-panel" id="nav-quality" hidden><a href="/resources/certifications">Certifications</a><a href="/downloads">Downloads &amp; Documents</a><a href="/company-profile">Company Profile</a></div></div><div class="tc-nav-item"><button type="button" class="tc-nav-trigger" aria-expanded="false" aria-controls="nav-resources">Resources<svg class="tc-nav-caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button><div class="tc-nav-panel" id="nav-resources" hidden><a href="/downloads">Buyer Guides</a><a href="/resources/private-label">Private Label</a><a href="/resources/packaging">Packaging</a><a href="/resources/pricing">Pricing</a><a href="/resources/faq">FAQ</a><a href="/resources/why-egyptian-olives">Why Egyptian Olives</a><a href="/resources/export-markets">Export Markets</a><a href="/how-we-work">How We Work</a></div></div><div class="tc-nav-item"><button type="button" class="tc-nav-trigger" aria-expanded="false" aria-controls="nav-media">Media Center<svg class="tc-nav-caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button><div class="tc-nav-panel" id="nav-media" hidden><a href="/media/news">Company News</a><a href="/media/blog">Olive Trade Blog</a><a href="/media/inquiries">Media Inquiries</a></div></div><div class="tc-nav-item"><a class="tc-nav-link" href="/about">About</a></div></nav><div class="flex items-center gap-2 md:gap-3 shrink-0"><a href="https://www.facebook.com/profile.php?id=61592851801873" target="_blank" rel="noopener noreferrer" data-social="facebook" aria-label="Triple Company for Industrial Development on Facebook" title="Follow us on Facebook" class="tc-social-pill tc-social-fb"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="h-5 w-5" aria-hidden="true"><path d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z"/></svg><span class="tc-social-pill-label">Follow</span></a><a href="/ar/resources" hreflang="ar" lang="ar" dir="rtl" class="hidden lg:flex items-center text-xs font-semibold text-muted-foreground hover:text-foreground border border-border rounded-md px-2.5 py-1.5 whitespace-nowrap">AR</a><button id="theme-toggle-btn" type="button" aria-label="Toggle dark mode" title="Toggle dark mode" class="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors border border-transparent h-9 w-9 hover:bg-accent hover:text-accent-foreground"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-moon h-5 w-5 dark:hidden" aria-hidden="true"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"></path></svg><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-sun h-5 w-5 hidden dark:block" aria-hidden="true"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2"></path><path d="M12 20v2"></path><path d="m4.93 4.93 1.41 1.41"></path><path d="m17.66 17.66 1.41 1.41"></path><path d="M2 12h2"></path><path d="M20 12h2"></path><path d="m6.34 17.66-1.41 1.41"></path><path d="m19.07 4.93-1.41 1.41"></path></svg><span class="sr-only">Toggle dark mode</span></button><div class="hidden md:flex items-center gap-2"><a href="/contact" class="inline-flex h-9 items-center justify-center whitespace-nowrap rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground tc-cta-primary shadow transition-colors hover:bg-primary/90">Request a Quote</a></div><button id="mobile-menu-toggle" class="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors border border-transparent h-9 w-9 lg:hidden" type="button" aria-expanded="false" aria-controls="mobile-menu-panel"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-menu h-5 w-5" aria-hidden="true"><path d="M4 5h16"/><path d="M4 12h16"/><path d="M4 19h16"/></svg><span class="sr-only">Toggle menu</span></button><div id="mobile-menu-panel" hidden class="lg:hidden border-t border-border bg-background"><nav class="flex flex-col px-4 py-3" aria-label="Primary"><a href="/catalog" class="py-2 text-sm font-medium text-foreground">Products</a><button type="button" class="tc-drawer-trigger flex items-center justify-between py-2 text-sm font-medium text-foreground" aria-expanded="false" aria-controls="drawer-quality">Quality &amp; Documents<svg class="tc-nav-caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button><div id="drawer-quality" hidden class="flex flex-col"><a href="/resources/certifications" class="py-2 ps-4 text-sm text-muted-foreground">Certifications</a><a href="/downloads" class="py-2 ps-4 text-sm text-muted-foreground">Downloads &amp; Documents</a><a href="/company-profile" class="py-2 ps-4 text-sm text-muted-foreground">Company Profile</a></div><button type="button" class="tc-drawer-trigger flex items-center justify-between py-2 text-sm font-medium text-foreground" aria-expanded="false" aria-controls="drawer-resources">Resources<svg class="tc-nav-caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button><div id="drawer-resources" hidden class="flex flex-col"><a href="/downloads" class="py-2 ps-4 text-sm text-muted-foreground">Buyer Guides</a><a href="/resources/private-label" class="py-2 ps-4 text-sm text-muted-foreground">Private Label</a><a href="/resources/packaging" class="py-2 ps-4 text-sm text-muted-foreground">Packaging</a><a href="/resources/pricing" class="py-2 ps-4 text-sm text-muted-foreground">Pricing</a><a href="/resources/faq" class="py-2 ps-4 text-sm text-muted-foreground">FAQ</a><a href="/resources/why-egyptian-olives" class="py-2 ps-4 text-sm text-muted-foreground">Why Egyptian Olives</a><a href="/resources/export-markets" class="py-2 ps-4 text-sm text-muted-foreground">Export Markets</a><a href="/how-we-work" class="py-2 ps-4 text-sm text-muted-foreground">How We Work</a></div><button type="button" class="tc-drawer-trigger flex items-center justify-between py-2 text-sm font-medium text-foreground" aria-expanded="false" aria-controls="drawer-media">Media Center<svg class="tc-nav-caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button><div id="drawer-media" hidden class="flex flex-col"><a href="/media/news" class="py-2 ps-4 text-sm text-muted-foreground">Company News</a><a href="/media/blog" class="py-2 ps-4 text-sm text-muted-foreground">Olive Trade Blog</a><a href="/media/inquiries" class="py-2 ps-4 text-sm text-muted-foreground">Media Inquiries</a></div><a href="/about" class="py-2 text-sm font-medium text-foreground">About</a><div class="flex gap-2 mt-2 pt-2 border-t border-border"><a href="https://www.facebook.com/profile.php?id=61592851801873" target="_blank" rel="noopener noreferrer" data-social="facebook" aria-label="Triple Company for Industrial Development on Facebook" class="tc-social-wide tc-social-fb flex-1">Facebook</a><a href="/ar/resources" hreflang="ar" lang="ar" dir="rtl" class="flex-1 text-center rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground">AR</a><a href="/contact" class="flex-1 text-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground tc-cta-primary">Request a Quote</a></div></nav></div></div></div></header>{main_html}<footer class="w-full border-t border-border py-12 mt-12"><div class="container max-w-screen-2xl mx-auto px-4"><div class="tc-footer-cols"><div class="tc-footer-col"><h3>Products</h3><ul><li><a href="/catalog">Products</a></li><li><a href="/downloads">Full Catalog</a></li><li><a href="/catalog/print">Product Specifications</a></li></ul></div><div class="tc-footer-col"><h3>Quality &amp; Documents</h3><ul><li><a href="/resources/certifications">Certifications</a></li><li><a href="/downloads">Downloads &amp; Documents</a></li><li><a href="/company-profile">Company Profile</a></li></ul></div><div class="tc-footer-col"><h3>Resources</h3><ul><li><a href="/downloads">Buyer Guides</a></li><li><a href="/resources/private-label">Private Label</a></li><li><a href="/resources/faq">FAQ</a></li><li><a href="/how-we-work">How We Work</a></li></ul></div><div class="tc-footer-col"><h3>Media Center</h3><ul><li><a href="/media/news">Company News</a></li><li><a href="/media/blog">Olive Trade Blog</a></li><li><a href="/media/inquiries">Media Inquiries</a></li></ul></div><div class="tc-footer-col"><h3>Contact</h3><ul><li><a href="/contact">Contact</a></li><li><a href="/sample">Request a Sample</a></li><li><a href="https://wa.me/201006045961" rel="noopener" target="_blank">WhatsApp</a></li></ul></div></div><div class="mt-10 pt-6 border-t border-border flex flex-col gap-3"><p class="font-serif font-bold text-primary">Triple Company for Industrial Development</p><p class="text-sm text-muted-foreground max-w-2xl">An Egyptian table-olive supplier based in Cairo, Egypt, preparing for international export via approved partner arrangements.</p><p class="text-sm text-muted-foreground">Ouroba Square (ميدان العروبة), 5th Settlement, New Cairo, Cairo, Egypt</p><p class="text-sm text-muted-foreground"><span dir="ltr">sales@olivesegypt.com</span> &middot; <span dir="ltr">+20 100 604 5961</span></p><div class="flex flex-wrap items-center gap-4 pt-2"><a href="/privacy" class="text-xs text-muted-foreground hover:text-foreground">Privacy</a><a href="/unsubscribe" class="text-xs text-muted-foreground hover:text-foreground">Unsubscribe</a><span class="text-xs text-muted-foreground">&copy; Triple Company for Industrial Development. All rights reserved. Website: olivesegypt.com</span></div></div></div></footer><div class="fixed bottom-6 z-50 flex flex-col items-end gap-3 right-6" dir="ltr"><a href="https://wa.me/201006045961" target="_blank" rel="noopener noreferrer" class="bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-full w-14 h-14 flex items-center justify-center shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 active:scale-95 relative" aria-label="Chat on WhatsApp"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="h-7 w-7" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"></path></svg><span class="absolute inset-0 rounded-full bg-[#25D366] animate-ping opacity-30 pointer-events-none"></span></a></div><a href="/media#blog" aria-label="Read our olive trade blog and insights" data-testid="floating-blog-link" class="group fixed top-1/2 z-40 -translate-y-1/2 right-0 rounded-l-2xl hover:-translate-x-1 block w-64 max-w-[74vw] overflow-hidden border border-border/60 bg-card/95 shadow-2xl ring-1 ring-black/5 backdrop-blur transition-transform duration-300"><span class="pointer-events-none absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-primary to-secondary" aria-hidden="true"></span><div class="min-h-[5.5rem] px-5 py-4 ps-6"><div class="flex items-center gap-3" style="opacity:1;transform:none"><span class="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-book-open h-5 w-5 text-primary" aria-hidden="true"><path d="M12 7v14"></path><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"></path></svg><span class="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-secondary shadow-[0_0_0_3px_var(--card)] motion-safe:animate-pulse" aria-hidden="true"></span></span><span class="flex flex-col"><span class="text-sm font-bold leading-tight text-card-foreground">Read Our Insights</span><span class="mt-0.5 inline-flex items-center gap-1 text-[11px] font-semibold text-primary">Explore the blog<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-arrow-right h-3 w-3 transition-transform group-hover:translate-x-0.5" aria-hidden="true"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg></span></span></div></div></a></div><div role="region" aria-label="Notifications (F8)" tabindex="-1" style="pointer-events:none"><ol tabindex="-1" class="fixed top-0 z-[100] flex max-h-screen w-full flex-col-reverse p-4 sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col md:max-w-[420px]"></ol></div></div>
  </body>
</html>"""

HUB_MAIN = """<main class="flex-1"><section class="py-16 md:py-20 bg-muted/20"><div class="container max-w-4xl"><p class="text-xs font-semibold uppercase tracking-widest text-primary mb-3">Resource Center</p><h1 class="text-3xl md:text-5xl font-serif font-bold text-foreground mb-4">Resources for Buyers</h1><p class="text-lg text-muted-foreground leading-relaxed">Everything a B2B buyer needs to evaluate Egyptian table olives: packaging, pricing, sourcing rationale, documentation status, target markets, and answers to common questions.</p></div></section><section class="py-16"><div class="container max-w-5xl"><div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-6"><a href="/resources/packaging" class="group rounded-2xl border border-border bg-card p-6 hover:border-primary/40 hover:shadow-md transition-all"><div class="text-3xl mb-3">📦</div><h3 class="font-serif font-bold text-lg text-foreground mb-2 group-hover:text-primary transition-colors">Packaging Options</h3><p class="text-sm text-muted-foreground leading-relaxed">Formats we offer and how caliber sizing works, plus private-label packaging.</p></a><a href="/resources/pricing" class="group rounded-2xl border border-border bg-card p-6 hover:border-primary/40 hover:shadow-md transition-all"><div class="text-3xl mb-3">💵</div><h3 class="font-serif font-bold text-lg text-foreground mb-2 group-hover:text-primary transition-colors">Pricing</h3><p class="text-sm text-muted-foreground leading-relaxed">What drives the price per kg, and how to request a current quote.</p></a><a href="/resources/why-egyptian-olives" class="group rounded-2xl border border-border bg-card p-6 hover:border-primary/40 hover:shadow-md transition-all"><div class="text-3xl mb-3">🌍</div><h3 class="font-serif font-bold text-lg text-foreground mb-2 group-hover:text-primary transition-colors">Why Egyptian Olives</h3><p class="text-sm text-muted-foreground leading-relaxed">Egypt's position in the global table-olive trade.</p></a><a href="/resources/certifications" class="group rounded-2xl border border-border bg-card p-6 hover:border-primary/40 hover:shadow-md transition-all"><div class="text-3xl mb-3">📋</div><h3 class="font-serif font-bold text-lg text-foreground mb-2 group-hover:text-primary transition-colors">Certifications & Documentation</h3><p class="text-sm text-muted-foreground leading-relaxed">Where our quality documentation currently stands.</p></a><a href="/resources/private-label" class="group rounded-2xl border border-border bg-card p-6 hover:border-primary/40 hover:shadow-md transition-all"><div class="text-3xl mb-3">🏷️</div><h3 class="font-serif font-bold text-lg text-foreground mb-2 group-hover:text-primary transition-colors">Private Label &amp; OEM</h3><p class="text-sm text-muted-foreground leading-relaxed">Build your own brand: ten products, four packaging formats, one brief.</p></a><a href="/resources/supply-network" class="group rounded-2xl border border-border bg-card p-6 hover:border-primary/40 hover:shadow-md transition-all"><div class="text-3xl mb-3">🔗</div><h3 class="font-serif font-bold text-lg text-foreground mb-2 group-hover:text-primary transition-colors">Supply &amp; Processing Network</h3><p class="text-sm text-muted-foreground leading-relaxed">Who does what, and where — including the parts we do not do ourselves.</p></a><a href="/resources/export-markets" class="group rounded-2xl border border-border bg-card p-6 hover:border-primary/40 hover:shadow-md transition-all"><div class="text-3xl mb-3">🚢</div><h3 class="font-serif font-bold text-lg text-foreground mb-2 group-hover:text-primary transition-colors">Export Markets</h3><p class="text-sm text-muted-foreground leading-relaxed">The regions we're actively engaging as buyers.</p></a><a href="/resources/faq" class="group rounded-2xl border border-border bg-card p-6 hover:border-primary/40 hover:shadow-md transition-all"><div class="text-3xl mb-3">❓</div><h3 class="font-serif font-bold text-lg text-foreground mb-2 group-hover:text-primary transition-colors">FAQ</h3><p class="text-sm text-muted-foreground leading-relaxed">Direct answers to the questions B2B buyers ask most.</p></a></div></div></section><section class="py-16 bg-muted/20"><div class="container max-w-3xl text-center"><h2 class="text-2xl md:text-3xl font-serif font-bold text-foreground mb-3">Can't find what you need?</h2><p class="text-muted-foreground mb-6 leading-relaxed">Ask our export team directly — we'll get you a precise answer.</p><div class="flex flex-wrap justify-center gap-3"><a href="/contact" class="inline-flex h-12 items-center justify-center rounded-md bg-primary px-6 text-sm font-bold text-primary-foreground shadow hover:bg-primary/90 transition-colors">Request a Quote</a><a href="/sample" class="inline-flex h-12 items-center justify-center rounded-md border border-secondary/60 bg-card px-6 text-sm font-semibold text-secondary hover:bg-secondary hover:text-secondary-foreground transition-colors">Request a Sample</a></div></div></section></main>"""

PAGES = [
    dict(
        slug='packaging',
        title='Packaging Options for Export | Triple Company for Industrial Development',
        bc_name='Packaging Options for Export',
        description='Glass jars, tin cans, plastic buckets, plastic barrels, and vacuum pouches for Egyptian table olive export — plus how caliber sizing works and private-label/OEM packaging.',
        keywords='olive packaging options Egypt, bulk olive drums, olive drums buckets cans jars wholesale supplier, private label custom OEM olive packaging',
        extra_jsonld="",
        main_html="""<main class="flex-1"><section class="py-16 md:py-20 bg-muted/20"><div class="container max-w-4xl"><p class="text-xs font-semibold uppercase tracking-widest text-primary mb-3">Packaging & Sizing</p><h1 class="text-3xl md:text-5xl font-serif font-bold text-foreground mb-4">Packaging Options for Export</h1><p class="text-lg text-muted-foreground leading-relaxed">How Egyptian table olives are packaged for bulk, retail, food-service, and private-label export, and how caliber sizing works.</p></div></section><section class="py-16"><div class="container max-w-4xl">

<h2 class="text-2xl font-serif font-bold text-foreground mb-6">Packaging formats we offer</h2>
<div class="space-y-4 mb-6"><div class="rounded-xl border border-border bg-card p-5"><h3 class="font-semibold text-foreground mb-1">Glass Jars</h3><p class="text-sm text-muted-foreground leading-relaxed">Premium retail and deli presentation. Common sizes from 300g to 1.7kg. Showcases the product; supports branded and private-label labeling.</p></div><div class="rounded-xl border border-border bg-card p-5"><h3 class="font-semibold text-foreground mb-1">Tin Cans</h3><p class="text-sm text-muted-foreground leading-relaxed">Shelf-stable and durable, ideal for food service, warm-climate export, and oxidized black olive lines. Stack and ship efficiently.</p></div><div class="rounded-xl border border-border bg-card p-5"><h3 class="font-semibold text-foreground mb-1">Plastic Buckets</h3><p class="text-sm text-muted-foreground leading-relaxed">Food-grade buckets, typically 1–10kg, for restaurants, caterers, and repackers. Balance cost, volume, and convenience.</p></div><div class="rounded-xl border border-border bg-card p-5"><h3 class="font-semibold text-foreground mb-1">Plastic Barrels</h3><p class="text-sm text-muted-foreground leading-relaxed">Bulk brine maturation and shipping in 220 kg barrels, for the lowest cost per kilogram on large volumes.</p></div><div class="rounded-xl border border-border bg-card p-5"><h3 class="font-semibold text-foreground mb-1">Vacuum Pouches</h3><p class="text-sm text-muted-foreground leading-relaxed">Compact, lightweight format for pitted or sliced product where brine weight and volume need to be minimized.</p></div></div>
<p class="text-sm text-muted-foreground leading-relaxed mb-14">These are the packaging formats confirmed as available. Exact sizes, case configurations, and minimum order quantities per format are confirmed during quotation and depend on the specific product and order volume.</p>

<h2 class="text-2xl font-serif font-bold text-foreground mb-4">Understanding caliber sizing</h2>
<p class="text-muted-foreground leading-relaxed mb-4">Table olives are graded by caliber — the count of olives per kilogram, written as a range such as <span class="font-semibold text-foreground">181/200</span>. A lower number means larger individual olives. Premium retail jars typically use 101/110 to 181/200; food-service and bulk repacking often use 201/230 and above at a lower cost per kilogram. Exact caliber ranges available for each variety are listed on the <a href="/catalog" class="font-semibold text-primary underline underline-offset-2 decoration-primary/40 hover:decoration-primary transition-colors">product catalog</a> and each product's own page.</p>

<h2 class="text-2xl font-serif font-bold text-foreground mb-4">Private label &amp; OEM packaging</h2>
<div class="rounded-2xl border border-primary/20 bg-primary/5 p-6 md:p-8">
<p class="text-base text-foreground leading-relaxed mb-3">Your brand, your packaging design, our export-ready product. We support private-label packaging across glass, tin, bucket, and barrel formats, handling printing, filling, and export documentation. We can help with label design on request. Full details, the ten products available and the brief form are on the <a href="/resources/private-label" class="text-primary underline">Private Label &amp; OEM</a> page.</p>
<p class="text-sm text-muted-foreground leading-relaxed">Minimum order quantity, artwork specifications, and labeling requirements for private-label and custom packaging are confirmed per project during quotation, since they depend on the format, print method, and volume you need. Tell us what you have in mind and we'll confirm exactly what's possible.</p>
</div>
</div></section><section class="py-16 bg-muted/20"><div class="container max-w-3xl text-center"><h2 class="text-2xl md:text-3xl font-serif font-bold text-foreground mb-3">Have a packaging format in mind?</h2><p class="text-muted-foreground mb-6 leading-relaxed">Tell us your target format, volume, and market — we'll confirm options, MOQ, and lead time.</p><div class="flex flex-wrap justify-center gap-3"><a href="/contact" class="inline-flex h-12 items-center justify-center rounded-md bg-primary px-6 text-sm font-bold text-primary-foreground shadow hover:bg-primary/90 transition-colors">Request a Quote</a><a href="/downloads" class="inline-flex h-12 items-center justify-center rounded-md border border-secondary/60 bg-card px-6 text-sm font-semibold text-secondary hover:bg-secondary hover:text-secondary-foreground transition-colors">Download Full Catalog</a></div></div></section></main>""",
    ),
    dict(
        slug='pricing',
        title='Egyptian Table Olive Pricing | Triple Company for Industrial Development',
        bc_name='Egyptian Table Olive Pricing',
        description='What drives Egyptian table-olive prices — harvest, currency, variety, caliber, packaging, and freight — and how to request a current, honest quote.',
        keywords='Egyptian table olive price per kg, olive wholesale price, olive wholesale minimum order',
        extra_jsonld="",
        main_html="""<main class="flex-1"><section class="py-16 md:py-20 bg-muted/20"><div class="container max-w-4xl"><p class="text-xs font-semibold uppercase tracking-widest text-primary mb-3">Market Guidance</p><h1 class="text-3xl md:text-5xl font-serif font-bold text-foreground mb-4">Egyptian Table Olive Pricing</h1><p class="text-lg text-muted-foreground leading-relaxed">What actually moves table-olive prices, how to think about your landed cost, and how to get a current quote — not a fixed price list.</p></div></section><section class="py-16"><div class="container max-w-4xl">

<div class="rounded-2xl border border-primary/20 bg-primary/5 p-6 md:p-8 mb-14"><p class="text-base text-foreground leading-relaxed">Table-olive prices move with the season, so we don't publish a fixed price list on this page — any number we printed today could be wrong by the time you read it. Instead, this page explains what actually drives pricing, and you can request a current, honest quote any time, free of charge.</p></div>

<h2 class="text-2xl font-serif font-bold text-foreground mb-6">What drives the price per kg</h2>
<div class="grid md:grid-cols-2 gap-6 mb-14">
<div class="rounded-2xl border border-border bg-card p-6"><h3 class="font-semibold text-foreground mb-2">Harvest yield &amp; weather</h3><p class="text-sm text-muted-foreground leading-relaxed">Egypt's main olive harvest runs through the autumn. A strong yield increases supply and softens prices into the new season; drought or an off-cycle year (olive trees follow a natural biennial bearing pattern) tightens availability.</p></div>
<div class="rounded-2xl border border-border bg-card p-6"><h3 class="font-semibold text-foreground mb-2">Currency movements</h3><p class="text-sm text-muted-foreground leading-relaxed">Exports are priced in USD, so the Egyptian pound's exchange rate affects competitiveness. Currency volatility introduces short-term swings worth watching if you're timing an order.</p></div>
<div class="rounded-2xl border border-border bg-card p-6"><h3 class="font-semibold text-foreground mb-2">Variety &amp; caliber</h3><p class="text-sm text-muted-foreground leading-relaxed">Large-caliber green olives and stuffed specialty lines sit at the premium end. Mid-caliber and oxidized black olives offer better value for high-volume food service.</p></div>
<div class="rounded-2xl border border-border bg-card p-6"><h3 class="font-semibold text-foreground mb-2">Packaging &amp; freight</h3><p class="text-sm text-muted-foreground leading-relaxed">Glass costs more per unit than bulk barrel; ocean freight rates and container availability also feed into your landed cost even when the FOB price hasn't moved.</p></div>
</div>

<h2 class="text-2xl font-serif font-bold text-foreground mb-4">An illustrative example</h2>
<div class="rounded-2xl border-2 border-amber-500/40 bg-card p-6 mb-2">
<div class="inline-flex items-center rounded-md border border-amber-500/40 text-amber-700 dark:text-amber-500 text-xs font-bold uppercase tracking-wide px-2.5 py-1 mb-4">Hypothetical example — not real pricing</div>
<p class="text-sm text-muted-foreground leading-relaxed mb-4">To show how these factors combine — not as a quote — consider a buyer sourcing Aggizi Green Olives, caliber 141/160, in bulk barrel packaging, for a full 1&times;20ft container FOB Alexandria, landing at a Northern European port. Every figure below is a made-up number chosen only to illustrate how the pieces stack — none of it reflects Triple Company's actual current pricing.</p>

<div class="overflow-x-auto rounded-xl border border-border mb-3">
<table class="w-full text-sm border-collapse">
<tbody>
<tr class="border-b border-border"><td class="px-4 py-2.5 text-foreground">FOB price <span class="text-xs text-amber-700 dark:text-amber-500 font-semibold">(made-up example)</span></td><td class="px-4 py-2.5 text-right font-mono text-foreground">$2.80 / kg</td></tr>
<tr class="border-b border-border"><td class="px-4 py-2.5 text-foreground">Ocean freight, Alexandria &rarr; N. Europe <span class="text-xs text-amber-700 dark:text-amber-500 font-semibold">(made-up example)</span></td><td class="px-4 py-2.5 text-right font-mono text-foreground">$0.35 / kg</td></tr>
<tr class="border-b border-border"><td class="px-4 py-2.5 text-foreground">Import duty <span class="text-xs text-amber-700 dark:text-amber-500 font-semibold">(made-up example rate)</span></td><td class="px-4 py-2.5 text-right font-mono text-foreground">$0.25 / kg</td></tr>
<tr class="border-b border-border"><td class="px-4 py-2.5 text-foreground">Local repacking into retail packs, optional <span class="text-xs text-amber-700 dark:text-amber-500 font-semibold">(made-up example)</span></td><td class="px-4 py-2.5 text-right font-mono text-foreground">$0.15 / kg</td></tr>
<tr><td class="px-4 py-2.5 font-bold text-foreground">Estimated landed cost <span class="text-xs text-amber-700 dark:text-amber-500 font-semibold">(fictional total — do not quote)</span></td><td class="px-4 py-2.5 text-right font-mono font-bold text-foreground">$3.55 / kg</td></tr>
</tbody>
</table>
</div>
<p class="text-xs text-muted-foreground border-t border-border pt-3">Every number above is fictional and invented purely to demonstrate the calculation — not a quote, not a benchmark, not derived from any real Triple Company price. Actual FOB pricing depends on the current season, your exact variety/caliber/packaging, and destination, and is confirmed on request at no cost.</p>
</div>
<p class="text-sm text-muted-foreground leading-relaxed mb-14">Want the real numbers for your order? <a href="/contact" class="font-semibold text-primary underline underline-offset-2 decoration-primary/40 hover:decoration-primary transition-colors">Request a current quote</a> and we'll confirm an honest price against your exact terms.</p>

<h2 class="text-2xl font-serif font-bold text-foreground mb-4">Requesting a current quote</h2>
<p class="text-muted-foreground leading-relaxed">When you request pricing, the fastest way to get an accurate number is to tell us: the variety and caliber you need, your preferred packaging format, your target order volume, your destination port, and which Incoterm you prefer (FOB, CIF, or CFR). We'll confirm a current, honest price against exactly those terms rather than a generic range.</p>
</div></section><section class="py-16 bg-muted/20"><div class="container max-w-3xl text-center"><h2 class="text-2xl md:text-3xl font-serif font-bold text-foreground mb-3">Ready for a current quote?</h2><p class="text-muted-foreground mb-6 leading-relaxed">Tell us your variety, caliber, packaging, volume, destination port, and preferred Incoterm — we'll send a tailored, current price.</p><div class="flex flex-wrap justify-center gap-3"><a href="/contact" class="inline-flex h-12 items-center justify-center rounded-md bg-primary px-6 text-sm font-bold text-primary-foreground shadow hover:bg-primary/90 transition-colors">Request Current Pricing</a><a href="/sample" class="inline-flex h-12 items-center justify-center rounded-md border border-secondary/60 bg-card px-6 text-sm font-semibold text-secondary hover:bg-secondary hover:text-secondary-foreground transition-colors">Request a Sample</a></div></div></section></main>""",
    ),
    dict(
        slug='why-egyptian-olives',
        title='Why Egyptian Olives | Triple Company for Industrial Development',
        bc_name='Why Egyptian Olives',
        description="Egypt's position in the global table-olive trade — production growth, variety range, harvest timing, and cost position — for bulk, co-packing, and private-label buyers.",
        keywords='Egyptian olives vs Spanish olives, best table olive origin, bulk table olives supplier, olive co-packer, olive contract packing, olive OEM manufacturer, olive white label supplier',
        extra_jsonld="",
        main_html="""<main class="flex-1"><section class="py-16 md:py-20 bg-muted/20"><div class="container max-w-4xl"><p class="text-xs font-semibold uppercase tracking-widest text-primary mb-3">Sourcing Origin</p><h1 class="text-3xl md:text-5xl font-serif font-bold text-foreground mb-4">Why Egyptian Olives</h1><p class="text-lg text-muted-foreground leading-relaxed">A look at Egypt's position in the global table-olive trade, and what that means for bulk, wholesale, co-packing, and private-label buyers.</p></div></section><section class="py-16"><div class="container max-w-4xl">

<div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-14">
<div class="rounded-xl border border-border bg-muted/30 p-5 text-center"><div class="text-2xl mb-1">🌍</div><p class="text-2xl font-bold font-serif text-primary">#1</p><p class="text-xs text-muted-foreground mt-1 leading-snug">Table Olive Exporter in Africa</p></div>
<div class="rounded-xl border border-border bg-muted/30 p-5 text-center"><div class="text-2xl mb-1">📦</div><p class="text-2xl font-bold font-serif text-primary">698K MT</p><p class="text-xs text-muted-foreground mt-1 leading-snug">Annual Production (2023)</p></div>
<div class="rounded-xl border border-border bg-muted/30 p-5 text-center"><div class="text-2xl mb-1">📈</div><p class="text-2xl font-bold font-serif text-primary">+45%</p><p class="text-xs text-muted-foreground mt-1 leading-snug">Production Growth (2014–2023)</p></div>
</div>
<p class="text-xs text-muted-foreground text-center -mt-10 mb-14">Source: FAO / IOC</p>

<h2 class="text-2xl font-serif font-bold text-foreground mb-4">A leading, growing origin</h2>
<p class="text-muted-foreground leading-relaxed mb-6">Egypt has quietly become one of the world's largest table-olive producers, and Africa's leading table-olive exporter, on the back of fertile Nile Delta and Fayoum growing regions, a long harvest window, and competitive FOB Alexandria pricing. Production has grown 45% over the past decade, reflecting sustained investment in the sector. We don't claim Egypt is the "best" origin for every buyer — the right origin depends on your variety, caliber, flavor profile, and price point — but it is a serious, scaling origin worth evaluating alongside any other.</p>

<h2 class="text-2xl font-serif font-bold text-foreground mb-4">How Egyptian olives compare</h2>
<p class="text-muted-foreground leading-relaxed mb-4">Egypt is one of several table-olive origins buyers evaluate alongside Spain, Turkey, and Greece. Here is how recent production compares across these four origins:</p>

<div class="overflow-x-auto rounded-2xl border border-border mb-2">
<table class="w-full text-sm border-collapse">
<thead>
<tr class="bg-muted/30 border-b border-border">
<th class="text-left font-semibold text-foreground px-4 py-3">Origin</th>
<th class="text-left font-semibold text-foreground px-4 py-3">Table Olive Production, 2023/24</th>
<th class="text-left font-semibold text-foreground px-4 py-3">Year-over-Year</th>
</tr>
</thead>
<tbody>
<tr class="border-b border-border"><td class="px-4 py-3 font-medium text-foreground">Egypt</td><td class="px-4 py-3 text-foreground">23% of world production</td><td class="px-4 py-3 font-semibold text-foreground">+8%</td></tr>
<tr class="border-b border-border"><td class="px-4 py-3 font-medium text-foreground">Spain</td><td class="px-4 py-3 text-foreground">854,000 tonnes</td><td class="px-4 py-3 font-semibold text-foreground">+28%</td></tr>
<tr class="border-b border-border"><td class="px-4 py-3 font-medium text-foreground">Turkey</td><td class="px-4 py-3 text-foreground">215,000 tonnes</td><td class="px-4 py-3 font-semibold text-foreground">&minus;52%</td></tr>
<tr><td class="px-4 py-3 font-medium text-foreground">Greece</td><td class="px-4 py-3 text-foreground">175,000 tonnes</td><td class="px-4 py-3 font-semibold text-foreground">&minus;49%</td></tr>
</tbody>
</table>
</div>
<p class="text-xs text-muted-foreground italic mb-8">Source: International Olive Council, "World Market of Olive Oil and Table Olives," 2023/24 crop-year figures, found via web search during this update. These figures could not be independently verified against the primary IOC document in this session and should be treated as needs-review pending direct confirmation. Egypt's 2023/24 crop-year share is reported on a different cycle than the "698K MT (2023)" figure above, so the two are not directly comparable to each other.</p>

<div class="grid md:grid-cols-2 gap-6 mb-6">
<div class="rounded-2xl border border-border bg-card p-6"><h3 class="font-semibold text-foreground mb-2">Variety range</h3><p class="text-sm text-muted-foreground leading-relaxed">Egypt grows both signature local varieties (Aggizi, Toffahi, Hamed) and internationally recognized varieties like Manzanilla, giving buyers a way to source a familiar variety from a competitively priced, less saturated origin.</p></div>
<div class="rounded-2xl border border-border bg-card p-6"><h3 class="font-semibold text-foreground mb-2">Harvest timing</h3><p class="text-sm text-muted-foreground leading-relaxed">Egypt's autumn harvest window means fresh-season supply is available on a different calendar than some other Mediterranean origins — useful for buyers managing year-round inventory across multiple sourcing regions.</p></div>
<div class="rounded-2xl border border-border bg-card p-6"><h3 class="font-semibold text-foreground mb-2">Cost position</h3><p class="text-sm text-muted-foreground leading-relaxed">FOB Alexandria pricing is generally competitive relative to established Mediterranean origins, which is part of why global demand for Egyptian olives has grown. Exact competitiveness depends on your specific variety, caliber, and packaging — request a current quote to compare.</p></div>
<div class="rounded-2xl border border-border bg-card p-6"><h3 class="font-semibold text-foreground mb-2">Co-packing &amp; OEM capacity</h3><p class="text-sm text-muted-foreground leading-relaxed">Buyers looking for a contract packing or white-label olive manufacturer can work with our partner facility on private label formats across glass, tin, bucket, and barrel, with label design help available on request.</p></div>
</div>

<p class="text-xs text-muted-foreground border-t border-border pt-4">Industry figures above are sourced from FAO and International Olive Council (IOC) reporting on Egyptian production. Company-specific claims elsewhere on this site are kept separate and are not implied by these industry statistics.</p>
</div></section><section class="py-16 bg-muted/20"><div class="container max-w-3xl text-center"><h2 class="text-2xl md:text-3xl font-serif font-bold text-foreground mb-3">Considering Egypt as a sourcing origin?</h2><p class="text-muted-foreground mb-6 leading-relaxed">Request a sample or a current quote and evaluate our product against your existing supply.</p><div class="flex flex-wrap justify-center gap-3"><a href="/sample" class="inline-flex h-12 items-center justify-center rounded-md bg-primary px-6 text-sm font-bold text-primary-foreground shadow hover:bg-primary/90 transition-colors">Request a Sample</a><a href="/contact" class="inline-flex h-12 items-center justify-center rounded-md border border-secondary/60 bg-card px-6 text-sm font-semibold text-secondary hover:bg-secondary hover:text-secondary-foreground transition-colors">Request a Quote</a></div></div></section></main>""",
    ),
    dict(
        slug='certifications',
        title='Certifications & Quality Documentation | Triple Company for Industrial Development',
        bc_name='Certifications & Quality Documentation',
        description="Current status of Triple Company's quality and certification documentation, and how qualified buyers can request the latest specifications.",
        keywords='olive exporter certifications Egypt, HACCP olive supplier, food safety certification olives, olive quality documentation',
        extra_jsonld="",
        main_html="""<main class="flex-1"><section class="py-16 md:py-20 bg-muted/20"><div class="container max-w-4xl"><p class="text-xs font-semibold uppercase tracking-widest text-primary mb-3">Quality &amp; Documentation</p><h1 class="text-3xl md:text-5xl font-serif font-bold text-foreground mb-4">Quality &amp; Documentation</h1><p class="text-lg text-muted-foreground leading-relaxed">Three tiers, sorted by what we can actually show you: what is published on this site today, what we confirm in writing for your specific order, and what is still being established. Nothing is listed in a higher tier than the evidence supports.</p></div></section><section class="py-16"><div class="container max-w-4xl" style="display:flex;flex-direction:column;gap:3.5rem">

<div class="rounded-xl border border-primary/20 bg-primary/5 p-6"><p class="text-sm text-foreground leading-relaxed"><strong>Triple Company for Industrial Development does not own or operate a processing facility.</strong> Sourcing and processing run through an approved partner processing facility in the 10th of Ramadan Industrial Zone. Any certification that exists belongs to that partner facility, never to Triple Company for Industrial Development &mdash; and we publish no certificate name, number, issuing body or scope until it has been checked against the actual certificate document.</p></div>

<div>
  <div class="flex items-center gap-3 mb-2"><span class="text-xs font-bold uppercase tracking-widest text-primary">Tier A</span><h2 class="text-2xl font-serif font-bold text-foreground">Published now</h2></div>
  <p class="text-muted-foreground leading-relaxed mb-6">Already on this site, product by product. You can read all of it before contacting us.</p>
  <div class="space-y-4">
    <div class="rounded-xl border border-border bg-card p-5"><h3 class="font-semibold text-foreground mb-1">Caliber ranges</h3><p class="text-sm text-muted-foreground leading-relaxed">Count-per-kilogram ranges for every variety &mdash; for example Aggizi at 141/160 through 231/260. Published on each product page and in the export catalogue. Where a product is not caliber-graded, the page says so rather than showing a number.</p></div>
    <div class="rounded-xl border border-border bg-card p-5"><h3 class="font-semibold text-foreground mb-1">Brine specification</h3><p class="text-sm text-muted-foreground leading-relaxed">Salt percentage, acidity and pH &mdash; for example 6&ndash;8% salt, 0.2&ndash;0.4% lactic acidity, pH 3.8&ndash;4.2. Published for ten of our eleven products; Kalamata currently shows no brine figures rather than an unverified one.</p></div>
    <div class="rounded-xl border border-border bg-card p-5"><h3 class="font-semibold text-foreground mb-1">Formats and packaging</h3><p class="text-sm text-muted-foreground leading-relaxed">Whole, pitted, cracked, sliced and stuffed formats, by product. Glass jars, tin cans, plastic buckets, plastic barrels in brine, and vacuum pouches &mdash; subject to product and order volume.</p></div>
    <div class="rounded-xl border border-border bg-card p-5"><h3 class="font-semibold text-foreground mb-1">Standard export documentation</h3><p class="text-sm text-muted-foreground leading-relaxed">Commercial invoice, packing list, certificate of origin, phytosanitary or health certificate, and bill of lading are prepared for every shipment. Which additional documents your destination market requires is confirmed during quotation.</p></div>
    <div class="rounded-xl border border-border bg-card p-5"><h3 class="font-semibold text-foreground mb-1">Commercial terms</h3><p class="text-sm text-muted-foreground leading-relaxed">Minimum order one 20ft container, confirmed during quotation. Payment typically 30% T/T deposit against 70% on bill-of-lading copy. Incoterms and lead time are confirmed per order.</p></div>
  </div>
</div>

<div>
  <div class="flex items-center gap-3 mb-2"><span class="text-xs font-bold uppercase tracking-widest text-primary">Tier B</span><h2 class="text-2xl font-serif font-bold text-foreground">Confirmed for your order</h2></div>
  <p class="text-muted-foreground leading-relaxed mb-6">Tell us the varieties, volume and destination market you need, and we confirm the following in writing before you commit to anything. Each is confirmed against your specific requirement.</p>
  <ul class="space-y-3">
    <li class="flex gap-3 text-sm text-muted-foreground leading-relaxed"><span class="text-primary font-bold">&middot;</span><span><strong class="text-foreground">Product specification sheet</strong> for the varieties you are buying, drawn from the published specifications above.</span></li>
    <li class="flex gap-3 text-sm text-muted-foreground leading-relaxed"><span class="text-primary font-bold">&middot;</span><span><strong class="text-foreground">Caliber confirmation</strong> for your order, from the published range for that variety.</span></li>
    <li class="flex gap-3 text-sm text-muted-foreground leading-relaxed"><span class="text-primary font-bold">&middot;</span><span><strong class="text-foreground">Packaging specification</strong> &mdash; format, fill and pack configuration for the volume you need.</span></li>
    <li class="flex gap-3 text-sm text-muted-foreground leading-relaxed"><span class="text-primary font-bold">&middot;</span><span><strong class="text-foreground">Label requirements</strong> &mdash; what your destination market requires on the label, and what we need from you. We can help with label design on request.</span></li>
    <li class="flex gap-3 text-sm text-muted-foreground leading-relaxed"><span class="text-primary font-bold">&middot;</span><span><strong class="text-foreground">Incoterm and lead time</strong> for your port and volume.</span></li>
  </ul>
</div>

<div>
  <div class="flex items-center gap-3 mb-2"><span class="text-xs font-bold uppercase tracking-widest text-secondary">Tier C</span><h2 class="text-2xl font-serif font-bold text-foreground">In progress</h2></div>
  <p class="text-muted-foreground leading-relaxed mb-6">Genuinely not settled yet. We would rather tell you where these stand than publish a claim we cannot support with the document itself.</p>
  <ul class="space-y-3">
    <li class="flex gap-3 text-sm text-muted-foreground leading-relaxed"><span class="text-secondary font-bold">&middot;</span><span><strong class="text-foreground">Partner-facility certifications</strong> &mdash; being verified against the actual certificate documents. No certificate name, number, issuing body, scope or validity date appears on this site until that check is complete.</span></li>
    <li class="flex gap-3 text-sm text-muted-foreground leading-relaxed"><span class="text-secondary font-bold">&middot;</span><span><strong class="text-foreground">Destination-market approvals</strong> &mdash; requirements differ by market and are confirmed per destination during quotation.</span></li>
    <li class="flex gap-3 text-sm text-muted-foreground leading-relaxed"><span class="text-secondary font-bold">&middot;</span><span><strong class="text-foreground">Buyer-specific compliance documents</strong> &mdash; confirmed during quotation once we know your market and requirements.</span></li>
  </ul>
</div>

<div class="rounded-2xl border border-border bg-card p-8 text-center"><h2 class="text-2xl font-serif font-bold text-foreground mb-3">Ask us where something stands</h2><p class="text-muted-foreground leading-relaxed mb-6 max-w-2xl mx-auto">Tell us what your market requires and we will confirm exactly what we can provide today &mdash; and what we cannot.</p><div class="flex flex-wrap gap-3 justify-center"><a href="/contact" class="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground">Request a Quote</a><a href="/sample" class="inline-flex items-center justify-center rounded-md border border-border px-6 py-3 text-sm font-medium text-foreground">Request a Sample</a><a href="/resources/supply-network" class="inline-flex items-center justify-center rounded-md border border-border px-6 py-3 text-sm font-medium text-foreground">How our supply chain works</a></div></div>

</div></section></main>""",
    ),
    dict(
        slug='export-markets',
        title='Export Markets — Africa, Middle East & Asia | Triple Company for Industrial Development',
        bc_name='Export Markets',
        description='Triple Company is actively engaging table olive buyers across Africa, the Middle East, and Asia. See the markets we are targeting and how we support private-label supply in each.',
        keywords='table olive supplier Africa, olive exporter Middle East, bulk olives supplier Asia',
        extra_jsonld="",
        main_html="""<main class="flex-1"><section class="py-16 md:py-20 bg-muted/20"><div class="container max-w-4xl"><p class="text-xs font-semibold uppercase tracking-widest text-primary mb-3">Markets We Are Engaging</p><h1 class="text-3xl md:text-5xl font-serif font-bold text-foreground mb-4">Export Markets</h1><p class="text-lg text-muted-foreground leading-relaxed">Where Triple Company is actively building buyer relationships today — presented honestly as markets we are engaging, not markets we currently serve.</p></div></section><section class="py-16"><div class="container max-w-5xl">
<div class="rounded-2xl border border-primary/20 bg-primary/5 p-6 md:p-8 mb-12"><p class="text-base text-foreground leading-relaxed">As a newly established export company, we are direct about where things stand: Triple Company has not yet completed an export shipment. The regions below are the markets we are actively targeting and building buyer relationships in — table olive supply for Africa, olive exporters serving the Middle East, and bulk olive supply for Asia. We will update this page as specific buyer relationships and shipments are confirmed.</p></div>

<h2 class="text-2xl font-serif font-bold text-foreground mb-6 text-center">Markets We Are Targeting</h2>
<div class="grid md:grid-cols-3 gap-6 mb-14"><div class="rounded-2xl border border-border bg-card p-6"><div class="text-3xl mb-3">🌍</div><h3 class="text-lg font-serif font-bold text-foreground mb-2">Africa</h3><p class="text-sm text-muted-foreground leading-relaxed">Our home continent and a natural first market — shorter freight lanes, established trade relationships, and strong existing demand for Egyptian table olives across North and West Africa.</p></div><div class="rounded-2xl border border-border bg-card p-6"><div class="text-3xl mb-3">🕌</div><h3 class="text-lg font-serif font-bold text-foreground mb-2">Middle East</h3><p class="text-sm text-muted-foreground leading-relaxed">A region with deep cultural familiarity with cracked, brined, and marinated green olives, and strong retail and food-service demand for Egyptian varieties like Hamed and Aggizi.</p></div><div class="rounded-2xl border border-border bg-card p-6"><div class="text-3xl mb-3">🌏</div><h3 class="text-lg font-serif font-bold text-foreground mb-2">Asia</h3><p class="text-sm text-muted-foreground leading-relaxed">A growing market for Mediterranean and Middle Eastern ingredients in retail, food service, and private label, with interest in competitively priced bulk and OEM supply.</p></div></div>

<h2 class="text-2xl font-serif font-bold text-foreground mb-4">Export documentation &amp; classification</h2>
<p class="text-muted-foreground leading-relaxed mb-3">Every order is prepared with standard export documentation — commercial invoice, packing list, certificate of origin, phytosanitary or health certificate, and bill of lading. Import duty and tariff treatment (including the correct HS classification for table olives in your destination market) varies by country and can change; we recommend confirming the applicable HS code and duty rate with your own customs broker for your specific market rather than relying on a general figure.</p>

<h2 class="text-2xl font-serif font-bold text-foreground mb-4">Private label &amp; OEM across regions</h2>
<p class="text-muted-foreground leading-relaxed">For buyers building a private-label or OEM olive range for any of these regions, we support private-label packaging across glass, tin, bucket, and barrel formats, and can help with label design on request. Tell us your target market and we'll confirm packaging, MOQ, and lead time for that region.</p>
</div></section><section class="py-16 bg-muted/20"><div class="container max-w-3xl text-center"><h2 class="text-2xl md:text-3xl font-serif font-bold text-foreground mb-3">Buying for Africa, the Middle East, or Asia?</h2><p class="text-muted-foreground mb-6 leading-relaxed">Tell us your destination market and requirements — we'll send a tailored offer.</p><div class="flex flex-wrap justify-center gap-3"><a href="/contact" class="inline-flex h-12 items-center justify-center rounded-md bg-primary px-6 text-sm font-bold text-primary-foreground shadow hover:bg-primary/90 transition-colors">Request a Quote</a><a href="/sample" class="inline-flex h-12 items-center justify-center rounded-md border border-secondary/60 bg-card px-6 text-sm font-semibold text-secondary hover:bg-secondary hover:text-secondary-foreground transition-colors">Request a Sample</a></div></div></section></main>""",
    ),
    dict(
        slug='faq',
        title='FAQ — Buying Egyptian Table Olives | Triple Company for Industrial Development',
        bc_name='FAQ',
        description='Answers to the questions B2B buyers ask most about importing Egyptian table olives: ownership, export history, MOQ, samples, packaging, markets, and documentation.',
        keywords='how to import olives from Egypt, olive export MOQ, olive payment terms, olive sample request',
        extra_jsonld="""    <script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "Do you own the processing facility?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "No. We work with an approved partner arrangement for processing and storage. Triple Company handles sourcing, quality specification, sales, and export logistics; the physical processing and brining takes place at a partner facility in the 10th of Ramadan Industrial Zone."
      }
    },
    {
      "@type": "Question",
      "name": "Have you exported before?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "We are a newly established export company actively developing our first international buyer relationships. We are direct about this because we would rather earn your trust with an honest first order than with an inflated track record."
      }
    },
    {
      "@type": "Question",
      "name": "What certifications apply?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Quality and documentation information is being prepared. Current product specifications and available documents can be requested by qualified buyers. Any certification we do publish will name the partner facility that holds it, together with the exact certificate name, number, and scope — not a general claim about Triple Company."
      }
    },
    {
      "@type": "Question",
      "name": "What is the MOQ?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Our current indicative minimum order is one 20ft container, approximately 16–18 metric tons. Smaller trial quantities may be possible depending on the variety and packaging format. Exact MOQ for your order is confirmed during quotation."
      }
    },
    {
      "@type": "Question",
      "name": "Can I request a sample?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Yes. Samples are reserved for qualified B2B buyers — importers, distributors, retail chains, and food-service buyers. We typically send a representative 1–5 kg assortment of the variety, caliber, and packaging you're evaluating. We coordinate dispatch and customs paperwork to your destination port or door, and sample requests are confirmed within 24 hours by our export team."
      }
    },
    {
      "@type": "Question",
      "name": "What packaging is available?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Glass jars, tin cans, plastic buckets, plastic barrels (for bulk brine), and vacuum pouches, depending on the product and order volume — these are the packaging formats we have actually confirmed as available. Private-label and OEM packaging is available; artwork, labeling, and minimum quantities for custom packaging are confirmed per project."
      }
    },
    {
      "@type": "Question",
      "name": "Which markets are you targeting?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "We are actively engaging buyers in Africa, the Middle East, and Asia. These are the markets we are building relationships in — not markets we currently serve with an established shipping history."
      }
    },
    {
      "@type": "Question",
      "name": "What documents do you provide?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Standard export documentation — commercial invoice, packing list, certificate of origin, phytosanitary or health certificate, and bill of lading — is prepared for every order. Additional documents specific to your destination market's requirements are confirmed during quotation."
      }
    }
  ]
}
</script>""",
        main_html="""<main class="flex-1"><section class="py-16 md:py-20 bg-muted/20"><div class="container max-w-4xl"><p class="text-xs font-semibold uppercase tracking-widest text-primary mb-3">Buyer FAQ</p><h1 class="text-3xl md:text-5xl font-serif font-bold text-foreground mb-4">Frequently Asked Questions</h1><p class="text-lg text-muted-foreground leading-relaxed">Direct answers to the questions B2B buyers ask us most — ownership, export history, certifications, MOQ, samples, packaging, target markets, and documentation.</p></div></section><section class="py-16"><div class="container max-w-3xl"><div class="space-y-3"><details class="faq-item rounded-xl border border-border bg-card overflow-hidden"><summary class="flex w-full items-center justify-between gap-4 px-5 py-4 text-left font-semibold text-foreground cursor-pointer list-none">Do you own the processing facility?<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-down h-4 w-4 shrink-0" aria-hidden="true"><path d="m6 9 6 6 6-6"></path></svg></summary><div class="px-5 pb-5 text-sm text-muted-foreground leading-relaxed">No. We work with an approved partner arrangement for processing and storage. Triple Company handles sourcing, quality specification, sales, and export logistics; the physical processing and brining takes place at a partner facility in the 10th of Ramadan Industrial Zone.</div></details><details class="faq-item rounded-xl border border-border bg-card overflow-hidden"><summary class="flex w-full items-center justify-between gap-4 px-5 py-4 text-left font-semibold text-foreground cursor-pointer list-none">Have you exported before?<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-down h-4 w-4 shrink-0" aria-hidden="true"><path d="m6 9 6 6 6-6"></path></svg></summary><div class="px-5 pb-5 text-sm text-muted-foreground leading-relaxed">We are a newly established export company actively developing our first international buyer relationships. We are direct about this because we would rather earn your trust with an honest first order than with an inflated track record.</div></details><details class="faq-item rounded-xl border border-border bg-card overflow-hidden"><summary class="flex w-full items-center justify-between gap-4 px-5 py-4 text-left font-semibold text-foreground cursor-pointer list-none">What certifications apply?<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-down h-4 w-4 shrink-0" aria-hidden="true"><path d="m6 9 6 6 6-6"></path></svg></summary><div class="px-5 pb-5 text-sm text-muted-foreground leading-relaxed">Quality and documentation information is being prepared. Current product specifications and available documents can be requested by qualified buyers. Any certification we do publish will name the partner facility that holds it, together with the exact certificate name, number, and scope &mdash; not a general claim about Triple Company.</div></details><details class="faq-item rounded-xl border border-border bg-card overflow-hidden"><summary class="flex w-full items-center justify-between gap-4 px-5 py-4 text-left font-semibold text-foreground cursor-pointer list-none">What is the MOQ?<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-down h-4 w-4 shrink-0" aria-hidden="true"><path d="m6 9 6 6 6-6"></path></svg></summary><div class="px-5 pb-5 text-sm text-muted-foreground leading-relaxed">Our current indicative minimum order is one 20ft container, approximately 16&ndash;18 metric tons. Smaller trial quantities may be possible depending on the variety and packaging format. Exact MOQ for your order is confirmed during quotation.</div></details><details class="faq-item rounded-xl border border-border bg-card overflow-hidden"><summary class="flex w-full items-center justify-between gap-4 px-5 py-4 text-left font-semibold text-foreground cursor-pointer list-none">Can I request a sample?<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-down h-4 w-4 shrink-0" aria-hidden="true"><path d="m6 9 6 6 6-6"></path></svg></summary><div class="px-5 pb-5 text-sm text-muted-foreground leading-relaxed">Yes. Samples are reserved for qualified B2B buyers &mdash; importers, distributors, retail chains, and food-service buyers. We typically send a representative 1&ndash;5&nbsp;kg assortment of the variety, caliber, and packaging you're evaluating. We coordinate dispatch and customs paperwork to your destination port or door, and sample requests are confirmed within 24 hours by our export team.</div></details><details class="faq-item rounded-xl border border-border bg-card overflow-hidden"><summary class="flex w-full items-center justify-between gap-4 px-5 py-4 text-left font-semibold text-foreground cursor-pointer list-none">What packaging is available?<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-down h-4 w-4 shrink-0" aria-hidden="true"><path d="m6 9 6 6 6-6"></path></svg></summary><div class="px-5 pb-5 text-sm text-muted-foreground leading-relaxed">Glass jars, tin cans, plastic buckets, plastic barrels (for bulk brine), and vacuum pouches, depending on the product and order volume &mdash; these are the packaging formats we have actually confirmed as available. Private-label and OEM packaging is available; artwork, labeling, and minimum quantities for custom packaging are confirmed per project.</div></details><details class="faq-item rounded-xl border border-border bg-card overflow-hidden"><summary class="flex w-full items-center justify-between gap-4 px-5 py-4 text-left font-semibold text-foreground cursor-pointer list-none">Which markets are you targeting?<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-down h-4 w-4 shrink-0" aria-hidden="true"><path d="m6 9 6 6 6-6"></path></svg></summary><div class="px-5 pb-5 text-sm text-muted-foreground leading-relaxed">We are actively engaging buyers in Africa, the Middle East, and Asia. These are the markets we are building relationships in &mdash; not markets we currently serve with an established shipping history.</div></details><details class="faq-item rounded-xl border border-border bg-card overflow-hidden"><summary class="flex w-full items-center justify-between gap-4 px-5 py-4 text-left font-semibold text-foreground cursor-pointer list-none">What documents do you provide?<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-down h-4 w-4 shrink-0" aria-hidden="true"><path d="m6 9 6 6 6-6"></path></svg></summary><div class="px-5 pb-5 text-sm text-muted-foreground leading-relaxed">Standard export documentation &mdash; commercial invoice, packing list, certificate of origin, phytosanitary or health certificate, and bill of lading &mdash; is prepared for every order. Additional documents specific to your destination market's requirements are confirmed during quotation.</div></details></div></div></section><section class="py-16 bg-muted/20"><div class="container max-w-3xl text-center"><h2 class="text-2xl md:text-3xl font-serif font-bold text-foreground mb-3">Still have a question?</h2><p class="text-muted-foreground mb-6 leading-relaxed">Ask our export team directly — we'd rather give you a precise, honest answer than a generic one.</p><div class="flex flex-wrap justify-center gap-3"><a href="/contact" class="inline-flex h-12 items-center justify-center rounded-md bg-primary px-6 text-sm font-bold text-primary-foreground shadow hover:bg-primary/90 transition-colors">Request a Quote</a><a href="/sample" class="inline-flex h-12 items-center justify-center rounded-md border border-secondary/60 bg-card px-6 text-sm font-semibold text-secondary hover:bg-secondary hover:text-secondary-foreground transition-colors">Request a Sample</a></div></div></section></main>""",
    ),
]


def render(p):
    return PAGE_TMPL.format(
        slug=p["slug"], title_esc=esc(p["title"]), bc_name=p["bc_name"],
        description_esc=esc(p["description"]), keywords_esc=esc(p["keywords"]),
        extra_jsonld=(p["extra_jsonld"] or "    "), main_html=p["main_html"],
    )


def main():
    default_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    root = sys.argv[1] if len(sys.argv) > 1 else default_root
    for p in PAGES:
        out_dir = os.path.join(root, "resources", p["slug"])
        os.makedirs(out_dir, exist_ok=True)
        out_path = os.path.join(out_dir, "index.html")
        with open(out_path, "w", encoding="utf-8") as f:
            f.write(render(p))
        print(f"wrote {out_path}")

    hub_dir = os.path.join(root, "resources")
    os.makedirs(hub_dir, exist_ok=True)
    hub_path = os.path.join(hub_dir, "index.html")
    with open(hub_path, "w", encoding="utf-8") as f:
        f.write(HUB_TMPL.format(main_html=HUB_MAIN))
    print(f"wrote {hub_path}")


if __name__ == "__main__":
    main()
