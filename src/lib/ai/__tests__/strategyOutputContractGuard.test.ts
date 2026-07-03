import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { formatStrategyPlatformLabel, guardStrategyOutputContract, selectStrategyCampaignPlatforms } from '../strategyOutputContractGuard'

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
      { label: 'Confirm the conversion path, response owner, and handoff process before turning this strategy into execution.', done: false },
    ])
  })

  it('fills weak readiness checklists with concrete review-safe defaults before persistence', () => {
    const out = guardStrategyOutputContract({
      readinessChecklist: [
        { label: 'Confirm booking handoff', done: true },
      ],
    }, { allowedPlatforms: allowed })

    expect(out.readinessChecklist).toHaveLength(3)
    expect(out.readinessChecklist.every((item: any) => item.done === false)).toBe(true)
    expect(out.readinessChecklist.map((item: any) => item.label)).toEqual([
      'Confirm booking handoff',
      'Confirm the conversion path, response owner, and handoff process before turning this strategy into execution.',
      'Prepare or select real visual assets for the first Content Hub posts before approval or scheduling.',
    ])
  })

  it('fills missing Arabic readiness checklists in the selected strategy language', () => {
    const out = guardStrategyOutputContract({
      readinessChecklist: [],
    }, { allowedPlatforms: allowed, language: 'ar' })

    expect(out.readinessChecklist).toHaveLength(3)
    expect(out.readinessChecklist.every((item: any) => item.done === false)).toBe(true)
    expect(JSON.stringify(out.readinessChecklist)).toMatch(/تأكيد مسار التحويل/)
    expect(JSON.stringify(out.readinessChecklist)).toMatch(/أصول بصرية/)
    expect(JSON.stringify(out.readinessChecklist)).toMatch(/إثباتات موثّقة/)
  })

  it('guards saved strategy display against unsupported platforms and unsupported download CTAs', () => {
    const out = guardStrategyOutputContract({
      contentAnglesDetailed: [
        { title: 'Dashboard Insights', platform: 'LinkedIn', cta: 'Download now' },
      ],
      funnelStages: [
        { stage: 'conversion', platform: 'LinkedIn', cta: 'Download now' },
      ],
      channelMix: [
        { platform: 'LinkedIn', rationale: 'Professional audience' },
        { platform: 'Youtube_shorts', rationale: 'Video education' },
      ],
      weeklyExecutionPlan: [
        { week: 1, platforms: ['LinkedIn', 'youtube_shorts'], deliverables: ['1 LinkedIn post'] },
      ],
    }, { allowedPlatforms: ['FACEBOOK', 'INSTAGRAM', 'YOUTUBE_SHORTS'] })

    expect(JSON.stringify(out)).not.toMatch(/LinkedIn|Download now|Youtube_shorts/)
    expect(out.contentAnglesDetailed[0].platform).toBe('Facebook')
    expect(out.contentAnglesDetailed[0].cta).toBe('Request more information')
    expect(out.funnelStages[0].platform).toBe('Facebook')
    expect(out.funnelStages[0].cta).toBe('Request more information')
    expect(out.channelMix.map((c: any) => c.platform)).toEqual(['Facebook', 'YouTube Shorts'])
    expect(out.weeklyExecutionPlan[0].platforms).toEqual(['Facebook', 'YouTube Shorts'])
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

describe('formatStrategyPlatformLabel', () => {
  it('formats common YouTube Shorts variants for runtime display', () => {
    expect(formatStrategyPlatformLabel('youtube_shorts')).toBe('YouTube Shorts')
    expect(formatStrategyPlatformLabel('Youtube_shorts')).toBe('YouTube Shorts')
    expect(formatStrategyPlatformLabel('youtube shorts')).toBe('YouTube Shorts')
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

    expect(runtimeCopy).toMatch(/Choose strategy type, duration, content intensity, and output language before reviewing cost/i)
    expect(runtimeCopy).toMatch(/اختر نوع الاستراتيجية، المدة، كثافة المحتوى، ولغة المخرجات قبل مراجعة التكلفة/)
    expect(runtimeCopy).toMatch(/Organic post directions for the first 30 days/i)
    expect(runtimeCopy).toMatch(/اتجاهات منشورات عضوية لأول 30 يوم/)
  })

  it('discloses strategy credit cost before the first modal action can continue', () => {
    const i18n = repoFile('src/lib/i18n-context.tsx')
    const modal = repoFile('src/components/RunFullStrategyModal.tsx')

    expect(i18n).toContain("langStartBtn: 'Continue to cost review'")
    expect(i18n).toContain("langStartBtn: 'متابعة لمراجعة التكلفة'")
    expect(i18n).toContain("langSelectTitle: 'Set up strategy request'")
    expect(i18n).toContain("langSelectTitle: 'إعداد طلب الاستراتيجية'")
    expect(i18n).not.toContain("langSelectTitle: 'Choose Strategy Language'")
    expect(modal).toContain('Strategy cost review')
    expect(modal).toContain('No credits are spent here. The next screen shows your balance and final confirmation before generation.')
    expect(modal).toContain('لا يتم خصم أي كريدت هنا')
    expect(modal).toContain('Review cost —')
    expect(modal).not.toContain('{rs.langStartBtn}')
  })

  it('starts strategy generation directly after final cost confirmation without a hidden media step', () => {
    const modal = repoFile('src/components/RunFullStrategyModal.tsx')

    expect(modal).toContain('Cost confirmation is the final user confirmation gate')
    expect(modal).toContain('starts here with no upload, attach, publish, schedule, or ad action')
    expect(modal).not.toContain("'media_check'")
    expect(modal).not.toContain("setPhase('media_check')")
  })
})
