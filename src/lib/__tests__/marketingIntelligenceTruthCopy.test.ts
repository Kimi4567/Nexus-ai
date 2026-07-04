import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const intelligenceSource = readFileSync(
  resolve(process.cwd(), 'src/lib/marketing-intelligence.ts'),
  'utf8',
)

const dashboardRouteSource = readFileSync(
  resolve(process.cwd(), 'src/app/api/dashboard/intelligence/route.ts'),
  'utf8',
)

describe('marketing intelligence truth copy', () => {
  it('frames first strategy as planning before execution, not campaign launch', () => {
    expect(intelligenceSource).toContain('organic content direction and paid planning before any execution step')
    expect(intelligenceSource).toContain('قبل أي خطوة تنفيذ')

    expect(intelligenceSource).not.toContain('before any campaign is launched')
    expect(intelligenceSource).not.toContain('قبل إطلاق أي حملة')
  })

  it('keeps content and learning copy analytics-gated', () => {
    expect(intelligenceSource).toContain('publishing decisions and analytics-backed learning are possible')
    expect(intelligenceSource).toContain('performance learning needs real analytics data')
    expect(intelligenceSource).toContain('إشارات سير عمل')
    expect(intelligenceSource).toContain('بيانات تحليلات حقيقية')

    expect(intelligenceSource).not.toContain('analytics-backed learning can start')
    expect(intelligenceSource).not.toContain('يمكن للمحتوى المنشور أن يغذي Brand Brain')
  })

  it('does not describe campaign management as active or autonomous when proof is incomplete', () => {
    expect(intelligenceSource).toContain('No campaign in ongoing management')
    expect(intelligenceSource).toContain('The core loop has evidence')
    expect(intelligenceSource).toContain('before it becomes more dependable')

    expect(intelligenceSource).not.toContain('No active campaigns')
    expect(intelligenceSource).not.toContain('currently marked active')
    expect(intelligenceSource).not.toContain('The core loop is active')
    expect(intelligenceSource).not.toContain('to become autonomous')
  })

  it('maps create-first-strategy suggestions to strategist strategy work, not campaign launch', () => {
    expect(dashboardRouteSource).toContain("case 'create-first-strategy':")
    expect(dashboardRouteSource).toContain("return { agent: 'STRATEGIST', type: 'STRATEGY', priority: 1 }")
    expect(dashboardRouteSource).not.toContain("return { agent: 'STRATEGIST', type: 'CAMPAIGN_LAUNCH', priority: 1 }")
  })
})
