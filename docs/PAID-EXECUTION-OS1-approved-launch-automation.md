# PAID-EXECUTION-OS1 — Approved Paid Launch Automation

## Goal

Move paid ads from a dead-end "planning only" surface toward an approval-gated
execution system:

1. paid planning draft
2. reviewed campaign setup
3. paused platform draft creation
4. final client approval
5. explicit platform activation
6. analytics-backed reporting after real platform data exists

The product should support automatic paid campaign execution after approval, but
it must never imply that connecting an account, generating a plan, or creating a
paused draft has already launched ads or started spend.

## Product Truth

- A paid planning draft is not a live ad campaign.
- A paused platform draft is not spending.
- Activation is the first moment where delivery/spend may begin.
- Activation requires a separate explicit final approval.
- Generic campaign updates must not mark paid campaigns active.
- Meta is the first execution path because Meta Ads OAuth, AdAccount storage,
  and a platform push layer already exist.
- LinkedIn, TikTok, and Google require their own connector/API review paths
  before direct launch automation can be truthful.

## Implementation

- Added `canActivatePlatformCampaign` to centralize the activation contract.
- Added `POST /api/ad-campaigns/[id]/activate-platform`.
- Activation only supports Meta in this PR.
- Activation requires:
  - `platform === META`
  - local status `PAUSED`
  - platform status `PAUSED`
  - existing `platformCampaignId`
  - connected ad account with `hasApiAccess === true`
  - explicit platform activation confirmation
  - explicit spend activation confirmation
  - explicit budget confirmation
- Activation updates existing Meta objects only:
  - ad sets → `ACTIVE`
  - ads → `ACTIVE`
  - campaign → `ACTIVE` last
- The campaign-level Meta object is activated last so children can be prepared
  while the campaign remains paused.
- Generic `PATCH /api/ad-campaigns/[id]` now rejects direct `ACTIVE` status or
  direct `platformStatus: ACTIVE`.

## Runtime Copy

Paid Ads surfaces now use "Paid Ads Control Center" and "approval-gated"
language instead of implying paid ads are permanently planning-only.

The detail page exposes:

- create paused platform drafts
- activate after final approval
- final activation confirmation modal

The final activation modal states that activation may start delivery and spend.

## Safety Boundaries

This PR does not:

- connect any platform account
- trigger OAuth
- create a paid campaign
- create a platform draft
- activate a platform campaign
- spend budget
- sync metrics
- update Brand Brain learning
- touch billing, dashboard, schema, migrations, credits, engine, publishing, or
  organic scheduling behavior

## Follow-up

Before enabling this for a first paid user, run a controlled Meta test account
flow:

1. connect Meta Ads in a reviewed/test Business Manager
2. create one paid planning draft
3. create one paused Meta draft
4. verify platform objects are paused
5. activate only after final approval
6. verify delivery/spend state in Meta
7. sync real metrics only after platform data exists
