'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import {
  ArrowLeft, Wand2, ChevronRight, ChevronLeft, Check,
  Target, Megaphone, DollarSign, Settings, Rocket, Loader2,
} from 'lucide-react'

const PLATFORMS = ['Facebook', 'Instagram', 'TikTok', 'Google', 'Snapchat', 'YouTube']

const GOAL_OPTIONS = [
  { value: 'SALES', label: 'مبيعات' },
  { value: 'AWARENESS', label: 'وعي بالعلامة' },
  { value: 'ENGAGEMENT', label: 'تفاعل' },
  { value: 'LEADS', label: 'قيادة (Leads)' },
  { value: 'TRAFFIC', label: 'زيارات' },
]

const TONE_OPTIONS = [
  { value: 'MODERN', label: 'عصري' },
  { value: 'FRIENDLY', label: 'ودود' },
  { value: 'PROFESSIONAL', label: 'احترافي' },
  { value: 'BOLD', label: 'جريء' },
  { value: 'INSPIRING', label: 'ملهم' },
]

export default function NewCampaignPage() {
  const router = useRouter()
  const { authHeader } = useAuth()

  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Form fields
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [goal, setGoal] = useState('SALES')
  const [tone, setTone] = useState('MODERN')
  const [platforms, setPlatforms] = useState<string[]>(['Facebook'])
  const [audience, setAudience] = useState('')

  const totalSteps = 4

  const steps = [
    { num: 1, label: 'الأساسية', icon: Target },
    { num: 2, label: 'المنصات', icon: Megaphone },
    { num: 3, label: 'الجمهور', icon: Settings },
    { num: 4, label: 'المراجعة', icon: Rocket },
  ]

  const togglePlatform = (p: string) => {
    setPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    )
  }

  const canNext = () => {
    if (step === 1) return name.trim().length > 0
    if (step === 2) return platforms.length > 0
    return true
  }

  const handleCreate = async () => {
    if (!name.trim()) return
    setSaving(true)
    setError('')

    try {
      // Step 1: Save campaign to DB
      const saveRes = await fetch('/api/campaigns', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authHeader(),
        },
        body: JSON.stringify({ name, description, goal, tone, platforms, audience }),
      })

      if (!saveRes.ok) {
        const err = await saveRes.json().catch(() => ({}))
        throw new Error(err.error || 'فشل في حفظ الحملة')
      }

      const { id: campaignId } = await saveRes.json()

      // Step 2: Trigger AI generation (non-blocking — redirect immediately)
      fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authHeader(),
        },
        body: JSON.stringify({ campaignId }),
      }).catch(() => {/* generation errors are handled on the campaign page */})

      // Redirect to campaign detail (will show generating state)
      router.push(`/campaigns/${campaignId}?generating=true`)
    } catch (err: any) {
      setError(err.message || 'حدث خطأ غير متوقع')
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/campaigns" className="p-2 rounded-lg hover:bg-white/5 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">حملة جديدة</h1>
          <p className="text-text-muted text-sm">الخطوة {step} من {totalSteps}</p>
        </div>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2">
        {steps.map((s) => {
          const Icon = s.icon
          return (
            <div key={s.num} className="flex items-center gap-2 flex-1">
              <div className={`flex items-center justify-center w-10 h-10 rounded-xl transition-all ${
                step >= s.num ? 'bg-amber text-black' : 'bg-white/5 text-text-muted'
              }`}>
                {step > s.num ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
              </div>
              <span className={`text-xs hidden sm:block ${step >= s.num ? 'text-text-primary' : 'text-text-muted'}`}>
                {s.label}
              </span>
              {s.num < totalSteps && <div className="flex-1 h-px bg-white/10 mx-2" />}
            </div>
          )
        })}
      </div>

      <div className="glass p-6" style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px' }}>

        {/* Step 1: Basic Info */}
        {step === 1 && (
          <div className="space-y-4">
            <h3 className="font-bold text-lg">المعلومات الأساسية</h3>
            <div>
              <label className="block text-sm font-medium mb-1.5">اسم الحملة <span className="text-red-400">*</span></label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="مثال: حملة إطلاق صيف 2026"
                className="input-nexus"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">وصف المنتج / الخدمة</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="اوصف المنتج أو الخدمة التي تريد الإعلان عنها..."
                rows={3}
                className="input-nexus resize-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">الهدف</label>
                <select value={goal} onChange={(e) => setGoal(e.target.value)} className="input-nexus">
                  {GOAL_OPTIONS.map((g) => (
                    <option key={g.value} value={g.value}>{g.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">الأسلوب</label>
                <select value={tone} onChange={(e) => setTone(e.target.value)} className="input-nexus">
                  {TONE_OPTIONS.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Platforms */}
        {step === 2 && (
          <div className="space-y-4">
            <h3 className="font-bold text-lg">المنصات الإعلانية</h3>
            <p className="text-text-muted text-sm">اختر منصة أو أكثر</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {PLATFORMS.map((p) => (
                <button
                  key={p}
                  onClick={() => togglePlatform(p)}
                  className={`p-4 rounded-xl border text-sm font-medium transition-all ${
                    platforms.includes(p)
                      ? 'border-amber bg-amber/10 text-amber'
                      : 'border-white/10 hover:border-white/20 text-text-secondary'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
            {platforms.length === 0 && (
              <p className="text-red-400 text-xs">اختر منصة واحدة على الأقل</p>
            )}
          </div>
        )}

        {/* Step 3: Audience */}
        {step === 3 && (
          <div className="space-y-4">
            <h3 className="font-bold text-lg">الجمهور المستهدف</h3>
            <div>
              <label className="block text-sm font-medium mb-1.5">صف جمهورك المثالي</label>
              <textarea
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                placeholder="مثال: شباب 18-35 سنة، مهتمين بالتقنية والموضة، في السعودية والإمارات، دخل متوسط إلى مرتفع"
                rows={5}
                className="input-nexus resize-none"
                autoFocus
              />
              <p className="text-text-muted text-xs mt-1.5">
                كلما كان الوصف أدق، كان المحتوى الذي ينشئه الـ AI أفضل
              </p>
            </div>
          </div>
        )}

        {/* Step 4: Review */}
        {step === 4 && (
          <div className="space-y-4">
            <h3 className="font-bold text-lg">مراجعة ونشر</h3>
            <div className="space-y-3 p-4 rounded-xl bg-white/5">
              <div className="flex justify-between">
                <span className="text-text-muted text-sm">اسم الحملة</span>
                <span className="font-medium">{name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted text-sm">الهدف</span>
                <span className="font-medium">{GOAL_OPTIONS.find(g => g.value === goal)?.label}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted text-sm">الأسلوب</span>
                <span className="font-medium">{TONE_OPTIONS.find(t => t.value === tone)?.label}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted text-sm">المنصات</span>
                <span className="font-medium">{platforms.join('، ')}</span>
              </div>
              {audience && (
                <div className="flex justify-between gap-4">
                  <span className="text-text-muted text-sm shrink-0">الجمهور</span>
                  <span className="font-medium text-sm text-left">{audience.slice(0, 60)}{audience.length > 60 ? '...' : ''}</span>
                </div>
              )}
            </div>

            <div className="p-4 rounded-xl bg-amber/5 border border-amber/20">
              <div className="flex items-start gap-3">
                <Wand2 className="w-5 h-5 text-amber shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-amber text-sm">AI سيولّد المحتوى تلقائياً</p>
                  <p className="text-text-muted text-xs mt-0.5">
                    بعد الإنشاء، ستنتقل إلى صفحة الحملة حيث يبدأ NEX في توليد الاستراتيجية والمحتوى والتقويم.
                  </p>
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

        {/* Navigation */}
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-white/10">
          <button
            onClick={() => setStep(s => s - 1)}
            disabled={step === 1}
            className="btn-secondary disabled:opacity-40"
          >
            <ChevronRight className="w-4 h-4" />
            السابق
          </button>

          {step < totalSteps ? (
            <button
              onClick={() => setStep(s => s + 1)}
              disabled={!canNext()}
              className="btn-primary disabled:opacity-40"
            >
              التالي
              <ChevronLeft className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleCreate}
              disabled={saving || !name.trim()}
              className="btn-primary disabled:opacity-40 min-w-[140px]"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  جاري الإنشاء...
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4" />
                  إنشاء مع AI
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
