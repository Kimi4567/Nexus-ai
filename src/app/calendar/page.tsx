'use client'

import { useAuth } from '@/lib/auth-context'
import { useEffect, useState, useMemo } from 'react'
import AppShell from '@/components/AppShell'
import Link from 'next/link'

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
  cta?: string
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
}

const PLATFORM_ICONS: Record<string, string> = {
  Instagram: '📸',
  Facebook:  '👥',
  LinkedIn:  '💼',
  TikTok:    '🎵',
  Twitter:   '🐦',
  YouTube:   '▶️',
  Pinterest: '📌',
  Snapchat:  '👻',
}

// Distinct campaign colors so multiple campaigns are visually separated
const CAMPAIGN_COLORS = [
  { bg: 'rgba(99,102,241,0.18)',  text: '#a5b4fc', dot: '#6366f1' },  // indigo
  { bg: 'rgba(236,72,153,0.18)', text: '#f9a8d4', dot: '#ec4899' },  // pink
  { bg: 'rgba(245,158,11,0.18)', text: '#fcd34d', dot: '#f59e0b' },  // amber
  { bg: 'rgba(16,185,129,0.18)', text: '#6ee7b7', dot: '#10b981' },  // emerald
  { bg: 'rgba(59,130,246,0.18)', text: '#93c5fd', dot: '#3b82f6' },  // blue
  { bg: 'rgba(239,68,68,0.18)',  text: '#fca5a5', dot: '#ef4444' },  // red
]

const DAY_NAME_TO_INDEX: Record<string, number> = {
  monday: 1, tuesday: 2, wednesday: 3, thursday: 4,
  friday: 5, saturday: 6, sunday: 0,
  mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6, sun: 0,
}

const DAYS   = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December']

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay()
}

/** Monday of the week containing `date` */
function getMondayOfWeek(date: Date): Date {
  const d = new Date(date)
  const dow = d.getDay()                              // 0=Sun…6=Sat
  const diff = dow === 0 ? -6 : 1 - dow              // shift to Monday
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

/**
 * Resolve a day-name string (e.g. "Monday", "Day 3") or number
 * to a 0-indexed weekday where 0=Monday … 6=Sunday
 */
function resolveDayOffset(raw: string | number): number {
  if (typeof raw === 'number') return Math.max(0, Math.min(6, raw - 1))
  const lower = String(raw).toLowerCase().trim()
  // "day 3", "day3"
  const dayNum = lower.match(/^day\s*(\d)/)
  if (dayNum) return Math.max(0, Math.min(6, parseInt(dayNum[1]) - 1))
  // named day
  if (DAY_NAME_TO_INDEX[lower] !== undefined) {
    const idx = DAY_NAME_TO_INDEX[lower]   // 0=Sun,1=Mon…
    return idx === 0 ? 6 : idx - 1         // convert to 0=Mon…6=Sun
  }
  return 0
}

/** Extract CalendarPost[] from a single campaign's aiOutput */
function extractPostsFromCampaign(campaign: any, colorIndex: number): CalendarPost[] {
  const aiOutput = campaign.aiOutput
  if (!aiOutput?.strategy?.contentCalendar?.weeks) return []

  const color = CAMPAIGN_COLORS[colorIndex % CAMPAIGN_COLORS.length]
  const createdAt = new Date(campaign.createdAt)
  const weekStart = getMondayOfWeek(createdAt)   // Monday of campaign-creation week

  const posts: CalendarPost[] = []

  aiOutput.strategy.contentCalendar.weeks.forEach((week: any, weekIdx: number) => {
    if (!Array.isArray(week.posts)) return

    week.posts.forEach((post: any, postIdx: number) => {
      const dayOffset  = resolveDayOffset(post.day ?? post.dayOfWeek ?? 1)
      const weekOffset = weekIdx * 7
      const postDate   = new Date(weekStart)
      postDate.setDate(postDate.getDate() + weekOffset + dayOffset)

      const platform = post.platform || campaign.platform || 'Instagram'

      posts.push({
        id:            `${campaign.id}-w${weekIdx}-p${postIdx}`,
        campaignId:    campaign.id,
        campaignName:  campaign.title || campaign.name || 'Campaign',
        campaignColor: color.dot,
        date:          postDate.toISOString().slice(0, 10),
        day:           postDate.getDate(),
        month:         postDate.getMonth(),
        year:          postDate.getFullYear(),
        platform,
        type:          post.type || post.contentType || 'Post',
        topic:         post.topic || post.title || post.content || 'Content',
        hook:          post.hook,
        cta:           post.cta,
      })
    })
  })

  return posts
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const { isAuthenticated, loading, authHeader } = useAuth()
  const [campaigns, setCampaigns]     = useState<any[]>([])
  const [loadingData, setLoadingData] = useState(true)

  const now = new Date()
  const [viewMonth, setViewMonth] = useState(now.getMonth())
  const [viewYear,  setViewYear]  = useState(now.getFullYear())
  const [selectedDay, setSelectedDay] = useState<number | null>(null)

  useEffect(() => {
    if (!isAuthenticated) return
    const token = authHeader()
    fetch('/api/campaigns', { headers: { Authorization: token } })
      .then(r => r.json())
      .then(data => { setCampaigns(data.campaigns || []); setLoadingData(false) })
      .catch(() => setLoadingData(false))
  }, [isAuthenticated])

  /** All posts across all campaigns, derived from aiOutput */
  const allPosts = useMemo(() => {
    const out: CalendarPost[] = []
    campaigns.forEach((c, i) => out.push(...extractPostsFromCampaign(c, i)))
    return out
  }, [campaigns])

  /** Posts visible in the current month view */
  const monthPosts = useMemo(
    () => allPosts.filter(p => p.month === viewMonth && p.year === viewYear),
    [allPosts, viewMonth, viewYear]
  )

  const getPostsForDay = (day: number) =>
    monthPosts.filter(p => p.day === day)

  if (loading) return (
    <div className="min-h-screen bg-dark flex items-center justify-center">
      <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (!isAuthenticated) return null

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

  // Platform breakdown for this month
  const platformBreakdown = monthPosts.reduce((acc, p) => {
    acc[p.platform] = (acc[p.platform] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  // Campaign legend — campaigns that have posts this month
  const activeCampaigns = campaigns.filter((_, i) => {
    const color = CAMPAIGN_COLORS[i % CAMPAIGN_COLORS.length]
    return monthPosts.some(p => p.campaignColor === color.dot)
  })

  const stats = {
    total: monthPosts.length,
    platforms: Object.keys(platformBreakdown).length,
    campaigns: new Set(monthPosts.map(p => p.campaignId)).size,
  }

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10 page-enter">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
              <span>Nexus</span><span>/</span>
              <span className="text-gray-300">Calendar</span>
            </div>
            <h1 className="text-3xl font-bold mb-1">Content Calendar</h1>
            <p className="text-gray-400">Your AI-planned content pipeline across all campaigns.</p>
          </div>
          <Link href="/campaigns/new"
            className="flex items-center gap-2 px-4 py-2.5 bg-accent hover:bg-accent/90 text-white font-semibold rounded-xl text-sm transition-all">
            + New Campaign
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: 'Posts This Month', value: stats.total,     color: 'text-white'      },
            { label: 'Active Campaigns', value: stats.campaigns,  color: 'text-indigo-400' },
            { label: 'Platforms',        value: stats.platforms,  color: 'text-amber-400'  },
          ].map(s => (
            <div key={s.label} className="rounded-xl border border-dark-tertiary bg-dark-secondary p-4">
              <div className={`text-2xl font-black ${s.color}`}>{s.value}</div>
              <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ── Calendar Grid ── */}
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
                {loadingData && (
                  <span className="text-[10px] text-gray-600">Loading…</span>
                )}
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
                      ${isSelected ? 'bg-accent/8' : 'hover:bg-white/2'}`}
                  >
                    <div className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold mb-1
                      ${isToday ? 'bg-accent text-white' : isSelected ? 'text-accent' : 'text-gray-500'}`}>
                      {day}
                    </div>
                    <div className="space-y-0.5">
                      {dayPosts.slice(0, 2).map((post, pi) => (
                        <div key={pi}
                          className="text-[9px] px-1 py-0.5 rounded truncate font-medium"
                          style={{ background: post.campaignColor + '30', color: post.campaignColor }}>
                          {PLATFORM_ICONS[post.platform] || '📱'} {post.topic}
                        </div>
                      ))}
                      {dayPosts.length > 2 && (
                        <div className="text-[9px] text-gray-600">+{dayPosts.length - 2} more</div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── Side Panel ── */}
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
                    <p className="text-sm text-gray-500">No content planned for this day.</p>
                    <Link href="/campaigns/new"
                      className="inline-block mt-3 text-xs text-accent hover:underline">
                      Create a campaign →
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                    {selectedDayPosts.map(post => (
                      <div key={post.id} className="p-3 rounded-xl bg-dark border border-dark-tertiary">

                        {/* Platform + type row */}
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-sm">{PLATFORM_ICONS[post.platform] || '📱'}</span>
                          <span className="text-xs font-bold"
                            style={{ color: PLATFORM_COLORS[post.platform] || '#FF9500' }}>
                            {post.platform}
                          </span>
                          <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-gray-400">
                            {post.type}
                          </span>
                        </div>

                        {/* Topic */}
                        <p className="text-sm font-semibold text-white leading-snug mb-1">
                          {post.topic}
                        </p>

                        {/* Hook */}
                        {post.hook && (
                          <p className="text-[11px] text-gray-400 italic leading-relaxed mb-1">
                            &ldquo;{post.hook}&rdquo;
                          </p>
                        )}

                        {/* CTA */}
                        {post.cta && (
                          <p className="text-[11px] text-accent font-medium">
                            CTA: {post.cta}
                          </p>
                        )}

                        {/* Campaign link */}
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-dark-tertiary">
                          <span className="text-[10px] text-gray-600 flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full inline-block"
                              style={{ background: post.campaignColor }} />
                            {post.campaignName}
                          </span>
                          <Link href={`/campaigns/${post.campaignId}`}
                            className="text-[10px] text-accent hover:underline">
                            View →
                          </Link>
                        </div>
                      </div>
                    ))}
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
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ background: color.dot }} />
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
              <h3 className="font-bold text-white mb-4 text-sm">Platform Breakdown</h3>
              {monthPosts.length === 0 ? (
                <p className="text-sm text-gray-500">No content planned for this month.</p>
              ) : (
                <div className="space-y-3">
                  {Object.entries(platformBreakdown)
                    .sort((a, b) => b[1] - a[1])
                    .map(([platform, count]) => (
                      <div key={platform} className="flex items-center gap-3">
                        <span className="text-sm">{PLATFORM_ICONS[platform] || '📱'}</span>
                        <div className="flex-1">
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-gray-300">{platform}</span>
                            <span className="font-bold"
                              style={{ color: PLATFORM_COLORS[platform] || '#FF9500' }}>
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
                    ))
                  }
                </div>
              )}
            </div>

            {/* PULSE insight */}
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm">⚡</span>
                <div className="text-xs font-bold uppercase tracking-wider text-amber-400">PULSE — Campaign Ops</div>
              </div>
              <p className="text-sm text-gray-300 leading-relaxed">
                {monthPosts.length === 0
                  ? 'No content scheduled yet. Generate your first campaign and PULSE will build out your full content calendar.'
                  : monthPosts.length < 12
                    ? `${monthPosts.length} posts planned this month. Consistent brands post 20–30× monthly. Generate another campaign to fill the gaps.`
                    : `Strong pipeline — ${monthPosts.length} posts across ${stats.platforms} platform${stats.platforms > 1 ? 's' : ''}. Keep campaigns running on schedule for maximum reach.`
                }
              </p>
              {campaigns.length === 0 && (
                <Link href="/campaigns/new"
                  className="inline-flex items-center gap-1 mt-3 text-xs text-amber-400 hover:underline font-medium">
                  Generate a campaign →
                </Link>
              )}
            </div>

          </div>
        </div>
      </div>
    </AppShell>
  )
}
