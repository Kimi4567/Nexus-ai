'use client'

import { useEffect, useState } from 'react'
import {
  ArrowUpRight,
  Megaphone,
  MousePointerClick,
  Target,
  TrendingUp,
  Users,
  X,
} from 'lucide-react'
import CreditConfirmModal from '@/components/CreditConfirmModal'
import { CREDIT_ACTION_COSTS } from '@/lib/creditActionTruth'
import {
  OWNER_CAMPAIGN_OUTCOMES,
  type OwnerCampaignOutcome,
} from '@/lib/ownerCampaignCommand'

interface Props {
  open: boolean
  busy: boolean
  error: string | null
  locale: string
  authHeader: () => string
  onClose: () => void
  onStart: (outcome: OwnerCampaignOutcome) => void
}

const OUTCOME_COPY: Record<OwnerCampaignOutcome, {
  ar: string
  en: string
  descriptionAr: string
  descriptionEn: string
  icon: typeof Target
}> = {
  LEADS: {
    ar: 'عملاء محتملون أكثر',
    en: 'More qualified leads',
    descriptionAr: 'طلبات تواصل أو حجز أو استفسار من جمهور مناسب.',
    descriptionEn: 'More relevant enquiries, bookings, or contact requests.',
    icon: Users,
  },
  SALES: {
    ar: 'مبيعات أكثر',
    en: 'More sales',
    descriptionAr: 'حملة تركّز على العرض وتحريك قرار الشراء.',
    descriptionEn: 'A campaign focused on the offer and purchase decision.',
    icon: TrendingUp,
  },
  AWARENESS: {
    ar: 'وعي أقوى بالعلامة',
    en: 'Stronger brand awareness',
    descriptionAr: 'توضيح مكانة العلامة ورسالتها أمام الجمهور الصحيح.',
    descriptionEn: 'Clarify the brand position and message for the right audience.',
    icon: Megaphone,
  },
  TRAFFIC: {
    ar: 'زيارات أكثر',
    en: 'More traffic',
    descriptionAr: 'توجيه الجمهور إلى الموقع أو العرض أو صفحة الهبوط.',
    descriptionEn: 'Send the audience to a site, offer, or landing page.',
    icon: MousePointerClick,
  },
}

export default function OwnerCampaignStarterModal({
  open,
  busy,
  error,
  locale,
  authHeader,
  onClose,
  onStart,
}: Props) {
  const ar = locale.toLowerCase().startsWith('ar')
  const [selected, setSelected] = useState<OwnerCampaignOutcome>('LEADS')
  const [confirmingCredits, setConfirmingCredits] = useState(false)

  useEffect(() => {
    if (!open) {
      setSelected('LEADS')
      setConfirmingCredits(false)
      return
    }
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy && !confirmingCredits) onClose()
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [busy, confirmingCredits, onClose, open])

  if (!open) return null

  return (
    <>
      {!confirmingCredits ? (
        <div
        className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
        dir={ar ? 'rtl' : 'ltr'}
        role="dialog"
        aria-modal="true"
        aria-labelledby="owner-campaign-title"
        onClick={event => {
          if (event.target === event.currentTarget && !busy) onClose()
        }}
        >
          <div className="relative max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-[28px] border border-white/10 bg-white p-5 shadow-[0_30px_100px_rgba(15,23,42,0.35)] sm:p-7">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label={ar ? 'إغلاق' : 'Close'}
            className="absolute end-4 top-4 rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="pe-10">
            <span className="inline-flex items-center gap-2 rounded-full bg-[#EEF2FF] px-3 py-1.5 text-[11px] font-bold text-[#5E63FF]">
              <span className="h-2 w-2 rounded-full bg-[#5E63FF]" />
              {ar ? 'أمر واحد لـ NEXUS' : 'One command for NEXUS'}
            </span>
            <h2 id="owner-campaign-title" className="mt-4 text-[24px] font-black tracking-[-0.035em] text-[#0B1028]">
              {ar ? 'ما النتيجة الأهم الآن؟' : 'What outcome matters most now?'}
            </h2>
            <p className="mt-2 max-w-xl text-[13px] leading-6 text-slate-500">
              {ar
                ? 'سيستخدم NEXUS بيانات Brand Brain، ويختار الجمهور والنبرة والمنصات، ثم يجهّز استراتيجية ومسار تنفيذ أولي لمراجعتك.'
                : 'NEXUS will use Brand Brain to choose the audience, tone, and channels, then prepare a strategy and initial execution path for review.'}
            </p>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label={ar ? 'هدف الحملة' : 'Campaign outcome'}>
            {OWNER_CAMPAIGN_OUTCOMES.map(outcome => {
              const item = OUTCOME_COPY[outcome]
              const Icon = item.icon
              const active = selected === outcome
              return (
                <button
                  key={outcome}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  disabled={busy}
                  onClick={() => setSelected(outcome)}
                  className={`rounded-[20px] border p-4 text-start transition ${
                    active
                      ? 'border-[#5E63FF] bg-[#F4F5FF] shadow-[0_12px_30px_rgba(94,99,255,0.12)]'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${active ? 'bg-[#5E63FF] text-white' : 'bg-slate-100 text-slate-500'}`}>
                      <Icon className="h-5 w-5" />
                    </span>
                    <span>
                      <span className="block text-[14px] font-black text-[#0B1028]">
                        {ar ? item.ar : item.en}
                      </span>
                      <span className="mt-1 block text-[11px] leading-5 text-slate-500">
                        {ar ? item.descriptionAr : item.descriptionEn}
                      </span>
                    </span>
                  </div>
                </button>
              )
            })}
          </div>

          {error ? (
            <div role="alert" className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-[12px] leading-5 text-rose-700">
              {error}
            </div>
          ) : null}

          <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[11px] leading-5 text-emerald-800">
            {ar
              ? 'لن ينشر NEXUS أي محتوى ولن ينفق أي ميزانية. ستراجع الاستراتيجية أولًا، وأي مرحلة مدفوعة لاحقة لها موافقة مستقلة.'
              : 'NEXUS will not publish content or spend budget. You review the strategy first, and any later paid stage requires separate approval.'}
          </div>

          <button
            type="button"
            disabled={busy}
            onClick={() => setConfirmingCredits(true)}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#101A4D] px-5 py-3.5 text-[13px] font-black text-white shadow-[0_16px_36px_rgba(16,26,77,0.2)] transition hover:brightness-110 disabled:cursor-wait disabled:opacity-60"
          >
            {busy
              ? (ar ? 'NEXUS يبدأ التجهيز…' : 'NEXUS is starting…')
              : (ar ? 'مراجعة التكلفة وبدء التجهيز' : 'Review cost and start')}
            <ArrowUpRight className="h-4 w-4" />
          </button>
          </div>
        </div>
      ) : null}

      <CreditConfirmModal
        isOpen={confirmingCredits}
        onClose={() => setConfirmingCredits(false)}
        onConfirm={() => onStart(selected)}
        cost={CREDIT_ACTION_COSTS.RUN_FULL_STRATEGY}
        actionTitle={ar ? 'تجهيز استراتيجية الحملة' : 'Prepare campaign strategy'}
        reason={ar
          ? 'يتضمن توليد الاستراتيجية ومفاهيم الحملة والتحقق من الجودة وحفظها داخل مسار مراجعة قابل للاستكمال.'
          : 'Includes strategy and campaign-concept generation, quality checks, and durable review preparation.'}
        authHeader={authHeader}
        locale={locale}
        includedItems={ar
          ? ['استراتيجية الحملة', 'الرسائل والخطافات', 'تقويم تنفيذ أولي', 'فحص جودة']
          : ['Campaign strategy', 'Messages and hooks', 'Initial calendar', 'Quality review']}
        confirmLabel={ar ? 'وافق وابدأ التجهيز' : 'Approve and start'}
      />
    </>
  )
}
