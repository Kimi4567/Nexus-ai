import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import {
  buildContentDraftTruthPolicyPrompt,
  guardContentDraftText,
  guardContentDraftTruth,
} from '../contentDraftTruthGuard'

describe('contentDraftTruthGuard', () => {
  it('softens luxury and perfection claims in draft captions', () => {
    const luxury = guardContentDraftText('ensuring every coffee break is a moment of luxury')
    expect(luxury).toContain('helping make coffee breaks feel more considered and enjoyable')
    expect(luxury).not.toContain('ensuring every')

    const brew = guardContentDraftText('perfect brew every time')
    expect(brew).toContain('more consistent brew')
    expect(brew).not.toContain('perfect brew every time')
  })

  it('bounds delivery wording to supported availability', () => {
    const doorstep = guardContentDraftText('Fresh coffee delivered to your doorstep.')
    expect(doorstep).toContain('delivery where available')
    expect(doorstep).not.toContain('delivered to your doorstep')

    const quick = guardContentDraftText('quick delivery guaranteed for your office')
    expect(quick).toContain('supported zones')
    expect(quick).not.toContain('guaranteed')
  })

  it('softens always-stocked office claims', () => {
    const out = guardContentDraftText('Ensure your office is always stocked with premium coffee.')

    expect(out).toContain('Help keep your office better stocked with planning support')
    expect(out).not.toContain('Ensure')
    expect(out).not.toContain('always stocked')
  })

  it('rewrites the observed awkward team-planning phrase', () => {
    const out = guardContentDraftText('Support more reliable team planning has access to great coffee.')

    expect(out).toBe('Help teams plan better office coffee routines.')
    expect(out).not.toContain('Support more reliable team planning has access')
  })

  it('preserves safe educational coffee guidance', () => {
    const safe = 'Choose the right grind size for your brewing method.'

    expect(guardContentDraftText(safe)).toBe(safe)
  })

  it('recursively guards generated post fields', () => {
    const guarded = guardContentDraftTruth({
      caption: 'Customer Testimonials: perfect brew every time with quick delivery guaranteed.',
      creative: {
        imagePrompt: 'Show award-winning coffee delivered to your doorstep.',
      },
    })
    const joined = JSON.stringify(guarded)

    expect(joined).toContain('Proof to collect')
    expect(joined).toContain('more consistent brew')
    expect(joined).toContain('supported zones')
    expect(joined).toContain('quality-focused')
    expect(joined).toContain('delivery where available')
    expect(joined).not.toContain('Customer Testimonials')
    expect(joined).not.toContain('quick delivery guaranteed')
    expect(joined).not.toContain('delivered to your doorstep')
  })

  it('documents the draft-only content plan policy', () => {
    const prompt = buildContentDraftTruthPolicyPrompt()

    expect(prompt).toContain('draft content for review only')
    expect(prompt).toContain('Nothing is approved, scheduled, published, or active')
    expect(prompt).toContain('where available')
  })

  it('analytics insight copy no longer says ready to activate for draft campaigns', () => {
    const insightsRoute = readFileSync(
      path.join(process.cwd(), 'src/app/api/analytics/insights/route.ts'),
      'utf8',
    )

    expect(insightsRoute).not.toContain('ready to activate')
    expect(insightsRoute).toContain('review before scheduling')
  })
})
