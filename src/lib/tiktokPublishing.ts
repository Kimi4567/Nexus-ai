const TIKTOK_API = 'https://open.tiktokapis.com'
const MAX_DIRECT_UPLOAD_BYTES = 64 * 1024 * 1024

export type TikTokCreatorInfo = {
  creatorAvatarUrl: string | null
  creatorUsername: string | null
  creatorNickname: string | null
  privacyLevelOptions: string[]
  commentDisabled: boolean
  duetDisabled: boolean
  stitchDisabled: boolean
  maxVideoPostDurationSec: number | null
}

export type TikTokPostOptions = {
  privacyLevel: string
  disableComment: boolean
  disableDuet: boolean
  disableStitch: boolean
  brandContentToggle: boolean
  brandOrganicToggle: boolean
  isAigc: boolean
  explicitConsent: boolean
}

export type TikTokPublishStatus = {
  status: string
  failed: boolean
  complete: boolean
  failReason: string | null
  publicPostIds: string[]
}

function providerMessage(data: any, fallback: string): string {
  return String(data?.error?.message || data?.message || fallback).slice(0, 400)
}

async function readJson(res: Response): Promise<any> {
  const text = await res.text()
  if (!text) return {}
  try { return JSON.parse(text) } catch { return { message: text.slice(0, 400) } }
}

function assertTikTokOk(res: Response, data: any, context: string): void {
  if (!res.ok || (data?.error?.code && data.error.code !== 'ok')) {
    throw new Error(`${context}: ${providerMessage(data, `HTTP ${res.status}`)}`)
  }
}

function bearerHeaders(accessToken: string): Record<string, string> {
  return {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json; charset=UTF-8',
  }
}

export async function queryTikTokCreatorInfo(accessToken: string): Promise<TikTokCreatorInfo> {
  const res = await fetch(`${TIKTOK_API}/v2/post/publish/creator_info/query/`, {
    method: 'POST',
    headers: bearerHeaders(accessToken),
    cache: 'no-store',
  })
  const payload = await readJson(res)
  assertTikTokOk(res, payload, 'TikTok creator information failed')
  const data = payload?.data || {}
  return {
    creatorAvatarUrl: typeof data.creator_avatar_url === 'string' ? data.creator_avatar_url : null,
    creatorUsername: typeof data.creator_username === 'string' ? data.creator_username : null,
    creatorNickname: typeof data.creator_nickname === 'string' ? data.creator_nickname : null,
    privacyLevelOptions: Array.isArray(data.privacy_level_options)
      ? data.privacy_level_options.filter((value: unknown): value is string => typeof value === 'string')
      : [],
    commentDisabled: Boolean(data.comment_disabled),
    duetDisabled: Boolean(data.duet_disabled),
    stitchDisabled: Boolean(data.stitch_disabled),
    maxVideoPostDurationSec: Number.isFinite(Number(data.max_video_post_duration_sec))
      ? Number(data.max_video_post_duration_sec)
      : null,
  }
}

function trustedCloudinaryVideoUrl(value: string): URL {
  const url = new URL(value)
  if (url.protocol !== 'https:' || url.hostname !== 'res.cloudinary.com') {
    throw new Error('TikTok publishing requires a permanent HTTPS Cloudinary video')
  }
  return url
}

async function downloadVideo(url: string): Promise<{ bytes: Uint8Array; contentType: string }> {
  trustedCloudinaryVideoUrl(url)
  const res = await fetch(url, { signal: AbortSignal.timeout(25_000), cache: 'no-store' })
  if (!res.ok) throw new Error(`Cloudinary video download failed: HTTP ${res.status}`)
  const contentType = (res.headers.get('content-type') || '').split(';')[0].toLowerCase()
  if (!['video/mp4', 'video/quicktime', 'video/webm'].includes(contentType)) {
    throw new Error('TikTok direct post supports MP4, MOV, or WebM video media')
  }
  const declared = Number(res.headers.get('content-length') || 0)
  if (declared > MAX_DIRECT_UPLOAD_BYTES) {
    throw new Error('TikTok direct upload is limited to 64 MB in this deployment')
  }
  const reader = res.body?.getReader()
  if (!reader) throw new Error('Video download returned no body')
  const chunks: Uint8Array[] = []
  let total = 0
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    if (!value) continue
    total += value.byteLength
    if (total > MAX_DIRECT_UPLOAD_BYTES) {
      await reader.cancel()
      throw new Error('TikTok direct upload is limited to 64 MB in this deployment')
    }
    chunks.push(value)
  }
  if (total === 0) throw new Error('TikTok video is empty')
  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return { bytes, contentType }
}

function validateOptions(options: TikTokPostOptions, creator: TikTokCreatorInfo): TikTokPostOptions {
  if (!options.explicitConsent) {
    throw new Error('TikTok requires explicit consent before sending this video')
  }
  if (!creator.privacyLevelOptions.includes(options.privacyLevel)) {
    throw new Error('Selected TikTok privacy level is no longer available; review it again')
  }
  return {
    ...options,
    // A creator-level restriction always wins over the saved choice.
    disableComment: creator.commentDisabled || options.disableComment,
    disableDuet: creator.duetDisabled || options.disableDuet,
    disableStitch: creator.stitchDisabled || options.disableStitch,
  }
}

export async function initializeTikTokVideoPost(input: {
  accessToken: string
  caption: string
  videoUrl: string
  options: TikTokPostOptions
}): Promise<{ publishId: string; creator: TikTokCreatorInfo }> {
  const creator = await queryTikTokCreatorInfo(input.accessToken)
  const options = validateOptions(input.options, creator)
  const { bytes, contentType } = await downloadVideo(input.videoUrl)
  const videoSize = bytes.byteLength

  const initRes = await fetch(`${TIKTOK_API}/v2/post/publish/video/init/`, {
    method: 'POST',
    headers: bearerHeaders(input.accessToken),
    body: JSON.stringify({
      post_info: {
        title: input.caption.slice(0, 2200),
        privacy_level: options.privacyLevel,
        disable_comment: options.disableComment,
        disable_duet: options.disableDuet,
        disable_stitch: options.disableStitch,
        brand_content_toggle: options.brandContentToggle,
        brand_organic_toggle: options.brandOrganicToggle,
        is_aigc: options.isAigc,
      },
      source_info: {
        source: 'FILE_UPLOAD',
        video_size: videoSize,
        chunk_size: videoSize,
        total_chunk_count: 1,
      },
    }),
  })
  const payload = await readJson(initRes)
  assertTikTokOk(initRes, payload, 'TikTok post initialization failed')
  const publishId = payload?.data?.publish_id
  const uploadUrl = payload?.data?.upload_url
  if (typeof publishId !== 'string' || typeof uploadUrl !== 'string') {
    throw new Error('TikTok post initialization returned an incomplete upload ticket')
  }

  const body = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(videoSize),
      'Content-Range': `bytes 0-${videoSize - 1}/${videoSize}`,
    },
    body,
  })
  if (![200, 201, 206].includes(uploadRes.status)) {
    const uploadPayload = await readJson(uploadRes)
    throw new Error(`TikTok video upload failed: ${providerMessage(uploadPayload, `HTTP ${uploadRes.status}`)}`)
  }
  return { publishId, creator }
}

export async function fetchTikTokPublishStatus(
  accessToken: string,
  publishId: string,
): Promise<TikTokPublishStatus> {
  const res = await fetch(`${TIKTOK_API}/v2/post/publish/status/fetch/`, {
    method: 'POST',
    headers: bearerHeaders(accessToken),
    body: JSON.stringify({ publish_id: publishId }),
    cache: 'no-store',
  })
  const payload = await readJson(res)
  assertTikTokOk(res, payload, 'TikTok publish status failed')
  const data = payload?.data || {}
  const status = typeof data.status === 'string' ? data.status : 'UNKNOWN'
  const rawIds = data.publicaly_available_post_id || data.publicly_available_post_id || []
  return {
    status,
    failed: status === 'FAILED',
    complete: status === 'PUBLISH_COMPLETE',
    failReason: typeof data.fail_reason === 'string' && data.fail_reason ? data.fail_reason : null,
    publicPostIds: Array.isArray(rawIds) ? rawIds.map(String) : [],
  }
}
