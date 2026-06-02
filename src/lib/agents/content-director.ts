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
import { BANNED_PHRASES, SPECIFICITY_RULES, CONTENT_QUALITY_RULES } from '@/lib/ai/promptRules'

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
      temperature: 0.65,  // Reduced: was 0.85 — more consistent, less random filler
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

You are NEXUS Content Director — a senior social media strategist who creates content calendars for specific brands.
Your output must feel like it was written by someone who spent a week studying this brand, its audience, and its competitors.

${BANNED_PHRASES}

${SPECIFICITY_RULES}

${CONTENT_QUALITY_RULES}

ADDITIONAL CONTENT RULES:
- Every hook must either: (a) name a specific pain point, (b) challenge a belief the audience holds, or (c) promise a specific outcome with a timeframe or number.
- Never start a hook with "Discover", "Unlock", "Transform", "Introducing", "Are you ready", or any AI cliché opener.
- Every caption must open with the hook, deliver ONE specific insight, and end with ONE specific CTA.
- Content pillars must be tied to the brand's real offer and audience — not generic "education / inspiration / promotion."
- Scripts must follow Problem → Agitate → Solution structure. Scene 1 = viewer's specific pain. NOT "Hi I'm [brand]."
- Caption formulas must have [brackets] for variable parts so they are reusable templates.

Return ONLY valid JSON. No markdown outside the JSON.`

  const userPrompt = `
━━━ BRAND ━━━
Name: ${input.brandName}
Tone Keywords: ${input.brandTone.join(', ')}
Writing Style: ${input.writingStyle || 'direct and punchy'}
Words/Phrases to NEVER use: ${input.avoidKeywords?.join(', ') || 'none specified'}
${input.region ? `Market / Region: ${input.region}` : ''}
${input.competitors ? `Competitors to differentiate from: ${input.competitors}` : ''}
${input.painPoints?.length ? `Audience Pain Points — address these directly in hooks:\n${input.painPoints.map(p => `  • ${p}`).join('\n')}` : ''}
${input.winningHooks?.length ? `Previously winning hooks (match this exact energy and style):\n${input.winningHooks.map(h => `  → "${h}"`).join('\n')}` : ''}

━━━ CAMPAIGN STRATEGY ━━━
Goal: ${input.strategy.goal}
Key Message: ${input.strategy.keyMessage || input.strategy.positioning}
Positioning: ${input.strategy.positioning}
Differentiation: ${(input.strategy as any).differentiation || 'Not specified'}
Target Audience: ${input.strategy.targetAudienceRefined}
Content Pillars from Strategy: ${input.strategy.contentPillars.join(' | ')}
Channels: ${input.strategy.channelMix.map((c: { platform: string; contentFrequency: string }) => `${c.platform} (${c.contentFrequency})`).join(', ')}
${(input.strategy as any).topHooks?.length ? `Strategy Hooks to build on:\n${((input.strategy as any).topHooks as string[]).slice(0, 5).map((h: string) => `  → "${h}"`).join('\n')}` : ''}
${(input.strategy as any).contentAngles?.length ? `Content Angles from Strategy:\n${((input.strategy as any).contentAngles as string[]).slice(0, 6).map((a: string) => `  • ${a}`).join('\n')}` : ''}

━━━ PRE-GENERATION CHECKLIST (internal — do not output) ━━━
Before writing any hook, ask: "Would a competitor of ${input.brandName} write this exact hook?" If yes, rewrite it.
Before writing any caption, ask: "Does this caption reference a specific pain from the list above?" If no, rewrite it.
Before writing any CTA, ask: "Is this CTA specific enough that someone knows exactly what they're clicking?" If no, make it specific.

━━━ GENERATE 4-WEEK CONTENT CALENDAR ━━━
For each post: hook ≤ 10 words (scroll-stopping), caption 60-130 words (specific, value-first), 5-8 hashtags (mix niche + medium), visualNote (describe exact shot/scene).

Return JSON with exactly these fields:
{
  "contentPillars": ["string — 4-6 pillars, each tied directly to ${input.brandName}'s offer and audience pain"],
  "calendar": [
    {
      "week": 1,
      "theme": "string — specific week theme tied to campaign goal",
      "posts": [
        {
          "day": "string — e.g. Monday",
          "week": 1,
          "platform": "string",
          "type": "string — Reel / Carousel / Static / Story / Video",
          "contentPillar": "string — which pillar this post belongs to",
          "hook": "string — ≤10 words, scroll-stopping, brand-specific, no clichés",
          "caption": "string — 60-130 words, opens with hook, one insight, one CTA",
          "cta": "string — specific action (not 'click link in bio')",
          "hashtags": ["string — 5-8 targeted hashtags"],
          "visualNote": "string — describe exact scene, shot angle, what to show",
          "format": "string — aspect ratio and frame"
        }
      ]
    }
  ],
  "topHooks": ["string — 8+ best hooks for ${input.brandName}, each addressing a different pain point"],
  "ctaVariations": ["string — 6 specific, action-oriented CTAs tailored to ${input.brandName}'s conversion goal"],
  "scriptTemplate": "string — full 8-12 line Reel/TikTok script for ${input.brandName}. Scene 1 = viewer pain. Use Problem-Agitate-Solve. Include scene directions in [brackets].",
  "captionFormulas": [
    "string — reusable template with [brackets]: e.g., 'لو كنت [situation], جرّب [specific action] وشوف كيف [specific result] — [CTA]'",
    "string — second formula",
    "string — third formula"
  ]
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
