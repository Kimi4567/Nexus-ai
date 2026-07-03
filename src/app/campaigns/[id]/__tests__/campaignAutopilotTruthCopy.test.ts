import { readFileSync } from 'fs'
import { resolve } from 'path'
import { describe, expect, it } from 'vitest'

const campaignRoomSource = readFileSync(
  resolve(process.cwd(), 'src/app/campaigns/[id]/page.tsx'),
  'utf8',
)

describe('Campaign Room Autopilot truth copy', () => {
  it('does not ask progressed manual/scheduled campaigns to regenerate strategy for Autopilot', () => {
    expect(campaignRoomSource).not.toContain('No weekly execution plan found — regenerate the strategy')
    expect(campaignRoomSource).not.toContain('أعد توليد الاستراتيجية')
  })

  it('frames scheduled and manual publish records as workflow records, not Autopilot execution', () => {
    expect(campaignRoomSource).toContain('Scheduled or manually published posts are workflow records')
    expect(campaignRoomSource).toContain('they do not require strategy regeneration')
    expect(campaignRoomSource).toContain('المنشورات المجدولة أو المؤكدة يدويًا هي سجلات سير عمل')
  })
})
