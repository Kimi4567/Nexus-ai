export type PublishPlatform = 'META' | 'FACEBOOK' | 'INSTAGRAM' | 'LINKEDIN' | 'TIKTOK'

export type SocialPublishInput = {
  platform: PublishPlatform | string
  caption: string
  imageUrl?: string | null
  link?: string | null
  pageId?: string | null
  accountId?: string | null
  accessToken: string
  integrationConfig?: Record<string, unknown> | null
}

export type SocialPublishResult = {
  platformPostId: string
  platformUrl?: string
}

const META_VERSION = process.env.META_GRAPH_API_VERSION || 'v21.0'
const LINKEDIN_VERSION = process.env.LINKEDIN_API_VERSION || '202603'
const MAX_LINKEDIN_IMAGE_BYTES = 20 * 1024 * 1024

class SocialPublishError extends Error {
  constructor(message: string, readonly retryable: boolean) {
    super(message)
    this.name = 'SocialPublishError'
  }
}

function providerError(provider: string, status: number, data: any): Error {
  const message = data?.error?.message || data?.message || data?.error_description || `HTTP ${status}`
  return new SocialPublishError(
    `${provider}: ${String(message).slice(0, 300)}`,
    status === 408 || status === 409 || status === 425 || status === 429 || status >= 500,
  )
}

export function isRetryableSocialPublishError(error: unknown): boolean {
  if (error instanceof SocialPublishError) return error.retryable
  if (error instanceof TypeError) return true // fetch/network failure
  const message = error instanceof Error ? error.message : String(error)
  return /\b(408|409|425|429|5\d\d)\b|rate.?limit|timeout|timed out|network|temporar/i.test(message)
}

function linkedinHeaders(accessToken: string): Record<string, string> {
  return {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    'Linkedin-Version': LINKEDIN_VERSION,
    'X-Restli-Protocol-Version': '2.0.0',
  }
}

function trustedCloudinaryUrl(value: string): URL {
  const url = new URL(value)
  if (url.protocol !== 'https:' || url.hostname !== 'res.cloudinary.com') {
    throw new Error('Publishing media must be a permanent HTTPS Cloudinary asset')
  }
  return url
}

async function jsonResponse(res: Response): Promise<any> {
  const text = await res.text()
  if (!text) return {}
  try { return JSON.parse(text) } catch { return { message: text.slice(0, 300) } }
}

async function readWithLimit(res: Response, maxBytes: number): Promise<Uint8Array> {
  const declared = Number(res.headers.get('content-length') || 0)
  if (declared > maxBytes) throw new Error('LinkedIn image exceeds the 20 MB safety limit')
  if (!res.body) throw new Error('Image download returned no body')

  const reader = res.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    if (!value) continue
    total += value.byteLength
    if (total > maxBytes) {
      await reader.cancel()
      throw new Error('LinkedIn image exceeds the 20 MB safety limit')
    }
    chunks.push(value)
  }

  const output = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    output.set(chunk, offset)
    offset += chunk.byteLength
  }
  return output
}

async function uploadLinkedInImage(input: {
  ownerUrn: string
  imageUrl: string
  accessToken: string
}): Promise<string> {
  trustedCloudinaryUrl(input.imageUrl)
  const initRes = await fetch('https://api.linkedin.com/rest/images?action=initializeUpload', {
    method: 'POST',
    headers: linkedinHeaders(input.accessToken),
    body: JSON.stringify({ initializeUploadRequest: { owner: input.ownerUrn } }),
  })
  const initData = await jsonResponse(initRes)
  if (!initRes.ok) throw providerError('LinkedIn image initialization failed', initRes.status, initData)

  const uploadUrl = initData?.value?.uploadUrl
  const imageUrn = initData?.value?.image
  if (typeof uploadUrl !== 'string' || typeof imageUrn !== 'string') {
    throw new Error('LinkedIn image initialization returned an incomplete response')
  }

  const sourceRes = await fetch(input.imageUrl, { signal: AbortSignal.timeout(15_000) })
  if (!sourceRes.ok) throw new Error(`Cloudinary image download failed: HTTP ${sourceRes.status}`)
  const contentType = sourceRes.headers.get('content-type') || ''
  if (!['image/jpeg', 'image/png', 'image/gif'].some((type) => contentType.startsWith(type))) {
    throw new Error('LinkedIn image must be JPG, PNG, or GIF')
  }
  const bytes = await readWithLimit(sourceRes, MAX_LINKEDIN_IMAGE_BYTES)
  const uploadBody = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer

  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: uploadBody,
  })
  if (!uploadRes.ok) {
    const data = await jsonResponse(uploadRes)
    throw providerError('LinkedIn image upload failed', uploadRes.status, data)
  }
  return imageUrn
}

async function publishLinkedIn(input: SocialPublishInput): Promise<SocialPublishResult> {
  const personId = input.accountId || String(input.integrationConfig?.personId || '')
  const organizationId = String(input.integrationConfig?.organizationId || '')
  const ownerUrn = organizationId
    ? (organizationId.startsWith('urn:li:') ? organizationId : `urn:li:organization:${organizationId}`)
    : personId.startsWith('urn:li:') ? personId : `urn:li:person:${personId}`
  if (!personId && !organizationId) throw new Error('LinkedIn author identity is missing')

  const body: Record<string, unknown> = {
    author: ownerUrn,
    commentary: input.caption,
    visibility: 'PUBLIC',
    distribution: {
      feedDistribution: 'MAIN_FEED',
      targetEntities: [],
      thirdPartyDistributionChannels: [],
    },
    lifecycleState: 'PUBLISHED',
    isReshareDisabledByAuthor: false,
  }
  if (input.imageUrl) {
    const imageUrn = await uploadLinkedInImage({
      ownerUrn,
      imageUrl: input.imageUrl,
      accessToken: input.accessToken,
    })
    body.content = { media: { id: imageUrn, altText: input.caption.slice(0, 120) } }
  }

  const res = await fetch('https://api.linkedin.com/rest/posts', {
    method: 'POST',
    headers: linkedinHeaders(input.accessToken),
    body: JSON.stringify(body),
  })
  const data = await jsonResponse(res)
  if (!res.ok) throw providerError('LinkedIn publish failed', res.status, data)
  const id = res.headers.get('x-restli-id') || data.id
  if (!id) throw new Error('LinkedIn publish succeeded without a post ID')
  return { platformPostId: id }
}

function metaPage(input: SocialPublishInput): Record<string, any> | null {
  const pages = Array.isArray(input.integrationConfig?.pages)
    ? input.integrationConfig?.pages as Array<Record<string, any>>
    : []
  return pages.find((page) => page.id === input.pageId || page.igAccountId === input.pageId) ?? null
}

async function publishMeta(input: SocialPublishInput): Promise<SocialPublishResult> {
  const page = metaPage(input)
  const targetId = input.pageId || page?.id
  if (!targetId) throw new Error('Meta page/account selection is missing')
  const isInstagram = input.platform === 'INSTAGRAM' || page?.igAccountId === targetId

  if (isInstagram) {
    if (!input.imageUrl) throw new Error('Instagram publishing requires an approved permanent image')
    trustedCloudinaryUrl(input.imageUrl)
    const containerRes = await fetch(`https://graph.facebook.com/${META_VERSION}/${encodeURIComponent(targetId)}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caption: input.caption, image_url: input.imageUrl, access_token: input.accessToken }),
    })
    const container = await jsonResponse(containerRes)
    if (!containerRes.ok || container.error || !container.id) {
      throw providerError('Instagram container creation failed', containerRes.status, container)
    }
    const publishRes = await fetch(`https://graph.facebook.com/${META_VERSION}/${encodeURIComponent(targetId)}/media_publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ creation_id: container.id, access_token: input.accessToken }),
    })
    const published = await jsonResponse(publishRes)
    if (!publishRes.ok || published.error || !published.id) {
      throw providerError('Instagram publish failed', publishRes.status, published)
    }
    return { platformPostId: published.id }
  }

  if (input.imageUrl) trustedCloudinaryUrl(input.imageUrl)
  const hasImage = Boolean(input.imageUrl)
  const endpoint = hasImage ? 'photos' : 'feed'
  const body = hasImage
    ? { message: input.caption, url: input.imageUrl, access_token: input.accessToken }
    : { message: input.caption, ...(input.link ? { link: input.link } : {}), access_token: input.accessToken }
  const res = await fetch(`https://graph.facebook.com/${META_VERSION}/${encodeURIComponent(targetId)}/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await jsonResponse(res)
  if (!res.ok || data.error || !data.id) throw providerError('Facebook publish failed', res.status, data)
  return { platformPostId: data.id, platformUrl: `https://facebook.com/${data.id}` }
}

async function publishTikTok(input: SocialPublishInput): Promise<SocialPublishResult> {
  if (!input.imageUrl) throw new Error('TikTok direct post requires a permanent video URL')
  trustedCloudinaryUrl(input.imageUrl)
  const privacyLevel = String(input.integrationConfig?.approvedPrivacyLevel || '')
  const consentAt = String(input.integrationConfig?.directPostConsentAt || '')
  if (!privacyLevel || !consentAt) {
    throw new Error('TikTok direct posting requires creator-info privacy selection and explicit consent; use manual publishing until configured')
  }
  throw new Error('TikTok direct posting is paused until creator-info validation is implemented')
}

export async function publishSocialPost(input: SocialPublishInput): Promise<SocialPublishResult> {
  if (!input.caption.trim()) throw new Error('Post caption is empty')
  if (!input.accessToken) throw new Error('Platform access token is missing')

  switch (input.platform) {
    case 'META':
    case 'FACEBOOK':
    case 'INSTAGRAM':
      return publishMeta(input)
    case 'LINKEDIN':
      return publishLinkedIn(input)
    case 'TIKTOK':
      return publishTikTok(input)
    default:
      throw new Error(`Unsupported publishing platform: ${input.platform}`)
  }
}
