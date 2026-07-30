import { describe, expect, it } from 'vitest'
import {
  inferCampaignTone,
  normalizeCampaignPlatformsForPersistence,
} from '@/lib/campaignInputNormalization'
import {
  isOwnerCampaignOutcome,
  ownerCampaignName,
} from '@/lib/ownerCampaignCommand'
import {
  ownerCampaignId,
  parseOwnerCampaignOperationKey,
} from '@/lib/ownerCampaignCommand.server'
import { parseIdempotencyKey } from '@/lib/idempotencyKey.server'

describe('owner campaign command', () => {
  it('accepts only supported owner-facing outcomes', () => {
    expect(isOwnerCampaignOutcome('LEADS')).toBe(true)
    expect(isOwnerCampaignOutcome('sales')).toBe(true)
    expect(isOwnerCampaignOutcome('ENGAGEMENT')).toBe(false)
  })

  it('normalizes Brand Brain platforms to persistence enums without inventing channels', () => {
    expect(normalizeCampaignPlatformsForPersistence([
      'Instagram',
      'X',
      'youtube_shorts',
      'unknown network',
      'INSTAGRAM',
    ])).toEqual(['INSTAGRAM', 'TWITTER', 'YOUTUBE_SHORTS'])
    expect(normalizeCampaignPlatformsForPersistence(['unknown network'])).toEqual([])
  })

  it('derives a conservative tone and localized campaign name', () => {
    expect(inferCampaignTone(['warm', 'friendly'])).toBe('FRIENDLY')
    expect(inferCampaignTone(['unmapped value'])).toBe('PROFESSIONAL')
    expect(ownerCampaignName({
      outcome: 'LEADS',
      brandName: 'Acme',
      language: 'ar',
    })).toBe('زيادة العملاء المحتملين — Acme')
  })

  it('uses a stable user-scoped id for safe network retries', () => {
    const first = ownerCampaignId('user-1', 'owner-command-123')
    expect(ownerCampaignId('user-1', 'owner-command-123')).toBe(first)
    expect(ownerCampaignId('user-2', 'owner-command-123')).not.toBe(first)
    expect(ownerCampaignId('user-1', 'owner-command-456')).not.toBe(first)
  })

  it('shares strict idempotency-key validation across owner commands', () => {
    const validRequest = new Request('http://localhost', {
      headers: { 'Idempotency-Key': 'owner-command_123:retry.1' },
    })
    const shortRequest = new Request('http://localhost', {
      headers: { 'Idempotency-Key': 'short' },
    })
    const unsafeRequest = new Request('http://localhost', {
      headers: { 'Idempotency-Key': 'owner command with spaces' },
    })

    expect(parseIdempotencyKey(validRequest)).toBe('owner-command_123:retry.1')
    expect(parseOwnerCampaignOperationKey(validRequest)).toBe('owner-command_123:retry.1')
    expect(parseIdempotencyKey(shortRequest)).toBeNull()
    expect(parseOwnerCampaignOperationKey(unsafeRequest)).toBeNull()
  })
})
