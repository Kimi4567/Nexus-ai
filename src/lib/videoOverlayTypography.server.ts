import { createElement, type ReactElement } from 'react'
import satori from 'satori'
import {
  NEXUS_ARABIC_FONT_BASE64,
  NEXUS_ARABIC_FONT_FAMILY,
} from '@/lib/assets/nexusArabicFont'

export function wrapVideoOverlayText(value: string, maxCharacters: number, maxLines = 2): string[] {
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

export function visualVideoOverlayText(value: string, rtl: boolean): string {
  // Satori shapes Arabic inside each word but lays word boxes left-to-right.
  // Reverse only the word boxes so glyph joining remains deterministic.
  return rtl && /[\u0600-\u06FF]/.test(value)
    ? value.trim().split(/\s+/).reverse().join(' ')
    : value
}

export function videoOverlayTextLines(lines: string[], options: {
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
  }, visualVideoOverlayText(line, options.rtl))))
}

export function videoOverlayInlineText(value: string, options: {
  rtl: boolean
  size: number
  color: string
  gap?: number
}): ReactElement {
  const words = value.trim().split(/\s+/).filter(Boolean)
  const visualWords = options.rtl ? words.reverse() : words
  return createElement('div', {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: options.gap ?? Math.max(8, Math.round(options.size * 0.3)),
      color: options.color,
      fontFamily: NEXUS_ARABIC_FONT_FAMILY,
      fontSize: options.size,
      fontWeight: 700,
      lineHeight: 1,
    },
  }, ...visualWords.map((word, index) => createElement('div', {
    key: `${index}-${word}`,
    style: { display: 'flex', whiteSpace: 'pre' },
  }, word)))
}

function satoriFontData(): ArrayBuffer {
  const font = Buffer.from(NEXUS_ARABIC_FONT_BASE64, 'base64')
  return font.buffer.slice(font.byteOffset, font.byteOffset + font.byteLength) as ArrayBuffer
}

export async function renderPathOnlyVideoOverlay(
  element: ReactElement,
  width: number,
  height: number,
): Promise<string> {
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
    throw new Error('NEXUS video typography was not converted to deterministic vector paths')
  }
  return svg
}

export { NEXUS_ARABIC_FONT_FAMILY }
