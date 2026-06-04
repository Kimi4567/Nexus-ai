import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerUserId } from '@/lib/apiAuth'

type Params = { params: { id: string } }

// ── Date helpers ──────────────────────────────────────────────────────────────

/** Return the ISO date string (YYYY-MM-DD) for next Monday from today.
 *  If today is Monday, returns today. */
function getNextMonday(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  const day = d.getDay() // 0 = Sun, 1 = Mon, ..., 6 = Sat
  const daysUntilMonday = day === 1 ? 0 : ((8 - day) % 7 || 7)
  d.setDate(d.getDate() + daysUntilMonday)
  return d
}

/** Map a "Week N, Day X" description to an absolute Date.
 *  weekIndex is 0-based (Week 1 → 0).
 *  dayStr can be: "Monday","Mon","1","Day 1","Tuesday","Tue","2", etc. */
function resolveDate(anchor: Date, weekIndex: number, dayStr: string | undefined): Date {
  const DAY_MAP: Record<string, number> = {
    sunday: 0, sun: 0,
    monday: 1, mon: 1,
    tuesday: 2, tue: 2,
    wednesday: 3, wed: 3,
    thursday: 4, thu: 4,
    friday: 5, fri: 5,
    saturday: 6, sat: 6,
  }

  let dayOffset = 0
  if (dayStr) {
    const lc = dayStr.toLowerCase().replace(/^day\s*/, '').trim()
    if (lc in DAY_MAP) {
      // Named day: offset from Monday of that week
      dayOffset = DAY_MAP[lc] === 0 ? 6 : DAY_MAP[lc] - 1 // Mon=0..Sun=6
    } else {
      const n = parseInt(lc, 10)
      if (!isNaN(n)) dayOffset = n - 1 // 1-based day number
    }
  }

  const result = new Date(anchor)
  result.setDate(anchor.getDate() + weekIndex * 7 + dayOffset)
  return result
}

function toDateString(d: Date): string {
  return d.toISOString().split('T')[0]
}

// ── Normalise the raw AI contentCalendar into flat CalendarItem list ──────────

interface CalendarItem {
  id: string
  campaignId: string
  week: number
  date: string          // YYYY-MM-DD
  platform: string
  topic: string
  title?: string
  hook?: string
  caption?: string
  cta?: string
  visualNote?: string
  contentType?: string
  status: 'planned'
  source: 'campaign_ai_output'
}

function buildCalendarItems(campaignId: string, aiOutput: any): CalendarItem[] {
  const anchor = getNextMonday()
  const items: CalendarItem[] = []

  // ── Priority 1: Sprint M weeklyExecutionPlan ─────────────────────────────
  const weeklyExecutionPlan: any[] = aiOutput?.strategy?.weeklyExecutionPlan || []
  if (weeklyExecutionPlan.length > 0) {
    for (const wk of weeklyExecutionPlan) {
      const weekNum: number = parseInt(wk.week ?? '1', 10) || 1
      const weekIndex = weekNum - 1
      const deliverables: string[] = Array.isArray(wk.deliverables) ? wk.deliverables : []
      const platforms: string[] = Array.isArray(wk.platforms) ? wk.platforms : ['general']

      deliverables.forEach((deliverable: string, di: number) => {
        // Spread deliverables across Mon–Fri of the week
        const dayOffset = di % 5  // 0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri
        const date = new Date(anchor)
        date.setDate(anchor.getDate() + weekIndex * 7 + dayOffset)

        items.push({
          id: `${campaignId}_wex_w${weekNum}_${items.length}`,
          campaignId,
          week: weekNum,
          date: toDateString(date),
          platform: (platforms[di % platforms.length] || 'general').toUpperCase(),
          topic: deliverable,
          title: wk.theme,
          hook: wk.keyMessage,
          caption: wk.organicFocus,
          cta: undefined,
          visualNote: wk.theme,
          contentType: wk.paidFocus ? 'paid' : 'organic',
          status: 'planned',
          source: 'campaign_ai_output',
        })
      })
    }
    return items
  }

  // ── Priority 2: contentCalendar (week/posts format) ──────────────────────
  // contentCalendar is array of { week, posts: [...] }
  const contentCalendar: any[] = aiOutput?.contentCalendar || []

  // Also try nested strategy.contentCalendar
  const strategyCalendar: any[] = aiOutput?.strategy?.contentCalendar || []

  // Combine both sources; contentCalendar (flat) takes priority
  const calendarSource = contentCalendar.length > 0 ? contentCalendar : strategyCalendar

  if (calendarSource.length > 0) {
    // Format: [{ week: 1, posts: [{ day, platform, type, topic, hook, caption, cta, ... }] }]
    for (const weekObj of calendarSource) {
      const weekNum: number = parseInt(weekObj.week ?? weekObj.weekNumber ?? '1', 10) || 1
      const weekIndex = weekNum - 1
      const posts: any[] = weekObj.posts || weekObj.content || []

      for (const post of posts) {
        const dayStr: string = post.day ?? post.dayOfWeek ?? post.dayNumber ?? undefined
        const date = resolveDate(anchor, weekIndex, dayStr)

        items.push({
          id: `${campaignId}_w${weekNum}_${items.length}`,
          campaignId,
          week: weekNum,
          date: toDateString(date),
          platform: post.platform || 'general',
          topic: post.topic || post.theme || post.title || 'Campaign Post',
          title: post.title || post.headline,
          hook: post.hook,
          caption: post.caption || post.content,
          cta: post.cta || post.callToAction,
          visualNote: post.visual || post.visualNote || post.visualDirection,
          contentType: post.type || post.contentType,
          status: 'planned',
          source: 'campaign_ai_output',
        })
      }
    }
    return items
  }

  // ── Priority 3: weeklyPlan format [{ week, theme, posts/days: [...] }] ────
  const weeklyPlan: any[] = aiOutput?.strategy?.weeklyPlan || []
  if (weeklyPlan.length > 0) {
    for (const weekObj of weeklyPlan) {
      const weekNum: number = parseInt(weekObj.week ?? '1', 10) || 1
      const weekIndex = weekNum - 1
      const posts: any[] = weekObj.posts || weekObj.days || weekObj.content || []

      for (const post of posts) {
        const dayStr: string = post.day ?? post.dayOfWeek ?? undefined
        const date = resolveDate(anchor, weekIndex, dayStr)

        items.push({
          id: `${campaignId}_w${weekNum}_${items.length}`,
          campaignId,
          week: weekNum,
          date: toDateString(date),
          platform: post.platform || 'general',
          topic: post.topic || post.theme || weekObj.theme || 'Campaign Post',
          title: post.title || post.headline,
          hook: post.hook,
          caption: post.caption || post.content,
          cta: post.cta || post.callToAction,
          visualNote: post.visual || post.visualNote,
          contentType: post.type || post.contentType,
          status: 'planned',
          source: 'campaign_ai_output',
        })
      }
    }
    return items
  }

  // Last resort: derive from contentPillars + hooks + CTAs (minimal scaffold)
  const pillars: any[] = aiOutput?.strategy?.contentPillars || []
  const hooks: string[] = aiOutput?.topHooks || aiOutput?.strategy?.topHooks || []
  const ctas: string[] = aiOutput?.ctaVariations || aiOutput?.strategy?.ctaVariations || []

  if (pillars.length > 0) {
    pillars.forEach((pillar, i) => {
      const date = resolveDate(anchor, Math.floor(i / 3), String((i % 3) + 1))
      items.push({
        id: `${campaignId}_pillar_${i}`,
        campaignId,
        week: Math.floor(i / 3) + 1,
        date: toDateString(date),
        platform: pillar.platform || 'general',
        topic: pillar.topic || pillar.pillar || pillar.title || 'Campaign Post',
        hook: hooks[i % hooks.length],
        cta: ctas[i % ctas.length],
        status: 'planned',
        source: 'campaign_ai_output',
      })
    })
  }

  return items
}

// ── POST /api/campaigns/[id]/push-to-calendar ─────────────────────────────────
export async function POST(req: NextRequest, { params }: Params) {
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const campaign = await prisma.campaign.findFirst({
      where: { id: params.id, workspace: { ownerId: userId } },
    })
    if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const aiOutput = (campaign.aiOutput ?? {}) as Record<string, any>

    // Duplicate prevention — check if already pushed (unless force=true)
    const body = await req.json().catch(() => ({}))
    const force: boolean = body?.force === true

    if (aiOutput.calendarPushedAt && !force) {
      return NextResponse.json({
        alreadyPushed: true,
        pushedAt: aiOutput.calendarPushedAt,
        count: (aiOutput.calendarItems ?? []).length,
      })
    }

    // Build calendar items from AI output
    const calendarItems = buildCalendarItems(params.id, aiOutput)

    if (calendarItems.length === 0) {
      return NextResponse.json({ error: 'NO_CONTENT_CALENDAR' }, { status: 422 })
    }

    // Persist back into aiOutput JSON
    const updatedAiOutput = {
      ...aiOutput,
      calendarItems,
      calendarPushedAt: new Date().toISOString(),
    }

    await prisma.campaign.update({
      where: { id: params.id },
      data: { aiOutput: updatedAiOutput as any },
    })

    // Log activity
    await prisma.campaignActivity.create({
      data: {
        campaignId: params.id,
        type: 'calendar_pushed',
        description: `Pushed ${calendarItems.length} items to calendar`,
      },
    }).catch(() => {}) // Non-blocking

    return NextResponse.json({
      success: true,
      count: calendarItems.length,
      pushedAt: updatedAiOutput.calendarPushedAt,
    })
  } catch (err: any) {
    console.error('[push-to-calendar POST]', err)
    return NextResponse.json({ error: 'Failed to push to calendar' }, { status: 500 })
  }
}

// ── DELETE /api/campaigns/[id]/push-to-calendar — remove pushed items ─────────
export async function DELETE(req: NextRequest, { params }: Params) {
  const userId = await getServerUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const campaign = await prisma.campaign.findFirst({
      where: { id: params.id, workspace: { ownerId: userId } },
    })
    if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const aiOutput = (campaign.aiOutput ?? {}) as Record<string, any>
    const { calendarItems: _removed, calendarPushedAt: _dt, ...rest } = aiOutput

    await prisma.campaign.update({
      where: { id: params.id },
      data: { aiOutput: rest },
    })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[push-to-calendar DELETE]', err)
    return NextResponse.json({ error: 'Failed to remove calendar items' }, { status: 500 })
  }
}
