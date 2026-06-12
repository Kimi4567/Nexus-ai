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
    const err = await response.text().catch(() => '')
    console.error('[OpenAI] API error:', response.status, err.slice(0, 300))
    throw new Error(`OpenAI API error: ${response.status}`)
  }

  const data = await response.json()
  const choice = data?.choices?.[0]
  const content = choice?.message?.content
  const finishReason = choice?.finish_reason
  if (!content) throw new Error('OpenAI returned empty response')

  if (jsonMode) {
    // 1. Direct parse (happy path)
    try { return JSON.parse(content) } catch {}

    // 2. Strip markdown code fences and retry (model sometimes wraps JSON despite json_object mode)
    const stripped = content
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```\s*$/i, '')
      .trim()
    try { return JSON.parse(stripped) } catch {}

    // 3. Extract first {...} block from the content
    const match = content.match(/\{[\s\S]*\}/)
    if (match) { try { return JSON.parse(match[0]) } catch {} }

    // Truncation is the most common real-world cause: the model hit max_tokens
    // and the JSON was cut off mid-structure. Surface it CLEARLY so logs explain
    // the cause (and the fix) instead of a generic "invalid JSON".
    if (finishReason === 'length') {
      console.error(`[OpenAI] Response truncated — hit max_tokens=${maxTokens} (finish_reason=length). Increase max_tokens. Head:`, content.slice(0, 200))
      throw new Error(`OpenAI response truncated at max_tokens=${maxTokens} — output incomplete`)
    }
    console.error(`[OpenAI] JSON parse failed after all attempts (finish_reason=${finishReason}):`, content.slice(0, 300))
    throw new Error('OpenAI returned invalid JSON')
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

  const user = `Create a focused marketing strategy. Return ONLY this JSON (no extra keys, keep values SHORT):

{
  "overview": "2 sentences max",
  "audience": "1 sentence",
  "valueProps": ["3 items, 8 words each max"],
  "angles": ["4 angles, 10 words each max"],
  "platformRecommendations": { "PLATFORM": "1 sentence per platform" },
  "ctaStrategies": ["2 CTAs, 8 words each max"]
}

CAMPAIGN: ${campaign.name} | Goal: ${campaign.goal} | Tone: ${campaign.tone}
Audience: ${campaign.audience || 'General'}
Platforms: ${(campaign.platforms || []).join(', ')}
${campaign.description ? `Description: ${campaign.description}` : ''}
${campaign.brandProfile?.brandName ? `Brand: ${campaign.brandProfile.brandName}` : ''}
${platformGuides ? `Platform context:\n${platformGuides}` : ''}
${campaign.pastLearnings ? `\n${campaign.pastLearnings}` : ''}

Be specific and concise. Real copy, not generic placeholders.
${getLanguageInstruction(campaign.language)}`

  // Arabic JSON output is token-heavy; 1500 leaves headroom so the strategy
  // JSON is never truncated mid-structure (the real cause of engine failures).
  return callOpenAI(system, user, true, 1500)
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

  const user = `Generate exactly 3 unique ad concepts. Return JSON: { "concepts": [ ...3 items... ] }

Each concept:
{
  "name": "short catchy name",
  "angle": "Pattern Interrupt | Social Proof | Problem/Solution | Curiosity Gap | FOMO | Transformation",
  "hook": "scroll-stopping opening line, platform-native, ultra-specific (not generic)",
  "script": "40-60 word platform-native ad script covering hook, problem, solution, CTA",
  "cta": "specific action CTA",
  "headlines": ["headline 1", "headline 2"],
  "captions": ["ready-to-post caption with hashtags"],
  "platform": "ONE of: ${platforms.join(' | ')}",
  "format": "Video/Carousel/Static/Reel"
}

CAMPAIGN: ${campaign.name} | Goal: ${campaign.goal} | Audience: ${campaign.audience || 'General'} | Tone: ${campaign.tone}
Platforms: ${platforms.join(', ')}
${campaign.description ? `Description: ${campaign.description}` : ''}
${campaign.brandProfile ? `Brand: ${campaign.brandProfile.brandName || ''} | Avoid: ${(campaign.brandProfile.avoidKeywords || []).join(', ')}` : ''}
${platformGuides ? `Platform guides:\n${platformGuides}` : ''}

3 concepts, 3 different angles. Write real copy, not descriptions.
CRITICAL: ${getLanguageInstruction(campaign.language)}`

  // 3 full Arabic concepts (hook + 40-60 word script + headlines + captions) are
  // the heaviest output here; 3000 prevents mid-JSON truncation under max_tokens.
  const result = await callOpenAI(system, user, true, 3000)
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
