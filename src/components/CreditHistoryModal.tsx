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
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n-context'
import {
  X, History, Zap, RefreshCw, AlertCircle,
  TrendingDown, TrendingUp, Loader2, Search, ChevronLeft, ChevronRight,
} from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────────────────

export interface Transaction {
  id: string
  action: string
  description: string | null
  amount: number   // negative = spent, positive = earned
  entityId: string | null
  entityType: string | null
  pricingVersion: string | null
  status: 'RESERVED' | 'SETTLED' | 'REFUNDED'
  creditCost: number
  reservedAt: string | null
  settledAt: string | null
  refundedAt: string | null
  createdAt: string
}

export interface CreditHistoryRow {
  transaction: Transaction
  correction: Transaction | null
}

/**
 * Credit transactions are append-only. When an old human-readable description
 * needs correcting, a zero-value AUDIT_CORRECTION points at the original row.
 * The UI applies the newest correction without mutating or hiding monetary
 * history, and does not render the metadata row as a second credit movement.
 */
export function applyCreditHistoryCorrections(transactions: Transaction[]): CreditHistoryRow[] {
  const corrections = new Map<string, Transaction>()

  for (const transaction of transactions) {
    if (
      transaction.action !== 'AUDIT_CORRECTION' ||
      transaction.entityType !== 'credit_transaction' ||
      !transaction.entityId ||
      !transaction.description
    ) continue

    const current = corrections.get(transaction.entityId)
    if (!current || new Date(transaction.createdAt).getTime() > new Date(current.createdAt).getTime()) {
      corrections.set(transaction.entityId, transaction)
    }
  }

  return transactions
    .filter(transaction => transaction.action !== 'AUDIT_CORRECTION')
    .map(transaction => {
      const correction = corrections.get(transaction.id) ?? null
      return {
        transaction: correction
          ? { ...transaction, description: correction.description }
          : transaction,
        correction,
      }
    })
}

interface Props {
  open: boolean
  onClose: () => void
}

type HistoryFilter = 'all' | 'spent' | 'added' | 'refunded' | 'legacy'
const HISTORY_PAGE_SIZE = 10

const ARABIC_ACTION_LABELS: Record<string, string> = {
  CAMPAIGN_GENERATION: 'إنشاء حزمة حملة للمراجعة',
  RUN_FULL_STRATEGY: 'إنشاء استراتيجية تسويق كاملة',
  CREATIVE_BRIEF: 'إنشاء البريف الإبداعي',
  SENTINEL_REVIEW: 'مراجعة Sentinel للجودة',
  IMAGE_GENERATION: 'توليد صورة لمنشور',
  VIDEO_GENERATION: 'توليد فيديو إعلاني احترافي',
  MOTION_DESIGN_VIDEO: 'إعلان Motion Design من فيديو أصلي',
  AD_COPY: 'توليد نص إعلان',
  AI_FIELD_SUGGESTION: 'اقتراح حقل بالذكاء الاصطناعي',
  PAID_EXECUTION_PLAN: 'خطة تنفيذ مدفوعة للمراجعة',
  CHAT_MESSAGE: 'رد المساعد الذكي',
  AI_POST_REWRITE: 'إعادة كتابة منشور',
  CONTENT_PLAN_GENERATION: 'إنشاء خطة محتوى مسودة',
  CONTENT_AB_VARIANTS: 'إنشاء نسخ A/B للنص',
  PAID_PACK_GENERATE: 'إنشاء حزمة حملة مدفوعة',
  WEBSITE_SCAN: 'فحص موقع الويب',
  CONTENT_ANALYSIS: 'تحليل عينات المحتوى',
  REFUND: 'استرداد كريديت',
  BONUS: 'إضافة كريديت',
  CREDIT_PURCHASE: 'شراء كريديت',
  MONTHLY_GRANT: 'تجديد رصيد الباقة الشهري',
}

function transactionLabel(transaction: Transaction, isArabic: boolean): string {
  if (isArabic) return ARABIC_ACTION_LABELS[transaction.action] || transaction.description || transaction.action
  return transaction.description || transaction.action
}

export function creditHistoryDisplayLabel(transaction: Transaction, isArabic: boolean): string {
  const rawLabel = transactionLabel(transaction, isArabic)
  return rawLabel.replace(
    /\s+[—-]\s+(\d+(?:\.\d+)?)\s+(?:credits?|كريديت)\s*$/i,
    (suffix, displayedAmount: string) => Number(displayedAmount) === Math.abs(transaction.amount) ? '' : suffix,
  ).trim()
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

function transactionStatus(status: Transaction['status'], isArabic: boolean) {
  if (status === 'RESERVED') {
    return {
      label: isArabic ? 'محجوز مؤقتًا' : 'Reserved',
      className: 'bg-amber-50 text-amber-700 border-amber-200',
    }
  }
  if (status === 'REFUNDED') {
    return {
      label: isArabic ? 'تم الاسترداد' : 'Refunded',
      className: 'bg-sky-50 text-sky-700 border-sky-200',
    }
  }
  return {
    label: isArabic ? 'مكتمل' : 'Completed',
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  }
}

function transactionEventDate(transaction: Transaction): string {
  if (transaction.status === 'REFUNDED') return transaction.refundedAt || transaction.createdAt
  if (transaction.status === 'SETTLED') return transaction.settledAt || transaction.createdAt
  return transaction.reservedAt || transaction.createdAt
}

export function transactionEntityHref(transaction: Pick<Transaction, 'entityId' | 'entityType'>): string | null {
  if (!transaction.entityId) return null
  if (transaction.entityType === 'campaign' || transaction.entityType === 'strategy') {
    return `/campaigns/${transaction.entityId}?tab=strategy`
  }
  return null
}

// ── Component ────────────────────────────────────────────────────────────────

export default function CreditHistoryModal({ open, onClose }: Props) {
  const { authHeader } = useAuth()
  const { locale, dir } = useI18n()

  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading]           = useState(false)
  const [error, setError]               = useState<string | null>(null)
  const [reloadKey, setReloadKey]       = useState(0)
  const [query, setQuery]               = useState('')
  const [filter, setFilter]             = useState<HistoryFilter>('all')
  const [page, setPage]                 = useState(1)

  useEffect(() => {
    if (!open) return
    const authorization = authHeader()
    if (!authorization) {
      setTransactions([])
      setLoading(false)
      setError(locale === 'ar' ? 'تعذر التحقق من جلسة الدخول' : 'Could not verify your session')
      return
    }
    const controller = new AbortController()
    setLoading(true)
    setError(null)

    fetch('/api/credits/history?limit=100', {
      headers: { Authorization: authorization },
      signal: controller.signal,
    })
      .then(async r => {
        if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error || r.statusText)
        return r.json()
      })
      .then((data: { history: Transaction[] }) => {
        setTransactions(data.history ?? [])
      })
      .catch(error => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setTransactions([])
        setError(locale === 'ar' ? 'تعذر تحميل سجل الكريديت. لم يتم إخفاء أي معاملات.' : 'Credit history could not be loaded. No transactions are being hidden.')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [authHeader, locale, open, reloadKey])

  useEffect(() => {
    if (!open) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose, open])

  useEffect(() => {
    setPage(1)
  }, [filter, query])

  if (!open) return null

  const isAr = locale === 'ar'
  const transactionRows = applyCreditHistoryCorrections(transactions)
  const hasLegacyPricingRows = transactionRows.some(({ transaction }) => !transaction.pricingVersion)
  const normalizedQuery = query.trim().toLowerCase()
  const filteredRows = transactionRows.filter(({ transaction }) => {
    const matchesFilter = filter === 'all'
      || (filter === 'spent' && (transaction.amount < 0 || transaction.creditCost > 0))
      || (filter === 'added' && transaction.amount > 0)
      || (filter === 'refunded' && transaction.status === 'REFUNDED')
      || (filter === 'legacy' && !transaction.pricingVersion)
    if (!matchesFilter) return false
    if (!normalizedQuery) return true
    return [
      creditHistoryDisplayLabel(transaction, isAr),
      transaction.description,
      transaction.action,
      transaction.entityType,
      transaction.pricingVersion,
    ].filter(Boolean).join(' ').toLowerCase().includes(normalizedQuery)
  })
  const pageCount = Math.max(1, Math.ceil(filteredRows.length / HISTORY_PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const visibleRows = filteredRows.slice((safePage - 1) * HISTORY_PAGE_SIZE, safePage * HISTORY_PAGE_SIZE)

  return (
    <div
      dir={dir}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.28)', backdropFilter: 'blur(12px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="credit-history-title"
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
              <h2 id="credit-history-title" className="text-sm font-bold text-slate-950 leading-none">
                {isAr ? 'سجل الكريديت' : 'Credit History'}
              </h2>
              <p className="text-[10px] text-slate-500 mt-0.5">
                {isAr ? 'جميع معاملاتك' : 'All your transactions'}
              </p>
            </div>
          </div>
          <button onClick={onClose}
            type="button"
            aria-label={isAr ? 'إغلاق سجل الكريديت' : 'Close credit history'}
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
                type="button"
                onClick={() => setReloadKey(key => key + 1)}
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
          {!loading && !error && transactionRows.length > 0 && (
            <div className="p-3 space-y-1.5">
              {hasLegacyPricingRows && (
                <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[10px] leading-5 text-amber-800">
                  {isAr
                    ? 'المعاملات المعلّمة «تسعير قديم» سبقت سجل نسخ التسعير الحالي. نحافظ على قيمتها التاريخية كما حدثت ولا ننسب لها نسخة أو مخرجًا لم يكن محفوظًا. السعر الحالي يظهر دائمًا قبل أي تشغيل جديد.'
                    : 'Rows marked “Legacy price” predate the current versioned pricing ledger. Their historical amount is preserved exactly; NEXUS does not invent a pricing version or artifact that was not stored. Current pricing is always confirmed before a new run.'}
                </div>
              )}
              <div className="sticky top-0 z-10 mb-3 space-y-2 rounded-xl border border-slate-200 bg-white/95 p-2.5 shadow-sm backdrop-blur">
                <label className="relative block">
                  <Search className="pointer-events-none absolute start-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <span className="sr-only">{isAr ? 'ابحث في سجل الكريديت' : 'Search credit history'}</span>
                  <input
                    type="search"
                    value={query}
                    onChange={event => setQuery(event.target.value)}
                    placeholder={isAr ? 'ابحث بالعملية أو المخرج...' : 'Search action or output...'}
                    className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 ps-9 pe-3 text-xs text-slate-900 outline-none transition focus:border-indigo-300 focus:bg-white focus:ring-2 focus:ring-indigo-100"
                  />
                </label>
                <div className="flex gap-1.5 overflow-x-auto pb-0.5" aria-label={isAr ? 'فلترة المعاملات' : 'Filter transactions'}>
                  {([
                    ['all', isAr ? 'الكل' : 'All'],
                    ['spent', isAr ? 'المستخدم' : 'Spent'],
                    ['added', isAr ? 'المضاف' : 'Added'],
                    ['refunded', isAr ? 'المسترد' : 'Refunded'],
                    ['legacy', isAr ? 'قديم' : 'Legacy'],
                  ] as Array<[HistoryFilter, string]>).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setFilter(value)}
                      aria-pressed={filter === value}
                      className={`shrink-0 rounded-lg border px-2.5 py-1 text-[10px] font-bold transition ${filter === value ? 'border-indigo-200 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-500 hover:text-slate-800'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {visibleRows.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center text-xs font-medium text-slate-500">
                  {isAr ? 'لا توجد معاملات تطابق البحث أو الفلتر.' : 'No transactions match this search or filter.'}
                </div>
              ) : visibleRows.map(({ transaction: tx, correction }) => {
                const isDeduction = tx.amount < 0 || (tx.amount === 0 && tx.creditCost > 0)
                const isRefunded = tx.status === 'REFUNDED'
                const badge = entityBadgeColor(tx.entityType)
                const status = transactionStatus(tx.status, isAr)
                const includedUsage = tx.amount === 0 && tx.creditCost > 0
                const entityHref = transactionEntityHref(tx)
                const displayLabel = creditHistoryDisplayLabel(tx, isAr)

                return (
                  <div key={tx.id}
                    className="flex items-center gap-3 p-3 rounded-xl transition-all hover:bg-slate-50"
                    style={{ border: '1px solid rgba(15,23,42,0.08)' }}>

                    {/* Direction icon */}
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{
                        background: isDeduction
                          ? (isRefunded ? '#F0F9FF' : '#FEF2F2')
                          : '#ECFDF5',
                        border: `1px solid ${isDeduction ? (isRefunded ? 'rgba(2,132,199,0.18)' : 'rgba(220,38,38,0.18)') : 'rgba(5,150,105,0.18)'}`,
                      }}>
                      {isRefunded
                        ? <RefreshCw className="w-3.5 h-3.5" style={{ color: '#0284C7' }} />
                        : isDeduction
                        ? <TrendingDown className="w-3.5 h-3.5" style={{ color: '#DC2626' }} />
                        : <TrendingUp   className="w-3.5 h-3.5" style={{ color: '#047857' }} />}
                    </div>

                    {/* Label + date */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-950 truncate leading-tight">
                        {displayLabel}
                      </p>
                      {tx.description && tx.description !== displayLabel && tx.description !== transactionLabel(tx, isAr) && (
                        <p className="mt-1 line-clamp-2 text-[10px] leading-4 text-slate-500">
                          {tx.description}
                        </p>
                      )}
                      {entityHref && (
                        <Link
                          href={entityHref}
                          onClick={onClose}
                          className="mt-1 inline-flex text-[10px] font-semibold text-indigo-700 hover:underline"
                        >
                          {isAr ? 'فتح المخرج المرتبط' : 'Open linked output'}
                        </Link>
                      )}
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <p className="text-[10px] text-slate-500">
                          {formatDate(transactionEventDate(tx), locale)}
                        </p>
                        <span className={`rounded border px-1.5 py-0.5 text-[9px] font-semibold ${status.className}`}>
                          {status.label}
                        </span>
                        {correction && (
                          <span
                            className="rounded border border-violet-200 bg-violet-50 px-1.5 py-0.5 text-[9px] font-semibold text-violet-700"
                            title={isAr
                              ? 'تم تصحيح الوصف بسجل تدقيق إضافي مع الحفاظ على المعاملة الأصلية'
                              : 'Description corrected by an append-only audit record; the original transaction remains preserved'}
                          >
                            {isAr ? 'وصف مصحّح' : 'Corrected description'}
                          </span>
                        )}
                        {tx.entityType && (
                          <span
                            className="text-[9px] font-semibold px-1.5 py-0.5 rounded"
                            style={{ background: badge.bg, color: badge.color }}>
                            {tx.entityType}
                          </span>
                        )}
                        <span
                          className={`rounded px-1.5 py-0.5 text-[9px] font-semibold ${tx.pricingVersion ? 'bg-slate-100 text-slate-600' : 'bg-amber-50 text-amber-700'}`}
                          title={tx.pricingVersion || (isAr ? 'معاملة قديمة بلا نسخة تسعير محفوظة' : 'Legacy transaction without a saved pricing version')}
                        >
                          {tx.pricingVersion || (isAr ? 'تسعير قديم' : 'Legacy price')}
                        </span>
                      </div>
                    </div>

                    {/* Amount */}
                    <div className="text-end flex-shrink-0">
                      <p className="text-sm font-bold tabular-nums"
                        style={{ color: isRefunded ? '#0284C7' : isDeduction ? '#DC2626' : '#047857' }}>
                        {includedUsage
                          ? (isAr ? 'ضمن الباقة' : 'Included')
                          : `${isDeduction ? '' : '+'}${tx.amount}`}
                      </p>
                      <p className="text-[9px] text-slate-500">
                        {includedUsage
                          ? (isAr ? `تكلفة تشغيلية ${tx.creditCost}` : `${tx.creditCost}-credit operation`)
                          : (isAr ? 'كريديت' : 'credits')}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        {!loading && !error && transactionRows.length > 0 && (
          <div className="px-5 py-3 flex items-center justify-between"
            style={{ borderTop: '1px solid rgba(15,23,42,0.08)' }}>
            <p className="text-[10px] text-slate-500">
              {isAr ? `${filteredRows.length} من ${transactionRows.length} معاملة` : `${filteredRows.length} of ${transactionRows.length} transactions`}
            </p>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPage(current => Math.max(1, current - 1))}
                disabled={safePage <= 1}
                aria-label={isAr ? 'الصفحة السابقة' : 'Previous page'}
                className="rounded-lg border border-slate-200 p-1.5 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-35"
              >
                {dir === 'rtl' ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
              </button>
              <span className="min-w-12 text-center text-[10px] font-semibold text-slate-600">{safePage}/{pageCount}</span>
              <button
                type="button"
                onClick={() => setPage(current => Math.min(pageCount, current + 1))}
                disabled={safePage >= pageCount}
                aria-label={isAr ? 'الصفحة التالية' : 'Next page'}
                className="rounded-lg border border-slate-200 p-1.5 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-35"
              >
                {dir === 'rtl' ? <ChevronLeft className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
