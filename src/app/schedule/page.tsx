'use client'

import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n-context'
import { useEffect, useState } from 'react'
import AppShell from '@/components/AppShell'
import Link from 'next/link'

type ScheduledPost = {
  id: string
  caption: string
  platform: string
  pageName: string
  imageUrl?: string
  status: 'SCHEDULED' | 'PUBLISHED' | 'FAILED' | 'DRAFT'
  scheduledAt: string
  publishedAt?: string
  platformUrl?: string
  campaignId?: string
  errorMessage?: string
}

type Integration = {
  id: string
  platform: string
  accountName: string
  config: any
}

const PLATFORM_ICONS: Record<string, string> = {
  FACEBOOK: '👥',
  INSTAGRAM: '📸',
  META: '🌐',
}

const STATUS_STYLES: Record<string, string> = {
  SCHEDULED: 'bg-accent/15 text-accent',
  PUBLISHED: 'bg-green-500/15 text-green-400',
  FAILED: 'bg-red-500/15 text-red-400',
  DRAFT: 'bg-yellow-500/15 text-yellow-400',
}

export default function SchedulePage() {
  const { isAuthenticated, loading, authHeader } = useAuth()
  const { t, locale, isRTL, dir } = useI18n()
  const scT = t('schedule')

  const [posts, setPosts] = useState<ScheduledPost[]>([])
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Modal form state
  const [caption, setCaption] = useState('')
  const [selectedIntegration, setSelectedIntegration] = useState('')
  const [selectedPage, setSelectedPage] = useState('')
  const [selectedPageName, setSelectedPageName] = useState('')
  const [selectedPlatform, setSelectedPlatform] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!isAuthenticated) return
    const token = authHeader()

    Promise.all([
      fetch('/api/schedule', { headers: { Authorization: token } }).then(r => r.json()),
      fetch('/api/social/accounts', { headers: { Authorization: token } }).then(r => r.json()),
    ]).then(([schedData, socialData]) => {
      setPosts(schedData.posts || [])
      setIntegrations(socialData.accounts || socialData.integrations || [])
      setLoadingData(false)
    }).catch(() => setLoadingData(false))
  }, [isAuthenticated, authHeader])

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    await fetch(`/api/schedule?id=${id}`, {
      method: 'DELETE',
      headers: { Authorization: authHeader() },
    })
    setPosts(prev => prev.filter(p => p.id !== id))
    setDeletingId(null)
  }

  const handleSchedule = async () => {
    if (!caption || !selectedIntegration || !selectedPage || !scheduledAt) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/schedule', {
        method: 'POST',
        headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          integrationId: selectedIntegration,
          pageId: selectedPage,
          pageName: selectedPageName,
          caption,
          imageUrl: imageUrl || undefined,
          platform: selectedPlatform,
          scheduledAt,
        }),
      })
      const data = await res.json()
      if (data.post) {
        setPosts(prev => [data.post, ...prev])
        setShowModal(false)
        setCaption('')
        setScheduledAt('')
        setImageUrl('')
        setSelectedIntegration('')
        setSelectedPage('')
      }
    } catch {
      alert(scT?.errSchedule as string)
    } finally {
      setSubmitting(false)
    }
  }

  const getPages = (integrationId: string) => {
    const integ = integrations.find(i => i.id === integrationId)
    if (!integ) return []
    return integ.config?.pages || []
  }

  function formatDate(iso: string) {
    const d = new Date(iso)
    return d.toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    })
  }

  function timeUntil(iso: string) {
    const diff = new Date(iso).getTime() - Date.now()
    if (diff < 0) return scT?.timeNow as string
    const h = Math.floor(diff / 3600000)
    const m = Math.floor((diff % 3600000) / 60000)
    if (h > 24) {
      const days = Math.floor(h / 24)
      return (scT?.timeDay as string)?.replace('{h}', String(days)) ?? `${days}d`
    }
    if (h > 0) {
      return (scT?.timeHour as string)?.replace('{h}', String(h))?.replace('{m}', String(m)) ?? `${h}h ${m}m`
    }
    return (scT?.timeMinute as string)?.replace('{m}', String(m)) ?? `${m}m`
  }

  // Min datetime for scheduling (now + 5 min)
  const minDateTime = new Date(Date.now() + 5 * 60 * 1000).toISOString().slice(0, 16)

  if (loading) return (
    <div className="min-h-screen bg-dark flex items-center justify-center">
      <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (!isAuthenticated) return null

  const scheduled = posts.filter(p => p.status === 'SCHEDULED')
  const published = posts.filter(p => p.status === 'PUBLISHED')
  const failed = posts.filter(p => p.status === 'FAILED')

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto px-6 py-10 page-enter" dir={dir}>

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
              <span>Nexus</span><span>/</span>
              <span className="text-gray-300">{scT?.breadcrumb as string}</span>
            </div>
            <h1 className="text-3xl font-bold mb-1">{scT?.title as string}</h1>
            <p className="text-gray-400">{scT?.subtitle as string}</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-accent hover:bg-accent/90 text-white font-semibold rounded-xl text-sm transition-all"
            style={{ boxShadow: '0 0 20px rgba(255,149,0,0.20)' }}>
            {scT?.btnSchedule as string}
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: scT?.statPending as string, value: scheduled.length, color: 'text-accent' },
            { label: scT?.statPublished as string, value: published.length, color: 'text-green-400' },
            { label: scT?.statFailed as string, value: failed.length, color: 'text-red-400' },
          ].map(s => (
            <div key={s.label} className="rounded-xl border border-dark-tertiary bg-dark-secondary p-4">
              <div className={`text-3xl font-black ${s.color}`}>{s.value}</div>
              <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* No integrations warning */}
        {!loadingData && integrations.length === 0 && (
          <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/5 p-6 mb-6 flex items-center gap-4">
            <span className="text-2xl">⚠️</span>
            <div>
              <div className="font-semibold text-yellow-300 mb-1">
                {scT?.noIntegrationsTitle as string}
              </div>
              <p className="text-sm text-gray-400">{scT?.noIntegrationsDesc as string}</p>
            </div>
            <Link href="/settings"
              className={`${isRTL ? 'mr-auto' : 'ml-auto'} shrink-0 px-4 py-2 bg-yellow-500/10 border border-yellow-500/20 text-yellow-300 text-sm font-semibold rounded-lg hover:bg-yellow-500/20 transition-all`}>
              {scT?.btnConnectAccount as string}
            </Link>
          </div>
        )}

        {/* Queued posts */}
        {scheduled.length > 0 && (
          <div className="mb-8">
            <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500 mb-3">
              {scT?.sectionScheduled as string}
            </h2>
            <div className="space-y-3">
              {scheduled.map(post => (
                <div key={post.id} className="rounded-xl border border-dark-tertiary bg-dark-secondary p-5 flex items-start gap-4">
                  <div className="text-2xl shrink-0">{PLATFORM_ICONS[post.platform] || '📱'}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-xs font-bold text-gray-400">{post.pageName || post.platform}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-lg font-medium ${STATUS_STYLES[post.status]}`}>
                        {post.status.toLowerCase()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-300 mb-2 line-clamp-2">{post.caption}</p>
                    <div className="flex items-center gap-3 text-xs text-gray-600">
                      <span>🕐 {formatDate(post.scheduledAt)}</span>
                      <span className="text-accent font-medium">
                        {(scT?.postIn as string)?.replace('{time}', timeUntil(post.scheduledAt))}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(post.id)}
                    disabled={deletingId === post.id}
                    className="shrink-0 text-xs px-3 py-1.5 rounded-lg border border-dark-tertiary text-gray-600 hover:text-red-400 hover:border-red-400/30 transition-all disabled:opacity-40">
                    {deletingId === post.id ? '...' : scT?.btnCancel as string}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Published posts */}
        {published.length > 0 && (
          <div className="mb-8">
            <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500 mb-3">
              {scT?.sectionPublished as string}
            </h2>
            <div className="space-y-3">
              {published.slice(0, 5).map(post => (
                <div key={post.id} className="rounded-xl border border-dark-tertiary bg-dark-secondary p-5 flex items-start gap-4">
                  <div className="text-2xl shrink-0">{PLATFORM_ICONS[post.platform] || '📱'}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-xs font-bold text-gray-400">{post.pageName || post.platform}</span>
                      <span className="text-xs px-2 py-0.5 rounded-lg font-medium bg-green-500/15 text-green-400">
                        {scT?.statusPublished as string}
                      </span>
                    </div>
                    <p className="text-sm text-gray-300 mb-2 line-clamp-2">{post.caption}</p>
                    <div className="flex items-center gap-3 text-xs text-gray-600">
                      <span>✅ {post.publishedAt ? formatDate(post.publishedAt) : scT?.statusPublished as string}</span>
                      {post.platformUrl && (
                        <a href={post.platformUrl} target="_blank" rel="noopener noreferrer"
                          className="text-accent hover:underline">{scT?.btnViewPost as string}</a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Failed posts */}
        {failed.length > 0 && (
          <div className="mb-8">
            <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500 mb-3">
              {scT?.sectionFailed as string}
            </h2>
            <div className="space-y-3">
              {failed.map(post => (
                <div key={post.id} className="rounded-xl border border-red-500/20 bg-red-500/5 p-5 flex items-start gap-4">
                  <div className="text-2xl shrink-0">{PLATFORM_ICONS[post.platform] || '📱'}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-xs font-bold text-gray-400">{post.pageName}</span>
                      <span className="text-xs px-2 py-0.5 rounded-lg font-medium bg-red-500/15 text-red-400">
                        {scT?.statusFailed as string}
                      </span>
                    </div>
                    <p className="text-sm text-gray-300 mb-1 line-clamp-2">{post.caption}</p>
                    {post.errorMessage && (
                      <p className="text-xs text-red-400">{post.errorMessage}</p>
                    )}
                  </div>
                  <button onClick={() => handleDelete(post.id)}
                    className="shrink-0 text-xs px-3 py-1.5 rounded-lg border border-dark-tertiary text-gray-600 hover:text-red-400 transition-all">
                    {scT?.btnDismiss as string}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!loadingData && posts.length === 0 && (
          <div className="rounded-2xl border border-dark-tertiary bg-dark-secondary p-12 text-center">
            <div className="text-4xl mb-4">📅</div>
            <h2 className="font-bold text-white mb-2">{scT?.emptyTitle as string}</h2>
            <p className="text-sm text-gray-500 mb-6">{scT?.emptyDesc as string}</p>
            <button onClick={() => setShowModal(true)}
              className="px-5 py-2.5 bg-accent text-white font-bold rounded-xl text-sm hover:bg-accent/90 transition-all">
              {scT?.emptyBtn as string}
            </button>
          </div>
        )}

        {/* AI tip */}
        <div className="rounded-2xl border border-accent/20 bg-accent/5 p-5 mt-6">
          <div className="text-xs font-bold uppercase tracking-wider text-accent mb-2">
            {scT?.tipTitle as string}
          </div>
          <p className="text-sm text-gray-300 leading-relaxed">{scT?.tipDesc as string}</p>
          <Link href="/strategy" className="inline-flex items-center gap-1 mt-3 text-xs text-accent hover:underline font-medium">
            {scT?.tipLink as string}
          </Link>
        </div>
      </div>

      {/* SCHEDULE MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}>
          <div className="w-full max-w-lg rounded-2xl border border-dark-tertiary bg-dark overflow-hidden"
            dir={dir}
            style={{ boxShadow: '0 0 80px rgba(0,0,0,0.5)' }}>

            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-dark-tertiary">
              <h2 className="font-bold text-white">{scT?.modalTitle as string}</h2>
              <button onClick={() => setShowModal(false)}
                className="text-gray-600 hover:text-white transition-all text-xl">×</button>
            </div>

            <div className="p-6 space-y-5">
              {/* Caption */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 block">
                  {scT?.modalCaptionLabel as string}
                </label>
                <textarea
                  value={caption}
                  onChange={e => setCaption(e.target.value)}
                  placeholder={scT?.modalCaptionPlaceholder as string}
                  rows={4}
                  className="w-full px-4 py-3 rounded-xl bg-dark-secondary border border-dark-tertiary text-white placeholder-gray-600 text-sm focus:outline-none focus:border-accent/50 transition-all resize-none"
                  autoFocus
                />
                <div className="text-xs text-gray-600 mt-1 text-left">{caption.length}/2200</div>
              </div>

              {/* Account */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 block">
                  {scT?.modalAccountLabel as string}
                </label>
                {integrations.length === 0 ? (
                  <div className="p-3 rounded-xl bg-yellow-500/5 border border-yellow-500/20 text-sm text-yellow-400">
                    {scT?.modalNoAccounts as string}{' '}
                    <Link href="/settings" className="underline">{scT?.modalConnectLink as string}</Link>
                  </div>
                ) : (
                  <select
                    value={selectedIntegration}
                    onChange={e => {
                      setSelectedIntegration(e.target.value)
                      setSelectedPage('')
                    }}
                    className="w-full px-4 py-3 rounded-xl bg-dark-secondary border border-dark-tertiary text-white text-sm focus:outline-none focus:border-accent/50 transition-all"
                  >
                    <option value="">{scT?.modalAccountPlaceholder as string}</option>
                    {integrations.map(i => (
                      <option key={i.id} value={i.id}>{i.accountName || i.platform}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Page / Profile */}
              {selectedIntegration && getPages(selectedIntegration).length > 0 && (
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 block">
                    {scT?.modalPageLabel as string}
                  </label>
                  <select
                    value={selectedPage}
                    onChange={e => {
                      const pages = getPages(selectedIntegration)
                      const page = pages.find((p: any) => p.id === e.target.value)
                      setSelectedPage(e.target.value)
                      setSelectedPageName(page?.name || '')
                      setSelectedPlatform(page?.type === 'instagram' ? 'INSTAGRAM' : 'FACEBOOK')
                    }}
                    className="w-full px-4 py-3 rounded-xl bg-dark-secondary border border-dark-tertiary text-white text-sm focus:outline-none focus:border-accent/50 transition-all"
                  >
                    <option value="">{scT?.modalPagePlaceholder as string}</option>
                    {getPages(selectedIntegration).map((p: any) => (
                      <option key={p.id} value={p.id}>{p.name} ({p.type || 'facebook'})</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Date/Time */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 block">
                  {scT?.modalDateLabel as string}
                </label>
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  min={minDateTime}
                  onChange={e => setScheduledAt(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-dark-secondary border border-dark-tertiary text-white text-sm focus:outline-none focus:border-accent/50 transition-all"
                />
              </div>

              {/* Image URL (optional) */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 block">
                  {scT?.modalImageLabel as string}{' '}
                  <span className="text-gray-700 normal-case font-normal">
                    {scT?.modalImageOptional as string}
                  </span>
                </label>
                <input
                  type="url"
                  value={imageUrl}
                  onChange={e => setImageUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-4 py-3 rounded-xl bg-dark-secondary border border-dark-tertiary text-white placeholder-gray-600 text-sm focus:outline-none focus:border-accent/50 transition-all"
                />
              </div>
            </div>

            {/* Modal footer */}
            <div className="flex gap-3 px-6 py-4 border-t border-dark-tertiary">
              <button onClick={() => setShowModal(false)}
                className="flex-1 py-3 border border-dark-tertiary text-gray-400 hover:text-white rounded-xl text-sm font-medium transition-all">
                {scT?.btnCancel as string}
              </button>
              <button
                onClick={handleSchedule}
                disabled={!caption || !selectedIntegration || !selectedPage || !scheduledAt || submitting}
                className="flex-1 py-3 bg-accent hover:bg-accent/90 text-white font-bold rounded-xl text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {submitting ? scT?.modalSubmitting as string : scT?.modalSubmitBtn as string}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  )
}
