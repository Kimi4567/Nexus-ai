'use client'

import { useState } from 'react'
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
  const [productName, setProductName] = useState('')
  const [description, setDescription] = useState('')
  const [style, setStyle] = useState('تسويقي')
  const [voice, setVoice] = useState('رجالي')
  const [music, setMusic] = useState('حيوي')
  const [duration, setDuration] = useState(30)
  const [script, setScript] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [jobs, setJobs] = useState<VideoJob[]>([
    { id: '1', title: 'إعلان القهوة', status: 'ready', progress: 100, createdAt: '2026-05-28' },
    { id: '2', title: 'ترويج التطبيق', status: 'generating', progress: 65, createdAt: '2026-05-28' },
    { id: '3', title: 'فيديو المنتج الجديد', status: 'pending', progress: 0, createdAt: '2026-05-27' },
  ])

  const handleGenerate = async () => {
    if (!productName) return
    setLoading(true)
    const result = await generateVideoScript(productName, description, style)
    setScript(result)
    setLoading(false)

    const newJob: VideoJob = {
      id: Date.now().toString(),
      title: productName,
      status: 'generating',
      progress: 0,
      createdAt: new Date().toISOString().split('T')[0],
    }
    setJobs(prev => [newJob, ...prev])

    let progress = 0
    const interval = setInterval(() => {
      progress += 10
      setJobs(prev => prev.map(j => j.id === newJob.id ? { ...j, progress } : j))
      if (progress >= 100) {
        clearInterval(interval)
        setJobs(prev => prev.map(j => j.id === newJob.id ? { ...j, status: 'ready', progress: 100 } : j))
      }
    }, 500)
  }

  const copyToClipboard = () => {
    navigator.clipboard.writeText(script)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const toggleJobStatus = (id: string) => {
    setJobs(prev => prev.map(j => j.id === id ? { ...j, status: j.status === 'generating' ? 'pending' : 'generating' } : j))
  }

  const deleteJob = (id: string) => {
    setJobs(prev => prev.filter(j => j.id !== id))
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold">استوديو NEX</h1>
        <p className="text-text-muted text-sm">انتج فيديوهات تسويقية بالذكاء الاصطناعي</p>
      </div>

      {/* Generation Form */}
      <div className="glass p-6 space-y-4" style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px' }}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">اسم المنتج/الخدمة</label>
            <div className="relative">
              <Type className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
              <input type="text" value={productName} onChange={(e) => setProductName(e.target.value)} placeholder="مثال: قهوة عربية فاخرة" className="input-nexus pr-10" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">الأسلوب</label>
            <div className="relative">
              <Layers className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
              <select value={style} onChange={(e) => setStyle(e.target.value)} className="input-nexus pr-10">
                <option value="تسويقي">تسويقي</option>
                <option value="تعليمي">تعليمي</option>
                <option value="ترفيهي">ترفيهي</option>
                <option value="عاطفي">عاطفي</option>
                <option value="احترافي">احترافي</option>
              </select>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">الوصف</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="صف المنتج باختصار..." rows={3} className="input-nexus resize-none" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">الصوت</label>
            <div className="relative">
              <Mic className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
              <select value={voice} onChange={(e) => setVoice(e.target.value)} className="input-nexus pr-10">
                <option value="رجالي">رجالي</option>
                <option value="نسائي">نسائي</option>
                <option value="شبابي">شبابي</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">الموسيقى</label>
            <div className="relative">
              <Music className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
              <select value={music} onChange={(e) => setMusic(e.target.value)} className="input-nexus pr-10">
                <option value="حيوي">حيوي</option>
                <option value="هادئ">هادئ</option>
                <option value="درامي">درامي</option>
                <option value="بدون">بدون موسيقى</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">المدة: {duration} ثانية</label>
            <div className="relative">
              <Clock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
              <input type="range" min="15" max="120" step="5" value={duration} onChange={(e) => setDuration(Number(e.target.value))} className="w-full mt-2" />
            </div>
          </div>
        </div>

        <button onClick={handleGenerate} disabled={loading || !productName} className="btn-primary w-full">
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Wand2 className="w-5 h-5" />}
          {loading ? 'جاري الإنشاء...' : 'إنشاء السكريبت والفيديو'}
        </button>
      </div>

      {/* Script Output */}
      {script && (
        <div className="glass p-6" style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px' }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Film className="w-5 h-5 text-amber" />
              <h3 className="font-bold">السكريبت المولد</h3>
            </div>
            <button onClick={copyToClipboard} className="flex items-center gap-1 text-sm text-text-muted hover:text-text-primary transition-colors">
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'تم النسخ' : 'نسخ'}
            </button>
          </div>
          <div className="p-4 rounded-xl bg-white/5 text-sm leading-relaxed whitespace-pre-wrap">
            {script}
          </div>
        </div>
      )}

      {/* Video Job Queue */}
      <div className="glass p-6" style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px' }}>
        <div className="flex items-center gap-2 mb-4">
          <Play className="w-5 h-5 text-cyan" />
          <h3 className="font-bold">قائمة الفيديوهات</h3>
        </div>
        <div className="space-y-3">
          {jobs.map((job) => (
            <div key={job.id} className="flex items-center gap-4 p-4 rounded-xl bg-white/5">
              <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center">
                {job.status === 'ready' ? <Film className="w-5 h-5 text-emerald-400" /> :
                 job.status === 'generating' ? <Loader2 className="w-5 h-5 text-amber animate-spin" /> :
                 <Clock className="w-5 h-5 text-text-muted" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{job.title}</p>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${job.status === 'ready' ? 'bg-emerald-400' : 'bg-amber'}`} style={{ width: `${job.progress}%` }} />
                  </div>
                  <span className="text-xs text-text-muted w-10">{job.progress}%</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => toggleJobStatus(job.id)} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors">
                  {job.status === 'generating' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </button>
                <button onClick={() => deleteJob(job.id)} className="p-1.5 rounded-lg hover:bg-white/5 text-red-400 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                </button>
              </div>
            </div>
          ))}
          {jobs.length === 0 && (
            <p className="text-center text-text-muted py-8">لا توجد فيديوهات في قائمة الانتظار</p>
          )}
        </div>
      </div>
    </div>
  )
}
