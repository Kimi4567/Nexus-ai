# CONTENT-PLAN-STRUCTURED-RENDERER — Save Gate

## Problem

Repeated healthcare SaaS content-plan QA showed that phrase-by-phrase cleanup is not enough. The model can keep inventing new ways to imply clinic efficiency, patient satisfaction, medical-care quality, guaranteed outcomes, or broad transformation.

Observed unsafe examples included:

- "تحسين كفاءة العمليات"
- "توفير وقتك"
- "تحسين الخدمة"
- "رضاهم وثقتهم"
- broken Arabic such as "يساعد على من كفاءة العمل"

These are not just wording bugs. They show that final captions were being written directly by the model and then saved to `SocialPost` rows after a replacement guard.

## Boundary

This PR does not mutate existing `SocialPost` rows, `campaign.aiOutput`, media, credits, approval, scheduling, publishing, image generation, Autopilot, paid launch, or engine behavior.

It changes only the future content-plan save path.

## New Contract

For high-risk clinic / healthcare SaaS content:

1. The model output is treated as draft intent, not final user-facing copy.
2. The saved caption is rendered through a deterministic operational template.
3. The template uses administrative workflow language only.
4. Patient outcomes, satisfaction, care-quality, efficiency, time-saving, success, and guarantee claims are not saved unless future verified-proof logic explicitly supports them.
5. A save gate validates captions, image prompts, and video prompts before any `SocialPost` rows are created.

## Draft Preservation

Existing draft posts are deleted only after the new plan has generated and passed the save gate. If generation or validation fails, the current review plan is not wiped.

## Failure Behavior

If the save gate finds unsafe copy:

- the content-plan charge is refunded when applicable;
- no new `SocialPost` rows are created;
- the route returns a clear failure with `reason: unsafe_content_plan_draft`.

## A/B Variant Boundary

B variants remain optional. If generated B variants fail the same save gate, they are skipped instead of being saved.

## Future Direction

This is the bridge toward a fuller structured content system:

- model generates `content_intent`;
- system renders platform/language/industry-safe captions;
- only validated drafts can be saved;
- approval, scheduling, publishing, media generation, and Brand Brain learning remain separate explicit steps.
