# CAMPAIGN-ROOM-IA2-SAFE1 — Dangerous Action Isolation + Engine Rebuild Guard

## Incident summary

During CAMPAIGN-ROOM-IA2 audit, a read-only browser interaction accidentally triggered the Campaign Room engine rebuild path for campaign `cmqw8ayo60006eh64tu66em3b`.

Observed effects:

- `RUN_FULL_STRATEGY` credit transaction spent 8 credits.
- `campaign.aiOutput` was overwritten by a forced engine run.
- `AgentRun.inputData.force` was `true`.
- Existing `SocialPost` rows were not changed.
- No approval, schedule, publish, manual publish, Autopilot, paid launch, platform push, image generation, admin action, refund, or rollback occurred.

The product risk was the tiny global Campaign Room rebuild control. It sat beside read-only navigation/status UI, had a broad “regenerate all outputs” affordance, and could call `/api/campaigns/[id]/engine` with `force: true`.

## Product rule

Credit-spending rebuild actions must never be:

- icon-only
- tiny header controls
- adjacent to read-only tabs, progress UI, or status cards
- executable without explicit cost and overwrite acknowledgement
- available for campaigns that already have approved, scheduled, or published posts

## UI guard

The global header `↻` rebuild button was removed.

The rebuild path is isolated under the overflow menu as a dangerous action. For early campaigns, the action opens an explicit confirmation modal that says:

- it costs 8 credits
- it overwrites campaign strategy/package output
- old output is not automatically restored
- it does not publish
- it does not schedule
- it does not update existing `SocialPost` rows

The final action is disabled until the acknowledgement checkbox is checked.

For progressed campaigns, the rebuild action is locked with this product truth:

> Rebuild is locked because this campaign already has approved, scheduled, or published posts. Create a new draft plan flow is required before regenerating campaign outputs.

## Server guard

`POST /api/campaigns/[id]/engine` now treats `force: true` as a dangerous rebuild request.

Before credit deduction, forced rebuilds must include:

- `explicitEngineRebuildConfirmed: true`
- `acknowledgedCreditCost: 8`
- `acknowledgedOutputOverwrite: true`

If those fields are missing, the route returns `400`:

> Engine rebuild requires explicit confirmation. No credits were spent.

## Progressed-campaign guard

Before credit deduction, forced rebuilds are blocked when the campaign has any `SocialPost` in:

- `APPROVED`
- `SCHEDULED`
- `PUBLISHED`

The route returns `409`:

> Campaign package rebuild is locked because this campaign already has approved, scheduled, or published posts. Create a new draft plan instead.

## What changed

- Added `src/lib/campaignDangerActions.ts` for deterministic rebuild availability and confirmation checks.
- Removed the tiny Campaign Room global rebuild icon.
- Added a labeled dangerous action path and explicit modal for early campaigns.
- Added server-side confirmation and progressed-post guards before credit deduction.
- Added focused helper tests and engine route tests.

## What did not change

- No credit cost changed.
- No refund/admin action was added.
- No campaign output rollback was added.
- No SocialPost rows are mutated by this PR.
- No approval, schedule, publish, manual publish, Autopilot, paid launch, platform push, image generation, schema, billing, dashboard, or PR #164 behavior changed.

## QA plan

Read-only browser QA only:

- Confirm Campaign Room header no longer has the tiny `↻` action.
- Confirm “Regenerate all outputs from scratch” is not present near tabs/progress.
- Confirm mixed scheduled/published campaigns cannot trigger rebuild as a credit action.
- Confirm any visible rebuild notice is locked because approved/scheduled/published posts exist.
- Confirm no `/engine` request is sent during read-only QA.
- Confirm credits are unchanged.
- Confirm console is clean.
- Confirm mobile 390px has no horizontal overflow if practical.
