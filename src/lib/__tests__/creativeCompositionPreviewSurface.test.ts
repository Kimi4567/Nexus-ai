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
    expect(result.candidate?.outputClassification).toBe('draft_composition_plan')
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
    expect(result.emptyStateCopy.en).toContain('layer blueprint')
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

  it('does not expose attach, upload, save, export, generate, publish, or schedule actions', () => {
    const result = deriveCreativeCompositionPreviewCandidate([generatedDonePost])

    expect(result.candidate?.availableActions).toEqual([])
    const serializedActions = JSON.stringify(result.candidate?.availableActions)
    expect(serializedActions).not.toMatch(/attach|upload|save|export|generate|publish|schedule/i)
  })

  it('classifies the candidate as a review-only composition plan, not final creative', () => {
    const result = deriveCreativeCompositionPreviewCandidate([generatedDonePost])

    expect(result.candidate).toMatchObject({
      outputClassification: 'draft_composition_plan',
      reviewStatus: 'review_only',
      notFinalAdCreative: true,
      notAttachedToPost: true,
      notRenderedOrExported: true,
    })
    expect(result.candidate?.boundaryCopy.en).toContain('Composition plan for review only')
    expect(result.candidate?.boundaryCopy.en).toContain('planning blueprint')
    expect(result.candidate?.boundaryCopy.en).toContain('not a rendered ad')
    expect(result.candidate?.planCopy.en).toContain('not final creative')
    expect(result.candidate?.planCopy.ar).toContain('ليست نسخة نهائية')
  })

  it('does not use ad-ready or final-ad wording', () => {
    const result = deriveCreativeCompositionPreviewCandidate([generatedDonePost])
    const copy = [
      result.candidate?.boundaryCopy.en,
      result.candidate?.boundaryCopy.ar,
      result.candidate?.planCopy.en,
      result.candidate?.planCopy.ar,
    ].join(' ')

    expect(copy).not.toMatch(/ad-ready|platform-ready|final ad preview/i)
    expect(copy).toContain('not attached')
  })
})
