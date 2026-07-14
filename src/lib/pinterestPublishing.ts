import { createHash, randomBytes } from 'crypto'
import { pinterestApiUrl } from './socialPlatformConfig'

export const PINTEREST_BOARDS_READ_SCOPE = 'boards:read'
export const PINTEREST_BOARDS_WRITE_SCOPE = 'boards:write'
export const PINTEREST_PINS_READ_SCOPE = 'pins:read'
export const PINTEREST_PINS_WRITE_SCOPE = 'pins:write'
export const PINTEREST_USER_READ_SCOPE = 'user_accounts:read'

export const PINTEREST_PUBLISH_SCOPES = [
  PINTEREST_BOARDS_READ_SCOPE,
  PINTEREST_BOARDS_WRITE_SCOPE,
  PINTEREST_PINS_READ_SCOPE,
  PINTEREST_PINS_WRITE_SCOPE,
] as const

export type PinterestBoard = {
  id: string
  name: string
  privacy?: string | null
  isAdsOnly?: boolean
}

export type PinterestPostOptions = {
  boardId: string
  title: string
  altText: string
  destinationLink: string | null
  aiDisclosureReviewed: true
  aiDisclosureValues: Array<'AI_MODIFIED' | 'SYNTHETIC_PERFORMER'>
  explicitConsent: true
}

export function createPinterestOAuthNonce(): string {
  return randomBytes(32).toString('base64url')
}

export function pinterestOAuthNonceHash(nonce: string): string {
  return createHash('sha256').update(`nexus-pinterest-oauth:${nonce}`).digest('base64url')
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

export function pinterestBoardsFromConfig(config: unknown): PinterestBoard[] {
  const record = objectValue(config)
  const source = Array.isArray(record.boards) ? record.boards : []
  const seen = new Set<string>()
  return source.flatMap((value): PinterestBoard[] => {
    const board = objectValue(value)
    const id = typeof board.id === 'string' ? board.id.trim() : ''
    const name = typeof board.name === 'string' ? board.name.trim() : ''
    if (!/^\d+$/.test(id) || !name || seen.has(id) || board.isAdsOnly === true) return []
    seen.add(id)
    return [{
      id,
      name: name.slice(0, 200),
      privacy: typeof board.privacy === 'string' ? board.privacy : null,
      isAdsOnly: false,
    }]
  })
}

function reviewedHttpsLink(value: unknown): string | null {
  if (value == null || value === '') return null
  if (typeof value !== 'string') throw new Error('Pinterest destination link must be a valid HTTPS URL')
  let url: URL
  try { url = new URL(value.trim()) } catch { throw new Error('Pinterest destination link must be a valid HTTPS URL') }
  const hostname = url.hostname.toLowerCase()
  if (
    url.protocol !== 'https:'
    || url.username
    || url.password
    || hostname === 'localhost'
    || hostname.endsWith('.localhost')
    || /^127\./.test(hostname)
    || /^10\./.test(hostname)
    || /^192\.168\./.test(hostname)
    || /^169\.254\./.test(hostname)
    || /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
  ) throw new Error('Pinterest destination link must use a public HTTPS address')
  return url.toString().slice(0, 2048)
}

export function parsePinterestPostOptions(value: unknown): PinterestPostOptions {
  const input = objectValue(value)
  const boardId = typeof input.boardId === 'string' ? input.boardId.trim() : ''
  const title = typeof input.title === 'string' ? input.title.trim() : ''
  const altText = typeof input.altText === 'string' ? input.altText.trim() : ''
  if (!/^\d+$/.test(boardId)) throw new Error('Select an authorized Pinterest Board')
  if (!title || Array.from(title).length > 100) throw new Error('Pinterest title must contain 1 to 100 characters')
  if (!altText || Array.from(altText).length > 500) throw new Error('Pinterest alt text must contain 1 to 500 characters')
  if (input.aiDisclosureReviewed !== true) throw new Error('Review the Pinterest AI disclosure before publishing')
  if (input.explicitConsent !== true) throw new Error('Pinterest requires explicit consent before publishing')

  const disclosureValues = Array.isArray(input.aiDisclosureValues) ? input.aiDisclosureValues : []
  const allowed = new Set(['AI_MODIFIED', 'SYNTHETIC_PERFORMER'])
  if (disclosureValues.some(item => typeof item !== 'string' || !allowed.has(item))) {
    throw new Error('Pinterest AI disclosure contains an unsupported value')
  }

  return {
    boardId,
    title,
    altText,
    destinationLink: reviewedHttpsLink(input.destinationLink),
    aiDisclosureReviewed: true,
    aiDisclosureValues: [...new Set(disclosureValues)] as PinterestPostOptions['aiDisclosureValues'],
    explicitConsent: true,
  }
}

function trustedPinterestImage(value: string): void {
  const url = new URL(value)
  if (url.protocol !== 'https:' || url.hostname !== 'res.cloudinary.com') {
    throw new Error('Pinterest publishing requires a permanent HTTPS Cloudinary image')
  }
  if (!/\/(?:image)\/upload\//.test(url.pathname)) {
    throw new Error('Pinterest publishing supports reviewed image assets only')
  }
}

function providerMessage(data: unknown, fallback: string): string {
  const payload = objectValue(data)
  const message = payload.message || payload.error || payload.code
  return message ? `${fallback}: ${String(message).slice(0, 300)}` : fallback
}

export async function createPinterestPin(input: {
  accessToken: string
  description: string
  imageUrl: string
  integrationConfig: unknown
  options: unknown
}): Promise<{ pinId: string; platformUrl: string }> {
  const options = parsePinterestPostOptions(input.options)
  const description = input.description.trim()
  if (!description || Array.from(description).length > 800) {
    throw new Error('Pinterest description must contain 1 to 800 characters')
  }
  trustedPinterestImage(input.imageUrl)
  const board = pinterestBoardsFromConfig(input.integrationConfig).find(item => item.id === options.boardId)
  if (!board) throw new Error('Selected Pinterest Board is not authorized for this connection')

  const response = await fetch(pinterestApiUrl('pins'), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      board_id: board.id,
      title: options.title,
      description,
      alt_text: options.altText,
      ...(options.destinationLink ? { link: options.destinationLink } : {}),
      ...(options.aiDisclosureValues.length > 0
        ? { ai_disclosures: { values: options.aiDisclosureValues } }
        : {}),
      media_source: {
        source_type: 'image_url',
        url: input.imageUrl,
        is_standard: true,
      },
    }),
    cache: 'no-store',
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(providerMessage(data, `Pinterest publish failed (HTTP ${response.status})`))
  const pinId = objectValue(data).id
  if (typeof pinId !== 'string' || !/^\d+$/.test(pinId)) {
    throw new Error('Pinterest publish succeeded without a valid Pin ID')
  }
  return { pinId, platformUrl: `https://www.pinterest.com/pin/${pinId}/` }
}
