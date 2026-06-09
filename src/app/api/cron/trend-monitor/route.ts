/**
 * GET /api/cron/trend-monitor
 * Runs weekly on Monday at 08:30 UTC.
 *
 * For every workspace that has an industry set in Brand Brain:
 *   1. Fetch recent industry news via Google News RSS (free, no API key)
 *   2. GPT-4o analyzes findings → what's trending? audience pain shifts? opportunities?
 *   3. Creates Brand Brain proposals via runBrainLearning(industry_trend)
 *
 * Complements competitor-monitor (daily) with broader industry intelligence (weekly).
 * Cost: ~$0.02-0.05 per workspace per week.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { runBrainLearning } from '@/lib/brain-learning'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// ── Google News RSS fetch ──────────────────────────────────────────────────────

interface NewsItem {
  topic: string
  title: string
  snippet: string
  source: string
  publishedAt: string
}

/** Fetch recent Google News RSS for an industry / topic keyword */
async function fetchIndustryNews(industryKeyword: string): Promise<NewsItem[]> {
  try {
    const query = encodeURIComponent(industryKeyword)
    const url = `https://news.google.com/rss/search?q=${query}&hl=en&gl=US&ceid=US:en`

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; NEXUS-AI/1.0; +https://nexus-ai.app)',
      },
      signal: AbortSignal.timeout(8000),
    })

    if (!res.ok) return []

    const xml = await res.text()
    const items: NewsItem[] = []
    const itemMatches = xml.match(/<item>([\s\S]*?)<\/item>/g) ?? []

    for (const item of itemMatches.slice(0, 8)) { // max 8 items per query
      const titleMatch  = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) ??
                          item.match(/<title>(.*?)<\/title>/)
      const descMatch   = item.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/) ??
                          item.match(/<description>(.*?)<\/description>/)
      const sourceMatch = item.match(/<source[^>]*>(.*?)<\/source>/)
      const dateMatch   = item.match(/<pubDate>(.*?)<\/pubDate>/)

      const title = titleMatch?.[1]?.trim() ?? ''
      if (!title || title.length < 10) continue

      const rawSnippet = descMatch?.[1] ?? ''
      const snippet = rawSnippet.replace(/<[^>]+>/g, '').replace(/&[a-z]+;/g, ' ').trim().slice(0, 300)

      items.push({
        topic: industryKeyword,
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

/** Build search queries for an industry — primary + 1-2 supplementary */
function buildIndustryQueries(industry: string): string[] {
  const base = industry.trim()
  if (!base) return []

  const queries: string[] = [base]

  // Add contextual trend queries
  queries.push(`${base} trends 2025`)
  queries.push(`${base} marketing`)

  return queries.slice(0, 3) // max 3 queries per workspace
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
    workspacesWithIndustry: 0,
    newsItemsFetched: 0,
    proposalsCreated: 0,
    errors: [] as string[],
  }

  try {
    // Load all workspaces that have industry set
    const profiles = await (prisma as any).brandProfile.findMany({
      where: {
        industry: { not: null },
      },
      select: {
        id: true,
        workspaceId: true,
        brandName: true,
        industry: true,
      },
      take: 50,
    }) as Array<{
      id: string
      workspaceId: string
      brandName: string | null
      industry: string | null
    }>

    results.workspacesChecked = profiles.length
    results.workspacesWithIndustry = profiles.filter(p => p.industry).length

    for (const profile of profiles) {
      if (!profile.industry) continue

      try {
        const queries = buildIndustryQueries(profile.industry)
        const allFindings: NewsItem[] = []

        for (const query of queries) {
          const items = await fetchIndustryNews(query)
          allFindings.push(...items)
          await new Promise(r => setTimeout(r, 500))
        }

        // Deduplicate by title
        const seen = new Set<string>()
        const uniqueFindings = allFindings.filter(item => {
          const key = item.title.slice(0, 60)
          if (seen.has(key)) return false
          seen.add(key)
          return true
        })

        results.newsItemsFetched += uniqueFindings.length

        if (uniqueFindings.length === 0) continue

        const proposed = await runBrainLearning({
          workspaceId: profile.workspaceId,
          trigger: 'industry_trend',
          payload: {
            industry: profile.industry,
            findings: uniqueFindings,
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
