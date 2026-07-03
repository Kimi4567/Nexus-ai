# STRATEGY-KPI-ARABIC-NUMERIC-GUARD

## Purpose

Production QA after `STRATEGY-RUN-FIX3` confirmed that the deferred credit charge
flow works, but a newly generated Arabic strategy still persisted unsupported KPI
targets such as:

- `زيادة بنسبة 20% في 30 يومًا`
- `زيادة بنسبة 25% في 30 يومًا`

Those numbers were not backed by connected analytics or user-provided historical
performance data. NEXUS should keep KPI wording directional until a real baseline
exists.

## Fix

- Extend the deterministic strategy KPI guard to recognize Arabic performance
  context such as `زيادة`, `تحسين`, `حجوزات`, `استفسارات`, and `تفاعلات`.
- Recognize Arabic-Indic and Persian digits as numeric performance tokens.
- Recognize Arabic percent `٪` as a percentage marker.
- Preserve Arabic calendar durations such as `30 يومًا` and `٣٠ يومًا`.
- Return Arabic-safe baseline wording when Arabic output is selected.
- Add a defensive nested `aiOutput.strategy` guard path so persisted wrapper
  shapes are safe if the guard is reused outside the orchestrator.
- Extend the strategy normalizer's general unsupported-number scrubber for Arabic
  percentages and Arabic-Indic digits.

## Product Boundary

This change does not generate, regenerate, approve, schedule, publish, manually
publish, activate Autopilot, attach media, create paid campaigns, push to any
platform, or mutate production data. It only hardens deterministic text guards and
tests.

## Expected Runtime Truth

When the system lacks analytics-backed baselines, future Arabic strategies should
use wording such as:

- `زيادة — نحتاج إلى خط أساس لتحديد الهدف بعد أول ٣٠ يومًا`
- `تحسين — نحتاج إلى خط أساس لتحديد الهدف بعد أول ٣٠ يومًا`

Unsupported numeric targets should not survive in KPI targets, success metric
targets, or general advisory metric text.
