export const CONTENT_HUB_UPLOADED_MEDIA_SOURCE = 'UPLOAD_RAW'

export type MediaAttachmentAction = 'attach' | 'replace' | 'remove'

export type MediaAttachmentConfirmationInput = {
  action: MediaAttachmentAction
  explicitMediaAttachConfirmed?: unknown
  explicitMediaReplaceConfirmed?: unknown
  explicitMediaRemoveConfirmed?: unknown
}

export type MediaOwnershipInput = {
  mediaWorkspaceId: string
  postWorkspaceId: string
  mediaCampaignId?: string | null
  campaignId: string
}

export type PostMediaSourceInput = {
  imageUrl?: string | null
  uploadedMediaId?: string | null
  mediaSource?: string | null
  generationStatus?: string | null
}

export function isMediaAttachmentConfirmationComplete(input: MediaAttachmentConfirmationInput): boolean {
  if (input.action === 'remove') return input.explicitMediaRemoveConfirmed === true
  if (input.action === 'replace') {
    return input.explicitMediaReplaceConfirmed === true || input.explicitMediaAttachConfirmed === true
  }
  return input.explicitMediaAttachConfirmed === true
}

export function getMediaAttachmentConfirmationError(action: MediaAttachmentAction): string {
  if (action === 'remove') return 'Explicit media remove confirmation is required.'
  if (action === 'replace') return 'Explicit media replace confirmation is required.'
  return 'Explicit media attach confirmation is required.'
}

export function isMediaAllowedForPost(input: MediaOwnershipInput): boolean {
  if (input.mediaWorkspaceId !== input.postWorkspaceId) return false
  if (input.mediaCampaignId && input.mediaCampaignId !== input.campaignId) return false
  return true
}

export function deriveMediaDeleteAvailability(linkedPostCount: number): {
  canDelete: boolean
  reason: 'READY' | 'LINKED_TO_POSTS'
  message?: string
} {
  if (linkedPostCount > 0) {
    return {
      canDelete: false,
      reason: 'LINKED_TO_POSTS',
      message: 'This media is used by one or more posts. Remove it from those posts before deleting.',
    }
  }

  return { canDelete: true, reason: 'READY' }
}

export function derivePostMediaSource(input: PostMediaSourceInput): {
  key: 'NO_MEDIA' | 'UPLOADED_ASSET' | 'GENERATED_IMAGE' | 'POST_MEDIA'
  en: string
  ar: string
} {
  if (!input.imageUrl) return { key: 'NO_MEDIA', en: 'No media', ar: 'لا توجد وسائط' }

  if (input.uploadedMediaId || input.mediaSource === CONTENT_HUB_UPLOADED_MEDIA_SOURCE || input.mediaSource === 'UPLOAD') {
    return { key: 'UPLOADED_ASSET', en: 'Uploaded asset', ar: 'أصل مرفوع' }
  }

  if (input.mediaSource === 'GENERATE' && input.generationStatus === 'DONE') {
    return { key: 'GENERATED_IMAGE', en: 'Generated image', ar: 'صورة مولّدة' }
  }

  return { key: 'POST_MEDIA', en: 'Post media', ar: 'وسائط المنشور' }
}
