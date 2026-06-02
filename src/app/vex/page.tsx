'use client'

import AppShell from '@/components/AppShell'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n-context'
import {
  Zap, Loader2, Copy, Check,
  Megaphone, Target, MousePointerClick, Type,
  Sparkles, RefreshCw, Brain
} from 'lucide-react'
import StarField from '@/components/ui/StarField'
import { useBrandBrain } from '@/hooks/useBrandBrain'

/* ═══════════════════════════════════════════════════════════════
   VEX — Paid Ad Copy Lab
   Facebook · Instagram · Google · LinkedIn · TikTok · Snapchat
   ═══════════════════════════════════════════════════════════════ */

type AdPlatform  = 'facebook' | 'instagram' | 'google' | 'linkedin' | 'tiktok' | 'snapchat'
type AdObjective = 'conversions' | 'traffic' | 'leads' | 'awareness' | 'engagement' | 'retargeting'
type AdFormat    = 'single_image' | 'carousel' | 'video' | 'story' | 'search'

interface AdVariant {
  headline: string
  primaryText: string
  description?: string
  cta: string
  angle: string
}

interface AdResult {
  id: string
  platform: AdPlatform
  objective: AdObjective
  offer: string
  variants: AdVariant[]
  createdAt: Date
}

// ── Static config ─────────────────────────────────────────────
const PLATFORMS: { id: AdPlatform; label: string; icon: string; color: string }[] = [
  { id: 'facebook',  label: 'Facebook',  icon: '👥', color: '#1877F2' },
  { id: 'instagram', label: 'Instagram', icon: '📸', color: '#E1306C' },
  { id: 'google',    label: 'Google',    icon: '🔍', color: '#4285F4' },
  { id: 'linkedin',  label: 'LinkedIn',  icon: '💼', color: '#0A66C2' },
  { id: 'tiktok',    label: 'TikTok',    icon: '🎵', color: '#69C9D0' },
  { id: 'snapchat',  label: 'Snapchat',  icon: '👻', color: '#FFFC00' },
]

const OBJECTIVES: { id: AdObjective; arLabel: string; enLabel: string; icon: string }[] = [
  { id: 'conversions', arLabel: 'تحويلات / مبيعات', enLabel: 'Conversions / Sales', icon: '💰' },
  { id: 'traffic',     arLabel: 'زيارات للموقع',    enLabel: 'Website Traffic',       icon: '🌐' },
  { id: 'leads',       arLabel: 'عملاء محتملون',    enLabel: 'Lead Generation',        icon: '🎯' },
  { id: 'awareness',   arLabel: 'وعي بالعلامة',     enLabel: 'Brand Awareness',        icon: '📢' },
  { id: 'engagement',  arLabel: 'تفاعل',             enLabel: 'Engagement',             icon: '❤️' },
  { id: 'retargeting', arLabel: 'إعادة استهداف',    enLabel: 'Retargeting',            icon: '🔄' },
]

const FORMATS_BY_PLATFORM: Record<AdPlatform, AdFormat[]> = {
  facebook:  ['single_image', 'carousel', 'video', 'story'],
  instagram: ['single_image', 'carousel', 'video', 'story'],
  google:    ['search'],
  linkedin:  ['single_image', 'carousel'],
  tiktok:    ['video', 'story'],
  snapchat:  ['single_image', 'story', 'video'],
}

const FORMAT_LABELS: Record<AdFormat, string> = {
  single_image: 'Single Image',
  carousel:     'Carousel',
  video:        'Video',
  story:        'Story',
  search:       'Search',
}

// ── Ambient background ─────────────────────────────────────────
function VexOrbs() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
      <div className="absolute rounded-full blur-[140px] opacity-20"
        style={{ width: 600, height: 600, background: 'radial-gradient(circle, rgba(249,115,22,0.18), transparent 70%)', top: '-5%', right: '-10%', animation: 'float 13s ease-in-out infinite' }} />
      <div className="absolute rounded-full blur-[100px] opacity-15"
        style={{ width: 450, height: 450, background: 'radial-gradient(circle, rgba(139,92,246,0.12), transparent 70%)', bottom: '5%', left: '-5%', animation: 'float 10s ease-in-out infinite reverse' }} />
    </div>
  )
}

// ── Copy button ────────────────────────────────────────────────
function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
      className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all flex-shrink-0"
      style={{
        background:   copied ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.06)',
        color:        copied ? '#10b981' : '#9ca3af',
        border:       `1px solid ${copied ? '#10b98130' : 'rgba(255,255,255,0.08)'}`,
      }}>
      {copied ? <Check size={11} /> : <Copy size={11} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

// ── Variant card ───────────────────────────────────────────────
function VariantCard({ variant, index }: { variant: AdVariant; index: number }) {
  const angleColors = ['#F97316', '#8B5CF6', '#06B6D4']
  const color = angleColors[index % angleColors.length]

  const fullText = `HEADLINE: ${variant.headline}\n\nPRIMARY TEXT: ${variant.primaryText}${variant.description ? `\n\nDESCRIPTION: ${variant.description}` : ''}\n\nCTA: ${variant.cta}`

  return (
    <div
      className="rounded-xl p-5 border transition-all hover:border-white/15"
      style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.08)' }}>
      {/* Top row */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-semibold px-3 py-1 rounded-full"
          style={{ background: `${color}20`, color, border: `1px solid ${color}30` }}>
          {variant.angle}
        </span>
        <CopyBtn text={fullText} />
      </div>

      {/* Headline */}
      <div className="mb-3">
        <div className="text-xs font-medium text-text-muted mb-1.5 flex items-center gap-1.5">
          <Type size={10} /> Headline
        </div>
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-semibold text-text-primary leading-snug flex-1">{variant.headline}</p>
          <CopyBtn text={variant.headline} />
        </div>
      </div>

      {/* Primary text */}
      <div className="mb-3">
        <div className="text-xs font-medium text-text-muted mb-1.5 flex items-center gap-1.5">
          <Megaphone size={10} /> Primary Text
        </div>
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm text-text-secondary leading-relaxed flex-1">{variant.primaryText}</p>
          <CopyBtn text={variant.primaryText} />
        </div>
      </div>

      {/* Description (Google Search) */}
      {variant.description && (
        <div className="mb-3">
          <div className="text-xs font-medium text-text-muted mb-1.5">Description</div>
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm text-text-secondary leading-relaxed flex-1">{variant.description}</p>
            <CopyBtn text={variant.description} />
          </div>
        </div>
      )}

      {/* CTA pill */}
      <div className="pt-3 border-t flex items-center gap-2" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <MousePointerClick size={12} style={{ color }} />
        <span className="text-xs font-semibold" style={{ color }}>{variant.cta}</span>
      </div>
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────
export default function VexPage() {
  const router = useRouter()
  const { isAuthenticated, loading, authHeader } = useAuth()
  const { locale }    = useI18n()
  const { brand: brandProfile } = useBrandBrain()

  const [platform,   setPlatform]   = useState<AdPlatform>('facebook')
  const [objective,  setObjective]  = useState<AdObjective>('conversions')
  const [format,     setFormat]     = useState<AdFormat>('single_image')
  const [offer,      setOffer]      = useState('')
  const [generating, setGenerating] = useState(false)
  const [results,    setResults]    = useState<AdResult[]>([])
  const [error,      setError]      = useState<string | null>(null)
  const resultsRef = useRef<HTMLDivElement>(null)

  // Auth guard
  useEffect(() => {
    if (!loading && !isAuthenticated) router.push('/auth/login')
  }, [loading, isAuthenticated, router])

  // Auto-select first available format when platform changes
  useEffect(() => {
    const formats = FORMATS_BY_PLATFORM[platform]
    if (!formats.includes(format)) setFormat(formats[0])
  }, [platform])

  const generate = async () => {
    if (!offer.trim()) { setError(locale === 'ar' ? 'اكتب وصف عرضك أولاً.' : 'Please describe your offer first.'); return }
    setError(null)
    setGenerating(true)

    const token = authHeader()

    const brandCtx = brandProfile
      ? `\nBrand: ${brandProfile.brandName || ''}, Industry: ${brandProfile.industry || ''}, Audience: ${brandProfile.targetAudience || ''}, Tone: ${(brandProfile.toneKeywords || []).join(', ')}, Offer: ${brandProfile.primaryOffer || ''}`
      : ''

    const systemPrompt = `You are VEX, an elite paid-advertising copywriter with 12+ years writing direct-response ads for ${platform.toUpperCase()}.
You deeply understand conversion psychology, platform algorithm signals, and how to write copy that stops the scroll.${brandCtx}
Respond ONLY with a valid JSON array. No preamble, no markdown fences, no explanation.`

    const objectiveLabel: Record<AdObjective, string> = {
      conversions: 'Drive purchases / conversions',
      traffic:     'Drive website traffic',
      leads:       'Capture leads / sign-ups',
      awareness:   'Build brand awareness',
      engagement:  'Maximize engagement',
      retargeting: 'Re-engage warm / past visitors',
    }

    const userPrompt = `Write 3 high-converting ${platform.toUpperCase()} ${FORMAT_LABELS[format]} ad copy variants for:

OFFER: ${offer}
OBJECTIVE: ${objectiveLabel[objective]}

Rules:
- Each variant MUST use a completely different psychological angle (e.g. urgency, social proof, curiosity, pain-point, aspiration, exclusivity, FOMO, authority)
- Headlines: punchy, scroll-stopping, under 40 chars for social, under 30 chars for Google
- Primary text: conversational, benefit-focused, ends with soft CTA
${platform === 'google' ? '- Include a "description" field (90 chars max) for the Google ad description line' : ''}
- CTAs: use strong verbs (Shop Now, Get Started, Learn More, Claim Offer, etc.)

Return ONLY this JSON array, nothing else:
[
  {
    "headline": "...",
    "primaryText": "...",${platform === 'google' ? '\n    "description": "...",' : ''}
    "cta": "...",
    "angle": "2-3 word angle label"
  },
  { ... },
  { ... }
]`

    try {
      const res  = await fetch('/api/ai/generate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: token } : {}) },
        body:    JSON.stringify({ systemPrompt, userPrompt, maxTokens: 1400 }),
      })
      const json = await res.json()

      if (!res.ok) {
        setError(res.status === 402
          ? (locale === 'ar' ? 'رصيدك غير كافٍ — يرجى الترقية.' : 'Not enough AI credits. Please upgrade.')
          : (json.error || 'Generation failed.'))
        return
      }

      const raw   = (json.content || json.result || '').trim()
      const match = raw.match(/\[[\s\S]*\]/)
      if (!match) { setError('Unexpected AI response. Try again.'); return }

      const variants: AdVariant[] = JSON.parse(match[0])

      setResults(prev => [{
        id: Date.now().toString(),
        platform, objective, offer, variants,
        createdAt: new Date(),
      }, ...prev].slice(0, 10))

      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setGenerating(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--color-bg)' }}>
        <Loader2 className="animate-spin" size={28} style={{ color: '#F97316' }} />
      </div>
    )
  }

  const current = results[0] ?? null
  const availableFormats = FORMATS_BY_PLATFORM[platform]

  return (
    <AppShell>
      <div className="relative min-h-screen" style={{ background: 'var(--color-bg)' }}>
        <StarField />
        <VexOrbs />

        <div className="relative z-10 max-w-5xl mx-auto px-6 py-10">

          {/* ── Header ── */}
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, rgba(249,115,22,0.25), rgba(249,115,22,0.1))', border: '1px solid rgba(249,115,22,0.3)' }}>
                <Zap size={20} style={{ color: '#F97316' }} />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-text-primary">
                  VEX <span style={{ color: '#F97316' }}>Ad Copy Lab</span>
                </h1>
                <p className="text-sm text-text-muted">
                  {locale === 'ar'
                    ? 'اكتب إعلانات مدفوعة عالية التحويل في ثوانٍ'
                    : 'High-converting paid ad copy — launch-ready in seconds'}
                </p>
              </div>
            </div>
            {brandProfile?.brandName && (
              <div className="flex items-center gap-2 mt-2 text-xs text-text-muted">
                <Brain size={11} style={{ color: '#F97316' }} />
                <span>
                  {locale === 'ar'
                    ? `Brand Brain نشط — يكتب VEX بأسلوب ${brandProfile.brandName}`
                    : `Brand Brain active — VEX writes in ${brandProfile.brandName}'s voice`}
                </span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

            {/* ── Left: controls ── */}
            <div className="lg:col-span-2 space-y-5">

              {/* Platform picker */}
              <div className="rounded-xl p-5 border" style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.08)' }}>
                <p className="text-xs font-semibold text-text-muted mb-3 uppercase tracking-wider">
                  {locale === 'ar' ? 'المنصة' : 'Platform'}
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {PLATFORMS.map(p => (
                    <button key={p.id} onClick={() => setPlatform(p.id)}
                      className="flex flex-col items-center gap-1.5 p-2.5 rounded-lg border text-xs font-medium transition-all"
                      style={{
                        background:   platform === p.id ? `${p.color}18` : 'transparent',
                        borderColor:  platform === p.id ? `${p.color}50` : 'rgba(255,255,255,0.07)',
                        color:        platform === p.id ? p.color : '#6b7280',
                      }}>
                      <span className="text-base">{p.icon}</span>
                      <span>{p.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Objective */}
              <div className="rounded-xl p-5 border" style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.08)' }}>
                <p className="text-xs font-semibold text-text-muted mb-3 uppercase tracking-wider">
                  {locale === 'ar' ? 'الهدف' : 'Objective'}
                </p>
                <div className="space-y-1.5">
                  {OBJECTIVES.map(obj => (
                    <button key={obj.id} onClick={() => setObjective(obj.id)}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg border text-sm transition-all text-left"
                      style={{
                        background:  objective === obj.id ? 'rgba(249,115,22,0.1)' : 'transparent',
                        borderColor: objective === obj.id ? 'rgba(249,115,22,0.35)' : 'rgba(255,255,255,0.06)',
                        color:       objective === obj.id ? '#F97316' : '#9ca3af',
                      }}>
                      <span>{obj.icon}</span>
                      <span className="font-medium">{locale === 'ar' ? obj.arLabel : obj.enLabel}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Format */}
              <div className="rounded-xl p-5 border" style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.08)' }}>
                <p className="text-xs font-semibold text-text-muted mb-3 uppercase tracking-wider">
                  {locale === 'ar' ? 'نوع الإعلان' : 'Ad Format'}
                </p>
                <div className="flex flex-wrap gap-2">
                  {availableFormats.map(f => (
                    <button key={f} onClick={() => setFormat(f)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-all"
                      style={{
                        background:  format === f ? 'rgba(249,115,22,0.1)' : 'transparent',
                        borderColor: format === f ? 'rgba(249,115,22,0.35)' : 'rgba(255,255,255,0.08)',
                        color:       format === f ? '#F97316' : '#6b7280',
                      }}>
                      {FORMAT_LABELS[f]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Offer */}
              <div className="rounded-xl p-5 border" style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.08)' }}>
                <label className="text-xs font-semibold text-text-muted mb-2 uppercase tracking-wider block">
                  {locale === 'ar' ? 'اوصف عرضك أو منتجك' : 'Your offer / product'}
                </label>
                <textarea
                  value={offer}
                  onChange={e => setOffer(e.target.value)}
                  rows={4}
                  placeholder={locale === 'ar'
                    ? 'مثال: كريم مكافحة شيخوخة بخلاصة الرمان، فعّال خلال 14 يوماً، سعر 199 جنيه بدلاً من 350...'
                    : 'e.g. Anti-aging serum with retinol, clinically proven in 14 days, launch price $49 (was $89)...'}
                  className="w-full text-sm rounded-lg px-3 py-2.5 resize-none outline-none transition-colors"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--color-text-primary)' }}
                />
              </div>

              {/* Error */}
              {error && (
                <div className="text-sm px-4 py-3 rounded-lg"
                  style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
                  {error}
                </div>
              )}

              {/* Generate button */}
              <button onClick={generate} disabled={generating || !offer.trim()}
                className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl font-semibold text-sm transition-all disabled:opacity-50"
                style={{
                  background:  generating ? 'rgba(249,115,22,0.2)' : 'linear-gradient(135deg, #F97316, #EA580C)',
                  color:       '#fff',
                  boxShadow:   generating ? 'none' : '0 0 24px rgba(249,115,22,0.35)',
                }}>
                {generating
                  ? <><Loader2 size={16} className="animate-spin" /> {locale === 'ar' ? 'VEX يكتب...' : 'VEX is writing...'}</>
                  : <><Zap size={16} /> {locale === 'ar' ? 'اكتب الإعلانات' : 'Generate Ad Copy'}</>
                }
              </button>
            </div>

            {/* ── Right: results ── */}
            <div className="lg:col-span-3" ref={resultsRef}>

              {/* Empty state */}
              {!current && !generating && (
                <div className="min-h-[420px] flex flex-col items-center justify-center text-center rounded-xl border"
                  style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.07)', borderStyle: 'dashed' }}>
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                    style={{ background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.2)' }}>
                    <Zap size={28} style={{ color: '#F97316' }} />
                  </div>
                  <h3 className="text-base font-semibold text-text-primary mb-2">
                    {locale === 'ar' ? 'VEX جاهز لكتابة إعلانك' : 'VEX is ready to write your ad'}
                  </h3>
                  <p className="text-sm text-text-muted max-w-xs">
                    {locale === 'ar'
                      ? 'اختر المنصة والهدف، اكتب عرضك، واحصل على 3 نسخ جاهزة للنشر'
                      : 'Choose platform & objective, describe your offer, get 3 launch-ready variants'}
                  </p>
                </div>
              )}

              {/* Loading */}
              {generating && (
                <div className="min-h-[420px] flex flex-col items-center justify-center rounded-xl border"
                  style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(249,115,22,0.15)' }}>
                  <div className="relative w-16 h-16 mb-4">
                    <div className="absolute inset-0 rounded-full animate-ping opacity-20" style={{ background: '#F97316' }} />
                    <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center"
                      style={{ background: 'rgba(249,115,22,0.15)', border: '1px solid rgba(249,115,22,0.3)' }}>
                      <Sparkles size={28} style={{ color: '#F97316' }} />
                    </div>
                  </div>
                  <p className="text-sm font-medium text-text-primary">
                    {locale === 'ar' ? 'VEX يكتب نسخاً عالية التحويل...' : 'VEX crafting high-converting copy...'}
                  </p>
                  <p className="text-xs text-text-muted mt-1">
                    {locale === 'ar' ? '3 نسخ · زوايا مختلفة · جاهزة للإطلاق' : '3 variants · 3 different angles · ready to launch'}
                  </p>
                </div>
              )}

              {/* Results */}
              {current && !generating && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ background: '#F97316' }} />
                      <span className="text-sm font-semibold text-text-primary">
                        {locale === 'ar' ? '٣ نسخ جاهزة' : '3 Variants Ready'}
                      </span>
                      <span className="text-xs text-text-muted">
                        {PLATFORMS.find(p => p.id === current.platform)?.label} · {FORMAT_LABELS[format]}
                      </span>
                    </div>
                    <button onClick={generate}
                      className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-secondary transition-colors">
                      <RefreshCw size={12} />
                      {locale === 'ar' ? 'إعادة توليد' : 'Regenerate'}
                    </button>
                  </div>

                  {/* Offer echo */}
                  <div className="px-4 py-2.5 rounded-lg text-xs border"
                    style={{ background: 'rgba(249,115,22,0.05)', borderColor: 'rgba(249,115,22,0.15)', color: '#9ca3af' }}>
                    <span style={{ color: '#F97316' }}>{locale === 'ar' ? 'العرض:' : 'Offer:'}</span>{' '}
                    {current.offer}
                  </div>

                  {current.variants.map((v, i) => (
                    <VariantCard key={i} variant={v} index={i} />
                  ))}

                  {results.length > 1 && (
                    <p className="text-xs text-text-muted text-center pt-1">
                      {results.length - 1} {locale === 'ar' ? 'نتيجة سابقة هذه الجلسة' : 'previous result(s) this session'}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
