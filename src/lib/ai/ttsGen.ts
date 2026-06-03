/**
 * NEXUS — OpenAI Text-to-Speech (TTS)
 *
 * Converts a video brief script into an MP3 voiceover.
 * Used automatically after video generation completes — the user
 * never needs to do this manually.
 *
 * Model:  tts-1 (optimised for speed; tts-1-hd for higher quality)
 * Voice:  nova (female, warm, professional — best for marketing content)
 * Cost:   ~$0.015 per 1,000 characters — negligible per generation
 *
 * Script is trimmed to ~500 characters (~30–40 seconds of speech) since
 * AI-generated videos are 5–10 seconds and only the first few lines
 * of voiceover will audibly fit.
 */

const MAX_SCRIPT_CHARS = 500 // ~30s of speech; video is only 5–10s — first lines matter most

/**
 * Generate a voiceover MP3 from the given text.
 * Returns a Buffer with the MP3 data, or null if TTS is unavailable or fails.
 * Never throws — caller should fall back to silent video on null.
 */
export async function generateVoiceover(script: string): Promise<Buffer | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey || !script?.trim()) return null

  // Trim to avoid overly long TTS for short videos
  const trimmed = script.trim().slice(0, MAX_SCRIPT_CHARS)

  try {
    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'tts-1',
        input: trimmed,
        voice: 'nova',
        response_format: 'mp3',
      }),
    })

    if (!response.ok) {
      const errText = await response.text().catch(() => '')
      console.error('[ttsGen] OpenAI TTS error:', response.status, errText.slice(0, 200))
      return null
    }

    const arrayBuffer = await response.arrayBuffer()
    console.log('[ttsGen] Voiceover generated:', arrayBuffer.byteLength, 'bytes')
    return Buffer.from(arrayBuffer)
  } catch (err) {
    console.error('[ttsGen] Voiceover generation failed:', err)
    return null
  }
}
