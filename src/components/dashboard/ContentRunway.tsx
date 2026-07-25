import Link from 'next/link'
import {
  ArrowUpRight,
  CalendarClock,
  Check,
  CircleAlert,
  Clock3,
  Film,
  ImageIcon,
  LockKeyhole,
  Radio,
} from 'lucide-react'
import type {
  DashboardContentRunwayItem,
  DashboardContentRunwayState,
} from '@/lib/dashboardContentRunway'

export interface DashboardContentRunwaySummary {
  scheduledWithEvidence: number
  manualScheduled: number
  autoDeliveryConfigured: number
  externallyPublished: number
  manuallyPublished: number
  mediaApproved: number
  approvedReady: number
}

interface ContentRunwayProps {
  ar: boolean
  items: DashboardContentRunwayItem[]
  summary: DashboardContentRunwaySummary
}

const STATE_PRESENTATION: Record<DashboardContentRunwayState, {
  en: string
  ar: string
  detailEn: string
  detailAr: string
  tone: string
}> = {
  NEEDS_ATTENTION: {
    en: 'Needs attention',
    ar: 'يحتاج انتباهًا',
    detailEn: 'Evidence or delivery configuration is incomplete.',
    detailAr: 'دليل القرار أو إعداد التسليم غير مكتمل.',
    tone: 'border-rose-200 bg-rose-50 text-rose-700',
  },
  FAILED: {
    en: 'Failed',
    ar: 'متعثر',
    detailEn: 'Resolve the recorded failure before continuing.',
    detailAr: 'عالج الفشل المسجل قبل متابعة التنفيذ.',
    tone: 'border-rose-200 bg-rose-50 text-rose-700',
  },
  OVERDUE_MANUAL: {
    en: 'Manual delivery overdue',
    ar: 'التسليم اليدوي متأخر',
    detailEn: 'The internal time passed with no verified publication.',
    detailAr: 'مر الموعد الداخلي دون إثبات نشر.',
    tone: 'border-amber-200 bg-amber-50 text-amber-800',
  },
  PROCESSING: {
    en: 'Provider processing',
    ar: 'قيد معالجة المنصة',
    detailEn: 'A provider accepted the request; final confirmation is pending.',
    detailAr: 'قبلت المنصة الطلب وينتظر تأكيد النشر النهائي.',
    tone: 'border-sky-200 bg-sky-50 text-sky-700',
  },
  INTERNAL_SCHEDULE_MANUAL: {
    en: 'Scheduled in NEXUS',
    ar: 'مجدول داخل NEXUS',
    detailEn: 'Internal schedule only · manual delivery required.',
    detailAr: 'جدولة داخلية فقط · يلزم تسليم يدوي.',
    tone: 'border-violet-200 bg-violet-50 text-violet-700',
  },
  AUTO_DELIVERY_CONFIGURED: {
    en: 'Auto delivery configured',
    ar: 'التسليم التلقائي مهيأ',
    detailEn: 'Schedule, integration, and explicit consent are recorded.',
    detailAr: 'تم توثيق الجدولة والربط والموافقة الصريحة.',
    tone: 'border-cyan-200 bg-cyan-50 text-cyan-700',
  },
  APPROVED_READY: {
    en: 'Approved · ready to schedule',
    ar: 'معتمد · جاهز للجدولة',
    detailEn: 'Copy and final media have separate approval evidence.',
    detailAr: 'للنص والوسائط النهائية دليلا اعتماد منفصلان.',
    tone: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  },
  DRAFT_REVIEW: {
    en: 'Draft review',
    ar: 'مسودة للمراجعة',
    detailEn: 'A human decision is required before scheduling.',
    detailAr: 'يلزم قرار بشري قبل الجدولة.',
    tone: 'border-slate-200 bg-slate-50 text-slate-600',
  },
  PUBLISHED_EXTERNAL: {
    en: 'Published · provider verified',
    ar: 'منشور · موثق من المنصة',
    detailEn: 'A provider publication reference is recorded.',
    detailAr: 'تم تسجيل مرجع نشر صادر من المنصة.',
    tone: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  },
  PUBLISHED_MANUAL: {
    en: 'Marked published manually',
    ar: 'تم تأكيد النشر يدويًا',
    detailEn: 'User-confirmed; no provider API proof is claimed.',
    detailAr: 'تأكيد من المستخدم دون ادعاء إثبات API.',
    tone: 'border-indigo-200 bg-indigo-50 text-indigo-700',
  },
}

function cloudinaryVideoPoster(url: string): string | null {
  if (!url.includes('/video/upload/')) return null
  return url
    .replace('/video/upload/', '/video/upload/so_0,f_jpg,q_auto/')
    .replace(/\.(mp4|mov|webm|m4v)(\?.*)?$/i, '.jpg$2')
}

function mediaStyle(item: DashboardContentRunwayItem): React.CSSProperties | undefined {
  if (!item.mediaUrl) return undefined
  const previewUrl = item.mediaKind === 'video'
    ? cloudinaryVideoPoster(item.mediaUrl)
    : item.mediaUrl
  return previewUrl
    ? { backgroundImage: `linear-gradient(180deg, transparent 52%, rgba(7,16,39,0.62)), url("${previewUrl}")` }
    : undefined
}

function formatSchedule(value: string | null, ar: boolean): string {
  if (!value) return ar ? 'بدون موعد تنفيذي' : 'No execution time'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ar ? 'موعد غير صالح' : 'Invalid time'
  return new Intl.DateTimeFormat(ar ? 'ar-AE' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed)
}

function EvidenceChip({
  ready,
  label,
}: {
  ready: boolean
  label: string
}) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[9px] font-bold ${
      ready ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
    }`}>
      {ready ? <Check className="h-3 w-3" /> : <Clock3 className="h-3 w-3" />}
      {label}
    </span>
  )
}

export function ContentRunway({
  ar,
  items,
  summary,
}: ContentRunwayProps) {
  return (
    <section className="nx-os-card nx-dashboard-content-runway overflow-hidden p-5 sm:p-6" dir={ar ? 'rtl' : 'ltr'}>
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <div className="nx-ai-chip mb-3">
            <span className="nx-ai-core" aria-hidden="true" />
            {ar ? 'مسار المحتوى الحي' : 'Live content runway'}
          </div>
          <h2 className="text-[22px] font-semibold tracking-[-0.03em] text-[#0B1028]">
            {ar ? 'ما هو جاهز، وما الذي سيحدث بعد ذلك' : 'What is ready, and what happens next'}
          </h2>
          <p className="mt-2 max-w-3xl text-[12px] leading-5 text-slate-600">
            {ar
              ? 'وسائط مرتبطة فعليًا وحالة تنفيذ مبنية على أدلة الاعتماد والجدولة والنشر. الجدولة الداخلية لا تعني نشرًا خارجيًا.'
              : 'Real attached media with execution states derived from approval, schedule, and publication evidence. An internal schedule never means external publication.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="nx-dashboard-runway-summary">
            <CalendarClock className="h-3.5 w-3.5 text-violet-600" />
            <b dir="ltr">{summary.scheduledWithEvidence}</b>
            {ar ? 'جدولات موثقة' : 'evidenced schedules'}
          </span>
          <span className="nx-dashboard-runway-summary">
            <LockKeyhole className="h-3.5 w-3.5 text-amber-600" />
            <b dir="ltr">{summary.manualScheduled}</b>
            {ar ? 'تسليم يدوي' : 'manual delivery'}
          </span>
          <span className="nx-dashboard-runway-summary">
            <Radio className="h-3.5 w-3.5 text-emerald-600" />
            <b dir="ltr">{summary.externallyPublished}</b>
            {ar ? 'نشر موثق خارجيًا' : 'provider-verified live'}
          </span>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="mt-5 rounded-[20px] border border-dashed border-slate-200 bg-white/70 px-5 py-8 text-center">
          <CircleAlert className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-3 text-[13px] font-bold text-slate-700">
            {ar ? 'لا يوجد محتوى تشغيلي بعد' : 'No operational content yet'}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            {ar ? 'ستظهر هنا مسودات Content Hub وقراراتها الفعلية.' : 'Content Hub drafts and their real decisions will appear here.'}
          </p>
        </div>
      ) : (
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {items.slice(0, 3).map(item => {
            const state = STATE_PRESENTATION[item.state]
            const visualStyle = mediaStyle(item)
            return (
              <article key={item.id} className="nx-dashboard-content-card">
                <div
                  className={`nx-dashboard-content-media ${visualStyle ? 'bg-cover bg-center' : ''}`}
                  style={visualStyle}
                  role="img"
                  aria-label={ar ? `وسائط منشور ${item.campaignName}` : `Media for ${item.campaignName} post`}
                >
                  {!visualStyle ? (
                    <div className="flex h-full items-center justify-center text-white/80">
                      {item.mediaKind === 'video' ? <Film className="h-8 w-8" /> : <ImageIcon className="h-8 w-8" />}
                    </div>
                  ) : null}
                  <div className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-2">
                    <span className="rounded-full bg-slate-950/65 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.08em] text-white backdrop-blur">
                      {item.platform}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-950/65 px-2.5 py-1 text-[9px] font-bold text-white backdrop-blur">
                      {item.mediaKind === 'video' ? <Film className="h-3 w-3" /> : <ImageIcon className="h-3 w-3" />}
                      {item.mediaKind === 'none'
                        ? (ar ? 'لا توجد وسائط' : 'No media')
                        : item.mediaKind === 'video'
                        ? (item.mediaApproved
                            ? (ar ? 'فيديو نهائي' : 'Final video')
                            : (ar ? 'معاينة فيديو' : 'Video preview'))
                        : (item.mediaApproved
                            ? (ar ? 'صورة نهائية' : 'Final image')
                            : (ar ? 'معاينة صورة' : 'Image preview'))}
                    </span>
                  </div>
                </div>

                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">
                        {item.campaignName}
                        {item.contentPlanIndex ? ` · #${item.contentPlanIndex}` : ''}
                      </p>
                      <p className="mt-1 line-clamp-2 min-h-10 text-[13px] font-semibold leading-5 text-[#0B1028]">
                        {item.caption || (ar ? 'لا يوجد نص محفوظ' : 'No saved caption')}
                      </p>
                    </div>
                    <Link
                      href={item.contentHubHref}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-[#5E63FF] transition hover:border-violet-200 hover:bg-violet-50"
                      aria-label={ar ? 'فتح المنشور في Content Hub' : 'Open post in Content Hub'}
                    >
                      <ArrowUpRight className="h-4 w-4" />
                    </Link>
                  </div>

                  <div className="mt-3 flex items-center gap-2 text-[10px] font-semibold text-slate-500">
                    <CalendarClock className="h-3.5 w-3.5 text-violet-500" />
                    <span>{formatSchedule(item.scheduledAt, ar)}</span>
                  </div>

                  <div className={`mt-3 rounded-xl border px-3 py-2 ${state.tone}`}>
                    <p className="text-[10px] font-black">{ar ? state.ar : state.en}</p>
                    <p className="mt-0.5 text-[9px] font-medium leading-4 opacity-80">
                      {ar ? state.detailAr : state.detailEn}
                    </p>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <EvidenceChip ready={item.copyApproved} label={ar ? 'النص معتمد' : 'Copy approved'} />
                    <EvidenceChip ready={item.mediaApproved} label={ar ? 'الوسائط معتمدة' : 'Media approved'} />
                    <EvidenceChip ready={item.scheduleEvidenced} label={ar ? 'الجدولة موثقة' : 'Schedule evidenced'} />
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
