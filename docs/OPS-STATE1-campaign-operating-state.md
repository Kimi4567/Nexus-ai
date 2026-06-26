# OPS-STATE1 — Campaign Operating State Foundation

## Objective

Create one pure, testable Campaign Operating State helper and use it only in the Campaign Room top status/progress area.

This PR is a foundation step. It does not redesign Campaign Room, change publishing behavior, change APIs, or introduce new execution capability.

## Why Campaign.status Is Not Enough

`Campaign.status` is a broad wrapper field. In the current product it can mean a campaign is ready for content planning, queued by an older flow, archived, or otherwise administratively marked. It is not proof that:

- content has been reviewed
- posts are scheduled
- auto-publishing is enabled
- content was published
- analytics are available

The operating state must be derived primarily from real `SocialPost` lifecycle fields and only use `Campaign.status` for paused/archived presentation.

## Helper Contract

The new helper lives in:

`src/lib/campaignOperatingState.ts`

It is:

- pure
- side-effect free
- independent of React
- independent of Prisma
- independent of APIs
- driven by normalized snapshots

It accepts campaign evidence, social post snapshots, and an optional pending learning count. It returns:

- `stage`
- localized stage labels/helpers
- a primary action contract
- blockers
- lifecycle counts
- truth flags

## Source-Of-Truth Rules

- `Campaign.status === ACTIVE` never means live, published, approved, or auto-publish enabled.
- Strategy exists only when `aiOutput.strategy` or conservative strategy-like fields exist.
- A strategy without passed quality review and without posts stays in `strategy_review_needed`.
- Content plan exists only when post rows exist.
- Draft content means content review is needed unless a stronger later state exists.
- Scheduled means `status === SCHEDULED` and `scheduledAt` is valid.
- Manual scheduled means scheduled with `publishMode !== AUTO`.
- Auto scheduled means scheduled with `publishMode === AUTO`.
- Auto-publish enabled means at least one scheduled post is explicitly `AUTO`; `campaign.autopilotEnabled` alone is only workflow evidence.
- Published means `status === PUBLISHED` and `publishedAt` exists.
- API-published means published plus `platformPostId` or `platformUrl`.
- Manual published means published plus `manuallyPublishedAt`, or published with no platform reference.
- Analytics-ready means a published post has `analyticsData` or `analyticsFetched`.
- Pending learning proposals are review-needed, not applied learning.

## Stage Rules

The helper derives one stage from the strongest truthful evidence:

1. `learning_review_needed`
2. `performance_ready`
3. `published_waiting_for_analytics`
4. `auto_publish_enabled`
5. `scheduled_auto`
6. `scheduled_manual`
7. `paused_or_archived`
8. `content_review_needed`
9. `strategy_missing`
10. `strategy_review_needed`
11. `content_plan_missing`
12. `content_approved_not_scheduled`

Published/performance/learning states can still surface for archived campaigns because the historical result remains true. Paused/archived only wins when no stronger execution evidence exists.

## Files Touched

- `src/lib/campaignOperatingState.ts`
- `src/lib/__tests__/campaignOperatingState.test.ts`
- `src/app/campaigns/[id]/page.tsx`
- `docs/OPS-STATE1-campaign-operating-state.md`

## UI Surfaces Changed

Only Campaign Room top-level display surfaces use the helper:

- header operating state badge
- content-plan banner copy
- progress strip
- top status helper copy
- top context action routing

## Intentionally Not Changed

- Content Hub
- Dashboard / Marketing Intelligence
- publishing APIs
- cron publishing
- platform APIs
- billing, credits, pricing
- Prisma schema or migrations
- RunFullStrategyModal
- generation behavior
- paid campaigns
- Creative Studio
- Campaign Room tab bodies

## Validation

Required validation:

```bash
git diff --check -- \
src/lib/campaignOperatingState.ts \
src/lib/__tests__/campaignOperatingState.test.ts \
src/app/campaigns/[id]/page.tsx \
docs/OPS-STATE1-campaign-operating-state.md

npm run test -- src/lib/__tests__/campaignOperatingState.test.ts
npm run type-check
npm run build
```

Dangerous-copy scan:

```bash
rg -n "Live|go live|fully running|immediate results|guaranteed|Auto-publish ready|Ads ready|Fully connected|Campaign active|Autopilot active" \
src/app/campaigns/[id]/page.tsx \
src/lib/campaignOperatingState.ts \
docs/OPS-STATE1-campaign-operating-state.md
```

## QA Plan

Authenticated browser QA:

- `/campaigns/{campaignId}?tab=strategy`
- Content & Hooks tab
- Calendar tab
- Visuals tab
- Publish tab
- Autopilot tab
- Performance tab
- mobile viewport

Confirm:

- no fake live or active claim in the top state
- scheduled means real `SCHEDULED + scheduledAt`
- auto-publish is not implied by `autopilotEnabled` alone
- Performance still shows the empty published-performance state when no published posts exist
- no generation, scheduling, publishing, or credit-spending action is triggered

## Follow-Ups

- Adopt the same helper in Content Hub summary surfaces.
- Adopt the same helper in Dashboard / Marketing Intelligence.
- Split Autopilot wording into workflow-enabled vs auto-publish-enabled.
- Update Brand Brain learning inbox copy so pending proposals read as suggestions to review.
- Add generated-content overclaim guards for stored campaign content.
