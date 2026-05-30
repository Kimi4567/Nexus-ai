'use client'

import AppShell from '@/components/AppShell'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n-context'
import { useBrandBrain, getBrandCompleteness, type BrandProfile } from '@/hooks/useBrandBrain'
import {
  Loader2, Brain, Check, ChevronDown, Sparkles, Save,
  Target, Mic, Package, Users, Globe, BarChart2, AlertTriangle,
  CheckCircle2, ArrowLeft, ArrowRight, Zap
} from 'lucide-react'
import StarField from '@/components/ui/StarField'

/* ═══════════════════════════════════════════════════════════════
   BRAND BRAIN — عقل العلامة التجارية
   كل المعلومات هنا تُحقن تلقائياً في كل وكيل ذكاء اصطناعي
   ═══════════════════════════════════════════════════════════════ */

type StepId = 'identity' | 'product' | 'audience' | 'voice' | 'platforms' | 'competitors'

interface Step {
  id: StepId
  label: string
  labelEn: string
  icon: React.ElementType
  color: string
  desc: string
  descEn: string
}

const STEPS: Step[] = [
  { id: 'identity',    label: 'الهوية',       labelEn: 'Identity',    icon: Brain,    color: '#f59e0b', desc: 'من أنتم؟',       descEn: 'Who are you?' },
  { id: 'product',     label: 'المنتج',       labelEn: 'Product',     icon: Package,  color: '#06b6d4', desc: 'ماذا تقدمون؟',  descEn: 'What do you offer?' },
  { id: 'audience',    label: 'الجمهور',      labelEn: 'Audience',    icon: Users,    color: '#8b5cf6', desc: 'لمن تتحدثون؟', descEn: 'Who are you talking to?' },
  { id: 'voice',       label: 'الصوت',        labelEn: 'Voice',       icon: Mic,      color: '#10b981', desc: 'كيف تتحدثون؟', descEn: 'How do you communicate?' },
  { id: 'platforms',   label: 'المنصات',      labelEn: 'Platforms',   icon: Globe,    color: '#ec4899', desc: 'أين تتواجدون؟', descEn: 'Where are you active?' },
  { id: 'competitors', label: 'المنافسون',    labelEn: 'Competitors', icon: Target,   color: '#f97316', desc: 'من تنافسون؟',   descEn: 'Who are your competitors?' },
]

const INDUSTRIES_AR = [
  'تجارة إلكترونية', 'مطاعم وأغذية', 'موضة وأزياء', 'صحة وجمال',
  'تقنية وتطبيقات', 'عقارات', 'تعليم وتدريب', 'خدمات مهنية',
  'سياحة وسفر', 'رياضة ولياقة', 'ديكور وأثاث', 'سيارات', 'آخر',
]
const INDUSTRIES_EN = [
  'E-commerce', 'Restaurants & Food', 'Fashion & Apparel', 'Health & Beauty',
  'Tech & Apps', 'Real Estate', 'Education & Training', 'Professional Services',
  'Travel & Tourism', 'Sports & Fitness', 'Home & Furniture', 'Automotive', 'Other',
]

const PLATFORMS_LIST = ['Instagram', 'TikTok', 'Facebook', 'Snapchat', 'YouTube', 'LinkedIn', 'X / Twitter', 'Pinterest']
const TONE_OPTIONS_AR = ['حماسي', 'احترافي', 'مرح', 'عاطفي', 'جريء', 'هادئ', 'ملهم', 'مباشر', 'راقي', 'شبابي']
const TONE_OPTIONS_EN = ['Energetic', 'Professional', 'Playful', 'Emotional', 'Bold', 'Calm', 'Inspiring', 'Direct', 'Upscale', 'Youthful']
const PRICE_OPTIONS = [
  { v: 'budget',    l: 'اقتصادي',  lEn: 'Budget' },
  { v: 'mid-range', l: 'متوسط',    lEn: 'Mid-range' },
  { v: 'premium',   l: 'بريميوم',  lEn: 'Premium' },
  { v: 'luxury',    l: 'فاخر',     lEn: 'Luxury' },
]
const AGE_OPTIONS_AR = ['13-17', '18-24', '25-34', '35-44', '45-54', '55+', 'جميع الأعمار']
const AGE_OPTIONS_EN = ['13-17', '18-24', '25-34', '35-44', '45-54', '55+', 'All ages']

// ── Sub-components ─────────────────────────────────────────────

function TagInput({ label, placeholder, values, onChange, suggestions }: {
  label: string; placeholder: string; values: string[]; onChange: (v: string[]) => void; suggestions?: string[]
}) {
  const [input, setInput] = useState('')

  const add = (val: string) => {
    const v = val.trim()
    if (v && !values.includes(v)) onChange([...values, v])
    setInput('')
  }

  const remove = (i: number) => onChange(values.filter((_, idx) => idx !== i))

  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs text-gray-500">{label}</label>
      <div className="flex flex-wrap gap-1.5 p-3 rounded-xl min-h-[44px]"
        style={{ background: 'rgba(17,21,54,0.5)', border: '1px solid rgba(108,99,255,0.12)' }}>
        {values.map((v, i) => (
          <span key={i} className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
            style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', color: '#f59e0b' }}>
            {v}
            <button onClick={() => remove(i)} className="text-amber-500/60 hover:text-red-400 transition-colors ml-1">×</button>
          </span>
        ))}
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(input) } }}
          placeholder={values.length ? '' : placeholder}
          className="flex-1 min-w-[120px] bg-transparent text-sm outline-none text-gray-300 placeholder-gray-600"
        />
      </div>
      {suggestions && suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {suggestions.filter(s => !values.includes(s)).slice(0, 6).map(s => (
            <button key={s} onClick={() => add(s)}
              className="px-2.5 py-1 rounded-lg text-xs transition-all hover:text-amber-400"
              style={{ background: 'rgba(17,21,54,0.5)', border: '1px solid rgba(108,99,255,0.1)', color: '#64748b' }}>
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs text-gray-500">{label}</label>
      {children}
    </div>
  )
}

function Input({ value, onChange, placeholder, textarea }: {
  value: string; onChange: (v: string) => void; placeholder?: string; textarea?: boolean
}) {
  const cls = "w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none transition-all"
  const style = { background: 'rgba(17,21,54,0.5)', border: '1px solid rgba(108,99,255,0.12)', color: '#f8fafc' }
  if (textarea) return (
    <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      rows={3} className={`${cls} resize-none`} style={style} />
  )
  return <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
    className={cls} style={style} />
}

function ToggleGrid({ options, selected, onChange, color }: {
  options: string[]; selected: string[]; onChange: (v: string[]) => void; color?: string
}) {
  const c = color || '#f59e0b'
  const toggle = (v: string) => {
    selected.includes(v) ? onChange(selected.filter(x => x !== v)) : onChange([...selected, v])
  }
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(o => {
        const active = selected.includes(o)
        return (
          <button key={o} onClick={() => toggle(o)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{
              background: active ? `${c}18` : 'rgba(255,255,255,0.03)',
              border: `1px solid ${active ? c + '50' : 'rgba(255,255,255,0.08)'}`,
              color: active ? c : '#9ca3af',
            }}>
            {active && '✓ '}{o}
          </button>
        )
      })}
    </div>
  )
}

function RadioGroup({ options, value, onChange }: {
  options: { v: string; l: string }[]; value: string; onChange: (v: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(o => (
        <button key={o.v} onClick={() => onChange(o.v)}
          className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
          style={{
            background: value === o.v ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.03)',
            border: `1px solid ${value === o.v ? 'rgba(245,158,11,0.4)' : 'rgba(255,255,255,0.08)'}`,
            color: value === o.v ? '#f59e0b' : '#9ca3af',
          }}>
          {value === o.v && '● '}{o.l}
        </button>
      ))}
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────
export default function BrandBrainPage() {
  const { isAuthenticated, loading: authLoading } = useAuth()
  const router = useRouter()
  const { locale, dir } = useI18n()
  const { brand, loading, saving, saveBrand } = useBrandBrain()

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/auth/login')
  }, [authLoading, isAuthenticated, router])

  const [step, setStep] = useState<StepId>('identity')
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState<BrandProfile>({
    brandName: '', industry: '', description: '',
    primaryOffer: '', secondaryOffers: [], pricePoint: 'mid-range', uniqueAdvantages: [],
    targetAudience: '', audienceAge: '', audienceLocation: '', audiencePainPoints: [], audienceDesires: [],
    toneKeywords: [], avoidKeywords: [], writingStyle: '',
    topPlatforms: [], visualStyle: '',
    winningHooks: [], winningAngles: [], failedAngles: [], competitorNotes: '', strategicNotes: '',
  })

  // Populate form when brand loads
  useEffect(() => {
    if (brand) setForm(b => ({ ...b, ...brand }))
  }, [brand])

  const set = (k: keyof BrandProfile, v: unknown) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    const ok = await saveBrand(form)
    if (ok) { setSaved(true); setTimeout(() => setSaved(false), 3000) }
  }

  const { score, missing } = getBrandCompleteness(form)

  const currentStepIdx = STEPS.findIndex(s => s.id === step)
  const currentStep = STEPS[currentStepIdx]

  if (authLoading || loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0A0E27' }}>
      <Loader2 className="animate-spin text-amber-500" size={32} />
    </div>
  )
  if (!isAuthenticated) return null

  const glassCard = { background: 'rgba(17,21,54,0.5)', border: '1px solid rgba(108,99,255,0.1)', backdropFilter: 'blur(20px)' }

  return (
    <AppShell>
      <div className="min-h-screen relative" style={{ background: '#0A0E27' }} dir={dir}>
        <StarField />
        <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }}>
          <div className="absolute rounded-full blur-[160px] opacity-15"
            style={{ width: 600, height: 600, background: 'radial-gradient(circle, rgba(108,99,255,0.15), transparent 70%)', top: '-10%', right: '-10%', animation: 'float 16s ease-in-out infinite' }} />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto px-4 py-8 space-y-6">

          {/* ── Header ─────────────────────────────────────────── */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.25), rgba(245,158,11,0.08))', border: '1px solid rgba(245,158,11,0.3)', boxShadow: '0 0 30px rgba(245,158,11,0.15)' }}>
                  <Brain size={26} className="text-amber-400" />
                </div>
                {score >= 80 && (
                  <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center bg-green-500">
                    <Check size={10} className="text-white" />
                  </div>
                )}
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold text-white">Brand Brain</h1>
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium"
                    style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)' }}>
                    {locale === 'ar' ? 'عقل العلامة' : 'Brand Memory'}
                  </span>
                </div>
                <p className="text-gray-400 text-sm mt-0.5">{locale === 'ar' ? 'المعلومات هنا تُحقن تلقائياً في كل وكيل ذكاء اصطناعي' : 'This data is automatically injected into every AI agent'}</p>
              </div>
            </div>
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all flex-shrink-0"
              style={{
                background: saved ? 'rgba(16,185,129,0.2)' : 'linear-gradient(135deg, #f59e0b, #d97706)',
                color: saved ? '#10b981' : '#0a0a0a',
                boxShadow: saved ? 'none' : '0 0 20px rgba(245,158,11,0.3)',
                border: saved ? '1px solid rgba(16,185,129,0.3)' : 'none',
              }}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <CheckCircle2 size={14} /> : <Save size={14} />}
              {saving ? (locale === 'ar' ? 'جاري الحفظ...' : 'Saving...') : saved ? (locale === 'ar' ? 'تم الحفظ ✓' : 'Saved ✓') : (locale === 'ar' ? 'حفظ الكل' : 'Save All')}
            </button>
          </div>

          {/* ── Completeness bar ────────────────────────────────── */}
          <div className="rounded-2xl p-4" style={glassCard}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Sparkles size={14} className="text-amber-500" />
                <span className="text-sm font-semibold text-white">{locale === 'ar' ? 'اكتمال الذاكرة' : 'Brain Completeness'}</span>
              </div>
              <span className="text-sm font-bold" style={{ color: score >= 80 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444' }}>
                {score}%
              </span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <div className="h-full rounded-full transition-all duration-500"
                style={{ width: `${score}%`, background: score >= 80 ? 'linear-gradient(90deg,#10b981,#059669)' : score >= 50 ? 'linear-gradient(90deg,#f59e0b,#d97706)' : 'linear-gradient(90deg,#ef4444,#dc2626)' }} />
            </div>
            {missing.length > 0 && (
              <p className="text-xs text-gray-600 mt-2">
                {locale === 'ar' ? 'ناقص:' : 'Missing:'} {missing.join(locale === 'ar' ? '، ' : ', ')}
              </p>
            )}
            {score < 60 && (
              <div className="flex items-start gap-2 mt-3 p-3 rounded-xl" style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}>
                <AlertTriangle size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-500/80">
                  {locale === 'ar' ? 'الوكلاء سيعملون بكفاءة أقل بدون معلومات كاملة. أكمل الإعداد للحصول على أفضل نتائج.' : 'Agents will work less effectively without complete information. Complete the setup for best results.'}
                </p>
              </div>
            )}
          </div>

          {/* ── Step tabs ───────────────────────────────────────── */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {STEPS.map((s, i) => {
              const active = step === s.id
              return (
                <button key={s.id} onClick={() => setStep(s.id)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all flex-shrink-0"
                  style={{
                    background: active ? `${s.color}18` : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${active ? s.color + '40' : 'rgba(255,255,255,0.07)'}`,
                    color: active ? s.color : '#9ca3af',
                  }}>
                  <s.icon size={14} />
                  <span>{locale === 'ar' ? s.label : s.labelEn}</span>
                </button>
              )
            })}
          </div>

          {/* ── Step content ────────────────────────────────────── */}
          <div className="rounded-2xl p-6 space-y-5" style={{ ...glassCard, borderColor: `${currentStep.color}25` }}>
            <div className="flex items-center gap-3 pb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: `${currentStep.color}18`, border: `1px solid ${currentStep.color}30` }}>
                <currentStep.icon size={18} style={{ color: currentStep.color }} />
              </div>
              <div>
                <h2 className="text-white font-bold">{locale === 'ar' ? currentStep.label : currentStep.labelEn}</h2>
                <p className="text-xs text-gray-500">{locale === 'ar' ? currentStep.desc : currentStep.descEn}</p>
              </div>
            </div>

            {/* IDENTITY */}
            {step === 'identity' && (
              <div className="space-y-4">
                <Field label={locale === 'ar' ? 'اسم العلامة التجارية *' : 'Brand Name *'}>
                  <Input value={form.brandName || ''} onChange={v => set('brandName', v)}
                    placeholder={locale === 'ar' ? 'مثال: مطعم الأصالة، متجر Zara Arabia...' : 'e.g. Al-Asala Restaurant, Zara Arabia...'} />
                </Field>
                <Field label={locale === 'ar' ? 'القطاع / الصناعة *' : 'Industry / Sector *'}>
                  <div className="relative">
                    <select value={form.industry || ''} onChange={e => set('industry', e.target.value)}
                      className="w-full appearance-none px-3 py-2.5 rounded-xl text-sm pr-8 focus:outline-none"
                      style={{ background: 'rgba(17,21,54,0.5)', border: '1px solid rgba(108,99,255,0.12)', color: form.industry ? '#e5e7eb' : '#6b7280' }}>
                      <option value="" style={{ background: '#111536' }}>{locale === 'ar' ? 'اختر القطاع...' : 'Select industry...'}</option>
                      {(locale === 'ar' ? INDUSTRIES_AR : INDUSTRIES_EN).map((ind, idx) => (
                        <option key={idx} value={ind} style={{ background: '#111536' }}>{ind}</option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                  </div>
                </Field>
                <Field label={locale === 'ar' ? 'وصف النشاط التجاري * — ما الذي تفعله؟' : 'Business Description * — What do you do?'}>
                  <Input textarea value={form.description || ''} onChange={v => set('description', v)}
                    placeholder={locale === 'ar'
                      ? 'مثال: نحن مطعم عائلي متخصص في الأكلات الشامية التقليدية في الرياض، نقدم تجربة عشاء فاخرة بأسعار معقولة...'
                      : 'e.g. We are a family restaurant specializing in traditional Levantine cuisine in Riyadh, offering a premium dining experience at reasonable prices...'} />
                </Field>
                <Field label={locale === 'ar' ? 'ملاحظات استراتيجية — أي معلومات أخرى مهمة عن النشاط' : 'Strategic Notes — Any other important information'}>
                  <Input textarea value={form.strategicNotes || ''} onChange={v => set('strategicNotes', v)}
                    placeholder={locale === 'ar'
                      ? 'مثال: نستهدف العائلات والمناسبات، لدينا برنامج ولاء، نسعى للتوسع في جدة...'
                      : 'e.g. We target families and events, we have a loyalty program, we aim to expand to Jeddah...'} />
                </Field>
              </div>
            )}

            {/* PRODUCT */}
            {step === 'product' && (
              <div className="space-y-4">
                <Field label={locale === 'ar' ? 'المنتج / الخدمة الرئيسية *' : 'Primary Product / Service *'}>
                  <Input textarea value={form.primaryOffer || ''} onChange={v => set('primaryOffer', v)}
                    placeholder={locale === 'ar'
                      ? 'مثال: وجبات رمضانية للعائلات مع إمكانية الحجز المسبق وخدمة توصيل للمنازل...'
                      : 'e.g. Ramadan family meals with pre-booking and home delivery service...'} />
                </Field>
                <TagInput
                  label={locale === 'ar' ? 'منتجات / خدمات ثانوية أخرى' : 'Other Secondary Products / Services'}
                  placeholder={locale === 'ar' ? 'اكتب واضغط Enter لكل منتج...' : 'Type and press Enter for each item...'}
                  values={form.secondaryOffers || []} onChange={v => set('secondaryOffers', v)} />
                <Field label={locale === 'ar' ? 'مستوى السعر *' : 'Price Point *'}>
                  <RadioGroup
                    options={PRICE_OPTIONS.map(o => ({ v: o.v, l: locale === 'ar' ? o.l : o.lEn }))}
                    value={form.pricePoint || ''} onChange={v => set('pricePoint', v)} />
                </Field>
                <TagInput
                  label={locale === 'ar' ? 'المميزات الفريدة — ما الذي يميزك عن المنافسين؟ *' : 'Unique Advantages — What sets you apart? *'}
                  placeholder={locale === 'ar' ? 'مثال: وصفات سرية، خدمة ٢٤/٧، ضمان استرداد...' : 'e.g. Secret recipes, 24/7 service, money-back guarantee...'}
                  values={form.uniqueAdvantages || []} onChange={v => set('uniqueAdvantages', v)} />
              </div>
            )}

            {/* AUDIENCE */}
            {step === 'audience' && (
              <div className="space-y-4">
                <Field label={locale === 'ar' ? 'وصف الجمهور المستهدف * — من هو عميلك المثالي؟' : 'Target Audience * — Who is your ideal customer?'}>
                  <Input textarea value={form.targetAudience || ''} onChange={v => set('targetAudience', v)}
                    placeholder={locale === 'ar'
                      ? 'مثال: شباب سعودي من 25-35 سنة، يعيش في المدن الكبرى، مهتم بتجارب الطعام الجديدة ويستخدم Instagram يومياً...'
                      : 'e.g. Saudi youth aged 25-35, living in major cities, interested in new food experiences and uses Instagram daily...'} />
                </Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field label={locale === 'ar' ? 'الفئة العمرية *' : 'Age Group *'}>
                    <div className="flex flex-wrap gap-2">
                      {(locale === 'ar' ? AGE_OPTIONS_AR : AGE_OPTIONS_EN).map(a => (
                        <button key={a} onClick={() => set('audienceAge', a)}
                          className="px-3 py-1.5 rounded-lg text-xs transition-all"
                          style={{
                            background: form.audienceAge === a ? 'rgba(139,92,246,0.18)' : 'rgba(255,255,255,0.03)',
                            border: `1px solid ${form.audienceAge === a ? 'rgba(139,92,246,0.4)' : 'rgba(255,255,255,0.08)'}`,
                            color: form.audienceAge === a ? '#8b5cf6' : '#9ca3af',
                          }}>
                          {form.audienceAge === a && '● '}{a}
                        </button>
                      ))}
                    </div>
                  </Field>
                  <Field label={locale === 'ar' ? 'الموقع الجغرافي *' : 'Geographic Location *'}>
                    <Input value={form.audienceLocation || ''} onChange={v => set('audienceLocation', v)}
                      placeholder={locale === 'ar' ? 'مثال: السعودية، الإمارات، مصر، الخليج العربي...' : 'e.g. Saudi Arabia, UAE, Egypt, Gulf region...'} />
                  </Field>
                </div>
                <TagInput
                  label={locale === 'ar' ? 'نقاط الألم — ما المشاكل التي يعاني منها جمهورك؟' : 'Pain Points — What problems does your audience face?'}
                  placeholder={locale === 'ar' ? 'مثال: لا وقت للطبخ، يبحث عن جودة بسعر معقول...' : 'e.g. No time to cook, looking for quality at a fair price...'}
                  values={form.audiencePainPoints || []} onChange={v => set('audiencePainPoints', v)} />
                <TagInput
                  label={locale === 'ar' ? 'الرغبات والتطلعات — ما الذي يريده جمهورك؟' : 'Desires & Aspirations — What does your audience want?'}
                  placeholder={locale === 'ar' ? 'مثال: توفير الوقت، الشعور بالفخر، تجربة مميزة...' : 'e.g. Saving time, feeling proud, a premium experience...'}
                  values={form.audienceDesires || []} onChange={v => set('audienceDesires', v)} />
              </div>
            )}

            {/* VOICE */}
            {step === 'voice' && (
              <div className="space-y-4">
                <Field label={locale === 'ar' ? 'نبرة الصوت المطلوبة * — كيف تريد أن تبدو في تواصلك؟' : 'Desired Tone * — How do you want to sound?'}>
                  <ToggleGrid options={locale === 'ar' ? TONE_OPTIONS_AR : TONE_OPTIONS_EN} selected={form.toneKeywords || []}
                    onChange={v => set('toneKeywords', v)} color="#10b981" />
                </Field>
                <Field label={locale === 'ar' ? 'أسلوب الكتابة المفضل' : 'Preferred Writing Style'}>
                  <Input value={form.writingStyle || ''} onChange={v => set('writingStyle', v)}
                    placeholder={locale === 'ar'
                      ? 'مثال: جمل قصيرة ومباشرة، نبرة ودية وعامية مصرية، بدون مصطلحات تقنية...'
                      : 'e.g. Short and direct sentences, friendly conversational tone, no technical jargon...'} />
                </Field>
                <TagInput
                  label={locale === 'ar' ? 'كلمات وأساليب يجب تجنبها' : 'Words & Styles to Avoid'}
                  placeholder={locale === 'ar' ? "مثال: 'رائع'، 'مميز'، المبالغة في الأوصاف..." : "e.g. 'amazing', 'unique', excessive adjectives..."}
                  values={form.avoidKeywords || []} onChange={v => set('avoidKeywords', v)} />
                <TagInput
                  label={locale === 'ar' ? 'أمثلة على هوكس نجحت معكم سابقاً (اختياري)' : 'Winning Hooks from past content (optional)'}
                  placeholder={locale === 'ar' ? 'هوك ناجح...' : 'A winning hook...'}
                  values={form.winningHooks || []} onChange={v => set('winningHooks', v)} />
              </div>
            )}

            {/* PLATFORMS */}
            {step === 'platforms' && (
              <div className="space-y-4">
                <Field label={locale === 'ar' ? 'المنصات التي تنشط فيها *' : 'Active Platforms *'}>
                  <ToggleGrid options={PLATFORMS_LIST} selected={form.topPlatforms || []}
                    onChange={v => set('topPlatforms', v)} color="#ec4899" />
                </Field>
                <Field label={locale === 'ar' ? 'الأسلوب البصري المفضل' : 'Preferred Visual Style'}>
                  <div className="flex flex-wrap gap-2">
                    {['minimalist', 'bold', 'lifestyle', 'corporate', 'playful', 'luxury', 'editorial'].map(style => (
                      <button key={style} onClick={() => set('visualStyle', style)}
                        className="px-3 py-1.5 rounded-lg text-xs transition-all"
                        style={{
                          background: form.visualStyle === style ? 'rgba(236,72,153,0.15)' : 'rgba(255,255,255,0.03)',
                          border: `1px solid ${form.visualStyle === style ? 'rgba(236,72,153,0.4)' : 'rgba(255,255,255,0.08)'}`,
                          color: form.visualStyle === style ? '#ec4899' : '#9ca3af',
                        }}>
                        {form.visualStyle === style && '● '}{style}
                      </button>
                    ))}
                  </div>
                </Field>
                <TagInput
                  label={locale === 'ar' ? 'زوايا وأساليب تسويقية نجحت (اختياري)' : 'Winning marketing angles (optional)'}
                  placeholder={locale === 'ar' ? 'مثال: تحديات TikTok، قصص العملاء...' : 'e.g. TikTok challenges, customer stories...'}
                  values={form.winningAngles || []} onChange={v => set('winningAngles', v)} />
                <TagInput
                  label={locale === 'ar' ? 'أساليب لم تنجح وتريد تجنبها (اختياري)' : 'Failed approaches to avoid (optional)'}
                  placeholder={locale === 'ar' ? 'مثال: الإعلانات الترويجية المباشرة، الصور المصطنعة...' : 'e.g. Direct promotional ads, staged photos...'}
                  values={form.failedAngles || []} onChange={v => set('failedAngles', v)} />
              </div>
            )}

            {/* COMPETITORS */}
            {step === 'competitors' && (
              <div className="space-y-4">
                <Field label={locale === 'ar' ? 'ملاحظات عن المنافسين — من هم ونقاط قوتهم وضعفهم؟' : 'Competitor Notes — Who are they and their strengths/weaknesses?'}>
                  <Input textarea value={form.competitorNotes || ''} onChange={v => set('competitorNotes', v)}
                    placeholder={locale === 'ar'
                      ? 'مثال: المنافس الرئيسي هو مطعم X — نقطة قوته: السعر، نقطة ضعفه: جودة الطعام وبطء التوصيل. نحن أفضل في الجودة لكن أقل وضوحاً في التسويق...'
                      : 'e.g. Main competitor is Restaurant X — strength: price, weakness: food quality and slow delivery. We are better in quality but less visible in marketing...'} />
                </Field>
              </div>
            )}

            {/* Navigation */}
            <div className="flex items-center justify-between pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <button
                onClick={() => currentStepIdx > 0 && setStep(STEPS[currentStepIdx - 1].id)}
                disabled={currentStepIdx === 0}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm transition-all"
                style={{ color: currentStepIdx === 0 ? '#374151' : '#9ca3af', cursor: currentStepIdx === 0 ? 'not-allowed' : 'pointer' }}>
                <ArrowRight size={15} />
                {locale === 'ar' ? 'السابق' : 'Previous'}
              </button>

              <div className="flex items-center gap-1">
                {STEPS.map((s, i) => (
                  <button key={s.id} onClick={() => setStep(s.id)}
                    className="w-2 h-2 rounded-full transition-all"
                    style={{ background: step === s.id ? '#f59e0b' : 'rgba(255,255,255,0.15)', transform: step === s.id ? 'scale(1.4)' : 'scale(1)' }} />
                ))}
              </div>

              {currentStepIdx < STEPS.length - 1 ? (
                <button
                  onClick={() => setStep(STEPS[currentStepIdx + 1].id)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm transition-all"
                  style={{ color: '#f59e0b' }}>
                  {locale === 'ar' ? 'التالي' : 'Next'}
                  <ArrowLeft size={15} />
                </button>
              ) : (
                <button onClick={handleSave} disabled={saving}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold transition-all"
                  style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#0a0a0a', boxShadow: '0 0 20px rgba(245,158,11,0.25)' }}>
                  <Zap size={14} />
                  {locale === 'ar' ? 'حفظ وتفعيل Brain' : 'Save & Activate Brain'}
                </button>
              )}
            </div>
          </div>

          {/* ── What this does ───────────────────────────────────── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { color: '#f59e0b', icon: Brain,    label: 'NEX Studio',  desc: 'سكريبتات مخصصة لعلامتك',  descEn: 'Custom scripts for your brand' },
              { color: '#06b6d4', icon: Zap,      label: 'VEX Ads',     desc: 'إعلانات بنبرة صوتك',       descEn: 'Ads in your brand voice' },
              { color: '#8b5cf6', icon: BarChart2, label: 'PULSE',      desc: 'تحليل موجّه لقطاعك',       descEn: 'Analysis focused on your sector' },
              { color: '#10b981', icon: Target,   label: 'Sentinel',    desc: 'رصد منافسيك تحديداً',      descEn: 'Monitor your specific competitors' },
            ].map((c, i) => (
              <div key={i} className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(108,99,255,0.08)' }}>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center mb-2"
                  style={{ background: `${c.color}18`, border: `1px solid ${c.color}25` }}>
                  <c.icon size={14} style={{ color: c.color }} />
                </div>
                <p className="text-xs font-semibold text-white">{c.label}</p>
                <p className="text-[11px] text-gray-600 mt-0.5">{locale === 'ar' ? c.desc : c.descEn}</p>
              </div>
            ))}
          </div>

        </div>
      </div>
    </AppShell>
  )
}
