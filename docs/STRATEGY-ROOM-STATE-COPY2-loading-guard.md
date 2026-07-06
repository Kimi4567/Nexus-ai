# STRATEGY-ROOM-STATE-COPY2 — Content Hub Loading State Guard

## Problem

After `STRATEGY-ROOM-STATE-COPY1`, the Strategy tab used Content Hub-aware copy once `SocialPost` snapshots were loaded.

Production QA showed a transient trust issue: before the Content Hub snapshot finished loading, the Strategy page could briefly show pre-Content Hub copy such as "Before Content Hub checklist" even when the campaign already had saved Content Hub posts.

## Fix

The Strategy tab now uses a tested copy helper for Strategy-room state surfaces:

- paid-only strategy review
- Content Hub snapshot loading
- content plan already exists
- no content plan after state is known
- Content & Hooks guidance while Content Hub state is still loading

While Content Hub state is unknown, the page shows neutral loading copy:

- "Checking Content Hub state"
- no claim that the first content plan still needs to be built
- no claim that final post previews do not exist yet
- no generation, approval, scheduling, publishing, or Brand Brain update implication

## Runtime Boundaries

This change is copy/state-surface only.

It does not:

- generate or regenerate strategy/content/images
- create or mutate SocialPost rows
- mutate `campaign.aiOutput`
- approve, schedule, publish, or manually publish
- update Brand Brain learning
- spend credits
- change billing, dashboard, schema, API routes, media, paid launch, Autopilot, or engine behavior

## Validation

- `git diff --check`
- `npm run test -- src/lib/__tests__/strategyRoomStateCopy.test.ts src/lib/__tests__/campaignSummary.test.ts src/lib/__tests__/contentCounts.test.ts`
- `npm run type-check`
- `npm run build`
