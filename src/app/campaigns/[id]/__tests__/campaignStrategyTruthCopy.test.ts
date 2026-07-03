import { readFileSync } from 'fs'
import { resolve } from 'path'
import { describe, expect, it } from 'vitest'

const campaignRoomSource = readFileSync(
  resolve(process.cwd(), 'src/app/campaigns/[id]/page.tsx'),
  'utf8',
)

describe('Campaign Room strategy truth copy', () => {
  it('does not tell progressed campaigns to turn strategy into content again', () => {
    expect(campaignRoomSource).not.toContain('Review strategy quality before turning it into content.')
    expect(campaignRoomSource).not.toContain('before turning it into content planning')
    expect(campaignRoomSource).not.toContain('قبل تحويلها إلى محتوى')
    expect(campaignRoomSource).not.toContain('قبل تحويلها إلى خطة محتوى')
  })

  it('frames strategy as reference material once Content Hub content exists', () => {
    expect(campaignRoomSource).toContain('Strategy is reference material. Content Hub shows the current execution state.')
    expect(campaignRoomSource).toContain('use Content Hub for the current post and execution state')
    expect(campaignRoomSource).toContain('الاستراتيجية أصبحت مادة مرجعية')
    expect(campaignRoomSource).toContain('حالة المنشورات والتنفيذ الحالية موجودة في Content Hub')
  })

  it('uses Content Hub post truth for the organic plan readiness card', () => {
    expect(campaignRoomSource).toContain('value={operatingState.truthFlags.hasContentPlan')
    expect(campaignRoomSource).toContain('Available for review in Content Hub')
    expect(campaignRoomSource).toContain('Ready for content planning')
  })
})
