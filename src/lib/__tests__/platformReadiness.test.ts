import { describe, it, expect } from 'vitest'
import {
  derivePlatformReadiness,
  summarizeForStrip,
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

  it('Google / Snapchat / WhatsApp → not_available with no CTA', () => {
    const s = derivePlatformReadiness([])
    for (const k of ['google', 'snapchat', 'whatsapp']) {
      expect(get(s, k).status).toBe('not_available')
      expect(get(s, k).action).toBe('none')
      expect(get(s, k).actionKey).toBeNull()
    }
  })

  it('Paid ads → always planning_only with no execution CTA', () => {
    const s = derivePlatformReadiness([metaWithPageAndIg])
    expect(get(s, 'paid').status).toBe('planning_only')
    expect(get(s, 'paid').action).toBe('none')
  })

  it('only Facebook can ever be ready', () => {
    const s = derivePlatformReadiness([metaWithPageAndIg, { platform: 'TIKTOK', status: 'CONNECTED' }, { platform: 'LINKEDIN', status: 'CONNECTED' }])
    const ready = s.filter((x) => x.status === 'ready').map((x) => x.key)
    expect(ready).toEqual(['facebook'])
  })

  it('null/undefined input does not crash', () => {
    expect(() => derivePlatformReadiness(null)).not.toThrow()
    expect(() => derivePlatformReadiness(undefined)).not.toThrow()
    expect(derivePlatformReadiness(null).length).toBe(8)
  })

  it('summarizeForStrip returns FB, IG, TikTok, LinkedIn, Paid in order', () => {
    const s = summarizeForStrip(derivePlatformReadiness([metaWithPageAndIg]))
    expect(s.map((x) => x.key)).toEqual(['facebook', 'instagram', 'tiktok', 'linkedin', 'paid'])
  })
})
