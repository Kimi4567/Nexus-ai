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
    case 'strategy':  return { bg: '#F5F3FF', color: '#5E5CE6' }
    case 'image':     return { bg: '#ECFEFF', color: '#0891B2' }
    case 'content':   return { bg: '#ECFDF5', color: '#047857' }
    case 'bonus':
    case 'refund':    return { bg: '#FFFBEB', color: '#B45309' }
    default:          return { bg: '#F5F3FF', color: '#5E5CE6' }
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
      style={{ background: 'rgba(15,23,42,0.28)', backdropFilter: 'blur(12px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-md rounded-2xl overflow-hidden flex flex-col"
        style={{
          background: '#FFFFFF',
          border: '1px solid rgba(15,23,42,0.10)',
          boxShadow: '0 24px 80px rgba(15,23,42,0.16)',
          maxHeight: '85vh',
        }}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid rgba(15,23,42,0.08)' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: '#F5F3FF', border: '1px solid rgba(94,92,230,0.18)' }}>
              <History className="w-4 h-4" style={{ color: '#5E5CE6' }} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-950 leading-none">
                {isAr ? 'سجل الكريديت' : 'Credit History'}
              </h2>
              <p className="text-[10px] text-slate-500 mt-0.5">
                {isAr ? 'جميع معاملاتك' : 'All your transactions'}
              </p>
            </div>
          </div>
          <button onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto">

          {/* Loading */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: '#5E5CE6' }} />
              <p className="text-xs text-slate-500">{isAr ? 'جاري التحميل...' : 'Loading...'}</p>
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <AlertCircle className="w-6 h-6" style={{ color: '#DC2626' }} />
              <p className="text-xs text-slate-500">{error}</p>
              <button
                onClick={() => { setError(null); setLoading(true) }}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all"
                style={{ background: '#F5F3FF', color: '#5E5CE6', border: '1px solid rgba(94,92,230,0.18)' }}>
                <RefreshCw className="w-3 h-3" />
                {isAr ? 'إعادة المحاولة' : 'Retry'}
              </button>
            </div>
          )}

          {/* Empty */}
          {!loading && !error && transactions.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                style={{ background: '#F5F3FF', border: '1px solid rgba(94,92,230,0.18)' }}>
                <Zap className="w-6 h-6" style={{ color: '#5E5CE6', opacity: 0.65 }} />
              </div>
              <p className="text-sm font-medium text-slate-950">
                {isAr ? 'لا توجد معاملات بعد' : 'No transactions yet'}
              </p>
              <p className="text-xs text-slate-500 text-center max-w-[200px] leading-relaxed">
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
                    className="flex items-center gap-3 p-3 rounded-xl transition-all hover:bg-slate-50"
                    style={{ border: '1px solid rgba(15,23,42,0.08)' }}>

                    {/* Direction icon */}
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{
                        background: isDeduction
                          ? '#FEF2F2'
                          : '#ECFDF5',
                        border: `1px solid ${isDeduction ? 'rgba(220,38,38,0.18)' : 'rgba(5,150,105,0.18)'}`,
                      }}>
                      {isDeduction
                        ? <TrendingDown className="w-3.5 h-3.5" style={{ color: '#DC2626' }} />
                        : <TrendingUp   className="w-3.5 h-3.5" style={{ color: '#047857' }} />}
                    </div>

                    {/* Label + date */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-950 truncate leading-tight">
                        {tx.description || tx.action}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <p className="text-[10px] text-slate-500">
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
                        style={{ color: isDeduction ? '#DC2626' : '#047857' }}>
                        {isDeduction ? '' : '+'}{tx.amount}
                      </p>
                      <p className="text-[9px] text-slate-500">
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
            style={{ borderTop: '1px solid rgba(15,23,42,0.08)' }}>
            <p className="text-[10px] text-slate-500">
              {isAr
                ? `${transactions.length} معاملة`
                : `${transactions.length} transaction${transactions.length !== 1 ? 's' : ''}`}
            </p>
            <button onClick={onClose}
              className="text-xs font-medium px-3 py-1.5 rounded-lg transition-all hover:bg-slate-100"
              style={{
                background: '#F8FAFC',
                border: '1px solid rgba(15,23,42,0.08)',
                color: '#334155',
              }}>
              {isAr ? 'إغلاق' : 'Close'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
