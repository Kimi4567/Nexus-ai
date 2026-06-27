# GEN-TRUTH1 Strategy & Content Proof Guard

## Audit Issue

Fresh-account strategy QA for Cairo Bloom Coffee found unsupported proof language inside the saved generated strategy output:

- `Customer Testimonials`
- `Hear from our satisfied customers`
- `Read their stories`
- `customer testimonial video`
- `active stage`

The Brand Brain record had no verified testimonials, customer stories, awards, case studies, reviews, or performance proof. The issue was generated content, not Campaign Room UI chrome.

## Why Content Plan QA Waits

Content Plan generation reads `campaign.aiOutput.strategy` and uses strategy content pillars, message, audience, and CTA context to create SocialPost drafts. If unsupported proof language remains in the strategy context, content-plan generation can amplify it into captions and media prompts.

## Proof Policy

NEXUS may use proof only when it is explicitly user-provided in Brand Brain verified proof.

Allowed:

- User-confirmed testimonials, customer quotes, reviews, awards, case studies, or performance proof.
- Factual proof copied from verified proof text.
- Proof-collection recommendations when proof is missing.

Not allowed unless verified proof exists:

- Testimonials
- Customer stories
- Reviews or ratings
- Awards or certifications
- Case studies
- Satisfaction claims
- Guarantees
- Performance/results claims

When proof is missing, strategy and content planning should say to collect proof, request customer feedback, or use available factual proof only.

Proof types are intentionally separated:

- Reviews/ratings allow review or rating language only.
- Testimonials allow testimonial language only.
- Customer stories allow customer-story language only.
- Awards allow award language only.
- Case studies allow case-study language only.

A review is not a testimonial, a rating is not a customer story, and an award is not a case study.

## Files Changed

- `src/lib/agents/orchestrator.ts`
- `src/lib/agents/strategist.ts`
- `src/lib/agents/content-director.ts`
- `src/lib/ai/strategyProofGuard.ts`
- `src/lib/ai/__tests__/strategyProofGuard.test.ts`
- `src/lib/ai/openai.ts`
- `src/lib/ai/mock.ts`
- `src/app/api/campaigns/[id]/generate-content-plan/route.ts`

## What Changed

- Injects Brand Brain verified proof into the strategy context.
- Adds explicit strategist prompt rules against invented proof.
- Adds a deterministic strategy proof guard before new strategy output is saved.
- Sanitizes strategy context before Content Plan generation uses it.
- Adds a proof-policy prompt block to Content Plan generation.
- Removes old proof-claim examples from legacy content/ad/mock generation helpers surfaced by the scan.

## What Did Not Change

- No existing `campaign.aiOutput` rows are mutated.
- No strategy or content plan was generated.
- No credits were spent.
- No billing, credit deduction/refund, schema, publishing, scheduling, cron, platform API, dashboard, billing page, Creative Studio, or paid launch behavior changed.

## Validation

Run:

```bash
git diff --check -- \
src/lib/agents/orchestrator.ts \
src/lib/agents/strategist.ts \
src/lib/agents/content-director.ts \
src/lib/ai/strategyProofGuard.ts \
src/lib/ai/__tests__/strategyProofGuard.test.ts \
src/lib/ai/openai.ts \
src/lib/ai/mock.ts \
src/app/api/campaigns/[id]/generate-content-plan/route.ts \
docs/GEN-TRUTH1-strategy-content-proof-guard.md

npm run test -- src/lib/ai/__tests__/strategyProofGuard.test.ts
npm run type-check
npm run build
```

Scan:

```bash
rg -n "Customer Testimonials|satisfied customers|Read their stories|customer testimonial video|active stage|testimonial|customer stories|case study|award-winning|guaranteed|ensure" \
src/lib/agents \
src/lib/ai \
src/app/api/campaigns/[id]/generate-content-plan/route.ts \
docs/GEN-TRUTH1-strategy-content-proof-guard.md
```

Remaining matches should be guard patterns, tests, prompt policy, or this documentation.

## Remaining Limitation

The existing Cairo Bloom Coffee campaign still contains old generated proof language because this PR intentionally does not mutate saved `campaign.aiOutput`. Existing saved output needs explicit regeneration or a separate approved remediation step.

## GEN-TRUTH1C Follow-Up

Controlled post-merge QA showed the proof guard successfully removed invented testimonial, customer-story, award, case-study, and guarantee proof. It also surfaced three wording issues that could be amplified by Content Plan generation:

- `مرحلة العمل: active` still appeared as a strategy status label.
- `Ensure your office has the best coffee every day` was too absolute for generated marketing copy.
- `Do not promise delivery where it cannot be aimed-for` showed that positive guarantee rewriting could make safe negative disclaimers awkward.

GEN-TRUTH1C adds deterministic backstops for those cases:

- Campaign status language such as `active stage`, `campaign active`, and `مرحلة العمل: active` is rewritten to planning/review-safe wording.
- Business-status wording can remain only when it clearly refers to the business already operating, not campaign execution being live.
- Absolute `ensure` claims are softened into support/help language.
- Negative guarantee disclaimers such as `Delivery cannot be guaranteed` and `Do not promise delivery where it cannot be guaranteed` remain readable.
- Positive guarantee claims such as `Guaranteed results` or `guaranteed growth` are softened.

## GEN-TRUTH1E Follow-Up

Controlled QA after GEN-TRUTH1C showed the proof guard was still not enough for structured strategy output:

- The rendered Strategy tab showed `مرحلة العمل` with a separate value of `active`.
- Generated messages still used broad absolute wording such as `Ensure your office is always stocked with premium coffee`.
- The strategy invented an unsupported budget assumption: `Assumes $5000 USD budget is available for allocation`.

GEN-TRUTH1E adds guard coverage for those cases before saved strategy output can feed Content Plan generation:

- Structured status fields inspect key/label/title/name plus value. Campaign/status/stage fields with `active`, `live`, `running`, `launched`, `published`, or `scheduled` are rewritten to planning/review-safe language.
- Business status can be represented as `business already operating`, but campaign execution remains planning/review until later user action.
- Broader `ensure`, `always stocked`, and `make sure ... always` wording is softened into help/support language.
- Numeric paid-budget assumptions are removed unless Brand Brain provides explicit budget context.
- The strategist prompt now says budget is not provided when readiness says no Brand Brain budget exists, even if an internal default exists elsewhere in the request flow.

## Next QA After Merge

Generate one new strategy in a controlled QA account and confirm no invented testimonials, customer stories, awards, case studies, guarantees, active campaign-state wording, absolute `ensure` claims, or unsupported budget assumptions appear. Proceed to Content Plan QA only after that strategy output is clean.
