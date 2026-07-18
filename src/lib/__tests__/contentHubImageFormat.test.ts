import { describe, expect, it } from 'vitest'
import {
  isContentHubYouTubeShortsPlatform,
  normalizeContentHubImagePromptForPlatform,
} from '../contentHubImageFormat'
import { platformToFluxAspectRatio, platformToOpenAISize } from '../ai/falGen'

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
    expect(platformToFluxAspectRatio('YOUTUBE')).toBe('9:16')
    expect(platformToFluxAspectRatio('YOUTUBE_SHORTS')).toBe('9:16')
    expect(platformToOpenAISize('YOUTUBE')).toBe('1024x1536')
    expect(platformToOpenAISize('YOUTUBE_SHORTS')).toBe('1024x1536')
  })

  it('maps META feed sources to portrait before the exact 4:5 delivery crop', () => {
    expect(platformToFluxAspectRatio('META')).toBe('4:5')
    expect(platformToOpenAISize('META')).toBe('1024x1536')
  })

  it('maps landscape feeds to the Ultra API 3:2 aspect ratio', () => {
    expect(platformToFluxAspectRatio('LINKEDIN')).toBe('3:2')
    expect(platformToFluxAspectRatio('X')).toBe('3:2')
  })

  it('maps Pinterest Pins to a standard vertical 2:3 creative', () => {
    expect(platformToFluxAspectRatio('PINTEREST')).toBe('2:3')
    expect(platformToOpenAISize('PINTEREST')).toBe('1024x1536')
    expect(normalizeContentHubImagePromptForPlatform('square 1:1 composition; product scene', 'PINTEREST'))
      .toContain('vertical 2:3 composition')
  })
})
