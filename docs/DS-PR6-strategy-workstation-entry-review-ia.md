# DS-PR6 Strategy Workstation Entry & Review IA

## Objective

Make `/strategy` the entry point for creating and reviewing marketing strategy, without routing users through the dashboard and without changing generation, billing, credit, or Brand Brain readiness behavior.

## Scope

- Updated `src/app/strategy/page.tsx` only.
- Reused the existing `RunFullStrategyModal` so language selection, Brand Brain gates, media checks, cost confirmation, and credit handling remain unchanged.
- Added state-aware page copy and next steps for no strategy, draft strategy, and existing strategy states.

## Behavior

- No strategy: the primary action opens the strategy modal directly on `/strategy`.
- Draft strategy: the page prioritizes review or continuation into existing content surfaces.
- Existing strategy with organic plan: the page shows the relationship between strategy direction, organic content plan, paid planning, and the next recommended action.
- Running or updating strategy still requires modal confirmation before credits are spent.

## Truth Guardrails

- Paid planning is described as planning-only and approval-gated.
- The page does not claim automatic publishing, ad readiness, connected analytics, or performance outcomes.
- Existing campaign and Brand Brain data are rendered as-is; no readiness or platform capability is invented.

## Out Of Scope

- No API changes.
- No auth changes.
- No billing, credit, publishing, cron, schema, migration, or environment changes.
- No dashboard redesign.
- No changes to `RunFullStrategyModal`.

## Follow-Ups

- Add a dedicated strategy detail/review route when the product has a supported strategy review surface.
- Revisit first-run session races if `/api/brand` or strategy data intermittently stalls authenticated QA.
