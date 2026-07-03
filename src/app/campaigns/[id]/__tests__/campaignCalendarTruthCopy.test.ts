import { readFileSync } from 'fs'
import { resolve } from 'path'
import { describe, expect, it } from 'vitest'

const campaignRoomSource = readFileSync(
  resolve(process.cwd(), 'src/app/campaigns/[id]/page.tsx'),
  'utf8',
)

describe('Campaign Room calendar truth copy', () => {
  it('uses scheduled and manually confirmed SocialPosts when legacy calendar output is missing', () => {
    expect(campaignRoomSource).toContain('const socialPostCalendarItems = campaignPosts')
    expect(campaignRoomSource).toContain('Calendar from Content Hub')
    expect(campaignRoomSource).toContain('Scheduled posts are saved in NEXUS only and are not published')
    expect(campaignRoomSource).toContain('user-confirmed manual publish is a user record, not API proof')
  })

  it('does not show the calendar empty state while SocialPost calendar records exist', () => {
    expect(campaignRoomSource).toContain('socialPostCalendarItems.length > 0')
    expect(campaignRoomSource).toContain('socialPostCalendarItems.length === 0')
    expect(campaignRoomSource).toContain('Content calendar not available yet.')
  })
})
