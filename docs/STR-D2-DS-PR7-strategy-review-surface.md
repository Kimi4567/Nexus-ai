# STR-D2 / DS-PR7 Strategy Review Surface

## Objective

Create a dedicated read-only strategy review surface so users can understand a generated strategy as a marketing brief before moving to content planning.

## Route Approach

- Added `/strategy/[campaignId]`.
- Kept `/strategy` as the create/update workstation from DS-PR6.
- Updated `/strategy` so draft and existing strategies link to the dedicated review route when a campaign id is available.

## Data Source

- Reads existing campaign data from `GET /api/campaigns`.
- Uses `campaign.aiOutput.strategy` when present, otherwise falls back to existing top-level `aiOutput` fields.
- Uses existing campaign fields such as name, status, goal, audience, platforms, and updated timestamp.

## Missing Data Handling

Missing strategy fields render honest limited states such as:

- “Not included in this strategy draft”
- “No paid plan generated yet”
- “Analytics not connected”
- “Auto-publishing not enabled”

## Safety Boundaries

- No strategy generation changes.
- No `/api/strategy/run-full` changes.
- No credit, billing, auth, campaign creation, publishing, cron, platform, schema, migration, or environment changes.
- No `RunFullStrategyModal` changes.
- No persisted approval system was added.

## Review Sections

- Strategy header and source
- Executive direction
- Audience and positioning
- Organic plan
- Paid planning as planning-only
- Readiness and limits
- Next action into Content Hub

## Follow-Ups

- Add a persisted strategy review state only after the product model supports it.
- Add a first-class strategy detail API if the campaign list endpoint becomes too broad for this route.
- Re-test Arabic locale switching once the app-level language toggle is reliable in browser QA.
