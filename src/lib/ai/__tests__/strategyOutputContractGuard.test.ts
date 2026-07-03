import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { guardStrategyOutputContract, selectStrategyCampaignPlatforms } from '../strategyOutputContractGuard'

describe('guardStrategyOutputContract', () => {
  const allowed = ['INSTAGRAM', 'TIKTOK', 'FACEBOOK']

  it('removes unsupported channelMix platforms and keeps selected platforms only', () => {
    const out = guardStrategyOutputContract({
      channelMix: [
        { platform: 'Instagram', budgetPercent: 40, rationale: 'main feed', contentFrequency: '4x/week' },
        { platform: 'Pinterest', budgetPercent: 20, rationale: 'boards', contentFrequency: 'daily' },
        { platform: 'TikTok', budgetPercent: 40, rationale: 'video', contentFrequency: '3x/week' },
      ],
    }, { allowedPlatforms: allowed })

    expect(out.channelMix.map((c: any) => c.platform)).toEqual(['Instagram', 'TikTok'])
    expect(JSON.stringify(out)).not.toMatch(/Pinterest/i)
  })

  it('rewrites unsupported platform text in angles and weekly deliverables', () => {
    const out = guardStrategyOutputContract({
      contentAnglesDetailed: [
        { title: 'Pinterest board for design ideas', platform: 'Pinterest', format: 'Blog Post', hook: 'Save this', cta: 'DM us' },
      ],
      weeklyExecutionPlan: [
        { week: 2, deliverables: ['Create Pinterest boards and blog posts'], platforms: ['Pinterest'] },
      ],
    }, { allowedPlatforms: allowed })

    expect(out.contentAnglesDetailed[0].platform).toBe('Instagram')
    expect(out.contentAnglesDetailed[0].format).toBe('Carousel or short social post')
    expect(JSON.stringify(out)).not.toMatch(/Pinterest|Blog Post/i)
    expect(out.weeklyExecutionPlan[0].platforms).toEqual(['Instagram'])
  })

  it('forces generated readiness checklist items to review-safe not-done states', () => {
    const out = guardStrategyOutputContract({
      readinessChecklist: [
        { label: 'Set up WhatsApp consultation process', done: true },
        { label: 'Create content assets', done: false },
      ],
    }, { allowedPlatforms: allowed })

    expect(out.readinessChecklist).toEqual([
      { label: 'Confirm WhatsApp consultation intake process', done: false },
      { label: 'Create content assets', done: false },
    ])
  })
})

describe('selectStrategyCampaignPlatforms', () => {
  it('prefers selected Brand Brain platforms over model-generated channelMix', () => {
    const platforms = selectStrategyCampaignPlatforms({
      channelMix: [{ platform: 'Pinterest' }, { platform: 'LinkedIn' }],
    }, ['INSTAGRAM', 'TIKTOK', 'FACEBOOK'])

    expect(platforms).toEqual(['Instagram', 'TikTok', 'Facebook'])
  })

  it('falls back to strategy channelMix when no selected platforms are available', () => {
    const platforms = selectStrategyCampaignPlatforms({
      channelMix: [{ platform: 'Instagram' }, { platform: 'TikTok' }],
    }, [])

    expect(platforms).toEqual(['Instagram', 'TikTok'])
  })
})

describe('strategy runtime copy contract', () => {
  const repoFile = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

  it('does not imply strategy generation creates final content drafts', () => {
    const i18n = repoFile('src/lib/i18n-context.tsx')
    const modal = repoFile('src/components/RunFullStrategyModal.tsx')
    const runtimeCopy = `${i18n}\n${modal}`

    expect(runtimeCopy).not.toMatch(/strategy output and content will be generated/i)
    expect(runtimeCopy).not.toMatch(/الاستراتيجية والمحتوى بالكامل/)
    expect(runtimeCopy).not.toMatch(/Organic posts \/ month/i)
    expect(runtimeCopy).not.toMatch(/منشورات عضوية شهرياً/)

    expect(runtimeCopy).toMatch(/execution outline will use your selected language/i)
    expect(runtimeCopy).toMatch(/مخطط التنفيذ باللغة اللي تختارها/)
    expect(runtimeCopy).toMatch(/Organic post directions for the first 30 days/i)
    expect(runtimeCopy).toMatch(/اتجاهات منشورات عضوية لأول 30 يوم/)
  })
})
