# DS-PR3 AppShell & Navigation IA

## Scope

DS-PR3 focuses only on the authenticated shell and primary navigation information architecture. It does not redesign product pages, alter routes, or change business logic.

## Pre-flight finding

The previously observed `/dashboard` state where the browser remained on `Checking your workspace...` was reproduced as a local QA concern before this UI work started. On the DS-PR3 pre-flight run, the shell resolved successfully after slow local compilation and API loading.

Observed locally:

- `/dashboard` returned `200`.
- Workspace, dashboard, brand, campaign, social account, billing, and brain proposal API requests returned `200` in the Next.js dev log.
- Browser console showed no errors or warnings.
- The authenticated dashboard shell rendered with the sidebar and `Welcome, Raouf`.

Conclusion: this did not block DS-PR3 visual QA. It appears to be a local first-load/session timing limitation rather than a sidebar/AppShell code defect. No dashboard page, auth, API, or backend logic was changed.

## Primary Navigation

Primary navigation is grouped by user workflow:

- Plan: Home, Brand Brain, Strategy
- Produce: Campaigns, Content Hub, Calendar, Media Library
- Operate: Connections
- Learn: Analytics
- Account: Billing, Settings

## Hidden From Primary Navigation

The following routes remain intentionally out of primary navigation until they are mature enough to present as real user-facing workflows:

- `/studio`
- `/sentinel`
- `/vex`
- `/paid-campaigns`
- `/templates`
- `/brand/score-history`

## Non-goals

- No page redesigns.
- No route behavior changes.
- No auth, API, billing, credits, publishing, cron, schema, migration, or env changes.
- No DS-PR4 work.
