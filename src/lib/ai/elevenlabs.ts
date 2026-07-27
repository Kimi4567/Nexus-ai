const ELEVENLABS_API_ROOT = 'https://api.elevenlabs.io/v1'
export const ELEVENLABS_TTS_MODEL = 'eleven_multilingual_v2' as const
export const ELEVENLABS_OUTPUT_FORMAT = 'mp3_44100_128' as const
const MAX_VOICEOVER_CHARACTERS = 600
const MAX_AUDIO_BYTES = 12 * 1024 * 1024

export type ElevenLabsVoiceLanguage = 'ar' | 'en'

export type ElevenLabsSpeechResult = {
  audio: Buffer
  contentType: 'audio/mpeg'
  modelId: typeof ELEVENLABS_TTS_MODEL
  voiceId: string
  characters: number
  characterCost: number | null
  estimatedCostUsd: number
  requestId: string | null
}

function normalized(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function elevenLabsApiKey(): string | null {
  const key = normalized(process.env.ELEVENLABS_API_KEY)
  return key || null
}

/**
 * ElevenLabs free-plan output is not licensed for commercial use. Keep the
 * provider fail-closed until the workspace operator has verified a paid plan
 * and explicitly enabled commercial output in the deployment environment.
 */
export function hasElevenLabsCommercialRights(): boolean {
  return normalized(process.env.ELEVENLABS_COMMERCIAL_LICENSE_CONFIRMED).toLowerCase() === 'true'
}

export function getElevenLabsVoiceId(language: ElevenLabsVoiceLanguage): string | null {
  const languageVoice = language === 'ar'
    ? process.env.ELEVENLABS_VOICE_ID_AR
    : process.env.ELEVENLABS_VOICE_ID_EN
  const voiceId = normalized(languageVoice) || normalized(process.env.ELEVENLABS_VOICE_ID)
  return /^[A-Za-z0-9_-]{8,128}$/.test(voiceId) ? voiceId : null
}

export function isElevenLabsVoiceoverConfigured(language: ElevenLabsVoiceLanguage): boolean {
  return hasElevenLabsCommercialRights()
    && elevenLabsApiKey() !== null
    && getElevenLabsVoiceId(language) !== null
}

function estimatedVoiceCostUsd(characters: number): number {
  const configuredRate = Number(process.env.ELEVENLABS_COST_PER_1000_CHARS_USD)
  if (!Number.isFinite(configuredRate) || configuredRate < 0) return 0
  return Number(((characters / 1_000) * configuredRate).toFixed(6))
}

function numericHeader(value: string | null): number | null {
  if (!value) return null
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? number : null
}

/**
 * Generates one bounded voiceover from already-approved copy. The caller owns
 * truth review; this adapter never rewrites, expands, or invents the script.
 */
export async function generateElevenLabsSpeech(input: {
  text: string
  language: ElevenLabsVoiceLanguage
}): Promise<ElevenLabsSpeechResult> {
  const apiKey = elevenLabsApiKey()
  const voiceId = getElevenLabsVoiceId(input.language)
  if (!hasElevenLabsCommercialRights()) {
    throw new Error('ELEVENLABS_COMMERCIAL_LICENSE_REQUIRED')
  }
  if (!apiKey || !voiceId) throw new Error('ELEVENLABS_VOICEOVER_UNAVAILABLE')

  const text = normalized(input.text).replace(/\s+/g, ' ')
  if (!text || text.length > MAX_VOICEOVER_CHARACTERS) {
    throw new Error('ELEVENLABS_VOICEOVER_TEXT_INVALID')
  }

  const response = await fetch(
    `${ELEVENLABS_API_ROOT}/text-to-speech/${encodeURIComponent(voiceId)}?output_format=${ELEVENLABS_OUTPUT_FORMAT}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
        'xi-api-key': apiKey,
      },
      body: JSON.stringify({
        text,
        model_id: ELEVENLABS_TTS_MODEL,
        voice_settings: {
          stability: 0.55,
          similarity_boost: 0.78,
          style: 0.2,
          use_speaker_boost: true,
          speed: 1.05,
        },
      }),
      signal: AbortSignal.timeout(45_000),
    },
  )

  if (!response.ok) {
    throw new Error(`ELEVENLABS_TTS_FAILED_${response.status}`)
  }
  const contentType = response.headers.get('content-type')?.toLowerCase() ?? ''
  if (!contentType.startsWith('audio/')) throw new Error('ELEVENLABS_TTS_RESPONSE_INVALID')

  const audio = Buffer.from(await response.arrayBuffer())
  if (audio.length < 256 || audio.length > MAX_AUDIO_BYTES) {
    throw new Error('ELEVENLABS_TTS_AUDIO_INVALID')
  }

  return {
    audio,
    contentType: 'audio/mpeg',
    modelId: ELEVENLABS_TTS_MODEL,
    voiceId,
    characters: text.length,
    characterCost: numericHeader(response.headers.get('character-cost')),
    estimatedCostUsd: estimatedVoiceCostUsd(text.length),
    requestId: normalized(response.headers.get('request-id')) || null,
  }
}
