import { guardContentDraftText, type ContentDraftTruthContext } from '@/lib/ai/contentDraftTruthGuard'

export interface ContentPlanRenderContext extends ContentDraftTruthContext {
  brand: string
  campaignName?: string
  keyMessage?: string
  targetAudience?: string
  contentPillars?: string[]
  offer?: string
  platform?: string
  isArabic: boolean
  postIndex: number
}

export interface GeneratedContentPlanPostLike {
  caption?: unknown
  videoCaption?: unknown
  text?: unknown
  imagePrompt?: unknown
  videoScript?: unknown
}

export type ContentPlanSaveGateReason =
  | 'unsupported_clinic_outcome_claim'
  | 'unsupported_performance_claim'
  | 'unsupported_security_claim'
  | 'unsupported_absolute_claim'
  | 'unsupported_fake_product_visual'
  | 'malformed_caption'

export interface ContentPlanSaveGateIssue {
  field: string
  reason: ContentPlanSaveGateReason
  match: string
}

export interface ContentPlanSaveGateResult {
  ok: boolean
  issues: ContentPlanSaveGateIssue[]
}

const ARABIC_RE = /[\u0600-\u06ff]/

// A clinic may be either the business being marketed (dentist, medical centre,
// etc.) or the customer of an operations product. The old detector treated any
// healthcare word — and even "bilingual" — as proof that the brand sold clinic
// software. That replaced valid provider copy with unrelated front-desk SaaS
// templates. Require both sides of the classification before using them.
const CLINIC_CONTEXT_RE =
  /clinic|dental|dentist|healthcare|medical|patient|appointment|عياد|أسنان|طبيب|طبي|صحي|مرضى|مريض|مواعيد|رعاية/i

const CLINIC_OPERATIONS_PRODUCT_RE =
  /saas|software|platform|dashboard|workflow|clinicflow|clinic\s+management|practice\s+management|appointment\s+management|patient\s+management|operations?\s+(?:app|system|tool|platform)|(?:app|system|tool|platform)\s+for\s+(?:clinics?|healthcare)|برنامج|منصة|تطبيق|نظام|لوحة\s+تحكم|سير\s+العمل|إدارة\s+(?:العيادات|المراكز|المواعيد|المرضى)|تشغيل\s+العيادات/i

const CUSTOMER_WORKFLOW_PRODUCT_RE =
  /saas|software|platform|workflow|crm|customer\s+(?:request|follow[-\s]?up|management)|lead\s+(?:follow[-\s]?up|management)|sales\s+(?:pipeline|opportunit)|منصة|برنامج|تطبيق|نظام|سير\s+العمل/i

const CUSTOMER_WORKFLOW_DOMAIN_RE =
  /customer|client|lead|sales|pipeline|crm|طلبات\s+العملاء|متابعة\s+العملاء|العملاء|فرص\s+البيع|إدارة\s+المبيعات|متابعة\s+المبيعات/i

const UNSAFE_PATTERNS: Array<{ reason: ContentPlanSaveGateReason; re: RegExp }> = [
  {
    reason: 'unsupported_performance_claim',
    re: /(?:يمكن\s+أن\s+)?(?:يقلل|يخفض)\s+من\s+أيام\s+التحصيل|تقليل\s+أيام\s+التحصيل|(?:تحسين|تعزيز)\s+(?:تدفقك|التدفق)\s+النقدي|(?:يوفر|يقدم)\s+لك\s+تنبؤات?\s+موثوقة|(?:توقعات|تنبؤات)\s+(?:أسبوعية\s+)?(?:موثوقة|دقيقة|مضمونة)|(?:التنبؤ|توقع)\s+ب?التدفق\s+النقدي\s+بثقة|تقليل\s+الضغط\s+على\s+السيولة|دون\s+الحاجة\s+إلى\s+زيادة\s+الفريق|\bcan\s+(?:reduce|shorten)\s+(?:invoice\s+)?collection\s+(?:days|time)\b|\bimprov(?:e|ing)\s+(?:your\s+)?cash\s+flow\b/iu,
  },
  {
    reason: 'unsupported_clinic_outcome_claim',
    re: /(?:تحسين|تعزيز|زيادة|رفع)\s+(?:كفاءة|رضا|تجربة|خدمة|رعاية|نتائج)|(?:رضاهم|ثقتهم|رعاية صحية متميزة|مرضى راضين|نتائج أفضل|توفير وقتك)|(?:improve|boost|increase|enhance)\s+(?:clinic efficiency|patient satisfaction|patient experience|care quality|healthcare outcomes|results)|\bsave(?:s|d|ing)?\s+(?:you\s+)?time\b/i,
  },
  {
    reason: 'unsupported_security_claim',
    re: /(?:protect|secure|safeguard)\s+(?:your|clinic|patient)?\s*data|our\s+security\s+(?:measures|procedures)|secure\s+(?:and\s+)?integrated\s+data|احمِ?\s+بيانات|حماية\s+بيانات|تأمين\s+بيانات|إجراءات\s+الأمان\s+لدينا|إدارة\s+متكاملة\s+وآمنة/i,
  },
  {
    reason: 'unsupported_absolute_claim',
    re: /(?:الحل الأمثل|مفتاح النجاح|تحقيق النجاح|يغير منظورك|مضمون|دائمًا|كل مرة|أفضل|مثالي|مثالية|لا تقاوم|لا\s+مثيل\s+ل(?:ها|ه)|لا\s+(?:داعي|حاجة)\s+للقلق[^.!؟]{0,80}نفاد|لا\s+(?:مزيد|مزيدًا)\s+من\s+(?:التأخير|التأخر)\s+في\s+التوصيل|تأكد\s+من\s+جودة|بكل\s+سهولة|ضمان\s+(?:ال)?(?:توقيت|التوصيل|الجودة|جودة|النتائج)|نحرص\s+على\s+جودة\s+التحميص)|(?:guarantee|guaranteed|ensure|ensures|perfect|best|ultimate|game[-\s]?changer|irresistible|unmatched|extraordinary|as fresh as it gets|taste the difference|richer taste|keep our coffee fresh|expert(?:\s+brewing)? tips|elevate your|transform your|unlock the full potential|hassle[-\s]?free|better cup of coffee)/i,
  },
  {
    reason: 'unsupported_absolute_claim',
    re: /\bdelivered (?:right |straight |directly )?to your (?:door|home)\b|\beasy it is to subscribe\b|\bour (?:brewing )?tutorials\b|\bwatch our (?:brewing )?tips\b/i,
  },
  {
    reason: 'unsupported_absolute_claim',
    re: /\btimely deliver(?:y|ies)\b|\bon[-\s]?time deliver(?:y|ies)\b|\bmarked\s+delivery\s+date\b|\bdeliver(?:ed|y)\s+on\s+(?:the\s+)?marked\s+date\b|\bquality\s+in\s+every\s+bean\b/i,
  },
  {
    reason: 'malformed_caption',
    re: /\bhelps that\b|\bhelp consistent\b|\bhelp quality\b|\bhelp your [^.!?]{0,80} remains\b|\bHelp your campaigns are\b|\bHelp unified communication\b|يساعد على من هوية|ندعم? أن تظل|راجع\s+تفاصيل\s+القهوة\s+المحمصة\s+المتاحة\s+راجع|يعتمد\s+على\s+الموقع\s+وموثوق|في\s+حالاتها\s+مناسب|المتاحةالموثقة|هل\s+تتساءل\s+عن\s+سرعة\s+توصيل\s+القهوة؟\s*راجع\s+مدى\s+ملاءمة\s+اشتراكنا|#[\p{L}\p{N}_]*coffeeless\b/iu,
  },
  {
    reason: 'malformed_caption',
    // Case-sensitive by design: sentence-start ". With NEXUS" is valid,
    // while the observed model defect was a lowercase ". with NEXUS".
    re: /\.\s+with\s+[A-Z0-9]/u,
  },
  {
    reason: 'unsupported_absolute_claim',
    re: /\beliminat(?:e|es|ed|ing) scattered efforts\b|\bachieve seamless operations\b|\benhances? resource utilization\b|\btrust that every marketing decision\b|\bput your budget concerns to rest\b|\bknow exactly where your marketing spend is going\b|\bbudget predictability\b|\bhelps transparency and predictability\b|\bmanage your marketing spend effectively\b|\bmanage your marketing spend with confidence\b|\bstay in control of your budget\b|\bprovides insights and control over your budget\b|\bgives you insights into your spending\b|\bhelping budget control\b|\bbudget control benefits\b|\bconsistent brand messaging maintained by AI\b|\bwon't hold you back\b|\bachieving marketing success\b|\bmaximize your resources\b|\brun smoothly and effectively\b|\benhance marketing strategies\b|\benhance your marketing strategies\b|\benhances marketing solutions\b|\bfull potential\b|\bseamless,? end-to-end workflow\b|\bhelping seamless marketing workflows\b|\bintegrates all your marketing needs\b|\bhelps maintain your brand voice\b|\bhelps your brand voice is unified\b|\bmake the most of your resources\b|ضمان دقة وفعالية الاستراتيجيات|دمج الموافقة البشرية في كل خطوة|نتائج موثوقة|مدروسة وآمنة|التحكم الكامل في إنفاقك|تحسين عملياتك التسويقية/i,
  },
  {
    reason: 'unsupported_absolute_claim',
    // Standalone guarantee verbs only. "يتضمن" means "includes" and is safe.
    re: /(?<![\p{L}\p{M}])(?:ل)?(?:تضمن|يضمن|نضمن|أضمن)(?:\s+لك)?(?![\p{L}\p{M}])/iu,
  },
  {
    reason: 'unsupported_absolute_claim',
    re: /توصيل\s+(?:القهوة|المنتج|الطلب)[^.!؟]{0,60}\s+إلى\s+(?:منزلك|المنزل)|التوصيل\s+إلى\s+(?:منزلك|المنزل)/iu,
  },
  {
    reason: 'unsupported_fake_product_visual',
    re: /(?:يظهر\s+على\s+الشاشة\s+واجهة|واجهة\s+(?:إعداد|نظام|منصة|تطبيق|المستخدم|مستخدم)|لوحة\s+تحكم|شاشة\s+(?:تعرض|توضح)|تطبيق\s+\S+\s+(?:على|في)\s+(?:هاتف|جهاز|شاشة)|(?:app|software|product)\s+(?:interface|dashboard|screen)|dashboard\s+(?:showing|displaying)|screen\s+(?:showing|displaying))/i,
  },
  {
    reason: 'unsupported_fake_product_visual',
    re: /\b(?:with|featuring|showing|displaying)\s+(?:the\s+)?[^.?!]{0,60}\blogo\b|\bhappy customer\b|\bbranded (?:roastery|clinic|office|facility|factory)\b|\bexpert (?:barista|doctor|dentist|advisor)\b|ردود\s+أفعال\s+(?:العملاء|العميل)|(?:عملاء|عميل)\s+(?:سعداء|سعيد|راضون|راضين|راضٍ|راضي)|شهادات?\s+(?:العملاء|عميل)|عملية\s+تحميص[^.!؟]{0,100}\s+(?:في|داخل)\s+[\p{L}\p{N}]/iu,
  },
  {
    reason: 'unsupported_fake_product_visual',
    re: /\b(?:coffee\s+)?beans?\s+being\s+(?:roasted|packed|sealed)\b|\b(?:delivery\s+)?van\b[^.?!]{0,100}\bbranding\b|\bbranded\s+(?:bags?|boxes?|packages?|packaging|vehicles?|vans?)\b|\b(?:bags?|boxes?|packages?)\s+(?:labelled|labeled)\s+['"][^'"]+['"]|\b(?:a|the) person\s+(?:receives?|opens?|unboxes?|uses?|enjoys?)\b/i,
  },
  {
    reason: 'unsupported_fake_product_visual',
    re: /مشهد\s*\d+\s*:\s*شخص|عملية\s+(?:ال)?(?:اشتراك|تحميص|تعبئة|تغليف|توصيل)|(?:شاهد|اكتشف|تعرّف|تعرف)\s+كيف\s+يتم\s+تحميص\s+القهوة|(?:تعبئة|تغليف)\s+القهوة(?:\s+في\s+(?:أكياس|عبوات))?|استلام\s+القهوة(?:\s+الطازجة)?\s+(?:في|إلى)\s+المنزل|توصيل\s+القهوة\s+إلى\s+باب\s+(?:العميل|المنزل)|(?:شخص|العميل)\s+(?:ينتظر|يستلم|يتسلم|يفتح|يستخدم|يستمتع)/i,
  },
  {
    reason: 'unsupported_fake_product_visual',
    // Generated Arabic storyboards sometimes request exact on-screen copy even
    // when the campaign has no approved first-party media. Treat that as
    // unavailable visual evidence so the renderer falls back to a text-free
    // editorial concept instead of persisting an instruction the media model
    // cannot reliably reproduce.
    re: /(?:مشهد\s*\d+\s*:[^.!؟]{0,120})?(?:نص|عبارة|كلمات)\s*(?:مقروء(?:ة)?|على\s+الشاشة)?\s*:\s*['"«][^'"»]{2,120}['"»]|(?:إظهار|عرض|يظهر|اعرض)\s+(?:نص|عبارة|كلمات)\s+(?:مقروء(?:ة)?|على\s+الشاشة)/iu,
  },
  {
    reason: 'unsupported_fake_product_visual',
    re: /(?:نص|عبارة|كلمات)[^.!؟]{0,60}(?:على\s+الشاشة|يوضح|توضح|يدعو)|(?:شاحنة|سيارة|مركبة)\s+(?:ال)?توصيل|القهوة\s+تصل\s+إلى\s+(?:العميل|المنزل)|(?:الطلب|القهوة)\s+يصل\s+إلى\s+(?:العميل|المنزل)/iu,
  },
  {
    reason: 'unsupported_fake_product_visual',
    re: /(?:ظهور|إظهار|عرض)\s+(?:سريع\s+ل)?(?:نص|واجهة|منصة|لوحة\s+تحكم)|(?:نص|عبارة|كلمات)[^.!؟]{0,100}يظهر\s+على\s+الشاشة|(?:عرض|إظهار)\s+واجهة\s+[\p{L}\p{N}]/iu,
  },
]

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
}

function normalizeEditorialTopic(value: string): string {
  return value
    .replace(/\bCoffee documented product details to review\b/gi, 'documented coffee product details')
    .replace(/^Review\s+the\s+/i, 'the ')
    .replace(/^Review\s+/i, '')
    .replace(/[.!؟]+$/u, '')
    .trim()
}

function buildEditorialImageFallback(ctx: ContentPlanRenderContext): string {
  const pillar = Array.isArray(ctx.contentPillars) && ctx.contentPillars.length > 0
    ? ctx.contentPillars[ctx.postIndex % ctx.contentPillars.length]
    : ''
  const topic = normalizeEditorialTopic(guardContentDraftText(
    normalizeText(pillar) || normalizeText(ctx.keyMessage) || normalizeText(ctx.campaignName) || 'the reviewed campaign topic',
    ctx,
  ))
  const audience = guardContentDraftText(
    normalizeText(ctx.targetAudience) || 'the intended audience',
    ctx,
  )

  return softenResidualContentPlanAbsolutes(
    `Editorial conceptual illustration for ${audience} about ${topic}, using abstract cards, connectors, and neutral workflow symbols. Use no screens, screenshots, readable text, logos, customer likenesses, branded facilities, or implied product evidence.`,
  )
}

function buildEditorialVideoFallback(ctx: ContentPlanRenderContext): string {
  const pillar = Array.isArray(ctx.contentPillars) && ctx.contentPillars.length > 0
    ? ctx.contentPillars[ctx.postIndex % ctx.contentPillars.length]
    : ''
  const topic = normalizeEditorialTopic(guardContentDraftText(
    normalizeText(pillar) || normalizeText(ctx.keyMessage) || normalizeText(ctx.campaignName) || 'the reviewed campaign topic',
    ctx,
  ))
  const audience = guardContentDraftText(
    normalizeText(ctx.targetAudience) || 'the intended audience',
    ctx,
  )

  return softenResidualContentPlanAbsolutes(
    `Short-form editorial video concept for ${audience} about ${topic}. Use neutral close-up details, simple object motion, and abstract transitions. Use no screens, screenshots, readable text, logos, customer or expert likenesses, branded facilities, testimonials, or implied product evidence.`,
  )
}

function isRealEstateContentContext(ctx: ContentPlanRenderContext): boolean {
  const facts = Array.isArray(ctx.brandFacts)
    ? ctx.brandFacts.flat(Infinity).filter((value): value is string => typeof value === 'string')
    : []
  const context = [
    ...facts,
    ctx.brand,
    ctx.campaignName,
    ctx.keyMessage,
    ctx.offer,
  ].filter((value): value is string => typeof value === 'string').join(' ')
  return /\b(?:real estate|realty|property marketing|property brokerage|estate agency|realtor|brokerage)\b|(?:تسويق عقاري|عقارات|وساطة عقارية|شركة عقارية|مكتب عقاري)/iu.test(context)
}

function softenResidualContentPlanAbsolutes(text: string): string {
  // Content-plan persistence has a stricter policy than the shared draft
  // guard: even otherwise-benign uses of "always" are rejected because the
  // surrounding model sentence may turn them into an unverified guarantee.
  // Apply one narrow lexical softening here so a safe draft can remain usable
  // without weakening the independent save gate or inventing replacement
  // facts. The shared guard intentionally keeps procedural uses unchanged in
  // other product surfaces.
  return text
    .replace(/دائمًا|دائما/gu, 'بشكل منتظم')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function normalizeBrandHashtag(text: string, brand: string): string {
  const brandTokens = brand.trim().split(/[^\p{L}\p{N}]+/u).filter(Boolean)
  if (brandTokens.length < 2) return text

  const canonical = brandTokens.join('')
  const normalizedCanonical = canonical.toLocaleLowerCase()
  return text.replace(/#([\p{L}\p{N}_]+)/gu, (full, rawTag: string) => {
    const normalizedTag = rawTag.replace(/_/g, '').toLocaleLowerCase()
    return normalizedTag.startsWith(normalizedCanonical) ? `#${canonical}` : full
  })
}

function finalizeCaption(text: string, ctx: ContentPlanRenderContext): string {
  return normalizeBrandHashtag(
    softenResidualContentPlanAbsolutes(guardContentDraftText(text, ctx)),
    ctx.brand,
  )
}

function stringifyContextValue(value: unknown): string {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.map(stringifyContextValue).join(' ')
  if (value && typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).map(stringifyContextValue).join(' ')
  }
  return ''
}

export function isClinicOperationalSaasContent(ctx: ContentPlanRenderContext, _gen: GeneratedContentPlanPostLike = {}): boolean {
  // Product classification must come from user-confirmed Brand Brain facts.
  // Generated copy and strategy prose are not evidence: if the model drifts into
  // "workflow/platform" language for a dental provider, it must not activate the
  // clinic-SaaS renderer and amplify that drift across every post.
  const explicitFacts = stringifyContextValue(ctx.brandFacts ?? [])
  return CLINIC_CONTEXT_RE.test(explicitFacts) && CLINIC_OPERATIONS_PRODUCT_RE.test(explicitFacts)
}

export function isCustomerWorkflowSaasContent(ctx: ContentPlanRenderContext): boolean {
  const explicitFacts = stringifyContextValue(ctx.brandFacts ?? [])
  return CUSTOMER_WORKFLOW_PRODUCT_RE.test(explicitFacts) && CUSTOMER_WORKFLOW_DOMAIN_RE.test(explicitFacts)
}

export function renderContentPlanDraftCaption(
  gen: GeneratedContentPlanPostLike,
  ctx: ContentPlanRenderContext,
): string {
  const source = normalizeText(gen.caption) || normalizeText(gen.videoCaption) || normalizeText(gen.text)
  // The renderer may sanitize model copy, but it must never replace it with a
  // separate domain template. Template substitution created a second content
  // source and previously turned a dental-service campaign into clinic-admin
  // software posts. Empty/unsafe output now reaches the save gate and fails
  // with a refund instead of being silently replaced with invented content.
  return source ? finalizeCaption(source, ctx) : ''
}

export function renderContentPlanDraftImagePrompt(
  gen: GeneratedContentPlanPostLike,
  ctx: ContentPlanRenderContext,
): string {
  const rawPrompt = normalizeText(gen.imagePrompt)
  const guardedPrompt = softenResidualContentPlanAbsolutes(guardContentDraftText(rawPrompt, ctx))
  const inventsUnavailableVisualEvidence = UNSAFE_PATTERNS.some((pattern) => (
    pattern.reason === 'unsupported_fake_product_visual'
      && (pattern.re.test(rawPrompt) || pattern.re.test(guardedPrompt))
  ))
  const hasUsableVisualDirection =
    /(?:photo|image|illustration|graphic|composition|scene|abstract|color|shape|icon|gradient|texture|layout|visual|صورة|رسم|تصميم|مشهد|ألوان|رموز|تجريدي|إنفوجرافيك)/iu.test(guardedPrompt)
  if (!inventsUnavailableVisualEvidence && hasUsableVisualDirection) return guardedPrompt

  // A generated screenshot, logo, customer, branded facility, or expert would
  // fabricate evidence the user never supplied. Keep the post usable by
  // converting only that visual direction into a truth-safe conceptual brief
  // grounded in the reviewed campaign topic and audience. This does not invent
  // a product view, testimonial, or alternate industry scene.
  return buildEditorialImageFallback(ctx)
}

export function renderContentPlanDraftVideoPrompt(
  gen: GeneratedContentPlanPostLike,
  ctx: ContentPlanRenderContext,
): string {
  if (isRealEstateContentContext(ctx)) {
    return ctx.isArabic
      ? 'فيلم صور عقاري يحافظ على المصدر. استخدم فقط 3–6 صور محللة يختارها المستخدم ويؤكد أنها لنفس العقار وأن لديه حق استخدامها. رتّب الصور بحركة كاميرا وانتقالات وطبقات نص منفصلة. لا تولّد أو تضف أو تستنتج غرفًا أو واجهات أو أشخاصًا أو موقعًا أو سعرًا أو مساحة أو عدد غرف أو إطلالة أو وسائل راحة أو توفرًا أو عائدًا استثماريًا. أي معلومة عقارية ظاهرة يجب أن تطابق نصًا معتمدًا ودليلًا موثقًا.'
      : 'Source-locked property photo film. Use only 3–6 analysed photographs selected by the user, who confirms they show the same property and are rights-cleared. Sequence those photos with camera motion, transitions, and separate typography layers. Do not generate, add, or infer rooms, facades, people, location, price, area, room count, view, amenities, availability, or investment performance. Any visible listing fact must match approved copy and source-linked evidence.'
  }

  const rawPrompt = normalizeText(gen.videoScript) || normalizeText(gen.videoCaption)
  const guardedPrompt = softenResidualContentPlanAbsolutes(guardContentDraftText(rawPrompt, ctx))
  const inventsUnavailableVisualEvidence = UNSAFE_PATTERNS.some((pattern) => (
    pattern.reason === 'unsupported_fake_product_visual'
      && (pattern.re.test(rawPrompt) || pattern.re.test(guardedPrompt))
  ))
  const hasUsableVideoDirection =
    /(?:video|film|scene|shot|camera|motion|transition|animation|فيديو|فيلم|مشهد|لقطة|كاميرا|حركة|انتقال)/iu.test(guardedPrompt)
  if (!inventsUnavailableVisualEvidence && hasUsableVideoDirection) return guardedPrompt

  return buildEditorialVideoFallback(ctx)
}

export function validateContentPlanDraftForSave(fields: Record<string, unknown>): ContentPlanSaveGateResult {
  const issues: ContentPlanSaveGateIssue[] = []

  for (const [field, raw] of Object.entries(fields)) {
    if (typeof raw !== 'string') continue
    const value = raw.trim()
    if (field === 'caption' && value.length < 12) {
      issues.push({ field, reason: 'malformed_caption', match: value })
      continue
    }

    for (const pattern of UNSAFE_PATTERNS) {
      const match = value.match(pattern.re)
      if (match?.[0]) {
        issues.push({ field, reason: pattern.reason, match: match[0] })
      }
    }

    if (field === 'caption' && ARABIC_RE.test(value) && /\b(?:Meta|LinkedIn|TikTok|YouTube)\b/.test(value)) {
      continue
    }
  }

  return { ok: issues.length === 0, issues }
}
