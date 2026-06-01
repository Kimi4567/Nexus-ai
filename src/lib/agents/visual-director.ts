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
  brand?: {
    name?: string
    businessType?: string
    visualStyle?: string
    colorPalette?: string
    uniqueValue?: string
    writingStyle?: string
    painPoints?: string
    desires?: string
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
}

// ─── Internal API Helpers ─────────────────────────────────────────────────────

async function callGPT4oVision(
  systemPrompt: string,
  userText: string,
  imageUrl: string
): Promise<any> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
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
  const raw = data.choices?.[0]?.message?.content || '{}'
  try { return JSON.parse(raw) } catch { return {} }
}

async function callOpenAI(
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 2500
): Promise<any> {
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
      response_format: { type: 'json_object' },
      max_tokens: maxTokens,
      temperature: 0.5,
    }),
  })
  if (!response.ok) throw new Error(`OpenAI error: ${response.status}`)
  const data = await response.json()
  const raw = data.choices?.[0]?.message?.content || '{}'
  try { return JSON.parse(raw) } catch { return {} }
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
    `BRAND: ${b.name || 'Unknown'} (${b.businessType || 'Business'})`,
    `VISUAL STYLE: ${b.visualStyle || 'Not specified'}`,
    `COLOR PALETTE: ${b.colorPalette || 'Not specified'}`,
    `UNIQUE VALUE: ${b.uniqueValue || 'Not specified'}`,
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

You are NEXUS Visual Director — an expert creative director and brand strategist.
You analyze real client assets and produce actionable creative direction for marketing campaigns.
Every analysis must be specific to the brand and campaign — no generic observations.

Always output valid JSON.`

  const imageAssets = assets.filter(a => a.type === 'IMAGE' || a.type === 'LOGO')
  const videoAssets = assets.filter(a => a.type === 'VIDEO')

  // ── Per-asset vision analysis ──
  const assetAnalyses: AssetAnalysis[] = []

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
      const result = await callGPT4oVision(visionSystemPrompt, userText, asset.url)
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

  // ── Video stubs (vision not supported for video in V1) ──
  for (const vid of videoAssets) {
    assetAnalyses.push({
      mediaId: vid.mediaId,
      fileName: vid.fileName,
      url: vid.url,
      type: vid.type,
      brandAlignment: 'Video analysis coming in V2',
      contentType: 'Video',
      suggestedUse: ['Instagram Reels', 'TikTok', 'YouTube Shorts', 'Stories'],
      qualityNotes: 'Video file — frame-level analysis requires transcoding pipeline (coming soon)',
      campaignFit: 'Please review manually and add to campaign calendar',
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

You are NEXUS Visual Director. Based on analyzed client assets and campaign strategy, produce strategic creative direction.

BANNED PHRASES — never write these:
"capture the essence", "tell your story", "authentic visuals", "vibrant imagery",
"dynamic content", "eye-catching", "stunning visuals", "brand story", "elevate your presence"

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

    try {
      const result = await callOpenAI(overallSystemPrompt, overallPrompt, 1800)
      overallCreativeDirection = result.overallCreativeDirection || ''
      adCopyVariants = Array.isArray(result.adCopyVariants) ? result.adCopyVariants : []
      captionFormulas = Array.isArray(result.captionFormulas) ? result.captionFormulas : []
      topAssetsForCampaign = Array.isArray(result.topAssetsForCampaign) ? result.topAssetsForCampaign : []
      assetBasedScripts = Array.isArray(result.assetBasedScripts) ? result.assetBasedScripts : []
    } catch (err) {
      console.error('[visual-director] Overall creative direction generation failed:', err)
    }
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

You are NEXUS Visual Director — an expert creative director who creates precise, production-ready visual concepts for marketing campaigns.

Every concept must be specific to the brand, audience, and campaign goal.
Write prompts as if briefing a professional photographer or Midjourney operator.

BANNED PHRASES — never write these:
"capture the essence", "tell your story", "authentic visuals", "vibrant imagery",
"dynamic content", "eye-catching", "stunning visuals", "brand story", "elevate your presence",
"transform your brand", "powerful impact", "next level"

MANDATORY: Every output must be tied to the specific brand, audience, and campaign. No generic templates.

Always output valid JSON.`

  const userPrompt = `Generate a complete visual concept package for this campaign:

${contextBlock}

Return JSON with exactly these fields:
{
  "imagePrompts": [
    {
      "platform": "e.g., Instagram Feed, TikTok Cover, Facebook Ad, LinkedIn Post",
      "style": "Specific visual style: e.g., 'clean flat-lay product on marble, warm tones', 'dark moody lifestyle, natural window light'",
      "prompt": "Complete image generation prompt for Midjourney/DALL-E — include: subject, setting, lighting setup, mood, composition rule (rule of thirds/center), color palette, specific props or environment, photographic style (editorial, commercial, candid), camera perspective",
      "aspectRatio": "e.g., 1:1, 9:16, 16:9, 4:5",
      "notes": "What to emphasize in production, what to avoid, key brand elements to include"
    }
  ],
  "storyboardScenes": [
    {
      "sceneNumber": 1,
      "description": "What happens — action, subject, storyline beat",
      "visualNotes": "Camera angle (eye-level/overhead/low angle), movement (static/pan/zoom), background, lighting",
      "textOverlay": "On-screen text, caption, or CTA — or 'none'",
      "duration": "e.g., '2-3 seconds'",
      "platform": "e.g., Instagram Reel"
    }
  ],
  "productionBrief": "Full 150-200 word production brief: recommended locations/settings, lighting setup (natural vs studio), required props and wardrobe, talent direction (expressions, poses, energy), shooting sequence, post-processing direction (filters, color grading), what to absolutely avoid",
  "moodDescription": "2-3 sentences describing the overall visual mood, aesthetic, and emotional register of this campaign",
  "colorDirections": [
    "Color direction 1 — specific to brand palette and campaign goal",
    "Color direction 2",
    "Color direction 3",
    "Color direction 4"
  ],
  "platformLayouts": {
    "instagram_feed": "Specific layout direction for Instagram feed post — placement, negative space, text positioning",
    "instagram_stories": "Layout direction for 9:16 Stories — framing, safe zones, animation direction",
    "tiktok_reel": "Direction for TikTok/Reels — hook frame, caption position, end card",
    "facebook_ad": "Facebook ad layout — headline placement, image zone, CTA button area",
    "linkedin": "LinkedIn post direction — professional framing, what works for this audience"
  },
  "creativeNotes": "3-5 key creative decisions and the specific strategic reason each one fits this brand and campaign"
}

Generate 6 imagePrompts and 5 storyboardScenes.`

  const result = await callOpenAI(systemPrompt, userPrompt, 3200)
  checkAndLog('visual-director', JSON.stringify(result), {
    brandName: ctx.brand?.name,
    industry: ctx.brand?.businessType,
  })

  return {
    mode: 'concept',
    generatedAt: new Date().toISOString(),
    imagePrompts: Array.isArray(result.imagePrompts) ? result.imagePrompts : [],
    storyboardScenes: Array.isArray(result.storyboardScenes) ? result.storyboardScenes : [],
    productionBrief: result.productionBrief || '',
    moodDescription: result.moodDescription || '',
    colorDirections: Array.isArray(result.colorDirections) ? result.colorDirections : [],
    platformLayouts: result.platformLayouts && typeof result.platformLayouts === 'object'
      ? result.platformLayouts
      : {},
    creativeNotes: result.creativeNotes || '',
  }
}
