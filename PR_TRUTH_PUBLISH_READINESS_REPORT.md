# PR: Truth & Publish-Readiness Hardening — Report
**Branch:** `feature/truth-publish-readiness-hardening`
**Date:** 13 June 2026
**Scope rule honored:** no new features, no redesign, no new modules, no pricing change, core credit ledger untouched.

---

## What changed (files)

### New
- `src/components/CreditConfirmModal.tsx` — reusable confirm-before-spend modal.
- `src/lib/campaignSummary.ts` — pure, testable resolver for campaign summary counts.
- `src/lib/__tests__/campaignSummary.test.ts` — 5 regression tests.
- `META_FIRST_PUBLISH_TEST_CHECKLIST.md` — safe first-publish manual checklist.

### Modified
- `src/app/api/campaigns/route.ts` — GET now returns authoritative workspace-wide `counts {total,active,draft}` (filter/limit independent).
- `src/app/campaigns/page.tsx` — summary cards read API counts; added loading skeleton, empty (0), and error states + retry.
- `src/app/billing/page.tsx` — credit display via `formatCreditDisplay`; no more "246 / 150/mo"; bonus explanation line.
- `src/app/dashboard/page.tsx` — credit card uses clamped percent + bonus-aware subtitle (no "246 of 150").
- `src/lib/dbRateLimit.ts` — added `brainLearningCapDb` + `BRAIN_LEARNING_DAILY_CAP` (default 30/workspace/day, env-tunable).
- `src/lib/brain-learning.ts` — enforces the daily cap before the gpt-4o call; logs `SKIP` when capped; keeps `COST` logging.
- `src/app/campaigns/new/page.tsx` — campaign generation (8 cr) gated by `CreditConfirmModal`.
- `src/app/campaigns/[id]/paid-launch/page.tsx` — paid-pack generation (6 cr) gated by `CreditConfirmModal`.
- `src/components/SocialPublisher.tsx` — empty state now also notes Meta App Review may be required + publishing unavailable until connected.
- `src/middleware.ts` — removed legacy NextAuth cookie clause; Supabase-only.
- `src/types/next-auth.d.ts` — neutralized (emptied) — see Auth note below.
- `.env.example` — documented `BRAIN_LEARNING_DAILY_CAP`.

> Note: `src/lib/creditDisplay.ts` + its test pre-existed (uncommitted) and were **wired into the UI** by this PR (previously unused). Strategy generation (8 cr) already had a cost-confirm step in `RunFullStrategyModal`, so it was left as-is.

---

## Acceptance criteria — status

| Criterion | Status |
|---|---|
| /campaigns cards show correct values | ✅ API counts + states; regression test |
| Credit display never overflows | ✅ `formatCreditDisplay` clamps; over-cap shows "N credits" + bonus note; covered by existing over-cap test |
| Expensive actions require confirmation | ✅ Strategy (existing) + Campaign gen (8cr) + Paid pack (6cr) |
| Failed actions still refund credits | ✅ Untouched — modal is a UI gate only; server still deducts/refunds |
| Background learning has daily cap + logs | ✅ `brainLearningCapDb` (30/day) + SKIP/COST logs |
| No new fake/mock features | ✅ |
| `npm run type-check` passes | ✅ `tsc --noEmit` exit 0, zero errors |
| `npm run build` passes | ⚠️ Could not run to completion in the sandbox — see below |
| `npm test` passes | ✅ 201/201 across 23 files |

---

## Verification performed
- **Tests:** `npx vitest run` → **201 passed / 201** (23 files). Was 196/22 before; +5 new campaign-summary tests.
- **Type-check:** `npx tsc --noEmit` → **exit 0, no errors** (`skipLibCheck` is the project default; this is the exact check `npm run type-check` runs, and `next.config` fails the build on type errors).
- **Client/server boundary:** verified no edited client file imports server-only modules (`@/lib/prisma`, `@/lib/credits`, `@/lib/email`). Costs are passed as literals mirroring `CREDIT_COSTS`.
- **ESLint:** `next.config.mjs` has `eslint.ignoreDuringBuilds: true`, so lint does not gate the build.

## What still needs manual verification (by you, on your Mac)
1. **`npm run build`** — I could not run it to completion here: the per-call shell time limit (≤45s) is shorter than this app's full build, and the sandbox can't reach `binaries.prisma.sh` for `prisma generate` (403, network-restricted). Type-check (the build's gating type phase) passes clean and all compile-failure risk factors were checked, but please run the full build before merging.
2. **Visual QA** of the four touched screens: `/campaigns` cards, `/billing` credit line, `/dashboard` credit card, campaign **Publish** tab empty state.
3. **Confirm-modal flow**: open New Campaign → Generate (should show "8 credits / balance after"), and Paid Launch → Generate (6 credits). Cancel must NOT spend; confirm proceeds.

## Auth cleanup note
NextAuth is functionally dead (no `useSession`/`getServerSession`/`authOptions`/`[...nextauth]`). `src/types/next-auth.d.ts` could **not be filesystem-deleted** in this environment, so it was emptied (`export {}`, augmentation removed). **Action for you:** `git rm src/types/next-auth.d.ts` and optionally drop `next-auth` from `package.json` in a follow-up dependency-cleanup PR.

## Risks
- **Low.** No schema migration, no change to credit deduction/refund core, no pricing change.
- Credit-cost literals in the two client pages (8, 6) must stay in sync with `CREDIT_COSTS` in `src/lib/credits.ts` (server remains the source of truth and the real deductor). Comments flag this at each site.
- Removing the legacy NextAuth cookie clause means a hypothetical user holding only an old NextAuth cookie won't be auto-redirected from the login page (cosmetic only; real protection is client-side). Practically nil given the Supabase migration.

## Not touched (per instructions)
Pricing, core credit ledger logic, unrelated pages, publishing/auto-publish behavior, and no real publish/connect/spend was performed.

## To ship
This branch is **not committed/pushed** — the sandbox `.git` is permission-locked (your usual flow: commit & push from your Mac, merge via GitHub web). On your Mac: review the diff, run `npm run build`, then commit/push.
