# STRATEGY-ENGINE-CONTRACT-CLEANUP

## Problem

The product had two strategy-generation paths:

- `/api/strategy/run-full`, which asks for a rich Strategy OS brief.
- `/api/campaigns/[id]/engine`, which still used the older compact marketing strategy prompt.

The older engine prompt could overwrite `campaign.aiOutput.strategy` with a small legacy shape:

- `overview`
- `audience`
- `valueProps`
- `angles`
- `platformRecommendations`
- `ctaStrategies`

That made the redesigned Campaign Room look organized while the underlying strategy was not an executable marketing operating plan.

## Boundary

This cleanup does not reset accounts, mutate production campaign data, generate strategy, generate content, generate images, publish, schedule, manually publish, activate Autopilot, run paid launch, push to platforms, or change billing/credits behavior.

## Fix

- Add a Strategy OS contract guard for campaign-engine strategy output.
- Detect and reject the old legacy engine schema.
- Require operational strategy sections before saving engine output as successful:
  - positioning
  - diagnosis
  - business objective
  - detailed audience segments
  - content pillars/hooks/CTAs
  - content angles
  - funnel stages
  - weekly execution plan
  - KPIs as hypotheses when analytics are absent
  - readiness checklist
  - risk notes, assumptions, and missing data
- Pass the real BrandProfile into the legacy engine adapter prompt.
- Replace the compact engine strategy prompt with a Strategy OS campaign brief prompt.
- If the generated strategy fails the contract, the engine throws before persisting the new strategy. The API route keeps its existing refund-on-failure behavior.

## Product Truth

Campaign Engine output must not make the product look smarter than the saved data.

A successful strategy run must produce an executable review brief, not a six-field summary. If the model returns a weak or legacy structure, the run is treated as failed rather than saved as a campaign strategy.

## Next Step

After this is merged and production-verified, the safe sequence is:

1. Run Workspace reset for the Nesrin QA workspace, not admin account reset.
2. Rebuild Brand Brain from scratch with complete organic and paid-planning inputs.
3. Add enough QA credits for the full strategy matrix.
4. Test Organic, Paid, and Full strategies across 30 / 90 / 180 / custom durations.
5. Evaluate every generated strategy for professional marketing quality, hallucination, execution usefulness, page organization, and cross-tab consistency.
