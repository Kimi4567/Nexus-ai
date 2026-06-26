# LIGHT-D2A Strategy Experience Luxury Light Cleanup

## Objective

Move the Strategy experience away from the remaining dark campaign-room shell and toward a calm, premium, light-first client strategy workspace.

This PR is intentionally Strategy-focused. It does not attempt to clean the full Campaign Room.

## Audit Findings

- The rich Strategy document body was already light-first from STR-DESIGN-1 and should be preserved.
- The visible shell above the Strategy tab still used dark campaign-room styling:
  - campaign hero/header card
  - progress/status panel
  - tab navigation
  - strategy empty/generating states
  - small reusable buttons inside the Strategy document
- The visible progress/status panel used risky language including internal quality-agent naming, approval wording, and a final live-stage label.
- Older dark UI still remains in other Campaign Room tab bodies and operation controls. Those are out of scope for this Strategy-only cleanup.

## Changes Made

- Converted the campaign header into a light campaign summary card with soft borders, slate text, and a calm status badge.
- Converted the Strategy-visible progress/status panel to a light truth-safe panel.
- Replaced risky Strategy-stage wording:
  - `Generate` -> `Strategy generated`
  - `Review` -> `Quality check`
  - `Approve` -> `Content planning`
  - the final publishing stage now uses `Publishing not enabled` or `Publishing configured`
- Replaced user-facing internal quality-agent wording with `quality check` / `review quality`.
- Updated the tab bar to a light segmented navigation treatment.
- Updated the Strategy empty/generating states to light surfaces.
- Updated small Strategy document copy/save controls to light surfaces.

## Preserved

- The existing rich Strategy document content and section depth.
- Campaign data, status fields, routing, tab behavior, and generation behavior.
- RunFullStrategyModal and all strategy generation logic.
- Content Hub, calendar, visuals, publish, autopilot, and performance tab bodies.

## Intentionally Excluded

- Full Campaign Room light conversion.
- Content & Hooks tab body cleanup.
- Content Calendar tab body cleanup.
- Visuals, Publish, Autopilot, and Performance tab body cleanup.
- Dashboard and billing pages.
- APIs, auth, billing, credits, pricing, publishing, cron, platform APIs, schema, migrations, and env files.

## Risks And Notes

- `src/app/campaigns/[id]/page.tsx` still contains legacy dark classes and older operation language outside the Strategy-visible shell. Those should be handled in later Campaign Room cleanup PRs.
- Some internal function/state names still reference legacy workflow terms. They were not renamed to avoid behavior risk in this visual/copy PR.
- The existing behavior for content-plan generation and campaign status transitions was intentionally left unchanged.

## Validation Notes

- Run `git diff --check` on touched files.
- Run the requested dangerous-copy/dark scan and report remaining matches with scope notes.
- Run `npm run type-check`.
- Run `npm run build`.
- Browser QA should confirm:
  - `/strategy`
  - Review strategy opens `/campaigns/{campaignId}?tab=strategy`
  - the campaign Strategy tab shell is light
  - the rich Strategy document remains intact
  - no generation run
  - no credits spent
  - mobile viewport has no horizontal overflow
