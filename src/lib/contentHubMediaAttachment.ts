import {
  CONTENT_HUB_UPLOADED_MEDIA_SOURCE,
  deriveContentHubMediaState,
} from './contentHubMediaState'

export { CONTENT_HUB_UPLOADED_MEDIA_SOURCE } from './contentHubMediaState'

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
  key: 'NO_MEDIA' | 'UPLOADED_ASSET' | 'GENERATED_IMAGE' | 'AMBIGUOUS_PREVIEW_PENDING' | 'POST_MEDIA'
  en: string
  ar: string
} {
  const state = deriveContentHubMediaState(input)

  if (state.key === 'no_media') return { key: 'NO_MEDIA', ...state.badgeLabel }
  if (state.key === 'uploaded_ready') return { key: 'UPLOADED_ASSET', ...state.badgeLabel }
  if (state.key === 'generated_ready') return { key: 'GENERATED_IMAGE', ...state.badgeLabel }
  if (state.key === 'ambiguous_preview_pending') {
    return { key: 'AMBIGUOUS_PREVIEW_PENDING', ...state.badgeLabel }
  }
  return { key: 'POST_MEDIA', ...state.badgeLabel }
}
