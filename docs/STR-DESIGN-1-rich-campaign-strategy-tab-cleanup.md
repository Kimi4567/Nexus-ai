# STR-DESIGN-1 — Rich Campaign Strategy Tab Cleanup

## Objective

Redesign the existing Campaign Strategy tab as the current canonical rich strategy output. This PR keeps the generated strategy content inside `/campaigns/[campaignId]?tab=strategy` and does not create a new strategy review route.

## Audit Summary

The Strategy tab is rendered in `src/app/campaigns/[id]/page.tsx` under `activeTab === 0`.

Before this cleanup, the tab mixed the rich strategy document with operator-style controls and dark dashboard panels:

- `StrategyBrief` summary component
- `StrategyActionCard` review/approval/content-plan control surface
- Brand Brain provenance/readiness cards
- Rich strategy fields for diagnosis, objective, message, positioning, audience, content, execution, metrics, readiness, assets, paid planning, risks, assumptions, and missing data
- Paid setup panel with internal naming and a regenerate path

Global Campaign Room controls above the tab still include engine/review/approval controls. They are outside this focused Strategy-tab body cleanup.

## Preserved Strategy Content

The cleaned tab preserves the rich generated strategy data when present:

- `diagnosis` and `diagnosisDetails`
- `businessObjective`
- `keyMessage`
- `positioning`
- `differentiation`
- `audienceSegmentsDetailed` and `audienceSegments`
- `valueProps`, `valuePropositions`, and `estimatedResults`
- `topHooks`
- `ctaVariations`
- `contentPillars`
- `contentAngles` and `contentAnglesDetailed`
- `funnelStages` and `funnelStrategy`
- `channelStrategy` and `channelMix`
- `offerCTAStrategy`
- `visualDirection`
- `weeklyExecutionPlan` and `weeklyPlan`
- `kpis`, `successMetricsDetailed`, and `successMetrics`
- `readinessChecklist` and `executionChecklist`
- `assetRequirements`
- `adSetupPlan`
- `riskNotes`
- `doNotDoYet`
- `executionAssumptions` and `assumptions`
- `missingData` and `confidenceReport`
- `competitorAnalysisComplete`

## Design Cleanup

The Strategy tab now reads as a client-ready marketing strategy brief:

- White and soft-gray surfaces replace the dark control-panel treatment in the Strategy tab body.
- A clear strategy header names the campaign, source, document type, last update, and next action.
- Strategy content is grouped into readable sections: Executive Strategy, Marketing Diagnosis, Business Objective, Audience Segments, Organic Content Plan, Execution Plan, KPIs & Metrics, Readiness & Paid Planning, and Risks / Assumptions / Missing Data.
- KPIs use conservative framing: hypotheses, baseline needed, and targets after real data.
- Paid planning is presented as planning-only, not as execution-ready.

## Safety Boundaries

No changes were made to:

- `RunFullStrategyModal`
- `/api/strategy/run-full`
- `/api/generate`
- `/api/campaigns/[id]/engine`
- credit deduction/refund logic
- strategy pricing
- auth, billing, schema, migrations, or env files
- publishing, cron, or platform APIs
- campaign creation logic
- content plan generation logic
- dashboard or billing pages
- other Campaign Room tabs

## Known Follow-Ups

- Global Campaign Room controls still include older operator/review/approval language outside the Strategy tab body.
- Other tabs still contain publishing/scheduling language because they belong to separate workflows and were intentionally left out of this PR.
- A later focused PR can clean Campaign Room global controls without changing generation or publishing behavior.
