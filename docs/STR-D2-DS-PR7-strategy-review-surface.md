# STR-D2 / DS-PR7 Strategy Review Surface

## Objective

Create a dedicated read-only strategy review surface so users can understand a generated strategy as a professional marketing brief before moving to content planning.

Revision note: PR #133 was merged before the product-review revision note was received. This follow-up revision keeps the same STR-D2 / DS-PR7 scope and turns `/strategy/[campaignId]` into the richer strategy review surface requested by product review.

## Route Approach

- Added `/strategy/[campaignId]`.
- Kept `/strategy` as the create/update workstation from DS-PR6.
- Updated `/strategy` so draft and existing strategies link to the dedicated review route when a campaign id is available.

## Data Source

- Reads existing campaign data from `GET /api/campaigns/[campaignId]`.
- Uses `campaign.aiOutput.strategy` when present, otherwise falls back to existing top-level `aiOutput` fields.
- Uses existing campaign fields such as name, status, goal, audience, platforms, and updated timestamp.
- Mirrors safe display patterns already used by existing campaign document surfaces, including structured `diagnosisDetails`, `businessObjective`, `audienceSegmentsDetailed`, `weeklyExecutionPlan`, `readinessChecklist`, and KPI-like strategy fields.

## Missing Data Handling

Missing strategy fields render honest limited states such as:

- “Not included in this strategy draft”
- “No paid plan generated yet”
- “Analytics not connected”
- “Automatic publishing is not enabled”
- “Baseline needed”
- “Target to define after first 30 days”

## Safety Boundaries

- No strategy generation changes.
- No `/api/strategy/run-full` changes.
- No credit, billing, auth, campaign creation, publishing, cron, platform, schema, migration, or environment changes.
- No `RunFullStrategyModal` changes.
- No persisted approval system was added.
- No campaign detail redesign was included.
- No strategy, campaign, credit, billing, publishing, auth, API, schema, migration, cron, or environment behavior was changed.

## Review Sections

- Strategy header, source, status, updated timestamp, and review actions
- Strategy readiness summary with conservative capability language
- Executive direction
- Marketing diagnosis
- Business objective
- Core strategy: key message, positioning, differentiation, 90-day direction, first 30 days
- Audience segments with pain, want, objection, message, and preferred platform when present
- Organic content plan with platform mix, content pillars, value propositions, hooks, CTAs, and content angles
- Paid planning as planning-only
- Execution plan with channel mix, funnel stages, and 4-week plan when present
- KPIs / metrics presented as hypotheses when baseline data is missing
- Readiness checklist, missing items, risks, and compliance notes
- Next action into Content Hub

## Follow-Ups

- Add a persisted strategy review state only after the product model supports it.
- Add a first-class strategy detail API if the campaign list endpoint becomes too broad for this route.
- Re-test Arabic locale switching once the app-level language toggle is reliable in browser QA.
- Consider moving shared strategy field extraction into a helper before future Campaign Room cleanup work.
