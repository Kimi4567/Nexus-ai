# STRATEGY-SURFACE-TRUTH1 — Baseline-safe 30-day success definitions

## Context

Campaign strategy output can be rich and useful while still creating trust risk if it describes first-month success as a performance result before real analytics exist.

The observed runtime issue was a strategy brief where the KPI section correctly said targets need a baseline, but `businessObjective.successIn30Days` still said a noticeable increase in demo requests would be first-month success. That creates a soft contradiction:

- KPI truth: baseline needed.
- Objective truth: increase implied.

## Product Contract

The strategy page is a decision and planning surface. It may define what to validate, what baseline to establish, and what next operational step to take.

It must not present unsupported first-month growth, lead, engagement, sales, or traffic movement as a success expectation when analytics data is missing.

## Runtime Guard

`guardStrategyKpis` now also guards:

- `businessObjective.successIn30Days`
- nested `aiOutput.strategy.businessObjective.successIn30Days`

Unsupported qualitative or numeric performance success claims are converted into baseline-safe definitions.

Arabic fallback:

> تحديد خط أساس للطلبات والتفاعل بعد أول ٣٠ يومًا من البيانات الحقيقية

English fallback:

> Define a baseline for qualified demand and engagement after the first 30 days of real data

## Prompt Reinforcement

The strategist schema now instructs `successIn30Days` to be a review-safe validation definition. If no analytics baseline exists, it should define the baseline to establish, not an increase, growth, or result claim.

## Boundaries

This change does not:

- generate a new strategy
- mutate existing campaign output
- change credits
- change publishing, scheduling, manual publish, Autopilot, paid launch, media, billing, dashboard, or schema behavior

