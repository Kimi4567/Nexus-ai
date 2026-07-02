# CREATIVE-REQ1 — Post-aware Creative Requirements

## Why this comes before Studio

NEXUS should not jump from a SocialPost to a generic AI image. A professional creative workflow needs a deterministic planning layer first:

Brand Brain context -> Strategy -> SocialPost copy -> Creative Requirement -> Template/layout later -> Generated or uploaded asset later -> Editable layers later -> Review -> Attach to post.

This PR adds that planning layer without running AI, spending credits, or mutating existing posts.

## Creative Requirement Contract

`src/lib/creativeRequirements.ts` derives a stable UI-friendly object per post:

- post id and platform
- platform format and aspect ratio defaults
- campaign objective and funnel stage
- content angle from post copy
- visual concept based on brand/campaign/post context
- required asset type
- generated/uploaded/either source preference
- text/logo/CTA layer placeholders for future Creative Studio/template work
- proof constraints
- requirement status

Current statuses:

- `media_needed`
- `requirement_ready`
- `generation_ready`
- `media_preview_needs_confirmation`
- `attached_to_post`
- `approved_for_publish`

CREATIVE-REQ1 does not automatically mark existing media as `approved_for_publish`; that remains a later review/publish boundary.

## Deterministic Rule

Creative requirements are derived from existing campaign, post, media, and Brand Brain context already available to the UI.

No LLM calls.
No image generation.
No creative brief generation.
No credits.
No database writes.
No production-data mutation.

## Content Hub Relationship

Content Hub remains the source of truth for final post preview and post-linked media decisions.

Each post card now shows a read-only Creative requirement block with:

- requirement status
- recommended aspect ratio
- platform format
- source preference
- reminder that text/logo layers come later

No new generation, attach, remove, publish, schedule, or credit action is introduced by this requirement block.

## Campaign Creative Tab Relationship

The Campaign Creative tab now summarizes post creative requirements:

- posts needing media
- posts with readiness-pending previews
- posts with media attached to posts

It also states that creative requirements guide media decisions only and do not generate or publish anything. Content Hub remains the place for final post media review and attachment.

## Brand Brain Relationship

Brand Brain context informs requirements as reviewed brand/style context.

This PR does not claim:

- Brand Brain learned
- NEXUS learned
- winning creative
- best-performing creative
- guaranteed or high-conversion visuals

Analytics-backed learning remains separate and requires real analytics data.

## Creative Studio Positioning

This PR does not build Creative Studio.

Creative Studio is positioned as a future context-first workspace opened later from a specific post for editable headline, CTA, logo, and layout layers. It does not publish, schedule, launch paid ads, or replace Content Hub as the post media source of truth.

## What Changed

- Added deterministic `derivePostCreativeRequirement`.
- Added creative requirement summary aggregation.
- Added a read-only Creative requirement block to Content Hub post cards.
- Added a read-only Post creative requirements summary to the Campaign Creative tab.
- Added focused helper tests.

## What Did Not Change

- No strategy generation.
- No content generation or regeneration.
- No visual/image generation.
- No creative brief generation.
- No media attach, replace, remove, or delete.
- No approval, scheduling, publishing, manual publishing, or Autopilot behavior.
- No paid launch or platform push behavior.
- No billing, credits, schema, migrations, dashboard, billing page, engine route, SocialPost rows, or campaign output behavior.

## QA Plan

Validation:

- `git diff --check`
- `npm run test -- src/lib/__tests__/creativeRequirements.test.ts`
- `npm run test -- src/lib/__tests__/contentHubMediaState.test.ts src/lib/__tests__/contentHubMediaAttachment.test.ts`
- `npm run type-check`
- `npm run build`

Read-only Browser QA:

- Content Hub shows Creative requirement info per post.
- Pending or ambiguous media is not called final creative.
- No-media posts show media-needed requirements.
- Ambiguous previews show readiness-pending requirements.
- Creative tab summarizes post creative requirements.
- Creative tab routes media decisions to Content Hub.
- No new generation button, credit action, publish, schedule, or Autopilot claim.
- Credits unchanged.
- No mutation endpoints.
- Console clean.
- Mobile 390px has no horizontal overflow.
