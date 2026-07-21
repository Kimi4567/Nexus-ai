import { afterAll, describe, expect, it } from 'vitest'
import { runStrategistAgent } from '@/lib/agents/strategist'
import {
  buildStrategyEvalBrief,
  STRATEGY_QUALITY_CASES,
  type StrategyQualityEvalCase,
} from '@/lib/strategy/evals/strategyQualityCases'
import {
  finalizeStrategyQuality,
  prepareStrategyGenerationContext,
} from '@/lib/strategy/strategyQualityPipeline'

interface EvalResult {
  id: string
  sector: string
  language: string
  mode: string
  status: 'passed' | 'failed'
  latencyMs: number
  contractScore?: number
  qualityScore?: number
  calls?: number
  inputTokens?: number
  outputTokens?: number
  estimatedProviderCostUsd?: number
  error?: string
}

function selectedCases(): StrategyQualityEvalCase[] {
  const requestedIds = (process.env.STRATEGY_EVAL_IDS || '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean)
  const filtered = requestedIds.length
    ? STRATEGY_QUALITY_CASES.filter(testCase => requestedIds.includes(testCase.id))
    : STRATEGY_QUALITY_CASES
  const parsedLimit = Number(process.env.STRATEGY_EVAL_LIMIT || filtered.length)
  const limit = Number.isFinite(parsedLimit) && parsedLimit > 0
    ? Math.floor(parsedLimit)
    : filtered.length
  return filtered.slice(0, limit)
}

const liveEnabled = process.env.RUN_LIVE_STRATEGY_EVAL === '1'
const cases = selectedCases()
const results: EvalResult[] = []

describe.skipIf(!liveEnabled).sequential('live Strategy OS quality evaluation', () => {
  afterAll(() => {
    const passed = results.filter(result => result.status === 'passed')
    const failed = results.filter(result => result.status === 'failed')
    const totals = passed.reduce((summary, result) => ({
      calls: summary.calls + (result.calls || 0),
      inputTokens: summary.inputTokens + (result.inputTokens || 0),
      outputTokens: summary.outputTokens + (result.outputTokens || 0),
      estimatedProviderCostUsd: summary.estimatedProviderCostUsd + (result.estimatedProviderCostUsd || 0),
    }), { calls: 0, inputTokens: 0, outputTokens: 0, estimatedProviderCostUsd: 0 })

    console.info('[Strategy Eval Report]', JSON.stringify({
      requested: cases.length,
      completed: results.length,
      passed: passed.length,
      failed: failed.length,
      passRate: results.length ? Number((passed.length / results.length).toFixed(4)) : 0,
      totals: {
        ...totals,
        estimatedProviderCostUsd: Number(totals.estimatedProviderCostUsd.toFixed(6)),
      },
      results,
    }, null, 2))
  })

  it.each(cases)('$id', async testCase => {
    const startedAt = Date.now()
    try {
      const brief = buildStrategyEvalBrief(testCase)
      const context = prepareStrategyGenerationContext(testCase.brand)
      const generated = await runStrategistAgent(
        brief,
        context.brandContext,
        brief.language,
        context.readiness,
      )
      const finalized = finalizeStrategyQuality(generated, brief, context)
      const usage = generated.providerUsage

      results.push({
        id: testCase.id,
        sector: testCase.sector,
        language: testCase.order.language,
        mode: testCase.order.strategyType,
        status: 'passed',
        latencyMs: Date.now() - startedAt,
        contractScore: finalized.contractReport.score,
        qualityScore: finalized.qualityGate.score,
        calls: usage?.calls,
        inputTokens: usage?.inputTokens,
        outputTokens: usage?.outputTokens,
        estimatedProviderCostUsd: usage?.estimatedProviderCostUsd,
      })

      expect(finalized.contractReport.valid).toBe(true)
      expect(finalized.qualityGate.status).toBe('passed')
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      results.push({
        id: testCase.id,
        sector: testCase.sector,
        language: testCase.order.language,
        mode: testCase.order.strategyType,
        status: 'failed',
        latencyMs: Date.now() - startedAt,
        error: message,
      })
      throw error
    }
  }, 240_000)
})
