# ASSET-COMPOSE1 — Template Composition Plan Helper

## Scope

ASSET-COMPOSE1 adds a deterministic TypeScript helper for planning how a generated or uploaded background can later be composed with editable template layers.

The helper does not render images, call AI, upload media, attach media to a post, spend credits, publish, schedule, launch paid campaigns, update Brand Brain learning, or mutate production data.

## Composition Contract

`deriveCreativeCompositionPlan(input)` returns a `CreativeCompositionPlan` with:

- a selected `CreativeTemplateSpec`
- canvas dimensions and aspect ratio
- background source metadata
- editable headline, CTA, logo or brand-name fallback, accent, and optional proof layers
- safe-zone compliance flags
- review validation results
- explicit Content Hub attach policy
- `outputClassification: "draft_composition_plan"`

The output is a planning artifact only. It is not final ad creative and it is not attached to a `SocialPost`.

## Inputs

The helper accepts read-only context:

- `postId`
- `postCaption`
- `brandName`
- `logoUrl`
- `colorPalette` and `colorRoles`
- `language`
- `creativeRequirement`
- `creativeTemplate`
- `backgroundImageUrl`
- `generatedVisualId`
- `uploadedMediaId`

The helper is intentionally pure. Callers must provide all data; the helper does not query the database.

## CreativeRequirement Mapping

The plan uses `CreativeRequirement` fields to guide the composition plan:

- `platform`, `format`, and `aspectRatio` choose a safe default template when no template is supplied.
- `objective`, `funnelStage`, `contentAngle`, and `visualConcept` shape the review copy context.
- `sourcePreference` and `requiredAssetType` classify the background source.
- `headlineLayer` and `ctaLayer` become editable composited text when present.
- `logoNeeded` is honored through a logo layer or editable brand-name fallback.
- `proofConstraints` decide whether optional proof/badge layers are allowed.

If the platform is unknown, the helper falls back to the generic square review template.

## Generated Background Boundary

Generated backgrounds remain background/review assets. They are not treated as final post media by this helper.

The composition plan can reference:

- a `GeneratedVisual` background
- an uploaded asset background
- no background yet

Even when a background exists, final attachment remains an explicit Content Hub action.

## Brand Brain Boundary

Brand Brain inputs can provide brand name, logo URL, and palette information. Missing brand assets use deterministic neutral fallbacks:

- no logo becomes an editable brand-name layer
- no palette becomes neutral premium colors

The helper does not write learning events, update Brand Brain, select winning assets, or infer performance patterns.

## Editable Layer Contract

Text and identity layers are composited/editable:

- headline layer
- CTA layer
- optional subheading layer
- logo or brand-name fallback layer
- optional proof layer only when constraints allow it

Arabic headline and CTA text must remain editable composited text. AI-rendered Arabic raster text is not accepted as final creative text.

## Safety Rules

`validateCreativeCompositionPlan(plan)` checks:

- background exists when required
- headline exists and is editable
- CTA exists when recommended
- logo or brand-name fallback exists
- layers fit template safe zones
- proof layers do not appear when proof is disallowed
- layer text does not claim publishing, scheduling, Autopilot, paid launch, or Brand Brain learning
- `autoAttach` is false
- output is a `draft_composition_plan`
- Arabic text remains editable/composited

## Content Hub Boundary

The plan includes:

```ts
attachPolicy: {
  autoAttach: false,
  attachRequiresExplicitUserAction: true,
  attachSurface: 'content_hub',
}
```

This preserves Content Hub as the final attachment and post-linked media source of truth.

## Non-Goals

ASSET-COMPOSE1 does not:

- build Creative Studio UI
- render a final creative
- create files
- upload media
- attach media
- delete media
- mutate `SocialPost`, `Media`, `GeneratedVisual`, or `campaign.aiOutput`
- generate images
- spend credits
- publish or schedule content
- launch paid campaigns
- update Brand Brain learning

## Future Integration

Future work can connect this contract to a Creative Studio composer that:

1. loads a generated background draft
2. chooses a `CreativeTemplateSpec`
3. creates editable layer controls
4. renders a preview for review
5. requires explicit Content Hub attachment before any `SocialPost` media change

That future flow should keep the same boundaries: generated background plus template plus editable layers creates a reviewable composition preview, not final post media until explicitly attached.
