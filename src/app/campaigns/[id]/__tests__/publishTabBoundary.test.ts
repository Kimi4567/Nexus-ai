import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const campaignRoomSource = readFileSync(
  resolve(process.cwd(), 'src/app/campaigns/[id]/page.tsx'),
  'utf8',
)

describe('Campaign Publish tab platform boundary', () => {
  it('does not mount the legacy free-form SocialPublisher composer', () => {
    expect(campaignRoomSource).not.toContain('<SocialPublisher')
    expect(campaignRoomSource).toContain('Publishing readiness belongs in Content Hub')
    expect(campaignRoomSource).toContain('جاهزية النشر تُراجع من Content Hub')
    expect(campaignRoomSource).not.toContain('Future publishing starts from Content Hub')
    expect(campaignRoomSource).not.toContain('النشر القادم يبدأ من Content Hub')
  })

  it('states that platform/API publish readiness must be reviewed on a specific Content Hub post', () => {
    expect(campaignRoomSource).toContain('Platform/API publish readiness must be reviewed')
    expect(campaignRoomSource).toContain('جاهزية للنشر عبر منصة/API يجب أن تُراجع')
    expect(campaignRoomSource).toContain('specific Content Hub post')
    expect(campaignRoomSource).toContain('منشور محدد في Content Hub')
    expect(campaignRoomSource).toContain('Connecting does not publish')
    expect(campaignRoomSource).toContain('الربط لا يعني النشر')
  })
})
