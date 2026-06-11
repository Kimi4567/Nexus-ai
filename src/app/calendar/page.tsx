'use client'

import { useAuth } from '@/lib/auth-context'
import { useEffect, useState, useMemo, useRef, Suspense } from 'react'
import AppShell from '@/components/AppShell'
import Link from 'next/link'
import { useI18n } from '@/lib/i18n-context'
import { useSearchParams } from 'next/navigation'

// ─── Types ────────────────────────────────────────────────────────────────────

type CalendarPost = {
  id: string
  campaignId: string
  campaignName: string
  campaignColor: string
  date: string          // 'YYYY-MM-DD'
  day: number           // day of month
  month: number
  year: number
  platform: string
  type: string
  topic: string
  hook?: string
  caption?: string
  cta?: string
  visualNote?: string
  source?: 'campaign_ai_output' | 'legacy' | 'scheduled' | 'published'
  scheduledAt?: string  // ISO string for scheduled posts
  publishStatus?: 'SCHEDULED' | 'PUBLISHED' | 'FAILED' | 'DRAFT'
}

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

// ─── Constants ────────────────────────────────────────────────────────────────

const PLATFORM_COLORS: Record<string, string> = {
  Instagram: '#e1306c',
  Facebook:  '#1877f2',
  LinkedIn:  '#0a66c2',
  TikTok:    '#010101',
  Twitter:   '#1da1f2',
  YouTube:   '#ff0000',
  Pinterest: '#e60023',
  Snapchat:  '#fffc00',
  FACEBOOK:  '#1877F2',
  INSTAGRAM: '#E1306C',
  META:      '#0668E1',
  LINKEDIN:  '#0A66C2',
  TIKTOK:    '#69C9D0',
  YOUTUBE:   '#FF0000',
  TWITTER:   '#1DA1F2',
}

const PLATFORM_ICONS_CAL: Record<string, string> = {
  Instagram: '📸',
  Facebook:  '👥',
  LinkedIn:  '💼',
  TikTok:    '🎵',
  Twitter:   '🐦',
  YouTube:   '▶️',
  Pinterest: '📌',
  Snapchat:  '👻',
}

const PLATFORM_ICONS_SCH: Record<string, string> = {
  FACEBOOK:  '👥',
  INSTAGRAM: '📸',
  META:      '🌐',
  LINKEDIN:  '💼',
  TIKTOK:    '🎵',
  SNAPCHAT:  '👻',
  YOUTUBE:   '▶️',
  TWITTER:   '𝕏',
}

const STATUS_STYLES: Record<string, string> = {
  SCHEDULED: 'bg-accent/15 text-accent',
  PUBLISHED: 'bg-green-500/15 text-green-400',
  FAILED: 'bg-red-500/15 text-red-400',
  DRAFT: 'bg-yellow-500/15 text-yellow-400',
}

const CAMPAIGN_COLORS = [
  { bg: 'rgba(99,102,241,0.18)',  text: '#a5b4fc', dot: '#6366f1' },
  { bg: 'rgba(236,72,153,0.18)', text: '#f9a8d4', dot: '#ec4899' },
  { bg: 'rgba(245,158,11,0.18)', text: '#fcd34d', dot: '#f59e0b' },
  { bg: 'rgba(16,185,129,0.18)', text: '#6ee7b7', dot: '#10b981' },
  { bg: 'rgba(59,130,246,0.18)', text: '#93c5fd', dot: '#3b82f6' },
  { bg: 'rgba(239,68,68,0.18)',  text: '#fca5a5', dot: '#ef4444' },
]

const DAY_NAME_TO_INDEX: Record<string, number> = {
  monday: 1, tuesday: 2, wednesday: 3, thursday: 4,
  friday: 5, saturday: 6, sunday: 0,
  mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6, sun: 0,
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay()
}

function getMondayOfWeek(date: Date): Date {
  const d = new Date(date)
  const dow = d.getDay()
  const diff = dow === 0 ? -6 : 1 - dow
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function resolveDayOffset(raw: string | number): number {
  if (typeof raw === 'number') return Math.max(0, Math.min(6, raw - 1))
  const lower = String(raw).toLowerCase().trim()
  const dayNum = lower.match(/^day\s*(\d)/)
  if (dayNum) return Math.max(0, Math.min(6, parseInt(dayNum[1]) - 1))
  if (DAY_NAME_TO_INDEX[lower] !== undefined) {
    const idx = DAY_NAME_TO_INDEX[lower]
    return idx === 0 ? 6 : idx - 1
  }
  return 0
}

function extractPostsFromCampaign(campaign: any, colorIndex: number): CalendarPost[] {
  const aiOutput = campaign.aiOutput
  if (!aiOutput) return []
  const color = CAMPAIGN_COLORS[colorIndex % CAMPAIGN_COLORS.length]
  const campaignName = campaign.title || campaign.name || 'Campaign'
  const posts: CalendarPost[] = []

  const calendarItems: any[] = aiOutput.calendarItems || []
  if (calendarItems.length > 0) {
    calendarItems.forEach((item: any) => {
      if (!item.date) return
      const d = new Date(item.date + 'T00:00:00')
      if (isNaN(d.getTime())) return
      const platform = normaliseplatform(item.platform)
      posts.push({
        id:            item.id || `${campaign.id}-ci-${posts.length}`,
        campaignId:    campaign.id,
        campaignName,
        campaignColor: color.dot,
        date:          item.date,
        day:           d.getDate(),
        month:         d.getMonth(),
        year:          d.getFullYear(),
        platform,
        type:          item.contentType || 'Post',
        topic:         item.topic || item.title || 'Content',
        hook:          item.hook,
        caption:       item.caption,
        cta:           item.cta,
        visualNote:    item.visualNote,
        source:        'campaign_ai_output',
      })
    })
    return posts
  }

  const flatCalendar: any[] = aiOutput.contentCalendar || aiOutput.strategy?.contentCalendar || []
  if (Array.isArray(flatCalendar) && flatCalendar.length > 0 && flatCalendar[0]?.posts) {
    const createdAt = new Date(campaign.createdAt)
    const weekStart = getMondayOfWeek(createdAt)
    flatCalendar.forEach((weekObj: any, weekIdx: number) => {
      if (!Array.isArray(weekObj.posts)) return
      weekObj.posts.forEach((post: any, postIdx: number) => {
        const dayOffset  = resolveDayOffset(post.day ?? post.dayOfWeek ?? 1)
        const weekOffset = weekIdx * 7
        const postDate   = new Date(weekStart)
        postDate.setDate(postDate.getDate() + weekOffset + dayOffset)
        const platform = normaliseplatform(post.platform)
        posts.push({
          id:            `${campaign.id}-fc${weekIdx}-p${postIdx}`,
          campaignId:    campaign.id,
          campaignName,
          campaignColor: color.dot,
          date:          postDate.toISOString().slice(0, 10),
          day:           postDate.getDate(),
          month:         postDate.getMonth(),
          year:          postDate.getFullYear(),
          platform,
          type:          post.type || post.contentType || 'Post',
          topic:         post.topic || post.title || post.content || 'Content',
          hook:          post.hook,
          caption:       post.caption || post.content,
          cta:           post.cta,
          visualNote:    post.visual || post.visualNote,
          source:        'legacy',
        })
      })
    })
    if (posts.length > 0) return posts
  }

  const weeks: any[] = aiOutput.strategy?.contentCalendar?.weeks || []
  if (weeks.length > 0) {
    const createdAt = new Date(campaign.createdAt)
    const weekStart = getMondayOfWeek(createdAt)
    weeks.forEach((week: any, weekIdx: number) => {
      if (!Array.isArray(week.posts)) return
      week.posts.forEach((post: any, postIdx: number) => {
        const dayOffset  = resolveDayOffset(post.day ?? post.dayOfWeek ?? 1)
        const weekOffset = weekIdx * 7
        const postDate   = new Date(weekStart)
        postDate.setDate(postDate.getDate() + weekOffset + dayOffset)
        const platform = normaliseplatform(post.platform)
        posts.push({
          id:            `${campaign.id}-w${weekIdx}-p${postIdx}`,
          campaignId:    campaign.id,
          campaignName,
          campaignColor: color.dot,
          date:          postDate.toISOString().slice(0, 10),
          day:           postDate.getDate(),
          month:         postDate.getMonth(),
          year:          postDate.getFullYear(),
          platform,
          type:          post.type || post.contentType || 'Post',
          topic:         post.topic || post.title || post.content || 'Content',
          hook:          post.hook,
          caption:       post.caption,
          cta:           post.cta,
          source:        'legacy',
        })
      })
    })
  }
  return posts
}

function normaliseplatform(raw: string | undefined): string {
  if (!raw) return 'Instagram'
  const map: Record<string, string> = {
    instagram: 'Instagram', facebook: 'Facebook', linkedin: 'LinkedIn',
    tiktok: 'TikTok', twitter: 'Twitter', youtube: 'YouTube',
    youtube_shorts: 'YouTube', snapchat: 'Snapchat', pinterest: 'Pinterest',
    general: 'Instagram',
  }
  return map[raw.toLowerCase()] || raw
}

function normalisePlatformQueue(raw: string | undefined): string {
  if (!raw) return 'Instagram'
  const map: Record<string, string> = {
    FACEBOOK: 'Facebook', INSTAGRAM: 'Instagram', LINKEDIN: 'LinkedIn',
    TIKTOK: 'TikTok', TWITTER: 'Twitter', YOUTUBE: 'YouTube',
    META: 'Facebook', SNAPCHAT: 'Snapchat',
  }
  return map[raw.toUpperCase()] || normaliseplatform(raw)
}

function convertScheduledToCalendarPosts(
  scheduledPosts: ScheduledPost[],
  campaigns: any[]
): CalendarPost[] {
  return scheduledPosts
    .filter(p => p.scheduledAt && p.status !== 'FAILED')
    .map(p => {
      const d = new Date(p.scheduledAt)
      if (isNaN(d.getTime())) return null
      const campaign = campaigns.find(c => c.id === p.campaignId)
      const campaignIdx = campaigns.findIndex(c => c.id === p.campaignId)
      const color = campaignIdx >= 0
        ? CAMPAIGN_COLORS[campaignIdx % CAMPAIGN_COLORS.length]
        : null
      const isPublished = p.status === 'PUBLISHED'
      return {
        id:            `sched-${p.id}`,
        campaignId:    p.campaignId || 'queue',
        campaignName:  campaign?.title || campaign?.name || p.pageName || 'Scheduled',
        campaignColor: isPublished ? '#10b981' : '#34d399',
        date:          d.toISOString().slice(0, 10),
        day:           d.getDate(),
        month:         d.getMonth(),
        year:          d.getFullYear(),
        platform:      normalisePlatformQueue(p.platform),
        type:          isPublished ? 'Published' : 'Scheduled',
        topic:         p.caption?.slice(0, 70) || 'Scheduled Post',
        scheduledAt:   p.scheduledAt,
        publishStatus: p.status,
        source:        (isPublished ? 'published' : 'scheduled') as 'published' | 'scheduled',
      }
    })
    .filter(Boolean) as CalendarPost[]
}

// ─── Component ────────────────────────────────────────────────────────────────

// Suspense wrapper required: useSearchParams() is used inside.
export default function CalendarPage() {
  return (
    <Suspense fallback={null}>
      <CalendarPageInner />
    </Suspense>
  )
}

function CalendarPageInner() {
  const { isAuthenticated, loading, authHeader } = useAuth()
  const { t, locale, isRTL, dir } = useI18n()
  const calT = t('calendar')
  const scT  = t('schedule')
  const searchParams = useSearchParams()

  const intlLocale = locale === 'ar' ? 'ar-SA' : 'en-US'
  const MONTHS = Array.from({ length: 12 }, (_, i) =>
    new Intl.DateTimeFormat(intlLocale, { month: 'long' }).format(new Date(2024, i, 1))
  )
  const DAYS = Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(intlLocale, { weekday: 'short' }).format(new Date(2024, 0, 7 + i))
  )

  // ── Tab state ──────────────────────────────────────────────────────────────
  const defaultTab = searchParams.get('tab') === 'queue' ? 'queue' : 'timeline'
  const [activeTab, setActiveTab] = useState<'timeline' | 'queue'>(defaultTab as any)

  // ── Strategy Timeline state ────────────────────────────────────────────────
  const [campaigns, setCampaigns]     = useState<any[]>([])
  const [loadingCal, setLoadingCal]   = useState(true)
  const now = new Date()
  const [viewMonth, setViewMonth]     = useState(now.getMonth())
  const [viewYear,  setViewYear]      = useState(now.getFullYear())
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [autoJumpBanner, setAutoJumpBanner] = useState<string | null>(null)
  const hasAutoJumpedRef = useRef(false)

  // ── Published Queue state ──────────────────────────────────────────────────
  const [posts, setPosts]               = useState<ScheduledPost[]>([])
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [loadingQueue, setLoadingQueue] = useState(true)
  const [showModal, setShowModal]       = useState(false)
  const [deletingId, setDeletingId]     = useState<string | null>(null)

  // Modal form state
  const [caption, setCaption]                   = useState('')
  const [selectedIntegration, setSelectedIntegration] = useState('')
  const [selectedPage, setSelectedPage]         = useState('')
  const [selectedPageName, setSelectedPageName] = useState('')
  const [selectedPlatform, setSelectedPlatform] = useState('')
  const [scheduledAt, setScheduledAt]           = useState('')
  const [imageUrl, setImageUrl]                 = useState('')
  const [submitting, setSubmitting]             = useState(false)

  // ── Fetch calendar data ────────────────────────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated) return
    const token = authHeader()
    fetch('/api/campaigns', { headers: { Authorization: token } })
      .then(r => r.json())
      .then(data => { setCampaigns(data.campaigns || []); setLoadingCal(false) })
      .catch(() => setLoadingCal(false))
  }, [isAuthenticated])

  // ── Fetch queue data ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated) return
    const token = authHeader()
    Promise.all([
      fetch('/api/schedule', { headers: { Authorization: token } }).then(r => r.json()),
      fetch('/api/social/accounts', { headers: { Authorization: token } }).then(r => r.json()),
    ]).then(([schedData, socialData]) => {
      setPosts(schedData.posts || [])
      setIntegrations(socialData.accounts || socialData.integrations || [])
      setLoadingQueue(false)
    }).catch(() => setLoadingQueue(false))
  }, [isAuthenticated])

  // ── Calendar derived state ─────────────────────────────────────────────────
  const allPosts = useMemo(() => {
    const out: CalendarPost[] = []
    // 1. AI-planned posts from campaign aiOutput
    campaigns.forEach((c, i) => out.push(...extractPostsFromCampaign(c, i)))
    // 2. Approved + scheduled SocialPost records — overlay on calendar grid
    const scheduledCalPosts = convertScheduledToCalendarPosts(posts, campaigns)
    // Avoid exact duplicates: skip if same campaignId + date + platform already exists from aiOutput
    scheduledCalPosts.forEach(sp => {
      const isDuplicate = out.some(
        p =>
          p.source === 'campaign_ai_output' &&
          p.date === sp.date &&
          p.platform.toLowerCase() === sp.platform.toLowerCase() &&
          p.campaignId === sp.campaignId
      )
      if (!isDuplicate) out.push(sp)
    })
    return out
  }, [campaigns, posts])

  const monthPosts = useMemo(
    () => allPosts.filter(p => p.month === viewMonth && p.year === viewYear),
    [allPosts, viewMonth, viewYear]
  )

  useEffect(() => {
    if (loadingCal) return
    if (hasAutoJumpedRef.current) return
    const pushedPosts = allPosts.filter(
      p => p.source === 'campaign_ai_output' || p.source === 'scheduled' || p.source === 'published'
    )
    if (pushedPosts.length === 0) return
    const curMonth = now.getMonth()
    const curYear  = now.getFullYear()
    const currentMonthHasItems = pushedPosts.some(p => p.month === curMonth && p.year === curYear)
    if (currentMonthHasItems) return
    const sorted = [...pushedPosts].sort((a, b) =>
      a.year !== b.year ? a.year - b.year : a.month - b.month
    )
    const target = sorted[0]
    hasAutoJumpedRef.current = true
    setViewMonth(target.month)
    setViewYear(target.year)
    const label = new Intl.DateTimeFormat(intlLocale, { month: 'long', year: 'numeric' })
      .format(new Date(target.year, target.month, 1))
    setAutoJumpBanner(label)
  }, [loadingCal, allPosts])

  const getPostsForDay = (day: number) => monthPosts.filter(p => p.day === day)

  const daysInMonth    = getDaysInMonth(viewYear, viewMonth)
  const firstDay       = getFirstDayOfMonth(viewYear, viewMonth)
  const todayDate      = now.getDate()
  const isCurrentMonth = now.getMonth() === viewMonth && now.getFullYear() === viewYear

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
    setSelectedDay(null)
  }
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
    setSelectedDay(null)
  }

  const selectedDayPosts = selectedDay ? getPostsForDay(selectedDay) : []

  const platformBreakdown = monthPosts.reduce((acc, p) => {
    acc[p.platform] = (acc[p.platform] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const calStats = {
    total: monthPosts.length,
    platforms: Object.keys(platformBreakdown).length,
    campaigns: new Set(monthPosts.map(p => p.campaignId)).size,
  }

  // ── Queue derived state ────────────────────────────────────────────────────
  const scheduled = posts.filter(p => p.status === 'SCHEDULED')
  const published  = posts.filter(p => p.status === 'PUBLISHED')
  const failed     = posts.filter(p => p.status === 'FAILED')

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
      alert(scT?.errSchedule as string || 'Failed to schedule post')
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
    if (diff < 0) return scT?.timeNow as string || 'Now'
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

  const minDateTime = new Date(Date.now() + 5 * 60 * 1000).toISOString().slice(0, 16)

  if (loading) return (
    <div className="min-h-screen bg-dark flex items-center justify-center">
      <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (!isAuthenticated) return null

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10 page-enter" dir={dir}>

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
              <span>Nexus</span><span>/</span>
              <span className="text-gray-300">Calendar</span>
            </div>
            <h1 className="text-3xl font-bold mb-1">
              {activeTab === 'timeline' ? 'Content Calendar' : 'Published Queue'}
            </h1>
            <p className="text-gray-400">
              {activeTab === 'timeline'
                ? 'Your AI-planned content pipeline across all campaigns.'
                : 'Scheduled and published posts across all connected accounts.'}
            </p>
          </div>

          {/* Action button */}
          {activeTab === 'timeline' ? (
            <Link href="/campaigns/new"
              className="flex items-center gap-2 px-4 py-2.5 bg-accent hover:bg-accent/90 text-white font-semibold rounded-xl text-sm transition-all">
              + New Campaign
            </Link>
          ) : (
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-accent hover:bg-accent/90 text-white font-semibold rounded-xl text-sm transition-all"
              style={{ boxShadow: '0 0 20px rgba(255,149,0,0.20)' }}>
              {scT?.btnSchedule as string || '+ Schedule Post'}
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-dark-secondary border border-dark-tertiary w-fit mb-8">
          <button
            onClick={() => setActiveTab('timeline')}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'timeline'
                ? 'bg-accent text-white shadow-sm'
                : 'text-gray-400 hover:text-white'
            }`}>
            📅 {locale === 'ar' ? 'الجدول الزمني' : 'Strategy Timeline'}
          </button>
          <button
            onClick={() => setActiveTab('queue')}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'queue'
                ? 'bg-accent text-white shadow-sm'
                : 'text-gray-400 hover:text-white'
            }`}>
            📤 {locale === 'ar' ? 'قائمة النشر' : 'Published Queue'}
            {scheduled.length > 0 && (
              <span className="ml-2 px-1.5 py-0.5 rounded-full bg-white/20 text-[10px] font-bold">
                {scheduled.length}
              </span>
            )}
          </button>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* TAB 1: STRATEGY TIMELINE                                           */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'timeline' && (
          <>
            {/* Auto-jump banner */}
            {autoJumpBanner && (
              <div className="flex items-center justify-between gap-3 mb-4 px-4 py-3 rounded-xl border border-cyan-500/25 bg-cyan-500/8 text-sm">
                <div className="flex items-center gap-2 text-cyan-300">
                  <span>📅</span>
                  <span>
                    {locale === 'ar'
                      ? `تم الانتقال إلى ${autoJumpBanner} — هذا هو الشهر الذي تم جدولة محتواك فيه`
                      : `Jumped to ${autoJumpBanner} — that's where your scheduled content landed`
                    }
                  </span>
                </div>
                <button
                  onClick={() => setAutoJumpBanner(null)}
                  className="flex-shrink-0 w-5 h-5 rounded flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/10 transition-all text-xs font-bold"
                  aria-label="Dismiss">
                  ✕
                </button>
              </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3 mb-3">
              {[
                { label: 'Posts This Month', value: calStats.total,     color: 'text-white'      },
                { label: 'Active Campaigns', value: calStats.campaigns,  color: 'text-indigo-400' },
                { label: 'Platforms',        value: calStats.platforms,  color: 'text-amber-400'  },
              ].map(s => (
                <div key={s.label} className="rounded-xl border border-dark-tertiary bg-dark-secondary p-4">
                  <div className={`text-2xl font-black ${s.color}`}>{s.value}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 mb-5 px-1">
              <div className="flex items-center gap-1.5">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-indigo-500/60" />
                <span className="text-[11px] text-gray-500">✦ AI Planned</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500/60" />
                <span className="text-[11px] text-gray-500">🕐 Scheduled</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-500/60" />
                <span className="text-[11px] text-gray-500">✅ Published</span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

              {/* Calendar Grid */}
              <div className="lg:col-span-2 rounded-2xl border border-dark-tertiary bg-dark-secondary overflow-hidden">

                {/* Month nav */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-dark-tertiary">
                  <button onClick={prevMonth}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/5 transition-all">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                      <path d="M9 2L4 7l5 5" />
                    </svg>
                  </button>
                  <div className="text-center">
                    <h2 className="font-bold text-white">{MONTHS[viewMonth]} {viewYear}</h2>
                    {loadingCal && <span className="text-[10px] text-gray-600">Loading…</span>}
                  </div>
                  <button onClick={nextMonth}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/5 transition-all">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                      <path d="M5 2l5 5-5 5" />
                    </svg>
                  </button>
                </div>

                {/* Day headers */}
                <div className="grid grid-cols-7 border-b border-dark-tertiary">
                  {DAYS.map(d => (
                    <div key={d} className="py-2 text-center text-xs font-bold text-gray-600 uppercase tracking-wider">
                      {d}
                    </div>
                  ))}
                </div>

                {/* Days grid */}
                <div className="grid grid-cols-7">
                  {Array.from({ length: firstDay }).map((_, i) => (
                    <div key={`empty-${i}`} className="h-20 border-b border-r border-[#161622]" />
                  ))}
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day      = i + 1
                    const dayPosts = getPostsForDay(day)
                    const isToday    = isCurrentMonth && day === todayDate
                    const isSelected = selectedDay === day
                    return (
                      <div
                        key={day}
                        onClick={() => setSelectedDay(isSelected ? null : day)}
                        className={`h-20 border-b border-r border-[#161622] p-1.5 cursor-pointer transition-all
                          ${isSelected ? 'bg-accent/8' : 'hover:bg-white/2'}`}>
                        <div className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold mb-1
                          ${isToday ? 'bg-accent text-white' : isSelected ? 'text-accent' : 'text-gray-500'}`}>
                          {day}
                        </div>
                        <div className="space-y-0.5">
                          {dayPosts.slice(0, 2).map((post, pi) => {
                            const isScheduled = post.source === 'scheduled'
                            const isPublished = post.source === 'published'
                            return (
                              <div key={pi}
                                className="text-[9px] px-1 py-0.5 rounded truncate font-medium flex items-center gap-0.5"
                                style={
                                  isPublished
                                    ? { background: 'rgba(16,185,129,0.22)', color: '#6ee7b7' }
                                    : isScheduled
                                      ? { background: 'rgba(52,211,153,0.18)', color: '#34d399' }
                                      : { background: post.campaignColor + '30', color: post.campaignColor }
                                }>
                                <span className="flex-shrink-0">
                                  {isPublished ? '✅' : isScheduled ? '🕐' : (PLATFORM_ICONS_CAL[post.platform] || '📱')}
                                </span>
                                <span className="truncate">{post.topic}</span>
                              </div>
                            )
                          })}
                          {dayPosts.length > 2 && (
                            <div className="text-[9px] text-gray-600">+{dayPosts.length - 2} more</div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Side Panel */}
              <div className="space-y-4">

                {/* Selected day detail */}
                {selectedDay ? (
                  <div className="rounded-2xl border border-dark-tertiary bg-dark-secondary p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-bold text-white">{MONTHS[viewMonth]} {selectedDay}</h3>
                      <Link href="/campaigns/new"
                        className="text-xs px-3 py-1.5 rounded-lg border border-accent/30 text-accent hover:bg-accent/10 transition-all">
                        + Add
                      </Link>
                    </div>
                    {selectedDayPosts.length === 0 ? (
                      <div className="text-center py-6">
                        <div className="text-2xl mb-2">📅</div>
                        <p className="text-sm text-gray-500">{calT?.emptyDay as string || 'No posts scheduled'}</p>
                        <Link href="/campaigns/new"
                          className="inline-block mt-3 text-xs text-accent hover:underline">
                          {calT?.btnNewCampaign as string || 'Create campaign'}
                        </Link>
                      </div>
                    ) : (
                      <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                        {selectedDayPosts.map(post => {
                          const isScheduled = post.source === 'scheduled'
                          const isPublished = post.source === 'published'
                          const isAiPlanned = post.source === 'campaign_ai_output'
                          return (
                            <div key={post.id}
                              className="p-3 rounded-xl bg-dark border transition-all"
                              style={{
                                borderColor: isPublished
                                  ? 'rgba(16,185,129,0.25)'
                                  : isScheduled
                                    ? 'rgba(52,211,153,0.20)'
                                    : '#1e1e2e',
                              }}>
                              {/* Header row */}
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-sm">{PLATFORM_ICONS_CAL[post.platform] || '📱'}</span>
                                <span className="text-xs font-bold"
                                  style={{ color: PLATFORM_COLORS[post.platform] || '#FF9500' }}>
                                  {post.platform}
                                </span>
                                {/* Status badge */}
                                {isPublished && (
                                  <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded-full font-semibold bg-green-500/15 text-green-400 flex items-center gap-0.5">
                                    ✅ Published
                                  </span>
                                )}
                                {isScheduled && (
                                  <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded-full font-semibold bg-emerald-500/15 text-emerald-400 flex items-center gap-0.5">
                                    🕐 Scheduled
                                  </span>
                                )}
                                {isAiPlanned && (
                                  <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded-full font-semibold bg-cyan-500/15 text-cyan-400">
                                    ✦ AI Planned
                                  </span>
                                )}
                                {!isPublished && !isScheduled && !isAiPlanned && (
                                  <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-gray-400">
                                    {post.type}
                                  </span>
                                )}
                              </div>

                              {/* Content */}
                              <p className="text-sm font-semibold text-white leading-snug mb-1">{post.topic}</p>

                              {post.hook && (
                                <p className="text-[11px] text-gray-400 italic leading-relaxed mb-1">
                                  &ldquo;{post.hook}&rdquo;
                                </p>
                              )}
                              {post.caption && !isScheduled && !isPublished && (
                                <p className="text-[11px] text-gray-500 leading-relaxed mb-1 line-clamp-2">
                                  {post.caption}
                                </p>
                              )}
                              {post.cta && (
                                <p className="text-[11px] text-accent font-medium">CTA: {post.cta}</p>
                              )}
                              {post.visualNote && (
                                <p className="text-[10px] text-purple-400/70 mt-1">🎨 {post.visualNote}</p>
                              )}

                              {/* Scheduled time */}
                              {(isScheduled || isPublished) && post.scheduledAt && (
                                <p className="text-[10px] text-gray-500 mt-1">
                                  🕐 {new Date(post.scheduledAt).toLocaleTimeString(
                                    locale === 'ar' ? 'ar-SA' : 'en-US',
                                    { hour: '2-digit', minute: '2-digit' }
                                  )}
                                </p>
                              )}

                              {/* Footer */}
                              <div className="flex items-center justify-between mt-2 pt-2 border-t border-dark-tertiary">
                                <span className="text-[10px] text-gray-600 flex items-center gap-1">
                                  <span className="w-2 h-2 rounded-full inline-block flex-shrink-0"
                                    style={{ background: isPublished ? '#10b981' : isScheduled ? '#34d399' : post.campaignColor }} />
                                  <span className="truncate max-w-[100px]">{post.campaignName}</span>
                                </span>
                                {post.campaignId && post.campaignId !== 'queue' && (
                                  <Link href={`/campaigns/${post.campaignId}`}
                                    className="text-[10px] text-accent hover:underline flex-shrink-0">
                                    {calT?.calendarViewCampaign as string || 'View'} →
                                  </Link>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dark-tertiary bg-dark-secondary p-5">
                    <h3 className="font-bold text-white mb-1">Select a day</h3>
                    <p className="text-sm text-gray-500">
                      Click any day to see your AI-planned content. Each coloured pill is a post from a campaign.
                    </p>
                  </div>
                )}

                {/* Campaign legend */}
                {campaigns.length > 0 && (
                  <div className="rounded-2xl border border-dark-tertiary bg-dark-secondary p-5">
                    <h3 className="font-bold text-white mb-4 text-sm">Campaigns</h3>
                    <div className="space-y-2">
                      {campaigns.slice(0, 6).map((c, i) => {
                        const color = CAMPAIGN_COLORS[i % CAMPAIGN_COLORS.length]
                        const count = monthPosts.filter(p => p.campaignId === c.id).length
                        return (
                          <Link key={c.id} href={`/campaigns/${c.id}`}
                            className="flex items-center gap-2 group hover:opacity-80 transition-opacity">
                            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color.dot }} />
                            <span className="text-xs text-gray-300 truncate flex-1 group-hover:text-white transition-colors">
                              {c.title || c.name || 'Campaign'}
                            </span>
                            <span className="text-[10px] text-gray-600 flex-shrink-0">{count} posts</span>
                          </Link>
                        )
                      })}
                      {campaigns.length > 6 && (
                        <p className="text-[10px] text-gray-600 pt-1">+{campaigns.length - 6} more campaigns</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Platform breakdown */}
                <div className="rounded-2xl border border-dark-tertiary bg-dark-secondary p-5">
                  <h3 className="font-bold text-white mb-4 text-sm">{calT?.platformBreakdown as string || 'Platform Breakdown'}</h3>
                  {monthPosts.length === 0 ? (
                    <p className="text-sm text-gray-500">{calT?.emptyMonth as string || 'No posts this month'}</p>
                  ) : (
                    <div className="space-y-3">
                      {Object.entries(platformBreakdown)
                        .sort((a, b) => b[1] - a[1])
                        .map(([platform, count]) => (
                          <div key={platform} className="flex items-center gap-3">
                            <span className="text-sm">{PLATFORM_ICONS_CAL[platform] || '📱'}</span>
                            <div className="flex-1">
                              <div className="flex justify-between text-xs mb-1">
                                <span className="text-gray-300">{platform}</span>
                                <span className="font-bold" style={{ color: PLATFORM_COLORS[platform] || '#FF9500' }}>
                                  {count}
                                </span>
                              </div>
                              <div className="h-1 rounded-full bg-dark-tertiary">
                                <div className="h-full rounded-full transition-all"
                                  style={{
                                    width: `${(count / monthPosts.length) * 100}%`,
                                    background: PLATFORM_COLORS[platform] || '#FF9500',
                                  }} />
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>

                {/* PULSE insight */}
                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm">⚡</span>
                    <div className="text-xs font-bold uppercase tracking-wider text-amber-400">
                      {calT?.pulseLabel as string || 'PULSE Insight'}
                    </div>
                  </div>
                  <p className="text-sm text-gray-300 leading-relaxed">
                    {monthPosts.length === 0
                      ? calT?.pulseEmpty as string || 'No posts scheduled yet. Create a campaign to start filling your calendar.'
                      : monthPosts.length < 12
                        ? (calT?.pulseLow as string)?.replace('{count}', String(monthPosts.length)) || `${monthPosts.length} posts planned this month. Consider adding more to stay consistent.`
                        : (calT?.pulseGood as string)?.replace('{count}', String(monthPosts.length))?.replace('{platforms}', String(calStats.platforms)) || `${monthPosts.length} posts across ${calStats.platforms} platforms. Great consistency!`
                    }
                  </p>
                  {campaigns.length === 0 && (
                    <Link href="/campaigns/new"
                      className="inline-flex items-center gap-1 mt-3 text-xs text-amber-400 hover:underline font-medium">
                      {calT?.btnCreateCampaign as string || 'Create your first campaign →'}
                    </Link>
                  )}
                </div>

              </div>
            </div>
          </>
        )}

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* TAB 2: PUBLISHED QUEUE                                             */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'queue' && (
          <div className="max-w-4xl">

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 mb-8">
              {[
                { label: scT?.statPending as string || 'Scheduled',  value: scheduled.length, color: 'text-accent'     },
                { label: scT?.statPublished as string || 'Published', value: published.length, color: 'text-green-400'  },
                { label: scT?.statFailed as string || 'Failed',       value: failed.length,    color: 'text-red-400'    },
              ].map(s => (
                <div key={s.label} className="rounded-xl border border-dark-tertiary bg-dark-secondary p-4">
                  <div className={`text-3xl font-black ${s.color}`}>{s.value}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>

            {/* No integrations warning */}
            {!loadingQueue && integrations.length === 0 && (
              <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/5 p-6 mb-6 flex items-center gap-4">
                <span className="text-2xl">⚠️</span>
                <div>
                  <div className="font-semibold text-yellow-300 mb-1">
                    {scT?.noIntegrationsTitle as string || 'No social accounts connected'}
                  </div>
                  <p className="text-sm text-gray-400">
                    {scT?.noIntegrationsDesc as string || 'Connect your social accounts in Settings to start scheduling posts.'}
                  </p>
                </div>
                <Link href="/settings"
                  className={`${isRTL ? 'mr-auto' : 'ml-auto'} shrink-0 px-4 py-2 bg-yellow-500/10 border border-yellow-500/20 text-yellow-300 text-sm font-semibold rounded-lg hover:bg-yellow-500/20 transition-all`}>
                  {scT?.btnConnectAccount as string || 'Connect Account'}
                </Link>
              </div>
            )}

            {/* Queued posts */}
            {scheduled.length > 0 && (
              <div className="mb-8">
                <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500 mb-3">
                  {scT?.sectionScheduled as string || 'Scheduled'}
                </h2>
                <div className="space-y-3">
                  {scheduled.map(post => (
                    <div key={post.id} className="rounded-xl border border-dark-tertiary bg-dark-secondary p-5 flex items-start gap-4">
                      <div className="text-2xl shrink-0">{PLATFORM_ICONS_SCH[post.platform] || '📱'}</div>
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
                            {(scT?.postIn as string)?.replace('{time}', timeUntil(post.scheduledAt)) || `Posts in ${timeUntil(post.scheduledAt)}`}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDelete(post.id)}
                        disabled={deletingId === post.id}
                        className="shrink-0 text-xs px-3 py-1.5 rounded-lg border border-dark-tertiary text-gray-600 hover:text-red-400 hover:border-red-400/30 transition-all disabled:opacity-40">
                        {deletingId === post.id ? '...' : scT?.btnCancel as string || 'Cancel'}
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
                  {scT?.sectionPublished as string || 'Published'}
                </h2>
                <div className="space-y-3">
                  {published.slice(0, 5).map(post => (
                    <div key={post.id} className="rounded-xl border border-dark-tertiary bg-dark-secondary p-5 flex items-start gap-4">
                      <div className="text-2xl shrink-0">{PLATFORM_ICONS_SCH[post.platform] || '📱'}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-xs font-bold text-gray-400">{post.pageName || post.platform}</span>
                          <span className="text-xs px-2 py-0.5 rounded-lg font-medium bg-green-500/15 text-green-400">
                            {scT?.statusPublished as string || 'Published'}
                          </span>
                        </div>
                        <p className="text-sm text-gray-300 mb-2 line-clamp-2">{post.caption}</p>
                        <div className="flex items-center gap-3 text-xs text-gray-600">
                          <span>✅ {post.publishedAt ? formatDate(post.publishedAt) : (scT?.statusPublished as string || 'Published')}</span>
                          {post.platformUrl && (
                            <a href={post.platformUrl} target="_blank" rel="noopener noreferrer"
                              className="text-accent hover:underline">
                              {scT?.btnViewPost as string || 'View post'}
                            </a>
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
                  {scT?.sectionFailed as string || 'Failed'}
                </h2>
                <div className="space-y-3">
                  {failed.map(post => (
                    <div key={post.id} className="rounded-xl border border-red-500/20 bg-red-500/5 p-5 flex items-start gap-4">
                      <div className="text-2xl shrink-0">{PLATFORM_ICONS_SCH[post.platform] || '📱'}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-xs font-bold text-gray-400">{post.pageName}</span>
                          <span className="text-xs px-2 py-0.5 rounded-lg font-medium bg-red-500/15 text-red-400">
                            {scT?.statusFailed as string || 'Failed'}
                          </span>
                        </div>
                        <p className="text-sm text-gray-300 mb-1 line-clamp-2">{post.caption}</p>
                        {post.errorMessage && (
                          <p className="text-xs text-red-400">{post.errorMessage}</p>
                        )}
                      </div>
                      <button onClick={() => handleDelete(post.id)}
                        className="shrink-0 text-xs px-3 py-1.5 rounded-lg border border-dark-tertiary text-gray-600 hover:text-red-400 transition-all">
                        {scT?.btnDismiss as string || 'Dismiss'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Empty state */}
            {!loadingQueue && posts.length === 0 && (
              <div className="rounded-2xl border border-dark-tertiary bg-dark-secondary p-12 text-center">
                <div className="text-4xl mb-4">📤</div>
                <h2 className="font-bold text-white mb-2">{scT?.emptyTitle as string || 'No scheduled posts'}</h2>
                <p className="text-sm text-gray-500 mb-6">
                  {scT?.emptyDesc as string || 'Schedule posts to your connected social accounts and they\'ll appear here.'}
                </p>
                <button onClick={() => setShowModal(true)}
                  className="px-5 py-2.5 bg-accent text-white font-bold rounded-xl text-sm hover:bg-accent/90 transition-all">
                  {scT?.emptyBtn as string || '+ Schedule a Post'}
                </button>
              </div>
            )}

            {/* AI tip */}
            <div className="rounded-2xl border border-accent/20 bg-accent/5 p-5 mt-6">
              <div className="text-xs font-bold uppercase tracking-wider text-accent mb-2">
                {scT?.tipTitle as string || 'Pro Tip'}
              </div>
              <p className="text-sm text-gray-300 leading-relaxed">
                {scT?.tipDesc as string || 'Use the Strategy Timeline tab to plan content with AI, then schedule directly from your campaign\'s Content Hub.'}
              </p>
              <button
                onClick={() => setActiveTab('timeline')}
                className="inline-flex items-center gap-1 mt-3 text-xs text-accent hover:underline font-medium">
                {locale === 'ar' ? 'عرض الجدول الزمني' : 'View Strategy Timeline'} →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* SCHEDULE MODAL                                                        */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}>
          <div className="w-full max-w-lg rounded-2xl border border-dark-tertiary bg-dark overflow-hidden"
            dir={dir}
            style={{ boxShadow: '0 0 80px rgba(0,0,0,0.5)' }}>

            <div className="flex items-center justify-between px-6 py-4 border-b border-dark-tertiary">
              <h2 className="font-bold text-white">{scT?.modalTitle as string || 'Schedule a Post'}</h2>
              <button onClick={() => setShowModal(false)}
                className="text-gray-600 hover:text-white transition-all text-xl">×</button>
            </div>

            <div className="p-6 space-y-5">
              {/* Caption */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 block">
                  {scT?.modalCaptionLabel as string || 'Caption'}
                </label>
                <textarea
                  value={caption}
                  onChange={e => setCaption(e.target.value)}
                  placeholder={scT?.modalCaptionPlaceholder as string || 'Write your post caption…'}
                  rows={4}
                  className="w-full px-4 py-3 rounded-xl bg-dark-secondary border border-dark-tertiary text-white placeholder-gray-600 text-sm focus:outline-none focus:border-accent/50 transition-all resize-none"
                  autoFocus
                />
                <div className="text-xs text-gray-600 mt-1 text-left">{caption.length}/2200</div>
              </div>

              {/* Account */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 block">
                  {scT?.modalAccountLabel as string || 'Account'}
                </label>
                {integrations.length === 0 ? (
                  <div className="p-3 rounded-xl bg-yellow-500/5 border border-yellow-500/20 text-sm text-yellow-400">
                    {scT?.modalNoAccounts as string || 'No accounts connected.'}{' '}
                    <Link href="/settings" className="underline">
                      {scT?.modalConnectLink as string || 'Connect one'}
                    </Link>
                  </div>
                ) : (
                  <select
                    value={selectedIntegration}
                    onChange={e => { setSelectedIntegration(e.target.value); setSelectedPage('') }}
                    className="w-full px-4 py-3 rounded-xl bg-dark-secondary border border-dark-tertiary text-white text-sm focus:outline-none focus:border-accent/50 transition-all">
                    <option value="">{scT?.modalAccountPlaceholder as string || 'Select account…'}</option>
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
                    {scT?.modalPageLabel as string || 'Page / Profile'}
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
                    className="w-full px-4 py-3 rounded-xl bg-dark-secondary border border-dark-tertiary text-white text-sm focus:outline-none focus:border-accent/50 transition-all">
                    <option value="">{scT?.modalPagePlaceholder as string || 'Select page…'}</option>
                    {getPages(selectedIntegration).map((p: any) => (
                      <option key={p.id} value={p.id}>{p.name} ({p.type || 'facebook'})</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Date/Time */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 block">
                  {scT?.modalDateLabel as string || 'Schedule Date & Time'}
                </label>
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  min={minDateTime}
                  onChange={e => setScheduledAt(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-dark-secondary border border-dark-tertiary text-white text-sm focus:outline-none focus:border-accent/50 transition-all"
                />
              </div>

              {/* Image URL */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 block">
                  {scT?.modalImageLabel as string || 'Image URL'}{' '}
                  <span className="text-gray-700 normal-case font-normal">
                    {scT?.modalImageOptional as string || '(optional)'}
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

            <div className="flex gap-3 px-6 py-4 border-t border-dark-tertiary">
              <button onClick={() => setShowModal(false)}
                className="flex-1 py-3 border border-dark-tertiary text-gray-400 hover:text-white rounded-xl text-sm font-medium transition-all">
                {scT?.btnCancel as string || 'Cancel'}
              </button>
              <button
                onClick={handleSchedule}
                disabled={!caption || !selectedIntegration || !selectedPage || !scheduledAt || submitting}
                className="flex-1 py-3 bg-accent hover:bg-accent/90 text-white font-bold rounded-xl text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                {submitting ? (scT?.modalSubmitting as string || 'Scheduling…') : (scT?.modalSubmitBtn as string || 'Schedule Post')}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  )
}
