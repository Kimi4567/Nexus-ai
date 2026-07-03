# STRATEGY-QUALITY2 — Exact post-count strategy scope

## Why

Strategy generation already supports Organic / Paid / Full modes, 30 / 90 / 180 / custom horizons, and content-intensity presets. The missing operational control was an exact organic post-direction count for users who know the desired first-month workload.

Without this control, a user who wants a concrete plan for 7 posts has to translate that into a vague intensity range. That weakens trust and makes QA harder because the strategy output cannot be judged against a clear count.

## Product contract

- Strategy generation remains a review artifact.
- The exact count applies only to organic/full strategies.
- Paid-only strategy ignores organic post count because it generates a paid planning brief, not organic post directions.
- The count is limited to 1–30 because this run only details the first execution window.
- The count controls `contentAnglesDetailed` and countable `weeklyExecutionPlan.deliverables`.
- Content Hub posts, SocialPost rows, captions, schedules, and publishing remain separate later steps.
- No strategy generation, content generation, publishing, scheduling, media attach, paid launch, platform push, or data mutation happens from this contract change.

## Pricing contract

Exact post count derives the same tier used by the existing pricing matrix:

- 1–10 directions → Light
- 11–16 directions → Standard
- 17–25 directions → Growth
- 26–30 directions → Daily

The backend recomputes the tier and cost from the submitted order. Client-provided price fields are ignored.

## Runtime copy

The modal now shows an optional exact-post-count control for Organic and Full modes:

- EN: `Use an exact post count`
- AR: `استخدم عدد منشورات محدد`

When enabled, the review screen describes the deliverable as exact post directions for the first 30 days. Paid-only mode does not show the control and uses planning-depth copy instead of organic post-count ranges.

## Guardrails

- Custom post count > 30 returns `UNSUPPORTED_POST_COUNT` before orchestration or credit deduction.
- Custom horizon > 180 remains `UNSUPPORTED_DURATION`.
- Prompt scope says the count is fixed by the order and must not be decided by the model.
- The model is instructed to return exactly the selected count of `contentAnglesDetailed` entries and distribute exactly that many countable post directions across the first detailed window.

## Validation focus

- Exact count normalization.
- Exact count pricing tier.
- Exact count deliverables.
- Backend recomputation before credit deduction.
- Prompt binding for exact content count.
- Existing 30 / 90 / 180 / custom-duration behavior stays intact.
