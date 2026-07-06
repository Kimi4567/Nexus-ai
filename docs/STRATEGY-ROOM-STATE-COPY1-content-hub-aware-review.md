# STRATEGY-ROOM-STATE-COPY1 - Content Hub-aware Strategy Review Copy

## Problem

The Campaign Strategy tab can be used both before and after Content Hub posts exist.
When posts already exist, copy such as "Before Content Hub checklist" and "before preparing the first content plan" becomes stale and makes the Campaign Room feel patched together.

## Product truth

- Strategy is a decision and reference surface.
- Content Hub is the source of truth for final post review, lifecycle, and media state.
- If Content Hub posts already exist, the Strategy tab should guide review of the current direction before editing or approving existing content.
- If no Content Hub posts exist, the Strategy tab may guide the user toward preparing the first content plan.
- Paid-only strategy remains a planning review surface and must not imply launch, spend, publishing, or account readiness.

## Implementation

- Added state-aware copy for the Strategy review checklist.
- Paid-only strategy shows a paid planning review checklist.
- Campaigns with Content Hub posts show a Strategy review checklist.
- Campaigns without Content Hub posts still show the Before Content Hub checklist.

## Boundaries

This change does not:

- generate strategy or content
- mutate campaign data
- change credits
- approve, schedule, publish, or manually publish
- activate Autopilot
- update Brand Brain
- change paid launch, platform push, media, engine, schema, billing, dashboard, or PR #164
