import 'server-only'

import {
  BRAND_EVIDENCE_MAX_SOURCE_CHARS,
  normalizeEvidenceText,
  truncateEvidenceSource,
  type BrandEvidenceMimeType,
} from '@/lib/brandEvidence'

export interface ExtractedBrandEvidence {
  text: string
  metadata: Record<string, unknown>
}

const POWERPOINT_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.presentationml.presentation'

function decodeXmlText(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (entity, token: string) => {
    const named: Record<string, string> = {
      amp: '&',
      lt: '<',
      gt: '>',
      quot: '"',
      apos: "'",
    }
    const normalized = token.toLowerCase()
    if (named[normalized]) return named[normalized]

    const radix = normalized.startsWith('#x') ? 16 : 10
    const numeric = Number.parseInt(normalized.replace(/^#x?/, ''), radix)
    if (!Number.isFinite(numeric) || numeric < 0 || numeric > 0x10ffff) return entity
    try {
      return String.fromCodePoint(numeric)
    } catch {
      return entity
    }
  })
}

function slideNumber(path: string): number | null {
  const match = /^ppt\/slides\/slide(\d+)\.xml$/i.exec(path)
  return match ? Number(match[1]) : null
}

async function extractPowerPointText(bytes: ArrayBuffer): Promise<ExtractedBrandEvidence> {
  try {
    const { default: JSZip } = await import('jszip')
    const archive = await JSZip.loadAsync(bytes)
    const slides = Object.values(archive.files)
      .map(file => ({ file, number: slideNumber(file.name) }))
      .filter((entry): entry is { file: typeof entry.file; number: number } => entry.number !== null && !entry.file.dir)
      .sort((left, right) => left.number - right.number)

    const sections: string[] = []
    for (const slide of slides) {
      const xml = await slide.file.async('string')
      const runs = Array.from(xml.matchAll(/<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>/gi))
        .map(match => normalizeEvidenceText(decodeXmlText(match[1])))
        .filter(Boolean)
      if (runs.length > 0) sections.push(`[Slide ${slide.number}]\n${runs.join(' ')}`)
    }

    const normalized = normalizeEvidenceText(sections.join('\n\n'))
    if (slides.length === 0 || !normalized) throw new Error('invalid_powerpoint_document')
    return {
      text: truncateEvidenceSource(normalized),
      metadata: {
        parser: 'jszip-pptx',
        totalSlides: slides.length,
        truncated: normalized.length > BRAND_EVIDENCE_MAX_SOURCE_CHARS,
      },
    }
  } catch (error) {
    if (error instanceof Error && error.message === 'invalid_powerpoint_document') throw error
    throw new Error('invalid_powerpoint_document')
  }
}

export async function extractBrandEvidenceText(
  bytes: ArrayBuffer,
  mimeType: BrandEvidenceMimeType,
): Promise<ExtractedBrandEvidence> {
  if (mimeType === 'application/pdf') {
    const { extractText, getDocumentProxy } = await import('unpdf')
    const pdf = await getDocumentProxy(new Uint8Array(bytes))
    const result = await extractText(pdf, { mergePages: true })
    const text = truncateEvidenceSource(result.text)
    return { text, metadata: { parser: 'unpdf', totalPages: result.totalPages, truncated: text.length >= 40_000 } }
  }

  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const mammoth = await import('mammoth')
    const result = await mammoth.extractRawText({ buffer: Buffer.from(bytes) })
    const text = truncateEvidenceSource(result.value)
    return {
      text,
      metadata: {
        parser: 'mammoth',
        warnings: result.messages.slice(0, 10).map(message => message.message),
        truncated: text.length >= 40_000,
      },
    }
  }

  if (mimeType === POWERPOINT_MIME_TYPE) {
    return extractPowerPointText(bytes)
  }

  const decoded = new TextDecoder('utf-8', { fatal: false }).decode(bytes)
  if (mimeType === 'application/json') {
    try {
      const parsed = JSON.parse(decoded)
      const text = truncateEvidenceSource(JSON.stringify(parsed, null, 2))
      return { text, metadata: { parser: 'json', truncated: text.length >= 40_000 } }
    } catch {
      throw new Error('invalid_json_document')
    }
  }

  const text = truncateEvidenceSource(normalizeEvidenceText(decoded))
  return { text, metadata: { parser: 'text', truncated: text.length >= 40_000 } }
}
