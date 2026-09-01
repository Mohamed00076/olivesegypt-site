#!/usr/bin/env python3
"""Generates /resources/<slug>/index.html pages for Section C1-C6.

Static HTML, no SPA bundle script (same reasoning as every other page
rebuilt this project: the compiled bundle hardcodes content and reverts
hydration-mismatched markup for real visitors -- verified empirically).

Run from repo root: python3 scripts/generate-resource-pages.py
"""
import json
import os

BASE = "https://olivesegypt.com"

HEADER = open("/tmp/claude-0/-home-user/36be3305-a78f-5ce0-a944-d34e900206f9/scratchpad/header_raw.html").read()
FOOTER = open("/tmp/claude-0/-home-user/36be3305-a78f-5ce0-a944-d34e900206f9/scratchpad/footer_raw.html").read()

ORG_JSONLD = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": f"{BASE}/#organization",
    "name": "Triple Company for Industrial Development",
    "alternateName": ["Triple Company", "شركة تريبل للتطوير الصناعي"],
    "url": BASE,
    "logo": f"{BASE}/logo.png",
    "image": f"{BASE}/opengraph.jpg",
    "description": "Egyptian table-olive supplier based in Cairo, Egypt, preparing for international export of the approved product range for bulk, wholesale, food-service, retail, and private-label buyer discussions. Founded in 2024.",
    "foundingDate": "2024",
    "address": {"@type": "PostalAddress", "addressCountry": "EG", "addressRegion": "Egypt"},
    "contactPoint": {
        "@type": "ContactPoint", "telephone": "+20-100-604-5961", "contactType": "sales",
        "availableLanguage": ["English", "French", "Arabic"],
    },
    "hasOfferCatalog": {"@type": "OfferCatalog", "name": "Egyptian Table Olives Export Catalog", "url": f"{BASE}/catalog"},
    "knowsAbout": ["Table olives", "Olive export", "Food processing"],
    "areaServed": {"@type": "GeoShape", "description": "Preparing to serve import markets across Europe, the Gulf, North America, Asia, and Africa"},
    "sameAs": [],
}


def jsonld_block(data):
    return '<script type="application/ld+json">\n' + json.dumps(data, indent=2, ensure_ascii=False) + '\n</script>'


def breadcrumb(name, slug):
    return jsonld_block({
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Home", "item": f"{BASE}/"},
            {"@type": "ListItem", "position": 2, "name": "Resources", "item": f"{BASE}/resources"},
            {"@type": "ListItem", "position": 3, "name": name, "item": f"{BASE}/resources/{slug}"},
        ],
    })


def esc(s):
    return s.replace("&", "&amp;").replace('"', "&quot;").replace("<", "&lt;").replace(">", "&gt;")


def head(slug, title_raw, description_raw, keywords, extra_jsonld=""):
    title = esc(title_raw)
    description = esc(description_raw)
    canonical = f"{BASE}/resources/{slug}"
    return f'''<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <script defer src="https://umami-olivesegypt.netlify.app/script.js" data-website-id="88799e3f-ddb2-4eb2-b162-878676480474"></script>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1" />
    <title>{title}</title>
    <meta name="keywords" content="{keywords}" />
    <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />
    <meta name="author" content="Triple Company for Industrial Development" />
    <meta name="geo.region" content="EG" />
    <meta name="geo.country" content="Egypt" />
    <meta name="geo.placename" content="Egypt" />
    <meta name="ICBM" content="30.0444, 31.2357" />
    <meta name="DC.language" content="en" />
    <link rel="alternate" hreflang="en" href="{canonical}" />
    <link rel="alternate" hreflang="x-default" href="{canonical}" />
    <meta property="og:site_name" content="Triple Company Export Specialist" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="Triple Company premium Egyptian table olives export" />
    <meta property="og:locale" content="en_US" />
    <link rel="icon" type="image/png" sizes="48x48" href="/favicon-48.png" />
    <link rel="icon" type="image/png" sizes="96x96" href="/favicon-96.png" />
    <link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png" />
    <link rel="icon" type="image/png" sizes="512x512" href="/icon-512.png" />
    <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Space+Mono&family=Great+Vibes&display=swap" rel="stylesheet">
    {jsonld_block(ORG_JSONLD)}
    {breadcrumb(title_raw.split(' | ')[0].split(' — ')[0], slug)}
    {extra_jsonld}
    <link rel="stylesheet" crossorigin href="/assets/index-Dw0yUE42.css">
    <meta name="description" content="{description}"/>
    <meta property="og:title" content="{title}"/>
    <meta property="og:description" content="{description}"/>
    <meta property="og:url" content="{canonical}"/>
    <meta property="og:type" content="website"/>
    <meta property="og:image" content="{BASE}/opengraph.jpg"/>
    <meta name="twitter:card" content="summary_large_image"/>
    <meta name="twitter:title" content="{title}"/>
    <meta name="twitter:description" content="{description}"/>
    <meta name="twitter:image" content="{BASE}/opengraph.jpg"/>
    <link rel="canonical" href="{canonical}"/>
  </head>
'''


def page(slug, title, description, keywords, main_html, extra_jsonld=""):
    return head(slug, title, description, keywords, extra_jsonld) + HEADER + main_html + "</main>" + FOOTER


def write(slug, title, description, keywords, main_html, extra_jsonld=""):
    out_dir = f"resources/{slug}"
    os.makedirs(out_dir, exist_ok=True)
    html = page(slug, title, description, keywords, main_html, extra_jsonld)
    with open(f"{out_dir}/index.html", "w") as f:
        f.write(html)
    print(f"wrote {out_dir}/index.html ({len(html)} bytes)")


# Shared page-header component
def hero(eyebrow, title, intro):
    return f'''<section class="py-16 md:py-20 bg-muted/20"><div class="container max-w-4xl"><p class="text-xs font-semibold uppercase tracking-widest text-primary mb-3">{eyebrow}</p><h1 class="text-3xl md:text-5xl font-serif font-bold text-foreground mb-4">{title}</h1><p class="text-lg text-muted-foreground leading-relaxed">{intro}</p></div></section>'''


def cta_block(heading, body, primary_label, primary_href, secondary_label=None, secondary_href=None):
    secondary = f'<a href="{secondary_href}" class="inline-flex h-12 items-center justify-center rounded-md border border-secondary/60 bg-card px-6 text-sm font-semibold text-secondary hover:bg-secondary hover:text-secondary-foreground transition-colors">{secondary_label}</a>' if secondary_label else ""
    return f'''<section class="py-16 bg-muted/20"><div class="container max-w-3xl text-center"><h2 class="text-2xl md:text-3xl font-serif font-bold text-foreground mb-3">{heading}</h2><p class="text-muted-foreground mb-6 leading-relaxed">{body}</p><div class="flex flex-wrap justify-center gap-3"><a href="{primary_href}" class="inline-flex h-12 items-center justify-center rounded-md bg-primary px-6 text-sm font-bold text-primary-foreground shadow hover:bg-primary/90 transition-colors">{primary_label}</a>{secondary}</div></div></section>'''


NEUTRAL_QUALITY_PLACEHOLDER = "Quality and documentation information is being prepared. Current product specifications and available documents can be requested by qualified buyers."

# =========================================================================
# C4. /resources/certifications
# =========================================================================
c4_main = hero(
    "Quality & Documentation",
    "Certifications & Quality Documentation",
    "Straight answer on where our certification information currently stands, and what you can request today.",
) + f'''<section class="py-16"><div class="container max-w-3xl"><div class="rounded-2xl border border-primary/20 bg-primary/5 p-6 md:p-8 mb-10"><p class="text-base text-foreground leading-relaxed">{NEUTRAL_QUALITY_PLACEHOLDER}</p></div>

<h2 class="text-2xl font-serif font-bold text-foreground mb-4">What we can tell you today</h2>
<div class="space-y-4 mb-10">
<div class="rounded-xl border border-border bg-card p-5"><h3 class="font-semibold text-foreground mb-1">We work through a partner processing arrangement</h3><p class="text-sm text-muted-foreground leading-relaxed">Triple Company does not own or operate a processing factory. Our products are sourced and processed through an approved partner facility in the 10th of Ramadan Industrial Zone. Any certification claim on this site refers to that partner facility, never to Triple Company itself.</p></div>
<div class="rounded-xl border border-border bg-card p-5"><h3 class="font-semibold text-foreground mb-1">Exact certification names are pending confirmation</h3><p class="text-sm text-muted-foreground leading-relaxed">We do not publish specific certificate names, numbers, issuing bodies, or scopes until they have been verified against the actual certificate documents. This page will be updated with exact, verified details once that review is complete &mdash; not before.</p></div>
<div class="rounded-xl border border-border bg-card p-5"><h3 class="font-semibold text-foreground mb-1">Documentation is confirmed per order</h3><p class="text-sm text-muted-foreground leading-relaxed">Standard export paperwork &mdash; commercial invoice, packing list, certificate of origin, phytosanitary or health certificate, and bill of lading &mdash; is prepared for every shipment. Which additional documents apply to your specific order and destination market is confirmed during quotation.</p></div>
</div>

<h2 class="text-2xl font-serif font-bold text-foreground mb-4">Requesting current documentation</h2>
<p class="text-muted-foreground leading-relaxed mb-2">Qualified buyers can request the current status of our quality documentation, along with product specification sheets, at any time. We would rather tell you exactly where things stand than make a claim we cannot yet back up with the certificate itself.</p>
</div></section>''' + cta_block(
    "Ask about our documentation",
    "Tell us what your market requires and we'll confirm exactly what we can currently provide.",
    "Request a Quote", "/contact", "Request a Sample", "/sample",
)

# =========================================================================
# C6. /resources/faq
# =========================================================================
FAQ_ITEMS = [
    ("Do you own the processing facility?",
     "No. We work with an approved partner arrangement for processing and storage. Triple Company handles sourcing, quality specification, sales, and export logistics; the physical processing and brining takes place at a partner facility in the 10th of Ramadan Industrial Zone."),
    ("Have you exported before?",
     "We are a newly established export company actively developing our first international buyer relationships. We are direct about this because we would rather earn your trust with an honest first order than with an inflated track record."),
    ("What certifications apply?",
     NEUTRAL_QUALITY_PLACEHOLDER + " Any certification we do publish will name the partner facility that holds it, together with the exact certificate name, number, and scope &mdash; not a general claim about Triple Company."),
    ("What is the MOQ?",
     "Our current indicative minimum order is one 20ft container, approximately 16&ndash;18 metric tons. Smaller trial quantities may be possible depending on the variety and packaging format. Exact MOQ for your order is confirmed during quotation."),
    ("Can I request a sample?",
     "Yes. Samples are reserved for qualified B2B buyers &mdash; importers, distributors, retail chains, and food-service buyers. We typically send a representative 1&ndash;5&nbsp;kg assortment of the variety, caliber, and packaging you're evaluating. We coordinate dispatch and customs paperwork to your destination port or door, and sample requests are confirmed within 24 hours by our export team."),
    ("What packaging is available?",
     "Glass jars, tin cans, plastic buckets, wooden barrels (for bulk brine), and vacuum pouches, depending on the product and order volume &mdash; these are the packaging formats we have actually confirmed as available. Private-label and OEM packaging is available; artwork, labeling, and minimum quantities for custom packaging are confirmed per project."),
    ("Which markets are you targeting?",
     "We are actively engaging buyers in Africa, the Middle East, and Asia. These are the markets we are building relationships in &mdash; not markets we currently serve with an established shipping history."),
    ("What documents do you provide?",
     "Standard export documentation &mdash; commercial invoice, packing list, certificate of origin, phytosanitary or health certificate, and bill of lading &mdash; is prepared for every order. Additional documents specific to your destination market's requirements are confirmed during quotation."),
]

def faq_accordion_html():
    items_html = ""
    for i, (q, a) in enumerate(FAQ_ITEMS):
        items_html += f'''<details class="faq-item rounded-xl border border-border bg-card overflow-hidden"><summary class="flex w-full items-center justify-between gap-4 px-5 py-4 text-left font-semibold text-foreground cursor-pointer list-none">{q}<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-down h-4 w-4 shrink-0" aria-hidden="true"><path d="m6 9 6 6 6-6"></path></svg></summary><div class="px-5 pb-5 text-sm text-muted-foreground leading-relaxed">{a}</div></details>'''
    return f'<div class="space-y-3">{items_html}</div>'

FAQ_JSONLD = jsonld_block({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
        {
            "@type": "Question",
            "name": q,
            "acceptedAnswer": {"@type": "Answer", "text": a.replace("&mdash;", "—").replace("&ndash;", "–").replace("&nbsp;", " ")},
        }
        for q, a in FAQ_ITEMS
    ],
})

c6_main = hero(
    "Buyer FAQ",
    "Frequently Asked Questions",
    "Direct answers to the questions B2B buyers ask us most — ownership, export history, certifications, MOQ, samples, packaging, target markets, and documentation.",
) + f'''<section class="py-16"><div class="container max-w-3xl">{faq_accordion_html()}</div></section>''' + cta_block(
    "Still have a question?",
    "Ask our export team directly — we'd rather give you a precise, honest answer than a generic one.",
    "Request a Quote", "/contact", "Request a Sample", "/sample",
)

write(
    "certifications",
    "Certifications & Quality Documentation | Triple Company for Industrial Development",
    "Current status of Triple Company's quality and certification documentation, and how qualified buyers can request the latest specifications.",
    "olive exporter certifications Egypt, HACCP olive supplier, food safety certification olives, olive quality documentation",
    c4_main,
)
write(
    "faq",
    "FAQ — Buying Egyptian Table Olives | Triple Company for Industrial Development",
    "Answers to the questions B2B buyers ask most about importing Egyptian table olives: ownership, export history, MOQ, samples, packaging, markets, and documentation.",
    "how to import olives from Egypt, olive export MOQ, olive payment terms, olive sample request",
    c6_main,
    extra_jsonld=FAQ_JSONLD,
)

# =========================================================================
# C5. /resources/export-markets
# =========================================================================
regions = [
    dict(name="Africa", icon="🌍", note="Our home continent and a natural first market — shorter freight lanes, established trade relationships, and strong existing demand for Egyptian table olives across North and West Africa."),
    dict(name="Middle East", icon="🕌", note="A region with deep cultural familiarity with cracked, brined, and marinated green olives, and strong retail and food-service demand for Egyptian varieties like Hamed and Aggizi."),
    dict(name="Asia", icon="🌏", note="A growing market for Mediterranean and Middle Eastern ingredients in retail, food service, and private label, with interest in competitively priced bulk and OEM supply."),
]
regions_html = "".join(f'''<div class="rounded-2xl border border-border bg-card p-6"><div class="text-3xl mb-3">{r["icon"]}</div><h3 class="text-lg font-serif font-bold text-foreground mb-2">{r["name"]}</h3><p class="text-sm text-muted-foreground leading-relaxed">{r["note"]}</p></div>''' for r in regions)

c5_main = hero(
    "Markets We Are Engaging",
    "Export Markets",
    "Where Triple Company is actively building buyer relationships today — presented honestly as markets we are engaging, not markets we currently serve.",
) + f'''<section class="py-16"><div class="container max-w-5xl">
<div class="rounded-2xl border border-primary/20 bg-primary/5 p-6 md:p-8 mb-12"><p class="text-base text-foreground leading-relaxed">As a newly established export company, we are direct about where things stand: Triple Company has not yet completed an export shipment. The regions below are the markets we are actively targeting and building buyer relationships in — table olive supply for Africa, olive exporters serving the Middle East, and bulk olive supply for Asia. We will update this page as specific buyer relationships and shipments are confirmed.</p></div>

<h2 class="text-2xl font-serif font-bold text-foreground mb-6 text-center">Markets We Are Targeting</h2>
<div class="grid md:grid-cols-3 gap-6 mb-14">{regions_html}</div>

<h2 class="text-2xl font-serif font-bold text-foreground mb-4">Export documentation &amp; classification</h2>
<p class="text-muted-foreground leading-relaxed mb-3">Every order is prepared with standard export documentation — commercial invoice, packing list, certificate of origin, phytosanitary or health certificate, and bill of lading. Import duty and tariff treatment (including the correct HS classification for table olives in your destination market) varies by country and can change; we recommend confirming the applicable HS code and duty rate with your own customs broker for your specific market rather than relying on a general figure.</p>

<h2 class="text-2xl font-serif font-bold text-foreground mb-4">Private label &amp; OEM across regions</h2>
<p class="text-muted-foreground leading-relaxed">For buyers building a private-label or OEM olive range for any of these regions, we support full design-to-shelf private label service across glass, tin, bucket, and barrel formats. Tell us your target market and we'll confirm packaging, MOQ, and lead time for that region.</p>
</div></section>''' + cta_block(
    "Buying for Africa, the Middle East, or Asia?",
    "Tell us your destination market and requirements — we'll send a tailored offer.",
    "Request a Quote", "/contact", "Request a Sample", "/sample",
)

write(
    "export-markets",
    "Export Markets — Africa, Middle East & Asia | Triple Company for Industrial Development",
    "Triple Company is actively engaging table olive buyers across Africa, the Middle East, and Asia. See the markets we are targeting and how we support private-label supply in each.",
    "table olive supplier Africa, olive exporter Middle East, bulk olives supplier Asia",
    c5_main,
)

# =========================================================================
# C3. /resources/why-egyptian-olives
# =========================================================================
c3_main = hero(
    "Sourcing Origin",
    "Why Egyptian Olives",
    "A look at Egypt's position in the global table-olive trade, and what that means for bulk, wholesale, co-packing, and private-label buyers.",
) + '''<section class="py-16"><div class="container max-w-4xl">

<div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-14">
<div class="rounded-xl border border-border bg-muted/30 p-5 text-center"><div class="text-2xl mb-1">🌍</div><p class="text-2xl font-bold font-serif text-primary">#1</p><p class="text-xs text-muted-foreground mt-1 leading-snug">Table Olive Exporter in Africa</p></div>
<div class="rounded-xl border border-border bg-muted/30 p-5 text-center"><div class="text-2xl mb-1">📦</div><p class="text-2xl font-bold font-serif text-primary">698K MT</p><p class="text-xs text-muted-foreground mt-1 leading-snug">Annual Production (2023)</p></div>
<div class="rounded-xl border border-border bg-muted/30 p-5 text-center"><div class="text-2xl mb-1">📈</div><p class="text-2xl font-bold font-serif text-primary">+45%</p><p class="text-xs text-muted-foreground mt-1 leading-snug">Production Growth (2014–2023)</p></div>
<div class="rounded-xl border border-border bg-muted/30 p-5 text-center"><div class="text-2xl mb-1">🚢</div><p class="text-2xl font-bold font-serif text-primary">3</p><p class="text-xs text-muted-foreground mt-1 leading-snug">Export Markets</p></div>
</div>
<p class="text-xs text-muted-foreground text-center -mt-10 mb-14">Source: FAO / IOC</p>

<h2 class="text-2xl font-serif font-bold text-foreground mb-4">A leading, growing origin</h2>
<p class="text-muted-foreground leading-relaxed mb-6">Egypt has quietly become one of the world's largest table-olive producers, and Africa's leading table-olive exporter, on the back of fertile Nile Delta and Fayoum growing regions, a long harvest window, and competitive FOB Alexandria pricing. Production has grown 45% over the past decade, reflecting sustained investment in the sector. We don't claim Egypt is the "best" origin for every buyer — the right origin depends on your variety, caliber, flavor profile, and price point — but it is a serious, scaling origin worth evaluating alongside any other.</p>

<h2 class="text-2xl font-serif font-bold text-foreground mb-4">How Egyptian olives compare</h2>
<div class="grid md:grid-cols-2 gap-6 mb-6">
<div class="rounded-2xl border border-border bg-card p-6"><h3 class="font-semibold text-foreground mb-2">Variety range</h3><p class="text-sm text-muted-foreground leading-relaxed">Egypt grows both signature local varieties (Aggizi, Toffahi, Hamed) and internationally recognized varieties like Manzanilla, giving buyers a way to source a familiar variety from a competitively priced, less saturated origin.</p></div>
<div class="rounded-2xl border border-border bg-card p-6"><h3 class="font-semibold text-foreground mb-2">Harvest timing</h3><p class="text-sm text-muted-foreground leading-relaxed">Egypt's autumn harvest window means fresh-season supply is available on a different calendar than some other Mediterranean origins — useful for buyers managing year-round inventory across multiple sourcing regions.</p></div>
<div class="rounded-2xl border border-border bg-card p-6"><h3 class="font-semibold text-foreground mb-2">Cost position</h3><p class="text-sm text-muted-foreground leading-relaxed">FOB Alexandria pricing is generally competitive relative to established Mediterranean origins, which is part of why global demand for Egyptian olives has grown. Exact competitiveness depends on your specific variety, caliber, and packaging — request a current quote to compare.</p></div>
<div class="rounded-2xl border border-border bg-card p-6"><h3 class="font-semibold text-foreground mb-2">Co-packing &amp; OEM capacity</h3><p class="text-sm text-muted-foreground leading-relaxed">Buyers looking for a contract packing or white-label olive manufacturer can work with our partner facility on private label formats across glass, tin, bucket, and barrel — full design-to-shelf service.</p></div>
</div>

<p class="text-xs text-muted-foreground border-t border-border pt-4">Industry figures above are sourced from FAO and International Olive Council (IOC) reporting on Egyptian production. Company-specific claims elsewhere on this site are kept separate and are not implied by these industry statistics.</p>
</div></section>''' + cta_block(
    "Considering Egypt as a sourcing origin?",
    "Request a sample or a current quote and evaluate our product against your existing supply.",
    "Request a Sample", "/sample", "Request a Quote", "/contact",
)

write(
    "why-egyptian-olives",
    "Why Egyptian Olives | Triple Company for Industrial Development",
    "Egypt's position in the global table-olive trade — production growth, variety range, harvest timing, and cost position — for bulk, co-packing, and private-label buyers.",
    "Egyptian olives vs Spanish olives, best table olive origin, bulk table olives supplier, olive co-packer, olive contract packing, olive OEM manufacturer, olive white label supplier",
    c3_main,
)

# =========================================================================
# C1. /resources/packaging
# =========================================================================
packaging_formats = [
    dict(name="Glass Jars", note="Premium retail and deli presentation. Common sizes from 300g to 1.7kg. Showcases the product; supports branded and private-label labeling."),
    dict(name="Tin Cans", note="Shelf-stable and durable, ideal for food service, warm-climate export, and oxidized black olive lines. Stack and ship efficiently."),
    dict(name="Plastic Buckets", note="Food-grade buckets, typically 1–10kg, for restaurants, caterers, and repackers. Balance cost, volume, and convenience."),
    dict(name="Wooden / Plastic Barrels", note="Bulk brine maturation and shipping, typically 50–200kg, for the lowest cost per kilogram on large volumes."),
    dict(name="Vacuum Pouches", note="Compact, lightweight format for pitted or sliced product where brine weight and volume need to be minimized."),
]
packaging_html = "".join(f'''<div class="rounded-xl border border-border bg-card p-5"><h3 class="font-semibold text-foreground mb-1">{p["name"]}</h3><p class="text-sm text-muted-foreground leading-relaxed">{p["note"]}</p></div>''' for p in packaging_formats)

c1_main = hero(
    "Packaging & Sizing",
    "Packaging Options for Export",
    "How Egyptian table olives are packaged for bulk, retail, food-service, and private-label export, and how caliber sizing works.",
) + f'''<section class="py-16"><div class="container max-w-4xl">

<h2 class="text-2xl font-serif font-bold text-foreground mb-6">Packaging formats we offer</h2>
<div class="space-y-4 mb-6">{packaging_html}</div>
<p class="text-sm text-muted-foreground leading-relaxed mb-14">These are the packaging formats confirmed as available. Exact sizes, case configurations, and minimum order quantities per format are confirmed during quotation and depend on the specific product and order volume.</p>

<h2 class="text-2xl font-serif font-bold text-foreground mb-4">Understanding caliber sizing</h2>
<p class="text-muted-foreground leading-relaxed mb-4">Table olives are graded by caliber — the count of olives per kilogram, written as a range such as <span class="font-semibold text-foreground">181/200</span>. A lower number means larger individual olives. Premium retail jars typically use 101/110 to 181/200; food-service and bulk repacking often use 201/230 and above at a lower cost per kilogram. Exact caliber ranges available for each variety are listed on the <a href="/catalog" class="font-semibold text-primary underline underline-offset-2 decoration-primary/40 hover:decoration-primary transition-colors">product catalog</a> and each product's own page.</p>

<h2 class="text-2xl font-serif font-bold text-foreground mb-4">Private label &amp; OEM packaging</h2>
<div class="rounded-2xl border border-primary/20 bg-primary/5 p-6 md:p-8">
<p class="text-base text-foreground leading-relaxed mb-3">Your brand, your packaging design, our export-ready product. We support full design-to-shelf private label service across glass, tin, bucket, and barrel formats, handling printing, filling, and export documentation.</p>
<p class="text-sm text-muted-foreground leading-relaxed">Minimum order quantity, artwork specifications, and labeling requirements for private-label and custom packaging are confirmed per project during quotation, since they depend on the format, print method, and volume you need. Tell us what you have in mind and we'll confirm exactly what's possible.</p>
</div>
</div></section>''' + cta_block(
    "Have a packaging format in mind?",
    "Tell us your target format, volume, and market — we'll confirm options, MOQ, and lead time.",
    "Request a Quote", "/contact", "Download Full Catalog", "/downloads",
)

write(
    "packaging",
    "Packaging Options for Export | Triple Company for Industrial Development",
    "Glass jars, tin cans, plastic buckets, wooden barrels, and vacuum pouches for Egyptian table olive export — plus how caliber sizing works and private-label/OEM packaging.",
    "olive packaging options Egypt, bulk olive drums, olive drums buckets cans jars wholesale supplier, private label custom OEM olive packaging",
    c1_main,
)

# =========================================================================
# C2. /resources/pricing
# =========================================================================
c2_main = hero(
    "Market Guidance",
    "Egyptian Table Olive Pricing",
    "What actually moves table-olive prices, how to think about your landed cost, and how to get a current quote — not a fixed price list.",
) + '''<section class="py-16"><div class="container max-w-4xl">

<div class="rounded-2xl border border-primary/20 bg-primary/5 p-6 md:p-8 mb-14"><p class="text-base text-foreground leading-relaxed">Table-olive prices move with the season, so we don't publish a fixed price list on this page — any number we printed today could be wrong by the time you read it. Instead, this page explains what actually drives pricing, and you can request a current, honest quote any time, free of charge.</p></div>

<h2 class="text-2xl font-serif font-bold text-foreground mb-6">What drives the price per kg</h2>
<div class="grid md:grid-cols-2 gap-6 mb-14">
<div class="rounded-2xl border border-border bg-card p-6"><h3 class="font-semibold text-foreground mb-2">Harvest yield &amp; weather</h3><p class="text-sm text-muted-foreground leading-relaxed">Egypt's main olive harvest runs through the autumn. A strong yield increases supply and softens prices into the new season; drought or an off-cycle year (olive trees follow a natural biennial bearing pattern) tightens availability.</p></div>
<div class="rounded-2xl border border-border bg-card p-6"><h3 class="font-semibold text-foreground mb-2">Currency movements</h3><p class="text-sm text-muted-foreground leading-relaxed">Exports are priced in USD, so the Egyptian pound's exchange rate affects competitiveness. Currency volatility introduces short-term swings worth watching if you're timing an order.</p></div>
<div class="rounded-2xl border border-border bg-card p-6"><h3 class="font-semibold text-foreground mb-2">Variety &amp; caliber</h3><p class="text-sm text-muted-foreground leading-relaxed">Large-caliber green olives and stuffed specialty lines sit at the premium end. Mid-caliber and oxidized black olives offer better value for high-volume food service.</p></div>
<div class="rounded-2xl border border-border bg-card p-6"><h3 class="font-semibold text-foreground mb-2">Packaging &amp; freight</h3><p class="text-sm text-muted-foreground leading-relaxed">Glass costs more per unit than bulk barrel; ocean freight rates and container availability also feed into your landed cost even when the FOB price hasn't moved.</p></div>
</div>

<h2 class="text-2xl font-serif font-bold text-foreground mb-4">An illustrative example</h2>
<div class="rounded-2xl border border-border bg-card p-6 mb-2">
<p class="text-sm text-muted-foreground leading-relaxed mb-3">To show how these factors combine — not as a quote — consider a buyer sourcing Aggizi Green Olives, caliber 141/160, in bulk barrel packaging, for a full 20ft container FOB Alexandria. Their landed cost per kg would reflect: the current FOB price for that caliber and packaging, ocean freight to their port, import duty in their market, and any local repacking cost if they plan to portion the product into their own retail packs.</p>
<p class="text-xs text-muted-foreground border-t border-border pt-3">Illustrative only. Not a quote or a binding offer — actual FOB pricing depends on the current season and is confirmed on request.</p>
</div>
<p class="text-sm text-muted-foreground leading-relaxed mb-14">The <a href="/catalog" class="font-semibold text-primary underline underline-offset-2 decoration-primary/40 hover:decoration-primary transition-colors">product catalog</a> lists indicative FOB reference ranges by variety and caliber if you want a starting point before requesting a live quote.</p>

<h2 class="text-2xl font-serif font-bold text-foreground mb-4">Requesting a current quote</h2>
<p class="text-muted-foreground leading-relaxed">When you request pricing, the fastest way to get an accurate number is to tell us: the variety and caliber you need, your preferred packaging format, your target order volume, your destination port, and which Incoterm you prefer (FOB, CIF, or CFR). We'll confirm a current, honest price against exactly those terms rather than a generic range.</p>
</div></section>''' + cta_block(
    "Ready for a current quote?",
    "Tell us your variety, caliber, packaging, volume, destination port, and preferred Incoterm — we'll send a tailored, current price.",
    "Request Current Pricing", "/contact", "Request a Sample", "/sample",
)

write(
    "pricing",
    "Egyptian Table Olive Pricing | Triple Company for Industrial Development",
    "What drives Egyptian table-olive prices — harvest, currency, variety, caliber, packaging, and freight — and how to request a current, honest quote.",
    "Egyptian table olive price per kg, olive wholesale price, olive wholesale minimum order",
    c2_main,
)

# =========================================================================
# Resources hub (/resources) — mirrors the /media hub pattern
# =========================================================================
HUB_PAGES = [
    ("packaging", "📦", "Packaging Options", "Formats we offer and how caliber sizing works, plus private-label packaging."),
    ("pricing", "💵", "Pricing", "What drives the price per kg, and how to request a current quote."),
    ("why-egyptian-olives", "🌍", "Why Egyptian Olives", "Egypt's position in the global table-olive trade."),
    ("certifications", "📋", "Certifications & Documentation", "Where our quality documentation currently stands."),
    ("export-markets", "🚢", "Export Markets", "The regions we're actively engaging as buyers."),
    ("faq", "❓", "FAQ", "Direct answers to the questions B2B buyers ask most."),
]
hub_cards = "".join(f'''<a href="/resources/{slug}" class="group rounded-2xl border border-border bg-card p-6 hover:border-primary/40 hover:shadow-md transition-all"><div class="text-3xl mb-3">{icon}</div><h3 class="font-serif font-bold text-lg text-foreground mb-2 group-hover:text-primary transition-colors">{name}</h3><p class="text-sm text-muted-foreground leading-relaxed">{desc}</p></div></a>''' for slug, icon, name, desc in HUB_PAGES)
# fix the stray extra </div> from the template above (card wraps <a> not <div>)
hub_cards = hub_cards.replace("</div></a>", "</a>")

hub_main = hero(
    "Resource Center",
    "Resources for Buyers",
    "Everything a B2B buyer needs to evaluate Egyptian table olives: packaging, pricing, sourcing rationale, documentation status, target markets, and answers to common questions.",
) + f'''<section class="py-16"><div class="container max-w-5xl"><div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">{hub_cards}</div></div></section>''' + cta_block(
    "Can't find what you need?",
    "Ask our export team directly — we'll get you a precise answer.",
    "Request a Quote", "/contact", "Request a Sample", "/sample",
)

hub_breadcrumb = jsonld_block({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Home", "item": f"{BASE}/"},
        {"@type": "ListItem", "position": 2, "name": "Resources", "item": f"{BASE}/resources"},
    ],
})


def write_hub():
    canonical = f"{BASE}/resources"
    title = "Resources for Buyers | Triple Company for Industrial Development"
    description = "Packaging, pricing, sourcing rationale, documentation status, export markets, and FAQ for B2B buyers evaluating Egyptian table olives."
    keywords = "olive packaging options Egypt, Egyptian table olive price per kg, table olive supplier Africa, how to import olives from Egypt"
    h = f'''<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <script defer src="https://umami-olivesegypt.netlify.app/script.js" data-website-id="88799e3f-ddb2-4eb2-b162-878676480474"></script>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1" />
    <title>{esc(title)}</title>
    <meta name="keywords" content="{keywords}" />
    <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />
    <meta name="author" content="Triple Company for Industrial Development" />
    <meta name="geo.region" content="EG" />
    <meta name="geo.country" content="Egypt" />
    <meta name="geo.placename" content="Egypt" />
    <meta name="ICBM" content="30.0444, 31.2357" />
    <meta name="DC.language" content="en" />
    <link rel="alternate" hreflang="en" href="{canonical}" />
    <link rel="alternate" hreflang="x-default" href="{canonical}" />
    <meta property="og:site_name" content="Triple Company Export Specialist" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="Triple Company premium Egyptian table olives export" />
    <meta property="og:locale" content="en_US" />
    <link rel="icon" type="image/png" sizes="48x48" href="/favicon-48.png" />
    <link rel="icon" type="image/png" sizes="96x96" href="/favicon-96.png" />
    <link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png" />
    <link rel="icon" type="image/png" sizes="512x512" href="/icon-512.png" />
    <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Space+Mono&family=Great+Vibes&display=swap" rel="stylesheet">
    {jsonld_block(ORG_JSONLD)}
    {hub_breadcrumb}
    <link rel="stylesheet" crossorigin href="/assets/index-Dw0yUE42.css">
    <meta name="description" content="{esc(description)}"/>
    <meta property="og:title" content="{esc(title)}"/>
    <meta property="og:description" content="{esc(description)}"/>
    <meta property="og:url" content="{canonical}"/>
    <meta property="og:type" content="website"/>
    <meta property="og:image" content="{BASE}/opengraph.jpg"/>
    <meta name="twitter:card" content="summary_large_image"/>
    <meta name="twitter:title" content="{esc(title)}"/>
    <meta name="twitter:description" content="{esc(description)}"/>
    <meta name="twitter:image" content="{BASE}/opengraph.jpg"/>
    <link rel="canonical" href="{canonical}"/>
  </head>
''' + HEADER + hub_main + "</main>" + FOOTER
    os.makedirs("resources", exist_ok=True)
    with open("resources/index.html", "w") as f:
        f.write(h)
    print(f"wrote resources/index.html ({len(h)} bytes)")


write_hub()
