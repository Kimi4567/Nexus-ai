/**
 * GET /api/cron/trend-monitor
 * Runs weekly on Monday at 08:30 UTC.
 *
 * For every workspace that has an industry set in Brand Brain:
 *   1. Fetch recent industry news via Google News RSS (free, no API key)
 *   2. Stores a source-linked research alert for user review
 *
 * Complements competitor-monitor (daily) with broader industry intelligence (weekly).
 * No model call, no automatic Brand Brain mutation, and no claim that a topic
 * is a trend merely because it appeared in search results.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cronAuthError } from '@/lib/cronAuth'
import { scheduledBatchOffset } from '@/lib/scheduledBatch'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// ── Google News RSS fetch ──────────────────────────────────────────────────────

interface NewsItem {
  topic: string
  title: string
  snippet: string
  source: string
  publishedAt: string
  url: string
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
      const linkMatch   = item.match(/<link>(.*?)<\/link>/)

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
        url: linkMatch?.[1]?.trim() ?? '',
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
  queries.push(`${base} trends ${new Date().getUTCFullYear()}`)
  queries.push(`${base} marketing`)

  return queries.slice(0, 3) // max 3 queries per workspace
}

// ── Main handler ───────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const authError = cronAuthError(req)
  if (authError) return authError

  const results = {
    workspacesChecked: 0,
    workspacesWithIndustry: 0,
    newsItemsFetched: 0,
    researchAlertsCreated: 0,
    errors: [] as string[],
  }

  try {
    const batchSize = 50
    const where = { industry: { not: null } }
    const eligibleProfiles = await (prisma as any).brandProfile.count({ where }) as number
    const skip = scheduledBatchOffset(eligibleProfiles, batchSize, new Date(), 'weekly')

    // Rotate capped batches so every eligible workspace can enter the scheduled
    // research cycle as the installation grows.
    const profiles = await (prisma as any).brandProfile.findMany({
      where,
      select: {
        id: true,
        workspaceId: true,
        brandName: true,
        industry: true,
      },
      orderBy: { id: 'asc' },
      skip,
      take: batchSize,
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
        const allFindings = (await Promise.all(
          queries.map((query) => fetchIndustryNews(query)),
        )).flat()

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

        const db = prisma as any
        const existing = await db.agentSuggestion.findFirst({
          where: {
            workspaceId: profile.workspaceId,
            status: 'PENDING',
            payload: { path: ['source'], equals: 'industry-research-monitor' },
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
            title: `Industry research: ${uniqueFindings.length} source headline${uniqueFindings.length === 1 ? '' : 's'} to verify`,
            reasoning: `Recent RSS results matched “${profile.industry}”. Frequency in search is not proof of a market trend; review the linked sources before creating a hypothesis or campaign.`,
            impact: null,
            payload: {
              source: 'industry-research-monitor',
              researchKind: 'industry',
              titleAr: `بحث القطاع: ${uniqueFindings.length} عنواناً للتحقق`,
              reasoningAr: `نتائج RSS حديثة طابقت «${profile.industry}». تكرار العناوين ليس دليلاً على ترند؛ راجع المصادر قبل بناء فرضية أو حملة.`,
              industry: profile.industry,
              queries,
              items: uniqueFindings.slice(0, 15),
              performanceClaim: false,
              autoLearningApplied: false,
            },
            expiresAt: new Date(Date.now() + 7 * 86_400_000),
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
