'use client'

import Link from 'next/link'

/* ═══════════════════════════════════════════════════════════════
   MARKETING JOURNEY BAR
   Shows users where they are in the funnel:
   Brand → Campaign → Content → Schedule → Analyze
   Data-driven: each step activates based on real user progress.
   ═══════════════════════════════════════════════════════════════ */

interface Step {
  id: number
  labelEn: string
  labelAr: string
  descEn: string
  descAr: string
  icon: string
  href: string
  ctaEn: string
  ctaAr: string
}

const STEPS: Step[] = [
  {
    id: 1,
    labelEn: 'Brand Brain',
    labelAr: 'عقل العلامة',
    descEn: 'Set up your brand identity so AI knows your voice',
    descAr: 'أعدد هوية علامتك حتى يعرف الذكاء الاصطناعي صوتك',
    icon: '🧠',
    href: '/brand',
    ctaEn: 'Set up Brand Brain',
    ctaAr: 'إعداد Brand Brain',
  },
  {
    id: 2,
    labelEn: 'First Campaign',
    labelAr: 'أول حملة',
    descEn: 'Create a content plan — AI builds strategy + posts for you',
    descAr: 'أنشئ خطة محتوى — الذكاء الاصطناعي يبني الاستراتيجية والبوستات',
    icon: '🎯',
    href: '/campaigns/new',
    ctaEn: 'Create Campaign',
    ctaAr: 'إنشاء حملة',
  },
  {
    id: 3,
    labelEn: 'Content Ready',
    labelAr: 'المحتوى جاهز',
    descEn: 'Review & approve your AI-generated posts in Content Hub',
    descAr: 'راجع وافقد على بوستاتك في مركز المحتوى',
    icon: '📝',
    href: '/content-hub',
    ctaEn: 'Open Content Hub',
    ctaAr: 'فتح مركز المحتوى',
  },
  {
    id: 4,
    labelEn: 'Connect & Schedule',
    labelAr: 'اتصل وجدول',
    descEn: 'Connect your social accounts and schedule your first post',
    descAr: 'اربط حساباتك الاجتماعية وجدول أول بوست',
    icon: '📡',
    href: '/connections',
    ctaEn: 'Connect Accounts',
    ctaAr: 'ربط الحسابات',
  },
  {
    id: 5,
    labelEn: 'Analyze & Grow',
    labelAr: 'تحليل ونمو',
    descEn: 'Track performance and let AI learn what works for your brand',
    descAr: 'تتبع الأداء ودع الذكاء الاصطناعي يتعلم ما يناسب علامتك',
    icon: '📊',
    href: '/analytics',
    ctaEn: 'View Analytics',
    ctaAr: 'عرض التحليلات',
  },
]

interface MarketingJourneyBarProps {
  brandReady: boolean
  hasCampaigns: boolean
  hasContent: boolean
  hasConnections: boolean
  hasPublished: boolean
  locale: string
}

export default function MarketingJourneyBar({
  brandReady,
  hasCampaigns,
  hasContent,
  hasConnections,
  hasPublished,
  locale,
}: MarketingJourneyBarProps) {
  const ar = locale === 'ar'

  // Map step completion
  const completed = [brandReady, hasCampaigns, hasContent, hasConnections, hasPublished]

  // Find the active step (first incomplete)
  const activeIndex = completed.findIndex(c => !c)
  const allDone = activeIndex === -1

  // If everything is done, don't show the bar
  if (allDone) return null

  const activeStep = allDone ? null : STEPS[activeIndex]

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: '#FFFFFF', border: '1px solid rgba(15,23,42,0.08)' }}
    >
      {/* Top accent line */}
      <div className="h-0.5" style={{ background: 'linear-gradient(90deg, #8B5CF6, #F97316, #10B981)' }} />

      <div className="px-5 py-4">
        {/* Title row */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">
              {ar ? 'رحلة التسويق' : 'Marketing Journey'}
            </p>
            {activeStep && (
              <p className="text-[13px] font-semibold text-slate-700">
                {ar
                  ? `الخطوة ${activeStep.id} من ${STEPS.length}: ${activeStep.labelAr}`
                  : `Step ${activeStep.id} of ${STEPS.length}: ${activeStep.labelEn}`}
              </p>
            )}
          </div>
          <span className="text-[11px] font-medium px-2.5 py-1 rounded-full"
            style={{ background: 'rgba(249,115,22,0.08)', color: '#C2410C', border: '1px solid rgba(249,115,22,0.18)' }}>
            {completed.filter(Boolean).length}/{STEPS.length} {ar ? 'مكتمل' : 'done'}
          </span>
        </div>

        {/* Steps — horizontal row */}
        <div className="flex items-center gap-0 overflow-x-auto pb-1 -mx-1 px-1">
          {STEPS.map((step, idx) => {
            const isDone = completed[idx]
            const isActive = idx === activeIndex
            const isUpcoming = !isDone && !isActive

            return (
              <div key={step.id} className="flex items-center flex-shrink-0">
                {/* Step node */}
                <Link
                  href={step.href}
                  className="flex flex-col items-center gap-1.5 group"
                  style={{ minWidth: '80px', maxWidth: '100px' }}
                >
                  {/* Circle */}
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center text-base transition-all duration-200 relative ${
                      isDone ? 'shadow-sm' : isActive ? 'shadow-md' : ''
                    }`}
                    style={
                      isDone
                        ? { background: 'rgba(16,185,129,0.1)', border: '1.5px solid rgba(16,185,129,0.4)' }
                        : isActive
                        ? { background: 'rgba(249,115,22,0.12)', border: '2px solid rgba(249,115,22,0.5)',
                            boxShadow: '0 0 0 4px rgba(249,115,22,0.08)' }
                        : { background: '#F5F5F7', border: '1.5px solid rgba(15,23,42,0.1)' }
                    }
                  >
                    {isDone ? (
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M3 8l3.5 3.5 6.5-7" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : (
                      <span className={isUpcoming ? 'opacity-40' : ''}>{step.icon}</span>
                    )}
                    {isActive && (
                      <span
                        className="absolute inset-0 rounded-full animate-ping"
                        style={{ background: 'rgba(249,115,22,0.15)' }}
                      />
                    )}
                  </div>

                  {/* Label */}
                  <span
                    className="text-[10px] font-semibold text-center leading-tight"
                    style={{
                      color: isDone ? '#10B981' : isActive ? '#C2410C' : '#9CA3AF',
                    }}
                  >
                    {ar ? step.labelAr : step.labelEn}
                  </span>
                </Link>

                {/* Connector line */}
                {idx < STEPS.length - 1 && (
                  <div
                    className="h-0.5 flex-1 mx-1 rounded-full"
                    style={{
                      background: completed[idx]
                        ? 'rgba(16,185,129,0.35)'
                        : 'rgba(15,23,42,0.08)',
                      minWidth: '16px',
                      maxWidth: '40px',
                    }}
                  />
                )}
              </div>
            )
          })}
        </div>

        {/* Active step description + CTA */}
        {activeStep && (
          <div
            className="mt-4 flex items-center justify-between gap-4 rounded-xl px-4 py-3"
            style={{ background: 'rgba(249,115,22,0.05)', border: '1px solid rgba(249,115,22,0.15)' }}
          >
            <p className="text-[12px] text-slate-600 leading-relaxed flex-1">
              {ar ? activeStep.descAr : activeStep.descEn}
            </p>
            <Link
              href={activeStep.href}
              className="flex items-center gap-1.5 text-[12px] font-bold px-3 py-1.5 rounded-lg flex-shrink-0 transition-all hover:brightness-95"
              style={{ background: '#F97316', color: '#FFFFFF' }}
            >
              {ar ? activeStep.ctaAr : activeStep.ctaEn}
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2.5 6h7M6.5 3l3 3-3 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
