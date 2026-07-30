export interface ContentPlanSemanticPost {
  caption?: string | null
  imagePrompt?: string | null
  videoPrompt?: string | null
  contentPlanIndex?: number | null
}

export interface ContentPlanSemanticContext {
  brandFacts?: Array<string | string[] | null | undefined>
  conversionDestination?: string | null
}

export interface ContentPlanSemanticIssue {
  index: number
  reason: 'unexpected_operational_saas_drift' | 'unexpected_domain_drift' | 'missing_strategy_alignment' | 'missing_conversion_handoff'
  evidence: string[]
}

export interface ContentPlanSemanticResult {
  ok: boolean
  alignedPosts: number
  requiredAlignedPosts: number
  issues: ContentPlanSemanticIssue[]
}

const STOP_WORDS = new Set([
  'about', 'after', 'again', 'also', 'because', 'before', 'brand', 'campaign', 'clear', 'content',
  'from', 'have', 'into', 'more', 'post', 'that', 'their', 'them', 'then', 'these', 'this', 'through',
  'with', 'your', 'أكثر', 'التي', 'الذي', 'العلامة', 'المحتوى', 'إلى', 'على', 'عند', 'عن', 'فقط', 'في',
  'كان', 'كل', 'كما', 'لدى', 'لها', 'ما', 'من', 'هذا', 'هذه', 'هو', 'هي', 'مع',
])

const CLINIC_RE = /clinic|dental|dentist|healthcare|medical|patient|appointment|عياد|أسنان|طبيب|طبي|صحي|مرضى|مريض|مواعيد/i
const OPERATIONS_PRODUCT_RE = /saas|software|platform|dashboard|workflow|clinicflow|clinic\s+management|practice\s+management|appointment\s+management|operations?\s+(?:app|system|tool|platform)|برنامج|منصة|تطبيق|نظام|لوحة\s+تحكم|سير\s+العمل|إدارة\s+(?:العيادات|المواعيد|المرضى)|تشغيل\s+العيادات/i
const CONVERSION_ACTION_RE = /\b(?:book|booking|demo|trial|form|whatsapp|calendar|schedule|consultation|call)\b|(?:احجز|حجز|ديمو|تجربة|نموذج|واتساب|تقويم|موعد|مكالمة|استشارة)/iu

const STRONG_DRIFT_PATTERNS: Array<{ label: string; re: RegExp }> = [
  {
    label: 'front desk or administrative handoff',
    // "Handoff" by itself is normal customer-journey and fulfillment language
    // (for example, a delivery handoff). Treat it as business-model drift only
    // when the surrounding words identify an internal administrative workflow.
    re: /front[-\s]?desk|(?:clinic|patient|admin(?:istrative)?|team|owner|request)\s+hand[-\s]?off|hand[-\s]?off\s+(?:workflow|checklist|between\s+(?:staff|teams?|colleagues)|to\s+(?:an?\s+)?(?:owner|admin|front[-\s]?desk))/i,
  },
  {
    label: 'workflow ownership handoff',
    re: /(?:map|review|assess)\s+(?:the\s+)?(?:current\s+)?hand[-\s]?offs?\b[^.?!]{0,140}\b(?:workflow|ownership)\b|\bunified\s+workflow\b[^.?!]{0,100}\bownership\b|\bworkflow\s+makes\s+(?:task\s+)?ownership\s+clearer\b/i,
  },
  { label: 'internal ownership workflow', re: /request,?\s+owner,?\s+(?:last|latest)\s+(?:update|note)|status,?\s+owner,?.*next\s+(?:admin\s+)?step/i },
  { label: 'leadership operations', re: /before leadership sees it|team meeting|operating checklist|workflow review/i },
  { label: 'clinic administration', re: /clinic administrative workflow|administrative patient follow[-\s]?up|admin(?:istrative)?\s+(?:workflow|review|step)/i },
  { label: 'internal communication', re: /bilingual administrative communication|internal communication|team ownership|compare (?:the )?(?:current )?workflow|save this idea for review/i },
  { label: 'إدارة داخلية للعيادة', re: /فريق الاستقبال|التسليم بين الزملاء|اجتماع الفريق|قائمة مراجعة تشغيلية|العمل الإداري داخل العيادة|متابعة المرضى إداريًا/i },
]

const DOMAIN_MARKERS: Array<{ label: string; content: RegExp; brand: RegExp }> = [
  {
    label: 'coffee-domain copy in a non-coffee campaign',
    content: /\bcoffee\b|\broast(?:ed|ing|er|ery)?\b|\bcoffee beans?\b|قهوة|تحميص|حبوب\s+القهوة/iu,
    brand: /\bcoffee\b|\broast(?:ed|ing|er|ery)?\b|\bcoffee beans?\b|قهوة|تحميص|حبوب\s+القهوة/iu,
  },
  {
    label: 'real-estate copy in a non-property campaign',
    content: /\breal estate\b|\bproperty listing\b|\bvilla\b|\bapartment\b|عقار|عقارات|فيلا|شقة/iu,
    brand: /\breal estate\b|\brealty\b|\bproperty\b|\bvilla\b|\bapartment\b|عقار|عقارات|فيلا|شقة/iu,
  },
]

function stringify(value: unknown): string {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.map(stringify).join(' ')
  if (value && typeof value === 'object') return Object.values(value as Record<string, unknown>).map(stringify).join(' ')
  return ''
}

function tokens(value: unknown): Set<string> {
  const words = stringify(value)
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(word => word.length >= 3 && !STOP_WORDS.has(word))
  return new Set(words)
}

function overlapCount(left: Set<string>, right: Set<string>): number {
  let count = 0
  for (const token of left) if (right.has(token)) count += 1
  return count
}

function contentAngles(strategy: unknown): unknown[] {
  if (!strategy || typeof strategy !== 'object') return []
  const candidate = (strategy as Record<string, unknown>).contentAnglesDetailed
  return Array.isArray(candidate) ? candidate : []
}

function hasVerifiedConversionHandoff(
  posts: ContentPlanSemanticPost[],
  conversionDestination: string,
): boolean {
  const destinationTokens = tokens(conversionDestination)
  return posts.some((post) => {
    const caption = post.caption ?? ''
    return CONVERSION_ACTION_RE.test(caption)
      && overlapCount(tokens(caption), destinationTokens) >= 1
  })
}

function buildGroundedConversionCta(destination: string): string {
  const isArabic = /[\u0600-\u06ff]/u.test(destination)
  if (!isArabic) {
    const parts: string[] = []
    if (/\bdemo\b/i.test(destination) && /\b(?:form|landing page)\b/i.test(destination)) {
      parts.push('Book a demo through the landing-page form')
    } else if (/\btrial\b/i.test(destination)) {
      parts.push('Start the documented trial')
    } else if (/\bform\b/i.test(destination)) {
      parts.push('Submit the documented form')
    }
    if (/\bwhatsapp\b/i.test(destination) && /\bcalendar\b/i.test(destination)) {
      parts.push('then continue through WhatsApp or the sales calendar')
    } else if (/\bwhatsapp\b/i.test(destination)) {
      parts.push('then continue through WhatsApp')
    } else if (/\bcalendar\b/i.test(destination)) {
      parts.push('then choose a time in the sales calendar')
    }
    return parts.length > 0
      ? `${parts.join(', ')}.`
      : `Verified next step: ${destination.replace(/[.!?]+$/u, '')}.`
  }

  const parts: string[] = []
  if (/demo|ديمو/iu.test(destination) && /نموذج|صفحة\s+هبوط/iu.test(destination)) {
    parts.push('احجز Demo عبر نموذج صفحة الهبوط')
  } else if (/تجربة/iu.test(destination)) {
    parts.push('ابدأ التجربة الموضحة في العرض')
  } else if (/نموذج/iu.test(destination)) {
    parts.push('أرسل النموذج المعتمد')
  }
  if (/واتساب/iu.test(destination) && /تقويم/iu.test(destination)) {
    parts.push('ثم اختر واتساب أو تقويم المبيعات للمتابعة')
  } else if (/واتساب/iu.test(destination)) {
    parts.push('ثم تابع عبر واتساب')
  } else if (/تقويم/iu.test(destination)) {
    parts.push('ثم اختر موعدًا في تقويم المبيعات')
  }
  return parts.length > 0
    ? `${parts.join('، ')}.`
    : `الخطوة التالية المعتمدة: ${destination.replace(/[.!؟]+$/u, '')}.`
}

/**
 * The model may ignore a real funnel destination even when it is repeated in
 * the prompt. Bind one conversion-stage draft to the exact Brand Brain route
 * deterministically, then let the normal truth/save gates review the result.
 */
export function ensureContentPlanConversionHandoff<T extends ContentPlanSemanticPost>(
  posts: T[],
  strategy: unknown,
  conversionDestination?: string | null,
): T[] {
  const destination = typeof conversionDestination === 'string'
    ? conversionDestination.trim()
    : ''
  if (!destination || hasVerifiedConversionHandoff(posts, destination) || posts.length === 0) {
    return posts
  }

  const angles = contentAngles(strategy)
  let targetIndex = posts.length - 1
  for (let index = posts.length - 1; index >= 0; index--) {
    const savedDirectionIndex = Number.isInteger(posts[index].contentPlanIndex)
      && Number(posts[index].contentPlanIndex) > 0
      ? Number(posts[index].contentPlanIndex) - 1
      : index
    const angle = angles.length > 0
      ? stringify(angles[savedDirectionIndex % angles.length])
      : ''
    if (/conversion|decision|purchase|bottom|تحويل|قرار|شراء|حجز|demo|trial|تجربة/iu.test(angle)) {
      targetIndex = index
      break
    }
  }

  const cta = buildGroundedConversionCta(destination)
  return posts.map((post, index) => {
    if (index !== targetIndex) return post
    const caption = typeof post.caption === 'string' ? post.caption.trim() : ''
    return {
      ...post,
      caption: caption ? `${caption}\n\n${cta}` : cta,
    }
  })
}

/**
 * Deterministic final-save check. It does not judge copy quality; it blocks the
 * two costly failure modes a normal user cannot safely diagnose: a draft that
 * switches the kind of business being marketed, or a batch that loses contact
 * with the reviewed strategy altogether.
 */
export function validateContentPlanSemanticAlignment(
  posts: ContentPlanSemanticPost[],
  strategy: unknown,
  context: ContentPlanSemanticContext = {},
): ContentPlanSemanticResult {
  const angles = contentAngles(strategy)
  // Business classification must come from user-confirmed Brand Brain facts.
  // A stale or already-drifted strategy is not evidence that a dental provider
  // suddenly sells clinic-operations software; allowing it here let the wrong
  // strategy validate the wrong posts and defeated the final approval gate.
  const explicitBrandFacts = (context.brandFacts ?? []).map(stringify).join(' ')
  // Operational workflow language is valid for any explicitly described
  // software/platform product, not only clinic software. The previous
  // clinic-only conjunction incorrectly rejected real lead-management SaaS as
  // business-model drift. Non-software brands remain protected below.
  const explicitOperationsProduct = OPERATIONS_PRODUCT_RE.test(explicitBrandFacts)
  const overallStrategyTokens = tokens(strategy)
  const issues: ContentPlanSemanticIssue[] = []
  let alignedPosts = 0

  posts.forEach((post, index) => {
    const postText = [post.caption, post.imagePrompt, post.videoPrompt].filter(Boolean).join(' ')

    if (!explicitOperationsProduct) {
      const driftEvidence = STRONG_DRIFT_PATTERNS
        .filter(pattern => pattern.re.test(postText))
        .map(pattern => pattern.label)
      if (driftEvidence.length > 0) {
        issues.push({ index: index + 1, reason: 'unexpected_operational_saas_drift', evidence: driftEvidence })
      }
    }

    const domainDriftEvidence = DOMAIN_MARKERS
      .filter(marker => !marker.brand.test(explicitBrandFacts) && marker.content.test(postText))
      .map(marker => marker.label)
    if (domainDriftEvidence.length > 0) {
      issues.push({
        index: index + 1,
        reason: 'unexpected_domain_drift',
        evidence: domainDriftEvidence,
      })
    }

    const postTokens = tokens(postText)
    const savedDirectionIndex = Number.isInteger(post.contentPlanIndex) && Number(post.contentPlanIndex) > 0
      ? Number(post.contentPlanIndex) - 1
      : index
    const expectedAngle = angles.length > 0 ? angles[savedDirectionIndex % angles.length] : null
    const angleTokens = tokens(expectedAngle)
    const angleOverlap = angleTokens.size > 0 ? overlapCount(postTokens, angleTokens) : 0
    const overallOverlap = overlapCount(postTokens, overallStrategyTokens)
    const aligned = angles.length === 0
      ? overallStrategyTokens.size === 0 || overallOverlap >= 1
      : angleOverlap >= 1 || overallOverlap >= 2

    if (aligned) {
      alignedPosts += 1
    } else {
      issues.push({
        index: index + 1,
        reason: 'missing_strategy_alignment',
        evidence: Array.from(angleTokens).slice(0, 6),
      })
    }
  })

  const conversionDestination = typeof context.conversionDestination === 'string'
    ? context.conversionDestination.trim()
    : ''
  if (conversionDestination) {
    const destinationTokens = tokens(conversionDestination)
    if (!hasVerifiedConversionHandoff(posts, conversionDestination)) {
      issues.push({
        index: 0,
        reason: 'missing_conversion_handoff',
        evidence: Array.from(destinationTokens).slice(0, 6),
      })
    }
  }

  const requiredAlignedPosts = posts.length === 0 ? 0 : Math.max(1, Math.ceil(posts.length * 0.75))
  const hasBusinessTypeDrift = issues.some(issue => (
    issue.reason === 'unexpected_operational_saas_drift'
    || issue.reason === 'unexpected_domain_drift'
  ))
  const hasMissingConversionHandoff = issues.some(issue => issue.reason === 'missing_conversion_handoff')
  const enoughAlignedPosts = alignedPosts >= requiredAlignedPosts

  return {
    ok: posts.length > 0 && !hasBusinessTypeDrift && !hasMissingConversionHandoff && enoughAlignedPosts,
    alignedPosts,
    requiredAlignedPosts,
    issues,
  }
}
