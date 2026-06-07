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
 * Auto-hides once all 6 complete. Dismissable via localStorage.
 */

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useI18n } from '@/lib/i18n-context'
import { CheckCircle2, Circle, ChevronRight, X, Rocket, Sparkles } from 'lucide-react'
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

export default function OnboardingChecklist({ stats, brandReadiness, hasConnections }: OnboardingChecklistProps) {
  const { locale } = useI18n()
  const ar = locale === 'ar'
  const [dismissed, setDismissed] = useState(true)
  const [expanded, setExpanded] = useState(true)

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
      descAr: 'أنت هنا!',
      descEn: 'You\'re here!',
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
      descAr: 'الذاكرة الذكية التي تجعل كل AI يعرف علامتك',
      descEn: 'The memory that makes every AI know your brand',
      href: '/brand',
      ctaAr: 'أكمل Brand Brain',
      ctaEn: 'Complete Brand Brain',
    },
    {
      id: 'campaign',
      done: !!(stats && stats.campaigns > 0),
      icon: '🚀',
      labelAr: 'إنشاء أول حملة',
      labelEn: 'Create your first campaign',
      descAr: 'حدد هدفك والمنصة — NEXUS يبني الباقي',
      descEn: 'Set your goal and platform — NEXUS builds the rest',
      href: '/campaigns/new',
      ctaAr: 'إنشاء حملة',
      ctaEn: 'Create campaign',
    },
    {
      id: 'strategy',
      done: !!(stats && (stats.strategiesRun ?? stats.campaigns) > 0),
      icon: '🎯',
      labelAr: 'تشغيل الاستراتيجية',
      labelEn: 'Run your strategy',
      descAr: 'الـ AI يحلل سوقك ويبني لك استراتيجية كاملة',
      descEn: 'AI analyzes your market and builds a full strategy',
      href: '/campaigns',
      ctaAr: 'اذهب للحملات',
      ctaEn: 'Go to campaigns',
    },
    {
      id: 'content',
      done: !!(stats && (stats.contentPlans ?? 0) > 0),
      icon: '✨',
      labelAr: 'توليد خطة المحتوى',
      labelEn: 'Generate content plan',
      descAr: 'منشورات جاهزة لكل منصة بلمسة واحدة',
      descEn: 'Ready-to-use posts for every platform in one tap',
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
      descAr: 'وصّل حساباتك وانشر مباشرةً من NEXUS',
      descEn: 'Connect your accounts and publish directly from NEXUS',
      href: '/connections',
      ctaAr: 'ربط المنصات',
      ctaEn: 'Connect platforms',
    },
  ]

  const completedCount = steps.filter(s => s.done).length
  const allDone = completedCount === steps.length
  const progressPct = Math.round((completedCount / steps.length) * 100)
  const nextStep = steps.find(s => !s.done)

  if (dismissed || allDone) return null

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
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white">
                {ar ? 'دليل البداية' : 'Getting Started'}
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(139,92,246,0.15)', color: '#c4b5fd', border: '1px solid rgba(139,92,246,0.25)' }}>
                {completedCount}/{steps.length}
              </span>
            </div>
            {/* Progress bar */}
            <div className="mt-1.5 w-full h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${progressPct}%`,
                  background: 'linear-gradient(90deg, #8b5cf6, #06b6d4)',
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
                    <p className={`text-xs font-semibold ${step.done ? 'line-through' : 'text-white'}`}
                      style={{ color: step.done ? 'rgba(255,255,255,0.35)' : undefined }}>
                      <span className="mr-1">{step.icon}</span>
                      {ar ? step.labelAr : step.labelEn}
                    </p>
                    {!step.done && (
                      <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
                        {ar ? step.descAr : step.descEn}
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
                  <span style={{ color: '#e2d9f3' }}>
                    {ar
                      ? `الخطوة التالية: ${nextStep.labelAr}`
                      : `Next step: ${nextStep.labelEn}`}
                  </span>
                </div>
                <ChevronRight className="w-4 h-4" style={{ color: '#8b5cf6' }} />
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  )
}
