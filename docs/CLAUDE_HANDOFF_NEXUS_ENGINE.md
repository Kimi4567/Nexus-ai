# Claude Handoff — NEXUS AI Operating Engine

Last updated: 2026-06-04 17:20 Asia/Dubai

## Current Situation

The product is being moved from separate AI tools into a single operating machine:

`Brand Brain -> NEXUS Engine -> Strategy -> Content -> Creative -> Sentinel -> Calendar -> Approval -> Autopilot`

The user wants the SaaS to feel like an AI marketing department, not a generator.

## Key Changes Implemented

### 1. Unified Campaign Engine

Added:

- `src/lib/campaign-engine.ts`
- `src/app/api/campaigns/[id]/engine/route.ts`

The engine now prepares a campaign package in one run:

- strategy
- content/calendar data
- creative direction
- Sentinel safety review
- calendar items
- campaign readiness state

The campaign detail page now has a visible `NEXUS Engine` control panel with readiness score and a one-click Run/Re-run action.

### 2. Approval Gate

Campaign approval is now blocked unless:

- Sentinel review passed
- calendar items exist

Client gate:

- `src/app/campaigns/[id]/page.tsx`

Server gate:

- `src/app/api/campaigns/[id]/route.ts`

This prevents a campaign from moving to `ACTIVE` before the operating pipeline is truly ready.

### 3. Brand Brain Learning on Approval

When a campaign is approved, Brand Brain learns from:

- top hooks
- content angles / pillars
- platforms
- last approved positioning

Implemented in:

- `src/app/api/campaigns/[id]/route.ts`

### 4. Media Library Integration

The engine now checks workspace media before generating creative direction.

If media exists:

- images/logos/videos are passed to `analyzeAssets`
- creative mode becomes `asset`
- media metadata is stored in `aiOutput.mediaStrategy`

If no media exists:

- the engine falls back to AI concept mode using `generateVisualConcepts`

Implemented in:

- `src/lib/campaign-engine.ts`

### 5. Autopilot Media Bug Fix

Fixed a bug in:

- `src/app/api/autopilot/activate/route.ts`

It was reading `creativeBrief.assetAnalysis`, but the real field is `creativeBrief.assetAnalyses`.

This lets uploaded Media Library assets flow into scheduled SocialPost records.

### 6. Monthly Plan Platform Preview UI

Campaign detail now shows a platform-organized monthly content plan.

Each platform is grouped separately:

- Instagram
- TikTok
- LinkedIn
- Facebook / Meta
- General fallback

Each post displays as a platform-style preview card showing:

- planned date/week
- platform identity
- topic
- hook
- caption/CTA
- visual preview
- whether the visual comes from Media Library or will be AI-generated

Implemented in:

- `src/app/campaigns/[id]/page.tsx`

### 7. Brand Brain Crash Fix

Production issue:

The `/brand` page could render the app error screen if old or malformed brand data returned non-array values for fields expected to be arrays.

Fixes added:

- `normalizeBrandProfile`
- safe array normalization in the Brand Brain hook
- defensive array handling in Brand page UI components
- API-side array normalization on save

Files:

- `src/hooks/useBrandBrain.ts`
- `src/app/brand/page.tsx`
- `src/app/api/brand/route.ts`

## Verification Already Run

Passed locally:

- `npm run type-check`
- `npm run build`

Known build warning:

- Google Fonts stylesheet download warning during local build due network/font optimization. It did not fail the build.

## Production Deployment Status

Latest successful production deployment after the Brand Brain crash fix:

- `https://www.nexus-grow.com`
- deployment URL: `https://nexus-6sr4vkl5y-raouf-s-projects2.vercel.app`
- deployment id: `dpl_GUQgmgEaxyPYHXB1EnfXuB4Qe6Ny`

Verified:

- `npm run type-check` passed locally.
- `npm run build` passed locally.
- Vercel production build passed.
- `https://www.nexus-grow.com/brand` loads and redirects unauthenticated users to login instead of throwing the app error screen.

## Important Caution

The worktree contains many unrelated pending changes beyond these files, including billing, cron, social, TikTok review, docs, and media assets.

Do not revert unrelated changes.

When deploying, be aware that Vercel deploy will publish the entire current worktree, not only the Brand Brain fix.

## Suggested Next Product Step

After this handoff:

1. Test `/brand` with the user's authenticated browser session.
2. Create a campaign with uploaded Media Library assets.
3. Run `NEXUS Engine`.
4. Confirm:
   - Creative Brief uses uploaded media.
   - monthly plan is grouped by platform.
   - cards show Media Library previews.
   - approval is blocked until Sentinel passes.
   - Autopilot scheduled posts inherit user assets where available.
