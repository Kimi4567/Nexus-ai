export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024 // 10MB
export const MAX_VIDEO_SIZE_BYTES = 200 * 1024 * 1024 // 200MB
export const MAX_TOTAL_UPLOAD_BYTES = 250 * 1024 * 1024 // 250MB
export const MAX_VIDEO_DURATION_SECONDS = 300 // 5 minutes

export const ALLOWED_IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml', 'image/gif']
export const ALLOWED_VIDEO_MIMES = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-m4v']
export const ALLOWED_UPLOAD_MIMES = [...ALLOWED_IMAGE_MIMES, ...ALLOWED_VIDEO_MIMES]

export type MediaType = 'IMAGE' | 'VIDEO'

export function getMediaTypeFromMime(mimeType: string): MediaType {
  if (ALLOWED_VIDEO_MIMES.includes(mimeType)) return 'VIDEO'
  return 'IMAGE'
}

export function isValidUploadMime(mimeType: string) {
  return ALLOWED_UPLOAD_MIMES.includes(mimeType)
}

export function getSafeFileName(fileName: string, fallbackUuid: string) {
  const sanitized = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
  const ext = sanitized.includes('.') ? sanitized.slice(sanitized.lastIndexOf('.')) : ''
  return `${fallbackUuid}${ext}`
}

export function validateUploadSize(mimeType: string, size: number) {
  if (size > MAX_TOTAL_UPLOAD_BYTES) {
    return { valid: false, message: 'File too large' }
  }
  if (ALLOWED_IMAGE_MIMES.includes(mimeType) && size > MAX_IMAGE_SIZE_BYTES) {
    return { valid: false, message: 'Image file too large' }
  }
  if (ALLOWED_VIDEO_MIMES.includes(mimeType) && size > MAX_VIDEO_SIZE_BYTES) {
    return { valid: false, message: 'Video file too large' }
  }
  return { valid: true }
}

/**
 * Cloudinary may return decimal durations while Prisma stores media metadata as
 * integer seconds. Round duration up so the stored value never understates the
 * real asset length; dimensions are rounded to the nearest whole pixel.
 */
export function normalizeMediaMetric(value: unknown, mode: 'duration' | 'dimension'): number | null {
  const numeric = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(numeric) || numeric <= 0) return null
  return mode === 'duration' ? Math.ceil(numeric) : Math.round(numeric)
}

export function validateVideoDuration(duration: unknown) {
  const normalizedDuration = normalizeMediaMetric(duration, 'duration')
  if (normalizedDuration === null) {
    return { valid: false, message: 'Video duration could not be verified', duration: null }
  }
  if (normalizedDuration > MAX_VIDEO_DURATION_SECONDS) {
    return {
      valid: false,
      message: `Video must be ${MAX_VIDEO_DURATION_SECONDS} seconds or shorter`,
      duration: normalizedDuration,
    }
  }
  return { valid: true, duration: normalizedDuration }
}

export function createUploadError(status: number, message: string, code?: string) {
  return { error: message, errorCode: code || 'UPLOAD_ERROR', status }
}
