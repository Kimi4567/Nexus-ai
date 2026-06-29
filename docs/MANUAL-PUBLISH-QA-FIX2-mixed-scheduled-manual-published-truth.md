# MANUAL-PUBLISH-QA-FIX2 — Mixed Scheduled + Manually Published Truth

## Context

CONTROLLED-MANUAL-PUBLISH-QA1 confirmed exactly one scheduled post was marked manually published after explicit user acknowledgement.

Observed lifecycle:

- Before: `DRAFT = 0`, `APPROVED = 0`, `SCHEDULED = 8`, `PUBLISHED = 0`.
- Action: one user-confirmed manual publish, without a live URL.
- After: `DRAFT = 0`, `APPROVED = 0`, `SCHEDULED = 7`, `PUBLISHED = 1`.
- Credits stayed unchanged.
- No generation, image generation, scheduling, API/platform publish, Autopilot, admin, or credit action occurred.

## Blocker

After the manual publish, Content Hub fell back to draft-review copy:

- `8 drafts to review`
- `Creates draft posts for review only. Nothing is approved, scheduled, or published.`

That was false for the mixed state: seven posts remained scheduled and one post was manually published by the user.

## What Changed

- Content Hub now detects the mixed state where there are no draft/approved posts, at least one scheduled post, and at least one manually published post.
- Manual-published detection now requires explicit manual evidence: `manuallyPublishedAt`, or non-`AUTO` `publishMode` as a legacy/manual fallback.
- Missing `platformUrl` alone does not classify a post as manually published.
- The header now describes the mixed state instead of draft-review fallback.
- The explainer says the manual publish was user-confirmed and the remaining posts are scheduled in NEXUS only.
- The regenerate helper says scheduled and manually published posts are saved, and regeneration creates a new draft plan without changing current scheduled or manually published posts.
- Manually published cards without a live URL now show that the manual publish was user-confirmed and no live post URL was saved.

## What Did Not Change

- Manual publish backend route behavior did not change.
- Manual publish planner behavior did not change.
- Post status transitions did not change.
- Scheduling, approval, publishing, Autopilot, generation, image generation, credits, billing, schema, dashboard, billing page, Creative Studio, and paid launch behavior did not change.
- Existing `SocialPost` rows and `campaign.aiOutput` were not mutated by this PR.

## Next QA

After merge, run read-only production mixed-state QA:

- Confirm the header no longer says `8 drafts to review`.
- Confirm it shows one manually published post plus seven scheduled posts not published.
- Confirm regenerate copy does not say nothing is scheduled or published.
- Confirm the manually published card does not imply platform/API proof when no live URL exists.
- Confirm Publish, Autopilot, and Performance remain truth-safe.
