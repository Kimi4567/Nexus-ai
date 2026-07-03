# STRATEGY-RUN-FIX3 — Defer Strategy Charge Until Saveable Output

## Incident

Production strategy QA showed that `/api/strategy/run-full` could deduct strategy credits before a campaign was saved. When the upstream AI/provider path or Vercel request lifecycle failed after the upfront debit, the user could be left with:

- a negative `RUN_FULL_STRATEGY` credit transaction,
- no new campaign,
- and a stuck or failed strategist run.

## Product Rule

Strategy credits should only be charged when NEXUS has produced a strategy that passed deterministic guards and is about to be saved as a campaign.

Pre-generation setup failures, provider failures, timeouts, and Strategy OS contract failures before persistence must not spend credits.

## Implementation

- `runFullAgency` now accepts an optional `beforePersistStrategy` callback.
- The callback is executed after:
  - the strategist returns,
  - server readiness normalization runs,
  - KPI/proof/output-contract guards run,
  - and `assertCampaignStrategyContract` passes.
- The callback runs immediately before campaign/suggestion rows are created.
- `/api/strategy/run-full` now performs a read-only credit preflight before generation.
- The route performs the real `checkAndDeductCredits` call only inside `beforePersistStrategy`.
- If the late deduction fails because credits changed during generation, the route returns `402` and no campaign is saved.
- If a persistence failure happens after the late deduction, the existing exact refund path still restores the deducted amount and writes the scalar `REFUND` ledger row when the wallet path is off.

## Preserved Behavior

- Variable strategy pricing remains server-computed.
- Unsupported orders still return `422` before any credit action.
- Brand Brain readiness and Strategy Brief readiness still run before generation.
- Existing wallet-refund behavior is preserved behind its flag.
- Existing campaign persistence behavior is unchanged after a successful charge.
- No schema, billing plan, generation prompt, dashboard, SocialPost, media, publish, schedule, Autopilot, paid launch, platform push, or engine behavior changed.

## QA Contract

Expected behavior after this fix:

- If the strategy output fails the Strategy OS contract before persistence, no debit is created and no refund is needed.
- If the request/provider path fails before the persistence callback, no debit is created and no refund is needed.
- If the persistence callback charges successfully and later persistence fails, the route refunds the exact deducted amount.
- If credits are insufficient at preflight, the route returns `402` before AI work.
- If credits become insufficient during generation, the route returns `402` from the late persistence gate without saving a campaign.
