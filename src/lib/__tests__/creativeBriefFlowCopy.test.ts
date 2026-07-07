import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const pageSource = readFileSync(
  join(process.cwd(), 'src/app/campaigns/[id]/creative-brief/page.tsx'),
  'utf8',
)

describe('creative brief flow copy', () => {
  it('frames the creative brief as planning and review, not execution', () => {
    expect(pageSource).toContain('مخطط الإبداع')
    expect(pageSource).toContain('تخطيط ومراجعة فقط')
    expect(pageSource).toContain('Planning and review only')
    expect(pageSource).toContain('This page does not publish, schedule, attach post media, or create finished ad assets.')
    expect(pageSource).toContain('Content Hub remains the place to preview final posts')
  })

  it('requires explicit acknowledgement before spending creative brief credits', () => {
    expect(pageSource).toContain('confirmedReviewOnly')
    expect(pageSource).toContain('Confirm before spending credits')
    expect(pageSource).toContain('It will not generate a final image')
    expect(pageSource).toContain('لن يولد صورة نهائية')
  })

  it('localizes generated strategy placeholder values on the Arabic page', () => {
    expect(pageSource).toContain('notIncluded')
    expect(pageSource).toContain('غير مشمول في هذه الخطة')
    expect(pageSource).toContain('notEnoughData')
    expect(pageSource).toContain('لا توجد بيانات كافية بعد')
    expect(pageSource).toContain('assetRequirementText(item)')
  })

  it('removes the old standalone visual-director mode labels from runtime copy', () => {
    expect(pageSource).not.toContain('NEXUS Visual Director')
    expect(pageSource).not.toContain('User Asset Mode')
    expect(pageSource).not.toContain('AI Concept Mode')
    expect(pageSource).not.toContain('Generate Visual Concepts')
    expect(pageSource).not.toContain('Ready-to-use ad copy')
  })
})
