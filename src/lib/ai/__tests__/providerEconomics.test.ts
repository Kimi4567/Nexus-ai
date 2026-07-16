import { describe, expect, it } from 'vitest'
import {
  estimateOpenAITextCostUsd,
  readOpenAIChatUsage,
  summarizeOpenAITextUsage,
} from '@/lib/ai/providerEconomics'

describe('provider economics', () => {
  it('prices uncached and cached gpt-4o tokens with the versioned catalog', () => {
    expect(estimateOpenAITextCostUsd('gpt-4o', {
      inputTokens: 1_000_000,
      cachedInputTokens: 250_000,
      outputTokens: 100_000,
    })).toBe(3.1875)
  })

  it('reads chat-completions usage without trusting malformed counts', () => {
    expect(readOpenAIChatUsage({
      prompt_tokens: 1_000,
      completion_tokens: 500,
      prompt_tokens_details: { cached_tokens: 200 },
    })).toEqual({
      inputTokens: 1_000,
      cachedInputTokens: 200,
      outputTokens: 500,
    })
    expect(readOpenAIChatUsage({ prompt_tokens: -4, completion_tokens: 'bad' })).toEqual({
      inputTokens: 0,
      cachedInputTokens: 0,
      outputTokens: 0,
    })
  })

  it('aggregates primary and repair calls into one strategy cost record', () => {
    const summary = summarizeOpenAITextUsage('gpt-4o', [
      { inputTokens: 6_000, cachedInputTokens: 0, outputTokens: 7_500 },
      { inputTokens: 12_000, cachedInputTokens: 5_000, outputTokens: 9_500 },
    ])

    expect(summary).toMatchObject({
      calls: 2,
      inputTokens: 18_000,
      cachedInputTokens: 5_000,
      outputTokens: 17_000,
      estimatedProviderCostUsd: 0.20875,
    })
  })
})
