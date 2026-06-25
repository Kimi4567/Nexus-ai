'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n-context'
import { getCampaignPlatformSummary } from '@/lib/campaignPlatforms'
import AppShell from '@/components/AppShell'
import {
  ArrowLeft, ArrowRight, Brain, CalendarDays, Circle, FileText,
  Layers, Loader2, Megaphone, ShieldCheck, Sparkles, Users,
} from 'lucide-react'

interface CampaignLite {
  id: string
  name: string
  description?: string | null
  goal?: string | null
  audience?: string | null
  status: string
  platforms: string[]
  aiOutput: unknown
  createdAt: string
  updatedAt: string
}

function objectValue(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : null
}

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : []
}

function firstText(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (value && typeof value === 'object') {
      const o = value as Record<string, unknown>
      const nested = firstText(o.name, o.title, o.summary, o.text, o.value, o.description)
      if (nested) return nested
    }
  }
  return ''
}

function listLabels(values: unknown[]): string[] {
  return values.map(value => firstText(value)).filter(Boolean).slice(0, 6)
}

function formatDate(value: string, locale: string): string {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar' : 'en', { month: 'short', day: 'numeric', year: 'numeric' }).format(d)
}

export default function StrategyReviewPage() {
  const { campaignId } = useParams<{ campaignId: string }>()
  const { authHeader, isAuthenticated, loading: authLoading } = useAuth()
  const { locale } = useI18n()
  const router = useRouter()
  const ar = locale === 'ar'

  const [loading, setLoading] = useState(true)
  const [campaign, setCampaign] = useState<CampaignLite | null>(null)

  const load = useCallback(async () => {
    if (!isAuthenticated || !campaignId) return
    try {
      const res = await fetch('/api/campaigns?limit=50&sort=updatedAt', {
        headers: { Authorization: authHeader() },
      })
      if (res.ok) {
        const data = await res.json()
        const found = Array.isArray(data.campaigns)
          ? data.campaigns.find((c: CampaignLite) => c.id === campaignId)
          : null
        setCampaign(found ?? null)
      }
    } catch {
      setCampaign(null)
    } finally {
      setLoading(false)
    }
  }, [authHeader, campaignId, isAuthenticated])

  useEffect(() => {
    if (!authLoading && isAuthenticated) load()
  }, [authLoading, isAuthenticated, load])

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/auth/login')
  }, [authLoading, isAuthenticated, router])

  const derived = useMemo(() => {
    const ai = objectValue(campaign?.aiOutput)
    const strategy = objectValue(ai?.strategy) ?? ai
    const paid = objectValue(ai?.paidPlan) ?? objectValue(ai?.paidCampaignPlan) ?? objectValue(strategy?.paidPlan)
    const platformSummary = getCampaignPlatformSummary(campaign?.platforms ?? [], locale)

    return {
      ai,
      strategy,
      paid,
      platformSummary,
      direction: firstText(strategy?.executiveSummary, strategy?.summary, strategy?.direction, strategy?.bigIdea, ai?.summary),
      goal: firstText(strategy?.goal, strategy?.objective, campaign?.goal),
      timeframe: firstText(strategy?.timeframe, strategy?.duration, strategy?.horizon),
      strategyType: firstText(strategy?.strategyType, strategy?.type),
      audience: firstText(strategy?.targetAudience, strategy?.audience, campaign?.audience),
      painPoints: listLabels([...asArray(strategy?.painPoints), ...asArray(strategy?.needs), ...asArray(ai?.painPoints)]),
      positioning: firstText(strategy?.positioning, strategy?.brandPositioning, strategy?.promise, strategy?.message),
      pillars: listLabels([...asArray(strategy?.contentPillars), ...asArray(ai?.contentPillars)]),
      hooks: listLabels([...asArray(ai?.topHooks), ...asArray(strategy?.topHooks), ...asArray(strategy?.hooks)]),
      ctas: listLabels([...asArray(ai?.ctaVariations), ...asArray(strategy?.ctaVariations), ...asArray(strategy?.ctas)]),
      paidNotes: listLabels([...asArray(paid?.recommendations), ...asArray(paid?.notes), ...asArray(paid?.channels)]),
    }
  }, [campaign, locale])

  const emptyText = ar ? 'غير مذكور في مسودة الاستراتيجية' : 'Not included in this strategy draft'
  const card = 'rounded-2xl p-5 sm:p-6'
  const cardStyle = { background: '#FFFFFF', border: '1px solid rgba(15,23,42,0.08)', boxShadow: '0 1px 2px rgba(15,23,42,0.04)' } as const
  const sectionLabel = 'text-[10px] font-bold uppercase tracking-wider'

  if (!authLoading && !isAuthenticated) return null

  if (authLoading || loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-7 h-7 animate-spin" style={{ color: '#8B5CF6' }} />
        </div>
      </AppShell>
    )
  }

  if (!campaign) {
    return (
      <AppShell>
        <div className="max-w-[920px] mx-auto px-4 py-10">
          <div className={`${card} text-center`} style={cardStyle}>
            <Circle className="w-9 h-9 mx-auto mb-3" style={{ color: '#94a3b8' }} />
            <h1 className="text-xl font-black" style={{ color: '#0f172a' }}>
              {ar ? 'لا توجد استراتيجية للمراجعة' : 'No strategy to review'}
            </h1>
            <p className="text-sm mt-2" style={{ color: '#64748b' }}>
              {ar
                ? 'لم يتم العثور على مسودة استراتيجية لهذا المسار. ارجع إلى صفحة الاستراتيجية لإنشاء أو تحديث الاستراتيجية.'
                : 'No strategy draft was found for this route. Return to Strategy to create or update the strategy.'}
            </p>
            <Link href="/strategy" className="inline-flex items-center justify-center gap-2 mt-5 px-5 py-2.5 rounded-xl text-sm font-bold"
              style={{ background: '#111827', color: '#FFFFFF' }}>
              <ArrowLeft className="w-4 h-4" />
              {ar ? 'العودة إلى الاستراتيجية' : 'Back to Strategy'}
            </Link>
          </div>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="relative min-h-screen">
        <div className="max-w-[1060px] mx-auto px-4 py-8 sm:py-10">
          <div className="mb-6">
            <Link href="/strategy" className="inline-flex items-center gap-1 text-xs font-semibold mb-4" style={{ color: '#8B5CF6' }}>
              <ArrowLeft className="w-3 h-3" />
              {ar ? 'العودة إلى الاستراتيجية' : 'Back to Strategy'}
            </Link>
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="w-4 h-4" style={{ color: '#8B5CF6' }} />
                  <span className="text-xs font-mono tracking-wider" style={{ color: 'rgba(139,92,246,0.8)' }}>
                    {ar ? 'مراجعة الاستراتيجية' : 'STRATEGY REVIEW'}
                  </span>
                </div>
                <h1 className="text-2xl font-black" style={{ color: '#0f172a' }}>{campaign.name}</h1>
                <p className="text-sm mt-1 max-w-2xl" style={{ color: '#64748b' }}>
                  {ar
                    ? 'مراجعة هادئة لمسودة الاستراتيجية قبل الانتقال إلى المحتوى.'
                    : 'A focused review of the strategy draft before moving into content.'}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="px-3 py-1 rounded-full text-xs font-semibold" style={{ background: '#F5F3FF', color: '#6d28d9', border: '1px solid rgba(139,92,246,0.18)' }}>
                  {campaign.status.toLowerCase() === 'draft' ? (ar ? 'مسودة استراتيجية' : 'Draft strategy') : campaign.status}
                </span>
                <span className="px-3 py-1 rounded-full text-xs font-semibold" style={{ background: '#ECFEFF', color: '#0e7490', border: '1px solid rgba(6,182,212,0.18)' }}>
                  {ar ? 'من ذاكرة العلامة' : 'From Brand Brain'}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
            {[
              { icon: Brain, label: ar ? 'المصدر' : 'Source', value: ar ? 'ذاكرة العلامة' : 'Brand Brain' },
              { icon: CalendarDays, label: ar ? 'آخر تحديث' : 'Last updated', value: formatDate(campaign.updatedAt, locale) || emptyText },
              { icon: FileText, label: ar ? 'نوع المراجعة' : 'Review type', value: ar ? 'مسودة قراءة فقط' : 'Read-only draft' },
            ].map((item) => (
              <div key={item.label} className={card} style={cardStyle}>
                <item.icon className="w-4 h-4 mb-2" style={{ color: '#8B5CF6' }} />
                <p className={sectionLabel} style={{ color: '#94a3b8' }}>{item.label}</p>
                <p className="text-sm font-bold mt-1" style={{ color: '#334155' }}>{item.value}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-4">
            <section className={card} style={cardStyle}>
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-4 h-4" style={{ color: '#8B5CF6' }} />
                <h2 className="text-sm font-bold" style={{ color: '#0f172a' }}>{ar ? 'الاتجاه التنفيذي' : 'Executive Direction'}</h2>
              </div>
              <p className="text-sm leading-6" style={{ color: derived.direction ? '#334155' : '#94a3b8' }}>
                {derived.direction || emptyText}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5">
                {[
                  { label: ar ? 'الهدف' : 'Goal', value: derived.goal || emptyText },
                  { label: ar ? 'الإطار الزمني' : 'Timeframe', value: derived.timeframe || emptyText },
                  { label: ar ? 'نوع الاستراتيجية' : 'Strategy type', value: derived.strategyType || emptyText },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl px-3 py-3" style={{ background: '#F8FAFC', border: '1px solid rgba(15,23,42,0.06)' }}>
                    <p className="text-[11px] font-semibold" style={{ color: '#94a3b8' }}>{item.label}</p>
                    <p className="text-sm font-bold mt-1" style={{ color: item.value === emptyText ? '#94a3b8' : '#334155' }}>{item.value}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className={card} style={cardStyle}>
              <div className="flex items-center gap-2 mb-4">
                <Users className="w-4 h-4" style={{ color: '#06B6D4' }} />
                <h2 className="text-sm font-bold" style={{ color: '#0f172a' }}>{ar ? 'الجمهور والتموضع' : 'Audience & Positioning'}</h2>
              </div>
              <div className="space-y-4">
                <BriefLine label={ar ? 'الجمهور' : 'Audience'} value={derived.audience || emptyText} muted={derived.audience === ''} />
                <BriefLine label={ar ? 'التموضع' : 'Positioning'} value={derived.positioning || emptyText} muted={derived.positioning === ''} />
                <BriefList label={ar ? 'الاحتياجات أو نقاط الألم' : 'Needs or pain points'} items={derived.painPoints} emptyText={emptyText} />
              </div>
            </section>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] gap-4 mt-4">
            <section className={card} style={cardStyle}>
              <div className="flex items-center gap-2 mb-4">
                <Layers className="w-4 h-4" style={{ color: '#8B5CF6' }} />
                <h2 className="text-sm font-bold" style={{ color: '#0f172a' }}>{ar ? 'الخطة العضوية' : 'Organic Plan'}</h2>
              </div>
              <div className="space-y-4">
                <BriefLine
                  label={ar ? 'مزيج المنصات' : 'Platform mix'}
                  value={derived.platformSummary.isEmpty ? emptyText : derived.platformSummary.labels.join(' · ')}
                  muted={derived.platformSummary.isEmpty}
                />
                <BriefList label={ar ? 'محاور المحتوى' : 'Content pillars'} items={derived.pillars} emptyText={emptyText} pill />
                <BriefList label={ar ? 'الخطافات' : 'Hooks'} items={derived.hooks} emptyText={emptyText} />
                <BriefList label={ar ? 'دعوات الإجراء' : 'CTAs'} items={derived.ctas} emptyText={emptyText} />
              </div>
            </section>

            <div className="space-y-4">
              <section className={card} style={cardStyle}>
                <div className="flex items-center gap-2 mb-3">
                  <Megaphone className="w-4 h-4" style={{ color: '#FF6B35' }} />
                  <h2 className="text-sm font-bold" style={{ color: '#0f172a' }}>{ar ? 'التخطيط المدفوع' : 'Paid Planning'}</h2>
                </div>
                <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold mb-3"
                  style={{ background: '#F1F5F9', color: '#64748b', border: '1px solid rgba(15,23,42,0.08)' }}>
                  {ar ? 'تخطيط فقط' : 'Planning-only'}
                </span>
                <BriefList label={ar ? 'تفاصيل متاحة' : 'Available details'} items={derived.paidNotes} emptyText={ar ? 'لم يتم إنشاء خطة مدفوعة بعد' : 'No paid plan generated yet'} />
                <div className="flex items-start gap-2 mt-4 px-3 py-2.5 rounded-xl"
                  style={{ background: '#FFF7ED', border: '1px solid rgba(249,115,22,0.18)' }}>
                  <ShieldCheck className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: '#ea580c' }} />
                  <p className="text-xs font-semibold" style={{ color: '#9a3412' }}>
                    {ar ? 'لن يتم صرف أي ميزانية إعلانية بدون موافقة صريحة.' : 'No ad spend will happen without explicit approval.'}
                  </p>
                </div>
              </section>

              <section className={card} style={cardStyle}>
                <h2 className="text-sm font-bold mb-3" style={{ color: '#0f172a' }}>{ar ? 'الجاهزية والحدود' : 'Readiness & Limits'}</h2>
                <div className="space-y-2">
                  {[
                    ar ? 'التحليلات غير متصلة' : 'Analytics not connected',
                    ar ? 'النشر التلقائي غير مفعّل' : 'Auto-publishing not enabled',
                    ar ? 'التخطيط المدفوع مرتبط بالموافقة' : 'Paid planning is approval-gated',
                  ].map((item) => (
                    <div key={item} className="flex items-start gap-2 text-sm" style={{ color: '#475569' }}>
                      <Circle className="w-3 h-3 mt-1 flex-shrink-0" style={{ color: '#94a3b8' }} />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>

          <section className={`${card} mt-4`} style={{ ...cardStyle, background: '#FAFAFF', border: '1px solid rgba(139,92,246,0.18)' }}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-sm font-bold" style={{ color: '#0f172a' }}>{ar ? 'الإجراء التالي' : 'Next Action'}</h2>
                <p className="text-sm mt-1" style={{ color: '#64748b' }}>
                  {ar
                    ? 'بعد مراجعة اتجاه الاستراتيجية، تابع إلى مركز المحتوى لتحويلها إلى خطة محتوى.'
                    : 'After reviewing the strategy direction, continue to Content Hub to turn it into a content plan.'}
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <Link href="/content-hub" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold"
                  style={{ background: '#111827', color: '#FFFFFF' }}>
                  <FileText className="w-4 h-4" />
                  {ar ? 'المتابعة إلى مركز المحتوى' : 'Continue to Content Hub'}
                </Link>
                <Link href="/strategy" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold"
                  style={{ background: '#FFFFFF', color: '#334155', border: '1px solid rgba(15,23,42,0.12)' }}>
                  {ar ? 'العودة إلى الاستراتيجية' : 'Back to Strategy'}
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  )
}

function BriefLine({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#94a3b8' }}>{label}</p>
      <p className="text-sm mt-1 leading-6" style={{ color: muted ? '#94a3b8' : '#334155' }}>{value}</p>
    </div>
  )
}

function BriefList({ label, items, emptyText, pill = false }: { label: string; items: string[]; emptyText: string; pill?: boolean }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#94a3b8' }}>{label}</p>
      {items.length === 0 ? (
        <p className="text-sm mt-1" style={{ color: '#94a3b8' }}>{emptyText}</p>
      ) : pill ? (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {items.map((item, i) => (
            <span key={`${item}-${i}`} className="px-2.5 py-1 rounded-full text-xs font-semibold"
              style={{ background: '#F5F3FF', border: '1px solid rgba(139,92,246,0.18)', color: '#6d28d9' }}>
              {item}
            </span>
          ))}
        </div>
      ) : (
        <ul className="mt-1 space-y-1">
          {items.map((item, i) => (
            <li key={`${item}-${i}`} className="text-sm leading-6" style={{ color: '#334155' }}>• {item}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
