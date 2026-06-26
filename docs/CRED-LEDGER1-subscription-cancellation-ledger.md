# CRED-LEDGER1 — Subscription Cancellation Credit Ledger

## Issue

Subscription cancellation currently expires the user's remaining scalar credit balance by setting `User.aiCredits` to `0`, but Credit History reads only `CreditTransaction` rows. That means a user can lose remaining credits after a Stripe `customer.subscription.deleted` event without seeing a matching history row.

## Previous Behavior

The `customer.subscription.deleted` webhook handler:

- marked the subscription `CANCELLED`
- marked the user subscription status `CANCELLED`
- set `User.aiCredits` to `0`
- voided active non-purchased `CreditGrant` rows

It did not create a `CreditTransaction`, so the visible Credit History had no record of the reset.

## New Behavior

Before zeroing the scalar balance, the cancellation handler reads the current `User.aiCredits` inside the same database transaction.

If the current balance is positive and finite, it creates a visible `CreditTransaction`:

- `action`: `CREDIT_EXPIRY`
- `description`: `Unused monthly credits expired after subscription cancellation`
- `amount`: negative current balance
- `entityType`: `billing`
- `entityId`: Stripe subscription id

The existing cancellation behavior still runs afterward.

## What Did Not Change

- No Stripe checkout or portal behavior changed.
- No subscription cancellation timing changed.
- No credit deduction, refund, generation, publishing, scheduling, cron, schema, or migration behavior changed.
- No billing page or dashboard UI changed.
- `CreditGrant` voiding remains unchanged.

## Policy Boundary

This fix documents the current product behavior when Stripe sends `customer.subscription.deleted`: unused scalar credits expire. It does not decide a future rollover, carryover, purchased-credit, or cancel-at-period-end policy. Those should be handled in a separate credit policy PR.

## Validation

- `git diff --check` on touched files
- focused billing webhook tests
- `npm run type-check`
- `npm run build`
- source scan for cancellation, ledger, and grant-voiding terms

## Risks

Webhook idempotency relies on the existing balance being `0` after the first successful cancellation handling. If two identical cancellation events process concurrently before either transaction commits, a duplicate expiry row is theoretically possible. Avoiding that completely would require a stronger idempotency key or unique ledger constraint, which is intentionally out of scope for this focused fix.
