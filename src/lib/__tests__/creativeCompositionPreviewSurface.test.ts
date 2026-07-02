import { describe, expect, it } from 'vitest'

import { deriveCreativeCompositionPreviewCandidate } from '../creativeCompositionPreviewSurface'

const generatedDonePost = {
  id: 'post-3',
  platform: 'LINKEDIN',
  caption: 'Make office coffee breaks easier with a more consistent option.',
  imageUrl: 'https://cdn.example.com/post-3-background.png',
  mediaSource: 'GENERATE',
  generationStatus: 'DONE',
  uploadedMediaId: null,
}

describe('deriveCreativeCompositionPreviewCandidate', () => {
  it('selects a generated DONE candidate', () => {
    const result = deriveCreativeCompositionPreviewCandidate([
      {
        id: 'post-1',
        imageUrl: null,
        mediaSource: null,
        generationStatus: null,
      },
      generatedDonePost,
    ])

    expect(result.candidate?.post.id).toBe('post-3')
    expect(result.candidate?.mediaStateKey).toBe('generated_ready')
    expect(result.candidate?.backgroundSource).toBe('generated_background')
  })

  it('excludes imageUrl plus PENDING preview candidates', () => {
    const result = deriveCreativeCompositionPreviewCandidate([
      {
        id: 'post-1',
        imageUrl: 'https://cdn.example.com/legacy-preview.png',
        mediaSource: 'GENERATE',
        generationStatus: 'PENDING',
      },
    ])

    expect(result.candidate).toBeNull()
    expect(result.emptyStateCopy.en).toContain('confirmed post background')
  })

  it('returns an empty state when no confirmed background exists', () => {
    const result = deriveCreativeCompositionPreviewCandidate([
      { id: 'post-1', imageUrl: null },
      {
        id: 'post-2',
        imageUrl: 'https://cdn.example.com/legacy-preview.png',
        generationStatus: 'FAILED',
      },
    ])

    expect(result.candidate).toBeNull()
    expect(result.emptyStateCopy.ar).toContain('خلفية منشور مؤكدة')
  })

  it('does not expose attach, upload, or save actions', () => {
    const result = deriveCreativeCompositionPreviewCandidate([generatedDonePost])

    expect(result.candidate?.availableActions).toEqual([])
    expect(result.candidate?.availableActions).not.toContain('attach')
    expect(result.candidate?.availableActions).not.toContain('upload')
    expect(result.candidate?.availableActions).not.toContain('save')
  })

  it('classifies the candidate as draft and review-only, not final ad creative', () => {
    const result = deriveCreativeCompositionPreviewCandidate([generatedDonePost])

    expect(result.candidate).toMatchObject({
      outputClassification: 'draft_composition_preview',
      reviewStatus: 'review_only',
      notFinalAdCreative: true,
      notAttachedToPost: true,
    })
    expect(result.candidate?.boundaryCopy.en).toContain('Review-only draft composition preview')
    expect(result.candidate?.boundaryCopy.en).toContain('not final ad creative')
  })
})
