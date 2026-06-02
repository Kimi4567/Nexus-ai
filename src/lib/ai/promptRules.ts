/**
 * NEXUS AI — Shared Prompt Quality Rules
 *
 * Central repository of anti-generic rules, specificity constraints,
 * chain-of-thought templates, and banned phrase lists.
 *
 * Import into any agent or API route that calls OpenAI.
 *
 * Rules exist for ONE reason: to make every AI output feel like it was
 * written by a senior strategist who has studied THIS brand specifically —
 * not copy-pasted from a generic marketing textbook.
 */

// ── Banned phrases ─────────────────────────────────────────────────────────────
// Any output containing these adds zero signal and undermines trust.

export const BANNED_PHRASES = `
BANNED PHRASES — if you write any of these, you have failed. Rewrite immediately:
- innovative / innovation / innovative approach / innovative solution
- cutting-edge / state-of-the-art / next-generation / next-gen
- game-changer / game-changing / revolutionary / groundbreaking
- world-class / best-in-class / industry-leading / market-leading
- leverage / leverage AI / leverage synergies / leverage your
- transform your / transformation / unlock / unlock your potential
- take to the next level / elevate your brand / elevate your
- powerful solution / robust solution / comprehensive solution / scalable solution
- seamless experience / seamless integration / seamlessly
- drive results / drive meaningful results / boost your / maximize ROI
- in today's digital landscape / in the competitive landscape / modern world
- proven ROI / guaranteed results / tested formula / industry best practices
- empower your / empower team / empower business
- holistic approach / end-to-end solution / full-service
- data-driven / actionable insights (when used as filler, not tied to specific data)
- dynamic content / eye-catching / stunning visuals / vibrant imagery
- capture the essence / tell your story / authentic visuals
`.trim()

// ── Specificity mandate ────────────────────────────────────────────────────────
// Everything must be tied to THIS brand, THIS audience, THIS context.

export const SPECIFICITY_RULES = `
SPECIFICITY RULES — every output must pass all of these:
1. NAME THE BRAND: Reference the brand by name in every major output. Not "your business" — use the actual brand name.
2. NAME THE AUDIENCE: Use a specific description ("UAE founder spending $3K/mo on ads") not generic ("business owners").
3. NAME THE PAIN: Reference a specific problem from the brand's pain points — not "challenges" or "issues."
4. NAME THE DIFFERENTIATOR: State what makes this brand different from its competitors. Never write "unique approach."
5. NAME THE ACTION: Every CTA must be a specific action. "Book a free 20-min audit" not "get started."
6. NO COPY-PASTE SAFE LINES: If the same sentence could appear in ANY brand's strategy, delete it and rewrite.
7. REAL NUMBERS: When giving targets or metrics, use realistic stage-appropriate ranges — never fake guarantees.
`.trim()

// ── Chain-of-thought instruction ───────────────────────────────────────────────
// Forces the model to reason before generating, producing more grounded outputs.

export const CHAIN_OF_THOUGHT_MARKETING = `
REASONING APPROACH — before writing your output, internally complete these steps:
1. What is this brand's actual stage? (pre-launch / early / active / scaling)
2. Who is their most likely buyer RIGHT NOW — specific job title, situation, budget?
3. What single problem keeps this buyer awake at night?
4. How does THIS brand solve it differently from competitors?
5. What would make this campaign fail if ignored?
Only after completing this analysis should you generate the output.
`.trim()

// ── Content quality rules ──────────────────────────────────────────────────────

export const CONTENT_QUALITY_RULES = `
CONTENT QUALITY RULES:
- HOOKS: Every hook must create a knowledge gap, challenge an assumption, or state a specific surprising fact. "5 reasons why..." is weak. "Why [Brand] stopped doing X (and doubled results)" is strong.
- CAPTIONS: Open with the hook, then give specific value, then end with ONE clear CTA. Never start a caption with the brand name.
- CTAs: CTAs must create urgency or specificity. "DM us" is weak. "DM us the word AUDIT for a free 15-min review" is strong.
- HASHTAGS: Mix 3 niche (under 100K posts) + 3 medium (100K-1M) + 2 brand hashtags. No generic mega-tags.
- SCRIPTS: Every script must have a problem-agitate-solve structure. Scene 1 = viewer's pain. Scene 2 = consequence. Scene 3 = brand solution. No scene should be "introduce brand" first.
`.trim()

// ── Quality system prompt header ───────────────────────────────────────────────
// Use this as the opening block of any system prompt.

export function buildQualitySystemPrompt(role: string, extra = ''): string {
  return `${role}

${BANNED_PHRASES}

${SPECIFICITY_RULES}

${extra}

Return ONLY valid JSON. No markdown outside the JSON. No explanation outside the JSON.`
}

// ── Brand context builder ──────────────────────────────────────────────────────
// Consistent format for injecting brand data into any prompt.

export interface BrandContextData {
  brandName?: string
  industry?: string
  description?: string
  primaryOffer?: string
  pricePoint?: string
  uniqueAdvantages?: string[]
  targetAudience?: string
  audienceAge?: string
  audienceLocation?: string
  audiencePainPoints?: string[]
  audienceDesires?: string[]
  toneKeywords?: string[]
  writingStyle?: string
  avoidKeywords?: string[]
  topPlatforms?: string[]
  winningHooks?: string[]
  winningAngles?: string[]
  competitorNotes?: string
  strategicNotes?: string
}

export function buildBrandContextBlock(brand: BrandContextData): string {
  const lines = [
    brand.brandName          && `Brand Name: ${brand.brandName}`,
    brand.industry           && `Industry: ${brand.industry}`,
    brand.description        && `Brand Description: ${brand.description}`,
    brand.primaryOffer       && `Core Offer: ${brand.primaryOffer}`,
    brand.pricePoint         && `Price Positioning: ${brand.pricePoint}`,
    brand.uniqueAdvantages?.length && `Unique Advantages: ${brand.uniqueAdvantages.join(' | ')}`,
    brand.targetAudience     && `Target Audience: ${brand.targetAudience}`,
    brand.audienceAge        && `Audience Age: ${brand.audienceAge}`,
    brand.audienceLocation   && `Market / Region: ${brand.audienceLocation}`,
    brand.audiencePainPoints?.length && `Audience Pain Points: ${brand.audiencePainPoints.join(' | ')}`,
    brand.audienceDesires?.length    && `Audience Desires: ${brand.audienceDesires.join(' | ')}`,
    brand.toneKeywords?.length       && `Brand Tone: ${brand.toneKeywords.join(', ')}`,
    brand.writingStyle       && `Writing Style: ${brand.writingStyle}`,
    brand.avoidKeywords?.length      && `NEVER use these words/phrases: ${brand.avoidKeywords.join(', ')}`,
    brand.topPlatforms?.length       && `Active Platforms: ${brand.topPlatforms.join(', ')}`,
    brand.winningHooks?.length       && `Winning Hooks (style reference): ${brand.winningHooks.slice(0, 3).join(' | ')}`,
    brand.winningAngles?.length      && `Winning Angles: ${brand.winningAngles.slice(0, 3).join(', ')}`,
    brand.competitorNotes    && `Key Competitors: ${brand.competitorNotes}`,
    brand.strategicNotes     && `Strategic Notes: ${brand.strategicNotes}`,
  ].filter(Boolean)

  return lines.length > 0
    ? `=== BRAND CONTEXT ===\n${lines.join('\n')}\n=== END BRAND CONTEXT ===`
    : '=== BRAND CONTEXT: Not yet configured ==='
}
