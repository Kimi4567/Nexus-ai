/**
 * AGENT — Visual Director
 *
 * Sprint F — Creative Direction
 *
 * Two modes:
 * 1. User Asset Mode — analyzes real uploaded client assets via GPT-4o vision
 *    Produces: per-asset analysis, ad copy hooks, caption suggestions,
 *    overall creative direction, scripts, and campaign-ready variants
 *
 * 2. AI Concept Mode — generates full visual concept package when no assets exist
 *    Produces: image prompts, storyboard scenes, production brief,
 *    platform layouts, color direction, creative notes
 *
 * Vision analysis uses GPT-4o (required for image input)
 * Text generation uses GPT-4o-mini for cost efficiency
 */

import { getLanguageInstruction } from '@/lib/ai/langHelper'
import { checkAndLog } from '@/lib/outputGuardrails'
import {
  readOpenAIChatUsage,
  summarizeOpenAITextUsage,
  type OpenAITextUsage,
  type ProviderUsageSummary,
} from '@/lib/ai/providerEconomics'
import { fetchAiProvider } from '@/lib/ai/providerFetch'
import { guardConceptCreativeBrief } from '@/lib/ai/creativeBriefTruthGuard'

// ─── Input Types ─────────────────────────────────────────────────────────────

export interface AssetItem {
  mediaId: string
  fileName: string
  url: string
  type: string // 'IMAGE' | 'VIDEO' | 'LOGO' | 'AUDIO'
}

export interface CampaignContext {
  campaignName: string
  campaignGoal?: string
  audience?: string
  tone?: string
  language?: string
  platforms?: string[]
  brand?: {
    name?: string
    businessType?: string
    visualStyle?: string
    colorPalette?: string
    uniqueValue?: string
    writingStyle?: string
    painPoints?: string
    desires?: string
    verifiedProof?: string[]
  }
  strategy?: {
    positioning?: string
    keyMessage?: string
    contentPillars?: string[]
    visualDirection?: string
    differentiation?: string
    diagnosis?: string
  }
}

// ─── Output Types ─────────────────────────────────────────────────────────────

export interface AssetAnalysis {
  mediaId: string
  fileName: string
  url: string
  type: string
  brandAlignment: string
  contentType: string
  suggestedUse: string[]
  qualityNotes: string
  campaignFit: string
  adCopyHook: string
  captionSuggestion: string
}

export interface StoryboardScene {
  sceneNumber: number
  description: string
  visualNotes: string
  textOverlay: string
  duration: string
  platform: string
}

export interface ImagePrompt {
  platform: string
  style: string
  prompt: string
  aspectRatio: string
  notes: string
}

export interface CreativeBrief {
  mode: 'asset' | 'concept'
  generatedAt: string
  // Asset mode
  assetAnalyses?: AssetAnalysis[]
  overallCreativeDirection?: string
  adCopyVariants?: string[]
  captionFormulas?: string[]
  topAssetsForCampaign?: string[]
  assetBasedScripts?: string[]
  // Concept mode
  imagePrompts?: ImagePrompt[]
  storyboardScenes?: StoryboardScene[]
  productionBrief?: string
  moodDescription?: string
  colorDirections?: string[]
  platformLayouts?: Record<string, string>
  creativeNotes?: string
  /** Internal provider meter; API callers remove it before persistence/response. */
  providerUsage?: ProviderUsageSummary
}

// ─── Internal API Helpers ─────────────────────────────────────────────────────

async function callGPT4oVision(
  systemPrompt: string,
  userText: string,
  imageUrl: string
): Promise<{ result: any; usage: OpenAITextUsage }> {
  const response = await fetchAiProvider('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            { type: 'text', text: userText },
            { type: 'image_url', image_url: { url: imageUrl, detail: 'low' } },
          ],
        },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 900,
      temperature: 0.4,
    }),
  })
  if (!response.ok) throw new Error(`OpenAI vision error: ${response.status}`)
  const data = await response.json()
  const raw = data.choices?.[0]?.message?.content?.trim()
  if (!raw) throw new Error('OpenAI returned no asset analysis')
  try {
    return { result: JSON.parse(raw), usage: readOpenAIChatUsage(data.usage) }
  } catch {
    throw new Error('OpenAI returned invalid asset analysis JSON')
  }
}

async function callOpenAI(
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 2500
): Promise<{ result: any; usage: OpenAITextUsage }> {
  const response = await fetchAiProvider('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',  // Visual direction — gpt-4o for creative nuance
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      max_tokens: maxTokens,
      temperature: 0.5,
    }),
  })
  if (!response.ok) throw new Error(`OpenAI error: ${response.status}`)
  const data = await response.json()
  const raw = data.choices?.[0]?.message?.content?.trim()
  if (!raw) throw new Error('OpenAI returned no visual direction')
  try {
    return { result: JSON.parse(raw), usage: readOpenAIChatUsage(data.usage) }
  } catch {
    throw new Error('OpenAI returned invalid visual direction JSON')
  }
}

// ─── Context Builder ──────────────────────────────────────────────────────────

function buildContextBlock(ctx: CampaignContext): string {
  const b = ctx.brand || {}
  const s = ctx.strategy || {}
  const lines = [
    `CAMPAIGN: ${ctx.campaignName}`,
    `GOAL: ${ctx.campaignGoal || 'Not specified'}`,
    `AUDIENCE: ${ctx.audience || 'Not specified'}`,
    `TONE: ${ctx.tone || 'Professional'}`,
    `ALLOWED CAMPAIGN PLATFORMS: ${(ctx.platforms || []).join(', ') || 'Not specified'}`,
    `BRAND: ${b.name || 'Unknown'} (${b.businessType || 'Business'})`,
    `VISUAL STYLE: ${b.visualStyle || 'Not specified'}`,
    `COLOR PALETTE: ${b.colorPalette || 'Not specified'}`,
    `UNIQUE VALUE: ${b.uniqueValue || 'Not specified'}`,
    `VERIFIED PROOF: ${(b.verifiedProof || []).join(' | ') || 'None supplied'}`,
    `POSITIONING: ${s.positioning || 'Not specified'}`,
    `KEY MESSAGE: ${s.keyMessage || 'Not specified'}`,
    `VISUAL DIRECTION: ${s.visualDirection || 'Not specified'}`,
    `CONTENT PILLARS: ${(s.contentPillars || []).join(', ') || 'Not specified'}`,
  ]
  return lines.join('\n')
}

// ─── User Asset Mode ──────────────────────────────────────────────────────────

/**
 * analyzeAssets — User Asset Mode
 *
 * Analyzes each IMAGE/LOGO with GPT-4o vision, then generates overall
 * creative direction, ad copy variants, scripts, and caption formulas
 * based on the full set of analyzed assets.
 */
export async function analyzeAssets(
  assets: AssetItem[],
  ctx: CampaignContext
): Promise<CreativeBrief> {
  const langInstruction = getLanguageInstruction(ctx.language)
  const contextBlock = buildContextBlock(ctx)

  const visionSystemPrompt = `${langInstruction}

Act as a senior creative director producing evidence-aware visual guidance for the supplied brand and campaign. Do not claim personal experience, campaign history, or guaranteed performance.

YOUR VISUAL INTELLIGENCE FRAMEWORK:

1. Gestalt Psychology — you see every image through the 6 laws: Proximity (what groups together), Similarity (what belongs together), Continuation (where the eye travels), Closure (what the brain completes), Figure-Ground (what is subject vs. background), Symmetry (balance and tension). You use these laws intentionally, and you break them intentionally when you want to create discomfort or surprise.

2. Color Context: treat color associations as culture- and category-dependent hypotheses, not universal psychology. Prefer the confirmed brand palette and flag cultural review when the market is known.

3. Visual Hierarchy: make the main subject, message, and next action legible at small sizes. Do not claim that one screen position, face treatment, or composition converts best without campaign evidence.

4. Attention Hypotheses: make the opening frame and thumbnail understandable quickly, then validate the treatment with real platform evidence. Never present a fixed attention threshold as fact.

5. Platform-Native Visual Language:
   - TikTok: test vertical-native, text-forward, creator-style, and polished variants; do not assume one style or face treatment performs best
   - Instagram Feed: curated, aesthetically coherent, white space is allowed, color harmony is expected, product context matters
   - Instagram Reels/Stories: full-bleed vertical, hook text in top 40% of frame, CTA in bottom 20%, safe zones respected (no text in extreme corners)
   - LinkedIn: professional framing, documentary-style or clean data/insight graphics, no lifestyle excess
   - Facebook Ads: direct-response first, clarity over aesthetics, text legibility at small size, product clear within 1 second

6. Brand Visual Identity Principles (Marty Neumeier): every brand has a visual "signature asset" — an instantly recognizable element (specific color, shape, composition style, or photographic treatment) that makes any piece of content ownable. Your job is to identify that signature and build toward it consistently.

ASSET ANALYSIS STANDARDS:
- Always assess: composition quality, lighting quality (direction, quality, color temperature), subject clarity, background tension with subject, color harmony or clash, brand alignment, and commercial utility.
- Flag: overexposed highlights, underexposed shadows, distracting backgrounds, poor subject isolation, text legibility issues, inappropriate color temperature.
- Never say "vibrant", "stunning", "eye-catching", "capture the essence", "tell your story", or "dynamic content." Describe what is literally visible and what can be improved.

Always output valid JSON.`

  const imageAssets = assets.filter(a => a.type === 'IMAGE' || a.type === 'LOGO')
  const videoAssets = assets.filter(a => a.type === 'VIDEO')
  const providerUsages: OpenAITextUsage[] = []

  // ── Per-asset vision analysis ──
  const assetAnalyses: AssetAnalysis[] = []
  let successfulImageAnalyses = 0

  for (const asset of imageAssets) {
    const userText = `Analyze this asset for the following campaign:

${contextBlock}

Return JSON with exactly these fields:
{
  "brandAlignment": "How specifically does this image align (or conflict) with the brand identity? Reference the brand's visual style and palette.",
  "contentType": "Exact shot type: product shot, lifestyle, logo mark, team photo, location exterior, food/beverage, etc.",
  "suggestedUse": ["2-4 specific placements: e.g., Instagram Feed Hero, Stories opening frame, Facebook Ad creative, etc."],
  "qualityNotes": "Honest notes on lighting quality, sharpness, composition. Flag any issues.",
  "campaignFit": "Specifically how this image supports the campaign goal and key message.",
  "adCopyHook": "One powerful, brand-specific opening hook line for an ad using this image. Do not write generic marketing copy.",
  "captionSuggestion": "A complete 2-3 sentence social caption for this image, in the brand's tone."
}`

    try {
      const response = await callGPT4oVision(visionSystemPrompt, userText, asset.url)
      const result = response.result
      providerUsages.push(response.usage)
      assetAnalyses.push({
        mediaId: asset.mediaId,
        fileName: asset.fileName,
        url: asset.url,
        type: asset.type,
        brandAlignment: result.brandAlignment || 'Analysis unavailable',
        contentType: result.contentType || 'Unknown',
        suggestedUse: Array.isArray(result.suggestedUse) ? result.suggestedUse : [],
        qualityNotes: result.qualityNotes || '',
        campaignFit: result.campaignFit || '',
        adCopyHook: result.adCopyHook || '',
        captionSuggestion: result.captionSuggestion || '',
      })
      successfulImageAnalyses += 1
    } catch (err) {
      console.error(`[visual-director] Asset analysis failed for ${asset.mediaId}:`, err)
      assetAnalyses.push({
        mediaId: asset.mediaId,
        fileName: asset.fileName,
        url: asset.url,
        type: asset.type,
        brandAlignment: 'Analysis could not be completed',
        contentType: 'Unknown',
        suggestedUse: [],
        qualityNotes: '',
        campaignFit: '',
        adCopyHook: '',
        captionSuggestion: '',
      })
    }
  }

  if (imageAssets.length > 0 && successfulImageAnalyses === 0) {
    throw new Error('No selected assets could be analyzed')
  }

  // This brief analyses still images and logos. Keep selected videos visible
  // as unevaluated inputs so the UI never implies that frames were inspected.
  for (const vid of videoAssets) {
    assetAnalyses.push({
      mediaId: vid.mediaId,
      fileName: vid.fileName,
      url: vid.url,
      type: vid.type,
      brandAlignment: 'Not evaluated in this image-based brief',
      contentType: 'Video',
      suggestedUse: [],
      qualityNotes: 'No video frames were inspected here. Run Campaign media intelligence before deciding whether this asset fits the campaign.',
      campaignFit: 'Not assessed in this brief',
      adCopyHook: '',
      captionSuggestion: '',
    })
  }

  // ── Overall creative direction (from all image assets) ──
  let overallCreativeDirection = ''
  let adCopyVariants: string[] = []
  let captionFormulas: string[] = []
  let topAssetsForCampaign: string[] = []
  let assetBasedScripts: string[] = []

  if (imageAssets.length > 0) {
    const assetSummaries = assetAnalyses
      .filter(a => a.type === 'IMAGE' || a.type === 'LOGO')
      .map(a => `- "${a.fileName}" (${a.contentType}): ${a.campaignFit}`)
      .join('\n')

    const overallSystemPrompt = `${langInstruction}

Act as a senior creative director. Synthesize only the supplied assets and campaign context into a coherent, reviewable visual direction; do not claim prior experience or conversion outcomes.

Your creative direction is always: specific (exact shots, exact compositions, exact treatments), actionable (a photographer or designer can execute without questions), and brand-faithful (uses what exists, extends what's possible).

BANNED PHRASES: "capture the essence" / "tell your story" / "authentic visuals" / "vibrant imagery" / "dynamic content" / "eye-catching" / "stunning visuals" / "brand story" / "elevate your presence" / "bring it to life" / "powerful imagery"

CREATIVE DIRECTION STANDARDS:
- Name the specific composition style (rule of thirds, centered subject, diagonal tension, negative space dominance)
- Name the specific lighting treatment (hard directional, soft diffused, golden hour, studio flat, mixed ambient)
- Name the specific color temperature direction (warm 3200K, neutral 5500K, cool 7000K, intentionally mixed)
- Describe the exact emotional register the visual should evoke — not adjectives but situations ("feels like finding a solution after 3 hours of frustration" not "empowering")
- Platform-specific treatments must account for safe zones, text placement, and thumbnail legibility

Always output valid JSON.`

    const overallPrompt = `Based on these analyzed assets and campaign context, produce strategic creative direction:

CAMPAIGN CONTEXT:
${contextBlock}

ANALYZED ASSETS:
${assetSummaries}

Return JSON with exactly these fields:
{
  "overallCreativeDirection": "2-3 sentences of specific, actionable creative direction for using these assets together in the campaign",
  "adCopyVariants": [
    "Ad copy variant 1 — specific hook + body (2-3 lines)",
    "Ad copy variant 2",
    "Ad copy variant 3"
  ],
  "captionFormulas": [
    "Caption formula 1 — usable template with [brackets] for variable parts",
    "Caption formula 2",
    "Caption formula 3"
  ],
  "topAssetsForCampaign": ["fileName of best asset", "fileName of second best", "fileName of third best"],
  "assetBasedScripts": [
    "Script 1 — 5-8 line Reel/TikTok script using these assets. Include scene directions.",
    "Script 2 — alternative angle"
  ]
}`

    const response = await callOpenAI(overallSystemPrompt, overallPrompt, 1800)
    const result = response.result
    providerUsages.push(response.usage)
    if (typeof result.overallCreativeDirection !== 'string' || !result.overallCreativeDirection.trim()) {
      throw new Error('OpenAI returned an incomplete asset-based creative direction')
    }
    overallCreativeDirection = result.overallCreativeDirection || ''
    adCopyVariants = Array.isArray(result.adCopyVariants) ? result.adCopyVariants : []
    captionFormulas = Array.isArray(result.captionFormulas) ? result.captionFormulas : []
    topAssetsForCampaign = Array.isArray(result.topAssetsForCampaign) ? result.topAssetsForCampaign : []
    assetBasedScripts = Array.isArray(result.assetBasedScripts) ? result.assetBasedScripts : []
  }

  return {
    mode: 'asset',
    generatedAt: new Date().toISOString(),
    assetAnalyses,
    overallCreativeDirection,
    adCopyVariants,
    captionFormulas,
    topAssetsForCampaign,
    assetBasedScripts,
    providerUsage: summarizeOpenAITextUsage('gpt-4o', providerUsages),
  }
}

// ─── AI Concept Mode ──────────────────────────────────────────────────────────

/**
 * generateVisualConcepts — AI Concept Mode
 *
 * Generates a complete visual concept package for campaigns without client assets:
 * image generation prompts, storyboard, production brief, platform layouts.
 */
export async function generateVisualConcepts(ctx: CampaignContext): Promise<CreativeBrief> {
  const langInstruction = getLanguageInstruction(ctx.language)
  const contextBlock = buildContextBlock(ctx)

  const systemPrompt = `${langInstruction}

Act as a senior creative director producing executable visual concepts from the supplied brief. Do not claim personal production history or guaranteed results.

This is CONCEPT MODE with no owned product screenshots, customer footage, or verified production assets. Use abstract editorial systems only. Do not depict people, customers, experts, product UI, dashboards, interfaces, screens, phones, laptops, tablets, smartwatches, notifications, testimonials, logos, readable generated text, or a product outcome. Do not invent features or show a result improving. Copy, CTA, and brand marks remain separate editable layers for later review.

Use only the ALLOWED CAMPAIGN PLATFORMS in the supplied context. Repeating an allowed platform is preferable to inventing TikTok, Facebook, or any other channel outside the approved campaign.

When you write an image prompt, it must be immediately usable by an illustrator or motion designer producing an abstract editorial background plate. When you write a storyboard, every frame must remain an abstract system of cards, markers, connectors, and category symbols. When you write a production brief, it must describe graphic composition, motion, palette, safe zones, and editable layers without talent, locations, product screens, devices, logos, or readable generated text.

YOUR PRODUCTION LANGUAGE STANDARDS:

Photography Direction:
- Always name: subject placement (rule of thirds left/center/right, center-dominant, diagonal), background treatment (clean seamless / environmental / shallow DOF bokeh / textured practical), lighting setup (Rembrandt ratio / butterfly / split / flat fill / natural window / golden hour), color temperature (3200K warm / 5500K daylight / 7000K blue), mood (clinical/sharp vs. soft/editorial vs. gritty/documentary)
- Camera perspective: eye-level / low-angle (empowering) / high-angle (overview, vulnerability) / overhead (flat lay) / Dutch angle (tension)
- Lens character: wide (environmental context) / 50mm (natural human perspective) / 85-135mm (compressed, intimate) / macro (detail, texture)

Videography Direction:
- Shot sequence: establish → medium → close-up → detail. Know when to break this.
- Movement: static (authority, calm) / handheld (authentic, urgent) / slider (premium, controlled) / gimbal (fluid, modern)
- Pacing: cut rhythm should match the emotional beat — fast cuts for energy/urgency, slow for authority/premium

Platform Visual Rules:
- TikTok/Reels: make the opening frame understandable as a still thumbnail, respect 9:16 safe zones, and test text scale and subject treatment instead of claiming a universal stop-scroll formula.
- Instagram Feed: cohesive color temperature across the grid. 4:5 or 1:1. Subject must be clear at 200px width (small feed view).
- LinkedIn: prepare a platform-compatible professional-context variant; treat data/insight and lifestyle treatments as test options.
- Facebook Ad: prioritize small-screen legibility and a clear subject; do not claim a placement or subject choice produces the highest CTR without evidence.

BANNED PHRASES: "capture the essence" / "tell your story" / "authentic visuals" / "vibrant imagery" / "dynamic content" / "eye-catching" / "stunning visuals" / "brand story" / "elevate your presence" / "powerful impact" / "next level" / "bring it to life"

MANDATORY: Every concept must be executable from the brief alone. No vague references. No "add some creativity." Name specific props, specific locations, specific lighting setups, specific camera angles.

Always output valid JSON.`

  const userPrompt = `Generate a complete visual concept package for this campaign:

${contextBlock}

Return JSON with exactly these fields:
{
  "imagePrompts": [
    {
      "platform": "one value from ALLOWED CAMPAIGN PLATFORMS only",
      "style": "Specific abstract editorial or information-design style with no people, devices, interfaces, or logos",
      "prompt": "Complete image generation prompt — include abstract category symbols, composition, lighting, mood, palette, negative space, and editable-layer boundaries; never depict people, product UI, devices, notifications, readable text, logos, testimonials, or outcomes",
      "aspectRatio": "e.g., 1:1, 9:16, 16:9, 4:5",
      "notes": "What abstract visual hierarchy to emphasize and which unsupported evidence to avoid"
    }
  ],
  "storyboardScenes": [
    {
      "sceneNumber": 1,
      "description": "How abstract cards, markers, connectors, and category symbols move; no product use or customer result",
      "visualNotes": "Composition, motion, background, lighting, and safe zones; no people, devices, screens, notifications, logos, or readable text",
      "textOverlay": "always 'none — add reviewed copy later as a separate editable layer'",
      "duration": "e.g., '2-3 seconds'",
      "platform": "one value from ALLOWED CAMPAIGN PLATFORMS only"
    }
  ],
  "productionBrief": "Full production brief for abstract editorial background plates: composition system, motion, palette, negative space, editable layers, and what to avoid. No talent, locations, product UI, devices, notifications, logos, readable generated text, testimonials, or outcomes",
  "moodDescription": "2-3 sentences describing a precise, evidence-neutral visual mood without implying product behavior or results",
  "colorDirections": [
    "Color direction 1 — specific to brand palette and campaign goal",
    "Color direction 2",
    "Color direction 3",
    "Color direction 4"
  ],
  "platformLayouts": {
    "approved_platform_key": "Layout direction for an allowed campaign platform — abstract focal system, safe zones, and separately reviewed copy/CTA/brand layers"
  },
  "creativeNotes": "3-5 evidence-neutral creative decisions using abstract workflow symbols only"
}

Generate 6 imagePrompts and 5 storyboardScenes.`

  const response = await callOpenAI(systemPrompt, userPrompt, 3200)
  const result = response.result
  if (
    !Array.isArray(result.imagePrompts) || result.imagePrompts.length === 0 ||
    !Array.isArray(result.storyboardScenes) || result.storyboardScenes.length === 0 ||
    typeof result.productionBrief !== 'string' || !result.productionBrief.trim()
  ) {
    throw new Error('OpenAI returned an incomplete visual concept package')
  }
  checkAndLog('visual-director', JSON.stringify(result), {
    brandName: ctx.brand?.name,
    industry: ctx.brand?.businessType,
  })

  const guarded = guardConceptCreativeBrief({
    imagePrompts: Array.isArray(result.imagePrompts) ? result.imagePrompts : [],
    storyboardScenes: Array.isArray(result.storyboardScenes) ? result.storyboardScenes : [],
    productionBrief: result.productionBrief || '',
    moodDescription: result.moodDescription || '',
    colorDirections: Array.isArray(result.colorDirections) ? result.colorDirections : [],
    platformLayouts: result.platformLayouts && typeof result.platformLayouts === 'object'
      ? result.platformLayouts
      : {},
    creativeNotes: result.creativeNotes || '',
  }, {
    audience: ctx.audience,
    campaignGoal: ctx.campaignGoal,
    campaignName: ctx.campaignName,
    brandName: ctx.brand?.name,
    brandPalette: ctx.brand?.colorPalette,
    allowedPlatforms: ctx.platforms,
  })

  return {
    mode: 'concept',
    generatedAt: new Date().toISOString(),
    ...guarded,
    providerUsage: summarizeOpenAITextUsage('gpt-4o', [response.usage]),
  }
}
