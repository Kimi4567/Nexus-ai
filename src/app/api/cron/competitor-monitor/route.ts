/**
 * GET /api/cron/competitor-monitor
 * Runs daily at 09:00 UTC.
 *
 * Sprint SB — Daily Competitor Intelligence Loop
 *
 * For every workspace that has competitors[] in their Brand Brain:
 *   1. Fetch recent news/activity for each competitor via Google News RSS (free, no API key)
 *   2. GPT-4o analyzes findings → what are competitors doing? any gaps/opportunities?
 *   3. Creates Brain Brain proposals via runBrainLearning(competitor_monitor)
 *
 * No external API key required — uses Google News public RSS feed.
 * Cost: ~$0.02-0.05 per workspace per day (GPT-4o analysis only).
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { runBrainLearning } from '@/lib/brain-learning'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// ── Google News RSS fetch ──────────────────────────────────────────────────────

interface NewsItem {
  competitor: string
  title: string
  snippet: string
  source: string
  publishedAt: string
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
      })
    }

    return items
  } catch {
    return []
  }
}

// ── Main handler ───────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret && process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 })
  }
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results = {
    workspacesChecked: 0,
    workspacesWithCompetitors: 0,
    newsItemsFetched: 0,
    proposalsCreated: 0,
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
        const allFindings: NewsItem[] = []
        const competitorsToCheck = profile.competitors.slice(0, 5)

        for (const competitor of competitorsToCheck) {
          const items = await fetchCompetitorNews(competitor)
          allFindings.push(...items)
          // Small delay to avoid rate limits
          await new Promise(r => setTimeout(r, 500))
        }

        results.newsItemsFetched += allFindings.length

        if (allFindings.length === 0) continue

        // Run Brain Brain learning with competitor findings
        const proposed = await runBrainLearning({
          workspaceId: profile.workspaceId,
          trigger: 'competitor_monitor',
          payload: {
            competitors: competitorsToCheck,
            findings: allFindings,
            brandName: profile.brandName ?? 'Unknown',
          },
        })

        results.proposalsCreated += proposed
      } catch (err: any) {
        results.errors.push(`Workspace ${profile.workspaceId}: ${err.message}`)
      }
    }
  } catch (err: any) {
    results.errors.push(`Top-level: ${err.message}`)
  }

  return NextResponse.json({
    ok: true,
    ...results,
    ts: new Date().toISOString(),
  })
}
