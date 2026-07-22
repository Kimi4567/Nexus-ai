'use client'

import { useAuth } from '@/lib/auth-context'
import { useEffect, useState, useMemo, useRef, Suspense } from 'react'
import AppShell from '@/components/AppShell'
import LuxuryWorkspaceHeader from '@/components/LuxuryWorkspaceHeader'
import Link from 'next/link'
import { useI18n } from '@/lib/i18n-context'
import { useRouter, useSearchParams } from 'next/navigation'
import { deriveDisplayState, statusLabelKey } from '@/lib/postStatus'
import { isAutoPublished } from '@/lib/postVisibility'
import { getPublishingStateSummary } from '@/lib/contentCounts'
import { getPostClaimRisk } from '@/lib/ai/claimGuard'
import { getCalendarMonthTruth, getCalendarTruthText, isRealCalendarPost } from '@/lib/calendarTruth'
import { reviewBrandTruthConsistency } from '@/lib/ai/marketingQualityGate'
import { AlertCircle, Trash2, X } from 'lucide-react'
import type { WorkspaceExecutionTruth } from '@/lib/executionTruth'
import { formatScheduledTimeDistance } from '@/lib/scheduleTimeDistance'
import { hasBrandTruthVerificationFailure, isBrandTruthExecutionLocked } from '@/lib/brandTruthGate'
import WorkspaceRouteLoading from '@/components/WorkspaceRouteLoading'

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
  publishStatus?: 'SCHEDULED' | 'PROCESSING' | 'PUBLISHED' | 'FAILED' | 'DRAFT' | 'APPROVED'
  // PR5 honest display: manual vs auto distinction + platform proof
  publishMode?: 'MANUAL' | 'AUTO' | null
  platformUrl?: string | null
  platformPostId?: string | null
}

type ScheduledPost = {
  id: string
  caption: string
  platform: string
  pageName?: string | null
  publishTarget?: string | null
  imageUrl?: string
  status: 'SCHEDULED' | 'PROCESSING' | 'PUBLISHED' | 'FAILED' | 'DRAFT' | 'APPROVED'
  scheduledAt: string
  publishedAt?: string
  platformUrl?: string | null
  platformPostId?: string | null
  publishMode?: 'MANUAL' | 'AUTO' | null
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
  X:         '#111827',
  YouTube:   '#ff0000',
  Pinterest: '#e60023',
  Snapchat:  '#fffc00',
  FACEBOOK:  '#1877F2',
  INSTAGRAM: '#E1306C',
  META:      '#0668E1',
  LINKEDIN:  '#0A66C2',
  TIKTOK:    '#69C9D0',
  YOUTUBE:   '#FF0000',
  TWITTER:   '#111827',
}

const PLATFORM_ICONS_CAL: Record<string, string> = {
  Instagram: '📸',
  Facebook:  '👥',
  LinkedIn:  '💼',
  TikTok:    '🎵',
  X:         '𝕏',
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
  YOUTUBE_SHORTS: '▶️',
  PINTEREST: '📌',
  THREADS:   '@',
  X:         '𝕏',
  TWITTER:   '𝕏',
}

const STATUS_STYLES: Record<string, string> = {
  SCHEDULED: 'bg-orange-50 text-orange-600 border border-orange-200',
  PROCESSING: 'bg-violet-50 text-violet-700 border border-violet-200',
  PUBLISHED: 'bg-green-50 text-green-700 border border-green-200',
  FAILED: 'bg-red-50 text-red-600 border border-red-200',
  DRAFT: 'bg-yellow-50 text-yellow-700 border border-yellow-200',
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
    tiktok: 'TikTok', twitter: 'X', x: 'X', youtube: 'YouTube',
    youtube_shorts: 'YouTube', snapchat: 'Snapchat', pinterest: 'Pinterest',
    general: 'Instagram',
  }
  return map[raw.toLowerCase()] || raw
}

function normalisePlatformQueue(raw: string | undefined): string {
  if (!raw) return 'Instagram'
  const map: Record<string, string> = {
    FACEBOOK: 'Facebook', INSTAGRAM: 'Instagram', LINKEDIN: 'LinkedIn',
    TIKTOK: 'TikTok', X: 'X', TWITTER: 'X', YOUTUBE: 'YouTube',
    META: 'Meta', SNAPCHAT: 'Snapchat',
  }
  return map[raw.toUpperCase()] || normaliseplatform(raw)
}

function convertScheduledToCalendarPosts(
  scheduledPosts: ScheduledPost[],
  campaigns: any[]
): CalendarPost[] {
  return scheduledPosts
    .filter(isRealCalendarPost)
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
        platform:      normalisePlatformQueue(p.publishTarget || p.platform),
        type:          isPublished ? 'Published' : 'Scheduled',
        topic:         p.caption?.slice(0, 70) || 'Scheduled Post',
        scheduledAt:   p.scheduledAt,
        publishStatus: p.status,
        publishMode:   p.publishMode ?? null,
        platformUrl:   p.platformUrl ?? null,
        platformPostId: p.platformPostId ?? null,
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
  const router = useRouter()
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
  const [activeTab, setActiveTab] = useState<'timeline' | 'queue'>(defaultTab)

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
  const [deletingId, setDeletingId]     = useState<string | null>(null)
  const [pendingDeletePost, setPendingDeletePost] = useState<ScheduledPost | null>(null)
  const [queueActionError, setQueueActionError] = useState('')
  const [brandTruthState, setBrandTruthState] = useState<'checking' | 'passed' | 'blocked' | 'unavailable'>('checking')
  const [executionTruth, setExecutionTruth] = useState<WorkspaceExecutionTruth | null>(null)
  const calendarTruthLocked = isBrandTruthExecutionLocked(brandTruthState)
  const calendarTruthFailure = hasBrandTruthVerificationFailure(brandTruthState)

  useEffect(() => {
    if (!loading && !isAuthenticated) router.push('/auth/login')
  }, [isAuthenticated, loading, router])

  // ── Fetch calendar data ────────────────────────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated) return
    const token = authHeader()
    Promise.all([
      fetch('/api/campaigns', { headers: { Authorization: token } }),
      fetch('/api/brand', { headers: { Authorization: token } }),
    ])
      .then(async ([campaignRes, brandRes]) => {
        const data = await campaignRes.json().catch(() => ({}))
        setCampaigns(data.campaigns || [])
        if (brandRes.ok) {
          const brandData = await brandRes.json().catch(() => ({}))
          setBrandTruthState(!brandData.brandProfile || reviewBrandTruthConsistency(brandData.brandProfile).status === 'blocked' ? 'blocked' : 'passed')
        } else {
          setBrandTruthState('unavailable')
        }
        setLoadingCal(false)
      })
      .catch(() => { setBrandTruthState('unavailable'); setLoadingCal(false) })
  }, [authHeader, isAuthenticated])

  // ── Fetch queue data ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated) return
    const token = authHeader()
    Promise.all([
      fetch('/api/schedule', { headers: { Authorization: token } }).then(r => r.json()),
      fetch('/api/social/accounts', { headers: { Authorization: token } }).then(r => r.json()),
      fetch('/api/execution/queue', { headers: { Authorization: token } }).then(r => r.ok ? r.json() : {}),
    ]).then(([schedData, socialData, executionData]) => {
      const executionPayload = executionData as { truth?: WorkspaceExecutionTruth }
      setPosts(schedData.posts || [])
      setIntegrations(socialData.accounts || socialData.integrations || [])
      setExecutionTruth(executionPayload.truth && typeof executionPayload.truth === 'object' ? executionPayload.truth : null)
      setLoadingQueue(false)
    }).catch(() => setLoadingQueue(false))
  }, [authHeader, isAuthenticated])

  // ── Calendar derived state ─────────────────────────────────────────────────
  const strategyPlanPosts = useMemo(() => {
    const out: CalendarPost[] = []
    campaigns.forEach((c, i) => out.push(...extractPostsFromCampaign(c, i)))
    return out
  }, [campaigns])

  const allPosts = useMemo(
    () => convertScheduledToCalendarPosts(posts, campaigns),
    [campaigns, posts]
  )

  const monthPosts = useMemo(
    () => allPosts.filter(p => p.month === viewMonth && p.year === viewYear),
    [allPosts, viewMonth, viewYear]
  )

  const monthStrategyIdeas = useMemo(
    () => strategyPlanPosts.filter(p => p.month === viewMonth && p.year === viewYear),
    [strategyPlanPosts, viewMonth, viewYear]
  )

  useEffect(() => {
    if (loadingCal) return
    if (hasAutoJumpedRef.current) return
    const pushedPosts = allPosts
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

  // Kept for the hidden legacy detail panel until its scheduling actions are migrated.
  const selectedDayPosts = selectedDay ? getPostsForDay(selectedDay) : []
  const selectedDayStrategyIdeas = selectedDay
    ? monthStrategyIdeas.filter(p => p.day === selectedDay)
    : []
  const platformBreakdown = monthPosts.reduce((acc, post) => {
    acc[post.platform] = (acc[post.platform] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const calendarTruth = getCalendarMonthTruth(posts, viewMonth, viewYear)
  const calStats = {
    total: calendarTruth.postsThisMonth,
    scheduled: calendarTruth.scheduled,
    published: calendarTruth.published,
    platforms: calendarTruth.platforms,
    campaigns: new Set(monthPosts.map(p => p.campaignId)).size,
  }

  const monthLabel = new Intl.DateTimeFormat(intlLocale, { month: 'long', year: 'numeric' })
    .format(new Date(viewYear, viewMonth, 1))

  const isPostInViewedMonth = (post: ScheduledPost) => {
    const date = new Date(post.scheduledAt)
    return Number.isFinite(date.getTime()) && date.getMonth() === viewMonth && date.getFullYear() === viewYear
  }
  const monthReviewPosts = posts.filter(p =>
    (p.status === 'DRAFT' || p.status === 'APPROVED') && isPostInViewedMonth(p)
  )
  const reviewCount = monthReviewPosts.length
  const lateCount = posts.filter(p => {
    if (!isPostInViewedMonth(p)) return false
    if (p.status === 'FAILED') return true
    return p.status === 'SCHEDULED' && new Date(p.scheduledAt).getTime() < Date.now()
  }).length

  // ── Queue derived state ────────────────────────────────────────────────────
  // PR7 honesty: the Published Queue is the integration / auto-publish surface.
  // Its "Published" count + list show ONLY genuinely auto-published posts. Manually
  // published posts are NOT counted here — they live in the Content Hub, badged
  // "Published manually" — so this surface never implies NEXUS auto-published a post
  // the user published by hand.
  const scheduled = posts.filter(p => p.status === 'SCHEDULED')
  const autoPublished = posts.filter(p => isAutoPublished(p))
  const failed     = posts.filter(p => p.status === 'FAILED')

  // PR-1J: honest, tested lifecycle counts. `notScheduled` = generated/approved
  // content that has no schedule yet — it must never read as scheduled or published.
  const queueSummary = getPublishingStateSummary(posts)
  const nextExecutionAction = executionTruth?.queue[0] ?? null

  const handleDelete = async (post: ScheduledPost) => {
    const operation = post.status === 'FAILED' ? 'dismiss_failed_record' : 'cancel_scheduled_post'
    setDeletingId(post.id)
    setQueueActionError('')
    try {
      const response = await fetch(`/api/schedule?id=${post.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: authHeader(),
          'X-Nexus-Confirm-Operation': operation,
        },
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.error || (locale === 'ar' ? 'تعذر تحديث سجل الجدولة.' : 'Could not update the scheduling record.'))
      }
      setPosts(prev => prev.filter(item => item.id !== post.id))
      setPendingDeletePost(null)
    } catch (error) {
      setQueueActionError(error instanceof Error ? error.message : (locale === 'ar' ? 'تعذر تحديث سجل الجدولة.' : 'Could not update the scheduling record.'))
    } finally {
      setDeletingId(null)
    }
  }

  function formatDate(iso: string) {
    const d = new Date(iso)
    return d.toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    })
  }

  if (loading) return <WorkspaceRouteLoading labelAr="جارٍ تجهيز مساحة التنفيذ" labelEn="Preparing execution workspace" />
  if (!isAuthenticated) return null

  return (
    <AppShell>
      <main className="nx-os-page" dir={dir}>
      <div className="nx-os-container page-enter">
        <LuxuryWorkspaceHeader
          journeyStage="execution"
          pageTitle={locale === 'ar' ? 'التنفيذ' : 'Execution'}
          pageSubtitle={locale === 'ar' ? 'قائمة قرارات واحدة للجدولة والنشر والمراقبة؛ يبدأ اعتماد النص والوسائط من إنتاج المحتوى.' : 'One decision queue for scheduling, publishing, and monitoring; copy and media approval starts in Content production.'}
          primaryHref={calendarTruthFailure ? '/brand' : calendarTruthLocked ? null : (nextExecutionAction?.requiresApproval ? '/approvals' : nextExecutionAction?.href) || '/content-hub'}
          primaryLabel={calendarTruthFailure
            ? (locale === 'ar' ? 'تصحيح Brand Brain' : 'Fix Brand Brain')
            : nextExecutionAction
              ? (locale === 'ar' ? 'افتح القرار التالي' : 'Open next decision')
              : (locale === 'ar' ? 'افتح إنتاج المحتوى' : 'Open Content production')}
          secondaryHref="/campaigns"
          secondaryLabel={locale === 'ar' ? 'الحملات' : 'Campaigns'}
        />

        {calendarTruthFailure && (
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-orange-200 bg-orange-50 px-4 py-4 text-orange-950" role="alert">
            <div>
              <p className="text-[13px] font-black">
                {brandTruthState === 'blocked' ? (locale === 'ar' ? 'الجدولة محجوبة حتى تصحيح مصدر الحقيقة' : 'Scheduling is blocked until the source of truth is fixed') : (locale === 'ar' ? 'تعذر التحقق من Brand Brain؛ تم إيقاف التنفيذ احتياطياً' : 'Brand Brain could not be verified; execution is safely paused')}
              </p>
              <p className="mt-1 max-w-4xl text-[11px] font-semibold leading-5 text-orange-800">
                {locale === 'ar' ? 'يبقى التقويم سجلاً للحالات الفعلية، لكن مسودات الاستراتيجية القديمة لا تُعامل كخطة قابلة للجدولة، ولا يبدأ نشر أو خصم كريديت.' : 'The calendar remains a record of actual states, but older strategy drafts are not treated as schedulable work, and no publishing or credit spend starts.'}
              </p>
            </div>
            <Link href="/brand" className="inline-flex h-10 items-center rounded-[12px] bg-orange-700 px-4 text-[11px] font-black text-white">
              {locale === 'ar' ? 'تصحيح Brand Brain' : 'Fix Brand Brain'}
            </Link>
          </div>
        )}

        {!calendarTruthLocked && activeTab !== 'queue' && (
          <section className="nx-os-action-strip mb-5" aria-live="polite">
            <div className="min-w-0">
              <p className="text-[13px] font-black text-[#0B1028]">
                {nextExecutionAction
                  ? (locale === 'ar' ? nextExecutionAction.title.ar : nextExecutionAction.title.en)
                  : (locale === 'ar' ? 'لا توجد مشكلة تنفيذ مؤكدة الآن' : 'No verified execution issue right now')}
              </p>
              <p className="mt-1 max-w-3xl text-[11px] font-semibold leading-5 text-slate-500">
                {nextExecutionAction
                  ? (locale === 'ar' ? nextExecutionAction.reason.ar : nextExecutionAction.reason.en)
                  : (locale === 'ar'
                      ? 'يراقب NEXUS الحالات المحفوظة؛ لا يعني ذلك أن نشرًا أو نتيجة أداء حدثت.'
                      : 'NEXUS monitors saved workflow states; this does not imply publishing or performance occurred.')}
              </p>
              <p className="mt-1 text-[10px] font-bold text-slate-400">
                {locale === 'ar'
                  ? `${executionTruth?.summary.needsAttention ?? 0} تحتاج انتباه · ${executionTruth?.summary.awaitingApproval ?? 0} قرارات تحتاج موافقة · ${executionTruth?.summary.scheduledPosts ?? scheduled.length} منشورات مجدولة`
                  : `${executionTruth?.summary.needsAttention ?? 0} need attention · ${executionTruth?.summary.awaitingApproval ?? 0} decisions require approval · ${executionTruth?.summary.scheduledPosts ?? scheduled.length} scheduled`}
              </p>
            </div>
            {nextExecutionAction ? (
              <Link
                href={nextExecutionAction.requiresApproval ? '/approvals' : nextExecutionAction.href}
                className="inline-flex h-10 shrink-0 items-center justify-center rounded-[14px] bg-[#071236] px-4 text-[12px] font-black text-white"
              >
                {locale === 'ar' ? 'تنفيذ القرار التالي' : 'Open next decision'}
              </Link>
            ) : null}
          </section>
        )}

        {/* Calendar controls */}
        <div className="nx-os-card mb-5 flex flex-wrap items-center justify-between gap-3 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-1 rounded-[16px] border border-[#e3e8f3] bg-white p-1 shadow-sm">
              {[
                { key: 'queue', label: locale === 'ar' ? 'قرارات التنفيذ' : 'Execution decisions' },
                { key: 'timeline', label: locale === 'ar' ? 'الخط الزمني' : 'Timeline' },
              ].map(item => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setActiveTab(item.key as 'timeline' | 'queue')}
                  className={`rounded-[12px] px-5 py-2 text-[12px] font-black transition-all ${
                    activeTab === item.key
                      ? 'bg-[#ece9ff] text-[#5366f6]'
                      : 'text-[#64708f] hover:text-[#071236]'
                  }`}>
                  {item.label}
                </button>
              ))}
            </div>
            <button type="button" onClick={prevMonth} aria-label={locale === 'ar' ? 'الشهر السابق' : 'Previous month'} className="h-10 w-10 rounded-[14px] border border-[#e3e8f3] bg-white text-[#64708f] shadow-sm">‹</button>
            <div className="inline-flex h-10 min-w-[220px] items-center justify-center rounded-[14px] border border-[#e3e8f3] bg-white px-5 text-[14px] font-black text-[#071236] shadow-sm">
              {monthLabel}
            </div>
            <button type="button" onClick={nextMonth} aria-label={locale === 'ar' ? 'الشهر التالي' : 'Next month'} className="h-10 w-10 rounded-[14px] border border-[#e3e8f3] bg-white text-[#64708f] shadow-sm">›</button>
          </div>
          {activeTab === 'queue' && !calendarTruthLocked ? (
            <Link
              href="/content-hub"
              className="inline-flex h-10 items-center gap-2 rounded-[14px] bg-[#071236] px-4 text-[12px] font-black text-white"
            >
              {locale === 'ar' ? 'افتح مركز المحتوى' : 'Open Content Hub'}
            </Link>
          ) : null}
        </div>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* TAB 1: STRATEGY TIMELINE                                           */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'timeline' && (
          <>
            {/* Auto-jump banner */}
            {autoJumpBanner && (
              <div className="flex items-center justify-between gap-3 mb-4 px-4 py-3 rounded-xl text-sm" style={{ background: 'rgba(6,182,212,0.07)', border: '1px solid rgba(6,182,212,0.25)' }}>
                <div className="flex items-center gap-2 text-cyan-700">
                  <span>📅</span>
                  <span>
                    {locale === 'ar'
                      ? `تم الانتقال إلى ${autoJumpBanner} — توجد منشورات مجدولة أو منشورة فعليًا في هذا الشهر`
                      : `Jumped to ${autoJumpBanner} — this month has real scheduled or published posts`
                    }
                  </span>
                </div>
                <button
                  onClick={() => setAutoJumpBanner(null)}
                  className="flex-shrink-0 w-5 h-5 rounded flex items-center justify-center text-slate-400 hover:text-slate-950 hover:bg-slate-100 transition-all text-xs font-bold"
                  aria-label="Dismiss">
                  ✕
                </button>
              </div>
            )}

            <div className="mb-5 flex flex-wrap items-center gap-2">
              {[
                { label: locale === 'ar' ? 'منشور' : 'Published', value: calStats.published, dot: 'bg-emerald-500', pill: 'bg-emerald-50 text-emerald-700' },
                { label: locale === 'ar' ? 'مجدول' : 'Scheduled', value: calStats.scheduled, dot: 'bg-[#5366f6]', pill: 'bg-[#eef0ff] text-[#5366f6]' },
                { label: locale === 'ar' ? 'قيد المراجعة هذا الشهر' : 'In review this month', value: reviewCount, dot: 'bg-amber-500', pill: 'bg-amber-50 text-amber-700' },
                { label: calendarTruthLocked ? (locale === 'ar' ? 'مراجع خطة محجوبة' : 'Blocked plan references') : (locale === 'ar' ? 'أفكار الخطة لهذا الشهر' : 'Plan ideas this month'), value: monthStrategyIdeas.length, dot: calendarTruthLocked ? 'bg-orange-400' : 'bg-slate-400', pill: calendarTruthLocked ? 'bg-orange-50 text-orange-700 border border-orange-200' : 'bg-white text-[#64708f] border border-[#e3e8f3]' },
                { label: locale === 'ar' ? 'متأخر' : 'Late', value: lateCount, dot: 'bg-red-500', pill: 'bg-red-50 text-red-600' },
              ].map(item => (
                <div key={item.label} className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-[12px] font-black ${item.pill}`}>
                  <span className={`h-2 w-2 rounded-full ${item.dot}`} />
                  <span>{item.label}</span>
                  <span>{item.value}</span>
                </div>
              ))}
            </div>

            <div>

              {/* Calendar Grid */}
              <div className="overflow-hidden rounded-2xl" style={{ background: 'white', border: '1px solid rgba(15,23,42,0.08)' }}>
                {loadingCal ? <div className="border-b border-slate-100 px-5 py-3 text-center text-[11px] font-bold text-slate-400">{locale === 'ar' ? 'جارٍ تحديث التقويم…' : 'Updating calendar…'}</div> : null}

                {/* Day headers */}
                <div className="grid grid-cols-7 border-b border-slate-100">
                  {DAYS.map(d => (
                    <div key={d} className="py-2 text-center text-xs font-bold text-slate-400 uppercase tracking-wider">
                      {d}
                    </div>
                  ))}
                </div>

                {/* Days grid */}
                <div className="grid grid-cols-7">
                  {Array.from({ length: firstDay }).map((_, i) => (
                    <div key={`empty-${i}`} className="h-20 border-b border-r border-slate-100" />
                  ))}
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day      = i + 1
                    const dayPosts = getPostsForDay(day)
                    const isToday    = isCurrentMonth && day === todayDate
                    const isSelected = selectedDay === day
                    return (
                      <button
                        type="button"
                        key={day}
                        onClick={() => setSelectedDay(isSelected ? null : day)}
                        aria-pressed={isSelected}
                        aria-label={`${day} ${monthLabel}, ${dayPosts.length} ${locale === 'ar' ? 'عناصر' : 'items'}`}
                        className={`h-20 cursor-pointer border-b border-r border-slate-100 p-1.5 text-start transition-all
                          ${isSelected ? 'bg-orange-50' : 'hover:bg-slate-50'}`}>
                        <div className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold mb-1
                          ${isToday ? 'bg-accent text-white' : isSelected ? 'text-accent' : 'text-slate-400'}`}>
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
                            <div className="text-[9px] text-slate-400">+{dayPosts.length - 2} more</div>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Legacy detail panel retained for logic safety, hidden in the luxury OS surface. */}
              <div className="hidden">

                {/* Selected day detail */}
                {selectedDay ? (
                  <div className="rounded-2xl p-5" style={{ background: 'white', border: '1px solid rgba(15,23,42,0.08)' }}>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-bold text-slate-950">{MONTHS[viewMonth]} {selectedDay}</h3>
                      <Link href="/campaigns/new"
                        className="text-xs px-3 py-1.5 rounded-lg border border-accent/30 text-accent hover:bg-accent/10 transition-all">
                        + Add
                      </Link>
                    </div>
                    {selectedDayPosts.length === 0 ? (
                      <div className="text-center py-6">
                        <div className="text-2xl mb-2">📅</div>
                        <p className="text-sm text-slate-500">{getCalendarTruthText('noGeneratedScheduled', locale)}</p>
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
                              className="p-3 rounded-xl bg-white transition-all"
                              style={{
                                border: isPublished
                                  ? '1px solid rgba(16,185,129,0.3)'
                                  : isScheduled
                                    ? '1px solid rgba(52,211,153,0.3)'
                                    : '1px solid rgba(15,23,42,0.08)',
                              }}>
                              {/* Header row */}
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-sm">{PLATFORM_ICONS_CAL[post.platform] || '📱'}</span>
                                <span className="text-xs font-bold"
                                  style={{ color: PLATFORM_COLORS[post.platform] || '#FF9500' }}>
                                  {post.platform}
                                </span>
                                {/* Status badge — honest derived state (PR5): distinguishes
                                    published manually vs automatically, and scheduled
                                    manual vs auto. AI-planned campaign content stays as such. */}
                                {isAiPlanned ? (
                                  <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded-full font-semibold bg-cyan-500/15 text-cyan-400">
                                    ✦ {getCalendarTruthText('legendPlanned', locale)}
                                  </span>
                                ) : (isPublished || isScheduled) && post.publishStatus ? (() => {
                                  const ds = deriveDisplayState({ status: post.publishStatus, publishMode: post.publishMode, platformPostId: post.platformPostId, platformUrl: post.platformUrl })
                                  const icon = ds.startsWith('published') ? '✅' : ds.startsWith('scheduled') ? '🕐' : ds === 'failed' ? '⚠️' : '✦'
                                  const cls = ds.startsWith('published') ? 'bg-green-500/15 text-green-400'
                                    : ds.startsWith('scheduled') ? 'bg-emerald-500/15 text-emerald-400'
                                    : ds === 'failed' ? 'bg-red-500/15 text-red-400'
                                    : 'bg-slate-100 text-slate-500'
                                  return (
                                    <span className={`ml-auto text-[9px] px-1.5 py-0.5 rounded-full font-semibold flex items-center gap-0.5 ${cls}`}>
                                      {icon} {t(statusLabelKey({ status: post.publishStatus, publishMode: post.publishMode, platformPostId: post.platformPostId, platformUrl: post.platformUrl })) as string}
                                    </span>
                                  )
                                })() : (
                                  <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
                                    {post.type}
                                  </span>
                                )}
                              </div>

                              {/* Content */}
                              <p className="text-sm font-semibold text-slate-950 leading-snug mb-1">{post.topic}</p>

                              {post.hook && (
                                <p className="text-[11px] text-slate-500 italic leading-relaxed mb-1">
                                  &ldquo;{post.hook}&rdquo;
                                </p>
                              )}
                              {post.caption && !isScheduled && !isPublished && (
                                <p className="text-[11px] text-slate-500 leading-relaxed mb-1 line-clamp-2">
                                  {post.caption}
                                </p>
                              )}
                              {post.cta && (
                                <p className="text-[11px] text-accent font-medium">CTA: {post.cta}</p>
                              )}
                              {post.visualNote && (
                                <p className="text-[10px] text-purple-600 mt-1">🎨 {post.visualNote}</p>
                              )}

                              {/* Scheduled time */}
                              {(isScheduled || isPublished) && post.scheduledAt && (
                                <p className="text-[10px] text-slate-500 mt-1">
                                  🕐 {new Date(post.scheduledAt).toLocaleTimeString(
                                    locale === 'ar' ? 'ar-SA' : 'en-US',
                                    { hour: '2-digit', minute: '2-digit' }
                                  )}
                                </p>
                              )}

                              {/* Footer */}
                              <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
                                <span className="text-[10px] text-slate-400 flex items-center gap-1">
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
                  <div className="rounded-2xl p-5" style={{ background: 'white', border: '1px solid rgba(15,23,42,0.08)' }}>
                    <h3 className="font-bold text-slate-950 mb-1">{locale === 'ar' ? 'اختر يومًا' : 'Select a day'}</h3>
                    <p className="text-sm text-slate-500">
                      {getCalendarTruthText('dayHelper', locale)}
                    </p>
                  </div>
                )}

                {/* Strategy ideas are deliberately separate from real scheduled/published posts. */}
                {monthStrategyIdeas.length > 0 && (
                  <div className="rounded-2xl p-5" style={{ background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.16)' }}>
                    <h3 className="font-bold text-slate-950 mb-1 text-sm">{getCalendarTruthText('plannedTab', locale)}</h3>
                    <p className="text-xs text-slate-500 mb-4">{getCalendarTruthText('plannedHelper', locale)}</p>
                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {(selectedDay ? selectedDayStrategyIdeas : monthStrategyIdeas).slice(0, 6).map(idea => (
                        <Link key={idea.id} href={`/campaigns/${idea.campaignId}`}
                          className="block rounded-xl bg-white px-3 py-2 hover:opacity-80 transition-opacity"
                          style={{ border: '1px solid rgba(15,23,42,0.08)' }}>
                          <div className="flex items-center gap-2 text-[11px] text-slate-500 mb-0.5">
                            <span className="w-2 h-2 rounded-full" style={{ background: idea.campaignColor }} />
                            <span>{MONTHS[idea.month]} {idea.day}</span>
                            <span>·</span>
                            <span>{idea.platform}</span>
                          </div>
                          <p className="text-xs font-semibold text-slate-800 line-clamp-2">{idea.topic}</p>
                        </Link>
                      ))}
                      {selectedDay && selectedDayStrategyIdeas.length === 0 && (
                        <p className="text-xs text-slate-500">{locale === 'ar' ? 'لا توجد أفكار استراتيجية لهذا اليوم.' : 'No strategy ideas for this day.'}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Campaign legend */}
                {campaigns.length > 0 && (
                  <div className="rounded-2xl p-5" style={{ background: 'white', border: '1px solid rgba(15,23,42,0.08)' }}>
                    <h3 className="font-bold text-slate-950 mb-4 text-sm">Campaigns</h3>
                    <div className="space-y-2">
                      {campaigns.slice(0, 6).map((c, i) => {
                        const color = CAMPAIGN_COLORS[i % CAMPAIGN_COLORS.length]
                        const count = monthStrategyIdeas.filter(p => p.campaignId === c.id).length
                        return (
                          <Link key={c.id} href={`/campaigns/${c.id}`}
                            className="flex items-center gap-2 group hover:opacity-80 transition-opacity">
                            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color.dot }} />
                            <span className="text-xs text-slate-600 truncate flex-1 group-hover:text-slate-950 transition-colors">
                              {c.title || c.name || 'Campaign'}
                            </span>
                            <span className="text-[10px] text-slate-400 flex-shrink-0">
                              {locale === 'ar' ? `${count} فكرة` : `${count} ideas`}
                            </span>
                          </Link>
                        )
                      })}
                      {campaigns.length > 6 && (
                        <p className="text-[10px] text-slate-400 pt-1">+{campaigns.length - 6} more campaigns</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Platform breakdown */}
                <div className="rounded-2xl p-5" style={{ background: 'white', border: '1px solid rgba(15,23,42,0.08)' }}>
                  <h3 className="font-bold text-slate-950 mb-4 text-sm">{calT?.platformBreakdown as string || 'Platform Breakdown'}</h3>
                  {monthPosts.length === 0 ? (
                    <p className="text-sm text-slate-500">{getCalendarTruthText('noGeneratedScheduled', locale)}</p>
                  ) : (
                    <div className="space-y-3">
                      {Object.entries(platformBreakdown)
                        .sort((a, b) => b[1] - a[1])
                        .map(([platform, count]) => (
                          <div key={platform} className="flex items-center gap-3">
                            <span className="text-sm">{PLATFORM_ICONS_CAL[platform] || '📱'}</span>
                            <div className="flex-1">
                              <div className="flex justify-between text-xs mb-1">
                                <span className="text-slate-700">{platform}</span>
                                <span className="font-bold" style={{ color: PLATFORM_COLORS[platform] || '#FF9500' }}>
                                  {count}
                                </span>
                              </div>
                              <div className="h-1 rounded-full bg-slate-100">
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
                <div className="rounded-2xl p-5" style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)' }}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm">⚡</span>
                    <div className="text-xs font-bold uppercase tracking-wider text-amber-700">
                      {calT?.pulseLabel as string || 'PULSE Insight'}
                    </div>
                  </div>
                  <p className="text-sm text-slate-700 leading-relaxed">
                    {monthPosts.length === 0
                      ? getCalendarTruthText('noGeneratedScheduled', locale)
                      : monthPosts.length < 12
                        ? (locale === 'ar'
                          ? `${monthPosts.length} منشورات مجدولة أو منشورة فعليًا هذا الشهر.`
                          : `${monthPosts.length} real scheduled or published posts this month.`)
                        : (locale === 'ar'
                          ? `${monthPosts.length} منشورات مجدولة أو منشورة فعليًا عبر ${calStats.platforms} منصات.`
                          : `${monthPosts.length} real scheduled or published posts across ${calStats.platforms} platforms.`)
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

            {executionTruth?.queue.length ? (
              <details className="nx-os-card mb-6 p-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[13px] font-black text-[#071236]">
                  <span>{locale === 'ar' ? 'قرارات التشغيل المجمّعة' : 'Consolidated operating decisions'}</span>
                  <span className="rounded-full bg-[#EEF2FF] px-2.5 py-1 text-[10px] text-[#5366F6]">{executionTruth.queue.length}</span>
                </summary>
                <p className="mt-2 text-[10px] font-semibold leading-5 text-slate-400">
                  {locale === 'ar' ? 'قد تلخّص البطاقة الواحدة عدة منشورات لها القرار التالي نفسه.' : 'One decision card may summarize several posts that share the same next action.'}
                </p>
                <div className="mt-4 space-y-2">
                  {executionTruth.queue.slice(0, 10).map(action => (
                    <div key={action.id} className="flex flex-col gap-3 rounded-[16px] border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase ${action.priority === 'critical' ? 'bg-rose-50 text-rose-700' : action.priority === 'high' ? 'bg-amber-50 text-amber-700' : 'bg-white text-slate-500'}`}>
                            {action.priority}
                          </span>
                          <span className="text-[10px] font-bold text-slate-400">{action.campaignName}</span>
                        </div>
                        <p className="mt-1 text-[12px] font-black text-[#0B1028]">{locale === 'ar' ? action.title.ar : action.title.en}</p>
                        <p className="mt-1 text-[11px] font-semibold leading-5 text-slate-500">{locale === 'ar' ? action.reason.ar : action.reason.en}</p>
                      </div>
                      <Link href={action.requiresApproval ? '/approvals' : action.href} className="inline-flex h-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-[11px] font-black text-[#5366F6]">
                        {action.requiresApproval ? (locale === 'ar' ? 'مراجعة القرار' : 'Review decision') : (locale === 'ar' ? 'فتح' : 'Open')}
                      </Link>
                    </div>
                  ))}
                </div>
              </details>
            ) : null}

            {/* Stats — lifecycle order, honest (PR-1J): "Not scheduled" = generated
                content with no schedule yet; it is never shown as scheduled/published. */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {[
                { label: calendarTruthLocked ? (locale === 'ar' ? 'سجلات محجوبة' : 'Blocked records') : (locale === 'ar' ? 'غير مجدولة' : 'Not scheduled'), value: queueSummary.notScheduled, color: calendarTruthLocked ? 'text-orange-700' : 'text-slate-600' },
                { label: scT?.statPending as string || 'Scheduled',  value: scheduled.length, color: 'text-orange-600'  },
                { label: scT?.statAutoPublished as string || 'API-published', value: autoPublished.length, color: 'text-green-700'   },
                { label: scT?.statFailed as string || 'Failed',       value: failed.length,    color: 'text-red-600'     },
              ].map(s => (
                <div key={s.label} className="rounded-xl bg-white p-4" style={{ border: '1px solid rgba(15,23,42,0.08)' }}>
                  <div className={`text-3xl font-black ${s.color}`}>{s.value}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Honest scope note (PR7): this queue is the auto-publish surface only. */}
            <div className="rounded-xl px-4 py-3 mb-6 text-xs text-slate-500" style={{ background: 'rgba(15,23,42,0.03)', border: '1px solid rgba(15,23,42,0.06)' }}>
              {scT?.queueManualNote as string || 'This queue separates scheduled records from posts published through an explicit connected-account API path. Posts you publish by hand are tracked in the Content Hub, marked “Published manually”.'}
            </div>

            {/* No integrations warning */}
            {!calendarTruthLocked && !loadingQueue && integrations.length === 0 && (
              <div className="rounded-2xl p-6 mb-6 flex items-center gap-4" style={{ background: 'rgba(234,179,8,0.06)', border: '1px solid rgba(234,179,8,0.2)' }}>
                <span className="text-2xl">⚠️</span>
                <div>
                  <div className="font-semibold text-yellow-700 mb-1">
                    {locale === 'ar' ? 'لا توجد حسابات نشر متصلة' : 'No publishing accounts connected'}
                  </div>
                  <p className="text-sm text-slate-600">
                    {locale === 'ar'
                      ? 'اربط الحسابات من صفحة الاتصالات قبل النشر عبر المنصة. الربط وحده لا يجدول أو ينشر أي شيء.'
                      : 'Connect accounts from Connections before platform publishing. Connecting alone never schedules or publishes anything.'}
                  </p>
                </div>
                <Link href="/connections"
                  className={`${isRTL ? 'mr-auto' : 'ml-auto'} shrink-0 px-4 py-2 rounded-lg text-sm font-semibold transition-all`}
                  style={{ background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.25)', color: '#92400e' }}>
                  {locale === 'ar' ? 'مراجعة الاتصالات' : 'Review Connections'}
                </Link>
              </div>
            )}

            {/* Queued posts */}
            {scheduled.length > 0 && (
              <div className="mb-8">
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-3">
                  {scT?.sectionScheduled as string || 'Scheduled'}
                </h2>
                <div className="space-y-3">
                  {scheduled.map(post => (
                    <div key={post.id} className="rounded-xl bg-white p-5 flex items-start gap-4" style={{ border: '1px solid rgba(15,23,42,0.08)' }}>
                      <div className="text-2xl shrink-0">{PLATFORM_ICONS_SCH[(post.publishTarget || post.platform).toUpperCase()] || '📱'}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-xs font-bold text-slate-500">{post.pageName || post.publishTarget || post.platform}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-lg font-medium ${STATUS_STYLES[post.status]}`}>
                            {t(statusLabelKey(post)) as string}
                          </span>
                        </div>
                        <p className="text-sm text-slate-700 mb-2 line-clamp-2">{post.caption}</p>
                        {/* PR-1K.1 — read-only claim-safety warning. Display only: never
                            edits, cancels, unschedules, or blocks publishing. Reuses the
                            shared detectUnsupportedClaims() guard via getPostClaimRisk(). */}
                        {getPostClaimRisk(post).hasUnsupportedClaims && (
                          <div
                            className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md mb-2"
                            style={{ background: 'rgba(234,179,8,0.12)', color: '#92400e', border: '1px solid rgba(234,179,8,0.3)' }}
                            title={locale === 'ar'
                              ? 'هذا المنشور المجدول يحتوي على ادعاء قد يحتاج إلى إثبات قبل النشر.'
                              : 'This scheduled post contains a claim that may need proof before publishing.'}
                          >
                            ⚠️ {locale === 'ar' ? 'يحتاج إلى دليل' : 'Needs evidence'}
                          </div>
                        )}
                        <div className="flex items-center gap-3 text-xs text-slate-400">
                          <span>🕐 {formatDate(post.scheduledAt)}</span>
                          <span className="text-accent font-medium">
                            {formatScheduledTimeDistance(post.scheduledAt, locale)}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setQueueActionError('')
                          setPendingDeletePost(post)
                        }}
                        disabled={deletingId === post.id}
                        className="shrink-0 text-xs px-3 py-1.5 rounded-lg transition-all disabled:opacity-40 text-slate-500 hover:text-red-500"
                        style={{ border: '1px solid rgba(15,23,42,0.1)' }}>
                        {deletingId === post.id ? '...' : scT?.btnCancel as string || 'Cancel'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Published posts — auto/integration only (PR7) */}
            {autoPublished.length > 0 && (
              <div className="mb-8">
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-3">
                  {scT?.sectionAutoPublished as string || 'Published through API'}
                </h2>
                <div className="space-y-3">
                  {autoPublished.slice(0, 5).map(post => (
                    <div key={post.id} className="rounded-xl bg-white p-5 flex items-start gap-4" style={{ border: '1px solid rgba(16,185,129,0.2)' }}>
                      <div className="text-2xl shrink-0">{PLATFORM_ICONS_SCH[post.platform] || '📱'}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-xs font-bold text-slate-500">{post.pageName || post.platform}</span>
                          <span className="text-xs px-2 py-0.5 rounded-lg font-medium bg-green-50 text-green-700 border border-green-200">
                            {scT?.statusAutoPublished as string || 'Published through API'}
                          </span>
                        </div>
                        <p className="text-sm text-slate-700 mb-2 line-clamp-2">{post.caption}</p>
                        <div className="flex items-center gap-3 text-xs text-slate-400">
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
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-3">
                  {scT?.sectionFailed as string || 'Failed'}
                </h2>
                <div className="space-y-3">
                  {failed.map(post => (
                    <div key={post.id} className="rounded-xl p-5 flex items-start gap-4" style={{ background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.2)' }}>
                      <div className="text-2xl shrink-0">{PLATFORM_ICONS_SCH[post.platform] || '📱'}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-xs font-bold text-slate-500">{post.pageName}</span>
                          <span className="text-xs px-2 py-0.5 rounded-lg font-medium bg-red-50 text-red-600 border border-red-200">
                            {scT?.statusFailed as string || 'Failed'}
                          </span>
                        </div>
                        <p className="text-sm text-slate-700 mb-1 line-clamp-2">{post.caption}</p>
                        {post.errorMessage && (
                          <p className="text-xs text-red-500">{post.errorMessage}</p>
                        )}
                      </div>
                      <button
                        onClick={() => {
                          setQueueActionError('')
                          setPendingDeletePost(post)
                        }}
                        disabled={deletingId === post.id}
                        className="shrink-0 text-xs px-3 py-1.5 rounded-lg text-slate-500 hover:text-red-500 transition-all disabled:opacity-40"
                        style={{ border: '1px solid rgba(15,23,42,0.1)' }}>
                        {deletingId === post.id ? '...' : (scT?.btnDismiss as string || 'Dismiss')}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Empty state */}
            {!loadingQueue && posts.length === 0 && (
              <div className="rounded-2xl p-12 text-center bg-white" style={{ border: '1px solid rgba(15,23,42,0.08)' }}>
                <div className="text-4xl mb-4">📤</div>
                <h2 className="font-bold text-slate-950 mb-2">{scT?.emptyTitle as string || 'No scheduled posts'}</h2>
                <p className="text-sm text-slate-500 mb-6">
                  {getCalendarTruthText('scheduledEmpty', locale)}
                </p>
                <Link href="/content-hub"
                  className="px-5 py-2.5 bg-accent text-white font-bold rounded-xl text-sm hover:bg-accent/90 transition-all">
                  {locale === 'ar' ? 'راجع المحتوى الجاهز' : 'Review ready content'}
                </Link>
              </div>
            )}

            {/* AI tip */}
            <div className="rounded-2xl p-5 mt-6" style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)' }}>
              <div className="text-xs font-bold uppercase tracking-wider text-amber-700 mb-2">
                {scT?.tipTitle as string || 'Pro Tip'}
              </div>
              <p className="text-sm text-slate-700 leading-relaxed">
                {locale === 'ar'
                  ? 'راجع أفكار الاستراتيجية بشكل منفصل، ثم جدول المنشورات المعتمدة من مركز المحتوى عند توفرها.'
                  : 'Review strategy ideas separately, then schedule approved posts from the Content Hub when real content is available.'}
              </p>
              <button
                onClick={() => setActiveTab('timeline')}
                className="inline-flex items-center gap-1 mt-3 text-xs text-accent hover:underline font-medium">
                {getCalendarTruthText('plannedTab', locale)} →
              </button>
            </div>
          </div>
        )}

        <details className="nx-os-card mt-5 p-4">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[13px] font-black text-[#071236]">
            <span>{locale === 'ar' ? 'أدوات تنفيذ اختيارية' : 'Optional execution tools'}</span>
            <span className="text-[10px] font-bold text-slate-400">{locale === 'ar' ? 'للتفاصيل فقط' : 'Details only'}</span>
          </summary>
          <p className="mt-2 text-[11px] font-semibold leading-5 text-slate-500">
            {locale === 'ar'
              ? 'هذه الأدوات تشرح الجاهزية والسياسات؛ قائمة القرارات أعلاه هي مسار العمل الأساسي.'
              : 'These tools explain readiness and policies; the decision queue above remains the primary workflow.'}
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Link href="/publish" className="rounded-[16px] border border-slate-200 bg-slate-50 p-4 transition hover:border-[#C7D2FE]">
              <p className="text-[12px] font-black text-[#071236]">{locale === 'ar' ? 'فحص جاهزية النشر' : 'Publishing readiness check'}</p>
              <p className="mt-1 text-[11px] font-semibold leading-5 text-slate-500">{locale === 'ar' ? 'الحسابات والصلاحيات وسجل النشر المؤكد.' : 'Accounts, permissions, and confirmed publishing log.'}</p>
            </Link>
            <Link href="/operations" className="rounded-[16px] border border-slate-200 bg-slate-50 p-4 transition hover:border-[#C7D2FE]">
              <p className="text-[12px] font-black text-[#071236]">{locale === 'ar' ? 'سياسات الأتمتة' : 'Automation policies'}</p>
              <p className="mt-1 text-[11px] font-semibold leading-5 text-slate-500">{locale === 'ar' ? 'ما يعمل الآن، وما يحتاج موافقة أو تكاملاً.' : 'What works now and what needs approval or an integration.'}</p>
            </Link>
          </div>
        </details>
      </div>
      </main>

      {pendingDeletePost && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4" style={{ background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(5px)' }}>
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl" dir={dir} style={{ border: '1px solid rgba(15,23,42,0.08)' }}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600">
                  <Trash2 className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-bold text-slate-950">
                    {pendingDeletePost.status === 'FAILED'
                      ? (locale === 'ar' ? 'إخفاء سجل التنفيذ الفاشل؟' : 'Dismiss failed execution record?')
                      : (locale === 'ar' ? 'إلغاء الجدولة؟' : 'Cancel scheduled post?')}
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    {pendingDeletePost.status === 'FAILED'
                      ? (locale === 'ar' ? 'سيُحذف سجل الفشل من NEXUS فقط. لا يرسل هذا الإجراء أي طلب إلى المنصة.' : 'This removes the failed record from NEXUS only. It sends no request to the platform.')
                      : (locale === 'ar' ? 'سيُلغى هذا الموعد داخل NEXUS فقط. لا يعني ذلك حذف أي منشور حي من المنصة.' : 'This cancels the NEXUS schedule only. It does not delete any live platform post.')}
                  </p>
                </div>
              </div>
              <button type="button" onClick={() => setPendingDeletePost(null)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label={locale === 'ar' ? 'إغلاق' : 'Close'}>
                <X className="h-4 w-4" />
              </button>
            </div>

            {queueActionError && (
              <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{queueActionError}</span>
              </div>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setPendingDeletePost(null)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                {locale === 'ar' ? 'رجوع' : 'Go back'}
              </button>
              <button type="button" onClick={() => handleDelete(pendingDeletePost)} disabled={deletingId === pendingDeletePost.id} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50">
                {deletingId === pendingDeletePost.id
                  ? (locale === 'ar' ? 'جارٍ التنفيذ...' : 'Working...')
                  : pendingDeletePost.status === 'FAILED'
                    ? (locale === 'ar' ? 'إخفاء السجل' : 'Dismiss record')
                    : (locale === 'ar' ? 'إلغاء الجدولة' : 'Cancel schedule')}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  )
}
