import { describe, expect, it } from 'vitest'
import {
  strategyExecutionPlatforms,
  strategySupportOnlyChannels,
} from '../strategyPlatformScope'

describe('strategy platform scope', () => {
  it('keeps social destinations executable and treats WhatsApp as support-only', () => {
    const channels = ['Instagram', 'WhatsApp', 'Pinterest']

    expect(strategyExecutionPlatforms(channels)).toEqual(['Instagram', 'Pinterest'])
    expect(strategySupportOnlyChannels(channels)).toEqual(['WhatsApp'])
  })

  it('handles legacy channel spellings, blanks, and duplicates deterministically', () => {
    const channels = [' Instagram ', 'instagram', 'WHATS_APP', 'Website', '', null]

    expect(strategyExecutionPlatforms(channels)).toEqual(['Instagram'])
    expect(strategySupportOnlyChannels(channels)).toEqual(['WHATS_APP', 'Website'])
  })

  it('does not remove genuine campaign platforms merely because publishing permissions are pending', () => {
    expect(strategyExecutionPlatforms(['Snapchat', 'YouTube', 'Threads', 'X'])).toEqual([
      'Snapchat',
      'YouTube',
      'Threads',
      'X',
    ])
  })
})
