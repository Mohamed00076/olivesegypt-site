# G0 — Questions for Counsel, With Implementation Action Taken Meanwhile

This section is deliberately named "privacy implementation and legal-review
preparation," not "PDPL compliance." Nothing here certifies legal compliance.
Every row below is a question that only a lawyer can answer; the right-hand
column is the technical action taken now, while that answer is pending, so
implementation is not blocked on it and no premature compliance claim is made
in the meantime.

| # | Question for counsel | Implementation action taken now |
|---|---|---|
| 1 | Does our processing require PDPC registration, licensing, or a DPO? | All processing, providers, data categories, scale, and locations inventoried in [g1-data-flow-inventory.md](./g1-data-flow-inventory.md). No compliance claim made or implied anywhere on the site. |
| 2 | Are Vercel, Netlify, GitHub, our database (Neon/Postgres), our email, Google Search Console, or other providers "international transfers" under Egyptian law? | Provider/country/data-flow register is part of the G1 inventory. No new provider has been or will be enabled without separate approval (Rule 15). |
| 3 | What consent is required for analytics, persistent visitor IDs, geolocation, and enrichment? | All optional tracking defaults to off (`TC.consent.analytics = false`, unknown-behaves-as-denied). Consent is granular per category, withdrawable, and logged (G2). No persistent visitor ID exists anywhere on the site today — see G1's "persistent visitor ID" row. |
| 4 | Is Arabic-primary or bilingual notice legally required for our consent banner and privacy policy? | **Flagged, not decided.** English copy is prepared now (G2 banner, G3 policy). No Arabic copy is published for either — machine-translated Arabic would violate Rule 12 (no machine-translated content as final) on top of the open legal question. |
| 5 | What data-subject rights, response deadlines, and identity-verification process apply? | A request-intake channel exists (the privacy page's contact-email instruction). No specific deadline (e.g. "72 hours") or automated deletion/anonymization workflow is published or claimed until counsel confirms what applies. |

## Additional items flagged for a legal/business decision (not technical questions)

These came up directly while implementing G2 and G1 and need your call, not just counsel's:

- **Whether an Arabic-primary bilingual toggle is required** for the consent banner and privacy policy (see row 4 above) — pending counsel, and separately pending a translation-and-review process per Rule 12 once counsel answers.
- **Whether pre-consent "Direct" traffic should be stored at all, or dropped entirely.** Currently: pre-consent, no optional-category data is sent anywhere (Umami's script itself does not load until Analytics consent is granted — see G2), so there is no "Direct" traffic record to decide about yet. This becomes a live question only once real consent-gated analytics data starts accumulating.

## What "PDPL implementation" does NOT mean here

Per the Legal-Review Boundary (00-operating-rules.md) and Rule 17: no page, banner, log, or document produced under Section G states or implies that Triple Company is "PDPL compliant," "GDPR compliant," or compliant with any other specific law. The privacy policy (G3) explicitly says so in its own text.
