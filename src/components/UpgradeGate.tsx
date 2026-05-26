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
      <div className="rounded-2xl border border-[#6366f1]/20 bg-[#6366f1]/5 p-6 text-center"
        style={{ boxShadow: '0 0 32px rgba(99,102,241,0.08)' }}>
        <div className="text-2xl mb-3">⚡</div>
        <h3 className="font-bold text-white mb-1">{feature}</h3>
        <p className="text-sm text-gray-400 mb-5 max-w-sm mx-auto">{description}</p>
        <Link href="/billing"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#6366f1] hover:bg-[#5558e8] text-white font-bold rounded-xl text-sm transition-all"
          style={{ boxShadow: '0 0 16px rgba(99,102,241,0.3)' }}>
          Upgrade to Pro →
        </Link>
        <div className="mt-3 text-xs text-gray-600">From $29/month · Cancel anytime</div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}>
      <div className="w-full max-w-sm rounded-2xl border border-[#6366f1]/20 bg-[#0d0d18] p-8 text-center"
        style={{ boxShadow: '0 0 80px rgba(99,102,241,0.15)' }}>
        {onClose && (
          <button onClick={onClose}
            className="absolute top-4 right-4 text-gray-600 hover:text-white transition-all text-lg">
            ×
          </button>
        )}
        <div className="w-14 h-14 rounded-2xl bg-[#6366f1]/10 border border-[#6366f1]/20 flex items-center justify-center mx-auto mb-4 text-2xl">
          ⚡
        </div>
        <h2 className="text-xl font-bold text-white mb-2">{feature}</h2>
        <p className="text-sm text-gray-400 mb-6 leading-relaxed">{description}</p>
        <div className="space-y-2">
          <Link href="/billing"
            className="block w-full py-3 bg-[#6366f1] hover:bg-[#5558e8] text-white font-bold rounded-xl text-sm transition-all"
            style={{ boxShadow: '0 0 20px rgba(99,102,241,0.25)' }}>
            Upgrade to Pro — $79/month
          </Link>
          {onClose && (
            <button onClick={onClose}
              className="block w-full py-2.5 border border-[#1e1e2e] hover:border-[#2e2e3e] text-gray-500 hover:text-white rounded-xl text-sm transition-all">
              Maybe later
            </button>
          )}
        </div>
        <div className="mt-4 text-xs text-gray-700">7-day money-back guarantee · Cancel anytime</div>
      </div>
    </div>
  )
}
