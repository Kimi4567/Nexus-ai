# STRATEGY-QA-FIX1 — stale brand strategy and final cost gate

## Production finding

After the account was reset and Brand Brain was rebuilt for a new business, the Strategy page still surfaced an older campaign strategy as if it were current. That created a product-truth problem: users could read BrightNest-style strategy content while the active Brand Brain represented a different company.

The Strategy generation modal also had a hidden media-selection/upload phase after the final cost confirmation. A button that shows the exact strategy credit cost should start the strategy request directly; media review belongs in Media Library, Content Hub, and creative workflows.

## Fix

- Add a deterministic brand-alignment helper for Strategy page surfaces.
- Detect when an existing strategy draft appears tied to a previous Brand Brain.
- Replace execution-style strategy summary with a stale-draft warning when the current Brand Brain does not match the existing strategy evidence.
- Route the primary Strategy CTA to update the strategy from the current Brand Brain after cost review.
- Hide old organic execution guidance when the current strategy draft is stale.
- Remove the hidden strategy modal media-check/upload step.
- Keep cost confirmation as the final confirmation before `/api/strategy/run-full`.
- Send no media IDs from the Strategy modal; media stays separate from Strategy generation.

## Product boundary

Strategy generation may spend strategy credits only after the visible cost-confirmation button. It does not upload media, attach media, publish, schedule, start ads, update Brand Brain learning, or mutate SocialPost rows.

Media and creative assets remain separate surfaces:

- Media Library for uploaded asset storage.
- Content Hub for final post preview and explicit post media decisions.
- Creative for planning, requirements, and review-only creative previews.

## Validation

- `git diff --check`
- `npm run test -- src/lib/__tests__/strategyBrandAlignment.test.ts src/app/strategy/__tests__/strategyWorkbenchCopy.test.ts src/lib/ai/__tests__/strategyOutputContractGuard.test.ts`
- `npm run type-check`
- `npm run build`

Browser QA should verify the Strategy page warning, cost-review modal flow, and that no media/upload step appears before generation.
