/**
 * GET /api/cron/competitor-monitor
 * Runs daily at 09:00 UTC.
 *
 * Sprint SB — Daily Competitor Intelligence Loop
 *
 * For every workspace that has competitors[] in their Brand Brain:
 *   1. Fetch recent news/activity for each competitor via Google News RSS (free, no API key)
 *   2. Stores a source-linked research alert for user review
 *
 * No external API key required — uses Google News public RSS feed.
 * No model call, no automatic Brand Brain mutation, and no performance claim.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cronAuthError } from '@/lib/cronAuth'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// ── Google News RSS fetch ──────────────────────────────────────────────────────

interface NewsItem {
  competitor: string
  title: string
  snippet: string
  source: string
  publishedAt: string
  url: string
}

/** Fetch recent Google News RSS for a competitor name */
async function fetchCompetitorNews(competitorName: string): Promise<NewsItem[]> {
  try {
    const query = encodeURIComponent(`"${competitorName}"`)
    const url = `https://news.google.com/rss/search?q=${query}&hl=en&gl=US&ceid=US:en`

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; NEXUS-AI/1.0; +https://nexus-ai.app)',
      },
      signal: AbortSignal.timeout(8000),
    })

    if (!res.ok) return []

    const xml = await res.text()

    // Parse RSS items — extract title + snippet from XML without a parser library
    const items: NewsItem[] = []
    const itemMatches = xml.match(/<item>([\s\S]*?)<\/item>/g) ?? []

    for (const item of itemMatches.slice(0, 5)) { // max 5 recent items per competitor
      const titleMatch  = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) ??
                          item.match(/<title>(.*?)<\/title>/)
      const descMatch   = item.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/) ??
                          item.match(/<description>(.*?)<\/description>/)
      const sourceMatch = item.match(/<source[^>]*>(.*?)<\/source>/)
      const dateMatch   = item.match(/<pubDate>(.*?)<\/pubDate>/)
      const linkMatch   = item.match(/<link>(.*?)<\/link>/)

      const title = titleMatch?.[1]?.trim() ?? ''
      if (!title || title.length < 10) continue

      // Strip HTML tags from description
      const rawSnippet = descMatch?.[1] ?? ''
      const snippet = rawSnippet.replace(/<[^>]+>/g, '').replace(/&[a-z]+;/g, ' ').trim().slice(0, 300)

      items.push({
        competitor: competitorName,
        title: title.slice(0, 200),
        snippet,
        source: sourceMatch?.[1]?.trim() ?? 'Unknown',
        publishedAt: dateMatch?.[1]?.trim() ?? '',
        url: linkMatch?.[1]?.trim() ?? '',
      })
    }

    return items
  } catch {
    return []
  }
}

// ── Main handler ───────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const authError = cronAuthError(req)
  if (authError) return authError

  const results = {
    workspacesChecked: 0,
    workspacesWithCompetitors: 0,
    newsItemsFetched: 0,
    researchAlertsCreated: 0,
    errors: [] as string[],
  }

  try {
    // Load all workspaces that have competitors[] set
    const profiles = await (prisma as any).brandProfile.findMany({
      where: {
        competitors: { isEmpty: false },
      },
      select: {
        id: true,
        workspaceId: true,
        brandName: true,
        competitors: true,
      },
      take: 50, // safety cap
    }) as Array<{
      id: string
      workspaceId: string
      brandName: string | null
      competitors: string[]
    }>

    results.workspacesChecked = profiles.length
    results.workspacesWithCompetitors = profiles.filter(p => p.competitors.length > 0).length

    for (const profile of profiles) {
      if (profile.competitors.length === 0) continue

      try {
        // Fetch news for each competitor (max 5 competitors per workspace to control cost)
        const competitorsToCheck = profile.competitors.slice(0, 5)
        const allFindings = (await Promise.all(
          competitorsToCheck.map((competitor) => fetchCompetitorNews(competitor)),
        )).flat()

        results.newsItemsFetched += allFindings.length

        if (allFindings.length === 0) continue

        const db = prisma as any
        const existing = await db.agentSuggestion.findFirst({
          where: {
            workspaceId: profile.workspaceId,
            status: 'PENDING',
            payload: { path: ['source'], equals: 'market-research-monitor' },
          },
          select: { id: true },
        })
        if (existing) continue

        await db.agentSuggestion.create({
          data: {
            workspaceId: profile.workspaceId,
            agent: 'REPORTING',
            type: 'STRATEGY',
            status: 'PENDING',
            priority: 3,
            title: `Competitor research: ${allFindings.length} source headline${allFindings.length === 1 ? '' : 's'} to review`,
            reasoning: `Recent Google News RSS results matched ${competitorsToCheck.join(', ')}. Headlines are research leads only; open the original sources before using them in strategy.`,
            impact: null,
            payload: {
              source: 'market-research-monitor',
              researchKind: 'competitor',
              titleAr: `بحث المنافسين: ${allFindings.length} عنواناً للمراجعة`,
              reasoningAr: `نتائج RSS حديثة طابقت ${competitorsToCheck.join('، ')}. هذه إشارات للبحث فقط؛ افتح المصادر الأصلية قبل استخدامها في الاستراتيجية.`,
              competitors: competitorsToCheck,
              items: allFindings.slice(0, 12),
              performanceClaim: false,
              autoLearningApplied: false,
            },
            expiresAt: new Date(Date.now() + 3 * 86_400_000),
          },
        })
        results.researchAlertsCreated++
      } catch (err: any) {
        results.errors.push(`Workspace ${profile.workspaceId}: ${err.message}`)
      }
    }
  } catch (err: any) {
    results.errors.push(`Top-level: ${err.message}`)
  }

  return NextResponse.json({
    ok: true,
    mode: 'source-linked-no-ai',
    aiUsed: false,
    autoLearningApplied: false,
    ...results,
    ts: new Date().toISOString(),
  })
}
