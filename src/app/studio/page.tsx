'use client'

import { useState, useEffect } from 'react'
import { generateVideoScript } from '@/services/openai'
import {
  Wand2, Loader2, Film, Copy, Play, Sparkles, Clapperboard, Music, Mic,
  Type, Layers, Star, Rocket, ChevronLeft, Clock, Zap
} from 'lucide-react'

/* ═══════════════════════════════════════════════════════════════
   STUDIO NEX — Creative Lab in the Cosmos
   Where ideas are forged in starlight.
   ═══════════════════════════════════════════════════════════════ */

interface VideoJob {
  id: string
  title: string
  status: 'pending' | 'generating' | 'ready' | 'failed'
  progress: number
  createdAt: string
  duration: string
  scenes: number
}

// Animated star field
function CreativeStars() {
  const [stars, setStars] = useState<{ x: number; y: number; size: number; delay: number; duration: number }[]>([])

  useEffect(() => {
    const newStars = Array.from({ length: 60 }, () => ({
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 1.5 + 0.3,
      delay: Math.random() * 8,
      duration: Math.random() * 4 + 3,
    }))
    setStars(newStars)
  }, [])

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
      {stars.map((star, i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            left: `${star.x}%`,
            top: `${star.y}%`,
            width: `${star.size}px`,
            height: `${star.size}px`,
            background: i % 3 === 0 ? 'rgba(245,158,11,0.7)' : i % 3 === 1 ? 'rgba(6,182,212,0.6)' : 'rgba(255,255,255,0.5)',
            boxShadow: `0 0 ${star.size * 4}px ${i % 3 === 0 ? 'rgba(245,158,11,0.3)' : i % 3 === 1 ? 'rgba(6,182,212,0.25)' : 'rgba(255,255,255,0.2)'}`,
            animation: `creativeTwinkle ${star.duration}s ease-in-out ${star.delay}s infinite`,
          }}
        />
      ))}
      <style jsx>{`
        @keyframes creativeTwinkle {
          0%, 100% { opacity: 0.15; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.3); }
        }
      `}</style>
    </div>
  )
}

// Floating creative orbs
function CreativeOrbs() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
      <div
        className="absolute w-[600px] h-[600px] rounded-full opacity-15 blur-[120px]"
        style={{
          background: 'radial-gradient(circle, rgba(245,158,11,0.12), transparent 70%)',
          top: '15%',
          left: '-10%',
          animation: 'float 10s ease-in-out infinite',
        }}
      />
      <div
        className="absolute w-[500px] h-[500px] rounded-full opacity-12 blur-[100px]"
        style={{
          background: 'radial-gradient(circle, rgba(139,92,246,0.1), transparent 70%)',
          bottom: '10%',
          right: '-5%',
          animation: 'float 12s ease-in-out infinite reverse',
        }}
      />
    </div>
  )
}

const styles = [
  { value: 'marketing', label: 'تسويقي', icon: Zap, desc: 'مباشر ومقنع' },
  { value: 'educational', label: 'تعليمي', icon: Type, desc: 'واضح وبسيط' },
  { value: 'entertaining', label: 'ترفيهي', icon: Sparkles, desc: 'مرح وجذاب' },
  { value: 'emotional', label: 'عاطفي', icon: Music, desc: 'مؤثر وعميق' },
  { value: 'cinematic', label: 'سينمائي', icon: Clapperboard, desc: 'درامي ومبهر' },
]

const durations = [
  { value: '15', label: '15 ثانية', desc: 'Reels & Shorts' },
  { value: '30', label: '30 ثانية', desc: 'إعلان قصير' },
  { value: '60', label: '60 ثانية', desc: 'إعلان متوسط' },
  { value: '90', label: '90 ثانية', desc: 'سرد قصصي' },
]

export default function StudioPage() {
  const [product, setProduct] = useState('')
  const [description, setDescription] = useState('')
  const [style, setStyle] = useState('marketing')
  const [duration, setDuration] = useState('30')
  const [script, setScript] = useState('')
  const [loading, setLoading] = useState(false)
  const [generatingEffect, setGeneratingEffect] = useState(false)
  const [jobs] = useState<VideoJob[]>([
    { id: '1', title: 'إعلان منتج X', status: 'ready', progress: 100, createdAt: '2026-05-28', duration: '30s', scenes: 4 },
    { id: '2', title: 'فيديو تعليمي Y', status: 'generating', progress: 65, createdAt: '2026-05-28', duration: '60s', scenes: 6 },
    { id: '3', title: 'ترويج خدمة Z', status: 'pending', progress: 0, createdAt: '2026-05-28', duration: '15s', scenes: 3 },
  ])

  const handleGenerate = async () => {
    if (!product || !description) return
    setLoading(true)
    setGeneratingEffect(true)
    try {
      const result = await generateVideoScript(product, description, style)
      setScript(result)
    } catch (e) {
      setScript('حدث خطأ أثناء توليد السكريبت. يرجى المحاولة مرة أخرى.')
    }
    setLoading(false)
    setTimeout(() => setGeneratingEffect(false), 2000)
  }

  const statusConfig: Record<string, { label: string; color: string; bg: string; icon: any }> = {
    pending: {
      label: 'معلّق',
      color: 'text-yellow-400',
      bg: 'bg-yellow-500/10 border-yellow-500/20',
      icon: Clock,
    },
    generating: {
      label: 'جاري الإنشاء',
      color: 'text-cyan-400',
      bg: 'bg-cyan-500/10 border-cyan-500/20',
      icon: Loader2,
    },
    ready: {
      label: 'جاهز',
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10 border-emerald-500/20',
      icon: Play,
    },
    failed: {
      label: 'فشل',
      color: 'text-red-400',
      bg: 'bg-red-500/10 border-red-500/20',
      icon: ChevronLeft,
    },
  }

  return (
    <div className="relative min-h-screen space-y-8">
      <CreativeStars />
      <CreativeOrbs />

      <div className="relative z-10">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber/20 to-orange/10 flex items-center justify-center">
              <Film className="w-4 h-4 text-amber" />
            </div>
            <span className="text-xs text-amber/70 font-mono tracking-wider">NEX STUDIO</span>
          </div>
          <h1 className="text-3xl font-bold mb-2">استوديو NEX</h1>
          <p className="text-text-muted text-sm">
            أنشئ سكريبتات فيديو سينمائية بالذكاء الاصطناعي. اكتب الوصف، واترك NEX يصنع السحر.
          </p>
        </div>

        {/* Creative Input Panel */}
        <div
          className="p-8 mb-8 corner-accent"
          style={{
            background: 'rgba(255,255,255,0.02)',
            backdropFilter: 'blur(30px)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '24px',
          }}
        >
          {/* Product Input */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2 flex items-center gap-2">
              <Star className="w-4 h-4 text-amber" />
              اسم المنتج أو الخدمة
            </label>
            <input
              type="text"
              value={product}
              onChange={(e) => setProduct(e.target.value)}
              placeholder="مثال: تطبيق fitness للياقة البدنية"
              className="input-nexus text-lg"
            />
          </div>

          {/* Description */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2 flex items-center gap-2">
              <Type className="w-4 h-4 text-cyan" />
              الوصف والتفاصيل
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="صف المنتج بالتفصيل: الجمهور المستهدف، المميزات الرئيسية، الرسالة اللي عايز توصلها..."
              className="input-nexus resize-none"
              rows={4}
            />
          </div>

          {/* Style Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-3 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-400" />
              الأسلوب الإبداعي
            </label>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {styles.map((s) => {
                const Icon = s.icon
                const isSelected = style === s.value
                return (
                  <button
                    key={s.value}
                    onClick={() => setStyle(s.value)}
                    className={`p-4 rounded-xl border text-center transition-all duration-300 ${
                      isSelected
                        ? 'border-amber/40 bg-amber/5 shadow-lg shadow-amber/5'
                        : 'border-white/8 bg-white/3 hover:bg-white/5 hover:border-white/15'
                    }`}
                  >
                    <Icon className={`w-5 h-5 mx-auto mb-2 ${isSelected ? 'text-amber' : 'text-text-muted'}`} />
                    <p className={`text-sm font-medium ${isSelected ? 'text-text-primary' : 'text-text-secondary'}`}>
                      {s.label}
                    </p>
                    <p className="text-[10px] text-text-muted mt-1">{s.desc}</p>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Duration Selection */}
          <div className="mb-8">
            <label className="block text-sm font-medium mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-400" />
              المدة الزمنية
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {durations.map((d) => {
                const isSelected = duration === d.value
                return (
                  <button
                    key={d.value}
                    onClick={() => setDuration(d.value)}
                    className={`p-3 rounded-xl border text-center transition-all duration-300 ${
                      isSelected
                        ? 'border-cyan/40 bg-cyan/5 shadow-lg shadow-cyan/5'
                        : 'border-white/8 bg-white/3 hover:bg-white/5 hover:border-white/15'
                    }`}
                  >
                    <p className={`text-sm font-bold ${isSelected ? 'text-cyan' : 'text-text-primary'}`}>
                      {d.label}
                    </p>
                    <p className="text-[10px] text-text-muted mt-1">{d.desc}</p>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={loading || !product || !description}
            className="btn-primary btn-3d text-lg px-8 py-4 w-full md:w-auto relative overflow-hidden"
          >
            {generatingEffect && (
              <div className="absolute inset-0 bg-gradient-to-r from-amber/0 via-amber/20 to-amber/0 animate-shimmer" />
            )}
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                NEX يُبدع السكريبت...
              </>
            ) : (
              <>
                <Wand2 className="w-5 h-5" />
                توليد السكريبت السينمائي
                <Sparkles className="w-5 h-5" />
              </>
            )}
          </button>
        </div>

        {/* Generated Script */}
        {script && (
          <div
            className="p-8 mb-8 corner-accent energy-ring"
            style={{
              background: 'rgba(245,158,11,0.02)',
              backdropFilter: 'blur(30px)',
              border: '1px solid rgba(245,158,11,0.1)',
              borderRadius: '24px',
            }}
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber/10 flex items-center justify-center">
                  <Clapperboard className="w-5 h-5 text-amber" />
                </div>
                <div>
                  <h3 className="font-bold">السكريبت المُولّد</h3>
                  <p className="text-xs text-text-muted">بواسطة NEX — منتج الفيديو</p>
                </div>
              </div>
              <button
                onClick={() => navigator.clipboard.writeText(script)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 transition-all border border-white/10 text-sm"
              >
                <Copy className="w-4 h-4" />
                نسخ
              </button>
            </div>
            <div className="p-6 rounded-xl bg-black/20 border border-white/5">
              <pre className="text-sm text-text-secondary whitespace-pre-wrap font-medium leading-relaxed">
                {script}
              </pre>
            </div>
            <div className="flex items-center gap-4 mt-6">
              <div className="flex items-center gap-2 text-xs text-text-muted">
                <Mic className="w-3 h-3" />
                <span>صوت وصفي متاح</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-text-muted">
                <Music className="w-3 h-3" />
                <span>موسيقى خلفية مقترحة</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-text-muted">
                <Layers className="w-3 h-3" />
                <span>4 مشاهد</span>
              </div>
            </div>
          </div>
        )}

        {/* Video Jobs */}
        <div
          className="p-8"
          style={{
            background: 'rgba(255,255,255,0.02)',
            backdropFilter: 'blur(30px)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '24px',
          }}
        >
          <div className="flex items-center gap-2 mb-6">
            <Rocket className="w-5 h-5 text-cyan" />
            <h3 className="text-xl font-bold">المشاريع السينمائية</h3>
          </div>

          <div className="space-y-4">
            {jobs.map((job) => {
              const config = statusConfig[job.status]
              const StatusIcon = config.icon
              return (
                <div
                  key={job.id}
                  className="flex items-center gap-4 p-5 rounded-xl bg-white/3 hover:bg-white/5 transition-all border border-transparent hover:border-white/8"
                >
                  {/* Thumbnail */}
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-amber/10 to-purple/5 flex items-center justify-center shrink-0">
                    <Film className="w-6 h-6 text-amber/70" />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm mb-1">{job.title}</p>
                    <div className="flex items-center gap-3 text-xs text-text-muted">
                      <span>{job.createdAt}</span>
                      <span className="w-1 h-1 rounded-full bg-white/20" />
                      <span>{job.duration}</span>
                      <span className="w-1 h-1 rounded-full bg-white/20" />
                      <span>{job.scenes} مشاهد</span>
                    </div>
                  </div>

                  {/* Status */}
                  <div className="flex items-center gap-4">
                    {/* Progress bar for generating */}
                    {job.status === 'generating' && (
                      <div className="w-24">
                        <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden mb-1">
                          <div
                            className="h-full bg-gradient-to-l from-cyan to-blue rounded-full transition-all duration-1000"
                            style={{ width: `${job.progress}%` }}
                          />
                        </div>
                        <p className="text-[10px] text-cyan text-center">{job.progress}%</p>
                      </div>
                    )}

                    <span className={`text-xs px-3 py-1.5 rounded-full border flex items-center gap-1.5 ${config.bg} ${config.color}`}>
                      <StatusIcon className={`w-3 h-3 ${job.status === 'generating' ? 'animate-spin' : ''}`} />
                      {config.label}
                    </span>

                    {job.status === 'ready' && (
                      <button className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 transition-all border border-white/10">
                        <Play className="w-4 h-4 text-emerald-400" />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}