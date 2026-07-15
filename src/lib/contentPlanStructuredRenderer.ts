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
    reason: 'unsupported_clinic_outcome_claim',
    re: /(?:تحسين|تعزيز|زيادة|رفع)\s+(?:كفاءة|رضا|تجربة|خدمة|رعاية|نتائج)|(?:رضاهم|ثقتهم|رعاية صحية متميزة|مرضى راضين|نتائج أفضل|توفير وقتك)|(?:improve|boost|increase|enhance)\s+(?:clinic efficiency|patient satisfaction|patient experience|care quality|healthcare outcomes|results)|\bsave(?:s|d|ing)?\s+(?:you\s+)?time\b/i,
  },
  {
    reason: 'unsupported_absolute_claim',
    re: /(?:الحل الأمثل|مفتاح النجاح|تحقيق النجاح|يغير منظورك|مضمون|دائمًا|كل مرة|أفضل|مثالي|مثالية|لا تقاوم)|(?:guarantee|guaranteed|ensure|ensures|perfect|best|ultimate|game[-\s]?changer|irresistible|unmatched|extraordinary|as fresh as it gets|taste the difference|richer taste|keep our coffee fresh|expert(?:\s+brewing)? tips|elevate your|transform your|unlock the full potential|hassle[-\s]?free|better cup of coffee)/i,
  },
  {
    reason: 'unsupported_absolute_claim',
    re: /\bdelivered (?:right |straight |directly )?to your (?:door|home)\b|\beasy it is to subscribe\b|\bour (?:brewing )?tutorials\b|\bwatch our (?:brewing )?tips\b/i,
  },
  {
    reason: 'malformed_caption',
    re: /\bhelps that\b|#[\p{L}\p{N}_]*coffeeless\b/iu,
  },
  {
    reason: 'unsupported_absolute_claim',
    // Standalone guarantee verbs only. "يتضمن" means "includes" and is safe.
    re: /(?<![\p{L}\p{M}])(?:تضمن|يضمن|نضمن|أضمن)(?:\s+لك)?(?![\p{L}\p{M}])/iu,
  },
  {
    reason: 'unsupported_fake_product_visual',
    re: /(?:يظهر\s+على\s+الشاشة\s+واجهة|واجهة\s+(?:إعداد|نظام|منصة|تطبيق|المستخدم|مستخدم)|لوحة\s+تحكم|شاشة\s+(?:تعرض|توضح)|تطبيق\s+\S+\s+(?:على|في)\s+(?:هاتف|جهاز|شاشة)|(?:app|software|product)\s+(?:interface|dashboard|screen)|dashboard\s+(?:showing|displaying)|screen\s+(?:showing|displaying))/i,
  },
  {
    reason: 'unsupported_fake_product_visual',
    re: /\b(?:with|featuring|showing|displaying)\s+(?:the\s+)?[^.?!]{0,60}\blogo\b|\bhappy customer\b|\bbranded (?:roastery|clinic|office|facility|factory)\b|\bexpert (?:barista|doctor|dentist|advisor)\b/i,
  },
]

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
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
  return normalizeBrandHashtag(guardContentDraftText(text, ctx), ctx.brand)
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
  // Image direction is also kept tied to the generated post. If it is unsafe,
  // validateContentPlanDraftForSave rejects it; no alternate industry scene is
  // invented behind the user's back.
  return guardContentDraftText(normalizeText(gen.imagePrompt), ctx)
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
