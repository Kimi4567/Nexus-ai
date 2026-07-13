import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockGenerateScript,
  mockGenerateCaptions,
  mockCallOpenAI,
  mockGenerateMarketingStrategy,
  mockGenerateAdConcepts,
} = vi.hoisted(() => ({
  mockGenerateScript: vi.fn(),
  mockGenerateCaptions: vi.fn(),
  mockCallOpenAI: vi.fn(),
  mockGenerateMarketingStrategy: vi.fn(),
  mockGenerateAdConcepts: vi.fn(),
}))

vi.mock('../openai', () => ({
  generateScript: mockGenerateScript,
  generateCaptions: mockGenerateCaptions,
  callOpenAI: mockCallOpenAI,
  generateMarketingStrategy: mockGenerateMarketingStrategy,
  generateAdConcepts: mockGenerateAdConcepts,
}))

import * as adapter from '../adapter'

const originalApiKey = process.env.OPENAI_API_KEY

beforeEach(() => {
  vi.clearAllMocks()
  delete process.env.OPENAI_API_KEY
})

afterEach(() => {
  if (originalApiKey === undefined) delete process.env.OPENAI_API_KEY
  else process.env.OPENAI_API_KEY = originalApiKey
})

describe('AI adapter provider guard', () => {
  it('fails explicitly instead of returning a mock strategy when the provider is absent', async () => {
    await expect(adapter.generateMarketingStrategy({ name: 'Launch' }, {})).rejects.toMatchObject({
      name: 'AiProviderUnavailableError',
      code: 'AI_PROVIDER_UNAVAILABLE',
      retryable: false,
    })
    expect(mockGenerateMarketingStrategy).not.toHaveBeenCalled()
  })

  it('delegates to the real provider only when a non-empty key is configured', async () => {
    process.env.OPENAI_API_KEY = 'test-key'
    mockGenerateScript.mockResolvedValue('real provider output')

    await expect(adapter.generateScript('brief')).resolves.toBe('real provider output')
    expect(mockGenerateScript).toHaveBeenCalledWith('brief')
  })
})
