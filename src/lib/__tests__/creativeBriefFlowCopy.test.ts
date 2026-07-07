import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const pageSource = readFileSync(
  join(process.cwd(), 'src/app/campaigns/[id]/creative-brief/page.tsx'),
  'utf8',
)
const campaignRoomSource = readFileSync(
  join(process.cwd(), 'src/app/campaigns/[id]/page.tsx'),
  'utf8',
)
const i18nSource = readFileSync(
  join(process.cwd(), 'src/lib/i18n-context.tsx'),
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

  it('does not call the asset-analysis empty state ready until assets can be selected', () => {
    expect(pageSource).toContain('Waiting for uploaded assets')
    expect(pageSource).toContain('Waiting for asset selection')
    expect(pageSource).toContain('بانتظار رفع الأصول')
    expect(pageSource).toContain('بانتظار اختيار أصل')
    expect(pageSource).toContain('emptyStateTitle')
    expect(pageSource).toContain('emptyStateBody')
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

  it('keeps the Campaign Creative entry aligned with the planner boundary', () => {
    const runtimeSources = `${campaignRoomSource}\n${i18nSource}`

    expect(runtimeSources).toContain('Creative brief planner')
    expect(runtimeSources).toContain('Open creative brief planner')
    expect(runtimeSources).toContain('مخطط الإبداع')
    expect(runtimeSources).toContain('افتح مخطط الإبداع')
    expect(runtimeSources).toContain('Review uploaded assets')
    expect(runtimeSources).toContain('Review-only visual direction')

    expect(runtimeSources).not.toContain('User Asset Mode')
    expect(runtimeSources).not.toContain('AI Concept Mode')
    expect(runtimeSources).not.toContain('View / Update Creative Brief')
    expect(runtimeSources).not.toContain('Create Creative Brief')
    expect(runtimeSources).not.toContain('مخطط الموجز')
    expect(runtimeSources).not.toContain('الموجز الإبداعي')
    expect(runtimeSources).not.toContain('موجز الإبداع')
    expect(runtimeSources).not.toContain('Open brief planner')
  })
})
