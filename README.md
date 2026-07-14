# NEXUS AI

NEXUS AI هو نظام تشغيل تسويق ذكي: يحفظ سياق العلامة في Brand Brain، يحوّله إلى استراتيجية وحزم محتوى قابلة للمراجعة، ثم يجهّز الجدولة أو النشر فقط عندما تكون الموافقات والحسابات والصلاحيات متاحة.

المنتج ليس مولّد نصوص منفردًا، ولا يَعِد بنتائج أو نشر/إنفاق تلقائي بدون دليل وموافقة.

## دورة العمل الحالية

1. يملأ المستخدم Brand Brain.
2. يولّد NEXUS استراتيجية، زوايا، Hooks، CTAs، Scripts، وخطة محتوى.
3. يراجع المستخدم المسودات ويعتمدها.
4. تُجدول المنشورات أو تُنشر يدويًا/تلقائيًا فقط مع حساب متصل صالح، وموافقة، واشتراك في الوضع التلقائي.
5. بعد توفر بيانات مؤهلة، ينشئ النظام مقترحات تعلم مرتبطة بالمصدر؛ لا يغيّر Brand Brain بصمت.

## التقنية

- Next.js 15 App Router + React 19 + TypeScript
- Prisma + PostgreSQL/Supabase
- Supabase Auth (الواجهة وBearer auth للـ API)
- OpenAI للخطط والمحتوى والتحليل، مع مسارات mock محلية عند غياب المفتاح
- Cloudinary اختياري لتخزين الوسائط في الإنتاج
- Vercel للـ deployment والـ cron jobs
- Stripe موجود خلف بوابة تفعيل صريحة، وغير مفعّل افتراضيًا

## الفوترة والكريدت

يوجد عرضان مدفوعان فقط:

| الخطة | السعر | الكريدت الشهري |
| --- | ---: | ---: |
| Growth | $49 / شهر | 150 |
| Autopilot | $99 / شهر | 500 |

الحساب الجديد يحصل على 10 أرصدة تجريبية صالحة 14 يومًا بدون بطاقة. الأرصدة الإضافية والمحفظة موجودة خلف `CREDIT_WALLET_ENABLED`.

لا يفتح الدفع الحقيقي إلا عند توفر كل الآتي:

- `NEXT_PUBLIC_BILLING_ENABLED=true`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- أسعار Growth وAutopilot (`STRIPE_PRICE_PRO` و`STRIPE_PRICE_BUSINESS`)
- مراجعة قانونية واختبار webhook في بيئة production

## التكاملات والصلاحيات

- Facebook Page: يمكن الوصول إلى حالة جاهزية بعد ربط صفحة وصلاحيات صحيحة، مع مراجعة قبل النشر.
- Instagram: يحتاج إعداد حساب أعمال ومراجعة الصلاحيات.
- LinkedIn وTikTok: حالات الاتصال موجودة، لكن الجاهزية تُعرض بحذر؛ نشر TikTok المباشر متوقف حتى اكتمال تحقق creator-info.
- Google وSnapchat وWhatsApp: غير متاحة للتشغيل حاليًا.
- الإعلانات المدفوعة: تخطيط وتصدير فقط ما لم تتوفر صلاحية API معتمدة؛ لا يوجد إنفاق تلقائي.

## التشغيل المحلي

المتطلبات: Node.js 18+ وPostgreSQL/Supabase.

```bash
npm install
cp .env.example .env
npx prisma generate
npm run dev
```

تحقق من الإعدادات قبل التشغيل عبر:

```bash
curl http://localhost:3000/api/health
```

تفاصيل readiness محمية بـ `CRON_SECRET`:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  "http://localhost:3000/api/health?detail=1"
```

كل المتغيرات المطلوبة موثقة في [`.env.example`](.env.example). لا تضع أسرارًا حقيقية في المستودع.

## التحقق قبل التسليم

```bash
npm run type-check
npm test -- --run
npm run build
git diff --check
```

## المسارات المهمة

- `src/app/onboarding/page.tsx` — إعداد Brand Brain الأولي
- `src/app/brand/page.tsx` — ذاكرة العلامة ومقترحاتها
- `src/app/campaigns/new/page.tsx` — إنشاء الحملة
- `src/app/campaigns/[id]/` — الاستراتيجية والمحتوى والموافقات
- `src/app/calendar/page.tsx` — طابور الجدولة والنشر
- `src/app/connections/page.tsx` — جاهزية المنصات
- `src/app/billing/page.tsx` — الباقتان والمحفظة
- `src/lib/runtimeConfig.ts` — readiness منقّح بلا أسرار
- `src/app/api/health/route.ts` — liveness/readiness endpoint
- `src/app/api/cron/` — النشر المجدول، التحليلات، المراقبة، وانتهاء الأرصدة

## التشغيل الإنتاجي

قبل فتح البيع أو النشر التلقائي:

1. طبّق migrations الخاصة بـ Credit Wallet على قاعدة production.
2. شغّل backfill وreconciliation ثم اختبر expiry sweep.
3. فعّل Stripe بعد إنشاء المنتجات والأسعار والـ webhook والتحقق من الأحداث idempotently.
4. أضف مفاتيح OAuth و`TOKEN_ENCRYPTION_KEY` و`OAUTH_STATE_SECRET` واختبر callback لكل مزود.
5. وفّر cron خارجيًا كل ساعة إذا كانت دقة الجدولة الزمنية مطلوبة على Vercel Hobby.
6. راقب `/api/health?detail=1` وسجلات cron قبل التفعيل العام.

## حدود معروفة

- نتائج الأداء لا تُعرض كحقائق قبل توفر مصدر وعيّنة مؤهلة.
- الصور موجودة، أما تحليل إطارات الفيديو فيحتاج pipeline transcoding لاحقًا.
- النشر التلقائي مجدول وليس مراقبة لحظية 24/7؛ كل إجراء حساس يظل خلف موافقة وaudit trail.
- لا يتم تفعيل Stripe أو OAuth أو Cloudinary production تلقائيًا من الكود.

المشروع خاص بـ NEXUS AI. للدعم: `support@nexus-grow.com`.
