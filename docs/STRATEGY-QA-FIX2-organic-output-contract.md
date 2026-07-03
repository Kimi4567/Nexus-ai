# STRATEGY-QA-FIX2 Organic Strategy Output Contract

## Context

Controlled production generation for the reset LedgerFlow AI Brand Brain produced a fresh organic strategy successfully. The server deducted the expected strategy credits and created a new draft campaign.

The runtime page was safer than prior versions: it showed review-only strategy copy, no media step, no publish/schedule/paid-launch action, and the new strategy matched the current Brand Brain. The strategy itself still exposed two contract issues:

- Organic-only `channelMix` could contain `budgetPercent`, which reads like ad-spend allocation even when the run is organic.
- `confidenceReport.overall` could be `high` when competitor context or analytics/pixel readiness was still missing.

## Product Truth

- Organic strategy is content/channel effort planning only.
- Organic strategy must not imply ad budget allocation, paid readiness, ad launch, spend, activation, or platform execution.
- Paid readiness is a separate paid/full strategy decision, not an automatic claim inside an organic-only campaign.
- High confidence requires more than organic content readiness. Missing competitor context or analytics/pixel readiness should cap overall confidence below `high`.

## Implementation

- `buildStrategistPrompts` now tells the strategist that organic-only `channelMix` uses `effortSharePercent`, not `budgetPercent`.
- `guardStrategyOutputContract` now receives `strategyType`.
- For `strategyType: "organic"`, the contract guard strips `budgetPercent` from `channelMix` and preserves the value as `effortSharePercent` when present.
- `applyServerReadiness` now receives `strategyType`.
- Organic-only persisted strategy output forces `readyForPaidAds: false` and sets `confidenceReport.byCapability.paidStrategy = "none"`.
- `deriveConfidenceReport` only returns `overall: "high"` when full strategy, competitor context, and analytics/pixel readiness are all ready.

## Non-Goals

- No UI redesign.
- No new strategy generation.
- No prompt expansion for richer strategy depth beyond the contract fix.
- No schema changes.
- No credit/billing changes.
- No dashboard, billing page, publish, schedule, manual publish, Autopilot, image, media, paid launch, platform push, or engine changes.

## Validation

Focused tests cover:

- Organic prompt uses `effortSharePercent` and not `budgetPercent`.
- Paid prompt can still use `budgetPercent` as planning assumption.
- Organic output guard strips `budgetPercent`.
- Paid output guard preserves `budgetPercent`.
- Confidence is capped below high when competitor or analytics/pixel inputs are missing.
- Organic persisted output cannot carry paid-readiness claims.
