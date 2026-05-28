'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ProtectedRoute } from '@/components/ui/ProtectedRoute'
import { ArrowLeft, Save, ChevronRight, ChevronLeft, Check, Target, Megaphone, DollarSign, Settings, Rocket } from 'lucide-react'

export default function NewCampaignPage() {
  const [step, setStep] = useState(1)
  const [name, setName] = useState('')
  const [platform, setPlatform] = useState('Facebook')
  const [objective, setObjective] = useState('مبيعات')
  const [budget, setBudget] = useState('')
  const [duration, setDuration] = useState('7')
  const [audience, setAudience] = useState('')
  const [saved, setSaved] = useState(false)

  const totalSteps = 5

  const nextStep = () => {
    if (step < totalSteps) setStep(step + 1)
  }

  const prevStep = () => {
    if (step > 1) setStep(step - 1)
  }

  const handleSave = () => {
    if (!name || !budget) return
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const steps = [
    { num: 1, label: 'الأساسية', icon: Target },
    { num: 2, label: 'المنصة', icon: Megaphone },
    { num: 3, label: 'الميزانية', icon: DollarSign },
    { num: 4, label: 'الجمهور', icon: Settings },
    { num: 5, label: 'المراجعة', icon: Rocket },
  ]

  return (
    <ProtectedRoute>
      <div className="space-y-6 max-w-3xl">
        <div className="flex items-center gap-3">
          <Link href="/campaigns" className="p-2 rounded-lg hover:bg-white/5 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold">حملة جديدة</h1>
            <p className="text-text-muted text-sm">إنشاء حملة إعلانية جديدة - الخطوة {step} من {totalSteps}</p>
          </div>
        </div>

        {/* Stepper */}
        <div className="flex items-center gap-2">
          {steps.map((s) => {
            const Icon = s.icon
            return (
              <div key={s.num} className="flex items-center gap-2 flex-1">
                <div
                  className={`flex items-center justify-center w-10 h-10 rounded-xl transition-all ${
                    step >= s.num
                      ? 'bg-amber text-black'
                      : 'bg-white/5 text-text-muted'
                  }`}
                >
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
              <h3 className="font-bold text-lg">معلومات أساسية</h3>
              <div>
                <label className="block text-sm font-medium mb-1.5">اسم الحملة</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: حملة صيف 2026" className="input-nexus" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">الهدف</label>
                <select value={objective} onChange={(e) => setObjective(e.target.value)} className="input-nexus">
                  <option value="مبيعات">مبيعات</option>
                  <option value="وعي">وعي بالعلامة</option>
                  <option value="تفاعل">تفاعل</option>
                  <option value="قيادة">قيادة (Leads)</option>
                </select>
              </div>
            </div>
          )}

          {/* Step 2: Platform */}
          {step === 2 && (
            <div className="space-y-4">
              <h3 className="font-bold text-lg">اختيار المنصة</h3>
              <div className="grid grid-cols-2 gap-3">
                {['Facebook', 'Instagram', 'TikTok', 'Google', 'Snapchat'].map((p) => (
                  <button
                    key={p}
                    onClick={() => setPlatform(p)}
                    className={`p-4 rounded-xl border text-sm font-medium transition-all ${
                      platform === p
                        ? 'border-amber bg-amber/10 text-amber'
                        : 'border-white/10 hover:border-white/20'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Budget */}
          {step === 3 && (
            <div className="space-y-4">
              <h3 className="font-bold text-lg">الميزانية والمدة</h3>
              <div>
                <label className="block text-sm font-medium mb-1.5">الميزانية ($)</label>
                <input type="number" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="2500" className="input-nexus" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">المدة (أيام)</label>
                <select value={duration} onChange={(e) => setDuration(e.target.value)} className="input-nexus">
                  <option value="7">7 أيام</option>
                  <option value="14">14 يوم</option>
                  <option value="30">30 يوم</option>
                  <option value="60">60 يوم</option>
                </select>
              </div>
              {budget && (
                <div className="p-4 rounded-xl bg-white/5">
                  <p className="text-sm text-text-muted">الميزانية اليومية التقديرية</p>
                  <p className="text-xl font-bold text-amber">${(Number(budget) / Number(duration)).toFixed(0)}/يوم</p>
                </div>
              )}
            </div>
          )}

          {/* Step 4: Audience */}
          {step === 4 && (
            <div className="space-y-4">
              <h3 className="font-bold text-lg">الجمهور المستهدف</h3>
              <div>
                <label className="block text-sm font-medium mb-1.5">وصف الجمهور</label>
                <textarea
                  value={audience}
                  onChange={(e) => setAudience(e.target.value)}
                  placeholder="مثال: شباب 18-35 سنة، مهتمين بالتقنية، في دبي والإمارات"
                  rows={4}
                  className="input-nexus resize-none"
                />
              </div>
            </div>
          )}

          {/* Step 5: Review */}
          {step === 5 && (
            <div className="space-y-4">
              <h3 className="font-bold text-lg">مراجعة الحملة</h3>
              <div className="space-y-3 p-4 rounded-xl bg-white/5">
                <div className="flex justify-between">
                  <span className="text-text-muted text-sm">الاسم</span>
                  <span className="font-medium">{name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted text-sm">الهدف</span>
                  <span className="font-medium">{objective}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted text-sm">المنصة</span>
                  <span className="font-medium">{platform}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted text-sm">الميزانية</span>
                  <span className="font-medium">${budget}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted text-sm">المدة</span>
                  <span className="font-medium">{duration} أيام</span>
                </div>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-white/10">
            <button
              onClick={prevStep}
              disabled={step === 1}
              className="btn-secondary disabled:opacity-50"
            >
              <ChevronRight className="w-4 h-4" />
              السابق
            </button>

            {step < totalSteps ? (
              <button onClick={nextStep} className="btn-primary">
                التالي
                <ChevronLeft className="w-4 h-4" />
              </button>
            ) : (
              <button onClick={handleSave} className="btn-primary">
                <Save className="w-4 h-4" />
                إنشاء الحملة
              </button>
            )}
          </div>

          {saved && (
            <div className="mt-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm text-center">
              ✅ تم إنشاء الحملة بنجاح
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  )
}
