import { describe, expect, it } from 'vitest'
import {
  CONTENT_HUB_UPLOADED_MEDIA_SOURCE,
  deriveContentHubMediaState,
  isContentPostMediaReadyForScheduling,
  summarizeContentHubMediaReadiness,
} from '../contentHubMediaState'

describe('Content Hub media readiness state', () => {
  it('uses the same confirmed-media rule as the scheduling gate', () => {
    expect(isContentPostMediaReadyForScheduling({
      imageUrl: null,
      mediaSource: 'GENERATE',
      generationStatus: 'PENDING',
    })).toBe(false)

    expect(isContentPostMediaReadyForScheduling({
      imageUrl: 'https://cdn.example.com/final.jpg',
      mediaSource: 'GENERATE',
      generationStatus: 'DONE',
    })).toBe(true)
  })

  it('treats posts without imageUrl as no media and not ready', () => {
    const state = deriveContentHubMediaState({
      imageUrl: null,
      mediaSource: 'GENERATE',
      generationStatus: 'PENDING',
    })

    expect(state.key).toBe('no_media')
    expect(state.countsAsReady).toBe(false)
    expect(state.needsAttention).toBe(true)
  })

  it('treats generated images with DONE status as confirmed ready', () => {
    const state = deriveContentHubMediaState({
      imageUrl: 'https://cdn.example.com/generated.jpg',
      mediaSource: 'GENERATE',
      generationStatus: 'DONE',
    })

    expect(state.key).toBe('generated_ready')
    expect(state.countsAsReady).toBe(true)
    expect(state.badgeLabel.en).toBe('Generated image')
  })

  it('keeps generated previews with PENDING status visible but not ready', () => {
    const state = deriveContentHubMediaState({
      imageUrl: 'https://cdn.example.com/legacy-preview.jpg',
      uploadedMediaId: null,
      mediaSource: 'GENERATE',
      generationStatus: 'PENDING',
    })

    expect(state.key).toBe('ambiguous_preview_pending')
    expect(state.countsAsReady).toBe(false)
    expect(state.hasPreview).toBe(true)
    expect(state.badgeLabel.en).toBe('Media preview — readiness pending')
  })

  it('treats uploaded media with DONE status as confirmed ready', () => {
    const state = deriveContentHubMediaState({
      imageUrl: 'https://cdn.example.com/uploaded.jpg',
      uploadedMediaId: 'media_1',
      mediaSource: CONTENT_HUB_UPLOADED_MEDIA_SOURCE,
      generationStatus: 'DONE',
    })

    expect(state.key).toBe('uploaded_ready')
    expect(state.countsAsReady).toBe(true)
    expect(state.badgeLabel.en).toBe('Uploaded asset')
  })

  it('does not count unknown-provenance pending previews as ready', () => {
    const state = deriveContentHubMediaState({
      imageUrl: 'https://cdn.example.com/unknown.jpg',
      mediaSource: null,
      generationStatus: 'PENDING',
    })

    expect(state.key).toBe('ambiguous_preview_pending')
    expect(state.countsAsReady).toBe(false)
    expect(state.explanatoryCopy.en).toContain('not counted ready')
  })

  it('counts confirmed media separately from ambiguous previews', () => {
    const summary = summarizeContentHubMediaReadiness([
      {
        imageUrl: 'https://cdn.example.com/generated.jpg',
        mediaSource: 'GENERATE',
        generationStatus: 'DONE',
      },
      {
        imageUrl: 'https://cdn.example.com/preview.jpg',
        mediaSource: 'GENERATE',
        generationStatus: 'PENDING',
      },
      {
        imageUrl: null,
        mediaSource: 'GENERATE',
        generationStatus: 'PENDING',
      },
    ])

    expect(summary.total).toBe(3)
    expect(summary.confirmedReady).toBe(1)
    expect(summary.ambiguousPreviewCount).toBe(1)
    expect(summary.needsAttentionCount).toBe(2)
  })

  it('ignores ambiguous pending previews in ready counts', () => {
    const summary = summarizeContentHubMediaReadiness([
      {
        imageUrl: 'https://cdn.example.com/preview-1.jpg',
        mediaSource: 'GENERATE',
        generationStatus: 'PENDING',
      },
      {
        imageUrl: 'https://cdn.example.com/preview-2.jpg',
        mediaSource: null,
        generationStatus: 'PENDING',
      },
    ])

    expect(summary.confirmedReady).toBe(0)
    expect(summary.ambiguousPreviewCount).toBe(2)
  })
})
