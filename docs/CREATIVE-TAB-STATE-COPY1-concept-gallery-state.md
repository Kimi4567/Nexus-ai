# CREATIVE-TAB-STATE-COPY1 — Concept Gallery State Copy

## Problem

Production owner QA found a Creative tab contradiction:

- the campaign already had Content Hub posts
- the concept-gallery lock message still said to "create Content Hub posts first"

That made the Creative tab feel like stale generic copy instead of a state-aware workflow.

## Fix

The concept-gallery lock copy now distinguishes:

- no Content Hub posts yet: review strategy, create Content Hub posts first, then open the creative brief
- Content Hub posts already exist: open the creative brief first to define asset and layer needs before concept visual generation

## Boundary

This is a read-only copy/state-surface fix.

It does not:

- generate visuals or images
- open the creative brief automatically
- spend credits
- attach or remove media
- mutate `SocialPost`, `Media`, `GeneratedVisual`, or `campaign.aiOutput`
- approve, schedule, publish, manually publish, activate Autopilot, run paid launch, push to platform, or run the engine

## Validation

- `git diff --check`
- `npm run test -- src/app/campaigns/[id]/__tests__/creativeStudioCopy.test.ts`
- `npm run type-check`
- `npm run build`
