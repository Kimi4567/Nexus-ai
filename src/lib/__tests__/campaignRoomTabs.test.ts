import { describe, expect, it } from 'vitest'
import {
  campaignRoomTabIndexFromQuery,
  campaignRoomTabKeyFromIndex,
  normalizeCampaignRoomTab,
} from '../campaignRoomTabs'

describe('campaignRoomTabs', () => {
  it.each([
    ['strategy', 'strategy', 0],
    ['content', 'content', 1],
    ['calendar', 'calendar', 2],
    ['creative', 'creative', 3],
    ['visuals', 'creative', 3],
    ['publish', 'publish', 4],
    ['autopilot', 'autopilot', 5],
    ['performance', 'performance', 6],
    ['analytics', 'performance', 6],
    ['results', 'performance', 6],
  ] as const)('maps ?tab=%s to %s', (query, expected, index) => {
    expect(normalizeCampaignRoomTab(query)).toBe(expected)
    expect(campaignRoomTabIndexFromQuery(query)).toBe(index)
  })

  it('falls back unknown or empty tab values to strategy', () => {
    expect(normalizeCampaignRoomTab('unknown')).toBe('strategy')
    expect(normalizeCampaignRoomTab('')).toBe('strategy')
    expect(normalizeCampaignRoomTab(null)).toBe('strategy')
    expect(campaignRoomTabIndexFromQuery('unknown')).toBe(0)
  })

  it('maps visible tab indices back to canonical query keys', () => {
    expect(campaignRoomTabKeyFromIndex(0)).toBe('strategy')
    expect(campaignRoomTabKeyFromIndex(3)).toBe('creative')
    expect(campaignRoomTabKeyFromIndex(6)).toBe('performance')
    expect(campaignRoomTabKeyFromIndex(99)).toBe('strategy')
  })
})
