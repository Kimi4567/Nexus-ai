'use client'

/**
 * CreditConfirmModal — reusable "confirm before spend" gate for AI actions.
 * Shows the exact cost, why it is charged, and the balance the user will have
 * AFTER the action, so spending is never a surprise.
 *
 * IMPORTANT: This is a UI gate only. It does NOT deduct credits. Deduction
 * still happens server-side inside the action's API route (via
 * checkAndDeductCredits), and refund-on-failure remains fully intact. The
 * modal simply gates the click: the caller's onConfirm() is what fires the
 * real request.
 *
 * Copy (per spec): "This action will use X credits. Your balance after this
 * action will be Y credits."
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Zap, AlertTriangle, ArrowUpRight, X } from 'lucide-react'

interface Props {
  isOpen: boolean
  onClose: () => void
  /** Fires the real (credit-spending) request. Only called after the user confirms. */
  onConfirm: () => void
  /** Credit cost of the action (should be the same value the server will deduct). */
  cost: number
  /** Short action label, e.g. "Generate Campaign" / "Generate Paid Ad Pack". */
  actionTitle: string
  /** Plain-language reason this action consumes credits. */
  reason: string
  /** Auth header getter so the modal can fetch the live balance. */
  authHeader: () => string
  /** 'ar' for Arabic copy; anything else → English. */
  locale?: string
  /** Optional: short bullets describing what the action includes. */
  includedItems?: string[]
  /** Optional: confirm button label override. */
  confirmLabel?: string
}

export default function CreditConfirmModal({
  isOpen, onClose, onConfirm, cost, actionTitle, reason, authHeader, locale, includedItems, confirmLabel,
}: Props) {
  const ar = (locale || '').toLowerCase().startsWith('ar')
  const [balance, setBalance] = useState<number | null>(null)
  const [loadingBalance, setLoadingBalance] = useState(false)

  useEffect(() => {
    if (!isOpen) { setBalance(null); return }
    setLoadingBalance(true)
    fetch('/api/user/credits', { headers: { Authorization: authHeader() } })
      .then(r => (r.ok ? r.json() : null))
      .then((d: { creditsRemaining?: number } | null) => {
        if (d?.creditsRemaining !== undefined) setBalance(d.creditsRemaining)
      })
      .catch(() => {})
      .finally(() => setLoadingBalance(false))
  }, [isOpen, authHeader])

  useEffect(() => {
    if (!isOpen) return
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const isUnlimited = balance === -1
  const balanceAfter = isUnlimited ? -1 : balance !== null ? Math.max(0, balance - cost) : null
  const canAfford = isUnlimited || (balance !== null && balance >= cost)

  const fmt = (n: number | null) =>
    n === null ? '…' : n === -1 ? (ar ? 'غير محدود ∞' : 'Unlimited ∞') : `${n} ${ar ? 'كريديت' : 'credits'}`

  return (
    <div
      dir={ar ? 'rtl' : 'ltr'}
      role="dialog"
      aria-modal="true"
      aria-labelledby="credit-confirm-title"
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-sm rounded-2xl bg-white overflow-hidden relative shadow-[0_24px_80px_rgba(15,23,42,0.25)] border border-slate-200">
        <button type="button" onClick={onClose}
          aria-label={ar ? 'إغلاق تأكيد الكريديت' : 'Close credit confirmation'}
          className="absolute top-4 end-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all">
          <X className="w-4 h-4" />
        </button>

        <div className="p-6">
          {/* Header */}
          <div className="text-center mb-5">
            <div className="w-12 h-12 mx-auto mb-3 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)' }}>
              <Zap className="w-6 h-6" style={{ color: '#8B5CF6' }} />
            </div>
            <h2 id="credit-confirm-title" className="text-lg font-bold text-slate-950 mb-1">
              {ar ? 'تأكيد استخدام الكريديت' : 'Confirm credit use'}
            </h2>
            <p className="text-xs text-slate-500">
              {ar
                ? `سيستخدم هذا الإجراء ${cost} كريديت. رصيدك بعد ذلك سيكون ${balanceAfter === null ? '…' : isUnlimited ? 'غير محدود' : balanceAfter} كريديت.`
                : `This action will use ${cost} credits. Your balance after this action will be ${balanceAfter === null ? '…' : isUnlimited ? 'unlimited' : balanceAfter} credits.`}
            </p>
          </div>

          {/* Breakdown */}
          <div className="rounded-2xl p-4 mb-4" style={{ background: 'rgba(139,92,246,0.05)', border: '1px solid rgba(139,92,246,0.15)' }}>
            <div className="flex items-center justify-between pb-3 mb-3" style={{ borderBottom: '1px solid rgba(139,92,246,0.12)' }}>
              <span className="text-sm font-semibold text-slate-800">{actionTitle}</span>
              <span className="text-lg font-bold" style={{ color: '#FF6B35' }}>
                {cost} {ar ? 'كريديت' : 'credits'}
              </span>
            </div>
            <p className="mb-3 text-[11px] leading-5 text-slate-600">{reason}</p>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500 text-xs">{ar ? 'رصيدك الحالي' : 'Current balance'}</span>
                <span className="font-semibold text-slate-700">{fmt(balance)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500 text-xs">{ar ? 'الرصيد بعد الإجراء' : 'Balance after'}</span>
                <span className="font-semibold" style={{ color: balanceAfter !== null && !isUnlimited && balanceAfter <= 2 ? '#FF6B35' : '#10B981' }}>
                  {fmt(balanceAfter)}
                </span>
              </div>
            </div>
          </div>

          {/* Included */}
          {includedItems && includedItems.length > 0 && (
            <div className="rounded-xl p-3 mb-4" style={{ background: 'rgba(16,185,129,0.04)', border: '1px solid rgba(16,185,129,0.12)' }}>
              <div className="grid grid-cols-2 gap-1">
                {includedItems.map(item => (
                  <div key={item} className="flex items-center gap-1.5 text-[11px] text-slate-500">
                    <span className="w-1 h-1 rounded-full bg-emerald-500 flex-shrink-0" />
                    {item}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Not enough credits */}
          {!canAfford && balance !== null && (
            <div className="rounded-xl px-3 py-2.5 mb-3 flex items-center gap-2" style={{ background: 'rgba(255,107,53,0.08)', border: '1px solid rgba(255,107,53,0.25)' }}>
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#FF6B35' }} />
              <p className="text-[11px] text-rose-700">
                {ar
                  ? `تحتاج ${cost} كريديت ولديك ${balance} فقط.`
                  : `You need ${cost} credits but have ${balance}.`}
              </p>
            </div>
          )}

          {/* Actions */}
          {canAfford ? (
            <button
              type="button"
              onClick={() => { onClose(); onConfirm() }}
              disabled={loadingBalance && balance === null}
              className="w-full py-3 rounded-xl font-semibold text-sm text-white flex items-center justify-center gap-2 mb-2 transition-all hover:brightness-110 disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)' }}>
              <Zap className="w-4 h-4" />
              {confirmLabel || (ar ? `تأكيد — ${cost} كريديت` : `Confirm — ${cost} credits`)}
            </button>
          ) : (
            <Link href="/billing" onClick={onClose}
              className="w-full py-3 rounded-xl font-semibold text-sm text-white flex items-center justify-center gap-2 mb-2 transition-all hover:brightness-110"
              style={{ background: 'linear-gradient(135deg, #FF6B35 0%, #E55A2B 100%)' }}>
              <ArrowUpRight className="w-4 h-4" />
              {ar ? 'ترقية الخطة' : 'Upgrade plan'}
            </Link>
          )}

          <button type="button" onClick={onClose}
            className="w-full py-2 rounded-xl text-xs text-slate-500 hover:text-slate-800 transition-all border border-slate-200">
            {ar ? 'إلغاء' : 'Cancel'}
          </button>
        </div>
      </div>
    </div>
  )
}
