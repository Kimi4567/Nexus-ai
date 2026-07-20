import { describe, expect, it } from 'vitest'
import {
  createOpenAIProviderUsageCollector,
  recordOpenAIProviderUsage,
} from '@/lib/ai/providerUsageContext'

describe('OpenAI provider usage context', () => {
  it('collects parallel provider calls inside one request scope', async () => {
    const collector = createOpenAIProviderUsageCollector()

    await collector.run(async () => {
      await Promise.all([
        Promise.resolve().then(() => recordOpenAIProviderUsage({ prompt_tokens: 100, completion_tokens: 40 })),
        Promise.resolve().then(() => recordOpenAIProviderUsage({ prompt_tokens: 80, completion_tokens: 20 })),
      ])
    })

    expect(collector.snapshot()).toEqual(expect.arrayContaining([
      { inputTokens: 100, cachedInputTokens: 0, outputTokens: 40 },
      { inputTokens: 80, cachedInputTokens: 0, outputTokens: 20 },
    ]))
  })

  it('does not leak calls across concurrent request scopes', async () => {
    const first = createOpenAIProviderUsageCollector()
    const second = createOpenAIProviderUsageCollector()

    await Promise.all([
      first.run(async () => recordOpenAIProviderUsage({ prompt_tokens: 11, completion_tokens: 1 })),
      second.run(async () => recordOpenAIProviderUsage({ prompt_tokens: 22, completion_tokens: 2 })),
    ])

    expect(first.snapshot()).toEqual([{ inputTokens: 11, cachedInputTokens: 0, outputTokens: 1 }])
    expect(second.snapshot()).toEqual([{ inputTokens: 22, cachedInputTokens: 0, outputTokens: 2 }])
  })
})
