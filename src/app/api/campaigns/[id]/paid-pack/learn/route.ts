/**
 * POST /api/campaigns/[id]/paid-pack/learn
 *
 * AI analyzes paid metrics + copy variants + audience brief and stores a
 * paid metrics signal. Manual metrics stay pending review and do not become
 * analytics-backed Brand Brain learning automatically.
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/apiAuth'
import {
  checkAndDeductCredits,
  refundCredits,
  refundCreditsForTransaction,
  type CreditDeductionOk,
} from '@/lib/credits'
import { snapshotBrandMaturity } from '@/lib/brandMaturity'
import { paidMetricsSignalCopy } from '@/lib/paidBoundary'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any

async function callGPT(system: string, user: string): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      response_format: { type: 'json_object' },
      temperature: 0.5,
      max_tokens: 1500,
    }),
  })
  if (!res.ok) throw new Error(`OpenAI error: ${res.status}`)
  const data = await res.json()
  return data.choices?.[0]?.message?.content ?? '{}'
}

async function refundDeductedCredits(userId: string, credit: CreditDeductionOk, reason: string) {
  if (credit.creditsUsed <= 0) return
  if (credit.transactionId) {
    await refundCreditsForTransaction({ userId, transactionId: credit.transactionId, reason })
    return
  }
  await refundCredits(userId, 'AD_COPY', reason)
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  let chargedUserId: string | null = null
  let chargedCredit: CreditDeductionOk | null = null

  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const campaign = await prisma.campaign.findFirst({
      where: { id: params.id, workspace: { ownerId: user.id } },
      include: { workspace: true },
    })
    if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const pack = await db.paidCampaignPack.findUnique({
      where: { campaignId: params.id },
    })
    if (!pack) return NextResponse.json({ error: 'No paid pack found' }, { status: 404 })
    if (!pack.metrics) return NextResponse.json({ error: 'No metrics yet — enter your campaign results first' }, { status: 400 })

    let brandProfile = null
    try {
      brandProfile = await db.brandProfile.findUnique({
        where: { workspaceId: campaign.workspaceId },
      })
    } catch { /* ok */ }

    const signalTruth = paidMetricsSignalCopy(pack.metricsSource)

    const systemPrompt = `You are a senior performance marketing analyst. Your job is to summarize paid campaign metrics as a review signal.

If the metrics source is manual, treat the output as a manually reported metrics signal pending review. Do not call it Brand Brain learning, a winner, best-performing, or analytics-backed proof.

Be specific. Use real numbers from the metrics. Never be generic. Output valid JSON only.`

    const metricsStr = JSON.stringify(pack.metrics ?? {})
    const copyStr = JSON.stringify((pack.copyVariants ?? []).slice(0, 5))
    const audienceStr = JSON.stringify(pack.audienceBrief ?? {})
    const platforms: string[] = pack.platforms ?? []
    const budgetInsights = JSON.stringify(pack.budgetInsights ?? {})

    const userPrompt = `Campaign: "${campaign.name}"
Objective: ${pack.objective}
Platforms: ${platforms.join(', ')}
Duration: ${pack.durationDays} days
Daily Budget: ${pack.currency} ${pack.dailyBudget}

ACTUAL METRICS:
${metricsStr}

COPY VARIANTS USED:
${copyStr}

AUDIENCE BRIEF:
${audienceStr}

BUDGET INSIGHTS:
${budgetInsights}

Current Brand Brain state:
- Current Reviewed Hook Signals: ${JSON.stringify((brandProfile?.winningHooks ?? []).slice(0, 3))}
- Current Target Audience: ${brandProfile?.targetAudience ?? 'Not set'}
- Current Top Platforms: ${JSON.stringify(brandProfile?.topPlatforms ?? [])}
- Current Reviewed Avoidance Signals: ${JSON.stringify((brandProfile?.failedAngles ?? []).slice(0, 3))}
Metrics source: ${pack.metricsSource ?? 'manual'}
Signal label: ${signalTruth.label}

Extract a paid metrics signal as JSON:
{
  "learnings": {
    "executiveSummary": "2-3 sentence plain-language summary of what worked, what didn't, and the #1 insight",
    "campaignScore": "1-10 rating based on industry benchmarks",
    "candidateHooks": ["exact hooks / angles that appear promising based on this signal"],
    "audienceSignal": "refined audience signal from the reported metrics",
    "platformSignal": "platform name with stronger reported CTR or ROAS if supported by the metrics",
    "underperformingAngles": ["copy angles or targeting that may need review"],
    "keyInsight": "the single most important thing this campaign revealed about the audience",
    "nextCampaignRecommendation": "specific actionable recommendation for the next campaign"
  },
  "brandBrainUpdates": {
    "hooksToReview": ["new hooks to review — only if analytics-backed metrics support them"],
    "anglesToReview": ["angles to review before avoiding in future"],
    "topPlatformsUpdate": ["ordered list of platforms from best to worst ROAS — replace current"],
    "targetAudienceRefinement": "updated audience description from analytics-backed metrics only, or null",
    "strategicNotesAddition": "1-2 sentence addition framed as a paid metrics signal"
  }
}`

    const creditResult = await checkAndDeductCredits(user.id, 'AD_COPY')
    if (!creditResult.ok) {
      return NextResponse.json({ error: 'Insufficient credits', upgradeRequired: true }, { status: 402 })
    }
    chargedUserId = user.id
    chargedCredit = creditResult

    const raw = await callGPT(systemPrompt, userPrompt)
    let parsed: {
      learnings?: Record<string, unknown>
      brandBrainUpdates?: {
        hooksToReview?: string[]
        anglesToReview?: string[]
        topPlatformsUpdate?: string[]
        targetAudienceRefinement?: string | null
        strategicNotesAddition?: string
      }
    }

    try {
      parsed = JSON.parse(raw)
    } catch {
      await refundDeductedCredits(user.id, creditResult, 'AI returned invalid JSON')
      return NextResponse.json({ error: 'AI returned invalid JSON' }, { status: 500 })
    }

    // Save learnings to pack
    await db.paidCampaignPack.update({
      where: { campaignId: params.id },
      data: {
        learnings: parsed.learnings ?? {},
        brandBrainUpdated: false,
      },
    })

    // Apply updates to Brand Brain only when metrics are analytics-backed.
    let brandBrainUpdated = false
    const updates = parsed.brandBrainUpdates
    if (updates && brandProfile && signalTruth.canUpdateBrandBrain) {
      const existingHooks: string[] = brandProfile.winningHooks ?? []
      const existingFailed: string[] = brandProfile.failedAngles ?? []
      const existingStrategic = brandProfile.strategicNotes ?? ''

      const newHooks = [...new Set([...existingHooks, ...(updates.hooksToReview ?? [])])]
      const newFailed = [...new Set([...existingFailed, ...(updates.anglesToReview ?? [])])]
      const newStrategic = updates.strategicNotesAddition
        ? `${existingStrategic}\n\n[${new Date().toLocaleDateString()}] ${updates.strategicNotesAddition}`.trim()
        : existingStrategic

      await db.brandProfile.update({
        where: { workspaceId: campaign.workspaceId },
        data: {
          winningHooks: newHooks.slice(0, 20), // cap at 20 to avoid bloat
          failedAngles: newFailed.slice(0, 20),
          ...(updates.topPlatformsUpdate?.length && { topPlatforms: updates.topPlatformsUpdate }),
          ...(updates.targetAudienceRefinement && { targetAudience: updates.targetAudienceRefinement }),
          strategicNotes: newStrategic,
        },
      })
      snapshotBrandMaturity(db, campaign.workspaceId).catch(() => null)

      await db.paidCampaignPack.update({
        where: { campaignId: params.id },
        data: {
          brandBrainUpdated: true,
          brandBrainUpdatedAt: new Date(),
        },
      })
      brandBrainUpdated = true
    }

    return NextResponse.json({
      learnings: parsed.learnings,
      brandBrainUpdated,
      brandBrainUpdates: parsed.brandBrainUpdates,
      signalLabel: signalTruth.label,
      analyticsBacked: signalTruth.canUpdateBrandBrain,
      success: true,
    })
  } catch (err) {
    console.error('[paid-pack/learn]', err)
    if (chargedUserId && chargedCredit) {
      await refundDeductedCredits(chargedUserId, chargedCredit, 'Paid metrics signal extraction failed')
    }
    return NextResponse.json({ error: 'Paid metrics signal extraction failed' }, { status: 500 })
  }
}
