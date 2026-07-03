# STRATEGY-RUN-FIX1 — Refund Strategy Credits on Exceptions

## Incident

During production QA after STRATEGY-LANG-FIX3, an Arabic Organic 30-day strategy run failed with a generic network-style UI error after credits were deducted.

Observed result:

- Credits changed from 355 to 345.
- No new campaign was saved.
- The latest strategy campaign remained the older English-heavy Arabic-selected draft.

## Root Cause

`/api/strategy/run-full` refunded credits when `runFullAgency()` returned a structured failure result, but not when the orchestration threw an exception after credit deduction.

That meant a provider/orchestration exception could leave the user charged without a saved strategy deliverable.

## Fix

The route now tracks the deducted strategy credit after successful debit and uses a shared refund helper in both paths:

- structured strategy failure with no saved campaign
- thrown exception after credit deduction

The exception path returns a safe JSON response with:

- `ok: false`
- a localized safe error message
- `refunded`
- `creditsRemaining`
- `creditsUsed`

Provider/internal exception messages are logged server-side but not exposed as user-facing copy.

## Boundaries

This does not change:

- Strategy pricing.
- Strategy readiness gates.
- Successful strategy persistence.
- Prompt/output quality guards.
- Billing plan logic.
- UI layout.
- Publishing, scheduling, Autopilot, media, paid launch, engine, dashboard, or schema behavior.

