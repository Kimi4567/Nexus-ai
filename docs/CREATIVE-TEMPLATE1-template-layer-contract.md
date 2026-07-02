# CREATIVE-TEMPLATE1 Template and Editable Layer Contract

## Why templates come before Studio

CREATIVE-REQ1 established the deterministic planning layer:

Brand Brain -> Strategy -> SocialPost -> Creative Requirement -> Template/layout decision -> Generated or uploaded visual asset -> Editable headline/CTA/logo layers -> Quality check -> Review -> Attach final media to SocialPost in Content Hub.

The next step is not image generation and not a full Creative Studio. The next step is a stable contract that lets NEXUS reason about professional marketing templates before rendering, editing, or attaching anything.

## Current audit finding

NEXUS already has useful pieces:

- post-aware Creative Requirements
- Content Hub as the final post preview and post-linked media source of truth
- GeneratedVisual records for generated concept visuals
- Media Library records for uploaded assets
- `brandComposite` for hardcoded Sharp/SVG composition

What NEXUS does not yet have:

- reusable template specs
- editable layer storage
- template-to-post draft state
- safe-zone rules as data
- platform template registry
- Creative Studio visual editor
- quality checks before final attachment

`brandComposite` is useful infrastructure, but it is a hardcoded compositor rather than a reusable template system.

## Template contract

`src/lib/creativeTemplates.ts` adds a JSON-first TypeScript contract:

- `templateId`
- `templateName`
- `platform`
- `format`
- `aspectRatio`
- `width`
- `height`
- `postType`
- `funnelStage`
- `industryFit`
- `brandStyleFit`
- `safeZones`
- `colorRoles`
- `typographyRoles`
- `requiredAssets`
- `editableFields`
- `qualityRules`
- `layers`

This contract is deterministic. It does not call AI, read or write the database, render assets, attach media, publish, schedule, or spend credits.

## Layer contract

Each `CreativeLayer` describes one editable or composited layer:

- `id`
- `type`
- `role`
- `contentSource`
- `editable`
- `required`
- `position`
- `size`
- `constraints`
- `fallback`
- `validationRules`

Layer types include:

- `background`
- `hero_image`
- `headline`
- `subheading`
- `cta`
- `logo`
- `badge`
- `accent`
- `proof_note`

Position and size are normalized template-space values for now. Safe zones are pixel-based for the target canvas.

## Editable text, logo, and CTA principle

Professional NEXUS creatives should not rely on AI-rendered text inside the generated image.

Preferred path:

1. AI generates a text-free background, scene, or hero image.
2. Template/compositor adds headline, CTA, logo, badge, accent, and proof note as separate layers.
3. Arabic text remains editable/composited so it can be rendered reliably.
4. The final composed media is attached to a SocialPost only after explicit review in Content Hub.

Headline, CTA, and logo layers are therefore modeled as separate layers, not as prompt-only image content.

## Default templates

This foundation includes three deterministic defaults:

1. `meta-portrait-offer-card-v1`
   - platform: `META`
   - format: `feed_portrait`
   - aspect ratio: `4:5`
   - size: `1080x1350`
   - layers: background, headline, CTA, logo, accent

2. `linkedin-landscape-insight-v1`
   - platform: `LINKEDIN`
   - format: `linkedin_landscape`
   - aspect ratio: `1.91:1`
   - size: `1200x628`
   - layers: background, headline, subheading, logo, CTA

3. `generic-square-review-v1`
   - platform: `UNKNOWN`
   - format: `feed_square`
   - aspect ratio: `1:1`
   - size: `1080x1080`
   - safe fallback for unknown platforms

These are contracts only. They are not runtime rendered templates.

## Brand Brain relationship

Brand Brain can provide:

- brand name
- logo
- color palette
- tone
- visual style
- language
- audience
- offer
- proof constraints
- reviewed signals

Future Brand Brain gaps before high-quality template rendering:

- color roles instead of a flat palette
- typography preferences
- logo variants
- product and lifestyle photos
- visual do/don't guidance
- creative references
- template style preferences
- compliance and proof assets

## CreativeRequirement mapping

`getCreativeTemplatesForRequirement()` accepts a lightweight CreativeRequirement-compatible input:

- `platform`
- `aspectRatio`
- `funnelStage`
- `logoNeeded`
- `textOverlayNeeded`
- `headlineLayer`
- `ctaLayer`
- `proofConstraints`

The helper returns platform-fit templates without mutating Creative Requirements. Unknown platforms use the generic square fallback.

Future extension can use more requirement signals:

- objective
- content angle
- source preference
- product image need
- proof allowance
- language/script constraints
- CTA layer need

## Content Hub and Studio boundary

Content Hub remains the final attachment source of truth.

Creative templates are planning/editing contracts. A template is not final post media by itself. It should not publish, schedule, launch paid ads, attach media, or overwrite `SocialPost.imageUrl`.

Future Creative Studio should open from a post:

`/studio?campaignId=...&postId=...`

It should load:

- Brand Brain context
- Creative Requirement
- selected template
- SocialPost copy
- platform preview

It may later allow:

- template selection
- headline/CTA editing
- background selection or generation
- preview
- explicit attach to post

It must not:

- publish
- schedule
- launch paid ads
- auto-attach
- replace Content Hub as the final post media source of truth

## JSON-first decision

This PR intentionally avoids schema migration.

The contract is TypeScript/JSON-first because no runtime Studio drafts or render history exist yet. Schema should wait until the product needs persistent draft state or version history.

Future entities may include:

- `CreativeTemplate`
- `CreativeLayer`
- `CreativeDraft`
- `PostCreative`
- `CreativeQualityCheck`

## Quality standard

`deriveCreativeQualityChecklist()` establishes the first professional creative checks:

- editable headline layer
- editable CTA layer
- avoid AI-rendered text in background
- safe zones defined
- brand/logo layer
- constrained proof/compliance layer
- platform aspect ratio match
- Content Hub final attachment boundary

Future checks should also cover:

- brand fit
- message hierarchy
- platform fit
- readability
- CTA clarity
- unsupported-claim safety
- Arabic rendering
- final preview match

## Future PRs

- `POST-IMAGE-PROMPT2`: make image prompts requirement-aware while preserving no-text background policy.
- `CREATIVE-STUDIO1`: context-first Studio MVP opened from a post.
- `ASSET-COMPOSE1`: layered rendering/composition from a selected template.
- `CREATIVE-QA1`: quality check and review workflow before final attachment.

## What this PR does not change

- No UI changes.
- No image generation.
- No creative brief generation.
- No media attach, replace, remove, upload, or delete.
- No strategy or content generation.
- No approval, scheduling, publishing, manual publishing, or Autopilot.
- No paid launch or platform push.
- No billing, credits, schema, migration, dashboard, billing page, engine, SocialPost rows, GeneratedVisual rows, Media rows, or campaign output behavior.
