/**
 * NEXUS AI — Real OpenAI Integration
 * Model: gpt-4o-mini (fast, cheap, high quality)
 * Uses JSON mode for reliable structured output
 */

import { getLanguageInstruction } from './langHelper'

const MODEL = 'gpt-4o-mini'

// Platform-native tone guides injected into prompts
const PLATFORM_GUIDES: Record<string, string> = {
  TIKTOK: 'TikTok: أسلوب غير رسمي وجذاب، تنسيق POV أو "يوم في حياتي"، الهوك يجب أن يضرب خلال 0-3 ثوانٍ، لغة شبابية، لا رسمية مبالغة.',
  INSTAGRAM: 'Instagram: سرد بصري وإلهامي، هوك الـ Reels في أقل من 3 ثوانٍ، كابشن يستحق الحفظ، محتوى مجتمعي.',
  FACEBOOK: 'Facebook: تنسيق مشكلة/حل، كابشن أطول مقبول، الـ carousel يؤدي جيداً، جمهور 30-55 سنة، إشارات الثقة والمصداقية.',
  YOUTUBE_SHORTS: 'YouTube Shorts: قيمة فورية في الثانية الأولى، محتوى تعليمي أو ترفيهي، هوك شفهي وبصري قوي، CTA واضح في النهاية.',
  LINKEDIN: 'LinkedIn: رؤى مهنية، قيادة فكرية، سرد أطول مقبول، زاوية السلطة والمصداقية، عقلية B2B.',
  SNAPCHAT: 'Snapchat: أصيل وسريع، مدفوع بـ FOMO، أسلوب غير مصقول يبدو حقيقياً، أقل من 10 ثوانٍ مثالياً.',
  Google: 'Google Ads: إعلانات بحث مختصرة وقوية، عنوان جذاب، وصف يحتوي على الكلمة المفتاحية وميزة واضحة.',
  Snapchat: 'Snapchat: محتوى سريع وشبابي، استهداف جمهور الخليج، أسلوب عفوي وحقيقي.',
}

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
  const langInstruction = getLanguageInstruction(campaign.language)
  const platformGuides = (campaign.platforms || [])
    .map((p: string) => PLATFORM_GUIDES[p])
    .filter(Boolean)
    .join('\n')

  const system = `You are a world-class marketing strategist and brand consultant specializing in the MENA (Middle East & North Africa) market, with 15+ years of experience helping Arab startups and growth-stage companies build category-defining brands. You create clear, actionable, platform-native marketing strategies with specific copy examples, not generic frameworks.
${langInstruction}
Always respond with valid JSON only.`

  const user = `Create a complete marketing strategy for this campaign. Return a JSON object with EXACTLY these keys:

{
  "overview": "2-3 sentence executive summary of the campaign strategy",
  "positioning": "how to position the product/service in the market",
  "audience": "a single plain string describing the target audience including demographics and psychographics (NOT a nested object)",
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
        { "day": "Monday", "platform": "PLATFORM", "type": "Content Type", "topic": "Post topic", "format": "Video/Image/Carousel", "caption": "Ready-to-post caption draft with hashtags" }
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
PLATFORM-SPECIFIC GUIDES (apply these):
${platformGuides || 'Create platform-native content appropriate to each platform.'}

Generate the contentCalendar for 4 weeks with 5-7 posts per week spread across the platforms: ${(campaign.platforms || ['INSTAGRAM']).join(', ')}.
For each calendar post, include a "caption" field with a ready-to-post caption draft (including relevant hashtags for social platforms).
Make ALL recommendations hyper-specific to this campaign — use real copy examples, not placeholders.
Every value prop, CTA, and hook should name the actual product/service and audience.
REMINDER: ${getLanguageInstruction(campaign.language)}`

  return callOpenAI(system, user, true, 4096)
}

// ─────────────────────────────────────────────
// AD CONCEPTS
// ─────────────────────────────────────────────
export async function generateAdConcepts(campaign: any, project: any): Promise<any[]> {
  const langInstruction = getLanguageInstruction(campaign.language)
  const platforms = campaign.platforms || ['INSTAGRAM']

  const platformGuides = platforms
    .map((p: string) => PLATFORM_GUIDES[p])
    .filter(Boolean)
    .join('\n')

  const system = `You are a top-tier creative director who has produced award-winning ad campaigns for major MENA brands.
You write platform-native scripts — a TikTok script sounds nothing like a LinkedIn post.
You use proven copywriting techniques: pattern interrupts, open loops, social proof, specificity, FOMO — adapted for MENA audiences.
Your hooks are tested, specific, and platform-native — not generic.
${langInstruction}
Always respond with valid JSON only.`

  const user = `Generate exactly 5 unique ad concepts for this campaign. Return a JSON object with a "concepts" array containing exactly 5 items.

RULES:
- Each of the 5 concepts must use a DIFFERENT creative angle from this list: Pattern Interrupt, Social Proof, Problem/Agitation/Solution, Curiosity Gap, FOMO/Urgency, Authority/Credibility, Transformation Story, Objection Killer
- Scripts must be platform-native — a TikTok script has a completely different voice/structure than LinkedIn
- Hooks must be ultra-specific to this product/audience — never generic
- Write actual copy, not descriptions of what copy would say

Each concept must have EXACTLY this structure:
{
  "name": "catchy concept name",
  "description": "1-2 sentence description of the concept approach",
  "angle": "the creative angle used (e.g. 'Social Proof', 'Pattern Interrupt', 'Curiosity Gap')",
  "hook": "the opening line that stops the scroll — specific, provocative, platform-native. First 0-3 seconds.",
  "script": "complete platform-native script: [HOOK - 0-3s] ... [PROBLEM] ... [SOLUTION] ... [PROOF/CREDIBILITY] ... [CTA]. For TikTok: casual, fast, punchy. For LinkedIn: insight-led, professional. For Instagram: visual storytelling. 80-120 words total.",
  "cta": "specific, action-driven call-to-action (not 'click the link')",
  "headlines": ["attention headline", "benefit-focused headline", "curiosity/FOMO headline"],
  "captions": ["full platform-native caption with relevant hashtags — ready to post"],
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
PLATFORM GUIDES:
${platformGuides || 'Adapt tone and format to each platform naturally.'}

The overall campaign tone is ${campaign.tone.toLowerCase()}. All 5 concepts must feel distinctly different — different angle, different emotional trigger, different platform if possible.
CRITICAL: ${getLanguageInstruction(campaign.language)}

Return: { "concepts": [ ...exactly 5 concepts... ] }`

  const result = await callOpenAI(system, user, true, 4096)
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
