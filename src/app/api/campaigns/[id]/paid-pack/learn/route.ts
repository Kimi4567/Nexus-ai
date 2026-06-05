/**
 * POST /api/campaigns/[id]/paid-pack/learn
 *
 * AI analyzes the campaign metrics + copy variants + audience brief
 * and extracts structured learnings, then auto-updates Brand Brain:
 *   - winningHooks   ← highest CTR copy angles
 *   - targetAudience ← refined audience description
 *   - topPlatforms   ← platform with best ROAS
 *   - failedAngles   ← lowest performing angles
 *   - strategicNotes ← AI executive summary
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/apiAuth'
import { checkAndDeductCredits } from '@/lib/credits'

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

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const creditResult = await checkAndDeductCredits(user.id, 'AD_COPY')
    if (!creditResult.ok) {
      return NextResponse.json({ error: 'Insufficient credits', upgradeRequired: true }, { status: 402 })
    }
    await checkAndDeductCredits(user.id, 'AD_COPY')

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

    const systemPrompt = `You are a senior performance marketing analyst. Your job is to extract actionable learnings from a completed paid campaign and structure them so they can update a brand's strategic memory (Brand Brain).

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
- Current Winning Hooks: ${JSON.stringify((brandProfile?.winningHooks ?? []).slice(0, 3))}
- Current Target Audience: ${brandProfile?.targetAudience ?? 'Not set'}
- Current Top Platforms: ${JSON.stringify(brandProfile?.topPlatforms ?? [])}
- Current Failed Angles: ${JSON.stringify((brandProfile?.failedAngles ?? []).slice(0, 3))}

Extract learnings as JSON:
{
  "learnings": {
    "executiveSummary": "2-3 sentence plain-language summary of what worked, what didn't, and the #1 insight",
    "campaignScore": "1-10 rating based on industry benchmarks",
    "winningHooks": ["exact hooks / angles that performed best — use actual copy from the variants"],
    "winningAudience": "refined description of the audience that responded best based on the data",
    "bestPlatform": "platform name that delivered best ROAS or CTR",
    "failedAngles": ["copy angles or targeting that underperformed"],
    "keyInsight": "the single most important thing this campaign revealed about the audience",
    "nextCampaignRecommendation": "specific actionable recommendation for the next campaign"
  },
  "brandBrainUpdates": {
    "winningHooksToAdd": ["new hooks to add — only if CTR was above 2% or conversions were strong"],
    "failedAnglesToAdd": ["angles to avoid in future"],
    "topPlatformsUpdate": ["ordered list of platforms from best to worst ROAS — replace current"],
    "targetAudienceRefinement": "updated audience description incorporating learnings (or null if no change)",
    "strategicNotesAddition": "1-2 sentence addition to strategic notes about this campaign's learnings"
  }
}`

    const raw = await callGPT(systemPrompt, userPrompt)
    let parsed: {
      learnings?: Record<string, unknown>
      brandBrainUpdates?: {
        winningHooksToAdd?: string[]
        failedAnglesToAdd?: string[]
        topPlatformsUpdate?: string[]
        targetAudienceRefinement?: string | null
        strategicNotesAddition?: string
      }
    }

    try {
      parsed = JSON.parse(raw)
    } catch {
      return NextResponse.json({ error: 'AI returned invalid JSON' }, { status: 500 })
    }

    // Save learnings to pack
    await db.paidCampaignPack.update({
      where: { campaignId: params.id },
      data: {
        learnings: parsed.learnings ?? {},
        brandBrainUpdated: false, // will be true after updates below
      },
    })

    // Apply updates to Brand Brain
    let brandBrainUpdated = false
    const updates = parsed.brandBrainUpdates
    if (updates && brandProfile) {
      const existingHooks: string[] = brandProfile.winningHooks ?? []
      const existingFailed: string[] = brandProfile.failedAngles ?? []
      const existingStrategic = brandProfile.strategicNotes ?? ''

      const newHooks = [...new Set([...existingHooks, ...(updates.winningHooksToAdd ?? [])])]
      const newFailed = [...new Set([...existingFailed, ...(updates.failedAnglesToAdd ?? [])])]
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
      success: true,
    })
  } catch (err) {
    console.error('[paid-pack/learn]', err)
    return NextResponse.json({ error: 'Learning extraction failed' }, { status: 500 })
  }
}
