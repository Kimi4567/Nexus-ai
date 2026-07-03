# STRATEGY-RUN-FIX2 — Refund Ledger + Arabic KPI Guard

## Why

Production Arabic strategy QA after STRATEGY-RUN-FIX1 showed the refund safety path working: the user balance stayed restored after the strategy output was blocked by the Strategy OS contract.

Two follow-up issues remained:

- Scalar refund restored `User.aiCredits` but did not write a positive `REFUND` transaction, making credit audit history look like an unbalanced spend.
- The KPI truth guard replaced unsupported KPI targets with English fallback text, which could make otherwise Arabic strategy output fail the Arabic language contract.

## Change

- Scalar strategy refunds now restore credits and write a positive `REFUND` `CreditTransaction`.
- Wallet-path refunds remain delegated to `refundCreditsForTransaction`.
- Arabic strategy KPI fallbacks now stay in Arabic:
  - `نحتاج إلى خط أساس لتحديد الهدف بعد أول ٣٠ يومًا`
  - directional variants such as `توليد — نحتاج إلى خط أساس لتحديد الهدف بعد أول ٣٠ يومًا`
- `guardStrategyKpis` now accepts an optional language context, and the strategy orchestrator passes `brief.language`.

## Product Truth

- A failed strategy run must not charge the user.
- Failed and refunded runs must be auditable in the credit ledger.
- KPI scrubbing must not introduce language-contract violations.
- Arabic output remains protected by the Strategy OS contract before any campaign is saved.

## Not Changed

- No UI change.
- No schema change.
- No generation behavior change outside post-processing and refund accounting.
- No billing page, dashboard page, SocialPost, Media, GeneratedVisual, publishing, scheduling, Autopilot, paid launch, or engine behavior change.

