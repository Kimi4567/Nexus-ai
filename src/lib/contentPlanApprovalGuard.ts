import { detectUnsupportedClaims } from '@/lib/ai/claimGuard'
import {
  validateContentPlanSemanticAlignment,
  type ContentPlanSemanticPost,
} from '@/lib/contentPlanSemanticGuard'
import { validateContentPlanDraftForSave } from '@/lib/contentPlanStructuredRenderer'

export interface ContentPlanApprovalIssue {
  index: number
  reason: string
}

export interface ContentPlanApprovalReview {
  ok: boolean
  issues: ContentPlanApprovalIssue[]
}

export function reviewContentPlanForApproval(
  posts: ContentPlanSemanticPost[],
  strategy: unknown,
  brandFacts: Array<string | string[] | null | undefined> = [],
): ContentPlanApprovalReview {
  const draftIssues = posts.flatMap((post, index) => {
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

    return [
      ...saveIssues.map(issue => ({ index: index + 1, reason: issue.reason })),
      ...claims.map(claim => ({ index: index + 1, reason: `unsupported_${claim.category}` })),
    ]
  })

  const semanticReview = validateContentPlanSemanticAlignment(posts, strategy, { brandFacts })
  const semanticIssues = semanticReview.issues.map(issue => ({
    index: issue.index,
    reason: issue.reason,
  }))
  const issues = [...draftIssues, ...semanticIssues]

  return { ok: draftIssues.length === 0 && semanticReview.ok, issues }
}
