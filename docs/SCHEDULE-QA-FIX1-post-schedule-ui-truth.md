# SCHEDULE-QA-FIX1 — Post-Schedule UI Truth Cleanup

## Context

SCHEDULE-SAFE1 verified that scheduling works at the lifecycle level:

- Exactly one Schedule All action was used.
- Posts moved from approved-only to scheduled-only.
- No content was published.
- No image generation, content generation, Autopilot activation, admin action, or credit spend occurred.
- The schedule result modal correctly stated that scheduling is not publishing.

## UI Truth Blockers

Post-schedule UI still had copy that described the scheduled-only state as if it were draft review, publishing, Autopilot, or image generation:

- Content Hub header could fall back to draft-review copy.
- The regenerate helper could say nothing was scheduled even after posts were scheduled.
- Campaign Room Autopilot queue could present manual scheduled posts as an Autopilot-like queue.
- Missing scheduled-post media could read as image auto-generating.
- Proof/status copy could say scheduled content was "scheduled to publish."

## What Changed

- Added scheduled-only Content Hub summary copy for `DRAFT = 0`, `APPROVED = 0`, `SCHEDULED > 0`, `PUBLISHED = 0`.
- Added scheduled-only helper copy that says scheduled posts are saved and regeneration creates a new draft plan only.
- Kept post cards lifecycle/media split: scheduled lifecycle remains separate from media pending.
- Made Campaign Room queue copy distinguish manual scheduled content from Autopilot when Autopilot is not enabled.
- Replaced "Image auto-generating" with media-pending wording unless a real image generation process is visible elsewhere.
- Tightened proof/status scheduled copy to "scheduled posts — not published."

## What Did Not Change

- No scheduling route behavior changed.
- No publishing route, cron, platform API, or Autopilot activation behavior changed.
- No generation, image generation, approval, scheduling, publishing, Autopilot, billing, credit, schema, dashboard, billing page, Creative Studio, or paid launch behavior changed.
- Existing saved `SocialPost` rows and `campaign.aiOutput` were not mutated.

## Next QA

After merge, run a read-only production check on the scheduled-only campaign:

- Content Hub should show scheduled-only header/helper copy.
- Cards should show scheduled lifecycle plus media pending when media is absent.
- Publish should remain locked/truth-safe and not imply anything is published.
- Autopilot should remain disabled/secondary and should not show image auto-generation.
- Performance should continue to show no published performance data until posts are actually published.
