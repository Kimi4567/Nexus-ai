# NEXUS pricing economics v2 — 2026-07-16

## Decision

NEXUS credits are commercial work units, not a resale of raw OpenAI tokens. A
credit pays for the provider call plus validation/repair calls, retries,
moderation, storage, platform processing, observability, refunds, support, and
gross margin. The server recomputes every charge; the browser never supplies a
trusted price.

The sellable plans remain `$49 Growth` and `$99 Autopilot`, but their monthly
allowances are reduced from 150/500 to 60/180 credits. Existing grants are not
rewritten. New grants use pricing version `2026-07-16-v2`.

## Official variable-cost baseline

Rates used by the runtime catalog:

| Provider operation | Input / 1M | Cached input / 1M | Output / 1M |
| --- | ---: | ---: | ---: |
| OpenAI `gpt-4o` | $2.50 | $1.25 | $10.00 |
| OpenAI `gpt-4o-mini` | $0.15 | $0.075 | $0.60 |

For `gpt-image-1` high quality, the reserve is `$0.167` for 1024×1024 and
`$0.25` for 1024×1536 or 1536×1024, plus image/text input tokens.

Sources:

- https://developers.openai.com/api/docs/pricing
- https://developers.openai.com/api/docs/guides/image-generation#calculating-costs

The strategy runtime records the actual provider-reported input, cached input,
and output tokens across the primary generation, an optional document repair,
and an optional focused Paid/Full package repair. The focused repair uses strict
Structured Outputs with exact commercial counts; it avoids paying to regenerate
an already-valid full strategy merely because (for example) four ad variations
were returned instead of nine. The internal cost record is versioned, so pricing
can be recalibrated from real production percentiles instead of guesses.

## Payment-cost reserve

The conservative card baseline is Stripe UAE domestic pricing of `2.9% + AED 1`
per successful transaction, plus Stripe Billing pay-as-you-go at `0.7%` of
billing volume. International cards and FX may add another 1% each.

Source: https://stripe.com/ae/pricing

Approximate domestic net before tax/refunds:

| Plan | Gross | Stripe payment + Billing reserve | Net | Net per credit |
| --- | ---: | ---: | ---: | ---: |
| Growth | $49 | ~$2.76 | ~$46.24 | ~$0.77 |
| Autopilot | $99 | ~$4.56 | ~$94.44 | ~$0.52 |

Autopilot is the lowest subscription yield and is therefore the margin floor.
Even after an extra 2% international/FX reserve it yields about `$0.51` per
credit.

## Strategy credit matrix

| Scope | Tier | 30 days | 90 days | 180 days |
| --- | --- | ---: | ---: | ---: |
| Organic | Light | 12 | 18 | 24 |
| Organic | Standard | 16 | 24 | 32 |
| Organic | Growth | 22 | 32 | 42 |
| Organic | Daily | 28 | 40 | 54 |
| Paid | Basic | 16 | 24 | 32 |
| Paid | Standard | 22 | 32 | 42 |
| Paid | Advanced | 28 | 40 | 54 |
| Full | Light | 24 | 34 | 46 |
| Full | Standard | 32 | 46 | 60 |
| Full | Growth | 42 | 60 | 78 |
| Full | Daily | 54 | 76 | 96 |

Why the price is higher than raw tokens: the current `gpt-4o` strategy call can
emit up to 7,500 output tokens, a document repair can emit up to 9,500 more, and
a focused paid-package repair is capped at 6,000. Most runs do not need every
repair. A real Organic audit run on 2026-07-16 used 12,298 input and 6,183 output
tokens across two calls and cost `$0.088735`; a deliberately rejected Paid run
used 14,548 input and 10,140 output tokens and cost `$0.13393`, then refunded the
user because its 4/9 copy count failed the contract. The customer is buying the
governed agency workflow, exact deliverable contract, failure refund, and
operating margin—not raw unvalidated JSON.

## Complete-journey capacity

These examples prevent the old problem where a subscription could create many
strategies without executing them:

| Journey | Credits |
| --- | ---: |
| Organic Light 30d + Content Plan + QA + 4 images | 37 |
| Full Standard 90d + Content Plan + QA | 55 |
| Full Standard 90d + Content Plan + QA + 4 images + Paid execution plan | 77 |

Growth supports one serious strategy-to-review journey, not dozens of detached
strategies. Autopilot supports about two rich Full journeys or a broader mix of
content/paid operations. Monthly credits expire with the billing cycle;
purchased wallet credits remain separate for 12 months.

## Wallet policy

- Minimum 20, maximum 500, step 5.
- Progressive blocks: first 50 at `$1.00` each, 51–150 at `$0.90`, 151–300 at
  `$0.80`, and 301–500 at `$0.70`.
- Top-ups remain more expensive than the Autopilot subscription unit price.
- Stripe Price IDs are retrieved before checkout; inactive, wrong-currency, or
  stale unit amounts fail closed with `CREDIT_PRICE_VERSION_MISMATCH`.
- Reservation occurs before work, finalization after success, automatic refund
  after failure, and operation idempotency prevents double charging.

## Repricing rule

Review monthly after enough paid usage exists. Raise an action's credit cost if
the p95 fully-loaded variable cost exceeds 25% of its lowest net credit revenue,
or if retries/support/storage make the contribution margin fall below the
target. Never reduce pricing from one cheap prompt sample; use p50/p95 provider
usage, repair rate, refund rate, image size mix, payment mix, and support cost.
