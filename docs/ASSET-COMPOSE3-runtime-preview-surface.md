# ASSET-COMPOSE3 Runtime Preview Surface

## Decision

ASSET-COMPOSE3 adds a read-only draft composition preview inside the Campaign Creative tab.

The preview uses the helper-only contracts introduced by ASSET-COMPOSE1 and ASSET-COMPOSE2:

Brand Brain -> Strategy -> SocialPost -> CreativeRequirement -> CreativeTemplateSpec -> confirmed generated/uploaded background -> CreativeCompositionPlan -> CreativeCompositionPreview.

## Why Creative Tab

The Creative tab is the safest runtime surface for early composition review because it already explains creative requirements, media readiness, Creative Brief planning, and the future Studio boundary.

Content Hub remains the final post preview and post-linked media source of truth. Putting the first composition preview in Content Hub would risk making a review artifact look like attached post media.

## Candidate Selection

The preview candidate must have confirmed background media:

- `mediaSource=GENERATE` and `generationStatus=DONE`, or
- confirmed uploaded media.

An `imageUrl` with `PENDING`, `FAILED`, or missing generation/attachment proof is not enough. Those legacy or ambiguous previews remain excluded from the composition preview surface.

## Read-only Boundary

The runtime preview is classified as `draft_composition_preview`.

It is:

- review-only
- not final ad creative
- not attached to a SocialPost
- not uploaded
- not persisted
- not a Media row
- not a GeneratedVisual row
- not a Brand Brain learning update

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

The composition preview is not `SocialPost.imageUrl`. It does not update `SocialPost.mediaSource`, `SocialPost.uploadedMediaId`, `Media`, `GeneratedVisual`, or `campaign.aiOutput`.

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

- Creative tab shows a draft composition preview card when confirmed media exists.
- The candidate is a confirmed `DONE` generated/uploaded background, not a pending legacy preview.
- Copy says review-only and not final ad creative.
- Copy says not attached automatically.
- Content Hub remains the final media decision point.
- No attach/save/export/upload/generate/publish/schedule buttons appear in the preview card.
- Credits do not change.
- No mutation endpoints are called.
- Content Hub state remains unchanged.
- Console is clean.
- Mobile 390px has no horizontal overflow.
