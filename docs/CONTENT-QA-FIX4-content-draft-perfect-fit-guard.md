# CONTENT-QA-FIX4 — Content Draft Perfect-For / Fit Claim Guard

## Why This PR Exists

`E2E-APPROVAL-QA1` stopped before approval because visible draft posts still contained broad fit/superlative wording:

- `Perfect for the hustle and bustle of urban life.`
- `Perfect for those needing a reliable coffee exper...`

Approving those drafts would turn unsupported fit claims into approved content, so approval QA remains blocked until future regeneration is guarded.

## Guard Policy

Future Content Plan generation should avoid broad fit claims unless the user has provided exact proof. The deterministic guard now softens:

- `Perfect for ...`
- `perfect choice for ...`
- `perfect fit for ...`
- `perfect way to ...`
- `perfectly suited for ...`
- `perfectly roasted`
- `perfectly crafted`
- `perfectly balanced`

Safer English framing:

- `A practical option for ...`
- `Well-suited for ...`
- `A helpful option for ...`
- `Designed for ...`
- `Carefully roasted`
- `Carefully crafted`
- `Balanced`

Arabic fit claims are also softened:

- `مثالي لـ`
- `مثالية لـ`
- `الخيار المثالي`
- `مثالي لمن`
- `مثالية لمن`
- `مثالي لكل`
- `مثالية لكل`

Safer Arabic framing:

- `مناسب لـ`
- `مناسبة لـ`
- `خيار عملي لـ`
- `خيار مناسب لـ`
- `ملائم لـ`

Safe educational wording such as `اختر درجة الطحن المناسبة لطريقة التحضير` is intentionally preserved.

## What Did Not Change

- Existing saved SocialPost rows were not mutated.
- Existing campaign `aiOutput` was not mutated.
- No content plan, strategy, visual, or creative brief generation was run.
- No approval, scheduling, publishing, or Autopilot action was run.
- Billing, credits, schema, migrations, dashboard, billing page, publishing, scheduling, cron, platform APIs, Creative Studio, and paid launch behavior were not changed.

## Next QA

Run one controlled Content Plan regeneration before resuming `E2E-APPROVAL-QA1`.

Expected result:

- Regenerated drafts should not include `Perfect for...`, `perfect choice`, `perfect fit`, `perfect way`, or broad Arabic `مثالي/مثالية` fit claims.
- Approval QA can resume only after regenerated drafts are clean enough to approve.
