# POST-IMAGE-PROMPT2 — Requirement-aware Background Prompt Hardening

## Audit Finding

POST-IMAGE-PROMPT2-AUDIT1 found that the newer creative planning foundation was not yet wired into image prompt generation:

- brand-level fallback prompts could ask the image model to include brand name or headline text
- `/api/visuals/generate` did not accept Creative Requirement or Creative Template hints
- the route always ran the legacy `brandComposite` text/logo compositor after generation
- legacy bulk and cron image paths could send stored `SocialPost.imagePrompt` directly to the image provider

This PR hardens the contract before any controlled image generation QA.

## Background-only Contract

AI image generation is now framed as background / scene / hero visual generation for review only.

The reusable `TEXT_FREE_BACKGROUND_IMAGE_CONSTRAINTS` contract says generated assets must not include:

- text, words, letters, numbers, typography, Arabic calligraphy, or Arabic raster text
- logos, brand marks, CTA buttons, badges, proof labels, or watermarks
- fake metrics, charts, dashboards, UI screenshots, or platform screenshots
- invented product proof, testimonials, awards, results, performance claims, or analytics

The prompt asks for clean negative space for later editable/composited headline, CTA, logo, badge, and proof layers.

## Creative Requirement Mapping

`VisualContext` now accepts optional `creativeRequirement` hints from CREATIVE-REQ1:

- visual concept
- platform and aspect ratio
- objective
- funnel stage
- content angle
- required asset type
- source preference
- text overlay need
- logo need
- product image need
- proof constraints

These hints guide the scene and constraints only. They do not generate, attach, publish, schedule, or mutate posts by themselves.

## Creative Template Mapping

`VisualContext` now accepts optional `creativeTemplate` hints from CREATIVE-TEMPLATE1:

- template name
- aspect ratio
- canvas size
- format
- safe zones
- required editable layer positions

Template hints influence composition and negative space. The AI output remains a generated background/draft visual asset, not final ad creative.

## Brand Brain Inputs and Gaps

Safe prompt inputs:

- brand name as context
- industry
- tone words
- color palette
- visual style
- audience
- primary offer
- positioning and key message

Future Brand Brain gaps before professional template rendering:

- logo variants
- product and lifestyle photo inventory
- visual do/don't list
- creative references
- brand color roles
- typography preferences
- compliance/proof asset inventory

## brandComposite Role

`brandComposite` remains useful temporary compositor infrastructure, but new background asset roles skip it by default:

- `post_background`
- `campaign_concept_background`
- `hero_visual`
- `draft_visual_asset`

This avoids returning a text/logo-composited image that could be mistaken for final editable ad creative. A legacy escape hatch remains for older callers, but current runtime callers use the background roles.

## Caller Updates

Content Hub per-post image generation now sends:

- `assetRole: post_background`
- derived Creative Requirement
- default platform Creative Template
- existing explicit image generation confirmation fields

Campaign concept visual generation now sends:

- `assetRole: campaign_concept_background`
- default Creative Template hint
- existing explicit image generation confirmation fields

Both remain credit-spending actions only after explicit confirmation. This PR does not run them.

## Legacy Bulk and Cron Note

The bulk Content Hub image route and cron image route still use stored `SocialPost.imagePrompt`, but now wrap those stored prompts with `TEXT_FREE_BACKGROUND_IMAGE_CONSTRAINTS` before provider calls.

This does not change credit behavior, scheduling, Autopilot, post selection, or database mutation behavior. It only prevents stored prompts from bypassing the background-only image contract.

## Output Classification

`/api/visuals/generate` now returns:

- `assetRole`
- `outputClassification: draft_background_for_review`

Generated images should be described as:

- generated background
- draft visual asset
- campaign concept background
- generated image for review

They should not be called:

- final ad creative
- platform-ready ad
- published media
- scheduled media
- Brand Brain learning

## What Changed

- Hardened brand-level fallback prompts so they no longer ask for brand name, headline, or text inside the image.
- Added reusable text-free/background-only prompt constraints.
- Added Creative Requirement and Creative Template prompt hints.
- Added background-role output classification.
- Updated current `/api/visuals/generate` callers to send background asset roles and planning hints.
- Wrapped legacy stored-prompt image paths with the background-only contract.
- Added prompt and route tests.

## What Did Not Change

- No image generation was run.
- No credits were spent.
- No content or strategy generation changed.
- No schema, migration, env, billing, credit, dashboard, or billing page behavior changed.
- No approval, scheduling, publishing, manual publishing, Autopilot, paid launch, platform push, engine, or PR #164 behavior changed.
- No SocialPost, Media, GeneratedVisual, campaign output, or production data was mutated.

## QA Plan

Validation:

- `git diff --check`
- `npm run test -- src/lib/ai/__tests__/imageGenPrompt.test.ts`
- `npm run test -- src/app/api/visuals/generate/__tests__/route.test.ts`
- related Creative Requirement / Creative Template / Content Hub action-safety tests
- `npm run type-check`
- `npm run build`
- source scan for unsafe prompt/runtime wording

Browser QA after preview deploy:

- modal-only/read-only Content Hub per-post image modal
- modal-only/read-only campaign concept visual confirmation
- no final generate click
- no `/api/visuals/generate` request
- credits unchanged
- console clean
- mobile check if practical

## Future Controlled One-image QA Condition

Controlled image generation may resume only after this PR is merged and production QA passes.

Minimum condition:

- one clean scheduled post with no trusted `imageUrl`
- exact expected 3-credit spend
- expected mutation documented: selected `SocialPost.imageUrl`, `generationStatus`, and `mediaSource`
- output classified as generated background / draft visual for review
- no approval, scheduling, publish/manual publish, Autopilot, paid launch, platform push, Brand Brain learning, admin, refund, or unrelated data mutation
