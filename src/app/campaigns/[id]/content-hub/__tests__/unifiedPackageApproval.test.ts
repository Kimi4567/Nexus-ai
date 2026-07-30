import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const SRC = readFileSync(
  resolve(process.cwd(), 'src/app/campaigns/[id]/content-hub/page.tsx'),
  'utf8',
)

describe('owner content-package approval', () => {
  it('uses one replay-safe command for copy, media, and the internal schedule', () => {
    expect(SRC).toContain("creditOperationScope('campaign:content-package-approval'")
    expect(SRC).toContain('`/api/campaigns/${campaignId}/approve-content-package`')
    expect(SRC).toContain("publishMode: 'MANUAL'")
    expect(SRC).toContain('explicitWeakMediaApprovalConfirmed:')
    expect(SRC).toContain('scheduledAtByPostId: reviewedScheduleByPostId')
  })

  it('shows exact schedule controls and keeps publishing and spend outside consent', () => {
    expect(SRC).toContain('type="datetime-local"')
    expect(SRC).toContain('One package decision')
    expect(SRC).toContain('Approve package and record schedule')
    expect(SRC).toContain('No external publishing, Autopilot activation, or budget spend.')
    expect(SRC).toContain('لم يُنشر شيء ولم يُمنح إذن إنفاق')
  })

  it('blocks a package decision while final media or dates are incomplete', () => {
    expect(SRC).toContain('draftMediaDecisionCount > 0')
    expect(SRC).toContain('packageScheduleDateIssues.length > 0')
    expect(SRC).toContain('packageWeakMediaApprovalRisks.length > 0 && !weakMediaApprovalAcknowledged')
  })
})
