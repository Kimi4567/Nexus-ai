export const YOUTUBE_UPLOAD_SCOPE = 'https://www.googleapis.com/auth/youtube.upload'
export const YOUTUBE_READ_SCOPE = 'https://www.googleapis.com/auth/youtube.readonly'

export type YouTubePrivacyStatus = 'private' | 'unlisted' | 'public'

export type YouTubePostOptions = {
  title: string
  privacyStatus: YouTubePrivacyStatus
  selfDeclaredMadeForKids: boolean
  containsSyntheticMedia: boolean
  notifySubscribers: boolean
  categoryId: string
  explicitConsent: true
}

export type YouTubeVideoStatus = {
  complete: boolean
  failed: boolean
  uploadStatus: string
  processingStatus: string
  privacyStatus: string | null
  reason: string | null
}

const DEFAULT_MAX_UPLOAD_BYTES = 200 * 1024 * 1024

function maxUploadBytes(): number {
  const configured = Number(process.env.YOUTUBE_MAX_UPLOAD_BYTES || DEFAULT_MAX_UPLOAD_BYTES)
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_MAX_UPLOAD_BYTES
}

function trustedCloudinaryVideoUrl(value: string): URL {
  const url = new URL(value)
  if (url.protocol !== 'https:' || url.hostname !== 'res.cloudinary.com') {
    throw new Error('YouTube publishing media must be a permanent HTTPS Cloudinary video')
  }
  return url
}

async function responseData(response: Response): Promise<any> {
  const body = await response.text()
  if (!body) return {}
  try { return JSON.parse(body) } catch { return { error: { message: body.slice(0, 300) } } }
}

function providerError(context: string, status: number, data: any): Error {
  const detail = data?.error?.message || data?.error_description || data?.message || `HTTP ${status}`
  return new Error(`${context}: ${String(detail).slice(0, 300)} (HTTP ${status})`)
}

function uploadSessionUrl(value: string): string {
  const url = new URL(value)
  const allowed = new Set(['www.googleapis.com', 'youtube.googleapis.com', 'upload.youtube.com'])
  if (url.protocol !== 'https:' || !allowed.has(url.hostname)) {
    throw new Error('YouTube returned an invalid resumable upload location')
  }
  return url.toString()
}

export function parseYouTubePostOptions(value: Record<string, unknown> | null | undefined): YouTubePostOptions {
  const raw = value || {}
  if (raw.explicitConsent !== true) throw new Error('YouTube requires explicit consent before uploading')

  const title = typeof raw.title === 'string' ? raw.title.trim().slice(0, 100) : ''
  if (!title) throw new Error('YouTube requires a reviewed video title')

  const privacyStatus = String(raw.privacyStatus || '').toLowerCase()
  if (!['private', 'unlisted', 'public'].includes(privacyStatus)) {
    throw new Error('Select a valid YouTube privacy setting')
  }
  if (typeof raw.selfDeclaredMadeForKids !== 'boolean') {
    throw new Error('Confirm whether the YouTube video is made for kids')
  }
  if (typeof raw.containsSyntheticMedia !== 'boolean') {
    throw new Error('Review the YouTube altered or synthetic media disclosure')
  }

  const categoryId = typeof raw.categoryId === 'string' && /^\d{1,4}$/.test(raw.categoryId)
    ? raw.categoryId
    : '22'

  return {
    title,
    privacyStatus: privacyStatus as YouTubePrivacyStatus,
    selfDeclaredMadeForKids: raw.selfDeclaredMadeForKids,
    containsSyntheticMedia: raw.containsSyntheticMedia,
    notifySubscribers: raw.notifySubscribers === true,
    categoryId,
    explicitConsent: true,
  }
}

export async function uploadYouTubeVideo(input: {
  accessToken: string
  caption: string
  videoUrl: string
  options: YouTubePostOptions
}): Promise<{ videoId: string; platformUrl: string }> {
  trustedCloudinaryVideoUrl(input.videoUrl)

  const source = await fetch(input.videoUrl, {
    cache: 'no-store',
    signal: AbortSignal.timeout(170_000),
  })
  if (!source.ok) throw new Error(`Cloudinary video download failed: HTTP ${source.status}`)
  if (!source.body) throw new Error('Cloudinary video download returned no body')

  const contentType = (source.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()
  if (!contentType.startsWith('video/') && contentType !== 'application/octet-stream') {
    await source.body.cancel().catch(() => {})
    throw new Error('YouTube upload requires a video media asset')
  }
  const contentLength = Number(source.headers.get('content-length') || 0)
  if (!Number.isSafeInteger(contentLength) || contentLength <= 0) {
    await source.body.cancel().catch(() => {})
    throw new Error('Cloudinary must provide the video size before YouTube upload')
  }
  if (contentLength > maxUploadBytes()) {
    await source.body.cancel().catch(() => {})
    throw new Error(`YouTube video exceeds the NEXUS upload safety limit of ${Math.floor(maxUploadBytes() / 1024 / 1024)} MB`)
  }

  const metadata = {
    snippet: {
      title: input.options.title,
      description: input.caption.slice(0, 5_000),
      categoryId: input.options.categoryId,
    },
    status: {
      privacyStatus: input.options.privacyStatus,
      selfDeclaredMadeForKids: input.options.selfDeclaredMadeForKids,
      containsSyntheticMedia: input.options.containsSyntheticMedia,
    },
  }
  const initUrl = new URL('https://www.googleapis.com/upload/youtube/v3/videos')
  initUrl.searchParams.set('uploadType', 'resumable')
  initUrl.searchParams.set('part', 'snippet,status')
  initUrl.searchParams.set('notifySubscribers', String(input.options.notifySubscribers))
  const initResponse = await fetch(initUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Length': String(contentLength),
      'X-Upload-Content-Type': contentType,
    },
    body: JSON.stringify(metadata),
    cache: 'no-store',
  })
  if (!initResponse.ok) {
    await source.body.cancel().catch(() => {})
    throw providerError('YouTube upload initialization failed', initResponse.status, await responseData(initResponse))
  }
  const location = initResponse.headers.get('location')
  if (!location) {
    await source.body.cancel().catch(() => {})
    throw new Error('YouTube upload initialization returned no session location')
  }

  const uploadResponse = await fetch(uploadSessionUrl(location), {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      'Content-Type': contentType,
      'Content-Length': String(contentLength),
    },
    body: source.body,
    duplex: 'half',
    cache: 'no-store',
  } as RequestInit & { duplex: 'half' })
  const uploaded = await responseData(uploadResponse)
  if (!uploadResponse.ok) {
    throw providerError('YouTube video upload failed', uploadResponse.status, uploaded)
  }
  const videoId = typeof uploaded?.id === 'string' ? uploaded.id : ''
  if (!videoId) throw new Error('YouTube accepted the upload without returning a video ID')
  return {
    videoId,
    platformUrl: `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`,
  }
}

export async function fetchYouTubeVideoStatus(accessToken: string, videoId: string): Promise<YouTubeVideoStatus> {
  const url = new URL('https://www.googleapis.com/youtube/v3/videos')
  url.searchParams.set('part', 'status,processingDetails')
  url.searchParams.set('id', videoId)
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  })
  const data = await responseData(response)
  if (!response.ok) throw providerError('YouTube status check failed', response.status, data)
  const video = Array.isArray(data?.items) ? data.items[0] : null
  if (!video) {
    return {
      complete: false,
      failed: true,
      uploadStatus: 'not_found',
      processingStatus: 'unknown',
      privacyStatus: null,
      reason: 'YouTube could not find the uploaded video for this channel',
    }
  }

  const uploadStatus = String(video?.status?.uploadStatus || 'unknown')
  const processingStatus = String(video?.processingDetails?.processingStatus || 'unknown')
  const failed = ['deleted', 'failed', 'rejected'].includes(uploadStatus) || processingStatus === 'failed'
  const complete = !failed && (uploadStatus === 'processed' || processingStatus === 'succeeded')
  const reason = failed
    ? String(
        video?.status?.failureReason
        || video?.status?.rejectionReason
        || video?.processingDetails?.processingFailureReason
        || 'YouTube processing failed',
      )
    : null

  return {
    complete,
    failed,
    uploadStatus,
    processingStatus,
    privacyStatus: typeof video?.status?.privacyStatus === 'string' ? video.status.privacyStatus : null,
    reason,
  }
}
