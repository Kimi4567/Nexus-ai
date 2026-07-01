# CAMPAIGN-ROOM-IA2 — Golden Path IA + Action Cleanup

## Audit Findings

The Campaign Room had several planning/review surfaces competing for the user's next step. Previous fixes protected destructive rebuild behavior, publishing boundaries, paid planning, and Creative tab truth, but the Campaign Room still needed clearer navigation contracts:

- Deep links such as `?tab=publish` and `?tab=performance` should be the source of truth for the active Campaign Room tab.
- Content Hub should be positioned as the final post preview and SocialPost-linked media source of truth.
- Content & Hooks should not offer direct Brand Brain mutation actions.
- Old saved campaign notes should remain review context without implying that saved `campaign.aiOutput` is rewritten.
- Creative should keep concept visuals secondary when post media decisions are pending.

## Tab Deep-Link Contract

Campaign Room tabs now normalize query-string routing through `src/lib/campaignRoomTabs.ts`.

Supported canonical tabs:

- `strategy`
- `content`
- `calendar`
- `creative`
- `publish`
- `autopilot`
- `performance`

Alias:

- `visuals` maps to `creative` for backward compatibility.

Unknown or empty tab values fall back to `strategy`. Tab clicks write the canonical `?tab=` value back to the URL so read-only QA and user navigation share the same state.

## Content Hub Final Preview Contract

Campaign Room tabs are planning and review surfaces. Content Hub remains the final post preview path and the source of truth for:

- final post copy review
- post-linked media readiness
- SocialPost lifecycle state
- manual publish status
- scheduling/publishing readiness handoff

The Strategy and Content & Hooks tabs now remind users that saved campaign notes are for review and that Content Hub shows the current post-ready state.

## Brand Brain Save Removal Rationale

The Content & Hooks tab no longer exposes direct Brand Brain save buttons for hooks or angles. Hooks and angles shown in Campaign Room are review material. Brand Brain updates should happen through reviewed signal proposals or Brand Brain surfaces.

This keeps the learning contract intact:

- approvals and preferences are workflow signals
- manual publish events are execution signals
- analytics-backed learning requires real analytics data
- Campaign Room review copy does not directly mutate Brand Brain

Backend Brand Brain behavior was not changed.

## Old Saved Output Context

Existing `campaign.aiOutput` remains untouched. The UI now frames saved campaign notes as review context instead of current execution truth. Content Hub remains the place to inspect current post-ready state.

## Creative Hierarchy

Creative remains planning and review only. When post media decisions are pending, the primary path points to Content Hub for post media review. Campaign concept visuals remain optional gallery assets that are not automatically attached to posts, scheduled, published, or used in ads.

This PR does not build Creative Studio and does not change visual generation behavior.

## What Changed

- Added a small tab normalization helper and focused tests.
- Wired Campaign Room tab state to `?tab=`.
- Preserved `visuals` as a Creative alias.
- Removed Campaign Room direct Brand Brain save actions.
- Added read-only Content Hub and Brand Brain signal guidance.
- Added saved-output context notes for Strategy / Content & Hooks.
- Removed now-unused save-to-memory translation labels.

## What Did Not Change

- No engine route or rebuild behavior changed.
- No billing, credits, schema, migrations, or environment config changed.
- No approval, scheduling, publishing, manual publish, Autopilot, paid launch, platform push, or image generation behavior changed.
- No existing SocialPost rows or `campaign.aiOutput` values were mutated.
- PR #164 remains parked and untouched.

## QA Plan

Read-only browser QA should verify:

- Direct links render the expected tab for `strategy`, `content`, `calendar`, `creative`, `visuals`, `publish`, `autopilot`, and `performance`.
- Clicking tabs updates the URL query parameter.
- `visuals` opens the Creative tab and future clicks use canonical `creative`.
- Content Hub is positioned as final post preview and SocialPost-linked media source of truth.
- Content & Hooks does not show direct Brand Brain save buttons.
- Creative keeps Content Hub / post media review as the primary path when media decisions are pending.
- The tiny global rebuild affordance remains removed and progressed campaigns remain rebuild-locked.
- No generation, credits, approval, schedule, publish, manual publish, Autopilot, admin, paid launch, platform push, image generation, or data mutation occurs.
