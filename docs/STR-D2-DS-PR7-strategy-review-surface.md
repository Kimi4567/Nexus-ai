# STR-D2 / DS-PR7 Strategy Review Surface

## Objective

Create a dedicated read-only strategy review surface so users can understand a generated strategy as a rich marketing brief before moving to content planning.

## Product Correction

PR #134 was closed without merging. Product review decided the canonical strategy review should preserve the rich strategy document model already present inside the Campaign detail Strategy tab, rather than inventing a separate simplified surface.

This revision keeps `/strategy/[campaignId]` as the canonical review route but moves the display toward the audited campaign strategy document model.

## Route Approach

- Added `/strategy/[campaignId]`.
- Kept `/strategy` as the create/update workstation from DS-PR6.
- Updated `/strategy` so draft and existing strategies link to the dedicated review route when a campaign id is available.
- Extracted a read-only `StrategyReviewDocument` display component for the canonical route.

## Audit Findings

- The existing rich Strategy tab is rendered inline in `src/app/campaigns/[id]/page.tsx` under “Tab 0: Strategy”.
- The campaign detail page parses rich fields from `campaign.aiOutput.strategy`, including:
  - `diagnosis`, `diagnosisDetails`
  - `businessObjective`
  - `keyMessage`, `positioning`, `differentiation`
  - `audienceSegmentsDetailed`, `audienceSegments`
  - `valueProps`, `topHooks`, `ctaVariations`, `contentPillars`, `contentAngles`
  - `funnelStages`, `channelStrategy`, `channelMix`, `weeklyExecutionPlan`, `weeklyPlan`
  - `kpis`, `successMetricsDetailed`, `successMetrics`
  - `readinessChecklist`, `executionChecklist`, `assetRequirements`, `adSetupPlan`
  - `riskNotes`, `doNotDoYet`, `assumptions`, `missingData`
- `StrategyBrief` is only the premium opening summary. The deeper strategy document content is mostly inline in the campaign page, mixed with campaign operations controls.
- Full extraction of the campaign tab was not safe for this PR because it would pull in quality-review actions, approval flows, campaign operations state, and publish/schedule language.
- The canonical route therefore mirrors the audited rich strategy content model in a read-only component and excludes campaign operations controls.

## Data Source

- Reads existing campaign data from `GET /api/campaigns/[campaignId]`.
- Uses `campaign.aiOutput.strategy` when present, otherwise falls back to existing top-level `aiOutput` fields.
- Uses existing campaign fields such as name, status, goal, audience, platforms, and updated timestamp.
- Mirrors the existing rich campaign strategy field model without changing strategy generation or persistence.

## Missing Data Handling

Missing strategy fields render honest limited states such as:

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
- No campaign operations controls were moved into the review route.

## Review Sections

- Strategy header, source, read-only status, updated timestamp, and actions
- Strategy readiness summary
- Marketing diagnosis
- Business objective
- Core strategy: key message, positioning, differentiation, 90-day direction, first 30 days
- Audience segments with pain, want, objection, message, and preferred platform when present
- Organic content plan with platform mix, content pillars, value propositions, hooks, CTAs, and content angles
- Paid planning as planning-only
- Execution plan with channel mix, funnel stages, and weekly / 4-week plan when present
- KPIs / metrics with baseline-safe hypothesis language
- Readiness checklist, missing items, risks, and compliance notes
- Next action into Content Hub

## Follow-Ups

- Add a persisted strategy review state only after the product model supports it.
- Consider reusing the read-only `StrategyReviewDocument` inside the Campaign detail Strategy tab during a future Campaign Room cleanup.
- Re-test Arabic locale switching once the app-level language toggle is reliable in browser QA.
