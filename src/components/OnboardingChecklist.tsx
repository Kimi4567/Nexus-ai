'use client'

/**
 * OnboardingChecklist — "Getting Started" widget shown on dashboard.
 *
 * Derives completion from live data (no separate API needed):
 *  1. Account created       — always true if this component renders
 *  2. Brand Brain set up    — from brandReadiness.ready
 *  3. First campaign        — stats.campaigns > 0
 *  4. Connect social media  — hasConnections
 *  5. Publish first post    — stats.publishedPostsTotal > 0
 *
 * Disappears automatically once all 5 steps are complete.
 * User can also dismiss manually (stored in localStorage).
 *
 * Sprint U — Onboarding Intelligence
 */

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useI18n } from '@/lib/i18n-context'
import { CheckCircle2, Circle, ChevronRight, X, Rocket } from 'lucide-react'
import type { BrandReadinessResult } from '@/lib/brandReadiness'

interface ChecklistStats {
  campaigns: number
  publishedPostsTotal: number
}

interface OnboardingChecklistProps {
  stats: ChecklistStats | null
  brandReadiness: BrandReadinessResult | null
  hasConnections: boolean | null
}

const LS_KEY = 'nexus_checklist_dismissed'

export default function OnboardingChecklist({ stats, brandReadiness, hasConnections }: OnboardingChecklistProps) {
  const { locale } = useI18n()
  const ar = locale === 'ar'
  const [dismissed, setDismissed] = useState(true) // start hidden until we read localStorage

  useEffect(() => {
    setDismissed(localStorage.getItem(LS_KEY) === '1')
  }, [])

  const steps = [
    {
      id: 'account',
      done: true,
      labelAr: 'إنشاء الحساب',
      labelEn: 'Create your account',
      hrefAr: null,
      hrefEn: null,
      ctaAr: null,
      ctaEn: null,
    },
    {
      id: 'brand',
      done: !!(brandReadiness?.ready),
      labelAr: 'إعداد Brand Brain',
      labelEn: 'Set up Brand Brain',
      hrefAr: '/brand',
      hrefEn: '/brand',
      ctaAr: 'أضف بيانات علامتك',
      ctaEn: 'Add your brand data',
    },
    {
      id: 'campaign',
      done: !!(stats && stats.campaigns > 0),
      labelAr: 'إنشاء أول حملة',
      labelEn: 'Create your first campaign',
      hrefAr: '/campaigns/new',
      hrefEn: '/campaigns/new',
      ctaAr: 'إنشاء حملة',
      ctaEn: 'Create campaign',
    },
    {
      id: 'connect',
      done: hasConnections === true,
      labelAr: 'ربط السوشيال ميديا',
      labelEn: 'Connect social media',
      hrefAr: '/connections',
      hrefEn: '/connections',
      ctaAr: 'ربط المنصات',
      ctaEn: 'Connect platforms',
    },
    {
      id: 'publish',
      done: !!(stats && stats.publishedPostsTotal > 0),
      labelAr: 'نشر أول منشور',
      labelEn: 'Publish your first post',
      hrefAr: '/campaigns',
      hrefEn: '/campaigns',
      ctaAr: 'اذ��ب للحملات',
      ctaEn: 'Go to campaigns',
    },
  ]

  const completedCount = steps.filter(s => s.done).length
  const allDone = completedCount === steps.length
  const progressPct = Math.round((completedCount / steps.length) * 100)

  // Don't show if dismissed or all done
  if (dismissed || allDone) return null

  const handleDismiss = () => {
    localStorage.setItem(LS_KEY, '1')
    setDismissed(true)
  }

  // Next incomplete step — for the CTA
  const nextStep = steps.find(s => !s.done)

  return (
    <div className="rounded-2xl overflow-hidden"
      style={{ background: 'rgba(12,13,36,0.6)', border: '1px solid rgba(139,92,246,0.15)', backdropFilter: 'blur(8px)' }}>

      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.2)' }}>
            <Rocket className="w-4 h-4 text-accent-purple" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">
              {ar ? 'الخطوات الأولى' : 'Getting Started'}
            </h3>
            <p className="text-[11px] text-text-muted">
              {ar
                ? `${completedCount} من ${steps.length} خطوات مكتملة`
                : `${completedCount} of ${steps.length} steps complete`}
            </p>
          </div>
        </div>
        <button onClick={handleDismiss}
          className="p-1.5 rounded-lg text-text-muted hover:text-white hover:bg-white/5 transition-all">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Progress bar */}
      <div className="px-5 pb-3">
        <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${progressPct}%`,
              background: progressPct === 100
                ? 'linear-gradient(90deg, #10B981, #00D4FF)'
                : 'linear-gradient(90deg, #8B5CF6, #9333EA)',
            }}
          />
        </div>
      </div>

      {/* Steps list */}
      <div className="px-5 pb-4 space-y-1">
        {steps.map(step => {
          const label = ar ? step.labelAr : step.labelEn
          const cta = ar ? step.ctaAr : step.ctaEn
          const href = ar ? step.hrefAr : step.hrefEn

          return (
            <div key={step.id}
              className={`flex items-center justify-between gap-3 py-2.5 px-3 rounded-xl transition-all ${
                step.done
                  ? 'opacity-50'
                  : 'hover:bg-white/3'
              }`}>
              <div className="flex items-center gap-2.5 min-w-0">
                {step.done
                  ? <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-accent-teal" />
                  : <Circle className="w-4 h-4 flex-shrink-0 text-text-muted" />
                }
                <span className={`text-xs font-medium truncate ${step.done ? 'text-text-muted line-through' : 'text-text-secondary'}`}>
                  {label}
                </span>
              </div>
              {!step.done && href && cta && (
                <Link href={href}
                  className="flex items-center gap-1 text-[10px] font-bold flex-shrink-0 transition-all hover:brightness-110"
                  style={{ color: '#8B5CF6' }}>
                  {cta}
                  <ChevronRight className="w-3 h-3" />
                </Link>
              )}
            </div>
          )
        })}
      </div>

      {/* Bottom CTA — highlight next step */}
      {nextStep && (
        <div className="px-5 pb-5">
          <Link
            href={(ar ? nextStep.hrefAr : nextStep.hrefEn) || '#'}
            className="flex items-center justify-between w-full px-4 py-3 rounded-xl font-bold text-sm text-white transition-all hover:brightness-110"
            style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.25)' }}>
            <span>
              {ar
                ? `التالي: ${nextStep.labelAr}`
                : `Next: ${nextStep.labelEn}`}
            </span>
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      )}
    </div>
  )
}
