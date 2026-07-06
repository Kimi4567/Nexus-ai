import { describe, it, expect } from 'vitest'
import {
  derivePlatformReadiness,
  summarizeForStrip,
  type AdAccountReadinessInput,
  type SocialAccount,
  type PlatformState,
} from '@/lib/platformReadiness'

function get(states: PlatformState[], key: string): PlatformState {
  const s = states.find((x) => x.key === key)
  if (!s) throw new Error(`missing platform ${key}`)
  return s
}

const metaWithPageAndIg: SocialAccount = {
  platform: 'META',
  status: 'CONNECTED',
  pages: [{ id: 'p1', name: 'My Page', igAccountId: 'ig1' }],
}
const metaWithPageNoIg: SocialAccount = {
  platform: 'META',
  status: 'CONNECTED',
  pages: [{ id: 'p1', name: 'My Page', igAccountId: null }],
}
const metaNoPage: SocialAccount = { platform: 'META', status: 'CONNECTED', pages: [] }
const metaAdsReady: AdAccountReadinessInput = {
  platform: 'META',
  status: 'ACTIVE',
  platformAccountId: 'act_123',
  pageId: 'page_1',
  hasApiAccess: true,
}

describe('derivePlatformReadiness — honesty rules', () => {
  it('no connected platform → nothing claims ready', () => {
    const s = derivePlatformReadiness([])
    expect(get(s, 'facebook').status).toBe('not_connected')
    expect(get(s, 'instagram').status).toBe('not_connected')
    expect(get(s, 'tiktok').status).toBe('not_connected')
    expect(get(s, 'linkedin').status).toBe('not_connected')
    expect(s.every((x) => x.status !== 'ready')).toBe(true)
  })

  it('Facebook connected WITH page → ready (manual)', () => {
    const s = derivePlatformReadiness([metaWithPageAndIg])
    expect(get(s, 'facebook').status).toBe('ready')
    expect(get(s, 'facebook').tone).toBe('ready')
  })

  it('Facebook connected WITHOUT page → needs_setup (select page)', () => {
    const s = derivePlatformReadiness([metaNoPage])
    expect(get(s, 'facebook').status).toBe('needs_setup')
    expect(get(s, 'facebook').action).toBe('select-page')
  })

  it('Meta connected, NO Instagram business → needs_setup (link instagram)', () => {
    const s = derivePlatformReadiness([metaWithPageNoIg])
    expect(get(s, 'instagram').status).toBe('needs_setup')
    expect(get(s, 'instagram').action).toBe('link-instagram')
  })

  it('Meta connected, Instagram linked → permission_unverified, NEVER ready', () => {
    const s = derivePlatformReadiness([metaWithPageAndIg])
    expect(get(s, 'instagram').status).toBe('permission_unverified')
    expect(get(s, 'instagram').status).not.toBe('ready')
  })

  it('TikTok connected → permission_unverified, never ready', () => {
    const s = derivePlatformReadiness([{ platform: 'TIKTOK', status: 'CONNECTED' }])
    expect(get(s, 'tiktok').status).toBe('permission_unverified')
  })

  it('LinkedIn connected → permission_unverified, never ready', () => {
    const s = derivePlatformReadiness([{ platform: 'LINKEDIN', status: 'CONNECTED' }])
    expect(get(s, 'linkedin').status).toBe('permission_unverified')
  })

  it('YouTube Shorts / Google / Snapchat / WhatsApp → not_available with no CTA', () => {
    const s = derivePlatformReadiness([])
    for (const k of ['youtube', 'google', 'snapchat', 'whatsapp']) {
      expect(get(s, k).status).toBe('not_available')
      expect(get(s, k).action).toBe('none')
      expect(get(s, k).actionKey).toBeNull()
    }
  })

  it('Paid ads without a Meta ad account asks for Meta Ads connection', () => {
    const s = derivePlatformReadiness([metaWithPageAndIg])
    expect(get(s, 'paid').status).toBe('not_connected')
    expect(get(s, 'paid').action).toBe('connect-meta-ads')
  })

  it('Paid ads do not become ready from organic Meta connection alone', () => {
    const s = derivePlatformReadiness([metaWithPageAndIg], [])
    expect(get(s, 'facebook').status).toBe('ready')
    expect(get(s, 'paid').status).not.toBe('ready')
  })

  it('Paid ads with Meta ad account but no API access require permission review', () => {
    const s = derivePlatformReadiness([metaWithPageAndIg], [{ ...metaAdsReady, hasApiAccess: false }])
    expect(get(s, 'paid').status).toBe('permission_unverified')
    expect(get(s, 'paid').action).toBe('open-paid-ads')
  })

  it('Paid ads with Meta ad account but no page identity need setup', () => {
    const s = derivePlatformReadiness([metaWithPageAndIg], [{ ...metaAdsReady, pageId: null }])
    expect(get(s, 'paid').status).toBe('needs_setup')
    expect(get(s, 'paid').action).toBe('open-paid-ads')
  })

  it('Paid ads become ready only for Meta API account with page identity', () => {
    const s = derivePlatformReadiness([metaWithPageAndIg], [metaAdsReady])
    expect(get(s, 'paid').status).toBe('ready')
    expect(get(s, 'paid').action).toBe('open-paid-ads')
  })

  it('only Facebook and Meta paid execution can be ready', () => {
    const s = derivePlatformReadiness([metaWithPageAndIg, { platform: 'TIKTOK', status: 'CONNECTED' }, { platform: 'LINKEDIN', status: 'CONNECTED' }])
    const ready = s.filter((x) => x.status === 'ready').map((x) => x.key)
    expect(ready).toEqual(['facebook'])
  })

  it('Facebook and paid are the only ready states when Meta Ads API prerequisites exist', () => {
    const s = derivePlatformReadiness(
      [metaWithPageAndIg, { platform: 'TIKTOK', status: 'CONNECTED' }, { platform: 'LINKEDIN', status: 'CONNECTED' }],
      [metaAdsReady],
    )
    const ready = s.filter((x) => x.status === 'ready').map((x) => x.key)
    expect(ready).toEqual(['facebook', 'paid'])
  })

  it('null/undefined input does not crash', () => {
    expect(() => derivePlatformReadiness(null)).not.toThrow()
    expect(() => derivePlatformReadiness(undefined)).not.toThrow()
    expect(derivePlatformReadiness(null).length).toBe(9)
  })

  it('summarizeForStrip returns FB, IG, TikTok, LinkedIn, YouTube, Paid in order', () => {
    const s = summarizeForStrip(derivePlatformReadiness([metaWithPageAndIg]))
    expect(s.map((x) => x.key)).toEqual(['facebook', 'instagram', 'tiktok', 'linkedin', 'youtube', 'paid'])
  })
})
