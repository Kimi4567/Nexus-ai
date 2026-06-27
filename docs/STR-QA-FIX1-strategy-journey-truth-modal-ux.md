# STR-QA-FIX1 Strategy Journey Truth + Modal UX Fixes

## Scope

This PR fixes truth and UX issues found during the fresh-account strategy QA journey.

Touched files:

- `src/components/RunFullStrategyModal.tsx`
- `src/app/campaigns/[id]/page.tsx`
- `docs/STR-QA-FIX1-strategy-journey-truth-modal-ux.md`

## What Changed

- Converted the visible `RunFullStrategyModal` shell, selection controls, cost confirmation, running state, and media-check state to a light-first surface.
- Made the modal scroll-safe with a `90vh` max height and internal scrolling so the close button, content, and CTA remain reachable.
- Removed the misleading insufficient-credit display that showed a zero post-run balance when the user could not afford the strategy.
- Added explicit insufficient-credit copy:
  - English: "You need X more credits to run this strategy."
  - Arabic: "تحتاج X كريديت إضافية لتشغيل هذه الاستراتيجية."
- Clarified that selected content-intensity ranges are planning ranges and that plan caps limit the generated first 30 days.
- Clarified that full/paid strategy output is planning-only when Brand Brain lacks paid budget, KPI, conversion, or tracking data.
- Replaced visible internal Campaign Room labels for content and calendar workflow tabs.
- Made the Campaign Room Autopilot checklist conservative when this page has no verified publishing connection data.
- Kept the Autopilot activation CTA secondary/disabled unless local requirements are met.

## What Did Not Change

- No `/api/strategy/run-full` changes.
- No strategy generation prompt changes.
- No credit deduction, refund, pricing, or billing logic changes.
- No schema, migration, or environment changes.
- No publishing, scheduling, cron, platform API, or Autopilot API changes.
- No content-plan generation, visual generation, creative brief generation, approval, scheduling, publishing, or Autopilot activation behavior changes.

## Remaining Notes

Some observed overclaims can exist inside previously generated campaign content. This PR does not mutate stored AI output or rewrite generated campaign documents globally. Generated-content truth cleanup should be handled by a separate prompt/output-quality item.

The Campaign Room still needs a future platform-readiness integration so Autopilot can show verified connection state instead of staying conservative in this page.

## Validation Plan

- `git diff --check` on touched files.
- Required dangerous-copy scan on touched files.
- `npm run type-check`.
- `npm run build`.
- Authenticated browser QA for `/strategy` and the existing campaign room tabs, without running generation or spending credits.
