export interface ContentPlanSemanticPost {
  caption?: string | null
  imagePrompt?: string | null
  videoPrompt?: string | null
  contentPlanIndex?: number | null
}

export interface ContentPlanSemanticContext {
  brandFacts?: Array<string | string[] | null | undefined>
}

export interface ContentPlanSemanticIssue {
  index: number
  reason: 'unexpected_operational_saas_drift' | 'missing_strategy_alignment'
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

  const requiredAlignedPosts = posts.length === 0 ? 0 : Math.max(1, Math.ceil(posts.length * 0.75))
  const hasBusinessTypeDrift = issues.some(issue => issue.reason === 'unexpected_operational_saas_drift')
  const enoughAlignedPosts = alignedPosts >= requiredAlignedPosts

  return {
    ok: posts.length > 0 && !hasBusinessTypeDrift && enoughAlignedPosts,
    alignedPosts,
    requiredAlignedPosts,
    issues,
  }
}
