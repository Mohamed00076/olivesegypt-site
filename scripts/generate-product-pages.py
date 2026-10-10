#!/usr/bin/env python3
"""Generates /products/<slug>/index.html pages for Section C0.

Static HTML, no SPA bundle script (same reasoning as B1/B2: the compiled
bundle hardcodes asset paths and hydration overwrites content it does not
recognize -- verified empirically during the B8 image-optimization pass).

    python3 scripts/generate-product-pages.py            # writes into the repo
    python3 scripts/generate-product-pages.py <out-root> # writes into <out-root>/products

THE TEMPLATE BELOW IS THE SHIPPED PAGES, NOT A COPY OF THEM.

It was derived from products/aggizi-green-olives/index.html on 2026-09-19 and
verified to reproduce all ten pages byte for byte. That mattered because the
previous template had stopped doing so: the pages had gained the consent,
locale-switch, site-nav and analytics scripts, hreflang alternates, the
favicon family, the theme bootstrap, the rebuilt navigation with its dropdown
panels and mobile drawer, the Facebook pill, the theme toggle and the footer
columns -- and had lost an offers/InStock block from the Product schema --
while the template kept emitting the shape they had before all of that.

Running the generator would have written that older shape back over ten live
pages. It is not that the generator was never updated: the WhatsApp button and
the insights tab were added to it during the floating-actions work. Only the
parts nobody thought to re-check drifted, which is the whole difficulty -- a
generator that is wrong does not say so until it is run, and by then it has
already written the file.

scripts/check-generator-parity.js renders into a temporary directory and
compares, so the suite fails if this template and the shipped pages ever
disagree again.
"""
import os
import sys

PRODUCTS = [
    dict(
        slug="green-olives", print_slug="green",
        name="Green Olives", origin="Egypt",
        formats=["Whole", "Pitted", "Sliced"],
        calibers=["140-360"],
        brine=dict(salt="5–8%", acidity="0.2–0.5% lactic", ph="3.7–4.2"),
        profile="Green table olives, supplied whole, pitted or sliced in brine. Our supply is by type; if you need a specific cultivar, we check availability for your request.",
        best_for=["Retail glass-jar programs", "Wholesale bulk supply"],
        related=["stuffed-green-olives", "oxidized-black-olives", "natural-black-olives"],
        image=dict(src='/assets/olive-green.jpg', alt='Green Olives', w='800', h='533', webp='/assets/olive-green.webp'),
    ),
    dict(
        slug="stuffed-green-olives", print_slug="stuffed",
        name="Stuffed Green Olives", origin="Egypt",
        formats=["Pepper", "Carrot"],
        calibers=["140-360"],
        brine=dict(salt="5–7%", acidity="0.2–0.4% lactic", ph="3.7–4.2"),
        profile="Green olives, pitted and stuffed with pepper or carrot. Machine-stuffed under hygienic, quality-controlled conditions at our partner facility.",
        best_for=["European retail", "Food-service programs wanting a ready-to-serve stuffed olive"],
        related=["green-olives", "oxidized-black-olives", "sliced-jalapeno-peppers"],
        image=dict(src='/assets/illus-stuffed.svg', alt='Illustration of stuffed green olives', w='900', h='630', webp=None),
    ),
    dict(
        slug="natural-black-olives", print_slug="black_natural",
        name="Natural Black Olives", origin="Nile Delta, Egypt",
        formats=["Whole"],
        calibers=["140-360"],
        brine=dict(salt="4–6%", acidity="0.1–0.2% citric", ph="6.0–7.0"),
        profile="Naturally ripened on the tree and processed without oxidation agents. Deep purple-black color, soft texture, mild flavor. No iron gluconate, no artificial coloring.",
        best_for=["Buyers wanting a naturally ripened black olive (not oxidized)", "Retail and food-service"],
        related=["oxidized-black-olives", "green-olives", "marinated-artichoke-hearts"],
        image=dict(src='/assets/illus-natural-black.svg', alt='Illustration of natural black olives', w='900', h='630', webp=None),
    ),
    dict(
        slug="oxidized-black-olives", print_slug="oxidized_black",
        name="Oxidized Black Olives", origin="Nile Delta, Egypt",
        formats=["Whole", "Sliced", "Pitted"],
        calibers=["140-360"],
        brine=dict(salt="3–5%", acidity="0.1–0.2% citric", ph="5.5–6.5"),
        profile="California-style black olives darkened by controlled oxidation for a uniform jet-black color and smooth, mild flavor.",
        best_for=["Pizza toppings", "Food service", "Retail cans"],
        related=["natural-black-olives", "green-olives", "sliced-jalapeno-peppers"],
        image=dict(src='/assets/olive-oxidized-black.jpg', alt='Oxidized Black Olives', w='1200', h='800', webp='/assets/olive-oxidized-black.webp'),
    ),
    dict(
        slug="sliced-jalapeno-peppers", print_slug="jalapeno",
        name="Sliced Jalapeño Peppers", origin="Egypt",
        formats=["Sliced Green Rings", "Sliced Red Rings", "Whole"], calibers=[],
        brine=dict(salt="4–6%", acidity="0.6–0.8% acetic", ph="3.4–3.8"),
        profile="Crisp jalapeño rings pickled for a bright, medium heat, in green or red. Packed in glass jars from 320ml to 1050ml, in 65mm, A9, A10 and A12 cans, and in a 4kg PET pail.",
        best_for=["Nachos, pizza, and Tex-Mex food-service applications", "Retail"],
        related=["pepperoncini-peppers", "marinated-artichoke-hearts", "oxidized-black-olives"],
        image=dict(src='/assets/jalapeno-sliced.jpg', alt='Sliced Jalapeño Peppers', w='1200', h='800', webp='/assets/jalapeno-sliced.webp'),
    ),
    dict(
        slug="marinated-artichoke-hearts", print_slug="artichoke",
        name="Marinated Artichoke Hearts", origin="Egypt",
        formats=["Quarters", "Hearts", "Grilled"], calibers=[],
        brine=dict(salt="2–3%", acidity="0.4–0.6% citric", ph="3.8–4.2"),
        profile="Tender artichoke hearts marinated in oil with Mediterranean herbs. An antipasto line that complements our olive range.",
        best_for=["Delis", "Retail antipasto programs", "Food service"],
        related=["pepperoncini-peppers", "sliced-jalapeno-peppers", "stuffed-green-olives"],
        image=dict(src='/assets/illus-artichoke.svg', alt='Illustration of marinated artichoke hearts', w='900', h='630', webp=None),
    ),
    dict(
        slug="pepperoncini-peppers", print_slug="pepperoncini",
        name="Pepperoncini Peppers", origin="Egypt",
        formats=["Whole", "Golden Greek"], calibers=[],
        brine=dict(salt="4–6%", acidity="0.5–0.7% acetic", ph="3.4–3.8"),
        profile="Mild, tangy golden-green peppers pickled in brine (Golden Greek style).",
        best_for=["European and North American retail", "Antipasto and sandwich programs"],
        related=["sliced-jalapeno-peppers", "marinated-artichoke-hearts", "natural-black-olives"],
        image=dict(src='/assets/illus-pepperoncini.svg', alt='Illustration of pepperoncini peppers', w='900', h='630', webp=None),
    ),
]

OLIVE_TYPES = ("green", "stuffed", "black_natural", "oxidized_black")

NAME_TO_SLUG = {p["name"]: p["slug"] for p in PRODUCTS}

PAGE_TMPL = """<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <script defer src="/assets/consent.js"></script>
    <script defer src="/assets/locale-switch.js"></script>
    <script defer src="/assets/site-nav.js"></script>
    <script defer src="/assets/analytics.js"></script>
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />

    <title>{name} | Triple Company</title>
    <meta name="description" content="{description}" />
    <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />
    <link rel="canonical" href="https://olivesegypt.com/products/{slug}" />
    <link rel="alternate" hreflang="en" href="https://olivesegypt.com/products/{slug}" />
    <link rel="alternate" hreflang="ar" href="https://olivesegypt.com/ar/products/{slug}" />
    <link rel="alternate" hreflang="x-default" href="https://olivesegypt.com/products/{slug}" />

    <meta property="og:site_name" content="Triple Company for Industrial Development" />
    <meta property="og:title" content="{name} | Triple Company" />
    <meta property="og:description" content="{name} from Egypt: {profile_short}" />
    <meta property="og:url" content="https://olivesegypt.com/products/{slug}" />
    <meta property="og:type" content="website" />
    <meta property="og:image" content="https://olivesegypt.com/opengraph.jpg" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="{name} | Triple Company" />
    <meta name="twitter:description" content="{name} from Egypt: {profile_short}" />
    <meta name="twitter:image" content="https://olivesegypt.com/opengraph.jpg" />
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
    <link href="/assets/fonts/fonts.css" rel="stylesheet">
    <link rel="stylesheet" crossorigin href="/assets/index-Dw0yUE42.css">

    <script type="application/ld+json">
    {{
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": [
        {{ "@type": "ListItem", "position": 1, "name": "Home", "item": "https://olivesegypt.com/" }},
        {{ "@type": "ListItem", "position": 2, "name": "{crumb_name}", "item": "https://olivesegypt.com{crumb_href}" }},
        {{ "@type": "ListItem", "position": 3, "name": "{name}", "item": "https://olivesegypt.com/products/{slug}" }}
      ]
    }}
    </script>
    <script type="application/ld+json">
    {{
      "@context": "https://schema.org",
      "@type": "Product",
      "@id": "https://olivesegypt.com/products/{slug}#product",
      "productID": "{print_slug}",
      "name": "{name}",
      "description": "{profile}",
      "inLanguage": "en",
      "url": "https://olivesegypt.com/products/{slug}",
{image_ld}      "countryOfOrigin": "Egypt"
    }}
    </script>
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
    
    <header class="relative sticky top-0 z-50 w-full border-b border-border bg-background shadow-sm"><div class="container flex h-16 max-w-screen-2xl items-center justify-between gap-4 mx-auto px-4"><a href="/" class="flex items-center gap-2 shrink-0">
          <img src="/assets/logo-header.png" alt="Triple Company for Industrial Development logo" class="h-8 w-8 object-contain shrink-0" width="52" height="64"/>
          <span class="font-serif text-sm sm:text-[15px] font-bold tracking-tight text-primary whitespace-nowrap">TRIPLE COMPANY</span>
        </a><nav class="tc-nav" aria-label="Primary"><div class="tc-nav-item"><button type="button" class="tc-nav-trigger" aria-expanded="false" aria-controls="nav-products">Products<svg class="tc-nav-caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button><div class="tc-nav-panel" id="nav-products" hidden><a href="/catalog">All Products</a><a href="/egyptian-table-olives">Table Olives</a><a href="/pickled-vegetables">Pickled Vegetables</a></div></div><div class="tc-nav-item"><a class="tc-nav-link" href="/solutions">Solutions</a></div><div class="tc-nav-item"><button type="button" class="tc-nav-trigger" aria-expanded="false" aria-controls="nav-quality">Quality &amp; Documents<svg class="tc-nav-caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button><div class="tc-nav-panel" id="nav-quality" hidden><a href="/resources/certifications">Certifications</a><a href="/downloads">Downloads &amp; Documents</a><a href="/company-profile">Company Profile</a></div></div><div class="tc-nav-item"><button type="button" class="tc-nav-trigger" aria-expanded="false" aria-controls="nav-resources">Resources<svg class="tc-nav-caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button><div class="tc-nav-panel" id="nav-resources" hidden><a href="/downloads">Buyer Guides</a><a href="/resources/private-label">Private Label</a><a href="/resources/packaging">Packaging</a><a href="/resources/pricing">Pricing</a><a href="/resources/faq">FAQ</a><a href="/resources/why-egyptian-olives">Why Egyptian Olives</a><a href="/resources/export-markets">Export Markets</a><a href="/how-we-work">How We Work</a></div></div><div class="tc-nav-item"><button type="button" class="tc-nav-trigger" aria-expanded="false" aria-controls="nav-media">Media Center<svg class="tc-nav-caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button><div class="tc-nav-panel" id="nav-media" hidden><a href="/media/news">Company News</a><a href="/media/blog">Olive Trade Blog</a><a href="/media/inquiries">Media Inquiries</a></div></div><div class="tc-nav-item"><a class="tc-nav-link" href="/about">About</a></div></nav><div class="flex items-center gap-2 md:gap-3 shrink-0"><a href="https://www.facebook.com/profile.php?id=61592851801873" target="_blank" rel="noopener noreferrer" data-social="facebook" aria-label="Follow Triple Company for Industrial Development on Facebook" title="Follow us on Facebook" class="tc-social-pill tc-social-fb"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="h-5 w-5" aria-hidden="true"><path d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z"/></svg><span class="tc-social-pill-label">Follow</span></a><a href="/ar/products/{slug}" hreflang="ar" lang="ar" dir="rtl" class="hidden lg:flex items-center text-xs font-semibold text-muted-foreground hover:text-foreground border border-border rounded-md px-2.5 py-1.5 whitespace-nowrap">AR</a><button id="theme-toggle-btn" type="button" aria-label="Toggle dark mode" title="Toggle dark mode" class="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors border border-transparent h-9 w-9 hover:bg-accent hover:text-accent-foreground"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-moon h-5 w-5 dark:hidden" aria-hidden="true"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"></path></svg><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-sun h-5 w-5 hidden dark:block" aria-hidden="true"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2"></path><path d="M12 20v2"></path><path d="m4.93 4.93 1.41 1.41"></path><path d="m17.66 17.66 1.41 1.41"></path><path d="M2 12h2"></path><path d="M20 12h2"></path><path d="m6.34 17.66-1.41 1.41"></path><path d="m19.07 4.93-1.41 1.41"></path></svg><span class="sr-only">Toggle dark mode</span></button><div class="hidden md:flex items-center gap-2"><a href="/contact" class="inline-flex h-9 items-center justify-center whitespace-nowrap rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground tc-cta-primary shadow transition-colors hover:bg-primary/90">Request a Quote</a></div><button id="mobile-menu-toggle" class="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors border border-transparent h-9 w-9 lg:hidden" type="button" aria-expanded="false" aria-controls="mobile-menu-panel"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-menu h-5 w-5" aria-hidden="true"><path d="M4 5h16"/><path d="M4 12h16"/><path d="M4 19h16"/></svg><span class="sr-only">Toggle menu</span></button><div id="mobile-menu-panel" hidden class="lg:hidden border-t border-border bg-background"><nav class="flex flex-col px-4 py-3" aria-label="Primary"><button type="button" class="tc-drawer-trigger flex items-center justify-between py-2 text-sm font-medium text-foreground" aria-expanded="false" aria-controls="drawer-products">Products<svg class="tc-nav-caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button><div id="drawer-products" hidden class="flex flex-col"><a href="/catalog" class="py-2 ps-4 text-sm text-muted-foreground">All Products</a><a href="/egyptian-table-olives" class="py-2 ps-4 text-sm text-muted-foreground">Table Olives</a><a href="/pickled-vegetables" class="py-2 ps-4 text-sm text-muted-foreground">Pickled Vegetables</a></div><a href="/solutions" class="py-2 text-sm font-medium text-foreground">Solutions</a><button type="button" class="tc-drawer-trigger flex items-center justify-between py-2 text-sm font-medium text-foreground" aria-expanded="false" aria-controls="drawer-quality">Quality &amp; Documents<svg class="tc-nav-caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button><div id="drawer-quality" hidden class="flex flex-col"><a href="/resources/certifications" class="py-2 ps-4 text-sm text-muted-foreground">Certifications</a><a href="/downloads" class="py-2 ps-4 text-sm text-muted-foreground">Downloads &amp; Documents</a><a href="/company-profile" class="py-2 ps-4 text-sm text-muted-foreground">Company Profile</a></div><button type="button" class="tc-drawer-trigger flex items-center justify-between py-2 text-sm font-medium text-foreground" aria-expanded="false" aria-controls="drawer-resources">Resources<svg class="tc-nav-caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button><div id="drawer-resources" hidden class="flex flex-col"><a href="/downloads" class="py-2 ps-4 text-sm text-muted-foreground">Buyer Guides</a><a href="/resources/private-label" class="py-2 ps-4 text-sm text-muted-foreground">Private Label</a><a href="/resources/packaging" class="py-2 ps-4 text-sm text-muted-foreground">Packaging</a><a href="/resources/pricing" class="py-2 ps-4 text-sm text-muted-foreground">Pricing</a><a href="/resources/faq" class="py-2 ps-4 text-sm text-muted-foreground">FAQ</a><a href="/resources/why-egyptian-olives" class="py-2 ps-4 text-sm text-muted-foreground">Why Egyptian Olives</a><a href="/resources/export-markets" class="py-2 ps-4 text-sm text-muted-foreground">Export Markets</a><a href="/how-we-work" class="py-2 ps-4 text-sm text-muted-foreground">How We Work</a></div><button type="button" class="tc-drawer-trigger flex items-center justify-between py-2 text-sm font-medium text-foreground" aria-expanded="false" aria-controls="drawer-media">Media Center<svg class="tc-nav-caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button><div id="drawer-media" hidden class="flex flex-col"><a href="/media/news" class="py-2 ps-4 text-sm text-muted-foreground">Company News</a><a href="/media/blog" class="py-2 ps-4 text-sm text-muted-foreground">Olive Trade Blog</a><a href="/media/inquiries" class="py-2 ps-4 text-sm text-muted-foreground">Media Inquiries</a></div><a href="/about" class="py-2 text-sm font-medium text-foreground">About</a><div class="flex gap-2 mt-2 pt-2 border-t border-border"><a href="https://www.facebook.com/profile.php?id=61592851801873" target="_blank" rel="noopener noreferrer" data-social="facebook" aria-label="Follow Triple Company for Industrial Development on Facebook" class="tc-social-wide tc-social-fb flex-1">Facebook</a><a href="/ar/products/{slug}" hreflang="ar" lang="ar" dir="rtl" class="flex-1 text-center rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground">AR</a><a href="/contact" class="flex-1 text-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground tc-cta-primary">Request a Quote</a></div></nav></div></div></div></header>

    {main_block}

    <footer class="w-full border-t border-border py-12 mt-12"><div class="container max-w-screen-2xl mx-auto px-4"><div class="tc-footer-cols"><div class="tc-footer-col"><h2>Products</h2><ul><li><a href="/egyptian-table-olives">Egyptian Table Olives</a></li><li><a href="/pickled-vegetables">Pickled Vegetables</a></li><li><a href="/catalog">Products</a></li><li><a href="/downloads">Full Catalog</a></li><li><a href="/catalog/print">Product Specifications</a></li></ul></div><div class="tc-footer-col"><h2>Quality &amp; Documents</h2><ul><li><a href="/resources/certifications">Certifications</a></li><li><a href="/downloads">Downloads &amp; Documents</a></li><li><a href="/company-profile">Company Profile</a></li></ul></div><div class="tc-footer-col"><h2>Resources</h2><ul><li><a href="/downloads">Buyer Guides</a></li><li><a href="/resources/private-label">Private Label</a></li><li><a href="/resources/faq">FAQ</a></li><li><a href="/how-we-work">How We Work</a></li></ul></div><div class="tc-footer-col"><h2>Media Center</h2><ul><li><a href="/media/news">Company News</a></li><li><a href="/media/blog">Olive Trade Blog</a></li><li><a href="/media/inquiries">Media Inquiries</a></li></ul></div><div class="tc-footer-col"><h2>Contact</h2><ul><li><a href="/contact">Contact</a></li><li><a href="/sample">Request a Sample</a></li><li><a href="https://wa.me/201006045961" rel="noopener" target="_blank">WhatsApp</a></li></ul></div></div><div class="mt-10 pt-6 border-t border-border flex flex-col gap-3"><p class="font-serif font-bold text-primary">Triple Company for Industrial Development</p><p class="text-sm text-muted-foreground max-w-2xl">An Egyptian table-olive supplier based in Cairo, Egypt, preparing for international export via approved partner arrangements.</p><p class="text-sm text-muted-foreground">Ouroba Square (ميدان العروبة), 5th Settlement, New Cairo, Cairo, Egypt</p><p class="text-sm text-muted-foreground"><span dir="ltr">sales@olivesegypt.com</span> &middot; <span dir="ltr">+20 100 604 5961</span></p><div class="flex flex-wrap items-center gap-4 pt-2"><a href="/privacy" class="text-xs text-muted-foreground hover:text-foreground">Privacy</a><a href="/unsubscribe" class="text-xs text-muted-foreground hover:text-foreground">Unsubscribe</a><span class="text-xs text-muted-foreground">&copy; Triple Company for Industrial Development. All rights reserved. Website: olivesegypt.com</span></div></div></div></footer>
  <div class="fixed bottom-6 z-50 flex flex-col items-end gap-3 right-6" dir="ltr"><a href="https://wa.me/201006045961" target="_blank" rel="noopener noreferrer" class="bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-full w-14 h-14 flex items-center justify-center shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 active:scale-95 relative" aria-label="Chat on WhatsApp"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="h-7 w-7" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"></path></svg><span class="absolute inset-0 rounded-full bg-[#25D366] animate-ping opacity-30 pointer-events-none"></span></a></div><a href="/media#blog" aria-label="Read our olive trade blog and insights" data-testid="floating-blog-link" class="group fixed top-1/2 z-40 -translate-y-1/2 right-0 rounded-l-2xl hover:-translate-x-1 block w-64 max-w-[74vw] overflow-hidden border border-border/60 bg-card/95 shadow-2xl ring-1 ring-black/5 backdrop-blur transition-transform duration-300"><span class="pointer-events-none absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-primary to-secondary" aria-hidden="true"></span><div class="min-h-[5.5rem] px-5 py-4 ps-6"><div class="flex items-center gap-3" style="opacity:1;transform:none"><span class="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-book-open h-5 w-5 text-primary" aria-hidden="true"><path d="M12 7v14"></path><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"></path></svg><span class="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-secondary shadow-[0_0_0_3px_var(--card)] motion-safe:animate-pulse" aria-hidden="true"></span></span><span class="flex flex-col"><span class="text-sm font-bold leading-tight text-card-foreground">Read Our Insights</span><span class="mt-0.5 inline-flex items-center gap-1 text-[11px] font-semibold text-primary">Explore the blog<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-arrow-right h-3 w-3 transition-transform group-hover:translate-x-0.5" aria-hidden="true"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg></span></span></div></div></a></body>
</html>
"""


ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Phase 3a layout (2026-10-04), shared by every product page in both languages:
# the seven English pages, which this script writes, and the seven Arabic ones,
# which are kept by hand. The hand-kept pages were converted once with these
# same functions (every word and figure on each page checked to carry over),
# so all fourteen share one layout; edit the Arabic pages by hand to match any
# change made here. (Ten products until 2026-10-10, when the range was
# restructured by olive type.)
LABELS = {
    "en": dict(profile="Product Profile", formats="Available Formats", calibers="Calibers (count / kg)",
               packaging="Packaging Options", brine="Brine Specification", best="Best For", related="Related Products"),
    "ar": dict(profile="وصف المنتج", formats="الصيغ المتاحة", calibers="الأعيرة (عدد الحبات / كجم)",
               packaging="خيارات التغليف", brine="مواصفات المحلول الملحي", best="الأنسب لـ", related="منتجات ذات صلة"),
}
CHECK_SVG = ('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" '
             'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" '
             'class="h-4 w-4" aria-hidden="true"><path d="M20 6 9 17l-5-5"></path></svg>')
PHOTO_WIDTHS = (600, 800, 1200)



DESC_TAIL = " B2B specifications, packaging, and quotation."


def _photo_sources(src):
    """The WebP and JPEG sizes a photograph has on disk, smallest first."""
    base, ext = os.path.splitext(src)
    webp, jpg = [], []
    for w in PHOTO_WIDTHS:
        if os.path.exists(os.path.join(ROOT, (base + "-%d.webp" % w).lstrip("/"))):
            webp.append((base + "-%d.webp" % w, w))
        if os.path.exists(os.path.join(ROOT, (base + "-%d.jpg" % w).lstrip("/"))):
            jpg.append((base + "-%d.jpg" % w, w))
    return webp, jpg


def product_image(im, sizes="(min-width: 1024px) 476px, (min-width: 640px) calc(100vw - 2rem), 80vw"):
    """The product's own image, at the top of the page: loaded first, in a
    fixed 3:2 box, with every size of the photograph that exists.

    On a phone the slot is about 90vw; it is declared as 80vw so a typical
    phone (412px at 1.75x) takes the 600w file rather than the 800w one. Measured
    2026-10-04 on the jalapeño page, the 92 KB 800w file put its LCP at 2.56s
    under Lighthouse's mobile throttling; the slightly softer 600w costs little
    at that size."""
    src, alt, w, h = im["src"], im["alt"], im["w"], im["h"]
    attrs = 'alt="%s" width="%s" height="%s" fetchpriority="high" decoding="async"' % (alt, w, h)
    if src.endswith(".svg"):
        return '<img src="%s" %s/>' % (src, attrs)
    webp, jpg = _photo_sources(src)
    base = os.path.splitext(src)[0]
    webp.append((base + ".webp", int(w)))
    jpg.append((src, int(w)))
    ws = ", ".join("%s %dw" % s for s in webp)
    js = ", ".join("%s %dw" % s for s in jpg)
    return ('<picture style="display:contents"><source type="image/webp" srcset="%s" sizes="%s">'
            '<img src="%s" srcset="%s" sizes="%s" %s/></picture>' % (ws, sizes, src, js, sizes, attrs))


def thumb(im):
    """A related product's picture: small, decorative (the link names it), lazy."""
    src = im["src"]
    if src.endswith(".svg"):
        return '<img src="%s" alt="" width="900" height="630" loading="lazy" decoding="async"/>' % src
    base = os.path.splitext(src)[0]
    w, h = int(im["w"]), int(im["h"])
    th = round(h * 320 / w)
    return '<img src="%s-320.webp" alt="" width="320" height="%d" loading="lazy" decoding="async"/>' % (base, th)


def product_main(d):
    """The <main> of a product page. d carries the page's own words, so the
    same function writes both languages."""
    L = LABELS[d["lang"]]
    chips = "".join('<span class="tc-chip">%s</span>' % f for f in d["formats"])
    ltr = ' dir="ltr"' if d["lang"] == "ar" else ""
    if d["calibers"]:
        # In Arabic each figure reads left to right; the row still starts on the right.
        cal = '<div class="flex flex-wrap gap-1.5">%s</div>' % "".join('<span class="tc-chip"%s>%s</span>' % (ltr, c) for c in d["calibers"])
    else:
        cal = d["caliber_text"]
    rows = ('<tr><th scope="row">%s</th><td><div class="flex flex-wrap gap-1.5">%s</div></td></tr>' % (L["formats"], chips)
            + '<tr><th scope="row">%s</th><td>%s</td></tr>' % (L["calibers"], cal)
            + '<tr><th scope="row">%s</th><td>%s</td></tr>' % (L["packaging"], d["packaging"]))
    brine = ""
    if d["brine"]:
        tiles = "".join('<div class="rounded-lg bg-muted px-2 py-2"><p class="text-[10px] text-muted-foreground uppercase">%s</p>'
                        '<p class="font-semibold text-foreground"%s>%s</p></div>' % (k, ltr, v) for k, v in d["brine"])
        brine = ('\n          <section class="mb-6"><h2 class="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">%s</h2>'
                 '<div class="grid grid-cols-3 gap-2 text-center text-sm">%s</div></section>' % (L["brine"], tiles))
    best = "".join('<li>%s<span>%s</span></li>' % (CHECK_SVG, b) for b in d["best_for"])
    related = "".join(
        '<li><a href="%s" class="tc-card tc-card-tight tc-related flex flex-col gap-2 h-full hover:border-primary/40">'
        '<div class="tc-media rounded-md">%s</div><span class="text-xs font-semibold text-foreground">%s</span></a></li>'
        % (href, thumb(im), name) for href, name, im in d["related"])
    return (
        '<main class="container max-w-5xl mx-auto px-4 py-12">\n'
        '      %s\n\n'
        '      <h1 class="text-4xl font-serif font-bold text-foreground mb-2">%s</h1>\n'
        '      <p class="text-sm text-muted-foreground mb-8">%s</p>\n\n'
        '      <div class="grid gap-8 lg:grid-cols-2 lg:gap-10 lg:items-start mb-10">\n'
        '        <div class="tc-media tc-media-product rounded-2xl shadow-md ring-1 ring-border">%s</div>\n'
        '        <div>\n'
        '          <section class="mb-6">\n'
        '            <h2 class="text-xl font-serif font-bold mb-2">%s</h2>\n'
        '            <p class="text-muted-foreground leading-relaxed">%s</p>\n'
        '          </section>\n'
        '          <table class="tc-spec-table tc-kv mb-6"><tbody>%s</tbody></table>%s\n'
        '          <div class="flex flex-wrap gap-3 pt-6 border-t border-border">%s</div>\n'
        '          %s\n'
        '        </div>\n'
        '      </div>\n\n'
        '      <div class="grid gap-8 lg:grid-cols-2 lg:gap-10">\n'
        '        <section class="tc-card">\n'
        '          <h2 class="text-xl font-serif font-bold mb-3">%s</h2>\n'
        '          <ul class="tc-check text-muted-foreground">%s</ul>\n'
        '        </section>\n'
        '        <section>\n'
        '          <h2 class="text-xl font-serif font-bold mb-3">%s</h2>\n'
        '          <ul class="grid grid-cols-3 gap-3">%s</ul>\n'
        '        </section>\n'
        '      </div>\n'
        '    </main>'
    ) % (d["breadcrumb"], d["name"], d["origin_line"], product_image(d["image"]), L["profile"], d["profile"],
         rows, brine, d["cta"], d["footnote"], L["best"], best, L["related"], related)


# Products with a page this script does not generate, so a related link can
# still name them. None since 2026-10-10: every English product page is
# generated here.
OTHER_PAGES = {}


def name_of(slug):
    for pp in PRODUCTS:
        if pp["slug"] == slug:
            return pp["name"]
    return OTHER_PAGES[slug]


# Every product's picture, for the related-product thumbnails, for pages this
# script does not generate. None since 2026-10-10.
OTHER_IMAGES = {}


def image_of(slug, lang="en"):
    for pp in PRODUCTS:
        if pp["slug"] == slug:
            im = dict(pp["image"])
            break
    else:
        im = dict(OTHER_IMAGES[slug])
    if lang == "ar" and im["src"].endswith(".svg"):
        im["src"] = im["src"][:-4] + "-ar.svg"
    return im


def render(p):
    if p["calibers"]:
        calibers, caliber_text = p["calibers"], None
    else:
        calibers, caliber_text = [], "Confirmed during quotation"
    slug = p["slug"]
    # The four olive types sit under the Egyptian Table Olives hub, the
    # pickled vegetables under their own page (2026-10-10).
    if p["print_slug"] in OLIVE_TYPES:
        crumb_href, crumb_name = "/egyptian-table-olives", "Egyptian Table Olives"
    else:
        crumb_href, crumb_name = "/pickled-vegetables", "Pickled Vegetables"
    main_block = product_main(dict(
        lang="en",
        breadcrumb=('<nav aria-label="Breadcrumb" class="text-xs text-muted-foreground mb-4"><ol class="flex flex-wrap items-center gap-1">'
                    '<li><a href="/" class="hover:underline">Home</a></li><li aria-hidden="true">/</li>'
                    '<li><a href="%s" class="hover:underline">%s</a></li><li aria-hidden="true">/</li>'
                    '<li aria-current="page">%s</li></ol></nav>' % (crumb_href, crumb_name, p["name"])),
        name=p["name"], origin_line="Origin: " + p["origin"], image=p["image"], profile=p["profile"],
        formats=p["formats"], calibers=calibers, caliber_text=caliber_text,
        packaging="Glass jars, tin cans, plastic buckets, or plastic barrels (brine), subject to product and order volume.",
        brine=[("Salt", p["brine"]["salt"]), ("Acidity", p["brine"]["acidity"]), ("pH", p["brine"]["ph"])],
        best_for=p["best_for"],
        related=[("/products/" + r, name_of(r), image_of(r)) for r in p["related"]],
        cta=('<a href="/downloads/spec-sheets/%s-en.pdf" download class="inline-flex items-center rounded-md border border-border px-5 py-2.5 text-sm font-semibold text-foreground">Download Spec Sheet</a>'
             '<a href="/sample" class="inline-flex items-center rounded-md border border-border px-5 py-2.5 text-sm font-semibold text-foreground">Request a Sample</a>'
             '<a href="/contact" class="inline-flex items-center rounded-md bg-primary text-primary-foreground px-5 py-2.5 text-sm font-semibold">Request a Quote</a>' % slug),
        footnote='<p class="text-xs text-muted-foreground mt-4">Exact packaging, brine specification, and pricing are confirmed during quotation for the selected format and order volume.</p>',
    ))
    profile_short = p["profile"].split(".")[0] + "."
    # The search description ends "B2B specifications, packaging, and
    # quotation." where that fits Google's ~160 characters, and stops after
    # the profile sentence where it does not (2026-10-09).
    description = f'{p["name"]} from Egypt: {profile_short}'
    if len(description + DESC_TAIL) <= 160:
        description += DESC_TAIL
    return PAGE_TMPL.format(
        name=p["name"], slug=slug, print_slug=p["print_slug"], profile=p["profile"], profile_short=profile_short,
        description=description, crumb_href=crumb_href, crumb_name=crumb_name,
        main_block=main_block,
        # Structured data names an image only when it is a photograph: an
        # illustration is not offered to search engines as the product
        # (2026-10-03).
        image_ld=('' if p["image"]["src"].startswith('/assets/illus-') else f'      "image": "https://olivesegypt.com{p["image"]["src"]}",\n'),
    )


def main():
    root = sys.argv[1] if len(sys.argv) > 1 else ROOT
    for p in PRODUCTS:
        out_dir = os.path.join(root, "products", p["slug"])
        os.makedirs(out_dir, exist_ok=True)
        out_path = os.path.join(out_dir, "index.html")
        with open(out_path, "w", encoding="utf-8") as f:
            f.write(render(p))
        print(f"wrote {out_path}")


if __name__ == "__main__":
    main()
