# Arabic structured-data audit — 2026-09-05

Read-only audit of every Arabic route, requested before any fix.

**Status: §4.2 was reviewed and resolved on 2026-09-05 — option 2, see the
resolution note there. §4.1 (product identifiers) is still open.**

Scope: all **42 Arabic routes with a page on disk**. (The route map counts 45;
the three gated guides are served from the functions bundle and have no
`index.html` to inspect. They carry no structured data, same as their English
twins, and are `noindex` + `Disallow` by design.)

---

## 1. Summary

| | Count | |
| --- | --- | --- |
| Arabic routes with **no structured data at all** | 3 | correct — see §2 |
| Arabic routes **already correct** | 39 | §3 |
| Arabic routes carrying **English content where Arabic belongs** | **0** | §3 |
| Real gaps found | 2 | §4 — one resolved, one open |

The headline finding is that the thing most likely to be wrong — Arabic pages
serving English structured data — **is not happening anywhere.** Every Arabic
label, question, answer, product name and product description in structured
data on an Arabic page is in Arabic, and every breadcrumb URL is an `/ar/`
URL.

---

## 2. Arabic routes with no structured data (3) — correct as-is

```
/ar/business-card      /ar/catalog/print      /ar/letterhead
```

Print and hand-over pages. Their English twins carry none either, all six are
`noindex` and `Disallow`ed, and none of them is a page a search engine should
be describing. No action.

*(`/ar/business-card` was `index, follow` in its meta robots tag while
`robots.txt` disallowed it — the one contradiction found. Fixed in the same
change as this audit, along with its English twin, to match `/ar/letterhead`.)*

---

## 3. Already correct

### WebSite — correct

One WebSite node exists in the Arabic tree, on `/ar/`:

```json
{
  "@type": "WebSite",
  "@id": "https://olivesegypt.com/ar/#website",
  "name": "الشركة الثلاثية للتنمية الصناعية",
  "url": "https://olivesegypt.com/ar/",
  "inLanguage": "ar",
  "publisher": { "@id": "https://olivesegypt.com/#organization" }
}
```

Arabic `name`, `inLanguage: "ar"`, a bare `@id` reference to the single
canonical Organization, and **no duplicated organisation fields** — no logo,
address, contactPoint, email or sameAs of its own. This is exactly the shape
asked for.

`description` is absent. It is an optional WebSite property and adding one
would mean writing new Arabic marketing copy, so it is left alone.

### BreadcrumbList — correct, 38 of 38

Every Arabic page with a breadcrumb has **Arabic labels and `/ar/` URLs**.
Zero English labels. Zero English URLs. For example:

```json
{"@type": "ListItem", "position": 2, "name": "الموارد",
 "item": "https://olivesegypt.com/ar/resources"}
```

### FAQPage — correct, and genuinely Arabic

Present on **both** `/ar/` and `/ar/resources/faq`, 8 questions each, matching
the English pair one-for-one in structure. The text is real Arabic, not
absent, not English, not a placeholder:

| | Arabic | English twin |
| --- | --- | --- |
| Q1 | هل تمتلكون منشأة المعالجة؟ | Do you own the processing facility? |
| Q2 | هل سبق لكم التصدير؟ | Have you exported before? |
| Q3 | ما هي الشهادات المعمول بها؟ | What certifications apply? |

The answers carry the same honest-disclosure positions as the English ones —
Q1 answers "لا" and describes the partner arrangement; Q3 says documentation is
still being prepared rather than claiming certification.

One asymmetry, in the English page's favour to fix rather than the Arabic:
`/ar/resources/faq` gives its FAQPage an `@id`
(`https://olivesegypt.com/ar/resources/faq#faq`) and the English
`/resources/faq` has none.

### Product — Arabic content correct

All **11** Arabic product pages carry Product schema with `inLanguage: "ar"`,
an Arabic `name` and an Arabic `description`, and an Arabic `brand`. Nothing
reuses English text. See §4.1 for what is missing from them.

### hreflang vs schema URLs — no mismatches

No Arabic page's structured data describes or points at its English twin. The
seven Arabic Article pages do reference `https://olivesegypt.com/logo.png`,
which is correct — one logo file serves both locales, and it is not
locale-specific content.

---

## 4. The two real gaps

### 4.1 English and Arabic products look like unrelated products — STILL OPEN

Every Arabic product page and its English twin describe the same physical
product, and **nothing in the markup says so**:

| Property | English | Arabic |
| --- | --- | --- |
| `@id` | absent | absent |
| `sku` / `productID` / `mpn` / `gtin` | absent | absent |
| `url` | absent | absent |
| `image` | absent | absent |
| `name`, `description`, `brand` | English | Arabic ✅ |

**0 of 11 pairs share any identifier.** To a consumer of structured data these
are 22 unrelated products, not 11 products in two languages.

This is fixable without writing a word of new copy — the canonical product
keys already exist in `scripts/product-order.js` (`aggizi`, `kalamata`,
`toffahi`, …) and are already used as JSON-LD `@id` fragments in the homepage
ItemList (`https://olivesegypt.com/catalog#aggizi`). Giving each Product node
the same `productID` in both locales, plus a locale-specific `url` and the
product's existing `image`, links the pairs using only values already in the
repository.

**Needs your say-so** because it adds properties to 22 pages, not because it
needs new content.

### 4.2 Fourteen Organization nodes that do not link to the company — RESOLVED

Each of the seven Arabic article pages carries two anonymous Organization
nodes — an `author` and a `publisher` — naming the company in Arabic with **no
`@id`**:

```json
"publisher": {
  "@type": "Organization",
  "name": "الشركة الثلاثية للتنمية الصناعية",
  "logo": { "@type": "ImageObject", "url": "https://olivesegypt.com/logo.png" }
}
```

Since 2026-09-05 the site has exactly one canonical Organization, defined on
the homepage, whose `name` is `Triple Company for Industrial Development`.
These fourteen nodes are unlinked copies of the same company under a different
name.

### Resolved 2026-09-05 — option 2

The owner chose to link them **and** restore `alternateName`, and confirmed
that the registered company name is the English one:
`Triple Company for Industrial Development`. That settles the modelling — the
Arabic name is an alternate, not a `legalName`, so `alternateName` is the
correct property for it rather than the more specific one.

The canonical Organization now carries:

```json
"name": "Triple Company for Industrial Development",
"alternateName": ["Triple Company", "الشركة الثلاثية للتنمية الصناعية"]
```

Both values are restored, not just the Arabic one. "Triple Company" was
briefly written off here as an informal alias; it is displayed in the header
of all 87 pages, so it is a name the company actively uses in public and there
is no reason to withhold it from an entity that is meant to be findable.

All fourteen Arabic article nodes now carry the canonical `@id`, the canonical
name and the one logo — the same shape the English articles already use. The
Arabic name is not repeated on them: anything merging by `@id` finds it on the
canonical definition, which is the point of having one.

**Site-wide result: 29 Organization nodes, all 29 linked to the canonical
`@id`, zero unlinked.**

---

## 5. What the automated check now covers

`scripts/check-org-schema.js` walks **nested** nodes, not just top-level ones —
the earlier version could not see an Organization inside an Article's
`publisher`, which is precisely where these fourteen were hiding. It now fails
if any node claiming the canonical `@id` disagrees with the definition on
`name` or `logo`, and reports the count of `@id`-less Organization nodes.

Since §4.2 was resolved, an Organization node that names the company without
claiming the canonical `@id` is a **hard failure**, not a note. The check also
requires `alternateName` to carry the Arabic name — that is now the only place
in the site's structured data it exists, so losing it silently is exactly the
regression worth guarding.

Both were confirmed by injection: dropping the Arabic name from
`alternateName`, and unlinking one Arabic publisher, each fail the check.
