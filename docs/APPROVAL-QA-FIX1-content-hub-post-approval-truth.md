# APPROVAL-QA-FIX1 — Content Hub Post-Approval Truth Cleanup

## Context

E2E-APPROVAL-QA1 confirmed the approval lifecycle worked correctly for campaign `cmqw8ayo60006eh64tu66em3b`:

- Credits stayed unchanged.
- One approval flow moved posts from `DRAFT` to `APPROVED`.
- No content regeneration, image generation, scheduling, publishing, Autopilot activation, admin action, or credit spend occurred.
- Publish, Autopilot, and Performance remained truth-safe.

The remaining blocker was UI truth drift in Content Hub after approval:

- The header still described approved posts as drafts to review.
- The regenerate helper still used draft-only disclosure without acknowledging saved approved posts.
- Individual cards showed a vague media `Pending` badge that could be confused with unapproved lifecycle state.

## Changes

- Content Hub now shows an approved-only header summary when there are no drafts and approved posts are waiting for scheduling.
- The approved-only helper copy explains that approved posts are saved, regeneration creates a new draft plan, and scheduling/publishing remain separate steps.
- Post cards now show lifecycle and media state separately:
  - `Approved, not scheduled` for post lifecycle.
  - `Media pending` for media/image generation status.

## What Did Not Change

- Approval route behavior remains `DRAFT` to `APPROVED`.
- Scheduling remains a separate explicit action.
- Publishing remains separate from scheduling.
- Autopilot remains separate and explicit.
- Content regeneration behavior is unchanged.
- No saved SocialPost rows or campaign output are mutated by this PR.
- No billing, credits, schema, dashboard, publishing, scheduling, cron, platform API, Creative Studio, paid launch, or image-generation behavior changed.

## QA Notes

Next QA should be read-only against the approved-only campaign state:

- Confirm the header no longer says drafts to review.
- Confirm status summary still shows approved posts.
- Confirm cards distinguish approved lifecycle from media pending state.
- Confirm Schedule and Regenerate CTAs are visible only as separate actions and are not clicked.
- Confirm Publish remains locked/truth-safe, Autopilot remains disabled/secondary, and Performance shows no published data.
