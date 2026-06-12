/**
 * NEXUS Visual Quality System
 *
 * Deterministic category detection + structured creative briefs for ad-ready
 * image prompts. This layer keeps generated visuals tied to Brand Brain first,
 * then post/campaign context, without adding per-image classification cost.
 */

export type VisualCategory =
  | 'healthcare_medical'
  | 'food_hospitality'
  | 'real_estate_property'
  | 'beauty_wellness'
  | 'fitness_sports'
  | 'retail_fashion'
  | 'professional_services'
  | 'education_training'
  | 'technology_saas'
  | 'home_services_maintenance'
  | 'other_business'

export interface VisualQualityContext {
  brandName?: string
  industry?: string
  description?: string
  primaryOffer?: string
  targetAudience?: string
  brandToneWords?: string[]
  colorPalette?: string | string[]
  visualStylePref?: string
  campaignName?: string
  campaignGoal?: string
  campaignTone?: string
  positioning?: string
  visualDirection?: string
  differentiation?: string
  keyMessage?: string
  postCaption?: string
  platform?: string
}

export interface VisualBriefConcept {
  centralElement: string
  emotion: string
  headline?: string
  cta?: string
  visualMood: string
}

export interface VisualQualityChecklist {
  businessRelevant: boolean
  adReady: boolean
  brandConsistent: boolean
  clearSubject: boolean
  textSafeSpace: boolean
  lightingAppropriate: boolean
  categoryRisksAvoided: boolean
}

export interface VisualCreativeBrief {
  category: VisualCategory
  categoryLabel: string
  brandMood: string
  scene: string
  subject: string
  composition: string
  lighting: string
  colorPalette: string
  textSafeArea: string
  negativePrompt: string
  platformSize: string
  adObjective: string
  benchmark: string
  qualityChecklist: VisualQualityChecklist
}

export interface CategoryRule {
  label: string
  keywords: string[]
  preferredScenes: string
  subjectGuidance: string
  composition: string
  lighting: string
  benchmark: string
  avoid: string[]
  trustSafety: string
  adReadiness: string
}

const CATEGORY_RULES: Record<VisualCategory, CategoryRule> = {
  healthcare_medical: {
    label: 'Healthcare / Medical',
    keywords: [
      'clinic', 'medical', 'healthcare', 'health', 'doctor', 'hospital', 'dental',
      'dentist', 'pharmacy', 'therapy', 'physiotherapy', 'patient', 'عيادة', 'طبيب',
      'اسنان', 'أسنان', 'صحة',
    ],
    preferredScenes: 'bright clean modern clinic, professional doctor or dentist with patient interaction when relevant, warm care moment',
    subjectGuidance: 'clear human care subject when appropriate; trust, safety, confidence, precision',
    composition: 'clean clinical hero subject in upper half, calm open lower area for copy, uncluttered environment',
    lighting: 'bright soft clinical daylight, clean white light balanced with warm human tone',
    benchmark: 'Mayo Clinic, Cleveland Clinic, premium dental practice advertising',
    avoid: ['blood', 'scary equipment-only scene', 'empty dental chair as the hero', 'dark cinematic clinic', 'distorted faces or hands', 'medical gore'],
    trustSafety: 'must feel safe, calm, professional and medically trustworthy',
    adReadiness: 'show care outcome or professional confidence, not fear',
  },
  food_hospitality: {
    label: 'Food & Hospitality',
    keywords: [
      'restaurant', 'cafe', 'café', 'food', 'hospitality', 'hotel', 'bakery',
      'catering', 'coffee', 'dining', 'dish', 'chef', 'menu', 'dessert',
      'مطعم', 'مقهى', 'طعام', 'اكل', 'أكل',
    ],
    preferredScenes: 'appetizing hero dish, premium table setting, chef plating moment, or warm restaurant experience',
    subjectGuidance: 'one delicious focal point with realistic texture, steam or fresh ingredients where natural',
    composition: 'hero food subject with shallow depth of field and clean negative space for campaign text',
    lighting: 'warm inviting restaurant light, soft daylight or golden ambient highlights',
    benchmark: 'Nobu, Four Seasons dining, premium delivery campaign imagery',
    avoid: ['ugly closeups', 'messy plates', 'dark unappetizing food', 'fake plastic texture', 'dirty tables'],
    trustSafety: 'food must look fresh, clean, edible and realistic',
    adReadiness: 'make the viewer want to taste or book immediately',
  },
  real_estate_property: {
    label: 'Real Estate & Property',
    keywords: [
      'real estate', 'property', 'realty', 'apartment', 'villa', 'house', 'home',
      'penthouse', 'condo', 'broker', 'developer', 'mortgage', 'rent', 'leasing',
      'عقار', 'عقارات', 'شقة', 'فيلا', 'منزل',
    ],
    preferredScenes: 'bright premium interiors, clean architecture, elegant exterior facade, aspirational home lifestyle',
    subjectGuidance: 'premium property or lifestyle moment as the hero; spacious, clean, desirable',
    composition: 'architectural lines, wide clean framing, strong daylight, clear text-safe area',
    lighting: 'bright natural daylight or premium golden hour, never gloomy',
    benchmark: "Sotheby's International Realty, Emaar, Airbnb Luxe advertising",
    avoid: ['fake distorted buildings', 'messy rooms', 'dark interiors', 'clutter', 'warped windows', 'unrealistic architecture'],
    trustSafety: 'property must look credible, clean and high-value',
    adReadiness: 'sell aspiration, clarity and trust in the property offer',
  },
  beauty_wellness: {
    label: 'Beauty & Wellness',
    keywords: [
      'salon', 'beauty', 'spa', 'skincare', 'cosmetic', 'makeup', 'hair',
      'wellness', 'massage', 'aesthetic', 'nails', 'lashes', 'facial',
      'صالون', 'تجميل', 'سبا', 'بشرة', 'شعر',
    ],
    preferredScenes: 'premium salon or spa environment, skincare/product ritual, polished treatment moment, soft beauty editorial',
    subjectGuidance: 'clean product, hair, skin or service outcome with natural premium look',
    composition: 'soft editorial hero subject, clean surfaces, refined negative space',
    lighting: 'soft flattering daylight or premium studio light, luminous but realistic',
    benchmark: 'Aesop, Sephora, luxury salon and spa advertising',
    avoid: ['distorted faces', 'overprocessed skin', 'messy salon', 'medical-looking fear imagery', 'unrealistic before-after claims'],
    trustSafety: 'must feel clean, safe, tasteful and confidence-building',
    adReadiness: 'show polished self-care value without looking artificial',
  },
  fitness_sports: {
    label: 'Fitness & Sports',
    keywords: [
      'gym', 'fitness', 'sports', 'sport', 'training', 'workout', 'yoga',
      'pilates', 'coach', 'athlete', 'strength', 'run', 'running', 'عضلات',
      'جيم', 'رياضة', 'تمرين',
    ],
    preferredScenes: 'clean modern gym, athlete in confident movement, coached training moment, energetic lifestyle scene',
    subjectGuidance: 'strong natural body movement, clear action, healthy confidence',
    composition: 'dynamic hero action with clean background and text-safe side or lower area',
    lighting: 'bright energetic gym/studio light, crisp contrast without harsh darkness',
    benchmark: 'Nike Training Club, Equinox, premium sports brand campaigns',
    avoid: ['unsafe poses', 'distorted bodies', 'aggressive dark mood unless brand requires it', 'cluttered gym floor', 'body shaming cues'],
    trustSafety: 'must feel healthy, empowering and safe',
    adReadiness: 'create energy and motivation with a clear training outcome',
  },
  retail_fashion: {
    label: 'Retail & Fashion',
    keywords: [
      'fashion', 'clothing', 'retail', 'boutique', 'apparel', 'shoes', 'jewelry',
      'accessories', 'collection', 'style', 'store', 'ecommerce', 'e-commerce',
      'ملابس', 'أزياء', 'موضة', 'متجر',
    ],
    preferredScenes: 'editorial product or model composition, premium styling, fabric/detail hero shot',
    subjectGuidance: 'clear product, outfit, accessory or collection moment with stylish confidence',
    composition: 'fashion editorial framing with strong product visibility and negative space',
    lighting: 'clean studio light or refined editorial daylight with premium texture',
    benchmark: 'Vogue editorial, Zara premium campaigns, Net-a-Porter product advertising',
    avoid: ['warped clothing', 'distorted limbs', 'messy racks', 'cheap stock-photo styling', 'fake unreadable labels'],
    trustSafety: 'product should look wearable, real and desirable',
    adReadiness: 'make the item or style instantly understandable and shoppable',
  },
  professional_services: {
    label: 'Professional Services',
    keywords: [
      'consulting', 'consultancy', 'agency', 'law', 'legal', 'accounting',
      'marketing agency', 'branding', 'advisor', 'business services', 'b2b service',
      'استشارات', 'محاماة', 'تسويق',
    ],
    preferredScenes: 'premium professional environment, strategic work session, client confidence moment, abstract business outcome visual',
    subjectGuidance: 'competence, clarity and trust; avoid generic boardroom stock imagery',
    composition: 'clean strategic focal point, editorial negative space, premium business polish',
    lighting: 'bright professional light with restrained contrast and polished depth',
    benchmark: 'McKinsey, Ogilvy, Deloitte premium service advertising',
    avoid: ['generic handshake stock photo', 'cluttered office', 'fake charts with text', 'cold empty boardroom'],
    trustSafety: 'must communicate expertise and credibility',
    adReadiness: 'make the service outcome tangible and premium',
  },
  education_training: {
    label: 'Education & Training',
    keywords: [
      'education', 'school', 'academy', 'course', 'training', 'learning',
      'university', 'tutoring', 'bootcamp', 'workshop', 'coaching',
      'تعليم', 'أكاديمية', 'تدريب', 'دورة',
    ],
    preferredScenes: 'bright learning environment, student progress moment, modern classroom or online training setup',
    subjectGuidance: 'growth, clarity, confidence and practical skill-building',
    composition: 'hopeful hero learning moment with clean text area',
    lighting: 'bright optimistic daylight, warm and accessible',
    benchmark: 'MasterClass, Coursera, premium academy campaigns',
    avoid: ['boring empty classroom', 'dark lecture hall', 'fake unreadable certificates', 'overcrowded scene'],
    trustSafety: 'must feel credible, inclusive and growth-oriented',
    adReadiness: 'show transformation through learning',
  },
  technology_saas: {
    label: 'Technology / SaaS',
    keywords: [
      'saas', 'software', 'ai', 'artificial intelligence', 'platform', 'app',
      'automation', 'crm', 'analytics', 'dashboard', 'data', 'cloud', 'api',
      'workflow', 'agent', 'technology', 'tech', 'digital', 'ذكاء اصطناعي',
      'تقنية', 'برنامج',
    ],
    preferredScenes: 'premium abstract productivity visual, elegant workspace, clean product metaphor, subtle interface-inspired shapes without readable UI',
    subjectGuidance: 'clarity, intelligence, automation and business growth; no fake product screenshots',
    composition: 'minimal premium tech composition, strong negative space, refined depth',
    lighting: 'clean luminous studio or soft gradient light, brand-color accents without gloom',
    benchmark: 'Apple, Stripe, Linear, Vercel, Figma campaign imagery',
    avoid: ['random dashboards', 'fake unreadable UI text', 'floating widgets overload', 'dark generic tech blobs', 'cyberpunk clutter'],
    trustSafety: 'must feel reliable, intelligent and modern',
    adReadiness: 'show business outcome and product sophistication, not screens for their own sake',
  },
  home_services_maintenance: {
    label: 'Home Services / Maintenance',
    keywords: [
      'maintenance', 'repair', 'plumbing', 'cleaning', 'hvac', 'electrician',
      'renovation', 'painting', 'landscaping', 'home service', 'pest control',
      'صيانة', 'تنظيف', 'سباكة', 'كهرباء',
    ],
    preferredScenes: 'clean home service professional at work, tidy finished result, reliable technician interaction',
    subjectGuidance: 'trustworthy service expert, clean tools, solved problem',
    composition: 'clear service action or before-after-ready result with uncluttered text-safe area',
    lighting: 'bright practical daylight, clean and reassuring',
    benchmark: 'premium local service advertising, Angi and Thumbtack quality',
    avoid: ['dirty chaotic mess as main image', 'unsafe tool use', 'dark basement mood', 'distorted tools or hands'],
    trustSafety: 'must feel safe, reliable and professional',
    adReadiness: 'show reliability and the finished benefit',
  },
  other_business: {
    label: 'Other / Generic Business',
    keywords: [],
    preferredScenes: 'premium commercial brand scene tied to the explicit offer, clear product/service outcome, polished environment',
    subjectGuidance: 'one meaningful subject connected to the business, never random decoration',
    composition: 'clean premium ad layout with one dominant subject and strong negative space',
    lighting: 'bright polished commercial light unless brand explicitly asks for dark',
    benchmark: 'premium Fortune 500 advertising quality',
    avoid: ['empty meaningless scene', 'random abstract background', 'stock-photo feel', 'dark depressing mood', 'text or logos'],
    trustSafety: 'must feel credible and commercially useful',
    adReadiness: 'if category is unclear, stay offer-led and avoid inventing industry-specific details',
  },
}

const UNIVERSAL_AVOID = [
  'text', 'words', 'letters', 'numbers', 'typography', 'logo', 'watermark',
  'crowded composition', 'empty meaningless scene', 'random stock photo feel',
  'distorted faces', 'distorted hands', 'warped anatomy', 'dark depressing mood',
]

function normalizeList(value?: string | string[]): string {
  if (Array.isArray(value)) return value.filter(Boolean).join(', ')
  return value || ''
}

function contextText(ctx: VisualQualityContext): string {
  return [
    ctx.industry,
    ctx.description,
    ctx.primaryOffer,
    ctx.targetAudience,
    ctx.campaignName,
    ctx.campaignGoal,
    ctx.positioning,
    ctx.differentiation,
    ctx.keyMessage,
    ctx.postCaption,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

export function detectVisualCategory(ctx: VisualQualityContext): VisualCategory {
  const text = contextText(ctx)

  const ranked = (Object.entries(CATEGORY_RULES) as Array<[VisualCategory, CategoryRule]>)
    .filter(([category]) => category !== 'other_business')
    .map(([category, rule]) => ({
      category,
      score: rule.keywords.reduce((sum, keyword) => sum + (text.includes(keyword.toLowerCase()) ? 1 : 0), 0),
    }))
    .sort((a, b) => b.score - a.score)

  return ranked[0]?.score > 0 ? ranked[0].category : 'other_business'
}

export function parseVisualColorMood(palette?: string | string[]): string {
  const raw = normalizeList(palette).trim()
  if (!raw) return 'clean premium neutral palette with restrained brand accents'
  const lower = raw.toLowerCase()

  const hex = raw.match(/#([0-9a-fA-F]{6})/)?.[1]
  if (hex) {
    const r = parseInt(hex.slice(0, 2), 16)
    const g = parseInt(hex.slice(2, 4), 16)
    const b = parseInt(hex.slice(4, 6), 16)
    if (r > 200 && g > 200 && b > 200) return 'airy white and soft neutral palette with premium minimal clarity'
    if (r < 60 && g < 60 && b < 60) return 'premium charcoal palette balanced with bright clean highlights'
    if (b > r && b > g) return 'trusted blue-led palette with clean professional accents'
    if (g > r && g > b) return 'fresh green-led palette with natural growth accents'
    if (r > g && r > b) return 'warm red-led palette used as a controlled confident accent'
  }

  if (lower.match(/white|cream|minimal|neutral/)) return 'airy white and soft neutral palette with premium minimal clarity'
  if (lower.match(/blue|navy|cobalt/)) return 'trusted blue-led palette with clean professional accents'
  if (lower.match(/green|emerald|mint/)) return 'fresh green-led palette with natural growth accents'
  if (lower.match(/gold|amber|orange/)) return 'warm gold and amber accents with premium commercial warmth'
  if (lower.match(/pink|rose|blush/)) return 'soft rose accents with polished beauty-style warmth'
  if (lower.match(/purple|violet|indigo/)) return 'controlled violet accents with modern premium depth'
  if (lower.match(/black|charcoal|dark/)) return 'premium charcoal palette balanced with bright clean highlights'

  return `${raw.slice(0, 80)} palette translated into polished commercial brand accents`
}

export function getPlatformSize(platform?: string): string {
  const p = (platform || 'META').toUpperCase()
  if (p === 'TIKTOK') return 'vertical 9:16 / 1024x1536, subject upper-center, safe lower text area'
  if (p === 'LINKEDIN') return 'landscape 16:9 / 1536x1024, professional horizontal flow'
  if (p === 'FACEBOOK' || p === 'X' || p === 'TWITTER') return 'landscape social feed / 1536x1024, strong left-right balance'
  if (p === 'INSTAGRAM' || p === 'META') return 'square social feed / 1024x1024, centered premium composition'
  return 'social feed composition with clear safe area for text overlay'
}

export function buildVisualCreativeBrief(
  ctx: VisualQualityContext,
  concept?: VisualBriefConcept,
): VisualCreativeBrief {
  const category = detectVisualCategory(ctx)
  const rule = CATEGORY_RULES[category]
  const tone = (ctx.brandToneWords || []).slice(0, 4).join(', ')
  const brandMood = [
    tone,
    ctx.visualStylePref,
    ctx.campaignTone,
    concept?.emotion,
  ].filter(Boolean).join(', ') || 'premium, clear, trustworthy'

  const explicitScene = concept?.centralElement || ctx.visualDirection || ctx.keyMessage || ctx.primaryOffer
  const scene = explicitScene
    ? `${explicitScene}. Category direction: ${rule.preferredScenes}`
    : rule.preferredScenes

  return {
    category,
    categoryLabel: rule.label,
    brandMood,
    scene,
    subject: rule.subjectGuidance,
    composition: rule.composition,
    lighting: rule.lighting,
    colorPalette: parseVisualColorMood(ctx.colorPalette),
    textSafeArea: 'leave the lower 35-45% clean and uncluttered for programmatic headline and CTA overlay',
    negativePrompt: [...rule.avoid, ...UNIVERSAL_AVOID].join(', '),
    platformSize: getPlatformSize(ctx.platform),
    adObjective: ctx.campaignGoal || ctx.keyMessage || ctx.primaryOffer || concept?.cta || 'create a clear premium marketing action',
    benchmark: rule.benchmark,
    qualityChecklist: {
      businessRelevant: category !== 'other_business' || Boolean(ctx.primaryOffer || ctx.keyMessage || ctx.postCaption),
      adReady: true,
      brandConsistent: Boolean(ctx.brandName || ctx.colorPalette || ctx.brandToneWords?.length || ctx.visualStylePref),
      clearSubject: true,
      textSafeSpace: true,
      lightingAppropriate: true,
      categoryRisksAvoided: true,
    },
  }
}

export function buildPromptFromVisualBrief(
  brief: VisualCreativeBrief,
  ctx: VisualQualityContext,
  language: 'ar' | 'en' = 'en',
): string {
  const brandName = ctx.brandName || 'the brand'
  const audience = ctx.targetAudience ? `Target audience: ${ctx.targetAudience}.` : ''
  const languageLine = language === 'ar'
    ? 'This is for an Arabic-language ad; the image itself must remain completely text-free.'
    : 'This is for a text-composited ad; the image itself must remain completely text-free.'

  return `Create a premium, polished, ad-ready BACKGROUND VISUAL for ${brandName}.
${languageLine}

BRAND-FIRST CONTEXT:
- Category: ${brief.categoryLabel}
- Brand mood: ${brief.brandMood}
- Audience: ${audience || 'use the provided business context, do not invent a random audience'}
- Objective: ${brief.adObjective}
- Color direction: ${brief.colorPalette}
- Quality benchmark: ${brief.benchmark}

STRUCTURED VISUAL BRIEF:
- Scene: ${brief.scene}
- Main subject: ${brief.subject}
- Composition: ${brief.composition}
- Lighting: ${brief.lighting}
- Platform framing: ${brief.platformSize}
- Text-safe area: ${brief.textSafeArea}

UNIVERSAL AD QUALITY RULES:
- Premium commercial campaign image, not a random AI picture.
- One clear main subject with strong visual hierarchy.
- Clean, bright, polished lighting unless the brand explicitly requires dark.
- Enough negative space for text overlay.
- Not overcrowded, not empty, not generic stock photography.
- Brand-consistent colors and mood.
- Platform-appropriate framing and crop safety.

CATEGORY-SPECIFIC SAFETY AND QUALITY:
- ${CATEGORY_RULES[brief.category].trustSafety}
- ${CATEGORY_RULES[brief.category].adReadiness}
- Avoid: ${brief.negativePrompt}

CRITICAL TEXT RULE:
Absolutely NO text, NO words, NO letters, NO numbers, NO logos, NO signage, NO watermarks,
NO typography of any kind inside the generated image. All copy and branding will be added
programmatically after generation.`
}

export function getVisualCategoryRule(category: VisualCategory): CategoryRule {
  return CATEGORY_RULES[category]
}
