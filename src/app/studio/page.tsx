'use client'

import AppShell from '@/components/AppShell'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n-context'
import {
  Wand2, Loader2, Film, Copy, Sparkles, Clapperboard, Mic,
  Type, Star, Rocket, Zap, BookOpen, Hash, MessageSquare,
  ChevronDown, Check, RefreshCw, Download, Clock, Play,
  Layers, Target, TrendingUp, Volume2
} from 'lucide-react'
import StarField from '@/components/ui/StarField'
import { useBrandBrain } from '@/hooks/useBrandBrain'

/* ═══════════════════════════════════════════════════════════════
   NEX — Creative Content Lab
   Script · Hooks · Captions · Storyboard · Voice — All by AI
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

// ── Ambient background ─────────────────────────────────────────
function NexOrbs() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
      <div className="absolute rounded-full blur-[140px] opacity-20"
        style={{ width: 700, height: 700, background: 'radial-gradient(circle, rgba(245,158,11,0.15), transparent 70%)', top: '-10%', left: '-15%', animation: 'float 14s ease-in-out infinite' }} />
      <div className="absolute rounded-full blur-[100px] opacity-15"
        style={{ width: 500, height: 500, background: 'radial-gradient(circle, rgba(139,92,246,0.12), transparent 70%)', bottom: '5%', right: '-10%', animation: 'float 11s ease-in-out infinite reverse' }} />
      <div className="absolute rounded-full blur-[80px] opacity-10"
        style={{ width: 300, height: 300, background: 'radial-gradient(circle, rgba(6,182,212,0.1), transparent 70%)', top: '50%', left: '50%', animation: 'float 9s ease-in-out infinite' }} />
    </div>
  )
}

// ── Copy button ────────────────────────────────────────────────
function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const { locale } = useI18n()
  const handle = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button onClick={handle}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
      style={{ background: copied ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.05)', color: copied ? '#10b981' : '#9ca3af', border: `1px solid ${copied ? '#10b98130' : 'rgba(255,255,255,0.08)'}` }}>
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? (locale === 'ar' ? 'تم النسخ' : 'Copied!') : (locale === 'ar' ? 'نسخ' : 'Copy')}
    </button>
  )
}

// ── Tab pill ───────────────────────────────────────────────────
function TabPill({ id, label, labelEn, icon: Icon, active, onClick }: {
  id: TabId; label: string; labelEn: string; icon: React.ElementType
  active: boolean; onClick: () => void
}) {
  const { locale } = useI18n()
  return (
    <button onClick={onClick}
      className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
      style={{
        background: active ? 'linear-gradient(135deg, rgba(245,158,11,0.2), rgba(245,158,11,0.08))' : 'rgba(255,255,255,0.04)',
        color: active ? '#f59e0b' : '#9ca3af',
        border: `1px solid ${active ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.07)'}`,
        boxShadow: active ? '0 0 20px rgba(245,158,11,0.1)' : 'none',
      }}>
      <Icon size={15} />
      <span>{locale === 'ar' ? label : labelEn}</span>
    </button>
  )
}

// ── Select ─────────────────────────────────────────────────────
function NexSelect<T extends string>({ label, value, options, onChange }: {
  label: string; value: T
  options: { value: T; label: string; labelEn?: string }[]
  onChange: (v: T) => void
}) {
  const { locale } = useI18n()
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs text-gray-500">{label}</label>
      <div className="relative">
        <select value={value} onChange={e => onChange(e.target.value as T)}
          className="w-full appearance-none px-3 py-2.5 rounded-xl text-sm pr-8"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#e5e7eb', outline: 'none' }}>
          {options.map(o => (
            <option key={o.value} value={o.value} style={{ background: '#0d0d1a' }}>
              {locale === 'ar' ? o.label : (o.labelEn || o.label)}
            </option>
          ))}
        </select>
        <ChevronDown size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
      </div>
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────
export default function NexStudioPage() {
  const { isAuthenticated, loading: authLoading } = useAuth()
  const { locale, dir } = useI18n()
  const router = useRouter()

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/auth/login')
  }, [authLoading, isAuthenticated, router])

  // ── State ────────────────────────────────────────────────────
  const { brandContext, brand, completeness } = useBrandBrain()
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
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#030309' }}>
      <Loader2 className="animate-spin text-amber-500" size={32} />
    </div>
  )
  if (!isAuthenticated) return null

  // ── Tab config ───────────────────────────────────────────────
  const tabs: { id: TabId; label: string; labelEn: string; icon: React.ElementType; placeholder: string; placeholderEn: string }[] = [
    { id: 'script',    label: 'السكريبت',   labelEn: 'Script',    icon: Film,          placeholder: 'صف المنتج أو الفكرة التي تريد تحويلها لسكريبت فيديو احترافي...', placeholderEn: 'Describe the product or idea you want turned into a professional video script...' },
    { id: 'hooks',     label: 'الهوكس',     labelEn: 'Hooks',     icon: Zap,           placeholder: 'ما المنتج أو الرسالة التي تريد جذب الانتباه بها؟',               placeholderEn: 'What product or message do you want to capture attention with?' },
    { id: 'captions',  label: 'الكابشن',    labelEn: 'Captions',  icon: MessageSquare, placeholder: 'صف المنتج أو الحدث الذي تريد كتابة كابشن له...',                placeholderEn: 'Describe the product or event you want a caption written for...' },
    { id: 'storyboard',label: 'ستوري بورد', labelEn: 'Storyboard',icon: Layers,        placeholder: 'صف الفيديو المطلوب لإنشاء خطة المشاهد التفصيلية...',            placeholderEn: 'Describe the video needed to create a detailed scene plan...' },
  ]

  const currentTab = tabs.find(t => t.id === activeTab)!

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
      const response = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemPrompt: systemPrompts[activeTab],
          userPrompt: prompt,
          maxTokens: 1200,
          language: locale,
        }),
      })

      if (!response.ok) throw new Error(locale === 'ar' ? 'فشل الاتصال بالذكاء الاصطناعي' : 'Failed to connect to AI')
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
    } catch (err) {
      setResult('⚠️ حدث خطأ أثناء التوليد. تحقق من اتصالك وحاول مجدداً.')
    } finally {
      setLoading(false)
    }
  }

  // ── UI ───────────────────────────────────────────────────────
  const glassCard = {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)',
    backdropFilter: 'blur(20px)',
  }

  return (
    <AppShell>
      <div className="min-h-screen relative" style={{ background: '#030309' }} dir={dir}>
        <StarField />
        <NexOrbs />

        <div className="relative z-10 max-w-7xl mx-auto px-4 py-8 space-y-8">

          {/* ── Header ─────────────────────────────────────────── */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.25), rgba(245,158,11,0.08))', border: '1px solid rgba(245,158,11,0.3)', boxShadow: '0 0 30px rgba(245,158,11,0.15)' }}>
                  <Film size={26} className="text-amber-400" />
                </div>
                <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-amber-400 animate-pulse" style={{ boxShadow: '0 0 8px rgba(245,158,11,0.8)' }} />
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold text-white">NEX</h1>
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium"
                    style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)' }}>
                    Studio
                  </span>
                </div>
                <p className="text-gray-400 text-sm mt-0.5">{locale === 'ar' ? 'مختبر المحتوى الإبداعي' : 'Creative Content Lab'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {brand?.brandName ? (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs"
                  style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', color: '#10b981' }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                  <span>Brain: {brand.brandName}</span>
                </div>
              ) : (
                <a href="/brand" className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-all hover:opacity-80"
                  style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', color: '#f59e0b' }}>
                  <span>{locale === 'ar' ? '⚡ فعّل Brand Brain' : '⚡ Activate Brand Brain'}</span>
                </a>
              )}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs"
                style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', color: '#f59e0b' }}>
                <Sparkles size={12} />
                <span>{locale === 'ar' ? 'GPT-4o · نشط' : 'GPT-4o · Active'}</span>
              </div>
            </div>
          </div>

          {/* ── Tabs ───────────────────────────────────────────── */}
          <div className="flex flex-wrap gap-2">
            {tabs.map(t => (
              <TabPill key={t.id} id={t.id} label={t.label} labelEn={t.labelEn}
                icon={t.icon} active={activeTab === t.id} onClick={() => { setActiveTab(t.id); setResult('') }} />
            ))}
          </div>

          {/* ── Main grid ──────────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Left: Config + Input */}
            <div className="lg:col-span-1 space-y-4">

              {/* Options card */}
              <div className="rounded-2xl p-5 space-y-4" style={glassCard}>
                <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                  <Target size={14} className="text-amber-500" />
                  {locale === 'ar' ? 'إعدادات التوليد' : 'Generation Settings'}
                </h3>
                <NexSelect<Platform>
                  label={locale === 'ar' ? 'المنصة' : 'Platform'}
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
                  label={locale === 'ar' ? 'النبرة' : 'Tone'}
                  value={tone}
                  onChange={setTone}
                  options={[
                    { value: 'excited',      label: 'حماسية',    labelEn: 'Excited' },
                    { value: 'professional', label: 'احترافية',  labelEn: 'Professional' },
                    { value: 'humorous',     label: 'مرحة',      labelEn: 'Humorous' },
                    { value: 'emotional',    label: 'عاطفية',    labelEn: 'Emotional' },
                    { value: 'urgent',       label: 'عاجلة',     labelEn: 'Urgent' },
                  ]}
                />
                {(activeTab === 'script' || activeTab === 'storyboard') && (
                  <NexSelect<Duration>
                    label={locale === 'ar' ? 'المدة' : 'Duration'}
                    value={duration}
                    onChange={setDuration}
                    options={[
                      { value: '15s',  label: '15 ثانية',  labelEn: '15 seconds' },
                      { value: '30s',  label: '30 ثانية',  labelEn: '30 seconds' },
                      { value: '60s',  label: '60 ثانية',  labelEn: '60 seconds' },
                      { value: '90s',  label: '90 ثانية',  labelEn: '90 seconds' },
                      { value: '3min', label: '3 دقائق',   labelEn: '3 minutes' },
                    ]}
                  />
                )}
              </div>

              {/* Quick prompts */}
              <div className="rounded-2xl p-4" style={glassCard}>
                <h3 className="text-xs font-semibold text-gray-500 mb-3">{locale === 'ar' ? 'أفكار سريعة' : 'Quick Prompts'}</h3>
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
                      className={`w-full text-xs px-3 py-2 rounded-lg transition-all hover:text-amber-400 ${locale === 'ar' ? 'text-right' : 'text-left'}`}
                      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: '#9ca3af' }}>
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
                  <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                    <currentTab.icon size={14} className="text-amber-500" />
                    {locale === 'ar' ? currentTab.label : currentTab.labelEn}
                  </h3>
                  <span className="text-xs text-gray-600">{locale === 'ar' ? `${charCount} حرف` : `${charCount} chars`}</span>
                </div>

                <textarea
                  ref={promptRef}
                  value={prompt}
                  onChange={e => { setPrompt(e.target.value); setCharCount(e.target.value.length) }}
                  onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) generate() }}
                  placeholder={locale === 'ar' ? currentTab.placeholder : currentTab.placeholderEn}
                  rows={5}
                  className="w-full resize-none text-sm rounded-xl p-4 focus:outline-none transition-all"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: '#e5e7eb',
                  }}
                />

                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-600">{locale === 'ar' ? 'Ctrl+Enter للتوليد السريع' : 'Ctrl+Enter to generate'}</span>
                  <button
                    onClick={generate}
                    disabled={!prompt.trim() || loading}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all"
                    style={{
                      background: prompt.trim() && !loading
                        ? 'linear-gradient(135deg, #f59e0b, #d97706)'
                        : 'rgba(255,255,255,0.05)',
                      color: prompt.trim() && !loading ? '#0a0a0a' : '#4b5563',
                      cursor: prompt.trim() && !loading ? 'pointer' : 'not-allowed',
                      boxShadow: prompt.trim() && !loading ? '0 0 30px rgba(245,158,11,0.3)' : 'none',
                    }}>
                    {loading ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
                    {loading ? (locale === 'ar' ? 'جاري التوليد...' : 'Generating...') : (locale === 'ar' ? 'ولّد الآن' : 'Generate')}
                  </button>
                </div>
              </div>

              {/* Output */}
              {(result || loading) && (
                <div className="rounded-2xl p-5 space-y-4" style={{
                  ...glassCard,
                  border: '1px solid rgba(245,158,11,0.2)',
                  boxShadow: '0 0 40px rgba(245,158,11,0.05)',
                }}>
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: '#f59e0b' }}>
                      <Sparkles size={14} />
                      {locale === 'ar' ? 'النتيجة' : 'Output'}
                    </h3>
                    {result && !loading && <CopyBtn text={result} />}
                  </div>

                  {loading ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-4">
                      <div className="relative">
                        <div className="w-16 h-16 rounded-full border-2 border-amber-500/30 border-t-amber-500 animate-spin" />
                        <Sparkles size={18} className="absolute inset-0 m-auto text-amber-400" />
                      </div>
                      <p className="text-sm text-gray-400 animate-pulse">{locale === 'ar' ? 'NEX يبتكر المحتوى...' : 'NEX is crafting your content...'}</p>
                    </div>
                  ) : (
                    <pre className="text-sm leading-relaxed whitespace-pre-wrap font-sans"
                      style={{ color: '#d1d5db', maxHeight: '500px', overflowY: 'auto' }}>
                      {result}
                    </pre>
                  )}
                </div>
              )}

              {/* Empty state */}
              {!result && !loading && (
                <div className="rounded-2xl p-10 flex flex-col items-center justify-center gap-4" style={glassCard}>
                  <div className="w-20 h-20 rounded-full flex items-center justify-center"
                    style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.15)' }}>
                    <Film size={32} className="text-amber-500/50" />
                  </div>
                  <div className="text-center">
                    <p className="text-gray-400 text-sm">{locale === 'ar' ? 'اختر نوع المحتوى، حدد المنصة والنبرة' : 'Choose content type, platform and tone'}</p>
                    <p className="text-gray-600 text-xs mt-1">{locale === 'ar' ? 'واكتب فكرتك ليبدأ NEX في الابتكار' : 'then write your idea and let NEX create'}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Generation History ─────────────────────────────── */}
          {history.length > 0 && (
            <div className="rounded-2xl p-5" style={glassCard}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                  <Clock size={14} className="text-gray-500" />
                  {locale === 'ar' ? 'سجل التوليد' : 'History'}
                </h3>
                <button onClick={() => setHistory([])} className="text-xs text-gray-600 hover:text-red-400 transition-colors">
                  {locale === 'ar' ? 'مسح الكل' : 'Clear all'}
                </button>
              </div>
              <div className="space-y-2">
                {history.map(h => (
                  <div key={h.id}
                    className="flex items-center justify-between p-3 rounded-xl cursor-pointer hover:bg-white/[0.03] transition-all"
                    style={{ border: '1px solid rgba(255,255,255,0.05)' }}
                    onClick={() => { setResult(h.output); setActiveTab(h.tab) }}>
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0"
                        style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.2)' }}>
                        {locale === 'ar' ? tabs.find(t => t.id === h.tab)?.label : tabs.find(t => t.id === h.tab)?.labelEn}
                      </span>
                      <span className="text-xs text-gray-500 truncate">{h.prompt}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs text-gray-700">{h.platform}</span>
                      <span className="text-xs text-gray-700">{h.createdAt.toLocaleTimeString(locale === 'ar' ? 'ar' : 'en', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Capabilities Banner ────────────────────────────── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: Film,         color: '#f59e0b', label: 'سكريبتات',  labelEn: 'Scripts',    desc: 'سكريبت احترافي لكل مقطع',    descEn: 'Professional script per video' },
              { icon: Zap,          color: '#06b6d4', label: 'هوكس',      labelEn: 'Hooks',      desc: '5 هوكس جاذبة للانتباه',       descEn: '5 attention-grabbing hooks' },
              { icon: MessageSquare,color: '#8b5cf6', label: 'كابشنز',    labelEn: 'Captions',   desc: 'كابشن متكامل + هاشتاقات',     descEn: 'Full caption + hashtags' },
              { icon: Layers,       color: '#10b981', label: 'ستوري بورد',labelEn: 'Storyboard', desc: 'خطة مشاهد تفصيلية',           descEn: 'Detailed scene plan' },
            ].map((cap, i) => (
              <div key={i} className="rounded-xl p-4" style={glassCard}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-3"
                  style={{ background: `${cap.color}18`, border: `1px solid ${cap.color}30` }}>
                  <cap.icon size={16} style={{ color: cap.color }} />
                </div>
                <p className="text-white text-sm font-medium">{locale === 'ar' ? cap.label : cap.labelEn}</p>
                <p className="text-gray-600 text-xs mt-1">{locale === 'ar' ? cap.desc : cap.descEn}</p>
              </div>
            ))}
          </div>

        </div>
      </div>
    </AppShell>
  )
}
