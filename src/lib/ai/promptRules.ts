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
1. NAME THE BRAND: Reference the brand by name in every major output. Not "your business" — use the actual brand name. If no brand name is given, write "this brand" — NEVER invent a brand name.
2. NAME ONLY THE CONFIRMED AUDIENCE: Use job, age, income, location, life stage, or buying behavior only when it appears in Brand Brain or the request. Never infer demographic detail from an industry. If it is missing, write "Audience detail not provided" and request it.
3. NAME ONLY A CONFIRMED PAIN: Reference a pain point supplied by the brand. If none is supplied, label the pain as missing input instead of inventing one.
4. GROUND THE DIFFERENTIATOR: State a differentiator only when Brand Brain supports it. Otherwise offer a clearly labelled positioning hypothesis to review — never a fact.
5. NAME AN AVAILABLE ACTION: Every CTA must use a channel, offer, price, deadline, or booking flow confirmed in Brand Brain. Never invent a free audit, discount, consultation, keyword, deadline, or contact path.
6. NO COPY-PASTE SAFE LINES: If the same sentence could appear in ANY brand's strategy, delete it and rewrite.
7. SOURCE-BOUND NUMBERS: Use a number only when the user or a verified platform record supplied it. Without a baseline, propose what to measure and when to review it; never invent a target range or benchmark.
8. STAY IN INDUSTRY: All examples, references, and analogies must match the brand's actual industry. Never import framing from unrelated industries.
`.trim()

// ── Unsupported-claim safety (PR-1K) ────────────────────────────────────────────
// NEXUS must never present invented metrics or proof as fact. Generators stay
// conservative; Sentinel's deterministic guard is the backstop.

export const UNSUPPORTED_CLAIMS_RULES = `
CLAIM SAFETY — never present invented proof as fact. Conservative beats impressive:
- NO invented numbers: no percentages ("30% more"), multipliers ("2x", "10x"), or
  "X times faster" unless that exact figure is given to you in the brand/source data.
- NO performance/ROI promises: avoid "boost sales", "increase revenue", "cut costs",
  "guaranteed results", "proven results", "will deliver".
- NO unsourced social proof: no "trusted by thousands", "customers love us", "join thousands".
- NO awards/superlatives as fact: no "#1", "award-winning", "best-in-class".
- NO platform-status claims you can't see: no "published automatically", "ads are running",
  "campaign is live" unless real platform data confirms it.
- Instead use honest, capability framing: "designed to help", "can help", "may improve",
  "aims to reduce", "built for", "intended to support". State value without faking proof.
`.trim()

// ── Chain-of-thought instruction ───────────────────────────────────────────────
// Forces the model to reason before generating, producing more grounded outputs.

export const CHAIN_OF_THOUGHT_MARKETING = `
REASONING APPROACH — before writing your output, internally complete these steps:
1. What is this brand's actual stage? (pre-launch / early / active / scaling)
2. Which buyer details are confirmed, and which are missing? Do not fill missing job, situation, or budget details.
3. Which audience problem is explicitly supported by the supplied context?
4. Which differentiator is confirmed, and which positioning idea must remain a hypothesis?
5. What would make this campaign fail if ignored?
Only after completing this analysis should you generate the output.
`.trim()

// ── Content quality rules ──────────────────────────────────────────────────────

export const CONTENT_QUALITY_RULES = `
CONTENT QUALITY RULES:
- HOOKS: Every hook should create a relevant knowledge gap, challenge an assumption, or use a verified fact. Never invent a result. Example: "What [confirmed audience] should check before choosing [confirmed offer category]."
- CAPTIONS: Open with the hook, then give specific value, then end with ONE clear CTA. Never start a caption with the brand name.
- CTAs: CTAs must be specific to a confirmed action path. Do not invent urgency, scarcity, discounts, free offers, booking duration, or a DM keyword.
- HASHTAGS: Recommend only contextually relevant terms. Do not claim post-volume tiers unless current platform evidence was supplied.
- SCRIPTS: Every script must have a problem-agitate-solve structure. Scene 1 = viewer's pain. Scene 2 = consequence. Scene 3 = brand solution. No scene should be "introduce brand" first.
`.trim()

// ── Quality system prompt header ───────────────────────────────────────────────
// Use this as the opening block of any system prompt.

export function buildQualitySystemPrompt(role: string, extra = ''): string {
  return `${role}

${BANNED_PHRASES}

${SPECIFICITY_RULES}

${UNSUPPORTED_CLAIMS_RULES}

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
    brand.winningHooks?.length       && `Stored Hook Candidates (style reference, not proof): ${brand.winningHooks.slice(0, 3).join(' | ')}`,
    brand.winningAngles?.length      && `Winning Angles: ${brand.winningAngles.slice(0, 3).join(', ')}`,
    brand.competitorNotes    && `Key Competitors: ${brand.competitorNotes}`,
    brand.strategicNotes     && `Strategic Notes: ${brand.strategicNotes}`,
  ].filter(Boolean)

  return lines.length > 0
    ? `=== BRAND CONTEXT ===\n${lines.join('\n')}\n=== END BRAND CONTEXT ===`
    : '=== BRAND CONTEXT: Not yet configured ==='
}
