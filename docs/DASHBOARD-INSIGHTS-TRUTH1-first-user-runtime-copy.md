# DASHBOARD-INSIGHTS-TRUTH1 — First-user runtime copy cleanup

## Why

The rule-based dashboard insights route can be one of the first surfaces a paid user sees after setup. Its copy must not imply that NEXUS has launched campaigns, activated a marketing engine, started paid execution, generated visuals, or learned performance patterns when the underlying state only says a workspace, Brand Brain, campaign, or visual count exists.

## Scope

This cleanup updates dashboard-facing operational copy in:

- `GET /api/analytics/insights`
- `buildMarketingIntelligenceBrief`
- `POST /api/dashboard/intelligence` suggestion classification for the first-strategy action

It does not change:

- dashboard page UI
- billing or credits
- campaign creation behavior
- agent suggestion persistence shape
- strategy/content/image generation
- approval, scheduling, publishing, manual publishing, Autopilot, paid launch, platform push, or engine behavior
- Brand Brain learning logic
- database schema or production data

## Runtime copy policy

- First-user nudges should say "create a campaign brief/workspace", not "launch a campaign".
- Fallback/system nudges should say NEXUS is available, not that a marketing engine is activated.
- Media nudges should say "review media needs before generation", not "generate now".
- Brand Brain nudges should say voice/signals/context are available or need setup, not that campaigns are already active or automatically learning.
- Legacy `/campaign/new` links should point to canonical `/campaigns/new`.
- `create-first-strategy` suggestions must classify as Strategist / Strategy work, not campaign launch work.
- Marketing intelligence summaries should say reviewed signals and analytics, not generic learning unless analytics-backed.
- Active campaign wording should avoid implying published/live/platform execution.

## Validation

- `npm run test -- src/app/api/analytics/__tests__/insightsTruthCopy.test.ts`
- `npm run test -- src/lib/__tests__/marketingIntelligenceTruthCopy.test.ts`
- scan runtime copy for launch/activation/generate-now regressions.
