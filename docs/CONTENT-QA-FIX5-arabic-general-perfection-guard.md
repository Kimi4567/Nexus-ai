# CONTENT-QA-FIX5 — Arabic General Perfection Wording Guard

## Background

CONTROLLED-CONTENT-REGEN-QA1 verified the merged CONTENT-QA-FIX4 scope:

- No English `Perfect for`, `perfect choice`, or `perfect fit` leakage was found in the regenerated drafts.
- No Arabic broad fit-claim patterns like `مثالي ل`, `مثالية ل`, or `الخيار المثالي` leaked.
- Exactly one normal Content Plan regeneration occurred.
- Credits moved from 185 to 183, matching the displayed 2-credit regeneration cost.
- The regenerated content remained draft/pending.
- No approval, scheduling, publishing, Autopilot, admin action, or extra generation occurred.

## Remaining Blocker

One regenerated Arabic draft still included:

`اكتشف أسرار صنع قهوة مثالية في المنزل...`

This is not a FIT-claim failure, but it is broad perfection-style wording. Approval QA should wait until future generated drafts avoid this pattern.

## Guard Policy

Future content drafts should avoid broad Arabic perfection claims unless exact user-provided proof supports them.

Guarded examples:

- `قهوة مثالية`
- `القهوة المثالية`
- `تجربة مثالية`
- `التجربة المثالية`
- `تجربة قهوة مثالية`
- `نتائج مثالية`
- `النتائج المثالية`
- `نتيجة مثالية`
- `النتيجة المثالية`
- `تحضير مثالي`
- `التحضير المثالي`
- `خلطة مثالية`
- `نكهة مثالية`
- `النكهة المثالية`
- `وصفة مثالية`
- `الوصفة المثالية`
- `كوب مثالي`
- `الكوب المثالي`
- `فنجان مثالي`
- `الفنجان المثالي`

Safer replacements:

- `قهوة متوازنة`
- `القهوة المتوازنة`
- `تجربة أكثر اتساقًا`
- `تجربة قهوة أكثر اتساقًا`
- `نتائج أكثر اتساقًا`
- `تحضير عملي`
- `التحضير العملي`
- `خلطة متوازنة`
- `نكهة متوازنة`
- `النكهة المتوازنة`
- `وصفة عملية`
- `كوب متوازن`
- `فنجان متوازن`

Safe educational wording remains unchanged, for example:

`اختر درجة الطحن المناسبة لطريقة التحضير`

## What Did Not Change

- Existing saved SocialPost rows were not mutated.
- Existing campaign `aiOutput` was not mutated.
- Content Plan generation behavior, credit deduction/refund behavior, approval, scheduling, publishing, Autopilot, billing, schema, dashboard, and platform APIs were not changed.
- This PR only affects future generation/regeneration output.

## Validation Notes

Focused tests cover:

- The observed `قهوة مثالية` blocker.
- Broader Arabic perfection phrases for experience, results, preparation, and blend wording.
- Safe Arabic educational wording.
- Existing FIX4 English and Arabic fit-claim regressions.
- Recursive guard behavior for nested generated fields.

## Next QA

After this PR is merged, run one controlled Content Plan regeneration on the QA campaign before resuming E2E-APPROVAL-QA1.

Expected result:

- No broad Arabic perfection wording in regenerated drafts.
- Drafts remain DRAFT/Pending.
- No approval, scheduling, publishing, Autopilot, admin action, or extra generation.
