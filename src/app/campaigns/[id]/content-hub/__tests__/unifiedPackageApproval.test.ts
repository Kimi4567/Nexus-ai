import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const SRC = readFileSync(
  resolve(process.cwd(), 'src/app/campaigns/[id]/content-hub/page.tsx'),
  'utf8',
)

describe('owner content approval workflow', () => {
  it('approves copy without approving media or recording the schedule', () => {
    expect(SRC).toContain("creditOperationScope('campaign:content-copy-approval'")
    expect(SRC).toContain('`/api/campaigns/${campaignId}/approve-content-plan`')
    expect(SRC).toContain("body: JSON.stringify({ mode: 'approve' })")
    expect(SRC).toContain('Approve copy only')
    expect(SRC).toContain('No media approval, scheduling, external publishing, platform linking')
    expect(SRC).not.toContain("creditOperationScope('campaign:content-package-approval'")
  })

  it('keeps final media approval and scheduling as separate UI decisions', () => {
    expect(SRC).toContain('Separate media decision')
    expect(SRC).toContain('Approve media only')
    expect(SRC).toContain('Separate scheduling decision')
    expect(SRC).toContain('Confirm scheduling')
    expect(SRC).toContain('لم تتم الجدولة أو النشر')
  })

  it('does not show the old combined package approval language', () => {
    expect(SRC).not.toContain('Approve package and record schedule')
    expect(SRC).not.toContain('One package decision')
    expect(SRC).not.toContain('اعتماد الحزمة وتسجيل الجدول')
  })
})
