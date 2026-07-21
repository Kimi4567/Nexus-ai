'use client'

import { AlertTriangle, CheckCircle2, Clock3, FileWarning, ShieldCheck } from 'lucide-react'
import type {
  BrandTruthArea,
  BrandTruthAreaKey,
  BrandTruthAreaStatus,
  BrandTruthSummary,
} from '@/lib/brandTruthRegistry'

interface BrandTruthCenterProps {
  locale: string
  summary: BrandTruthSummary
}

const LABELS: Record<BrandTruthAreaKey, { en: string; ar: string }> = {
  offer: { en: 'Offer identity', ar: 'هوية العرض' },
  pricing: { en: 'Pricing', ar: 'الأسعار' },
  sizing: { en: 'Sizing & fit', ar: 'المقاسات والملاءمة' },
  delivery: { en: 'Delivery', ar: 'التوصيل' },
  returns: { en: 'Returns & refunds', ar: 'الإرجاع والاسترداد' },
  materials_quality: { en: 'Materials & quality', ar: 'الخامات والجودة' },
  commercial_proof: { en: 'Customer & performance proof', ar: 'إثبات العملاء والأداء' },
  visual_assets: { en: 'Product visuals', ar: 'صور وفيديوهات المنتج' },
  conversion_path: { en: 'Conversion path', ar: 'مسار التحويل' },
}

const ACTIONS: Record<BrandTruthAreaKey, { en: string; ar: string }> = {
  offer: { en: 'Upload a current product, service, or package sheet.', ar: 'ارفع ملفًا حاليًا للمنتج أو الخدمة أو الباقة.' },
  pricing: { en: 'Upload an approved price list or offer sheet.', ar: 'ارفع قائمة أسعار أو ملف عرض معتمد.' },
  sizing: { en: 'Upload the current size or measurement guide.', ar: 'ارفع دليل المقاسات أو القياسات الحالي.' },
  delivery: { en: 'Upload the current delivery or shipping policy.', ar: 'ارفع سياسة التوصيل أو الشحن الحالية.' },
  returns: { en: 'Upload the current returns, refunds, or exchanges policy.', ar: 'ارفع سياسة الإرجاع أو الاسترداد أو الاستبدال.' },
  materials_quality: { en: 'Upload specifications, ingredients, or material details.', ar: 'ارفع المواصفات أو المكونات أو تفاصيل الخامات.' },
  commercial_proof: { en: 'Upload approved reviews, certifications, or measured results.', ar: 'ارفع تقييمات أو اعتمادات أو نتائج مقاسة ومعتمدة.' },
  visual_assets: { en: 'Add real product images or videos in Media Library.', ar: 'أضف صورًا أو فيديوهات حقيقية في مكتبة الوسائط.' },
  conversion_path: { en: 'Add a real live URL, form, booking page, or WhatsApp path.', ar: 'أضف رابطًا حيًا حقيقيًا أو نموذجًا أو صفحة حجز أو مسار واتساب.' },
}

const STATUS_STYLE: Record<BrandTruthAreaStatus, string> = {
  SOURCE_CONFIRMED: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  OWNER_CONFIRMED: 'border-sky-200 bg-sky-50 text-sky-800',
  PENDING_REVIEW: 'border-violet-200 bg-violet-50 text-violet-800',
  CONFLICTING: 'border-amber-300 bg-amber-50 text-amber-900',
  MISSING: 'border-slate-200 bg-slate-50 text-slate-600',
}

function statusLabel(area: BrandTruthArea, ar: boolean): string {
  if (area.status === 'SOURCE_CONFIRMED') {
    if (area.sourceKind === 'uploaded_asset') return ar ? 'مصدر بصري مرفوع' : 'Uploaded visual source'
    return ar ? 'موثّق بمصدر' : 'Source confirmed'
  }
  if (area.status === 'OWNER_CONFIRMED') return ar ? 'تأكيد صاحب المشروع فقط' : 'Owner-confirmed only'
  if (area.status === 'PENDING_REVIEW') return ar ? 'بانتظار المراجعة' : 'Pending review'
  if (area.status === 'CONFLICTING') return ar ? 'مصادر متعارضة' : 'Conflicting sources'
  return ar ? 'ناقص' : 'Missing'
}

function StatusIcon({ status }: { status: BrandTruthAreaStatus }) {
  if (status === 'SOURCE_CONFIRMED') return <CheckCircle2 size={13} />
  if (status === 'PENDING_REVIEW') return <Clock3 size={13} />
  if (status === 'CONFLICTING') return <AlertTriangle size={13} />
  if (status === 'OWNER_CONFIRMED') return <ShieldCheck size={13} />
  return <FileWarning size={13} />
}

export function BrandTruthCenter({ locale, summary }: BrandTruthCenterProps) {
  const ar = locale === 'ar'
  return (
    <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h4 className="text-sm font-extrabold text-slate-950">{ar ? 'مركز حقائق البراند' : 'Brand Truth Center'}</h4>
          <p className="mt-1 max-w-3xl text-[11px] leading-5 text-slate-600">
            {ar
              ? 'يفصل بين المصدر الموثّق، وتأكيدك الشخصي، وما يحتاج مراجعة. الادعاءات التجارية القوية لا تُفتح للنشر إلا بمصدر فعلي.'
              : 'Separates source-backed truth, owner confirmation, and review gaps. Strong commercial claims stay restricted until an inspectable source exists.'}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-1.5 text-[10px] font-bold">
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700 ring-1 ring-emerald-200">
            {summary.sourceConfirmedAreaCount} {ar ? 'موثّق' : 'source-backed'}
          </span>
          <span className="rounded-full bg-sky-50 px-2.5 py-1 text-sky-700 ring-1 ring-sky-200">
            {summary.ownerConfirmedAreaCount} {ar ? 'تأكيد شخصي' : 'owner-confirmed'}
          </span>
          <span className="rounded-full bg-slate-50 px-2.5 py-1 text-slate-600 ring-1 ring-slate-200">
            {summary.attentionAreaCount} {ar ? 'يحتاج انتباه' : 'need attention'}
          </span>
        </div>
      </div>

      {summary.restrictedStrongClaimKeys.length > 0 && (
        <div className="mt-4 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[11px] leading-5 text-amber-900">
          <AlertTriangle className="mt-0.5 shrink-0" size={15} />
          <p>
            {ar
              ? `${summary.restrictedStrongClaimKeys.length} مجالات ادعاء قوية ما زالت مقيّدة. يمكن للاستراتيجية التخطيط حول النواقص، لكنها لن تعرضها كحقائق مثبتة.`
              : `${summary.restrictedStrongClaimKeys.length} strong-claim areas remain restricted. Strategy may plan around the gaps, but cannot present them as proven facts.`}
          </p>
        </div>
      )}

      <div className="mt-4 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
        {summary.areas.map(area => {
          const needsAction = area.status !== 'SOURCE_CONFIRMED'
            && !(area.key === 'conversion_path' && area.status === 'OWNER_CONFIRMED')
          return (
            <article key={area.key} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-bold text-slate-900">{ar ? LABELS[area.key].ar : LABELS[area.key].en}</p>
                <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold ${STATUS_STYLE[area.status]}`}>
                  <StatusIcon status={area.status} />
                  {statusLabel(area, ar)}
                </span>
              </div>
              {area.sample && (
                <p className="mt-2 line-clamp-2 text-[10px] leading-4 text-slate-500">
                  {area.key === 'visual_assets'
                    ? (ar ? `${area.sample} أصل بصري مرفوع` : `${area.sample} uploaded visual assets`)
                    : area.sample}
                </p>
              )}
              {needsAction && (
                <p className="mt-2 text-[10px] font-semibold leading-4 text-slate-700">
                  {ar ? ACTIONS[area.key].ar : ACTIONS[area.key].en}
                </p>
              )}
            </article>
          )
        })}
      </div>
    </div>
  )
}
