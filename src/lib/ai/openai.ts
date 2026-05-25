/**
 * NEXUS AI — Real OpenAI Integration
 * Model: gpt-4o-mini (fast, cheap, high quality)
 * Uses JSON mode for reliable structured output
 */

const MODEL = 'gpt-4o-mini'

async function callOpenAI(
  systemPrompt: string,
  userPrompt: string,
  jsonMode = true,
  maxTokens = 4000
): Promise<any> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.85,
      max_tokens: maxTokens,
      ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    console.error('[OpenAI] API error:', response.status, err)
    throw new Error(`OpenAI API error: ${response.status}`)
  }

  const data = await response.json()
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error('OpenAI returned empty response')

  if (jsonMode) {
    try {
      return JSON.parse(content)
    } catch {
      console.error('[OpenAI] JSON parse failed:', content)
      throw new Error('OpenAI returned invalid JSON')
    }
  }
  return content
}

// ─────────────────────────────────────────────
// MARKETING STRATEGY
// ─────────────────────────────────────────────
export async function generateMarketingStrategy(campaign: any, project: any): Promise<any> {
  const system = `You are a world-class marketing strategist and brand consultant with 15+ years of experience
helping startups and growth-stage companies. You create clear, actionable, data-driven marketing strategies.
Always respond with valid JSON only.`

  const user = `Create a complete marketing strategy for this campaign. Return a JSON object with EXACTLY these keys:

{
  "overview": "2-3 sentence executive summary of the campaign strategy",
  "positioning": "how to position the product/service in the market",
  "audience": "detailed description of the target audience with psychographics",
  "valueProps": ["value prop 1", "value prop 2", "value prop 3", "value prop 4"],
  "contentPillars": ["pillar 1", "pillar 2", "pillar 3", "pillar 4"],
  "angles": ["content angle 1", "content angle 2", "content angle 3", "content angle 4", "content angle 5"],
  "platformRecommendations": {
    "PLATFORM_NAME": "specific strategy and content type for this platform"
  },
  "contentCalendar": [
    {
      "week": "Week 1",
      "posts": [
        { "day": "Monday", "platform": "PLATFORM", "type": "Content Type", "topic": "Post topic", "format": "Video/Image/Carousel" }
      ]
    }
  ],
  "metrics": {
    "impressions": "target number",
    "engagement": "target %",
    "clicks": "target number",
    "conversions": "target number",
    "roi": "target %"
  },
  "ctaStrategies": ["CTA 1", "CTA 2", "CTA 3", "CTA 4"],
  "risks": ["risk 1", "risk 2"]
}

CAMPAIGN DATA:
- Name: ${campaign.name}
- Goal: ${campaign.goal}
- Audience: ${campaign.audience || 'Not specified'}
- Tone: ${campaign.tone}
- Platforms: ${(campaign.platforms || []).join(', ')}
- Description: ${campaign.description || 'Not provided'}
${campaign.brandProfile ? `
BRAND MEMORY (use this to stay on-brand):
- Brand: ${campaign.brandProfile.brandName || 'Unknown'}
- Industry: ${campaign.brandProfile.industry || 'Unknown'}
- Brand Description: ${campaign.brandProfile.description || ''}
- Tone Keywords: ${(campaign.brandProfile.toneKeywords || []).join(', ')}
- Avoid: ${(campaign.brandProfile.avoidKeywords || []).join(', ')}
- Writing Style: ${campaign.brandProfile.writingStyle || ''}
- Target Audience: ${campaign.brandProfile.targetAudience || ''}
- Primary Offer: ${campaign.brandProfile.primaryOffer || ''}
- Unique Advantages: ${(campaign.brandProfile.uniqueAdvantages || []).join(', ')}
- Winning Hooks: ${(campaign.brandProfile.winningHooks || []).join(', ')}
- Winning Angles: ${(campaign.brandProfile.winningAngles || []).join(', ')}
- Strategic Notes: ${campaign.brandProfile.strategicNotes || ''}
` : ''}
Generate the contentCalendar for 4 weeks with 7 posts per week spread across the platforms: ${(campaign.platforms || ['INSTAGRAM']).join(', ')}.
Make all recommendations specific to the campaign details above. Be concrete and actionable.`

  return callOpenAI(system, user, true, 4000)
}

// ─────────────────────────────────────────────
// AD CONCEPTS
// ─────────────────────────────────────────────
export async function generateAdConcepts(campaign: any, project: any): Promise<any[]> {
  const system = `You are a top-tier creative director who has produced award-winning ad campaigns for major brands.
You create scroll-stopping concepts with precise hooks, compelling scripts, and platform-native content.
Always respond with valid JSON only.`

  const platforms = campaign.platforms || ['INSTAGRAM']

  const user = `Generate exactly 5 unique ad concepts for this campaign. Return a JSON object with a "concepts" array containing exactly 5 items.

Each concept must have EXACTLY this structure:
{
  "name": "catchy concept name",
  "description": "1-2 sentence description of the concept approach",
  "angle": "the main creative angle (e.g. 'Social Proof', 'Problem/Solution', 'Curiosity', 'FOMO', 'Authority')",
  "hook": "the opening line that stops the scroll — first 3 seconds of the ad",
  "script": "full 30-60 second video script with [HOOK], [PROBLEM], [SOLUTION], [PROOF], [CTA] sections",
  "cta": "the specific call to action",
  "headlines": ["headline variant 1", "headline variant 2", "headline variant 3"],
  "captions": ["platform-optimized caption with hashtags"],
  "platform": "ONE of: ${platforms.join(' | ')}",
  "format": "Video/Carousel/Static/Story/Reel",
  "estimatedReach": "estimated reach range (e.g. '10K-50K')"
}

CAMPAIGN:
- Name: ${campaign.name}
- Goal: ${campaign.goal}
- Audience: ${campaign.audience || 'General audience'}
- Tone: ${campaign.tone}
- Platforms: ${platforms.join(', ')}
- Description: ${campaign.description || 'Not provided'}
${campaign.brandProfile ? `
BRAND VOICE (strictly follow this):
- Brand: ${campaign.brandProfile.brandName || ''}
- Tone: ${(campaign.brandProfile.toneKeywords || []).join(', ')}
- Avoid: ${(campaign.brandProfile.avoidKeywords || []).join(', ')}
- Writing Style: ${campaign.brandProfile.writingStyle || ''}
- Winning Hooks to build on: ${(campaign.brandProfile.winningHooks || []).join(' | ')}
- Winning Angles to use: ${(campaign.brandProfile.winningAngles || []).join(' | ')}
` : ''}
Make each concept use a different creative angle. Write scripts that are actually compelling and specific to this campaign — not generic templates. The tone must be ${campaign.tone.toLowerCase()}.

Return: { "concepts": [ ...5 concepts... ] }`

  const result = await callOpenAI(system, user, true, 4000)
  // Handle both { concepts: [] } and direct array
  if (Array.isArray(result)) return result
  if (result?.concepts) return result.concepts
  return []
}

// ─────────────────────────────────────────────
// BASIC HELPERS (used by other parts of the app)
// ─────────────────────────────────────────────
export async function callOpenAI_raw(prompt: string): Promise<any> {
  return callOpenAI(
    'You are an expert marketing strategist and creative director.',
    prompt,
    false,
    2000
  )
}

export { callOpenAI_raw as callOpenAI }

export async function generateScript(briefing: string): Promise<string> {
  const system = `You are an expert video scriptwriter specializing in short-form social media ads.`
  const user = `Write a compelling 30-60 second video ad script for:

${briefing}

Structure:
[HOOK - first 3 seconds, stops the scroll]
[PROBLEM - identify the pain point]
[SOLUTION - introduce the product/service]
[PROOF - social proof or results]
[CTA - clear call to action]

Return only the script text, no JSON.`

  return callOpenAI(system, user, false, 800)
}

export async function generateCaptions(script: string, platform: string): Promise<string[]> {
  const system = `You are a social media copywriter who writes viral, platform-native captions.`
  const user = `Generate 3 caption variations for ${platform} based on this script:

${script}

Each caption must:
- Be optimized for ${platform}'s algorithm and character limits
- Include relevant hashtags
- Have a clear CTA
- Match the platform's native tone

Return JSON: { "captions": ["caption 1", "caption 2", "caption 3"] }`

  const result = await callOpenAI(system, user, true, 800)
  return result?.captions || []
}
