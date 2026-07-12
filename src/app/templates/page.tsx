'use client'

import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n-context'
import { useEffect } from 'react'
import AppShell from '@/components/AppShell'
import LuxuryWorkspaceHeader from '@/components/LuxuryWorkspaceHeader'
import StrategySpineCard from '@/components/StrategySpineCard'
import Link from 'next/link'
import { ArrowLeft, CheckCircle2, Layers3, Sparkles, Target, Wand2 } from 'lucide-react'

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
  const ar = locale === 'ar'

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

  const applyTemplate = (tpl: typeof TEMPLATES[0]) => {
    const params = new URLSearchParams({
      goal: tpl.goal,
      platforms: tpl.platforms.join(','),
      template: tpl.nameEn,
    })
    router.push(`/campaigns/new?${params.toString()}`)
  }

  return (
    <AppShell>
      <main className="min-h-screen bg-[#f6f8fc] text-[#071236]">
        <div className="mx-auto flex max-w-[1540px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 page-enter">
        <LuxuryWorkspaceHeader
          pageTitle={ar ? 'قوالب الحملات' : 'Campaign templates'}
          pageSubtitle={ar ? 'قوالب تشغيلية كبداية للحملة فقط؛ لا تولّد محتوى ولا تخصم رصيداً بدون تأكيد لاحق.' : 'Operating templates as campaign starters only; they do not generate content or spend credits without later confirmation.'}
          primaryHref="/campaigns/new"
          primaryLabel={tplT?.btnStartFromScratch as string}
          secondaryHref="/campaigns"
          secondaryLabel={ar ? 'الحملات' : 'Campaigns'}
        />

        <StrategySpineCard
          current="strategy"
          nextHref="/campaigns/new"
          nextLabel={ar ? 'ابدأ حملة بإعداد واضح' : 'Start a scoped campaign'}
          title={ar ? 'القوالب نقطة بداية للاستراتيجية وليست تنفيذًا جاهزًا' : 'Templates start strategy; they are not execution by themselves'}
          body={ar
            ? 'اختيار قالب يحدد سياقًا أوليًا للحملة فقط. لا يولّد محتوى، لا ينشر، ولا يخصم رصيدًا قبل مراجعة النطاق والتكلفة والتأكيد الصريح.'
            : 'Choosing a template only creates starter campaign context. It does not generate content, publish, or spend credits before scope, cost, and explicit confirmation are reviewed.'}
        />

        {/* Header */}
        <div className="rounded-[28px] border border-slate-200/80 bg-white/95 p-5 shadow-[0_22px_70px_rgba(15,23,42,0.08)] sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="flex min-w-0 items-start gap-4">
              <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-[24px] border border-indigo-100 bg-indigo-50 text-indigo-600 shadow-inner">
                <Layers3 className="h-7 w-7" />
              </div>
              <div className="min-w-0">
                <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-600">
                  <Sparkles className="h-3.5 w-3.5" />
                  {locale === 'ar' ? 'مكتبة قوالب تشغيلية' : 'Operating template library'}
                </div>
                <h1 className="text-3xl font-black tracking-tight text-slate-950">{tplT?.pageTitle as string}</h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">{tplT?.pageSubtitle as string}</p>
              </div>
            </div>
            <Link
              href="/campaigns/new"
              className="inline-flex items-center gap-2 rounded-2xl bg-[#071236] px-5 py-3 text-sm font-bold text-white shadow-[0_16px_34px_rgba(7,18,54,0.18)]"
            >
              {tplT?.btnStartFromScratch as string}
              <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
            </Link>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {[
              [locale === 'ar' ? 'اختيار القالب لا يولّد محتوى' : 'Choosing a template does not generate content', CheckCircle2],
              [locale === 'ar' ? 'يفتح إنشاء حملة بإعدادات أولية' : 'It opens campaign creation with starter settings', Target],
              [locale === 'ar' ? 'كل تكلفة تظهر لاحقاً قبل أي إجراء' : 'Every cost is shown later before action', Wand2],
            ].map(([text, Icon]) => (
              <div key={text as string} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3">
                <Icon className="h-4 w-4 flex-shrink-0 text-indigo-500" />
                <span className="text-sm font-semibold text-slate-700">{text as string}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {TEMPLATES.map(tpl => (
            <div
              key={tpl.id}
              className="group relative overflow-hidden rounded-[24px] p-6 transition-all hover:-translate-y-0.5"
              style={{
                background: 'rgba(255,255,255,0.96)',
                border: '1px solid rgba(15,23,42,0.08)',
                boxShadow: '0 18px 50px rgba(15,23,42,0.06)',
              }}
            >
              <div className="pointer-events-none absolute inset-x-0 top-0 h-1" style={{ background: `linear-gradient(90deg, ${tpl.color}, rgba(94,92,230,0.45))` }} />
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
                className="mb-5 flex h-14 w-14 items-center justify-center rounded-[22px] text-2xl"
                style={{ background: `${tpl.color}15`, border: `1px solid ${tpl.color}25` }}
              >
                {tpl.icon}
              </div>

              {/* Content */}
              <h3 className="mb-1 text-xl font-black text-slate-950 transition-colors">
                {locale === 'ar' ? tpl.name : tpl.nameEn}
              </h3>
              <p className="mb-5 min-h-[56px] text-sm leading-relaxed text-slate-500">
                {locale === 'ar' ? tpl.desc : tpl.descEn}
              </p>

              {/* Goal + Platforms */}
              <div className="mb-5 flex flex-wrap items-center gap-2">
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
                onClick={() => applyTemplate(tpl)}
                className="flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-bold text-white transition-all hover:opacity-90"
                style={{ background: tpl.color, boxShadow: `0 10px 24px ${tpl.color}24` }}
              >
                {tplT?.btnUse as string}
                <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
              </button>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="text-center">
          <Link
            href="/campaigns/new"
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-indigo-600 transition hover:border-indigo-200 hover:bg-indigo-50"
          >
            {tplT?.btnStartFromScratch as string}
            <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
          </Link>
        </div>
        </div>
      </main>
    </AppShell>
  )
}
