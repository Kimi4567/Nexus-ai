/**
 * SocialPublisher — explicit platform publishing readiness and action.
 *
 * Features:
 * - Lists connected Meta accounts + pages
 * - Pre-populates caption from campaign strategy (hooks, captions, CTAs)
 * - Explicit API publish or schedule controls when readiness gates pass
 * - Shows published posts history for this campaign
 * - Sprint R
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n-context'
import {
  Send, Clock, CheckCircle2, XCircle, Loader2,
  Image as ImageIcon, ChevronDown,
  ExternalLink, AlertCircle, RefreshCw, Zap, Lock,
} from 'lucide-react'
import { getPublishReadiness } from '@/lib/publishReadiness'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ConnectedPage {
  id: string
  name: string
  igAccountId: string | null
}

interface ConnectedAccount {
  id: string          // integrationId
  platform: string    // 'META'
  accountName: string
  pages: ConnectedPage[]
  pictureUrl: string | null
}

interface PublishedPost {
  id: string
  platform: string
  pageName: string | null
  caption: string
  imageUrl: string | null
  status: string
  publishedAt: string | null
  scheduledAt: string | null
  platformUrl: string | null
  errorMessage: string | null
  createdAt: string
}

interface SocialPublisherProps {
  campaignId: string
  campaignName: string
  /** True when campaign is ACTIVE or approvalState === 'done' */
  contentApproved?: boolean
  // Content suggestions from strategy
  topHooks?: string[]
  captionFormulas?: string[]
  ctaVariations?: string[]
  keyMessage?: string
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SocialPublisher({
  campaignId,
  campaignName,
  contentApproved = false,
  topHooks = [],
  captionFormulas = [],
  ctaVariations = [],
  keyMessage,
}: SocialPublisherProps) {
  const { authHeader } = useAuth()
  const { locale, dir } = useI18n()

  // Accounts
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([])
  const [loadingAccounts, setLoadingAccounts] = useState(true)

  // Selection
  const [selectedAccount, setSelectedAccount] = useState<ConnectedAccount | null>(null)
  const [selectedPage, setSelectedPage] = useState<ConnectedPage | null>(null)
  const [platform, setPlatform] = useState<'FACEBOOK' | 'INSTAGRAM'>('FACEBOOK')

  // Content
  const [caption, setCaption] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  // Remove-from-history (Nexus-only; never touches the platform)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [pendingRecordRemoval, setPendingRecordRemoval] = useState<PublishedPost | null>(null)

  // Schedule
  const [mode, setMode] = useState<'now' | 'schedule'>('now')
  const [scheduledAt, setScheduledAt] = useState('')

  // Status
  const [publishing, setPublishing] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; url?: string; error?: string } | null>(null)

  // History
  const [posts, setPosts] = useState<PublishedPost[]>([])
  const [loadingPosts, setLoadingPosts] = useState(false)

  const ar = locale === 'ar'

  // ── Load accounts ────────────────────────────────────────────────────────

  const loadAccounts = useCallback(async () => {
    setLoadingAccounts(true)
    try {
      const res = await fetch('/api/social/accounts', {
        headers: { Authorization: authHeader() },
      })
      const data = await res.json()
      const accs: ConnectedAccount[] = data.accounts || []
      setAccounts(accs)
      if (accs.length > 0 && !selectedAccount) {
        setSelectedAccount(accs[0])
        if (accs[0].pages.length > 0) {
          setSelectedPage(accs[0].pages[0])
        }
      }
    } catch {
      setAccounts([])
    } finally {
      setLoadingAccounts(false)
    }
  }, [authHeader, selectedAccount])

  // ── Load post history ────────────────────────────────────────────────────

  const loadPosts = useCallback(async () => {
    setLoadingPosts(true)
    try {
      // order=recent → newest first, so manually-published posts (scheduledAt = null)
      // surface here instead of being pushed past the server-side take cap.
      const res = await fetch('/api/schedule?order=recent', {
        headers: { Authorization: authHeader() },
      })
      const data = await res.json()
      const allPosts: PublishedPost[] = data.posts || []
      // Filter to this campaign
      setPosts(allPosts.filter((p: any) => p.campaignId === campaignId).slice(0, 10))
    } catch {
      setPosts([])
    } finally {
      setLoadingPosts(false)
    }
  }, [authHeader, campaignId])

  const handleRemoveFromHistory = useCallback(async (post: PublishedPost) => {
    const operation = post.status === 'FAILED' ? 'dismiss_failed_record' : 'cancel_scheduled_post'
    setRemovingId(post.id)
    setResult(null)
    try {
      const response = await fetch(`/api/schedule?id=${post.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: authHeader(),
          'X-Nexus-Confirm-Operation': operation,
        },
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || (ar ? 'تعذر تحديث سجل النشر.' : 'Could not update publishing history.'))
      setPosts(prev => prev.filter(p => p.id !== post.id))
      setPendingRecordRemoval(null)
    } catch (error) {
      setResult({ ok: false, error: error instanceof Error ? error.message : (ar ? 'تعذر تحديث سجل النشر.' : 'Could not update publishing history.') })
    }
    finally { setRemovingId(null) }
  }, [authHeader, ar])

  useEffect(() => {
    loadAccounts()
    loadPosts()
  }, [loadAccounts, loadPosts])

  // ── Auto-select platform based on page ──────────────────────────────────

  useEffect(() => {
    if (!selectedPage) return
    // Default to Instagram if page has IG account linked
    if (selectedPage.igAccountId) {
      setPlatform('INSTAGRAM')
    } else {
      setPlatform('FACEBOOK')
    }
  }, [selectedPage])

  // ── Publish ─────────────────────────────────────────────────────────────

  const handlePublish = async () => {
    if (!selectedAccount || !selectedPage || !caption.trim()) return
    setPublishing(true)
    setResult(null)

    try {
      if (mode === 'now') {
        // Immediate publish
        const pageId = platform === 'INSTAGRAM'
          ? (selectedPage.igAccountId || selectedPage.id)
          : selectedPage.id

        const res = await fetch('/api/social/publish', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: authHeader(),
          },
          body: JSON.stringify({
            integrationId: selectedAccount.id,
            pageId,
            pageName: selectedPage.name,
            caption: caption.trim(),
            imageUrl: imageUrl.trim() || undefined,
            platform,
            campaignId,
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Publish failed')
        setResult({ ok: true, url: data.platformUrl })
        loadPosts()
        setCaption('')
        setImageUrl('')
      } else {
        // Scheduled
        if (!scheduledAt) {
          setResult({ ok: false, error: ar ? 'حدد وقت النشر' : 'Select a scheduled time' })
          return
        }
        const pageId = platform === 'INSTAGRAM'
          ? (selectedPage.igAccountId || selectedPage.id)
          : selectedPage.id

        const res = await fetch('/api/schedule', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: authHeader(),
          },
          body: JSON.stringify({
            integrationId: selectedAccount.id,
            pageId,
            pageName: selectedPage.name,
            caption: caption.trim(),
            imageUrl: imageUrl.trim() || undefined,
            platform,
            campaignId,
            scheduledAt,
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Scheduling failed')
        setResult({ ok: true })
        loadPosts()
        setCaption('')
        setImageUrl('')
        setScheduledAt('')
      }
    } catch (err: any) {
      setResult({ ok: false, error: err.message })
    } finally {
      setPublishing(false)
    }
  }

  // ── Suggestions ──────────────────────────────────────────────────────────

  const allSuggestions = [
    ...topHooks.slice(0, 3),
    ...captionFormulas.slice(0, 3),
    ...ctaVariations.slice(0, 2),
    ...(keyMessage ? [keyMessage] : []),
  ].filter(Boolean)

  // ── Empty state ──────────────────────────────────────────────────────────

  if (loadingAccounts) {
    return (
      <div className="flex items-center justify-center py-12 gap-3 text-gray-500">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm">{ar ? 'جاري التحميل...' : 'Loading...'}</span>
      </div>
    )
  }

  if (accounts.length === 0) {
    return (
      <div className="text-center py-12 space-y-4">
        <div className="text-4xl">📱</div>
        <h3 className="text-base font-semibold text-slate-950">
          {ar ? 'لا توجد حسابات نشر متصلة' : 'No connected publishing accounts'}
        </h3>
        <p className="mx-auto max-w-xs text-sm text-slate-500">
          {ar
            ? 'راجع الاتصالات أولاً. ربط الحساب وحده لا ينشر أي محتوى ولا يفعّل النشر التلقائي.'
            : 'Review Connections first. Connecting an account does not publish content or enable automation by itself.'}
        </p>
        <a
          href="/connections"
          className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700 transition-all hover:bg-indigo-100"
        >
          <Zap className="w-4 h-4" />
          {ar ? 'مراجعة الاتصالات' : 'Review Connections'}
          <ExternalLink className="w-3 h-3" />
        </a>

        {/* Honest readiness note — publishing is unavailable until an account is
            connected, and Meta may require app-permission review first. */}
        <div className="max-w-sm mx-auto mt-2 rounded-xl px-3 py-2.5 flex items-start gap-2 text-start"
          style={{ background: '#fffbeb', border: '1px solid #fde68a' }}>
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: '#FFB800' }} />
          <p className="text-[11px] leading-snug text-amber-800">
            {ar
              ? 'النشر عبر المنصات غير متاح هنا حتى يوجد حساب وصفحة وصلاحيات ووسائط وتأكيد صريح. الجدولة داخل NEXUS لا تعني أن المنشور نُشر.'
              : 'Platform publishing is unavailable here until account, page, permissions, media, and explicit confirmation are ready. Scheduling in NEXUS does not mean the post has been published.'}
          </p>
        </div>
      </div>
    )
  }

  // ── Main UI ──────────────────────────────────────────────────────────────

  // ── Readiness (pure, no side effects) ───────────────────────────────────
  const readiness = getPublishReadiness({
    contentApproved,
    accountCount: accounts.length,
    hasPage: !!selectedPage,
    pageHasIgAccount: !!(selectedPage?.igAccountId),
    platform,
    hasImage: imageUrl.trim().length > 0,
    mode,
    hasScheduledAt: scheduledAt.trim().length > 0,
  })

  const canPublish = readiness.status === 'ready' && caption.trim().length > 0

  return (
    <div className="space-y-5" dir={dir}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">📤</span>
          <div>
            <h3 className="text-base font-semibold text-slate-950">
              {ar ? 'جاهزية النشر' : 'Publishing readiness'}
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              {ar
                ? 'راجع ما يمكن نشره وما يحتاج اتصال حساب وصلاحيات وتأكيدًا صريحًا.'
                : 'Review what can be published and what still needs account, permission, and explicit confirmation.'}
            </p>
          </div>
        </div>
        <button
          onClick={() => { loadAccounts(); loadPosts() }}
          className="rounded-lg p-1.5 text-slate-500 transition-all hover:bg-slate-100 hover:text-slate-700"
          title={ar ? 'تحديث' : 'Refresh'}
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Account + Page selector */}
      <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          {ar ? 'الحساب والصفحة' : 'Account & Page'}
        </p>

        {/* Account */}
        <div className="space-y-2">
          {accounts.map(acc => (
            <button
              key={acc.id}
              onClick={() => {
                setSelectedAccount(acc)
                setSelectedPage(acc.pages[0] || null)
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all text-left ${
                selectedAccount?.id === acc.id
                  ? 'border-blue-500/50 bg-blue-500/10'
                  : 'border-slate-200 bg-slate-50 hover:border-slate-300'
              }`}
            >
              {acc.pictureUrl ? (
                <img src={acc.pictureUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-sm font-bold" style={{ color: '#fff' }}>
                  {acc.accountName?.[0] || 'F'}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-semibold text-slate-950">{acc.accountName}</p>
                <p className="text-xs text-slate-500">Facebook / Instagram · {acc.pages.length} {ar ? 'صفحة' : 'page(s)'}</p>
              </div>
              {selectedAccount?.id === acc.id && (
                <CheckCircle2 className="w-4 h-4 text-blue-400 flex-shrink-0" />
              )}
            </button>
          ))}
        </div>

        {/* No pages warning */}
        {selectedAccount && selectedAccount.pages.length === 0 && (
          <div className="space-y-1 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-xs text-amber-800">
            <p className="font-semibold">⚠️ {ar ? 'لا توجد صفحات مربوطة' : 'No Facebook Pages found'}</p>
            <p className="leading-relaxed text-amber-700">
              {ar
                ? 'لنشر على Facebook أو Instagram عبر API، تحتاج إلى صفحة Facebook Business مربوطة بحسابك.'
                : 'To publish via the API, you need a Facebook Business Page linked to your account.'}
            </p>
            <a
              href="https://www.facebook.com/pages/create"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 underline font-semibold mt-1"
            >
              {ar ? 'إنشاء صفحة Facebook' : 'Create a Facebook Page'} →
            </a>
          </div>
        )}

        {/* Page selector */}
        {selectedAccount && selectedAccount.pages.length > 0 && (
          <div>
            <p className="mb-2 text-xs text-slate-500">{ar ? 'اختر الصفحة' : 'Select page'}</p>
            <div className="grid grid-cols-1 gap-1.5">
              {selectedAccount.pages.map(page => (
                <button
                  key={page.id}
                  onClick={() => setSelectedPage(page)}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border transition-all text-left ${
                    selectedPage?.id === page.id
                      ? 'border-accent/50 bg-accent/10'
                      : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                  }`}
                >
                  {page.igAccountId ? (
                    <span className="text-pink-400 text-sm flex-shrink-0">📸</span>
                  ) : (
                    <span className="text-blue-400 text-sm flex-shrink-0">👥</span>
                  )}
                  <span className="flex-1 truncate text-sm text-slate-700">{page.name}</span>
                  {page.igAccountId && (
                    <span className="text-xs text-pink-400 bg-pink-500/10 border border-pink-500/20 px-1.5 py-0.5 rounded-full flex-shrink-0">IG</span>
                  )}
                  {selectedPage?.id === page.id && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-accent flex-shrink-0" />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Platform toggle (only show if page has IG) */}
        {selectedPage?.igAccountId && (
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => setPlatform('FACEBOOK')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl border text-sm font-semibold transition-all ${
                platform === 'FACEBOOK'
                  ? 'border-blue-500/50 bg-blue-500/10 text-blue-300'
                  : 'border-slate-200 bg-slate-50 text-slate-500 hover:text-slate-700'
              }`}
            >
              👥 Facebook
            </button>
            <button
              onClick={() => setPlatform('INSTAGRAM')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl border text-sm font-semibold transition-all ${
                platform === 'INSTAGRAM'
                  ? 'border-pink-500/50 bg-pink-500/10 text-pink-300'
                  : 'border-slate-200 bg-slate-50 text-slate-500 hover:text-slate-700'
              }`}
            >
              📸 Instagram
            </button>
          </div>
        )}
      </div>

      {/* Caption composer */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            {ar ? 'نص المنشور' : 'Post Caption'}
          </p>
          {allSuggestions.length > 0 && (
            <button
              onClick={() => setShowSuggestions(s => !s)}
              className="flex items-center gap-1 text-xs text-accent hover:text-accent/80 transition-colors"
            >
              <Zap className="w-3 h-3" />
              {ar ? 'اقتراحات AI' : 'AI Suggestions'}
              <ChevronDown className={`w-3 h-3 transition-transform ${showSuggestions ? 'rotate-180' : ''}`} />
            </button>
          )}
        </div>

        {/* Suggestions */}
        {showSuggestions && allSuggestions.length > 0 && (
          <div className="space-y-2 rounded-xl border border-indigo-100 bg-indigo-50 p-3">
            <p className="text-xs text-slate-500">{ar ? 'اضغط لاستخدام' : 'Click to use'}</p>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {allSuggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => { setCaption(s); setShowSuggestions(false) }}
                  className="w-full truncate rounded-lg border border-transparent px-3 py-2 text-left text-xs text-slate-700 transition-all hover:border-indigo-200 hover:bg-white hover:text-indigo-700"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        <textarea
          value={caption}
          onChange={e => setCaption(e.target.value)}
          placeholder={ar ? 'اكتب نص المنشور هنا...' : 'Write your post caption here...'}
          rows={4}
          className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 placeholder-slate-400 transition-colors focus:border-indigo-300 focus:outline-none"
          dir={ar ? 'rtl' : 'ltr'}
        />
        <p className="text-right text-xs text-slate-400">{caption.length} {ar ? 'حرف' : 'chars'}</p>
      </div>

      {/* Image URL */}
      <div className="space-y-2">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
          <ImageIcon className="w-3 h-3" />
          {ar ? 'رابط الصورة (اختياري)' : 'Image URL (optional)'}
        </p>
        <input
          type="url"
          value={imageUrl}
          onChange={e => setImageUrl(e.target.value)}
          placeholder="https://..."
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 transition-colors focus:border-indigo-300 focus:outline-none"
        />
        {platform === 'INSTAGRAM' && !imageUrl && (
          <p className="text-xs text-amber-400 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            {ar ? 'Instagram يتطلب صورة' : 'Instagram requires an image'}
          </p>
        )}
      </div>

      {/* Mode selector — compact toggle */}
      <div className="flex items-center gap-2">
        <p className="flex-shrink-0 text-xs text-slate-500">{ar ? 'إجراء المنصة:' : 'Platform action:'}</p>
        <div className={`flex gap-1 rounded-xl border border-slate-200 p-1 ${
          readiness.status === 'locked' ? 'bg-slate-50 opacity-75' : 'bg-slate-100'
        }`}>
          <button
            onClick={() => setMode('now')}
            disabled={readiness.status === 'locked'}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              readiness.status === 'locked'
                ? 'cursor-not-allowed text-slate-400'
                : mode === 'now'
                ? 'bg-accent text-black'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Send className="w-3 h-3" />
            {ar ? 'API صريح' : 'Explicit API'}
          </button>
          <button
            onClick={() => setMode('schedule')}
            disabled={readiness.status === 'locked'}
            style={{ color: readiness.status !== 'locked' && mode === 'schedule' ? '#fff' : undefined }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              readiness.status === 'locked'
                ? 'cursor-not-allowed text-slate-400'
                : mode === 'schedule'
                ? 'bg-blue-600'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Clock className="w-3 h-3" />
            {ar ? 'جدولة' : 'Schedule'}
          </button>
        </div>
      </div>

      {/* Schedule datetime */}
      {mode === 'schedule' && readiness.status !== 'locked' && (
        <input
          type="datetime-local"
          value={scheduledAt}
          onChange={e => setScheduledAt(e.target.value)}
          min={new Date(Date.now() + 5 * 60 * 1000).toISOString().slice(0, 16)}
          className="w-full rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-sm text-slate-800 transition-colors focus:border-blue-300 focus:outline-none"
        />
      )}

      {/* Result feedback */}
      {result && (
        <div className={`flex items-start gap-3 px-4 py-3 rounded-xl border text-sm ${
          result.ok
            ? 'bg-green-500/10 border-green-500/30 text-green-400'
            : 'bg-red-500/10 border-red-500/30 text-red-400'
        }`}>
          {result.ok ? <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" /> : <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />}
          <div>
            {result.ok ? (
              <>
                <p className="font-semibold">
                  {mode === 'schedule'
                    ? (ar ? 'تمت الجدولة بنجاح ✓' : 'Scheduled successfully ✓')
                    : (ar ? 'تم الإرسال عبر API المنصة ✓' : 'Platform API publish completed ✓')
                  }
                </p>
                {result.url && (
                  <a href={result.url} target="_blank" rel="noreferrer" className="text-xs underline mt-1 inline-flex items-center gap-1">
                    {ar ? 'عرض المنشور' : 'View post'} <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                {mode !== 'schedule' && (
                  <p className="mt-1.5 text-[11px] font-normal leading-snug text-slate-500">
                    {ar
                      ? 'يفتح "عرض المنشور" المنصة وقد لا يكون متاحًا إذا حُذف هناك. تظهر التحليلات عادةً خلال 24–72 ساعة؛ إذا حذفت المنشور على المنصة فلن يمكن جلب تحليلاته.'
                      : '"View post" opens the platform and may be unavailable if the post was deleted there. Analytics usually arrive within 24–72h; if you delete the post on the platform, its analytics can no longer be fetched.'}
                  </p>
                )}
              </>
            ) : (
              <p>{result.error}</p>
            )}
          </div>
        </div>
      )}

      {/* ── Readiness banner (OP-D1.3) ───────────────────────────────────── */}
      {readiness.status === 'locked' ? (
        <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl"
          style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.25)' }}>
          <Lock className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-red-400" />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-red-400">
              {ar ? readiness.title.ar : readiness.title.en}
            </p>
            <p className="mt-0.5 text-[11px] leading-snug text-slate-600">
              {ar ? readiness.copy.ar : readiness.copy.en}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl"
          style={{ background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.2)' }}>
          <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-green-400" />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-green-400">
              {ar ? readiness.title.ar : readiness.title.en}
            </p>
            <p className="mt-0.5 text-[11px] leading-snug text-slate-600">
              {ar ? readiness.copy.ar : readiness.copy.en}
            </p>
          </div>
        </div>
      )}

      {/* Publish button — disabled unless readiness is ready AND caption present */}
      <button
        onClick={handlePublish}
        disabled={!canPublish || publishing}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-sm font-bold transition-all hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:opacity-100"
        style={{ color: canPublish && !publishing ? '#fff' : undefined }}
      >
        {publishing ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            {ar ? 'جاري النشر...' : 'Publishing...'}
          </>
        ) : readiness.status === 'locked' ? (
          <>
            <Lock className="w-4 h-4" />
            {ar ? 'محظور' : 'Locked'}
          </>
        ) : mode === 'schedule' ? (
          <>
            <Clock className="w-4 h-4" />
            {ar ? (readiness.buttonLabel?.ar ?? 'جدولة المنشور') : (readiness.buttonLabel?.en ?? 'Schedule Post')}
          </>
        ) : (
          <>
            <Send className="w-4 h-4" />
            {ar ? (readiness.buttonLabel?.ar ?? 'النشر عبر API المنصة') : (readiness.buttonLabel?.en ?? 'Publish via platform API')}
            {selectedPage && <span className="text-xs opacity-70">→ {selectedPage.name}</span>}
          </>
        )}
      </button>

      {/* Published history */}
      {posts.length > 0 && (
        <div className="space-y-3 border-t border-slate-200 pt-2">
          <p className="pt-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            {ar ? 'سجل النشر' : 'Publishing History'}
          </p>
          <p className="text-[11px] leading-snug text-slate-500">
            {ar
              ? 'السجل يفرّق بين النشر اليدوي الذي أكده المستخدم والنشر عبر API. السجلات المنشورة محفوظة كدليل تشغيل، ويمكن فقط إلغاء الموعد أو إخفاء سجل فشل.'
              : 'This history separates user-confirmed manual publishing from platform/API publishing. Published records are retained as execution evidence; only schedules or failed records can be removed.'}
          </p>
          <div className="space-y-2">
            {posts.map(post => (
              <div key={post.id} className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                {post.platform === 'INSTAGRAM' ? (
                    <span className="text-pink-400 flex-shrink-0 mt-0.5">📸</span>
                  ) : (
                    <span className="text-blue-400 flex-shrink-0 mt-0.5">👥</span>
                  )}
                <div className="flex-1 min-w-0">
                  <p className="truncate text-xs text-slate-700">{post.caption}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                      post.status === 'PUBLISHED' ? 'bg-green-50 text-green-700 border border-green-200' :
                      post.status === 'SCHEDULED' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                      post.status === 'FAILED'    ? 'bg-red-50 text-red-700 border border-red-200' :
                      'bg-slate-100 text-slate-500 border border-slate-200'
                    }`}>
                      {post.status === 'PUBLISHED' ? (ar ? 'منشور' : 'Published') :
                       post.status === 'SCHEDULED' ? (ar ? 'مجدول — غير منشور' : 'Scheduled — not published') :
                       post.status === 'FAILED'    ? (ar ? 'فشل' : 'Failed') :
                       post.status}
                    </span>
                    <span className="text-xs text-slate-400">
                      {post.publishedAt
                        ? new Date(post.publishedAt).toLocaleDateString(ar ? 'ar-SA' : 'en-US')
                        : post.scheduledAt
                        ? new Date(post.scheduledAt).toLocaleString(ar ? 'ar-SA' : 'en-US')
                        : ''}
                    </span>
                    {post.platformUrl && (
                      <a
                        href={post.platformUrl}
                        target="_blank"
                        rel="noreferrer"
                        title={ar
                          ? 'يفتح على المنصة — قد لا يكون متاحًا إذا حُذف هناك'
                          : 'Opens on the platform — may be unavailable if deleted there'}
                        className="text-xs text-accent hover:underline flex items-center gap-0.5"
                      >
                        {ar ? 'عرض' : 'View'} <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    )}
                    {(post.status === 'SCHEDULED' || post.status === 'FAILED') && (
                      <button
                        onClick={() => setPendingRecordRemoval(post)}
                        disabled={removingId === post.id}
                        title={post.status === 'FAILED'
                          ? (ar ? 'إخفاء سجل الفشل من NEXUS فقط' : 'Dismiss the failed NEXUS record only')
                          : (ar ? 'إلغاء موعد NEXUS فقط' : 'Cancel the NEXUS schedule only')}
                        className="text-xs text-gray-500 hover:text-red-400 transition-colors disabled:opacity-40"
                      >
                        {removingId === post.id
                          ? '...'
                          : post.status === 'FAILED'
                            ? (ar ? 'إخفاء الفشل' : 'Dismiss failure')
                            : (ar ? 'إلغاء الموعد' : 'Cancel schedule')}
                      </button>
                    )}
                  </div>
                  {post.errorMessage && (
                    <p className="text-xs text-red-400 mt-1">{post.errorMessage}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {pendingRecordRemoval && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center px-4" style={{ background: 'rgba(15,23,42,0.52)', backdropFilter: 'blur(5px)' }}>
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 text-slate-950 shadow-2xl" dir={dir}>
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold">
                  {pendingRecordRemoval.status === 'FAILED'
                    ? (ar ? 'إخفاء سجل الفشل؟' : 'Dismiss failed record?')
                    : (ar ? 'إلغاء الموعد؟' : 'Cancel schedule?')}
                </h3>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  {pendingRecordRemoval.status === 'FAILED'
                    ? (ar ? 'سيُحذف سجل الفشل من NEXUS فقط، ولن يتغير أي شيء على المنصة.' : 'This removes the failed NEXUS record only and changes nothing on the platform.')
                    : (ar ? 'سيُلغى الموعد داخل NEXUS فقط. لا يحذف هذا الإجراء منشورًا حيًا من المنصة.' : 'This cancels the NEXUS schedule only. It does not delete a live platform post.')}
                </p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setPendingRecordRemoval(null)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                {ar ? 'رجوع' : 'Go back'}
              </button>
              <button type="button" onClick={() => handleRemoveFromHistory(pendingRecordRemoval)} disabled={removingId === pendingRecordRemoval.id} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50">
                {removingId === pendingRecordRemoval.id
                  ? (ar ? 'جارٍ التنفيذ...' : 'Working...')
                  : pendingRecordRemoval.status === 'FAILED'
                    ? (ar ? 'إخفاء السجل' : 'Dismiss record')
                    : (ar ? 'إلغاء الجدولة' : 'Cancel schedule')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
