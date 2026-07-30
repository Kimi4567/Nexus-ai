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
const originalGatewayKey = process.env.AI_GATEWAY_API_KEY
const originalOidcToken = process.env.VERCEL_OIDC_TOKEN

beforeEach(() => {
  vi.clearAllMocks()
  delete process.env.OPENAI_API_KEY
  delete process.env.FAL_KEY
  delete process.env.AI_GATEWAY_API_KEY
  delete process.env.VERCEL_OIDC_TOKEN
})

afterEach(() => {
  if (originalApiKey === undefined) delete process.env.OPENAI_API_KEY
  else process.env.OPENAI_API_KEY = originalApiKey
  if (originalFalKey === undefined) delete process.env.FAL_KEY
  else process.env.FAL_KEY = originalFalKey
  if (originalGatewayKey === undefined) delete process.env.AI_GATEWAY_API_KEY
  else process.env.AI_GATEWAY_API_KEY = originalGatewayKey
  if (originalOidcToken === undefined) delete process.env.VERCEL_OIDC_TOKEN
  else process.env.VERCEL_OIDC_TOKEN = originalOidcToken
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

  it('accepts Vercel OIDC without requiring a direct OpenAI key', async () => {
    process.env.VERCEL_OIDC_TOKEN = 'oidc-token'
    mockGenerateScript.mockResolvedValue('gateway output')

    await expect(adapter.generateScript('brief')).resolves.toBe('gateway output')
    expect(mockGenerateScript).toHaveBeenCalledWith('brief')
  })

  it('accepts FAL as a real image provider even without OpenAI', () => {
    process.env.FAL_KEY = 'test-fal-key'

    expect(isImageProviderConfigured()).toBe(true)
  })

  it('does not mistake a text-only Gateway credential for an image provider', () => {
    process.env.VERCEL_OIDC_TOKEN = 'oidc-token'

    expect(isImageProviderConfigured()).toBe(false)
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
