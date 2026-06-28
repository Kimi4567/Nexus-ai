# CONTENT-QA-FIX7 — Residual Best/Premium Draft Guard

## Context

CONTROLLED-CONTENT-REGEN-QA3 verified that CONTENT-QA-FIX6 affected future Content Plan regeneration for the Cairo Bloom Coffee QA campaign. The exact FIX6 target families passed:

- No `أفضل نكهة`, `بجودة لا تقاوم`, `لا تقاوم`, `نكهة فريدة`, or `تجربة قهوة فريدة`.
- No broad Arabic perfection wording such as `قهوة مثالية`, `التجربة المثالية`, or `نتائج مثالية`.
- No Arabic fit-claim leakage such as `مثالي ل`, `مثالية ل`, or `الخيار المثالي`.
- No English `Perfect for`, `irresistible`, `extraordinary`, or `unmatched` exact target leakage.
- Regeneration spent the displayed 2-credit cost, kept 8 posts in draft review, and did not trigger image generation.

QA3 still found two residual generated draft phrases that were too broad for approval QA:

- `دليلك البسيط لاختيار أفضل الحبوب`
- `premium experience`

## Guard Policy

This PR adds narrow deterministic replacements for residual best/premium wording. It does not add a generic rewrite for every Arabic `أفضل` or every English `premium`.

Arabic replacements:

- `أفضل الحبوب` and `أفضل حبوب` -> `حبوب مختارة بعناية`
- `أفضل حبوب القهوة` -> `حبوب قهوة مختارة بعناية`
- `أفضل مذاق` -> `مذاق متوازن`
- `أفضل رائحة` -> `رائحة متوازنة`
- `أفضل اختيار للقهوة` -> `اختيار مناسب للقهوة`
- `أفضل خيار للقهوة` -> `خيار مناسب للقهوة`

English replacements:

- `premium experience` -> `more considered experience`
- `premium coffee experience` -> `more considered coffee experience`
- `premium taste` -> `balanced taste`
- `premium flavor` -> `balanced flavor`
- `premium quality` -> `carefully selected quality`
- `best beans` -> `carefully selected beans`
- `best coffee beans` -> `carefully selected coffee beans`
- `best flavor` -> `balanced flavor`
- `best taste` -> `balanced taste`
- `best coffee experience` -> `more consistent coffee experience`

## Prompt Policy

The Content Plan generation prompt now explicitly avoids residual broad best/premium quality wording, including `أفضل الحبوب`, `أفضل حبوب القهوة`, `premium experience`, `premium quality`, `best beans`, and `best flavor`, unless exact user-provided proof exists.

Preferred alternatives include:

- `حبوب مختارة بعناية`
- `مذاق متوازن`
- `more considered experience`
- `carefully selected beans`
- `balanced flavor`

## What Did Not Change

- Existing saved SocialPost rows are not mutated.
- Existing `campaign.aiOutput` is not mutated.
- Content Plan generation behavior and credit charging behavior are unchanged.
- Approval, scheduling, publishing, Autopilot, image generation, billing, dashboard, schema, migrations, and platform APIs are untouched.

## Next QA

After merge, run one controlled Content Plan regeneration before resuming E2E approval QA. Existing saved drafts may still show the residual phrases until a future generation/regeneration happens.
