import { readFileSync } from 'fs'
import { resolve } from 'path'
import { describe, expect, it } from 'vitest'

const campaignRoomSource = readFileSync(
  resolve(process.cwd(), 'src/app/campaigns/[id]/page.tsx'),
  'utf8',
)
const operatingStateSource = readFileSync(
  resolve(process.cwd(), 'src/lib/campaignOperatingState.ts'),
  'utf8',
)
const aiPresenceBarSource = readFileSync(
  resolve(process.cwd(), 'src/components/AIPresenceBar.tsx'),
  'utf8',
)
const analyticsInsightsRouteSource = readFileSync(
  resolve(process.cwd(), 'src/app/api/analytics/insights/route.ts'),
  'utf8',
)

describe('Campaign Room strategy truth copy', () => {
  it('does not tell progressed campaigns to turn strategy into content again', () => {
    expect(campaignRoomSource).not.toContain('Review strategy quality before turning it into content.')
    expect(campaignRoomSource).not.toContain('before turning it into content planning')
    expect(campaignRoomSource).not.toContain('قبل تحويلها إلى محتوى')
    expect(campaignRoomSource).not.toContain('قبل تحويلها إلى خطة محتوى')
    expect(operatingStateSource).toContain('Review strategy quality before building the first content plan.')
    expect(operatingStateSource).toContain('راجع جودة الاستراتيجية قبل بناء أول خطة محتوى.')
    expect(operatingStateSource).not.toContain('Review the strategy quality before turning it into a content plan.')
    expect(operatingStateSource).not.toContain('قبل تحويلها إلى خطة محتوى')
  })

  it('frames strategy as reference material once Content Hub content exists', () => {
    expect(campaignRoomSource).toContain('Strategy is reference material. Content Hub shows the current execution state.')
    expect(campaignRoomSource).toContain('use Content Hub for the current post and execution state')
    expect(campaignRoomSource).toContain('الاستراتيجية أصبحت مادة مرجعية')
    expect(campaignRoomSource).toContain('حالة المنشورات والتنفيذ الحالية موجودة في Content Hub')
  })

  it('uses Content Hub post truth for the organic plan readiness card', () => {
    expect(campaignRoomSource).toContain('operatingState.truthFlags.hasContentPlan')
    expect(campaignRoomSource).toContain('Available for review in Content Hub')
    expect(campaignRoomSource).toContain('Ready to build a content plan after review')
    expect(campaignRoomSource).not.toContain('Ready for content planning')
  })

  it('does not describe the pre-content-plan Content Hub action as review', () => {
    expect(campaignRoomSource).toContain('Open Content Hub to prepare content plan')
    expect(campaignRoomSource).toContain('افتح Content Hub لتحضير خطة المحتوى')
    expect(campaignRoomSource).not.toContain('Open Content Hub for review')
    expect(campaignRoomSource).not.toContain('افتح Content Hub للمراجعة')
  })

  it('frames the strategy tab as a decision cockpit rather than a long report', () => {
    expect(campaignRoomSource).toContain('Strategy decision brief')
    expect(campaignRoomSource).toContain('Review before execution')
    expect(campaignRoomSource).toContain('Missing before execution decisions')
    expect(campaignRoomSource).toContain('This page keeps the full strategy value, but organizes it into reviewable decisions.')
    expect(campaignRoomSource).toContain('No publishing, scheduling, ad spend, or Brand Brain updates happen from this page.')
  })

  it('uses functional section navigation for only visible strategy sections', () => {
    expect(campaignRoomSource).toContain('strategySectionNavItems')
    expect(campaignRoomSource).toContain('scrollToStrategySection')
    expect(campaignRoomSource).toContain("document.getElementById(sectionId)")
    expect(campaignRoomSource).toContain("window.location.hash.replace('#', '')")
    expect(campaignRoomSource).not.toContain("['04', locale === 'ar' ? 'المحتوى' : 'Content', '#strategy-content']")
  })

  it('does not surface unconfirmed budget assumptions as factual allocation', () => {
    expect(campaignRoomSource).toContain('sanitizeStrategyLimitText')
    expect(campaignRoomSource).toContain('Paid budget needs user confirmation before allocation.')
    expect(campaignRoomSource).not.toContain('Assumes $5000 USD budget is available for allocation')
  })

  it('localizes strategy field labels instead of hardcoding English labels into Arabic runtime cards', () => {
    expect(campaignRoomSource).toContain('strategyFieldLabel')
    expect(campaignRoomSource).toContain("strategyFieldLabel('situation')")
    expect(campaignRoomSource).toContain("strategyFieldLabel('desiredOutcome')")
    expect(campaignRoomSource).toContain("strategyFieldLabel('successMetric')")
    expect(campaignRoomSource).not.toContain('label="Situation"')
    expect(campaignRoomSource).not.toContain('label="Pain"')
    expect(campaignRoomSource).not.toContain('label="Want"')
    expect(campaignRoomSource).not.toContain('label="Objection"')
    expect(campaignRoomSource).not.toContain('label="Message"')
    expect(campaignRoomSource).not.toContain('label="Format"')
    expect(campaignRoomSource).not.toContain('label="Platform"')
    expect(campaignRoomSource).not.toContain('label="CTA"')
  })

  it('keeps the global AI presence bar localized on Arabic campaign pages', () => {
    expect(aiPresenceBarSource).toContain('current.messageAr')
    expect(aiPresenceBarSource).toContain("locale === 'ar'")
    expect(analyticsInsightsRouteSource).toContain('messageAr')
    expect(analyticsInsightsRouteSource).toContain('حملات في المسودة')
    expect(analyticsInsightsRouteSource).toContain('راجعها قبل الجدولة')
  })
})
