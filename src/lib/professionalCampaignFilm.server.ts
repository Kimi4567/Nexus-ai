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
import { createElement, type CSSProperties, type ReactElement } from 'react'
import satori from 'satori'
import sharp from 'sharp'
import {
  NEXUS_ARABIC_FONT_BASE64,
  NEXUS_ARABIC_FONT_FAMILY,
} from '@/lib/assets/nexusArabicFont'
import type { PlatformVideoFormat } from '@/lib/platformVideoFormat'
import { PROFESSIONAL_CAMPAIGN_FILM_DURATION_SECONDS } from '@/lib/professionalCampaignFilm'

export type StoredProfessionalCampaignFilm = {
  url: string
  publicId: string
  bytes: number
  width: number | null
  height: number | null
  duration: number | null
  format: string
}

const execFileAsync = promisify(execFile)
const MAX_SOURCE_BYTES = 150 * 1024 * 1024
const RENDER_TIMEOUT_MS = 120_000
const FRAME_RATE = 24

function resolveFfmpegBinary(): string {
  const tracedRuntimePath = path.join(process.cwd(), 'node_modules', 'ffmpeg-static', 'ffmpeg')
  const candidates = [tracedRuntimePath, ffmpegPath].filter((value): value is string => Boolean(value))
  const available = candidates.find(candidate => existsSync(candidate))
  if (!available) throw new Error('NEXUS campaign-film compositor is unavailable on this platform')
  return available
}

function configureCloudinary() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
  const apiKey = process.env.CLOUDINARY_API_KEY
  const apiSecret = process.env.CLOUDINARY_API_SECRET
  if (!cloudName || !apiKey || !apiSecret) throw new Error('Cloudinary campaign-film storage is not configured')
  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret })
}

function safeCloudinaryVideoUrl(value: string): URL {
  const parsed = new URL(value)
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'res.cloudinary.com' || !parsed.pathname.includes('/video/upload/')) {
    throw new Error('Campaign-film compositor accepts only durable Cloudinary video')
  }
  return parsed
}

function wrapText(value: string, maxCharacters: number, maxLines = 2): string[] {
  const words = value.trim().split(/\s+/).filter(Boolean)
  const lines: string[] = []
  for (const word of words) {
    const current = lines.at(-1)
    if (!current || (current.length + 1 + word.length > maxCharacters && lines.length < maxLines)) {
      if (lines.length < maxLines) lines.push(word)
      else lines[lines.length - 1] = `${lines[lines.length - 1]} ${word}`
    } else {
      lines[lines.length - 1] = `${current} ${word}`
    }
  }
  return lines.slice(0, maxLines)
}

function satoriFontData(): ArrayBuffer {
  const font = Buffer.from(NEXUS_ARABIC_FONT_BASE64, 'base64')
  return font.buffer.slice(font.byteOffset, font.byteOffset + font.byteLength) as ArrayBuffer
}

function visualText(value: string, rtl: boolean): string {
  // Satori shapes each Arabic word with the supplied font but lays word boxes
  // left-to-right. Reversing the word boxes produces the correct visual RTL
  // order while preserving the connected glyphs inside every word.
  return rtl && /[\u0600-\u06FF]/.test(value)
    ? value.trim().split(/\s+/).reverse().join(' ')
    : value
}

function textLines(lines: string[], options: {
  rtl: boolean
  size: number
  color: string
  align?: 'flex-start' | 'center' | 'flex-end'
}): ReactElement {
  return createElement('div', {
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: options.align || (options.rtl ? 'flex-end' : 'flex-start'),
      width: '100%',
      gap: 6,
      color: options.color,
      fontFamily: NEXUS_ARABIC_FONT_FAMILY,
      fontSize: options.size,
      fontWeight: 700,
      lineHeight: 1.18,
    },
  }, ...lines.map((line, index) => createElement('div', {
    key: `${index}-${line}`,
    style: { display: 'flex', whiteSpace: 'pre' },
  }, visualText(line, options.rtl))))
}

async function renderPathOnlyOverlay(element: ReactElement, width: number, height: number): Promise<string> {
  const svg = await satori(element, {
    width,
    height,
    fonts: [{
      name: NEXUS_ARABIC_FONT_FAMILY,
      data: satoriFontData(),
      weight: 700,
      style: 'normal',
    }],
  })
  if (!svg.includes('<path') || svg.includes('<text')) {
    throw new Error('NEXUS campaign-film typography was not converted to deterministic vector paths')
  }
  return svg
}

export async function professionalCampaignFilmOverlaySvgs(input: {
  brand: string
  hook: string
  benefit: string
  cta: string
  language: 'ar' | 'en'
  width?: number
  height?: number
}): Promise<{ hook: string; benefit: string; end: string }> {
  const width = input.width || 720
  const height = input.height || 1280
  const rtl = input.language === 'ar'
  const root: CSSProperties = { width, height, display: 'flex', fontFamily: NEXUS_ARABIC_FONT_FAMILY }
  const brandStyle: CSSProperties = {
    display: 'flex',
    alignSelf: rtl ? 'flex-end' : 'flex-start',
    color: '#E7D5B3',
    fontFamily: NEXUS_ARABIC_FONT_FAMILY,
    fontSize: 24,
    fontWeight: 700,
    letterSpacing: rtl ? 0 : 5,
    whiteSpace: 'pre',
  }

  const hook = await renderPathOnlyOverlay(createElement('div', {
    style: {
      ...root,
      flexDirection: 'column',
      justifyContent: 'space-between',
      padding: '64px 70px 150px',
      backgroundImage: 'linear-gradient(to bottom, rgba(6,16,26,0) 50%, rgba(6,16,26,0.90) 100%)',
    },
  },
  createElement('div', { style: brandStyle }, visualText(input.brand.toUpperCase(), rtl)),
  textLines(wrapText(input.hook, rtl ? 16 : 22), { rtl, size: 50, color: '#FFFFFF' })), width, height)

  const benefit = await renderPathOnlyOverlay(createElement('div', {
    style: {
      ...root,
      flexDirection: 'column',
      justifyContent: 'flex-end',
      padding: '0 54px 180px',
      backgroundImage: 'linear-gradient(to bottom, rgba(6,16,26,0) 55%, rgba(6,16,26,0.90) 100%)',
    },
  },
  createElement('div', { style: { display: 'flex', width: '100%', height: 2, marginBottom: 62, backgroundColor: 'rgba(231,213,179,0.75)' } }),
  textLines(wrapText(input.benefit, rtl ? 20 : 28), { rtl, size: 38, color: '#FFFFFF' })), width, height)

  const end = await renderPathOnlyOverlay(createElement('div', {
    style: {
      ...root,
      padding: 38,
      backgroundColor: 'rgba(6,16,26,0.94)',
    },
  }, createElement('div', {
    style: {
      display: 'flex',
      width: '100%',
      height: '100%',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      border: '1px solid rgba(231,213,179,0.55)',
      borderRadius: 28,
    },
  },
  createElement('div', {
    style: {
      display: 'flex',
      color: '#E7D5B3',
      fontFamily: NEXUS_ARABIC_FONT_FAMILY,
      fontSize: 34,
      fontWeight: 700,
      letterSpacing: rtl ? 0 : 8,
      marginBottom: 180,
      whiteSpace: 'pre',
    },
  }, visualText(input.brand.toUpperCase(), rtl)),
  createElement('div', {
    style: {
      display: 'flex',
      width: 420,
      height: 132,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 66,
      backgroundColor: '#E7D5B3',
      color: '#0A1620',
      fontFamily: NEXUS_ARABIC_FONT_FAMILY,
      fontSize: 34,
      fontWeight: 700,
      whiteSpace: 'pre',
    },
  }, visualText(input.cta, rtl)))), width, height)

  return { hook, benefit, end }
}

export function buildProfessionalCampaignFilmFfmpegArgs(input: {
  sourcePath: string
  hookOverlayPath: string
  benefitOverlayPath: string
  endOverlayPath: string
  outputPath: string
  target: PlatformVideoFormat
}): string[] {
  const filter = [
    `[0:v]scale=${input.target.width}:${input.target.height}:force_original_aspect_ratio=increase,crop=${input.target.width}:${input.target.height},setsar=1,fps=${FRAME_RATE},trim=duration=${PROFESSIONAL_CAMPAIGN_FILM_DURATION_SECONDS},setpts=PTS-STARTPTS[base]`,
    '[1:v]format=rgba,fade=t=in:st=0.08:d=0.28:alpha=1,fade=t=out:st=2.45:d=0.35:alpha=1[hook]',
    '[2:v]format=rgba,fade=t=in:st=3.05:d=0.30:alpha=1,fade=t=out:st=6.15:d=0.35:alpha=1[benefit]',
    '[3:v]format=rgba,fade=t=in:st=7.48:d=0.42:alpha=1[end]',
    "[base][hook]overlay=x='if(lt(t,0.48),(0.48-t)*-250,0)':y=0:enable='between(t,0,2.8)'[v1]",
    "[v1][benefit]overlay=x=0:y='if(lt(t,3.45),(3.45-t)*120,0)':enable='between(t,3.0,6.6)'[v2]",
    "[v2][end]overlay=x=0:y='if(lt(t,7.95),(7.95-t)*80,0)':enable='between(t,7.5,10.0)',format=yuv420p[outv]",
  ].join(';')

  return [
    '-y', '-hide_banner', '-loglevel', 'error',
    '-i', input.sourcePath,
    '-loop', '1', '-framerate', String(FRAME_RATE), '-t', String(PROFESSIONAL_CAMPAIGN_FILM_DURATION_SECONDS), '-i', input.hookOverlayPath,
    '-loop', '1', '-framerate', String(FRAME_RATE), '-t', String(PROFESSIONAL_CAMPAIGN_FILM_DURATION_SECONDS), '-i', input.benefitOverlayPath,
    '-loop', '1', '-framerate', String(FRAME_RATE), '-t', String(PROFESSIONAL_CAMPAIGN_FILM_DURATION_SECONDS), '-i', input.endOverlayPath,
    '-filter_complex', filter,
    '-map', '[outv]', '-map', '0:a?',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-profile:v', 'high', '-level', '4.1',
    '-c:a', 'aac', '-b:a', '192k', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
    '-t', String(PROFESSIONAL_CAMPAIGN_FILM_DURATION_SECONDS),
    input.outputPath,
  ]
}

async function downloadSourceVideo(sourceUrl: string, destination: string): Promise<void> {
  const response = await fetch(safeCloudinaryVideoUrl(sourceUrl), { signal: AbortSignal.timeout(45_000) })
  if (!response.ok || !response.body) throw new Error('Campaign-film compositor could not read the generated master')
  const declaredBytes = Number(response.headers.get('content-length') || 0)
  if (declaredBytes > MAX_SOURCE_BYTES) throw new Error('Campaign-film source exceeds the 150 MB render limit')
  let downloadedBytes = 0
  const byteLimit = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      downloadedBytes += chunk.length
      callback(downloadedBytes > MAX_SOURCE_BYTES
        ? new Error('Campaign-film source exceeds the 150 MB render limit')
        : null, chunk)
    },
  })
  await pipeline(Readable.fromWeb(response.body as never), byteLimit, createWriteStream(destination, { flags: 'wx' }))
}

export async function renderAndPersistProfessionalCampaignFilm(input: {
  sourceUrl: string
  target: PlatformVideoFormat
  generationId: string
  overlayCopy: { brand: string; hook: string; benefit: string; cta: string; language: 'ar' | 'en' }
}): Promise<StoredProfessionalCampaignFilm> {
  configureCloudinary()
  const executable = resolveFfmpegBinary()
  const workDir = await mkdtemp(path.join(tmpdir(), 'nexus-campaign-film-'))
  const sourcePath = path.join(workDir, 'source.mp4')
  const hookOverlayPath = path.join(workDir, 'hook.png')
  const benefitOverlayPath = path.join(workDir, 'benefit.png')
  const endOverlayPath = path.join(workDir, 'end.png')
  const outputPath = path.join(workDir, 'master.mp4')

  try {
    await downloadSourceVideo(input.sourceUrl, sourcePath)
    const overlays = await professionalCampaignFilmOverlaySvgs({
      ...input.overlayCopy,
      width: input.target.width,
      height: input.target.height,
    })
    await Promise.all([
      sharp(Buffer.from(overlays.hook)).png().toFile(hookOverlayPath),
      sharp(Buffer.from(overlays.benefit)).png().toFile(benefitOverlayPath),
      sharp(Buffer.from(overlays.end)).png().toFile(endOverlayPath),
    ])
    await execFileAsync(executable, buildProfessionalCampaignFilmFfmpegArgs({
      sourcePath, hookOverlayPath, benefitOverlayPath, endOverlayPath, outputPath, target: input.target,
    }), { timeout: RENDER_TIMEOUT_MS, maxBuffer: 2 * 1024 * 1024 })
    const rendered = await stat(outputPath)
    if (!rendered.isFile() || rendered.size <= 0) throw new Error('Campaign-film compositor produced no usable file')
    const result = await cloudinary.uploader.upload(outputPath, {
      resource_type: 'video',
      folder: 'nexus/campaign-films',
      public_id: `campaign_film_${input.generationId}`,
      overwrite: true,
      unique_filename: false,
    })
    if (!result.secure_url?.startsWith('https://')) throw new Error('Cloudinary returned no durable campaign film')
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
