# CONTENT-QA-FIX8 — Arabic Contextual Coffee Perfection Guard

## Context

CONTROLLED-CONTENT-REGEN-QA4 verified the merged CONTENT-QA-FIX7 guard against residual best/premium draft language.

The QA run passed the exact FIX7 targets:

- No `أفضل الحبوب`
- No `أفضل حبوب القهوة`
- No `premium experience`
- No `best coffee beans`
- No `أفضل نكهة`
- No `بجودة لا تقاوم`
- No `لا تقاوم`
- No `قهوة مثالية`
- No Arabic broad fit claim such as `مثالي ل`, `مثالية ل`, or `الخيار المثالي`
- No English `Perfect for`, `irresistible`, `extraordinary`, or `unmatched`
- No image generation occurred
- Regeneration spent the displayed 2-credit cost
- The 8 content items remained draft/review content

## Residual Blocker

One newly regenerated draft still contained contextual Arabic coffee perfection wording:

```text
هل تبحث عن توصيات لقهوة صباحية مثالية؟
```

This is not the generic `قهوة مثالية` form already covered by earlier guards. It is a contextual `قهوة + descriptor + مثالية` phrase and still reads like an unsupported perfection claim.

## Guard Policy

Future Content Plan drafts should soften contextual Arabic coffee perfection phrases into grounded consistency/balance language.

Examples:

- `قهوة صباحية مثالية` -> `قهوة صباحية أكثر اتساقًا`
- `القهوة الصباحية المثالية` -> `القهوة الصباحية الأكثر اتساقًا`
- `قهوة يومية مثالية` -> `قهوة يومية أكثر اتساقًا`
- `القهوة اليومية المثالية` -> `القهوة اليومية الأكثر اتساقًا`
- `قهوة منزلية مثالية` -> `قهوة منزلية أكثر اتساقًا`
- `القهوة المنزلية المثالية` -> `القهوة المنزلية الأكثر اتساقًا`
- `قهوة مكتبية مثالية` -> `قهوة مكتبية أكثر اتساقًا`
- `القهوة المكتبية المثالية` -> `القهوة المكتبية الأكثر اتساقًا`
- `كوب قهوة مثالي` -> `كوب قهوة متوازن`
- `فنجان قهوة مثالي` -> `فنجان قهوة متوازن`

The guard remains narrow. It does not rewrite every occurrence of `مثالي` or `مثالية`, and it preserves safe educational text such as:

```text
اختر درجة الطحن المناسبة لطريقة التحضير
```

## What Changed

- Added deterministic contextual Arabic coffee perfection replacements to `contentDraftTruthGuard`.
- Added focused tests for the observed blocker, definite forms, daily/home coffee forms, cup/finjan forms, and recursive nested fields.
- Reinforced the Content Plan prompt policy with the contextual Arabic examples and grounded alternatives.

## What Did Not Change

- No existing saved SocialPost rows were mutated.
- No existing `campaign.aiOutput` was mutated.
- No generation, regeneration, approval, scheduling, publishing, Autopilot, image generation, admin, billing, or credit behavior changed.
- No Content Hub UI behavior changed.

## Next QA

After merge, run one controlled Content Plan regeneration on the QA campaign before resuming approval QA. The next QA should verify that future regenerated drafts no longer contain contextual Arabic coffee perfection wording such as `قهوة صباحية مثالية`, while still preserving safe grounded alternatives.
