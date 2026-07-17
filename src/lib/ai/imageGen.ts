/**
 * NEXUS Visual Intelligence — Professional Ad Image Prompt Builder
 *
 * Generates advertising-agency-grade image prompts by combining:
 *   1. Caption analysis  → deterministic, zero-token scene selection
 *   2. Brand Brain       → colors, industry, tone, brand name
 *   3. Language          → Arabic or English (drives text rendering strategy)
 *   4. Platform          → dimensions and composition format
 *
 * Design philosophy: every generated image must feel like it came from a
 * world-class advertising agency, not a generic AI image tool.
 * Each post caption drives a UNIQUE visual concept — two posts from the same
 * brand should look distinctly different.
 *
 * Text strategy (both languages — background-only approach):
 *   AI model      → generates a text-free background scene (explicit NO_TEXT instruction)
 *   New post/concept roles return background assets for review and later editable layers
 *   Legacy roles can still use brandComposite for compatibility with older flows
 *   This ensures zero garbled/wrong AI text in newly generated background assets.
 */

import {
  detectLanguage,
  extractVisualConcept,
  type VisualConcept,
} from '@/lib/ai/conceptExtractor'
import type { CreativeRequirement } from '@/lib/creativeRequirements'
import type { CreativeTemplateSpec } from '@/lib/creativeTemplates'

// ─── Types ────────────────────────────────────────────────────────────────────

export type VisualStyle =
  | 'Minimal'
  | 'Luxury'
  | 'Corporate'
  | 'Editorial'
  | 'Cinematic'
  | 'Bold'
  | 'Gen Z'
  | 'Premium'
  | 'Futuristic'
  | 'Elegant'

export type VisualType = 'HERO' | 'SOCIAL_PREVIEW' | 'AD_CREATIVE' | 'THUMBNAIL' | 'ALTERNATE'
export type VisualAssetRole =
  | 'post_background'
  | 'campaign_concept_background'
  | 'hero_visual'
  | 'draft_visual_asset'
  | 'final_composited_ad'

export interface VisualContext {
  // User-selected layout choices (kept for backward compat)
  visualType: VisualType
  visualStyle: VisualStyle
  // Campaign fields
  campaignName?: string
  campaignGoal?: string
  campaignTone?: string
  audience?: string
  // Brand Brain — primary drivers of visual quality
  brandName?: string
  brandToneWords?: string[]
  primaryOffer?: string
  industry?: string
  colorPalette?: string       // e.g. "deep blue, #4f46e5, gold"
  visualStylePref?: string
  uniqueAdvantages?: string
  // Strategy fields
  positioning?: string
  visualDirection?: string
  differentiation?: string
  keyMessage?: string
  // Post-level creative brief — THIS is the primary driver
  postCaption?: string
  /**
   * Post-specific art direction produced by the content plan. Keep this
   * separate from the caption so a broad SaaS category can never flatten five
   * different posts into the same generic "people around glowing data" scene.
   */
  creativeDirection?: string
  // Platform (passed from route for dimension-aware composition)
  platform?: string           // META | INSTAGRAM | TIKTOK | LINKEDIN
  // Creative planning hints from CREATIVE-REQ1 / CREATIVE-TEMPLATE1
  creativeRequirement?: Partial<CreativeRequirement>
  creativeTemplate?: Partial<CreativeTemplateSpec>
  assetRole?: VisualAssetRole
}

export const IMAGE_OUTPUT_CLASSIFICATION = 'draft_background_for_review'

export const TEXT_FREE_BACKGROUND_IMAGE_CONSTRAINTS = `TEXT-FREE BACKGROUND CONTRACT:
- Generate a background, scene, or hero visual asset for review only.
- Exclude all text, words, letters, numbers, typography, Arabic calligraphy, and no Arabic raster text.
- Do not include logos, brand marks, CTA buttons, badges, proof labels, watermarks, fake metrics, charts, dashboards, UI screenshots, or platform screenshots.
- Do not invent product claims, testimonials, awards, results, performance proof, or analytics.
- Leave clean negative space for later editable/composited headline, CTA, logo, badge, and proof layers.
- This generated asset is a draft background visual for review, not final ad creative, not a published post, and not a platform-ready ad.`

const NON_RASTER_SAFE_CONCEPT_PATTERN = /\b(?:ui|screens?|interfaces?|dashboards?|diagrams?|charts?|graphs?|infographics?|icons?|metric\s*cards?|data\s*visualizations?|glass\s*boards?|signage|signs?|logos?|words?|letters?|numbers?|typography|reports?|laptops?|computers?|digital\s*devices?)\b|(?:واجهة|واجهات|شاشة|شاشات|لوحة\s*معلومات|لوحات\s*معلومات|مخطط|مخططات|رسم\s*بياني|رسوم\s*بيانية|إنفوجرافيك|انفوجرافيك|أيقونات|ايقونات|رموز|تقارير|حاسوب|كمبيوتر|لابتوب|أجهزة\s*رقمية|نص|نصوص|شعار|شعارات|حروف|أرقام)/i

/**
 * Image models often turn dashboards, charts, and infographic requests into
 * invented raster text or fake metrics. Convert those directions into a
 * tangible scene before the provider ever sees them.
 */
export function normalizeTextFreeCentralElement(
  centralElement: string,
  category: BrandCategory,
  sourceText = centralElement,
): string {
  const clean = centralElement.replace(/\s+/g, ' ').trim()
  if (clean && !NON_RASTER_SAFE_CONCEPT_PATTERN.test(clean)) return clean

  const semanticSource = `${sourceText} ${clean}`.toLowerCase()

  // Unsafe diagram/UI requests still carry useful semantic intent. Translate
  // that intent into a concrete, text-free physical metaphor instead of
  // replacing every SaaS request with one category-level stock scene.
  if (/monthly|purchased|billing cycle|credit pools?|plan credits?|شهري|الشهرية|المشت(?:رى|راة)|دورة الباقة|نوع الرصيد/i.test(semanticSource)) {
    return 'two clearly separated physical reservoirs of blank metallic tokens: one beside a circular renewal ring and one inside a durable transparent vault, with a precise divider between them and generous negative space'
  }

  if (/credits?|ledger|quoted cost|metered action|pricing|balance|كريديت|أرصدة|رصيد|تكلفة|خصم|سجل/i.test(semanticSource)) {
    return 'three distinct tactile stations arranged left to right: a small stack of blank metallic tokens beside a quotation tile, one illuminated confirmation gate, and a sealed archive of blank ledger cards, connected by one precise physical path'
  }

  if (/brand brain|positioning|voice|verified claims?|restrictions?|channel drafts?|تموضع|النبرة|ادعاءات موثقة|القيود|مسودات القنوات/i.test(semanticSource)) {
    return 'one central translucent sculptural core receiving four distinct blank material inputs, then branching into three differently shaped channel frames, with a visible human review gate before the frames and no screens or lettering'
  }

  if (/ownership|capacity|handoffs?|approval|assignments?|operations?|ملكية|السعة|تسليم|الموافقات|المهام|التشغيل/i.test(semanticSource)) {
    return 'three-person operations team passing distinct blank task blocks through clearly separated work lanes toward one physical review gate, with visible unused lane capacity and an uncluttered premium workspace'
  }

  if (/workflow|strategy|execution|results?|stages?|سير العمل|الاستراتيجية|التنفيذ|النتائج|المراحل/i.test(semanticSource)) {
    return 'six distinct tactile stages forming one governed physical path from a central brand core through planning blocks and a human review gate to a final measurement vessel, with every stage visually separate and no screens'
  }

  if (category === 'saas_ai_tech' || category === 'agency_consultancy') {
    return 'focused marketing and product team collaborating around a clean table, arranging blank color-coded wooden tiles and luminous physical connection nodes into an orderly path, premium uncluttered workspace'
  }
  if (category === 'finance') {
    return 'precise ascending architectural forms in brushed gold beside a confident advisor in a refined dark environment, polished tactile materials and generous negative space'
  }
  if (category === 'education') {
    return 'mentor and learner arranging tactile building blocks in a bright modern studio, warm natural light and generous negative space'
  }

  return 'people arranging blank tactile geometric objects in a polished professional environment to express progress and collaboration, uncluttered surfaces and generous negative space'
}

// ─── Brand category detection ─────────────────────────────────────────────────

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  saas_ai_tech: [
    'saas', 'software', 'ai', 'artificial intelligence', 'machine learning',
    'platform', 'app', 'application', 'digital', 'tech', 'technology',
    'automation', 'crm', 'analytics', 'data', 'cloud', 'b2b', 'dashboard',
    'workflow', 'agent', 'martech', 'operating system', 'startup', 'api',
    'nexus', 'plugin', 'integration', 'devops', 'cybersecurity',
  ],
  real_estate: [
    'real estate', 'property', 'realty', 'housing', 'apartments', 'villas',
    'condos', 'townhouse', 'mortgage', 'residential', 'commercial property',
    'land', 'broker', 'developer', 'rental', 'leasing', 'عقارات', 'عقار',
  ],
  food_beverage: [
    'restaurant', 'café', 'cafe', 'food', 'beverage', 'bakery', 'catering',
    'coffee', 'bar', 'dining', 'cuisine', 'meal', 'menu', 'chef', 'bistro',
    'delivery', 'takeaway', 'grocery', 'snack', 'dessert', 'مطعم', 'مقهى',
  ],
  health_wellness: [
    'clinic', 'medical', 'health', 'wellness', 'fitness', 'gym', 'pharmacy',
    'dental', 'doctor', 'hospital', 'therapy', 'nutrition', 'supplement',
    'spa', 'rehab', 'physiotherapy', 'mental health', 'yoga', 'عيادة', 'صحة',
  ],
  retail_fashion: [
    'retail', 'fashion', 'clothing', 'boutique', 'store', 'e-commerce',
    'apparel', 'accessories', 'jewelry', 'shoes', 'collection', 'wardrobe',
    'style', 'beauty', 'cosmetics', 'skincare', 'ملابس', 'متجر',
  ],
  agency_consultancy: [
    'agency', 'consultancy', 'consulting', 'marketing agency', 'design studio',
    'branding', 'creative agency', 'pr agency', 'advertising', 'digital agency',
    'media agency', 'strategy firm', 'management consulting',
  ],
  education: [
    'school', 'academy', 'courses', 'e-learning', 'tutoring', 'training',
    'university', 'college', 'learning', 'education', 'bootcamp', 'workshop',
    'certification', 'coaching', 'skills', 'teaching', 'تعليم', 'أكاديمية',
  ],
  finance: [
    'finance', 'investment', 'banking', 'insurance', 'fintech', 'trading',
    'wealth', 'fund', 'portfolio', 'accounting', 'tax', 'crypto', 'financial',
    'stock', 'broker', 'venture capital', 'استثمار', 'مالية',
  ],
}

export type BrandCategory =
  | 'saas_ai_tech'
  | 'real_estate'
  | 'food_beverage'
  | 'health_wellness'
  | 'retail_fashion'
  | 'agency_consultancy'
  | 'education'
  | 'finance'
  | 'general'

export interface BrandDetectionContext {
  industry?: string
  brandName?: string
  campaignName?: string
  primaryOffer?: string
  positioning?: string
  differentiation?: string
}

export function detectBrandCategory(ctx: BrandDetectionContext): BrandCategory {
  const text = [
    ctx.industry, ctx.brandName, ctx.campaignName, ctx.primaryOffer,
    ctx.positioning, ctx.differentiation,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(kw => text.includes(kw))) {
      return category as BrandCategory
    }
  }
  return 'general'
}

// ─── Industry visual styles ───────────────────────────────────────────────────

interface IndustryStyle {
  photography: string
  lighting:    string
  mood:        string
  atmosphere:  string
  benchmark:   string
}

const INDUSTRY_STYLES: Record<string, IndustryStyle> = {
  food_beverage: {
    photography: 'cinematic food photography, Michelin-star presentation quality, appetizing hero close-up',
    lighting:    'warm golden-hour ambient light, steam effects, shallow depth-of-field bokeh, rich texture',
    mood:        'indulgent, sensory, warm, authentic, mouth-watering',
    atmosphere:  'restaurant ambiance, culinary artistry, inviting warmth, rich food textures',
    benchmark:   'Nobu, Deliveroo Premium, Four Seasons Restaurant advertising',
  },
  health_wellness: {
    photography: 'clean editorial healthcare and wellness photography with human warmth',
    lighting:    'crisp cool-white clinical light balanced with warm human touches, conveying hope and precision',
    mood:        'trustworthy, healing, professional, compassionate, innovative',
    atmosphere:  'modern medical facility, wellness sanctuary, precision and care, clean open spaces',
    benchmark:   'Mayo Clinic, Apple Health, Headspace, Therabody premium campaigns',
  },
  real_estate: {
    photography: 'architectural and luxury interior / exterior photography',
    lighting:    'golden-hour property photography or bright airy natural-light interiors',
    mood:        'aspirational, premium, lifestyle-defining, investment-grade, exclusive',
    atmosphere:  'luxury finishes, spacious layouts, prestigious locations, lifestyle imagery',
    benchmark:   "Sotheby's International Realty, Emaar Properties, Airbnb Luxe advertising",
  },
  saas_ai_tech: {
    photography: 'clean minimal premium tech brand advertising built from tactile geometric forms, luminous physical connection nodes, and an abstract soft gradient background',
    lighting:    'cinematic soft gradient light with brand color depth, subtle atmospheric glow, generous negative space',
    mood:        'powerful, innovative, empowering, intelligent, premium, elegant',
    atmosphere:  'clean dark gradient background with subtle abstract geometric light shapes and professional open negative space',
    benchmark:   'award-winning minimal premium software campaign advertising with precise art direction',
  },
  retail_fashion: {
    photography: 'editorial fashion photography or luxury product hero shot',
    lighting:    'dramatic studio lighting with rim highlights or moody editorial side light',
    mood:        'confident, aspirational, stylish, luxurious, statement-making',
    atmosphere:  'high-fashion editorial, premium retail aesthetic, aspirational lifestyle',
    benchmark:   'Vogue editorial, Gucci, Balenciaga, Zara premium campaign advertising',
  },
  agency_consultancy: {
    photography: 'clean minimal premium brand advertising with purposeful human collaboration, tactile planning objects, and abstract editorial depth',
    lighting:    'dramatic soft directional light, creative depth, bold contrast with generous negative space',
    mood:        'intelligent, results-driven, creative, confident, premium',
    atmosphere:  'clean minimal abstract background with strategic visual metaphors and premium editorial negative space',
    benchmark:   'award-winning global creative agency campaign advertising with disciplined editorial art direction',
  },
  education: {
    photography: 'inspiring learning environment or knowledge journey editorial photography',
    lighting:    'bright, clean, hopeful — natural or warm studio light with optimism',
    mood:        'inspiring, empowering, growth-focused, accessible, forward-looking',
    atmosphere:  'motivational learning spaces, knowledge and possibility, clear path to growth',
    benchmark:   'Coursera, MasterClass, Harvard Extension, Duolingo premium campaigns',
  },
  finance: {
    photography: 'premium financial brand photography — abstract wealth, growth, or trust imagery',
    lighting:    'authoritative cool professional tones with warm gold-accent highlights',
    mood:        'trustworthy, authoritative, premium, growth-focused, stable',
    atmosphere:  'wealth management precision, financial confidence, exclusive professional club',
    benchmark:   'Goldman Sachs, American Express Platinum, Bloomberg premium ads',
  },
  general: {
    photography: 'clean premium commercial photography with professional production value and open negative space',
    lighting:    'dramatic soft studio lighting with clear focal point and atmospheric depth',
    mood:        'professional, premium, trustworthy, aspirational',
    atmosphere:  'polished brand environment with clear visual hierarchy, premium feel, and clean negative space for typography',
    benchmark:   'Fortune 500 brand advertising quality',
  },
}

// ─── Color mood parser ────────────────────────────────────────────────────────

function parseColorMood(palette: string): string {
  if (!palette) return 'deep premium dark tones with sophisticated accents'
  const lower = palette.toLowerCase()

  const hex = palette.match(/#([0-9a-fA-F]{6})/)?.[1]
  if (hex) {
    const r = parseInt(hex.slice(0, 2), 16)
    const g = parseInt(hex.slice(2, 4), 16)
    const b = parseInt(hex.slice(4, 6), 16)
    if (r > 160 && r > g * 1.6 && r > b * 1.6) return 'bold passionate crimson-red atmosphere, deep red accents'
    if (b > 160 && b > r * 1.4 && b > g * 1.2) return 'deep trusted navy-blue atmosphere, cool professional tones'
    if (g > 160 && g > r * 1.3 && g > b * 1.3) return 'fresh natural emerald-green atmosphere, organic growth tones'
    if (r > 140 && g > 100 && b < 90)           return 'warm golden-amber luxury atmosphere, rich organic tones'
    if (r > 110 && b > 110 && g < 90)           return 'premium deep violet-purple atmosphere, creative luminous accents'
    if (r > 200 && g > 160 && b < 80)           return 'luxury gold and warm amber atmosphere, premium metallic tones'
    if (r < 60  && g < 60  && b < 60)           return 'premium deep black and charcoal atmosphere, high contrast'
    if (r > 200 && g > 200 && b > 200)          return 'clean premium white and light atmosphere, airy minimal tones'
  }

  if (lower.match(/purple|violet|indigo/))   return 'premium deep violet-purple atmosphere, creative luminous accents'
  if (lower.match(/blue|navy|cobalt/))        return 'deep trusted navy-blue atmosphere, cool professional tones'
  if (lower.match(/red|crimson|scarlet/))     return 'bold passionate crimson atmosphere, high-energy red tones'
  if (lower.match(/green|emerald|forest/))    return 'fresh natural emerald-green atmosphere, organic growth tones'
  if (lower.match(/gold|amber|orange/))       return 'warm golden-amber luxury atmosphere, rich premium tones'
  if (lower.match(/black|dark|charcoal/))     return 'premium deep black and charcoal atmosphere, high contrast'
  if (lower.match(/white|clean|minimal/))     return 'clean premium white and light atmosphere, airy tones'
  if (lower.match(/pink|rose/))               return 'soft romantic rose-pink atmosphere, feminine premium tones'
  if (lower.match(/teal|cyan|mint/))          return 'fresh modern teal-cyan atmosphere, contemporary tones'

  return `${palette.slice(0, 60)} brand color atmosphere with premium depth`
}

// ─── Platform composition hint ────────────────────────────────────────────────

function getPlatformHint(platform?: string): string {
  const p = (platform || 'META').toUpperCase()
  if (p === 'TIKTOK')    return 'vertical portrait format (9:16), tall composition, focal point in upper-center'
  if (p === 'LINKEDIN')  return 'wide landscape format (16:9), professional horizontal layout, strong visual flow'
  if (p === 'INSTAGRAM') return 'square format (1:1), balanced centered composition, social-media native hierarchy'
  return 'versatile square or near-square composition, balanced centered layout'
}

function buildTemplateHint(template?: Partial<CreativeTemplateSpec>): string {
  if (!template) return ''
  const lines = [
    template.templateName && `Template: ${template.templateName}`,
    template.aspectRatio && `Template aspect ratio: ${template.aspectRatio}`,
    template.width && template.height && `Template canvas: ${template.width}x${template.height}`,
    template.format && `Template format: ${template.format}`,
    template.safeZones && `Respect safe zones: top ${template.safeZones.top}px, right ${template.safeZones.right}px, bottom ${template.safeZones.bottom}px, left ${template.safeZones.left}px.`,
    template.layers?.length && `Background must leave room for editable layers: ${template.layers
      .filter(layer => layer.type !== 'background' && layer.required)
      .map(layer => `${layer.type} at ${layer.position.anchor}`)
      .join(', ')}.`,
  ].filter(Boolean)

  return lines.length ? `\nTEMPLATE / LAYER HINTS:\n${lines.join('\n')}` : ''
}

function buildCreativeRequirementHint(requirement?: Partial<CreativeRequirement>): string {
  if (!requirement) return ''
  const lines = [
    requirement.visualConcept
      && !NON_RASTER_SAFE_CONCEPT_PATTERN.test(requirement.visualConcept)
      && `Visual concept: ${requirement.visualConcept}`,
    requirement.objective && `Campaign objective: ${requirement.objective}`,
    requirement.funnelStage && `Funnel stage: ${requirement.funnelStage}`,
    requirement.contentAngle && `Content angle: ${requirement.contentAngle}`,
    requirement.requiredAssetType && `Required asset type: ${requirement.requiredAssetType}`,
    requirement.sourcePreference && `Source preference: ${requirement.sourcePreference}`,
    requirement.aspectRatio && `Recommended aspect ratio: ${requirement.aspectRatio}`,
    requirement.platform && `Requirement platform: ${requirement.platform}`,
    typeof requirement.textOverlayNeeded === 'boolean' && `Text overlay planned later: ${requirement.textOverlayNeeded ? 'yes' : 'no'}`,
    typeof requirement.logoNeeded === 'boolean' && `Logo layer planned later: ${requirement.logoNeeded ? 'yes' : 'no'}`,
    typeof requirement.productImageNeeded === 'boolean' && `Product image needed: ${requirement.productImageNeeded ? 'yes' : 'no'}`,
    requirement.proofConstraints?.length && `Proof constraints: ${requirement.proofConstraints.join(' | ')}`,
  ].filter(Boolean)

  return lines.length ? `\nCREATIVE REQUIREMENT HINTS:\n${lines.join('\n')}` : ''
}

function buildRoleHint(assetRole?: VisualAssetRole): string {
  const role = assetRole || 'draft_visual_asset'
  const label = role.replace(/_/g, ' ')
  return `\nASSET ROLE: ${label}. Output classification: ${IMAGE_OUTPUT_CLASSIFICATION}.`
}

export function wrapPromptWithTextFreeBackgroundContract(prompt: string): string {
  return `${prompt.trim()}

${TEXT_FREE_BACKGROUND_IMAGE_CONSTRAINTS}`.trim()
}

/**
 * Reference work is not ordinary text-to-image generation. The uploaded asset
 * is immutable evidence, including any real UI or packaging text already
 * visible inside it. Keep this prompt separate from the background prompt so
 * "no dashboards/screens" can never fight the user's source of truth.
 */
export function buildReferencePreservingEditPrompt(input: {
  campaignMessage?: string | null
  creativeDirection?: string | null
  platform?: string | null
  brandName?: string | null
  referenceEvidence?: unknown
}): string {
  const clean = (value: unknown, max: number) => typeof value === 'string'
    ? value.replace(/\s+/g, ' ').trim().slice(0, max)
    : ''
  const message = clean(input.campaignMessage, 900)
  const direction = clean(input.creativeDirection, 700)
  const brandName = clean(input.brandName, 80) || 'the brand'
  const platform = clean(input.platform, 40) || 'social feed'

  return `Create one premium ${platform} advertising visual for ${brandName} using the supplied image as an immutable hero asset.

SOURCE-OF-TRUTH CONTRACT:
- Preserve the supplied product, packaging, device, screen, person, geometry, colours, labels, logo placement, proportions, materials, and distinctive details exactly.
- If the source contains a real screen, dashboard, interface, logo, label, or text, keep that source content legible and unchanged. Never redraw or rewrite it.
- Do not replace the source with a metaphor, illustration, different device, different product, or newly invented interface.
- Do not add new raster text, captions, CTA buttons, badges, metrics, logos, watermarks, claims, awards, testimonials, or certifications.
- Change only the surrounding scene, lighting, depth, and crop needed to create a disciplined premium composition. Keep the source clearly dominant and recognizable.

CAMPAIGN MEANING (art direction only; do not render this copy):
${message || 'A premium, trustworthy brand moment.'}

CREATIVE DIRECTION:
${direction || 'Realistic commercial lighting, controlled depth, clean negative space, and a high-budget editorial advertising finish.'}

KNOWN SOURCE EVIDENCE:
${JSON.stringify(input.referenceEvidence ?? {}).slice(0, 2200)}

QUALITY BAR:
The result must look like a real agency-produced advertisement while remaining visibly the exact supplied source. Product/source fidelity is more important than novelty.`
}

// ─── English prompt builder ───────────────────────────────────────────────────

function buildEnglishAdPrompt(
  ctx: VisualContext,
  concept: VisualConcept,
  colorMood: string,
  style: IndustryStyle
): string {
  const platformHint = getPlatformHint(ctx.platform)
  const toneWords    = (ctx.brandToneWords || []).slice(0, 3).join(', ')
  const requirementHint = buildCreativeRequirementHint(ctx.creativeRequirement)
  const templateHint = buildTemplateHint(ctx.creativeTemplate)
  const roleHint = buildRoleHint(ctx.assetRole)

  return wrapPromptWithTextFreeBackgroundContract(`Create a world-class professional advertising BACKGROUND VISUAL.
Text, headlines, and brand copy will be composited as a separate layer — DO NOT include any
text, words, letters, numbers, logos, or typography anywhere in the image.

ADVERTISEMENT QUALITY: ${style.benchmark} level — advertising agency production, not stock photography.

CENTRAL VISUAL SCENE:
${concept.centralElement}

ATMOSPHERE & BACKGROUND:
${colorMood} as the dominant atmospheric color tone.
${style.photography}.
Lighting: ${style.lighting}.
Mood: ${concept.visualMood}.
${style.atmosphere}.

EMOTIONAL TONE: ${concept.emotion}${toneWords ? `. Brand voice: ${toneWords}` : ''}.
${requirementHint}${templateHint}${roleHint}

VISUAL COMPOSITION:
• ${platformHint}
• Clear visual hierarchy: one dominant hero element, supporting context, atmospheric depth
• Leave clean open negative space (lower 35–45% of the frame) for text overlay
• Soft gradient fade toward the bottom for text legibility
• Cinematic depth of field — foreground richness with atmospheric background
• Premium feel throughout — high-budget campaign aesthetic

CRITICAL: Absolutely NO text, NO words, NO letters, NO numbers, NO watermarks, NO logos,
NO typography of any kind anywhere in the image. The scene must be 100% visual, zero text.
This is background art — all copy will be added programmatically on top.

QUALITY BAR:
This image must look like a high-budget advertising campaign background.
Think: premium full-page magazine photo or top-tier social media visual without any overlaid text.
NOT acceptable: stock photography feel, generic backgrounds, flat composition, amateur layouts.`)
}

// ─── Arabic prompt builder ────────────────────────────────────────────────────

/**
 * Arabic ad background generator.
 *
 * Strategy: image models are unreliable at rendering Arabic text, so this builder
 * only asks for a background scene. Arabic copy remains a later editable/composited
 * layer outside the generated bitmap.
 */
function buildArabicAdPrompt(
  ctx: VisualContext,
  concept: VisualConcept,
  colorMood: string,
  style: IndustryStyle
): string {
  const platformHint = getPlatformHint(ctx.platform)
  const toneWords    = (ctx.brandToneWords || []).slice(0, 3).join(', ')
  const requirementHint = buildCreativeRequirementHint(ctx.creativeRequirement)
  const templateHint = buildTemplateHint(ctx.creativeTemplate)
  const roleHint = buildRoleHint(ctx.assetRole)

  return wrapPromptWithTextFreeBackgroundContract(`Create a world-class professional advertising BACKGROUND VISUAL.
This image is for an Arabic-language advertisement targeting Arabic-speaking audiences.
Typography and Arabic text will be composited as a separate layer — DO NOT include any text,
words, letters, or typography anywhere in the image.

ADVERTISEMENT QUALITY: ${style.benchmark} standard.

CENTRAL VISUAL SCENE:
${concept.centralElement}

VISUAL STYLE & ATMOSPHERE:
${colorMood} as the dominant atmospheric color.
${style.photography}.
Lighting: ${style.lighting}.
Overall mood: ${concept.visualMood}.
${style.atmosphere}.

COMPOSITION:
• ${platformHint}
• Leave clean open negative space in the lower 35–45% of the image for text overlay
• Upper portion: hero visual scene with atmospheric depth
• Soft gradient fade toward bottom to ensure text legibility

CRITICAL REQUIREMENT:
Absolutely NO text, NO words, NO Arabic calligraphy, NO numbers, NO letters anywhere.
This must be a pure photographic / illustrative background.

EMOTIONAL TONE: ${concept.emotion}${toneWords ? `. Brand voice: ${toneWords}` : ''}.
${requirementHint}${templateHint}${roleHint}

QUALITY BAR: ${style.benchmark} background visual.
Reference aesthetic: premium Middle Eastern campaign photography with disciplined art direction and uncluttered editorial composition.`)
}

// ─── Brand-level fallback (no caption) ───────────────────────────────────────

function buildBrandLevelPrompt(
  ctx: VisualContext,
  colorMood: string,
  style: IndustryStyle,
  language: 'ar' | 'en'
): string {
  const platformHint = getPlatformHint(ctx.platform)
  const offer        = ctx.primaryOffer || ctx.positioning || ctx.keyMessage || ''
  const requirementHint = buildCreativeRequirementHint(ctx.creativeRequirement)
  const templateHint = buildTemplateHint(ctx.creativeTemplate)
  const roleHint = buildRoleHint(ctx.assetRole)

  if (language === 'ar') {
    return wrapPromptWithTextFreeBackgroundContract(`Create a premium brand advertising BACKGROUND VISUAL.
${offer ? `Brand context: ${offer}` : ''}
Style: ${style.photography}. ${style.lighting}.
Atmosphere: ${colorMood}. ${style.atmosphere}.
Quality: ${style.benchmark} advertising level.
${platformHint}.
${requirementHint}${templateHint}${roleHint}
Create a polished hero scene with clean negative space for later editable Arabic headline, CTA, logo, and proof layers.`)
  }

  return wrapPromptWithTextFreeBackgroundContract(`Create a premium brand advertising BACKGROUND VISUAL.
${offer ? `Brand context: "${offer}"` : ''}
Style: ${style.photography}. ${style.lighting}.
Atmosphere: ${colorMood}. ${style.atmosphere}.
Quality: ${style.benchmark} advertising level.
${platformHint}.
${requirementHint}${templateHint}${roleHint}
Create a polished hero scene with clean negative space for later editable headline, CTA, logo, and proof layers.`)
}

// ─── Main async prompt builder ────────────────────────────────────────────────

/**
 * Build a professional advertising prompt from Brand Brain + post caption.
 *
 * This is the core function that powers ALL image generation in NEXUS.
 * Returns the prompt string, detected language, AND the extracted visual concept
 * so downstream callers can preserve post-specific visual direction while keeping
 * generated bitmaps text-free.
 */
export async function buildImagePrompt(ctx: VisualContext): Promise<{
  prompt: string
  language: 'ar' | 'en'
  concept?: VisualConcept
}> {
  // 1. Determine caption text to analyze
  const captionText = ctx.postCaption
    || ctx.keyMessage
    || ctx.primaryOffer
    || ctx.campaignName
    || ''
  const conceptText = [ctx.creativeDirection, captionText]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .join('\n')

  // 2. Detect language
  const language = detectLanguage(captionText)

  // 3. Get industry style
  const category = detectBrandCategory(ctx)
  const style    = INDUSTRY_STYLES[category] || INDUSTRY_STYLES.general

  // 4. Parse brand color mood
  const rawPalette = Array.isArray(ctx.colorPalette)
    ? (ctx.colorPalette as string[]).join(', ')
    : (ctx.colorPalette || '')
  const colorMood = parseColorMood(rawPalette)

  if (process.env.NODE_ENV !== 'production') {
    console.log(`[imageGen] category=${category} language=${language} platform=${ctx.platform || 'META'}`)
  }

  // 5. No text → use brand-level prompt (no concept extraction needed)
  if (!conceptText.trim()) {
    const prompt = buildBrandLevelPrompt(ctx, colorMood, style, language)
    return { prompt, language }
  }

  // 6. Extract the visual concept deterministically. The only paid provider
  // call in the image action is the image generation request itself.
  const extractedConcept = await extractVisualConcept({
    text:      conceptText,
    industry:  ctx.industry || category,
    brandName: ctx.brandName || 'Brand',
    language,
  })
  const concept: VisualConcept = {
    ...extractedConcept,
    centralElement: normalizeTextFreeCentralElement(extractedConcept.centralElement, category, conceptText),
  }

  if (process.env.NODE_ENV !== 'production') {
    console.log(`[imageGen] headline="${concept.headline}" | scene="${concept.centralElement.slice(0, 80)}..."`)
  }

  // 7. Build the prompt for the correct language.
  //    Both paths produce background-only prompts for later editable/composited layers.
  const prompt = language === 'ar'
    ? buildArabicAdPrompt(ctx, concept, colorMood, style)
    : buildEnglishAdPrompt(ctx, concept, colorMood, style)

  return { prompt, language, concept }
}

// ─── Image generation ─────────────────────────────────────────────────────────

/**
 * Generate a final-quality image via GPT Image 2.
 * Returns a data URI (base64 PNG).
 */
export async function generateWithDallE(
  prompt: string,
  size: '1024x1024' | '1024x1536' | '1536x1024' = '1536x1024'
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured')

  if (process.env.NODE_ENV !== 'production') {
    console.log('[imageGen] gpt-image-2 | size:', size, '| prompt:', prompt.slice(0, 200) + '…')
  }

  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model:   process.env.OPENAI_IMAGE_MODEL || 'gpt-image-2',
      prompt,
      n:       1,
      size,
      quality: 'high',
    }),
    // High-quality output can take several minutes. Callers run this behind a
    // durable polled job, so a short browser-style timeout would create false
    // failures and unnecessary provider retries.
    signal: AbortSignal.timeout(240_000),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(
      (err as { error?: { message?: string } })?.error?.message
      || `Image generation API error: ${response.status}`
    )
  }

  const data = await response.json()
  const b64  = (data as { data?: Array<{ b64_json?: string }> })?.data?.[0]?.b64_json
  if (!b64) throw new Error('Image generation returned no image data')

  return `data:image/png;base64,${b64}`
}

/**
 * Turn an owned product/reference image into a campaign scene while preserving
 * the source object. This intentionally has no text-only fallback: returning a
 * pretty image with the wrong product is a failed result, not a degradation.
 */
export async function generateWithOpenAIImageEdit(
  prompt: string,
  referenceImageUrl: string,
  size: '1024x1024' | '1024x1536' | '1536x1024' = '1536x1024',
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured')
  const model = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-2'

  if (!referenceImageUrl.startsWith('https://res.cloudinary.com/')) {
    throw new Error('Reference image must be an owned, durable Cloudinary image')
  }

  const referenceResponse = await fetch(referenceImageUrl, {
    signal: AbortSignal.timeout(12_000),
  })
  if (!referenceResponse.ok) throw new Error('Reference image could not be loaded')
  const contentType = referenceResponse.headers.get('content-type') || 'image/png'
  if (!contentType.startsWith('image/')) throw new Error('Reference asset is not an image')
  const referenceBuffer = await referenceResponse.arrayBuffer()
  if (referenceBuffer.byteLength > 20 * 1024 * 1024) {
    throw new Error('Reference image exceeds the 20 MB editing limit')
  }

  const form = new FormData()
  form.append('model', model)
  form.append('prompt', `${prompt}\n\nREFERENCE FIDELITY CONTRACT:\nTreat the supplied image as the exact product source of truth. Preserve its geometry, packaging, colour, label, logo placement, proportions, materials, and distinctive details. Change only the surrounding advertising scene, lighting, and composition. Do not redesign, relabel, recolour, duplicate, deform, or replace the product. Do not add claims or text inside the generated pixels.`)
  form.append('size', size)
  form.append('quality', 'high')
  // gpt-image-2 always processes references at high fidelity and rejects the
  // legacy input_fidelity parameter. Earlier GPT Image models still accept it.
  if (model !== 'gpt-image-2') form.append('input_fidelity', 'high')
  form.append('n', '1')
  const extension = contentType.includes('jpeg') || contentType.includes('jpg')
    ? 'jpg'
    : contentType.includes('webp')
      ? 'webp'
      : 'png'
  // The current Image Edit multipart contract uses image[] for GPT Image
  // inputs. A real extension also prevents ambiguous MIME inference upstream.
  form.append('image[]', new Blob([referenceBuffer], { type: contentType }), `reference-image.${extension}`)

  const response = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
    // The caller runs high-quality reference edits as a durable, polled job,
    // so the provider can use its documented multi-minute completion window
    // without keeping the browser request open.
    signal: AbortSignal.timeout(240_000),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(
      (err as { error?: { message?: string } })?.error?.message
      || `Image editing API error: ${response.status}`,
    )
  }

  const data = await response.json() as { data?: Array<{ b64_json?: string }> }
  const b64 = data.data?.[0]?.b64_json
  if (!b64) throw new Error('Image editing returned no image data')
  return `data:image/png;base64,${b64}`
}

// ─── Cloudinary upload ────────────────────────────────────────────────────────

/**
 * Upload a data URI or URL to Cloudinary for permanent storage.
 * Fails closed: callers must never persist a base64 payload or provider-
 * temporary URL as if it were durable media.
 */
export async function uploadToCloudinary(imageUrl: string, publicId: string): Promise<string> {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
  const apiKey    = process.env.CLOUDINARY_API_KEY
  const apiSecret = process.env.CLOUDINARY_API_SECRET

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error('Cloudinary permanent media storage is not configured')
  }

  const timestamp = Math.round(Date.now() / 1000)
  const folder    = 'nexus/visuals'

  const crypto    = await import('crypto')
  const sigStr    = `folder=${folder}&public_id=${publicId}&timestamp=${timestamp}`
  const signature = crypto.createHash('sha1').update(sigStr + apiSecret).digest('hex')

  const formData = new FormData()
  formData.append('file',      imageUrl)
  formData.append('public_id', publicId)
  formData.append('folder',    folder)
  formData.append('timestamp', String(timestamp))
  formData.append('api_key',   apiKey)
  formData.append('signature', signature)

  const uploadRes = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    { method: 'POST', body: formData, signal: AbortSignal.timeout(10_000) }
  )

  if (!uploadRes.ok) {
    const cloudErr = await uploadRes.json().catch(() => ({}))
    console.error('[imageGen] Cloudinary upload failed:', cloudErr)
    const message = (cloudErr as { error?: { message?: string } })?.error?.message
    throw new Error(message ? `Cloudinary upload failed: ${message}` : `Cloudinary upload failed: ${uploadRes.status}`)
  }

  const uploadData = await uploadRes.json()
  const secureUrl = (uploadData as { secure_url?: unknown }).secure_url
  if (typeof secureUrl !== 'string' || !secureUrl.startsWith('https://')) {
    throw new Error('Cloudinary upload returned no permanent HTTPS URL')
  }
  return secureUrl
}
