# ASSET-COMPOSE2 — Server-side Template Composition Preview Helper

## Audit Finding

ASSET-COMPOSE1 introduced a deterministic `CreativeCompositionPlan` that maps a generated or uploaded background, a `CreativeTemplateSpec`, a `CreativeRequirement`, Brand Brain inputs, and editable headline/CTA/logo layers into a review-safe plan.

The remaining gap was a contract-driven preview bridge. Existing `brandComposite` infrastructure can render a hardcoded flat branded raster, but it does not preserve editable layer metadata and does not consume the new template/layer contract.

## Why This Comes Before Studio

ASSET-COMPOSE2 adds the small server-side foundation that a future Studio can use. It does not build Creative Studio, does not add runtime UI, and does not create a persistence model.

The product path remains:

Brand Brain -> Strategy -> SocialPost -> CreativeRequirement -> CreativeTemplateSpec -> generated or uploaded background asset -> CreativeCompositionPlan -> draft composition preview -> future Studio/review -> future explicit attach in Content Hub.

## Preview Contract

`deriveCreativeCompositionPreview(input)` turns an existing `CreativeCompositionPlan` into a `CreativeCompositionPreview`.

The preview includes:

- `outputClassification: "draft_composition_preview"`
- `reviewStatus: "preview_for_review"`
- canvas width, height, and aspect ratio
- a transient SVG artifact
- layer metadata for background, headline, subheading, CTA, logo or brand-name fallback, and accent layers
- validation results
- attach policy requiring a future explicit Content Hub action
- safety flags confirming no publish, schedule, Brand Brain learning, paid launch, or SocialPost mutation

## SVG / Transient Artifact Contract

The preview artifact is:

- `type: "svg_string"`
- `mimeType: "image/svg+xml"`
- `persisted: false`
- `uploaded: false`

The helper builds the SVG string deterministically. It does not fetch external image URLs, logo URLs, or fonts. Background and logo URLs are included as escaped SVG `href` values only.

The artifact is for future preview use and tests. It is not final ad creative, not platform-ready creative, and not post media.

## Editable Layer Preservation

The preview preserves layer metadata separately from the SVG string:

- original layer id
- role
- type
- editable flag
- required flag
- content and content source
- normalized render box
- safe-zone compliance
- validation messages

Headline, CTA, and Arabic text remain editable/composited layer content. They are not treated as AI-rendered text inside the background image.

## No Upload / No Attach / No Persistence

ASSET-COMPOSE2 does not:

- upload SVG or raster previews
- save previews to `Media`
- save previews to `GeneratedVisual`
- update `SocialPost.imageUrl`
- update `SocialPost.mediaSource`
- attach, replace, remove, or delete media
- call AI
- spend credits
- mutate campaign output

## Content Hub Source-of-Truth Boundary

Content Hub remains the final post preview and post-linked media decision surface.

The composition preview is a review artifact only. A future explicit attach flow in Content Hub must still be required before a composed asset can become post media.

## Relationship To CreativeCompositionPlan

`CreativeCompositionPlan` remains the planning object.

`CreativeCompositionPreview` is derived from that plan and adds a transient SVG preview artifact plus preview-specific validations. The preview never changes the original plan and never mutates product state.

## Relationship To CreativeTemplate

The helper uses the resolved plan layers produced from `CreativeTemplateSpec`. It respects template dimensions, aspect ratio, layer positions, and safe-zone compliance already carried by the plan.

Future template work can improve typography, responsive text wrapping, and platform-specific preview rules without changing the storage boundary.

## Relationship To brandComposite

`brandComposite` remains a legacy/hardcoded compositor reference.

It is useful proof that Sharp/SVG and Arabic text rendering can work server-side, but ASSET-COMPOSE2 intentionally does not modify or depend on it. The new helper is contract-driven and layer-preserving.

Future ASSET-COMPOSE3 or Creative Studio work can decide whether to use Sharp, Satori, or another rendering pipeline for production-quality rendering.

## Post #3 Background Use Case

Post #3 can follow the intended path:

1. generated background draft exists for review
2. LinkedIn landscape template is selected
3. headline, CTA, logo or brand-name fallback, and safe-zone metadata are derived from the composition plan
4. server-side helper creates a draft composition preview
5. preview remains unattached until a future explicit Content Hub action

The result should be described as a draft composition preview or review asset, not a final ad creative.

## Future ASSET-COMPOSE3 / CREATIVE-STUDIO1 Path

Likely next layers:

- richer preview rendering with text wrapping and contrast checks
- persistent draft model only when users need saved versions
- Studio opened from a specific post
- editable headline/CTA/logo controls
- explicit Content Hub attach of a reviewed composed asset
- optional raster rendering/upload after explicit user action

## What Changed

- Added `src/lib/creativeCompositionPreview.ts`.
- Added focused tests for preview derivation, SVG transient artifact behavior, editable layer metadata, Arabic escaping, safe-zone validation, no auto-attach, and Post #3-like LinkedIn fixture behavior.

## What Did Not Change

- No runtime UI changes.
- No API routes.
- No schema or migrations.
- No Cloudinary upload behavior.
- No image generation.
- No media attach/remove/delete.
- No SocialPost, Media, GeneratedVisual, or campaign output mutation.
- No approval, scheduling, publishing, manual publishing, Autopilot, paid launch, platform push, billing, credits, dashboard, engine, or PR #164 behavior changes.

## QA Plan

Because this PR is helper/tests/docs only, Browser QA is not required.

Validation:

- `git diff --check`
- `npm run test -- src/lib/__tests__/creativeCompositionPreview.test.ts`
- `npm run test -- src/lib/__tests__/creativeComposition.test.ts src/lib/__tests__/creativeTemplates.test.ts src/lib/__tests__/creativeRequirements.test.ts`
- `npm run type-check`
- `npm run build`
- source scan for preview, persistence, upload, auto-attach, final creative, publish, schedule, Autopilot, paid launch, Brand Brain learning, Content Hub, brandComposite, SVG, safe zone, editable, and Arabic terms
