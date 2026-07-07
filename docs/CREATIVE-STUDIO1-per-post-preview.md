# CREATIVE-STUDIO1 — Per-post Creative Studio Preview

## Purpose

CREATIVE-STUDIO1 adds the first review-only Creative Studio surface inside the Creative Brief planner.

The goal is to connect the current campaign path:

Strategy -> Content Hub posts -> Creative Brief -> Post production desk

to a per-post layered creative preview that shows how a post can become a composed marketing asset later.

## What This Adds

- A deterministic `creativeStudioPreview` helper.
- A per-post draft layered preview on `/campaigns/[id]/creative-brief`.
- A selectable post list tied to real Content Hub posts.
- A transient SVG preview built from:
  - existing post copy
  - platform/format requirement
  - available post background, if one exists
  - editable headline layer
  - editable CTA layer
  - logo or brand-name fallback layer
  - template safe zones
- A controlled execution path display:
  - draft layered preview
  - future render with explicit confirmation
  - future Content Hub attachment with explicit confirmation

## Product Truth

The preview is not final ad creative.

It does not:

- generate images
- render a persisted asset
- upload a composed asset
- attach media to a SocialPost
- publish
- schedule
- spend credits
- update Brand Brain learning
- launch paid ads
- mutate production data

The output is a review-only preview that helps the user understand the creative direction for a specific post.

## Source Of Truth Boundary

Content Hub remains the final post media source of truth.

Future attachment must happen from Content Hub through a separate explicit confirmation flow. Creative Studio preview can inform that decision, but it cannot silently attach or replace post media.

## Why This Comes Before Full Studio

A full editor/render/upload pipeline is risky if the product cannot first show:

- which post is being worked on
- which platform and format it is for
- what copy layers are editable
- whether the background exists
- where the logo/brand layer goes
- whether safe zones are respected
- what is still locked

CREATIVE-STUDIO1 makes that state legible before adding expensive or mutating creative actions.

## Future Work

The next steps should be separate guarded PRs:

1. Controlled render confirmation.
2. Rendered asset persistence as Media only.
3. Explicit Content Hub attach from rendered asset.
4. Editable layer controls.
5. Version history and approval flow.

Each step should preserve the same truth boundary: no generation, upload, attach, schedule, publish, or paid launch without explicit confirmation.
