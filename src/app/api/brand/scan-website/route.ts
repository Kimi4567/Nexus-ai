/**
 * POST /api/brand/scan-website
 *
 * Fetches up to 3 pages from the user's website (homepage, /about, /pricing or /services),
 * strips HTML to plain text, then sends to GPT-4o for Brand Brain extraction.
 *
 * Returns a structured object that maps directly to BrandProfile fields.
 * The client shows a preview and lets the user apply it to the form.
 *
 * Cost: 3 AI credits (WEBSITE_SCAN)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/apiAuth'
import { checkAndDeductCredits, refundCredits } from '@/lib/credits'

// ── Helpers ──────────────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#\d+;/g, '')
    .replace(/\s{3,}/g, '\n\n')
    .trim()
    .slice(0, 6000) // cap per page
}

async function fetchPage(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; NexusAI/1.0; +https://nexus-ai.app)',
        'Accept': 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return ''
    const html = await res.text()
    return stripHtml(html)
  } catch {
    return ''
  }
}

function normalizeUrl(raw: string): string {
  let url = raw.trim()
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url
  }
  return url.replace(/\/$/, '')
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Hoisted so the outer catch can refund a charged-but-failed scan.
  let chargedUserId: string | null = null
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { url } = body as { url?: string }

    if (!url?.trim()) {
      return NextResponse.json({ error: 'Website URL is required' }, { status: 400 })
    }

    // Deduct 3 credits for website scan
    const creditResult = await checkAndDeductCredits(user.id, 'WEBSITE_SCAN')
    if (!creditResult.ok) {
      return NextResponse.json({ error: 'insufficient_credits' }, { status: 402 })
    }
    // Mark as charged (skip unlimited plans) so any failure below refunds.
    if (creditResult.creditsUsed > 0) chargedUserId = user.id

    const base = normalizeUrl(url)

    // Fetch homepage + common sub-pages in parallel
    const pagesToTry = [
      base,
      `${base}/about`,
      `${base}/about-us`,
      `${base}/services`,
      `${base}/pricing`,
      `${base}/products`,
    ]

    const fetched = await Promise.all(pagesToTry.map(fetchPage))
    const pages = fetched.filter(t => t.length > 200) // drop empty/failed pages

    if (pages.length === 0) {
      if (chargedUserId) await refundCredits(chargedUserId, 'WEBSITE_SCAN', 'Website unreadable')
      return NextResponse.json({
        error: 'Could not read website content. The site may block automated access or require JavaScript.',
      }, { status: 422 })
    }

    // Cap total content to ~12,000 chars to stay well within context
    const combined = pages.slice(0, 3).join('\n\n---PAGE BREAK---\n\n').slice(0, 12000)

    // Send to GPT-4o for extraction via direct fetch
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        temperature: 0.2,
        max_tokens: 1200,
        messages: [
          {
            role: 'system',
            content: `You are a brand intelligence analyst. Extract structured brand data from website content.
Return ONLY valid JSON with no markdown. Be specific and factual — only extract what's clearly present.
If a field can't be determined, omit it or use an empty array.`,
          },
          {
            role: 'user',
            content: `Analyze this website content and extract brand intelligence:

${combined}

Return JSON with this exact structure:
{
  "brandName": "string or null",
  "industry": "string or null (e.g. ecommerce, SaaS, beauty, real estate)",
  "description": "2-3 sentence brand description based on their copy",
  "targetAudience": "who they serve, from their copy",
  "primaryOffer": "their main product or service",
  "uniqueAdvantages": ["advantage 1", "advantage 2", "advantage 3"],
  "toneKeywords": ["tone word 1", "tone word 2", "tone word 3"],
  "writingStyle": "how they write (e.g. conversational, professional, bold, technical)",
  "audiencePainPoints": ["pain point 1", "pain point 2"],
  "pricePoint": "budget | mid-range | premium | luxury (infer from copy/pricing page)",
  "competitors": [],
  "strategicNotes": "any notable positioning, differentiators, or messaging patterns worth noting"
}`,
          },
        ],
      }),
    })

    if (!openaiRes.ok) {
      if (chargedUserId) await refundCredits(chargedUserId, 'WEBSITE_SCAN')
      return NextResponse.json({ error: 'AI analysis failed', refunded: !!chargedUserId }, { status: 500 })
    }

    const openaiData = await openaiRes.json()
    const raw = openaiData.choices?.[0]?.message?.content?.trim() || '{}'

    let extracted: Record<string, unknown> = {}
    try {
      // Strip markdown code fences if present
      const clean = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim()
      extracted = JSON.parse(clean)
    } catch {
      if (chargedUserId) await refundCredits(chargedUserId, 'WEBSITE_SCAN', 'Unparseable AI response')
      return NextResponse.json({ error: 'Failed to parse AI response', refunded: !!chargedUserId }, { status: 500 })
    }

    return NextResponse.json({ extracted, pagesScanned: pages.length })
  } catch (error) {
    console.error('[brand/scan-website]', error)
    // Refund — charged-but-failed scan must not cost the user (skip unlimited plans)
    if (chargedUserId) await refundCredits(chargedUserId, 'WEBSITE_SCAN')
    return NextResponse.json({ error: 'Internal server error', refunded: !!chargedUserId }, { status: 500 })
  }
}
