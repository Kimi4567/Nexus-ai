import { detectUnsupportedClaims } from '@/lib/ai/claimGuard'
import {
  validateContentPlanSemanticAlignment,
  type ContentPlanSemanticPost,
} from '@/lib/contentPlanSemanticGuard'
import { validateContentPlanDraftForSave } from '@/lib/contentPlanStructuredRenderer'
import { hasGenericMarketingHook } from '@/lib/marketingCopyGuard'

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

  return [
    ...saveIssues.map(issue => ({ index, reason: issue.reason })),
    ...claims.map(claim => ({ index, reason: `unsupported_${claim.category}` })),
    ...genericHookIssue,
  ]
}

export function reviewContentPlanForApproval(
  posts: ContentPlanSemanticPost[],
  strategy: unknown,
  brandFacts: Array<string | string[] | null | undefined> = [],
): ContentPlanApprovalReview {
  const draftIssues = posts.flatMap((post, index) => reviewContentPostForPublishing(post, index + 1))

  const semanticReview = validateContentPlanSemanticAlignment(posts, strategy, { brandFacts })
  const semanticIssues = semanticReview.issues.map(issue => ({
    index: issue.index,
    reason: issue.reason,
  }))
  const issues = [...draftIssues, ...semanticIssues]

  return { ok: draftIssues.length === 0 && semanticReview.ok, issues }
}
