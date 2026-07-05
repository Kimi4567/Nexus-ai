# CONTENT-PLAN-HEALTHCARE-QUALITY1 — Operational Claims Guard

## Context

A controlled production content-plan generation for a healthcare/clinic SaaS campaign produced draft Arabic copy that was too broad for review-ready marketing operations. Examples included:

- `الحل الأمثل`
- `يضمن كفاءة وفعالية أكبر`
- `تحقيق النجاح`
- `يغير منظورك`
- `حلول ذكية`
- `رعاية صحية متميزة`
- `تحسين تجربتك مع المرضى`

Those phrases can imply guaranteed operational results, healthcare quality outcomes, or unsupported transformation claims.

## Change

The deterministic Content Draft Truth guard now softens healthcare, clinic, patient, appointment-management, and operational SaaS draft copy before SocialPost rows are created.

Unsafe broad claims are replaced with grounded operational wording, such as:

- `خيار عملي لتنظيم المواعيد`
- `وضوحًا أكبر في العمل اليومي`
- `مراجعة خطوات العمل اليومية`
- `تنظيم متابعة المرضى إداريًا`
- `أدوات عملية`
- `خطوات أكثر تنظيمًا`

The prompt policy also instructs content-plan generation to avoid patient outcome, care-quality, guarantee, or transformation claims unless exact verified proof exists.

## Follow-up Regeneration Finding

After the first guard deployed, one controlled regeneration improved the original blocker but still produced broad operational/patient-satisfaction wording:

- `لم يكن أبداً بهذه السهولة`
- `ضمان مواعيد منظمة ومرضى راضين`
- `الحلول الذكية`
- `تعزز الكفاءة`
- `الابتكارات التي نقدمها`

The guard now also softens these phrases into review-safe operational language about clearer appointment organization, administrative patient experience, workflow visibility, and practical features.

## Boundary

This PR does not mutate existing SocialPost rows or campaign output. Existing generated drafts remain unchanged until a future controlled regeneration or manual rewrite runs through the updated guard.

No approval, scheduling, publishing, manual publish, Autopilot, paid launch, image generation, media attachment, credit refund, engine run, schema change, billing change, dashboard change, or PR #164 work is included.
