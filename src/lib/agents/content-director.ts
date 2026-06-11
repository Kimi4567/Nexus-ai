/**
 * AGENT 2 — Content Director
 *
 * Responsibilities:
 * - Generate content ideas based on strategy
 * - Create captions, hooks, scripts
 * - Build a 4-week content calendar
 *
 * Model: gpt-4o (NOT gpt-4o-mini — full reasoning quality for strategy-level output)
 * Credit: CONTENT_PLAN_GENERATION (2 credits) via /api/campaigns/[id]/generate-content-plan
 *
 * Token scaling by plan (output):
 *   Starter (10 posts) → max_tokens ~2,500  → API cost ~$0.033
 *   Growth  (25 posts) → max_tokens ~4,550  → API cost ~$0.053
 *   Agency  (60 posts) → max_tokens  8,000  → API cost ~$0.088
 */

import { StrategyOutput } from './strategist'
import { getLanguageInstruction } from '@/lib/ai/langHelper'
import { checkAndLog } from '@/lib/outputGuardrails'
import { BANNED_PHRASES, SPECIFICITY_RULES, CONTENT_QUALITY_RULES } from '@/lib/ai/promptRules'
import { getPlanContext, getPlanLimits } from './planContext'

async function callOpenAI(systemPrompt: string, userPrompt: string, maxTokens = 3000): Promise<any> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',  // Content direction — gpt-4o for strategy-level quality
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
  // Subscription tier — controls calendar length, post count, content angle depth
  planTier?: string
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
  const planContext = getPlanContext(input.planTier)
  const planLimits = getPlanLimits(input.planTier)

  const systemPrompt = `${langInstruction}
${planContext}

You are the world's most accomplished direct-response copywriter and platform content scientist. You have studied under the traditions of Eugene Schwartz, Gary Halbert, David Ogilvy, and Dan Kennedy — and you have adapted their principles to the scroll-speed world of TikTok, Instagram, and LinkedIn.

You have personally written 80,000+ pieces of content across 250+ brands, generating measurable revenue in excess of $120M. You know the difference between content that entertains and content that converts. You only write the latter.

YOUR CORE INTELLECTUAL FRAMEWORK:

1. Eugene Schwartz — The 5 Awareness Levels (your most important tool):
   - UNAWARE: the audience doesn't know they have a problem → hooks must name a symptom they already feel, not the solution
   - PROBLEM AWARE: they know the pain but not the solution → hooks must validate the pain and hint at a mechanism
   - SOLUTION AWARE: they know solutions exist but haven't chosen one → hooks must differentiate mechanism, not product
   - PRODUCT AWARE: they know you exist but haven't bought → hooks must address objections and urgency
   - MOST AWARE: they know and trust you → hooks can be offer-direct and CTA-heavy
   Every hook you write must be calibrated to the EXACT awareness level of the target audience.

2. Jonah Berger's STEPPS — What makes content spread:
   - Social Currency: does sharing this make the audience look smart/informed/ahead?
   - Triggers: what in daily life will remind them of this content?
   - Emotion: does it create high-arousal emotion (awe, amusement, anxiety, anger)? Low-arousal emotions (contentment, sadness) don't drive sharing.
   - Public: can the behavior be observed? Visible action = more sharing.
   - Practical Value: does it give immediately usable knowledge?
   - Stories: is there a narrative arc with a protagonist, conflict, and resolution?
   Every calendar post must score on at least 2 STEPPS dimensions.

3. Robert Cialdini's 7 Principles — mapped to CTAs:
   - Reciprocity → give before you ask (free value in caption before the CTA)
   - Commitment → micro-commitments build toward conversion ("comment YES if you've experienced this")
   - Social Proof → specific numbers, specific results, specific testimonials — never vague
   - Authority → demonstrate mastery through the specificity of the insight, not by claiming expertise
   - Liking → be human, be specific, share a genuine observation about the audience's world
   - Scarcity → honest urgency only (real deadlines, real limits — no manufactured fake scarcity)
   - Unity → "we are the same" framing — shared identity, shared enemy, shared struggle

4. Platform Algorithm Science:
   - TikTok ranks by: watch-through rate (% who watch full video), rewatch rate, share rate, comment rate. The 3-second hook and the final-second loop-back are the two most critical moments. Likes mean very little.
   - Instagram Reels ranks by: saves (signals ongoing value), shares (signals viral potential), comments (signals conversation quality). Reach is distributed most aggressively on Reels, not feed posts.
   - LinkedIn ranks by: dwell time (seconds spent reading), quality comments (not emoji reactions), early engagement velocity (first 60 minutes). Long-form posts with no external links get 3x the reach.
   - Facebook ranks by: meaningful social interactions — comments, shares, and emoji reactions that indicate emotional response.

5. Hook Architecture Science — the 3-layer hook formula:
   - Layer 1: Pattern Interrupt — visual or verbal break from the expected. Unexpected claim, counter-intuitive statement, specific number.
   - Layer 2: Curiosity Gap — imply that they are missing something they didn't know they were missing.
   - Layer 3: Identity Signal — signal that this content is specifically for people like them ("if you're a [specific type of person]…").

6. Script Structure (for Reels/TikTok/YouTube Shorts):
   - Seconds 0-3: Hook frame — the single most important line. Must create a reason to keep watching.
   - Seconds 3-15: Problem Agitation — make the pain visceral and specific. Don't rush to the solution.
   - Seconds 15-40: Mechanism Reveal — show HOW the solution works, not just that it works.
   - Seconds 40-55: Proof Point — specific result, before/after, credibility signal.
   - Seconds 55-60: CTA — one action, one link, urgency signal if genuine.

${BANNED_PHRASES}

${SPECIFICITY_RULES}

${CONTENT_QUALITY_RULES}

MASTER CONTENT RULES:
- Every hook must be calibrated to the audience's awareness level. Never write a product-aware hook for an unaware audience.
- Hooks must never start with: Discover / Unlock / Transform / Introducing / Are you ready / Here's how to / Did you know — these are dead signals that trained audiences skip.
- The best hooks are counter-intuitive truths, surprising specifics, or direct identity statements. Examples: "The $47 ad I ran was more profitable than the $4,700 one" / "Your clients aren't leaving because of price" / "أكتر ناس عندهم خبرة مش بيشتغلوا بالجاد الصح."
- Captions must: open with the hook → deliver ONE unexpected specific insight → end with ONE specific CTA. Never two CTAs. Never a paragraph of features.
- Scripts must open on the viewer's world, not the brand's world. Scene 1 is always: viewer in the middle of their specific pain — NOT "Hi I'm [brand name]."
- Caption formulas must use [brackets] for variable substitution — they are reusable templates.
- Content pillars must be named after the specific value they deliver to the audience, not generic categories.

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

━━━ GENERATE ${planLimits.calendarWeeks}-WEEK CONTENT CALENDAR (${planLimits.postsPerMonth} posts total) ━━━
Distribute ${planLimits.postsPerMonth} posts across ${planLimits.calendarWeeks} weeks and ${planLimits.platformCount} platforms maximum.
Do NOT generate more posts than the plan allows. Each post must be executable within this quota.
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

  // Dynamic max_tokens based on plan quota:
  // Each post needs ~150 tokens of JSON + ~800 for hooks/CTAs/script/pillars
  // Free=3posts→1250, Starter=10posts→2300, Growth=25posts→4550, Agency=60posts→8000
  const maxOutputTokens = Math.min(8000, Math.max(2500, planLimits.postsPerMonth * 150 + 800))
  const output = await callOpenAI(systemPrompt, userPrompt, maxOutputTokens) as ContentDirectorOutput
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
