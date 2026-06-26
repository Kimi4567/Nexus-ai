# LIGHT-D2A Campaign Room Full Light Cleanup

## Objective

Move the full Campaign Room page to a calm, premium, light-first interface while keeping product behavior unchanged.

This PR expands the original Strategy-visible cleanup because review found that dark Campaign Room surfaces remained in adjacent tabs.

## Dark Surfaces Removed

- Campaign header and campaign summary card.
- Progress/status panel above the tabs.
- Campaign Room tab navigation.
- Strategy empty/generating states and Strategy document utility controls.
- Content & Hooks cards:
  - Top Hooks
  - CTA Variations
  - Caption Formulas
  - Script Template
  - Content Angles
- Content Calendar weekly execution cards and monthly platform summary.
- Visuals tab entry cards:
  - Creative Brief
  - Content Hub
  - Paid Planning Pack
  - Visual Direction
  - Campaign Visuals wrapper
  - VisualGenerator cards, metadata, action menu, generating state, and empty state
- Publish tab wrapper, locked-state notice, publisher composer, account selectors, readiness banners, and post history.
- Autopilot header, requirements list, action row, queue table, empty state, and how-it-works card.
- Performance empty state, metric cards, status row, platform breakdown, engagement trend, and top-post cards.

## Truth And Copy Cleanup

- Replaced visible internal quality-agent language with `quality check` / `quality review`.
- Removed the unsafe final publishing-stage label and replaced it with readiness language.
- Replaced misleading approval/activation language in the Strategy shell with content-planning language.
- Added a Publish tab locked-state notice before the publisher controls.
- Disabled the Now/Schedule mode toggle while publishing is locked so scheduling controls do not appear ready.
- Updated Autopilot queue language:
  - `Scheduled content queue` only appears when posts are actually scheduled with scheduled data.
  - otherwise the queue uses `Planned content queue`.
- Analytics now says Meta performance data appears when available.
- Performance empty state now says `No published performance data yet`.
- Completion labels remain only where they map to real persisted post status or performance counts.

## Preserved

- Existing rich Strategy document content and section depth.
- Campaign data, status fields, routing, tab behavior, and generation behavior.
- RunFullStrategyModal and all strategy generation logic.
- Visual generation behavior.
- Social publishing behavior.
- Autopilot API behavior.
- Analytics fetching behavior.

## Files Touched

- `src/app/campaigns/[id]/page.tsx`
- `src/components/SocialPublisher.tsx`
- `src/components/SocialAnalytics.tsx`
- `src/components/VisualGenerator.tsx`
- `docs/LIGHT-D2A-strategy-experience-luxury-light-cleanup.md`

## Intentionally Excluded

- APIs, auth, billing, credits, pricing, publishing endpoints, cron, platform APIs, schema, migrations, and env files.
- RunFullStrategyModal.
- Dashboard and billing pages.
- Platform-native preview cards where dark styling is part of the simulated platform/media preview.
- Full redesign of content generation or campaign workflows.

## Remaining Notes

- Internal function/state names still include legacy terms such as `sentinel` and `launch`. These were not renamed to avoid behavior risk in a visual cleanup PR.
- Real post states may still render completion labels only when backed by persisted post status or analytics summary data.
- Browser QA still depends on a valid authenticated session and accessible campaign data.

## Validation Notes

- Run `git diff --check` on touched files.
- Run dark-style and dangerous-copy scans.
- Run `npm run type-check`.
- Run `npm run build`.
- Browser QA should inspect every Campaign Room tab, mobile viewport, and confirm no generation run or credit spend.
