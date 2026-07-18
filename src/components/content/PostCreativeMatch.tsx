'use client'

import { Film, Image as ImageIcon, RefreshCw, Sparkles } from 'lucide-react'
import type { CreativeMediaCandidate, CreativeMediaMatch } from '@/lib/creativeIntelligence'
import { CONTENT_HUB_REWRITE_COST } from '@/lib/contentHubActionSafety'

interface PostCreativeMatchProps {
  isAr: boolean
  match: CreativeMediaMatch
  media: CreativeMediaCandidate
  postIsVideo: boolean
  immutable: boolean
  adapting: boolean
  onUseExisting: () => void
  onAdaptCopy: () => void
  onGenerateFromReference: () => void
  onChooseManually: () => void
}

const VERDICT_STYLE = {
  STRONG: { bg: '#ECFDF5', color: '#047857', border: '#A7F3D0' },
  PARTIAL: { bg: '#FFF7ED', color: '#C2410C', border: '#FED7AA' },
  WEAK: { bg: '#F8FAFC', color: '#475569', border: '#E2E8F0' },
  REJECTED: { bg: '#FEF2F2', color: '#B91C1C', border: '#FECACA' },
} as const

export function PostCreativeMatch({
  isAr,
  match,
  media,
  postIsVideo,
  immutable,
  adapting,
  onUseExisting,
  onAdaptCopy,
  onGenerateFromReference,
  onChooseManually,
}: PostCreativeMatchProps) {
  const style = VERDICT_STYLE[match.verdict]
  const isVideo = String(media.type).toUpperCase() === 'VIDEO'
  const verdictLabel = {
    STRONG: isAr ? 'تطابق قوي' : 'Strong match',
    PARTIAL: isAr ? 'تطابق جزئي' : 'Partial match',
    WEAK: isAr ? 'تطابق ضعيف' : 'Weak match',
    REJECTED: isAr ? 'غير متوافق' : 'Not compatible',
  }[match.verdict]
  const isReference = match.compatibility === 'REFERENCE'
  const canGenerateFromReference = !isVideo
  const needsDifferentAsset = match.recommendedDecision === 'CREATE_NEW' && !canGenerateFromReference

  return (
    <div className="border-t border-violet-100 bg-gradient-to-br from-violet-50/80 to-white px-3 py-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-violet-600" aria-hidden="true" />
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-violet-700">
            {isAr ? 'أفضل تطابق من وسائطك' : 'Best match from your media'}
          </p>
        </div>
        <span className="rounded-full border px-2 py-1 text-[10px] font-black" style={{ background: style.bg, color: style.color, borderColor: style.border }}>
          {verdictLabel} · {match.score}%
        </span>
      </div>

      <div className="mt-3 flex gap-3">
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
          {isVideo
            ? <video src={media.url} muted playsInline preload="metadata" className="h-full w-full object-cover" />
            : <img src={media.url} alt={media.fileName} className="h-full w-full object-cover" />}
          <span className="absolute bottom-1 end-1 rounded-md bg-slate-950/75 p-1 text-white">
            {isVideo ? <Film className="h-3 w-3" aria-hidden="true" /> : <ImageIcon className="h-3 w-3" aria-hidden="true" />}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-bold text-slate-900">{media.fileName}</p>
          <p className="mt-1 text-[10px] leading-4 text-slate-600">{match.reasons[0]}</p>
          {match.gaps[0] && <p className="mt-1 text-[10px] leading-4 text-amber-700">{isAr ? 'الفجوة: ' : 'Gap: '}{match.gaps[0]}</p>}
          <p className="mt-1 text-[9px] text-slate-400">{isAr ? 'درجة ملاءمة إبداعية — ليست توقع أداء' : 'Creative-fit score — not a performance forecast'}</p>
        </div>
      </div>

      {!immutable && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {isReference || (match.recommendedDecision === 'CREATE_NEW' && canGenerateFromReference) ? (
            <button type="button" onClick={onGenerateFromReference} className="col-span-2 min-h-10 rounded-xl bg-slate-950 px-3 text-[11px] font-bold text-white">
              {postIsVideo
                ? (isAr ? 'حوّل هذا الأصل إلى فيديو مطابق للنص' : 'Turn this asset into a video matching the copy')
                : (isAr ? 'حوّل الأصل إلى إعلان مطابق للنص' : 'Turn this asset into an ad matching the copy')}
            </button>
          ) : needsDifferentAsset ? (
            <>
              <button type="button" onClick={onChooseManually} className="col-span-2 min-h-10 rounded-xl bg-slate-950 px-3 text-[11px] font-bold text-white">
                {isAr ? 'اختر أصلًا أقرب للرسالة' : 'Choose an asset closer to the message'}
              </button>
              <button type="button" onClick={onAdaptCopy} disabled={adapting} className="col-span-2 min-h-10 rounded-xl border border-violet-200 bg-white px-3 text-[11px] font-bold text-violet-700 disabled:opacity-50">
                {adapting
                  ? (isAr ? 'جارٍ الملاءمة…' : 'Adapting…')
                  : (isAr ? `غيّر النص ليلائم الأصل — ${CONTENT_HUB_REWRITE_COST} كريديت` : `Change copy to fit asset — ${CONTENT_HUB_REWRITE_COST} credits`)}
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={onUseExisting} className="min-h-10 rounded-xl bg-slate-950 px-3 text-[11px] font-bold text-white">
                {isAr ? 'استخدم الأصل كما هو' : 'Use this asset'}
              </button>
              <button type="button" onClick={onAdaptCopy} disabled={adapting} className="min-h-10 rounded-xl border border-violet-200 bg-white px-3 text-[11px] font-bold text-violet-700 disabled:opacity-50">
                {adapting
                  ? (isAr ? 'جارٍ الملاءمة…' : 'Adapting…')
                  : (isAr ? `لائم النص — ${CONTENT_HUB_REWRITE_COST} كريديت` : `Adapt copy — ${CONTENT_HUB_REWRITE_COST} credits`)}
              </button>
              <button type="button" onClick={onGenerateFromReference} className="col-span-2 inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-[11px] font-bold text-slate-700">
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                {isAr ? 'احتفظ بالنص وأنشئ إعلانًا من هذا المرجع' : 'Keep copy and create an ad from this reference'}
              </button>
            </>
          )}
          <button type="button" onClick={onChooseManually} className="col-span-2 text-[10px] font-semibold text-slate-500 underline-offset-2 hover:underline">
            {isAr ? 'اختيار أصل آخر يدويًا' : 'Choose another asset manually'}
          </button>
        </div>
      )}
    </div>
  )
}
