# STRATEGY-QUALITY3 — Current Brand Workbench + Count Guard

## Production finding

After `STRATEGY-QUALITY2` merged, a controlled production strategy generation was retried for `ClinicFlow AI`:

- scope: Organic, Arabic, 30 days, exact 7 post directions
- cost: 8 credits
- credits moved from 311 to 303
- DB confirmed the newest generated campaign was `استراتيجية نمو عضوي لـ ClinicFlow AI`

The strategy generation succeeded, but two product-truth issues were found:

1. `/strategy` could still surface an older `LedgerFlow AI` campaign because it selected the first campaign sorted by `updatedAt`. Opening an older campaign can update it and make it look like the current workbench strategy.
2. The generated strategy contained 7 `contentAnglesDetailed` entries but the weekly execution plan described 9 countable deliverables.

## Fix

- `/strategy` now chooses a visible campaign that matches the current Brand Brain before falling back to the first recent campaign.
- `/strategy` fetches a wider recent campaign window so the current-brand strategy is less likely to be hidden by recently viewed stale records.
- The strategy output guard now receives the paid/reviewed `organicPostCount` from the orchestrator.
- If the model returns a weekly plan whose deliverables do not add up to the paid exact organic count, the guard rebuilds weekly deliverables from `contentAnglesDetailed`.

## Product boundary

This fix does not regenerate, refund, approve, schedule, publish, create content drafts, mutate SocialPost rows, attach media, launch paid campaigns, activate Autopilot, or alter Brand Brain data.

It only prevents the workbench and persisted strategy outline from contradicting the current Brand Brain and the confirmed strategy order.

## Validation

- `npm run test -- src/lib/ai/__tests__/strategyOutputContractGuard.test.ts src/lib/__tests__/strategyWorkbenchCampaign.test.ts`

