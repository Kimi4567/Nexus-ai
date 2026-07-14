import { createHash, randomBytes } from 'crypto'

export const X_TWEET_READ_SCOPE = 'tweet.read'
export const X_TWEET_WRITE_SCOPE = 'tweet.write'
export const X_USERS_READ_SCOPE = 'users.read'
export const X_MEDIA_WRITE_SCOPE = 'media.write'
export const X_OFFLINE_SCOPE = 'offline.access'

const DEFAULT_MAX_IMAGE_BYTES = 5 * 1024 * 1024

export function createXCodeVerifier(): string {
  return randomBytes(48).toString('base64url')
}

export function xCodeChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url')
}

export function xCodeVerifierHash(verifier: string): string {
  return createHash('sha256').update(`nexus-x-pkce:${verifier}`).digest('base64url')
}

export function xImageLimitBytes(): number {
  const configured = Number(process.env.X_MAX_IMAGE_BYTES || DEFAULT_MAX_IMAGE_BYTES)
  return Number.isFinite(configured) && configured > 0
    ? Math.min(configured, DEFAULT_MAX_IMAGE_BYTES)
    : DEFAULT_MAX_IMAGE_BYTES
}

function trustedCloudinaryUrl(value: string): URL {
  const url = new URL(value)
  if (url.protocol !== 'https:' || url.hostname !== 'res.cloudinary.com') {
    throw new Error('X publishing media must be a permanent HTTPS Cloudinary asset')
  }
  return url
}

function providerMessage(data: unknown, fallback: string): string {
  const payload = data && typeof data === 'object' && !Array.isArray(data)
    ? data as Record<string, unknown>
    : {}
  const errors = Array.isArray(payload.errors) ? payload.errors : []
  const firstError = errors[0] && typeof errors[0] === 'object' && !Array.isArray(errors[0])
    ? errors[0] as Record<string, unknown>
    : {}
  const detail = payload.detail || payload.title || firstError.detail || firstError.title || payload.error || payload.message
  return detail ? `${fallback}: ${String(detail).slice(0, 300)}` : fallback
}

async function readImageWithLimit(response: Response): Promise<{ bytes: Uint8Array; contentType: string }> {
  const contentType = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(contentType)) {
    throw new Error('X image publishing supports reviewed JPG, PNG, or WEBP assets')
  }
  const limit = xImageLimitBytes()
  const declared = Number(response.headers.get('content-length') || 0)
  if (declared > limit) throw new Error('X image exceeds the 5 MB provider limit')
  if (!response.body) throw new Error('X image download returned no body')

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    if (!value) continue
    total += value.byteLength
    if (total > limit) {
      await reader.cancel()
      throw new Error('X image exceeds the 5 MB provider limit')
    }
    chunks.push(value)
  }
  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return { bytes, contentType }
}

export async function uploadXImage(input: {
  accessToken: string
  imageUrl: string
}): Promise<string> {
  trustedCloudinaryUrl(input.imageUrl)
  const source = await fetch(input.imageUrl, { cache: 'no-store', signal: AbortSignal.timeout(20_000) })
  if (!source.ok) throw new Error(`Cloudinary image download failed: HTTP ${source.status}`)
  const { bytes, contentType } = await readImageWithLimit(source)

  const response = await fetch('https://api.x.com/2/media/upload', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      media: Buffer.from(bytes).toString('base64'),
      media_category: 'tweet_image',
      media_type: contentType,
      shared: false,
    }),
    cache: 'no-store',
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(providerMessage(data, `X media upload failed (HTTP ${response.status})`))
  const mediaId = data?.data?.id || data?.media_id_string
  if (!mediaId) throw new Error('X media upload succeeded without a media ID')
  return String(mediaId)
}

export async function createXPost(input: {
  accessToken: string
  text: string
  imageUrl?: string | null
  username?: string | null
  explicitConsent: boolean
}): Promise<{ postId: string; platformUrl: string }> {
  const text = input.text.trim()
  if (!input.explicitConsent) throw new Error('X requires explicit consent before publishing')
  if (!text) throw new Error('X post text is empty')
  if (Array.from(text).length > 280) {
    throw new Error('X post text must be reviewed to 280 characters or fewer')
  }

  const mediaId = input.imageUrl
    ? await uploadXImage({ accessToken: input.accessToken, imageUrl: input.imageUrl })
    : null
  const response = await fetch('https://api.x.com/2/tweets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text,
      ...(mediaId ? { media: { media_ids: [mediaId] } } : {}),
    }),
    cache: 'no-store',
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(providerMessage(data, `X publish failed (HTTP ${response.status})`))
  const postId = data?.data?.id
  if (!postId) throw new Error('X publish succeeded without a post ID')
  const username = String(input.username || '').replace(/^@/, '').trim()
  return {
    postId: String(postId),
    platformUrl: username
      ? `https://x.com/${encodeURIComponent(username)}/status/${postId}`
      : `https://x.com/i/web/status/${postId}`,
  }
}
