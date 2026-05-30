'use client'

import AppShell from '@/components/AppShell'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n-context'
import {
  Loader2, Megaphone, Wand2, Sparkles, Target, TrendingUp, Copy,
  Check, ChevronDown, DollarSign, Eye, MousePointer, Heart
} from 'lucide-react'
import StarField from '@/components/ui/StarField'
import { useBrandBrain } from '@/hooks/useBrandBrain'

/* ═══════════════════════════════════════════════════════════════
   VEX — Ads & Campaign Management Center
   ═══════════════════════════════════════════════════════════════ */

type AdType = 'awareness' | 'conversion' | 'engagement' | 'leads' | 'traffic'
type AdPlatform = 'meta' | 'google' | 'tiktok' | 'linkedin' | 'snapchat' | 'twitter'
type AdFormat = 'single_image' | 'carousel' | 'video' | 'story' | 'reel' | 'search'
type OutputTab = 'copy' | 'audience' | 'budget' | 'strategy'

interface AdResult {
  id: string
  type: AdType
  platform: AdPlatform
  prompt: string
  output: string
  tab: OutputTab
  createdAt: Date
}

function VexOrbs() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
      <div className="absolute rounded-full blur-[160px] opacity-15"
        style={{ width: 800, height: 800, background: 'radial-gradient(circle, rgba(6,182,212,0.15), transparent 70%)', top: '-20%', right: '-20%', animation: 'float 16s ease-in-out infinite' }} />
      <div className="absolute rounded-full blur-[100px] opacity-12"
        style={{ width: 500, height: 500, background: 'radial-gradient(circle, rgba(255,107,53,0.12), transparent 70%)', bottom: '10%', left: '-10%', animation: 'float 12s ease-in-out infinite reverse' }} />
    </div>
  )
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const { locale } = useI18n()
  const handle = () => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000) }
  return (
    <button onClick={handle}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
      style={{ background: copied ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.05)', color: copied ? '#10b981' : '#9ca3af', border: `1px solid ${copied ? '#10b98130' : 'rgba(255,255,255,0.08)'}` }}>
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? (locale === 'ar' ? 'تم النسخ' : 'Copied!') : (locale === 'ar' ? 'نسخ' : 'Copy')}
    </button>
  )
}

function VexSelect<T extends string>({ label, value, options, onChange }: {
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
          style={{ background: 'rgba(17,21,54,0.4)', border: '1px solid rgba(108,99,255,0.12)', color: '#f8fafc', outline: 'none' }}>
          {options.map(o => <option key={o.value} value={o.value} style={{ background: '#111536' }}>{locale === 'ar' ? o.label : (o.labelEn || o.label)}</option>)}
        </select>
        <ChevronDown size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
      </div>
    </div>
  )
}

function StatCard({ icon: Icon, color, value, label }: { icon: React.ElementType; color: string; value: string; label: string }) {
  return (
    <div className="rounded-xl p-4 flex items-center gap-3"
      style={{ background: 'rgba(17,21,54,0.5)', border: '1px solid rgba(108,99,255,0.1)' }}>
      <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: `${color}18`, border: `1px solid ${color}25` }}>
        <Icon size={16} style={{ color }} />
      </div>
      <div>
        <p className="text-white text-base font-bold">{value}</p>
        <p className="text-gray-500 text-xs">{label}</p>
      </div>
    </div>
  )
}

export default function VexPage() {
  const { isAuthenticated, loading: authLoading } = useAuth()
  const { locale, dir } = useI18n()
  const router = useRouter()

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/auth/login')
  }, [authLoading, isAuthenticated, router])

  const { brandContext, brand } = useBrandBrain()
  const [outputTab, setOutputTab] = useState<OutputTab>('copy')
  const [adType, setAdType] = useState<AdType>('conversion')
  const [adPlatform, setAdPlatform] = useState<AdPlatform>('meta')
  const [adFormat, setAdFormat] = useState<AdFormat>('single_image')
  const [budget, setBudget] = useState('500')
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState('')
  const [history, setHistory] = useState<AdResult[]>([])

  if (authLoading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0A0E27' }}>
      <Loader2 className="animate-spin" size={32} style={{ color: '#06b6d4' }} />
    </div>
  )
  if (!isAuthenticated) return null

  const outputTabs: { id: OutputTab; label: string; labelEn: string; icon: React.ElementType }[] = [
    { id: 'copy',     label: 'نص الإعلان',    labelEn: 'Ad Copy',    icon: Megaphone },
    { id: 'audience', label: 'الجمهور',        labelEn: 'Audience',   icon: Target },
    { id: 'budget',   label: 'الميزانية',      labelEn: 'Budget',     icon: DollarSign },
    { id: 'strategy', label: 'الاستراتيجية',  labelEn: 'Strategy',   icon: TrendingUp },
  ]

  const systemPrompts: Record<OutputTab, string> = {
    copy:     `${brandContext}أنت VEX، خبير في كتابة نصوص الإعلانات عالية التحويل على ${adPlatform}. الهدف: ${adType}. الصيغة: ${adFormat}. اكتب: العنوان الرئيسي + النص التشويقي + الـ CTA + 3 إعلانات للاختبار A/B. اجعل كل نص مخصصاً تماماً للعلامة التجارية أعلاه.`,
    audience: `${brandContext}أنت VEX، خبير في استهداف الجماهير الإعلانية على ${adPlatform}. الهدف: ${adType}. الميزانية: ${budget}$. حدد الجمهور المناسب تماماً للعلامة التجارية أعلاه: الجمهور الأساسي + الاهتمامات + الديموغرافيا + الجماهير المشابهة.`,
    budget:   `${brandContext}أنت VEX، خبير في إدارة ميزانيات الإعلانات. المنصة: ${adPlatform}. الهدف: ${adType}. الميزانية: ${budget}$/شهر. قسّم الميزانية بشكل مثالي يناسب طبيعة العلامة التجارية أعلاه مع توقعات KPIs واقعية.`,
    strategy: `${brandContext}أنت VEX، استراتيجي إعلانات رقمية. المنصة: ${adPlatform}. الهدف: ${adType}. الميزانية: ${budget}$. صمّم استراتيجية حملة 30 يوم كاملة ومخصصة تماماً للعلامة التجارية أعلاه.`,
  }

  async function generate() {
    if (!prompt.trim() || loading) return
    setLoading(true)
    setResult('')
    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ systemPrompt: systemPrompts[outputTab], userPrompt: prompt, maxTokens: 1200, language: locale }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      const output = data.content || data.result || ''
      setResult(output)
      setHistory(prev => [{ id: crypto.randomUUID(), type: adType, platform: adPlatform, prompt, output, tab: outputTab, createdAt: new Date() }, ...prev.slice(0, 9)])
    } catch {
      setResult('⚠️ فشل الاتصال بـ VEX. حاول مجدداً.')
    } finally {
      setLoading(false)
    }
  }

  const glassCard = { background: 'rgba(17,21,54,0.5)', border: '1px solid rgba(108,99,255,0.1)', backdropFilter: 'blur(20px)' }
  const cyanColor = '#06b6d4'

  return (
    <AppShell>
      <div className="min-h-screen relative" style={{ background: '#0A0E27' }} dir={dir}>
        <StarField />
        <VexOrbs />

        <div className="relative z-10 max-w-7xl mx-auto px-4 py-8 space-y-8">

          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, rgba(6,182,212,0.25), rgba(6,182,212,0.08))', border: '1px solid rgba(6,182,212,0.3)', boxShadow: '0 0 30px rgba(6,182,212,0.15)' }}>
                  <Megaphone size={26} style={{ color: cyanColor }} />
                </div>
                <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full animate-pulse"
                  style={{ background: cyanColor, boxShadow: `0 0 8px ${cyanColor}` }} />
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold text-white">VEX</h1>
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium"
                    style={{ background: 'rgba(6,182,212,0.15)', color: cyanColor, border: `1px solid rgba(6,182,212,0.3)` }}>
                    Ads Engine
                  </span>
                </div>
                <p className="text-gray-400 text-sm mt-0.5">{locale === 'ar' ? 'محرك الإعلانات الذكي' : 'Intelligent Ads Engine'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs"
              style={{ background: 'rgba(6,182,212,0.1)', border: `1px solid rgba(6,182,212,0.2)`, color: cyanColor }}>
              <Sparkles size={12} />
              <span>{locale === 'ar' ? 'GPT-4o · نشط' : 'GPT-4o · Active'}</span>
            </div>
            {brand?.brandName ? (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs"
                style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', color: '#10b981' }}>
                <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                <span>Brain: {brand.brandName}</span>
              </div>
            ) : (
              <a href="/brand" className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs"
                style={{ background: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.2)', color: '#06b6d4' }}>
                {locale === 'ar' ? '⚡ فعّل Brand Brain' : '⚡ Activate Brand Brain'}
              </a>
            )}
          </div>

          {/* Mini stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard icon={Eye}          color="#06b6d4" value="—" label={locale === 'ar' ? 'مشاهدات' : 'Impressions'} />
            <StatCard icon={MousePointer} color="#6C63FF" value="—" label={locale === 'ar' ? 'نقرات' : 'Clicks'} />
            <StatCard icon={Heart}        color="#8b5cf6" value="—" label={locale === 'ar' ? 'تفاعلات' : 'Engagements'} />
            <StatCard icon={DollarSign}   color="#10b981" value="—" label={locale === 'ar' ? 'تحويلات' : 'Conversions'} />
          </div>

          {/* Output tabs */}
          <div className="flex flex-wrap gap-2">
            {outputTabs.map(t => (
              <button key={t.id} onClick={() => { setOutputTab(t.id); setResult('') }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
                style={{
                  background: outputTab === t.id ? 'linear-gradient(135deg, rgba(6,182,212,0.2), rgba(6,182,212,0.08))' : 'rgba(255,255,255,0.04)',
                  color: outputTab === t.id ? cyanColor : '#9ca3af',
                  border: `1px solid ${outputTab === t.id ? 'rgba(6,182,212,0.3)' : 'rgba(255,255,255,0.07)'}`,
                }}>
                <t.icon size={15} />
                <span>{locale === 'ar' ? t.label : t.labelEn}</span>
              </button>
            ))}
          </div>

          {/* Main grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Config */}
            <div className="lg:col-span-1 space-y-4">
              <div className="rounded-2xl p-5 space-y-4" style={glassCard}>
                <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                  <Target size={14} style={{ color: cyanColor }} />
                  {locale === 'ar' ? 'إعدادات الحملة' : 'Campaign Settings'}
                </h3>
                <VexSelect<AdPlatform> label={locale === 'ar' ? 'المنصة' : 'Platform'} value={adPlatform} onChange={setAdPlatform}
                  options={[
                    { value: 'meta',     label: 'Meta (فيسبوك + إنستجرام)', labelEn: 'Meta (Facebook + Instagram)' },
                    { value: 'google',   label: 'Google Ads',               labelEn: 'Google Ads' },
                    { value: 'tiktok',   label: 'TikTok Ads',               labelEn: 'TikTok Ads' },
                    { value: 'linkedin', label: 'LinkedIn Ads',             labelEn: 'LinkedIn Ads' },
                    { value: 'snapchat', label: 'Snapchat Ads',             labelEn: 'Snapchat Ads' },
                    { value: 'twitter',  label: 'X / Twitter Ads',          labelEn: 'X / Twitter Ads' },
                  ]} />
                <VexSelect<AdType> label={locale === 'ar' ? 'هدف الحملة' : 'Objective'} value={adType} onChange={setAdType}
                  options={[
                    { value: 'conversion', label: 'تحويل',           labelEn: 'Conversion' },
                    { value: 'awareness',  label: 'وعي بالعلامة',    labelEn: 'Awareness' },
                    { value: 'engagement', label: 'تفاعل',           labelEn: 'Engagement' },
                    { value: 'leads',      label: 'عملاء محتملون',   labelEn: 'Leads' },
                    { value: 'traffic',    label: 'زيارات',          labelEn: 'Traffic' },
                  ]} />
                <VexSelect<AdFormat> label={locale === 'ar' ? 'صيغة الإعلان' : 'Format'} value={adFormat} onChange={setAdFormat}
                  options={[
                    { value: 'single_image', label: 'صورة',    labelEn: 'Single Image' },
                    { value: 'carousel',     label: 'كاروسيل', labelEn: 'Carousel' },
                    { value: 'video',        label: 'فيديو',   labelEn: 'Video' },
                    { value: 'story',        label: 'ستوري',   labelEn: 'Story' },
                    { value: 'reel',         label: 'ريلز',    labelEn: 'Reel' },
                    { value: 'search',       label: 'بحث',     labelEn: 'Search' },
                  ]} />
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-gray-500">{locale === 'ar' ? 'الميزانية الشهرية ($)' : 'Monthly Budget ($)'}</label>
                  <input type="number" value={budget} onChange={e => setBudget(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl text-sm"
                    style={{ background: 'rgba(17,21,54,0.4)', border: '1px solid rgba(108,99,255,0.12)', color: '#f8fafc', outline: 'none' }} />
                </div>
              </div>

              <div className="rounded-2xl p-4" style={glassCard}>
                <h3 className="text-xs font-semibold text-gray-500 mb-3">{locale === 'ar' ? 'أفكار سريعة' : 'Quick Ideas'}</h3>
                <div className="space-y-2">
                  {(locale === 'ar' ? [
                    'متجر ملابس أونلاين - تصفية نهاية الموسم',
                    'تطبيق توصيل طعام - أول طلب مجاني',
                    'عيادة تجميل - حجز استشارة مجانية',
                    'دورة تدريبية في التسويق الرقمي',
                  ] : [
                    'Online clothing store - end-of-season sale',
                    'Food delivery app - first order free',
                    'Beauty clinic - free consultation booking',
                    'Digital marketing training course',
                  ]).map((idea, i) => (
                    <button key={i} onClick={() => setPrompt(idea)}
                      className={`w-full text-xs px-3 py-2 rounded-lg transition-all hover:text-cyan-400 ${locale === 'ar' ? 'text-right' : 'text-left'}`}
                      style={{ background: 'rgba(17,21,54,0.5)', border: '1px solid rgba(108,99,255,0.08)', color: '#94a3b8' }}>
                      {idea}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Prompt + Output */}
            <div className="lg:col-span-2 space-y-4">
              <div className="rounded-2xl p-5 space-y-4" style={glassCard}>
                <textarea
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) generate() }}
                  placeholder={locale === 'ar' ? 'صف منتجك أو خدمتك ورسالتك التسويقية الرئيسية...' : 'Describe your product or service and your main marketing message...'}
                  rows={5}
                  className="w-full resize-none text-sm rounded-xl p-4 focus:outline-none"
                  style={{ background: 'rgba(17,21,54,0.5)', border: '1px solid rgba(108,99,255,0.12)', color: '#f8fafc' }} />
                <div className="flex justify-end">
                  <button onClick={generate} disabled={!prompt.trim() || loading}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all"
                    style={{
                      background: prompt.trim() && !loading ? `linear-gradient(135deg, ${cyanColor}, #0891b2)` : 'rgba(255,255,255,0.05)',
                      color: prompt.trim() && !loading ? '#0a0a0a' : '#4b5563',
                      boxShadow: prompt.trim() && !loading ? `0 0 30px rgba(6,182,212,0.3)` : 'none',
                    }}>
                    {loading ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
                    {loading ? (locale === 'ar' ? 'جاري التوليد...' : 'Generating...') : (locale === 'ar' ? 'ولّد الآن' : 'Generate')}
                  </button>
                </div>
              </div>

              {(result || loading) && (
                <div className="rounded-2xl p-5 space-y-4" style={{ ...glassCard, border: `1px solid rgba(6,182,212,0.2)`, boxShadow: 'rgba(6,182,212,0.05) 0 0 40px' }}>
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: cyanColor }}>
                      <Sparkles size={14} />{locale === 'ar' ? 'النتيجة' : 'Output'}
                    </h3>
                    {result && !loading && <CopyBtn text={result} />}
                  </div>
                  {loading ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-4">
                      <div className="w-16 h-16 rounded-full border-2 animate-spin" style={{ borderColor: 'rgba(6,182,212,0.3)', borderTopColor: cyanColor }} />
                      <p className="text-sm text-gray-400 animate-pulse">{locale === 'ar' ? 'VEX يحلل ويولد...' : 'VEX is analyzing and generating...'}</p>
                    </div>
                  ) : (
                    <pre className="text-sm leading-relaxed whitespace-pre-wrap font-sans"
                      style={{ color: '#d1d5db', maxHeight: '500px', overflowY: 'auto' }}>
                      {result}
                    </pre>
                  )}
                </div>
              )}

              {!result && !loading && (
                <div className="rounded-2xl p-10 flex flex-col items-center gap-4" style={glassCard}>
                  <div className="w-20 h-20 rounded-full flex items-center justify-center"
                    style={{ background: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.15)' }}>
                    <Megaphone size={32} style={{ color: 'rgba(6,182,212,0.4)' }} />
                  </div>
                  <div className="text-center">
                    <p className="text-gray-400 text-sm">{locale === 'ar' ? 'اختر المنصة والهدف والصيغة' : 'Choose platform, objective and format'}</p>
                    <p className="text-gray-600 text-xs mt-1">{locale === 'ar' ? 'واكتب عن منتجك ليبدأ VEX في بناء حملتك' : 'then describe your product and let VEX build your campaign'}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* History */}
          {history.length > 0 && (
            <div className="rounded-2xl p-5" style={glassCard}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-300">{locale === 'ar' ? 'سجل التوليد' : 'History'}</h3>
                <button onClick={() => setHistory([])} className="text-xs text-gray-600 hover:text-red-400 transition-colors">{locale === 'ar' ? 'مسح الكل' : 'Clear all'}</button>
              </div>
              <div className="space-y-2">
                {history.map(h => (
                  <div key={h.id} onClick={() => { setResult(h.output); setOutputTab(h.tab) }}
                    className="flex items-center justify-between p-3 rounded-xl cursor-pointer hover:bg-white/[0.03] transition-all"
                    style={{ border: '1px solid rgba(108,99,255,0.08)' }}>
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0"
                        style={{ background: 'rgba(6,182,212,0.1)', color: cyanColor, border: `1px solid rgba(6,182,212,0.2)` }}>
                        {locale === 'ar' ? outputTabs.find(t => t.id === h.tab)?.label : outputTabs.find(t => t.id === h.tab)?.labelEn}
                      </span>
                      <span className="text-xs text-gray-500 truncate">{h.prompt}</span>
                    </div>
                    <span className="text-xs text-gray-700 flex-shrink-0">{h.platform}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Capabilities */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: Megaphone, color: '#06b6d4', label: 'نص الإعلان',      labelEn: 'AI Ad Copy',    desc: 'نصوص تحويل عالية الأداء',  descEn: 'High-converting ad copy' },
              { icon: Target,    color: '#6C63FF', label: 'استهداف الجمهور', labelEn: 'Audience',      desc: 'جمهور دقيق ومخصص',         descEn: 'Precise custom audience' },
              { icon: DollarSign,color: '#10b981', label: 'توزيع الميزانية', labelEn: 'Budget Split',  desc: 'تحسين توزيع الإنفاق الإعلاني', descEn: 'Optimize ad spend allocation' },
              { icon: TrendingUp,color: '#8b5cf6', label: 'استراتيجية كاملة',labelEn: 'Full Strategy', desc: 'خطة 30 يوم متكاملة',        descEn: 'Complete 30-day plan' },
            ].map((c, i) => (
              <div key={i} className="rounded-xl p-4" style={glassCard}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-3"
                  style={{ background: `${c.color}18`, border: `1px solid ${c.color}30` }}>
                  <c.icon size={16} style={{ color: c.color }} />
                </div>
                <p className="text-white text-sm font-medium">{locale === 'ar' ? c.label : c.labelEn}</p>
                <p className="text-gray-600 text-xs mt-1">{locale === 'ar' ? c.desc : c.descEn}</p>
              </div>
            ))}
          </div>

        </div>
      </div>
    </AppShell>
  )
}
