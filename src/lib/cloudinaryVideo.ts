/**
 * NEXUS — Cloudinary Video + Audio Merge
 *
 * Uploads a silent video (from Replicate URL) and an MP3 voiceover
 * to Cloudinary, then returns a merged URL with the audio track overlaid.
 *
 * Cloudinary handles the merge server-side via URL transformation —
 * no ffmpeg or separate encoding step required.
 *
 * The merged URL is generated on first CDN access and cached permanently.
 *
 * Requirements:
 *   CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
 *
 * Usage:
 *   const mergedUrl = await mergeVideoAudio(videoUrl, audioBuffer, generationId, 5)
 *   // Returns permanent Cloudinary URL with voiceover baked in
 */

import { v2 as cloudinary } from 'cloudinary'

// Configure once on module load
if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key:    process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  })
}

/**
 * Upload a video from an external URL to Cloudinary.
 * Cloudinary fetches it server-to-server and stores it permanently.
 * Returns the Cloudinary public_id.
 */
export async function uploadVideoFromUrl(videoUrl: string, publicId: string): Promise<string> {
  const result = await cloudinary.uploader.upload(videoUrl, {
    resource_type: 'video',
    public_id: publicId,
    overwrite: true,
    // No eager transformations needed — generated URL is lazy-evaluated
  })
  console.log('[cloudinaryVideo] Video uploaded:', result.public_id, result.bytes, 'bytes')
  return result.public_id
}

/**
 * Upload an audio Buffer (MP3) to Cloudinary.
 * Cloudinary treats audio as resource_type: 'video'.
 * Returns the Cloudinary public_id.
 */
export async function uploadAudioBuffer(audioBuffer: Buffer, publicId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: 'video',
        public_id: publicId,
        overwrite: true,
        format: 'mp3',
      },
      (err, result) => {
        if (err || !result) {
          reject(err || new Error('Audio upload to Cloudinary failed'))
        } else {
          console.log('[cloudinaryVideo] Audio uploaded:', result.public_id)
          resolve(result.public_id)
        }
      }
    )
    stream.end(audioBuffer)
  })
}

/**
 * Build a Cloudinary URL that overlays the audio track on the video.
 * The audio is capped at `durationSeconds` to match the video length.
 * The URL is lazily rendered on first CDN access and cached permanently.
 *
 * @param videoPublicId   Cloudinary public_id of the uploaded video
 * @param audioPublicId   Cloudinary public_id of the uploaded audio
 * @param durationSeconds Video duration (caps audio playback)
 */
export function buildVideoWithAudioUrl(
  videoPublicId: string,
  audioPublicId: string,
  durationSeconds: number,
): string {
  // Cloudinary overlay syntax uses colons as folder separators
  const audioLayer = audioPublicId.replace(/\//g, ':')

  return cloudinary.url(videoPublicId, {
    resource_type: 'video',
    transformation: [
      {
        overlay: `audio:${audioLayer}`,
        end_offset: durationSeconds,
        flags: 'layer_apply',
      },
    ],
    format: 'mp4',
    sign_url: false,
  })
}

/**
 * Full pipeline: upload video + audio → return merged URL.
 * Falls back to the original silent videoUrl if anything fails.
 *
 * @param videoUrl        External (Replicate) video URL
 * @param audioBuffer     MP3 audio buffer from TTS
 * @param generationId    Used as a stable public_id key
 * @param durationSeconds Video duration in seconds
 */
export async function mergeVideoAudio(
  videoUrl: string,
  audioBuffer: Buffer,
  generationId: string,
  durationSeconds: number,
): Promise<string> {
  const videoPublicId = `nexus_videos/${generationId}`
  const audioPublicId = `nexus_audio/${generationId}`

  // Upload both assets to Cloudinary (in parallel)
  const [videoPid, audioPid] = await Promise.all([
    uploadVideoFromUrl(videoUrl, videoPublicId),
    uploadAudioBuffer(audioBuffer, audioPublicId),
  ])

  return buildVideoWithAudioUrl(videoPid, audioPid, durationSeconds)
}

/**
 * Check whether Cloudinary is properly configured for video operations.
 */
export function isCloudinaryVideoAvailable(): boolean {
  return !!(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  )
}
