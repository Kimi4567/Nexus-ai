'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import AppShell from '@/components/AppShell'

interface BrandProfile {
  brandName?: string
  industry?: string
  description?: string
  toneKeywords: string[]
  avoidKeywords: string[]
  writingStyle?: string
  targetAudience?: string
  audienceAge?: string
  audienceLocation?: string
  audiencePainPoints: string[]
  audienceDesires: string[]
  primaryOffer?: string
  secondaryOffers: string[]
  pricePoint?: string
  uniqueAdvantages: string[]
  visualStyle?: string
  colorPalette: string[]
  winningHooks: string[]
  winningAngles: string[]
  strategicNotes?: string
  competitorNotes?: string
}

const emptyProfile: BrandProfile = {
  brandName: '', industry: '', description: '',
  toneKeywords: [], avoidKeywords: [], writingStyle: '',
  targetAudience: '', audienceAge: '', audienceLocation: '',
  audiencePainPoints: [], audienceDesires: [],
  primaryOffer: '', secondaryOffers: [], pricePoint: '',
  uniqueAdvantages: [], visualStyle: '', colorPalette: [],
  winningHooks: [], winningAngles: [], strategicNotes: '', competitorNotes: '',
}

// Bilingual options — displayed in Arabic, stored in English for AI context
const TONE_OPTIONS    = ['جريء', 'محادثاتي', 'راقي', 'بسيط', 'حيوي', 'موثوق', 'ودود', 'ذكي', 'عاجل', 'ملهم']
const STYLE_OPTIONS   = ['قصير ومكثف', 'سرد طويل', 'نقاط مرتبة', 'تساؤلات', 'مدعوم بالأرقام', 'قصصي', 'استجابة مباشرة']
const VISUAL_OPTIONS  = ['مينيمال', 'جرافيك جريء', 'تصوير حياتي', 'نظيف احترافي', 'داكن راقي', 'مشرق وممتع', 'افتتاحي']
const PRICE_OPTIONS   = ['اقتصادي', 'متوسط', 'راقي', 'فاخر']
const AGE_OPTIONS     = ['13–17', '18–24', '25–34', '35–44', '45–54', '55–64', '65+']

const SECTIONS = ['الهوية', 'الصوت والأسلوب', 'الجمهور', 'العرض', 'الهوية البصرية', 'ذاكرة الحملات']

// ── Sub-components ──────────────────────────────────────────────────────────

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-5">
      <h2 className="text-sm font-semibold text-white">{title}</h2>
      <p className="text-[12px] text-t3 mt-0.5">{description}</p>
    </div>
  )
}

function TagInput({
  label, values, onChange, placeholder, suggestions,
}: {
  label: string
  values: string[]
  onChange: (vals: string[]) => void
  placeholder?: string
  suggestions?: string[]
}) {
  const [input, setInput] = useState('')

  const add = (val: string) => {
    const trimmed = val.trim()
    if (trimmed && !values.includes(trimmed)) onChange([...values, trimmed])
    setInput('')
  }
  const remove = (val: string) => onChange(values.filter(v => v !== val))

  return (
    <div>
      <label className="block text-[11px] font-medium text-t3 uppercase tracking-wide mb-2">{label}</label>
      {suggestions && suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {suggestions.filter(s => !values.includes(s)).map(s => (
            <button key={s} type="button" onClick={() => add(s)}
              className="text-[11px] px-2.5 py-1 bg-s3 border border-s4 text-t3 rounded-full hover:text-white hover:border-s5 transition">
              + {s}
            </button>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-1.5 mb-2">
        {values.map(v => (
          <span key={v} className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 bg-accent/15 border border-accent/30 text-accent rounded-full">
            {v}
            <button type="button" onClick={() => remove(v)} className="hover:text-white transition leading-none">×</button>
          </span>
        ))}
      </div>
      <input
        type="text"
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(input) } }}
        placeholder={placeholder || 'اكتب واضغط Enter'}
        className="w-full px-3 py-2 bg-s1 border border-s4 rounded-lg text-sm text-t1 placeholder-t4 focus:outline-none focus:border-accent/60 transition"
      />
    </div>
  )
}

function TextArea({ label, value, onChange, placeholder, rows = 3 }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; rows?: number
}) {
  return (
    <div>
      <label className="block text-[11px] font-medium text-t3 uppercase tracking-wide mb-2">{label}</label>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full px-3 py-2.5 bg-s1 border border-s4 rounded-lg text-sm text-t1 placeholder-t4 focus:outline-none focus:border-accent/60 transition resize-none"
      />
    </div>
  )
}

function TextField({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string
}) {
  return (
    <div>
      <label className="block text-[11px] font-medium text-t3 uppercase tracking-wide mb-2">{label}</label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 bg-s1 border border-s4 rounded-lg text-sm text-t1 placeholder-t4 focus:outline-none focus:border-accent/60 transition"
      />
    </div>
  )
}

function PillSelect({ label, options, value, onChange }: {
  label: string; options: string[]; value: string; onChange: (v: string) => void
}) {
  return (
    <div>
      <label className="block text-[11px] font-medium text-t3 uppercase tracking-wide mb-2">{label}</label>
      <div className="flex flex-wrap gap-2">
        {options.map(opt => (
          <button key={opt} type="button" onClick={() => onChange(value === opt ? '' : opt)}
            className={`text-[11px] px-3 py-1.5 rounded-full border transition font-medium ${
              value === opt
                ? 'bg-accent border-accent text-white'
                : 'bg-s1 border-s4 text-t3 hover:text-white hover:border-s5'
            }`}>
            {opt}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function BrandIntelligencePage() {
  const router = useRouter()
  const { isAuthenticated, loading, authHeader } = useAuth()
  const [profile, setProfile]           = useState<BrandProfile>(emptyProfile)
  const [fetching, setFetching]         = useState(true)
  const [saving, setSaving]             = useState(false)
  const [saved, setSaved]               = useState(false)
  const [activeSection, setActiveSection] = useState(0)

  useEffect(() => {
    if (!loading && !isAuthenticated) router.push('/auth/login')
  }, [loading, isAuthenticated, router])

  const fetchProfile = useCallback(async () => {
    const token = authHeader()
    if (!token) return
    setFetching(true)
    try {
      const res  = await fetch('/api/brand', { headers: { Authorization: token } })
      const data = await res.json()
      if (data.brandProfile) setProfile({ ...emptyProfile, ...data.brandProfile })
    } catch { /* silent */ }
    setFetching(false)
  }, [authHeader])

  useEffect(() => {
    if (isAuthenticated) fetchProfile()
  }, [isAuthenticated, fetchProfile])

  const update = <K extends keyof BrandProfile>(key: K, value: BrandProfile[K]) => {
    setProfile(prev => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  const handleSave = async () => {
    const token = authHeader()
    if (!token) return
    setSaving(true)
    try {
      await fetch('/api/brand', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: token },
        body: JSON.stringify(profile),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch { /* silent */ }
    setSaving(false)
  }

  if (loading || fetching) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-64">
          <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      </AppShell>
    )
  }

  const completionFields = [
    profile.brandName, profile.industry, profile.description,
    profile.toneKeywords.length > 0, profile.writingStyle,
    profile.targetAudience, profile.primaryOffer,
  ]
  const completionPct = Math.round((completionFields.filter(Boolean).length / completionFields.length) * 100)

  return (
    <AppShell>
      <div className="px-8 py-8 max-w-[900px] page-enter" dir="rtl">

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-white mb-1">ذاكرة العلامة التجارية</h1>
            <p className="text-sm text-t3">
              الـ AI يقرأ هذا قبل كل حملة ليتكلم بصوتك تماماً.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-left">
              <div className="text-[11px] text-t3 mb-1">اكتمال الملف — {completionPct}%</div>
              <div className="w-32 h-1.5 bg-s3 rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent rounded-full transition-all duration-500"
                  style={{ width: `${completionPct}%` }}
                />
              </div>
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                saved
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-accent hover:bg-accent-light text-white'
              }`}
            >
              {saving ? 'جاري الحفظ...' : saved ? '✓ تم الحفظ' : 'حفظ التغييرات'}
            </button>
          </div>
        </div>

        {/* ── Section tabs ───────────────────────────────────────────── */}
        <div className="flex gap-1 mb-8 overflow-x-auto pb-1">
          {SECTIONS.map((s, i) => (
            <button
              key={s}
              onClick={() => setActiveSection(i)}
              className={`px-3.5 py-2 rounded-lg text-[12px] font-medium whitespace-nowrap transition ${
                activeSection === i ? 'bg-s3 text-t1' : 'text-t3 hover:text-t2'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* ── Section content ────────────────────────────────────────── */}
        <div className="space-y-6">

          {/* 0 — Identity */}
          {activeSection === 0 && (
            <div className="surface-card rounded-card p-6 space-y-5">
              <SectionHeader
                title="هوية العلامة"
                description="الأساس — من أنت وماذا تفعل."
              />
              <div className="grid grid-cols-2 gap-5">
                <TextField
                  label="اسم العلامة / الشركة"
                  value={profile.brandName || ''}
                  onChange={v => update('brandName', v)}
                  placeholder="مثال: متجر النور، Acme Co."
                />
                <TextField
                  label="القطاع"
                  value={profile.industry || ''}
                  onChange={v => update('industry', v)}
                  placeholder="مثال: تجارة إلكترونية، SaaS، جمال"
                />
              </div>
              <TextArea
                label="وصف العلامة"
                value={profile.description || ''}
                onChange={v => update('description', v)}
                placeholder="ماذا تقدم؟ ما المشكلة التي تحلها؟ ما الذي يميزك؟"
                rows={4}
              />
            </div>
          )}

          {/* 1 — Voice & Tone */}
          {activeSection === 1 && (
            <div className="surface-card rounded-card p-6 space-y-6">
              <SectionHeader
                title="الصوت والأسلوب"
                description="كيف تبدو علامتك؟ الـ AI سيكتب بهذا الأسلوب في كل حملة."
              />
              <TagInput
                label="كلمات مفتاحية للأسلوب"
                values={profile.toneKeywords}
                onChange={v => update('toneKeywords', v)}
                suggestions={TONE_OPTIONS}
                placeholder="أضف وصفاً للأسلوب واضغط Enter"
              />
              <TagInput
                label="كلمات / أساليب يجب تجنبها"
                values={profile.avoidKeywords}
                onChange={v => update('avoidKeywords', v)}
                placeholder="مثال: 'ثوري'، تعقيدات لغوية، علامات التعجب المبالغة"
              />
              <PillSelect
                label="نمط الكتابة"
                options={STYLE_OPTIONS}
                value={profile.writingStyle || ''}
                onChange={v => update('writingStyle', v)}
              />
            </div>
          )}

          {/* 2 — Audience */}
          {activeSection === 2 && (
            <div className="surface-card rounded-card p-6 space-y-6">
              <SectionHeader
                title="الجمهور المستهدف"
                description="من تتكلم إليه؟ كلما كنت أكثر تحديداً، كان الـ AI أفضل."
              />
              <TextArea
                label="وصف الجمهور"
                value={profile.targetAudience || ''}
                onChange={v => update('targetAudience', v)}
                placeholder="صف عميلك المثالي بالتفصيل — يومه، قيمه، إحباطاته، أحلامه..."
                rows={4}
              />
              <div className="grid grid-cols-2 gap-5">
                <PillSelect
                  label="الفئة العمرية"
                  options={AGE_OPTIONS}
                  value={profile.audienceAge || ''}
                  onChange={v => update('audienceAge', v)}
                />
                <TextField
                  label="الموقع / السوق"
                  value={profile.audienceLocation || ''}
                  onChange={v => update('audienceLocation', v)}
                  placeholder="مثال: السعودية، الإمارات، مصر، MENA"
                />
              </div>
              <TagInput
                label="نقاط الألم"
                values={profile.audiencePainPoints}
                onChange={v => update('audiencePainPoints', v)}
                placeholder="ماذا يزعجهم؟ اضغط Enter بعد كل نقطة"
              />
              <TagInput
                label="الرغبات والأهداف"
                values={profile.audienceDesires}
                onChange={v => update('audienceDesires', v)}
                placeholder="ماذا يريدون؟ اضغط Enter بعد كل رغبة"
              />
            </div>
          )}

          {/* 3 — Offer */}
          {activeSection === 3 && (
            <div className="surface-card rounded-card p-6 space-y-6">
              <SectionHeader
                title="العرض والتموضع"
                description="ماذا تبيع ولماذا هو أفضل؟ يشكّل كل استراتيجية حملة."
              />
              <TextArea
                label="العرض الرئيسي"
                value={profile.primaryOffer || ''}
                onChange={v => update('primaryOffer', v)}
                placeholder="منتجك / خدمتك الأساسية وما تقدمه من قيمة..."
                rows={3}
              />
              <TagInput
                label="عروض ثانوية / إضافية"
                values={profile.secondaryOffers}
                onChange={v => update('secondaryOffers', v)}
                placeholder="منتجات أخرى، إضافات، أو خدمات"
              />
              <PillSelect
                label="نطاق السعر"
                options={PRICE_OPTIONS}
                value={profile.pricePoint || ''}
                onChange={v => update('pricePoint', v)}
              />
              <TagInput
                label="المزايا الفريدة"
                values={profile.uniqueAdvantages}
                onChange={v => update('uniqueAdvantages', v)}
                placeholder="ما الذي يجعلك أفضل من البدائل؟ اضغط Enter بعد كل ميزة"
              />
            </div>
          )}

          {/* 4 — Visual */}
          {activeSection === 4 && (
            <div className="surface-card rounded-card p-6 space-y-6">
              <SectionHeader
                title="الهوية البصرية"
                description="تفضيلاتك الجمالية — توجّه الاتجاه الإبداعي والصور."
              />
              <PillSelect
                label="الأسلوب البصري"
                options={VISUAL_OPTIONS}
                value={profile.visualStyle || ''}
                onChange={v => update('visualStyle', v)}
              />
              <TagInput
                label="ألوان العلامة"
                values={profile.colorPalette}
                onChange={v => update('colorPalette', v)}
                placeholder="مثال: أزرق داكن، ذهبي، #1a1a2e — اضغط Enter بعد كل لون"
              />
            </div>
          )}

          {/* 5 — Memory */}
          {activeSection === 5 && (
            <div className="surface-card rounded-card p-6 space-y-6">
              <SectionHeader
                title="ذاكرة الحملات"
                description="ما الذي نجح وما الذي لم ينجح؟ الـ AI يتعلم من تاريخك."
              />
              <TagInput
                label="أفضل hooks نجحت"
                values={profile.winningHooks}
                onChange={v => update('winningHooks', v)}
                placeholder="افتتاحيات أثارت تفاعلاً — اضغط Enter بعد كل واحد"
              />
              <TagInput
                label="أفضل زوايا تسويقية"
                values={profile.winningAngles}
                onChange={v => update('winningAngles', v)}
                placeholder="زوايا حملات حوّلت — اضغط Enter بعد كل زاوية"
              />
              <TextArea
                label="ملاحظات استراتيجية"
                value={profile.strategicNotes || ''}
                onChange={v => update('strategicNotes', v)}
                placeholder="أي سياق استراتيجي يجب أن يعرفه الـ AI دائماً — موسمية، إعادة تموضع، إطلاقات قادمة..."
                rows={4}
              />
              <TextArea
                label="ملاحظات المنافسين"
                value={profile.competitorNotes || ''}
                onChange={v => update('competitorNotes', v)}
                placeholder="من هم منافسوك؟ كيف تتميز عنهم؟"
                rows={3}
              />
            </div>
          )}
        </div>

        {/* ── Bottom save ────────────────────────────────────────────── */}
        <div className="mt-8 flex justify-start">
          <button
            onClick={handleSave}
            disabled={saving}
            className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition ${
              saved
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-accent hover:bg-accent-light text-white'
            }`}
          >
            {saving ? 'جاري الحفظ...' : saved ? '✓ تم حفظ ملف العلامة' : 'حفظ التغييرات'}
          </button>
        </div>

      </div>
    </AppShell>
  )
}
