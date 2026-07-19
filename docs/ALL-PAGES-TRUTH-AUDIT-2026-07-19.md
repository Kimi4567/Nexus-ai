# All-pages truth audit — 2026-07-19

## Scope

Authenticated and public routes were reviewed from Brand Brain through strategy, campaign production, approvals, publishing, paid execution, analytics, learning, operations, connections, billing, settings, and legal/reviewer pages. Campaign-room tabs and legacy redirects were included.

The audit used one rule: a label, number, status, or capability may be shown as true only when it is supported by the saved record, the shared commercial contract, or verified provider data.

## Corrected contradictions

- Brand score history no longer calls eight saved identity fields “100% completeness” while showing a different maturity score.
- Strategy header copy now passes through the same evidence/proof guard as the detailed strategy document.
- `analytics` and `results` campaign tab URLs now resolve to the honest Performance tab instead of silently showing Strategy.
- Image-only creative analysis no longer claims that video frames were inspected or that video analysis is merely a future feature.
- TikTok reviewer copy no longer renders an unfinished nickname placeholder as account truth.
- Approval, execution, analytics, paid, publishing, and operations metadata now describe evidence-gated behavior rather than implied outcomes.
- Public pricing now describes post counts as maximum planned-copy allowances, separates image/video actions, and states that AI operations consume credits.
- Pre-launch pricing, upgrade, cancellation, renewal, Terms, and Refund wording now agrees that Stripe is not live and that no real subscription starts yet.
- The Arabic free-trial allowance now uses the shared 15-credit contract, matching English and runtime billing.
- Legacy Arabic pricing values were aligned with the authoritative Growth (60) and Autopilot (180) credit contracts.
- Public structured data no longer advertises live purchasable offers while commercial billing is disabled.
- Assisted Brand Brain suggestions without a returned source excerpt are labelled unverified instead of promising future evidence.
- Broken layout codemod shells were replaced with valid child-rendering layouts, and private/reviewer routes are marked `noindex`.

## Truth that remains intentionally visible

- No live publishing, paid spend, performance attribution, or learning outcome is claimed without an eligible provider connection and returned evidence.
- Campaign limits are creation/workspace allowances; they are not promises of fully generated campaigns. AI production remains credit-priced per action.
- Strategy recommendations are planning outputs. Unsupported assets are work to create and approve, not assets that already exist.
- Operations Center shows verified workflow incidents and missing evidence; it does not infer campaign performance.

## Verification

- Full test suite: 321 files, 2,437 tests passed.
- Targeted truth/contract suite: 3 files, 61 tests passed.
- TypeScript: passed with no errors.
- Production build: passed; 123 application pages generated/validated.
- `git diff --check`: clean.

## External proof boundary

This audit removes contradictions and unsupported claims in the product. It does not turn an unavailable external permission into a verified capability. End-to-end proof of live publishing, paid activation, provider analytics, and approved learning still requires the relevant platform approvals and a controlled pilot; the UI must continue to show those states as locked or unproven until that evidence exists.
