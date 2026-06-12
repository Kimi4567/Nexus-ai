'use client'

/**
 * StrategyFailedScreen — honest failure state for the campaign wizard.
 * Trust & Reliability Sprint #1: shown when Run Full Strategy fails, instead
 * of silently routing to the Content Hub as if it had succeeded.
 *
 * Intentionally pure/presentational (no providers, no data fetching) so it is
 * easy to render-test. All copy is passed in by the caller (already localized).
 */

import { AlertTriangle, RefreshCw, ArrowRight } from 'lucide-react'

export interface StrategyFailedScreenProps {
  title: string
  description: string
  /** When true, render the refund note (credits were returned). */
  refunded: boolean
  refundNote: string
  retryLabel: string
  viewCampaignLabel: string
  onRetry: () => void
  onViewCampaign: () => void
  /** Right-to-left layout (Arabic). */
  rtl?: boolean
}

export default function StrategyFailedScreen({
  title,
  description,
  refunded,
  refundNote,
  retryLabel,
  viewCampaignLabel,
  onRetry,
  onViewCampaign,
  rtl = false,
}: StrategyFailedScreenProps) {
  return (
    <div
      className="min-h-screen bg-[#f5f5f7] flex items-center justify-center px-4"
      dir={rtl ? 'rtl' : 'ltr'}
    >
      <div className="text-center max-w-md" role="alert">
        <div className="relative w-20 h-20 mx-auto mb-6">
          <div
            className="w-full h-full rounded-full flex items-center justify-center"
            style={{
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.25)',
            }}
          >
            <AlertTriangle className="w-9 h-9" style={{ color: '#ef4444' }} />
          </div>
        </div>

        <h2 className="text-2xl font-bold text-slate-950 mb-2">{title}</h2>
        <p className="text-slate-500 text-sm mb-4">{description}</p>

        {refunded && (
          <p
            data-testid="refund-note"
            className="text-sm font-medium mb-6 inline-block px-3 py-1.5 rounded-lg"
            style={{
              color: '#059669',
              background: 'rgba(5,150,105,0.08)',
              border: '1px solid rgba(5,150,105,0.2)',
            }}
          >
            {refundNote}
          </p>
        )}

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-2">
          <button
            type="button"
            onClick={onRetry}
            className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white transition-all w-full sm:w-auto"
            style={{ background: '#6d28d9', boxShadow: '0 8px 24px rgba(109,40,217,0.25)' }}
          >
            <RefreshCw className="w-4 h-4" />
            {retryLabel}
          </button>
          <button
            type="button"
            onClick={onViewCampaign}
            className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all w-full sm:w-auto"
            style={{ background: '#fff', border: '1px solid rgba(15,23,42,0.12)', color: '#64748b' }}
          >
            {viewCampaignLabel}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
