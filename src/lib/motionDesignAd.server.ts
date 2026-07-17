import { execFile } from 'node:child_process'
import { createWriteStream, existsSync } from 'node:fs'
import { mkdtemp, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { promisify } from 'node:util'
import { v2 as cloudinary } from 'cloudinary'
import ffmpegPath from 'ffmpeg-static'
import type { PlatformVideoFormat } from '@/lib/platformVideoFormat'
import {
  MOTION_DESIGN_DURATION_SECONDS,
  MOTION_DESIGN_SAFE_SOURCE_SECONDS,
} from '@/lib/motionDesignAd'

export type StoredMotionDesignVideo = {
  url: string
  publicId: string
  bytes: number
  width: number | null
  height: number | null
  duration: number | null
  format: string
}

const execFileAsync = promisify(execFile)
const MAX_SOURCE_BYTES = 100 * 1024 * 1024
const RENDER_TIMEOUT_MS = 90_000
const MOTION_DESIGN_FRAME_RATE = 24

function resolveFfmpegBinary(): string {
  // Next bundles ffmpeg-static's JS shim into the route, so its default export
  // can point beside route.js on Vercel even though output tracing correctly
  // ships the executable under node_modules. Prefer that traced runtime path.
  const tracedRuntimePath = path.join(process.cwd(), 'node_modules', 'ffmpeg-static', 'ffmpeg')
  const candidates = [tracedRuntimePath, ffmpegPath].filter((value): value is string => Boolean(value))
  const available = candidates.find(candidate => existsSync(candidate))
  if (!available) throw new Error('NEXUS Motion Design render engine is unavailable on this platform')
  return available
}

function configureCloudinary() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
  const apiKey = process.env.CLOUDINARY_API_KEY
  const apiSecret = process.env.CLOUDINARY_API_SECRET
  if (!cloudName || !apiKey || !apiSecret) throw new Error('Cloudinary motion-design storage is not configured')
  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret })
}

function assertSafeCloudinaryVideoUrl(value: string): URL {
  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    throw new Error('Motion Design requires a valid source video URL')
  }
  if (
    parsed.protocol !== 'https:'
    || parsed.hostname !== 'res.cloudinary.com'
    || !parsed.pathname.includes('/video/upload/')
  ) {
    throw new Error('Motion Design accepts only a durable Cloudinary source video')
  }
  return parsed
}

export function buildMotionDesignFfmpegArgs(input: {
  sourcePath: string
  outputPath: string
  target: PlatformVideoFormat
}): string[] {
  const vertical = input.target.height > input.target.width
  const sourceWidth = vertical ? input.target.width - 60 : Math.round(input.target.width * 0.78)
  const sourceHeight = vertical ? input.target.height - 360 : input.target.height - 160
  const holdSeconds = MOTION_DESIGN_DURATION_SECONDS - MOTION_DESIGN_SAFE_SOURCE_SECONDS
  const filter = [
    '[0:v]setpts=PTS-STARTPTS',
    `scale=${sourceWidth}:${sourceHeight}:force_original_aspect_ratio=decrease`,
    `pad=${input.target.width}:${input.target.height}:(ow-iw)/2:(oh-ih)/2:color=0x090B13`,
    `fps=${MOTION_DESIGN_FRAME_RATE}`,
    `tpad=stop_mode=clone:stop_duration=${holdSeconds}`,
    `trim=duration=${MOTION_DESIGN_DURATION_SECONDS}`,
    'setpts=PTS-STARTPTS',
    'format=yuv420p[outv]',
  ].join(',')

  return [
    '-y',
    '-hide_banner',
    '-loglevel', 'error',
    // End the decoder at the safe boundary. A filter-only trim keeps reading
    // later source frames until EOF, which can leak an unrelated transition
    // into a supposedly frozen end card on long-GOP uploads.
    '-ss', '0',
    '-t', String(MOTION_DESIGN_SAFE_SOURCE_SECONDS),
    '-i', input.sourcePath,
    '-filter_complex', filter,
    '-map', '[outv]',
    '-an',
    '-c:v', 'libx264',
    '-preset', 'medium',
    '-crf', '18',
    '-profile:v', 'high',
    '-level', '4.1',
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    input.outputPath,
  ]
}

async function downloadSourceVideo(sourceUrl: string, destination: string): Promise<void> {
  const parsed = assertSafeCloudinaryVideoUrl(sourceUrl)
  const response = await fetch(parsed, { signal: AbortSignal.timeout(30_000) })
  if (!response.ok || !response.body) throw new Error('Motion Design could not read the verified source video')

  const declaredBytes = Number(response.headers.get('content-length') || 0)
  if (declaredBytes > MAX_SOURCE_BYTES) throw new Error('Motion Design source exceeds the 100 MB render limit')

  let downloadedBytes = 0
  const byteLimit = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      downloadedBytes += chunk.length
      if (downloadedBytes > MAX_SOURCE_BYTES) {
        callback(new Error('Motion Design source exceeds the 100 MB render limit'))
        return
      }
      callback(null, chunk)
    },
  })
  await pipeline(
    Readable.fromWeb(response.body as never),
    byteLimit,
    createWriteStream(destination, { flags: 'wx' }),
  )
}

/**
 * Render a deterministic paid-social master with a real video editor. NEXUS
 * preserves the verified opening source pixels for three seconds, then holds
 * the last clean frame as a deliberate CTA/end card. No generative-video
 * provider or synthetic product pixels are involved.
 */
export async function renderAndPersistMotionDesignAd(input: {
  sourceUrl: string
  target: PlatformVideoFormat
  generationId: string
}): Promise<StoredMotionDesignVideo> {
  configureCloudinary()
  const executable = resolveFfmpegBinary()

  const workDir = await mkdtemp(path.join(tmpdir(), 'nexus-motion-'))
  const sourcePath = path.join(workDir, 'source.mp4')
  const outputPath = path.join(workDir, 'master.mp4')
  try {
    await downloadSourceVideo(input.sourceUrl, sourcePath)
    await execFileAsync(executable, buildMotionDesignFfmpegArgs({
      sourcePath,
      outputPath,
      target: input.target,
    }), {
      timeout: RENDER_TIMEOUT_MS,
      maxBuffer: 1024 * 1024,
    })

    const rendered = await stat(outputPath)
    if (!rendered.isFile() || rendered.size <= 0) throw new Error('NEXUS Motion Design render produced no usable file')

    const result = await cloudinary.uploader.upload(outputPath, {
      resource_type: 'video',
      folder: 'nexus/motion-design',
      public_id: `motion_${input.generationId}`,
      overwrite: false,
      unique_filename: false,
    })
    if (!result.secure_url?.startsWith('https://')) throw new Error('Cloudinary returned no durable motion-design video')
    return {
      url: result.secure_url,
      publicId: result.public_id,
      bytes: Number(result.bytes || rendered.size),
      width: Number.isFinite(result.width) ? result.width : null,
      height: Number.isFinite(result.height) ? result.height : null,
      duration: Number.isFinite(result.duration) ? Math.round(result.duration) : null,
      format: result.format || 'mp4',
    }
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => undefined)
  }
}

export async function destroyMotionDesignAd(publicId: string): Promise<void> {
  configureCloudinary()
  await cloudinary.uploader.destroy(publicId, { resource_type: 'video', invalidate: true })
}
