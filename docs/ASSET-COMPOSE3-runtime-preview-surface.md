# ASSET-COMPOSE3 Composition Plan Surface

## Decision

ASSET-COMPOSE3 adds a read-only Composition Plan card inside the Campaign Creative tab.

The plan uses the helper-only contracts introduced by ASSET-COMPOSE1 and ASSET-COMPOSE2:

Brand Brain -> Strategy -> SocialPost -> CreativeRequirement -> CreativeTemplateSpec -> confirmed generated/uploaded background -> CreativeCompositionPlan -> CreativeCompositionPreview.

The runtime surface intentionally does not present the SVG artifact as a finished or near-finished ad preview. Until a professional compositor/editor exists, the user-facing experience is a structured layout blueprint for review.

## Why Creative Tab

The Creative tab is the safest runtime surface for early composition review because it already explains creative requirements, media readiness, Creative Brief planning, and the future Studio boundary.

Content Hub remains the final post preview and post-linked media source of truth. Putting the first composition plan in Content Hub would risk making a review artifact look like attached post media.

## Candidate Selection

The composition-plan candidate must have confirmed background media:

- `mediaSource=GENERATE` and `generationStatus=DONE`, or
- confirmed uploaded media.

An `imageUrl` with `PENDING`, `FAILED`, or missing generation/attachment proof is not enough. Those legacy or ambiguous previews remain excluded from the composition plan surface.

## Read-only Boundary

The runtime plan is classified as `draft_composition_plan`.

It is:

- review-only
- not final ad creative
- not a rendered ad
- not attached to a SocialPost
- not exported
- not uploaded
- not persisted
- not a Media row
- not a GeneratedVisual row
- not a Brand Brain learning update

## Runtime Presentation

The runtime card shows layer metadata instead of a large ad-like SVG:

- selected post
- platform/template
- background source
- headline layer
- CTA layer
- brand layer
- safe-zone status
- output classification

The card copy says:

- Composition plan / layout blueprint
- review-only
- not final creative
- not rendered/exported
- not attached to the post
- future Creative Studio will handle editable layers later

If a future visual guide is shown, it must be small, labeled as a layout guide, and must not look like a final creative preview.

## No Execution Actions

ASSET-COMPOSE3 does not add:

- attach to post
- save preview
- export
- upload
- publish
- schedule
- generate
- regenerate
- paid launch
- platform push

Any future attach/export/save path must be explicit and separate.

## Content Hub Source of Truth

Content Hub remains the source of truth for final post copy, lifecycle status, and post-linked media.

The composition plan is not `SocialPost.imageUrl`. It does not update `SocialPost.mediaSource`, `SocialPost.uploadedMediaId`, `Media`, `GeneratedVisual`, or `campaign.aiOutput`.

## Future Path

Future work can add:

- ASSET-COMPOSE4 or CREATIVE-STUDIO1 context-first Studio shell
- editable layer controls
- preview export/render pipeline
- explicit Content Hub attach flow
- Brand creative asset inputs

Those are intentionally out of scope for ASSET-COMPOSE3.

## QA Plan

Browser QA should verify:

- Creative tab shows a Composition Plan / Layout Blueprint card when confirmed media exists.
- The candidate is a confirmed `DONE` generated/uploaded background, not a pending legacy preview.
- Copy says review-only and not final creative.
- Copy says the plan is not rendered/exported.
- Copy says not attached automatically.
- Layer summary is readable.
- Content Hub remains the final media decision point.
- No attach/save/export/upload/generate/publish/schedule buttons appear in the plan card.
- Credits do not change.
- No mutation endpoints are called.
- Content Hub state remains unchanged.
- Console is clean.
- Mobile 390px has no horizontal overflow.
