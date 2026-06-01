/**
 * SocialPublisher — Publish campaign content to connected social accounts.
 *
 * Features:
 * - Lists connected Meta accounts + pages
 * - Pre-populates caption from campaign strategy (hooks, captions, CTAs)
 * - Publish now (immediate) or Schedule (future date/time)
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
  ExternalLink, AlertCircle, RefreshCw, Zap,
} from 'lucide-react'

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
      const res = await fetch('/api/schedule', {
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
        <h3 className="font-bold text-base text-white">
          {ar ? 'لا توجد حسابات مربوطة' : 'No connected accounts'}
        </h3>
        <p className="text-sm text-gray-500 max-w-xs mx-auto">
          {ar
            ? 'ربط حساب Facebook أو Instagram من صفحة الاتصالات للبدء في النشر'
            : 'Connect a Facebook or Instagram account on the Connections page to start publishing'}
        </p>
        <a
          href="/connections"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-accent/20 border border-accent/30 text-accent text-sm font-semibold hover:bg-accent/30 transition-all"
        >
          <Zap className="w-4 h-4" />
          {ar ? 'ربط حساب الآن' : 'Connect account now'}
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    )
  }

  // ── Main UI ──────────────────────────────────────────────────────────────

  const canPublish = selectedAccount && selectedPage && caption.trim().length > 0

  return (
    <div className="space-y-5" dir={dir}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">📤</span>
          <div>
            <h3 className="font-bold text-base text-white">
              {ar ? 'النشر على السوشيال ميديا' : 'Publish to Social Media'}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {ar ? 'انشر محتوى الحملة مباشرة من هنا' : 'Publish campaign content directly from here'}
            </p>
          </div>
        </div>
        <button
          onClick={() => { loadAccounts(); loadPosts() }}
          className="p-1.5 rounded-lg hover:bg-dark-tertiary text-gray-500 hover:text-gray-300 transition-all"
          title={ar ? 'تحديث' : 'Refresh'}
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Account + Page selector */}
      <div className="bg-dark-tertiary rounded-2xl p-4 space-y-3">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
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
                  : 'border-dark-tertiary bg-dark-secondary hover:border-gray-600'
              }`}
            >
              {acc.pictureUrl ? (
                <img src={acc.pictureUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-bold">
                  {acc.accountName?.[0] || 'F'}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{acc.accountName}</p>
                <p className="text-xs text-gray-500">Facebook / Instagram · {acc.pages.length} {ar ? 'صفحة' : 'page(s)'}</p>
              </div>
              {selectedAccount?.id === acc.id && (
                <CheckCircle2 className="w-4 h-4 text-blue-400 flex-shrink-0" />
              )}
            </button>
          ))}
        </div>

        {/* No pages warning */}
        {selectedAccount && selectedAccount.pages.length === 0 && (
          <div className="px-3 py-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs space-y-1">
            <p className="font-semibold">⚠️ {ar ? 'لا توجد صفحات مربوطة' : 'No Facebook Pages found'}</p>
            <p className="text-amber-400/80 leading-relaxed">
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
            <p className="text-xs text-gray-500 mb-2">{ar ? 'اختر الصفحة' : 'Select page'}</p>
            <div className="grid grid-cols-1 gap-1.5">
              {selectedAccount.pages.map(page => (
                <button
                  key={page.id}
                  onClick={() => setSelectedPage(page)}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border transition-all text-left ${
                    selectedPage?.id === page.id
                      ? 'border-accent/50 bg-accent/10'
                      : 'border-transparent bg-dark-secondary hover:border-gray-700'
                  }`}
                >
                  {page.igAccountId ? (
                    <span className="text-pink-400 text-sm flex-shrink-0">📸</span>
                  ) : (
                    <span className="text-blue-400 text-sm flex-shrink-0">👥</span>
                  )}
                  <span className="text-sm text-gray-300 flex-1 truncate">{page.name}</span>
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
                  : 'border-transparent bg-dark-secondary text-gray-500 hover:text-gray-300'
              }`}
            >
              👥 Facebook
            </button>
            <button
              onClick={() => setPlatform('INSTAGRAM')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl border text-sm font-semibold transition-all ${
                platform === 'INSTAGRAM'
                  ? 'border-pink-500/50 bg-pink-500/10 text-pink-300'
                  : 'border-transparent bg-dark-secondary text-gray-500 hover:text-gray-300'
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
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
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
          <div className="bg-dark-tertiary rounded-xl p-3 space-y-2 border border-accent/20">
            <p className="text-xs text-gray-500">{ar ? 'اضغط لاستخدام' : 'Click to use'}</p>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {allSuggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => { setCaption(s); setShowSuggestions(false) }}
                  className="w-full text-left text-xs text-gray-300 px-3 py-2 rounded-lg hover:bg-dark-secondary hover:text-white transition-all border border-transparent hover:border-accent/20 truncate"
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
          className="w-full bg-dark-tertiary border border-dark-tertiary focus:border-accent/50 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 resize-none focus:outline-none transition-colors"
          dir={ar ? 'rtl' : 'ltr'}
        />
        <p className="text-xs text-gray-600 text-right">{caption.length} {ar ? 'حرف' : 'chars'}</p>
      </div>

      {/* Image URL */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
          <ImageIcon className="w-3 h-3" />
          {ar ? 'رابط الصورة (اختياري)' : 'Image URL (optional)'}
        </p>
        <input
          type="url"
          value={imageUrl}
          onChange={e => setImageUrl(e.target.value)}
          placeholder="https://..."
          className="w-full bg-dark-tertiary border border-dark-tertiary focus:border-accent/50 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none transition-colors"
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
        <p className="text-xs text-gray-500 flex-shrink-0">{ar ? 'وقت النشر:' : 'Publish:'}</p>
        <div className="flex gap-1 bg-dark-tertiary rounded-xl p-1">
          <button
            onClick={() => setMode('now')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              mode === 'now'
                ? 'bg-accent text-black'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <Send className="w-3 h-3" />
            {ar ? 'فوري' : 'Now'}
          </button>
          <button
            onClick={() => setMode('schedule')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              mode === 'schedule'
                ? 'bg-blue-600 text-white'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <Clock className="w-3 h-3" />
            {ar ? 'جدولة' : 'Schedule'}
          </button>
        </div>
      </div>

      {/* Schedule datetime */}
      {mode === 'schedule' && (
        <input
          type="datetime-local"
          value={scheduledAt}
          onChange={e => setScheduledAt(e.target.value)}
          min={new Date(Date.now() + 5 * 60 * 1000).toISOString().slice(0, 16)}
          className="w-full bg-dark-tertiary border border-blue-500/30 focus:border-blue-500/50 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none transition-colors"
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
                    : (ar ? 'تم النشر بنجاح ✓' : 'Published successfully ✓')
                  }
                </p>
                {result.url && (
                  <a href={result.url} target="_blank" rel="noreferrer" className="text-xs underline mt-1 inline-flex items-center gap-1">
                    {ar ? 'عرض المنشور' : 'View post'} <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </>
            ) : (
              <p>{result.error}</p>
            )}
          </div>
        </div>
      )}

      {/* Publish button */}
      <button
        onClick={handlePublish}
        disabled={!canPublish || publishing || (platform === 'INSTAGRAM' && !imageUrl)}
        className="w-full py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed bg-accent hover:bg-accent/90 text-black"
      >
        {publishing ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            {ar ? 'جاري النشر...' : 'Publishing...'}
          </>
        ) : mode === 'schedule' ? (
          <>
            <Clock className="w-4 h-4" />
            {ar ? 'جدولة المنشور' : 'Schedule Post'}
          </>
        ) : (
          <>
            <Send className="w-4 h-4" />
            {ar ? 'انشر الآن' : 'Publish Now'}
            {selectedPage && <span className="text-xs opacity-70">→ {selectedPage.name}</span>}
          </>
        )}
      </button>

      {/* Published history */}
      {posts.length > 0 && (
        <div className="space-y-3 pt-2 border-t border-dark-tertiary">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider pt-2">
            {ar ? 'سجل المنشورات' : 'Post History'}
          </p>
          <div className="space-y-2">
            {posts.map(post => (
              <div key={post.id} className="flex items-start gap-3 px-3 py-2.5 rounded-xl bg-dark-tertiary">
                {post.platform === 'INSTAGRAM' ? (
                    <span className="text-pink-400 flex-shrink-0 mt-0.5">📸</span>
                  ) : (
                    <span className="text-blue-400 flex-shrink-0 mt-0.5">👥</span>
                  )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-300 truncate">{post.caption}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                      post.status === 'PUBLISHED' ? 'bg-green-500/10 text-green-400' :
                      post.status === 'SCHEDULED' ? 'bg-blue-500/10 text-blue-400' :
                      post.status === 'FAILED'    ? 'bg-red-500/10 text-red-400' :
                      'bg-gray-500/10 text-gray-400'
                    }`}>
                      {post.status === 'PUBLISHED' ? (ar ? 'منشور' : 'Published') :
                       post.status === 'SCHEDULED' ? (ar ? 'مجدول' : 'Scheduled') :
                       post.status === 'FAILED'    ? (ar ? 'فشل' : 'Failed') :
                       post.status}
                    </span>
                    <span className="text-xs text-gray-600">
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
                        className="text-xs text-accent hover:underline flex items-center gap-0.5"
                      >
                        {ar ? 'عرض' : 'View'} <ExternalLink className="w-2.5 h-2.5" />
                      </a>
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
    </div>
  )
}
