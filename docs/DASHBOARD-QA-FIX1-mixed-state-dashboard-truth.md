# DASHBOARD-QA-FIX1 - Mixed-State Dashboard Truth

## Context

After one user-confirmed manual publish, the campaign `cmqw8ayo60006eh64tu66em3b` is expected to be:

- DRAFT: 0
- APPROVED: 0
- SCHEDULED: 7
- PUBLISHED: 1
- One post was marked manually published by the user.
- No live URL was saved.
- No connected publishing account or platform/API publish occurred.
- No analytics data exists yet.

Content Hub, Publish, Autopilot, and Performance had already been cleaned up for this state. The Dashboard still had drift.

## Audit Findings

The Dashboard showed several stale or ambiguous signals:

- Recent Campaigns used `Campaign.status`, so the current campaign still appeared as Draft / مسودة.
- Marketing Operating Brief said `1 published - 7 scheduled`, which did not distinguish user-confirmed manual publish from platform/API publish.
- Learning evidence showed Active / نشط based on Brand Brain memory fields, not analytics data.
- The Marketing Workflow Learning tile was checked even though no performance analytics existed.
- AI Suggestions could still show stale `Strategy ready` / Approve cards for a campaign that had already progressed into scheduled/manual-published execution.

## Changes

- Added a small dashboard truth helper for post lifecycle summaries.
- Added post lifecycle summaries to campaign list responses used by Dashboard Recent Campaigns.
- Recent Campaigns now prefers SocialPost lifecycle truth over raw `Campaign.status`.
- Mixed state displays as `1 manually published - 7 scheduled` / `1 منشور تم تأكيد نشره يدويًا - 7 مجدولة`.
- Marketing Operating Brief execution copy now distinguishes manual publish from platform/API publish.
- A user-provided live URL remains manual-publish proof/reference only; `platformUrl` alone is not platform/API publish evidence.
- Learning evidence now stays `Analytics pending` / `التحليلات قيد الانتظار` until analytics data exists.
- The Marketing Workflow Learning loop is no longer complete from Brand Brain memory alone.
- Pending dashboard suggestions are filtered so progressed campaigns do not show stale strategy/content approval actions.

## Unchanged

- No SocialPost rows are changed.
- No campaign output is changed.
- No manual publish route or planner behavior is changed.
- No scheduling, approval, publish, Autopilot, credit, billing, schema, image generation, or analytics ingestion behavior is changed.
- Existing saved dashboard data is not backfilled or mutated.

## Next QA

Run read-only Dashboard truth QA on the PR preview:

- Confirm Recent Campaigns no longer shows this campaign as Draft / مسودة.
- Confirm Recent Campaigns shows manual/scheduled truth.
- Confirm Marketing Operating Brief does not imply platform/API publish.
- Confirm Learning evidence is analytics-pending, not Active.
- Confirm the Learning workflow tile does not imply performance learning.
- Confirm stale `Strategy ready` / Approve suggestions are hidden or no longer actionable for the progressed campaign.
- Confirm Content Hub and Performance remain truth-safe.
