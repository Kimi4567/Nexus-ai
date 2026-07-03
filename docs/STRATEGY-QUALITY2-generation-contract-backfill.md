# STRATEGY-QUALITY2 — Generation Contract Backfill

## Production finding

During the first controlled ClinicFlow AI organic strategy generation, production blocked persistence safely:

- route: `/api/strategy/run-full`
- selected scope: Organic, Arabic, 30 days, exact 7 post directions
- UI cost: 8 credits
- visible credits stayed 311
- no campaign was saved
- Vercel reason: `Campaign engine strategy failed Strategy OS contract (weak: funnelStages, kpis)`

The failure was useful: the quality contract prevented a weak strategy from becoming the operating source of truth.

## Fix

`guardStrategyOutputContract` now adds deterministic review-safe backfills when the model returns weak minimum contract fields:

- `kpis`: at least two baseline-needed hypothesis KPIs, localized by selected language
- `funnelStages`: four operational funnel stages with mindset, message, content type, platform, CTA, success metric, next step, and product area

The backfill is intentionally conservative:

- no invented performance numbers
- no ROI/ROAS/CPL/CPA claims
- no published/scheduled/live/active campaign wording
- no paid-launch or platform-execution implication
- no proof claims
- Arabic output receives Arabic user-facing fallback text

## Product boundary

This does not weaken the strategy contract. It keeps the hard persistence guard, while ensuring NEXUS can repair predictable low-structure model gaps into review-safe operating guidance before persistence.

The fallback remains a strategy review artifact only. It does not create Content Hub drafts, SocialPost rows, schedules, published posts, paid campaigns, or platform actions.

## Validation

- `npm run test -- src/lib/ai/__tests__/strategyOutputContractGuard.test.ts`
- broader strategy contract suite:
  - `src/lib/ai/__tests__/strategyOutputContractGuard.test.ts`
  - `src/lib/ai/__tests__/strategyKpiGuard.test.ts`
  - `src/lib/__tests__/strategyNormalize.test.ts`
  - `src/app/api/strategy/run-full/__tests__/route.test.ts`
  - `src/lib/agents/__tests__/strategistPrompt.test.ts`

