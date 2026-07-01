# CONTENT-HUB-FINAL-PREVIEW2 — Media Decision + Credit Action Safety

## Audit Finding

CONTENT-HUB-FINAL-PREVIEW2-AUDIT1 found that Content Hub was truth-safe for lifecycle and media status, but not yet safe enough as the final post preview and media decision surface.

Observed production state:

- 1 user-confirmed manually published post.
- 7 scheduled posts saved in NEXUS and not published.
- 8 image slots with 0/8 generated images.
- Media pending was correctly separated from scheduled/published lifecycle state.

Remaining risks:

- Bulk image generation was visible as `Generate Images 8` without total cost or explicit confirmation.
- Rewrite spent 1 credit, but the visible card action did not show the cost before opening.
- Existing-media assignment used the ambiguous `Img` label.
- Content Hub itself needed a stronger final-preview and media-decision contract.
- Regenerating a progressed campaign needed an explicit confirmation step before spending credits.

## Content Hub Contract

Content Hub is the source of truth for final NEXUS post previews, post copy, lifecycle state, and media linked to each SocialPost.

The page must not imply:

- Scheduled posts are published.
- Media-pending posts are visually final.
- Manual publish is platform/API proof.
- Media decisions publish, schedule, activate Autopilot, or update analytics.

## What Changed

- Added a top-level Content Hub banner: final post preview plus media decisions.
- Clarified that platform rendering may differ and media-pending posts are not visually final.
- Reframed bulk image generation as a costed action: `Generate N post images — X credits total`.
- Added a bulk image generation confirmation modal with:
  - image count,
  - total credit cost,
  - no publish/schedule/manual/API state change copy,
  - checkbox acknowledgement,
  - disabled final confirmation until acknowledged.
- Added a server-side bulk image generation confirmation guard before any credit deduction.
- Preserved the existing image route batch limit by sending exact confirmed batches while showing the user the total pending-image cost before starting.
- Reframed rewrite as `Rewrite copy — 1 credit`.
- Added a rewrite confirmation modal with:
  - 1-credit cost,
  - post-copy-only scope,
  - no publish/schedule/media/Brand Brain learning copy,
  - checkbox acknowledgement,
  - disabled final confirmation until acknowledged.
- Added a server-side rewrite confirmation guard before any credit deduction.
- Renamed per-post image generation to `Generate image — 3 credits`.
- Renamed existing-media assignment to `Choose existing media`.
- Added a regeneration confirmation modal for progressed plans with:
  - 2-credit cost,
  - creates a new draft plan only,
  - preserves scheduled and manually published posts,
  - no publish/schedule/Autopilot copy.
- Preserved the manual publish checkbox flow and backend behavior.

## What Did Not Change

- Credit costs did not change.
- Credit deduction/refund logic did not change.
- Existing SocialPost rows were not mutated by this PR.
- Existing campaign.aiOutput was not mutated by this PR.
- Approval, schedule, publish, manual publish, Autopilot, paid launch, platform push, image provider, and engine behavior were not changed.
- PR #164 remains parked and untouched.

## Server Guard Contract

Bulk image generation must include:

- `explicitBulkImageGenerationConfirmed === true`
- `acknowledgedImageCount === expected pending image count`
- `acknowledgedCreditCost === expected count * IMAGE_GENERATION cost`

Rewrite must include:

- `explicitRewriteConfirmed === true`
- `acknowledgedCreditCost === AI_POST_REWRITE cost`

If confirmation is missing or stale, the route returns `400` with `No credits were spent` before credit deduction.

## QA Plan

Read-only / modal-only browser QA:

- Open Content Hub.
- Confirm the final-preview banner is visible.
- Confirm mixed state remains 1 manually published and 7 scheduled, not published.
- Open bulk image confirmation modal only; do not confirm.
- Confirm checkbox starts unchecked and final button is disabled.
- Open rewrite confirmation modal only; do not confirm.
- Confirm rewrite cost is visible and final button is disabled.
- Open regeneration confirmation modal only; do not confirm.
- Confirm cost and preservation copy.
- Confirm per-post labels: `Generate image — 3 credits` and `Choose existing media`.
- Confirm no generation, rewrite, regeneration, media attach, publish, manual publish, schedule, Autopilot, paid launch, platform push, or credit mutation occurs.

Validation:

- `npm run test -- src/lib/__tests__/contentHubActionSafety.test.ts`
- `npm run test -- src/app/api/campaigns/[id]/generate-content-plan/generate/__tests__/route.test.ts src/app/api/campaigns/[id]/content-plan/[postId]/rewrite/__tests__/route.test.ts`
- `npm run type-check`
- `npm run build`
