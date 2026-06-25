# STR-D2 / DS-PR7 Strategy Review Surface

## Objective

Restore the Strategy generation journey so generated strategy output resolves to the existing rich Campaign Strategy tab.

## Product Decision

- The canonical rich strategy output currently lives in the Campaign detail Strategy tab at `/campaigns/[campaignId]?tab=strategy`.
- `/strategy` remains the Strategy entry point and opens the existing `RunFullStrategyModal` for generation.
- `RunFullStrategyModal` remains the core generation flow: language, strategy type, duration, content intensity, Brand Brain gate, media check, cost/credits confirmation, then `POST /api/strategy/run-full`.
- No separate Strategy Review surface is canonical yet.
- Future design-system work should redesign or extract the existing rich Campaign Strategy tab carefully, preserving its depth.

## Route Approach

- `/strategy` review links now point to `/campaigns/[campaignId]?tab=strategy`.
- `/strategy/[campaignId]` is retained only as a compatibility redirect to `/campaigns/[campaignId]?tab=strategy`.
- The previous dedicated read-only review surface direction was abandoned.

## Data Source

- The rich Campaign Strategy tab reads existing campaign data and `campaign.aiOutput.strategy`.
- The modal success path already sends users to `/campaigns/[campaignId]?tab=strategy`.
- This fix aligns `/strategy` with that same destination.

## Missing Data Handling

Missing strategy fields should continue to render honest limited states in the rich Campaign Strategy tab. Future cleanup should preserve language such as:

- “Not included in this strategy draft”
- “No paid plan generated yet”
- “Baseline needed”
- “Target to define after first 30 days”
- “Not connected”
- “Not enabled”

## Safety Boundaries

- No strategy generation changes.
- No `/api/strategy/run-full` changes.
- No credit, billing, auth, campaign creation, publishing, cron, platform, schema, migration, or environment changes.
- No `RunFullStrategyModal` changes.
- No persisted approval system was added.
- No campaign detail redesign was included.

## Review Sections

The existing rich Campaign Strategy tab preserves the valuable generated strategy content:

- Marketing Diagnosis
- Business Objective
- Key Message
- Positioning
- Differentiation
- Audience Segments
- Value Propositions
- Top Hooks
- Execution Plan
- KPIs / Metrics
- Readiness Checklist
- Risk & Compliance Notes

## Follow-Ups

- Redesign or extract the existing rich Campaign Strategy tab into a premium strategy document in a future focused PR.
- Keep Campaign Room execution cleanup separate from this journey restore.
- Re-test Arabic locale switching once the app-level language toggle is reliable in browser QA.
