/**
 * POST /api/chat
 * Real AI chat assistant scoped to Nexus platform.
 * Injects user's Brand Brain, campaigns, credits, and page context.
 * Returns a streaming text/event-stream response.
 */
import { NextRequest, NextResponse } from 'next/server'
import { ensureDbUser } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'
import { chatRateLimitDb } from '@/lib/dbRateLimit'
import {
  checkAndDeductCredits,
  refundCredits,
  refundCreditsForTransaction,
  CREDIT_COSTS,
  type CreditDeductionOk,
} from '@/lib/credits'
import { buildBrandExecutionContext } from '@/lib/brandExecutionContext'
import { PUBLIC_PAID_PLANS } from '@/lib/commercialPlans'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any

// ── Build system prompt from user context ──────────────────────
function buildSystemPrompt(ctx: {
  userName: string | null
  brandContext: string
  campaignCount: number
  aiCredits: number
  plan: string
  page: string
}): string {
  const {
    userName, brandContext,
    campaignCount, aiCredits, plan, page,
  } = ctx

  const brandSection = brandContext
    ? `\n## User's governed Brand Brain\n${brandContext}\n`
    : `\n## User's Brand\n- No Brand Brain configured yet. Encourage them to set it up at /brand.\n`

  const [growth, autopilot] = PUBLIC_PAID_PLANS

  const accountSection = `
## User's Account
- Name: ${userName || 'User'}
- Plan: ${plan}
- AI Credits Remaining: ${aiCredits}
- Campaigns Created: ${campaignCount}
- Current Page: ${page}
`

  const platformKnowledge = `
## Nexus Platform Knowledge
Nexus is an AI-powered marketing operating system. Here's what it can do:

**Brand Brain** (/brand): The memory system. Users define their brand identity, tone, audience, offers, and competitors. All AI outputs are scoped to this brand.

**Campaigns** (/campaigns): Create full AI-generated marketing campaigns. Each campaign produces: strategy, positioning, hooks, scripts, captions, CTAs, content calendar, storyboard, and creative briefs.

**Run Full Strategy**: A one-click feature on the dashboard that generates a complete campaign strategy using the brand's context. Costs AI credits.

**Campaign Detail**: After creating a campaign, users can see: Strategy tab (AI-generated plan), Visuals tab (AI images + video concepts), Calendar tab (scheduled posts), Publish tab (social media connections), Content Pack (ready-to-use content), Execution Package (full briefing doc), Sentinel Review (competitor analysis).

**Connections** (/connections): Connect Meta (Facebook/Instagram), TikTok, LinkedIn social accounts to publish directly.

**Calendar** (/calendar): See all scheduled posts across campaigns in a monthly view.

**Media Library** (/media): Upload and manage brand assets (images, videos, logos).

**Analytics** (/analytics): Track campaign performance and AI-generated insights.

**Billing** (/billing): Manage subscription and credits. There are exactly two public paid plans: ${growth.name} ($${growth.priceUsd}/month, ${growth.monthlyCredits} monthly credits) and ${autopilot.name} ($${autopilot.priceUsd}/month, ${autopilot.monthlyCredits} monthly credits). The 10-credit, 14-day trial is onboarding, not a third paid plan. Legacy plan names may exist only for existing accounts.

**AI Credits**: Current fixed costs are full strategy ${CREDIT_COSTS.RUN_FULL_STRATEGY}, campaign generation ${CREDIT_COSTS.CAMPAIGN_GENERATION}, content plan ${CREDIT_COSTS.CONTENT_PLAN_GENERATION}, image ${CREDIT_COSTS.IMAGE_GENERATION}, and chat ${CREDIT_COSTS.CHAT_MESSAGE}. Some strategy runs can show a variable cost before execution. Monthly subscription credits refresh with the billing cycle; purchased credits have separate validity and are not monthly allowance.

**Settings** (/settings): Account preferences, language (Arabic/English), notifications.

## Pages Reference
- /dashboard: Main hub with recent campaigns, suggestions, credits overview
- /campaigns: List of all campaigns
- /campaigns/new: Create a new campaign
- /brand: Brand Brain setup
- /connections: Social media integrations
- /calendar: Content calendar
- /media: Media library
- /analytics: Performance analytics
- /billing: Subscription management
- /settings: Account settings
- /strategy: Marketing strategy hub
`

  return `You are the Nexus AI Assistant — an intelligent marketing advisor built into the Nexus platform.

## Your Role
You help users get the most out of Nexus to grow their business. You understand their brand, campaigns, and goals. You provide:
- Actionable marketing advice tailored to their brand
- Platform guidance (how to use Nexus features effectively)
- Campaign strategy suggestions
- Content ideas aligned with their brand voice
- Answers to any question about using the Nexus platform

## Your Boundaries
You ONLY discuss:
1. The Nexus platform and its features
2. Marketing, advertising, campaigns, content creation, social media strategy
3. The user's brand, campaigns, and business goals within Nexus
4. General marketing best practices

You do NOT:
- Discuss unrelated topics (politics, personal life, other tools unrelated to marketing, coding outside Nexus)
- Write full code or technical implementations
- Give financial investment advice
- Engage in off-topic conversation

If asked something outside scope, politely redirect: "I'm focused on helping you with your marketing on Nexus. Let me know how I can help with your campaigns or brand strategy!"

Never present AI inference, generated copy, a publication event, or an approval as measured marketing performance. State what is known, what is assumed, and what requires connected analytics.

## Tone
- Warm, intelligent, direct
- Bilingual: respond in the same language the user writes in (Arabic or English)
- If user writes in Arabic, respond fully in Arabic
- If user writes in English, respond fully in English
- Be concise — 2-4 sentences max unless a detailed answer is genuinely needed
- Use specific, actionable advice — never generic filler
${brandSection}${accountSection}${platformKnowledge}`
}

async function refundChatCredit(userId: string, credit: CreditDeductionOk, reason: string) {
  if (credit.creditsUsed <= 0) return
  if (credit.transactionId) {
    await refundCreditsForTransaction({ userId, transactionId: credit.transactionId, reason })
    return
  }
  await refundCredits(userId, 'CHAT_MESSAGE', reason)
}

// ── Main handler ───────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const authUser = await ensureDbUser(req)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const rl = await chatRateLimitDb(authUser.id)
    if (!rl.ok) {
      return NextResponse.json({ error: rl.message }, { status: 429 })
    }

    const body = await req.json()
    const { messages, page } = body as {
      messages: Array<{ role: 'user' | 'assistant'; content: string }>
      page?: string
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'No messages provided' }, { status: 400 })
    }

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'AI service not configured' }, { status: 503 })
    }

    // ── Deduct credits before AI call ────────────────────────────
    const credit = await checkAndDeductCredits(authUser.id, 'CHAT_MESSAGE')
    if (!credit.ok) return NextResponse.json(credit, { status: 402 })

    // ── Load user context in parallel ───────────────────────────
    const [user, workspace, subscription] = await Promise.all([
      prisma.user.findUnique({
        where: { id: authUser.id },
        select: { name: true, aiCredits: true, subscriptionStatus: true },
      }),
      prisma.workspace.findFirst({
        where: { ownerId: authUser.id },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      }),
      prisma.subscription.findUnique({
        where: { userId: authUser.id },
        select: { plan: true },
      }).catch(() => null),
    ])

    // ── Load Brand Brain + campaign count ───────────────────────
    let brandProfile: Record<string, unknown> | null = null
    let campaignCount = 0

    if (workspace) {
      const [bp, cc] = await Promise.all([
        db.brandProfile.findUnique({ where: { workspaceId: workspace.id } }).catch(() => null),
        prisma.campaign.count({ where: { workspaceId: workspace.id } }).catch(() => 0),
      ])
      brandProfile = bp
      campaignCount = cc
    }

    // ── Build context ────────────────────────────────────────────
    const systemPrompt = buildSystemPrompt({
      userName: user?.name ?? null,
      brandContext: buildBrandExecutionContext(brandProfile),
      campaignCount,
      aiCredits: user?.aiCredits ?? 0,
      plan: subscription?.plan ?? 'FREE',
      page: page ?? 'unknown',
    })

    // ── Streaming OpenAI call ────────────────────────────────────
    let openaiRes: Response
    try {
      openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          stream: true,
          max_tokens: 400,
          temperature: 0.7,
          messages: [
            { role: 'system', content: systemPrompt },
            // Keep last 10 messages max for context window efficiency
            ...messages.slice(-10),
          ],
        }),
      })
    } catch (error) {
      await refundChatCredit(authUser.id, credit, 'Chat provider request failed')
      throw error
    }

    if (!openaiRes.ok) {
      const errText = await openaiRes.text()
      console.error('[chat] OpenAI error:', openaiRes.status, errText)
      await refundChatCredit(authUser.id, credit, `Chat provider returned ${openaiRes.status}`)
      return NextResponse.json(
        { error: `AI service error (${openaiRes.status})` },
        { status: 502 },
      )
    }

    // ── Stream back to client ─────────────────────────────────────
    // Parse SSE from OpenAI and pipe as plain text chunks
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        const reader = openaiRes.body?.getReader()
        if (!reader) { controller.close(); return }

        const decoder = new TextDecoder()
        let buffer = ''

        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() ?? ''

            for (const line of lines) {
              const trimmed = line.trim()
              if (!trimmed || trimmed === 'data: [DONE]') continue
              if (!trimmed.startsWith('data: ')) continue

              try {
                const json = JSON.parse(trimmed.slice(6))
                const delta = json.choices?.[0]?.delta?.content
                if (delta) {
                  controller.enqueue(encoder.encode(delta))
                }
              } catch {
                // malformed chunk — skip
              }
            }
          }
        } finally {
          reader.releaseLock()
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (err) {
    console.error('[chat] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
