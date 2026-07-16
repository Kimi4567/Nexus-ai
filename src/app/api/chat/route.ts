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
  buildCreditChargeReceipt,
  checkAndDeductCredits,
  creditCheckHttpStatus,
  finalizeCreditDeduction,
  refundCreditDeduction,
  CREDIT_COSTS,
  type CreditDeductionOk,
} from '@/lib/credits'
import { buildBrandExecutionContext } from '@/lib/brandExecutionContext'
import { PUBLIC_PAID_PLANS } from '@/lib/commercialPlans'
import { enforceBillableAiRateLimit } from '@/lib/billableAiRateLimit'
import { getCreditOperationKey } from '@/lib/creditOperationKey.server'
import {
  getStrategyToDraftsJourneyCost,
  STRATEGY_PRICING_DISPLAY_TRUTH,
} from '@/lib/strategy/strategyPricingDisplayTruth'

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

**Strategy Studio** (/strategy): The single place to create a new strategy. The strategy is a review artifact: positioning, audience, messages, content directions, risks, and an execution outline. It does not create final posts or publish anything.

**Strategy & campaigns** (/strategy): The operating path for creating a strategy and continuing its campaign workspace.

**Quality Review**: A paid review gate that checks claim risk, brand consistency, and recommended fixes. Passing it is not proof that the strategy will perform.

**Content Hub**: After strategy approval, users may spend credits to create review-only post drafts. Draft creation does not approve, schedule, publish, or launch ads. Optional image generation is a separate action and cost.

**Connections** (/connections): Shows the integrations that are actually available and their current connection state. Never tell a user an account is connected or direct publishing is supported unless current product data explicitly confirms it.

**Analytics** (/analytics): Shows measured performance only when eligible connected data exists. Otherwise it is readiness guidance, not results.

**Billing** (/billing): Manage subscription and credits. There are exactly two public paid plans: ${growth.name} ($${growth.priceUsd}/month, ${growth.monthlyCredits} monthly credits) and ${autopilot.name} ($${autopilot.priceUsd}/month, ${autopilot.monthlyCredits} monthly credits). The 12 one-time trial credits are onboarding, not a third paid plan. Legacy plan names may exist only for existing accounts.

**AI Credits**: Strategy generation costs ${STRATEGY_PRICING_DISPLAY_TRUTH.range.minimum}–${STRATEGY_PRICING_DISPLAY_TRUTH.range.maximum} credits based on the confirmed scope, horizon, and intensity. The 12-credit trial example is Organic Light / 30 days (${STRATEGY_PRICING_DISPLAY_TRUTH.trialActivation.cost}) + quality review (${CREDIT_COSTS.SENTINEL_REVIEW}) + content plan (${CREDIT_COSTS.CONTENT_PLAN_GENERATION}) = ${getStrategyToDraftsJourneyCost(STRATEGY_PRICING_DISPLAY_TRUTH.trialActivation.cost, CREDIT_COSTS.SENTINEL_REVIEW, CREDIT_COSTS.CONTENT_PLAN_GENERATION)}. The exact quote is shown before execution and saved in the ledger. Images cost ${CREDIT_COSTS.IMAGE_GENERATION} each and chat costs ${CREDIT_COSTS.CHAT_MESSAGE} per message. Failed provider requests are refunded. Monthly subscription credits refresh with the billing cycle; purchased credits have separate validity.

**Settings** (/settings): Account preferences, language (Arabic/English), and notifications; available from the account menu rather than the primary workflow.

## Pages Reference
- /dashboard: Today's decisions, workstreams, activity, and credit overview
- /strategy: Create a strategy and enter its campaign workspace
- /brand: Brand Brain setup
- /content-hub: Review content and publishing work
- /connections: Social media integrations
- /analytics: Performance analytics
- /billing: Subscription management
- /settings: Account settings
- /approvals: Decision Center for review-required actions
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
  await refundCreditDeduction({ userId, action: 'CHAT_MESSAGE', deduction: credit, reason })
}

// ── Main handler ───────────────────────────────────────────────
export async function POST(req: NextRequest) {
  let chargedUserId: string | null = null
  let chargedCredit: CreditDeductionOk | null = null
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
    const normalizedMessages = messages.slice(-10).map((message) => ({
      role: message?.role,
      content: typeof message?.content === 'string' ? message.content.trim() : '',
    }))
    const invalidMessage = normalizedMessages.some((message) =>
      !['user', 'assistant'].includes(message.role) || !message.content || message.content.length > 4_000,
    )
    const totalInputCharacters = normalizedMessages.reduce((sum, message) => sum + message.content.length, 0)
    if (invalidMessage || totalInputCharacters > 12_000) {
      return NextResponse.json({
        error: 'Chat context is too large or invalid. Keep the last messages under 12,000 characters total.',
        code: 'CHAT_CONTEXT_LIMIT',
        creditsCharged: false,
      }, { status: 400 })
    }

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'AI service not configured' }, { status: 503 })
    }

    const rateLimitResponse = await enforceBillableAiRateLimit(authUser.id, 'CHAT_MESSAGE')
    if (rateLimitResponse) return rateLimitResponse

    // ── Reserve credits before AI call ───────────────────────────
    const credit = await checkAndDeductCredits(
      authUser.id,
      'CHAT_MESSAGE',
      undefined,
      {
        entityId: authUser.id,
        entityType: 'ephemeral_chat_response',
        operationKey: getCreditOperationKey(req, 'CHAT_MESSAGE', 'ephemeral_chat_response', authUser.id),
      },
    )
    if (!credit.ok) return NextResponse.json(credit, { status: creditCheckHttpStatus(credit) })
    chargedUserId = authUser.id
    chargedCredit = credit

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
            ...normalizedMessages,
          ],
        }),
      })
    } catch (error) {
      await refundChatCredit(authUser.id, credit, 'Chat provider request failed')
      chargedCredit = null
      throw error
    }

    if (!openaiRes.ok) {
      const errText = await openaiRes.text()
      console.error('[chat] OpenAI error:', openaiRes.status, errText)
      await refundChatCredit(authUser.id, credit, `Chat provider returned ${openaiRes.status}`)
      chargedCredit = null
      return NextResponse.json(
        { error: `AI service error (${openaiRes.status})` },
        { status: 502 },
      )
    }

    // ── Stream back to client ─────────────────────────────────────
    // Parse SSE from OpenAI and pipe as plain text chunks
    const encoder = new TextEncoder()
    let streamRefunded = false
    const refundStreamOnce = async (reason: string) => {
      if (streamRefunded) return
      streamRefunded = true
      await refundChatCredit(authUser.id, credit, reason)
    }
    const stream = new ReadableStream({
      async start(controller) {
        const reader = openaiRes.body?.getReader()
        if (!reader) {
          await refundStreamOnce('Chat provider returned no response stream')
          controller.close()
          return
        }

        const decoder = new TextDecoder()
        let buffer = ''
        let emittedContent = false
        let completed = false

        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) {
              completed = true
              break
            }

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
                  emittedContent = true
                  controller.enqueue(encoder.encode(delta))
                }
              } catch {
                // malformed chunk — skip
              }
            }
          }
        } catch (error) {
          console.error('[chat] Stream failed:', error)
        } finally {
          if (!completed || !emittedContent) {
            await refundStreamOnce(!completed
              ? 'Chat response stream failed before completion'
              : 'Chat provider returned no usable response')
          } else {
            const finalization = await finalizeCreditDeduction({
              userId: authUser.id,
              action: 'CHAT_MESSAGE',
              deduction: credit,
            })
            if (!finalization.ok) {
              console.error('[chat] Credit finalization failed; reservation was returned:', finalization.error)
            }
          }
          reader.releaseLock()
          controller.close()
        }
      },
    })

    const receipt = buildCreditChargeReceipt('CHAT_MESSAGE', credit)

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'X-Content-Type-Options': 'nosniff',
        'X-Nexus-Credit-Action': receipt.action,
        'X-Nexus-Credits-Used': String(receipt.creditsUsed),
        'X-Nexus-Credits-Remaining': String(receipt.creditsRemaining),
        'X-Nexus-Credit-Reason': encodeURIComponent(receipt.reason),
        'X-Nexus-Credit-Status': 'finalizes-after-stream',
      },
    })
  } catch (err) {
    console.error('[chat] Unexpected error:', err)
    if (chargedUserId && chargedCredit) {
      await refundChatCredit(chargedUserId, chargedCredit, 'Chat request failed before a usable response')
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
