export interface ContentPlanOrderPostLike {
  contentPlanIndex?: number | null
  variantGroup?: string | null
}

export type ContentPlanOrderMismatchReason =
  | 'direction-count-mismatch'
  | 'paid-plan-has-posts'
  | 'missing-organic-count'

export type ContentPlanOrderReview =
  | {
      bound: false
      ok: true
      expectedDirections: null
      actualDirections: number
      strategyType: null
      reason: null
    }
  | {
      bound: true
      ok: true
      expectedDirections: number
      actualDirections: number
      strategyType: string | null
      reason: null
    }
  | {
      bound: true
      ok: false
      expectedDirections: number | null
      actualDirections: number
      strategyType: string | null
      reason: ContentPlanOrderMismatchReason
    }

interface ContentPlanOrderScope {
  bound: boolean
  expectedDirections: number | null
  strategyType: string | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeStrategyType(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim().toLowerCase() : null
}

function nonNegativeInteger(value: unknown): number | null {
  const n = Math.floor(Number(value))
  return Number.isFinite(n) && n >= 0 ? n : null
}

function positiveInteger(value: unknown): number | null {
  const n = nonNegativeInteger(value)
  return n && n > 0 ? n : null
}

function firstCount(...values: unknown[]): number | null {
  for (const value of values) {
    const n = nonNegativeInteger(value)
    if (n !== null) return n
  }
  return null
}

export function countContentPlanDirections(posts: ContentPlanOrderPostLike[]): number {
  const keys = new Set<string>()

  posts.forEach((post, index) => {
    const contentPlanIndex = positiveInteger(post.contentPlanIndex)
    if (contentPlanIndex) {
      keys.add(`index:${contentPlanIndex}`)
      return
    }

    const variantGroup = typeof post.variantGroup === 'string' ? post.variantGroup.trim() : ''
    if (variantGroup) {
      keys.add(`variant:${variantGroup}`)
      return
    }

    keys.add(`row:${index}`)
  })

  return keys.size
}

export function resolveContentPlanOrderScope(aiOutput: unknown): ContentPlanOrderScope {
  if (!isRecord(aiOutput)) {
    return { bound: false, expectedDirections: null, strategyType: null }
  }

  const order = isRecord(aiOutput.strategyOrder) ? aiOutput.strategyOrder : null
  const deliverables = isRecord(aiOutput.strategyDeliverables) ? aiOutput.strategyDeliverables : null
  const strategy = isRecord(aiOutput.strategy) ? aiOutput.strategy : null

  const strategyType =
    normalizeStrategyType(aiOutput.strategyType) ??
    normalizeStrategyType(order?.strategyType) ??
    normalizeStrategyType(strategy?.strategyType)

  const expectedDirections = firstCount(
    deliverables?.organicPostCount,
    deliverables?.requestedOrganicPostCount,
    aiOutput.organicPostCount,
    order?.customOrganicPostCount,
    order?.organicPostCount,
  )

  const bound = Boolean(
    order ||
    deliverables ||
    expectedDirections !== null
  )

  if (!bound) {
    return { bound: false, expectedDirections: null, strategyType: null }
  }

  if (strategyType === 'paid') {
    return { bound: true, expectedDirections: 0, strategyType }
  }

  return { bound: true, expectedDirections, strategyType }
}

export function deriveContentPlanOrderReview(
  aiOutput: unknown,
  posts: ContentPlanOrderPostLike[],
): ContentPlanOrderReview {
  const actualDirections = countContentPlanDirections(posts)
  const scope = resolveContentPlanOrderScope(aiOutput)

  if (!scope.bound) {
    return {
      bound: false,
      ok: true,
      expectedDirections: null,
      actualDirections,
      strategyType: null,
      reason: null,
    }
  }

  if (scope.expectedDirections === null) {
    return {
      bound: true,
      ok: false,
      expectedDirections: null,
      actualDirections,
      strategyType: scope.strategyType,
      reason: 'missing-organic-count',
    }
  }

  if (scope.strategyType === 'paid' && actualDirections > 0) {
    return {
      bound: true,
      ok: false,
      expectedDirections: 0,
      actualDirections,
      strategyType: scope.strategyType,
      reason: 'paid-plan-has-posts',
    }
  }

  if (actualDirections !== scope.expectedDirections) {
    return {
      bound: true,
      ok: false,
      expectedDirections: scope.expectedDirections,
      actualDirections,
      strategyType: scope.strategyType,
      reason: 'direction-count-mismatch',
    }
  }

  return {
    bound: true,
    ok: true,
    expectedDirections: scope.expectedDirections,
    actualDirections,
    strategyType: scope.strategyType,
    reason: null,
  }
}

export function buildContentPlanOrderMismatchMessage(review: ContentPlanOrderReview): string | null {
  if (!review.bound || review.ok) return null

  if (review.reason === 'paid-plan-has-posts') {
    return `This campaign was ordered as paid planning only, but Content Hub currently has ${review.actualDirections} post direction${review.actualDirections === 1 ? '' : 's'}. Regenerate or repair the draft plan before approval.`
  }

  if (review.reason === 'missing-organic-count') {
    return 'This campaign has a saved strategy order, but no reliable organic post-count scope. Regenerate or repair the draft plan before approval.'
  }

  return `Content Hub has ${review.actualDirections} post direction${review.actualDirections === 1 ? '' : 's'}, but the reviewed strategy order expects ${review.expectedDirections}. Regenerate or repair the draft plan before approval.`
}
