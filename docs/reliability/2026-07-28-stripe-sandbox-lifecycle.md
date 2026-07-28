# Stripe Sandbox lifecycle evidence — 2026-07-28

## Scope and safety boundary

- Environment: Vercel Preview only.
- Stripe mode: test (`sk_test_`) with explicit sandbox confirmation.
- Production billing was not enabled or promoted.
- Preview deployment: `dpl_6xJkj9NwFEr5dmBxgK2nWcZF7HfF`
- Preview URL: <https://nexus-6iln1xcpl-raouf-s-projects2.vercel.app>
- Product prices exercised:
  - Growth: USD 49/month, 60 monthly credits.
  - Autopilot UI contract: USD 99/month, 180 monthly credits.
- Credit-wallet Checkout remains safely locked because its Stripe Price IDs do
  not match pricing version `2026-07-18-v1`.

## Real Stripe test objects

| Object | Stripe ID | Result |
| --- | --- | --- |
| Test Clock | `clock_1Ty8XGRrREVc0xX3QSWXoSuE` | advanced through renewal |
| Customer | `cus_Uy4gnaQmW7iWi0` | test customer |
| Subscription | `sub_1Ty8Z7RrREVc0xX3PzGlIpjH` | active, cancellation scheduled |
| Checkout invoice | `in_1Ty8Z7RrREVc0xX3bjXaX7QP` | paid, 4,900 cents |
| Checkout charge | `ch_3Ty8Z8RrREVc0xX30vtIi6Ih` | paid, partially refunded |
| Renewal invoice | `in_1Ty8ZfRrREVc0xX3ivUh2L4u` | paid, 4,900 cents |
| Renewal charge | `ch_3Ty8eyRrREVc0xX30en1ro7P` | paid, fully refunded |
| Partial refund | `re_3Ty8Z8RrREVc0xX30zW2iAaG` | 490 cents |
| Full refund | `re_3Ty8eyRrREVc0xX30eReKg2K` | 4,900 cents |

The final subscription record is:

- Status: `ACTIVE`
- Current period: `2026-08-28T10:46:58.000Z` to
  `2026-09-28T10:46:58.000Z`
- Scheduled cancellation: `2026-09-28T10:46:58.000Z`

## Webhook evidence

Actual Stripe events accepted with HTTP 200:

- `evt_1Ty8ZBRrREVc0xX3ALacCCEd` — `checkout.session.completed`
- `evt_1Ty8ZBRrREVc0xX3sbmTtKV9` — `invoice.paid`
- `evt_1Ty8ZCRrREVc0xX3I5ZpEyhw` — `invoice.payment_succeeded`
- `evt_1Ty8ZCRrREVc0xX3QFa9GpYj` — `customer.subscription.updated`
- `evt_1Ty8ZgRrREVc0xX3HrAWKIja` — `customer.subscription.updated`
- `evt_1Ty8f2RrREVc0xX3DNKKBhNZ` — `invoice.paid`
- `evt_1Ty8f2RrREVc0xX3xr8PVChA` — `invoice.payment_succeeded`
- `evt_1Ty8f5RrREVc0xX3pJpfxTWF` — `customer.subscription.updated`
- `evt_3Ty8Z8RrREVc0xX3083U5zK9` — `charge.refunded`
- `evt_3Ty8eyRrREVc0xX30HdHUl0J` — `charge.refunded`

The final isolated reconciliation replay processed 16 relevant lifecycle events;
all 16 returned HTTP 200.

## Defects found and fixed during the live drill

1. Sandbox Checkout controls were hidden in Preview. The UI now enables them
   only when Preview, sandbox billing, and verified test configuration agree.
2. Crossing only the Test Clock renewal boundary left the renewal invoice in
   draft. The drill now advances through the finalization window and verifies a
   paid renewal invoice.
3. Some subscription update snapshots omitted period boundaries. The webhook
   now retrieves authoritative Stripe state before overwriting stored dates.
4. `customer.subscription.updated` could re-grant credits after a refund.
   Entitlement updates can no longer grant an allowance.
5. Checkout and paid-invoice events could both act as credit grant signals.
   `invoice.paid` / `invoice.payment_succeeded` are now the only paid allowance
   signals.
6. The Invoice root period can represent its collection window rather than the
   paid service cycle. Grants and refunds now use the non-proration subscription
   line period.
7. A historical paid-event replay could resurrect a previously refunded grant.
   Refund reconciliation now converges the grant to the cumulative Stripe refund
   state even when its audit delta was already recorded.
8. The Billing status card entered a three-column layout too early and made the
   credit text unreadable at tablet width. It now stays stacked until a large
   viewport and allows the actions to wrap.

## Final database and visual assertions

- Cached balance: 135 credits.
- Manual grant: 135 remaining.
- July monthly grant: `VOID`, 0 remaining.
- August monthly grant: `VOID`, 0 remaining.
- Billing UI:
  - `Stripe test mode enabled`
  - Growth / Active
  - cancellation through Sep 28, 2026
  - `135 total credits available`
  - `Monthly 0 · Purchased 0 · Trial 0 · Manual grant 135`
  - credit-wallet Checkout disabled with an explicit Price-version mismatch

## Result

The sandbox sequence `Checkout → renewal → cancel at period end → partial
refund → full refund → webhook replay → database/UI reconciliation` passed.
This evidence does not authorize Stripe Live; legal approval, live credentials,
live webhook verification, and a separate go-live decision are still required.

Final repository verification:

- ESLint: passed.
- TypeScript: passed.
- Vitest: 420 files passed, 2 skipped; 3,077 tests passed, 33 skipped.
- Next.js production build: passed; 136 static pages generated.
