export type StrategyApprovalState =
  | 'draft'
  | 'blocked'
  | 'ready_for_review'
  | 'approved'
  | 'revoked'

export type StrategyApprovalBlockerCode =
  | 'STRATEGY_MISSING'
  | 'MARKETING_QUALITY_GATE_REQUIRED'
  | 'MARKETING_QUALITY_GATE_FAILED'
  | 'SENTINEL_REVIEW_REQUIRED'
  | 'SENTINEL_REVIEW_FAILED'
  | 'CAMPAIGN_NOT_EDITABLE'
  | 'PUBLISHED_CONTENT_EXISTS'
  | 'ACTIVE_PAID_CAMPAIGN_EXISTS'

export interface StrategyApprovalBlocker {
  code: StrategyApprovalBlockerCode
  phase: 'approve' | 'revoke'
  message: { en: string; ar: string }
}

export interface StrategyDecisionEvent {
  eventType: 'STRATEGY_APPROVED' | 'STRATEGY_APPROVAL_REVOKED'
  createdAt: string
  source: string
}

export interface StrategyApprovalInput {
  campaign: {
    id: string
    name: string
    status: string
    goal: string
    audience?: string | null
    platforms?: unknown
    aiOutput?: unknown
    updatedAt?: Date | string | null
  }
  latestDecision?: StrategyDecisionEvent | null
  publishedPostCount?: number
  activeAdCampaignCount?: number
}

export interface StrategyApprovalContract {
  state: StrategyApprovalState
  canApprove: boolean
  canRevoke: boolean
  approvalBlockers: StrategyApprovalBlocker[]
  revokeBlockers: StrategyApprovalBlocker[]
  decision: StrategyDecisionEvent | null
  operatingBrief: {
    campaignId: string
    campaignName: string
    objective: string
    audience: string | null
    positioning: string | null
    channels: string[]
    contentPillars: string[]
    strategyUpdatedAt: string | null
    sentinelStatus: 'not_run' | 'passed' | 'failed'
    paidExecution: 'planning_only'
    publishingPolicy: 'approval_required'
  }
}

const APPROVED_STRATEGY_STATUSES = new Set(['ACTIVE', 'SCHEDULED', 'PAUSED', 'COMPLETED'])

/**
 * Campaign statuses that can only be reached after approval in the current
 * lifecycle. SCHEDULED/COMPLETED are retained for legacy campaigns.
 */
export function hasApprovedStrategyExecutionStatus(status: string): boolean {
  return APPROVED_STRATEGY_STATUSES.has(status)
}

/**
 * Execution requires both the ACTIVE lifecycle state and current, persisted
 * quality evidence. ACTIVE alone is not proof because legacy rows may predate
 * the deterministic Brand Brain gate.
 */
export function canMutateCampaignExecution(status: string, aiOutput: unknown): boolean {
  if (status !== 'ACTIVE') return false
  const output = record(aiOutput)
  const strategy = record(output?.strategy) ?? output
  const qualityGate = record(output?.qualityGate)
  const sentinel = record(output?.sentinelReview)
  return Boolean(
    strategy
    && Object.keys(strategy).length > 0
    && qualityGate?.schemaVersion === 1
    && text(qualityGate?.status)?.toLowerCase() === 'passed'
    && (!Array.isArray(qualityGate?.blockers) || qualityGate.blockers.length === 0)
    && text(sentinel?.status)?.toLowerCase() === 'passed'
  )
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function strings(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => typeof item === 'string'
      ? item
      : text(record(item)?.pillar) ?? text(record(item)?.title) ?? text(record(item)?.name) ?? '')
    .map((item) => item.trim())
    .filter(Boolean)
}

function dateString(value: Date | string | null | undefined): string | null {
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'string' && value.trim()) return value
  return null
}

export function buildStrategyApprovalContract(input: StrategyApprovalInput): StrategyApprovalContract {
  const aiOutput = record(input.campaign.aiOutput)
  const nestedStrategy = record(aiOutput?.strategy)
  const strategy = nestedStrategy ?? aiOutput
  const hasStrategy = Boolean(strategy && Object.keys(strategy).length > 0)
  const sentinel = record(aiOutput?.sentinelReview)
  const sentinelRaw = text(sentinel?.status)?.toLowerCase()
  const sentinelStatus: 'not_run' | 'passed' | 'failed' = sentinelRaw === 'passed'
    ? 'passed'
    : sentinelRaw
      ? 'failed'
      : 'not_run'
  const qualityGate = record(aiOutput?.qualityGate)
  const qualityGateStatus = text(qualityGate?.status)?.toLowerCase()
  const qualityGateVersion = qualityGate?.schemaVersion

  const approvalBlockers: StrategyApprovalBlocker[] = []
  if (!['DRAFT', 'ACTIVE'].includes(input.campaign.status)) {
    approvalBlockers.push({
      code: 'CAMPAIGN_NOT_EDITABLE',
      phase: 'approve',
      message: {
        en: 'This campaign state cannot accept a new strategy approval.',
        ar: 'حالة الحملة الحالية لا تسمح باعتماد استراتيجية جديدة.',
      },
    })
  }
  if (!hasStrategy) {
    approvalBlockers.push({
      code: 'STRATEGY_MISSING',
      phase: 'approve',
      message: { en: 'Generate a strategy before approval.', ar: 'أنشئ الاستراتيجية قبل اعتمادها.' },
    })
  } else if (!qualityGateStatus || qualityGateVersion !== 1) {
    approvalBlockers.push({
      code: 'MARKETING_QUALITY_GATE_REQUIRED',
      phase: 'approve',
      message: {
        en: 'Run the current deterministic brand and scope review before approval.',
        ar: 'شغّل مراجعة تطابق العلامة والنطاق الحالية قبل الاعتماد.',
      },
    })
  } else if (qualityGateStatus !== 'passed' || (Array.isArray(qualityGate?.blockers) && qualityGate.blockers.length > 0)) {
    approvalBlockers.push({
      code: 'MARKETING_QUALITY_GATE_FAILED',
      phase: 'approve',
      message: {
        en: 'Regenerate the strategy after resolving its Brand Brain or scope conflicts.',
        ar: 'أعد إنشاء الاستراتيجية بعد حل تعارضات Brand Brain أو النطاق.',
      },
    })
  } else if (sentinelStatus === 'not_run') {
    approvalBlockers.push({
      code: 'SENTINEL_REVIEW_REQUIRED',
      phase: 'approve',
      message: { en: 'Complete the Sentinel quality review before approval.', ar: 'أكمل مراجعة Sentinel للجودة قبل الاعتماد.' },
    })
  } else if (sentinelStatus === 'failed') {
    approvalBlockers.push({
      code: 'SENTINEL_REVIEW_FAILED',
      phase: 'approve',
      message: { en: 'Resolve the Sentinel findings before approval.', ar: 'عالج ملاحظات Sentinel قبل الاعتماد.' },
    })
  }

  const revokeBlockers: StrategyApprovalBlocker[] = []
  const approvedLegacyStatus = hasApprovedStrategyExecutionStatus(input.campaign.status)
  if (approvedLegacyStatus && input.campaign.status !== 'ACTIVE') {
    revokeBlockers.push({
      code: 'CAMPAIGN_NOT_EDITABLE',
      phase: 'revoke',
      message: {
        en: 'Resolve the campaign execution state before revoking strategy approval.',
        ar: 'عالج حالة تنفيذ الحملة قبل إلغاء اعتماد الاستراتيجية.',
      },
    })
  }
  if ((input.publishedPostCount ?? 0) > 0) {
    revokeBlockers.push({
      code: 'PUBLISHED_CONTENT_EXISTS',
      phase: 'revoke',
      message: {
        en: 'Published content exists. Pause execution and create a new strategy revision instead of revoking history.',
        ar: 'يوجد محتوى منشور. أوقف التنفيذ وأنشئ إصدار استراتيجية جديداً بدلاً من إلغاء التاريخ.',
      },
    })
  }
  if ((input.activeAdCampaignCount ?? 0) > 0) {
    revokeBlockers.push({
      code: 'ACTIVE_PAID_CAMPAIGN_EXISTS',
      phase: 'revoke',
      message: {
        en: 'An active paid campaign is linked. Pause it before revoking strategy approval.',
        ar: 'توجد حملة مدفوعة نشطة مرتبطة. أوقفها قبل إلغاء اعتماد الاستراتيجية.',
      },
    })
  }

  const approved = input.latestDecision?.eventType === 'STRATEGY_APPROVED'
    || (approvedLegacyStatus && input.latestDecision?.eventType !== 'STRATEGY_APPROVAL_REVOKED')
  const revoked = input.latestDecision?.eventType === 'STRATEGY_APPROVAL_REVOKED'
  const hasTruthBlocker = approvalBlockers.some((blocker) => blocker.code !== 'CAMPAIGN_NOT_EDITABLE')

  // Current truth gates always outrank a stale lifecycle status or an older
  // approval event. This prevents an ACTIVE legacy campaign from appearing
  // approved while its current Brand Brain/scope review is missing or failed.
  const state: StrategyApprovalState = revoked
    ? 'revoked'
    : !hasStrategy
      ? 'draft'
      : hasTruthBlocker
        ? 'blocked'
        : approved
          ? 'approved'
          : 'ready_for_review'

  return {
    state,
    canApprove: state !== 'approved' && approvalBlockers.length === 0,
    canRevoke: state === 'approved' && revokeBlockers.length === 0,
    approvalBlockers,
    revokeBlockers,
    decision: input.latestDecision ?? null,
    operatingBrief: {
      campaignId: input.campaign.id,
      campaignName: input.campaign.name,
      objective: input.campaign.goal,
      audience: text(input.campaign.audience) ?? text(strategy?.targetAudienceRefined) ?? text(strategy?.targetAudience),
      positioning: text(strategy?.positioning) ?? text(strategy?.positioningStatement) ?? text(strategy?.keyMessage),
      channels: strings(input.campaign.platforms),
      contentPillars: strings(strategy?.contentPillars),
      strategyUpdatedAt: dateString(input.campaign.updatedAt),
      sentinelStatus,
      paidExecution: 'planning_only',
      publishingPolicy: 'approval_required',
    },
  }
}
