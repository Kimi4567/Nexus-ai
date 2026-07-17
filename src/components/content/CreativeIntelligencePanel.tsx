'use client'

import { ArrowUpRight, Images, ScanSearch, ShieldCheck, Sparkles } from 'lucide-react'

interface CreativeIntelligencePanelProps {
  isAr: boolean
  totalAssets: number
  analyzedAssets: number
  pendingAssets: number
  batchSize: number
  matchedPosts: number
  totalPosts: number
  creditCost: number
  scanning: boolean
  locked: boolean
  onAnalyze: () => void
  onOpenMedia: () => void
}

export function CreativeIntelligencePanel({
  isAr,
  totalAssets,
  analyzedAssets,
  pendingAssets,
  batchSize,
  matchedPosts,
  totalPosts,
  creditCost,
  scanning,
  locked,
  onAnalyze,
  onOpenMedia,
}: CreativeIntelligencePanelProps) {
  const complete = totalAssets > 0 && pendingAssets === 0
  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_18px_55px_rgba(15,23,42,0.07)]">
      <div className="bg-slate-950 px-5 py-5 text-white sm:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-500/20 text-violet-200 ring-1 ring-violet-300/20">
              <Sparkles className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-violet-300">NEXUS CREATIVE INTELLIGENCE</p>
              <h2 className="mt-1 text-lg font-black sm:text-xl">
                {isAr ? 'طابق وسائطك الحقيقية مع خطة المحتوى' : 'Match your real media to the content plan'}
              </h2>
              <p className="mt-1 max-w-3xl text-xs leading-6 text-slate-300 sm:text-sm">
                {isAr
                  ? 'يحلل NEXUS ما يظهر فعلًا في الصور والفيديوهات، ثم يرشح الأصل الأنسب لكل بوست. لا يرفق أو يعدّل أو ينشر شيئًا دون قرارك.'
                  : 'NEXUS analyzes only what is visibly present, then recommends the best asset for each post. Nothing is attached, changed, or published without your decision.'}
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={onOpenMedia}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/15 px-4 text-xs font-bold text-white transition hover:bg-white/10"
            >
              <Images className="h-4 w-4" aria-hidden="true" />
              {isAr ? 'إضافة وسائط' : 'Add media'}
            </button>
            <button
              type="button"
              onClick={onAnalyze}
              disabled={scanning || batchSize === 0}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 text-xs font-black text-slate-950 transition hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <ScanSearch className={`h-4 w-4 ${scanning ? 'animate-pulse' : ''}`} aria-hidden="true" />
              {scanning
                ? (isAr ? 'جارٍ التحليل والمطابقة…' : 'Analyzing and matching…')
                : batchSize > 0
                  ? locked
                    ? (isAr ? 'أضف رصيدًا للتحليل' : 'Add credits to analyze')
                    : (isAr ? `حلّل ${batchSize} أصول — ${creditCost} كريديت` : `Analyze ${batchSize} assets — ${creditCost} credits`)
                  : complete
                    ? (isAr ? 'التحليل محدث' : 'Analysis is current')
                    : (isAr ? 'أضف وسائط قابلة للتحليل' : 'Add previewable media')}
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-px bg-slate-200 sm:grid-cols-3">
        <div className="bg-white p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">{isAr ? 'مكتبة الحملة' : 'Campaign library'}</p>
          <p className="mt-1 text-xl font-black text-slate-950">{analyzedAssets}/{totalAssets}</p>
          <p className="mt-1 text-xs text-slate-500">{isAr ? 'أصول محللة بأدلة مرئية' : 'assets analyzed from visual evidence'}</p>
        </div>
        <div className="bg-white p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">{isAr ? 'خطة المحتوى' : 'Content plan'}</p>
          <p className="mt-1 text-xl font-black text-slate-950">{matchedPosts}/{totalPosts}</p>
          <p className="mt-1 text-xs text-slate-500">{isAr ? 'بوستات لها تطابق قوي أو جزئي' : 'posts with a strong or partial match'}</p>
        </div>
        <div className="bg-white p-4">
          <div className="flex items-center gap-2 text-emerald-700">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            <p className="text-[10px] font-bold uppercase tracking-[0.14em]">{isAr ? 'حدود آمنة' : 'Safe boundary'}</p>
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-600">
            {isAr ? 'المطابقة اقتراح للمراجعة وليست موافقة أو إثبات أداء.' : 'Matching is a review recommendation, not approval or performance proof.'}
          </p>
          <button type="button" onClick={onOpenMedia} className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-violet-700">
            {isAr ? 'إدارة المكتبة' : 'Manage library'}
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </section>
  )
}
