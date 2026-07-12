'use client'

import Link from 'next/link'

interface UpgradeGateProps {
  feature: string
  description: string
  onClose?: () => void
  inline?: boolean
}

/**
 * UpgradeGate — shown when a free user tries to access a paid feature.
 * Use inline=true for embedded banners, false for modal overlays.
 */
export default function UpgradeGate({ feature, description, onClose, inline = false }: UpgradeGateProps) {
  if (inline) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="text-2xl mb-3">⚡</div>
        <h3 className="font-bold text-slate-950 mb-1">{feature}</h3>
        <p className="text-sm text-slate-500 mb-5 max-w-sm mx-auto">{description}</p>
        <Link href="/billing"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-950 hover:bg-slate-800 text-white font-bold rounded-xl text-sm transition-all">
          Upgrade to Growth →
        </Link>
        <div className="mt-3 text-xs text-slate-500">From $19/month · Cancel anytime</div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: 'rgba(15,23,42,0.28)', backdropFilter: 'blur(12px)' }}>
      <div className="relative w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-[0_24px_80px_rgba(15,23,42,0.16)]">
        {onClose && (
          <button onClick={onClose}
            className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 transition-all text-lg">
            ×
          </button>
        )}
        <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto mb-4 text-2xl">
          ⚡
        </div>
        <h2 className="text-xl font-bold text-slate-950 mb-2">{feature}</h2>
        <p className="text-sm text-slate-500 mb-6 leading-relaxed">{description}</p>
        <div className="space-y-2">
          <Link href="/billing"
            className="block w-full py-3 bg-slate-950 hover:bg-slate-800 text-white font-bold rounded-xl text-sm transition-all">
            Upgrade to Growth — $49/month
          </Link>
          {onClose && (
            <button onClick={onClose}
              className="block w-full py-2.5 border border-slate-200 hover:border-slate-300 text-slate-500 hover:text-slate-950 rounded-xl text-sm transition-all">
              Maybe later
            </button>
          )}
        </div>
        <div className="mt-4 text-xs text-slate-400">Cancel anytime · Access continues through the paid period</div>
      </div>
    </div>
  )
}
