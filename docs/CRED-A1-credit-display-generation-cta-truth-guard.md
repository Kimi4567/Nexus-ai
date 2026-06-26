# CRED-A1 — Credit Display and Generation CTA Truth Guard

## Objective

Make credit display and generation entry points truth-safe when a user has no available credits.

## Observed Issue

The Sidebar could show "No credits left" while Content Hub still showed active-looking generation actions such as "Generate Images" and "Regenerate Plan." Backend credit checks still protected the spend, but the UI created a trust contradiction.

## Source Of Truth Summary

- Runtime display and default credit spending continue to use `User.aiCredits`.
- `CreditGrant` rows remain a wallet foundation / flag-gated path and are not the default display source.
- `/api/billing/status` now displays the same first-time starter balance that the existing spend path grants on first use, only for inactive FREE users who have no stored credits and no prior monthly generations.
- `/api/user/credits` now uses the same starter-credit constant for the Strategy modal balance display.

## Files Touched

- `src/app/api/billing/status/route.ts`
- `src/app/api/user/credits/route.ts`
- `src/lib/creditActionTruth.ts`
- `src/lib/__tests__/creditActionTruth.test.ts`
- `src/app/campaigns/[id]/content-hub/page.tsx`
- `src/components/VisualGenerator.tsx`
- `src/app/campaigns/[id]/creative-brief/page.tsx`

## Display-Only Starter Credit Alignment

First-time free users with no active subscription, `subscriptionStatus === 'FREE'`, `aiCredits === 0`, and `monthlyGenerations === 0` are shown the existing starter credit amount. This does not mutate the database and does not grant credits from the status endpoint.

## Generation CTA Gating Rules

- Content plan generation uses `CONTENT_PLAN_GENERATION`.
- Image generation uses `IMAGE_GENERATION`.
- Creative Brief generation uses `CREATIVE_BRIEF`.
- Unaffordable actions switch to Add credits copy and route to Billing before any generation API call.
- Backend `checkAndDeductCredits()` remains the final source of truth.

## Intentionally Not Changed

- No credit deduction or refund logic changed.
- No CreditGrant wallet behavior changed.
- No Stripe checkout, webhook, schema, migration, or env behavior changed.
- No generation prompts, publishing, scheduling, cron, or platform API behavior changed.
- Existing dirty dashboard and billing page work stayed out of scope.

## Validation

- `git diff --check` on touched files.
- `npm run test -- src/lib/__tests__/creditActionTruth.test.ts`
- `npm run type-check`
- `npm run build`
- Source scan for credit/generation CTA copy.

## QA Plan

- Confirm Sidebar no longer labels first-time starter users as out of credits.
- Confirm zero-credit Content Hub generation CTAs are locked/secondary and route to Billing.
- Confirm per-post image generation cannot call the API while locked.
- Confirm VisualGenerator generate/regenerate actions are blocked while locked.
- Confirm Creative Brief generation/regeneration actions are blocked while locked.
- Confirm RunFullStrategyModal behavior remains unchanged.
- Confirm mobile layouts have no horizontal overflow.

## Remaining Risks

- If `CREDIT_WALLET_ENABLED` is turned on and `User.aiCredits` falls out of sync with active `CreditGrant` rows, the display may still reflect the scalar cache.
- Backend 402 responses remain the final protection against race conditions or stale client state.
- This PR does not address broader credit history, Stripe, or grant-ledger migration work.
