# LEARNING-CONTRACT1 — Brand Brain Signal Vocabulary Cleanup

## Audit finding

Brand Brain copy mixed four different concepts: user approval signals, user preference signals, manual execution events, and analytics-backed performance learning. That made some approval/manual/variant flows sound like NEXUS had learned performance truth before any analytics existed.

## Vocabulary contract

- Approval/review actions are **signals**: approved content signal, user-approved signal, content preference signal, saved signal.
- Manual publish actions are **manual execution events**: user-confirmed manual publish, published status recorded by user.
- User A/B choices are **preferences**: user-selected variant, selected draft variant, editorial choice.
- Analytics-backed events are the only place for **learning/winning/performance evidence** language: analytics-backed learning, winning hook, top-performing angle, learned from performance.

## What changed

- Added a small `brandBrainLearningContract` helper so approval, manual publish, variant selection, analytics, and missing-analytics sources have explicit display labels and permissions for learning/winning language.
- Updated approval response copy from "Brand Brain learned" style wording to "Approval signals saved" and returned `signals` instead of `learned`.
- Updated user-selected variant copy from winner language to selected/preferred variant language while preserving legacy route and database field names.
- Updated the A/B rich Brand Brain proposal context to send `user_selected_variant`, `selectedVariant`, and `discardedVariant` vocabulary instead of winner/loser payload context. Legacy route and DB field names remain only as internal compatibility details.
- Updated Brand/Brain UI labels to describe saved signals and reviewed updates instead of implying NEXUS learned from approval-only actions.
- Softened paid metrics UI copy from automatic Brand Brain learning to paid metrics signals for review.

## What did not change

- No database fields were renamed.
- The `/pick-winner` route path and legacy `variantWinner` / `winningHooks` / `winningAngles` schema fields were not renamed.
- No schema or migration changed.
- Approval status transitions remain unchanged.
- Manual publish backend behavior remains unchanged.
- Schedule, publish, Autopilot, billing, credits, image generation, and paid launch APIs remain unchanged.
- Existing saved SocialPost rows and campaign output were not mutated.

## Next QA

Run read-only QA on the PR preview:

- `/brand`
- `/campaigns/cmqw8ayo60006eh64tu66em3b/content-hub`
- `/campaigns/cmqw8ayo60006eh64tu66em3b?tab=strategy`

Confirm approval/manual/variant surfaces say signals, preferences, or manual execution unless analytics-backed data exists. Do not click generation, approval, schedule, publish, manual publish, Autopilot, image generation, save, or connect-account actions.
