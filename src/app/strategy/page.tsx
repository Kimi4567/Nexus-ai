'use client'

/**
 * /strategy — Marketing Strategy page (PR-B: read-only IA foundation).
 *
 * This is the Strategy stage of the journey:
 *   Brand Brain → Strategy → Organic Content Plan + Paid Campaign Plan → execution
 *
 * IMPORTANT — this page is READ/RENDER ONLY. It does not generate strategy, run
 * any AI, create campaigns, spend credits, schedule, publish, or run ads. It
 * surfaces the Strategy stage using data that already exists:
 *   - GET /api/brand      → maturity.status (Building/Active) + brandName
 *   - GET /api/campaigns  → existing campaigns + their aiOutput.strategy
 * When no strategy/campaign exists yet, every section shows an honest empty
 * state. Nothing here invents budgets, KPIs, results, percentages, timelines,
 * or platform readiness, and nothing implies ads/spend/publishing are active.
 */

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n-context'
import { getStrategyCapabilities, BrandReadinessStatus } from '@/lib/brandReadiness'
import { getCampaignPlatformSummary } from '@/lib/campaignPlatforms'
import AppShell from '@/components/AppShell'
import {
  Sparkles, Loader2, ArrowRight, Megaphone, FileText, Layers,
  ShieldCheck, Brain, CheckCircle2, Circle, Info,
} from 'lucide-react'

interface CampaignLite {
  id: string
  name: string
  status: string
  platforms: string[]
  aiOutput: unknown
  createdAt: string
  updatedAt: string
}

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : []
}
function pillarLabel(p: unknown): string {
  if (typeof p === 'string') return p
  if (p && typeof p === 'object') {
    const o = p as Record<string, unknown>
    return String(o.name ?? o.title ?? o.pillar ?? '').trim()
  }
  return ''
}
function textLabel(p: unknown): string {
  if (typeof p === 'string') return p
  if (p && typeof p === 'object') {
    const o = p as Record<string, unknown>
    return String(o.hook ?? o.text ?? o.cta ?? o.value ?? '').trim()
  }
  return ''
}

export default function StrategyPage() {
  const { authHeader, isAuthenticated, loading: authLoading } = useAuth()
  const { locale } = useI18n()
  const router = useRouter()
  const ar = locale === 'ar'

  const [loading, setLoading] = useState(true)
  const [brandStatus, setBrandStatus] = useState<BrandReadinessStatus | null>(null)
  const [brandName, setBrandName] = useState<string>('')
  // PX-2B.1 — capability-specific readiness reuses the SAME brand profile already
  // returned by GET /api/brand (no extra request, no new math, no new score).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [brandProfile, setBrandProfile] = useState<any>(null)
  const [campaigns, setCampaigns] = useState<CampaignLite[]>([])
  const [total, setTotal] = useState(0)

  const load = useCallback(async () => {
    if (!isAuthenticated) return
    try {
      const [cRes, bRes] = await Promise.all([
        fetch('/api/campaigns?limit=5&sort=updatedAt', { headers: { Authorization: authHeader() } }),
        fetch('/api/brand', { headers: { Authorization: authHeader() } }),
      ])
      if (cRes.ok) {
        const d = await cRes.json()
        setCampaigns(Array.isArray(d.campaigns) ? d.campaigns : [])
        setTotal(d.counts?.total ?? (Array.isArray(d.campaigns) ? d.campaigns.length : 0))
      }
      if (bRes.ok) {
        const d = await bRes.json()
        setBrandStatus(d.maturity?.status ?? null)
        setBrandName(d.brandProfile?.brandName ?? '')
        setBrandProfile(d.brandProfile ?? null)
      }
    } catch {
      /* non-fatal — render honest empty states */
    } finally {
      setLoading(false)
    }
  }, [authHeader, isAuthenticated])

  useEffect(() => {
    if (!authLoading && isAuthenticated) load()
  }, [authLoading, isAuthenticated, load])

  // Standard app auth gate (same pattern as the dashboard): once auth has
  // resolved with no user, send them to login instead of hanging on a spinner.
  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/auth/login')
  }, [authLoading, isAuthenticated, router])

  // ── Derived, truthful state (no invention) ──────────────────────────────────
  const hasStrategy = total > 0
  const recent = campaigns[0]
  const ai = (recent?.aiOutput ?? null) as Record<string, unknown> | null
  const strat = (ai?.strategy ?? ai ?? null) as Record<string, unknown> | null

  const pillars = [
    ...asArray(strat?.contentPillars),
    ...asArray(ai?.contentPillars),
  ].map(pillarLabel).filter(Boolean).slice(0, 6)
  const platformSummary = getCampaignPlatformSummary(recent?.platforms ?? [], locale)
  const hooks = [
    ...asArray(ai?.topHooks),
    ...asArray(strat?.topHooks),
  ].map(textLabel).filter(Boolean).slice(0, 4)
  const ctas = [
    ...asArray(ai?.ctaVariations),
    ...asArray(strat?.ctaVariations),
  ].map(textLabel).filter(Boolean).slice(0, 4)
  const hasOrganicData = pillars.length > 0 || hooks.length > 0 || ctas.length > 0 || !platformSummary.isEmpty

  const brandActive = brandStatus === 'active'
  // PX-2B.1 — capability-specific, LABEL-ONLY readiness from the same utility
  // /brand uses (getStrategyCapabilities). This prevents a coarse "needs data"
  // here from conflicting with "organic ready" on /brand. The headline is the
  // memory maturity STAGE (Early/Developing/Strong), never a bare number.
  const caps = getStrategyCapabilities(brandProfile)
  const memStage = brandStatus === 'active'
    ? (ar ? 'قوية' : 'Strong')
    : brandStatus === 'building'
      ? (ar ? 'قيد التطوّر' : 'Developing')
      : (ar ? 'مبكرة' : 'Early')
  const capRows: { label: string; value: string; ready?: boolean }[] = [
    { label: ar ? 'العضوي' : 'Organic',
      value: caps.contentStrategy.ready ? (ar ? 'جاهز لموجز أولي' : 'Ready for an initial brief') : (ar ? 'يحتاج بيانات أساسية' : 'Needs core data'),
      ready: caps.contentStrategy.ready },
    { label: ar ? 'الاستراتيجية الكاملة' : 'Full strategy',
      value: caps.fullStrategy.ready ? (ar ? 'جاهزة' : 'Ready') : (ar ? 'تحتاج معلومات إضافية' : 'Needs more information'),
      ready: caps.fullStrategy.ready },
    { label: ar ? 'الإعلانات المدفوعة' : 'Paid ads', value: ar ? 'للتخطيط فقط' : 'Planning-only' },
    { label: ar ? 'التحليلات' : 'Analytics', value: ar ? 'غير متصلة' : 'Not connected' },
    { label: ar ? 'النشر التلقائي' : 'Auto-publishing', value: ar ? 'غير مفعّل' : 'Not enabled' },
  ]

  const strategyStatusText = !hasStrategy
    ? (ar ? 'لم يتم إنشاء استراتيجية بعد' : 'No strategy created yet')
    : recent?.status === 'DRAFT'
      ? (ar ? 'مسودة استراتيجية متاحة' : 'Draft strategy available')
      : (ar ? `استراتيجية مرتبطة بحملة: ${recent?.name}` : `Strategy linked to campaign: ${recent?.name}`)

  // ── UI helpers ──────────────────────────────────────────────────────────────
  const card = 'rounded-2xl p-5 sm:p-6'
  const cardStyle = { background: '#FFFFFF', border: '1px solid rgba(15,23,42,0.08)', boxShadow: '0 1px 2px rgba(15,23,42,0.04)' } as const
  const sectionLabel = 'text-[10px] font-bold uppercase tracking-wider'

  // Redirecting to login — render nothing (avoids an infinite spinner when
  // there is no authenticated session).
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

  return (
    <AppShell>
      <div className="relative min-h-screen">
        <div className="max-w-[1100px] mx-auto px-4 py-8 sm:py-10">

          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4" style={{ color: '#8B5CF6' }} />
              <span className="text-xs font-mono tracking-wider" style={{ color: 'rgba(139,92,246,0.8)' }}>
                {ar ? 'الاستراتيجية' : 'STRATEGY'}
              </span>
            </div>
            <h1 className="text-2xl font-black" style={{ color: '#0f172a' }}>
              {ar ? 'استراتيجية التسويق' : 'Marketing Strategy'}
            </h1>
            <p className="text-sm mt-1" style={{ color: '#64748b' }}>
              {ar
                ? 'حوّل ذاكرة العلامة التجارية إلى خطة واضحة للمحتوى العضوي والإعلانات المدفوعة.'
                : 'Turn your Brand Brain into a clear organic and paid marketing plan.'}
            </p>
          </div>

          {/* Status row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
            <div className={card} style={cardStyle}>
              <p className={sectionLabel} style={{ color: '#94a3b8' }}>{ar ? 'ذاكرة العلامة التجارية' : 'Brand Memory'}</p>
              <div className="flex items-center gap-2 mt-2">
                <Brain className="w-4 h-4 flex-shrink-0" style={{ color: brandActive ? '#10b981' : '#f59e0b' }} />
                <span className="text-sm font-bold" style={{ color: brandActive ? '#059669' : '#d97706' }}>
                  {memStage}
                </span>
              </div>
              {/* PX-2B.1 — capability-specific readiness; never a bare "Ready". */}
              <div className="mt-3 space-y-1.5">
                {capRows.map((r, i) => (
                  <div key={i} className="flex items-center justify-between gap-3">
                    <span className="text-[12px]" style={{ color: '#64748b' }}>{r.label}</span>
                    <span className="text-[12px] font-semibold" style={{ color: r.ready ? '#059669' : '#475569' }}>{r.value}</span>
                  </div>
                ))}
              </div>
              {!brandActive && (
                <Link href="/brand" className="inline-flex items-center gap-1 text-xs font-semibold mt-3" style={{ color: '#8B5CF6' }}>
                  {ar ? 'متابعة إعداد ذاكرة العلامة' : 'Continue Brand Brain'} <ArrowRight className="w-3 h-3" />
                </Link>
              )}
            </div>
            <div className={card} style={cardStyle}>
              <p className={sectionLabel} style={{ color: '#94a3b8' }}>{ar ? 'حالة الاستراتيجية' : 'Strategy status'}</p>
              <div className="flex items-center gap-2 mt-2">
                {hasStrategy
                  ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: '#059669' }} />
                  : <Circle className="w-4 h-4 flex-shrink-0" style={{ color: '#94a3b8' }} />}
                <span className="text-sm font-bold" style={{ color: hasStrategy ? '#059669' : '#64748b' }}>
                  {strategyStatusText}
                </span>
              </div>
              {hasStrategy && (
                <Link href="/campaigns" className="inline-flex items-center gap-1 text-xs font-semibold mt-3" style={{ color: '#8B5CF6' }}>
                  {ar ? 'عرض الحملات' : 'View campaigns'} <ArrowRight className="w-3 h-3" />
                </Link>
              )}
            </div>
          </div>

          {/* Primary empty state — only when no strategy/campaign exists */}
          {!hasStrategy && (
            <div className={`${card} mb-6 text-center`} style={{ ...cardStyle, background: '#FAFAFF', border: '1px solid rgba(139,92,246,0.18)' }}>
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3"
                style={{ background: 'rgba(139,92,246,0.10)', border: '1px solid rgba(139,92,246,0.2)' }}>
                <Sparkles className="w-6 h-6" style={{ color: '#8B5CF6' }} />
              </div>
              <h3 className="text-base font-bold" style={{ color: '#0f172a' }}>
                {ar ? 'لم يتم إنشاء استراتيجية بعد.' : 'No strategy created yet.'}
              </h3>
              <p className="text-sm mt-1 max-w-xl mx-auto" style={{ color: '#64748b' }}>
                {ar
                  ? 'ابدأ بإنشاء أول استراتيجية من ذاكرة العلامة التجارية. سيستخدمها NEXUS لتنظيم المحتوى العضوي وتخطيط الحملات المدفوعة.'
                  : 'Start by creating your first strategy from your Brand Brain. NEXUS will use it to organize organic content and paid campaign planning.'}
              </p>
              {/* CTA — routes to the current real strategy entry point only. It opens
                  the Run Full Strategy flow on the dashboard; it does NOT auto-run
                  anything here and spends no credits on this page. */}
              <Link href="/dashboard?runStrategy=1"
                className="inline-flex items-center justify-center gap-2 mt-4 px-5 py-2.5 rounded-xl text-sm font-bold"
                style={{ background: '#111827', color: '#FFFFFF' }}>
                <Sparkles className="w-4 h-4" />
                {ar ? 'إنشاء أول استراتيجية' : 'Create your first strategy'}
              </Link>
            </div>
          )}

          {/* Two clearly-separated outputs: Organic + Paid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* ── Monthly Organic Content Plan ── */}
            <div className={card} style={cardStyle}>
              <div className="flex items-center gap-2 mb-3">
                <Layers className="w-4 h-4" style={{ color: '#8B5CF6' }} />
                <h2 className="text-sm font-bold" style={{ color: '#0f172a' }}>
                  {ar ? 'خطة المحتوى العضوي الشهرية' : 'Monthly Organic Content Plan'}
                </h2>
              </div>

              {!hasStrategy || !hasOrganicData ? (
                <p className="text-sm" style={{ color: '#94a3b8' }}>
                  {ar
                    ? 'ستظهر خطة المحتوى العضوي هنا بعد إنشاء أول استراتيجية.'
                    : 'Organic plan will appear here after your first strategy is created.'}
                </p>
              ) : (
                <div className="space-y-4">
                  {!platformSummary.isEmpty && (
                    <div>
                      <p className={sectionLabel} style={{ color: '#94a3b8' }}>{ar ? 'المنصات' : 'Platform mix'}</p>
                      <p className="text-sm mt-1" style={{ color: '#334155' }}>{platformSummary.labels.join(' · ')}</p>
                    </div>
                  )}
                  {pillars.length > 0 && (
                    <div>
                      <p className={sectionLabel} style={{ color: '#94a3b8' }}>{ar ? 'محاور المحتوى' : 'Content pillars'}</p>
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {pillars.map((p, i) => (
                          <span key={i} className="px-2.5 py-1 rounded-full text-xs font-semibold"
                            style={{ background: '#F5F3FF', border: '1px solid rgba(139,92,246,0.18)', color: '#6d28d9' }}>{p}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {hooks.length > 0 && (
                    <div>
                      <p className={sectionLabel} style={{ color: '#94a3b8' }}>{ar ? 'خطافات' : 'Hooks'}</p>
                      <ul className="mt-1 space-y-1">
                        {hooks.map((h, i) => <li key={i} className="text-sm" style={{ color: '#334155' }}>• {h}</li>)}
                      </ul>
                    </div>
                  )}
                  {ctas.length > 0 && (
                    <div>
                      <p className={sectionLabel} style={{ color: '#94a3b8' }}>{ar ? 'دعوات لاتخاذ إجراء (CTA)' : 'CTAs'}</p>
                      <ul className="mt-1 space-y-1">
                        {ctas.map((c, i) => <li key={i} className="text-sm" style={{ color: '#334155' }}>• {c}</li>)}
                      </ul>
                    </div>
                  )}
                  <Link href="/content-hub" className="inline-flex items-center gap-1 text-xs font-semibold pt-1" style={{ color: '#8B5CF6' }}>
                    <FileText className="w-3.5 h-3.5" /> {ar ? 'فتح مركز المحتوى' : 'Open Content Hub'} <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              )}
            </div>

            {/* ── Paid Campaign Plan (conservative, read-only) ── */}
            <div className={card} style={cardStyle}>
              <div className="flex items-center gap-2 mb-3">
                <Megaphone className="w-4 h-4" style={{ color: '#FF6B35' }} />
                <h2 className="text-sm font-bold" style={{ color: '#0f172a' }}>
                  {ar ? 'خطة الحملات المدفوعة' : 'Paid Campaign Plan'}
                </h2>
              </div>

              <div className="flex items-center gap-2 mb-3">
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold"
                  style={{ background: '#F1F5F9', color: '#64748b', border: '1px solid rgba(15,23,42,0.08)' }}>
                  {ar ? 'تخطيط فقط' : 'Planning only'}
                </span>
              </div>

              <p className="text-sm" style={{ color: '#94a3b8' }}>
                {ar
                  ? 'سيتم إعداد تخطيط الإعلانات المدفوعة بعد إنشاء الاستراتيجية والتحقق من جاهزية الحسابات.'
                  : 'Paid planning will be prepared after strategy creation and account readiness checks.'}
              </p>

              {/* Approval / no-spend guarantee */}
              <div className="flex items-start gap-2 mt-4 px-3 py-2.5 rounded-xl"
                style={{ background: '#FFF7ED', border: '1px solid rgba(249,115,22,0.18)' }}>
                <ShieldCheck className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: '#ea580c' }} />
                <p className="text-xs font-semibold" style={{ color: '#9a3412' }}>
                  {ar ? 'لن يتم صرف أي ميزانية إعلانية بدون موافقة صريحة.' : 'No ad spend will happen without explicit approval.'}
                </p>
              </div>
            </div>
          </div>

          {/* Next steps */}
          <div className={`${card} mt-6`} style={cardStyle}>
            <div className="flex items-center gap-2 mb-3">
              <Info className="w-4 h-4" style={{ color: '#06B6D4' }} />
              <h2 className="text-sm font-bold" style={{ color: '#0f172a' }}>{ar ? 'الخطوات التالية' : 'Next steps'}</h2>
            </div>
            <ol className="space-y-2">
              {[
                ar ? 'أنشئ الاستراتيجية' : 'Create your strategy',
                ar ? 'راجع خطة المحتوى العضوي' : 'Review the organic plan',
                ar ? 'ولّد المحتوى إلى مركز المحتوى' : 'Generate content into Content Hub',
                ar ? 'جهّز خطة الإعلانات المدفوعة بعد التحقق من الجاهزية والموافقة' : 'Prepare the paid plan only after readiness and approval',
              ].map((s, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm" style={{ color: '#334155' }}>
                  <span className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold"
                    style={{ background: '#F5F3FF', color: '#6d28d9', border: '1px solid rgba(139,92,246,0.18)' }}>{i + 1}</span>
                  {s}
                </li>
              ))}
            </ol>
          </div>

        </div>
      </div>
    </AppShell>
  )
}
