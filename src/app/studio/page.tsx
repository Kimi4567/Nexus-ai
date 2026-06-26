'use client'

import AppShell from '@/components/AppShell'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n-context'
import { useEffect } from 'react'
import {
  Wand2, Loader2, Film, Copy, Sparkles,
  Type, Zap, MessageSquare,
  ChevronDown, Check, Clock,
  Layers, Target
} from 'lucide-react'
import { useBrandBrain } from '@/hooks/useBrandBrain'

/* ═══════════════════════════════════════════════════════════════
   NEX Content Lab
   Script · Hooks · Captions · Storyboard — text drafting only
   ═══════════════════════════════════════════════════════════════ */

// ── Types ──────────────────────────────────────────────────────
type TabId = 'script' | 'hooks' | 'captions' | 'storyboard'
type Tone = 'excited' | 'professional' | 'humorous' | 'emotional' | 'urgent'
type Platform = 'instagram' | 'tiktok' | 'youtube' | 'linkedin' | 'snapchat' | 'twitter'
type Duration = '15s' | '30s' | '60s' | '90s' | '3min'

interface GenerationResult {
  id: string
  tab: TabId
  prompt: string
  output: string
  createdAt: Date
  platform: Platform
}

// ── Tabs static config (labelKey resolved at render time) ──────
const TABS: { id: TabId; labelKey: string; placeholderKey: string; icon: React.ElementType }[] = [
  { id: 'script',     labelKey: 'nex.tabScript',     placeholderKey: 'nex.scriptPlaceholder',     icon: Film },
  { id: 'hooks',      labelKey: 'nex.tabHooks',      placeholderKey: 'nex.hooksPlaceholder',      icon: Zap },
  { id: 'captions',   labelKey: 'nex.tabCaptions',   placeholderKey: 'nex.captionsPlaceholder',   icon: MessageSquare },
  { id: 'storyboard', labelKey: 'nex.tabStoryboard', placeholderKey: 'nex.storyboardPlaceholder', icon: Layers },
]

// ── Copy button ────────────────────────────────────────────────
function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const { t } = useI18n()
  const handle = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button onClick={handle}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
      style={{ background: copied ? '#ECFDF5' : '#F8FAFC', color: copied ? '#059669' : '#475569', border: `1px solid ${copied ? '#BBF7D0' : '#E2E8F0'}` }}>
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? t('common.copied') : t('common.copy')}
    </button>
  )
}

// ── Tab pill ───────────────────────────────────────────────────
function TabPill({ id, label, icon: Icon, active, onClick }: {
  id: TabId; label: string; icon: React.ElementType
  active: boolean; onClick: () => void
}) {
  return (
    <button onClick={onClick}
      className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
      style={{
        background: active ? '#E0F2FE' : '#FFFFFF',
        color: active ? '#0369A1' : '#64748B',
        border: `1px solid ${active ? 'rgba(14,165,233,0.28)' : 'rgba(15,23,42,0.08)'}`,
        boxShadow: active ? '0 8px 18px rgba(14,165,233,0.10)' : 'none',
      }}>
      <Icon size={15} />
      <span>{label}</span>
    </button>
  )
}

// ── Select ─────────────────────────────────────────────────────
function NexSelect<T extends string>({ label, value, options, onChange }: {
  label: string; value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs text-slate-500">{label}</label>
      <div className="relative">
        <select value={value} onChange={e => onChange(e.target.value as T)}
          className="w-full appearance-none px-3 py-2.5 rounded-xl text-sm pr-8"
          style={{ background: '#FFFFFF', border: '1px solid rgba(15,23,42,0.1)', color: '#0F172A', outline: 'none' }}>
          {options.map(o => (
            <option key={o.value} value={o.value} style={{ background: '#FFFFFF' }}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
      </div>
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────
export default function NexStudioPage() {
  const { isAuthenticated, loading: authLoading, authHeader } = useAuth()
  const { locale, dir, t } = useI18n()
  const router = useRouter()

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/auth/login')
  }, [authLoading, isAuthenticated, router])

  // ── State ────────────────────────────────────────────────────
  const { brandContext, brand } = useBrandBrain()
  const [activeTab, setActiveTab] = useState<TabId>('script')
  const [prompt, setPrompt] = useState('')
  const [platform, setPlatform] = useState<Platform>('instagram')
  const [tone, setTone] = useState<Tone>('excited')
  const [duration, setDuration] = useState<Duration>('30s')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string>('')
  const [history, setHistory] = useState<GenerationResult[]>([])
  const [charCount, setCharCount] = useState(0)
  const promptRef = useRef<HTMLTextAreaElement>(null)

  // ── Loading guard ────────────────────────────────────────────
  if (authLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#f5f5f7]">
      <Loader2 className="animate-spin text-blue-500" size={32} />
    </div>
  )
  if (!isAuthenticated) return null

  // ── Resolved tabs (labels + placeholders from i18n) ──────────
  const tabs = TABS.map(tab => ({
    ...tab,
    label: t(tab.labelKey) as string,
    placeholder: t(tab.placeholderKey) as string,
  }))

  const currentTab = tabs.find(tab => tab.id === activeTab)!

  // ── Generate ─────────────────────────────────────────────────
  async function generate() {
    if (!prompt.trim() || loading) return
    setLoading(true)
    setResult('')

    const toneLabel = locale === 'ar'
      ? (tone === 'excited' ? 'حماسية ومثيرة' : tone === 'professional' ? 'احترافية وواثقة' : tone === 'humorous' ? 'مرحة وممتعة' : tone === 'emotional' ? 'عاطفية ومؤثرة' : 'عاجلة ومقنعة')
      : (tone === 'excited' ? 'Energetic and exciting' : tone === 'professional' ? 'Professional and confident' : tone === 'humorous' ? 'Playful and fun' : tone === 'emotional' ? 'Emotional and touching' : 'Urgent and compelling')

    const systemPrompts: Record<TabId, string> = {
      script: `${brandContext}أنت NEX، خبير في كتابة سكريبتات الفيديو التسويقية. اكتب سكريبت فيديو احترافي وجذاب لمنصة ${platform} بمدة ${duration}. النبرة: ${toneLabel}. الصيغة: [المشهد X] → الإجراء → الحوار. اجعل كل مشهد واضحاً وقابلاً للتنفيذ. أضف تعليمات للكاميرا والإضاءة. اجعل المحتوى مخصصاً تماماً للعلامة التجارية أعلاه.`,
      hooks: `${brandContext}أنت NEX، خبير في صناعة هوكس الفيديوهات الفيروسية. اكتب 5 هوكس مختلفة وقوية لمنصة ${platform}. النبرة: ${toneLabel}. كل هوك بأسلوب مختلف: سؤال، إحصائية، تحدي، قصة، وعد. اجعلها قصيرة (أقل من 10 ثوانٍ) ومخصصة تماماً للعلامة التجارية أعلاه.`,
      captions: `${brandContext}أنت NEX، خبير في كتابة الكابشنز التسويقية لمنصة ${platform}. اكتب 3 كابشنز مختلفة: قصير (50 كلمة)، متوسط (100 كلمة)، طويل (200 كلمة). أضف هاشتاقات مناسبة وCTA قوي. النبرة: ${toneLabel}. اجعل المحتوى مخصصاً للعلامة التجارية أعلاه.`,
      storyboard: `${brandContext}أنت NEX، مخرج فيديو إبداعي. أنشئ ستوري بورد تفصيلياً لفيديو ${duration} على ${platform}. قسّم الفيديو إلى مشاهد واضحة مع: وصف المشهد، الحوار/الصوت، الإجراء البصري، مؤثرات الكاميرا، والمدة. النبرة: ${toneLabel}. اجعل كل مشهد معبّراً عن هوية العلامة التجارية أعلاه.`,
    }

    try {
      const token = authHeader()
      const response = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: token } : {}) },
        body: JSON.stringify({
          systemPrompt: systemPrompts[activeTab],
          userPrompt: prompt,
          maxTokens: 1200,
          language: locale,
        }),
      })

      if (!response.ok) throw new Error('generate_failed')
      const data = await response.json()
      const output = data.content || data.result || ''
      setResult(output)
      setHistory(prev => [{
        id: crypto.randomUUID(),
        tab: activeTab,
        prompt,
        output,
        createdAt: new Date(),
        platform,
      }, ...prev.slice(0, 9)])
    } catch {
      setResult(t('nex.errorGenerate') as string)
    } finally {
      setLoading(false)
    }
  }

  // ── UI ───────────────────────────────────────────────────────
  const glassCard = {
    background: '#FFFFFF',
    border: '1px solid rgba(15,23,42,0.08)',
    boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
  }

  return (
    <AppShell>
      <div className="min-h-screen bg-[#f5f5f7]" dir={dir}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">

          {/* ── Header ─────────────────────────────────────────── */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                  style={{ background: '#E0F2FE', border: '1px solid rgba(14,165,233,0.18)' }}>
                  <Film size={26} className="text-blue-600" />
                </div>
                <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-500" />
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-semibold text-slate-950">NEX Content Lab</h1>
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium"
                    style={{ background: '#E0F2FE', color: '#0369A1', border: '1px solid rgba(14,165,233,0.25)' }}>
                    Script & Copy Lab
                  </span>
                </div>
                <p className="text-slate-500 text-sm mt-0.5">{t('nex.subheading')}</p>
                <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">
                  {locale === 'ar'
                    ? 'ينشئ سكريبتات، هوكس، تعليقات، ولوحات قصة نصية باستخدام سياق Brand Brain عند توفره. لا يحرر التصاميم أو ينشر المحتوى.'
                    : 'Creates scripts, hooks, captions, and storyboard text using Brand Brain context when available. This is not a visual design editor and does not publish content.'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {brand?.brandName ? (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs"
                  style={{ background: '#ECFDF5', border: '1px solid #BBF7D0', color: '#047857' }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                  <span>Brand Brain context: {brand.brandName}</span>
                </div>
              ) : (
                <a href="/brand" className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-all hover:opacity-80"
                  style={{ background: '#E0F2FE', border: '1px solid rgba(14,165,233,0.25)', color: '#0369A1' }}>
                  <span>{t('nex.activateBrain')}</span>
                </a>
              )}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs"
                style={{ background: '#F8FAFC', border: '1px solid rgba(15,23,42,0.08)', color: '#475569' }}>
                <Sparkles size={12} />
                <span>{t('nex.gptActive')}</span>
              </div>
            </div>
          </div>

          {/* ── Tabs ───────────────────────────────────────────── */}
          <div className="flex flex-wrap gap-2">
            {tabs.map(tab => (
              <TabPill key={tab.id} id={tab.id} label={tab.label}
                icon={tab.icon} active={activeTab === tab.id} onClick={() => { setActiveTab(tab.id); setResult('') }} />
            ))}
          </div>

          {/* ── Main grid ──────────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Left: Config + Input */}
            <div className="lg:col-span-1 space-y-4">

              {/* Options card */}
              <div className="rounded-2xl p-5 space-y-4" style={glassCard}>
                <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                  <Target size={14} className="text-blue-600" />
                  {t('nex.generationSettings')}
                </h3>
                <NexSelect<Platform>
                  label={t('nex.platformLabel') as string}
                  value={platform}
                  onChange={setPlatform}
                  options={[
                    { value: 'instagram', label: 'Instagram' },
                    { value: 'tiktok',    label: 'TikTok' },
                    { value: 'youtube',   label: 'YouTube' },
                    { value: 'linkedin',  label: 'LinkedIn' },
                    { value: 'snapchat',  label: 'Snapchat' },
                    { value: 'twitter',   label: 'X / Twitter' },
                  ]}
                />
                <NexSelect<Tone>
                  label={t('nex.toneLabel') as string}
                  value={tone}
                  onChange={setTone}
                  options={[
                    { value: 'excited',      label: t('nex.toneExcited') as string },
                    { value: 'professional', label: t('nex.toneProfessional') as string },
                    { value: 'humorous',     label: t('nex.toneHumorous') as string },
                    { value: 'emotional',    label: t('nex.toneEmotional') as string },
                    { value: 'urgent',       label: t('nex.toneUrgent') as string },
                  ]}
                />
                {(activeTab === 'script' || activeTab === 'storyboard') && (
                  <NexSelect<Duration>
                    label={t('nex.durationLabel') as string}
                    value={duration}
                    onChange={setDuration}
                    options={[
                      { value: '15s',  label: t('nex.dur15s') as string },
                      { value: '30s',  label: t('nex.dur30s') as string },
                      { value: '60s',  label: t('nex.dur60s') as string },
                      { value: '90s',  label: t('nex.dur90s') as string },
                      { value: '3min', label: t('nex.dur3min') as string },
                    ]}
                  />
                )}
              </div>

              {/* Quick prompts */}
              <div className="rounded-2xl p-4" style={glassCard}>
                <h3 className="text-xs font-semibold text-slate-500 mb-3">{t('nex.quickPrompts')}</h3>
                <div className="space-y-2">
                  {(locale === 'ar' ? [
                    'إطلاق منتج جديد للعناية بالبشرة',
                    'خصم 50% لفترة محدودة',
                    'خدمة توصيل فوري للمطاعم',
                    'دورة تعليمية في التسويق الرقمي',
                  ] : [
                    'New skincare product launch',
                    '50% off limited-time sale',
                    'Instant restaurant delivery service',
                    'Digital marketing online course',
                  ]).map((idea, i) => (
                    <button key={i} onClick={() => setPrompt(idea)}
                      className={`w-full text-xs px-3 py-2 rounded-lg transition-all hover:text-blue-700 ${locale === 'ar' ? 'text-right' : 'text-left'}`}
                      style={{ background: '#F8FAFC', border: '1px solid rgba(15,23,42,0.08)', color: '#475569' }}>
                      {idea}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Right: Prompt + Output */}
            <div className="lg:col-span-2 space-y-4">

              {/* Prompt input */}
              <div className="rounded-2xl p-5 space-y-4" style={glassCard}>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                    <currentTab.icon size={14} className="text-blue-600" />
                    {currentTab.label}
                  </h3>
                  <span className="text-xs text-slate-400">{charCount} {t('nex.charsSuffix')}</span>
                </div>

                <textarea
                  ref={promptRef}
                  value={prompt}
                  onChange={e => { setPrompt(e.target.value); setCharCount(e.target.value.length) }}
                  onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) generate() }}
                  placeholder={currentTab.placeholder}
                  rows={5}
                  className="w-full resize-none text-sm rounded-xl p-4 focus:outline-none transition-all"
                  style={{
                    background: '#F8FAFC',
                    border: '1px solid rgba(15,23,42,0.1)',
                    color: '#0F172A',
                  }}
                />

                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">{t('nex.ctrlEnterHint')}</span>
                  <button
                    onClick={generate}
                    disabled={!prompt.trim() || loading}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all"
                    style={{
                      background: prompt.trim() && !loading
                        ? '#0071E3'
                        : '#E2E8F0',
                      color: prompt.trim() && !loading ? '#FFFFFF' : '#64748B',
                      cursor: prompt.trim() && !loading ? 'pointer' : 'not-allowed',
                      boxShadow: prompt.trim() && !loading ? '0 10px 24px rgba(0,113,227,0.18)' : 'none',
                    }}>
                    {loading ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
                    {loading ? t('nex.generating') : t('nex.generateNow')}
                  </button>
                </div>
              </div>

              {/* Output */}
              {(result || loading) && (
                <div className="rounded-2xl p-5 space-y-4" style={{
                  ...glassCard,
                  border: '1px solid rgba(14,165,233,0.18)',
                }}>
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: '#06b6d4' }}>
                      <Sparkles size={14} />
                      {t('nex.outputTitle')}
                    </h3>
                    {result && !loading && <CopyBtn text={result} />}
                  </div>

                  {loading ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-4">
                      <div className="relative">
                        <div className="w-16 h-16 rounded-full border-2 border-blue-200 border-t-blue-500 animate-spin" />
                        <Sparkles size={18} className="absolute inset-0 m-auto text-blue-500" />
                      </div>
                      <p className="text-sm text-slate-500 animate-pulse">{t('nex.crafting')}</p>
                    </div>
                  ) : (
                    <pre className="text-sm leading-relaxed whitespace-pre-wrap font-sans"
                      style={{ color: '#334155', maxHeight: '500px', overflowY: 'auto' }}>
                      {result}
                    </pre>
                  )}
                </div>
              )}

              {/* Empty state */}
              {!result && !loading && (
                <div className="rounded-2xl p-10 flex flex-col items-center justify-center gap-4" style={glassCard}>
                  <div className="w-20 h-20 rounded-full flex items-center justify-center"
                    style={{ background: '#E0F2FE', border: '1px solid rgba(14,165,233,0.18)' }}>
                    <Film size={32} className="text-blue-500/60" />
                  </div>
                  <div className="text-center">
                    <p className="text-slate-500 text-sm">{t('nex.emptyTitle')}</p>
                    <p className="text-slate-400 text-xs mt-1">{t('nex.emptySub')}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Generation History ─────────────────────────────── */}
          {history.length > 0 && (
            <div className="rounded-2xl p-5" style={glassCard}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                  <Clock size={14} className="text-slate-400" />
                  {t('nex.historyTitle')}
                </h3>
                <button onClick={() => setHistory([])} className="text-xs text-slate-400 hover:text-red-600 transition-colors">
                  {t('nex.clearAll')}
                </button>
              </div>
              <div className="space-y-2">
                {history.map(h => (
                  <div key={h.id}
                    className="flex items-center justify-between p-3 rounded-xl cursor-pointer hover:bg-slate-50 transition-all"
                    style={{ border: '1px solid rgba(15,23,42,0.08)' }}
                    onClick={() => { setResult(h.output); setActiveTab(h.tab) }}>
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0"
                        style={{ background: 'rgba(6,182,212,0.1)', color: '#06b6d4', border: '1px solid rgba(6,182,212,0.2)' }}>
                        {tabs.find(tab => tab.id === h.tab)?.label}
                      </span>
                      <span className="text-xs text-slate-500 truncate">{h.prompt}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs text-slate-400">{h.platform}</span>
                      <span className="text-xs text-slate-400">{h.createdAt.toLocaleTimeString(locale === 'ar' ? 'ar' : 'en', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Capabilities Banner ────────────────────────────── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {([
              { icon: Film,         color: '#06b6d4', labelKey: 'nex.capScriptsLabel',   descKey: 'nex.capScriptsDesc' },
              { icon: Zap,          color: '#06b6d4', labelKey: 'nex.capHooksLabel',     descKey: 'nex.capHooksDesc' },
              { icon: MessageSquare,color: '#8b5cf6', labelKey: 'nex.capCaptionsLabel',  descKey: 'nex.capCaptionsDesc' },
              { icon: Layers,       color: '#10b981', labelKey: 'nex.capStoryboardLabel',descKey: 'nex.capStoryboardDesc' },
            ] as { icon: React.ElementType; color: string; labelKey: string; descKey: string }[]).map((cap, i) => (
              <div key={i} className="rounded-xl p-4" style={glassCard}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-3"
                  style={{ background: `${cap.color}18`, border: `1px solid ${cap.color}30` }}>
                  <cap.icon size={16} style={{ color: cap.color }} />
                </div>
                <p className="text-slate-800 text-sm font-medium">{t(cap.labelKey)}</p>
                <p className="text-slate-400 text-xs mt-1">{t(cap.descKey)}</p>
              </div>
            ))}
          </div>

        </div>
      </div>
    </AppShell>
  )
}
