# STRATEGY-OS-1 — Strategy Brief Readiness Gate

## Why this exists

Brand Brain can be complete enough for everyday organic strategy while still being too early for paid planning. The Strategy entrypoint now checks the selected strategy mode before generation, so NEXUS does not silently fill missing paid assumptions.

Onboarding remains light. The deeper agency-style checks happen at the Strategy Brief gate, where the user is already choosing Organic, Paid, or Full strategy.

## Mode split

- Organic only: allowed when the core brand, offer, audience, goal, platform, and tone/language fields exist. Organic-only never includes paid scope.
- Paid only: requires explicit paid-planning inputs such as budget, conversion destination, lead handling, audience/location, offer, and target platforms.
- Full strategy: requires both the organic brief and paid brief. If organic is ready but paid is incomplete, the user should switch to Organic-only or complete paid inputs. If both briefs are ready, Full can include organic strategy plus paid planning only.

## Paid boundary

Paid planning is allowed only as planning. This PR does not authorize ad launch, budget spend, publishing, connected-account readiness, Autopilot activation, or platform execution.

Paid launch/spend remains outside strategy generation unless future work verifies:

- budget approval
- tracking/pixel readiness
- platform readiness
- explicit launch approval

Missing launch readiness is a warning and downstream gate, not a paid-planning generation blocker. Paid planning can still be generated when the paid brief itself is present.

## Budget handling

No internal default budget should be treated as user-provided. If Brand Brain has no marketing budget, NEXUS must say budget is not provided and ask for budget confirmation before paid planning or launch-specific recommendations.

## Verified proof

Missing verified proof does not block organic strategy. It adds a warning: strategy and content must avoid proof-based claims such as testimonials, awards, reviews, case studies, or customer stories unless the user provides them.

## What changed

- Added a pure mode-aware Strategy Brief readiness helper.
- Added client-side readiness disclosure in `RunFullStrategyModal`.
- Added server-side readiness guard before credit deduction in `/api/strategy/run-full`.
- Removed the old route-level default budget from the generated strategy brief.
- Reinforced strategist prompt policy around strategy mode, paid planning, budget, tracking, and platform readiness.

## What did not change

- No generation, publishing, scheduling, manual publish, image generation, Autopilot, billing, credit deduction/refund, schema, migration, dashboard, or paid launch API behavior was changed.
- Existing Brand Brain save behavior was not changed.
- Existing saved campaign output and SocialPost rows were not mutated.

## Next QA

Read-only modal QA should check `/strategy`:

- Organic-only shows organic readiness and proof warning when proof is missing.
- Paid-only shows missing paid inputs when budget/conversion/lead handling/location are missing.
- Full strategy blocks or clearly explains incomplete paid inputs.
- No `5000` default budget appears.
- No launch, spend, active campaign, guaranteed result, or connected-platform readiness copy appears.
