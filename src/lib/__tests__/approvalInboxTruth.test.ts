import { describe, expect, it } from 'vitest'
import {
  actionableApprovalSuggestions,
  isLegacyStrategySuggestion,
  liveApprovalQueue,
} from '@/lib/approvalInboxTruth'

describe('approval inbox truth', () => {
  it('never exposes a legacy strategy notification as an approval action', () => {
    expect(isLegacyStrategySuggestion({ type: 'STRATEGY' })).toBe(true)
    expect(actionableApprovalSuggestions([
      { id: 'old', type: 'STRATEGY' },
      { id: 'pause', type: 'CAMPAIGN_PAUSE' },
    ])).toEqual([{ id: 'pause', type: 'CAMPAIGN_PAUSE' }])
  })

  it('counts only live queue entries that truly require approval', () => {
    expect(liveApprovalQueue([
      { id: 'review', requiresApproval: true },
      { id: 'manual', requiresApproval: false },
    ])).toEqual([{ id: 'review', requiresApproval: true }])
  })
})
