# STRATEGY-QUALITY1 — Professional Strategy Output + Arabic Runtime Labels

## Purpose

After controlled production generation, the Strategy page structure improved, but two quality gaps remained:

- Arabic runtime cards still exposed English field labels such as `Situation`, `Pain`, `Message`, `Format`, `Platform`, `CTA`, and `Metric`.
- Future strategy output needed a stronger operating-brief contract so it reads like a marketing team can execute it, not like generic AI strategy prose.

## Runtime UI Cleanup

The Campaign Strategy surface now uses localized strategy field labels for:

- audience situation, pain, desired outcome, objection, message
- platform, format, CTA
- funnel message, format, platform, CTA, success metric
- paid planning objective, exclusions, and ad copy angles
- weekly CTA and success metric labels

This keeps Arabic campaign review surfaces coherent and avoids mixed-language card labels that make the product feel patched together.

## Strategy Output Contract Hardening

The strategist prompt now includes a binding `PROFESSIONAL STRATEGY OPERATING BRIEF CONTRACT`.

Future strategy runs must produce an agency-grade operating brief with:

- executable audience segments, not vague persona labels
- clear pain, desired outcome, objection, message, platform, format, and CTA per segment
- funnel handoff after CTA, including what the user should do next and what the team must respond with
- concrete weekly post directions tied to segment, message, format, platform, CTA, asset need, and review point
- explicit operating gaps when lead handling, conversion destination, proof, analytics, competitors, or budget are missing
- practical proof and compliance boundaries before claims are made

## Boundaries

This PR does not generate a new strategy and does not mutate production data. It only changes future prompt behavior and Strategy page runtime copy.

It does not change:

- credits or billing
- approval, scheduling, publishing, manual publishing, or Autopilot
- Content Hub SocialPost state
- Media, GeneratedVisual, or asset attachment behavior
- schema or migrations
- paid launch/platform push behavior

## Validation Plan

- `git diff --check`
- `npm run test -- src/lib/agents/__tests__/strategistPrompt.test.ts src/app/campaigns/[id]/__tests__/campaignStrategyTruthCopy.test.ts`
- broader strategy contract tests
- `npm run type-check`
- `npm run build`

Browser QA should verify the Strategy page in Arabic after deployment:

- no English field labels appear in Arabic strategy cards
- Strategy page remains review-only
- no generation, credits, publish, schedule, manual publish, Autopilot, paid launch, media attach, or data mutation occurs during QA
