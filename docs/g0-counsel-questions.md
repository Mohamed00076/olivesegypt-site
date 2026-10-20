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
| 6 | Is Meta/Facebook (the homepage's click-to-load widget SDK) an "international transfer" the same way question 2 asks about Netlify/Neon/etc.? | Added to the G1 inventory (section 12) as its own gap, 2026-09-02 — was live before this without being inventoried or disclosed on `/privacy`. The widget is strictly user-initiated (a click), not loaded on page load, but that doesn't answer this question. |
| 7 | Does the Buyer CRM's lack of any retention/deletion policy for buyer personal data (soft-delete only, `deleted_at`, data never actually purged) need one, and if so what deadline? | Added to the G1 inventory (section 11), 2026-09-02 — same gap pattern as question 5, but specific to a system that was previously undocumented entirely. No retention period invented or published anywhere. |
| 8 | Should the visit counter's visitor ID (`tc-analytics-visitor`, local storage, set only after analytics consent) have a finite lifetime, and how long? Working suggestion from the owner: 13 months. | Added 2026-10-16 (PR #373). Today it has no expiry: it stays until the visitor clears site data, withdraws consent (removed since PR #373), or the server signals a deletion request. Disclosed as such on /privacy and /ar/privacy. **No expiry implemented** until counsel answers. |
| 9 | Before PR #373 the privacy pages said only that the browser "keeps the same analytics identifier between visits", without naming the two stored entries, what they hold or how long they last. Does that less detailed disclosure mean visitors who accepted before the new text should be asked again? | Added 2026-10-16. Not acted on: PR #373 keeps `POLICY_VERSION` 2026-10-11, so no saved choice is cleared. Re-asking would mean changing `POLICY_VERSION`, which re-shows the banner to everyone. |
| 10 | Does strictly aggregate measurement with no cookies, nothing stored on the device and no persistent ID (for example, server-side page counts) need consent? | Added 2026-10-16 from the consent diagnosis. Not built. |
| 11 | Is the consent register's `device_hash` (sha256 of IP + user agent, truncated) personal data, is keeping it justified as proof of consent, and for how long? | Added 2026-10-16. Unchanged; disclosed on /privacy as "a one-way hashed device identifier". |
| 12 | Does a change of policy wording require asking everyone again, or only a change in what data is used? How long should a saved choice last before asking again? | Added 2026-10-16. The re-ask policy waits for this answer; `POLICY_VERSION` is unchanged meanwhile. |
| 13 | Google Analytics sends visit data to Google's servers, possibly outside Egypt. Is the current wording enough under Law 151/2020 and, for EU buyers, the GDPR? Does the after-consent lookup of the network an IP address belongs to need its own line in the consent request? | Added 2026-10-16. Both are disclosed on the privacy pages; neither is gated separately. |

### Added 2026-10-20 (numbered after 14–17, which arrive with the password-reset pull request #382)

| # | Question for counsel | Implementation action taken now |
|---|---|---|
| 18 | **Erasure requests versus backups.** When a buyer asks for their data to be deleted, the CRM's Erase removes the record, notes, stage history and linked enquiries at once. Copies can remain outside the CRM: the database's restore history (Neon; at most 6 hours on the Free plan per Neon's plans page, set per project), and any manual database snapshot until it is deleted. Is that acceptable for an erasure request, should the person be told, and should snapshots be avoided or deleted on a schedule? Separately, Erase keeps issued documents and uploaded files as business records: is that the right line? | The Erase confirmation says exactly this ("cannot be undone from the CRM"; copies can remain in restore history and snapshots) and no longer says "not even from the database". No snapshot schedule exists; none is created. Nothing claims erasure from backups. |

## Additional items flagged for a legal/business decision (not technical questions)

These came up directly while implementing G2 and G1 and need your call, not just counsel's:

- **Whether an Arabic-primary bilingual toggle is required** for the consent banner and privacy policy (see row 4 above) — pending counsel, and separately pending a translation-and-review process per Rule 12 once counsel answers.
- **Whether pre-consent "Direct" traffic should be stored at all, or dropped entirely.** Currently: pre-consent, no optional-category data is sent anywhere (Umami's script itself does not load until Analytics consent is granted — see G2), so there is no "Direct" traffic record to decide about yet. This becomes a live question only once real consent-gated analytics data starts accumulating.
- **Whether the public privacy policy needs to be updated now to accurately describe the CRM and the Facebook widget** (both real, live, and currently undisclosed on `/privacy` — see questions 6-7 above), independent of whatever counsel eventually says about their underlying legal basis. A factual disclosure gap doesn't wait on a legal-basis answer to become inaccurate; it's inaccurate today. Flagged here as a business decision, not yet acted on without your review of the specific wording.

## What "PDPL implementation" does NOT mean here

Per the Legal-Review Boundary (00-operating-rules.md) and Rule 17: no page, banner, log, or document produced under Section G states or implies that Triple Company is "PDPL compliant," "GDPR compliant," or compliant with any other specific law. The privacy policy (G3) explicitly says so in its own text.
