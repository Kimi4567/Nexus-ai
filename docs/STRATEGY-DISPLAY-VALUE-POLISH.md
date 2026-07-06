# STRATEGY-DISPLAY-VALUE-POLISH

## Problem

Strategy output can contain safe internal contract values such as `planning/review` or `Not enough data`.
Those values are useful inside prompts and guards, but they feel raw and unprofessional when shown directly to a paying user, especially inside Arabic runtime surfaces.

Observed production issues:

- Arabic Strategy pages could show `planning/review` as a raw business-stage value.
- Arabic proof/asset cards could show `Not enough data` inside lists.
- Campaign tone could show `Modern` beside an Arabic label.

## Product Decision

Keep the saved strategy output unchanged, but normalize display values at render time:

- `planning/review` -> `Planning and review stage` / `مرحلة التخطيط والمراجعة`
- `business already operating` -> localized business-state copy
- `Not enough data` -> `Not enough data yet` / `بيانات غير كافية بعد`
- Common campaign tone values get localized on Arabic pages.

This keeps the product honest without pretending missing data exists.

## Safety Boundary

This is a UI display cleanup only.

It does not:

- regenerate strategy
- mutate `campaign.aiOutput`
- change prompts or AI providers
- change API routes
- change schema
- approve, schedule, publish, or manually publish
- update Brand Brain
- spend credits

