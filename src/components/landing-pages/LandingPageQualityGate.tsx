import type { LandingPageQualityCheckId, LandingPageQualityResult, LandingPageQualityStatus } from '@/lib/landingPageQualityGate'
import { AlertCircle, CheckCircle2, Info, ShieldAlert } from 'lucide-react'

interface LandingPageQualityGateProps {
  result: LandingPageQualityResult
  locale: 'ar' | 'en'
  hasUnsavedChanges: boolean
}

const STATUS_STYLES: Record<LandingPageQualityStatus, string> = {
  BLOCKER: 'border-rose-100 bg-rose-50 text-rose-700',
  WARNING: 'border-amber-100 bg-amber-50 text-amber-700',
  READY: 'border-emerald-100 bg-emerald-50 text-emerald-700',
  INFO: 'border-slate-200 bg-slate-50 text-slate-600',
}

const STATUS_ICONS = {
  BLOCKER: ShieldAlert,
  WARNING: AlertCircle,
  READY: CheckCircle2,
  INFO: Info,
} as const

const CHECK_COPY: Record<LandingPageQualityCheckId, { ar: string; en: string }> = {
  DESTINATION: {
    ar: 'CTA له وجهة قابلة للاستخدام: نموذج مرتبط أو رابط HTTPS.',
    en: 'The CTA has a usable destination: a linked form or HTTPS URL.',
  },
  HEADLINE: {
    ar: 'العنوان واضح وقابل للمسح السريع؛ النطاق الإرشادي 20–100 حرف.',
    en: 'The headline is scannable; the advisory range is 20–100 characters.',
  },
  OFFER_DETAIL: {
    ar: 'العرض يحتاج عنوانًا داعمًا واضحًا وشرحًا كافيًا قبل طلب الإجراء.',
    en: 'The offer needs a clear supporting line and enough detail before asking for action.',
  },
  BENEFITS: {
    ar: 'اعرض 3 مزايا محددة على الأقل بدل وصف عام للمنتج.',
    en: 'Show at least three specific benefits instead of a generic product description.',
  },
  PROOF: {
    ar: 'لا يوجد إثبات معروض. اتركه فارغًا بدل اختلاق claim؛ أضف فقط دليلًا يمكنك دعمه.',
    en: 'No proof is shown. Leave it empty instead of inventing a claim; add only evidence you can support.',
  },
  SEARCH_METADATA: {
    ar: 'طلب الفهرسة يحتاج عنوان SEO من 10–70 حرفًا ووصفًا من 50–180 حرفًا.',
    en: 'Indexing requests require a 10–70 character SEO title and a 50–180 character description.',
  },
  SEARCH_SNIPPET_FIT: {
    ar: 'نطاق العرض الإرشادي: عنوان 30–60 حرفًا ووصف 70–160؛ محركات البحث قد تعيد الكتابة.',
    en: 'Advisory display range: 30–60 title characters and 70–160 description characters; search engines may rewrite them.',
  },
  MESSAGE_MATCH: {
    ar: 'فحص تقريبي: اجعل عنوان البحث والعنوان الرئيسي يشتركان في صياغة أساسية واضحة.',
    en: 'Heuristic check: keep a clear core phrase shared by the search title and page headline.',
  },
}

export function LandingPageQualityGate({ result, locale, hasUnsavedChanges }: LandingPageQualityGateProps) {
  const ar = locale === 'ar'

  return (
    <section aria-labelledby="landing-quality-heading" className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4 lg:col-span-2">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 id="landing-quality-heading" className="text-sm font-black text-[#0B1028]">
            {ar ? 'فحص جاهزية الصفحة' : 'Page readiness review'}
          </h3>
          <p className="mt-1 max-w-2xl text-[11px] font-bold leading-5 text-slate-500">
            {ar
              ? 'هذه درجة اكتمال تحريرية وتقنية، وليست SEO score أو توقعًا للترتيب أو التحويل.'
              : 'This is an editorial and technical completeness score, not an SEO score or a ranking/conversion forecast.'}
          </p>
        </div>
        <div aria-label={ar ? `درجة الاكتمال ${result.score} من 100` : `Completeness score ${result.score} out of 100`} className="shrink-0 rounded-xl bg-white px-4 py-2 text-center shadow-sm">
          <p className="text-xl font-black text-[#5E63FF]">{result.score}<span className="text-xs text-slate-400">/100</span></p>
          <p className="text-[9px] font-black uppercase tracking-wide text-slate-400">{ar ? 'اكتمال' : 'Completeness'}</p>
        </div>
      </div>

      {hasUnsavedChanges ? (
        <div role="status" className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-black leading-5 text-amber-800">
          {ar ? 'هناك تعديلات غير محفوظة. احفظ نسخة جديدة قبل النشر حتى لا تنشر إصدارًا أقدم مما تراه.' : 'You have unsaved edits. Save a new revision before publishing so an older version is not published.'}
        </div>
      ) : null}

      <div className="mt-4 grid gap-2 md:grid-cols-2">
        {result.checks.map(check => {
          const Icon = STATUS_ICONS[check.status]
          return (
            <div key={check.id} className={`flex items-start gap-2 rounded-xl border px-3 py-2.5 text-[11px] font-bold leading-5 ${STATUS_STYLES[check.status]}`}>
              <Icon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{CHECK_COPY[check.id][locale]}</span>
            </div>
          )
        })}
      </div>

      <div className="mt-3 rounded-xl bg-white px-3 py-2.5 text-[11px] font-bold leading-5 text-slate-600">
        {result.measurementMode === 'SERVER_CONFIRMED_FORM'
          ? (ar ? 'القياس: إرسال النموذج يمكن تأكيده من السيرفر وربطه بـLead.' : 'Measurement: form intake can be server-confirmed and linked to a lead.')
          : result.measurementMode === 'CLIENT_REPORTED_CLICK'
            ? (ar ? 'القياس: الرابط الخارجي يثبت نقرة متصفح فقط؛ لا يثبت lead أو بيعًا أو إيرادًا.' : 'Measurement: an external URL proves only a browser-reported click, not a lead, sale, or revenue.')
            : (ar ? 'القياس غير مهيأ: أضف نموذج استقبال أو رابط HTTPS قبل النشر.' : 'Measurement is not configured: add a capture form or HTTPS URL before publishing.')}
      </div>
    </section>
  )
}
