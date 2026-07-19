import { describe, expect, it } from 'vitest'
import {
  paidStrategyAllowsPlatform,
  resolvePaidStrategyPlatforms,
} from '@/lib/paidStrategyPlatforms'

describe('paid strategy platform truth', () => {
  it('derives executable and planning-only channels from the paid budget mix', () => {
    const truth = resolvePaidStrategyPlatforms({
      aiOutput: {
        strategy: {
          channelMix: [
            { platform: 'Instagram', budgetPercent: 40 },
            { platform: 'TikTok', budgetPercent: 30 },
            { platform: 'Pinterest', budgetPercent: 30 },
            { platform: 'LinkedIn', role: 'organic authority' },
          ],
        },
      },
    })

    expect(truth).toEqual({
      approvedPlatforms: ['META'],
      planningOnlyPlatforms: ['TikTok Ads', 'Pinterest Ads'],
      source: 'paid_channel_mix',
    })
    expect(paidStrategyAllowsPlatform(truth, 'META')).toBe(true)
    expect(paidStrategyAllowsPlatform(truth, 'GOOGLE')).toBe(false)
  })

  it('lets explicit paid planning platforms outrank broad campaign channels', () => {
    expect(resolvePaidStrategyPlatforms({
      aiOutput: {
        strategy: {
          paidPlanning: { platforms: ['LinkedIn Ads'] },
          channelMix: [{ platform: 'Instagram', budgetPercent: 100 }],
        },
      },
      campaignPlatforms: ['TikTok'],
    })).toEqual({
      approvedPlatforms: [],
      planningOnlyPlatforms: ['LinkedIn Ads'],
      source: 'paid_planning',
    })
  })

  it('uses saved campaign platforms only when no paid decision exists', () => {
    expect(resolvePaidStrategyPlatforms({
      aiOutput: { strategy: { positioning: 'Premium' } },
      campaignPlatforms: ['Google Ads', 'Pinterest'],
    })).toEqual({
      approvedPlatforms: ['GOOGLE'],
      planningOnlyPlatforms: ['Pinterest Ads'],
      source: 'campaign_platforms',
    })
  })
})
