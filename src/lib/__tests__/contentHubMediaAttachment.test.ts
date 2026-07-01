import { describe, expect, it } from 'vitest'
import {
  CONTENT_HUB_UPLOADED_MEDIA_SOURCE,
  deriveMediaDeleteAvailability,
  derivePostMediaSource,
  getMediaAttachmentConfirmationError,
  isMediaAllowedForPost,
  isMediaAttachmentConfirmationComplete,
} from '../contentHubMediaAttachment'

describe('Content Hub media attachment confirmation contract', () => {
  it('requires explicit confirmation before attaching uploaded media', () => {
    expect(isMediaAttachmentConfirmationComplete({ action: 'attach' })).toBe(false)
    expect(isMediaAttachmentConfirmationComplete({
      action: 'attach',
      explicitMediaAttachConfirmed: true,
    })).toBe(true)
    expect(getMediaAttachmentConfirmationError('attach')).toContain('attach confirmation')
  })

  it('requires explicit confirmation before replacing post media', () => {
    expect(isMediaAttachmentConfirmationComplete({ action: 'replace' })).toBe(false)
    expect(isMediaAttachmentConfirmationComplete({
      action: 'replace',
      explicitMediaReplaceConfirmed: true,
    })).toBe(true)
    expect(getMediaAttachmentConfirmationError('replace')).toContain('replace confirmation')
  })

  it('requires explicit confirmation before removing post media', () => {
    expect(isMediaAttachmentConfirmationComplete({ action: 'remove' })).toBe(false)
    expect(isMediaAttachmentConfirmationComplete({
      action: 'remove',
      explicitMediaRemoveConfirmed: true,
    })).toBe(true)
    expect(getMediaAttachmentConfirmationError('remove')).toContain('remove confirmation')
  })
})

describe('Content Hub media ownership contract', () => {
  it('allows workspace-level media with no campaignId', () => {
    expect(isMediaAllowedForPost({
      mediaWorkspaceId: 'workspace_1',
      postWorkspaceId: 'workspace_1',
      mediaCampaignId: null,
      campaignId: 'campaign_1',
    })).toBe(true)
  })

  it('allows media linked to the same campaign', () => {
    expect(isMediaAllowedForPost({
      mediaWorkspaceId: 'workspace_1',
      postWorkspaceId: 'workspace_1',
      mediaCampaignId: 'campaign_1',
      campaignId: 'campaign_1',
    })).toBe(true)
  })

  it('rejects media from another workspace', () => {
    expect(isMediaAllowedForPost({
      mediaWorkspaceId: 'workspace_2',
      postWorkspaceId: 'workspace_1',
      mediaCampaignId: null,
      campaignId: 'campaign_1',
    })).toBe(false)
  })

  it('rejects campaign-specific media from another campaign', () => {
    expect(isMediaAllowedForPost({
      mediaWorkspaceId: 'workspace_1',
      postWorkspaceId: 'workspace_1',
      mediaCampaignId: 'campaign_2',
      campaignId: 'campaign_1',
    })).toBe(false)
  })
})

describe('Content Hub media delete protection', () => {
  it('blocks deletion when media is linked to SocialPosts', () => {
    const result = deriveMediaDeleteAvailability(2)

    expect(result.canDelete).toBe(false)
    expect(result.reason).toBe('LINKED_TO_POSTS')
    expect(result.message).toBe('This media is used by one or more posts. Remove it from those posts before deleting.')
  })

  it('allows deletion when media is not linked to SocialPosts', () => {
    expect(deriveMediaDeleteAvailability(0)).toEqual({ canDelete: true, reason: 'READY' })
  })
})

describe('Content Hub media source labels', () => {
  it('labels missing media as no media', () => {
    expect(derivePostMediaSource({ imageUrl: null }).en).toBe('No media')
  })

  it('labels uploaded media as uploaded asset', () => {
    expect(derivePostMediaSource({
      imageUrl: 'https://cdn.example.com/upload.jpg',
      uploadedMediaId: 'media_1',
      mediaSource: CONTENT_HUB_UPLOADED_MEDIA_SOURCE,
      generationStatus: 'DONE',
    }).en).toBe('Uploaded asset')
  })

  it('labels generated post images as generated image', () => {
    expect(derivePostMediaSource({
      imageUrl: 'https://cdn.example.com/generated.jpg',
      mediaSource: 'GENERATE',
      generationStatus: 'DONE',
    }).en).toBe('Generated image')
  })
})
