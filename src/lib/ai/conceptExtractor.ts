/**
 * NEXUS Visual Intelligence — Caption → Visual Concept Extractor
 *
 * Analyzes post captions and brand context using GPT-4o mini to extract:
 *   - centralElement  — the specific scene/hero visual to generate
 *   - emotion         — 2-3 emotion words to guide the visual mood
 *   - headline        — a 4-7 word ad headline from the caption's core promise
 *   - cta             — call-to-action button text
 *   - visualMood      — one-sentence atmosphere/mood description
 *
 * This extraction is what makes every generated ad image UNIQUE and
 * content-driven rather than generic style-map output.
 *
 * Cost: ~$0.0003/call (GPT-4o mini) — well worth the quality gain.
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
 * Extract visual concept from a social media caption using GPT-4o mini.
 * Falls back to keyword-based defaults if the API call fails.
 */
export async function extractVisualConcept(input: ConceptInput): Promise<VisualConcept> {
  const { text, industry, brandName } = input
  const language = input.language ?? detectLanguage(text)

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return buildFallbackConcept(text, industry, brandName, language)

  const systemPrompt = `You are a world-class advertising art director working at a top agency.
Your job: extract the visual concept from a social media post caption to brief an AI image generator.
Return ONLY a valid JSON object — no markdown, no explanation, no code blocks.`

  const userPrompt = `Caption: "${text.slice(0, 600)}"
Brand: ${brandName}
Industry: ${industry}
Caption language: ${language === 'ar' ? 'Arabic' : 'English'}

Return this JSON object:
{
  "centralElement": "...",
  "emotion": "...",
  "headline": "...",
  "cta": "...",
  "visualMood": "..."
}

Rules for each field:
- centralElement: SPECIFIC and CINEMATIC text-free scene (e.g. "steaming carbonara pasta with golden parmesan, candlelit table" NOT "food image"). Describe tangible people, objects, and environment physically in the frame.
- centralElement must NEVER request text, lettering, numbers, signs, infographics, icons, charts, graphs, dashboards, interfaces, screens, logos, watermarks, or UI. If the caption or creative direction asks for any of those, translate its meaning into one tangible photographic scene or visual metaphor instead.
- emotion: 2-3 emotion words the image must evoke (e.g. "indulgent, warm, authentic")
- headline: 4-7 word bold ad headline in the SAME LANGUAGE as the caption. Derive from the caption's main benefit or promise.
- cta: 2-4 word call-to-action in the SAME LANGUAGE as the caption (e.g. "Order Now" in English, "اطلب الآن" in Arabic)
- visualMood: ONE sentence describing the complete visual atmosphere (lighting, color, feeling)

Industry-specific guidance:
- restaurant/food: hero dish close-up, warm candlelit ambiance, steam, bokeh, Michelin-star plating
- real estate: specific property type (luxury penthouse, villa pool, modern apartment), time of day, lifestyle
- medical/clinic: modern clean clinical environment, warm professional lighting, hope and precision
- saas/tech: human team, physical workflow objects, or abstract luminous connections that communicate intelligence without screens, interfaces, charts, or text
- fashion/retail: editorial product shot, dramatic lighting, aspirational lifestyle
- fitness/gym: dynamic action, strong contrast, energy and motion
- education: bright inspiring space, learning journey, knowledge and growth

IMPORTANT: Be specific and visual. The AI needs to see exactly what to draw.`

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userPrompt   },
        ],
        max_tokens: 350,
        temperature: 0.4,
        response_format: { type: 'json_object' },
      }),
    })

    if (!response.ok) throw new Error(`GPT-4o mini responded ${response.status}`)

    const data = await response.json()
    const content = data?.choices?.[0]?.message?.content
    if (!content) throw new Error('Empty response from GPT-4o mini')

    const parsed = JSON.parse(content) as Partial<VisualConcept>
    const fallback = buildFallbackConcept(text, industry, brandName, language)

    return {
      centralElement: parsed.centralElement?.trim() || fallback.centralElement,
      emotion:        parsed.emotion?.trim()        || fallback.emotion,
      headline:       parsed.headline?.trim()       || fallback.headline,
      cta:            parsed.cta?.trim()            || fallback.cta,
      visualMood:     parsed.visualMood?.trim()     || fallback.visualMood,
    }
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[conceptExtractor] GPT-4o mini extraction failed, using fallback:', err)
    }
    return buildFallbackConcept(text, industry, brandName, language)
  }
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
      centralElement: 'focused product and marketing team in a premium dark workspace arranging luminous violet-blue physical nodes into a clear connected workflow, no screens or visible writing',
      emotion:        'powerful, innovative, empowering',
      headline:       isAr ? 'حوّل بياناتك إلى نتائج' : 'Transform Data Into Growth',
      cta:            isAr ? 'ابدأ مجاناً' : 'Start Free',
      visualMood:     'Dark premium tech aesthetic with deep violet-blue glow, floating UI elements and depth haze',
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
      centralElement: 'premium creative agency team collaborating around a clean table with blank color-coded planning cards and tactile campaign objects, dramatic accent lighting, no screens or visible writing',
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
      centralElement: 'precise ascending architectural forms in brushed gold beside a confident advisor in a refined dark environment, communicating disciplined financial growth without charts or visible writing',
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
