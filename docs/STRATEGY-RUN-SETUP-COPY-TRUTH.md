# STRATEGY-RUN-SETUP-COPY-TRUTH

## Purpose

The first strategy generation modal step is no longer only a language choice.
It is the setup step for a strategy request: strategy type, duration, content
intensity, output language, and then cost review.

This cleanup removes copy that made the step feel narrower or more misleading
than the actual product behavior.

## Runtime Truth

- The first step is a strategy request setup step.
- Language is one of several setup choices, not the whole decision.
- Arabic and English language choices should not imply a full-strategy order.
- The next action goes to cost review before any generation or credit charge.

## Boundaries

This PR changes copy and tests only.

It does not change:

- strategy generation behavior
- strategy pricing
- credit deduction timing
- Brand Brain readiness logic
- paid planning logic
- API routes
- database schema
- campaign or SocialPost data
- publishing, scheduling, Autopilot, paid launch, image generation, or engine behavior

## Validation

- `npm run test -- src/lib/__tests__/strategyRunSetupCopy.test.ts`
- `npm run type-check`
- `npm run build`

