# STRATEGY-EXECUTION-BRIDGE1 — Strategy-scoped execution readiness

> Historical implementation note. YouTube Shorts no longer shares the unsupported-platform state: current readiness requires a verified upload scope, status-readback scope, channel identity, and offline refresh token. The read-only strategy bridge contract remains unchanged.

## Purpose

NEXUS should feel like an operating system, not a set of patched pages. Strategy, Connections, Publish, and Paid Launch must each own a clear responsibility:

- Strategy decides what should be executed.
- Connections proves which accounts, pages, permissions, and API paths exist.
- Content Hub owns final post previews and post media state.
- Publish owns publishing readiness and explicit publishing boundaries.
- Paid Launch owns paid planning review and any future explicit paid execution flow.

This PR adds a small bridge between Strategy and Connections so the Campaign Room can explain execution readiness for the specific strategy scope without implying that anything has been launched, published, connected, or spent.

## Product Truth

- Organic-only strategy should not show paid execution as part of the plan.
- Paid-only strategy should not imply organic publishing work was produced.
- Full strategy should show both organic and paid prerequisites separately.
- Meta organic connection does not imply Meta Ads API readiness.
- TikTok, LinkedIn, and Instagram connections remain permission-unverified unless the platform readiness helper proves otherwise.
- YouTube Shorts and unsupported platforms stay blocked/not available for API publishing.
- A positive readiness row never means automatic publishing, campaign activation, or spend approval.

## Implementation Boundary

Added:

- `src/lib/strategyExecutionBridge.ts`
- `src/lib/__tests__/strategyExecutionBridge.test.ts`
- Campaign Strategy tab read-only execution bridge surface.

No behavior changed for:

- Strategy generation.
- Content generation/regeneration.
- Image/visual generation.
- Creative brief generation.
- Approval.
- Scheduling.
- Publish/manual publish.
- Autopilot.
- Paid launch/platform push.
- Credits/billing.
- Schema/data.
- SocialPost, Media, GeneratedVisual, or campaign.aiOutput mutation.

## Runtime Placement

The bridge appears inside the Campaign Room Strategy tab near readiness. It is intentionally read-only. Its links route the user to the right owner:

- `/connections` for account/page/API readiness.
- `/campaigns/[id]/paid-launch` for paid planning review when paid prerequisites are available.

It does not add any direct publishing, platform draft, connect, spend, or generation action.

## Follow-up Path

Future platform execution work should extend the existing `platformReadiness` and `strategyExecutionBridge` helpers first, then expose capability through the correct owner surface. Do not add isolated “ready” claims directly inside Strategy, Creative, Publish, or Paid pages without updating this bridge.
