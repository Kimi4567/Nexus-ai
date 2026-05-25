export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024 // 10MB
export const MAX_VIDEO_SIZE_BYTES = 200 * 1024 * 1024 // 200MB
export const MAX_TOTAL_UPLOAD_BYTES = 250 * 1024 * 1024 // 250MB
export const MAX_VIDEO_DURATION_SECONDS = 300 // placeholder max duration for future validation

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

export function createUploadError(status: number, message: string, code?: string) {
  return { error: message, errorCode: code || 'UPLOAD_ERROR', status }
}
