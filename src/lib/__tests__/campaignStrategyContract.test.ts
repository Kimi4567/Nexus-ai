import { describe, expect, it } from 'vitest'
import {
  assertCampaignStrategyContract,
  detectLegacyCampaignEngineStrategy,
  validateCampaignStrategyContract,
} from '@/lib/campaignStrategyContract'

const richStrategy = {
  campaignName: 'Cairo Bloom Coffee Lead Generation',
  goal: 'LEADS',
  positioning: 'Cairo Bloom Coffee is the specialty coffee option for Cairo office teams who need reliable daily coffee without complicated ordering.',
  keyMessage: 'Better office coffee can be simple to choose, order, and repeat.',
  differentiation: 'Fresh roast guidance and WhatsApp ordering tailored to home drinkers and small offices.',
  targetAudienceRefined: 'Office managers and home coffee drinkers in Cairo and Giza choosing reliable beans for daily routines.',
  diagnosis: 'The brand has a useful offer but must make the buying path and proof clearer before scaling paid media.',
  businessStage: 'active',
  businessObjective: {
    primary: 'Increase repeat WhatsApp orders',
    marketing: 'Build trust around daily coffee routines',
    conversionAction: 'WhatsApp inquiry',
    expectedUserAction: 'Ask for a roast recommendation',
    whyNow: 'The offer is concrete enough to test demand',
    successIn30Days: 'A clearer content-to-WhatsApp path is validated',
  },
  diagnosisDetails: {
    stage: 'active',
    bottleneck: 'Trust and conversion path clarity',
    trustGap: 'Not enough proof shown',
    offerClarity: 'partial',
    contentGap: 'Needs practical use cases',
    assetReadiness: 'Needs product and routine visuals',
    conversionReadiness: 'WhatsApp path needs clearer prompts',
    readyForPaidAds: false,
    readyForPaidAdsReason: 'Budget and tracking are not confirmed',
    mainRisk: 'Running paid traffic before proof and tracking are ready',
  },
  audienceSegmentsDetailed: [
    { segment: 'Office managers', situation: 'Stocking coffee for teams', pain: 'Inconsistent supply', desiredOutcome: 'Reliable office coffee', objection: 'Will the team like it?', message: 'Office coffee can be easier to repeat.', platform: 'LinkedIn', format: 'Carousel', cta: 'Ask for an office bundle' },
    { segment: 'Home drinkers', situation: 'Making coffee before work', pain: 'Unsure which grind to choose', desiredOutcome: 'Consistent morning cup', objection: 'I do not know what to order', message: 'Choose beans by routine, not guesswork.', platform: 'Instagram', format: 'Reel', cta: 'Message for a grind recommendation' },
  ],
  contentPillars: ['Office coffee routines', 'Home brewing guidance', 'Bean selection help'],
  contentAnglesDetailed: [
    { title: 'Office reorder reminder', pain: 'Running out', format: 'Carousel', hook: 'Your office coffee should not be a weekly emergency.', platform: 'LinkedIn', cta: 'Ask for a bundle', asset: 'Office setup', funnelStage: 'consideration' },
    { title: 'Grind-size guide', pain: 'Wrong grind', format: 'Reel', hook: 'The grind can change your whole cup.', platform: 'Instagram', cta: 'Message for help', asset: 'Brew setup', funnelStage: 'awareness' },
    { title: 'Morning routine', pain: 'Inconsistent taste', format: 'Story', hook: 'Small coffee choices make mornings easier.', platform: 'Instagram', cta: 'Choose your bag', asset: 'Kitchen counter', funnelStage: 'conversion' },
    { title: 'Team preference poll', pain: 'Mixed team taste', format: 'Post', hook: 'One office, many coffee preferences.', platform: 'Facebook', cta: 'Build a team pack', asset: 'Coffee bags', funnelStage: 'consideration' },
  ],
  funnelStages: [
    { stage: 'awareness', userMindset: 'Curious', message: 'Daily coffee can be more consistent', contentType: 'Reel', platform: 'Instagram', cta: 'Save the guide', successMetric: 'Saved posts', nextStep: 'Compare beans', productArea: 'Organic' },
    { stage: 'consideration', userMindset: 'Comparing options', message: 'Pick beans by routine', contentType: 'Carousel', platform: 'Facebook', cta: 'Ask for recommendation', successMetric: 'DMs', nextStep: 'WhatsApp', productArea: 'Content' },
    { stage: 'conversion', userMindset: 'Ready to order', message: 'Order the right grind today', contentType: 'Story', platform: 'Instagram', cta: 'Message on WhatsApp', successMetric: 'WhatsApp starts', nextStep: 'Order', productArea: 'Sales' },
  ],
  weeklyExecutionPlan: [
    { week: 1, objective: 'Clarify choice', keyMessage: 'Choose by routine', deliverables: ['2 Reels about grind choice'], platforms: ['Instagram'], assetsNeeded: ['Beans and grinder'], cta: 'Ask for help', successMetric: 'DMs', executionNote: 'Keep it practical', reviewPoints: ['DM quality'] },
    { week: 2, objective: 'Build trust', keyMessage: 'Reliable office coffee', deliverables: ['1 LinkedIn carousel'], platforms: ['LinkedIn'], assetsNeeded: ['Office setup'], cta: 'Ask for bundle', successMetric: 'Inquiries', executionNote: 'Avoid proof claims', reviewPoints: ['Clicks'] },
    { week: 3, objective: 'Show routine', keyMessage: 'Daily cup made easier', deliverables: ['3 stories'], platforms: ['Instagram'], assetsNeeded: ['Cup sequence'], cta: 'Order on WhatsApp', successMetric: 'Replies', executionNote: 'Use simple steps', reviewPoints: ['Replies'] },
    { week: 4, objective: 'Test offer', keyMessage: 'Office bundle planning', deliverables: ['1 offer post'], platforms: ['Facebook'], assetsNeeded: ['Bundle shot'], cta: 'Request bundle', successMetric: 'WhatsApp starts', executionNote: 'No discount assumptions', reviewPoints: ['Inquiry fit'] },
  ],
  channelMix: [{ platform: 'Instagram', budgetPercent: 0, rationale: 'Organic review surface only', contentFrequency: '3x/week' }],
  topHooks: ['Your office coffee should not be a weekly emergency.', 'Choose beans by routine, not guesswork.', 'The grind can change your whole cup.'],
  ctaVariations: ['Ask for a grind recommendation', 'Message for an office bundle', 'Choose your daily bag'],
  valueProps: ['Fresh beans with guidance', 'WhatsApp ordering', 'Office bundle support'],
  kpis: [
    { metric: 'WhatsApp starts', target: 'Validate inquiry quality', timeframe: '30 days', isHypothesis: true },
    { metric: 'Saved guides', target: 'Validate education demand', timeframe: '30 days', isHypothesis: true },
  ],
  readinessChecklist: [
    { label: 'Confirm conversion destination', done: false },
    { label: 'Collect proof assets', done: false },
    { label: 'Prepare product visuals', done: false },
  ],
  riskNotes: ['Paid launch should wait for budget and tracking confirmation.'],
  assumptions: ['No analytics or verified proof were provided.'],
  missingData: ['marketingBudget', 'conversionDestination', 'leadHandling', 'pixel'],
  doNotDoYet: ['Do not launch paid ads before tracking is clear.'],
  nextBestAction: 'Confirm the WhatsApp order path and lead owner.',
  estimatedResults: 'The first month can validate message clarity and inquiry quality without promising performance.',
  readyForPaidAds: false,
  readyForPaidAdsReason: 'Budget, tracking, and proof are not confirmed.',
  confidenceReport: { overall: 'medium', byCapability: { contentStrategy: 'high' } },
  competitorAnalysisComplete: false,
}

describe('campaign strategy contract', () => {
  it('rejects the legacy campaign-engine strategy schema', () => {
    const legacy = {
      overview: 'A short overview.',
      audience: 'Coffee drinkers.',
      valueProps: ['Fresh coffee'],
      angles: ['Morning coffee'],
      platformRecommendations: { INSTAGRAM: 'Post reels' },
      ctaStrategies: ['Message us'],
    }

    expect(detectLegacyCampaignEngineStrategy(legacy)).toBe(true)
    const report = validateCampaignStrategyContract(legacy)
    expect(report.valid).toBe(false)
    expect(report.legacySchemaDetected).toBe(true)
    expect(report.missingFields).toContain('positioning')
    expect(() => assertCampaignStrategyContract(legacy)).toThrow(/Strategy OS contract/)
  })

  it('accepts a complete Strategy OS campaign brief', () => {
    const report = validateCampaignStrategyContract(richStrategy)
    expect(report.valid).toBe(true)
    expect(report.legacySchemaDetected).toBe(false)
    expect(report.missingFields).toEqual([])
    expect(report.weakFields).toEqual([])
    expect(report.languageViolations).toEqual([])
    expect(report.score).toBe(100)
  })

  it('rejects English-heavy user-facing strategy text when Arabic output is selected', () => {
    const report = validateCampaignStrategyContract(richStrategy, { language: 'ar' })

    expect(report.valid).toBe(false)
    expect(report.languageViolations).toEqual(expect.arrayContaining([
      'strategy.campaignName',
      'strategy.topHooks[0]',
      'strategy.readinessChecklist[0].label',
    ]))
    expect(() => assertCampaignStrategyContract(richStrategy, { language: 'ar' })).toThrow(/language: .*campaignName/)
  })

  it('flags weak operational sections before strategy can be saved as successful', () => {
    const partial = {
      ...richStrategy,
      weeklyExecutionPlan: [],
      contentAnglesDetailed: richStrategy.contentAnglesDetailed.slice(0, 2),
    }

    const report = validateCampaignStrategyContract(partial)
    expect(report.valid).toBe(false)
    expect(report.weakFields).toEqual(expect.arrayContaining(['weeklyExecutionPlan', 'contentAnglesDetailed']))
  })

  it('rejects strategies that look complete but use generic weekly execution filler', () => {
    const generic = {
      ...richStrategy,
      weeklyExecutionPlan: richStrategy.weeklyExecutionPlan.map((week) => ({
        ...week,
        deliverables: ['Create content', 'Build awareness'],
      })),
    }

    const report = validateCampaignStrategyContract(generic)
    expect(report.valid).toBe(false)
    expect(report.weakFields).toContain('weeklyExecutionPlan.countableDeliverables')
    expect(() => assertCampaignStrategyContract(generic)).toThrow(/weeklyExecutionPlan\.countableDeliverables/)
  })

  it('rejects rich-shaped content angles that are not executable enough for a marketer', () => {
    const weakAngles = {
      ...richStrategy,
      contentAnglesDetailed: richStrategy.contentAnglesDetailed.map((angle) => ({
        ...angle,
        hook: 'Build awareness',
        cta: '',
      })),
    }

    const report = validateCampaignStrategyContract(weakAngles)
    expect(report.valid).toBe(false)
    expect(report.weakFields).toContain('contentAnglesDetailed.operationalDepth')
  })
})
