'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { ProtectedRoute } from '@/components/ui/ProtectedRoute'
import { generateVideoScript } from '@/services/openai'
import { Wand2, Loader2, Film, Copy, Check, Play, Pause, Clock, Music, Mic, Type, Layers } from 'lucide-react'

interface VideoJob {
  id: string
  title: string
  status: 'pending' | 'generating' | 'ready' | 'failed'
  progress: number
  createdAt: string
}

export default function StudioPage() {
  const [product, setProduct] = useState('')
  const [description, setDescription] = useState('')
  const [style, setStyle] = useState('marketing')
  const [script, setScript] = useState('')
  const [loading, setLoading] = useState(false)
  const [jobs, setJobs] = useState<VideoJob[]>([
    { id: '1', title: 'إعلان منتج X', status: 'ready', progress: 100, createdAt: '2026-05-28' },
    { id: '2', title: 'فيديو تعليمي Y', status: 'generating', progress: 65, createdAt: '2026-05-28' },
    { id: '3', title: 'ترويج خدمة Z', status: 'pending', progress: 0, createdAt: '2026-05-28' },
  ])

  const handleGenerate = async () => {
    if (!product || !description) return
    setLoading(true)
    const result = await generateVideoScript(product, description, style)
    setScript(result)
    setLoading(false)
  }

  const statusColors: Record<string, string> = {
    pending: 'text-yellow-500',
    generating: 'text-cyan-500',
    ready: 'text-emerald-500',
    failed: 'text-red-500',
  }

  const statusLabels: Record<string, string> = {
    pending: 'معلّق',
    generating: 'جاري الإنشاء',
    ready: 'جاهز',
    failed: 'فشل',
  }

  return (
    <ProtectedRoute>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">استوديو NEX</h1>
          <p className="text-text-muted text-sm">أنتج فيديوهات تسويقية بالذكاء الاصطناعي</p>
        </div>

        {/* Generator Form */}
        <div className="glass p-6" style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px' }}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">اسم المنتج/الخدمة</label>
              <input
                type="text"
                value={product}
                onChange={(e) => setProduct(e.target.value)}
                placeholder="مثال: تطبيق fitness"
                className="input-nexus"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">الأسلوب</label>
              <select
                value={style}
                onChange={(e) => setStyle(e.target.value)}
                className="input-nexus"
              >
                <option value="marketing">تسويقي</option>
                <option value="educational">تعليمي</option>
                <option value="entertaining">ترفيهي</option>
                <option value="emotional">عاطفي</option>
              </select>
            </div>
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1.5">الوصف</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="صف المنتج أو الخدمة بالتفصيل..."
              className="input-nexus"
              rows={3}
            />
          </div>
          <button
            onClick={handleGenerate}
            disabled={loading || !product || !description}
            className="btn-primary"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
            {loading ? 'جاري التوليد...' : 'توليد السكريبت'}
          </button>

          {script && (
            <div className="mt-4 p-4 rounded-xl bg-white/5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">السكريبت:</span>
                <button
                  onClick={() => navigator.clipboard.writeText(script)}
                  className="text-xs text-amber hover:text-amber-dark transition-colors"
                >
                  <Copy className="w-4 h-4" />
                  نسخ
                </button>
              </div>
              <p className="text-sm text-text-secondary whitespace-pre-wrap">{script}</p>
            </div>
          )}
        </div>

        {/* Jobs List */}
        <div className="glass p-6" style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px' }}>
          <h3 className="text-lg font-bold mb-4">الفيديوهات</h3>
          <div className="space-y-3">
            {jobs.map((job) => (
              <div key={job.id} className="flex items-center gap-4 p-4 rounded-xl bg-white/5">
                <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center">
                  <Film className="w-5 h-5 text-amber" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm">{job.title}</p>
                  <p className="text-xs text-text-muted">{job.createdAt}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-medium ${statusColors[job.status]}`}>
                    {statusLabels[job.status]}
                  </span>
                  {job.status === 'generating' && (
                    <div className="w-24 h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-cyan rounded-full transition-all"
                        style={{ width: `${job.progress}%` }}
                      />
                    </div>
                  )}
                  {job.status === 'ready' && (
                    <button className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors">
                      <Play className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}
