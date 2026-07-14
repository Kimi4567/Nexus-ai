/**
 * Strategy proof guard
 *
 * Deterministic backstop for strategy/content-planning outputs. Prompt rules are
 * the first line of defense; this guard keeps unsupported proof assets from
 * being saved as strategy truth when Brand Brain has no verified proof.
 */

export interface StrategyProofContext {
  verifiedProof?: string[] | null
  budgetText?: string | null
  /** User-authored factual Brand Brain fields that may support service-policy claims. */
  allowedClaimText?: string[] | null
}

interface ProofAvailability {
  hasTestimonials: boolean
  hasCustomerStories: boolean
  hasAwards: boolean
  hasCaseStudies: boolean
  hasReviews: boolean
}

function verifiedProofText(context: StrategyProofContext): string {
  return Array.isArray(context.verifiedProof)
    ? context.verifiedProof.filter((item): item is string => typeof item === 'string').join(' \n ')
    : ''
}

function softenUnsupportedGuarantees(text: string): string {
  return text
    .split(/(\bguaranteed\s+results?\b|\bguaranteed\s+growth\b|\bguaranteed\s+delivery\b|\bguaranteed\b)/gi)
    .map((part, index, parts) => {
      if (!/^guaranteed(?:\s+results?|\s+growth|\s+delivery)?$/i.test(part)) return part
      const before = (parts[index - 1] || '').toLowerCase().slice(-80)
      if (/(?:^|\s)(?:no|not|avoid|without|cannot be|can not be|can't be|do not|do not promise|do not guarantee)\s*$/.test(before)) {
        return part
      }
      if (/\s+growth$/i.test(part)) return 'planned growth goal'
      if (/\s+delivery$/i.test(part)) return 'delivery goal'
      return /\s+results?$/i.test(part) ? 'aimed-for results' : 'aimed-for'
    })
    .join('')
}

function guardUnsafeStatusLanguage(text: string): string {
  return text
    .replace(/مرحلة العمل\s*:\s*active\b/gi, 'مرحلة العمل: مرحلة التخطيط/المراجعة')
    .replace(/مرحلة العمل\s+active\b/gi, 'مرحلة العمل مرحلة التخطيط/المراجعة')
    .replace(/\bbusiness stage\s*:\s*active\b/gi, 'business stage: business already operating')
    .replace(/\bactive stage\b/gi, 'planning/review stage')
    .replace(/\bcampaign active\b/gi, 'campaign in planning/review')
    .replace(/\bthe campaign is active\b/gi, 'the campaign is in planning/review')
}

function softenAbsoluteOutcomeClaims(text: string): string {
  return text
    .replace(/خطط\s+علاج\s+واضحة\s+تضمن\s+لك\s+راحة\s+البال\.?/gi, 'خطط علاج واضحة تساعدك على فهم الخطوات قبل البدء.')
    .replace(/الفحوصات\s+المنتظمة\s+تحميك\s+من\s+مشاكل\s+الأسنان\s+الكبيرة\.?/gi, 'الفحوصات المنتظمة تساعدك على متابعة احتياجات رعاية الأسنان.')
    .replace(/اختيار\s+العيادة\s+المناسبة\s+يمكن\s+أن\s+يغير\s+تجربتك\s+الصحية\s+بالكامل\.?/gi, 'اختيار العيادة المناسبة يساعدك على فهم خيارات الرعاية والخطوات التالية.')
    .replace(/المحتوى\s+التوضيحي\s+سيكون\s+كافي(?:ًا|ا)\s+لزيادة\s+التفاعل\.?/gi, 'أثر المحتوى التوضيحي على التفاعل فرضية تحتاج إلى بيانات فعلية.')
    .replace(/الجمهور\s+المستهدف\s+يستخدم\s+Instagram\s+بشكل\s+نشط\.?/gi, 'استخدام الجمهور المستهدف لـ Instagram فرضية تحتاج إلى بيانات فعلية.')
    .replace(/عدم\s+التركيز\s+على\s+منصات\s+غير\s+فعالة/gi, 'عدم توسيع القنوات قبل توفر بيانات أداء فعلية')
    // Generic standalone guarantee verbs. Unicode boundaries preserve ordinary
    // inclusion wording such as "ما يتضمنه العرض" while softening real promises.
    .replace(/(?<![\p{L}\p{M}])تضمن(?:\s+لك)?(?![\p{L}\p{M}])/giu, 'تدعم')
    .replace(/(?<![\p{L}\p{M}])يضمن(?:\s+لك)?(?![\p{L}\p{M}])/giu, 'يدعم')
    .replace(/(?<![\p{L}\p{M}])نضمن(?:\s+لك)?(?![\p{L}\p{M}])/giu, 'نسعى إلى دعم')
    .replace(/(?<![\p{L}\p{M}])أضمن(?:\s+لك)?(?![\p{L}\p{M}])/giu, 'أهدف إلى دعم')
    .replace(/اختر\s+خيارات\s+صديقة\s+للبيئة\s+لمنزل\s+أكثر\s+صحة\.?/gi, 'استفسر عن خيارات تنظيف صديقة للبيئة عند توفرها.')
    .replace(/خيارات\s+صديقة\s+للبيئة\s+لمنزل\s+أكثر\s+صحة/gi, 'خيارات تنظيف صديقة للبيئة عند توفرها')
    .replace(/منزل\s+أكثر\s+صحة/gi, 'منزل يلائم احتياجاتك')
    .replace(/\bchoose\s+eco-friendly\s+options\s+for\s+a\s+healthier\s+home\.?/gi, 'Ask about eco-friendly options where available.')
    .replace(/\bfor\s+a\s+healthier\s+home\b/gi, 'where available')
    .replace(/احجز\s+تنظيف\s+منزلك\s+في\s+ثوان(?:ٍ|ي)?\s+عبر\s+WhatsApp!?/gi, 'ابدأ طلب تنظيف منزلك عبر WhatsApp بخطوة بسيطة.')
    .replace(/احجز\s+خدمة\s+التنظيف\s+في\s+ثوان(?:ٍ|ي)?\s+عبر\s+WhatsApp!?/gi, 'احجز خدمة التنظيف عبر WhatsApp بخطوة بسيطة.')
    .replace(/في\s+ثوان(?:ٍ|ي)?\s+عبر\s+WhatsApp/gi, 'عبر WhatsApp بخطوة بسيطة')
    .replace(/\bbook\s+(?:your\s+)?(?:home\s+)?cleaning\s+in\s+seconds\s+via\s+WhatsApp!?/gi, 'Start a cleaning request via WhatsApp.')
    .replace(/\bin\s+seconds\s+via\s+WhatsApp\b/gi, 'via WhatsApp')
    .replace(/لا\s+مزيد\s+من\s+الإضافات\s+المفاجئة!?/gi, 'راجع الأسعار والتفاصيل بوضوح قبل الحجز.')
    .replace(/لا\s+مزيد\s+من\s+الرسوم\s+المفاجئة!?/gi, 'راجع الأسعار والتفاصيل بوضوح قبل الحجز.')
    .replace(/\bno\s+more\s+surprise\s+(?:add-ons|fees|charges)!?/gi, 'Review pricing and add-ons before booking.')
    .replace(/استمتع\s+بجودة\s+تنظيف\s+متسقة\s+في\s+كل\s+زيارة\.?/gi, 'استهدف تجربة تنظيف أكثر اتساقًا مع كل حجز.')
    .replace(/جودة\s+تنظيف\s+متسقة\s+في\s+كل\s+زيارة/gi, 'تجربة تنظيف أكثر اتساقًا مع كل حجز')
    .replace(/\bconsistent\s+cleaning\s+quality\s+(?:on|in|for)\s+every\s+visit\b/gi, 'a more consistent cleaning experience across bookings')
    .replace(/\bevery\s+visit\b/gi, 'future bookings')
    .replace(/\bEnsure your office has the best coffee every day\b/gi, 'Help keep your office stocked with better coffee')
    .replace(/\bEnsure your office is always\b[^.?!]*/gi, 'Help keep your office stocked with better coffee')
    .replace(/\bEnsure your office has\b[^.?!]*/gi, 'Help keep your office stocked with better coffee')
    .replace(/\bSupport more reliable team planning has access to great coffee\b/gi, 'Help teams plan better office coffee routines')
    .replace(/\bEnsure your team always\b[^.?!]*/gi, 'Help teams plan better office coffee routines')
    .replace(/\bEnsure customers always\b/gi, 'Help customers')
    .replace(/\bEnsure every\b/gi, 'Support each')
    .replace(/\bAlways stocked\b/gi, 'more reliably stocked')
    .replace(/\bbest\b([^.!?]{0,60})\bevery day\b/gi, 'better$1more consistently')
    .replace(/\bEnsure results\b/gi, 'Support the planned outcome')
    .replace(/\bEnsure delivery\b/gi, 'Support delivery planning')
    .replace(/\bEnsure customers\b/gi, 'Help customers')
    .replace(/\bmake sure your team always\b/gi, 'help your team more consistently')
    .replace(/\bmake sure\b([^.!?]{0,80})\balways\b/gi, 'help$1more consistently')
    .replace(/\b(?:our\s+)?pricing details available to discuss ensures? no surprises\.?/gi, 'Ask for pricing details before confirming the next step.')
    .replace(/\bpricing details to review before booking,\s*(?:just\s+)?clear treatment plans\.?/gi, 'Review pricing details and the proposed treatment plan before booking.')
    .replace(/\bexperience dental care without the stress\.?/gi, 'Explore dental care with clearer next steps.')
}

function guardUnsupportedBudgetAssumptions(text: string): string {
  return text
    .replace(/\bAssumes?\s+(?:a\s+)?(?:\$|USD\s*)[\d,]+(?:\s*USD)?\s+budget\b[^.?!]*/gi, 'Paid budget needs user confirmation')
    .replace(/\bAssumes?\s+[^.?!]{0,80}\bbudget\s+is\s+available\b[^.?!]*/gi, 'Paid budget needs user confirmation')
    .replace(/\b(?:\$|USD\s*)[\d,]+(?:\s*USD)?\s+budget\s+is\s+available\b[^.?!]*/gi, 'Paid budget needs user confirmation')
    .replace(/\b(?:ad\s+budget|paid\s+budget|budget)\s+is\s+available\b/gi, 'paid budget needs user confirmation')
    .replace(/\bmonthly\s+paid\s+budget\s+of\s+(?:\$|USD\s*)[\d,]+(?:\s*USD)?\b/gi, 'paid budget needs user confirmation')
    .replace(/\b(?:\$|USD\s*)[\d,]+(?:\s*USD)?\s+(?:ad\s+)?budget\b/gi, 'paid budget needs user confirmation')
    .replace(/\b(?:allocate|spend)\s+(?:\$|USD\s*)[\d,]+(?:\s*USD)?\s+(?:to|on|for)\s+([^.,;!?]+)/gi, 'Paid allocation needs confirmation before allocating spend to $1')
}

function allowedClaimsText(context: StrategyProofContext): string {
  return Array.isArray(context.allowedClaimText)
    ? context.allowedClaimText.filter((item): item is string => typeof item === 'string').join(' ')
    : ''
}

function hasAffirmedClaim(text: string, pattern: RegExp): boolean {
  const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`
  const scanner = new RegExp(pattern.source, flags)
  let match: RegExpExecArray | null
  while ((match = scanner.exec(text)) !== null) {
    const before = text.slice(Math.max(0, match.index - 48), match.index)
    if (!/(?:\b(?:avoid|never|not|no|without|do\s+not\s+use|must\s+not\s+use)\s+|(?:تجنب|تجنّب|لا\s+تستخدم|بدون|غير)\s*)$/i.test(before)) return true
  }
  return false
}

function softenUnsupportedQualityClaims(text: string, context: StrategyProofContext): string {
  const allowed = allowedClaimsText(context)
  const startedCapitalized = /^[A-Z]/.test(text.trimStart())
  let guarded = text

  // Comparative and luxury adjectives assert a market position. Keep them
  // only when Brand Brain contains the same user-supplied positioning.
  if (!hasAffirmedClaim(allowed, /\bfreshest\b|الأطزج|الأكثر\s+طزاجة/i)) {
    guarded = guarded
      .replace(/\bthe\s+freshest\s+coffee\b/gi, 'freshly roasted coffee')
      .replace(/\bfreshest\s+coffee\b/gi, 'freshly roasted coffee')
      .replace(/\bfreshest\b/gi, 'fresh')
      .replace(/الأكثر\s+طزاجة|الأطزج/gi, 'طازج')
  }

  if (!hasAffirmedClaim(allowed, /\bpremium\b|فاخر|فاخرة/i)) {
    guarded = guarded
      .replace(/\bpremium\s*,\s*/gi, '')
      .replace(/\bpremium\b\s*/gi, '')
      .replace(/(قهوة|حبوب|منتج|خدمة)\s+(?:فاخرة|فاخر)/gi, '$1')
  }

  if (!hasAffirmedClaim(allowed, /\bhigh[-\s]?quality\b|عالي(?:ة)?\s+الجودة/i)) {
    guarded = guarded
      .replace(/\bhigh[-\s]?quality\s+/gi, '')
      .replace(/\bhigh[-\s]?quality\b/gi, '')
      .replace(/عالي(?:ة)?\s+الجودة\s*/gi, '')
  }

  if (!hasAffirmedClaim(allowed, /\boptimal\b|مثالي|مثالية|الأمثل/i)) {
    guarded = guarded
      .replace(/\s+for\s+optimal\s+(?:flavou?r|results?|performance)\b/gi, '')
      .replace(/\boptimal\s+(?:flavou?r|results?|performance)\b/gi, 'the intended outcome')
      .replace(/\boptimal\b/gi, '')
      .replace(/(?:الأمثل|مثالي|مثالية)\s*/gi, '')
  }

  if (!hasAffirmedClaim(allowed, /\bperfect\b/i)) guarded = guarded.replace(/\bperfect\b\s*/gi, '')
  if (!hasAffirmedClaim(allowed, /\bfinest\b/i)) guarded = guarded.replace(/\bfinest\b\s*/gi, '')
  if (!hasAffirmedClaim(allowed, /\bultimate\b/i)) guarded = guarded.replace(/\bultimate\b\s*/gi, '')
  if (!hasAffirmedClaim(allowed, /\bunmatched\b/i)) guarded = guarded.replace(/\bunmatched\b\s*/gi, '')
  if (!hasAffirmedClaim(allowed, /\bunrival(?:l)?ed\b/i)) guarded = guarded.replace(/\bunrival(?:l)?ed\b\s*/gi, '')
  if (!hasAffirmedClaim(allowed, /الأفضل/i)) guarded = guarded.replace(/الأفضل\s*/gi, '')

  const cleaned = guarded
    .replace(/\bsee\s+our\s+quality\s+promise\b/gi, 'See the product details')
    .replace(/\bquality\s+promise\b/gi, 'product details')
  return startedCapitalized ? cleaned.replace(/^([a-z])/, char => char.toUpperCase()) : cleaned
}

function cleanProofCollectionArtifacts(text: string): string {
  return text
    .replace(/\b((?:(?:customer|client)\s+stor(?:y|ies)|customer\s+proof|customer\s+reviews?|star\s+ratings?|ratings?|proof(?:\s+examples?)?)\s+to\s+collect)(?:\s+to\s+collect)+\b/gi, '$1')
    .replace(/\s+([,.;!?])/g, '$1')
}

function softenUnsupportedPerformancePromises(text: string): string {
  const startedCapitalized = /^[A-Z]/.test(text.trimStart())
  const guarded = text
    .replace(/\b(?:increase|boost|grow|maximi[sz]e|double|triple)\s+your\s+(sales|revenue|profits?|conversions?|leads?|traffic)\b/gi, 'support your $1 goals')
    .replace(/\b(?:increase|boost|grow|maximi[sz]e|double|triple)\s+(sales|revenue|profits?|conversions?|leads?|traffic)\b/gi, 'support $1 goals')
  return startedCapitalized ? guarded.replace(/^([a-z])/, char => char.toUpperCase()) : guarded
}

function softenUnsupportedServiceClaims(text: string, context: StrategyProofContext): string {
  const allowed = allowedClaimsText(context)
  let guarded = text

  if (!/\b(?:premium|luxury|high[-\s]?end)\b|(?:فاخر|فاخرة|متميز|متميزة)/i.test(allowed)) {
    guarded = guarded
      .replace(/\bpremium\s+(?=(?:dental\s+)?(?:clinic|care|service|provider|brand)\b)/gi, '')
      .replace(/(?:العيادة|الرعاية|الخدمة)\s+(?:الفاخرة|المتميزة)/gi, '$1')
  }

  if (!/\b(?:in minutes|in seconds|instant booking|book instantly)\b|في (?:دقائق|ثوان(?:ٍ|ي)?)|حجز فوري/i.test(allowed)) {
    guarded = guarded
      .replace(/\s+في\s+(?:دقائق|ثوان(?:ٍ|ي)?)(?=\s|[،,.!?]|$)/gi, '')
      .replace(/\s+in\s+(?:minutes|seconds)\b/gi, '')
      .replace(/\binstant booking\b/gi, 'booking steps to confirm')
      .replace(/\bbook instantly\b/gi, 'review booking steps')
  }

  if (!/\b(?:in the heart of|prime location|distinguished location)\b|في قلب|موقع(?:نا)? (?:متميز|استثنائي)|الموقع (?:المتميز|الاستثنائي)/i.test(allowed)) {
    guarded = guarded
      .replace(/\bin the heart of\s+/gi, 'in ')
      .replace(/في\s+قلب\s+/gi, 'في ')
      .replace(/\b(?:prime|distinguished) location\b/gi, 'stated location')
      .replace(/موقع(?:نا| العيادة) (?:المتميز|الاستثنائي)/gi, 'موقع العيادة داخل المنطقة المحددة')
      .replace(/موقع (?:متميز|استثنائي)/gi, 'موقع داخل المنطقة المحددة')
      .replace(/الموقع (?:المتميز|الاستثنائي)/gi, 'الموقع داخل المنطقة المحددة')
  }

  if (!/\btrusted (?:care|service|provider)\b|رعاية موثوقة|خدمة موثوقة|مزود موثوق/i.test(allowed)) {
    guarded = guarded
      .replace(/\btrusted and convenient care\b/gi, 'care with clear next steps')
      .replace(/\btrusted (?:care|service)\b/gi, 'service with clear next steps')
      .replace(/رعاية\s+أسنان\s+موثوقة\s+ومريحة/gi, 'رعاية أسنان بخطوات واضحة')
      .replace(/رعاية\s+أسنان\s+موثوقة/gi, 'رعاية أسنان بخطوات واضحة')
      .replace(/خدمة\s+موثوقة\s+ومريحة/gi, 'خدمة بخطوات واضحة')
  }

  if (!/no hidden|transparent pricing|pricing transparency|بدون (?:رسوم|تكاليف) خفية|لا توجد (?:رسوم|تكاليف) خفية|شفاف(?:ة|ية) الأسعار/i.test(allowed)) {
    guarded = guarded
      .replace(/\bno hidden (?:costs?|fees?|charges?)\b/gi, 'pricing details to review before booking')
      .replace(/\btransparent pricing\b/gi, 'pricing details available to discuss')
      .replace(/بدون (?:رسوم|تكاليف) خفية/gi, 'تفاصيل أسعار للمراجعة قبل الحجز')
      .replace(/لا توجد (?:رسوم|تكاليف) خفية/gi, 'راجع تفاصيل الأسعار قبل الحجز')
      .replace(/شفاف(?:ة|ية) الأسعار/gi, 'وضوح تفاصيل الأسعار قبل الحجز')
  }

  if (!/bilingual|arabic and english|english and arabic|ثنائي(?:ة)? اللغة|العربية والإنجليزية|الإنجليزية والعربية/i.test(allowed)) {
    guarded = guarded
      .replace(/\bbilingual (?:care|service|support|communication|team)\b/gi, 'clear communication')
      .replace(/\b(?:Arabic and English|English and Arabic) (?:care|service|support|communication)\b/gi, 'clear communication')
      .replace(/(?:رعاية|خدمة|دعم|تواصل) ثنائي(?:ة)? اللغة/gi, 'تواصل واضح')
      .replace(/(?:خدمة|دعم|تواصل) (?:بالعربية والإنجليزية|بالإنجليزية والعربية)/gi, 'تواصل واضح')
      .replace(/\bclear communication in your preferred language\.?/gi, 'Clear communication about the next steps.')
      .replace(/تواصل واضح بلغتك المفضلة\.?/gi, 'تواصل واضح حول الخطوات التالية.')
  }

  if (!/family[-\s]?friendly|children|kids|pediatric|عائلات|عائلي|الأطفال|طب أسنان الأطفال/i.test(allowed)) {
    guarded = guarded
      .replace(/\bfamily[-\s]?friendly\b/gi, 'welcoming')
      .replace(/\bdental care that caters to the whole family\.?/gi, 'Dental care options to review for different needs.')
      .replace(/مناسب(?:ة)? للعائلات/gi, 'مرحّب')
      .replace(/صديق(?:ة)? للعائلة/gi, 'مرحّب')
  }

  if (!/pain[-\s]?free|stress[-\s]?free|without pain|بدون ألم|بلا ألم|خالية? من التوتر/i.test(allowed)) {
    guarded = guarded
      .replace(/\bpain[-\s]?free\b/gi, 'with comfort options to discuss')
      .replace(/\bstress[-\s]?free\b/gi, 'with clear next steps')
      .replace(/بدون ألم|بلا ألم/gi, 'مع خيارات راحة يمكن مناقشتها')
      .replace(/خالي(?:ة)? من التوتر/gi, 'بخطوات واضحة')
  }

  if (!/tour|facility visit|office visit|جولة|زيارة المنشأة|زيارة العيادة/i.test(allowed)) {
    guarded = guarded
      .replace(/\b(?:book|schedule|request) (?:a |your )?(?:clinic |facility |office )?tour\b/gi, 'book a consultation')
      .replace(/\bvisit us for a tour\b/gi, 'book a consultation')
      .replace(/(?:احجز|اطلب|حدد) جولة(?: في العيادة)?/gi, 'احجز استشارة')
  }

  return guarded
}

function keyImpliesStatus(key: string): boolean {
  return /\b(stage|status|campaign state|execution state)\b/i.test(key) || /مرحلة/.test(key)
}

function keyImpliesBusinessStatus(key: string): boolean {
  return /\bbusiness\s+(?:stage|status)\b/i.test(key) || /حالة النشاط|مرحلة النشاط/.test(key)
}

function isUnsafeStatusValue(value: string): boolean {
  return /^(active|live|running|launched|published|scheduled)$/i.test(value.trim())
}

function guardStructuredStatusValue(key: string, value: string): string {
  if (!keyImpliesStatus(key) || !isUnsafeStatusValue(value)) return value
  if (keyImpliesBusinessStatus(key)) return 'business already operating'
  return /مرحلة/.test(key) ? 'مرحلة التخطيط/المراجعة' : 'planning/review'
}

export function getProofAvailability(context: StrategyProofContext): ProofAvailability {
  const proof = verifiedProofText(context).toLowerCase()
  return {
    hasTestimonials: /\b(testimonial|satisfied customer|client quote|customer quote)\b/i.test(proof),
    hasCustomerStories: /\b(customer story|customer stories)\b/i.test(proof),
    hasAwards: /\b(award|certified|certification|accredited|badge)\b/i.test(proof),
    hasCaseStudies: /\b(case study|case studies|case-study)\b/i.test(proof),
    hasReviews: /\b(review|rating|rated|stars?)\b/i.test(proof),
  }
}

export function buildProofPolicyPrompt(context: StrategyProofContext): string {
  const proof = Array.isArray(context.verifiedProof)
    ? context.verifiedProof.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : []

  const proofLine = proof.length
    ? `Verified proof provided by the user: ${proof.map(item => `"${item}"`).join('; ')}.`
    : 'No testimonial, customer-story, review, award, case-study, guarantee, or performance proof has been provided.'

  return [
    'PROOF POLICY (strict):',
    proofLine,
    '- Use only the verified proof above as factual proof.',
    '- Do not invent testimonials, customer/client stories, before/after transformations, awards, reviews, satisfaction claims, case studies, guarantees, or performance claims.',
    '- Do not phrase proof gaps as if they already exist.',
    '- Do not create "Customer Testimonials" as a content pillar unless verified proof includes real testimonials.',
    '- Do not write "Hear from satisfied customers", "Read their stories", "Client Stories", or "Before and After Transformations" unless those proof/assets were provided.',
    '- If proof is missing, recommend collecting proof, asking customers for feedback, or using available factual proof only.',
  ].join('\n')
}

export function guardStrategyProofText(text: unknown, context: StrategyProofContext = {}): string {
  if (typeof text !== 'string' || !text.trim()) return typeof text === 'string' ? text : ''

  const proof = getProofAvailability(context)
  let guarded = text

  if (!proof.hasTestimonials) {
    guarded = guarded
      .replace(/\bCustomer Testimonials\b/gi, 'Proof to collect')
      .replace(/\bHear from our satisfied customers\b/gi, 'Ask customers for feedback and stories')
      .replace(/\bHear from satisfied customers\b/gi, 'Ask customers for feedback and stories')
      .replace(/\bcustomer testimonial video\b/gi, 'customer feedback request or proof-collection video')
      .replace(/\bcustomer testimonials?\b/gi, 'customer proof to collect')
      .replace(/\btestimonials?\b/gi, 'proof to collect')
      .replace(/\bsatisfied customers\b/gi, 'customers to ask for feedback')
  }

  if (!proof.hasCustomerStories) {
    guarded = guarded
      .replace(/\bclient stories\b/gi, 'client stories to collect')
      .replace(/\bclient story\b/gi, 'client story to collect')
      .replace(/\bcustomer stories\b/gi, 'customer stories to collect')
      .replace(/\bcustomer story\b/gi, 'customer story to collect')
      .replace(/\bRead their stories\b/gi, 'Collect customer stories for future use')
  }

  if (!proof.hasCustomerStories && !proof.hasCaseStudies) {
    guarded = guarded
      .replace(/\bbefore\s+and\s+after\s+transformations\b/gi, 'transformation planning walkthroughs')
      .replace(/\bbefore\s*\/\s*after\s+transformations\b/gi, 'transformation planning walkthroughs')
      .replace(/\bbefore\s+and\s+after\b/gi, 'before/after assets to collect')
      .replace(/\bbefore\s*\/\s*after\b/gi, 'before/after assets to collect')
  }

  if (!proof.hasReviews) {
    guarded = guarded
      .replace(/\bcustomer reviews?\b/gi, 'customer reviews to collect')
      .replace(/\bratings?\b/gi, 'ratings to collect')
      .replace(/\bstar ratings?\b/gi, 'star ratings to collect')
  }

  if (!proof.hasCaseStudies) {
    guarded = guarded.replace(/\bcase stud(?:y|ies)\b/gi, 'proof examples to collect')
  }

  if (!proof.hasAwards) {
    guarded = guarded
      .replace(/\baward[-\s]?winning\b/gi, 'quality-focused')
      .replace(/\bcertified\b/gi, 'to be verified')
  }

  guarded = cleanProofCollectionArtifacts(guardUnsupportedBudgetAssumptions(
    softenUnsupportedPerformancePromises(
      softenUnsupportedQualityClaims(
        softenUnsupportedServiceClaims(
          softenAbsoluteOutcomeClaims(guardUnsafeStatusLanguage(guarded)),
          context,
        ),
        context,
      ),
    ),
  ))
    .replace(/\s{2,}/g, ' ')
    .trim()

  return softenUnsupportedGuarantees(guarded)
}

export function guardStrategyProof<T>(input: T, context: StrategyProofContext = {}): T {
  return guardStrategyProofValue(input, context) as T
}

function guardStrategyProofValue(input: unknown, context: StrategyProofContext, keyPath = ''): unknown {
  if (typeof input === 'string') return guardStrategyProofText(input, context)
  if (Array.isArray(input)) {
    return input.map((item, index) => guardStrategyProofValue(item, context, `${keyPath}.${index}`))
  }
  if (input && typeof input === 'object') {
    const output: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
      const valueKeyPath = keyPath ? `${keyPath}.${key}` : key
      if (typeof value === 'string') {
        const labelCandidates = [
          key,
          valueKeyPath,
          typeof (input as Record<string, unknown>).label === 'string' ? (input as Record<string, unknown>).label as string : '',
          typeof (input as Record<string, unknown>).title === 'string' ? (input as Record<string, unknown>).title as string : '',
          typeof (input as Record<string, unknown>).name === 'string' ? (input as Record<string, unknown>).name as string : '',
        ].filter(Boolean).join(' ')
        output[key] = guardStrategyProofText(guardStructuredStatusValue(labelCandidates, value), context)
      } else {
        output[key] = guardStrategyProofValue(value, context, valueKeyPath)
      }
    }
    return output
  }
  return input
}
