'use client'

import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n-context'
import { useEffect } from 'react'
import AppShell from '@/components/AppShell'
import Link from 'next/link'
import { Sparkles } from 'lucide-react'

/* ═══════════════════════════════════════════════════════════════
   TEMPLATES — Campaign Templates
   ═══════════════════════════════════════════════════════════════ */

const TEMPLATES = [
  {
    id: 't1',
    icon: '⚡',
    name: 'إطلاق منتج',
    nameEn: 'Product Launch',
    desc: 'حملة إطلاق متكاملة مع هوكات، سكريبتات، وتقويم محتوى لـ 30 يوم',
    descEn: 'A complete launch campaign with hooks, scripts, and a 30-day content calendar',
    goal: 'SALES',
    platforms: ['Instagram', 'TikTok'],
    color: '#f59e0b',
    badge: false,
  },
  {
    id: 't2',
    icon: '🎯',
    name: 'توليد عملاء محتملين',
    nameEn: 'Lead Generation',
    desc: 'استقطب عملاء مؤهلين برسائل موجّهة وعبارات CTA قوية',
    descEn: 'Attract qualified leads with targeted messaging and powerful CTAs',
    goal: 'LEADS',
    platforms: ['Facebook', 'Instagram'],
    color: '#06b6d4',
    badge: false,
  },
  {
    id: 't3',
    icon: '📣',
    name: 'بناء الوعي بالعلامة',
    nameEn: 'Brand Awareness',
    desc: 'عزّز حضورك وابنِ هوية قوية عبر كل المنصات',
    descEn: 'Strengthen your presence and build a strong brand identity across all platforms',
    goal: 'AWARENESS',
    platforms: ['Instagram', 'TikTok', 'Snapchat'],
    color: '#8b5cf6',
    badge: true,
  },
  {
    id: 't4',
    icon: '❤️',
    name: 'تنمية المجتمع',
    nameEn: 'Community Growth',
    desc: 'تفاعل مع جمهورك وابنِ قاعدة متابعين وفيّة ومتفاعلة',
    descEn: 'Engage your audience and build a loyal, active follower base',
    goal: 'ENGAGEMENT',
    platforms: ['Instagram', 'Facebook'],
    color: '#ec4899',
    badge: false,
  },
  {
    id: 't5',
    icon: '🚦',
    name: 'زيادة الزيارات',
    nameEn: 'Traffic Driver',
    desc: 'قُد زيارات مستهدفة لموقعك وحوّل الزوار إلى عملاء',
    descEn: 'Drive targeted traffic to your website and convert visitors into customers',
    goal: 'TRAFFIC',
    platforms: ['Google', 'Facebook'],
    color: '#10b981',
    badge: false,
  },
  {
    id: 't6',
    icon: '🛍️',
    name: 'عرض محدود الوقت',
    nameEn: 'Flash Sale',
    desc: 'حملة إلحاحية عالية التأثير للعروض والخصومات الموقّتة',
    descEn: 'High-impact urgency campaign for time-limited offers and discounts',
    goal: 'SALES',
    platforms: ['Instagram', 'TikTok', 'Snapchat'],
    color: '#ef4444',
    badge: false,
  },
]

const PLATFORM_ICONS: Record<string, string> = {
  Instagram: '📸',
  TikTok: '🎵',
  Facebook: '👥',
  Snapchat: '👻',
  Google: '🔍',
  YouTube: '▶️',
}

export default function TemplatesPage() {
  const { isAuthenticated, loading } = useAuth()
  const { t, locale } = useI18n()
  const tplT = t('templates')
  const router = useRouter()

  const GOAL_LABELS: Record<string, string> = {
    SALES:      tplT?.goalSales      as string,
    LEADS:      tplT?.goalLeads      as string,
    AWARENESS:  tplT?.goalAwareness  as string,
    ENGAGEMENT: tplT?.goalEngagement as string,
    TRAFFIC:    tplT?.goalTraffic    as string,
  }

  useEffect(() => {
    if (!loading && !isAuthenticated) router.push('/auth/login')
  }, [loading, isAuthenticated, router])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }
  if (!isAuthenticated) return null

  const useTemplate = (tpl: typeof TEMPLATES[0]) => {
    const params = new URLSearchParams({
      goal: tpl.goal,
      platforms: tpl.platforms.join(','),
      template: tpl.nameEn,
    })
    router.push(`/campaigns/new?${params.toString()}`)
  }

  return (
    <AppShell>
      <div className="min-h-screen bg-[#f5f5f7]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12 page-enter">

        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-blue-600" />
            <span className="text-xs text-slate-500 font-semibold tracking-[0.18em] uppercase">NEXUS TEMPLATES</span>
          </div>
          <h1 className="text-3xl font-semibold text-slate-950 mb-2">{tplT?.pageTitle as string}</h1>
          <p className="text-slate-500 text-sm max-w-2xl leading-6">{tplT?.pageSubtitle as string}</p>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {TEMPLATES.map(tpl => (
            <div
              key={tpl.id}
              className="relative rounded-2xl p-6 transition-all group hover:-translate-y-0.5"
              style={{
                background: '#FFFFFF',
                border: '1px solid rgba(15,23,42,0.08)',
                boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
              }}
            >
              {/* Badge */}
              {tpl.badge && (
                <div
                  className="absolute -top-3 right-5 text-xs font-bold px-3 py-1 rounded-full"
                  style={{ background: tpl.color, color: '#fff', boxShadow: `0 8px 18px ${tpl.color}25` }}
                >
                  {tplT?.badgeMostUsed as string}
                </div>
              )}

              {/* Icon */}
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl mb-4"
                style={{ background: `${tpl.color}15`, border: `1px solid ${tpl.color}25` }}
              >
                {tpl.icon}
              </div>

              {/* Content */}
              <h3 className="font-semibold text-slate-950 text-lg mb-1 transition-colors">
                {locale === 'ar' ? tpl.name : tpl.nameEn}
              </h3>
              <p className="text-slate-500 text-sm mb-4 leading-relaxed">
                {locale === 'ar' ? tpl.desc : tpl.descEn}
              </p>

              {/* Goal + Platforms */}
              <div className="flex flex-wrap items-center gap-2 mb-5">
                <span
                  className="text-xs px-2.5 py-1 rounded-full font-medium"
                  style={{ background: `${tpl.color}12`, color: tpl.color, border: `1px solid ${tpl.color}20` }}
                >
                  {GOAL_LABELS[tpl.goal] || tpl.goal}
                </span>
                {tpl.platforms.map(p => (
                  <span
                    key={p}
                    className="text-xs px-2 py-1 rounded-full text-slate-500"
                    style={{ background: '#F8FAFC', border: '1px solid rgba(15,23,42,0.08)' }}
                  >
                    {PLATFORM_ICONS[p] || '🌐'} {p}
                  </span>
                ))}
              </div>

              {/* CTA */}
              <button
                onClick={() => useTemplate(tpl)}
                className="w-full py-2.5 rounded-xl font-bold text-sm transition-all text-white hover:opacity-90"
                style={{ background: tpl.color, boxShadow: `0 10px 24px ${tpl.color}24` }}
              >
                {tplT?.btnUse as string}
              </button>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-10 text-center">
          <Link
            href="/campaigns/new"
            className="text-sm text-blue-600 hover:text-blue-700 transition"
          >
            {tplT?.btnStartFromScratch as string}
          </Link>
        </div>
        </div>
      </div>
    </AppShell>
  )
}
