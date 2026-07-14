# PLATFORM-CONNECT-TRUTH1 — Platform Publish Boundary

> Historical boundary note. The YouTube limitation described below was superseded in July 2026 by the reviewed OAuth, resumable upload, scheduled publishing, processing reconciliation, token refresh, and analytics-evidence connector. The Content Hub approval boundary remains in force.

## Purpose

This cleanup keeps platform connection and publishing surfaces honest before building real multi-platform execution.

NEXUS should feel like a marketing operating system, not a collection of disconnected generators. That means platform actions must start from a real campaign artifact, with visible readiness and explicit confirmation.

## Product Boundary

- Connections give NEXUS account context and available permissions only.
- Connecting a platform does not publish content.
- Connecting a platform does not activate paid ads.
- Paid ads remain planning-only unless a platform draft flow has explicit platform and budget confirmations.
- Content Hub remains the source of truth for final post content and post-linked media.
- Future platform/API publishing must start from a specific Content Hub `SocialPost`.
- Campaign Room Publish tab is readiness-only until post-level publish is implemented.

## What Changed

- Removed the Campaign Room free-form `SocialPublisher` composer from the Publish tab.
- Replaced it with a read-only boundary card that points to Content Hub and Connections.
- Added YouTube Shorts to platform readiness as not available for API publishing yet.
- Kept Facebook as the only platform that can currently derive `ready` in platform readiness, and even then publishing still requires post-level confirmation in a future flow.
- Kept Instagram, TikTok, and LinkedIn capped as permission-unverified until platform review and post-level flows are proven.

## Why This Matters

The old composer could create new scheduled or published `SocialPost` rows from free-form text inside the Campaign Room. That conflicts with the newer product contract where Content Hub is the final post preview and media source of truth.

For the first paid user, the safer path is:

1. Strategy creates the plan.
2. Content Hub owns post copy, media, lifecycle, and readiness.
3. Publish tab explains readiness and lock reasons.
4. A future post-level publish action sends one specific Content Hub post through one verified platform API after explicit confirmation.

## Future PR Sequence

1. `ORGANIC-PUBLISH-FB1`: Facebook Page API publish from one specific Content Hub post.
2. `ANALYTICS-SIGNALS1`: convert analytics-backed performance updates into reviewable Brand Brain signal proposals.
3. `PAID-META-DRAFT1`: create paused Meta Ads draft objects from approved paid planning with explicit budget confirmation.
4. Platform-specific PRs for Instagram, LinkedIn, TikTok, YouTube, and Google Ads only after permissions, app review, media requirements, and confirmation contracts are proven.

## Non-goals

- No platform connection was performed.
- No publishing or scheduling behavior was added.
- No paid launch behavior was added.
- No credits, schema, engine, dashboard, billing, media, SocialPost, Media, GeneratedVisual, or campaign output behavior changed.
