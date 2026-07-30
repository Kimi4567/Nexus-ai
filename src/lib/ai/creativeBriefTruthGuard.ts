/**
 * Deterministic truth guard for concept-only creative briefs.
 *
 * Concept mode has no owned product screenshots, customer footage, or verified
 * production assets. The model may still propose useful art direction, but it
 * must not turn that absence into invented UI, features, customer proof, or
 * outcome scenes.
 */

export interface ConceptImagePrompt {
  platform: string
  style: string
  prompt: string
  aspectRatio: string
  notes: string
}

export interface ConceptStoryboardScene {
  sceneNumber: number
  description: string
  visualNotes: string
  textOverlay: string
  duration: string
  platform: string
}

export interface ConceptCreativeBrief {
  imagePrompts?: ConceptImagePrompt[]
  storyboardScenes?: ConceptStoryboardScene[]
  productionBrief?: string
  moodDescription?: string
  colorDirections?: string[]
  platformLayouts?: Record<string, string>
  creativeNotes?: string
}

export interface ConceptCreativeBriefInput {
  imagePrompts?: Array<Partial<ConceptImagePrompt>>
  storyboardScenes?: Array<Partial<ConceptStoryboardScene>>
  productionBrief?: string
  moodDescription?: string
  colorDirections?: string[]
  platformLayouts?: Record<string, string>
  creativeNotes?: string
}

export interface CreativeBriefTruthContext {
  audience?: string
  campaignGoal?: string
  campaignName?: string
  brandName?: string
  brandPalette?: string
  allowedPlatforms?: string[]
}

function normalizedPlatform(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/giu, '_').replace(/^_+|_+$/g, '')
}

function displayPlatform(value: string): string {
  const normalized = normalizedPlatform(value)
  if (normalized.includes('youtube')) return 'YouTube Shorts'
  if (normalized.includes('linkedin')) return 'LinkedIn'
  if (normalized.includes('instagram')) return normalized.includes('stories') ? 'Instagram Stories' : 'Instagram Feed'
  if (normalized.includes('tiktok')) return 'TikTok'
  if (normalized.includes('facebook') || normalized === 'meta') return 'Facebook'
  if (normalized === 'x' || normalized.includes('twitter')) return 'X'
  if (normalized.includes('threads')) return 'Threads'
  if (normalized.includes('pinterest')) return 'Pinterest'
  return value.trim() || 'Campaign channel'
}

function platformKey(value: string): string {
  const normalized = normalizedPlatform(value)
  if (normalized.includes('youtube')) return 'youtube_shorts'
  if (normalized.includes('linkedin')) return 'linkedin'
  if (normalized.includes('instagram')) return normalized.includes('stories') ? 'instagram_stories' : 'instagram_feed'
  if (normalized.includes('tiktok')) return 'tiktok'
  if (normalized.includes('facebook') || normalized === 'meta') return 'facebook'
  if (normalized === 'x' || normalized.includes('twitter')) return 'x'
  if (normalized.includes('threads')) return 'threads'
  if (normalized.includes('pinterest')) return 'pinterest'
  return normalized || 'campaign_channel'
}

function platformRatio(platform: string): string {
  const normalized = normalizedPlatform(platform)
  if (normalized.includes('youtube') || normalized.includes('stories') || normalized.includes('tiktok')) return '9:16'
  if (normalized.includes('linkedin')) return '1.91:1'
  return '4:5'
}

function allowedPlatformList(context: CreativeBriefTruthContext): string[] {
  const values = Array.isArray(context.allowedPlatforms)
    ? context.allowedPlatforms.map(displayPlatform).filter(Boolean)
    : []
  return [...new Set(values.length ? values : ['Campaign channel'])]
}

function domainScene(context: CreativeBriefTruthContext): string {
  const corpus = [
    context.campaignName,
    context.campaignGoal,
    context.brandName,
    context.audience,
  ].filter(Boolean).join(' ')

  if (/cash\s*flow|invoice|receivable|collection|سيول|فاتور|تحصيل/iu.test(corpus)) {
    return 'abstract invoice cards, due-date markers, a cash-flow timeline, and connected review checkpoints'
  }
  if (/marketing|campaign|content|تسويق|حمل|محتوى/iu.test(corpus)) {
    return 'abstract campaign cards, channel markers, approval checkpoints, and a measured results timeline'
  }
  return 'abstract workflow cards, timeline markers, connectors, and neutral category symbols'
}

function safeConceptPrompt(context: CreativeBriefTruthContext, platform: string, index: number): string {
  const audience = context.audience?.trim() || 'the reviewed campaign audience'
  const scene = domainScene(context)
  const compositions = ['structured editorial grid', 'calm diagonal flow', 'centered modular system']
  return [
    `Editorial conceptual illustration for ${audience}, using ${scene}.`,
    `Use a ${compositions[index % compositions.length]} with restrained depth and a professional, evidence-neutral mood.`,
    `Prepare the composition for ${platform}.`,
    'No people, faces, hands, customers, product UI, dashboards, screens, devices, notifications, readable text, logos, testimonials, or implied performance outcomes.',
    'Keep copy, CTA, and brand marks as separate editable layers added only after review.',
  ].join(' ')
}

function safeVisualNotes(platform: string): string {
  return [
    `Use an abstract editorial composition sized for ${platform}.`,
    'Animate only neutral cards, connectors, markers, and light transitions.',
    'Do not show people, product use, interfaces, devices, notifications, readable text, logos, or outcome proof.',
  ].join(' ')
}

function safeLayout(platform: string): string {
  return [
    `Use a platform-compatible composition for ${platform} with one clear abstract focal system and generous safe zones.`,
    'Reserve headline, CTA, and brand layers for separate reviewed typography.',
    'Do not place generated readable text, product screens, people, or performance proof in the background.',
  ].join(' ')
}

export function guardConceptCreativeBrief(
  input: ConceptCreativeBriefInput,
  context: CreativeBriefTruthContext,
): ConceptCreativeBrief {
  const allowedPlatforms = allowedPlatformList(context)

  const imagePrompts = (Array.isArray(input.imagePrompts) ? input.imagePrompts : []).map((item, index) => {
    const platform = allowedPlatforms[index % allowedPlatforms.length]

    return {
      ...item,
      platform,
      style: 'Abstract editorial workflow system with neutral category symbols',
      aspectRatio: platformRatio(platform),
      prompt: safeConceptPrompt(context, platform, index),
      notes: 'Use only the reviewed abstract direction. Add copy, CTA, and brand marks later as editable layers.',
    }
  })

  const storyboardScenes = (Array.isArray(input.storyboardScenes) ? input.storyboardScenes : []).map((item, index) => {
    const platform = allowedPlatforms[index % allowedPlatforms.length]

    return {
      ...item,
      sceneNumber: index + 1,
      platform,
      duration: String(item.duration || '2-3 seconds').trim(),
      description: `Animate ${domainScene(context)} as a review-only editorial sequence; show no product use or customer result.`,
      visualNotes: safeVisualNotes(platform),
      textOverlay: 'none — add only reviewed copy later as a separate editable layer',
    }
  })

  const safePalette = context.brandPalette?.trim()
    ? context.brandPalette.trim()
    : 'neutral navy, restrained violet, slate, and warm off-white'

  const platformLayouts = Object.fromEntries(allowedPlatforms.map(platform => [
    platformKey(platform),
    safeLayout(platform),
  ]))

  const productionBrief = [
    `Produce review-only abstract editorial background plates using ${domainScene(context)}.`,
    `Use the reviewed palette (${safePalette}), controlled lighting, clean negative space, and separate editable layers for copy, CTA, and brand marks.`,
    'Do not source or depict talent, customers, experts, product screens, devices, notifications, readable text, logos, testimonials, or performance outcomes.',
    'The deliverable is a creative-planning reference, not proof of product behavior or campaign results.',
  ].join(' ')

  return {
    ...input,
    imagePrompts,
    storyboardScenes,
    productionBrief,
    moodDescription: 'A calm, precise editorial system that explains the reviewed workflow without depicting product use or customer outcomes.',
    colorDirections: [
      `Primary reviewed palette: ${safePalette}.`,
      'Use contrast for hierarchy, not as an implied performance signal.',
      'Keep background colors compatible with separate reviewed typography.',
      'Do not encode success, urgency, or conversion claims through decorative badges.',
    ],
    platformLayouts,
    creativeNotes: 'Use abstract workflow evidence only. Keep product UI, customer proof, features, results, copy, CTA, and brand marks behind their own reviewable source and layer decisions.',
  }
}
