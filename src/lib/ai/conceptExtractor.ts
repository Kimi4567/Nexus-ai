/**
 * NEXUS Visual Intelligence — Caption → Visual Concept Extractor
 *
 * Analyzes post captions and brand context deterministically to extract:
 *   - centralElement  — the specific scene/hero visual to generate
 *   - emotion         — 2-3 emotion words to guide the visual mood
 *   - headline        — a 4-7 word ad headline from the caption's core promise
 *   - cta             — call-to-action button text
 *   - visualMood      — one-sentence atmosphere/mood description
 *
 * This step intentionally makes no provider call. Image generation is already
 * a paid action, and silently adding a second model call makes the credit price
 * misleading and weakens unit economics. A future model-assisted art-direction
 * pass must be exposed and metered as its own explicit action.
 */

export interface VisualConcept {
  /** Specific, cinematic scene description — what the hero visual SHOWS */
  centralElement: string
  /** 2-3 emotion words the image should evoke */
  emotion: string
  /** 4-7 word bold ad headline derived from the caption */
  headline: string
  /** 2-4 word call-to-action button text */
  cta: string
  /** One-sentence overall visual atmosphere */
  visualMood: string
}

// ─── Language detection ───────────────────────────────────────────────────────

/**
 * Detect whether a text is primarily Arabic or English.
 * Returns 'ar' if more than 20% of alphabetic characters are Arabic Unicode.
 */
export function detectLanguage(text: string): 'ar' | 'en' {
  if (!text || text.trim().length === 0) return 'en'
  // Arabic Unicode blocks: Basic Arabic + Extended
  const arabicChars = (text.match(/[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/g) || []).length
  const totalAlpha  = (text.match(/[a-zA-Z؀-ۿݐ-ݿ]/g) || []).length
  if (totalAlpha === 0) return arabicChars > 0 ? 'ar' : 'en'
  return arabicChars / totalAlpha > 0.2 ? 'ar' : 'en'
}

// ─── Concept extraction ───────────────────────────────────────────────────────

export interface ConceptInput {
  text: string          // post caption or campaign brief text
  industry: string      // from Brand Brain
  brandName: string     // from Brand Brain
  language?: 'ar' | 'en'
}

/**
 * Extract a safe visual concept without consuming a provider token.
 * The result is grounded in the caption language and business category and is
 * then normalized again by the image prompt builder before generation.
 */
export async function extractVisualConcept(input: ConceptInput): Promise<VisualConcept> {
  const { text, industry, brandName } = input
  const language = input.language ?? detectLanguage(text)
  return buildFallbackConcept(text, industry, brandName, language)
}

// ─── Keyword-based fallback ───────────────────────────────────────────────────

/** Industry-keyed fallback concepts — used when API call fails */
function buildFallbackConcept(
  text: string,
  industry: string,
  brandName: string,
  language: 'ar' | 'en' = 'en'
): VisualConcept {
  const check = (text + ' ' + industry).toLowerCase()

  const isAr = language === 'ar'

  // Post-level operational themes must be resolved before broad industry
  // categories such as "AI" or "marketing". Otherwise every NEXUS post falls
  // into the same generic SaaS scene regardless of its actual creative brief.
  if (check.match(/monthly|purchased|billing cycle|credit pools?|plan credits?|شهري|الشهرية|المشت(?:رى|راة)|دورة الباقة|نوع الرصيد/)) {
    return {
      centralElement: 'two clearly separated physical reservoirs of blank metallic tokens: one beside a circular renewal ring and one inside a durable transparent vault, with a precise divider between them and generous negative space',
      emotion: 'clear, controlled, durable',
      headline: isAr ? 'رصيدان بقواعد واضحة' : 'Two Balances, Clear Rules',
      cta: isAr ? 'راجع الرصيد' : 'Review Balance',
      visualMood: 'Premium financial-operations still life with disciplined separation and calm violet-blue depth',
    }
  }

  if (check.match(/credits?|ledger|quoted cost|metered action|pricing|balance|كريديت|أرصدة|رصيد|تكلفة|خصم|سجل/)) {
    return {
      centralElement: 'three distinct tactile stations arranged left to right: a small stack of blank metallic tokens beside a quotation tile, one illuminated confirmation gate, and a sealed archive of blank ledger cards, connected by one precise physical path',
      emotion: 'transparent, controlled, precise',
      headline: isAr ? 'التكلفة واضحة قبل التنفيذ' : 'Know Cost Before Execution',
      cta: isAr ? 'راجع العملية' : 'Review Operation',
      visualMood: 'Precise premium product-operations scene with one legible physical flow and generous negative space',
    }
  }

  if (check.match(/brand brain|positioning|voice|verified claims?|restrictions?|channel drafts?|تموضع|النبرة|ادعاءات موثقة|القيود|مسودات القنوات/)) {
    return {
      centralElement: 'one central translucent sculptural core receiving four distinct blank material inputs, then branching into three differently shaped channel frames, with a visible human review gate before the frames and no screens or lettering',
      emotion: 'governed, coherent, intentional',
      headline: isAr ? 'مصدر واحد لكل رسالة' : 'One Source for Every Message',
      cta: isAr ? 'راجع التكييف' : 'Review Adaptation',
      visualMood: 'Editorial brand-governance sculpture with disciplined branches, visible review control and premium depth',
    }
  }

  if (check.match(/ownership|capacity|handoffs?|approval|assignments?|operations?|ملكية|السعة|تسليم|الموافقات|المهام|التشغيل/)) {
    return {
      centralElement: 'three-person operations team passing distinct blank task blocks through clearly separated work lanes toward one physical review gate, with visible unused lane capacity and an uncluttered premium workspace',
      emotion: 'organized, accountable, calm',
      headline: isAr ? 'الملكية والسعة قبل التوسع' : 'Ownership Before Expansion',
      cta: isAr ? 'راجع السعة' : 'Review Capacity',
      visualMood: 'Premium operations editorial with clear handoffs, visible capacity and a single review decision',
    }
  }

  if (check.match(/workflow|strategy|execution|results?|stages?|سير العمل|الاستراتيجية|التنفيذ|النتائج|المراحل/)) {
    return {
      centralElement: 'six distinct tactile stages forming one governed physical path from a central brand core through planning blocks and a human review gate to a final measurement vessel, with every stage visually separate and no screens',
      emotion: 'guided, connected, reviewable',
      headline: isAr ? 'مسار واحد وقرار واضح' : 'One Path, Clear Decisions',
      cta: isAr ? 'راجع المرحلة' : 'Review Stage',
      visualMood: 'Cinematic governed-workflow metaphor with distinct stages, human control and measured progression',
    }
  }

  if (check.match(/restaurant|cafe|food|beverage|coffee|bakery|مطعم|مقهى|طعام|طبخ|وجبة/)) {
    return {
      centralElement: 'beautifully plated signature dish bathed in warm candlelight, steam rising, shallow depth of field with restaurant ambiance in soft bokeh background',
      emotion:        'indulgent, sensory, appetizing',
      headline:       isAr ? 'طعم لا يُنسى في كل لقمة' : 'Taste Worth Every Moment',
      cta:            isAr ? 'اطلب الآن' : 'Order Now',
      visualMood:     'Warm candlelit restaurant atmosphere with rich food textures and golden ambient light',
    }
  }

  if (check.match(/real estate|property|realty|apartment|villa|house|عقار|شقة|فيلا|منزل|عقارات/)) {
    return {
      centralElement: 'luxury apartment living room with floor-to-ceiling windows, golden-hour city skyline visible, premium marble finishes and designer furniture',
      emotion:        'aspirational, exclusive, lifestyle',
      headline:       isAr ? 'منزل أحلامك في انتظارك' : 'Your Dream Address Awaits',
      cta:            isAr ? 'اكتشف الآن' : 'View Properties',
      visualMood:     'Aspirational luxury real estate with warm golden-hour light and premium interior details',
    }
  }

  if (check.match(/clinic|medical|health|wellness|fitness|doctor|hospital|dental|عيادة|طبيب|صحة|علاج/)) {
    return {
      centralElement: 'modern healthcare environment with clean white and soft blue tones, professional medical setting with warm lighting evoking trust, care and precision',
      emotion:        'trustworthy, healing, professional',
      headline:       isAr ? 'صحتك أولويتنا' : 'Your Health, Our Priority',
      cta:            isAr ? 'احجز موعدك' : 'Book Appointment',
      visualMood:     'Clean, trustworthy medical environment with warm human touches and clinical precision',
    }
  }

  if (check.match(/saas|software|platform|app|tech|ai|automation|digital|data|analytics|startup|crm/)) {
    return {
      centralElement: 'focused product and marketing team in a premium dark workspace arranging luminous violet-blue physical nodes into a clear connected path across an uncluttered table',
      emotion:        'powerful, innovative, empowering',
      headline:       isAr ? 'حوّل بياناتك إلى نتائج' : 'Transform Data Into Growth',
      cta:            isAr ? 'ابدأ مجاناً' : 'Start Free',
      visualMood:     'Dark premium tech aesthetic with deep violet-blue glow, tactile luminous connections and atmospheric depth haze',
    }
  }

  if (check.match(/fashion|clothing|style|boutique|retail|apparel|ملابس|أزياء|موضة/)) {
    return {
      centralElement: 'editorial fashion close-up with dramatic side lighting, premium fabric texture in sharp focus, aspirational lifestyle aesthetic',
      emotion:        'confident, stylish, aspirational',
      headline:       isAr ? 'أسلوبك يقول كل شيء' : 'Define Your Signature Style',
      cta:            isAr ? 'تسوق الآن' : 'Shop Now',
      visualMood:     'High-fashion editorial with dramatic contrast, premium texture and aspirational lifestyle energy',
    }
  }

  if (check.match(/marketing|agency|consultancy|advertising|branding|strategy|تسويق|وكالة|استراتيجية/)) {
    return {
      centralElement: 'premium creative agency team collaborating around a clean table with blank color-coded wooden tiles and tactile campaign objects, dramatic accent lighting and generous negative space',
      emotion:        'intelligent, results-driven, creative',
      headline:       isAr ? 'نحوّل رؤيتك إلى نجاح' : 'Turn Vision Into Results',
      cta:            isAr ? 'ابدأ الآن' : 'Get Started',
      visualMood:     'Dynamic premium agency environment with strategic thinking and creative energy',
    }
  }

  if (check.match(/education|school|course|academy|learning|training|تعليم|أكاديمية|دورة|تدريب/)) {
    return {
      centralElement: 'bright inspiring learning environment with warm natural light, knowledge journey visualization, modern academic setting with hopeful atmosphere',
      emotion:        'inspiring, empowering, hopeful',
      headline:       isAr ? 'استثمر في مستقبلك اليوم' : 'Invest in Your Future Today',
      cta:            isAr ? 'سجّل الآن' : 'Enroll Now',
      visualMood:     'Bright, optimistic learning atmosphere with natural light and knowledge-journey energy',
    }
  }

  if (check.match(/finance|investment|banking|fintech|wealth|استثمار|مالية|بنك|ثروة/)) {
    return {
      centralElement: 'precise ascending architectural forms in brushed gold beside a confident advisor in a refined dark environment, communicating disciplined financial growth through tactile scale and balance',
      emotion:        'trustworthy, premium, growth-focused',
      headline:       isAr ? 'ثروتك تستحق الأفضل' : 'Your Wealth, Expertly Managed',
      cta:            isAr ? 'تواصل معنا' : 'Talk to an Expert',
      visualMood:     'Authoritative premium financial aesthetic with deep dark tones and gold accents',
    }
  }

  // ── General / unknown industry ──────────────────────────────────────────────
  return {
    centralElement: `premium brand visual for ${brandName} — professional atmosphere with depth, rich texture and aspirational quality`,
    emotion:        'professional, premium, trustworthy',
    headline:       isAr ? `${brandName} — الأفضل دائماً` : `${brandName} — Excellence Defined`,
    cta:            isAr ? 'اكتشف المزيد' : 'Learn More',
    visualMood:     'Premium brand atmosphere with dramatic lighting, depth and polished commercial quality',
  }
}
