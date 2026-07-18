import { prisma } from '@/lib/prisma'
import { getWorkspaceExecutionTruthByWorkspaceId } from '@/lib/executionTruthService'
import { filterCurrentAgentSuggestions } from '@/lib/currentAgentSuggestions'
import {
  actionableApprovalSuggestions,
  dedupeLiveApprovalQueue,
} from '@/lib/approvalInboxTruth'
import { inspectBrainSignalProvenance } from '@/lib/brainSignalProvenance'

const db = prisma as any // Prisma client can lag additive production tables during rollout.

export async function getCanonicalApprovalInbox(userId: string) {
  const workspace = await prisma.workspace.findFirst({
    where: { ownerId: userId },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  })

  if (!workspace) {
    return {
      version: 1 as const,
      generatedAt: new Date().toISOString(),
      workspaceId: null,
      proposals: [],
      suggestions: [],
      liveApprovalActions: [],
      summary: { total: 0, brandBrain: 0, operational: 0, live: 0 },
    }
  }

  const now = new Date()
  const [truth, suggestionCandidates, rawProposals] = await Promise.all([
    getWorkspaceExecutionTruthByWorkspaceId(workspace.id),
    db.agentSuggestion.findMany({
      where: {
        workspaceId: workspace.id,
        status: 'PENDING',
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
      take: 200,
    }),
    db.brainLearning.findMany({
      where: { workspaceId: workspace.id, status: 'pending' },
      orderBy: { createdAt: 'desc' },
      take: 200,
    }),
  ])

  const suggestions = actionableApprovalSuggestions(
    filterCurrentAgentSuggestions(suggestionCandidates, truth),
  )
  const liveApprovalActions = dedupeLiveApprovalQueue(suggestions, truth.queue)
  const proposals = rawProposals.map((raw: Record<string, unknown>) => {
    const provenance = inspectBrainSignalProvenance({
      trigger: typeof raw.trigger === 'string' ? raw.trigger : null,
      reason: typeof raw.reason === 'string' ? raw.reason : null,
      campaignId: typeof raw.campaignId === 'string' ? raw.campaignId : null,
      evidence: raw.evidence,
    })
    return {
      ...raw,
      reason: provenance.displayReason,
      traceability: provenance.traceability,
      sourceRefs: provenance.sourceRefs,
      canAccept: provenance.canAccept,
    }
  })

  return {
    version: 1 as const,
    generatedAt: now.toISOString(),
    workspaceId: workspace.id,
    proposals,
    suggestions,
    liveApprovalActions,
    summary: {
      total: proposals.length + suggestions.length + liveApprovalActions.length,
      brandBrain: proposals.length,
      operational: suggestions.length,
      live: liveApprovalActions.length,
    },
  }
}
