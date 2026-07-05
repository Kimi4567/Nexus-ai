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

## Second Regeneration Finding

A second controlled regeneration removed the previous phrases, but still produced softer patient-outcome and growth-adjacent wording:

- `تحسين تجربة مرضاك`
- `يعزز ... تنظيم عملك الطبي`
- `يعزز ... وضوح العمليات`
- `تحسين الكفاءة التشغيلية`
- `نمو عيادتك العضوي`
- `#رعاية_المرضى`

The guard now treats these as review-risk phrases for clinic SaaS unless proof exists, and replaces them with administrative patient-experience, workflow visibility, task review, and follow-up language.

## Third Regeneration Finding

A third controlled regeneration exposed broader escape hatches:

- `تعزيز كفاءة العيادات`
- `تحسين رضا المرضى`
- `رحلة التحول الرقمي`
- `الأداة المناسبة لرفع وضوح العمليات اليومية`
- `إليك الحل`

The guard now treats clinic efficiency, patient satisfaction, and digital-transformation wording as claims that must be grounded into operational review language unless proof exists.

## Fourth Regeneration Finding

A fourth controlled regeneration still produced broader unsupported benefit language:

- `تحسين كفاءة العيادة`
- `تحسين متابعة المرضى`
- `توفير الوقت`
- `تواصل فعال وسهل`
- `تحسين الخدمة`
- `حقق نتائج أفضل`
- `لكفاءة أكبر`
- `تجربة أكثر تنظيماً وكفاءة`

The guard now broadens clinic SaaS replacements for time-saving, service-improvement, better-results, effectiveness, and communication claims. Content-plan generation temperature was also lowered to reduce decorative/hype phrasing and keep drafts closer to operational review language.

## Boundary

This PR does not mutate existing SocialPost rows or campaign output. Existing generated drafts remain unchanged until a future controlled regeneration or manual rewrite runs through the updated guard.

No approval, scheduling, publishing, manual publish, Autopilot, paid launch, image generation, media attachment, credit refund, engine run, schema change, billing change, dashboard change, or PR #164 work is included.
