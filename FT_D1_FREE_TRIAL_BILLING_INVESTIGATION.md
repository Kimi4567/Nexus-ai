# FT-D1 Free Trial / Billing First-Run Investigation

## Executive Verdict

A fresh account can visually read as `No credits left - PRO` because the authenticated app sidebar combines two independent UI states:

- `No credits left` comes from the sidebar's empty-credit state after `useBillingStatus()` receives `credits.remaining = 0`.
- `PRO` is a hardcoded upgrade badge shown for any non-paid user. It does not mean the user is actually on a Pro/Growth subscription.

The strongest root cause is a mismatch between first-run credit presentation surfaces:

- `/api/billing/status`, the sidebar, and dashboard stats use raw `User.aiCredits`.
- New users default to `aiCredits = 0`.
- `/api/user/credits` has a separate first-run display fallback that shows complimentary credits for a new free user.
- Real starter credits are lazily granted only when the user first attempts an AI action through credit deduction logic.

This is most likely a UI/API consistency and first-run presentation bug, not evidence that a new user has been upgraded to PRO or that Stripe/billing state changed.

## Exact Source of `No credits left - PRO`

### Rendering Surface

File: `src/components/Sidebar.tsx`

The message appears in the global authenticated sidebar, not specifically in the `/brand` page body. `/brand` is wrapped by the authenticated app shell, which renders the sidebar.

Relevant logic:

- `Sidebar` calls `useBillingStatus()`.
- `useBillingStatus()` returns:
  - `creditsRemaining`
  - `creditsMax`
  - `isUnlimited`
  - `isPaid`
  - `isLow`
  - `isEmpty`
  - `billingLoading`
- The sidebar renders `No credits left` when:
  - billing is no longer loading;
  - the account is not unlimited;
  - `creditsRemaining <= 0`;
  - therefore `isEmpty === true`.
- The sidebar renders a `PRO` badge when:
  - `!isPaid`;
  - regardless of whether the account is actually Pro.

### Data Source

File: `src/lib/useBillingStatus.ts`

`useBillingStatus()` fetches:

- `/api/billing/status`

It derives:

- `creditsRemaining = status?.credits?.remaining ?? 0`
- `creditsMax = status?.credits?.max ?? 15`
- `isPaid = status?.hasActiveSubscription ?? false`
- `isEmpty = !loading && !isUnlimited && creditsRemaining <= 0`

If the billing status endpoint returns zero remaining credits for a new free user, the sidebar enters the empty state.

### Billing Status Endpoint

File: `src/app/api/billing/status/route.ts`

The endpoint reads the Prisma `User` record and returns raw credit balance:

- `credits.remaining = dbUser.aiCredits ?? 0`
- `hasActiveSubscription = isActive`
- `plan = isActive ? planRaw : 'free'`

For a newly created free user with default `aiCredits = 0`, this endpoint reports zero remaining credits.

## What `PRO` Means There

`PRO` in the sidebar is not a verified billing plan label.

It is a hardcoded upgrade badge shown for users where `isPaid` is false. In this context it means "upgrade to Pro" or "paid plan CTA", but because it sits beside `No credits left`, it can be read as an active account status: "No credits left - PRO".

Findings:

- The user is not necessarily on PRO.
- The badge is not sourced from Stripe, Prisma `Subscription.plan`, or the canonical plan display helper.
- The label is presentation-only and can be misleading.
- The canonical credit display helper maps internal `pro` to the user-facing `Growth`, so this sidebar badge also bypasses newer plan naming conventions.

## Free Trial Credit Initialization

### User Creation

File: `src/lib/apiAuth.ts`

`ensureDbUser(req)` upserts a Prisma `User` with identity fields only:

- `id`
- `email`
- `name`

It does not initialize credits.

### Prisma Defaults

File: `prisma/schema.prisma`

The `User` model defaults include:

- `subscriptionStatus = FREE`
- `aiCredits = 0`
- `monthlyGenerations = 0`

### Workspace / Onboarding

File: `src/app/api/workspaces/route.ts`

Workspace creation uses `ensureDbUser()` and creates workspace records. It does not grant free trial credits.

### Lazy Starter Credit Grant

File: `src/lib/credits.ts`

Starter credits are granted lazily during the first AI credit check/deduction path:

- `FREE_STARTER_CREDITS = 10`
- For a first-time free user with:
  - `subscriptionStatus === 'FREE'`
  - `aiCredits === 0`
  - `monthlyGenerations === 0`
- the transaction sets `User.aiCredits = FREE_STARTER_CREDITS`
- it also creates an idempotent trial `CreditGrant`
- then it deducts the requested AI action cost.

Conclusion: a new account does not appear to receive real trial credits at signup, onboarding, workspace creation, or first page load. Credits are effectively initialized on first AI spend/action.

## `/api/user/credits` Behavior

File: `src/app/api/user/credits/route.ts`

Behavior:

- Unauthenticated request returns `401`.
- Authenticated request loads the Prisma `User`.
- Missing user returns `404`.
- Unlimited/active users return unlimited semantics.
- New free users receive a presentation fallback:
  - `FREE_COMPLIMENTARY_RUNS = 3`
  - if `subscriptionStatus === 'FREE'`, `aiCredits === 0`, and `monthlyGenerations === 0`, the endpoint returns `creditsRemaining = 3`.

Response shape includes:

- `creditsRemaining`
- `subscriptionStatus`
- `monthlyGenerations`
- `isUnlimited`
- `isFree`

Important mismatch: this endpoint may show a new free user as having 3 available complimentary runs, while `/api/billing/status` shows the same user as having 0 raw credits.

## `/brand` and `/dashboard` Credit Display

### `/brand`

The `/brand` page itself is not the source of the exact message. The visible string comes from the authenticated sidebar rendered by the app shell.

Flow:

- `/brand`
- authenticated app shell
- `Sidebar`
- `useBillingStatus()`
- `/api/billing/status`
- raw `User.aiCredits`
- empty state + upgrade badge

### `/dashboard`

Files:

- `src/app/api/dashboard/stats/route.ts`
- `src/app/dashboard/page.tsx`

The dashboard stats route also reads raw `User.aiCredits`. It calculates the free monthly total from plan configuration, but the remaining value is still the raw database balance.

For a new free user, this can produce a display like zero remaining credits against a free-plan total, and may trigger low-credit messaging before the user has generated anything.

### Shared Display Helpers

File: `src/lib/creditDisplay.ts`

The project has safer credit display helpers, including canonical plan naming that maps internal `pro` to `Growth`. The sidebar does not appear to use these helpers for this CTA.

## Data Flow

1. User signs in with Supabase Auth.
2. `ensureDbUser()` creates or updates the Prisma user.
3. Prisma defaults the account to `subscriptionStatus = FREE`, `aiCredits = 0`, `monthlyGenerations = 0`.
4. Onboarding/workspace creation does not grant credits.
5. `/brand` renders the authenticated app shell.
6. The sidebar calls `/api/billing/status`.
7. `/api/billing/status` returns raw `aiCredits = 0`, `hasActiveSubscription = false`, `plan = free`.
8. `useBillingStatus()` derives `isEmpty = true` and `isPaid = false`.
9. The sidebar renders `No credits left` and a separate `PRO` upgrade badge.
10. Separately, `/api/user/credits` would present a new free user as having 3 complimentary credits.
11. The first AI action path can lazily grant 10 starter credits and then deduct usage.

## Root Cause Candidates Ranked

1. High likelihood: Sidebar presentation bug. The sidebar combines an empty-credit warning with a hardcoded `PRO` upgrade badge for non-paid users, creating misleading copy.
2. High likelihood: Credit API inconsistency. `/api/billing/status` and dashboard stats use raw `User.aiCredits`, while `/api/user/credits` has first-run virtual complimentary credit presentation.
3. Medium likelihood: Lazy credit initialization. If the intended product truth is "new users already have trial credits", the grant currently happens too late for first-run UI surfaces.
4. Medium-low likelihood: Plan label bug. `PRO` is not the user's actual plan in this state; it is a CTA badge. It bypasses canonical `Growth` naming.
5. Low likelihood: Production-only stale state. The issue is reproducible by code path for any fresh free user with `aiCredits = 0` and no generations, so it is not primarily a stale preview or test-account artifact.

## Could This Be Preview / Local / Test-Account Specific?

It could be observed in preview, local, or production, but the underlying condition is not environment-specific:

- a newly created free user defaults to zero raw credits;
- the sidebar reads raw billing status;
- the sidebar shows the empty-credit state;
- the non-paid upgrade badge reads `PRO`.

A partially created user or failed onboarding could also show the same state because the sidebar only needs an authenticated user record with zero raw credits and no active subscription.

## Trust / Product Impact

A new user who sees `No credits left - PRO` may reasonably conclude:

- their account is already blocked;
- the free trial did not work;
- they are somehow on PRO but have no credits;
- NEXUS may be pushing payment before demonstrating value.

This is a first-run trust issue. It does not necessarily block system functionality, because the first AI action may lazily grant starter credits, but the presentation can damage confidence before the user reaches that point.

Safer product wording for unavailable or uninitialized first-run credits should avoid scarcity language before any usage. Examples:

- `Free trial credits ready`
- `Credits activate on your first AI action`
- `Free plan`
- `Checking credits...` while loading

Avoid showing `No credits left` for a brand-new free user who has not generated anything.

## Immediate Hotfix Recommendation

Recommended next action: A) tiny hotfix.

The safest minimal fix is display-only:

- Do not render `No credits left` in the sidebar for a non-paid first-run/free user whose raw credits are zero but who has no usage yet.
- Replace the hardcoded `PRO` badge with a clearer upgrade CTA label, or remove it from the empty-credit state.
- Prefer shared display helpers such as `formatCreditDisplay()` and `getPlanDisplayName()` where possible.

If the product decision is that trial credits must be real immediately at signup or onboarding, that should become a larger billing/trial PR. That would touch credit initialization, ledger behavior, and idempotency rules, and should not be mixed into a display hotfix.

## Files Likely Involved

- `src/components/Sidebar.tsx`
- `src/lib/useBillingStatus.ts`
- `src/app/api/billing/status/route.ts`
- `src/app/api/user/credits/route.ts`
- `src/app/api/dashboard/stats/route.ts`
- `src/app/dashboard/page.tsx`
- `src/lib/credits.ts`
- `src/lib/creditDisplay.ts`
- `src/lib/apiAuth.ts`
- `src/app/api/workspaces/route.ts`
- `prisma/schema.prisma`

## Tests Needed

- Sidebar render test for a fresh free account state:
  - `hasActiveSubscription = false`
  - `credits.remaining = 0`
  - no output that visually combines `No credits left` with `PRO`
- Billing status route test for a new free user with zero raw credits.
- Dashboard stats/display test for a new free user before first generation.
- Regression test that internal `pro` continues to display as `Growth` in user-facing plan naming.
- Credit grant test coverage should remain separate if changing real initialization timing.

## Risks

- A copy-only sidebar hotfix may still leave dashboard and API surfaces inconsistent.
- Granting real credits earlier could create double-grant risk unless coordinated with `checkAndDeductCredits()` and `CreditGrant` idempotency.
- Wallet/ledger code appears partly transitional; changing it without a dedicated billing PR could introduce accounting drift.
- Changing Stripe plan or subscription behavior is unnecessary for this issue and would increase blast radius.

## What Must Not Be Changed In This Investigation

- Production user data.
- Stripe or billing provider state.
- Credit economics.
- Credit deduction/refund behavior.
- Credit ledger or wallet schema.
- Database schema or migrations.
- Environment variables.
- Platform connections.
- Analytics/PULSE behavior.
- AI generation, publishing, scheduling, sending, ads, or budget actions.

## Investigation Conclusion

The issue is best classified as expected raw first-run data with bad presentation and inconsistent credit APIs.

The immediate user-facing problem can likely be solved with a tiny display hotfix. The deeper product decision is whether free trial credits should remain lazily granted on first AI action or be initialized as real credits earlier in the account lifecycle.
