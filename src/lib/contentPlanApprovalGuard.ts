import { detectUnsupportedClaims } from '@/lib/ai/claimGuard'
import {
  validateContentPlanSemanticAlignment,
  type ContentPlanSemanticPost,
} from '@/lib/contentPlanSemanticGuard'
import { validateContentPlanDraftForSave } from '@/lib/contentPlanStructuredRenderer'
import { hasGenericMarketingHook } from '@/lib/marketingCopyGuard'
import { guardContentDraftText } from '@/lib/ai/contentDraftTruthGuard'

export interface ContentPlanApprovalIssue {
  index: number
  reason: string
}

export interface ContentPlanApprovalReview {
  ok: boolean
  issues: ContentPlanApprovalIssue[]
}

export function hasGenericHookFormula(value: unknown): boolean {
  return hasGenericMarketingHook(value)
}

export function reviewContentPostForPublishing(
  post: ContentPlanSemanticPost,
  index = 1,
  brandFacts: Array<string | string[] | null | undefined> = [],
): ContentPlanApprovalIssue[] {
  const saveIssues = validateContentPlanDraftForSave({
    caption: post.caption,
    imagePrompt: post.imagePrompt ?? '',
    videoPrompt: post.videoPrompt ?? '',
  }).issues
  const claims = detectUnsupportedClaims([
    post.caption,
    post.imagePrompt,
    post.videoPrompt,
  ]).findings
  const genericHookIssue = hasGenericHookFormula(post.caption)
    ? [{ index, reason: 'generic_hook_formula' }]
    : []
  const truthContext = { brandFacts }
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
  brandFacts: Array<string | string[] | null | undefined> = [],
): ContentPlanApprovalReview {
  const draftIssues = posts.flatMap((post, index) => reviewContentPostForPublishing(post, index + 1, brandFacts))

  const semanticReview = validateContentPlanSemanticAlignment(posts, strategy, { brandFacts })
  const semanticIssues = semanticReview.issues.map(issue => ({
    index: issue.index,
    reason: issue.reason,
  }))
  const issues = [...draftIssues, ...semanticIssues]

  return { ok: draftIssues.length === 0 && semanticReview.ok, issues }
}
