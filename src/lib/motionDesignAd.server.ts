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
import {
  PROFESSIONAL_VIDEO_DURATION_SECONDS,
  PROFESSIONAL_VIDEO_FRAME_RATE,
  type ProfessionalVideoTimeline,
} from '@/lib/professionalVideoTimeline'

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

export function splitMotionDesignHookMetric(hook: string): { lead: string; metric: string } | null {
  // Arabic unit words can contain combining marks (for example "درهمًا").
  // Treat those marks as part of the unit so the price/timing metric gets its
  // own legible visual treatment instead of overflowing as generic body copy.
  const match = hook.match(/^(.*?)(\d+(?:[.,]\d+)?\s+[\p{L}\p{M}]+)\s*$/u)
  if (!match) return null
  const lead = match[1]?.trim() || ''
  const metric = match[2]?.trim() || ''
  return metric ? { lead, metric } : null
}

export function professionalMotionDesignHeadlineLines(
  headline: string,
  vertical = true,
): string[] {
  return wrapVideoOverlayText(headline, vertical ? 16 : 28, vertical ? 3 : 2)
}

export async function professionalMotionDesignOverlaySvgs(input: {
  timeline: ProfessionalVideoTimeline
  width?: number
  height?: number
}): Promise<{ intro: string; hook: string; end: string }> {
  const width = input.width || 720
  const height = input.height || 1280
  const vertical = height > width
  const { copy, palette } = input.timeline
  const rtl = copy.language === 'ar'
  const shortEdge = Math.min(width, height)
  const horizontalPadding = Math.round(width * (vertical ? 0.075 : 0.06))
  const root: CSSProperties = {
    width,
    height,
    display: 'flex',
    boxSizing: 'border-box',
    fontFamily: NEXUS_ARABIC_FONT_FAMILY,
  }
  const brand = createElement('div', {
    style: {
      display: 'flex',
      alignSelf: rtl ? 'flex-end' : 'flex-start',
      padding: `${Math.round(shortEdge * 0.014)}px ${Math.round(shortEdge * 0.024)}px`,
      border: `${Math.max(1, Math.round(shortEdge * 0.0015))}px solid rgba(255,255,255,0.46)`,
      borderRadius: Math.round(shortEdge * 0.05),
      backgroundColor: 'rgba(12,10,9,0.48)',
      color: '#FFFFFF',
      fontSize: Math.round(shortEdge * 0.026),
      fontWeight: 700,
      letterSpacing: rtl ? 0 : Math.round(shortEdge * 0.003),
      whiteSpace: 'pre',
    },
  }, visualVideoOverlayText(copy.brand.toUpperCase(), rtl))

  const intro = await renderPathOnlyVideoOverlay(createElement('div', {
    style: {
      ...root,
      flexDirection: 'column',
      justifyContent: 'space-between',
      padding: `${Math.round(height * 0.055)}px ${horizontalPadding}px ${Math.round(height * (vertical ? 0.16 : 0.10))}px`,
      backgroundImage: 'linear-gradient(to bottom, rgba(10,8,7,0.36) 0%, rgba(10,8,7,0) 35%, rgba(10,8,7,0.08) 52%, rgba(10,8,7,0.88) 100%)',
    },
  },
  brand,
  createElement('div', {
    style: {
      display: 'flex',
      width: vertical ? '94%' : '70%',
      alignSelf: rtl ? 'flex-end' : 'flex-start',
      flexDirection: 'column',
      alignItems: rtl ? 'flex-end' : 'flex-start',
      gap: Math.round(shortEdge * 0.024),
    },
  },
  createElement('div', {
    style: {
      display: 'flex',
      width: Math.round(shortEdge * 0.16),
      height: Math.max(5, Math.round(shortEdge * 0.009)),
      borderRadius: Math.round(shortEdge * 0.01),
      backgroundColor: palette.accent,
    },
  }),
  videoOverlayTextLines(
    wrapVideoOverlayText(copy.eyebrow, rtl ? (vertical ? 20 : 28) : (vertical ? 26 : 36), 2),
    {
      rtl,
      size: Math.round(shortEdge * (vertical ? 0.043 : 0.036)),
      color: palette.paper,
    },
  ),
  createElement('div', {
    style: {
      display: 'flex',
      width: '100%',
      padding: `${Math.round(shortEdge * 0.016)}px ${Math.round(shortEdge * 0.03)}px`,
      boxSizing: 'border-box',
      borderRadius: Math.round(shortEdge * 0.018),
      backgroundColor: palette.paper,
      color: palette.ink,
      boxShadow: `0 ${Math.round(shortEdge * 0.02)}px ${Math.round(shortEdge * 0.07)}px rgba(0,0,0,0.30)`,
    },
  }, videoOverlayTextLines(
    professionalMotionDesignHeadlineLines(copy.headline, vertical),
    {
      rtl,
      size: Math.round(shortEdge * (vertical ? 0.062 : 0.058)),
      color: palette.ink,
    },
  )))), width, height)

  const hook = await renderPathOnlyVideoOverlay(createElement('div', {
    style: {
      ...root,
      flexDirection: 'column',
      justifyContent: 'space-between',
      padding: `${Math.round(height * 0.055)}px ${horizontalPadding}px ${Math.round(height * (vertical ? 0.15 : 0.09))}px`,
      backgroundImage: 'linear-gradient(to bottom, rgba(10,8,7,0.42) 0%, rgba(10,8,7,0) 34%, rgba(10,8,7,0) 50%, rgba(10,8,7,0.82) 100%)',
    },
  },
  brand,
  createElement('div', {
    style: {
      display: 'flex',
      width: vertical ? '88%' : '64%',
      alignSelf: rtl ? 'flex-end' : 'flex-start',
      flexDirection: 'column',
      alignItems: rtl ? 'flex-end' : 'flex-start',
      padding: `${Math.round(shortEdge * 0.035)}px ${Math.round(shortEdge * 0.04)}px`,
      gap: Math.round(shortEdge * 0.024),
      boxSizing: 'border-box',
      border: `${Math.max(1, Math.round(shortEdge * 0.0015))}px solid rgba(255,255,255,0.34)`,
      borderRadius: Math.round(shortEdge * 0.03),
      backgroundColor: 'rgba(17,13,11,0.78)',
    },
  },
  createElement('div', {
    style: {
      display: 'flex',
      width: Math.round(shortEdge * 0.11),
      height: Math.max(4, Math.round(shortEdge * 0.007)),
      borderRadius: Math.round(shortEdge * 0.008),
      backgroundColor: palette.accent,
    },
  }),
  videoOverlayTextLines(
    wrapVideoOverlayText(copy.eyebrow, rtl ? (vertical ? 18 : 28) : (vertical ? 24 : 34), 2),
    {
      rtl,
      size: Math.round(shortEdge * (vertical ? 0.06 : 0.048)),
      color: '#FFFFFF',
    },
  ),
  copy.supporting
    ? videoOverlayTextLines(
      wrapVideoOverlayText(copy.supporting, rtl ? (vertical ? 24 : 34) : (vertical ? 30 : 42), 2),
      {
        rtl,
        size: Math.round(shortEdge * (vertical ? 0.038 : 0.032)),
        color: palette.paper,
      },
    )
    : null)), width, height)

  const end = await renderPathOnlyVideoOverlay(createElement('div', {
    style: {
      ...root,
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'flex-end',
      padding: `${Math.round(height * 0.07)}px ${horizontalPadding}px ${Math.round(height * (vertical ? 0.16 : 0.10))}px`,
      backgroundImage: 'linear-gradient(to bottom, rgba(10,8,7,0.16) 0%, rgba(10,8,7,0.08) 38%, rgba(10,8,7,0.92) 100%)',
    },
  },
  createElement('div', {
    style: {
      display: 'flex',
      width: vertical ? '88%' : '58%',
      flexDirection: 'column',
      alignItems: 'center',
      gap: Math.round(shortEdge * 0.035),
    },
  },
  createElement('div', {
    style: {
      display: 'flex',
      color: '#FFFFFF',
      fontSize: Math.round(shortEdge * 0.052),
      fontWeight: 700,
      letterSpacing: rtl ? 0 : Math.round(shortEdge * 0.006),
      whiteSpace: 'pre',
    },
  }, visualVideoOverlayText(copy.brand.toUpperCase(), rtl)),
  createElement('div', {
    style: {
      display: 'flex',
      width: Math.round(shortEdge * 0.13),
      height: Math.max(5, Math.round(shortEdge * 0.008)),
      borderRadius: Math.round(shortEdge * 0.01),
      backgroundColor: palette.accent,
    },
  }),
  createElement('div', {
    style: {
      display: 'flex',
      minWidth: Math.round(width * (vertical ? 0.52 : 0.32)),
      padding: `${Math.round(shortEdge * 0.015)}px ${Math.round(shortEdge * 0.045)}px ${Math.round(shortEdge * 0.022)}px`,
      alignItems: 'center',
      justifyContent: 'center',
      borderBottom: `${Math.max(3, Math.round(shortEdge * 0.006))}px solid ${palette.accent}`,
    },
  }, videoOverlayTextLines([copy.cta], {
    rtl,
    size: Math.round(shortEdge * 0.043),
    color: '#FFFFFF',
    align: 'center',
  })))), width, height)

  return { intro, hook, end }
}

export async function motionDesignOverlaySvgs(input: MotionDesignCopy & {
  width?: number
  height?: number
}): Promise<{ intro: string; hook: string; end: string }> {
  const width = input.width || 720
  const height = input.height || 1280
  const vertical = height > width
  const rtl = input.language === 'ar'
  const hookMetricParts = splitMotionDesignHookMetric(input.hook)
  const hookLead = hookMetricParts?.lead || ''
  const hookMetric = hookMetricParts?.metric || ''
  const shortEdge = Math.min(width, height)
  const horizontalPadding = Math.round(width * (vertical ? 0.08 : 0.065))
  const root: CSSProperties = {
    width,
    height,
    display: 'flex',
    boxSizing: 'border-box',
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

  const intro = await renderPathOnlyVideoOverlay(createElement('div', {
    style: {
      ...root,
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'flex-start',
      padding: `${Math.round(height * 0.06)}px ${horizontalPadding}px ${Math.round(height * 0.09)}px`,
      backgroundImage: 'linear-gradient(to bottom, rgba(7,10,19,0.82) 0%, rgba(7,10,19,0.28) 28%, rgba(7,10,19,0) 48%, rgba(7,10,19,0) 68%, rgba(7,10,19,0.78) 100%)',
    },
  },
  createElement('div', {
    style: {
      ...brandStyle,
      alignSelf: 'center',
      color: '#D8C7FF',
      fontSize: Math.round(shortEdge * 0.04),
    },
  }, visualVideoOverlayText(input.brandLabel.toUpperCase(), rtl)),
  createElement('div', {
    style: {
      display: 'flex',
      width: vertical ? '82%' : '58%',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: Math.round(height * 0.07),
      padding: `${Math.round(shortEdge * 0.045)}px ${Math.round(shortEdge * 0.04)}px`,
      boxSizing: 'border-box',
      border: `${Math.max(2, Math.round(shortEdge * 0.004))}px solid rgba(255,255,255,0.82)`,
      borderRadius: Math.round(shortEdge * 0.05),
      backgroundColor: '#D8C7FF',
    },
  },
  hookMetric
    ? createElement('div', {
      style: {
        display: 'flex',
        width: '100%',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Math.round(shortEdge * 0.025),
      },
    },
    hookLead
      ? videoOverlayTextLines(
        wrapVideoOverlayText(hookLead, rtl ? (vertical ? 18 : 26) : (vertical ? 24 : 34)),
        {
          rtl,
          size: Math.round(shortEdge * (vertical ? 0.05 : 0.043)),
          color: '#0B0E18',
          align: 'center',
        },
      )
      : null,
    createElement('div', {
      style: {
        display: 'flex',
        minWidth: Math.round(width * (vertical ? 0.72 : 0.48)),
        height: Math.round(shortEdge * 0.21),
        padding: `0 ${Math.round(shortEdge * 0.07)}px`,
        alignItems: 'center',
        justifyContent: 'center',
        boxSizing: 'border-box',
        borderRadius: Math.round(shortEdge * 0.125),
        backgroundColor: '#0B0E18',
      },
    }, videoOverlayInlineText(hookMetric, {
      rtl,
      size: Math.round(shortEdge * (vertical ? 0.112 : 0.09)),
      color: '#FFFFFF',
    })))
    : null,
  !hookMetric
    ? videoOverlayTextLines(
      wrapVideoOverlayText(input.hook, rtl ? (vertical ? 13 : 20) : (vertical ? 18 : 28)),
      {
        rtl,
        size: Math.round(shortEdge * (vertical ? 0.09 : 0.072)),
        color: '#0B0E18',
        align: 'center',
      },
    )
    : null),
  createElement('div', {
    style: {
      display: 'flex',
      width: Math.round(shortEdge * 0.22),
      height: Math.max(5, Math.round(shortEdge * 0.012)),
      marginTop: 'auto',
      borderRadius: Math.round(shortEdge * 0.008),
      backgroundColor: '#D8C7FF',
    },
  })), width, height)

  const hook = await renderPathOnlyVideoOverlay(createElement('div', {
    style: {
      ...root,
      flexDirection: 'column',
      justifyContent: 'space-between',
      padding: `${Math.round(height * 0.055)}px ${horizontalPadding}px ${Math.round(height * (vertical ? 0.12 : 0.09))}px`,
      backgroundImage: 'linear-gradient(to bottom, rgba(7,10,19,0.24) 0%, rgba(7,10,19,0) 38%, rgba(7,10,19,0.94) 100%)',
    },
  },
  createElement('div', { style: brandStyle }, visualVideoOverlayText(input.brandLabel.toUpperCase(), rtl)),
  createElement('div', {
    style: {
      display: 'flex',
      width: '100%',
      flexDirection: 'column',
      alignItems: rtl ? 'flex-end' : 'flex-start',
      gap: Math.round(shortEdge * 0.026),
      padding: `${Math.round(shortEdge * 0.044)}px ${Math.round(shortEdge * 0.05)}px`,
      boxSizing: 'border-box',
      border: `${Math.max(1, Math.round(shortEdge * 0.002))}px solid rgba(255,255,255,0.72)`,
      borderRadius: Math.round(shortEdge * 0.038),
      backgroundColor: '#D8C7FF',
    },
  },
  createElement('div', {
    style: {
      display: 'flex',
      width: Math.round(shortEdge * 0.12),
      height: Math.max(4, Math.round(shortEdge * 0.009)),
      borderRadius: Math.round(shortEdge * 0.006),
      backgroundColor: '#0B0E18',
    },
  }),
  hookLead && hookMetric
    ? createElement('div', {
      style: {
        display: 'flex',
        width: '100%',
        flexDirection: 'column',
        alignItems: rtl ? 'flex-end' : 'flex-start',
        gap: Math.round(shortEdge * 0.025),
      },
    },
    videoOverlayTextLines(
      wrapVideoOverlayText(hookLead, rtl ? (vertical ? 18 : 26) : (vertical ? 24 : 34)),
      {
        rtl,
        size: Math.round(shortEdge * (vertical ? 0.058 : 0.05)),
        color: '#0B0E18',
      },
    ),
    createElement('div', {
      style: {
        display: 'flex',
        minWidth: Math.round(width * (vertical ? 0.48 : 0.3)),
        height: Math.round(shortEdge * 0.145),
        padding: `0 ${Math.round(shortEdge * 0.055)}px`,
        alignItems: 'center',
        justifyContent: 'center',
        boxSizing: 'border-box',
        borderRadius: Math.round(shortEdge * 0.073),
        backgroundColor: '#0B0E18',
      },
    }, videoOverlayInlineText(hookMetric, {
      rtl,
      size: Math.round(shortEdge * (vertical ? 0.076 : 0.064)),
      color: '#D8C7FF',
    })))
    : videoOverlayTextLines(
      wrapVideoOverlayText(input.hook, rtl ? (vertical ? 16 : 24) : (vertical ? 21 : 32)),
      {
        rtl,
        size: Math.round(shortEdge * (vertical ? 0.074 : 0.062)),
        color: '#0B0E18',
      },
    ))), width, height)

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
      boxSizing: 'border-box',
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

  return { intro, hook, end }
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
  introOverlayPath: string
  hookOverlayPath: string
  endOverlayPath: string
  outputPath: string
  target: PlatformVideoFormat
  timeline?: ProfessionalVideoTimeline
  sourceWidth?: number | null
  sourceHeight?: number | null
}): string[] {
  const sourceAspect = Number(input.sourceWidth || 0) / Math.max(1, Number(input.sourceHeight || 0))
  const targetAspect = input.target.width / input.target.height
  const sourceMatchesTarget = Number(input.sourceWidth || 0) > 0
    && Number(input.sourceHeight || 0) > 0
    && Math.abs(sourceAspect - targetAspect) <= 0.02
  const frameRate = input.timeline?.frameRate || PROFESSIONAL_VIDEO_FRAME_RATE
  const durationSeconds = input.timeline?.durationSeconds || PROFESSIONAL_VIDEO_DURATION_SECONDS
  const width = input.target.width
  const height = input.target.height
  const fullBleed = sourceMatchesTarget || input.timeline?.sourceLayout === 'FULL_BLEED'
  const sourceCanvas = fullBleed
    ? [
        `[0:v]scale=${width}:${height}:force_original_aspect_ratio=increase`,
        `crop=${width}:${height}`,
        `fps=${frameRate}`,
        'setsar=1',
        'format=yuv420p[canvas]',
      ].join(',')
    : [
        '[0:v]split=2[background_source][hero_source]',
        `[background_source]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},gblur=sigma=32,eq=brightness=-0.24:saturation=0.72[background]`,
        `[hero_source]scale=${width}:${height}:force_original_aspect_ratio=decrease[hero]`,
        `[background][hero]overlay=x=(W-w)/2:y=(H-h)/2,fps=${frameRate},setsar=1,format=yuv420p[canvas]`,
      ].join(';')
  const filter = [
    sourceCanvas,
    '[canvas]split=3[hook_source][proof_source][cta_source]',
    `[hook_source]trim=start=0:duration=2,setpts=PTS-STARTPTS,zoompan=z='if(lt(on,12),1.12-(on/12)*0.12,1)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=${width}x${height}:fps=${frameRate},settb=AVTB,format=yuv420p[scene_hook]`,
    `[proof_source]trim=start=0.5:duration=2.5,setpts=PTS-STARTPTS,zoompan=z='1.025':x='min(on*0.35,iw-iw/zoom)':y='ih/2-(ih/zoom/2)':d=1:s=${width}x${height}:fps=${frameRate},settb=AVTB,format=yuv420p[scene_proof]`,
    `[cta_source]trim=start=0.8:duration=2.2,setpts=PTS-STARTPTS,zoompan=z='1+min(on/${Math.round(2.2 * frameRate)},1)*0.045':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=${width}x${height}:fps=${frameRate},eq=contrast=1.04:saturation=1.04,settb=AVTB,format=yuv420p[scene_cta]`,
    '[scene_hook][scene_proof]xfade=transition=smoothleft:duration=0.35:offset=1.65[edit_a]',
    '[edit_a][scene_cta]xfade=transition=fade:duration=0.35:offset=3.8[base]',
    // The commercial fact must be legible on frame zero. A fade-in here makes
    // the first QA frame look like unbranded source footage and weakens the
    // real-world scroll stop even when the rest of the edit is strong.
    '[1:v]format=rgba,fade=t=out:st=1.52:d=0.18:alpha=1[intro]',
    '[2:v]format=rgba,fade=t=in:st=1.58:d=0.18:alpha=1,fade=t=out:st=3.58:d=0.2:alpha=1[hook]',
    '[3:v]format=rgba,fade=t=in:st=3.72:d=0.24:alpha=1[end]',
    "[base][intro]overlay=x=0:y=0:enable='between(t,0,1.72)'[v0]",
    "[v0][hook]overlay=x='if(lt(t,1.82),(1.82-t)*100,0)':y=0:enable='between(t,1.58,3.82)'[v1]",
    `[v1][end]overlay=x=0:y='if(lt(t,4.02),(4.02-t)*90,0)':enable='between(t,3.72,${durationSeconds})',trim=duration=${durationSeconds},format=yuv420p[outv]`,
    `[4:a]highpass=f=180,lowpass=f=4200,volume='0.012+0.052*between(t\\,0\\,0.34)+0.064*between(t\\,1.48\\,1.94)+0.058*between(t\\,3.64\\,4.12)':eval=frame,afade=t=in:st=0:d=0.08,afade=t=out:st=5.65:d=0.35[whoosh]`,
    '[5:a]volume=0.16,afade=t=out:st=0.12:d=0.1,adelay=3780|3780[impact]',
    `[whoosh][impact]amix=inputs=2:duration=longest:normalize=0,loudnorm=I=${input.timeline?.soundDesign.targetLufs || -18}:TP=${input.timeline?.soundDesign.truePeakDb || -2}:LRA=7,atrim=duration=${durationSeconds}[outa]`,
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
    '-framerate', String(frameRate),
    '-t', String(durationSeconds),
    '-i', input.introOverlayPath,
    '-loop', '1',
    '-framerate', String(frameRate),
    '-t', String(durationSeconds),
    '-i', input.hookOverlayPath,
    '-loop', '1',
    '-framerate', String(frameRate),
    '-t', String(durationSeconds),
    '-i', input.endOverlayPath,
    '-f', 'lavfi',
    '-t', String(durationSeconds),
    '-i', 'anoisesrc=color=pink:sample_rate=48000:amplitude=0.12',
    '-f', 'lavfi',
    '-t', '0.22',
    '-i', 'sine=frequency=92:sample_rate=48000',
    '-filter_complex', filter,
    '-map', '[outv]',
    '-map', '[outa]',
    '-c:v', 'libx264',
    '-preset', 'medium',
    '-crf', '18',
    '-profile:v', 'high',
    '-level', '4.1',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-b:a', '160k',
    '-movflags', '+faststart',
    '-t', String(durationSeconds),
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
  timeline: ProfessionalVideoTimeline
  sourceWidth?: number | null
  sourceHeight?: number | null
}): Promise<StoredMotionDesignVideo> {
  configureCloudinary()
  const executable = resolveFfmpegBinary()

  const workDir = await mkdtemp(path.join(tmpdir(), 'nexus-motion-'))
  const sourcePath = path.join(workDir, 'source.mp4')
  const introOverlayPath = path.join(workDir, 'intro.png')
  const hookOverlayPath = path.join(workDir, 'hook.png')
  const endOverlayPath = path.join(workDir, 'end.png')
  const outputPath = path.join(workDir, 'master.mp4')
  try {
    await downloadSourceVideo(input.sourceUrl, sourcePath)
    const overlays = await professionalMotionDesignOverlaySvgs({
      timeline: input.timeline,
      width: input.target.width,
      height: input.target.height,
    })
    await Promise.all([
      sharp(Buffer.from(overlays.intro)).png().toFile(introOverlayPath),
      sharp(Buffer.from(overlays.hook)).png().toFile(hookOverlayPath),
      sharp(Buffer.from(overlays.end)).png().toFile(endOverlayPath),
    ])
    await execFileAsync(executable, buildMotionDesignFfmpegArgs({
      sourcePath,
      introOverlayPath,
      hookOverlayPath,
      endOverlayPath,
      outputPath,
      target: input.target,
      timeline: input.timeline,
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
