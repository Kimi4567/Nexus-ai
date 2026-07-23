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
import { createElement, type CSSProperties } from 'react'
import sharp from 'sharp'
import type { PlatformVideoFormat } from '@/lib/platformVideoFormat'
import {
  MOTION_DESIGN_DURATION_SECONDS,
  MOTION_DESIGN_SAFE_SOURCE_SECONDS,
  type MotionDesignCopy,
} from '@/lib/motionDesignAd'
import {
  NEXUS_ARABIC_FONT_FAMILY,
  renderPathOnlyVideoOverlay,
  videoOverlayInlineText,
  videoOverlayTextLines,
  visualVideoOverlayText,
  wrapVideoOverlayText,
} from '@/lib/videoOverlayTypography.server'

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

export async function motionDesignOverlaySvgs(input: MotionDesignCopy & {
  width?: number
  height?: number
}): Promise<{ hook: string; end: string }> {
  const width = input.width || 720
  const height = input.height || 1280
  const vertical = height > width
  const rtl = input.language === 'ar'
  const shortEdge = Math.min(width, height)
  const horizontalPadding = Math.round(width * (vertical ? 0.08 : 0.065))
  const root: CSSProperties = {
    width,
    height,
    display: 'flex',
    fontFamily: NEXUS_ARABIC_FONT_FAMILY,
  }
  const brandStyle: CSSProperties = {
    display: 'flex',
    alignSelf: rtl ? 'flex-end' : 'flex-start',
    color: '#D8C7FF',
    fontFamily: NEXUS_ARABIC_FONT_FAMILY,
    fontSize: Math.round(shortEdge * 0.034),
    fontWeight: 700,
    letterSpacing: rtl ? 0 : Math.round(shortEdge * 0.006),
    whiteSpace: 'pre',
  }

  const hook = await renderPathOnlyVideoOverlay(createElement('div', {
    style: {
      ...root,
      flexDirection: 'column',
      justifyContent: 'space-between',
      padding: `${Math.round(height * 0.055)}px ${horizontalPadding}px ${Math.round(height * (vertical ? 0.16 : 0.12))}px`,
      backgroundImage: 'linear-gradient(to bottom, rgba(7,10,19,0.18) 0%, rgba(7,10,19,0) 42%, rgba(7,10,19,0.90) 100%)',
    },
  },
  createElement('div', { style: brandStyle }, visualVideoOverlayText(input.brandLabel.toUpperCase(), rtl)),
  videoOverlayTextLines(
    wrapVideoOverlayText(input.hook, rtl ? (vertical ? 16 : 24) : (vertical ? 22 : 34)),
    {
      rtl,
      size: Math.round(shortEdge * (vertical ? 0.068 : 0.058)),
      color: '#FFFFFF',
    },
  )), width, height)

  const end = await renderPathOnlyVideoOverlay(createElement('div', {
    style: {
      ...root,
      padding: Math.round(shortEdge * 0.045),
      backgroundColor: 'rgba(7,10,19,0.93)',
    },
  }, createElement('div', {
    style: {
      display: 'flex',
      width: '100%',
      height: '100%',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      border: `${Math.max(1, Math.round(shortEdge * 0.0015))}px solid rgba(216,199,255,0.55)`,
      borderRadius: Math.round(shortEdge * 0.04),
    },
  },
  createElement('div', {
    style: {
      display: 'flex',
      color: '#D8C7FF',
      fontFamily: NEXUS_ARABIC_FONT_FAMILY,
      fontSize: Math.round(shortEdge * 0.048),
      fontWeight: 700,
      letterSpacing: rtl ? 0 : Math.round(shortEdge * 0.008),
      marginBottom: Math.round(height * (vertical ? 0.14 : 0.08)),
      whiteSpace: 'pre',
    },
  }, visualVideoOverlayText(input.brandLabel.toUpperCase(), rtl)),
  createElement('div', {
    style: {
      display: 'flex',
      minWidth: Math.round(width * (vertical ? 0.58 : 0.34)),
      height: Math.round(shortEdge * 0.15),
      padding: `0 ${Math.round(shortEdge * 0.06)}px`,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: Math.round(shortEdge * 0.075),
      backgroundColor: '#D8C7FF',
      color: '#0B0E18',
      fontFamily: NEXUS_ARABIC_FONT_FAMILY,
    },
  }, videoOverlayInlineText(input.cta, {
    rtl,
    size: Math.round(shortEdge * 0.046),
    color: '#0B0E18',
  })))), width, height)

  return { hook, end }
}

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
  hookOverlayPath: string
  endOverlayPath: string
  outputPath: string
  target: PlatformVideoFormat
  sourceWidth?: number | null
  sourceHeight?: number | null
}): string[] {
  const vertical = input.target.height > input.target.width
  const sourceAspect = Number(input.sourceWidth || 0) / Math.max(1, Number(input.sourceHeight || 0))
  const targetAspect = input.target.width / input.target.height
  const sourceMatchesTarget = Number(input.sourceWidth || 0) > 0
    && Number(input.sourceHeight || 0) > 0
    && Math.abs(sourceAspect - targetAspect) <= 0.02
  // Preserve a native 9:16/16:9 master edge-to-edge instead of shrinking it
  // into an unnecessary mat. Typography is composited in separate vector layers.
  const sourceWidth = sourceMatchesTarget
    ? input.target.width
    : vertical ? input.target.width - 60 : Math.round(input.target.width * 0.78)
  const sourceHeight = sourceMatchesTarget
    ? input.target.height
    : vertical ? input.target.height - 360 : input.target.height - 160
  const holdSeconds = MOTION_DESIGN_DURATION_SECONDS - MOTION_DESIGN_SAFE_SOURCE_SECONDS
  const sourceEndFrame = MOTION_DESIGN_SAFE_SOURCE_SECONDS * MOTION_DESIGN_FRAME_RATE - 1
  const endMotionFrames = holdSeconds * MOTION_DESIGN_FRAME_RATE
  const zoomExpression = `if(lt(on,12),1.08-(on/12)*0.08,if(lte(on,${sourceEndFrame}),1,1+min((on-${sourceEndFrame})/${endMotionFrames},1)*0.06))`
  const baseFilter = [
    '[0:v]setpts=PTS-STARTPTS',
    `scale=${sourceWidth}:${sourceHeight}:force_original_aspect_ratio=decrease`,
    `pad=${input.target.width}:${input.target.height}:(ow-iw)/2:(oh-ih)/2:color=0x090B13`,
    `fps=${MOTION_DESIGN_FRAME_RATE}`,
    `tpad=stop_mode=clone:stop_duration=${holdSeconds}`,
    // A half-second punch-out creates an immediate hook; the verified source
    // then plays at rest before a restrained six-percent CTA push-in. This is
    // real editorial motion over source-derived frames, not AI fill.
    `zoompan=z='${zoomExpression}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=${input.target.width}x${input.target.height}:fps=${MOTION_DESIGN_FRAME_RATE}`,
    `trim=duration=${MOTION_DESIGN_DURATION_SECONDS}`,
    'setpts=PTS-STARTPTS',
    'setsar=1',
    'format=yuv420p[base]',
  ].join(',')
  const filter = [
    baseFilter,
    '[1:v]format=rgba,fade=t=in:st=0.05:d=0.22:alpha=1,fade=t=out:st=1.55:d=0.25:alpha=1[hook]',
    '[2:v]format=rgba,fade=t=in:st=3.65:d=0.35:alpha=1[end]',
    "[base][hook]overlay=x='if(lt(t,0.35),(0.35-t)*-160,0)':y=0:enable='between(t,0,1.8)'[v1]",
    "[v1][end]overlay=x=0:y='if(lt(t,4.0),(4.0-t)*70,0)':enable='between(t,3.65,6.0)',format=yuv420p[outv]",
  ].join(';')

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
    '-loop', '1',
    '-framerate', String(MOTION_DESIGN_FRAME_RATE),
    '-t', String(MOTION_DESIGN_DURATION_SECONDS),
    '-i', input.hookOverlayPath,
    '-loop', '1',
    '-framerate', String(MOTION_DESIGN_FRAME_RATE),
    '-t', String(MOTION_DESIGN_DURATION_SECONDS),
    '-i', input.endOverlayPath,
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
    '-t', String(MOTION_DESIGN_DURATION_SECONDS),
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
 * preserves the verified opening source identity, composites an approved-copy
 * hook, then closes with a separately rendered brand-and-CTA card. No
 * generative-video provider or synthetic product pixels are involved.
 */
export async function renderAndPersistMotionDesignAd(input: {
  sourceUrl: string
  target: PlatformVideoFormat
  generationId: string
  overlayCopy: MotionDesignCopy
  sourceWidth?: number | null
  sourceHeight?: number | null
}): Promise<StoredMotionDesignVideo> {
  configureCloudinary()
  const executable = resolveFfmpegBinary()

  const workDir = await mkdtemp(path.join(tmpdir(), 'nexus-motion-'))
  const sourcePath = path.join(workDir, 'source.mp4')
  const hookOverlayPath = path.join(workDir, 'hook.png')
  const endOverlayPath = path.join(workDir, 'end.png')
  const outputPath = path.join(workDir, 'master.mp4')
  try {
    await downloadSourceVideo(input.sourceUrl, sourcePath)
    const overlays = await motionDesignOverlaySvgs({
      ...input.overlayCopy,
      width: input.target.width,
      height: input.target.height,
    })
    await Promise.all([
      sharp(Buffer.from(overlays.hook)).png().toFile(hookOverlayPath),
      sharp(Buffer.from(overlays.end)).png().toFile(endOverlayPath),
    ])
    await execFileAsync(executable, buildMotionDesignFfmpegArgs({
      sourcePath,
      hookOverlayPath,
      endOverlayPath,
      outputPath,
      target: input.target,
      sourceWidth: input.sourceWidth,
      sourceHeight: input.sourceHeight,
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
