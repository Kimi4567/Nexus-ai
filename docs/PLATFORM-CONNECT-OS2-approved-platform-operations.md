# PLATFORM-CONNECT-OS2 — Platform connections and approved operations

## Purpose

Connections is the operating readiness surface for platform accounts. It should answer three questions clearly:

- Which publishing channels are connected?
- Which paid execution path is available?
- What still needs permissions, setup, or explicit approval before anything can publish or spend?

## Product truth

- Connecting a social account does not publish content.
- Connecting an ad account does not activate a campaign.
- Organic publishing and paid execution are separate readiness tracks.
- Meta organic publishing can become ready only when a Facebook Page is connected.
- Meta Ads is the first paid execution path because the product has Meta Ads OAuth, AdAccount storage, paused platform draft creation, and explicit activation guardrails.
- Meta Ads readiness requires an active ad account, a Page/publishing identity, and `hasApiAccess === true`.
- Paid activation still happens only from Paid Ads after explicit final approval, budget confirmation, spend acknowledgement, and paused platform draft review.
- Google, TikTok, LinkedIn, YouTube, Snapchat, and X may remain planning/review channels until their own reviewed connector/API execution path exists.

## Boundaries

This PR does not:

- create or activate paid campaigns
- connect OAuth accounts during QA
- spend credits or ad budget
- publish or schedule content
- create platform draft objects
- change schema or migrations
- mutate SocialPost, AdCampaign, AdAccount, Integration, Media, GeneratedVisual, or campaign output data

## Runtime changes

- `derivePlatformReadiness` now accepts safe AdAccount readiness input in addition to social account input.
- Paid readiness is no longer hard-coded to planning-only.
- Paid readiness distinguishes:
  - no Meta Ads account connected
  - Meta Ads connected but missing Page/publishing identity
  - Meta Ads connected but API access not approved
  - Meta Ads ready for paused platform drafts and explicit final activation
- Connections fetches `/api/social/accounts` and `/api/ad-accounts` read-only to render honest readiness.
- Connections exposes a Meta Ads connect path, but activation remains in Paid Ads.
- Brand/Dashboard copy avoids saying paid ads are permanently planning-only.
- Meta Ads OAuth scopes mirror the current Meta Marketing API use case: `public_profile`, `ads_management`, `ads_read`, and `business_management`. Ads insights are covered by `ads_read`; `read_insights` is intentionally not requested for the paid connection.
- Meta Ads App Review is documented separately in `docs/META_ADS_APP_REVIEW_PACKAGE.md` so the paid review flow stays distinct from organic Facebook Page publishing.

## QA plan

- Unit tests for social-only readiness, Meta Ads permission gaps, missing Page identity, and ready Meta paid execution.
- Type-check and build.
- Browser QA on `/connections`:
  - no global planning-only paid claim
  - Meta Ads readiness visible
  - no launch/spend/active claim
  - no OAuth clicked unless manually approved by the owner
  - no product mutation
