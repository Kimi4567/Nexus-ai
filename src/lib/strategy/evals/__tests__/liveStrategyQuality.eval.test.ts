import { afterAll, describe, expect, it } from 'vitest'
import { writeFileSync } from 'node:fs'
import {
  repairStrategistQualityFailure,
  runStrategistAgent,
} from '@/lib/agents/strategist'
import {
  buildStrategyEvalBrief,
  STRATEGY_QUALITY_CASES,
  type StrategyQualityEvalCase,
} from '@/lib/strategy/evals/strategyQualityCases'
import {
  finalizeStrategyQuality,
  prepareStrategyGenerationContext,
  StrategyQualityFailure,
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
  firstPass?: boolean
  repaired?: boolean
  issueCodes?: string[]
  affectedPaths?: string[]
  issueDetails?: string[]
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
    const firstPass = passed.filter(result => result.calls === 1)
    const repaired = passed.filter(result => (result.calls || 0) > 1)
    const sortedLatencies = results
      .map(result => result.latencyMs)
      .sort((a, b) => a - b)
    const percentile = (ratio: number) => {
      if (sortedLatencies.length === 0) return 0
      return sortedLatencies[Math.max(0, Math.ceil(sortedLatencies.length * ratio) - 1)]
    }
    const byMode = results.reduce<Record<string, {
      requested: number
      passed: number
      failed: number
      firstPass: number
      repaired: number
    }>>((summary, result) => {
      const current = summary[result.mode] || {
        requested: 0,
        passed: 0,
        failed: 0,
        firstPass: 0,
        repaired: 0,
      }
      current.requested += 1
      current[result.status] += 1
      if (result.firstPass) current.firstPass += 1
      if (result.repaired) current.repaired += 1
      summary[result.mode] = current
      return summary
    }, {})
    const totals = results.reduce((summary, result) => ({
      calls: summary.calls + (result.calls || 0),
      inputTokens: summary.inputTokens + (result.inputTokens || 0),
      outputTokens: summary.outputTokens + (result.outputTokens || 0),
      estimatedProviderCostUsd: summary.estimatedProviderCostUsd + (result.estimatedProviderCostUsd || 0),
    }), { calls: 0, inputTokens: 0, outputTokens: 0, estimatedProviderCostUsd: 0 })

    const report = {
      requested: cases.length,
      completed: results.length,
      passed: passed.length,
      failed: failed.length,
      passRate: results.length ? Number((passed.length / results.length).toFixed(4)) : 0,
      firstPassSuccessRate: results.length
        ? Number((firstPass.length / results.length).toFixed(4))
        : 0,
      successAfterRepairRate: results.length
        ? Number((passed.length / results.length).toFixed(4))
        : 0,
      repairedSuccesses: repaired.length,
      latencyMs: {
        p50: percentile(0.5),
        p95: percentile(0.95),
        max: sortedLatencies.at(-1) || 0,
      },
      byMode,
      totals: {
        ...totals,
        estimatedProviderCostUsd: Number(totals.estimatedProviderCostUsd.toFixed(6)),
      },
      results,
    }
    const serializedReport = JSON.stringify(report, null, 2)
    console.info('[Strategy Eval Report]', serializedReport)
    if (process.env.STRATEGY_EVAL_REPORT_PATH) {
      writeFileSync(process.env.STRATEGY_EVAL_REPORT_PATH, `${serializedReport}\n`, 'utf8')
    }
  })

  it.each(cases)('$id', async testCase => {
    const startedAt = Date.now()
    let generated: Awaited<ReturnType<typeof runStrategistAgent>> | undefined
    try {
      const brief = buildStrategyEvalBrief(testCase)
      const context = prepareStrategyGenerationContext(testCase.brand)
      generated = await runStrategistAgent(
        brief,
        context.brandContext,
        brief.language,
        context.readiness,
      )
      let finalized
      try {
        finalized = finalizeStrategyQuality(generated, brief, context)
      } catch (qualityError) {
        if (!(qualityError instanceof StrategyQualityFailure)) throw qualityError
        generated = await repairStrategistQualityFailure(
          generated,
          brief,
          qualityError.diagnostics,
          context.brandContext,
          brief.language,
          context.readiness,
        )
        finalized = finalizeStrategyQuality(generated, brief, context)
      }
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
        firstPass: usage?.calls === 1,
        repaired: (usage?.calls || 0) > 1,
      })

      expect(finalized.contractReport.valid).toBe(true)
      expect(finalized.qualityGate.status).toBe('passed')
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const usage = generated?.providerUsage
      const diagnostics = error instanceof StrategyQualityFailure ? error.diagnostics : undefined
      results.push({
        id: testCase.id,
        sector: testCase.sector,
        language: testCase.order.language,
        mode: testCase.order.strategyType,
        status: 'failed',
        latencyMs: Date.now() - startedAt,
        calls: usage?.calls,
        inputTokens: usage?.inputTokens,
        outputTokens: usage?.outputTokens,
        estimatedProviderCostUsd: usage?.estimatedProviderCostUsd,
        firstPass: false,
        repaired: (usage?.calls || 0) > 1,
        issueCodes: diagnostics?.issueCodes,
        affectedPaths: diagnostics?.affectedPaths,
        issueDetails: diagnostics?.issueDetails,
        error: message,
      })
      throw error
    }
  }, 240_000)
})
