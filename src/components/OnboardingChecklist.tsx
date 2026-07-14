'use client'

/**
 * OnboardingChecklist — "Getting Started" guide shown on dashboard.
 *
 * 6 steps that map to the core value loop:
 *  1. Account created       — always true
 *  2. Brand Brain set up    — brandReadiness.ready
 *  3. First campaign        — stats.campaigns > 0
 *  4. Run strategy          — stats.strategiesRun > 0
 *  5. Generate content      — stats.contentPlans > 0
 *  6. Connect & publish     — stats.publishedPostsTotal > 0
 *
 * Auto-shows celebration when all 6 complete, then hides after 3s.
 * Dismissable at any time via X button.
 */

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useI18n } from '@/lib/i18n-context'
import { CheckCircle2, Circle, ChevronRight, X, Rocket, Sparkles, Clock, Trophy } from 'lucide-react'
import type { BrandReadinessResult } from '@/lib/brandReadiness'

interface ChecklistStats {
  campaigns: number
  publishedPostsTotal: number
  strategiesRun?: number
  contentPlans?: number
}

interface OnboardingChecklistProps {
  stats: ChecklistStats | null
  brandReadiness: BrandReadinessResult | null
  hasConnections: boolean | null
}

const LS_KEY = 'nexus_checklist_dismissed_v2'
const LS_CELEBRATED = 'nexus_checklist_celebrated_v1'

export default function OnboardingChecklist({ stats, brandReadiness, hasConnections }: OnboardingChecklistProps) {
  const { locale } = useI18n()
  const ar = locale === 'ar'
  const [dismissed, setDismissed] = useState(true)
  const [expanded, setExpanded] = useState(true)
  const [celebrating, setCelebrating] = useState(false)
  const celebrationTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setDismissed(localStorage.getItem(LS_KEY) === '1')
  }, [])

  const steps = [
    {
      id: 'account',
      done: true,
      icon: '✅',
      labelAr: 'إنشاء الحساب',
      labelEn: 'Create your account',
      descAr: 'أنت هنا — مرحباً بك!',
      descEn: 'You\'re in — welcome aboard!',
      whyAr: null,
      whyEn: null,
      timeEstAr: null,
      timeEstEn: null,
      href: null,
      ctaAr: null,
      ctaEn: null,
    },
    {
      id: 'brand',
      done: !!(brandReadiness?.ready),
      icon: '🧠',
      labelAr: 'إعداد Brand Brain',
      labelEn: 'Set up Brand Brain',
      descAr: 'ذاكرة العلامة التي تساعد NEXUS على تخصيص الاستراتيجية والمحتوى',
      descEn: 'The brand memory that helps NEXUS tailor strategy and content',
      whyAr: 'بدونها، تكون التوصيات أعمّ. معها، يمكن أن تصبح المخرجات أكثر صلة بعملك.',
      whyEn: 'Without it, recommendations are more generic. With it, outputs can become more relevant to your business.',
      timeEstAr: '٣ دقائق',
      timeEstEn: '3 min',
      href: '/brand',
      ctaAr: 'أكمل Brand Brain',
      ctaEn: 'Complete Brand Brain',
    },
    {
      id: 'strategy-entry',
      done: !!(stats && stats.campaigns > 0),
      icon: '🚀',
      labelAr: 'إعداد أول استراتيجية',
      labelEn: 'Prepare your first strategy',
      descAr: 'ابدأ من الاستراتيجية قبل إنشاء المحتوى أو الجدولة',
      descEn: 'Start with strategy before creating content or scheduling work',
      whyAr: 'الاستراتيجية توضح الاتجاه قبل أن يتحول العمل إلى محتوى أو نشر.',
      whyEn: 'Strategy clarifies direction before work becomes content or publishing.',
      timeEstAr: '١ دقيقة',
      timeEstEn: '1 min',
      href: '/strategy',
      ctaAr: 'فتح الاستراتيجية',
      ctaEn: 'Open Strategy',
    },
    {
      id: 'strategy-review',
      done: !!(stats && (stats.strategiesRun ?? stats.campaigns) > 0),
      icon: '🎯',
      labelAr: 'مراجعة الاستراتيجية',
      labelEn: 'Review strategy',
      descAr: 'راجع الخطة قبل تحويلها إلى محتوى',
      descEn: 'Review the plan before turning it into content',
      whyAr: 'الاستراتيجية تعطيك الاتجاه والتموضع والرسائل قبل التنفيذ.',
      whyEn: 'Strategy gives you direction, positioning, and messages before execution.',
      timeEstAr: '٢ دقيقة',
      timeEstEn: '2 min',
      href: '/strategy',
      ctaAr: 'فتح مسار الاستراتيجية',
      ctaEn: 'Open strategy workflow',
    },
    {
      id: 'content',
      done: !!(stats && (stats.contentPlans ?? 0) > 0),
      icon: '✨',
      labelAr: 'توليد خطة المحتوى',
      labelEn: 'Generate content plan',
      descAr: 'مسودات منشورات للمراجعة قبل الجدولة أو النشر',
      descEn: 'Draft posts to review before scheduling or publishing',
      whyAr: 'خطة محتوى قابلة للمراجعة — Instagram، TikTok، LinkedIn وأكثر',
      whyEn: 'A reviewable content plan — Instagram, TikTok, LinkedIn and more',
      timeEstAr: '٣٠ ثانية',
      timeEstEn: '30 sec',
      href: '/content-hub',
      ctaAr: 'Content Hub',
      ctaEn: 'Content Hub',
    },
    {
      id: 'publish',
      done: !!(stats && stats.publishedPostsTotal > 0),
      icon: '📡',
      labelAr: 'نشر أول منشور',
      labelEn: 'Publish your first post',
      descAr: 'وصّل حساباتك عندما تكون جاهزاً لمراجعة إعداد النشر',
      descEn: 'Connect accounts when you are ready to review publishing setup',
      whyAr: 'بعد نشر المنشورات وتوفر التحليلات، يمكن لـ NEXUS اقتراح إشارات أداء لمراجعة Brand Brain.',
      whyEn: 'After posts are published and analytics are available, NEXUS can suggest performance signals for Brand Brain review.',
      timeEstAr: '٢ دقيقة',
      timeEstEn: '2 min',
      href: '/connections',
      ctaAr: 'ربط المنصات',
      ctaEn: 'Connect platforms',
    },
  ]

  const completedCount = steps.filter(s => s.done).length
  const allDone = completedCount === steps.length
  const progressPct = Math.round((completedCount / steps.length) * 100)
  const nextStep = steps.find(s => !s.done)

  // Celebration effect when all steps just completed
  useEffect(() => {
    if (allDone && !dismissed && localStorage.getItem(LS_CELEBRATED) !== '1') {
      setCelebrating(true)
      localStorage.setItem(LS_CELEBRATED, '1')
      celebrationTimer.current = setTimeout(() => {
        setCelebrating(false)
        localStorage.setItem(LS_KEY, '1')
        setDismissed(true)
      }, 3500)
    }
    return () => {
      if (celebrationTimer.current) clearTimeout(celebrationTimer.current)
    }
  }, [allDone, dismissed])

  if (dismissed && !celebrating) return null

  // ── Celebration screen ─────────────────────────────────────────
  if (celebrating) {
    return (
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: 'rgba(10,11,28,0.9)',
          border: '1px solid rgba(16,185,129,0.4)',
          boxShadow: '0 0 48px rgba(16,185,129,0.12)',
          backdropFilter: 'blur(16px)',
        }}
      >
        <div className="h-0.5" style={{ background: 'linear-gradient(90deg, #10b981, #06b6d4, #8b5cf6, #f59e0b)' }} />
        <div className="p-6 text-center">
          <div className="w-14 h-14 mx-auto mb-3 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', boxShadow: '0 0 32px rgba(16,185,129,0.15)' }}>
            <Trophy className="w-7 h-7" style={{ color: '#10b981' }} />
          </div>
          <h3 className="text-base font-bold text-white mb-1">
            {ar ? '🎉 الإعداد مكتمل!' : '🎉 Setup complete!'}
          </h3>
          <p className="text-sm" style={{ color: 'var(--nx-text-3)' }}>
            {ar
              ? 'اكتمل الإعداد الأساسي — لدى NEXUS سياق علامتك المحفوظ'
              : 'Core setup is complete — NEXUS has your saved brand context'}
          </p>
          <div className="mt-4 flex items-center justify-center gap-1.5">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="w-2 h-2 rounded-full" style={{ background: '#10b981', opacity: 0.6 + i * 0.07 }} />
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ── Main checklist ─────────────────────────────────────────────
  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: 'rgba(10,11,28,0.75)',
        border: '1px solid rgba(139,92,246,0.2)',
        boxShadow: '0 0 32px rgba(139,92,246,0.05)',
        backdropFilter: 'blur(12px)',
      }}
    >
      {/* Top accent line */}
      <div className="h-0.5" style={{ background: 'linear-gradient(90deg, #8b5cf6, #06b6d4, #10b981)' }} />

      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3">
        <button
          onClick={() => setExpanded(v => !v)}
          className="flex items-center gap-3 flex-1 min-w-0 text-left"
        >
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.2)' }}>
            <Rocket className="w-4 h-4" style={{ color: '#8b5cf6' }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-white">
                {ar ? 'دليل البداية السريعة' : 'Quick Start Guide'}
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(139,92,246,0.15)', color: '#c4b5fd', border: '1px solid rgba(139,92,246,0.25)' }}>
                {completedCount}/{steps.length}
              </span>
              {nextStep && (
                <span className="hidden sm:flex items-center gap-1 text-[10px]" style={{ color: 'var(--nx-text-4)' }}>
                  <Clock className="w-3 h-3" />
                  {ar
                    ? `متبقي ~${steps.filter(s => !s.done && s.timeEstAr).reduce((acc) => acc, 0)} دقائق`
                    : `~${steps.filter(s => !s.done).length * 2} min to finish`}
                </span>
              )}
            </div>
            {/* Progress bar */}
            <div className="mt-1.5 w-full h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${progressPct}%`,
                  background: progressPct === 100
                    ? 'linear-gradient(90deg, #10b981, #06b6d4)'
                    : 'linear-gradient(90deg, #8b5cf6, #06b6d4)',
                }}
              />
            </div>
          </div>
        </button>
        <div className="flex items-center gap-1 flex-shrink-0 ml-3">
          <button
            onClick={() => setExpanded(v => !v)}
            className="p-1.5 rounded-lg transition-all hover:bg-white/5"
            style={{ color: 'rgba(255,255,255,0.3)' }}
          >
            <ChevronRight
              className="w-3.5 h-3.5 transition-transform duration-200"
              style={{ transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
            />
          </button>
          <button
            onClick={() => { localStorage.setItem(LS_KEY, '1'); setDismissed(true) }}
            className="p-1.5 rounded-lg transition-all hover:bg-white/5"
            style={{ color: 'rgba(255,255,255,0.3)' }}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Steps — collapsible */}
      {expanded && (
        <>
          <div className="px-4 pb-2 space-y-1">
            {steps.map((step, idx) => {
              const isNext = !step.done && nextStep?.id === step.id
              return (
                <div
                  key={step.id}
                  className="flex items-start gap-3 px-3 py-2.5 rounded-xl transition-all"
                  style={{
                    background: isNext ? 'rgba(139,92,246,0.06)' : 'transparent',
                    border: isNext ? '1px solid rgba(139,92,246,0.15)' : '1px solid transparent',
                    opacity: step.done ? 0.45 : 1,
                  }}
                >
                  {/* Icon / check */}
                  <div className="flex-shrink-0 mt-0.5">
                    {step.done ? (
                      <CheckCircle2 className="w-4 h-4" style={{ color: '#10b981' }} />
                    ) : isNext ? (
                      <div className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black"
                        style={{ background: 'rgba(139,92,246,0.25)', color: '#c4b5fd', border: '1px solid rgba(139,92,246,0.4)' }}>
                        {idx + 1}
                      </div>
                    ) : (
                      <Circle className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.2)' }} />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className={`text-xs font-semibold ${step.done ? 'line-through' : 'text-white'}`}
                        style={{ color: step.done ? 'rgba(255,255,255,0.35)' : undefined }}>
                        <span className="mr-1">{step.icon}</span>
                        {ar ? step.labelAr : step.labelEn}
                      </p>
                      {!step.done && step.timeEstEn && (
                        <span className="flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full font-medium"
                          style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.25)', border: '1px solid rgba(255,255,255,0.07)' }}>
                          <Clock className="w-2.5 h-2.5" />
                          {ar ? step.timeEstAr : step.timeEstEn}
                        </span>
                      )}
                    </div>
                    {!step.done && (
                      <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
                        {ar ? step.descAr : step.descEn}
                      </p>
                    )}
                    {/* "Why it matters" — shown only for the active next step */}
                    {isNext && (step.whyAr || step.whyEn) && (
                      <p className="text-[10px] mt-1 italic" style={{ color: 'rgba(139,92,246,0.6)' }}>
                        {ar ? step.whyAr : step.whyEn}
                      </p>
                    )}
                  </div>

                  {/* CTA */}
                  {!step.done && step.href && (
                    <Link
                      href={step.href}
                      className="flex-shrink-0 flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all hover:brightness-110"
                      style={{
                        background: isNext ? 'rgba(139,92,246,0.2)' : 'transparent',
                        color: isNext ? '#c4b5fd' : 'rgba(255,255,255,0.3)',
                        border: isNext ? '1px solid rgba(139,92,246,0.3)' : '1px solid transparent',
                      }}
                    >
                      {ar ? step.ctaAr : step.ctaEn}
                      <ChevronRight className="w-3 h-3" />
                    </Link>
                  )}
                </div>
              )
            })}
          </div>

          {/* Bottom: next action prominence */}
          {nextStep?.href && (
            <div className="px-4 pb-4">
              <Link
                href={nextStep.href}
                className="flex items-center justify-between w-full px-4 py-3 rounded-xl font-bold text-sm text-white transition-all hover:brightness-110"
                style={{
                  background: 'linear-gradient(135deg, rgba(139,92,246,0.2), rgba(6,182,212,0.1))',
                  border: '1px solid rgba(139,92,246,0.3)',
                }}
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4" style={{ color: '#c4b5fd' }} />
                  <div>
                    <span className="text-[10px] font-medium block" style={{ color: 'rgba(255,255,255,0.4)' }}>
                      {ar ? 'الخطوة التالية' : 'Next step'}
                    </span>
                    <span className="text-xs" style={{ color: '#e2d9f3' }}>
                      {ar ? nextStep.labelAr : nextStep.labelEn}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {(ar ? nextStep.timeEstAr : nextStep.timeEstEn) && (
                    <span className="text-[10px] flex items-center gap-1" style={{ color: 'rgba(255,255,255,0.3)' }}>
                      <Clock className="w-3 h-3" />
                      {ar ? nextStep.timeEstAr : nextStep.timeEstEn}
                    </span>
                  )}
                  <ChevronRight className="w-4 h-4" style={{ color: '#8b5cf6' }} />
                </div>
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  )
}
