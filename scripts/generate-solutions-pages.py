#!/usr/bin/env python3
"""Build the /solutions/ hub and its five buyer pages, in English and Arabic.

    python3 scripts/generate-solutions-pages.py

The owner's Solutions brief (2026-09-29): each of the homepage's six
"Who Are You Sourcing For?" cards gets a page built for that buyer.
Private label keeps its existing page, /resources/private-label (owner's
choice), so the hub links there and no private-label page is built here.

Every page takes its shell -- head, header, menu, footer, floating actions,
scripts -- from /resources/export-markets in the same language, so it
carries exactly the chrome every other page has. Only the page's own head
fields (title, description, keywords, canonical, hreflang, breadcrumb) and
its <main> are replaced. Re-run after editing the wording below; the pages
are overwritten.

Wording rules (Operating Rules):
  - Manufacturer and Local use the owner-confirmed copy verbatim (MFR_*,
    LOCAL_*), expanded only with facts already published elsewhere.
  - Importer/Distributor, Retail and Food Service use only facts already live
    on the site (company profile, How We Work, Packaging, FAQ, Export
    Markets, Supply Network) and link to those pages rather than repeating
    them.
  - Every enquiry button goes to the shared /contact form, with ?from= naming
    the page, which the form records as the enquiry's source.
"""
import html
import json
import os
import re

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SITE = 'https://olivesegypt.com'
ORG = 'Triple Company for Industrial Development'
ORG_AR = 'الشركة الثلاثية للتنمية الصناعية'

PRODUCTS = [
    ('aggizi-green-olives', 'Aggizi Green Olives', 'زيتون عجيزي أخضر'),
    ('toffahi-green-olives', 'Toffahi Green Olives', 'زيتون تفاحي أخضر'),
    ('kalamata-olives', 'Kalamata Olives', 'زيتون كالاماتا'),
    ('manzanilla-green-olives', 'Manzanilla Green Olives', 'زيتون مانزانيلا أخضر'),
    ('natural-black-olives', 'Natural Black Olives', 'زيتون أسود طبيعي'),
    ('pepper-stuffed-green-olives', 'Stuffed Green Olives', 'زيتون أخضر محشو'),
    ('oxidized-black-olives', 'Oxidized Black Olives', 'زيتون أسود مؤكسد'),
    ('sliced-jalapeno-peppers', 'Sliced Jalapeño Peppers', 'فلفل هالبينو مقطع'),
    ('marinated-artichoke-hearts', 'Marinated Artichoke Hearts', 'قلوب أرضي شوكي متبّلة'),
    ('pepperoncini-peppers', 'Pepperoncini Peppers', 'فلفل بيبرونشيني'),
]

LINK = 'text-primary underline'


# ---- markup helpers (every class is one the site's stylesheet already has) --
def pre(lang):
    return '/ar' if lang == 'ar' else ''


def a(href, text):
    return f'<a href="{href}" class="{LINK}">{text}</a>'


def hero(eyebrow, h1, intro):
    return ('<section class="py-16 md:py-20 bg-muted/20"><div class="container max-w-4xl">'
            f'<p class="text-xs font-semibold uppercase tracking-widest text-primary mb-3">{eyebrow}</p>'
            f'<h1 class="text-3xl md:text-5xl font-serif font-bold text-foreground mb-4">{h1}</h1>'
            f'<p class="text-lg text-muted-foreground leading-relaxed">{intro}</p></div></section>')


def body(*blocks):
    return ('<section class="py-16"><div class="container max-w-4xl" style="display:flex;flex-direction:column;gap:3.5rem">\n\n'
            + '\n\n'.join(blocks) + '\n\n</div></section>')


def forwhom(text):
    return ('<div class="rounded-2xl border border-primary/20 bg-primary/5 p-6 md:p-8">'
            f'<p class="text-base text-foreground leading-relaxed">{text}</p></div>')


def block(h2, *paras, extra=''):
    ps = ''.join(f'<p class="text-muted-foreground leading-relaxed mb-3">{p}</p>' for p in paras)
    return f'<div>\n  <h2 class="text-2xl font-serif font-bold text-foreground mb-4">{h2}</h2>\n  {ps}{extra}\n</div>'


def facts(items):
    cells = ''.join(
        '\n    <div class="rounded-lg border border-border bg-card p-4">'
        f'<p class="text-xs uppercase tracking-wider text-secondary font-semibold mb-1">{k}</p>'
        f'<p class="text-sm text-foreground">{v}</p></div>' for k, v in items)
    return f'<div class="grid gap-3 sm:grid-cols-2">{cells}\n  </div>'


def cards(items):
    cells = ''.join(
        '\n    <div class="rounded-lg border border-border bg-card p-4">'
        f'<p class="text-sm"><strong class="text-foreground">{k}</strong></p>'
        f'<p class="text-sm text-muted-foreground leading-relaxed mt-1">{v}</p></div>' for k, v in items)
    return f'<div class="grid gap-3 sm:grid-cols-2 md:grid-cols-3">{cells}\n  </div>'


def note(text):
    return f'<p class="text-sm text-muted-foreground leading-relaxed mt-4">{text}</p>'


def products(lang):
    cells = ''.join(
        f'<a href="{pre(lang)}/products/{slug}" class="rounded-lg border border-border bg-card px-4 py-3 text-sm text-foreground hover:border-primary/40 transition-colors">{ar if lang == "ar" else en}</a>'
        for slug, en, ar in PRODUCTS)
    return f'<div class="grid gap-3 sm:grid-cols-2">{cells}</div>'


def cta(h2, p, primary, secondary):
    (ph, pt), (sh, st) = primary, secondary
    return ('<section class="py-24 bg-primary text-primary-foreground text-center"><div class="container max-w-2xl"><div class="flex flex-col items-center gap-6">'
            f'<h2 class="text-3xl md:text-4xl font-serif font-bold">{h2}</h2><p class="text-primary-foreground/80 text-lg">{p}</p>'
            '<div class="flex flex-wrap justify-center gap-3 mt-2">'
            f'<a href="{ph}" class="group inline-flex h-12 items-center justify-center gap-2 whitespace-nowrap rounded-md bg-secondary px-7 text-sm font-bold text-secondary-foreground shadow-md transition-all hover:bg-secondary/90 hover:-translate-y-0.5">{pt}</a>'
            f'<a href="{sh}" class="inline-flex h-12 items-center justify-center whitespace-nowrap rounded-md border border-primary-foreground/30 bg-transparent px-7 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-foreground/10">{st}</a>'
            '</div></div></div></section>')


def contact(lang, intent, slug):
    """The shared enquiry form, with the intent badge and the page it came from."""
    path = f'{pre(lang)}/solutions' + (f'/{slug}' if slug else '')
    return f'{pre(lang)}/contact?intent={intent}&amp;from={path}'


def sample(lang):
    return (f'{pre(lang)}/sample', 'اطلب عينة' if lang == 'ar' else 'Request a Sample')


# ---- owner-confirmed copy (Solutions brief, 2026-09-29) -- do not paraphrase --
MFR_EN = ('We offer co-packing and OEM supply for buyers who repack, private-label, or process our product further. '
          'This is an active service we currently provide, not a theoretical capability. Our team works directly on custom brine '
          'formulation, specific caliber sorting, and private packaging and labeling requirements for OEM buyers, coordinating '
          'execution with our approved partner processing facility. If you need a specific formulation, sort, or private-label '
          'configuration for your own brand or further processing, tell us your requirements and we&#x27;ll confirm feasibility, '
          'specification, and quotation.')
MFR_AR = ('نقدّم التعبئة التعاقدية (Co-packing) وتوريد OEM للمشترين الذين يعيدون تعبئة منتجنا، أو يبيعونه بعلامتهم الخاصة، أو يعالجونه معالجة إضافية. '
          'هذه خدمة فعلية نقدّمها حاليًا، وليست قدرة نظرية. يعمل فريقنا مباشرة على تركيب المحلول الملحي المخصص، وفرز الأعيرة المحددة، '
          'ومتطلبات التغليف ووضع الملصقات الخاصة لمشتري OEM، وينسّق التنفيذ مع منشأة المعالجة الشريكة المعتمدة لدينا. '
          'إذا كنت تحتاج تركيبة أو فرزًا أو إعدادًا محددًا للعلامة الخاصة لعلامتك التجارية أو لمعالجة إضافية، فأخبرنا بمتطلباتك '
          'وسنؤكد إمكانية التنفيذ والمواصفات وعرض السعر.')
LOCAL_EN = ('We can supply local Egyptian buyers without export logistics. For bulk orders in 220kg barrels, the minimum order is '
            '10 metric tons (approximately 45 barrels). For retail-ready formats — glass jar, tin, or bucket — the standard minimum '
            'applies, the same as our export container minimum of 16–18 metric tons. Pricing and delivery arrangements within Egypt '
            'are confirmed during quotation.')
LOCAL_AR = ('يمكننا التوريد للمشترين المحليين في مصر دون إجراءات تصدير. للطلبات بالجملة في براميل سعة 220 كجم، الحد الأدنى للطلب '
            '10 أطنان مترية (نحو 45 برميلًا). أما الصيغ الجاهزة للتجزئة — البرطمان الزجاجي أو العلبة الصفيح أو الدلو — فيُطبَّق عليها '
            'الحد الأدنى القياسي، وهو نفسه الحد الأدنى لحاوية التصدير: 16–18 طنًا متريًا. ويُؤكَّد التسعير وترتيبات التسليم داخل مصر '
            'أثناء عرض السعر.')
LOCAL_CARD_EN = ('Local delivery-within-Egypt orders: 10-metric-ton minimum for bulk 220kg barrel orders; other packaging formats '
                 'follow the standard 16–18 MT container minimum. Pricing confirmed during quotation.')
LOCAL_CARD_AR = ('طلبات التسليم داخل مصر: حد أدنى 10 أطنان مترية لطلبات البراميل سعة 220 كجم بالجملة؛ وتتبع صيغ التغليف الأخرى '
                 'الحد الأدنى القياسي للحاوية 16–18 طنًا متريًا. ويُؤكَّد التسعير أثناء عرض السعر.')

# The hub's cards: the homepage cards' own wording and order.
HUB_CARDS = [
    ('🚢', 'importer-distributor', 'Importer / Distributor', 'مستورد / موزّع',
     'Bulk container orders, export terms, MOQ, and logistics.',
     'طلبات حاويات بالجملة، وشروط تصدير، وحد أدنى للطلب، ولوجستيات.'),
    ('🏬', 'retail', 'Retail', 'تجزئة',
     'Retail-ready glass and tin formats for supermarket and specialty shelves.',
     'تغليف زجاجي وصفيح جاهز للتجزئة يلائم أرفف السوبر ماركت والمتاجر المتخصصة.'),
    ('🍕', 'food-service', 'Food-Service', 'خدمات الأغذية',
     'Bulk buckets and tins sized for kitchens, caterers, and repackers.',
     'دِلاء وعلب بالجملة بأحجام مناسبة للمطابخ ومقدمي خدمات التموين وموزّعي التعبئة.'),
    ('🏷️', None, 'Private-Label', 'علامة خاصة',
     'Your brand, your packaging design, our export-ready product.',
     'علامتك التجارية، تصميم تغليفك، ومنتجنا الجاهز للتصدير.'),
    ('🏭', 'manufacturer', 'Manufacturer', 'مُصنّع',
     'Co-packing and OEM supply for buyers who repack or process further.',
     'تعبئة تعاقدية (Co-packing) وتوريد OEM للمشترين الذين يعيدون التعبئة أو المعالجة.'),
    ('🇪🇬', 'local-egypt', 'Local / Egypt-Based', 'محلي / داخل مصر', LOCAL_CARD_EN, LOCAL_CARD_AR),
]


def hub_grid(lang):
    cells = ''
    for emoji, slug, en_t, ar_t, en_d, ar_d in HUB_CARDS:
        href = f'{pre(lang)}/solutions/{slug}' if slug else f'{pre(lang)}/resources/private-label'
        t, d = (ar_t, ar_d) if lang == 'ar' else (en_t, en_d)
        cells += (f'<a href="{href}" class="group rounded-2xl border border-border bg-card p-6 text-center hover:border-primary/40 hover:shadow-md transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">'
                  f'<div class="text-3xl mb-3">{emoji}</div><h2 class="font-serif font-bold text-base text-foreground mb-1.5 group-hover:text-primary transition-colors">{t}</h2>'
                  f'<p class="text-xs text-muted-foreground leading-relaxed">{d}</p></a>')
    return f'<div class="grid grid-cols-2 lg:grid-cols-3 gap-5">{cells}</div>'


PAGES = {}

PAGES[''] = {
    'en': dict(
        crumb='Solutions',
        title=f'Solutions by Buyer Type | {ORG}',
        desc='Egyptian table olives by buyer type: importers and distributors, retail, food service, private label, OEM and co-packing, and buyers inside Egypt. The terms, packaging and products for each.',
        keywords='Egyptian table olive supplier, olive supplier by buyer type, bulk olives importer, olive private label, olive OEM co-packing',
        main=lambda: hero('Solutions', 'Solutions for Every Kind of Olive Buyer',
                          'Choose the description closest to your business. Each page brings together the terms, packaging and products that matter to that kind of buyer, and links to the full detail elsewhere on this site.')
        + body(hub_grid('en'))
        + cta('Not sure which fits?', 'Tell us what you buy and where — we&#x27;ll point you to the right terms.',
              (contact('en', 'quote', ''), 'Request a Quote'), sample('en'))),
    'ar': dict(
        crumb='الحلول',
        title=f'الحلول حسب نوع المشتري | {ORG_AR}',
        desc='زيتون المائدة المصري حسب نوع المشتري: المستوردون والموزعون، والتجزئة، وخدمات الأغذية، والعلامة الخاصة، و OEM والتعبئة التعاقدية، والمشترون داخل مصر. الشروط والتغليف والمنتجات المناسبة لكل منهم.',
        keywords='مورد زيتون مائدة مصري, زيتون بالجملة للمستوردين, زيتون بالعلامة الخاصة, تعبئة تعاقدية للزيتون',
        main=lambda: hero('الحلول', 'حلول لكل نوع من مشتري الزيتون',
                          'اختر الوصف الأقرب إلى نشاطك. تجمع كل صفحة الشروط والتغليف والمنتجات التي تهم هذا النوع من المشترين، مع روابط إلى التفاصيل الكاملة في أقسام أخرى من الموقع.')
        + body(hub_grid('ar'))
        + cta('لست متأكدًا أيّها يناسبك؟', 'أخبرنا بما تشتريه وأين — وسنرشدك إلى الشروط المناسبة.',
              (contact('ar', 'quote', ''), 'اطلب عرض سعر'), sample('ar'))),
}

PAGES['importer-distributor'] = {
    'en': dict(
        crumb='Importers &amp; Distributors',
        title=f'Bulk Table Olives for Importers &amp; Distributors | {ORG}',
        desc='Container terms for table olive importers and distributors: 1×20ft minimum (about 16–18 MT), FOB Alexandria, CIF or CFR, T/T or L/C payment, and a full export documentation pack.',
        keywords='bulk table olive importer Egypt, olive container export terms, wholesale olive distributor Egypt, FOB olive exporter',
        main=lambda: hero('Solutions', 'For Importers and Distributors',
                          'Egyptian table olives by the container, for importers and wholesale distributors who resell or distribute in their own market.')
        + body(
            forwhom('This page is for importers and wholesale distributors buying by the container. It sets out the commercial terms, the documents that travel with each shipment, and where to find packaging and product detail.'),
            block('Container terms at a glance', extra=facts([
                ('Minimum order', '1 &times; 20ft container (about 16&ndash;18 metric tons) &mdash; confirmed during quotation'),
                ('Incoterms', 'FOB Alexandria, CIF or CFR &mdash; agreed during quotation'),
                ('Payment', 'Typically 30% T/T deposit &middot; 70% against B/L copy; L/C at sight and other negotiable terms for established partners'),
                ('Currency', 'USD or EUR'),
                ('Samples', 'A representative 1&ndash;5 kg assortment, on request'),
                ('Documentation', 'A full export documentation pack with every container (below)'),
            ]) + note('Terms shown are current and indicative; exact terms are confirmed during quotation for the specific product and order. The six steps from enquiry to shipment are on ' + a('/how-we-work', 'How We Work') + '.')),
            block('Export documentation with every container',
                  'Every order is prepared with standard export documentation &mdash; commercial invoice, packing list, certificate of origin, phytosanitary or health certificate, and bill of lading. Additional documents your destination market requires are confirmed during quotation.',
                  'Import duty and tariff treatment, including the correct HS classification for table olives in your market, vary by country and can change. Please confirm them with your own customs broker. Where our documentation stands today is set out on ' + a('/resources/certifications', 'Quality &amp; Documentation') + '.'),
            block('Packaging for bulk and onward distribution',
                  'For the lowest cost per kilogram on large volumes, olives ship in 220 kg plastic barrels. Food-grade buckets, tin cans, glass jars and vacuum pouches are also available, so a distributor can take retail-ready or food-service packs as well as bulk. Sizes and carton counts are on ' + a('/resources/packaging', 'Packaging &amp; Sizing') + '; caliber grading is explained there too.'),
            block('Markets we are engaging',
                  'We are actively building buyer relationships in Africa, the Middle East and Asia. As a newly established export company, we are direct about where things stand: we have not yet completed an export shipment, so these are markets we are engaging, not markets we already serve. More on ' + a('/resources/export-markets', 'Export Markets') + '.'),
            block('Who does what',
                  'Processing and brining are completed through our approved partner processing facility in the 10th of Ramadan Industrial Zone. ' + ORG + ' manages sourcing, product specification, buyer communication, export coordination and documentation. The full arrangement is on ' + a('/resources/supply-network', 'Supply &amp; Processing Network') + '.'),
            block('The range', 'Ten products. Calibers, brine specification and formats are on each product&rsquo;s own page and in the ' + a('/catalog', 'catalogue') + '.', extra=products('en')),
        )
        + cta('Tell us your market and volume', 'We&#x27;ll come back with a tailored offer and confirm the terms for your order.',
              (contact('en', 'quote', 'importer-distributor'), 'Request a Quote'), sample('en'))),
    'ar': dict(
        crumb='المستوردون والموزعون',
        title=f'زيتون مائدة بالجملة للمستوردين والموزعين | {ORG_AR}',
        desc='شروط الحاويات لمستوردي وموزعي زيتون المائدة: حد أدنى حاوية 20 قدمًا (نحو 16–18 طنًا متريًا)، و FOB الإسكندرية أو CIF أو CFR، والدفع بـ T/T أو L/C، وحزمة مستندات تصدير كاملة.',
        keywords='مستورد زيتون مائدة بالجملة مصر, شروط تصدير حاويات الزيتون, موزع زيتون بالجملة مصر, مصدر زيتون FOB',
        main=lambda: hero('الحلول', 'للمستوردين والموزعين',
                          'زيتون مائدة مصري بالحاوية، للمستوردين وموزعي الجملة الذين يعيدون البيع أو التوزيع في أسواقهم.')
        + body(
            forwhom('هذه الصفحة للمستوردين وموزعي الجملة الذين يشترون بالحاوية. توضّح الشروط التجارية، والمستندات التي ترافق كل شحنة، وأين تجد تفاصيل التغليف والمنتجات.'),
            block('شروط الحاوية في لمحة', extra=facts([
                ('الحد الأدنى للطلب', 'حاوية واحدة 20 قدمًا (نحو 16&ndash;18 طنًا متريًا) &mdash; تُؤكَّد أثناء عرض السعر'),
                ('شروط التسليم', 'FOB الإسكندرية أو CIF أو CFR &mdash; يُتفق عليها أثناء عرض السعر'),
                ('الدفع', 'عادةً 30% T/T · 70% مقابل صورة B/L؛ واعتماد مستندي عند الاطلاع L/C وشروط قابلة للتفاوض للشركاء المعتمدين'),
                ('العملة', 'الدولار أو اليورو'),
                ('العينات', 'تشكيلة 1&ndash;5 كجم متاحة عند الطلب'),
                ('المستندات', 'حزمة مستندات تصدير كاملة مع كل حاوية (أدناه)'),
            ]) + note('الشروط الموضحة حالية واسترشادية؛ تُؤكَّد الشروط الدقيقة أثناء عرض السعر للمنتج والطلب المحدد. والخطوات الست من الاستفسار إلى الشحن على صفحة ' + a('/ar/how-we-work', 'كيف نعمل') + '.')),
            block('مستندات التصدير مع كل حاوية',
                  'يُعَدّ كل طلب بمستندات تصدير قياسية &mdash; فاتورة تجارية، وقائمة تعبئة، وشهادة منشأ، وشهادة صحية أو نباتية، وبوليصة شحن. وتُؤكَّد المستندات الإضافية التي يتطلبها سوق وجهتك أثناء عرض السعر.',
                  'تختلف الرسوم الجمركية ومعاملة التعرفة، بما في ذلك التصنيف الجمركي HS الصحيح لزيتون المائدة في سوقك، من بلد لآخر وقد تتغير. يُرجى تأكيدها مع مخلّصك الجمركي. ووضع مستنداتنا اليوم موضّح على صفحة ' + a('/ar/resources/certifications', 'الشهادات ومستندات الجودة') + '.'),
            block('التغليف للجملة وإعادة التوزيع',
                  'لأقل تكلفة لكل كيلوجرام في الأحجام الكبيرة، يُشحن الزيتون في براميل بلاستيكية سعة 220 كجم. وتتوفر أيضًا دِلاء درجة غذائية، وعلب صفيح، وبرطمانات زجاجية، وأكياس مفرّغة من الهواء، فيمكن للموزع أن يأخذ عبوات جاهزة للتجزئة أو لخدمات الأغذية إلى جانب الجملة. الأحجام وأعداد الكرتونة على صفحة ' + a('/ar/resources/packaging', 'التغليف والأحجام') + '، ومعها شرح تصنيف الأعيرة.'),
            block('الأسواق التي نتواصل معها',
                  'نبني علاقات مع المشترين بفاعلية في أفريقيا والشرق الأوسط وآسيا. وبصفتنا شركة تصدير حديثة التأسيس، نحن صريحون بشأن الوضع الحالي: لم نُتمّ بعد أي شحنة تصدير، فهذه أسواق نتواصل معها، وليست أسواقًا نخدمها حاليًا. المزيد على صفحة ' + a('/ar/resources/export-markets', 'أسواق التصدير') + '.'),
            block('من يقوم بماذا',
                  'تُنجَز المعالجة والتخليل عبر منشأة المعالجة الشريكة المعتمدة في منطقة العاشر من رمضان الصناعية. وتتولى ' + ORG_AR + ' التوريد وتحديد مواصفات المنتج والتواصل مع المشترين وتنسيق التصدير والمستندات. والترتيب كاملًا على صفحة ' + a('/ar/resources/supply-network', 'شبكة التوريد والمعالجة') + '.'),
            block('التشكيلة', 'عشرة منتجات. الأعيرة ومواصفات المحلول الملحي والصيغ على صفحة كل منتج وفي ' + a('/ar/catalog', 'الكتالوج') + '.', extra=products('ar')),
        )
        + cta('أخبرنا بسوقك وحجم طلبك', 'سنرسل لك عرضًا مخصصًا ونؤكد الشروط لطلبك.',
              (contact('ar', 'quote', 'importer-distributor'), 'اطلب عرض سعر'), sample('ar'))),
}

PAGES['retail'] = {
    'en': dict(
        crumb='Retail',
        title=f'Retail-Ready Egyptian Olives in Glass Jars &amp; Tins | {ORG}',
        desc='Retail-ready Egyptian table olives in glass jars (320–1050 ml) and tin cans (65mm to A12), available under your own label for supermarket and specialty shelves.',
        keywords='retail-ready olive supplier, olives for supermarket private label, glass jar olive supplier Egypt',
        main=lambda: hero('Solutions', 'For Retail Buyers',
                          'Shelf-ready Egyptian table olives in glass jars and tin cans, under your own label if you want one.')
        + body(
            forwhom('This page is for supermarket chains, specialty food shops and delicatessens &mdash; and the importers who supply them &mdash; buying olives packed for the shelf.'),
            block('Retail formats', extra=cards([
                ('Glass jars', '320, 370, 467, 720 and 1050 ml &mdash; 12 jars per carton up to 720 ml, 6 at 1050 ml. Premium retail and deli presentation; shows the product and supports branded and private-label labels.'),
                ('Tin cans', '65mm, A9, A10 and A12 &mdash; 12 per carton for 65mm, 6 for A9 and A10, 4 for A12. Shelf-stable and durable, and suited to warm-climate markets.'),
            ]) + note('These are the jar and can sizes we currently quote. All formats, including buckets, barrels and vacuum pouches, are on ' + a('/resources/packaging#glass-jars', 'Packaging &amp; Sizing') + '.')),
            block('Choosing a caliber for the shelf',
                  'Caliber is the count of olives per kilogram, so a lower number means larger olives. Premium retail jars typically use 101/110 to 181/200. The calibers available for each variety are on its product page and in the ' + a('/catalog', 'catalogue') + '.'),
            block('Your own label',
                  'Private label is available on nine of our ten products, in glass, tin, bucket and barrel formats. We handle printing, filling and export documentation, and can help with label design on request &mdash; we are not a design agency. Products, limits and the brief form are on ' + a('/resources/private-label', 'Private Label &amp; OEM') + '.'),
            block('The range', 'Ten products. Calibers, brine specification and formats are on each product&rsquo;s own page.', extra=products('en')),
            block('Order terms',
                  'Retail orders follow the same container terms as any other order &mdash; a minimum of 1 &times; 20ft container, confirmed during quotation. Payment, Incoterms and documents are on ' + a('/solutions/importer-distributor', 'Importers &amp; Distributors') + '.'),
        )
        + cta('Planning a retail range?', 'Tell us your formats, sizes and market — we&#x27;ll confirm options and send an offer.',
              (contact('en', 'quote', 'retail'), 'Request a Quote'), sample('en'))),
    'ar': dict(
        crumb='التجزئة',
        title=f'زيتون مصري جاهز للتجزئة في برطمانات زجاجية وعلب صفيح | {ORG_AR}',
        desc='زيتون مائدة مصري جاهز للتجزئة في برطمانات زجاجية (320–1050 مل) وعلب صفيح (من 65 مم إلى A12)، ومتاح بعلامتك الخاصة لأرفف السوبر ماركت والمتاجر المتخصصة.',
        keywords='مورد زيتون جاهز للتجزئة, زيتون بالعلامة الخاصة للسوبر ماركت, مورد زيتون في برطمانات زجاجية مصر',
        main=lambda: hero('الحلول', 'لمشتري التجزئة',
                          'زيتون مائدة مصري جاهز للرف في برطمانات زجاجية وعلب صفيح، وبعلامتك الخاصة إن أردت.')
        + body(
            forwhom('هذه الصفحة لسلاسل السوبر ماركت ومتاجر الأغذية المتخصصة ومحلات الأطعمة الجاهزة &mdash; وللمستوردين الذين يوردون لها &mdash; ممن يشترون الزيتون مُعبَّأً للرف.'),
            block('صيغ التجزئة', extra=cards([
                ('برطمانات زجاجية', '320 و 370 و 467 و 720 و 1050 مل &mdash; 12 برطمانًا في الكرتونة حتى حجم 720 مل، و 6 لحجم 1050 مل. عرض فاخر للتجزئة ومحلات الأطعمة الجاهزة؛ تُبرز المنتج وتدعم ملصقات العلامة التجارية والعلامة الخاصة.'),
                ('علب صفيح', '65 مم و A9 و A10 و A12 &mdash; 12 علبة في الكرتونة لمقاس 65 مم، و 6 لمقاسي A9 و A10، و 4 لمقاس A12. ثابتة ومتينة على الرف، ومناسبة لأسواق المناخات الحارة.'),
            ]) + note('هذه مقاسات البرطمانات والعلب التي نعرضها حاليًا. وجميع الصيغ، بما فيها الدِلاء والبراميل والأكياس المفرّغة من الهواء، على صفحة ' + a('/ar/resources/packaging#glass-jars', 'التغليف والأحجام') + '.')),
            block('اختيار العيار للرف',
                  'العيار هو عدد حبات الزيتون لكل كيلوجرام، فالرقم الأقل يعني حبات أكبر. تستخدم برطمانات التجزئة الفاخرة عادة الأعيرة من 101/110 إلى 181/200. والأعيرة المتاحة لكل صنف على صفحة المنتج وفي ' + a('/ar/catalog', 'الكتالوج') + '.'),
            block('علامتك الخاصة',
                  'العلامة الخاصة متاحة على تسعة من منتجاتنا العشرة، بصيغ الزجاج والصفيح والدلو والبرميل. نتولى الطباعة والتعبئة ومستندات التصدير، ويمكننا المساعدة في تصميم الملصق عند الطلب &mdash; ولسنا وكالة تصميم. المنتجات والحدود ونموذج الموجز على صفحة ' + a('/ar/resources/private-label', 'العلامة الخاصة و OEM') + '.'),
            block('التشكيلة', 'عشرة منتجات. الأعيرة ومواصفات المحلول الملحي والصيغ على صفحة كل منتج.', extra=products('ar')),
            block('شروط الطلب',
                  'تتبع طلبات التجزئة شروط الحاويات نفسها لأي طلب آخر &mdash; حد أدنى حاوية واحدة 20 قدمًا، يُؤكَّد أثناء عرض السعر. والدفع وشروط التسليم والمستندات على صفحة ' + a('/ar/solutions/importer-distributor', 'المستوردون والموزعون') + '.'),
        )
        + cta('تخطط لتشكيلة تجزئة؟', 'أخبرنا بالصيغ والأحجام والسوق — وسنؤكد الخيارات ونرسل عرضًا.',
              (contact('ar', 'quote', 'retail'), 'اطلب عرض سعر'), sample('ar'))),
}

PAGES['food-service'] = {
    'en': dict(
        crumb='Food Service',
        title=f'Bulk Olives for Restaurants, Caterers &amp; Repackers | {ORG}',
        desc='Egyptian table olives for kitchens, caterers and repackers: food-grade buckets (typically 1–10 kg), tin cans, a 4 kg PET pail for sliced jalapeños, and 220 kg barrels.',
        keywords='bulk olives for restaurants, food-service olive supplier Egypt, olives for caterers and repackers',
        main=lambda: hero('Solutions', 'For Food-Service Buyers',
                          'Olives in practical, larger packs for kitchens, caterers and repackers — where volume and cost per kilogram matter more than shelf presentation.')
        + body(
            forwhom('This page is for restaurants, caterers, food-service suppliers and repackers &mdash; and the importers who supply them.'),
            block('Food-service formats', extra=cards([
                ('Plastic buckets', 'Food-grade buckets, typically 1&ndash;10 kg, for restaurants, caterers and repackers. They balance cost, volume and convenience.'),
                ('Tin cans', 'Shelf-stable and durable, and suited to food service: 65mm, A9, A10 and A12.'),
                ('Plastic barrels', '220 kg barrels for the lowest cost per kilogram on large volumes &mdash; the usual choice for repacking.'),
                ('Vacuum pouches', 'Compact and light, for pitted or sliced product where brine weight and volume need to be kept down.'),
                ('4 kg PET pail', 'For sliced jalape&ntilde;o peppers, 4 per carton.'),
            ]) + note('Sizes and carton counts for every format are on ' + a('/resources/packaging#plastic-buckets', 'Packaging &amp; Sizing') + '.')),
            block('Calibers and cuts for the kitchen',
                  'Food-service and bulk repacking often use calibers of 201/230 and above, at a lower cost per kilogram than premium retail sizes. Whole, pitted, cracked, sliced and stuffed formats are available, depending on the product. What each variety offers is on its product page and in the ' + a('/catalog', 'catalogue') + '.'),
            block('The range', 'Ten products, including sliced jalape&ntilde;os, pepperoncini and marinated artichoke hearts alongside the olives.', extra=products('en')),
            block('Your own brand',
                  'Supplying under your own food-service brand? Private label is available on nine of our ten products, in bucket, tin, barrel and glass formats &mdash; see ' + a('/resources/private-label', 'Private Label &amp; OEM') + '.'),
            block('Order terms',
                  'Food-service orders follow the same container terms as any other order &mdash; a minimum of 1 &times; 20ft container, confirmed during quotation. Payment, Incoterms and documents are on ' + a('/solutions/importer-distributor', 'Importers &amp; Distributors') + '. Buying inside Egypt? See ' + a('/solutions/local-egypt', 'Buyers in Egypt') + '.'),
        )
        + cta('Tell us what your kitchens use', 'Pack sizes, cuts and volumes — we&#x27;ll confirm what fits and send an offer.',
              (contact('en', 'quote', 'food-service'), 'Request a Quote'), sample('en'))),
    'ar': dict(
        crumb='خدمات الأغذية',
        title=f'زيتون بالجملة للمطاعم ومقدمي خدمات التموين وإعادة التعبئة | {ORG_AR}',
        desc='زيتون مائدة مصري للمطابخ ومقدمي خدمات التموين وشركات إعادة التعبئة: دِلاء درجة غذائية (عادة 1–10 كجم)، وعلب صفيح، ووعاء PET سعة 4 كجم للهالبينو المقطّع، وبراميل سعة 220 كجم.',
        keywords='زيتون بالجملة للمطاعم, مورد زيتون لخدمات الأغذية مصر, زيتون لمقدمي التموين وإعادة التعبئة',
        main=lambda: hero('الحلول', 'لمشتري خدمات الأغذية',
                          'زيتون في عبوات عملية وأكبر حجمًا للمطابخ ومقدمي خدمات التموين وشركات إعادة التعبئة — حيث يهم الحجم والتكلفة لكل كيلوجرام أكثر من العرض على الرف.')
        + body(
            forwhom('هذه الصفحة للمطاعم ومقدمي خدمات التموين وموردي خدمات الأغذية وشركات إعادة التعبئة &mdash; وللمستوردين الذين يوردون لهم.'),
            block('صيغ خدمات الأغذية', extra=cards([
                ('دِلاء بلاستيكية', 'دِلاء درجة غذائية، عادة من 1 إلى 10 كجم، للمطاعم ومقدمي خدمات الطعام وشركات إعادة التعبئة. توازن بين التكلفة والحجم والملاءمة.'),
                ('علب صفيح', 'ثابتة ومتينة، ومناسبة لخدمات الأغذية: 65 مم و A9 و A10 و A12.'),
                ('براميل بلاستيكية', 'براميل سعة 220 كجم لأقل تكلفة لكل كيلوجرام في الأحجام الكبيرة &mdash; الخيار المعتاد لإعادة التعبئة.'),
                ('أكياس مفرّغة من الهواء', 'صيغة مدمجة وخفيفة للمنتج المنزوع النواة أو المقطع حيث يلزم تقليل وزن وحجم المحلول الملحي.'),
                ('وعاء PET سعة 4 كجم', 'للفلفل الهالبينو المقطّع، 4 في الكرتونة.'),
            ]) + note('الأحجام وأعداد الكرتونة لكل صيغة على صفحة ' + a('/ar/resources/packaging#plastic-buckets', 'التغليف والأحجام') + '.')),
            block('الأعيرة والتقطيعات للمطبخ',
                  'تستخدم خدمات الأغذية وإعادة التعبئة بالجملة غالبًا الأعيرة 201/230 وما فوق، بتكلفة أقل لكل كيلوجرام من أحجام التجزئة الفاخرة. وتتوفر صيغ كاملة، ومنزوعة النواة، ومكسّرة، ومقطعة، ومحشوة، حسب المنتج. وما يقدمه كل صنف على صفحة المنتج وفي ' + a('/ar/catalog', 'الكتالوج') + '.'),
            block('التشكيلة', 'عشرة منتجات، منها الهالبينو المقطّع والبيبرونشيني وقلوب الأرضي شوكي المتبّلة إلى جانب الزيتون.', extra=products('ar')),
            block('علامتك الخاصة',
                  'توريد بعلامتك الخاصة لخدمات الأغذية؟ العلامة الخاصة متاحة على تسعة من منتجاتنا العشرة، بصيغ الدلو والصفيح والبرميل والزجاج &mdash; انظر ' + a('/ar/resources/private-label', 'العلامة الخاصة و OEM') + '.'),
            block('شروط الطلب',
                  'تتبع طلبات خدمات الأغذية شروط الحاويات نفسها لأي طلب آخر &mdash; حد أدنى حاوية واحدة 20 قدمًا، يُؤكَّد أثناء عرض السعر. والدفع وشروط التسليم والمستندات على صفحة ' + a('/ar/solutions/importer-distributor', 'المستوردون والموزعون') + '. تشتري داخل مصر؟ انظر ' + a('/ar/solutions/local-egypt', 'المشترون داخل مصر') + '.'),
        )
        + cta('أخبرنا بما تستخدمه مطابخك', 'أحجام العبوات والتقطيعات والكميات — وسنؤكد ما يناسبك ونرسل عرضًا.',
              (contact('ar', 'quote', 'food-service'), 'اطلب عرض سعر'), sample('ar'))),
}

PAGES['manufacturer'] = {
    'en': dict(
        crumb='Manufacturers &amp; OEM',
        title=f'OEM &amp; Co-Packing Olive Supply | {ORG}',
        desc='Co-packing and OEM supply of Egyptian table olives: custom brine formulation, specific caliber sorting, and private packaging and labeling, executed with our approved partner processing facility.',
        keywords='OEM olive co-packing Egypt, olive contract manufacturing, custom brine formulation olives, private label olive formulation',
        main=lambda: hero('Solutions', 'For Manufacturers and OEM Buyers',
                          'Co-packing and OEM supply for buyers who need Egyptian table olives to their own specification.')
        + body(
            forwhom('This page is for buyers who repack, private-label, or process our product further &mdash; food manufacturers, repackers and brand owners.'),
            block('Co-packing and OEM supply', MFR_EN),
            block('What we work on with you', extra=cards([
                ('Custom brine formulation', 'The brine your product needs, worked out with you. The specification is confirmed during quotation.'),
                ('Specific caliber sorting', 'Olives sorted to the caliber range you specify &mdash; the count per kilogram. How caliber works is on ' + a('/resources/packaging', 'Packaging &amp; Sizing') + '.'),
                ('Private packaging and labeling', 'Packing and labeling to your requirements, across glass, tin, bucket and barrel formats, with label design help on request.'),
            ])),
            block('Who does what',
                  'Our team takes an active technical role: formulation, sorting and packaging and labeling decisions are worked out by us, with you. The physical processing, brining and packing are carried out at our approved partner processing facility in the 10th of Ramadan Industrial Zone. We do not own or operate a processing factory, and we do not present the partner facility as ours &mdash; the arrangement is set out on ' + a('/resources/supply-network', 'Supply &amp; Processing Network') + '.'),
            block('How to start',
                  'Send us your requirements &mdash; the product, the brine, the caliber, the packaging and labeling, and the volume. We will confirm what is feasible, the specification, and a quotation. A sample of the varieties you are considering can come first; see ' + a('/how-we-work', 'How We Work') + ' for the steps. Which products are offered for private label is on ' + a('/resources/private-label', 'Private Label &amp; OEM') + '.'),
            block('Order terms',
                  'OEM orders follow the same container terms as any other order &mdash; a minimum of 1 &times; 20ft container, confirmed during quotation. Payment, Incoterms and documents are on ' + a('/solutions/importer-distributor', 'Importers &amp; Distributors') + '.'),
            block('The range', 'Ten products, with calibers, brine specification and formats on each product&rsquo;s own page.', extra=products('en')),
        )
        + cta('Send us your specification', 'Formulation, sort, packaging and volume — we&#x27;ll confirm feasibility and quote.',
              (contact('en', 'quote', 'manufacturer'), 'Request a Quote'), sample('en'))),
    'ar': dict(
        crumb='المصنّعون و OEM',
        title=f'توريد زيتون OEM وتعبئة تعاقدية | {ORG_AR}',
        desc='تعبئة تعاقدية وتوريد OEM لزيتون المائدة المصري: تركيب محلول ملحي مخصص، وفرز أعيرة محددة، وتغليف وملصقات خاصة، يُنفَّذ مع منشأة المعالجة الشريكة المعتمدة لدينا.',
        keywords='تعبئة تعاقدية للزيتون مصر, تصنيع زيتون بالتعاقد, تركيب محلول ملحي مخصص للزيتون, زيتون بالعلامة الخاصة OEM',
        main=lambda: hero('الحلول', 'للمصنّعين ومشتري OEM',
                          'تعبئة تعاقدية وتوريد OEM للمشترين الذين يحتاجون زيتون مائدة مصريًا بحسب مواصفاتهم.')
        + body(
            forwhom('هذه الصفحة للمشترين الذين يعيدون تعبئة منتجنا، أو يبيعونه بعلامتهم الخاصة، أو يعالجونه معالجة إضافية &mdash; مصنّعو الأغذية، وشركات إعادة التعبئة، وأصحاب العلامات التجارية.'),
            block('التعبئة التعاقدية وتوريد OEM', MFR_AR),
            block('ما نعمل عليه معك', extra=cards([
                ('تركيب المحلول الملحي المخصص', 'المحلول الملحي الذي يحتاجه منتجك، نحدده معك. وتُؤكَّد المواصفة أثناء عرض السعر.'),
                ('فرز الأعيرة المحددة', 'زيتون مفروز بنطاق العيار الذي تحدده &mdash; عدد الحبات لكل كيلوجرام. وشرح الأعيرة على صفحة ' + a('/ar/resources/packaging', 'التغليف والأحجام') + '.'),
                ('التغليف ووضع الملصقات الخاصة', 'تعبئة ووضع ملصقات بحسب متطلباتك، بصيغ الزجاج والصفيح والدلو والبرميل، مع إمكانية المساعدة في تصميم الملصق عند الطلب.'),
            ])),
            block('من يقوم بماذا',
                  'يؤدي فريقنا دورًا فنيًا فعليًا: قرارات التركيب والفرز والتغليف ووضع الملصقات نعمل عليها نحن، معك. أما المعالجة والتخليل والتعبئة فعليًا فتُنفَّذ في منشأة المعالجة الشريكة المعتمدة في منطقة العاشر من رمضان الصناعية. نحن لا نمتلك مصنع معالجة ولا نُشغّله، ولا نقدّم المنشأة الشريكة على أنها ملكنا &mdash; والترتيب موضّح على صفحة ' + a('/ar/resources/supply-network', 'شبكة التوريد والمعالجة') + '.'),
            block('كيف تبدأ',
                  'أرسل لنا متطلباتك &mdash; المنتج، والمحلول الملحي، والعيار، والتغليف والملصقات، والكمية. وسنؤكد ما يمكن تنفيذه، والمواصفات، وعرض السعر. ويمكن أن تسبق ذلك عينة من الأصناف التي تدرسها؛ والخطوات على صفحة ' + a('/ar/how-we-work', 'كيف نعمل') + '. والمنتجات المتاحة للعلامة الخاصة على صفحة ' + a('/ar/resources/private-label', 'العلامة الخاصة و OEM') + '.'),
            block('شروط الطلب',
                  'تتبع طلبات OEM شروط الحاويات نفسها لأي طلب آخر &mdash; حد أدنى حاوية واحدة 20 قدمًا، يُؤكَّد أثناء عرض السعر. والدفع وشروط التسليم والمستندات على صفحة ' + a('/ar/solutions/importer-distributor', 'المستوردون والموزعون') + '.'),
            block('التشكيلة', 'عشرة منتجات، والأعيرة ومواصفات المحلول الملحي والصيغ على صفحة كل منتج.', extra=products('ar')),
        )
        + cta('أرسل لنا مواصفاتك', 'التركيبة والفرز والتغليف والكمية — وسنؤكد إمكانية التنفيذ ونرسل عرض السعر.',
              (contact('ar', 'quote', 'manufacturer'), 'اطلب عرض سعر'), sample('ar'))),
}

PAGES['local-egypt'] = {
    'en': dict(
        crumb='Buyers in Egypt',
        title=f'Olive Supplier in Egypt — Local Barrel Orders from 10 Tons | {ORG}',
        desc='Egyptian table olives for buyers inside Egypt, without export logistics: 220 kg barrel orders from 10 metric tons (about 45 barrels); jars, tins and buckets at the standard 16–18 MT minimum. Pricing confirmed during quotation.',
        keywords='olive supplier Egypt EGP pricing, local wholesale olives Cairo, olive barrel supplier Egypt',
        main=lambda: hero('Solutions', 'For Buyers in Egypt',
                          'Egyptian table olives for businesses buying inside Egypt rather than for export.')
        + body(
            forwhom('This page is for businesses in Egypt &mdash; wholesalers, distributors, food-service operators, retailers and manufacturers &mdash; buying for the local market.'),
            block('Local supply', LOCAL_EN),
            block('Local order terms', extra=facts([
                ('Bulk barrels (220 kg)', 'Minimum order 10 metric tons &mdash; approximately 45 barrels'),
                ('Glass jars, tins and buckets', 'The standard minimum, the same as export: 16&ndash;18 metric tons'),
                ('Pricing', 'Quoted in Egyptian pounds (EGP) and confirmed during quotation'),
                ('Delivery within Egypt', 'Arranged and confirmed during quotation'),
            ])),
            block('Packaging and products',
                  'Barrels, buckets, tins and jars are described on ' + a('/resources/packaging#plastic-barrels', 'Packaging &amp; Sizing') + ', and every product is in the ' + a('/catalog', 'catalogue') + '. Buying for food service or retail? The ' + a('/solutions/food-service', 'food-service') + ' and ' + a('/solutions/retail', 'retail') + ' pages cover those formats in more detail.',
                  extra=products('en')),
        )
        + cta('Request local pricing', 'Tell us the product, format and quantity — we&#x27;ll confirm pricing and delivery within Egypt.',
              (contact('en', 'local_pricing', 'local-egypt'), 'Request Local Pricing'), sample('en'))),
    'ar': dict(
        crumb='المشترون داخل مصر',
        title=f'مورد زيتون في مصر — طلبات براميل محلية من 10 أطنان | {ORG_AR}',
        desc='زيتون مائدة مصري للمشترين داخل مصر دون إجراءات تصدير: طلبات البراميل سعة 220 كجم من 10 أطنان مترية (نحو 45 برميلًا)؛ والبرطمانات والعلب والدِلاء بالحد الأدنى القياسي 16–18 طنًا متريًا. ويُؤكَّد التسعير أثناء عرض السعر.',
        keywords='مورد زيتون مصر بالجنيه المصري, زيتون بالجملة القاهرة, مورد براميل زيتون مصر',
        main=lambda: hero('الحلول', 'للمشترين داخل مصر',
                          'زيتون مائدة مصري للشركات التي تشتري داخل مصر وليس للتصدير.')
        + body(
            forwhom('هذه الصفحة للشركات في مصر &mdash; تجار الجملة، والموزعون، ومشغلو خدمات الأغذية، ومتاجر التجزئة، والمصنّعون &mdash; ممن يشترون للسوق المحلي.'),
            block('التوريد المحلي', LOCAL_AR),
            block('شروط الطلب المحلي', extra=facts([
                ('البراميل بالجملة (220 كجم)', 'الحد الأدنى للطلب 10 أطنان مترية &mdash; نحو 45 برميلًا'),
                ('البرطمانات الزجاجية والعلب والدِلاء', 'الحد الأدنى القياسي، وهو نفسه للتصدير: 16&ndash;18 طنًا متريًا'),
                ('التسعير', 'بالجنيه المصري، ويُؤكَّد أثناء عرض السعر'),
                ('التسليم داخل مصر', 'يُرتَّب ويُؤكَّد أثناء عرض السعر'),
            ])),
            block('التغليف والمنتجات',
                  'البراميل والدِلاء والعلب والبرطمانات موضّحة على صفحة ' + a('/ar/resources/packaging#plastic-barrels', 'التغليف والأحجام') + '، وكل المنتجات في ' + a('/ar/catalog', 'الكتالوج') + '. تشتري لخدمات الأغذية أو للتجزئة؟ صفحتا ' + a('/ar/solutions/food-service', 'خدمات الأغذية') + ' و' + a('/ar/solutions/retail', 'التجزئة') + ' تتناولان هذه الصيغ بتفصيل أكبر.',
                  extra=products('ar')),
        )
        + cta('اطلب أسعار السوق المحلي', 'أخبرنا بالمنتج والصيغة والكمية — وسنؤكد التسعير والتسليم داخل مصر.',
              (contact('ar', 'local_pricing', 'local-egypt'), 'اطلب أسعار السوق المصري'), sample('ar'))),
}


# ---- assemble ---------------------------------------------------------------
SHELL_ROUTE = '/resources/export-markets'


def shell(lang):
    rel = ('ar' if lang == 'ar' else '') + SHELL_ROUTE
    return open(os.path.join(ROOT, rel.lstrip('/'), 'index.html'), encoding='utf-8').read()


def build(slug, lang, p):
    s = shell(lang)
    route = '/solutions' + (f'/{slug}' if slug else '')
    url = SITE + pre(lang) + route
    en_url, ar_url = SITE + route, SITE + '/ar' + route

    def sub(pattern, repl, optional=False):
        nonlocal s
        new, n = re.subn(pattern, lambda m: repl, s, count=1)
        assert n == 1 or (optional and n == 0), (slug, lang, pattern, n)
        s = new

    sub(r'<title>[^<]*</title>', f'<title>{p["title"]}</title>')
    sub(r'<meta name="keywords" content="[^"]*"\s*/>', f'<meta name="keywords" content="{p["keywords"]}" />')
    sub(r'<link rel="alternate" hreflang="en" href="[^"]*"\s*/>', f'<link rel="alternate" hreflang="en" href="{en_url}" />')
    sub(r'<link rel="alternate" hreflang="ar" href="[^"]*"\s*/>', f'<link rel="alternate" hreflang="ar" href="{ar_url}" />')
    sub(r'<link rel="alternate" hreflang="x-default" href="[^"]*"\s*/>', f'<link rel="alternate" hreflang="x-default" href="{en_url}" />')
    sub(r'<meta property="og:title" content="[^"]*"\s*/>', f'<meta property="og:title" content="{p["title"]}" />')
    sub(r'<meta name="twitter:title" content="[^"]*"\s*/>', f'<meta name="twitter:title" content="{p["title"]}" />', optional=True)
    sub(r'<meta name="description" content="[^"]*"\s*/>', f'<meta name="description" content="{p["desc"]}" />')
    sub(r'<meta property="og:description" content="[^"]*"\s*/>', f'<meta property="og:description" content="{p["desc"]}" />')
    sub(r'<meta name="twitter:description" content="[^"]*"\s*/>', f'<meta name="twitter:description" content="{p["desc"]}" />', optional=True)
    sub(r'<meta property="og:url" content="[^"]*"\s*/>', f'<meta property="og:url" content="{url}" />')
    sub(r'<link rel="canonical" href="[^"]*"\s*/>', f'<link rel="canonical" href="{url}" />')

    home = 'الرئيسية' if lang == 'ar' else 'Home'
    hub = 'الحلول' if lang == 'ar' else 'Solutions'
    crumbs = [(home, SITE + ('/ar/' if lang == 'ar' else '/'))]
    crumbs += [(hub, SITE + pre(lang) + '/solutions'), (html.unescape(p['crumb']), url)] if slug else [(hub, url)]
    ld = {'@context': 'https://schema.org', '@type': 'BreadcrumbList', 'itemListElement': [
        {'@type': 'ListItem', 'position': i + 1, 'name': n, 'item': u} for i, (n, u) in enumerate(crumbs)]}
    sub(r'<script type="application/ld\+json">\s*\{\s*"@context": "https://schema.org",\s*"@type": "BreadcrumbList"[\s\S]*?</script>',
        '<script type="application/ld+json">\n' + json.dumps(ld, ensure_ascii=False, indent=2) + '\n</script>')

    # The language switch (header and phone menu) points at this page's twin.
    shell_twin = SHELL_ROUTE if lang == 'ar' else '/ar' + SHELL_ROUTE
    twin = route if lang == 'ar' else '/ar' + route
    assert s.count(f'href="{shell_twin}" hreflang=') == 2, (slug, lang)
    s = s.replace(f'href="{shell_twin}" hreflang=', f'href="{twin}" hreflang=')

    i, j = s.index('<main class="flex-1">'), s.index('</main>') + len('</main>')
    s = s[:i] + '<main class="flex-1">' + p['main']() + '</main>' + s[j:]
    head = s[:s.index('<body')]
    assert SHELL_ROUTE not in head, (slug, lang, 'the shell page\'s address was left in the head')
    return s


def main():
    for slug, langs in PAGES.items():
        for lang, p in langs.items():
            parts = (['ar'] if lang == 'ar' else []) + ['solutions'] + ([slug] if slug else []) + ['index.html']
            out = os.path.join(ROOT, *parts)
            os.makedirs(os.path.dirname(out), exist_ok=True)
            with open(out, 'w', encoding='utf-8') as f:
                f.write(build(slug, lang, p))
            print('wrote', '/'.join(parts))


if __name__ == '__main__':
    main()
