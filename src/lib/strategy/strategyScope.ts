export type StrategyScopeType = 'organic' | 'paid' | 'full'

type JsonRecord = Record<string, unknown>

function isRecord(value: unknown): value is JsonRecord {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function normalizeStrategyScopeType(value: unknown): StrategyScopeType | null {
  if (value === 'paid' || value === 'full' || value === 'organic') return value
  return null
}

export function resolveStrategyScope(aiOutput: unknown): {
  type: StrategyScopeType
  includesOrganic: boolean
  includesPaid: boolean
  paidOnly: boolean
  source: 'aiOutput.strategyType' | 'aiOutput.strategyOrder.strategyType' | 'strategy.strategyType' | 'fallback'
} {
  const output = isRecord(aiOutput) ? aiOutput : {}
  const strategy = isRecord(output.strategy) ? output.strategy : {}
  const strategyOrder = isRecord(output.strategyOrder) ? output.strategyOrder : {}

  const direct = normalizeStrategyScopeType(output.strategyType)
  if (direct) {
    return {
      type: direct,
      includesOrganic: direct !== 'paid',
      includesPaid: direct !== 'organic',
      paidOnly: direct === 'paid',
      source: 'aiOutput.strategyType',
    }
  }

  const orderType = normalizeStrategyScopeType(strategyOrder.strategyType)
  if (orderType) {
    return {
      type: orderType,
      includesOrganic: orderType !== 'paid',
      includesPaid: orderType !== 'organic',
      paidOnly: orderType === 'paid',
      source: 'aiOutput.strategyOrder.strategyType',
    }
  }

  const strategyType = normalizeStrategyScopeType(strategy.strategyType)
  if (strategyType) {
    return {
      type: strategyType,
      includesOrganic: strategyType !== 'paid',
      includesPaid: strategyType !== 'organic',
      paidOnly: strategyType === 'paid',
      source: 'strategy.strategyType',
    }
  }

  return {
    type: 'organic',
    includesOrganic: true,
    includesPaid: false,
    paidOnly: false,
    source: 'fallback',
  }
}
