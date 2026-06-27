# CONTENT-QA-FIX2 - Content Draft Superlative, Delivery, and Ensure Guard

## Context

Controlled CONTENT-QA-FIX1B production QA regenerated one content plan for campaign `cmqw8ayo60006eh64tu66em3b`.

The flow behaved correctly:

- The generation cost was shown before action.
- Exactly one regenerate action was run.
- The campaign stayed in draft/content-review state.
- Nothing was approved, scheduled, published, or activated.

The regenerated drafts still showed a few future-generation copy risks:

- Superlative/perfection wording such as `perfect blend`, `perfect brew`, and `finest coffee`.
- Absolute ensure wording such as `delivery service ensures...`.
- Awkward or unbounded delivery wording such as `promptly delivery where available` and doorstep delivery phrasing.
- Arabic superlatives and unbounded delivery wording such as `أفضل حبوب القهوة` and `لتصلك إلى باب منزلك`.

## What Changed

This PR hardens the content draft truth guard for future content-plan generations:

- English perfection and superlative claims are softened into grounded wording.
- Ensure, guarantees, makes-sure, always-stocked, and never-run-out phrasing is softened.
- Delivery claims are bounded to availability, supported zones, or location-dependent timing.
- Arabic superlatives, perfection wording, guarantee wording, always wording, and doorstep delivery phrasing are softened.
- The content-plan prompt policy now explicitly tells the model to avoid superlative, absolute, and unbounded delivery claims.

## Compatibility

The guard remains deterministic and recursive across generated draft fields, including captions, image prompts, video prompts, and nested variant objects.

## Intentionally Not Changed

This PR does not mutate existing saved data:

- No existing `SocialPost` rows are updated.
- No existing `campaign.aiOutput` is rewritten.
- No strategy, content plan, visual, creative brief, approval, scheduling, publishing, or Autopilot action is run.

This PR also does not touch:

- Billing, credits, deduction, refund, or Stripe behavior.
- Schema, migrations, or env.
- Publishing, scheduling, cron, platform APIs, or Autopilot APIs.
- Dashboard, billing page, Creative Studio, or paid launch.

## QA Notes

Existing saved drafts may still show old unsafe generated copy until a future regeneration runs through the updated guard. That is expected for this PR.

Recommended follow-up QA is one controlled content-plan regeneration on the same QA campaign after the PR is deployed, then inspect draft captions and prompts for the guarded phrases.
