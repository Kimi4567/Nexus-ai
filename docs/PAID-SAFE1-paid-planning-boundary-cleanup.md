# PAID-SAFE1 Paid Planning Boundary Cleanup

## Context

PAID-SAFE1-AUDIT1 found that the newer Strategy surfaces correctly frame paid work as planning-only, but older paid execution surfaces could still imply launch readiness, active status, approved spend, or analytics-backed Brand Brain learning before those states were proven.

## Paid Lifecycle Contract

Paid work must move through explicit proof states:

1. `PAID_DRAFT_PLAN`
2. `PAID_BRIEF_COMPLETE`
3. `BUDGET_CONFIRMED`
4. `TRACKING_READY`
5. `CREATIVE_READY`
6. `PLATFORM_READY`
7. `READY_FOR_EXTERNAL_LAUNCH_REVIEW`
8. `EXTERNAL_LAUNCH_RECORDED`
9. `METRICS_RECORDED`
10. `METRICS_REVIEWED`
11. `ANALYTICS_BACKED_LEARNING`

Until those proof states exist, the UI should use planning-safe language: paid planning, planning-only, budget not confirmed, tracking not ready, platform not ads-ready, external launch not recorded, paused platform draft, or manual metrics signal pending review.

## What Changed

- Paid pack setup/upsert no longer accepts launch, active, completed, live, or ready-to-launch status from the client.
- Manual paid metrics no longer mark a paid pack launched or completed by themselves.
- External launch recording now requires explicit acknowledgement that the user launched outside NEXUS.
- Manual paid metrics can create a paid metrics signal for review, but do not automatically update Brand Brain as analytics-backed learning.
- Paid planning generation now frames default/fallback budgets as planning assumptions, not confirmed spend.
- Meta API creation keeps platform objects paused and maps the local campaign to a non-active state.
- Paused platform draft creation is still an external platform mutation, so it now requires explicit platform-draft confirmation and explicit budget confirmation before any API draft objects are created.
- A positive saved budget value alone is not budget approval for external platform creation.
- A budget value can exist without budget approval; `budget_value_present_unconfirmed` means planning value only, while `explicit_budget_confirmed` requires explicit acknowledgement.
- Paid Campaigns list/new/detail UI now uses setup-review, planning assumption, paused draft, and review-needed language instead of launch-ready language.

Creating paused platform drafts still does not launch ads, activate a campaign, or spend budget. It only creates paused objects for platform-side review after the user confirms budget, tracking, creative, and platform readiness have been reviewed.

The paid Ad Manager confirmation modal uses two separate acknowledgements before calling the platform draft route:

1. The user confirms NEXUS should create paused platform draft objects only and understands this does not launch ads or spend budget.
2. The user confirms budget, tracking, creative, and platform readiness have been reviewed for this draft creation.

Planning prompts must treat unconfirmed budget values as planning inputs only. They must not present a positive budget amount as approved spend unless the explicit budget confirmation gate has been satisfied.

## What Did Not Change

- No schema or migration changes.
- No credit deduction/refund behavior changes.
- No generation endpoint behavior was invoked during implementation.
- No publishing, scheduling, manual publish, Autopilot, image generation, dashboard, or billing behavior changed.
- Existing saved SocialPost rows, campaign output, paid campaign rows, and paid pack rows were not mutated.

## Remaining Deferred Work

- A future `PAID-METRICS1` should separate reviewed manual metrics from platform/API analytics in the data model more explicitly.
- A future `PLATFORM-CAP1` should add a full ads-readiness capability matrix for ad accounts, page permissions, pixel/tracking, app review, creative readiness, and budget approval.
- Schema-level paid lifecycle states can be added later if product policy needs more precise statuses than the current enums allow.

## QA Notes

Browser QA should be read-only until this PR is approved. Do not click generate, external launch, platform draft creation, metrics save, metrics signal extraction, connect account, publish, schedule, approval, Autopilot, or image generation actions.
