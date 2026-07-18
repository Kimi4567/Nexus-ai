'use client'

import { ShieldCheck, Sparkles } from 'lucide-react'
import type { CreativeMediaCandidate } from '@/lib/creativeIntelligence'
import { CONTENT_HUB_REWRITE_COST } from '@/lib/contentHubActionSafety'

interface CreativeAdaptationModalProps {
  isAr: boolean
  postIndex: number
  media: CreativeMediaCandidate
  acknowledged: boolean
  adapting: boolean
  onAcknowledgedChange: (value: boolean) => void
  onClose: () => void
  onConfirm: () => void
}

export function CreativeAdaptationModal({
  isAr,
  postIndex,
  media,
  acknowledged,
  adapting,
  onAcknowledgedChange,
  onClose,
  onConfirm,
}: CreativeAdaptationModalProps) {
  const isVideo = String(media.type).toUpperCase() === 'VIDEO'
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: 'rgba(15,23,42,0.36)', backdropFilter: 'blur(12px)' }} onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="creative-adaptation-title" className="w-full max-w-xl overflow-hidden rounded-3xl bg-white shadow-2xl" onClick={event => event.stopPropagation()}>
        <div className="bg-slate-950 px-5 py-5 text-white">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-violet-300">NEXUS CREATIVE INTELLIGENCE</p>
              <h3 id="creative-adaptation-title" className="mt-1 text-xl font-black">{isAr ? 'ملاءمة النص مع الأصل الحقيقي' : 'Adapt copy to the real asset'}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                {isAr ? `سيعيد NEXUS كتابة نص البوست #${postIndex} ليتطابق بصدق مع ما يظهر في الأصل.` : `NEXUS will rewrite post #${postIndex} so it honestly matches what is visible in the asset.`}
              </p>
            </div>
            <button type="button" aria-label={isAr ? 'إغلاق نافذة ملاءمة النص' : 'Close copy adaptation'} onClick={onClose} disabled={adapting} className="text-2xl text-slate-400 hover:text-white disabled:opacity-40">×</button>
          </div>
        </div>

        <div className="p-5">
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
            {isVideo
              ? <video src={media.url} muted playsInline preload="metadata" className="h-20 w-20 rounded-xl object-cover" />
              : <img src={media.url} alt={media.fileName} className="h-20 w-20 rounded-xl object-cover" />}
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-slate-950">{media.fileName}</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                {isAr ? 'سيظل الأصل كما هو؛ التغيير سيكون في النص وربطه بالمنشور للمراجعة.' : 'The asset stays unchanged; only the copy and draft attachment are updated for review.'}
              </p>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-violet-200 bg-violet-50 p-4 text-xs leading-6 text-violet-950/80">
            <p className="flex items-center gap-2 font-black text-violet-950"><Sparkles className="h-4 w-4" aria-hidden="true" />{isAr ? 'عقد التنفيذ' : 'Execution contract'}</p>
            <p className="mt-2">✓ {isAr ? 'الحفاظ على هدف الاستراتيجية ونبرة البراند' : 'Preserve strategy objective and brand voice'}</p>
            <p>✓ {isAr ? 'إزالة أو تخفيف الادعاءات التي لا يدعمها الأصل' : 'Remove or soften claims the asset cannot support'}</p>
            <p>✓ {isAr ? `التكلفة: ${CONTENT_HUB_REWRITE_COST} كريديت` : `Cost: ${CONTENT_HUB_REWRITE_COST} credits`}</p>
            <p>— {isAr ? 'لا موافقة، لا جدولة، ولا نشر تلقائي' : 'No automatic approval, scheduling, or publishing'}</p>
          </div>

          <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 p-4">
            <input type="checkbox" checked={acknowledged} onChange={event => onAcknowledgedChange(event.target.checked)} disabled={adapting} className="mt-1" />
            <span className="text-xs font-semibold leading-6 text-slate-700">
              {isAr
                ? `أوافق على خصم ${CONTENT_HUB_REWRITE_COST} كريديت، وأفهم أن النص والوسائط سيعودان إلى حالة مسودة للمراجعة فقط.`
                : `I approve a ${CONTENT_HUB_REWRITE_COST}-credit charge and understand the copy and media return as a review-only draft.`}
            </span>
          </label>

          <div className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-[10px] font-semibold text-emerald-800">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            {isAr ? 'يُسترد الكريديت تلقائيًا إذا لم ينتج نص صالح محفوظ.' : 'Credits are restored automatically if no usable saved copy is produced.'}
          </div>

          <div className="mt-5 flex gap-3">
            <button type="button" onClick={onClose} disabled={adapting} className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600">{isAr ? 'إلغاء' : 'Cancel'}</button>
            <button type="button" onClick={onConfirm} disabled={!acknowledged || adapting} className="flex-1 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-40">
              {adapting ? (isAr ? 'جارٍ الملاءمة…' : 'Adapting…') : (isAr ? `ابدأ — ${CONTENT_HUB_REWRITE_COST} كريديت` : `Start — ${CONTENT_HUB_REWRITE_COST} credits`)}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
