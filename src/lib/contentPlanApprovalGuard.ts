import { detectUnsupportedClaims } from '@/lib/ai/claimGuard'
import {
  validateContentPlanSemanticAlignment,
  type ContentPlanSemanticPost,
} from '@/lib/contentPlanSemanticGuard'
import { validateContentPlanDraftForSave } from '@/lib/contentPlanStructuredRenderer'
import { hasGenericMarketingHook } from '@/lib/marketingCopyGuard'
import { guardContentDraftText } from '@/lib/ai/contentDraftTruthGuard'
import type { ClaimFinding } from '@/lib/ai/claimGuard'

export interface ContentPlanApprovalIssue {
  index: number
  reason: string
}

export interface ContentPlanApprovalReview {
  ok: boolean
  issues: ContentPlanApprovalIssue[]
}

export interface ContentPlanTruthContext {
  brandFacts: Array<string | string[] | null | undefined>
  verifiedProof: string[]
}

type ContentPlanTruthInput = ContentPlanTruthContext | ContentPlanTruthContext['brandFacts']

function isTruthContext(value: ContentPlanTruthInput): value is ContentPlanTruthContext {
  return !Array.isArray(value) && Boolean(value && typeof value === 'object')
}

function normalizedTruthContext(input: ContentPlanTruthInput = []): ContentPlanTruthContext {
  return isTruthContext(input)
    ? {
        brandFacts: Array.isArray(input.brandFacts) ? input.brandFacts : [],
        verifiedProof: Array.isArray(input.verifiedProof)
          ? input.verifiedProof.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
          : [],
      }
    : { brandFacts: input, verifiedProof: [] }
}

function normalizedEvidenceText(value: string): string {
  return value.toLocaleLowerCase().replace(/\s+/g, ' ').trim()
}

function claimHasExactVerifiedSupport(finding: ClaimFinding, context: ContentPlanTruthContext): boolean {
  // Guarantees and provider-status statements remain blocked even if Brand
  // Brain repeats them. They require legal/provider proof outside a copy field.
  if (finding.category === 'guarantee' || finding.category === 'platformStatus') return false
  const match = normalizedEvidenceText(finding.match)
  if (!match) return false
  return context.verifiedProof.some(item => normalizedEvidenceText(item).includes(match))
}

/** Build one reusable truth context for approval, media, scheduling, and publishing. */
export function buildContentPlanTruthContext(brandProfile: unknown): ContentPlanTruthContext {
  const brand = brandProfile && typeof brandProfile === 'object' && !Array.isArray(brandProfile)
    ? brandProfile as Record<string, unknown>
    : {}
  const list = (value: unknown): string[] => Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : []
  const verifiedProof = list(brand.verifiedProof)

  return {
    brandFacts: [
      typeof brand.brandName === 'string' ? brand.brandName : null,
      typeof brand.industry === 'string' ? brand.industry : null,
      typeof brand.description === 'string' ? brand.description : null,
      typeof brand.primaryOffer === 'string' ? brand.primaryOffer : null,
      typeof brand.targetAudience === 'string' ? brand.targetAudience : null,
      typeof brand.audienceAge === 'string' ? brand.audienceAge : null,
      typeof brand.audienceLocation === 'string' ? brand.audienceLocation : null,
      list(brand.audiencePainPoints),
      list(brand.audienceDesires),
      list(brand.uniqueAdvantages),
      typeof brand.pricePoint === 'string' ? brand.pricePoint : null,
      typeof brand.complianceNotes === 'string' ? brand.complianceNotes : null,
      typeof brand.conversionDestination === 'string' ? brand.conversionDestination : null,
      typeof brand.leadHandling === 'string' ? brand.leadHandling : null,
      verifiedProof,
    ],
    verifiedProof,
  }
}

export function hasGenericHookFormula(value: unknown): boolean {
  return hasGenericMarketingHook(value)
}

export function reviewContentPostForPublishing(
  post: ContentPlanSemanticPost,
  index = 1,
  truthInput: ContentPlanTruthInput = [],
): ContentPlanApprovalIssue[] {
  const truthContext = normalizedTruthContext(truthInput)
  const saveIssues = validateContentPlanDraftForSave({
    caption: post.caption,
    imagePrompt: post.imagePrompt ?? '',
    videoPrompt: post.videoPrompt ?? '',
  }).issues
  const claims = detectUnsupportedClaims([
    post.caption,
    post.imagePrompt,
    post.videoPrompt,
  ]).findings.filter(finding => !claimHasExactVerifiedSupport(finding, truthContext))
  const genericHookIssue = hasGenericHookFormula(post.caption)
    ? [{ index, reason: 'generic_hook_formula' }]
    : []
  const hasUnverifiedFeatureOrOutcome = [post.caption, post.imagePrompt, post.videoPrompt]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .some(value => guardContentDraftText(value, truthContext) !== value.trim())
  const truthIssue = hasUnverifiedFeatureOrOutcome
    ? [{ index, reason: 'unverified_feature_or_outcome' }]
    : []

  return [
    ...saveIssues.map(issue => ({ index, reason: issue.reason })),
    ...claims.map(claim => ({ index, reason: `unsupported_${claim.category}` })),
    ...genericHookIssue,
    ...truthIssue,
  ]
}

export function reviewContentPlanForApproval(
  posts: ContentPlanSemanticPost[],
  strategy: unknown,
  truthInput: ContentPlanTruthInput = [],
): ContentPlanApprovalReview {
  const truthContext = normalizedTruthContext(truthInput)
  const draftIssues = posts.flatMap((post, index) => reviewContentPostForPublishing(post, index + 1, truthContext))

  const semanticReview = validateContentPlanSemanticAlignment(posts, strategy, { brandFacts: truthContext.brandFacts })
  const semanticIssues = semanticReview.issues.map(issue => ({
    index: issue.index,
    reason: issue.reason,
  }))
  const issues = [...draftIssues, ...semanticIssues]

  return { ok: draftIssues.length === 0 && semanticReview.ok, issues }
}
