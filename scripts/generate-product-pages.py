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
        slug="aggizi-green-olives", print_slug="aggizi",
        name="Aggizi Green Olives", origin="Nile Delta, Egypt",
        formats=["Whole", "Pitted", "Cracked"],
        calibers=["140-360"],
        brine=dict(salt="6–8%", acidity="0.2–0.4% lactic", ph="3.8–4.2"),
        profile="Egypt's signature export variety — firm texture, mild brine, bright green color. Grown in the Nile Delta.",
        best_for=["Retail glass-jar programs", "Wholesale bulk supply", "Buyers wanting Egypt's benchmark green-olive variety"],
        related=["toffahi-green-olives", "manzanilla-green-olives", "pepper-stuffed-green-olives"],
        image=dict(src='/assets/olive-aggizi-BuhWRZTd.jpg', alt='Aggizi Green Olives', w='800', h='533', webp='/assets/olive-aggizi-BuhWRZTd.webp'),
    ),
    dict(
        slug="toffahi-green-olives", print_slug="toffahi",
        name="Toffahi Green Olives", origin="Fayoum & Giza, Egypt",
        formats=["Whole", "Pitted", "Stuffed"],
        calibers=["140-360"],
        brine=dict(salt="5–7%", acidity="0.3–0.5% lactic", ph="3.7–4.1"),
        profile="A distinctive Egyptian variety from Fayoum — slightly sweeter, rounder shape, and a high flesh-to-pit ratio.",
        best_for=["Premium glass-jar presentation", "Retail programs wanting a sweeter flavor profile", "Stuffed-olive production"],
        related=["aggizi-green-olives", "manzanilla-green-olives", "hamed-green-olives"],
        image=dict(src='/assets/olive-toffahi-SpdiHPHF.jpg', alt='Toffahi Green Olives', w='1200', h='800', webp='/assets/olive-toffahi-SpdiHPHF.webp'),
    ),
    dict(
        slug="hamed-green-olives", print_slug="hamed",
        name="Hamed Green Olives", origin="North Coast, Egypt",
        formats=["Whole", "Cracked with Herbs"],
        calibers=["140-360"],
        brine=dict(salt="7–9%", acidity="0.2–0.3% lactic", ph="3.9–4.3"),
        profile="Large-caliber green olives from Egypt's North Coast. Cracked and marinated with herbs.",
        best_for=["Middle Eastern and North African import markets", "Buyers wanting a large-caliber cracked olive"],
        related=["aggizi-green-olives", "toffahi-green-olives", "natural-black-olives"],
        image=dict(src='/assets/olive-hamed-DhlKuQ55.jpg', alt='Hamed Green Olives', w='1200', h='1800', webp='/assets/olive-hamed-DhlKuQ55.webp'),
    ),
    dict(
        slug="manzanilla-green-olives", print_slug="manzanilla",
        name="Manzanilla Green Olives", origin="Egypt (Spanish variety)",
        formats=["Whole", "Pitted", "Stuffed (Pimiento / Almond / Garlic)"],
        calibers=["140-360"],
        brine=dict(salt="5–7%", acidity="0.2–0.4% lactic", ph="3.7–4.1"),
        profile="The internationally recognized Spanish variety, grown and processed in Egypt. Consistent oval shape, mild nutty flavor.",
        best_for=["Stuffed-olive production", "Buyers who already source Manzanilla elsewhere and want an Egypt-origin alternative"],
        related=["pepper-stuffed-green-olives", "aggizi-green-olives", "toffahi-green-olives"],
        image=dict(src='/assets/olive-manzanilla-vwgGqjiA.jpg', alt='Manzanilla Green Olives', w='1200', h='797', webp='/assets/olive-manzanilla-vwgGqjiA.webp'),
    ),
    dict(
        slug="natural-black-olives", print_slug="black_natural",
        name="Natural Black Olives", origin="Nile Delta, Egypt",
        formats=["Whole", "Sliced", "Pitted"],
        calibers=["140-360"],
        brine=dict(salt="4–6%", acidity="0.1–0.2% citric", ph="6.0–7.0"),
        profile="Naturally ripened on the tree and processed without oxidation agents. Deep purple-black color, soft texture, mild flavor. No iron gluconate, no artificial coloring.",
        best_for=["Buyers wanting a naturally ripened black olive (not oxidized)", "Retail and food-service"],
        related=["oxidized-black-olives", "hamed-green-olives", "aggizi-green-olives"],
        image=dict(src='/assets/olive-black-CzV0ukvu.jpg', alt='Natural Black Olives', w='800', h='515', webp='/assets/olive-black-CzV0ukvu.webp'),
    ),
    dict(
        slug="pepper-stuffed-green-olives", print_slug="stuffed",
        name="Stuffed Green Olives", origin="Egypt",
        formats=["Pimiento", "Almond", "Garlic", "Lemon"],
        calibers=["140-360"],
        brine=dict(salt="5–7%", acidity="0.2–0.4% lactic", ph="3.7–4.2"),
        profile="Premium Manzanilla and Aggizi olives, pitted and stuffed with a choice of fillings. Machine-stuffed under hygienic, quality-controlled conditions at our partner facility.",
        best_for=["European retail", "Food-service programs wanting a ready-to-serve stuffed olive"],
        related=["manzanilla-green-olives", "aggizi-green-olives", "toffahi-green-olives"],
        image=dict(src='/assets/illus-stuffed.svg', alt='Stuffed Green Olives — photography pending', w='900', h='630', webp=None),
    ),
    dict(
        slug="oxidized-black-olives", print_slug="oxidized_black",
        name="Oxidized Black Olives", origin="Nile Delta, Egypt",
        formats=["Whole", "Sliced", "Pitted"],
        calibers=["140-360"],
        brine=dict(salt="3–5%", acidity="0.1–0.2% citric", ph="5.5–6.5"),
        profile="California-style black olives darkened by controlled oxidation for a uniform jet-black color and smooth, mild flavor.",
        best_for=["Pizza toppings", "Food service", "Retail cans"],
        related=["natural-black-olives", "hamed-green-olives", "aggizi-green-olives"],
        image=dict(src='/assets/illus-oxidized-black.svg', alt='Oxidized Black Olives — photography pending', w='900', h='630', webp=None),
    ),
    dict(
        slug="marinated-artichoke-hearts", print_slug="artichoke",
        name="Marinated Artichoke Hearts", origin="Egypt",
        formats=["Quarters", "Hearts", "Grilled"], calibers=[],
        brine=dict(salt="2–3%", acidity="0.4–0.6% citric", ph="3.8–4.2"),
        profile="Tender artichoke hearts marinated in oil with Mediterranean herbs. A premium antipasto line that complements our olive range.",
        best_for=["Delis", "Retail antipasto programs", "Food service"],
        related=["pepperoncini-peppers", "sliced-jalapeno-peppers", "pepper-stuffed-green-olives"],
        image=dict(src='/assets/illus-artichoke.svg', alt='Marinated Artichoke Hearts — photography pending', w='900', h='630', webp=None),
    ),
    dict(
        slug="pepperoncini-peppers", print_slug="pepperoncini",
        name="Pepperoncini Peppers", origin="Egypt",
        formats=["Whole", "Golden Greek"], calibers=[],
        brine=dict(salt="4–6%", acidity="0.5–0.7% acetic", ph="3.4–3.8"),
        profile="Mild, tangy golden-green peppers pickled in brine (Golden Greek style).",
        best_for=["European and North American retail", "Antipasto and sandwich programs"],
        related=["sliced-jalapeno-peppers", "marinated-artichoke-hearts", "natural-black-olives"],
        image=dict(src='/assets/illus-pepperoncini.svg', alt='Pepperoncini Peppers — photography pending', w='900', h='630', webp=None),
    ),
    dict(
        slug="sliced-jalapeno-peppers", print_slug="jalapeno",
        name="Sliced Jalapeño Peppers", origin="Egypt",
        formats=["Sliced Green Rings", "Sliced Red Rings", "Whole"], calibers=[],
        brine=dict(salt="4–6%", acidity="0.6–0.8% acetic", ph="3.4–3.8"),
        profile="Crisp jalapeño rings pickled for a bright, medium heat, in green or red. Packed in glass jars from 320ml to 1050ml, in 65mm, A9, A10 and A12 cans, and in a 4kg PET pail.",
        best_for=["Nachos, pizza, and Tex-Mex food-service applications", "Retail"],
        related=["pepperoncini-peppers", "marinated-artichoke-hearts", "oxidized-black-olives"],
        image=dict(src='/assets/illus-jalapeno.svg', alt='Sliced Jalapeño Peppers — photography pending', w='900', h='630', webp=None),
    ),
]

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

    <title>{name} | Triple Company for Industrial Development</title>
    <meta name="description" content="{name} from Egypt: {profile_short} B2B specifications, packaging, and quotation for bulk and private-label buyers." />
    <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />
    <link rel="canonical" href="https://olivesegypt.com/products/{slug}" />
    <link rel="alternate" hreflang="en" href="https://olivesegypt.com/products/{slug}" />
    <link rel="alternate" hreflang="ar" href="https://olivesegypt.com/ar/products/{slug}" />
    <link rel="alternate" hreflang="x-default" href="https://olivesegypt.com/products/{slug}" />

    <meta property="og:site_name" content="Triple Company for Industrial Development" />
    <meta property="og:title" content="{name} | Triple Company for Industrial Development" />
    <meta property="og:description" content="{name} from Egypt: {profile_short}" />
    <meta property="og:url" content="https://olivesegypt.com/products/{slug}" />
    <meta property="og:type" content="website" />
    <meta property="og:image" content="https://olivesegypt.com/opengraph.jpg" />
<link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
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
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap" rel="stylesheet">
    <link rel="stylesheet" crossorigin href="/assets/index-Dw0yUE42.css">

    <script type="application/ld+json">
    {{
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": [
        {{ "@type": "ListItem", "position": 1, "name": "Home", "item": "https://olivesegypt.com/" }},
        {{ "@type": "ListItem", "position": 2, "name": "Catalog", "item": "https://olivesegypt.com/catalog" }},
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
      "image": "https://olivesegypt.com{image_src}",
      "countryOfOrigin": "Egypt"
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
          <img src="/assets/logo-BJ1TOn9V.png" alt="Triple Company for Industrial Development logo" class="h-8 w-8 object-contain shrink-0" width="236" height="289"/>
          <span class="font-serif text-sm sm:text-[15px] font-bold tracking-tight text-primary whitespace-nowrap">TRIPLE COMPANY</span>
        </a><nav class="tc-nav" aria-label="Primary"><div class="tc-nav-item"><a class="tc-nav-link" href="/catalog">Products</a></div><div class="tc-nav-item"><button type="button" class="tc-nav-trigger" aria-expanded="false" aria-controls="nav-quality">Quality &amp; Documents<svg class="tc-nav-caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button><div class="tc-nav-panel" id="nav-quality" hidden><a href="/resources/certifications">Certifications</a><a href="/downloads">Downloads &amp; Documents</a><a href="/company-profile">Company Profile</a></div></div><div class="tc-nav-item"><button type="button" class="tc-nav-trigger" aria-expanded="false" aria-controls="nav-resources">Resources<svg class="tc-nav-caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button><div class="tc-nav-panel" id="nav-resources" hidden><a href="/downloads">Buyer Guides</a><a href="/resources/private-label">Private Label</a><a href="/resources/packaging">Packaging</a><a href="/resources/pricing">Pricing</a><a href="/resources/faq">FAQ</a><a href="/resources/why-egyptian-olives">Why Egyptian Olives</a><a href="/resources/export-markets">Export Markets</a><a href="/how-we-work">How We Work</a></div></div><div class="tc-nav-item"><button type="button" class="tc-nav-trigger" aria-expanded="false" aria-controls="nav-media">Media Center<svg class="tc-nav-caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button><div class="tc-nav-panel" id="nav-media" hidden><a href="/media/news">Company News</a><a href="/media/blog">Olive Trade Blog</a><a href="/media/inquiries">Media Inquiries</a></div></div><div class="tc-nav-item"><a class="tc-nav-link" href="/about">About</a></div></nav><div class="flex items-center gap-2 md:gap-3 shrink-0"><a href="https://www.facebook.com/profile.php?id=61592851801873" target="_blank" rel="noopener noreferrer" data-social="facebook" aria-label="Triple Company for Industrial Development on Facebook" title="Follow us on Facebook" class="tc-social-pill tc-social-fb"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="h-5 w-5" aria-hidden="true"><path d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z"/></svg><span class="tc-social-pill-label">Follow</span></a><a href="/ar/products/{slug}" hreflang="ar" lang="ar" dir="rtl" class="hidden lg:flex items-center text-xs font-semibold text-muted-foreground hover:text-foreground border border-border rounded-md px-2.5 py-1.5 whitespace-nowrap">AR</a><button id="theme-toggle-btn" type="button" aria-label="Toggle dark mode" title="Toggle dark mode" class="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors border border-transparent h-9 w-9 hover:bg-accent hover:text-accent-foreground"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-moon h-5 w-5 dark:hidden" aria-hidden="true"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"></path></svg><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-sun h-5 w-5 hidden dark:block" aria-hidden="true"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2"></path><path d="M12 20v2"></path><path d="m4.93 4.93 1.41 1.41"></path><path d="m17.66 17.66 1.41 1.41"></path><path d="M2 12h2"></path><path d="M20 12h2"></path><path d="m6.34 17.66-1.41 1.41"></path><path d="m19.07 4.93-1.41 1.41"></path></svg><span class="sr-only">Toggle dark mode</span></button><div class="hidden md:flex items-center gap-2"><a href="/contact" class="inline-flex h-9 items-center justify-center whitespace-nowrap rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground tc-cta-primary shadow transition-colors hover:bg-primary/90">Request a Quote</a></div><button id="mobile-menu-toggle" class="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors border border-transparent h-9 w-9 lg:hidden" type="button" aria-expanded="false" aria-controls="mobile-menu-panel"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-menu h-5 w-5" aria-hidden="true"><path d="M4 5h16"/><path d="M4 12h16"/><path d="M4 19h16"/></svg><span class="sr-only">Toggle menu</span></button><div id="mobile-menu-panel" hidden class="lg:hidden border-t border-border bg-background"><nav class="flex flex-col px-4 py-3" aria-label="Primary"><a href="/catalog" class="py-2 text-sm font-medium text-foreground">Products</a><button type="button" class="tc-drawer-trigger flex items-center justify-between py-2 text-sm font-medium text-foreground" aria-expanded="false" aria-controls="drawer-quality">Quality &amp; Documents<svg class="tc-nav-caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button><div id="drawer-quality" hidden class="flex flex-col"><a href="/resources/certifications" class="py-2 ps-4 text-sm text-muted-foreground">Certifications</a><a href="/downloads" class="py-2 ps-4 text-sm text-muted-foreground">Downloads &amp; Documents</a><a href="/company-profile" class="py-2 ps-4 text-sm text-muted-foreground">Company Profile</a></div><button type="button" class="tc-drawer-trigger flex items-center justify-between py-2 text-sm font-medium text-foreground" aria-expanded="false" aria-controls="drawer-resources">Resources<svg class="tc-nav-caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button><div id="drawer-resources" hidden class="flex flex-col"><a href="/downloads" class="py-2 ps-4 text-sm text-muted-foreground">Buyer Guides</a><a href="/resources/private-label" class="py-2 ps-4 text-sm text-muted-foreground">Private Label</a><a href="/resources/packaging" class="py-2 ps-4 text-sm text-muted-foreground">Packaging</a><a href="/resources/pricing" class="py-2 ps-4 text-sm text-muted-foreground">Pricing</a><a href="/resources/faq" class="py-2 ps-4 text-sm text-muted-foreground">FAQ</a><a href="/resources/why-egyptian-olives" class="py-2 ps-4 text-sm text-muted-foreground">Why Egyptian Olives</a><a href="/resources/export-markets" class="py-2 ps-4 text-sm text-muted-foreground">Export Markets</a><a href="/how-we-work" class="py-2 ps-4 text-sm text-muted-foreground">How We Work</a></div><button type="button" class="tc-drawer-trigger flex items-center justify-between py-2 text-sm font-medium text-foreground" aria-expanded="false" aria-controls="drawer-media">Media Center<svg class="tc-nav-caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button><div id="drawer-media" hidden class="flex flex-col"><a href="/media/news" class="py-2 ps-4 text-sm text-muted-foreground">Company News</a><a href="/media/blog" class="py-2 ps-4 text-sm text-muted-foreground">Olive Trade Blog</a><a href="/media/inquiries" class="py-2 ps-4 text-sm text-muted-foreground">Media Inquiries</a></div><a href="/about" class="py-2 text-sm font-medium text-foreground">About</a><div class="flex gap-2 mt-2 pt-2 border-t border-border"><a href="https://www.facebook.com/profile.php?id=61592851801873" target="_blank" rel="noopener noreferrer" data-social="facebook" aria-label="Triple Company for Industrial Development on Facebook" class="tc-social-wide tc-social-fb flex-1">Facebook</a><a href="/ar/products/{slug}" hreflang="ar" lang="ar" dir="rtl" class="flex-1 text-center rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground">AR</a><a href="/contact" class="flex-1 text-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground tc-cta-primary">Request a Quote</a></div></nav></div></div></div></header>

    <main class="container max-w-3xl mx-auto px-4 py-12">
      <nav aria-label="Breadcrumb" class="text-xs text-muted-foreground mb-4"><ol class="flex flex-wrap items-center gap-1"><li><a href="/" class="hover:underline">Home</a></li><li aria-hidden="true">/</li><li><a href="/catalog" class="hover:underline">Catalog</a></li><li aria-hidden="true">/</li><li aria-current="page">{name}</li></ol></nav>

      <h1 class="text-4xl font-serif font-bold text-foreground mb-3">{name}</h1>
      <p class="text-sm text-muted-foreground mb-8">Origin: {origin}</p>

      <div class="rounded-2xl overflow-hidden shadow-md ring-1 ring-border mb-8">{image_block}</div>

      <section class="mb-8">
        <h2 class="text-xl font-serif font-bold mb-2">Variety Profile</h2>
        <p class="text-muted-foreground leading-relaxed">{profile}</p>
      </section>

      <section class="mb-8 grid sm:grid-cols-2 gap-x-8 gap-y-4 text-sm">
        <div>
          <h2 class="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Available Formats</h2>
          <div class="flex flex-wrap gap-1.5">{formats}</div>
        </div>
        <div>
          <h2 class="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Calibers (count / kg)</h2>
          <div class="flex flex-wrap gap-1.5">{caliber_html}</div>
        </div>
        <div class="sm:col-span-2">
          <h2 class="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Packaging Options</h2>
          <p class="text-foreground">Glass jars, tin cans, plastic buckets, plastic barrels (brine), or vacuum pouches, subject to product and order volume.</p>
        </div>
      </section>

      <section class="mb-8"><h2 class="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Brine Specification</h2><div class="grid grid-cols-3 gap-2 max-w-sm text-center text-sm">
        <div class="rounded bg-muted px-2 py-2"><p class="text-[10px] text-muted-foreground uppercase">Salt</p><p class="font-semibold text-foreground">{brine_salt}</p></div>
        <div class="rounded bg-muted px-2 py-2"><p class="text-[10px] text-muted-foreground uppercase">Acidity</p><p class="font-semibold text-foreground">{brine_acidity}</p></div>
        <div class="rounded bg-muted px-2 py-2"><p class="text-[10px] text-muted-foreground uppercase">pH</p><p class="font-semibold text-foreground">{brine_ph}</p></div>
      </div></section>

      <section class="mb-8">
        <h2 class="text-xl font-serif font-bold mb-2">Best For</h2>
        <ul class="list-disc list-inside text-muted-foreground space-y-1">
          {best_for_html}
        </ul>
      </section>

      <section class="mb-8">
        <h2 class="text-xl font-serif font-bold mb-2">Related Products</h2>
        <ul class="flex flex-wrap gap-2">
          {related_html}
        </ul>
      </section>

      <div class="flex flex-wrap gap-3 mt-10 pt-8 border-t border-border">
        <a href="/catalog/print?product={print_slug}" class="inline-flex items-center rounded-md border border-border px-5 py-2.5 text-sm font-semibold text-foreground">Download Spec Sheet</a>
        <a href="/sample" class="inline-flex items-center rounded-md border border-border px-5 py-2.5 text-sm font-semibold text-foreground">Request a Sample</a>
        <a href="/contact" class="inline-flex items-center rounded-md bg-primary text-primary-foreground px-5 py-2.5 text-sm font-semibold">Request a Quote</a>
      </div>
      <p class="text-xs text-muted-foreground mt-4">Exact packaging, brine specification, and pricing are confirmed during quotation for the selected format and order volume.</p>
    </main>

    <footer class="w-full border-t border-border py-12 mt-12"><div class="container max-w-screen-2xl mx-auto px-4"><div class="tc-footer-cols"><div class="tc-footer-col"><h3>Products</h3><ul><li><a href="/catalog">Products</a></li><li><a href="/downloads">Full Catalog</a></li><li><a href="/catalog/print">Product Specifications</a></li></ul></div><div class="tc-footer-col"><h3>Quality &amp; Documents</h3><ul><li><a href="/resources/certifications">Certifications</a></li><li><a href="/downloads">Downloads &amp; Documents</a></li><li><a href="/company-profile">Company Profile</a></li></ul></div><div class="tc-footer-col"><h3>Resources</h3><ul><li><a href="/downloads">Buyer Guides</a></li><li><a href="/resources/private-label">Private Label</a></li><li><a href="/resources/faq">FAQ</a></li><li><a href="/how-we-work">How We Work</a></li></ul></div><div class="tc-footer-col"><h3>Media Center</h3><ul><li><a href="/media/news">Company News</a></li><li><a href="/media/blog">Olive Trade Blog</a></li><li><a href="/media/inquiries">Media Inquiries</a></li></ul></div><div class="tc-footer-col"><h3>Contact</h3><ul><li><a href="/contact">Contact</a></li><li><a href="/sample">Request a Sample</a></li><li><a href="https://wa.me/201006045961" rel="noopener" target="_blank">WhatsApp</a></li></ul></div></div><div class="mt-10 pt-6 border-t border-border flex flex-col gap-3"><p class="font-serif font-bold text-primary">Triple Company for Industrial Development</p><p class="text-sm text-muted-foreground max-w-2xl">An Egyptian table-olive supplier based in Cairo, Egypt, preparing for international export via approved partner arrangements.</p><p class="text-sm text-muted-foreground">Ouroba Square (ميدان العروبة), 5th Settlement, New Cairo, Cairo, Egypt</p><p class="text-sm text-muted-foreground"><span dir="ltr">sales@olivesegypt.com</span> &middot; <span dir="ltr">+20 100 604 5961</span></p><div class="flex flex-wrap items-center gap-4 pt-2"><a href="/privacy" class="text-xs text-muted-foreground hover:text-foreground">Privacy</a><a href="/unsubscribe" class="text-xs text-muted-foreground hover:text-foreground">Unsubscribe</a><span class="text-xs text-muted-foreground">&copy; Triple Company for Industrial Development. All rights reserved. Website: olivesegypt.com</span></div></div></div></footer>
  <div class="fixed bottom-6 z-50 flex flex-col items-end gap-3 right-6" dir="ltr"><a href="https://wa.me/201006045961" target="_blank" rel="noopener noreferrer" class="bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-full w-14 h-14 flex items-center justify-center shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 active:scale-95 relative" aria-label="Chat on WhatsApp"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="h-7 w-7" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"></path></svg><span class="absolute inset-0 rounded-full bg-[#25D366] animate-ping opacity-30 pointer-events-none"></span></a></div><a href="/media#blog" aria-label="Read our olive trade blog and insights" data-testid="floating-blog-link" class="group fixed top-1/2 z-40 -translate-y-1/2 right-0 rounded-l-2xl hover:-translate-x-1 block w-64 max-w-[74vw] overflow-hidden border border-border/60 bg-card/95 shadow-2xl ring-1 ring-black/5 backdrop-blur transition-transform duration-300"><span class="pointer-events-none absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-primary to-secondary" aria-hidden="true"></span><div class="min-h-[5.5rem] px-5 py-4 ps-6"><div class="flex items-center gap-3" style="opacity:1;transform:none"><span class="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-book-open h-5 w-5 text-primary" aria-hidden="true"><path d="M12 7v14"></path><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"></path></svg><span class="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-secondary shadow-[0_0_0_3px_var(--card)] motion-safe:animate-pulse" aria-hidden="true"></span></span><span class="flex flex-col"><span class="text-sm font-bold leading-tight text-card-foreground">Read Our Insights</span><span class="mt-0.5 inline-flex items-center gap-1 text-[11px] font-semibold text-primary">Explore the blog<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-arrow-right h-3 w-3 transition-transform group-hover:translate-x-0.5" aria-hidden="true"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg></span></span></div></div></a></body>
</html>
"""


def image_block(im):
    """The product photo, as the shipped pages carry it.

    Five products have a real photograph with a WebP source; the rest carry an
    illustration and the alt text says photography is pending. Both shapes are
    the page's own markup, read back out of it rather than invented here.
    """
    tag = ('<img src="%s" alt="%s" class="w-full h-auto object-cover" '
           'width="%s" height="%s" loading="lazy"/>' % (im["src"], im["alt"], im["w"], im["h"]))
    if im["webp"]:
        return ('<picture style="display:contents">'
                '<source type="image/webp" srcset="%s">%s</picture>' % (im["webp"], tag))
    return tag


def render(p):
    formats = "".join(
        f'<span class="inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium text-foreground">{f}</span>'
        for f in p["formats"]
    )
    if p["calibers"]:
        caliber_html = "".join(
            f'<span class="inline-block rounded border border-border bg-muted px-2 py-0.5 font-mono text-xs text-foreground">{c}</span>'
            for c in p["calibers"]
        )
    else:
        caliber_html = '<span class="text-foreground text-sm">Confirmed during quotation</span>'
    best_for_html = "\n          ".join(f"<li>{b}</li>" for b in p["best_for"])
    related_html = "\n          ".join(
        f'<li><a href="/products/{r}" class="inline-flex items-center rounded-full border border-border px-3 py-1 text-xs font-medium text-foreground hover:border-primary/40">{next(pp["name"] for pp in PRODUCTS if pp["slug"] == r)}</a></li>'
        for r in p["related"]
    )
    profile_short = p["profile"].split(".")[0] + "."
    return PAGE_TMPL.format(
        name=p["name"], slug=p["slug"], print_slug=p["print_slug"], origin=p["origin"],
        profile=p["profile"], profile_short=profile_short, formats=formats, caliber_html=caliber_html,
        brine_salt=p["brine"]["salt"], brine_acidity=p["brine"]["acidity"], brine_ph=p["brine"]["ph"],
        best_for_html=best_for_html, related_html=related_html,
        image_block=image_block(p["image"]), image_src=p["image"]["src"],
    )


def main():
    default_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    root = sys.argv[1] if len(sys.argv) > 1 else default_root
    for p in PRODUCTS:
        out_dir = os.path.join(root, "products", p["slug"])
        os.makedirs(out_dir, exist_ok=True)
        out_path = os.path.join(out_dir, "index.html")
        with open(out_path, "w", encoding="utf-8") as f:
            f.write(render(p))
        print(f"wrote {out_path}")


if __name__ == "__main__":
    main()
