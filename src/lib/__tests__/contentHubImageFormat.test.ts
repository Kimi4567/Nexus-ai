import { describe, expect, it } from 'vitest'
import {
  isContentHubYouTubeShortsPlatform,
  normalizeContentHubImagePromptForPlatform,
} from '../contentHubImageFormat'
import { platformToFluxSize, platformToOpenAISize } from '../ai/falGen'

describe('Content Hub image format normalization', () => {
  it('treats persisted YOUTUBE content-plan posts as YouTube Shorts', () => {
    expect(isContentHubYouTubeShortsPlatform('YOUTUBE')).toBe(true)
    expect(isContentHubYouTubeShortsPlatform('YOUTUBE_SHORTS')).toBe(true)
    expect(isContentHubYouTubeShortsPlatform('LINKEDIN')).toBe(false)
  })

  it('normalizes stale square YouTube prompts to vertical 9:16 before generation', () => {
    const prompt = normalizeContentHubImagePromptForPlatform(
      'square 1:1 composition; clinic operations table with paper notes.',
      'YOUTUBE',
    )

    expect(prompt).toContain('vertical 9:16 composition')
    expect(prompt).not.toContain('square 1:1 composition')
  })

  it('prefixes YouTube prompts that have no explicit composition', () => {
    expect(normalizeContentHubImagePromptForPlatform('clinic workflow review background', 'YOUTUBE'))
      .toBe('vertical 9:16 composition; clinic workflow review background')
  })

  it('preserves non-YouTube prompts', () => {
    expect(normalizeContentHubImagePromptForPlatform('square 1:1 composition; clinic desk.', 'META'))
      .toBe('square 1:1 composition; clinic desk.')
  })

  it('maps YouTube image providers to portrait sizes', () => {
    expect(platformToFluxSize('YOUTUBE')).toBe('portrait_16_9')
    expect(platformToFluxSize('YOUTUBE_SHORTS')).toBe('portrait_16_9')
    expect(platformToOpenAISize('YOUTUBE')).toBe('1024x1536')
    expect(platformToOpenAISize('YOUTUBE_SHORTS')).toBe('1024x1536')
  })

  it('maps Content Hub META feed visuals to the square preview used by the UI', () => {
    expect(platformToFluxSize('META')).toBe('square_hd')
    expect(platformToOpenAISize('META')).toBe('1024x1024')
  })
})
