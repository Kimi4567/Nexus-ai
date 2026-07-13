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
import { paidMetricsCompleteness } from '@/lib/paidMetrics'

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

function hasAttributionBreakdown(metrics: unknown): boolean {
  if (!metrics || typeof metrics !== 'object' || Array.isArray(metrics)) return false
  const record = metrics as Record<string, unknown>
  return ['byCreative', 'byAudience', 'byPlatform'].some((key) => {
    const value = record[key]
    if (Array.isArray(value)) return value.length > 0
    return Boolean(value && typeof value === 'object' && Object.keys(value as Record<string, unknown>).length > 0)
  })
}

function aggregateMetricsSignal(metrics: unknown) {
  const record = metrics && typeof metrics === 'object' && !Array.isArray(metrics)
    ? metrics as Record<string, unknown>
    : {}
  const observed = Object.entries(record)
    .filter(([, value]) => typeof value === 'number' && Number.isFinite(value))
    .map(([key, value]) => `${key}: ${value}`)

  return {
    executiveSummary: observed.length
      ? `Reported aggregate metrics: ${observed.join(', ')}. These totals do not identify which creative, audience, or platform caused the result.`
      : 'The saved metrics do not contain enough numeric campaign data for a reliable analysis.',
    measurementCompleteness: paidMetricsCompleteness(record),
    candidateHooks: [],
    audienceSignal: 'No audience-level attribution breakdown is available.',
    platformSignal: 'No platform-level attribution breakdown is available.',
    underperformingAngles: [],
    keyInsight: 'Aggregate campaign totals cannot establish creative, audience, or platform winners.',
    nextCampaignRecommendation: 'Collect provider-backed metrics split by creative, audience, or platform before updating Brand Brain.',
  }
}

export async function POST(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params
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
    const attributionReady = signalTruth.canUpdateBrandBrain && hasAttributionBreakdown(pack.metrics)

    if (!attributionReady) {
      const learnings = aggregateMetricsSignal(pack.metrics)
      await db.paidCampaignPack.update({
        where: { campaignId: params.id },
        data: { learnings, brandBrainUpdated: false },
      })
      const signalLabel = signalTruth.canUpdateBrandBrain
        ? 'Analytics-backed aggregate metrics saved; attribution breakdown is required for Brand Brain updates'
        : signalTruth.label

      return NextResponse.json({
        learnings,
        brandBrainUpdated: false,
        brandBrainUpdates: null,
        signalLabel,
        analyticsBacked: signalTruth.canUpdateBrandBrain,
        attributionReady: false,
        creditsUsed: 0,
        success: true,
      })
    }

    const systemPrompt = `You are a senior performance marketing analyst. Your job is to summarize paid campaign metrics as a review signal.

If the metrics source is manual, treat the output as a manually reported metrics signal pending review. Do not call it Brand Brain learning, a winner, best-performing, or analytics-backed proof.
Compare only values that are present in this campaign's supplied metrics. Do not use or invent industry benchmarks. Do not create a campaign score.

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
    "measurementCompleteness": "complete|partial|insufficient, based only on whether the supplied metrics can support the requested analysis",
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

    const safeLearnings = { ...(parsed.learnings ?? {}) }
    delete safeLearnings.campaignScore
    safeLearnings.measurementCompleteness = paidMetricsCompleteness(pack.metrics)

    // Save learnings to pack
    await db.paidCampaignPack.update({
      where: { campaignId: params.id },
      data: {
        learnings: safeLearnings,
        brandBrainUpdated: false,
      },
    })

    // Apply updates to Brand Brain only when metrics are analytics-backed.
    let brandBrainUpdated = false
    const updates = parsed.brandBrainUpdates
    if (updates && brandProfile && attributionReady) {
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
      learnings: safeLearnings,
      brandBrainUpdated,
      brandBrainUpdates: parsed.brandBrainUpdates,
      signalLabel: signalTruth.label,
      analyticsBacked: signalTruth.canUpdateBrandBrain,
      attributionReady,
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
