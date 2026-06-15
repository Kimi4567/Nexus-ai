import { describe, it, expect } from 'vitest'
import {
  deriveCampaignProofOfWork,
  type ProofPostInput,
  type ProofCampaignInput,
} from '@/lib/campaignProofOfWork'

const post = (over: Partial<ProofPostInput>): ProofPostInput => ({ id: Math.random().toString(36).slice(2), ...over })

describe('deriveCampaignProofOfWork — strategy & content plan', () => {
  it('strategy exists → Strategy created (Done)', () => {
    const r = deriveCampaignProofOfWork({ strategy: { positioning: 'x' } }, [])
    expect(r.groups.strategy).toHaveLength(1)
    expect(r.groups.strategy[0].titleKey).toBe('campaign.proof.item.strategyCreated')
    expect(r.groups.strategy[0].status).toBe('done')
  })

  it('empty/absent strategy → no Strategy item', () => {
    expect(deriveCampaignProofOfWork({ strategy: {} }, []).groups.strategy).toHaveLength(0)
    expect(deriveCampaignProofOfWork({ strategy: '' }, []).groups.strategy).toHaveLength(0)
    expect(deriveCampaignProofOfWork(null, []).groups.strategy).toHaveLength(0)
  })

  it('reads strategy from aiOutput.strategy too', () => {
    const r = deriveCampaignProofOfWork({ aiOutput: { strategy: { a: 1 } } }, [])
    expect(r.groups.strategy).toHaveLength(1)
  })

  it('posts exist → Content plan created with count', () => {
    const r = deriveCampaignProofOfWork(null, [post({ status: 'DRAFT' }), post({ status: 'DRAFT' })])
    const item = r.groups.content.find((i) => i.titleKey === 'campaign.proof.item.contentPlanCreated')
    expect(item).toBeTruthy()
    expect(item!.count).toBe(2)
    expect(item!.status).toBe('done')
  })
})

describe('deriveCampaignProofOfWork — per-status honesty', () => {
  it('approved post → Needs review, NOT scheduled/published', () => {
    const r = deriveCampaignProofOfWork(null, [post({ status: 'APPROVED' })])
    const approved = r.groups.content.find((i) => i.titleKey === 'campaign.proof.item.approved')
    expect(approved).toBeTruthy()
    expect(approved!.status).toBe('needs_review')
    expect(r.items.some((i) => i.status === 'scheduled')).toBe(false)
    expect(r.items.some((i) => i.status === 'published')).toBe(false)
  })

  it('scheduled post → Scheduled, NOT published', () => {
    const r = deriveCampaignProofOfWork(null, [post({ status: 'SCHEDULED', scheduledAt: '2026-07-01T10:00:00Z' })])
    const sched = r.groups.publishing.find((i) => i.status === 'scheduled')
    expect(sched).toBeTruthy()
    expect(sched!.titleKey).toBe('campaign.proof.item.scheduled')
    expect(r.items.some((i) => i.status === 'published')).toBe(false)
  })

  it('published + MANUAL → Published + Manual, with view link when URL valid', () => {
    const r = deriveCampaignProofOfWork(null, [post({ status: 'PUBLISHED', publishMode: 'MANUAL', platform: 'META', platformUrl: 'https://facebook.com/p/1', manuallyPublishedAt: '2026-06-10T09:00:00Z' })])
    const pub = r.groups.publishing.find((i) => i.status === 'published')!
    expect(pub.mode).toBe('manual')
    expect(pub.titleKey).toBe('campaign.proof.item.publishedManual')
    expect(pub.modeKey).toBe('campaign.proof.mode.manual')
    expect(pub.canViewPost).toBe(true)
    expect(pub.platformUrl).toBe('https://facebook.com/p/1')
    expect(pub.at).toBe('2026-06-10T09:00:00Z')
  })

  it('published + AUTO → Published + Auto (only when publishMode is AUTO)', () => {
    const r = deriveCampaignProofOfWork(null, [post({ status: 'PUBLISHED', publishMode: 'AUTO', platform: 'META', platformUrl: 'https://facebook.com/p/2' })])
    const pub = r.groups.publishing.find((i) => i.status === 'published')!
    expect(pub.mode).toBe('auto')
    expect(pub.titleKey).toBe('campaign.proof.item.publishedAuto')
    expect(pub.modeKey).toBe('campaign.proof.mode.auto')
  })

  it('published with no/again publishMode defaults to MANUAL (never fake auto)', () => {
    const r = deriveCampaignProofOfWork(null, [post({ status: 'PUBLISHED', platform: 'META' })])
    expect(r.groups.publishing.find((i) => i.status === 'published')!.mode).toBe('manual')
  })

  it('published with invalid/no URL → no view link', () => {
    const r = deriveCampaignProofOfWork(null, [post({ status: 'PUBLISHED', publishMode: 'MANUAL', platformUrl: 'not-a-url' })])
    const pub = r.groups.publishing.find((i) => i.status === 'published')!
    expect(pub.canViewPost).toBe(false)
    expect(pub.platformUrl).toBeNull()
  })
})

describe('deriveCampaignProofOfWork — failures (no fabricated reason)', () => {
  it('failed WITH errorMessage → Failed item carrying the stored reason', () => {
    const r = deriveCampaignProofOfWork(null, [post({ status: 'FAILED', errorMessage: 'Token expired' })])
    const failed = r.groups.publishing.find((i) => i.status === 'failed')
    expect(failed).toBeTruthy()
    expect(failed!.errorMessage).toBe('Token expired')
    expect(failed!.titleKey).toBe('campaign.proof.item.failed')
  })

  it('failed WITHOUT errorMessage → NOT shown (never fabricate)', () => {
    const r = deriveCampaignProofOfWork(null, [post({ status: 'FAILED', errorMessage: '' }), post({ status: 'FAILED' })])
    expect(r.items.some((i) => i.status === 'failed')).toBe(false)
  })
})

describe('deriveCampaignProofOfWork — exclusions & empty', () => {
  it('DRAFT/generated posts are NOT shown as completed proof', () => {
    const r = deriveCampaignProofOfWork(null, [post({ status: 'DRAFT' }), post({ status: 'DRAFT' })])
    // only the "content plan created" aggregate appears; no per-draft completed item
    expect(r.items.every((i) => i.status !== 'published' && i.status !== 'scheduled' && i.status !== 'needs_review')).toBe(true)
  })

  it('zero data → empty', () => {
    const r = deriveCampaignProofOfWork(null, [])
    expect(r.isEmpty).toBe(true)
    expect(r.items).toHaveLength(0)
  })

  it('never produces an analytics item', () => {
    const r = deriveCampaignProofOfWork({ strategy: { a: 1 } }, [
      post({ status: 'PUBLISHED', publishMode: 'AUTO', platformUrl: 'https://x.com/p' }),
      post({ status: 'APPROVED' }),
    ])
    expect(r.items.some((i) => /analytic/i.test(i.titleKey))).toBe(false)
  })

  it('mixed campaign groups items correctly', () => {
    const r = deriveCampaignProofOfWork({ strategy: { a: 1 } }, [
      post({ status: 'APPROVED' }),
      post({ status: 'SCHEDULED', scheduledAt: '2026-07-01T10:00:00Z' }),
      post({ status: 'PUBLISHED', publishMode: 'MANUAL', platform: 'META', platformUrl: 'https://facebook.com/p/9' }),
      post({ status: 'FAILED', errorMessage: 'rate limited' }),
      post({ status: 'DRAFT' }),
    ])
    expect(r.groups.strategy).toHaveLength(1)
    expect(r.groups.content.length).toBe(2) // plan created + approved(1)
    expect(r.groups.publishing.length).toBe(3) // scheduled(1) + published(1) + failed(1)
    expect(r.isEmpty).toBe(false)
  })
})
