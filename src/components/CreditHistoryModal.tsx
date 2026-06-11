'use client'

/**
 * CreditHistoryModal
 *
 * Displays a paginated list of all CreditTransaction records for the
 * authenticated user. Fetches GET /api/credits/history and renders
 * each entry as a row: icon + label + amount + date.
 *
 * Amounts: negative (credit deduction) → red, positive (top-up / refund) → green.
 */

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n-context'
import {
  X, History, Zap, RefreshCw, AlertCircle,
  TrendingDown, TrendingUp, Loader2,
} from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────────────────

interface Transaction {
  id: string
  action: string
  description: string | null
  amount: number   // negative = spent, positive = earned
  entityType: string | null
  createdAt: string
}

interface Props {
  open: boolean
  onClose: () => void
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string, locale: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function entityBadgeColor(entityType: string | null): { bg: string; color: string } {
  switch (entityType) {
    case 'campaign':
    case 'strategy':  return { bg: 'rgba(139,92,246,0.12)', color: '#a5a0ff' }
    case 'image':     return { bg: 'rgba(0,212,255,0.1)',    color: '#00D4FF' }
    case 'content':   return { bg: 'rgba(16,185,129,0.1)',   color: '#10B981' }
    case 'bonus':
    case 'refund':    return { bg: 'rgba(255,184,0,0.1)',    color: '#FFB800' }
    default:          return { bg: 'rgba(139,92,246,0.08)',  color: '#a5a0ff' }
  }
}

// ── Component ────────────────────────────────────────────────────────────────

export default function CreditHistoryModal({ open, onClose }: Props) {
  const { authHeader } = useAuth()
  const { locale, dir } = useI18n()

  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading]           = useState(false)
  const [error, setError]               = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    setError(null)

    fetch('/api/credits/history?limit=100', {
      headers: { Authorization: authHeader() },
    })
      .then(r => r.ok ? r.json() : Promise.reject(r.statusText))
      .then((data: { history: Transaction[] }) => {
        setTransactions(data.history ?? [])
      })
      .catch(() => setError(locale === 'ar' ? 'تعذر تحميل السجل' : 'Failed to load history'))
      .finally(() => setLoading(false))
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null

  const isAr = locale === 'ar'

  return (
    <div
      dir={dir}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-md rounded-2xl overflow-hidden flex flex-col"
        style={{
          background: 'rgba(6,7,26,0.97)',
          border: '1px solid rgba(139,92,246,0.25)',
          boxShadow: '0 24px 80px rgba(139,92,246,0.2)',
          maxHeight: '85vh',
        }}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid rgba(139,92,246,0.12)' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.25)' }}>
              <History className="w-4 h-4" style={{ color: '#8B5CF6' }} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white leading-none">
                {isAr ? 'سجل الكريديت' : 'Credit History'}
              </h2>
              <p className="text-[10px] text-text-muted mt-0.5">
                {isAr ? 'جميع معاملاتك' : 'All your transactions'}
              </p>
            </div>
          </div>
          <button onClick={onClose}
            className="p-1.5 rounded-lg text-text-muted hover:text-white hover:bg-white/5 transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto">

          {/* Loading */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: '#8B5CF6' }} />
              <p className="text-xs text-text-muted">{isAr ? 'جاري التحميل...' : 'Loading...'}</p>
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <AlertCircle className="w-6 h-6" style={{ color: '#FF6B35' }} />
              <p className="text-xs text-text-muted">{error}</p>
              <button
                onClick={() => { setError(null); setLoading(true) }}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all"
                style={{ background: 'rgba(139,92,246,0.1)', color: '#a5a0ff', border: '1px solid rgba(139,92,246,0.2)' }}>
                <RefreshCw className="w-3 h-3" />
                {isAr ? 'إعادة المحاولة' : 'Retry'}
              </button>
            </div>
          )}

          {/* Empty */}
          {!loading && !error && transactions.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.15)' }}>
                <Zap className="w-6 h-6" style={{ color: '#8B5CF6', opacity: 0.5 }} />
              </div>
              <p className="text-sm font-medium text-white">
                {isAr ? 'لا توجد معاملات بعد' : 'No transactions yet'}
              </p>
              <p className="text-xs text-text-muted text-center max-w-[200px] leading-relaxed">
                {isAr
                  ? 'ستظهر هنا تفاصيل كل عملية استخدام للكريديت'
                  : 'Every credit usage will appear here with full details'}
              </p>
            </div>
          )}

          {/* Transaction list */}
          {!loading && !error && transactions.length > 0 && (
            <div className="p-3 space-y-1.5">
              {transactions.map(tx => {
                const isDeduction = tx.amount < 0
                const badge = entityBadgeColor(tx.entityType)

                return (
                  <div key={tx.id}
                    className="flex items-center gap-3 p-3 rounded-xl transition-all hover:bg-white/[0.02]"
                    style={{ border: '1px solid rgba(139,92,246,0.08)' }}>

                    {/* Direction icon */}
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{
                        background: isDeduction
                          ? 'rgba(255,107,53,0.1)'
                          : 'rgba(16,185,129,0.1)',
                        border: `1px solid ${isDeduction ? 'rgba(255,107,53,0.2)' : 'rgba(16,185,129,0.2)'}`,
                      }}>
                      {isDeduction
                        ? <TrendingDown className="w-3.5 h-3.5" style={{ color: '#FF6B35' }} />
                        : <TrendingUp   className="w-3.5 h-3.5" style={{ color: '#10B981' }} />}
                    </div>

                    {/* Label + date */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate leading-tight">
                        {tx.description || tx.action}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <p className="text-[10px] text-text-muted">
                          {formatDate(tx.createdAt, locale)}
                        </p>
                        {tx.entityType && (
                          <span
                            className="text-[9px] font-semibold px-1.5 py-0.5 rounded"
                            style={{ background: badge.bg, color: badge.color }}>
                            {tx.entityType}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Amount */}
                    <div className="text-end flex-shrink-0">
                      <p className="text-sm font-bold tabular-nums"
                        style={{ color: isDeduction ? '#FF6B35' : '#10B981' }}>
                        {isDeduction ? '' : '+'}{tx.amount}
                      </p>
                      <p className="text-[9px] text-text-muted">
                        {isAr ? 'كريديت' : 'credits'}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        {!loading && !error && transactions.length > 0 && (
          <div className="px-5 py-3 flex items-center justify-between"
            style={{ borderTop: '1px solid rgba(139,92,246,0.1)' }}>
            <p className="text-[10px] text-text-muted">
              {isAr
                ? `${transactions.length} معاملة`
                : `${transactions.length} transaction${transactions.length !== 1 ? 's' : ''}`}
            </p>
            <button onClick={onClose}
              className="text-xs font-medium px-3 py-1.5 rounded-lg transition-all hover:text-white"
              style={{
                background: 'rgba(139,92,246,0.08)',
                border: '1px solid rgba(139,92,246,0.18)',
                color: '#a5a0ff',
              }}>
              {isAr ? 'إغلاق' : 'Close'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
