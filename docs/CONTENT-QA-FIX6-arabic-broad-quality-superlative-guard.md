# CONTENT-QA-FIX6 — Arabic Broad Quality/Superlative Draft Guard

## Context

CONTROLLED-CONTENT-REGEN-QA2 verified that CONTENT-QA-FIX5 cleaned the targeted Arabic perfection and fit-claim phrases from newly regenerated draft content.

Confirmed cleaned target families:

- `قهوة مثالية`
- `التجربة المثالية`
- `نتائج مثالية`
- `تحضير مثالي`
- Arabic fit claims such as `مثالي ل`, `مثالية ل`, and `الخيار المثالي`

The same QA found two remaining broad quality/superlative overclaims in regenerated draft captions:

- `لتوفير أفضل نكهة لمحبي القهوة`
- `بجودة لا تقاوم`

These are generated draft-copy issues, not UI chrome issues. Existing saved SocialPost rows remain unchanged by this PR.

## Image Incident Note

During CONTROLLED-CONTENT-REGEN-QA2, one image appeared to be generated while captions were being inspected through browser automation. The follow-up audit found:

- visible credits remained at `181`, matching the expected post-regeneration balance
- one post showed `1 / 8` visuals generated with a Cloudinary image URL
- source inspection did not show caption expansion automatically triggering image generation
- accidental automation click mistargeting is the most likely explanation

No image-generation code change is included in this task unless the issue reproduces.

## Guard Policy

Future Content Plan draft generation should soften broad Arabic quality and superlative claims unless the user has provided exact proof.

Deterministic Arabic replacements include:

- `أفضل نكهة` → `نكهة متوازنة`
- `أفضل طعم` → `طعم متوازن`
- `أفضل تجربة` → `تجربة أكثر اتساقًا`
- `أفضل جودة` → `جودة مختارة بعناية`
- `بجودة لا تقاوم` → `بجودة مختارة بعناية`
- `جودة لا تقاوم` → `جودة مختارة بعناية`
- `تجربة لا تقاوم` → `تجربة أكثر اتساقًا`
- `نكهة لا تقاوم` → `نكهة متوازنة`
- `طعم لا يقاوم` → `طعم متوازن`
- `نكهة فريدة` → `نكهة مميزة ومتوازنة`
- `تجربة قهوة فريدة` → `تجربة قهوة أكثر اتساقًا`
- `تجربة فريدة` → `تجربة أكثر اتساقًا`
- `جودة فريدة` → `جودة مختارة بعناية`

Limited English adjacent hype replacements include:

- `irresistible quality` → `carefully selected quality`
- `irresistible taste` → `balanced taste`
- `irresistible flavor` → `balanced flavor`
- `extraordinary coffee experience` → `more consistent coffee experience`
- `extraordinary experience` → `more considered experience`
- `unmatched quality` → `carefully selected quality`
- `unmatched flavor` → `balanced flavor`
- `unique coffee experience` → `more consistent coffee experience`

## Prompt Policy

The Content Plan prompt now reinforces that generated drafts should avoid broad Arabic quality/superlative phrases such as `أفضل نكهة`, `أفضل تجربة`, `بجودة لا تقاوم`, and `نكهة فريدة` unless exact user-provided proof exists.

Preferred grounded Arabic alternatives:

- `نكهة متوازنة`
- `جودة مختارة بعناية`
- `تجربة أكثر اتساقًا`
- `خطوات عملية`

The prompt also discourages English hype such as `irresistible`, `extraordinary`, `unmatched`, and broad `unique coffee experience` claims unless exact proof exists.

## What Did Not Change

- No existing saved SocialPost rows were mutated.
- No existing campaign `aiOutput` was mutated.
- No content plan was generated or regenerated.
- No strategy, visual, or creative brief generation was run.
- No approval, scheduling, publishing, or Autopilot action occurred.
- No billing, credits, schema, migration, publishing, scheduling, cron, platform API, dashboard, billing page, Creative Studio, or paid launch code was changed.
- The accidental generated image from QA2 was not reset, deleted, or modified.

## Validation Notes

This PR adds focused tests for:

- observed Arabic blocker `أفضل نكهة`
- observed Arabic blocker `بجودة لا تقاوم`
- `تجربة لا تقاوم`
- `تجربة قهوة فريدة`
- English `irresistible quality`
- English `extraordinary coffee experience`
- preservation of safe Arabic educational text
- existing recursive caption/imagePrompt/videoPrompt guarding

## Next QA

After merge, run one controlled Content Plan regeneration on the QA campaign before resuming E2E approval QA.

Expected QA outcome:

- regenerated drafts should not contain the FIX5 target phrases
- regenerated drafts should not contain `أفضل نكهة` or `بجودة لا تقاوم`
- regenerated drafts should remain DRAFT/Pending
- no approval, scheduling, publishing, Autopilot, visual generation, creative brief generation, or admin action should occur
