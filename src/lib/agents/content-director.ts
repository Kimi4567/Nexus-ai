/**
 * AGENT 2 — Content Director
 *
 * Responsibilities:
 * - Generate content ideas based on strategy
 * - Create captions, hooks, scripts
 * - Build a 4-week content calendar
 */

import { StrategyOutput } from './strategist'
import { getLanguageInstruction } from '@/lib/ai/langHelper'
import { checkAndLog } from '@/lib/outputGuardrails'

async function callOpenAI(systemPrompt: string, userPrompt: string, maxTokens = 3000): Promise<any> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.85,
      max_tokens: maxTokens,
      response_format: { type: 'json_object' },
    }),
  })
  if (!response.ok) throw new Error(`OpenAI error: ${response.status}`)
  const data = await response.json()
  const content = data.choices?.[0]?.message?.content || '{}'
  return JSON.parse(content)
}

export interface ContentDirectorInput {
  strategy: StrategyOutput
  brandName: string
  brandTone: string[]
  avoidKeywords?: string[]
  writingStyle?: string
  existingCaptions?: string[]
  competitors?: string
  region?: string
  painPoints?: string[]
  winningHooks?: string[]
  // Language preference: 'ar' | 'en' | 'bilingual'
  language?: string
}

export interface ContentPost {
  day: string
  week: number
  platform: string
  type: string
  contentPillar: string
  hook: string
  caption: string
  cta: string
  hashtags: string[]
  visualNote: string
  format: string
}

export interface ContentCalendarWeek {
  week: number
  theme: string
  posts: ContentPost[]
}

export interface ContentDirectorOutput {
  contentPillars: string[]
  calendar: ContentCalendarWeek[]
  topHooks: string[]
  ctaVariations: string[]
  scriptTemplate: string
  captionFormulas: string[]
}

export async function runContentDirectorAgent(
  input: ContentDirectorInput
): Promise<ContentDirectorOutput> {
  const langInstruction = getLanguageInstruction(input.language)
  const systemPrompt = `${langInstruction}

You are a world-class social media content director.
You create viral, high-converting content calendars for specific brands.
CRITICAL: Write content specific to THIS brand. No generic templates.
Every hook must be scroll-stopping and brand-specific. Every caption must drive action for THIS audience.
If winning hooks are provided, match that energy and style.
Return ONLY valid JSON. No markdown outside the JSON.`

  const userPrompt = `
Brand: ${input.brandName}
Tone: ${input.brandTone.join(', ')}
Writing Style: ${input.writingStyle || 'direct and punchy'}
Avoid: ${input.avoidKeywords?.join(', ') || 'nothing specific'}
${input.region ? `Market / Region: ${input.region}` : ''}
${input.competitors ? `Key Competitors (differentiate content): ${input.competitors}` : ''}
${input.painPoints?.length ? `Audience Pain Points (address in hooks): ${input.painPoints.join(', ')}` : ''}
${input.winningHooks?.length ? `Winning Hook Style (match this energy): ${input.winningHooks.join(' | ')}` : ''}

Campaign Strategy:
- Goal: ${input.strategy.goal}
- Key Message: ${input.strategy.keyMessage || input.strategy.positioning}
- Positioning: ${input.strategy.positioning}
- Target Audience: ${input.strategy.targetAudienceRefined}
- Content Pillars: ${input.strategy.contentPillars.join(', ')}
- Channels: ${input.strategy.channelMix.map((c: { platform: string; contentFrequency: string }) => `${c.platform} (${c.contentFrequency})`).join(', ')}

Create a 4-week content calendar. For each post: hook under 10 words, caption 50-120 words, 5-8 hashtags.

Return JSON:
{
  "contentPillars": string[],
  "calendar": [{ "week": number, "theme": string, "posts": [{ "day": string, "week": number, "platform": string, "type": string, "contentPillar": string, "hook": string, "caption": string, "cta": string, "hashtags": string[], "visualNote": string, "format": string }] }],
  "topHooks": string[],
  "ctaVariations": string[],
  "scriptTemplate": string,
  "captionFormulas": string[]
}`

  const output = await callOpenAI(systemPrompt, userPrompt) as ContentDirectorOutput
  checkAndLog('content-director', JSON.stringify(output), {
    brandName: input.brandName,
    targetAudience: input.strategy.targetAudienceRefined,
  })
  return output
}

export async function refreshContentWeek(
  input: ContentDirectorInput,
  weekNumber: number,
  reason: string
): Promise<ContentCalendarWeek> {
  const systemPrompt = `You are a content director refreshing week ${weekNumber} of a campaign because: ${reason}.
Create fresh content completely different from before but on-brand.
Return ONLY valid JSON for a single ContentCalendarWeek.`

  const userPrompt = `
Brand: ${input.brandName}, Tone: ${input.brandTone.join(', ')}
Goal: ${input.strategy.goal}, Positioning: ${input.strategy.positioning}
Channels: ${input.strategy.channelMix.map((c: { platform: string }) => c.platform).join(', ')}
${input.existingCaptions?.length ? `Already used (avoid similarity):\n${input.existingCaptions.slice(0, 3).join('\n')}` : ''}

Return JSON: { "week": ${weekNumber}, "theme": string, "posts": [...] }`

  return callOpenAI(systemPrompt, userPrompt, 1500) as Promise<ContentCalendarWeek>
}
