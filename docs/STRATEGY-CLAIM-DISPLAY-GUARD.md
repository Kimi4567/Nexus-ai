# STRATEGY-CLAIM-DISPLAY-GUARD

## Purpose

Production strategy QA found legacy saved strategy copy that still rendered broad
service claims such as:

- `اختر خيارات صديقة للبيئة لمنزل أكثر صحة.`
- `احجز تنظيف منزلك في ثوانٍ عبر WhatsApp!`
- `لا مزيد من الإضافات المفاجئة!`
- `استمتع بجودة تنظيف متسقة في كل زيارة.`

These claims can read as unsupported health, speed, pricing, or every-visit
promises when the Brand Brain does not contain verified proof. The fix is a
deterministic display/future-output guard, not a production data repair.

## Fix

- Extend `strategyProofGuard` to soften unsupported service health, instant
  booking, absolute no-more-surprises, and every-visit consistency claims.
- Apply the proof guard to the Campaign Room strategy display before KPI and
  platform display normalization.
- Guard top-level saved hooks, CTA variations, caption formulas, and content
  calendar fields before rendering.
- Keep `/strategy` and Campaign Room aligned on the same proof/claim safety
  contract.

## Product Boundary

This does not mutate `campaign.aiOutput`, SocialPost rows, Media rows,
GeneratedVisual rows, Brand Brain, credits, billing, publishing state,
scheduling state, Autopilot state, paid launch state, or engine behavior.

## Expected Runtime Truth

Unsupported saved strategy text should render as practical, review-safe wording,
for example:

- `استفسر عن خيارات تنظيف صديقة للبيئة عند توفرها.`
- `ابدأ طلب تنظيف منزلك عبر WhatsApp بخطوة بسيطة.`
- `راجع الأسعار والتفاصيل بوضوح قبل الحجز.`
- `استهدف تجربة تنظيف أكثر اتساقًا مع كل حجز.`

The original saved data remains unchanged; only future guarded output and
read-only display surfaces are softened.
