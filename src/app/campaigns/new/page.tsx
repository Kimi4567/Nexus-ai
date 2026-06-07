'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n-context'
import { getBrandBrainReadiness, BrandReadinessResult } from '@/lib/brandReadiness'
import { useBillingStatus } from '@/lib/useBillingStatus'
import {
  ArrowLeft, Wand2, ChevronRight, ChevronLeft, Check,
  Target, Megaphone, Settings, Rocket, Loader2, Brain, AlertTriangle,
  BookOpen, Users, Calendar, Globe, BarChart3, ArrowUpRight, Layers,
} from 'lucide-react'
import AppShell from '@/components/AppShell'
import UpgradeModal from '@/components/UpgradeModal'

const PLATFORMS = ['Facebook', 'Instagram', 'TikTok', 'YouTube Shorts', 'Snapchat', 'LinkedIn']

// Client-side mirror of PLAN_QUOTAS from lib/stripe.ts
const PLAN_POST_QUOTA: Record<string, number> = {
  FREE: 3,     free: 3,
  STARTER: 10, starter: 10,
  PRO: 25,     pro: 25,     GROWTH: 25, growth: 25,
  BUSINESS: 60, business: 60, AGENCY: 60, agency: 60,
  ACTIVE: 25,
}

const PLAN_DISPLAY: Record<string, string> = {
  FREE: 'Free',       free: 'Free',
  STARTER: 'Starter', starter: 'Starter',
  PRO: 'Growth',      pro: 'Growth',
  BUSINESS: 'Agency', business: 'Agency',
  ACTIVE: 'Growth',
}

type ContentFocus = 'PRODUCT_LAUNCH' | 'BRAND_AWARENESS' | 'COMMUNITY' | 'EDUCATION' | 'SEASONAL'
type ContentLanguage = 'ar' | 'en' | 'bilingual'

function distributePosts(total: number, platformList: string[]): string {
  if (!platformList.length) return ''
  const per: Record<string, number> = {}
  for (let i = 0; i < total; i++) {
    const p = platformList[i % platformList.length]
    per[p] = (per[p] || 0) + 1
  }
  return Object.entries(per).map(([p, n]) => `${n} ${p}`).join(' · ')
}

export default function NewCampaignPage() {
  const router = useRouter()
  const { authHeader } = useAuth()
  const { t, locale } = useI18n()
  const cnT = t('campaignNew')
  const billingStatus = useBillingStatus()

  const isRTL = locale === 'ar'
  const PrevIcon = isRTL ? ChevronRight : ChevronLeft
  const NextIcon = isRTL ? ChevronLeft : ChevronRight

  // Plan quota
  const rawPlan = billingStatus.status?.plan ?? 'free'
  const planPostQuota = PLAN_POST_QUOTA[rawPlan] ?? 3
  const planDisplayName = PLAN_DISPLAY[rawPlan] ?? 'Free'
  const isFreePlan = !billingStatus.isPaid

  // ── Content Focus options ─────────────────────────────────────────────────────
  const CONTENT_FOCUS_OPTIONS: Array<{
    value: ContentFocus
    label: string
    icon: React.ElementType
    desc: string
  }> = [
    {
      value: 'PRODUCT_LAUNCH',
      label: locale === 'ar' ? 'إطلاق منتج' : 'Product Launch',
      icon: Rocket,
      desc: locale === 'ar' ? 'أعلن عن منتج أو خدمة جديدة' : 'Announce a new product or service',
    },
    {
      value: 'BRAND_AWARENESS',
      label: locale === 'ar' ? 'بناء البراند' : 'Brand Awareness',
      icon: Target,
      desc: locale === 'ar' ? 'قوّي حضور علامتك التجارية' : 'Strengthen your brand presence',
    },
    {
      value: 'COMMUNITY',
      label: locale === 'ar' ? 'تفاعل الجمهور' : 'Community Building',
      icon: Users,
      desc: locale === 'ar' ? 'زوّد التفاعل والمجتمع' : 'Grow engagement and community',
    },
    {
      value: 'EDUCATION',
      label: locale === 'ar' ? 'محتوى تعليمي' : 'Education',
      icon: BookOpen,
      desc: locale === 'ar' ? 'علّم جمهورك وشارك الخبرة' : 'Educate your audience and share expertise',
    },
    {
      value: 'SEASONAL',
      label: locale === 'ar' ? 'موسمي / أوكازيون' : 'Seasonal / Occasion',
      icon: Calendar,
      desc: locale === 'ar' ? 'استغل المواسم والمناسبات' : 'Leverage seasons and special occasions',
    },
  ]

  // ── Content Mix presets ───────────────────────────────────────────────────────
  const CONTENT_MIX_PRESETS = [
    { id: 'balanced',    label: { ar: 'متوازن',           en: 'Balanced' },           educational: 35, promotional: 30, engagement: 35 },
    { id: 'educational', label: { ar: 'تعليمي بالأساس',   en: 'Educational Focus' },  educational: 60, promotional: 20, engagement: 20 },
    { id: 'promotional', label: { ar: 'ترويجي بالأساس',   en: 'Promotional Focus' },  educational: 20, promotional: 60, engagement: 20 },
    { id: 'community',   label: { ar: 'تفاعلي بالأساس',   en: 'Community Focus' },    educational: 20, promotional: 20, engagement: 60 },
  ]

  const GOAL_OPTIONS = [
    { value: 'SALES',      label: cnT?.goalSALES      as string },
    { value: 'AWARENESS',  label: cnT?.goalAWARENESS  as string },
    { value: 'ENGAGEMENT', label: cnT?.goalENGAGEMENT as string },
    { value: 'LEADS',      label: cnT?.goalLEADS      as string },
    { value: 'TRAFFIC',    label: cnT?.goalTRAFFIC    as string },
  ]

  const TONE_OPTIONS = [
    { value: 'MODERN',       label: cnT?.toneMODERN       as string },
    { value: 'FRIENDLY',     label: cnT?.toneFRIENDLY     as string },
    { value: 'PROFESSIONAL', label: cnT?.tonePROFESSIONAL as string },
    { value: 'BOLD',         label: cnT?.toneBOLD         as string },
    { value: 'INSPIRING',    label: cnT?.toneINSPIRING    as string },
  ]

  // ── State ─────────────────────────────────────────────────────────────────────
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [generatingStrategy, setGeneratingStrategy] = useState(false)
  const [loadingPhase, setLoadingPhase] = useState<'strategy' | 'content'>('strategy')
  const [error, setError] = useState('')
  const [showUpgrade, setShowUpgrade] = useState(false)
  const [brandReadiness, setBrandReadiness] = useState<BrandReadinessResult | null>(null)

  // AI suggest state
  const [suggesting, setSuggesting] = useState<string | null>(null)
  const [suggestion, setSuggestion] = useState<{ field: string; text: string } | null>(null)

  // Form fields
  const [name, setName] = useState('')
  const [goal, setGoal] = useState('SALES')
  const [tone, setTone] = useState('MODERN')
  const [contentFocus, setContentFocus] = useState<ContentFocus>('BRAND_AWARENESS')
  const [platforms, setPlatforms] = useState<string[]>(['Facebook', 'Instagram'])
  const [audience, setAudience] = useState('')
  const [contentLanguage, setContentLanguage] = useState<ContentLanguage>(
    locale === 'ar' ? 'ar' : 'en',
  )
  const [mixPreset, setMixPreset] = useState('balanced')

  const selectedMix = CONTENT_MIX_PRESETS.find(m => m.id === mixPreset) ?? CONTENT_MIX_PRESETS[0]
  const postDistribution = distributePosts(planPostQuota, platforms)

  const totalSteps = 5
  const steps = [
    { num: 1, label: locale === 'ar' ? 'المحتوى'  : 'Content',   icon: Target   },
    { num: 2, label: locale === 'ar' ? 'المنصات'  : 'Platforms', icon: Megaphone },
    { num: 3, label: locale === 'ar' ? 'الجمهور'  : 'Audience',  icon: Users    },
    { num: 4, label: locale === 'ar' ? 'الإعدادات': 'Settings',  icon: Settings },
    { num: 5, label: locale === 'ar' ? 'مراجعة'   : 'Review',    icon: Rocket   },
  ]

  // Fetch Brand Brain readiness
  useEffect(() => {
    fetch('/api/brand', { headers: { Authorization: authHeader() } })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) setBrandReadiness(getBrandBrainReadiness(data.brandProfile))
      })
      .catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const togglePlatform = (p: string) =>
    setPlatforms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])

  const canNext = () => {
    if (step === 1) return name.trim().length > 0
    if (step === 2) return platforms.length > 0
    return true
  }

  const brandNotReady = brandReadiness !== null && !brandReadiness.ready

  // ── Create + Generate ─────────────────────────────────────────────────────────
  const handleCreate = async (skipGeneration = false) => {
    if (!name.trim()) return
    setSaving(true)
    setError('')

    try {
      const saveRes = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: authHeader() },
        body: JSON.stringify({ name, goal, tone, platforms, audience }),
      })

      if (!saveRes.ok) {
        const err = await saveRes.json().catch(() => ({}))
        throw new Error(err.error || (cnT?.errorSave as string))
      }

      const { id: campaignId } = await saveRes.json()

      if (skipGeneration || brandNotReady) {
        router.push(`/campaigns/${campaignId}`)
        return
      }

      setSaving(false)
      setGeneratingStrategy(true)

      try {
        const engineRes = await fetch(`/api/campaigns/${campaignId}/engine`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: authHeader() },
          body: JSON.stringify({
            language: contentLanguage === 'bilingual' ? 'ar' : contentLanguage,
            contentFocus,
          }),
        })

        if (!engineRes.ok) {
          if (engineRes.status === 402) {
            setGeneratingStrategy(false)
            setShowUpgrade(true)
            router.push(`/campaigns/${campaignId}`)
            return
          }
          throw new Error('Strategy generation failed')
        }

        // Auto-generate content plan after strategy
        setLoadingPhase('content')
        try {
          await fetch(`/api/campaigns/${campaignId}/generate-content-plan`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: authHeader() },
            body: JSON.stringify({
              mediaSource: 'GENERATE',
              language: contentLanguage,
              contentMix: {
                educational: selectedMix.educational,
                promotional: selectedMix.promotional,
                engagement: selectedMix.engagement,
              },
            }),
          })
        } catch { /* non-fatal — generatable from campaign page */ }
      } catch { /* non-fatal */ }

      router.push(`/campaigns/${campaignId}`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (cnT?.errorUnexpected as string)
      setError(msg)
      setSaving(false)
    }
  }

  // ── AI Suggest ────────────────────────────────────────────────────────────────
  const handleSuggest = async (field: 'name' | 'audience') => {
    setSuggesting(field)
    setSuggestion(null)
    try {
      const res = await fetch('/api/campaigns/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: authHeader() },
        body: JSON.stringify({ field, name, goal, locale }),
      })
      const data = await res.json()
      if (data.suggestion) setSuggestion({ field, text: data.suggestion })
    } catch { /* silent */ }
    finally { setSuggesting(null) }
  }

  const acceptSuggestion = () => {
    if (!suggestion) return
    if (suggestion.field === 'name') setName(suggestion.text)
    if (suggestion.field === 'audience') setAudience(suggestion.text)
    setSuggestion(null)
  }

  // ── Loading screen ────────────────────────────────────────────────────────────
  if (generatingStrategy) {
    const isContent = loadingPhase === 'content'
    const loadingSteps = isContent
      ? [
          locale === 'ar' ? 'الاستراتيجية جاهزة ✓' : 'Strategy complete ✓',
          locale === 'ar' ? 'اكتشاف المنصات المتصلة...' : 'Detecting connected platforms...',
          locale === 'ar' ? 'توليد البوستات بالـ AI...' : 'Generating posts with AI...',
          locale === 'ar' ? 'بناء تقويم النشر...' : 'Building your publishing calendar...',
        ]
      : [
          locale === 'ar' ? 'تحليل البراند الخاص بك...' : 'Analysing your brand...',
          locale === 'ar' ? 'بناء استراتيجية المحتوى...' : 'Building content strategy...',
          locale === 'ar' ? 'تحديد الـ Content Angles...' : 'Identifying content angles...',
          locale === 'ar' ? 'الانتهاء من الخطة...' : 'Finalising your content plan...',
        ]

    const headingText = isContent
      ? (locale === 'ar' ? 'NEXUS بيولد المحتوى...' : 'NEXUS is generating your content...')
      : (locale === 'ar' ? 'NEXUS بيبني استراتيجيتك...' : 'NEXUS is building your strategy...')

    const subText = isContent
      ? (locale === 'ar'
          ? `بنجهز ${planPostQuota} بوست جاهز للنشر. لحظة.`
          : `Preparing ${planPostQuota} ready-to-publish posts. Just a moment.`)
      : (locale === 'ar'
          ? 'الـ AI بيحلل البراند بتاعك ويبني استراتيجية محتوى كاملة.'
          : 'AI is analysing your brand and building a full content strategy.')

    return (
      <AppShell>
        <div className="min-h-screen flex items-center justify-center px-4">
          <div className="text-center max-w-md">
            <div className="relative w-24 h-24 mx-auto mb-8">
              <div className="absolute inset-0 rounded-full animate-ping"
                style={{ background: isContent ? 'rgba(99,102,241,0.15)' : 'rgba(139,92,246,0.15)' }} />
              <div className="absolute inset-2 rounded-full animate-pulse"
                style={{ background: isContent ? 'rgba(99,102,241,0.2)' : 'rgba(139,92,246,0.2)' }} />
              <div className="relative w-full h-full rounded-full flex items-center justify-center"
                style={{
                  background: isContent
                    ? 'linear-gradient(135deg,#6366f1,#4f46e5)'
                    : 'linear-gradient(135deg,#8B5CF6,#6366f1)',
                  boxShadow: isContent
                    ? '0 0 40px rgba(99,102,241,0.4)'
                    : '0 0 40px rgba(139,92,246,0.4)',
                }}>
                <Wand2 className="w-10 h-10 text-white" />
              </div>
            </div>

            <h2 className="text-2xl font-bold mb-2">{headingText}</h2>
            <p className="text-text-muted text-sm mb-8">{subText}</p>

            <div className="flex items-center justify-center gap-2 mb-6">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full"
                  style={{ background: isContent ? '#4ade80' : '#8B5CF6' }} />
                <span className="text-xs" style={{ color: isContent ? '#4ade80' : '#8B5CF6' }}>
                  {locale === 'ar' ? 'الاستراتيجية' : 'Strategy'}
                </span>
              </div>
              <div className="w-8 h-px bg-gray-600" />
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full"
                  style={{ background: isContent ? '#6366f1' : 'rgba(99,102,241,0.3)' }} />
                <span className="text-xs" style={{ color: isContent ? '#6366f1' : 'rgba(156,163,175,0.5)' }}>
                  {locale === 'ar' ? 'المحتوى' : 'Content'}
                </span>
              </div>
            </div>

            <div className="space-y-3 text-left">
              {loadingSteps.map((s, i) => (
                <div key={`${loadingPhase}-${i}`} className="flex items-center gap-3 text-sm"
                  style={{ opacity: 0.4 + i * 0.2, animation: `fadeIn 0.5s ease ${i * 0.4}s both` }}>
                  {i === 0 && isContent
                    ? <Check className="w-4 h-4 flex-shrink-0 text-green-400" />
                    : <Loader2 className="w-4 h-4 animate-spin flex-shrink-0 text-violet-400" />
                  }
                  <span className="text-text-secondary">{s}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </AppShell>
    )
  }

  // ── Wizard ────────────────────────────────────────────────────────────────────
  return (
    <AppShell>
      <div className="relative min-h-screen">
        <div className="absolute inset-0 nx-bg-grid pointer-events-none opacity-30" />
        <div className="relative max-w-3xl mx-auto px-4 py-10 page-enter">
          <UpgradeModal open={showUpgrade} onClose={() => setShowUpgrade(false)} reason="no_credits" />

          {/* ── Header ─────────────────────────────────────────────────────── */}
          <div className="flex items-center gap-3 mb-8">
            <Link href="/campaigns"
              className="w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:scale-105"
              style={{ background: 'rgba(12,13,36,0.6)', border: '1px solid rgba(139,92,246,0.2)' }}>
              <ArrowLeft className="w-4 h-4 text-gray-400" />
            </Link>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <Layers className="w-4 h-4 text-violet-400" />
                <span className="text-xs text-violet-400/70 font-mono tracking-wider">
                  {locale === 'ar' ? 'محتوى عضوي جديد' : 'NEW ORGANIC CONTENT'}
                </span>
              </div>
              <h1 className="text-2xl font-bold">
                {locale === 'ar' ? 'ولّد محتوى المنصات' : 'Generate Platform Content'}
              </h1>
              <p className="text-text-muted text-sm">
                {locale === 'ar' ? `الخطوة ${step} من ${totalSteps}` : `Step ${step} of ${totalSteps}`}
              </p>
            </div>
          </div>

          {/* ── Stepper ─────────────────────────────────────────────────────── */}
          <div className="flex items-center gap-1 mb-8 overflow-x-auto">
            {steps.map(s => {
              const Icon = s.icon
              const done = step > s.num
              const active = step === s.num
              return (
                <div key={s.num} className="flex items-center gap-1 flex-1 min-w-0">
                  <div className={`flex items-center justify-center w-9 h-9 rounded-xl transition-all flex-shrink-0 ${
                    done ? 'text-white' : active ? 'text-black' : 'text-text-muted'
                  }`} style={{
                    background: done
                      ? 'rgba(16,185,129,0.15)'
                      : active
                      ? 'linear-gradient(135deg,#8B5CF6,#6366f1)'
                      : 'rgba(255,255,255,0.04)',
                    border: done
                      ? '1px solid rgba(16,185,129,0.3)'
                      : active
                      ? 'none'
                      : '1px solid rgba(255,255,255,0.08)',
                  }}>
                    {done
                      ? <Check className="w-4 h-4 text-emerald-400" />
                      : <Icon className="w-4 h-4" />}
                  </div>
                  <span className={`text-xs hidden sm:block font-medium truncate ${
                    active ? 'text-white' : done ? 'text-emerald-400' : 'text-text-muted'
                  }`}>
                    {s.label}
                  </span>
                  {s.num < totalSteps && (
                    <div className="flex-1 h-px mx-1" style={{
                      background: done ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.08)',
                      minWidth: '8px',
                    }} />
                  )}
                </div>
              )
            })}
          </div>

          {/* ── Card ────────────────────────────────────────────────────────── */}
          <div className="rounded-2xl p-6" style={{
            background: 'rgba(12,13,36,0.6)',
            border: '1px solid rgba(139,92,246,0.15)',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          }}>

            {/* ── Step 1: Content Info ──────────────────────────────────────── */}
            {step === 1 && (
              <div className="space-y-5">
                <div>
                  <h3 className="font-bold text-lg mb-0.5">
                    {locale === 'ar' ? 'معلومات المحتوى' : 'Content Info'}
                  </h3>
                  <p className="text-text-muted text-sm">
                    {locale === 'ar'
                      ? 'حدد الاسم والهدف والنبرة وتركيز المحتوى'
                      : 'Define your content name, goal, tone, and focus'}
                  </p>
                </div>

                {/* Name */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-sm font-medium">
                      {locale === 'ar' ? 'اسم المشروع' : 'Project Name'}{' '}
                      <span className="text-red-400">*</span>
                    </label>
                    <button type="button" onClick={() => handleSuggest('name')}
                      disabled={suggesting === 'name'}
                      className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg transition-all hover:scale-105"
                      style={{
                        background: 'rgba(139,92,246,0.12)',
                        border: '1px solid rgba(139,92,246,0.25)',
                        color: '#a78bfa',
                      }}>
                      {suggesting === 'name'
                        ? <Loader2 className="w-3 h-3 animate-spin" />
                        : <Wand2 className="w-3 h-3" />}
                      {locale === 'ar' ? 'اقتراح AI' : 'AI Suggest'}
                    </button>
                  </div>
                  <input type="text" value={name} onChange={e => setName(e.target.value)}
                    placeholder={locale === 'ar'
                      ? 'مثال: محتوى رمضان 2025'
                      : 'e.g. Ramadan Content 2025'}
                    className="input-nexus" autoFocus />
                  {suggestion?.field === 'name' && (
                    <div className="mt-2 p-3 rounded-xl text-sm"
                      style={{ background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.2)' }}>
                      <p className="text-violet-300 font-medium mb-2">✨ {suggestion.text}</p>
                      <div className="flex gap-2">
                        <button onClick={acceptSuggestion}
                          className="text-xs px-3 py-1 rounded-lg font-semibold"
                          style={{ background: 'rgba(139,92,246,0.2)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.3)' }}>
                          {locale === 'ar' ? 'استخدم هذا' : 'Use this'}
                        </button>
                        <button onClick={() => setSuggestion(null)}
                          className="text-xs px-3 py-1 rounded-lg text-gray-500 hover:text-gray-400">
                          {locale === 'ar' ? 'تجاهل' : 'Dismiss'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Goal + Tone */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">{cnT?.goalLabel as string}</label>
                    <select value={goal} onChange={e => setGoal(e.target.value)} className="input-nexus">
                      {GOAL_OPTIONS.map(g => (
                        <option key={g.value} value={g.value}>{g.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">{cnT?.toneLabel as string}</label>
                    <select value={tone} onChange={e => setTone(e.target.value)} className="input-nexus">
                      {TONE_OPTIONS.map(tn => (
                        <option key={tn.value} value={tn.value}>{tn.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Content Focus */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    {locale === 'ar' ? 'تركيز المحتوى' : 'Content Focus'}
                    <span className="text-text-muted font-normal ms-1 text-xs">
                      {locale === 'ar' ? '— ما الهدف الأساسي؟' : '— What is the primary focus?'}
                    </span>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {CONTENT_FOCUS_OPTIONS.map(opt => {
                      const FocusIcon = opt.icon
                      const isActive = contentFocus === opt.value
                      return (
                        <button key={opt.value} type="button" onClick={() => setContentFocus(opt.value)}
                          className="flex items-center gap-3 p-3 rounded-xl text-left transition-all"
                          style={{
                            background: isActive ? 'rgba(139,92,246,0.12)' : 'rgba(255,255,255,0.03)',
                            border: isActive
                              ? '1px solid rgba(139,92,246,0.4)'
                              : '1px solid rgba(255,255,255,0.08)',
                          }}>
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ background: isActive ? 'rgba(139,92,246,0.2)' : 'rgba(255,255,255,0.05)' }}>
                            <FocusIcon className="w-4 h-4"
                              style={{ color: isActive ? '#a78bfa' : '#6B7280' }} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium"
                              style={{ color: isActive ? '#a78bfa' : '#E5E7EB' }}>
                              {opt.label}
                            </p>
                            <p className="text-xs text-text-muted truncate">{opt.desc}</p>
                          </div>
                          {isActive && <Check className="w-4 h-4 text-violet-400 flex-shrink-0 ms-auto" />}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* ── Step 2: Platforms + Quota ─────────────────────────────────── */}
            {step === 2 && (
              <div className="space-y-4">
                <div>
                  <h3 className="font-bold text-lg mb-0.5">
                    {locale === 'ar' ? 'المنصات والحصة الشهرية' : 'Platforms & Monthly Quota'}
                  </h3>
                  <p className="text-text-muted text-sm">
                    {locale === 'ar'
                      ? 'اختار المنصات — NEXUS هيوزّع البوستات تلقائياً'
                      : 'Choose your platforms — NEXUS will distribute posts automatically'}
                  </p>
                </div>

                {/* Plan Quota Banner */}
                <div className="rounded-xl p-4" style={{
                  background: isFreePlan ? 'rgba(249,115,22,0.06)' : 'rgba(99,102,241,0.06)',
                  border: `1px solid ${isFreePlan ? 'rgba(249,115,22,0.25)' : 'rgba(99,102,241,0.25)'}`,
                }}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center"
                        style={{
                          background: isFreePlan ? 'rgba(249,115,22,0.15)' : 'rgba(99,102,241,0.15)',
                        }}>
                        <BarChart3 className="w-4 h-4"
                          style={{ color: isFreePlan ? '#F97316' : '#818CF8' }} />
                      </div>
                      <div>
                        <p className="text-sm font-bold"
                          style={{ color: isFreePlan ? '#F97316' : '#818CF8' }}>
                          {locale === 'ar' ? `باقة ${planDisplayName}` : `${planDisplayName} Plan`}
                        </p>
                        <p className="text-xs text-text-muted">
                          {locale === 'ar'
                            ? `حصتك: ${planPostQuota} بوست / شهر`
                            : `Your quota: ${planPostQuota} posts / month`}
                        </p>
                      </div>
                    </div>
                    {isFreePlan && (
                      <Link href="/billing"
                        className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-lg"
                        style={{
                          background: 'rgba(249,115,22,0.15)',
                          color: '#F97316',
                          border: '1px solid rgba(249,115,22,0.3)',
                        }}>
                        {locale === 'ar' ? 'ترقية' : 'Upgrade'}
                        <ArrowUpRight className="w-3 h-3" />
                      </Link>
                    )}
                  </div>
                  {isFreePlan && (
                    <p className="text-xs mt-2" style={{ color: 'rgba(249,115,22,0.7)' }}>
                      {locale === 'ar'
                        ? '⚡ الباقة المدفوعة تبدأ من 10 بوست/شهر — ارفع التأثير بتاعك'
                        : '⚡ Paid plans start at 10 posts/month — amplify your reach'}
                    </p>
                  )}
                </div>

                {/* Platform Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {PLATFORMS.map(p => (
                    <button key={p} type="button" onClick={() => togglePlatform(p)}
                      className={`p-4 rounded-xl border text-sm font-medium transition-all ${
                        platforms.includes(p)
                          ? 'border-amber bg-amber/10 text-amber'
                          : 'border-white/10 hover:border-white/20 text-text-secondary'
                      }`}>
                      {p}
                    </button>
                  ))}
                </div>
                {platforms.length === 0 && (
                  <p className="text-red-400 text-xs">{cnT?.platformRequired as string}</p>
                )}

                {/* Post distribution preview */}
                {platforms.length > 0 && (
                  <div className="rounded-xl p-4" style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}>
                    <p className="text-xs text-text-muted mb-1.5">
                      {locale === 'ar' ? '📊 توزيع البوستات الشهرية:' : '📊 Monthly post distribution:'}
                    </p>
                    <p className="text-sm font-semibold text-white">{postDistribution}</p>
                    <p className="text-xs text-text-muted mt-1">
                      {locale === 'ar'
                        ? `الإجمالي: ${planPostQuota} بوست على ${platforms.length} منصة`
                        : `Total: ${planPostQuota} posts across ${platforms.length} platform${platforms.length > 1 ? 's' : ''}`}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* ── Step 3: Audience ─────────────────────────────────────────── */}
            {step === 3 && (
              <div className="space-y-4">
                <div>
                  <h3 className="font-bold text-lg mb-0.5">{cnT?.step3Heading as string}</h3>
                  <p className="text-text-muted text-sm">
                    {locale === 'ar'
                      ? 'صف الجمهور المستهدف — NEXUS هيبني المحتوى حوليه'
                      : 'Describe your target audience — NEXUS will tailor content around them'}
                  </p>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-sm font-medium">{cnT?.audienceLabel as string}</label>
                    <button type="button" onClick={() => handleSuggest('audience')}
                      disabled={suggesting === 'audience'}
                      className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg transition-all hover:scale-105"
                      style={{
                        background: 'rgba(139,92,246,0.12)',
                        border: '1px solid rgba(139,92,246,0.25)',
                        color: '#a78bfa',
                      }}>
                      {suggesting === 'audience'
                        ? <Loader2 className="w-3 h-3 animate-spin" />
                        : <Wand2 className="w-3 h-3" />}
                      {locale === 'ar' ? 'اقتراح AI' : 'AI Suggest'}
                    </button>
                  </div>
                  <textarea value={audience} onChange={e => setAudience(e.target.value)}
                    placeholder={cnT?.audiencePlaceholder as string}
                    rows={5} className="input-nexus resize-none" autoFocus />
                  {suggestion?.field === 'audience' && (
                    <div className="mt-2 p-3 rounded-xl text-sm"
                      style={{ background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.2)' }}>
                      <p className="text-violet-300 mb-2">{suggestion.text}</p>
                      <div className="flex gap-2">
                        <button onClick={acceptSuggestion}
                          className="text-xs px-3 py-1 rounded-lg font-semibold"
                          style={{ background: 'rgba(139,92,246,0.2)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.3)' }}>
                          {locale === 'ar' ? 'استخدم هذا' : 'Use this'}
                        </button>
                        <button onClick={() => setSuggestion(null)}
                          className="text-xs px-3 py-1 rounded-lg text-gray-500 hover:text-gray-400">
                          {locale === 'ar' ? 'تجاهل' : 'Dismiss'}
                        </button>
                      </div>
                    </div>
                  )}
                  <p className="text-text-muted text-xs mt-1.5">{cnT?.audienceHint as string}</p>
                </div>
              </div>
            )}

            {/* ── Step 4: Language + Content Mix ───────────────────────────── */}
            {step === 4 && (
              <div className="space-y-5">
                <div>
                  <h3 className="font-bold text-lg mb-0.5">
                    {locale === 'ar' ? 'إعدادات المحتوى' : 'Content Settings'}
                  </h3>
                  <p className="text-text-muted text-sm">
                    {locale === 'ar'
                      ? 'حدد لغة المحتوى ومزيج أنواعه'
                      : 'Define your content language and type mix'}
                  </p>
                </div>

                {/* Language picker */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    <Globe className="w-3.5 h-3.5 inline me-1.5 text-violet-400" />
                    {locale === 'ar' ? 'لغة المحتوى' : 'Content Language'}
                  </label>
                  <div className="flex gap-2">
                    {([
                      { value: 'ar',        flag: '🇸🇦', label: locale === 'ar' ? 'عربي'          : 'Arabic'    },
                      { value: 'en',        flag: '🇺🇸', label: locale === 'ar' ? 'إنجليزي'       : 'English'   },
                      { value: 'bilingual', flag: '⚡',  label: locale === 'ar' ? 'ثنائي اللغة'   : 'Bilingual' },
                    ] as Array<{ value: ContentLanguage; flag: string; label: string }>).map(opt => (
                      <button key={opt.value} type="button" onClick={() => setContentLanguage(opt.value)}
                        className="flex-1 flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl text-sm font-medium transition-all"
                        style={{
                          background: contentLanguage === opt.value
                            ? 'rgba(139,92,246,0.12)'
                            : 'rgba(255,255,255,0.03)',
                          border: contentLanguage === opt.value
                            ? '1px solid rgba(139,92,246,0.4)'
                            : '1px solid rgba(255,255,255,0.08)',
                          color: contentLanguage === opt.value ? '#a78bfa' : '#9CA3AF',
                        }}>
                        <span className="text-xl">{opt.flag}</span>
                        <span>{opt.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Content Mix */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    <BarChart3 className="w-3.5 h-3.5 inline me-1.5 text-violet-400" />
                    {locale === 'ar' ? 'مزيج المحتوى' : 'Content Mix'}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {CONTENT_MIX_PRESETS.map(preset => {
                      const isSelected = mixPreset === preset.id
                      return (
                        <button key={preset.id} type="button" onClick={() => setMixPreset(preset.id)}
                          className="p-3 rounded-xl text-left transition-all"
                          style={{
                            background: isSelected ? 'rgba(139,92,246,0.12)' : 'rgba(255,255,255,0.03)',
                            border: isSelected
                              ? '1px solid rgba(139,92,246,0.4)'
                              : '1px solid rgba(255,255,255,0.08)',
                          }}>
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-medium"
                              style={{ color: isSelected ? '#a78bfa' : '#E5E7EB' }}>
                              {locale === 'ar' ? preset.label.ar : preset.label.en}
                            </p>
                            {isSelected && <Check className="w-3.5 h-3.5 text-violet-400" />}
                          </div>
                          {/* Mini bar chart */}
                          <div className="flex gap-1 items-end h-6">
                            <div className="flex-1 rounded-sm" style={{
                              height: `${Math.max(4, preset.educational * 0.4)}px`,
                              background: '#6366f1',
                            }} />
                            <div className="flex-1 rounded-sm" style={{
                              height: `${Math.max(4, preset.promotional * 0.4)}px`,
                              background: '#F97316',
                            }} />
                            <div className="flex-1 rounded-sm" style={{
                              height: `${Math.max(4, preset.engagement * 0.4)}px`,
                              background: '#10B981',
                            }} />
                          </div>
                          <div className="flex gap-2 mt-1.5 text-[10px] text-text-muted flex-wrap">
                            <span style={{ color: '#818CF8' }}>📚 {preset.educational}%</span>
                            <span style={{ color: '#FB923C' }}>📢 {preset.promotional}%</span>
                            <span style={{ color: '#34D399' }}>💬 {preset.engagement}%</span>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                  <div className="flex items-center gap-4 mt-3 text-xs text-text-muted">
                    <span><span style={{ color: '#818CF8' }}>■</span> {locale === 'ar' ? 'تعليمي' : 'Educational'}</span>
                    <span><span style={{ color: '#FB923C' }}>■</span> {locale === 'ar' ? 'ترويجي' : 'Promotional'}</span>
                    <span><span style={{ color: '#34D399' }}>■</span> {locale === 'ar' ? 'تفاعلي' : 'Engagement'}</span>
                  </div>
                </div>
              </div>
            )}

            {/* ── Step 5: Review ────────────────────────────────────────────── */}
            {step === 5 && (
              <div className="space-y-4">
                <div>
                  <h3 className="font-bold text-lg mb-0.5">
                    {locale === 'ar' ? 'مراجعة وتأكيد' : 'Review & Confirm'}
                  </h3>
                  <p className="text-text-muted text-sm">
                    {locale === 'ar'
                      ? 'تأكد من التفاصيل ثم ابدأ التوليد'
                      : 'Confirm details then start generation'}
                  </p>
                </div>

                {/* Brand Brain gate warning */}
                {brandNotReady && brandReadiness && (
                  <div className="rounded-xl p-4"
                    style={{ background: 'rgba(255,184,0,0.06)', border: '1px solid rgba(255,184,0,0.25)' }}>
                    <div className="flex items-start gap-3">
                      <Brain className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#FFB800' }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold mb-0.5" style={{ color: '#FFB800' }}>
                          {(t('brandGate') as Record<string, string>).campaignTitle}
                        </p>
                        <p className="text-xs text-text-muted mb-2">
                          {(t('brandGate') as Record<string, string>).campaignDesc}
                        </p>
                        <Link href="/brand"
                          className="inline-flex items-center gap-1 text-[11px] font-bold"
                          style={{ color: '#FFB800' }}>
                          {(t('brandGate') as Record<string, string>).completeBrandBtn} →
                        </Link>
                      </div>
                    </div>
                  </div>
                )}

                {/* Summary table */}
                <div className="space-y-2.5 p-4 rounded-xl"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  {[
                    {
                      label: locale === 'ar' ? 'الاسم' : 'Name',
                      value: name,
                    },
                    {
                      label: locale === 'ar' ? 'الهدف' : 'Goal',
                      value: GOAL_OPTIONS.find(g => g.value === goal)?.label,
                    },
                    {
                      label: locale === 'ar' ? 'النبرة' : 'Tone',
                      value: TONE_OPTIONS.find(tn => tn.value === tone)?.label,
                    },
                    {
                      label: locale === 'ar' ? 'التركيز' : 'Focus',
                      value: CONTENT_FOCUS_OPTIONS.find(f => f.value === contentFocus)?.label,
                    },
                    {
                      label: locale === 'ar' ? 'المنصات' : 'Platforms',
                      value: platforms.join(' · '),
                    },
                    {
                      label: locale === 'ar' ? 'اللغة' : 'Language',
                      value: contentLanguage === 'ar'
                        ? '🇸🇦 عربي'
                        : contentLanguage === 'en'
                        ? '🇺🇸 English'
                        : '⚡ Bilingual',
                    },
                    {
                      label: locale === 'ar' ? 'مزيج المحتوى' : 'Content Mix',
                      value: locale === 'ar'
                        ? CONTENT_MIX_PRESETS.find(m => m.id === mixPreset)?.label.ar
                        : CONTENT_MIX_PRESETS.find(m => m.id === mixPreset)?.label.en,
                    },
                  ].map(item => (
                    <div key={item.label} className="flex justify-between gap-3">
                      <span className="text-text-muted text-sm flex-shrink-0">{item.label}</span>
                      <span className="font-medium text-sm text-right">{item.value}</span>
                    </div>
                  ))}
                </div>

                {/* Generation info card */}
                <div className="rounded-xl p-4"
                  style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)' }}>
                  <div className="flex items-start gap-3">
                    <Wand2 className="w-5 h-5 text-indigo-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-semibold text-indigo-300 text-sm mb-2">
                        {locale === 'ar' ? '✨ ما سيُولَّد' : '✨ What will be generated'}
                      </p>
                      <div className="space-y-1 text-xs text-text-muted">
                        <p>
                          {locale === 'ar'
                            ? `📦 باقة ${planDisplayName} ← ${planPostQuota} بوست عضوي جاهز للنشر`
                            : `📦 ${planDisplayName} plan → ${planPostQuota} organic posts ready to publish`}
                        </p>
                        <p>
                          {locale === 'ar'
                            ? `📊 توزيع: ${postDistribution || `${planPostQuota} بوست`}`
                            : `📊 Distribution: ${postDistribution || `${planPostQuota} posts`}`}
                        </p>
                        <p>
                          {locale === 'ar'
                            ? '💳 التكلفة: 8 كريدت (استراتيجية) + 2 كريدت (توليد محتوى) = 10 كريدت'
                            : '💳 Cost: 8 credits (strategy) + 2 credits (content generation) = 10 credits'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {error && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                    {error}
                  </div>
                )}
              </div>
            )}

            {/* ── Navigation ────────────────────────────────────────────────── */}
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-white/10">
              <button onClick={() => setStep(s => s - 1)} disabled={step === 1}
                className="btn-secondary disabled:opacity-40">
                <PrevIcon className="w-4 h-4" />
                {cnT?.btnPrev as string}
              </button>

              {step < totalSteps ? (
                <button onClick={() => setStep(s => s + 1)} disabled={!canNext()}
                  className="btn-primary disabled:opacity-40">
                  {cnT?.btnNext as string}
                  <NextIcon className="w-4 h-4" />
                </button>
              ) : brandNotReady ? (
                <button onClick={() => handleCreate(true)} disabled={saving || !name.trim()}
                  className="btn-secondary disabled:opacity-40 min-w-[160px] flex items-center gap-1.5">
                  {saving
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <AlertTriangle className="w-4 h-4" />}
                  {(t('brandGate') as Record<string, string>).saveDraftBtn}
                </button>
              ) : (
                <button onClick={() => handleCreate(false)} disabled={saving || !name.trim()}
                  className="btn-primary disabled:opacity-40 min-w-[160px]">
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {cnT?.btnCreating as string}
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-4 h-4" />
                      {locale === 'ar' ? 'ولّد المحتوى' : 'Generate Content'}
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
