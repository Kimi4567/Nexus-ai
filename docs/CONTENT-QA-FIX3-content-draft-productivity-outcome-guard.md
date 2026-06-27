# CONTENT-QA-FIX3 — Content Draft Productivity / Outcome Claim Guard

## Context

CONTENT-QA-FIX2B regenerated one controlled content plan for Cairo Bloom Coffee after the superlative, delivery, and ensure guard shipped.

That QA confirmed the draft output no longer showed the earlier high-risk proof, publishing, guarantee, perfect-brew, finest-coffee, or unbounded delivery claims. One unsupported outcome claim remained in a newly generated draft:

> premium blends can boost productivity and morale

The claim is not safe unless the user has provided verified proof that the coffee product improves productivity, morale, focus, energy, workplace output, or team performance.

## Policy

Future content-plan drafts must not claim that coffee improves business or workplace outcomes unless that proof is explicitly provided by the user.

Allowed framing:

- support office coffee planning
- make team coffee breaks easier
- help provide a more consistent coffee option
- support a more considered office coffee routine
- help teams plan better coffee breaks
- support everyday coffee routines
- create a more enjoyable coffee break

Avoid unless user-provided verified proof exists:

- boost productivity
- improve morale
- increase team output
- improve team performance
- boost focus
- boost energy
- energize your team
- drive productivity
- unlock productivity

Arabic drafts should use routine and planning language instead of performance promises.

Allowed Arabic framing:

- يدعم روتين قهوة أوضح
- يساعد على تخطيط استراحات القهوة
- يجعل استراحة القهوة أسهل
- يدعم تجربة قهوة أكثر انتظامًا
- يساعد الفريق على تنظيم استراحات القهوة

Avoid unless user-provided verified proof exists:

- زيادة الإنتاجية
- تحسين الإنتاجية
- رفع الإنتاجية
- يعزز المعنويات
- يرفع المعنويات
- يحسن الأداء
- أداء الفريق
- طاقة مضمونة
- تركيز أفضل

## What Changed

- Added deterministic content draft guard replacements for unsupported productivity, morale, focus, energy, team-performance, workplace-output, and business-result claims.
- Reinforced the Content Plan generation prompt policy so the model avoids these claims before the deterministic guard runs.
- Added English and Arabic tests for risky outcome claims and safe coffee-planning copy.

## What Did Not Change

- No existing SocialPost rows were mutated.
- No existing campaign strategy output or `campaign.aiOutput` was mutated.
- No content plan was generated as part of implementation.
- No approval, scheduling, publishing, Autopilot, visual generation, creative brief, billing, credit deduction/refund, schema, migration, or platform API behavior changed.

## Next QA

Before APPROVAL-SAFE1, run one controlled content plan regeneration on the QA campaign and confirm:

- cost is disclosed before regeneration
- exactly one regeneration runs
- draft count remains expected
- output avoids productivity, morale, focus, energy, team-performance, proof, publishing, scheduling, paid-budget, and unbounded delivery claims
- Content Hub and Campaign Room remain draft/review-only
