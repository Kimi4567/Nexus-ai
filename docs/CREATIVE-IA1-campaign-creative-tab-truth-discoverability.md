# CREATIVE-IA1 Campaign Creative Tab Truth & Discoverability

## Audit Finding

The Campaign Room "Visuals" tab had become a mixed creative workflow surface. It routed to the Creative Brief, Content Hub, Paid Planning Brief, strategy visual direction, and the campaign-level visual generator. The underlying behavior was mostly truth-safe, but the main label made the surface feel like an image-only or design-editor workflow.

## IA Decision

The tab is now framed as **Creative**.

Creative is the campaign creative requirements and readiness control point. It helps the user understand what creative work is needed next, where post-linked media should be reviewed, and where campaign-level concept visuals live.

## Content Hub Relationship

Content Hub remains the source of truth for post previews and post-linked media.

- `SocialPost.imageUrl` is the final post media field.
- `SocialPost.uploadedMediaId` links uploaded assets to posts.
- Post media generation, upload assignment, and platform previews stay in Content Hub.
- The Creative tab summarizes media readiness and routes users to Content Hub instead of duplicating post editing.

## Creative Brief Contract

The Creative Brief remains a planning artifact.

It can help plan:

- art direction
- asset needs
- prompt guidance
- concept direction
- production notes

It does not approve content, schedule posts, publish, launch ads, or push anything to a platform.

## Campaign Concept Visuals Contract

Campaign concept visuals are campaign-level gallery assets.

- They are generated into `GeneratedVisual`.
- They are not automatically attached to `SocialPost` rows.
- They are not saved to Media Library automatically.
- They are not scheduled, published, or used for paid ads automatically.

The visible generator copy now uses "campaign concept visual" language instead of generic "Generate visual" wording.

## Paid Creative Requirements

Paid creative requirements remain planning-only in this PR.

The Creative tab can route to the Paid Planning Brief, but no ad launch, spend, platform push, paused platform draft creation, or paid campaign mutation happens from Creative.

## Creative Studio Deferred

This PR does not build Creative Studio.

Future Creative Studio should be context-aware rather than a blank-canvas editor:

- start from campaign, post, platform, brand style, and creative requirement
- create assets for review
- attach assets to posts only with explicit user action
- never publish, schedule, or launch ads

Explicitly deferred:

- Canva-like editor
- template and layer system
- post-to-GeneratedVisual attachment model
- bulk asset attach
- paid creative production
- Media Library save-from-generated-visual
- creative approval state
- creative performance learning

## QA Plan

Read-only browser QA should confirm:

- Campaign Room tab label is Creative, not Visuals.
- Creative tab explains planning and media readiness without publish, schedule, or paid launch implications.
- Post media readiness points to Content Hub.
- Creative Brief is planning-only.
- Campaign concept visuals are clearly gallery assets and not attached automatically.
- No generation, credits, approval, scheduling, publishing, paid launch, platform push, Autopilot, or admin action is triggered.

## Validation

Run:

- `git diff --check`
- `npm run test -- src/app/campaigns/[id]/__tests__/creativeStudioCopy.test.ts`
- `npm run type-check`
- `npm run build`
- copy scan over Campaign page, VisualGenerator, i18n, source guard, and this doc
