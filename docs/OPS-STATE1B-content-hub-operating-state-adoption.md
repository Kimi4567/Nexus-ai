# OPS-STATE1B Content Hub Operating State Adoption

## Scope

This PR makes Content Hub labels and summaries more truth-safe without changing behavior.

Touched surfaces:

- `/content-hub` campaign overview
- `/campaigns/[id]/content-hub` campaign content workspace
- focused source-level copy guard

## What Changed

- Replaced generation-only overview copy with media-specific labels.
- Replaced generic generation `DONE` labels in the campaign Content Hub with media-specific wording.
- Added a compact campaign-level operating-state summary using `deriveCampaignOperatingState()` from existing campaign and post data.
- Kept per-post status rendering separate from campaign-level operating state.
- Kept draft review, approval, scheduling, and published states separate.
- Renamed approved-only planned-date modal copy to planned content wording.
- Kept publishing-window wording only for schedule results.
- Replaced connection guidance that implied automatic publishing with safer scheduling preparation language.

## Behavior Unchanged

- No API changes.
- No schema or migration changes.
- No generation behavior changes.
- No approval behavior changes.
- No scheduling behavior changes.
- No publishing behavior changes.
- No billing, credits, pricing, dashboard, Creative Studio, Paid Campaigns, or RunFullStrategyModal changes.

## Compatibility Notes

- Existing i18n dictionary keys were intentionally left in place because this PR is scoped to Content Hub surfaces, not global translation cleanup.
- The campaign Content Hub uses localized inline labels only where existing dictionary keys were too generic for generation-only media state.
- Existing per-post display helpers remain the source for post status chips.

## Validation Plan

- `git diff --check -- touched files`
- focused Content Hub source guard
- existing operating-state and post-status tests
- `npm run type-check`
- `npm run build`
- scan Content Hub surfaces for unsafe copy

## Browser QA Notes

Confirm:

- `/content-hub` describes generated media without implying content approval.
- `/campaigns/{campaignId}/content-hub` shows media readiness separately from draft review, approval, scheduling, and publishing.
- Draft content still requires review.
- Approved content is not shown as scheduled until `SocialPost.status === 'SCHEDULED'`.
- Published content requires `SocialPost.status === 'PUBLISHED'`.
- No generation, scheduling, publishing, or credit-spending actions are triggered during QA.
