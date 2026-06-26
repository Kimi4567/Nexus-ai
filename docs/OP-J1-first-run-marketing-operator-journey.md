# OP-J1 — First-run Marketing Operator Journey Router

## Objective

Make the first-run path coherent and truth-safe:

Signup / login -> onboarding or Brand Brain -> Strategy entry -> one clear next best action.

This PR keeps the real strategy generation journey unchanged:

Brand Brain -> `/strategy` -> existing `RunFullStrategyModal` -> cost confirmation -> `/api/strategy/run-full` -> `/campaigns/{campaignId}?tab=strategy`.

## Current Problem

The first-run experience had several competing state models:

- login defaulted to `/dashboard`;
- auth context routed only by workspace existence;
- onboarding skipped when any workspace existed;
- onboarding summary treated starter memory as full readiness;
- dashboard rendered multiple beginner surfaces;
- some first-run copy implied publishing, live status, or automated learning too early.

## Files Touched

- `src/lib/firstUserJourney.ts`
- `src/lib/dashboardOnboarding.ts`
- `src/lib/auth-context.tsx`
- `src/app/auth/login/page.tsx`
- `src/app/auth/register/page.tsx`
- `src/app/onboarding/page.tsx`
- `src/app/dashboard/page.tsx`
- `src/components/MarketingJourneyBar.tsx`
- `src/components/OnboardingChecklist.tsx`
- `src/app/brand/page.tsx`
- `src/app/strategy/page.tsx`

## State Contract

`src/lib/firstUserJourney.ts` now exposes a pure `getFirstRunJourney()` helper. It does not call APIs and only derives UI decisions from existing signals supplied by each page.

States:

- `no_workspace`
- `brand_missing`
- `brand_partial`
- `brand_ready_for_initial_strategy`
- `strategy_missing`
- `strategy_draft_ready`
- `content_plan_missing`
- `execution_ready_later`

Each state returns a safe title, helper text, CTA label, CTA href, and blockers.

## Routing Behavior

- Safe internal redirect params are still respected by `/auth/login`.
- Without a redirect, login now checks existing workspace, Brand Brain readiness, and available dashboard stats before choosing a destination.
- Users with no workspace go to `/onboarding`.
- Users with workspace but missing or partial Brand Brain go to `/brand`.
- Users ready for first strategy go to `/strategy`.
- Users past first-run execution readiness can continue to `/dashboard`.
- Existing workspace users no longer get silently treated as fully onboarded by `/onboarding`.

## Copy Changes

- Register no longer promises social publishing immediately.
- Onboarding uses "Platforms you currently use" instead of "Active platforms".
- Onboarding summary says starter Brand Brain was saved, not fully completed.
- Dashboard badge says "Workspace" instead of "LIVE".
- Dashboard first-run insight says analytics/performance insights instead of internal agent labels.
- Dashboard alert empty state avoids internal monitoring-agent copy.
- Old checklist copy no longer claims real execution or analytics-based learning before those signals exist.
- Brand and Strategy readiness labels are capability-specific.
- Strategy uses conservative publishing-automation language with "Not enabled".

## Intentionally Not Changed

- No API changes.
- No schema, migration, or env changes.
- No billing, credits, or pricing changes.
- No publishing, cron, or platform API changes.
- No generation logic changes.
- No `RunFullStrategyModal` behavior changes.
- No Campaign Room Strategy tab changes.

## Validation Notes

Required validation:

- `git diff --check` on touched files.
- `npm run type-check`.
- `npm run build`.
- Broad trust-copy scan across auth, onboarding, Brand, dashboard, Strategy, shared lib, and components.
- Targeted journey scan for first-run surfaces.

Remaining scan matches should be classified as internal enum/status, tests/comments, or truth-backed copy.

## QA Plan

- `/auth/register`: success copy does not promise publishing.
- `/auth/login`: safe redirect behavior and coherent no-workspace/Brand/Strategy routing.
- `/onboarding`: starter Brand Brain setup, no fake full readiness, no publishing/ads overclaim.
- `/brand`: partial Brand Brain copy is capability-specific.
- `/dashboard`: one first-run next action, no LIVE badge, no internal agent labels in first-run surfaces.
- `/strategy`: existing modal opens normally; no generation run and no credits spent.
- Mobile QA for `/onboarding`, `/brand`, `/dashboard`, and `/strategy`.
