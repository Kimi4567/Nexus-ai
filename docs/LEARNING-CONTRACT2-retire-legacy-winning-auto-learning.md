# LEARNING-CONTRACT2 — Retire Legacy Winning / Auto-Learning Runtime Paths

## Audit Finding

LEARNING-CONTRACT1 cleaned many runtime labels, but several legacy paths still treated workflow events as Brand Brain performance learning:

- content approval could write approved caption patterns into `BrandProfile.winningHooks` and `winningAngles`
- user-selected variants could write the selected opening hook into `BrandProfile.winningHooks`
- campaign status changes could write generated strategy hooks and angles into Brand Brain
- agent suggestion approval could directly apply hooks, angles, platforms, and insights to Brand Brain
- legacy brain prompts still used winning, proven, high-conversion, and permanent-memory language for non-analytics triggers

Those paths confuse review signals with analytics-backed learning.

## Product Law

- Approval is a workflow signal, not performance learning.
- Manual publish is an execution event, not performance learning.
- User-selected variant is a preference signal, not a performance winner.
- Manual paid metrics are reported metrics signals unless reviewed or analytics-backed.
- Analytics-backed learning requires real `analyticsData` or trusted platform metrics.
- Winner, winning, best-performing, proven, high-conversion, learned, and optimized language is reserved for analytics-backed evidence and must be clearly sourced.

## What Changed

- Approval now records workflow/review signals only and no longer writes hooks or angles into Brand Brain legacy fields.
- User-selected variants still keep route and legacy-field compatibility, but no longer write selected hooks into Brand Brain as performance learning.
- The `pick-winner` route name and `variantWinner` field remain compatibility names only. The selected variant is saved in post state; any Brand Brain preference signal is queued/proposed for review and may fail asynchronously.
- Campaign `ACTIVE` status updates no longer write generated strategy hooks, angles, platforms, or insights into Brand Brain.
- Suggestion approval no longer applies hooks, angles, platforms, or insights directly to Brand Brain.
- Legacy `/api/brain/learn` copy now uses review-signal language for non-analytics triggers.
- Shared `runBrainLearning` prompts now frame strategy, approval, user-selected variant, Sentinel, competitor, and industry triggers as review, preference, or market-intelligence signals unless the trigger is analytics-backed post performance.
- Content rewrite prompts now reference reviewed hook signals instead of proven hook formulas.
- Brand Brain assisted-field labels now expose reviewed hook/content-angle signal language.
- Brand maturity runtime copy now describes long-term depth as saved setup plus Brand Brain signals over time, not as generic "what NEXUS learned"; performance learning is explicitly reserved until real analytics are available.

## Analytics-Backed Learning

Analytics-backed language remains allowed only when the source is real performance evidence, such as:

- `post_performance` with actual published post analytics
- trusted paid metrics sources such as platform/analytics API data, when explicitly gated by the paid metrics boundary

Manual metrics and workflow transitions remain review signals.

Brand maturity and readiness surfaces may describe memory richness, reviewed signals, preference signals, execution signals, and analytics-required states. They must not imply that approval, scheduling, manual publish, or user variant choice has already taught NEXUS performance patterns.

## Schema Naming Debt

This PR intentionally does not migrate schema fields such as:

- `BrandProfile.winningHooks`
- `BrandProfile.winningAngles`
- `SocialPost.variantWinner`
- `PaidCampaignPack.learnings`

Those names remain legacy storage compatibility. Runtime labels, prompts, route copy, and source contracts must wrap them with safe signal language until a future migration is justified.

## QA Plan

Code validation:

- `git diff --check`
- `npm run test -- src/lib/__tests__/brandBrainLearningContract.test.ts src/lib/__tests__/brainTimeline.test.ts`
- `npm run type-check`
- `npm run build`

Source scan:

- scan touched files for winner/winning/learned/best-performing/proven/high-conversion/permanent-memory language
- classify remaining matches as legacy schema keys, analytics-backed allowed language, explicit forbidden-language guards, docs/tests, or unsafe runtime copy

Browser QA:

- read-only only
- confirm approval, selected variant, manual publish, Publish, Autopilot, Performance, Brand Brain, and Brain Timeline surfaces still use signal/review/execution language for non-analytics sources
- do not generate, approve, schedule, publish, manually publish, activate Autopilot, create paid campaigns, or spend credits during QA
