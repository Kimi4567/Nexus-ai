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
import { getImageProviderUnavailablePayload, isImageProviderConfigured } from '../provider'

const originalApiKey = process.env.OPENAI_API_KEY
const originalFalKey = process.env.FAL_KEY

beforeEach(() => {
  vi.clearAllMocks()
  delete process.env.OPENAI_API_KEY
  delete process.env.FAL_KEY
})

afterEach(() => {
  if (originalApiKey === undefined) delete process.env.OPENAI_API_KEY
  else process.env.OPENAI_API_KEY = originalApiKey
  if (originalFalKey === undefined) delete process.env.FAL_KEY
  else process.env.FAL_KEY = originalFalKey
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

  it('accepts FAL as a real image provider even without OpenAI', () => {
    process.env.FAL_KEY = 'test-fal-key'

    expect(isImageProviderConfigured()).toBe(true)
  })

  it('returns a truthful no-charge payload when every image provider is absent', () => {
    expect(isImageProviderConfigured()).toBe(false)
    expect(getImageProviderUnavailablePayload('en')).toMatchObject({
      code: 'IMAGE_PROVIDER_UNAVAILABLE',
      providerConfigured: false,
      creditsCharged: false,
      retryable: false,
    })
  })
})
