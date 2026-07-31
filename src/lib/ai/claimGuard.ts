/**
 * PR-1K — Unsupported-claim guard.
 *
 * Deterministic, pattern-based detector for marketing claims that NEXUS must not
 * present as fact unless the product has evidence/source data. This is NOT a full
 * fact-checking system — it is a conservative safety net that runs AFTER the LLM
 * Sentinel review so risky claims can never silently pass (the LLM is fallible;
 * "30% productivity gain" slipped through once).
 *
 * Philosophy (rule: conservative is better than impressive): when in doubt, flag.
 * Numbers/percentages/guarantees/social-proof/awards are flagged as "needs
 * evidence" unless a caller can prove the data exists. Pure + dependency-free, so
 * it is fully unit-testable and safe to call from server agents.
 */

export type ClaimCategory =
  | 'percentage'      // "30%", "25%"
  | 'multiplier'      // "2x", "10x", "3 times faster"
  | 'performance'     // "boost sales", "increase revenue", "cut costs"
  | 'guarantee'       // "guaranteed", "proven results", "will deliver"
  | 'socialProof'     // "trusted by thousands", "customers love us"
  | 'award'           // "#1", "award-winning", "best-in-class"
  | 'caseStudy'       // "helped companies achieve", "real customers achieved"
  | 'platformStatus'  // "published automatically", "campaign is live"

export interface ClaimFinding {
  category: ClaimCategory
  /** the exact offending text matched */
  match: string
  /** short surrounding context for the UI */
  excerpt: string
}

export interface ClaimScanResult {
  /** true when at least one unsupported claim pattern was found */
  hasUnsupportedClaims: boolean
  findings: ClaimFinding[]
}

const PATTERNS: { category: ClaimCategory; re: RegExp }[] = [
  // Any bare percentage reads as an unsubstantiated stat unless sourced.
  { category: 'percentage', re: /\b\d{1,3}(?:\.\d+)?\s?%/g },
  // Multipliers: 2x / 10x / 3 times faster|more|better.
  { category: 'multiplier', re: /\b\d+(?:\.\d+)?x\b/gi },
  { category: 'multiplier', re: /\b\d+\s+times\s+(?:faster|more|better|higher|stronger|cheaper)\b/gi },
  // Hard commercial-outcome verbs paired with a money/growth metric.
  { category: 'performance', re: /\b(?:boost|increase|grow|double|triple|skyrocket|maximi[sz]e|cut|slash|reduce)\s+(?:your\s+)?(?:sales|revenue|profits?|roi|conversions?|leads?|traffic|income|costs?)\b/gi },
  // Arabic commercial-outcome and effectiveness claims. These deliberately
  // require either a measurable marketing outcome or customer-facing
  // "effective campaign/content" wording, so ordinary process improvements do
  // not become false positives.
  { category: 'performance', re: /(?:تحسين|زيادة|رفع|تعزيز|تنمية|مضاعفة)\s+(?:عدد\s+|جودة\s+)?(?:الاستفسارات|استفسارات(?:ك|كم)?|المبيعات|الإيرادات|الأرباح|التحويلات|العملاء\s+المحتملين|الزيارات|التفاعل|الوصول)(?=\s|[،,.!?؟]|$)/giu },
  { category: 'performance', re: /(?:أكثر|أعلى|عالية)\s+(?:فعالية|فاعلية)(?=\s|[،,.!?؟]|$)/giu },
  { category: 'performance', re: /(?:حملات?|محتوى|إعلانات?|استراتيجيات?|خطط)\s+(?:[\p{L}\p{M}]+\s+){0,4}(?:فعالة|فعّالة)(?=\s|[،,.!?؟]|$)/giu },
  // Reliability language is a proof claim when applied to a campaign itself.
  // "Based on approved data" is a process fact; calling the resulting campaign
  // trustworthy/reliable still needs evidence or more precise wording.
  { category: 'guarantee', re: /حملات?\s+(?:[\p{L}\p{M}]+\s+){0,4}موثوقة(?=\s|[،,.!?؟]|$)/giu },
  // Guarantees / proof language.
  { category: 'guarantee', re: /\b(?:guarantee[ds]?|guaranteed\s+results|proven\s+results|proven\s+to|risk[-\s]?free|will\s+deliver(?:\s+results)?|100%\s+guaranteed)\b/gi },
  // Arabic guarantee verbs must be standalone words. Without these Unicode
  // boundaries, ordinary phrases such as "ما يتضمنه العرض" (what the offer
  // includes) are incorrectly read as a guarantee and block approval.
  { category: 'guarantee', re: /(?<![\p{L}\p{M}])(?:تضمن|يضمن|نضمن|أضمن)(?:\s+لك)?(?![\p{L}\p{M}])|نتائج\s+مضمونة|تحميك\s+من\s+(?:مشاكل|أمراض)|يغير\s+تجربتك\s+الصحية\s+بالكامل/giu },
  { category: 'guarantee', re: /(?:لضمان|ضمان)\s+(?:راحة\s+البال|النتائج?|النجاح|الجودة|الرضا|التسليم|عدم\s+التأخير|سير\s+العمل\s+بسلاسة)(?=\s|[،,.!?؟]|$)/giu },
  { category: 'guarantee', re: /(?:لضمان|ضمان|كيفية\s+ضمان)\s+محتوى\s+(?:دقيق(?:\s+و\s*)?موثوق|موثوق)(?=\s|[،,.!?؟]|$)/giu },
  { category: 'guarantee', re: /(?:نجعل|تجعل)\s+(?:هذه\s+)?(?:ال)?رحلة\s+(?:سهلة|سلسة)(?:\s+وممتعة)?|رؤية\s+واضحة\s+للنتيجة\s+النهائية/giu },
  { category: 'guarantee', re: /دون\s+عناء(?:\s+المتابعة\s+اليومية)?|(?:نهتم|سنهتم|نعتني|سنعتني)\s+(?:لك\s+)?بكل\s+(?:شيء|التفاصيل)|(?:اترك|اتركي)\s+لنا\s+(?:كل\s+)?(?:التفاصيل|المشوار)|(?:اطمئن|اطمئني)\s+(?:و)?(?:اترك|اتركي)|تساعد\s+على\s+كل\s+التفاصيل|يحتوي\s+راحتك|راحة\s+البال|تجنب\s+المفاجآت\s+المالية|دراية\s+تامة\s+بكل\s+خطوة|إشراف(?:ًا|ا)?\s+كامل(?:ًا|اً|ا)?\s+على\s+التنفيذ/giu },
  { category: 'guarantee', re: /\b(?:hassle[-\s]?free|we\s+handle\s+every\s+detail|complete\s+peace\s+of\s+mind|avoid\s+financial\s+surprises|full\s+execution\s+supervision)\b/gi },
  // Social proof without a cited source.
  { category: 'socialProof', re: /\b(?:trusted|used|loved)\s+by\s+(?:thousands|millions|hundreds|leading|top|over\s+\d+)\b/gi },
  { category: 'socialProof', re: /\b(?:thousands|millions)\s+of\s+(?:customers|users|businesses|companies|brands)\b/gi },
  { category: 'socialProof', re: /\bcustomers\s+love\s+(?:us|it|our)\b/gi },
  { category: 'socialProof', re: /\bjoin\s+(?:thousands|millions)\b/gi },
  { category: 'socialProof', re: /(?:آراء|تجارب)\s+(?:عملائنا|العملاء|زبائننا)|عملاؤنا\s+يحبون|(?:آلاف|مئات|ملايين)\s+(?:العملاء|المستخدمين|الشركات|العلامات)/giu },
  // Awards / superlative rankings.
  { category: 'award', re: /(?:^|[^\w])#1\b/gi },
  { category: 'award', re: /\b(?:award[-\s]?winning|best[-\s]?in[-\s]?class|industry[-\s]?leading|world[-\s]?class|top[-\s]?rated|number\s+one)\b/gi },
  { category: 'award', re: /الأكثر\s+(?:فعالية|فاعلية)|(?:الأفضل|رقم\s+واحد)(?=\s|[،,.!?]|$)/gi },
  // Case-study style outcome claims.
  { category: 'caseStudy', re: /\bhelped\s+(?:companies|businesses|clients|teams|brands)\s+(?:achieve|grow|increase|save|boost|double|triple)\b/gi },
  { category: 'caseStudy', re: /\b(?:real\s+customers\s+achieved|our\s+clients\s+(?:saw|achieved|grew))\b/gi },
  { category: 'caseStudy', re: /(?:قصص|نماذج)\s+نجاح\s+(?:عملائنا|العملاء|زبائننا)|نجاحات\s+(?:عملائنا|العملاء|زبائننا)/giu },
  // Platform/status claims that require real platform confirmation.
  { category: 'platformStatus', re: /\b(?:published\s+automatically|auto[-\s]?published|campaign\s+is\s+live|ads?\s+are\s+(?:running|live)|now\s+live\s+on)\b/gi },
]

function makeExcerpt(text: string, index: number, matchLen: number): string {
  const start = Math.max(0, index - 24)
  const end = Math.min(text.length, index + matchLen + 24)
  const prefix = start > 0 ? '…' : ''
  const suffix = end < text.length ? '…' : ''
  return (prefix + text.slice(start, end).trim() + suffix).replace(/\s+/g, ' ')
}

export function hasNegatingSafetyContext(
  text: string,
  matchIndex: number,
): boolean {
  const before = text.slice(Math.max(0, matchIndex - 140), matchIndex)
    .toLocaleLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/\s+/g, ' ')
    .trimEnd()

  // Only explicit negation/safety constructions suppress a finding. Keeping
  // the action verb in these patterns is important: "No risk — guaranteed
  // results" is still advertising copy, while "do not use guaranteed results"
  // is an internal instruction and must not block the campaign.
  const englishSafety = /(?:\b(?:do\s+not|don't|never|avoid|must\s+not|should\s+not)(?:\s+(?:promise|claim|state|imply|use|offer|make|present|suggest|write|mention))?(?:\s+(?:any\s+)?(?:words?|phrases?|language)(?:\s+(?:like|such\s+as))?)?|\bwithout\s+(?:promising|claiming|stating|implying|using|offering|presenting|suggesting|writing|mentioning)|\b(?:cannot|can't)(?:\s+(?:promise|claim|state|imply|use|offer|make|present|suggest))?|\b(?:is|are)\s+not|\bnot|\bno)$/i
  const arabicSafety = /(?:(?:عدم|ممنوع)(?:\s+(?:استخدام|استعمال|ذكر|كتابة|قول|الوعد|الادعاء|تقديم|عرض))?(?:\s+(?:كلمة|كلمات|عبارة|عبارات)(?:\s+(?:مثل|من\s+قبيل))?)?|(?:تجنب|تجنّب|يجب\s+(?:الا|ألا)|لا|لن|لم|ليس|غير|بدون)(?:\s*(?:تعد|تدعي|تستخدم|تستعمل|تقدم|توحي|تذكر|تكتب|تقول|نعد|ندعي|نستخدم|نقدم|نوحي|نذكر|نكتب|نقول|استخدام|استعمال|ذكر|كتابة|قول|تقديم|عرض))?(?:\s+(?:انك|أنك|بأنك|باننا|بأننا|اننا|أننا))?)$/iu

  if (englishSafety.test(before) || arabicSafety.test(before)) return true

  // A single safety directive may list several forbidden phrases. Carry the
  // negation across that list, but never across a sentence/semicolon or an
  // explicit contrast such as "but" / "لكن".
  const clause = before.slice(Math.max(
    before.lastIndexOf('.'),
    before.lastIndexOf('!'),
    before.lastIndexOf('?'),
    before.lastIndexOf(';'),
    before.lastIndexOf('؛'),
    before.lastIndexOf('\n'),
  ) + 1)
  const hasContrast = /\b(?:but|however|instead)\b|(?:لكن|ولكن|بل)/iu.test(clause)
  if (hasContrast) return false
  const englishListDirective = /\b(?:do\s+not|don't|never|avoid|must\s+not|should\s+not)\s+(?:promise|claim|state|imply|use|offer|make|present|suggest|write|mention)\b/i
  const arabicListDirective = /(?:عدم|ممنوع)\s+(?:استخدام|استعمال|ذكر|كتابة|قول|الوعد|الادعاء|تقديم|عرض)(?![\p{L}\p{M}])|(?:تجنب|تجنّب|يجب\s+(?:الا|ألا)|لا|لن|لم)\s*(?:تعد|تدعي|تستخدم|تستعمل|تقدم|توحي|تذكر|تكتب|تقول|استخدام|استعمال|ذكر|كتابة|قول|تقديم|عرض)(?![\p{L}\p{M}])/iu
  return englishListDirective.test(clause) || arabicListDirective.test(clause)
}

/**
 * Scan text (or an array of strings) for unsupported marketing claims.
 * Returns every distinct finding with its category and a short excerpt.
 */
export function detectUnsupportedClaims(input: string | Array<string | null | undefined> | null | undefined): ClaimScanResult {
  const parts = Array.isArray(input) ? input : [input]
  const findings: ClaimFinding[] = []
  const seen = new Set<string>()

  for (const part of parts) {
    if (typeof part !== 'string' || !part.trim()) continue
    for (const { category, re } of PATTERNS) {
      re.lastIndex = 0
      let m: RegExpExecArray | null
      while ((m = re.exec(part)) !== null) {
        if (hasNegatingSafetyContext(part, m.index)) {
          if (m.index === re.lastIndex) re.lastIndex++
          continue
        }
        const match = m[0].trim()
        const key = `${category}::${match.toLowerCase()}::${m.index}::${part.slice(0, 12)}`
        if (seen.has(key)) continue
        seen.add(key)
        findings.push({ category, match, excerpt: makeExcerpt(part, m.index, m[0].length) })
        if (m.index === re.lastIndex) re.lastIndex++ // guard against zero-length loops
      }
    }
  }

  return { hasUnsupportedClaims: findings.length > 0, findings }
}

/** Human-readable label for a claim category (English; UI may localize). */
export function claimCategoryLabel(category: ClaimCategory): string {
  switch (category) {
    case 'percentage':     return 'unverified percentage'
    case 'multiplier':     return 'unverified multiplier'
    case 'performance':    return 'unverified performance/ROI claim'
    case 'guarantee':      return 'guarantee / proof claim'
    case 'socialProof':    return 'unsourced social proof'
    case 'award':          return 'award / ranking claim'
    case 'caseStudy':      return 'case-study outcome claim'
    case 'platformStatus': return 'unconfirmed platform status'
  }
}

function claimCategoryLabelAr(category: ClaimCategory): string {
  switch (category) {
    case 'percentage':     return 'نسبة غير موثقة'
    case 'multiplier':     return 'مضاعفة غير موثقة'
    case 'performance':    return 'ادعاء أداء أو عائد غير موثق'
    case 'guarantee':      return 'ضمان أو إثبات غير موثق'
    case 'socialProof':    return 'دليل اجتماعي بلا مصدر'
    case 'award':          return 'جائزة أو ترتيب غير موثق'
    case 'caseStudy':      return 'نتيجة دراسة حالة غير موثقة'
    case 'platformStatus': return 'حالة منصة غير مؤكدة'
  }
}

function isArabicLanguage(language: string | null | undefined): boolean {
  return typeof language === 'string' && language.toLowerCase().startsWith('ar')
}

/**
 * Build short, deterministic compliance-warning strings from findings, suitable
 * for appending to Sentinel's complianceWarnings. Each says WHY it was flagged.
 */
export function buildClaimWarnings(result: ClaimScanResult, language?: string | null): string[] {
  const arabic = isArabicLanguage(language)
  return result.findings.map((finding) => arabic
    ? `ادعاء غير مدعوم — يحتاج إلى دليل أو صياغة أكثر تحفظاً (${claimCategoryLabelAr(finding.category)}): «${finding.excerpt}»`
    : `Unsupported claim — needs evidence or safer wording (${claimCategoryLabel(finding.category)}): "${finding.excerpt}"`,
  )
}

/** Deterministic, actionable remediation paired with every claim warning. */
export function buildClaimFixes(result: ClaimScanResult, language?: string | null): string[] {
  const arabic = isArabicLanguage(language)
  return result.findings.map((finding) => arabic
    ? `استبدل «${finding.excerpt}» بصياغة احتمالية قابلة للقياس مثل «تهدف إلى» أو «قد تساعد على»، أو أرفق دليلاً موثقاً قبل الاستخدام.`
    : `Replace "${finding.excerpt}" with measurable, qualified wording such as "aims to" or "may help", or attach verified evidence before use.`,
  )
}

// ── PR-1K.1 — scheduled-post claim risk (display-only view model) ────────────────
// Reuses detectUnsupportedClaims to flag a single post's visible text fields so the
// UI can show a read-only "Needs evidence" warning before a scheduled post publishes.
// Pure: scans only the text passed in; never mutates or persists anything.

export interface PostLikeForClaims {
  caption?: string | null
  hook?: string | null
  cta?: string | null
  adCopy?: string | null
  title?: string | null
}

export interface PostClaimRisk {
  /** true when any visible text field contains an unsupported claim */
  hasUnsupportedClaims: boolean
  /** distinct claim categories found (for optional UI detail) */
  categories: ClaimCategory[]
}

/**
 * Display-only risk summary for a single scheduled/pending post. Scans the post's
 * visible text fields (caption/hook/cta/adCopy/title) — no data is changed.
 */
export function getPostClaimRisk(post: PostLikeForClaims | null | undefined): PostClaimRisk {
  const scan = detectUnsupportedClaims([
    post?.caption,
    post?.hook,
    post?.cta,
    post?.adCopy,
    post?.title,
  ])
  const categories = Array.from(new Set(scan.findings.map(f => f.category)))
  return { hasUnsupportedClaims: scan.hasUnsupportedClaims, categories }
}
