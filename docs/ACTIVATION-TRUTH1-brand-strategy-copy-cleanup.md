# ACTIVATION-TRUTH1 — Brand/Strategy Activation Copy Cleanup

## Problem

Several runtime surfaces used activation-style language for states that are only saved context, planning, or review:

- `Activate Brand Brain`
- `Save & Activate Brain`
- `Brand Brain is ready`
- `all agents will use this automatically`
- `before activation`
- `Campaign activation`
- first-content-plan copy that implied the marketing system was being activated

That wording is too strong for a first-user marketing operating system because it can imply platform execution, autonomous agent activation, or analytics-backed learning before those events happen.

## Product truth

- Brand Brain save means NEXUS has a core brand context profile.
- Brand Brain context can inform strategy, content, and on-demand analysis.
- Brand Brain save does not mean all agents fully know the brand.
- Brand Brain save does not mean analytics-backed learning happened.
- Content plans and strategies are review artifacts before approval, scheduling, publishing, or paid execution.
- Paid planning may become executable only after required inputs, platform readiness, permissions, media readiness, and explicit confirmation.
- Strategy deliverables should say campaign execution, not campaign activation.

## Runtime copy changes

- Replaced Brand Brain activation actions with setup/save language.
- Replaced active Brand Brain state with `Core profile available` / `ملف أساسي متاح`.
- Replaced all-agents automatic language with context/reference language.
- Replaced first content-plan banner activation copy with review-before-scheduling/publishing copy.
- Replaced strategic verdict paid wording with `before paid execution`.
- Replaced excluded deliverable `Campaign activation` with `Campaign execution`.
- Reframed onboarding setup/generation copy away from broad AI training and full system readiness.

## Guard

`src/lib/__tests__/activationTruthCopy.test.ts` scans the runtime files that own this language and blocks the old activation/all-agents copy from returning.

## Non-goals

This cleanup does not change:

- Brand Brain storage or learning logic
- Strategy generation logic
- Content generation logic
- Billing or credits
- Approval, scheduling, publishing, manual publish, Autopilot, paid launch, platform push, engine, or media behavior
- Schema or migrations
- Existing production data
