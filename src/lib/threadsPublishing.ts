import { createHash, randomBytes } from 'crypto'
import { threadsApiUrl } from './socialPlatformConfig'

export const THREADS_BASIC_SCOPE = 'threads_basic'
export const THREADS_PUBLISH_SCOPE = 'threads_content_publish'
export const THREADS_INSIGHTS_SCOPE = 'threads_manage_insights'

export const THREADS_PUBLISH_SCOPES = [
  THREADS_BASIC_SCOPE,
  THREADS_PUBLISH_SCOPE,
] as const

export const THREADS_OPERATIONAL_SCOPES = [
  ...THREADS_PUBLISH_SCOPES,
  THREADS_INSIGHTS_SCOPE,
] as const

export const THREADS_MAX_TEXT_LENGTH = 500

export type ThreadsReplyControl = 'everyone' | 'accounts_you_follow' | 'mentioned_only'

export type ThreadsPostOptions = {
  replyControl: ThreadsReplyControl
  altText: string | null
  explicitConsent: true
}

type RecordValue = Record<string, unknown>

function objectValue(value: unknown): RecordValue {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as RecordValue
    : {}
}

export function createThreadsOAuthNonce(): string {
  return randomBytes(32).toString('base64url')
}

export function threadsOAuthNonceHash(nonce: string): string {
  return createHash('sha256').update(`nexus-threads-oauth:${nonce}`).digest('base64url')
}

export function parseThreadsPostOptions(value: unknown, input?: { hasImage?: boolean }): ThreadsPostOptions {
  const record = objectValue(value)
  if (record.explicitConsent !== true) {
    throw new Error('Threads requires explicit consent before publishing')
  }
  const replyControl = String(record.replyControl || 'everyone') as ThreadsReplyControl
  if (!['everyone', 'accounts_you_follow', 'mentioned_only'].includes(replyControl)) {
    throw new Error('Select a supported Threads reply setting')
  }
  const rawAltText = typeof record.altText === 'string' ? record.altText.trim() : ''
  if (rawAltText && Array.from(rawAltText).length > 1_000) {
    throw new Error('Threads image alt text must not exceed 1,000 characters')
  }
  if (input?.hasImage && !rawAltText) {
    throw new Error('Threads image posts require reviewed alt text')
  }
  return {
    replyControl,
    altText: rawAltText || null,
    explicitConsent: true,
  }
}

function trustedThreadsImage(value: string): void {
  let url: URL
  try { url = new URL(value) } catch { throw new Error('Threads publishing requires a valid permanent image URL') }
  if (
    url.protocol !== 'https:'
    || url.hostname !== 'res.cloudinary.com'
    || !/\/image\/upload\//.test(url.pathname)
  ) {
    throw new Error('Threads publishing requires a reviewed permanent HTTPS Cloudinary image')
  }
}

function providerMessage(data: unknown, fallback: string): string {
  const payload = objectValue(data)
  const nested = objectValue(payload.error)
  const message = nested.message || payload.message || payload.error_description || payload.error
  return message ? `${fallback}: ${String(message).slice(0, 300)}` : fallback
}

async function responseJson(response: Response): Promise<RecordValue> {
  const text = await response.text()
  if (!text) return {}
  try { return objectValue(JSON.parse(text)) } catch { return { message: text.slice(0, 300) } }
}

async function waitForContainer(input: { creationId: string; accessToken: string }): Promise<void> {
  const delays = [0, 250, 500, 1_000, 2_000]
  for (const delay of delays) {
    if (delay > 0) await new Promise(resolve => setTimeout(resolve, delay))
    const statusUrl = new URL(threadsApiUrl(encodeURIComponent(input.creationId)))
    statusUrl.searchParams.set('fields', 'id,status,error_message')
    const response = await fetch(statusUrl, {
      headers: { Authorization: `Bearer ${input.accessToken}` },
      cache: 'no-store',
    })
    const data = await responseJson(response)
    if (!response.ok) {
      throw new Error(providerMessage(data, `Threads container status check failed (HTTP ${response.status})`))
    }
    const status = String(data.status || '').toUpperCase()
    if (status === 'FINISHED') return
    if (status === 'ERROR' || status === 'EXPIRED') {
      throw new Error(providerMessage(data, `Threads container entered ${status}`))
    }
    if (status !== 'IN_PROGRESS') {
      throw new Error(`Threads container returned an unsupported status: ${status || 'missing'}`)
    }
  }
  throw new Error('Threads container is still processing after the publication readiness window (HTTP 425)')
}

export async function createThreadsPost(input: {
  accessToken: string
  text: string
  imageUrl?: string | null
  options: unknown
}): Promise<{ postId: string; platformUrl?: string }> {
  const text = input.text.trim()
  const length = Array.from(text).length
  if (length < 1 || length > THREADS_MAX_TEXT_LENGTH) {
    throw new Error(`Threads text must contain 1 to ${THREADS_MAX_TEXT_LENGTH} characters`)
  }
  const imageUrl = input.imageUrl?.trim() || null
  if (imageUrl) trustedThreadsImage(imageUrl)
  const options = parseThreadsPostOptions(input.options, { hasImage: Boolean(imageUrl) })

  const createBody = new URLSearchParams({
    media_type: imageUrl ? 'IMAGE' : 'TEXT',
    text,
    reply_control: options.replyControl,
  })
  if (imageUrl) createBody.set('image_url', imageUrl)
  if (options.altText) createBody.set('alt_text', options.altText)

  const containerResponse = await fetch(threadsApiUrl('me/threads'), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: createBody,
    cache: 'no-store',
  })
  const containerData = await responseJson(containerResponse)
  const creationId = typeof containerData.id === 'string' ? containerData.id : ''
  if (!containerResponse.ok || !creationId) {
    throw new Error(providerMessage(containerData, `Threads container creation failed (HTTP ${containerResponse.status})`))
  }

  await waitForContainer({ creationId, accessToken: input.accessToken })

  const publishResponse = await fetch(threadsApiUrl('me/threads_publish'), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ creation_id: creationId }),
    cache: 'no-store',
  })
  const publishData = await responseJson(publishResponse)
  const postId = typeof publishData.id === 'string' ? publishData.id : ''
  if (!publishResponse.ok || !postId) {
    throw new Error(providerMessage(publishData, `Threads publish failed (HTTP ${publishResponse.status})`))
  }

  const permalinkResponse = await fetch(threadsApiUrl(`${encodeURIComponent(postId)}?fields=id,permalink`), {
    headers: { Authorization: `Bearer ${input.accessToken}` },
    cache: 'no-store',
  }).catch(() => null)
  if (!permalinkResponse?.ok) return { postId }
  const permalinkData = await responseJson(permalinkResponse)
  const permalink = typeof permalinkData.permalink === 'string' && permalinkData.permalink.startsWith('https://')
    ? permalinkData.permalink
    : undefined
  return { postId, ...(permalink ? { platformUrl: permalink } : {}) }
}
