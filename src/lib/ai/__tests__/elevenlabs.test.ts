import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ELEVENLABS_TTS_MODEL,
  generateElevenLabsSpeech,
  hasElevenLabsCommercialRights,
  isElevenLabsVoiceoverConfigured,
} from '../elevenlabs'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('ElevenLabs voiceover adapter', () => {
  it('requires a confirmed commercial license, server key, and language-appropriate voice', () => {
    vi.stubEnv('ELEVENLABS_API_KEY', 'test-key')
    expect(isElevenLabsVoiceoverConfigured('ar')).toBe(false)

    vi.stubEnv('ELEVENLABS_VOICE_ID_AR', 'ArabicVoice123')
    expect(isElevenLabsVoiceoverConfigured('ar')).toBe(false)

    vi.stubEnv('ELEVENLABS_COMMERCIAL_LICENSE_CONFIRMED', 'true')
    expect(hasElevenLabsCommercialRights()).toBe(true)
    expect(isElevenLabsVoiceoverConfigured('ar')).toBe(true)
    expect(isElevenLabsVoiceoverConfigured('en')).toBe(false)
  })

  it('refuses to generate commercially unlicensed free-plan output', async () => {
    vi.stubEnv('ELEVENLABS_API_KEY', 'secret-test-key')
    vi.stubEnv('ELEVENLABS_VOICE_ID_EN', 'EnglishVoice123')

    await expect(generateElevenLabsSpeech({
      text: 'Approved copy only',
      language: 'en',
    })).rejects.toThrow('ELEVENLABS_COMMERCIAL_LICENSE_REQUIRED')
  })

  it('sends approved copy verbatim and captures provider usage headers', async () => {
    vi.stubEnv('ELEVENLABS_API_KEY', 'secret-test-key')
    vi.stubEnv('ELEVENLABS_VOICE_ID_AR', 'ArabicVoice123')
    vi.stubEnv('ELEVENLABS_COMMERCIAL_LICENSE_CONFIRMED', 'true')
    vi.stubEnv('ELEVENLABS_COST_PER_1000_CHARS_USD', '0.2')
    const fetchMock = vi.fn().mockResolvedValue(new Response(new Uint8Array(512), {
      status: 200,
      headers: {
        'content-type': 'audio/mpeg',
        'character-cost': '17',
        'request-id': 'request-safe-id',
      },
    }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await generateElevenLabsSpeech({
      text: 'راجع السعر والكمية',
      language: 'ar',
    })

    expect(result).toMatchObject({
      modelId: ELEVENLABS_TTS_MODEL,
      voiceId: 'ArabicVoice123',
      characterCost: 17,
      requestId: 'request-safe-id',
    })
    expect(result.audio).toHaveLength(512)
    const request = fetchMock.mock.calls[0]
    expect(JSON.parse(String(request[1]?.body))).toMatchObject({
      text: 'راجع السعر والكمية',
      model_id: ELEVENLABS_TTS_MODEL,
    })
    expect(result.estimatedCostUsd).toBeGreaterThan(0)
  })

  it('does not expose provider response bodies when speech generation fails', async () => {
    vi.stubEnv('ELEVENLABS_API_KEY', 'secret-test-key')
    vi.stubEnv('ELEVENLABS_VOICE_ID_EN', 'EnglishVoice123')
    vi.stubEnv('ELEVENLABS_COMMERCIAL_LICENSE_CONFIRMED', 'true')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('provider-private-detail', {
      status: 429,
    })))

    await expect(generateElevenLabsSpeech({
      text: 'Approved copy only',
      language: 'en',
    })).rejects.toThrow('ELEVENLABS_TTS_FAILED_429')
  })
})
