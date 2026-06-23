/**
 * publishReadiness tests — OP-D1.3
 *
 * Enforces the NEXUS locked-state honesty rules:
 *   - No real content → publishing locked
 *   - Draft/unapproved → needs approval
 *   - Approved + no platform → manual only
 *   - Approved + verified platform → connected ready
 *   - Approved + platform + autopilot on → auto ready
 */

import {
  derivePublishReadiness,
  getConnectedPublishLockReason,
  getAutopilotLockReason,
  type PublishReadinessInput,
} from '../publishReadiness'

function makeInput(overrides: Partial<PublishReadinessInput> = {}): PublishReadinessInput {
  return {
    hasGeneratedPosts: false,
    hasApprovedPosts: false,
    connectedAccountExists: false,
    platformReady: false,
    autopilotEnabled: false,
    campaignStatus: 'DRAFT',
    ...overrides,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// derivePublishReadiness
// ─────────────────────────────────────────────────────────────────────────────

describe('derivePublishReadiness', () => {
  // 1. No content → locked
  it('returns no_content when no generated posts exist', () => {
    const result = derivePublishReadiness(makeInput({ hasGeneratedPosts: false }))
    expect(result.state).toBe('no_content')
    expect(result.canPublish).toBe(false)
    expect(result.canConnectPublish).toBe(false)
    expect(result.canAutoPublish).toBe(false)
    expect(result.reasonEn).toContain('locked')
  })

  // 2. Posts exist but none approved → locked
  it('returns draft_unapproved when posts exist but none approved', () => {
    const result = derivePublishReadiness(makeInput({
      hasGeneratedPosts: true,
      hasApprovedPosts: false,
    }))
    expect(result.state).toBe('draft_unapproved')
    expect(result.canPublish).toBe(false)
    expect(result.reasonEn).toContain('Approve')
  })

  // 3. Approved posts + no platform → manual only
  it('returns manual_only when approved posts exist but platform not ready', () => {
    const result = derivePublishReadiness(makeInput({
      hasGeneratedPosts: true,
      hasApprovedPosts: true,
      connectedAccountExists: true,
      platformReady: false,
    }))
    expect(result.state).toBe('manual_only')
    expect(result.canPublish).toBe(true)
    expect(result.canConnectPublish).toBe(false)
    expect(result.reasonEn).toContain('Manual publishing')
  })

  // 4. Approved posts + platform ready → connected ready
  it('returns connected_ready when approved posts + verified platform', () => {
    const result = derivePublishReadiness(makeInput({
      hasGeneratedPosts: true,
      hasApprovedPosts: true,
      connectedAccountExists: true,
      platformReady: true,
    }))
    expect(result.state).toBe('connected_ready')
    expect(result.canPublish).toBe(true)
    expect(result.canConnectPublish).toBe(true)
    expect(result.reasonEn).toContain('Connected publishing')
    expect(result.reasonEn).toContain('Approval does not publish')
  })

  // 5. Approved posts + platform ready + autopilot on → auto ready
  it('returns auto_ready when approved posts + verified platform + autopilot enabled', () => {
    const result = derivePublishReadiness(makeInput({
      hasGeneratedPosts: true,
      hasApprovedPosts: true,
      connectedAccountExists: true,
      platformReady: true,
      autopilotEnabled: true,
    }))
    expect(result.state).toBe('auto_ready')
    expect(result.canPublish).toBe(true)
    expect(result.canConnectPublish).toBe(true)
    expect(result.canAutoPublish).toBe(true)
    expect(result.reasonEn).toContain('Auto-publish')
  })

  // 6. No content takes precedence over platform readiness
  it('no_content takes precedence even when platform is ready', () => {
    const result = derivePublishReadiness(makeInput({
      hasGeneratedPosts: false,
      hasApprovedPosts: false,
      connectedAccountExists: true,
      platformReady: true,
    }))
    expect(result.state).toBe('no_content')
    expect(result.canPublish).toBe(false)
  })

  // 7. draft_unapproved takes precedence over platform readiness
  it('draft_unapproved takes precedence even when platform is ready', () => {
    const result = derivePublishReadiness(makeInput({
      hasGeneratedPosts: true,
      hasApprovedPosts: false,
      connectedAccountExists: true,
      platformReady: true,
    }))
    expect(result.state).toBe('draft_unapproved')
    expect(result.canPublish).toBe(false)
  })

  // 8. autopilot_ready takes precedence over connected_ready
  it('auto_ready takes precedence over connected_ready', () => {
    const result = derivePublishReadiness(makeInput({
      hasGeneratedPosts: true,
      hasApprovedPosts: true,
      connectedAccountExists: true,
      platformReady: true,
      autopilotEnabled: true,
    }))
    expect(result.state).toBe('auto_ready')
    expect(result.state).not.toBe('connected_ready')
  })

  // 9. manual_only when approved posts exist but no connected account at all
  it('returns manual_only when no connected account exists but posts approved', () => {
    const result = derivePublishReadiness(makeInput({
      hasGeneratedPosts: true,
      hasApprovedPosts: true,
      connectedAccountExists: false,
      platformReady: false,
    }))
    expect(result.state).toBe('manual_only')
    expect(result.canPublish).toBe(true)
    expect(result.canConnectPublish).toBe(false)
  })

  // 10. AR translations exist
  it('provides Arabic translations', () => {
    const result = derivePublishReadiness(makeInput({ hasGeneratedPosts: false }))
    expect(result.reasonAr).toBeTruthy()
    expect(result.reasonAr).not.toContain('locked') // should be Arabic text
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// getConnectedPublishLockReason
// ─────────────────────────────────────────────────────────────────────────────

describe('getConnectedPublishLockReason', () => {
  it('returns reason when account exists but platform not ready', () => {
    const result = getConnectedPublishLockReason(true, false)
    expect(result).not.toBeNull()
    expect(result!.en).toContain('not ready yet')
    expect(result!.key).toBe('publish.lock.connectedNotReady')
  })

  it('returns reason when no account connected', () => {
    const result = getConnectedPublishLockReason(false, false)
    expect(result).not.toBeNull()
    expect(result!.en).toContain('Connect a social account')
    expect(result!.key).toBe('publish.lock.noConnectedAccount')
  })

  it('returns null when platform is ready', () => {
    const result = getConnectedPublishLockReason(true, true)
    expect(result).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// getAutopilotLockReason
// ─────────────────────────────────────────────────────────────────────────────

describe('getAutopilotLockReason', () => {
  it('returns reason when campaign not approved', () => {
    const result = getAutopilotLockReason(true, true, false)
    expect(result).not.toBeNull()
    expect(result!.en).toContain('campaign is approved')
    expect(result!.key).toBe('publish.lock.autopilotNeedsApproval')
  })

  it('returns reason when no approved posts', () => {
    const result = getAutopilotLockReason(false, true, true)
    expect(result).not.toBeNull()
    expect(result!.en).toContain('content is approved')
    expect(result!.key).toBe('publish.lock.autopilotNeedsContent')
  })

  it('returns reason when platform not ready', () => {
    const result = getAutopilotLockReason(true, false, true)
    expect(result).not.toBeNull()
    expect(result!.en).toContain('platform permissions')
    expect(result!.key).toBe('publish.lock.autopilotNeedsPlatform')
  })

  it('returns null when all conditions met', () => {
    const result = getAutopilotLockReason(true, true, true)
    expect(result).toBeNull()
  })
})
