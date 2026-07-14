import { describe, expect, it } from 'vitest'
import {
  deriveCreativePlatformFormat,
  derivePostCreativeRequirement,
  summarizeCreativeRequirements,
} from '../creativeRequirements'
import { CONTENT_HUB_UPLOADED_MEDIA_SOURCE } from '../contentHubMediaState'

describe('post-aware creative requirements', () => {
  it('marks a post without imageUrl as media_needed', () => {
    const requirement = derivePostCreativeRequirement({
      postId: 'post_1',
      platform: 'INSTAGRAM',
      caption: 'Ask the office what roast they prefer this week.',
      mediaSource: 'GENERATE',
      generationStatus: 'PENDING',
      imageUrl: null,
    })

    expect(requirement.status).toBe('media_needed')
    expect(requirement.statusLabel).toBe('Needs post media')
    expect(requirement.countsAsMediaPresent).toBe(false)
  })

  it('keeps imageUrl with PENDING readiness as preview-needs-confirmation, not final', () => {
    const requirement = derivePostCreativeRequirement({
      postId: 'post_2',
      platform: 'META',
      caption: 'A calmer way to plan the office coffee shelf.',
      mediaSource: 'GENERATE',
      generationStatus: 'PENDING',
      imageUrl: 'https://cdn.example.com/legacy-preview.jpg',
    })

    expect(requirement.status).toBe('media_preview_needs_confirmation')
    expect(requirement.countsAsMediaPresent).toBe(true)
    expect(`${requirement.statusLabel} ${requirement.explanation}`).not.toMatch(/final creative|ad-ready/i)
  })

  it('marks generated media with DONE status as attached to the post', () => {
    const requirement = derivePostCreativeRequirement({
      postId: 'post_3',
      platform: 'LINKEDIN',
      caption: 'Support office pantry planning with a consistent coffee option.',
      mediaSource: 'GENERATE',
      generationStatus: 'DONE',
      imageUrl: 'https://cdn.example.com/generated.jpg',
    })

    expect(requirement.status).toBe('attached_to_post')
    expect(requirement.requiredAssetType).toBe('generated_background')
    expect(requirement.countsAsMediaPresent).toBe(true)
  })

  it('marks confirmed uploaded media as attached to the post', () => {
    const requirement = derivePostCreativeRequirement({
      postId: 'post_4',
      platform: 'FACEBOOK',
      caption: 'Show the roast bag next to the office coffee setup.',
      uploadedMediaId: 'media_1',
      mediaSource: CONTENT_HUB_UPLOADED_MEDIA_SOURCE,
      generationStatus: 'DONE',
      imageUrl: 'https://cdn.example.com/uploaded.jpg',
    })

    expect(requirement.status).toBe('attached_to_post')
    expect(requirement.requiredAssetType).toBe('uploaded_asset')
    expect(requirement.sourcePreference).toBe('uploaded')
  })

  it('maps platform defaults to stable aspect ratios', () => {
    expect(deriveCreativePlatformFormat('INSTAGRAM')).toMatchObject({ aspectRatio: '4:5' })
    expect(deriveCreativePlatformFormat('META')).toMatchObject({ aspectRatio: '4:5' })
    expect(deriveCreativePlatformFormat('LINKEDIN')).toMatchObject({ aspectRatio: '1.91:1' })
    expect(deriveCreativePlatformFormat('TIKTOK')).toMatchObject({ aspectRatio: '9:16' })
    expect(deriveCreativePlatformFormat('YOUTUBE')).toMatchObject({ aspectRatio: '9:16' })
    expect(deriveCreativePlatformFormat('YOUTUBE_SHORTS')).toMatchObject({ aspectRatio: '9:16' })
    expect(deriveCreativePlatformFormat('PINTEREST')).toMatchObject({ format: 'Pinterest standard image Pin', aspectRatio: '2:3' })
    expect(deriveCreativePlatformFormat('UNKNOWN')).toMatchObject({ aspectRatio: '1:1' })
  })

  it('derives generated, uploaded, and either source preference deterministically', () => {
    expect(derivePostCreativeRequirement({
      postId: 'generated',
      platform: 'INSTAGRAM',
      mediaSource: 'GENERATE',
      generationStatus: 'PENDING',
      imageUrl: null,
    }).sourcePreference).toBe('generated')

    expect(derivePostCreativeRequirement({
      postId: 'uploaded',
      platform: 'INSTAGRAM',
      uploadedMediaId: 'media_2',
      mediaSource: 'UPLOAD_RAW',
      generationStatus: 'DONE',
      imageUrl: 'https://cdn.example.com/uploaded.jpg',
    }).sourcePreference).toBe('uploaded')

    expect(derivePostCreativeRequirement({
      postId: 'either',
      platform: 'INSTAGRAM',
      mediaSource: 'MIXED',
      generationStatus: 'PENDING',
      imageUrl: null,
    }).sourcePreference).toBe('either')
  })

  it('keeps requirement copy away from final/ad-ready/guaranteed/winning language', () => {
    const requirement = derivePostCreativeRequirement({
      postId: 'safe_copy',
      platform: 'META',
      caption: 'Help teams choose coffee for next week.',
      mediaSource: 'GENERATE',
      generationStatus: 'PENDING',
      imageUrl: null,
    })
    const copy = [
      requirement.statusLabel,
      requirement.explanation,
      requirement.visualConcept,
      ...requirement.proofConstraints,
    ].join(' ')

    expect(copy).not.toMatch(/final ad|final creative|ad-ready|guaranteed|winning|best-performing|high-conversion/i)
  })

  it('does not automatically mark a published/manual post with ambiguous media as final creative', () => {
    const requirement = derivePostCreativeRequirement({
      postId: 'manual_published',
      platform: 'META',
      status: 'PUBLISHED',
      mediaSource: 'GENERATE',
      generationStatus: 'PENDING',
      imageUrl: 'https://cdn.example.com/ambiguous.jpg',
    })

    expect(requirement.status).toBe('media_preview_needs_confirmation')
    expect(requirement.status).not.toBe('approved_for_publish')
  })

  it('summarizes media-needed, readiness-pending, and attached requirements', () => {
    const summary = summarizeCreativeRequirements([
      { postId: 'a', platform: 'META', imageUrl: null, generationStatus: 'PENDING', mediaSource: 'GENERATE' },
      { postId: 'b', platform: 'META', imageUrl: 'https://cdn.example.com/b.jpg', generationStatus: 'PENDING', mediaSource: 'GENERATE' },
      { postId: 'c', platform: 'META', imageUrl: 'https://cdn.example.com/c.jpg', generationStatus: 'DONE', mediaSource: 'GENERATE' },
    ])

    expect(summary).toEqual({
      total: 3,
      mediaNeeded: 1,
      readinessPending: 1,
      attachedToPost: 1,
    })
  })
})
