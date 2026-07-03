# FIRST-PAID-TRUTH1 — Dashboard, Brand, Billing Truth Cleanup

## Purpose

Fix the first trust breaks found during the paid-user operating audit without changing generation, credits, billing behavior, schema, or production data.

## Changes

- Dashboard early operating summary now shows the real workspace draft campaign count instead of a hardcoded `0`.
- `/api/dashboard/stats` returns a workspace-wide draft campaign count so the dashboard does not infer truth from a paginated recent-campaign list.
- Brand Brain early-state copy no longer says the profile needs more core context when the real issue may be missing proof, analytics, or reviewed signals.
- Analytics insights use the same early Brand Brain framing.
- Billing plan copy no longer implies automatic brand learning; it now describes reviewed signals across campaigns.

## Product Truth

- Brand completeness can be 100% while memory maturity is still early.
- Early maturity should ask for saved context, proof, analytics, and reviewed signals, not imply core profile fields are missing.
- Approval, scheduling, and campaign setup signals are workflow/context signals only.
- Performance learning still requires real analytics.
- Billing should not imply automatic brand learning from every campaign.

## Non-goals

- No strategy generation.
- No content generation.
- No credit behavior change.
- No billing/Stripe checkout behavior change.
- No schema migration.
- No production data mutation.
- No dashboard redesign.
- No PR #164 changes.
