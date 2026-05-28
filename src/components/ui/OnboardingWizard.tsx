'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import AgentAvatar from '@/components/ui/AgentAvatar'
import {
  Rocket, ChevronLeft, Globe, Zap, Target, Sparkles, Check,
  Film, Megaphone, BarChart3, Shield, ArrowLeft
} from 'lucide-react'

/* ═══════════════════════════════════════════════════════════════
   ONBOARDING WIZARD — First-Time User Journey
   Guides new users through their first 3 steps:
   1. Welcome + Choose business type
   2. Connect first platform
   3. Launch first campaign (auto-demo)
   ═══════════════════════════════════════════════════════════════ */

const STEPS = [
  {
    id: 'welcome',
    title: 'أهلاً بيك في NEXUS 🚀',
    subtitle: 'مركبتك جاهزة للإطلاق. خلينا نجهزها في ٣ خطوات سريعة.',
  },
  {
    id: 'connect',
    title: 'اربط أول منصة',
    subtitle: 'VEX يحتاج منصة عشان يبدأ يشتغل. اختار المنصة اللي تهمك.',
  },
  {
    id: 'launch',
    title: 'اطلق أول حملة',
    subtitle: 'كُل حاجة جهزة. اضغط زر الإطلاق وشوف الوكلاء يشتغلوا.',
  },
]

const PLATFORMS = [
  { name: 'Meta', icon: 'M', color: '#1877F2', desc: 'فيسبوك + إنستجرام' },
  { name: 'TikTok', icon: 'T', color: '#FE2C55', desc: 'فيديوهات قصيرة' },
  { name: 'Google', icon: 'G', color: '#4285F4', desc: 'بحث + يوتيوب' },
]

const BUSINESS_TYPES = [
  { value: 'ecommerce', label: 'متجر إلكتروني', icon: '🛒' },
  { value: 'service', label: 'خدمات', icon: '🔧' },
  { value: 'saas', label: 'تطبيق / SaaS', icon: '💻' },
  { value: 'brand', label: 'علامة تجارية', icon: '🏷️' },
  { value: 'local', label: 'محل / مطعم', icon: '🏪' },
]

export default function OnboardingWizard() {
  const [step, setStep] = useState(0)
  const [selectedPlatform, setSelectedPlatform] = useState('Meta')
  const [businessType, setBusinessType] = useState('')
  const [launched, setLaunched] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const done = localStorage.getItem('nexus_onboarding_done')
    if (done === 'true') setDismissed(true)
  }, [])

  if (dismissed) return null

  const currentStep = STEPS[step]

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1)
    } else {
      localStorage.setItem('nexus_onboarding_done', 'true')
      setDismissed(true)
    }
  }

  const handleLaunch = () => {
    setLaunched(true)
    setTimeout(() => {
      localStorage.setItem('nexus_onboarding_done', 'true')
      router.push('/dashboard')
    }, 2500)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(20px)' }}>
      <div
        className="w-full max-w-xl p-8 corner-accent relative overflow-hidden"
        style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '24px',
        }}
      >
        {/* Ambient glow */}
        <div className="absolute w-[300px] h-[300px] rounded-full opacity-10 blur-[80px] -top-20 -right-20 pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(245,158,11,0.2), transparent 70%)' }}
        />

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-8">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                i <= step ? 'bg-amber text-black' : 'bg-white/5 text-text-muted'
              }`}>
                {i < step ? <Check className="w-4 h-4" /> : i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div className={`w-8 h-px transition-all ${i < step ? 'bg-amber' : 'bg-white/10'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-2">{currentStep.title}</h2>
          <p className="text-text-muted text-sm">{currentStep.subtitle}</p>
        </div>

        {/* Step 1: Welcome + Business Type */}
        {step === 0 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {BUSINESS_TYPES.map((bt) => (
                <button
                  key={bt.value}
                  onClick={() => setBusinessType(bt.value)}
                  className={`p-4 rounded-xl border text-center transition-all ${
                    businessType === bt.value
                      ? 'border-amber/40 bg-amber/5'
                      : 'border-white/8 bg-white/3 hover:bg-white/5'
                  }`}
                >
                  <div className="text-2xl mb-2">{bt.icon}</div>
                  <p className="text-sm font-medium">{bt.label}</p>
                </button>
              ))}
            </div>

            {/* Agent preview */}
            <div className="flex items-center justify-center gap-4 py-4">
              {['NEX', 'VEX', 'PULSE', 'Sentinel'].map((agent) => (
                <div key={agent} className="text-center">
                  <AgentAvatar name={agent as any} size="sm" animate={false} />
                  <p className="text-[10px] text-text-muted mt-1">{agent}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Connect Platform */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="space-y-3">
              {PLATFORMS.map((platform) => (
                <button
                  key={platform.name}
                  onClick={() => setSelectedPlatform(platform.name)}
                  className={`w-full flex items-center gap-4 p-4 rounded-xl border text-left transition-all ${
                    selectedPlatform === platform.name
                      ? 'border-cyan/40 bg-cyan/5'
                      : 'border-white/8 bg-white/3 hover:bg-white/5'
                  }`}
                >
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold"
                    style={{ background: platform.color + '20', color: platform.color }}
                  >
                    {platform.icon}
                  </div>
                  <div>
                    <p className="font-medium">{platform.name}</p>
                    <p className="text-xs text-text-muted">{platform.desc}</p>
                  </div>
                  {selectedPlatform === platform.name && (
                    <div className="mr-auto w-5 h-5 rounded-full bg-cyan flex items-center justify-center">
                      <Check className="w-3 h-3 text-black" />
                    </div>
                  )}
                </button>
              ))}
            </div>

            <div className="p-4 rounded-xl bg-white/3 border border-white/8">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-4 h-4 text-amber" />
                <p className="text-sm font-medium">لماذا Meta أولاً؟</p>
              </div>
              <p className="text-xs text-text-muted">
                80% من عملائنا يبدأون بـ Meta لأنه يوفر أفضل نتائج للمتاجر والعلامات التجارية في الشرق الأوسط.
              </p>
            </div>
          </div>
        )}

        {/* Step 3: Launch */}
        {step === 2 && (
          <div className="space-y-6 text-center">
            {!launched ? (
              <>
                <div className="flex items-center justify-center gap-6 py-4">
                  <div className="text-center">
                    <AgentAvatar name="VEX" size="md" />
                    <p className="text-xs text-cyan mt-2">VEX</p>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Sparkles className="w-4 h-4 text-amber animate-pulse" />
                    <div className="w-8 h-px bg-amber/30" />
                  </div>
                  <div className="text-center">
                    <AgentAvatar name="NEX" size="md" />
                    <p className="text-xs text-amber mt-2">NEX</p>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-white/3 border border-white/8 text-right">
                  <div className="flex items-center gap-2 mb-3">
                    <Target className="w-4 h-4 text-amber" />
                    <p className="text-sm font-medium">حملة تجريبية جاهزة:</p>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-text-secondary">اسم المنتج: تيشيرت صيفي قطني</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-text-secondary">المنصة: {selectedPlatform}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-text-secondary">الميزانية: $300 / ٧ أيام</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-text-secondary">الهدف: مبيعات + وعي</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleLaunch}
                  className="btn-primary btn-3d text-lg py-4 px-8 w-full"
                >
                  <Rocket className="w-5 h-5" />
                  إطلاق الحملة التجريبية
                  <Sparkles className="w-5 h-5" />
                </button>
              </>
            ) : (
              <div className="py-8">
                <div className="w-20 h-20 mx-auto mb-6 relative">
                  <div className="absolute inset-0 rounded-full border-4 border-amber/20 border-t-amber animate-spin" />
                  <Rocket className="w-8 h-8 text-amber absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                </div>
                <p className="text-xl font-bold mb-2">VEX بيُطلق الحملة...</p>
                <p className="text-sm text-text-muted">NEX بيولد الفيديو · PULSE بيُحلل · Sentinel بيراقب</p>
              </div>
            )}
          </div>
        )}

        {/* Footer buttons */}
        <div className="flex items-center justify-between mt-8">
          <button
            onClick={() => {
              localStorage.setItem('nexus_onboarding_done', 'true')
              setDismissed(true)
            }}
            className="text-xs text-text-muted hover:text-text-primary transition-colors"
          >
            تخطي الـ Onboarding
          </button>

          {step < STEPS.length - 1 ? (
            <button
              onClick={handleNext}
              disabled={step === 0 && !businessType}
              className="btn-primary text-sm py-2.5 px-6 btn-3d flex items-center gap-2 disabled:opacity-50"
            >
              الخطوة التالية
              <ChevronLeft className="w-4 h-4" />
            </button>
          ) : (
            !launched && (
              <button
                onClick={handleNext}
                className="btn-primary text-sm py-2.5 px-6 btn-3d flex items-center gap-2"
              >
                ابدأ الاستكشاف
                <ArrowLeft className="w-4 h-4" />
              </button>
            )
          )}
        </div>
      </div>
    </div>
  )
}
