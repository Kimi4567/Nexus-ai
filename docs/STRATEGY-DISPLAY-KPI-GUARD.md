# STRATEGY-DISPLAY-KPI-GUARD

## Purpose

Post-merge production QA after the Arabic KPI numeric guard found that old saved
campaign strategy data could still display unsupported Arabic KPI targets such as
`زيادة بنسبة 20% في 30 يومًا` and `زيادة بنسبة 25% في 30 يومًا`.

The generation guard protects future strategy runs, but it intentionally does not
mutate existing `campaign.aiOutput`. The Campaign Room therefore needs a read-only
display guard so legacy saved strategy output is rendered truthfully without a DB
repair.

## Fix

- Apply `guardStrategyKpis` to the Campaign Room strategy object after platform
  contract normalization and before rendering.
- Use `aiOutput.language` when available, falling back to the active locale.
- Do not mutate `campaign.aiOutput`, SocialPost rows, Media rows, GeneratedVisual
  rows, credits, billing state, publishing state, scheduling state, or Brand Brain.

## Expected Result

Unsupported saved KPI percentages are displayed as baseline-safe Arabic wording,
for example:

- `زيادة — نحتاج إلى خط أساس لتحديد الهدف بعد أول ٣٠ يومًا`

The old raw saved data remains unchanged; only the rendered Campaign Room strategy
view is guarded.
