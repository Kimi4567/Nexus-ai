# NEXUS Credit Wallet — Production Policy and Runbook

**Status:** Implemented and protected by `CREDIT_WALLET_ENABLED`.
**Billing mode:** Stripe Checkout; Sandbox remains the release-validation mode until the business is approved for Live payments.

## Product policy

- Free trial: 12 credits, created on the first AI action, expires after 14 days.
- Growth: 150 credits per paid billing cycle.
- Autopilot: 500 credits per paid billing cycle.
- Monthly plan credits reset at the next Stripe billing cycle and never roll over.
- Extra purchased credits survive renewal and cancellation and expire 12 calendar months after purchase.
- Cancellation voids monthly, trial, referral, manual, refund, and migrated balances. It never voids valid purchased credit.
- Spend order is soonest-expiry-first. This normally consumes the monthly/trial bucket before longer-lived purchased credit.
- Unlimited/admin accounts preserve their bypass semantics and do not create finite debits.

Approved customer copy:

- Arabic: `كريدت الباقة الشهرية يتجدد مع كل دورة دفع ولا يتم ترحيله. الكريدت الإضافي الذي تشتريه يبقى صالحاً لمدة 12 شهراً.`
- English: `Monthly plan credits reset each billing cycle and do not roll over. Extra purchased credits remain valid for 12 months.`

## Custom-purchase policy

Customers can select 50–5,000 credits in increments of 10. The server applies progressive pricing; the browser never supplies a trusted amount or Stripe Price ID.

| Block | Price per credit |
|---|---:|
| 1–100 | $0.29 |
| 101–300 | $0.20 |
| 301–1,000 | $0.17 |
| 1,001–5,000 | $0.14 |

Examples: 100 credits = $29, 300 = $69, and 500 = $103. The pricing version is stored in signed Stripe metadata so a later price change cannot silently reinterpret an older Checkout session.

## Source of truth

`CreditGrant` is the authoritative wallet ledger. Each grant records its type, original amount, remaining amount, expiry, source/idempotency key, status, and optional billing cycle. `User.aiCredits` is a transactionally maintained compatibility cache and is repaired from eligible grants whenever the wallet changes.

The balance shown to the user is the sum of `ACTIVE` grants with positive remaining credit whose expiry is in the future (or null). Expired grants never remain spendable merely because the scalar cache is stale.

`CreditTransaction` is the immutable activity history. Debit allocations link a spend to the exact grant rows it consumed, enabling source-aware refunds without extending the original validity incorrectly.

## Renewal and cancellation

Stripe webhook and monthly cron share the same deterministic source:

`monthly:{stripeSubscriptionId}:{currentPeriodStartISO}`

The unique `(userId, source)` constraint makes retries and webhook/cron races idempotent. A newly created cycle grant resets prior active non-purchased grants, then the cache is recomputed including any valid purchased grants.

On subscription deletion, all active non-purchased grants are marked `VOID`; purchased grants are untouched and the cached balance becomes the remaining eligible purchased total.

## Secure one-time fulfilment

1. The authenticated checkout endpoint validates the requested quantity, applies the versioned server quote, splits it across immutable Stripe tier Prices, and uses a user-scoped idempotency key.
2. Checkout metadata is copied to the PaymentIntent and includes the user, credit quantity, expected cents, and pricing version.
3. The signed Stripe webhook fulfils only a paid USD session whose client reference, subtotal, total, quantity, amount, and pricing version all match the server quote.
4. The Stripe Checkout session ID becomes the unique grant source. Re-delivery can never create a second grant or purchase transaction.
5. The purchase creates a `PURCHASED` grant expiring 12 calendar months from the Checkout creation time and recomputes the wallet cache in the same database transaction.

## Operational controls

- Feature switch: `CREDIT_WALLET_ENABLED`.
- Required Stripe configuration: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and all four `STRIPE_PRICE_CREDIT_WALLET_TIER_*` variables.
- Required webhook event: `checkout.session.completed`. Subscription renewal/cancellation also require the subscription and invoice events configured in Stripe.
- Checkout creation is authenticated and rate-limited in Postgres.
- The reconciliation command is dry-run by default: `npm run credits:wallet-cutover`. Production writes require the explicit `--apply` argument.
- A cutover is complete only when a second dry run reports zero grants created, zero credits added/reduced, and no unexpected mismatches.

## Release gate

Before enabling the wallet in any environment:

1. Run the full test suite, TypeScript check, and production build.
2. Run the reconciliation dry run; apply once; repeat the dry run until it is clean.
3. Complete a real Stripe Sandbox Checkout and confirm exactly one `PURCHASED` grant, one positive purchase transaction, the expected balance, and a successful webhook delivery.
4. Retry/replay the same webhook and confirm no duplicate credit is created.
5. Keep Stripe Live mode disabled until the site, legal setup, and Stripe approval are complete.
