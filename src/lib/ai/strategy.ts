import { prisma } from '@/lib/prisma'
import * as ai from './adapter'

/**
 * Generate comprehensive marketing strategy using Claude/GPT
 */
export async function generateMarketingStrategy(
  campaign: any,
  project: any
) {
  try {
    const businessInfo = project.businessInfo as any
    const mediaDescriptions = project.media
      .map((m: any) => `- ${m.category || 'Media'}: ${m.fileName}`)
      .join('\n')

    const prompt = `You are an expert marketing strategist with 20+ years of experience at leading agencies.

Analyze this business and create a comprehensive marketing strategy:

BUSINESS TYPE: ${project.businessType}
BUSINESS INFO: ${JSON.stringify(businessInfo, null, 2)}

CAMPAIGN GOAL: ${campaign.goal}
TARGET AUDIENCE: ${campaign.audience}
BRAND TONE: ${campaign.tone}
PLATFORMS: ${campaign.platforms.join(', ')}

AVAILABLE ASSETS:
${mediaDescriptions}

Generate a detailed marketing strategy that includes:
1. Campaign overview and key insight
2. Target audience deep dive
3. Key value propositions to emphasize
4. Recommended content angles and hooks
5. Platform-specific recommendations
6. Success metrics
7. Content pillars (5-7 pillars)
8. Competitive positioning
9. Call-to-action strategies
10. Potential risks and mitigation

Format as JSON with these keys: overview, audience, valueProps, angles, platformRecommendations, metrics, contentPillars, positioning, ctaStrategies, risks`

    const strategy = await ai.generateMarketingStrategy(campaign as any, project as any)

    await prisma.campaign.update({
      where: { id: campaign.id },
      data: {
        strategy,
      },
    })

    console.log(`✓ Strategy generated for campaign ${campaign.id}`)
  } catch (error) {
    console.error('Strategy generation failed:', error)
  }
}

export async function generateAdConcepts(
  campaign: any,
  project: any
) {
  try {
    const businessInfo = project.businessInfo as any

    const prompt = `You are a creative director at a top-tier ad agency.

Create 5 distinct ad concepts for this campaign:

BUSINESS: ${JSON.stringify(businessInfo)}
GOAL: ${campaign.goal}
TONE: ${campaign.tone}
AUDIENCE: ${campaign.audience}

For each concept, generate:
- name (catchy)
- description
- angle (the unique hook)
- script (30-60 seconds for video)
- cta (call-to-action)
- headlines (3 variations)
- captions (platform-specific)

Format as JSON array of objects with these keys: name, description, angle, script, cta, headlines, captions`

    const concepts = await ai.generateAdConcepts(campaign as any, project as any)
    const parsed = typeof concepts === 'string' ? JSON.parse(concepts) : concepts

    for (const concept of parsed) {
      await prisma.adConcept.create({
        data: {
          campaignId: campaign.id,
          name: concept.name,
          description: concept.description,
          angle: concept.angle,
          script: concept.script,
          cta: concept.cta,
          headlines: concept.headlines,
          captions: concept.captions,
        },
      })
    }

    console.log(`✓ ${parsed.length} ad concepts created for campaign ${campaign.id}`)
  } catch (error) {
    console.error('Ad concepts generation failed:', error)
  }
}
