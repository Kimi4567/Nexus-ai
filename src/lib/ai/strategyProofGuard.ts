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
  /**
   * Facts allowed to support commercial reassurance specifically. When
   * omitted, allowedClaimText remains the backwards-compatible source.
   * Production strategy flows set this to explicit proof entries so an
   * AI-suggested advantage cannot validate another AI-generated promise.
   */
  commercialClaimText?: string[] | null
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
    .replace(/\bvisual content will (?:drive|build|increase) trust\b[^.?!]*/gi, 'Whether visual content strengthens trust signals is a hypothesis to test')
    .replace(/\bengagement will (?:lead to|drive|generate) (?:qualified )?(?:inquiries|leads|sales|conversions|consultation requests?)\b[^.?!]*/gi, 'Test whether engagement is associated with qualified inquiries')
    .replace(/\b(?:this|the) (?:content|campaign|strategy) will (?:drive|boost|increase|generate) (?:trust|engagement|inquiries|leads|sales|conversions)\b[^.?!]*/gi, 'Treat the intended outcome as a hypothesis and validate it with real platform evidence')
    .replace(/المحتوى\s+المرئي\s+سي(?:بني|عزز|زيد)\s+الثقة[^.؟!]*/gi, 'مدى دعم المحتوى المرئي لإشارات الثقة فرضية تحتاج إلى اختبار')
    .replace(/التفاعل\s+سيؤدي\s+إلى\s+(?:استفسارات|عملاء\s+محتملين|مبيعات|تحويلات)[^.؟!]*/gi, 'اختبر ما إذا كان التفاعل يرتبط باستفسارات مؤهلة')
    .replace(/(?:هذا|هذه)\s+(?:المحتوى|الحملة|الاستراتيجية)\s+سي(?:زيد|عزز|حقق|ولد)\s+(?:الثقة|التفاعل|الاستفسارات|العملاء\s+المحتملين|المبيعات|التحويلات)[^.؟!]*/gi, 'تعامل مع النتيجة المقصودة كفرضية وتحقق منها ببيانات المنصة الفعلية')
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

function softenUnsupportedExperienceClaims(text: string, context: StrategyProofContext): string {
  const allowed = (Array.isArray(context.commercialClaimText)
    ? context.commercialClaimText
    : context.allowedClaimText
  )?.filter((item): item is string => typeof item === 'string').join(' ') || ''
  let guarded = text

  if (!hasAffirmedClaim(allowed, /إشراف(?:ًا|ا)?\s+كامل(?:ًا|اً|ا)?|\bfull\s+(?:execution\s+)?supervision\b/i)) {
    guarded = guarded
      .replace(/إشراف(?:ًا|ا)?\s+كامل(?:ًا|اً|ا)?\s+على\s+التنفيذ/giu, 'إشرافًا على التنفيذ ضمن النطاق المتفق عليه')
      .replace(/\bfull\s+(?:execution\s+)?supervision\b/gi, 'supervision within the agreed execution scope')
  }

  guarded = guarded
    .replace(/لضمان\s+الجودة/giu, 'مع نقاط مراجعة للجودة')
    .replace(/\bto\s+(?:ensure|guarantee)\s+quality\b/gi, 'with documented quality review points')

  if (!hasAffirmedClaim(allowed, /\b(?:seamless|hassle[-\s]?free|smooth)\s+(?:renovation|experience|journey|process)\b|تجربة\s+(?:سلسة|بلا\s+متاعب)/i)) {
    guarded = guarded
      .replace(/\bexperience\s+a\s+seamless\s+renovation\b/gi, 'Review a structured renovation plan')
      .replace(/\bseamless\s+renovation\b/gi, 'structured renovation plan')
      .replace(/\bhassle[-\s]?free\s+renovation\b/gi, 'renovation with documented stages to review')
      .replace(/\bsmooth\s+renovation\s+journey\b/gi, 'structured renovation process')
      .replace(/\bseamless\s+(?:experience|journey|process)\b/gi, 'documented process to review')
      .replace(/تجربة\s+(?:سلسة|بلا\s+متاعب)/gi, 'خطوات موثقة للمراجعة')
  }

  if (!hasAffirmedClaim(allowed, /\bno surprises\b|بلا مفاجآت|دون مفاجآت/i)) {
    guarded = guarded
      .replace(/\bour\s+(?:clear\s+)?project\s+phases?\s+ensures?\s+no\s+surprises\.?/gi, 'Review the documented project phases before execution.')
      .replace(/\bour\s+phased\s+approach\s+ensures?\s+no\s+surprises\.?/gi, 'Review the documented project phases before execution.')
      .replace(/\b(?:ensure|ensures|with)\s+no\s+surprises\b/gi, 'supports a clearer pre-execution review')
      .replace(/\bno\s+surprises\b/gi, 'items documented for review before execution')
      .replace(/(?:بلا|دون)\s+مفاجآت/gi, 'مع بنود موثقة للمراجعة قبل التنفيذ')
  }

  if (!hasAffirmedClaim(allowed, /\bpeace of mind\b|راحة البال/i)) {
    guarded = guarded
      .replace(/\b(?:for|with)\s+(?:your\s+)?peace\s+of\s+mind\b/gi, 'to support a clearer decision')
      .replace(/\bexperience\s+peace\s+of\s+mind\b/gi, 'Review the documented decision details')
      .replace(/\bpeace\s+of\s+mind\b/gi, 'clearer decision context')
      .replace(/(?:ل|من أجل)\s*راحة\s+البال/gi, 'لدعم قرار أوضح')
      .replace(/راحة\s+البال/gi, 'وضوح القرار')
  }

  guarded = guarded
    .replace(/\bour\s+clear\s+project\s+phases?\s+ensures?\s+you\s+know\s+exactly\s+what\s+to\s+expect\.?/gi, 'Review the documented project phases before execution.')
    .replace(/\bknow\s+exactly\s+what\s+to\s+expect\b/gi, 'review the documented project phases')
    .replace(/\bnever\s+miss\s+a\s+beat\b/gi, 'Review each scheduled project update')
    .replace(/\bupdates?\s+you\s+can\s+rely\s+on\b/gi, 'Review the weekly update process')
    .replace(/\bour\s+structured\s+approach\s+ensures?\s+a\s+structured\s+renovation\s+process\.?/gi, 'Our structured approach documents the renovation stages for review.')
    .replace(/\bour\s+phased\s+approach\s+makes\s+renovation\s+simple\s+and\s+clear\.?/gi, 'Our phased approach documents the renovation stages for review.')
    .replace(/\bcapitali[sz]e\s+on\s+(?:the\s+)?growing\s+(?:interest|demand)\s+in\b[^.?!]*/gi, 'begin testing the reviewed demand hypothesis with a measurable baseline')
    .replace(/\bdiscover\s+how\s+we\s+make\s+renovations?\s+with\s+clear\s+next\s+steps\s+with\s+clear\s+phases\b/gi, 'Review how the documented renovation phases connect to each next step')
    .replace(/\bsee\s+how\s+transparent\s+costs\s+can\s+lead\s+to\s+a\s+with\s+clear\s+next\s+steps\s+renovation\b/gi, 'Review the documented scope and cost details before the next renovation decision')
    .replace(/\bare\s+and\s+aligned\b/gi, 'are aligned')

  // A timeline or phased plan can make delivery easier to review, but it is
  // not proof that execution will finish on time. Keep an explicitly supplied
  // commercial guarantee intact; otherwise neutralize the outcome promise in
  // any nested audience/copy field before it can be approved or exported.
  if (!hasAffirmedClaim(allowed, /\bguarantee(?:s|d)?\s+(?:(?:timely|on[-\s]?time)\s+(?:project\s+)?(?:completion|delivery)|(?:project\s+)?delivery\s+on\s+time)\b/i)) {
    guarded = guarded
      .replace(
        /\bour\s+([^.!?]{1,80}?)\s+guarantees?\s+(?:(?:timely|on[-\s]?time)\s+(?:project\s+)?(?:completion|delivery)|(?:project\s+)?delivery\s+on\s+time)\b/gi,
        'Our $1 supports a clearer pre-execution timeline review',
      )
  }

  return guarded
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

function replaceAffirmedOfferAssurance(
  text: string,
  pattern: RegExp,
  replacement: string,
): string {
  const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`
  const scanner = new RegExp(pattern.source, flags)
  return text.replace(scanner, (...args: unknown[]) => {
    const match = String(args[0] ?? '')
    const offset = Number(args[args.length - 2])
    const before = text.slice(Math.max(0, offset - 48), offset)
    const negated = /(?:\b(?:avoid|never|not|no|without|do\s+not\s+use|must\s+not\s+use)\s+|(?:تجنب|تجنّب|لا\s+تستخدم|بدون|غير)\s*)$/i.test(before)
    return negated ? match : replacement
  })
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

  // Value-for-money and price positioning are factual commercial claims. Keep
  // them only when the Brand Brain explicitly confirms the same positioning.
  if (!hasAffirmedClaim(allowed, /\b(?:value for money|affordable|competitive pricing|cost[-\s]?effective|budget[-\s]?friendly)\b|قيمة (?:ممتازة|رائعة) مقابل|أسعار تنافسية|سعر مناسب|في المتناول/i)) {
    guarded = guarded
      .replace(/(?:نظامنا|الخدمة|العرض)\s+(?:يقدم|تقدم|يوفر|توفر)\s+قيمة (?:ممتازة|رائعة|أفضل) مقابل (?:التكلفة|السعر)/gi, 'تحقق من السعر وما يتضمنه العرض قبل الرد على اعتراض التكلفة')
      .replace(/\b(?:excellent|great|best) value (?:for money|relative to (?:the )?cost|at (?:this|the) price)\b/gi, 'pricing and included value to confirm before using this claim')
      .replace(/\bvalue for money\b/gi, 'pricing and included value to confirm')
      .replace(/\bcompetitive pricing\b/gi, 'pricing to compare after confirmation')
      .replace(/\bcost[-\s]?effective\b/gi, 'cost and value to verify')
      .replace(/\baffordable\b/gi, 'priced after confirmation')
      .replace(/\bbudget[-\s]?friendly\s+renovations?\b/gi, 'Renovation budget review')
      .replace(/\bbudget[-\s]?friendly\b/gi, 'budget details to review')
      .replace(/قيمة (?:ممتازة|رائعة|أفضل) مقابل (?:التكلفة|السعر)/gi, 'وضّح السعر وما يتضمنه العرض قبل استخدام ادعاء القيمة')
      .replace(/(?:ب)?أسعار تنافسية/gi, 'بتفاصيل سعر تحتاج إلى تأكيد')
      .replace(/سعر مناسب|في المتناول|اقتصادي(?:ة)?/gi, 'سعر يحتاج إلى تأكيد')
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

/**
 * Product-quality reassurance, shopping-experience adjectives, and universal
 * fit claims are commercial promises even when they do not use a classic
 * superlative such as "premium" or "best". Keep them only when Brand Brain
 * contains the same owner-supplied fact; otherwise turn them into a concrete
 * review or proof task before the strategy can be saved.
 */
function softenUnsupportedOfferAssurances(text: string, context: StrategyProofContext): string {
  // Commercial reassurance needs an explicit proof entry, not a positioning
  // field or an AI-suggested advantage. Brand Brain descriptions and unique
  // advantages can legitimately guide strategy, but they are not evidence
  // that product quality or the shopping experience has already been proven.
  const allowed = (Array.isArray(context.commercialClaimText)
    ? context.commercialClaimText
    : context.allowedClaimText
  )?.filter((item): item is string => typeof item === 'string').join(' ') || ''
  let guarded = text

  const qualityAssurancePattern = /\b(?:guaranteed|assured)\s+quality\b|\bquality\s+(?:guarantee|assurance)\b|ضمان\s+(?:جودة|الخامات?|المنتج|الخدمة)|جودة\s+(?:مضمونة|مؤكدة)/i
  if (!hasAffirmedClaim(allowed, qualityAssurancePattern)) {
    guarded = replaceAffirmedOfferAssurance(
      guarded,
      qualityAssurancePattern,
      /[\u0600-\u06ff]/i.test(guarded)
        ? 'تفاصيل المنتج الموثقة المطلوب مراجعتها'
        : 'documented product details to review',
    )
  }

  if (!hasAffirmedClaim(allowed, /\b(?:trusted|verified|proven)\s+(?:product\s+)?quality\b|\bquality\s+(?:customers?|you)\s+can\s+trust\b|(?:جودة\s+(?:المنتج|الخدمة)\s+موثقة|جودة\s+يمكن(?:ك)?\s+الوثوق\s+بها|ثقة\s+موثقة\s+في\s+جودة)/i)) {
    guarded = guarded
      .replace(/\b(?:trust|confidence)\s+in\s+(?:the\s+)?(?:product|service)\s+quality\b/gi, 'Product details needed to evaluate quality')
      .replace(/\b(?:product\s+)?quality\s+(?:customers?|you)\s+can\s+trust\b/gi, 'Product details to review before evaluating quality')
      .replace(/\btrusted\s+(?:product\s+)?quality\b/gi, 'Product quality to verify from documented details')
      .replace(/(?:ال)?ثقة\s+في\s+جودة\s+(?:المنتج|الخدمة|الخامات?)/gi, 'تفاصيل المنتج المطلوبة لتقييم الجودة')
      .replace(/جودة\s+(?:يمكنك|يمكن|تستطيع)\s+الوثوق\s+بها/gi, 'تفاصيل المنتج التي يلزم مراجعتها قبل تقييم الجودة')
      .replace(/جودة\s+(?:المنتج|الخدمة)\s+الموثوقة/gi, 'جودة المنتج التي يلزم التحقق منها')
  }

  if (!hasAffirmedClaim(allowed, /\b(?:easy|safe|secure|smooth|comfortable|organized|seamless|unforgettable|exceptional)(?:\s+and\s+(?:easy|safe|secure|smooth|comfortable|organized|seamless))*\s+(?:shopping|purchase|buying|checkout|ordering)\s+(?:experience|process|journey|flow)\b|تجربة\s+(?:شراء|تسو[ّ]?ق)\s+(?:آمنة|سلسة|سهلة|مريحة|منظمة|مميزة|استثنائية|لا\s+ت[ُ]?نسى)/i)) {
    guarded = guarded
      .replace(/\b(?:an?\s+)?(?:easy|safe|secure|smooth|comfortable|organized|seamless|unforgettable|exceptional)(?:\s+and\s+(?:easy|safe|secure|smooth|comfortable|organized|seamless))*\s+(?:shopping|purchase|buying|checkout|ordering)\s+(?:experience|process|journey|flow)\b/gi, 'shopping steps to document and review')
      .replace(/\bshop\s+(?:easily|comfortably|with ease|with confidence)\b/gi, 'review the available shopping steps')
      .replace(/تجربة\s+(?:شراء|تسو[ّ]?ق)\s+(?:سهلة\s+ومريحة|لا\s+ت[ُ]?نسى|استثنائية|مميزة|منظمة|مريحة|سهلة)/gi, 'خطوات شراء يلزم توثيقها ومراجعتها')
      .replace(/تسو[ّ]?ق(?:ي)?\s+(?:بسهولة\s+وراحة|بكل\s+سهولة|بسهولة|بثقة)/gi, 'راجعي خطوات الشراء المتاحة')
  }

  if (!hasAffirmedClaim(allowed, /\bchoose\s+(?:the\s+)?(?:right|correct)\s+size\s+(?:easily|with\s+ease|confidently)\b|اختار(?:ي)?\s+المقاس\s+(?:المناسب|الصحيح)\s+(?:بسهولة|بثقة)/i)) {
    guarded = guarded
      .replace(/\bchoose\s+(?:the\s+)?(?:right|correct)\s+size\s+(?:easily|with\s+ease|confidently)\b/gi, 'review documented sizing details before selection')
      .replace(/اختار(?:ي)?\s+المقاس\s+(?:المناسب|الصحيح)\s+(?:بسهولة|بثقة)/gi, 'راجعي تفاصيل المقاسات الموثقة قبل الاختيار')
  }

  if (!hasAffirmedClaim(allowed, /\b(?:(?:combine|combines|blends?)\s+)?(?:style|elegance)\s+(?:and|with)\s+comfort\b|(?:الأناقة\s+والراحة|(?:تجمع|يجمع)\s+بين\s+(?:الأناقة|التصميم)\s+والراحة)/i)) {
    guarded = guarded
      .replace(/\b(?:(?:combine|combines|blends?)\s+)?(?:style|elegance)\s+(?:and|with)\s+comfort\b/gi, 'review design details and wear-comfort evidence when available')
      .replace(/(?:عبايات?|تصاميم)?\s*(?:تجمع|يجمع)\s+بين\s+(?:الأناقة|التصميم)\s+والراحة/gi, 'راجعي تفاصيل التصميم ودليل ملاءمة الارتداء عند توفره')
      .replace(/الأناقة\s+والراحة/gi, 'تفاصيل التصميم وملاءمة الارتداء للمراجعة')
  }

  if (!hasAffirmedClaim(allowed, /\b(?:unique|distinctive|exclusive)\s+designs?\b|تصاميم(?:\s+[\u0600-\u06ff]{2,30})?\s+(?:ال)?(?:فريدة|مميزة|حصرية)(?:\s+و(?:فريدة|مميزة|حصرية))*/i)) {
    guarded = guarded
      .replace(/\b(?:unique|distinctive|exclusive)\s+designs?\b/gi, 'design details to compare after review')
      .replace(/(?:تميزي\s+ب)?تصاميم(?:\s+[\u0600-\u06ff]{2,30})?\s+(?:ال)?(?:فريدة|مميزة|حصرية)(?:\s+و(?:فريدة|مميزة|حصرية))*/gi, 'راجعي تفاصيل التصميم الموثقة قبل تقييم التميّز')
  }

  if (!hasAffirmedClaim(allowed, /\b(?:for|fits?|suits?)\s+(?:every|any|all)\s+occasions?\b|(?:تلائم|تناسب)\s+كل\s+مناسبة|لكل\s+المناسبات/i)) {
    guarded = guarded
      .replace(/\b(?:designed|made|styled)?\s*(?:to\s+fit\s+|to\s+suit\s+|for\s+)(?:every|any|all)\s+occasions?\b/gi, ' with fit to review for each stated occasion')
      .replace(/(?:عبايات?|تصاميم)\s+(?:تلائم|تناسب)\s+كل\s+مناسبة/gi, 'راجعي ملاءمة كل تصميم للمناسبة المحددة')
      .replace(/(?:تلائم|تناسب)\s+كل\s+مناسبة/gi, 'تحتاج مراجعة ملاءمتها للمناسبة المحددة')
      .replace(/لكل\s+المناسبات/gi, 'للمناسبات المحددة بعد مراجعة التفاصيل')
  }

  if (!hasAffirmedClaim(allowed, /\bwithout\s+compromising\s+on\s+(?:style|quality|comfort)\b|دون\s+(?:التنازل|مساومة)\s+عن\s+(?:الأناقة|الجودة|الراحة)/i)) {
    guarded = guarded
      .replace(/\bwithout\s+compromising\s+on\s+(?:style|quality|comfort)\b/gi, 'with the fit and product details still to review')
      .replace(/دون\s+(?:التنازل|مساومة)\s+عن\s+(?:الأناقة|الجودة|الراحة)/gi, 'مع مراجعة الملاءمة وتفاصيل المنتج')
  }

  return guarded
}

function cleanProofCollectionArtifacts(text: string): string {
  return text
    .replace(/\b((?:(?:customer|client)\s+stor(?:y|ies)|customer\s+proof|customer\s+reviews?|star\s+ratings?|ratings?|proof(?:\s+examples?)?)\s+to\s+collect)(?:\s+to\s+collect)+\b/gi, '$1')
    .replace(/\s+([,.;!?])/g, '$1')
}

function softenUnsupportedPerformancePromises(text: string): string {
  const startedCapitalized = /^[A-Z]/.test(text.trimStart())
  const guarded = text
    .replace(
      /\b([^.!?\n]{2,80}?)\s+will\s+(?:reduce|cut|lower|increase|boost|grow|maximi[sz]e)\s+(?:your\s+)?(sales|revenue|profits?|conversions?|leads?|traffic|income|costs?)([^.!?\n]*)/gi,
      (_match, subject: string, metric: string, suffix: string) =>
        `Test whether ${subject.trim()} changes ${metric}${suffix}`,
    )
    .replace(/\b(?:increase|boost|grow|maximi[sz]e|double|triple)\s+your\s+(sales|revenue|profits?|conversions?|leads?|traffic)\b/gi, 'support your $1 goals')
    .replace(/\b(?:increase|boost|grow|maximi[sz]e|double|triple)\s+(sales|revenue|profits?|conversions?|leads?|traffic)\b/gi, 'support $1 goals')
  return startedCapitalized ? guarded.replace(/^([a-z])/, char => char.toUpperCase()) : guarded
}

function softenUnsupportedServiceClaims(text: string, context: StrategyProofContext): string {
  const allowed = allowedClaimsText(context)
  let guarded = text

  if (!/\bfree\b|مجان(?:ية|ي(?:اً|ًا|ا)?)/i.test(allowed)) {
    guarded = guarded
      .replace(/\bfree\s+(consultation|discovery session|assessment|audit|quote)\b/gi, '$1')
      .replace(/((?:جلسة\s+(?:اكتشاف|استشارة)|استشارة|معاينة|تقييم|عرض\s+سعر))\s+مجان(?:ية|ي(?:اً|ًا|ا)?)/giu, '$1')
  }

  if (!/\b(?:fast|quick|rapid|same[-\s]?day)\b|سريع(?:ة|اً|ًا|ا)?|في\s+نفس\s+اليوم/i.test(allowed)) {
    guarded = guarded
      .replace(/\b(?:fast|quick|rapid)\s+renovation\b/gi, 'organized renovation')
      .replace(/تجديد(?:ًا|ا)?\s+سريع(?:ة|اً|ًا|ا)?(?:\s+وفع[ّ]?ال(?:ة|اً|ًا|ا)?)?/giu, 'تجديد منظم')
  }

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
    '- A webinar, workshop, whitepaper, guide, checklist, demo, product tour, explainer video, or success story may be presented as an existing conversion asset only when it appears in the user-provided Brand Brain or Evidence Library.',
    '- When one of those assets would help but is not provided, label it explicitly as a proposed asset to create and approve. Never attach a download, registration, watch, or booking CTA to it yet.',
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
      .replace(/(?:آراء|تجارب)\s+(?:عملائنا|العملاء|زبائننا)/giu, 'إثبات اجتماعي مطلوب جمعه والتحقق منه')
      .replace(/عملاؤنا\s+يحبون/giu, 'اطلب ملاحظات العملاء وتحقق منها قبل استخدامها')
      .replace(/(?:آلاف|مئات|ملايين)\s+(?:العملاء|المستخدمين|الشركات|العلامات)/giu, 'عدد العملاء يحتاج إلى إثبات موثّق')
  }

  if (!proof.hasCustomerStories) {
    guarded = guarded
      .replace(/\bclient stories\b/gi, 'client stories to collect')
      .replace(/\bclient story\b/gi, 'client story to collect')
      .replace(/\bcustomer stories\b/gi, 'customer stories to collect')
      .replace(/\bcustomer story\b/gi, 'customer story to collect')
      .replace(/\bsuccess stories\b/gi, 'customer proof stories to collect and approve')
      .replace(/\bsuccess story\b/gi, 'customer proof story to collect and approve')
      .replace(/\bRead their stories\b/gi, 'Collect customer stories for future use')
      .replace(/(?:قصص|نماذج)\s+نجاح\s+(?:عملائنا|العملاء|زبائننا)/giu, 'أمثلة عملاء مطلوب جمعها واعتمادها')
      .replace(/نجاحات\s+(?:عملائنا|العملاء|زبائننا)/giu, 'نتائج عملاء مطلوب توثيقها واعتمادها')
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
      .replace(/(?:تقييمات|مراجعات)\s+(?:عملائنا|العملاء|زبائننا)/giu, 'تقييمات مطلوب جمعها والتحقق منها')
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
        softenUnsupportedOfferAssurances(
          softenUnsupportedServiceClaims(
            softenUnsupportedExperienceClaims(
              softenAbsoluteOutcomeClaims(guardUnsafeStatusLanguage(guarded)),
              context,
            ),
            context,
          ),
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

function guardUnsupportedActionAsset(text: string, context: StrategyProofContext): string {
  const approved = [
    ...(Array.isArray(context.allowedClaimText) ? context.allowedClaimText : []),
    ...(Array.isArray(context.verifiedProof) ? context.verifiedProof : []),
  ].join(' ').toLowerCase()

  let guarded = text
  const hasDownloadAsset = /\b(?:guide|ebook|e-book|whitepaper|checklist|report|template)\b|دليل|كتاب إلكتروني|قائمة مراجعة|تقرير|قالب/i.test(approved)
  const hasWebinar = /\b(?:webinar|workshop|masterclass)\b|ندوة|ورشة|جلسة تدريب/i.test(approved)
  const hasDemo = /\b(?:demo|product tour)\b|عرض توضيحي|تجربة المنتج/i.test(approved)
  const hasExplainerVideo = /\b(?:explainer|product|demonstration|walkthrough)\s+video\b|فيديو (?:توضيحي|للمنتج|استعراضي)/i.test(approved)

  if (!hasDownloadAsset) {
    guarded = guarded
      .replace(/\b(?:download|get|grab|read|open|view)\s+(?:(?:the|our|your|a)\s+)?(?:[\w-]+\s+){0,5}(?:guide|ebook|e-book|whitepaper|checklist|report|template)\b/gi, 'Request details after the resource is created and approved')
      .replace(/(?:حمّل|حمل|نزّل|نزل)\s+(?:ال)?(?:دليل|كتاب إلكتروني|قائمة مراجعة|تقرير|قالب)/gi, 'اطلب التفاصيل بعد إنشاء الأصل واعتماده')
  }
  if (!hasWebinar) {
    guarded = guarded
      .replace(/\b(?:join|register for|reserve (?:a|your) (?:seat|spot) (?:for|in))\s+(?:(?:the|our|a)\s+)?(?:[\w-]+\s+){0,5}(?:webinar|workshop|masterclass)\b/gi, 'Request an update after the session is created and scheduled')
      .replace(/(?:سجّل|سجل|انضم)\s+(?:في|إلى|لل)?\s*(?:ال)?(?:ندوة|ورشة|جلسة تدريب)/gi, 'اطلب إشعارًا بعد إنشاء الجلسة وجدولتها')
  }
  if (!hasDemo) {
    guarded = guarded
      .replace(/\b(?:book|watch|request)\s+(?:a\s+|the\s+|our\s+)?(?:demo|product tour)\b/gi, 'Request product details')
      .replace(/(?:احجز|شاهد|اطلب)\s+(?:عرضًا|عرضا|الـ)?\s*(?:توضيحيًا|توضيحيا|تجريبيًا|تجريبيا)/gi, 'اطلب تفاصيل المنتج')
  }
  if (!hasExplainerVideo) {
    guarded = guarded
      .replace(/\b(?:watch|view|see)\s+(?:(?:the|our|a)\s+)?(?:[\w-]+\s+){0,4}(?:explainer|product|demonstration|walkthrough)\s+video\b/gi, 'Request an update after the video is created and approved')
      .replace(/(?:شاهد|اعرض|اطّلع على)\s+(?:ال)?فيديو\s+(?:التوضيحي|الخاص بالمنتج|الاستعراضي)/gi, 'اطلب إشعارًا بعد إنشاء الفيديو واعتماده')
  }

  return guarded
}

function actionBearingPath(keyPath: string): boolean {
  return /(?:^|\.)(?:cta|callToAction|nextStep|offerCTAStrategy|ctaVariations)(?:\.|$)/i.test(keyPath)
}

function assetBearingPath(keyPath: string): boolean {
  return /(?:^|\.)(?:format|contentType|asset|assets|assetsNeeded|requiredAssets|deliverables|title|name)(?:\.|$)/i.test(keyPath)
}

function plannedAssetNeedsCreation(text: string, context: StrategyProofContext): boolean {
  const approved = [
    ...(Array.isArray(context.allowedClaimText) ? context.allowedClaimText : []),
    ...(Array.isArray(context.verifiedProof) ? context.verifiedProof : []),
  ].join(' ')
  const assetKinds = [
    /\b(?:webinar|workshop|masterclass)\b|ندوة|ورشة|جلسة تدريب/i,
    /\b(?:whitepaper|e-?book|guide|checklist|report|template)\b|دليل|كتاب إلكتروني|قائمة مراجعة|تقرير|قالب/i,
    /\b(?:live\s+demo|product\s+tour)\b|عرض توضيحي/i,
    /\b(?:(?:explainer|demo|demonstration|walkthrough|workflow|product|short)\s+)?video\b|فيديو(?:\s+(?:توضيحي|للمنتج|استعراضي|قصير))?/i,
    /\binfographic\b|إنفوجرافيك|رسم معلوماتي/i,
  ]
  return assetKinds.some(pattern => pattern.test(text) && !pattern.test(approved))
}

function neutralizeConsumptionCtaForUnbuiltAsset(text: string): string {
  if (/^[\u0600-\u06FF]/.test(text.trim())) {
    return /^(?:شاهد|اعرض|اطّلع|اقرأ|حمّل|حمل|نزّل|نزل|سجّل|سجل|انضم)\b/i.test(text.trim())
      ? 'اطلب إشعارًا بعد إنشاء هذا الأصل واعتماده'
      : text
  }
  return /^(?:watch|view|see|read|open|download|get|grab|join|register)\b/i.test(text.trim())
    ? 'Request an update after this asset is created and approved'
    : text
}

function guardUnsupportedPlannedAsset(text: string, context: StrategyProofContext): string {
  if (!plannedAssetNeedsCreation(text, context)) return text

  // Preserve explicit production tasks. They already tell the reviewer that
  // the item does not exist yet and must be created before a CTA can use it.
  if (/\b(?:proposed|create|produce|develop|record|draft|to create|to produce|needs creation|collect and approve)\b|(?:مقترح|إنشاء|أنشئ|إنتاج|سجّل|تطوير|مطلوب إنشاؤه|لإنشائه|وجمعه واعتماده)/i.test(text)) {
    return text
  }

  const isArabic = /[\u0600-\u06FF]/.test(text)
  return isArabic
    ? `أصل مقترح مطلوب إنشاؤه واعتماده — ${text}`
    : `Proposed asset to create and approve — ${text}`
}

function guardStrategyProofValue(input: unknown, context: StrategyProofContext, keyPath = ''): unknown {
  if (typeof input === 'string') {
    const proofGuarded = guardStrategyProofText(input, context)
    if (actionBearingPath(keyPath)) return guardUnsupportedActionAsset(proofGuarded, context)
    return assetBearingPath(keyPath) ? guardUnsupportedPlannedAsset(proofGuarded, context) : proofGuarded
  }
  if (Array.isArray(input)) {
    return input.map((item, index) => guardStrategyProofValue(item, context, `${keyPath}.${index}`))
  }
  if (input && typeof input === 'object') {
    const output: Record<string, unknown> = {}
    const record = input as Record<string, unknown>
    const siblingAssetDescriptor = ['format', 'contentType', 'asset']
      .map(key => record[key])
      .filter((value): value is string => typeof value === 'string')
      .join(' ')
    const siblingAssetNeedsCreation = Boolean(
      siblingAssetDescriptor && plannedAssetNeedsCreation(siblingAssetDescriptor, context),
    )
    for (const [key, value] of Object.entries(record)) {
      const valueKeyPath = keyPath ? `${keyPath}.${key}` : key
      if (typeof value === 'string') {
        const labelCandidates = [
          key,
          valueKeyPath,
          typeof (input as Record<string, unknown>).label === 'string' ? (input as Record<string, unknown>).label as string : '',
          typeof (input as Record<string, unknown>).title === 'string' ? (input as Record<string, unknown>).title as string : '',
          typeof (input as Record<string, unknown>).name === 'string' ? (input as Record<string, unknown>).name as string : '',
        ].filter(Boolean).join(' ')
        const proofGuarded = guardStrategyProofText(guardStructuredStatusValue(labelCandidates, value), context)
        output[key] = actionBearingPath(valueKeyPath)
          ? siblingAssetNeedsCreation
            ? neutralizeConsumptionCtaForUnbuiltAsset(guardUnsupportedActionAsset(proofGuarded, context))
            : guardUnsupportedActionAsset(proofGuarded, context)
          : assetBearingPath(valueKeyPath)
            ? guardUnsupportedPlannedAsset(proofGuarded, context)
            : proofGuarded
      } else {
        output[key] = guardStrategyProofValue(value, context, valueKeyPath)
      }
    }
    return output
  }
  return input
}
