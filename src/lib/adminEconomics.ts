import { PUBLIC_PAID_PLANS } from '@/lib/commercialPlans'

export interface ProviderEconomicsTransaction {
  action: string
  status: string
  creditCost: number
  providerCostUsd: unknown
}

export interface ProviderEconomicsBreakdown {
  action: string
  operations: number
  refundedOperations: number
  credits: number
  providerCostUsd: number
  failedProviderCostUsd: number
}

export interface ProviderEconomicsSummary {
  periodDays: number
  billableOperations: number
  meteredOperations: number
  unmeteredOperations: number
  meterCoveragePercent: number
  refundedOperations: number
  meteredRefundedOperations: number
  settledCredits: number
  meteredCredits: number
  settledProviderCostUsd: number
  failedProviderCostUsd: number
  providerCostUsd: number
  commercialValueFloorUsd: number
  contributionBufferUsd: number
  contributionMarginPercent: number | null
  recurringCreditValueFloorUsd: number
  breakdown: ProviderEconomicsBreakdown[]
}

export const RECURRING_CREDIT_VALUE_FLOOR_USD = Math.min(
  ...PUBLIC_PAID_PLANS.map(plan => plan.priceUsd / plan.monthlyCredits),
)

function money(value: number): number {
  return Number(value.toFixed(2))
}

function cost(value: unknown): number | null {
  if (value == null) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

/**
 * Internal margin evidence only. The commercial value floor is not revenue;
 * it prices metered credits at the cheapest recurring-plan credit rate so an
 * operator can see whether measured provider COGS are safely covered.
 */
export function summarizeProviderEconomics(
  transactions: ProviderEconomicsTransaction[],
  periodDays = 30,
): ProviderEconomicsSummary {
  const terminalBillable = transactions.filter(transaction =>
    ['SETTLED', 'REFUNDED'].includes(transaction.status)
    && Number.isFinite(transaction.creditCost)
    && transaction.creditCost > 0,
  )
  const billable = terminalBillable.filter(transaction => transaction.status === 'SETTLED')
  const refunded = terminalBillable.filter(transaction => transaction.status === 'REFUNDED')
  const terminalMetered = terminalBillable.flatMap(transaction => {
    const providerCostUsd = cost(transaction.providerCostUsd)
    return providerCostUsd == null ? [] : [{ ...transaction, providerCostUsd }]
  })
  const metered = terminalMetered.filter(transaction => transaction.status === 'SETTLED')
  const meteredRefunded = terminalMetered.filter(transaction => transaction.status === 'REFUNDED')

  const settledCredits = billable.reduce((sum, transaction) => sum + transaction.creditCost, 0)
  const meteredCredits = metered.reduce((sum, transaction) => sum + transaction.creditCost, 0)
  const settledProviderCostUsd = metered.reduce((sum, transaction) => sum + transaction.providerCostUsd, 0)
  const failedProviderCostUsd = meteredRefunded.reduce((sum, transaction) => sum + transaction.providerCostUsd, 0)
  const providerCostUsd = settledProviderCostUsd + failedProviderCostUsd
  const commercialValueFloorUsd = meteredCredits * RECURRING_CREDIT_VALUE_FLOOR_USD
  const contributionBufferUsd = commercialValueFloorUsd - providerCostUsd

  const breakdownMap = new Map<string, ProviderEconomicsBreakdown>()
  for (const transaction of terminalMetered) {
    const current = breakdownMap.get(transaction.action) ?? {
      action: transaction.action,
      operations: 0,
      refundedOperations: 0,
      credits: 0,
      providerCostUsd: 0,
      failedProviderCostUsd: 0,
    }
    current.operations += 1
    current.refundedOperations += transaction.status === 'REFUNDED' ? 1 : 0
    current.credits += transaction.status === 'SETTLED' ? transaction.creditCost : 0
    current.providerCostUsd += transaction.providerCostUsd
    current.failedProviderCostUsd += transaction.status === 'REFUNDED' ? transaction.providerCostUsd : 0
    breakdownMap.set(transaction.action, current)
  }

  return {
    periodDays,
    billableOperations: billable.length,
    meteredOperations: terminalMetered.length,
    unmeteredOperations: terminalBillable.length - terminalMetered.length,
    meterCoveragePercent: terminalBillable.length > 0 ? Math.round((terminalMetered.length / terminalBillable.length) * 100) : 100,
    refundedOperations: refunded.length,
    meteredRefundedOperations: meteredRefunded.length,
    settledCredits,
    meteredCredits,
    settledProviderCostUsd: money(settledProviderCostUsd),
    failedProviderCostUsd: money(failedProviderCostUsd),
    providerCostUsd: money(providerCostUsd),
    commercialValueFloorUsd: money(commercialValueFloorUsd),
    contributionBufferUsd: money(contributionBufferUsd),
    contributionMarginPercent: commercialValueFloorUsd > 0
      ? Number(((contributionBufferUsd / commercialValueFloorUsd) * 100).toFixed(1))
      : null,
    recurringCreditValueFloorUsd: Number(RECURRING_CREDIT_VALUE_FLOOR_USD.toFixed(4)),
    breakdown: [...breakdownMap.values()]
      .map(item => ({
        ...item,
        providerCostUsd: money(item.providerCostUsd),
        failedProviderCostUsd: money(item.failedProviderCostUsd),
      }))
      .sort((left, right) => right.providerCostUsd - left.providerCostUsd),
  }
}
