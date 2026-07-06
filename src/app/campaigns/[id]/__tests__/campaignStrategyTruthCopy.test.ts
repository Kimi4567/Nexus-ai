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
const strategyRoomStateCopySource = readFileSync(
  resolve(process.cwd(), 'src/lib/strategyRoomStateCopy.ts'),
  'utf8',
)
const appShellSource = readFileSync(
  resolve(process.cwd(), 'src/components/AppShell.tsx'),
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
const strategyRuntimeCopySource = `${campaignRoomSource}\n${strategyRoomStateCopySource}`

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
    expect(strategyRuntimeCopySource).toContain('Strategy is reference material. Content Hub shows the current execution state.')
    expect(strategyRuntimeCopySource).toContain('use Content Hub for the current post and execution state')
    expect(strategyRuntimeCopySource).toContain('الاستراتيجية أصبحت مادة مرجعية')
    expect(strategyRuntimeCopySource).toContain('حالة المنشورات والتنفيذ الحالية موجودة في Content Hub')
  })

  it('uses Content Hub post truth for the organic plan readiness card', () => {
    expect(campaignRoomSource).toContain('operatingState.truthFlags.hasContentPlan')
    expect(strategyRuntimeCopySource).toContain('Available for review in Content Hub')
    expect(strategyRuntimeCopySource).toContain('Ready to build a content plan after review')
    expect(campaignRoomSource).not.toContain('Ready for content planning')
  })

  it('does not describe the pre-content-plan Content Hub action as review', () => {
    expect(strategyRuntimeCopySource).toContain('Open Content Hub to prepare content plan')
    expect(strategyRuntimeCopySource).toContain('افتح Content Hub لتحضير خطة المحتوى')
    expect(strategyRuntimeCopySource).toContain('These are planning inputs, not final post drafts')
    expect(strategyRuntimeCopySource).toContain('Hooks and angles here are strategy material for building the first content plan.')
    expect(strategyRuntimeCopySource).toContain('Final post previews do not exist until Content Hub is prepared.')
    expect(campaignRoomSource).not.toContain('Open Content Hub for review')
    expect(campaignRoomSource).not.toContain('افتح Content Hub للمراجعة')
  })

  it('keeps paid planning diagnosis scope-aware for organic-only strategies', () => {
    expect(campaignRoomSource).toContain('!includesPaidPlanningStrategy')
    expect(campaignRoomSource).toContain('Not included in this organic run')
    expect(campaignRoomSource).toContain('غير مشمول في هذا التشغيل العضوي')
    expect(campaignRoomSource).toContain('Paid inputs missing; no spend without approval')
    expect(campaignRoomSource).not.toContain('Needs setup before any spend')
    expect(campaignRoomSource).not.toContain('يحتاج إعداداً قبل الصرف')
  })

  it('frames the strategy tab as a command center rather than a long report', () => {
    expect(campaignRoomSource).toContain('Strategy command center')
    expect(campaignRoomSource).toContain('Next action')
    expect(campaignRoomSource).toContain('Review before execution')
    expect(campaignRoomSource).toContain('Missing before execution decisions')
    expect(campaignRoomSource).toContain('This page keeps the full strategy value, but organizes it into reviewable decisions.')
    expect(campaignRoomSource).toContain('No publishing, scheduling, ad spend, or Brand Brain updates happen from this page.')
    expect(campaignRoomSource).toContain('Review strategy sections')
    expect(campaignRoomSource).toContain("scrollToStrategySection('strategy-executive')")
    expect(campaignRoomSource).not.toContain('Open Strategy workspace')
    expect(campaignRoomSource).not.toContain('Back to Strategy')
  })

  it('keeps execution readiness labels specific instead of vague review language', () => {
    expect(campaignRoomSource).toContain('need connection/support')
    expect(campaignRoomSource).toContain('تحتاج ربطاً أو دعماً')
    expect(campaignRoomSource).not.toContain('need review')
    expect(campaignRoomSource).not.toContain('يحتاج مراجعة')
  })

  it('keeps campaign tabs and the strategy map visible in one operating navigation surface', () => {
    expect(campaignRoomSource).toContain('Campaign Room')
    expect(campaignRoomSource).toContain('Current workspace:')
    expect(campaignRoomSource).toContain('Operating navigation')
    expect(campaignRoomSource).toContain('Strategy map')
    expect(campaignRoomSource).toContain('sticky top-0 z-30')
    expect(campaignRoomSource).toContain('activeTab === 0 && strategySectionNavItems.length > 0')
    expect(appShellSource).toContain('min-w-0 flex-1 min-h-screen overflow-y-visible')
    expect(appShellSource).toContain('overflow-y-visible')
    expect(appShellSource).not.toContain('min-h-screen overflow-y-auto transition-all')
  })

  it('labels campaign room tabs as review material before execution records exist', () => {
    expect(campaignRoomSource).toContain('Content planning inputs')
    expect(campaignRoomSource).toContain('Hooks and angles for review')
    expect(campaignRoomSource).toContain('Execution rhythm')
    expect(campaignRoomSource).toContain('Planned, not scheduled')
    expect(campaignRoomSource).toContain('Execution rhythm for review — not scheduled posts')
    expect(campaignRoomSource).toContain('No Content Hub posts are scheduled or published until a content plan is built and explicitly reviewed.')
    expect(campaignRoomSource).not.toContain('Content workflow')
    expect(campaignRoomSource).not.toContain('Drafts and hooks for review')
    expect(campaignRoomSource).not.toContain('Campaign calendar')
  })

  it('adds a review-only execution checklist before Content Hub preparation', () => {
    expect(strategyRuntimeCopySource).toContain('Before Content Hub checklist')
    expect(strategyRuntimeCopySource).toContain('Use this as the go/no-go check before preparing the first content plan.')
    expect(strategyRuntimeCopySource).toContain('This panel does not generate, approve, schedule, publish, or update Brand Brain.')
    expect(campaignRoomSource).toContain('Message and audience direction')
    expect(campaignRoomSource).toContain('Content plan status')
    expect(campaignRoomSource).toContain('Proof and trust')
    expect(campaignRoomSource).toContain('Creative assets')
    expect(campaignRoomSource).toContain('Analytics baseline')
    expect(campaignRoomSource).toContain('Paid planning scope')
    expect(strategyRuntimeCopySource).toContain('قائمة ما قبل Content Hub')
    expect(strategyRuntimeCopySource).toContain('هذه اللوحة لا تولّد ولا تعتمد ولا تجدول ولا تنشر ولا تحدّث Brand Brain.')
  })

  it('uses functional section navigation for only visible strategy sections', () => {
    expect(campaignRoomSource).toContain('strategySectionNavItems')
    expect(campaignRoomSource).toContain('scrollToStrategySection')
    expect(campaignRoomSource).toContain("document.getElementById(sectionId)")
    expect(campaignRoomSource).toContain("document.querySelector('[data-strategy-operating-nav]')")
    expect(campaignRoomSource).toContain('stickyNav.getBoundingClientRect().height + 24')
    expect(campaignRoomSource).toContain('window.scrollTo({ top, behavior')
    expect(campaignRoomSource).toContain('data-strategy-operating-nav')
    expect(campaignRoomSource).toContain("id: 'strategy-executive'")
    expect(campaignRoomSource).toContain("id: 'strategy-metrics'")
    expect(campaignRoomSource).toContain('id="strategy-metrics"')
    expect(campaignRoomSource).toContain("window.location.hash.replace('#', '')")
    expect(campaignRoomSource).not.toContain("{ num: '01', label: locale === 'ar' ? 'الملخص' : 'Summary'")
    expect(campaignRoomSource).not.toContain("['04', locale === 'ar' ? 'المحتوى' : 'Content', '#strategy-content']")
  })

  it('does not surface unconfirmed budget assumptions as factual allocation', () => {
    expect(campaignRoomSource).toContain('sanitizeStrategyLimitText')
    expect(campaignRoomSource).toContain('Paid budget needs user confirmation before allocation.')
    expect(campaignRoomSource).not.toContain('Assumes $5000 USD budget is available for allocation')
  })

  it('localizes strategy field labels instead of hardcoding English labels into Arabic runtime cards', () => {
    expect(campaignRoomSource).toContain('strategyFieldLabel')
    expect(campaignRoomSource).toContain("strategyDocFieldLabel('situation')")
    expect(campaignRoomSource).toContain("strategyDocFieldLabel('desiredOutcome')")
    expect(campaignRoomSource).toContain("strategyDocFieldLabel('successMetric')")
    expect(campaignRoomSource).not.toContain('label="Situation"')
    expect(campaignRoomSource).not.toContain('label="Pain"')
    expect(campaignRoomSource).not.toContain('label="Want"')
    expect(campaignRoomSource).not.toContain('label="Objection"')
    expect(campaignRoomSource).not.toContain('label="Message"')
    expect(campaignRoomSource).not.toContain('label="Format"')
    expect(campaignRoomSource).not.toContain('label="Platform"')
    expect(campaignRoomSource).not.toContain('label="CTA"')
  })

  it('normalizes raw strategy output values before rendering them to users', () => {
    expect(campaignRoomSource).toContain('formatStrategyDisplayText')
    expect(campaignRoomSource).toContain('مرحلة التخطيط والمراجعة')
    expect(campaignRoomSource).toContain('Planning and review stage')
    expect(campaignRoomSource).toContain('بيانات غير كافية بعد')
    expect(campaignRoomSource).toContain('Not enough data yet')
    expect(campaignRoomSource).toContain('formatCampaignToneForLocale')
    expect(campaignRoomSource).toContain("Modern: 'حديثة'")
    expect(campaignRoomSource).toContain('effectiveLocale')
    expect(campaignRoomSource).toContain('StrategyDocList locale={strategyDocumentLocale}')
    expect(campaignRoomSource).toContain('formatStrategyDisplayText(item, locale)')
  })

  it('uses the generated strategy language for the strategy document reading surface', () => {
    expect(campaignRoomSource).toContain('resolveStrategyDocumentLocale(strategyLanguage, locale)')
    expect(campaignRoomSource).toContain('strategyDocumentLocale')
    expect(campaignRoomSource).toContain('strategyDocText')
    expect(campaignRoomSource).toContain('strategyDocStateCopy')
    expect(campaignRoomSource).toContain("strategyDocFieldLabel('situation')")
    expect(campaignRoomSource).toContain("strategyDocFieldLabel('successMetric')")
    expect(campaignRoomSource).toContain('StrategyDocList locale={strategyDocumentLocale}')
    expect(campaignRoomSource).toContain("strategyDocText('تشخيص التسويق', 'Marketing Diagnosis')")
    expect(campaignRoomSource).toContain("strategyDocText('خطة التنفيذ', 'Execution Plan')")
    expect(campaignRoomSource).toContain("strategyDocText('مؤشرات القياس', 'KPIs & Metrics')")
    expect(campaignRoomSource).not.toContain('StrategyDocList ordered locale={locale} items={audienceSegments')
  })

  it('keeps the global AI presence bar localized on Arabic campaign pages', () => {
    expect(aiPresenceBarSource).toContain('current.messageAr')
    expect(aiPresenceBarSource).toContain("locale === 'ar'")
    expect(analyticsInsightsRouteSource).toContain('messageAr')
    expect(analyticsInsightsRouteSource).toContain('حملات في المسودة')
    expect(analyticsInsightsRouteSource).toContain('راجعها قبل الجدولة')
  })
})
