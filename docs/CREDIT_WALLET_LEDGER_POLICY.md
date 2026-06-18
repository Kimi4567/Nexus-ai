# Credit Wallet Ledger & Expiry Policy — Design & Audit (B1a)

**Status:** Design / audit only. **No runtime code, schema, billing, deduction, renewal, or UI changes are made by this document or the PR that introduces it.**
**Track:** Billing / Credit Wallet (B1). This is **B1a** — the design doc that the implementation PRs (B1b–B1g) will follow.
**Baseline commit:** `main` @ 151d412 (after the S1c strategy pricing/enforcement track shipped).

---

## Approved product policy

1. Monthly plan credits **reset each billing cycle**.
2. Unused monthly plan credits **do not roll over**.
3. Purchased extra credits remain valid for **12 months**.
4. Trial credits expire after **14 days**.
5. Purchased credits **must survive monthly renewals**.
6. Monthly renewal **must not stack** unused monthly credits.
7. Reviewing options spends **0 credits**.
8. Credits are deducted **only on explicit user actions**.
9. Refunds are **exact and source-aware** where possible.
10. **Unlimited** users must remain safe.

**Approved deduction order:** **soonest-expiry-first** (preferred over strict monthly-first — it protects the user from losing credits that expire sooner; it still naturally spends monthly credits before purchased ones).

**Approved policy copy**
- **English:** "Monthly plan credits reset each billing cycle and do not roll over. Extra purchased credits remain valid for 12 months."
- **Arabic:** "كريدت الباقة الشهرية يتجدد مع كل دورة دفع ولا يتم ترحيله. الكريدت الإضافي الذي تشتريه يبقى صالحًا لمدة 12 شهرًا."

---

## A. Current credit architecture

Credits are a **single integer** on the user: `User.aiCredits Int @default(0)` (`prisma/schema.prisma:39`). `-1` is the **unlimited** sentinel. `User.monthlyGenerations Int` is a lifetime spend counter.

There is **no bucket, no credit type, no expiry, and no per-grant tracking**. A `CreditTransaction` model exists (`schema.prisma:488`) — a signed-amount **immutable audit log** (`action`, `description`, `amount`, `entityId/entityType`, `createdAt`) — but **the live balance is never derived from it**; it is history only, read by `getCreditHistory()` / `getUsageSummary()` / `getMonthlyActivity()` in `src/lib/credits.ts`.

Other relevant models: `Subscription` (`monthlyCredits`, `currentPeriodStart/End`, `status`) and `Usage` (monthly aggregate). **No `CreditGrant` model exists. No expiry column exists anywhere.**

`addCredits(userId, amount, ...)` (referral +20, admin top-ups) simply **increments `aiCredits`** with no type and no expiry.

## B. Current billing / renewal architecture

Provider: **Stripe** (`src/lib/stripe.ts`), gated by `isBillingConfigured()` (`STRIPE_SECRET_KEY` + `NEXT_PUBLIC_BILLING_ENABLED`). Plan → credit map: `PLAN_CREDITS` (Free 10, Starter 50, Growth/PRO 150, Agency/BUSINESS 500).

Webhook `/api/billing/webhook`:
- `checkout.session.completed` / `customer.subscription.updated` → `provisionSubscription()` **sets `aiCredits = plan allowance`** (overwrite) when active.
- `invoice.payment_succeeded` (renewal) → **`aiCredits = creditsForPlan(plan)`** (overwrite).
- `customer.subscription.deleted` → **`aiCredits: 0`**.
- `invoice.payment_failed` → status `PAST_DUE`.

Monthly cron `/api/cron/reset-credits` → **sets `aiCredits = PLAN_CREDITS[plan]`** for all `ACTIVE` paid subscriptions.

Checkout (`/api/billing/checkout`) is **subscription-only** (`mode: 'subscription'`, body `{plan}`). **There is no one-time "buy extra credits" / credit-pack path today.**

## C. Current credit UI

- Dashboard "AI Credits" card and sidebar chip (`AI Credits 132 / 150`, `132 credits left` / `رصيد متبقي`).
- `/api/user/credits` and `/api/billing/status` feed these.
- A `/billing` page exists (Stripe checkout success/cancel return here).
- `src/components/CreditHistoryModal.tsx` renders the `CreditTransaction` ledger.

**Not shown anywhere today:** reset date, expiry date, or a monthly-vs-purchased-vs-trial breakdown.

## D. Current transaction / refund architecture

`checkAndDeductCredits(userId, action, costOverride?)` (`src/lib/credits.ts`): resolves cost from `CREDIT_COSTS[action]` or the S1c-2 `costOverride`; unlimited (`-1`) → no charge, `creditsUsed:0`; first-time FREE users granted 10; **atomic** `prisma.user.updateMany({ where:{ id, aiCredits:{ gte:cost } }, data:{ aiCredits:{ decrement:cost } } })` race guard; writes a `CreditTransaction` debit + `Usage` upsert (both non-blocking); low-credit email. Insufficient → `{ ok:false, error:'INSUFFICIENT_CREDITS' }` (HTTP 402).

Refunds: `refundCredits(userId, action)` increments by the **fixed** `CREDIT_COSTS[action]`; the run-full route instead refunds the **exact variable amount** via `increment: credit.creditsUsed` (with a comment forbidding `refundCredits` for the variable path). Both operate on the single `aiCredits` field — exact in **amount**, but with no notion of credit **type/source**.

## E. Problems with a single `User.aiCredits`

1. **Renewal, monthly reset, and cancel all OVERWRITE `aiCredits`** to the plan allowance (or 0). Any purchased or referral credits would be **silently erased**.
2. **No type distinction** — cannot express "monthly resets / purchased persists 12 mo / trial expires in 14 days."
3. **No expiry** — 12-month purchased validity and 14-day trial expiry are unrepresentable.
4. **Refunds cannot target the right pool** — everything is one number, so a refund can't restore the specific grant it came from.
5. **Cron + webhook both reset** the same field (double source of truth); the cron also has odd `?? 300/1000` fallbacks.
6. **Referral/admin bonuses are already at risk** — they increment `aiCredits` and would be wiped on the next renewal/reset.

## F. Why the renewal overwrite is dangerous *before* purchased packs

The instant a user can buy a 12-month credit pack, those credits live in the **same `aiCredits` integer** that `invoice.payment_succeeded`, the reset cron, and `subscription.deleted` all **overwrite**. The user's next renewal (or the 1st-of-month cron, or a cancel) would **destroy paid-for credits** — a refund/billing incident and a trust breach.

**Therefore the renewal/reset/cancel logic must become grant-aware (B1d) BEFORE any purchased-pack path ships (B1e).** This ordering is a hard requirement of this design.

## G. Buckets vs CreditGrant ledger

| | Option 1 — scalar buckets | Option 2 — CreditGrant ledger |
|---|---|---|
| Shape | `monthly/purchased/trial Remaining + …ResetAt/ExpiresAt` columns on User | one row per grant (`type/amount/remaining/expiresAt/source`) |
| Per-grant expiry | one expiry per bucket only | native, unlimited grants |
| Extensibility (4th type, packs of different sizes) | rigid (schema change per type) | additive (new `type` value/rows) |
| Refund-to-source | approximate (bucket-level) | exact (grant id) |
| Auditability ("which grant expired/funded this spend") | none | full |
| Implementation size | smaller | larger |

**Decision (approved): CreditGrant ledger (Option 2)** — scalable and transparent, and the only model that cleanly supports per-grant 12-month / 14-day expiry and source-aware refunds.

## H. Recommended final CreditGrant model

```prisma
enum CreditGrantType   { MONTHLY  PURCHASED  TRIAL  REFERRAL  REFUND  MANUAL  MIGRATED }
enum CreditGrantStatus { ACTIVE   EXPIRED    RESET  DEPLETED }

model CreditGrant {
  id             String   @id @default(cuid())
  userId         String
  type           CreditGrantType
  amount         Int                 // original grant size
  remaining      Int                 // decremented as spent
  expiresAt      DateTime?           // null = never (legacy / unlimited)
  status         CreditGrantStatus @default(ACTIVE)
  source         String?             // "stripe:in_123", "pack:500", "referral", "migration"
  billingCycleId String?             // links a MONTHLY grant to its invoice/period (idempotency)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@index([userId, status, expiresAt])
  @@index([userId, type])
}
```

Optionally add `grantId String?` to `CreditTransaction` so each debit/refund can name the grant it touched (enables exact source-aware refunds — section O).

## I. Why `User.aiCredits` stays as a derived/cache balance during migration

`aiCredits` is read in **many** places (deduction guard, `/api/user/credits`, `/api/billing/status`, dashboard card, sidebar chip, admin, tests). Ripping it out at once is high-risk. Instead, during migration the **grant ledger is the source of truth** and `User.aiCredits` is kept as a **transactionally-maintained cache** equal to `Σ remaining` over ACTIVE, non-expired grants (`-1` preserved for unlimited). Every existing reader keeps working unchanged; the cache is recomputed inside the same transaction as every grant mutation, with a reconcile cron as a safety net. The scalar is only retired in **B1g**, after all readers are flipped to the ledger.

## J. Migration / backfill strategy (B1b)

Additive Prisma migration adds `CreditGrant` (+ enums) — **no column dropped, no behavior switched**. A backfill script creates **one grant per existing user** from their current balance so **nobody loses credits**:
`CreditGrant{ type: MIGRATED, amount: aiCredits, remaining: aiCredits, expiresAt: subscription.currentPeriodEnd ?? null, source: "migration", status: ACTIVE }`. Unlimited (`-1`) users → keep `aiCredits = -1` and **no finite grant** (sentinel handled in code). `aiCredits` remains authoritative until B1c flips reads behind a flag.

## K. Deduction order — soonest-expiry-first

Spend across the user's ACTIVE, non-expired grants **ordered by `expiresAt` ascending** (nulls last), tie-break `TRIAL → MONTHLY → REFERRAL → PURCHASED`. This protects the user (burns soonest-to-expire first) and **still spends monthly before purchased** (monthly expires at cycle end ≪ purchased's 12 months). Preserve the **atomic** guarantee by decrementing each grant row with a `WHERE remaining >= n` conditional inside a single transaction; recompute the `aiCredits` cache in the same transaction. Unlimited users bypass grant spend entirely (unchanged).

## L. Monthly renewal / reset strategy (B1d)

On `invoice.payment_succeeded` (and the reset cron): **mark the prior MONTHLY grant `RESET` (`remaining = 0`)** and **create a new MONTHLY grant** with `expiresAt = currentPeriodEnd`, `billingCycleId = invoice/subscription period`. **PURCHASED and REFERRAL grants are untouched; TRIAL follows its own expiry.** No unused monthly credits stack. This **replaces** today's `aiCredits = allowance` overwrite. `billingCycleId` uniqueness gives idempotency so the webhook and cron can't double-grant the same cycle. `subscription.deleted` must **expire only MONTHLY grants**, never PURCHASED.

## M. Purchased credits — 12-month expiry (B1e)

A one-time Stripe purchase creates a `PURCHASED` grant: `amount = pack size`, `expiresAt = purchaseDate + 12 months`, `source = "pack:{size}"`, never reset by renewal. Requires a **new one-time checkout mode + a webhook branch** for the one-time payment. **Ships only after B1d** (per section F).

## N. Trial credits — 14-day expiry (B1n / part of B1b–c)

On signup (or first action), create a `TRIAL` grant: `amount = free allowance`, `expiresAt = createdAt + 14 days`, no rollover. An expiry sweep (cron) marks past-due TRIAL/MONTHLY/PURCHASED grants `EXPIRED` and recomputes caches. Replaces today's "first-action grant of 10."

## O. Refund-to-source strategy

**Exact, source-aware:** persist the spent `grantId`(s) on the debit `CreditTransaction`; a refund restores `remaining` on the **same grant** (capped at `amount`, only if the grant is not expired). **Safe interim** if per-grant linkage is deferred to a later sub-PR: refund into a fresh `REFUND` grant whose `expiresAt = end of the current billing cycle` (conservative — never extends validity, never lands in the wrong long-lived pool). The run-full exact-`creditsUsed` refund stays correct under either method.

## P. Required schema changes (B1b)

Add `CreditGrant` model + `CreditGrantType` / `CreditGrantStatus` enums; optionally `CreditTransaction.grantId`. Keep `User.aiCredits` (now a cache). **Additive and non-breaking** — new Prisma migration + backfill script; **no runtime switch** in B1b.

## Q. Required backend changes (B1c / B1d)

- New `src/lib/creditWallet.ts`: `createGrant`, `expireGrants`, `spendAcrossGrants` (soonest-expiry-first, atomic), `refundToSource`, `recomputeCachedBalance`.
- **B1c:** refactor `checkAndDeductCredits` to spend across grants **behind a feature flag** with a **scalar fallback** (flag off = today's exact behavior). Preserve `costOverride`, unlimited, insufficient (402), and the atomic guard.
- **B1d:** renewal/reset/cancel + expiry-sweep cron become grant-based (section L).

## R. Required billing webhook changes (B1d / B1e)

- `invoice.payment_succeeded` → reset+create MONTHLY grant (not overwrite `aiCredits`).
- `customer.subscription.deleted` → expire MONTHLY grants only (purchased survive).
- `checkout.session.completed` (subscription) → seed MONTHLY grant.
- **B1e:** new one-time-payment branch → create PURCHASED grant (12-mo expiry).
- All keyed by `billingCycleId` / `source` for idempotency.

## S. Required UI transparency changes (B1f)

Credit card + sidebar show a **breakdown** (monthly / purchased / trial) with **monthly reset date** and **purchased expiry date**; `CreditHistoryModal` shows grant type per row; `/billing` displays the approved EN/AR policy copy and (after B1e) a "Buy credits" pack option. Display-only consumers of `aiCredits` keep working via the cache.

## T. Required tests

Grant create / expire / reset; **deduction order = soonest-expiry-first** (and that it spends monthly before purchased); refund-to-source + interim REFUND-grant; **renewal resets MONTHLY only / PURCHASED survives**; trial 14-day expiry; cache invariant `aiCredits == Σ remaining (ACTIVE, non-expired)`; unlimited stays `creditsUsed:0`; **regression:** all existing `credits.test.ts` / run-full route / strategy suites stay green with the flag **off**.

## U. Risks

- **#1 (blocking):** overwrite-on-renewal/reset/cancel must be replaced **before** purchased packs exist (section F) — enforce **B1d before B1e**.
- Cache drift (`aiCredits` ≠ Σ grants) → transactional updates + reconcile cron.
- Double-grant from webhook **and** cron firing the same cycle → `billingCycleId`/`source` idempotency.
- Migration must not strip unlimited (`-1`) users.
- Expiry correctness depends on accurate `currentPeriodEnd` / timezones.
- Refund into the wrong (longer-lived) pool if interim method is used carelessly → cap interim REFUND grants to the current cycle.

## V. Recommended PR breakdown

- **B1a** — Audit + design doc only *(this PR)*.
- **B1b** — Schema/ledger foundation + backfill; **no runtime switch**.
- **B1c** — Deduction reads grants **behind a feature flag** with scalar fallback.
- **B1d** — Renewal/reset/cancel grant-based; **fixes the overwrite risk**.
- **B1e** — Purchased credit packs + 12-month expiry.
- **B1f** — Billing/Credits UI transparency (+ policy copy).
- **B1g** — Retire scalar-only behavior / cleanup.

**Hard ordering: B1d must land before B1e. Do not sell purchased credit packs until monthly renewal/reset no longer overwrites `aiCredits`.**

## W. Acceptance criteria (track-level)

Monthly resets and never rolls over; purchased valid 12 mo and survives renewal; trial expires at 14 days; reviewing spends 0; deduction only on explicit action; refunds exact & source-aware; unlimited safe; `aiCredits` cache always equals Σ valid grants; existing deduction/strategy/refund tests stay green at every step; no pricing / UX / publish / schedule / ads regression.

---

*B1a is documentation only. Implementation begins at B1b (Raouf-gated).*
