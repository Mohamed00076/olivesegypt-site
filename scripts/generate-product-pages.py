#!/usr/bin/env python3
"""Generates /products/<slug>/index.html pages for Section C0.

Static HTML, no SPA bundle script (same reasoning as B1/B2: the compiled
bundle hardcodes asset paths and hydration overwrites content it doesn't
recognize -- verified empirically during the B8 image-optimization pass).
Run from repo root: python3 scripts/generate-product-pages.py
"""
import os

PRODUCTS = [
    dict(
        slug="aggizi-green-olives", print_slug="aggizi",
        name="Aggizi Green Olives", origin="Nile Delta, Egypt",
        formats=["Whole", "Pitted", "Cracked"],
        calibers=["141/160", "161/180", "181/200", "201/230", "231/260"],
        brine=dict(salt="6–8%", acidity="0.2–0.4% lactic", ph="3.8–4.2"),
        profile="Egypt's signature export variety — firm texture, mild brine, bright green color. Grown in the Nile Delta.",
        best_for=["Retail glass-jar programs", "Wholesale bulk supply", "Buyers wanting Egypt's benchmark green-olive variety"],
        related=["toffahi-green-olives", "manzanilla-green-olives", "pepper-stuffed-green-olives"],
    ),
    dict(
        slug="toffahi-green-olives", print_slug="toffahi",
        name="Toffahi Green Olives", origin="Fayoum & Giza, Egypt",
        formats=["Whole", "Pitted", "Stuffed"],
        calibers=["101/110", "111/120", "121/140", "141/160", "161/180"],
        brine=dict(salt="5–7%", acidity="0.3–0.5% lactic", ph="3.7–4.1"),
        profile="A distinctive Egyptian variety from Fayoum — slightly sweeter, rounder shape, and a high flesh-to-pit ratio.",
        best_for=["Premium glass-jar presentation", "Retail programs wanting a sweeter flavor profile", "Stuffed-olive production"],
        related=["aggizi-green-olives", "manzanilla-green-olives", "hamed-green-olives"],
    ),
    dict(
        slug="hamed-green-olives", print_slug="hamed",
        name="Hamed Green Olives", origin="North Coast, Egypt",
        formats=["Whole", "Cracked with Herbs"],
        calibers=["161/180", "181/200", "201/230", "231/260", "261/290"],
        brine=dict(salt="7–9%", acidity="0.2–0.3% lactic", ph="3.9–4.3"),
        profile="Large-caliber green olives from Egypt's North Coast. Cracked and marinated with herbs.",
        best_for=["Middle Eastern and North African import markets", "Buyers wanting a large-caliber cracked olive"],
        related=["aggizi-green-olives", "toffahi-green-olives", "natural-black-olives"],
    ),
    dict(
        slug="manzanilla-green-olives", print_slug="manzanilla",
        name="Manzanilla Green Olives", origin="Egypt (Spanish variety)",
        formats=["Whole", "Pitted", "Stuffed (Pimiento / Almond / Garlic)"],
        calibers=["101/110", "111/120", "121/140", "141/160", "161/180", "181/200", "201/230", "231/260"],
        brine=dict(salt="5–7%", acidity="0.2–0.4% lactic", ph="3.7–4.1"),
        profile="The internationally recognized Spanish variety, grown and processed in Egypt. Consistent oval shape, mild nutty flavor.",
        best_for=["Stuffed-olive production", "Buyers who already source Manzanilla elsewhere and want an Egypt-origin alternative"],
        related=["pepper-stuffed-green-olives", "aggizi-green-olives", "toffahi-green-olives"],
    ),
    dict(
        slug="natural-black-olives", print_slug="black_natural",
        name="Natural Black Olives", origin="Nile Delta, Egypt",
        formats=["Whole", "Sliced", "Pitted"],
        calibers=["141/160", "161/180", "181/200", "201/230", "231/260", "261/290"],
        brine=dict(salt="4–6%", acidity="0.1–0.2% citric", ph="6.0–7.0"),
        profile="Naturally ripened on the tree and processed without oxidation agents. Deep purple-black color, soft texture, mild flavor. No iron gluconate, no artificial coloring.",
        best_for=["Buyers wanting a naturally ripened black olive (not oxidized)", "Retail and food-service"],
        related=["oxidized-black-olives", "hamed-green-olives", "aggizi-green-olives"],
    ),
    dict(
        slug="pepper-stuffed-green-olives", print_slug="stuffed",
        name="Stuffed Green Olives", origin="Egypt",
        formats=["Pimiento", "Almond", "Garlic", "Lemon"],
        calibers=["101/110", "111/120", "121/140", "141/160"],
        brine=dict(salt="5–7%", acidity="0.2–0.4% lactic", ph="3.7–4.2"),
        profile="Premium Manzanilla and Aggizi olives, pitted and stuffed with a choice of fillings. Machine-stuffed under hygienic, quality-controlled conditions at our partner facility.",
        best_for=["European retail", "Food-service programs wanting a ready-to-serve stuffed olive"],
        related=["manzanilla-green-olives", "aggizi-green-olives", "toffahi-green-olives"],
    ),
    dict(
        slug="oxidized-black-olives", print_slug="oxidized_black",
        name="Oxidized Black Olives", origin="Nile Delta, Egypt",
        formats=["Whole", "Sliced", "Pitted"],
        calibers=["181/200", "201/230", "231/260", "261/290"],
        brine=dict(salt="3–5%", acidity="0.1–0.2% citric", ph="5.5–6.5"),
        profile="California-style black olives darkened by controlled oxidation for a uniform jet-black color and smooth, mild flavor.",
        best_for=["Pizza toppings", "Food service", "Retail cans"],
        related=["natural-black-olives", "hamed-green-olives", "aggizi-green-olives"],
    ),
    dict(
        slug="marinated-artichoke-hearts", print_slug="artichoke",
        name="Marinated Artichoke Hearts", origin="Egypt",
        formats=["Quarters", "Hearts", "Grilled"], calibers=[],
        brine=dict(salt="2–3%", acidity="0.4–0.6% citric", ph="3.8–4.2"),
        profile="Tender artichoke hearts marinated in oil with Mediterranean herbs. A premium antipasto line that complements our olive range.",
        best_for=["Delis", "Retail antipasto programs", "Food service"],
        related=["pepperoncini-peppers", "sliced-jalapeno-peppers", "pepper-stuffed-green-olives"],
    ),
    dict(
        slug="pepperoncini-peppers", print_slug="pepperoncini",
        name="Pepperoncini Peppers", origin="Egypt",
        formats=["Whole", "Golden Greek"], calibers=[],
        brine=dict(salt="4–6%", acidity="0.5–0.7% acetic", ph="3.4–3.8"),
        profile="Mild, tangy golden-green peppers pickled in brine (Golden Greek style).",
        best_for=["European and North American retail", "Antipasto and sandwich programs"],
        related=["sliced-jalapeno-peppers", "marinated-artichoke-hearts", "natural-black-olives"],
    ),
    dict(
        slug="sliced-jalapeno-peppers", print_slug="jalapeno",
        name="Sliced Jalapeño Peppers", origin="Egypt",
        formats=["Sliced Rings", "Whole"], calibers=[],
        brine=dict(salt="4–6%", acidity="0.6–0.8% acetic", ph="3.4–3.8"),
        profile="Crisp green jalapeño rings pickled for a bright, medium heat.",
        best_for=["Nachos, pizza, and Tex-Mex food-service applications", "Retail"],
        related=["pepperoncini-peppers", "marinated-artichoke-hearts", "oxidized-black-olives"],
    ),
]

NAME_TO_SLUG = {p["name"]: p["slug"] for p in PRODUCTS}

PAGE_TMPL = """<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <script defer src="https://umami-olivesegypt.netlify.app/script.js" data-website-id="88799e3f-ddb2-4eb2-b162-878676480474"></script>
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />

    <title>{name} | Triple Company for Industrial Development</title>
    <meta name="description" content="{name} from Egypt: {profile_short} B2B specifications, packaging, and quotation for bulk and private-label buyers." />
    <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />
    <link rel="canonical" href="https://olivesegypt.com/products/{slug}" />

    <meta property="og:site_name" content="Triple Company for Industrial Development" />
    <meta property="og:title" content="{name} | Triple Company for Industrial Development" />
    <meta property="og:description" content="{name} from Egypt: {profile_short}" />
    <meta property="og:url" content="https://olivesegypt.com/products/{slug}" />
    <meta property="og:type" content="website" />
    <meta property="og:image" content="https://olivesegypt.com/opengraph.jpg" />

    <link rel="icon" type="image/png" sizes="48x48" href="/favicon-48.png" />
    <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />

    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
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
      "name": "{name}",
      "description": "{profile}",
      "countryOfOrigin": "Egypt",
      "offers": {{
        "@type": "Offer",
        "availability": "https://schema.org/InStock",
        "seller": {{ "@id": "https://olivesegypt.com/#organization" }},
        "businessFunction": "https://purl.org/goodrelations/v1#Sell"
      }}
    }}
    </script>
  </head>
  <body>
    <header class="w-full border-b border-border bg-background">
      <div class="container flex h-16 max-w-screen-2xl items-center justify-between gap-4 mx-auto px-4">
        <a href="/" class="flex items-center gap-2 shrink-0">
          <img src="/assets/logo-BJ1TOn9V.png" alt="Triple Company for Industrial Development logo" class="h-8 w-8 object-contain shrink-0"/>
          <span class="font-serif text-sm sm:text-[15px] font-bold tracking-tight text-primary whitespace-nowrap">TRIPLE COMPANY</span>
        </a>
        <nav class="flex gap-4 text-sm font-medium">
          <a href="/catalog" class="text-muted-foreground hover:text-foreground">Catalog</a>
          <a href="/how-we-work" class="text-muted-foreground hover:text-foreground">How We Work</a>
          <a href="/contact" class="text-muted-foreground hover:text-foreground">Contact</a>
        </nav>
      </div>
    </header>

    <main class="container max-w-3xl mx-auto px-4 py-12">
      <p class="text-xs text-muted-foreground mb-4"><a href="/" class="hover:underline">Home</a> / <a href="/catalog" class="hover:underline">Catalog</a> / {name}</p>

      <h1 class="text-4xl font-serif font-bold text-foreground mb-3">{name}</h1>
      <p class="text-sm text-muted-foreground mb-8">Origin: {origin}</p>

      <section class="mb-8">
        <h2 class="text-xl font-serif font-bold mb-2">Variety Profile</h2>
        <p class="text-muted-foreground leading-relaxed">{profile}</p>
      </section>

      <section class="mb-8 grid sm:grid-cols-2 gap-x-8 gap-y-4 text-sm">
        <div>
          <h2 class="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Available Formats</h2>
          <p class="text-foreground">{formats}</p>
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

      <section class="mb-8">
        <h2 class="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Brine Specification</h2>
        <div class="grid grid-cols-3 gap-2 max-w-sm text-center text-sm">
        <div class="rounded bg-muted px-2 py-2"><p class="text-[10px] text-muted-foreground uppercase">Salt</p><p class="font-semibold text-foreground">{brine_salt}</p></div>
        <div class="rounded bg-muted px-2 py-2"><p class="text-[10px] text-muted-foreground uppercase">Acidity</p><p class="font-semibold text-foreground">{brine_acidity}</p></div>
        <div class="rounded bg-muted px-2 py-2"><p class="text-[10px] text-muted-foreground uppercase">pH</p><p class="font-semibold text-foreground">{brine_ph}</p></div>
        </div>
      </section>

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

    <footer class="w-full border-t border-border py-8 mt-8">
      <div class="container max-w-screen-2xl mx-auto px-4 text-sm text-muted-foreground">
        &copy; 2026 Triple Company for Industrial Development. All rights reserved. Website: olivesegypt.com
      </div>
    </footer>
    <div class="fixed bottom-6 z-50 flex flex-col items-end gap-3 right-6" dir="ltr"><a href="https://wa.me/201006045961" target="_blank" rel="noopener noreferrer" class="bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-full w-14 h-14 flex items-center justify-center shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 active:scale-95 relative" aria-label="Chat on WhatsApp"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="h-7 w-7" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"></path></svg><span class="absolute inset-0 rounded-full bg-[#25D366] animate-ping opacity-30 pointer-events-none"></span></a></div>
    <a href="/media#blog" aria-label="Read our olive trade blog and insights" data-testid="floating-blog-link" class="group fixed top-1/2 z-40 -translate-y-1/2 right-0 rounded-l-2xl hover:-translate-x-1 block w-64 max-w-[74vw] overflow-hidden border border-border/60 bg-card/95 shadow-2xl ring-1 ring-black/5 backdrop-blur transition-transform duration-300"><span class="pointer-events-none absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-primary to-secondary" aria-hidden="true"></span><div class="min-h-[5.5rem] px-5 py-4 ps-6"><div class="flex items-center gap-3" style="opacity:1;transform:none"><span class="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-book-open h-5 w-5 text-primary" aria-hidden="true"><path d="M12 7v14"></path><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"></path></svg><span class="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-secondary shadow-[0_0_0_3px_var(--card)] motion-safe:animate-pulse" aria-hidden="true"></span></span><span class="flex flex-col"><span class="text-sm font-bold leading-tight text-card-foreground">Read Our Insights</span><span class="mt-0.5 inline-flex items-center gap-1 text-[11px] font-semibold text-primary">Explore the blog<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-arrow-right h-3 w-3 transition-transform group-hover:translate-x-0.5" aria-hidden="true"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg></span></span></div></div></a>
  </body>
</html>
"""


def render(p):
    formats = " &middot; ".join(p["formats"])
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
    )


def main():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    for p in PRODUCTS:
        out_dir = os.path.join(root, "products", p["slug"])
        os.makedirs(out_dir, exist_ok=True)
        out_path = os.path.join(out_dir, "index.html")
        with open(out_path, "w", encoding="utf-8") as f:
            f.write(render(p))
        print(f"wrote {out_path}")


if __name__ == "__main__":
    main()
