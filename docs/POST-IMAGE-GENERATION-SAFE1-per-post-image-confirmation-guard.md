# POST-IMAGE-GENERATION-SAFE1 — Per-post image confirmation guard

## Preflight finding

POST-IMAGE-GENERATION-PREFLIGHT1 found that one-post image generation was partially ready, but not approved for controlled QA. Content Hub showed a browser-native confirmation before spending 3 credits, but `/api/visuals/generate` could deduct `IMAGE_GENERATION` credits without a structured server-side confirmation payload.

Browser confirmation alone is not enough for credit-spending image generation. The server must reject stale or missing acknowledgement before credit deduction, external image providers, `GeneratedVisual` creation, or post media mutation.

## UI modal contract

Content Hub per-post image generation now opens an explicit modal before any backend call. The modal states:

- one post image will be generated for review
- cost is 3 credits
- failed generations are refunded when existing refund logic supports it
- nothing is published or scheduled
- manual/API publish state is not changed
- Brand Brain learning is not updated
- successful generation updates the selected post preview media

The final action is disabled until the user checks:

> I understand this costs 3 credits and will generate post media for review.

The final CTA is:

> Confirm image generation — 3 credits

The checkbox resets on open, close, and successful completion.

Campaign concept visual generation also requires an explicit confirmation before calling `/api/visuals/generate`. Concept visuals remain gallery/review assets only: they are not attached to posts automatically, not scheduled, not published, and not used in paid ads automatically.

## Server guard contract

`/api/visuals/generate` requires these fields before credit deduction:

```json
{
  "explicitImageGenerationConfirmed": true,
  "acknowledgedCreditCost": 3,
  "acknowledgedNoPublishOrSchedule": true,
  "acknowledgedPostMediaForReview": true
}
```

If confirmation is missing or stale, the route returns HTTP 400:

```json
{
  "error": "IMAGE_GENERATION_CONFIRMATION_REQUIRED",
  "message": "Image generation requires explicit confirmation. No credits were spent.",
  "required": {
    "explicitImageGenerationConfirmed": true,
    "acknowledgedCreditCost": 3,
    "acknowledgedNoPublishOrSchedule": true
  }
}
```

The guard runs before `checkAndDeductCredits`, image provider calls, and `GeneratedVisual` creation.

## Caller update contract

All runtime callers of `/api/visuals/generate` send the server-required confirmation fields only from explicit final confirmation flows:

- Content Hub per-post image generation
- Campaign concept visual generation / regeneration

No caller should call `/api/visuals/generate` directly from an initial button without a confirmation step.

## Expected one-image QA candidate

Future controlled QA should use:

- Campaign: `cmqw8ayo60006eh64tu66em3b`
- Post: `#2`
- Platform: Facebook
- State: scheduled, not published
- Media: media pending / no media

Post `#1` should be avoided because it is already manually published and has existing post media.

## Expected mutation map if later approved

After exactly one successful per-post image generation:

- `GeneratedVisual` is created and completed with a Cloudinary `imageUrl`
- selected `SocialPost.imageUrl` is updated to that generated URL
- selected `SocialPost.generationStatus` becomes `DONE`
- selected `SocialPost.mediaSource` remains/sets `GENERATE`
- selected `SocialPost.uploadedMediaId` remains `null`

The flow must not change:

- `SocialPost.status`
- `scheduledAt`
- `publishedAt`
- `manuallyPublishedAt`
- `publishMode`
- `platformUrl`
- `platformPostId`
- Brand Brain fields
- approval, schedule, publish, manual publish, Autopilot, paid launch, platform push, or engine state

## Post-generation Content Hub state

Expected visible state after a successful one-post generation:

- image progress increases from `0 / 8` to `1 / 8`
- generated post card shows media ready
- generated post card shows `Generated image`
- the post remains scheduled/not published
- Publish, manual publish, Autopilot, and paid/platform state remain unchanged

## Deferred notes

This PR does not add a direct `SocialPost -> GeneratedVisual` provenance relation. Source-of-truth remains:

- `GeneratedVisual` stores generated visual output
- `SocialPost.imageUrl` stores final post preview media URL
- `SocialPost.mediaSource = GENERATE` plus `generationStatus = DONE` labels generated post media

## QA plan

Read-only/modal-only QA:

1. Open production/preview Content Hub.
2. Confirm current campaign state remains 1 manually published, 7 scheduled-not-published, and 0/8 images before generation.
3. Click one per-post `Generate image — 3 credits` button only to open the modal.
4. Confirm no `/api/visuals/generate` request fires on modal open.
5. Confirm checkbox is unchecked and final CTA is disabled.
6. Toggle checkbox only if no backend request fires.
7. Confirm final CTA enables.
8. Close modal.
9. Confirm credits unchanged and no mutation occurred.

Controlled one-image QA remains a separate future approval and must generate exactly one image only if explicitly authorized.
