# STRATEGY-QUALITY-CONTRACT1 - Operational Depth Gate

## Problem

The strategy UI can look premium while the saved strategy JSON is still too soft to operate from. A strategy can satisfy the old rich-shape contract by returning enough fields, but still contain generic execution guidance such as:

- `Create content`
- `Build awareness`
- `Increase engagement`
- content angles without a real hook, CTA, platform, or funnel stage
- weekly plans that are not countable enough for Content Hub planning

That is not an AI marketing department. It is a formatted strategy summary.

## Product Truth

A saved campaign strategy must be an executable review brief:

- audience segments must include real pain, desired outcome, objection, message, platform, and CTA
- content angles must include hook, pain, format, platform, CTA, and funnel stage
- funnel stages must include user mindset, message, content type, platform, CTA, success metric, next step, and product area
- weekly execution plans must contain countable deliverables, not generic tasks

If the strategy is weak, the run should fail before the strategy becomes the basis for Content Hub, Creative, Calendar, Publish, or Paid planning.

## Implementation

- Extended `campaignStrategyContract` with operational-depth checks.
- The campaign engine already used the contract before saving engine strategy output.
- `/api/strategy/run-full` now also passes strategy output through the same contract inside `runFullAgency` before creating the campaign.
- If the contract fails, the existing run-full failure path returns failure and refunds the deducted credits.
- Strengthened the strategy prompts so Organic, Paid, and Full strategy outputs ask for countable weekly deliverables and executable segment/angle/funnel fields.

## Boundaries

This cleanup does not:

- generate strategy
- reset data
- mutate production campaigns
- change credit pricing
- change refund logic
- change schema
- change strategy page UI
- change Content Hub, publishing, scheduling, manual publish, Autopilot, paid launch, media, engine rebuild, billing, dashboard, or PR #164

## QA Focus

Next controlled generation QA should evaluate:

- whether weak/generic strategies fail instead of saving
- whether successful strategies contain countable weekly deliverables
- whether strategy sections are useful enough for a real marketer to execute
- whether Organic/Paid/Full scopes stay honest and planning-safe
