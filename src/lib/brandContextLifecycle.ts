import { createHash } from 'node:crypto'

const BRAND_CONTEXT_IDENTITY_FIELDS = new Set([
  'brandName',
  'industry',
  'primaryOffer',
  'websiteUrl',
])

type BrandContextProfile = Record<string, unknown> | null | undefined

type UpdateManyResult = { count: number }

export interface BrandContextInvalidationStore {
  competitor: {
    updateMany(args: Record<string, unknown>): Promise<UpdateManyResult>
  }
  competitorSignal: {
    updateMany(args: Record<string, unknown>): Promise<UpdateManyResult>
  }
  brainLearning: {
    updateMany(args: Record<string, unknown>): Promise<UpdateManyResult>
  }
  competitorSource: {
    updateMany(args: Record<string, unknown>): Promise<UpdateManyResult>
  }
}

export interface BrandContextInvalidationResult {
  required: boolean
  competitorsPaused: number
  signalsDismissed: number
  proposalsDismissed: number
}

function normalizedContextValue(value: unknown): string {
  return typeof value === 'string'
    ? value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-US')
    : ''
}

export function brandContextFingerprint(profile: BrandContextProfile): string {
  const context = {
    brandName: normalizedContextValue(profile?.brandName),
    industry: normalizedContextValue(profile?.industry),
    primaryOffer: normalizedContextValue(profile?.primaryOffer),
    websiteUrl: normalizedContextValue(profile?.websiteUrl),
  }
  return createHash('sha256').update(JSON.stringify(context)).digest('hex')
}

export function hasBrandIdentityChange(changedFields: string[]): boolean {
  return changedFields.some(field => BRAND_CONTEXT_IDENTITY_FIELDS.has(field))
}

export async function invalidateDependentBrandContext(
  store: BrandContextInvalidationStore,
  workspaceId: string,
  changedFields: string[],
  invalidatedAt = new Date(),
): Promise<BrandContextInvalidationResult> {
  if (!hasBrandIdentityChange(changedFields)) {
    return {
      required: false,
      competitorsPaused: 0,
      signalsDismissed: 0,
      proposalsDismissed: 0,
    }
  }

  const [competitors, signals, proposals] = await Promise.all([
    store.competitor.updateMany({
      where: {
        workspaceId,
        contextReviewRequired: false,
      },
      data: {
        status: 'PAUSED',
        contextReviewRequired: true,
        contextInvalidatedAt: invalidatedAt,
        nextScanAt: null,
      },
    }),
    store.competitorSignal.updateMany({
      where: {
        workspaceId,
        status: { in: ['NEW', 'REVIEWED', 'PROPOSED'] },
      },
      data: {
        status: 'DISMISSED',
        reviewedAt: invalidatedAt,
        reviewedBy: 'SYSTEM:BRAND_CONTEXT_CHANGED',
      },
    }),
    store.brainLearning.updateMany({
      where: {
        workspaceId,
        trigger: 'competitor_monitor',
        status: 'pending',
      },
      data: { status: 'dismissed' },
    }),
    store.competitorSource.updateMany({
      where: { workspaceId },
      data: {
        leaseUntil: null,
        leaseToken: null,
      },
    }),
  ])

  return {
    required: competitors.count > 0,
    competitorsPaused: competitors.count,
    signalsDismissed: signals.count,
    proposalsDismissed: proposals.count,
  }
}
