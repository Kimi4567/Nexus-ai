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
    successIn30Days: 'Establish a 30-day baseline for qualified WhatsApp inquiries; continue only when inquiries match the intended buying situation.',
  },
  diagnosisDetails: {
    stage: 'active',
    basis: 'hypothesis',
    evidenceBasis: 'Validate the suspected trust and conversion-path gap from qualified WhatsApp inquiries and repeated objections.',
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
    { title: 'Office reorder reminder', pain: 'Running out', desiredOutcome: 'Reliable reorder rhythm', objection: 'Will the team like this coffee?', format: 'Carousel', hook: 'Your office coffee should not be a weekly emergency.', platform: 'LinkedIn', cta: 'Ask for a bundle', asset: 'Office setup', funnelStage: 'consideration', proofNeeded: 'Office routine photo or reorder checklist', responseHandoff: 'Owner replies with bundle options and team-size question', reviewPoint: 'Review inquiry fit before repeating' },
    { title: 'Grind-size guide', pain: 'Wrong grind', desiredOutcome: 'Consistent morning cup', objection: 'I do not know which grind to order', format: 'Reel', hook: 'The grind can change your whole cup.', platform: 'Instagram', cta: 'Message for help', asset: 'Brew setup', funnelStage: 'awareness', proofNeeded: 'Brew setup photos and grind examples', responseHandoff: 'Owner asks brewing method and recommends one grind', reviewPoint: 'Review saved posts and recommendation requests' },
    { title: 'Morning routine', pain: 'Inconsistent taste', desiredOutcome: 'Simpler daily choice', objection: 'Will this work with my equipment?', format: 'Story', hook: 'Small coffee choices make mornings easier.', platform: 'Instagram', cta: 'Choose your bag', asset: 'Kitchen counter', funnelStage: 'conversion', proofNeeded: 'Routine sequence photos', responseHandoff: 'Owner confirms brew method before order', reviewPoint: 'Review reply quality and confusion points' },
    { title: 'Team preference poll', pain: 'Mixed team taste', desiredOutcome: 'Office pack that matches team preference', objection: 'One coffee will not fit everyone', format: 'Post', hook: 'One office, many coffee preferences.', platform: 'Facebook', cta: 'Build a team pack', asset: 'Coffee bags', funnelStage: 'consideration', proofNeeded: 'Team preference poll or bundle menu', responseHandoff: 'Owner asks team size and taste range', reviewPoint: 'Review bundle inquiry readiness' },
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
  assetRequirements: {
    mustHave: ['Product photos', 'WhatsApp response owner'],
    niceToHave: ['Office coffee setup'],
    forAds: ['Paid proof later only'],
    forOrganic: ['Routine visuals'],
    forProof: ['Customer feedback before proof claims'],
    canStartWithout: true,
    canStartWithoutNote: 'Organic planning can start while proof is collected.',
    nextToCreate: ['Office setup photo set'],
  },
  measurementPlan: {
    primaryOutcome: 'Validate qualified WhatsApp inquiries',
    baselineStatus: 'The first cycle establishes the baseline',
    eventsToTrack: ['Content source', 'WhatsApp start', 'qualified follow-up'],
    attributionRule: 'Tie each inquiry to its last verifiable source',
    reportingCadence: 'Weekly review',
    owner: 'Sales owner to confirm',
    noDataDecision: 'Keep collecting baseline evidence without scaling',
  },
  operatingCadence: {
    daily: ['Review replies and publishing failures'],
    weekly: ['Review inquiry quality and objections'],
    monthly: ['Approve evidenced Brand Brain learnings'],
    approvalSla: 'Team agreement required',
    responseSla: 'Sales owner agreement required',
    owners: ['Content owner', 'Sales owner to confirm'],
  },
  experimentBacklog: [
    { hypothesis: 'Routine framing improves message fit', audience: 'Home drinkers', variable: 'Hook', successSignal: 'Relevant recommendation questions', minimumEvidence: 'Reviewable replies', decisionRule: 'Continue when replies fit the intended need', priority: 'now', dependency: 'Brew visuals' },
    { hypothesis: 'Office bundle framing clarifies the offer', audience: 'Office managers', variable: 'Offer framing', successSignal: 'Team-size questions', minimumEvidence: 'Qualified inquiries', decisionRule: 'Revise when the bundle remains unclear', priority: 'next', dependency: 'Bundle details' },
    { hypothesis: 'A grind guide reduces confusion', audience: 'Home drinkers', variable: 'Educational format', successSignal: 'Grind-specific questions', minimumEvidence: 'Real replies', decisionRule: 'Keep when questions become more specific', priority: 'later', dependency: 'Grind examples' },
  ],
  decisionRules: [
    { signal: 'Inquiry quality', continueWhen: 'Replies match the intended segment', iterateWhen: 'The same confusion repeats', stopWhen: 'Replies stay unrelated after revision', nextAction: 'Revise message and qualification' },
    { signal: 'Publishing integrity', continueWhen: 'Platforms confirm publishing', iterateWhen: 'A fixable format issue appears', stopWhen: 'Permission or claim checks fail', nextAction: 'Pause the destination and review' },
    { signal: 'Evidence quality', continueWhen: 'Reviewable evidence exists', iterateWhen: 'Signal is weak but valid', stopWhen: 'Attribution is unavailable', nextAction: 'Repair measurement before scaling' },
  ],
  roadmap30_60_90: [
    { phase: 'days_1_30', objective: 'Establish baseline', deliverables: ['Run first review cycle'], exitGate: 'Reviewable inquiry evidence' },
    { phase: 'days_31_60', objective: 'Improve messages', deliverables: ['Iterate one variable at a time'], exitGate: 'Documented learning' },
    { phase: 'days_61_90', objective: 'Scale validated work', deliverables: ['Expand only proven angles'], exitGate: 'Approval and measurement readiness' },
  ],
  competitorFrame: {
    analysisStatus: 'incomplete',
    providedCompetitors: [],
    differentiationHypotheses: ['Service guidance may differentiate the offer'],
    researchNeeded: ['Collect competitor offer and conversion-path evidence'],
  },
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

  it('accepts short unique ad-copy IDs while keeping user-facing paid copy operational', () => {
    const expectedPaidPlanning = {
      audienceHypothesisCount: 3,
      paidAdAngleCount: 4,
      paidAdVariationCount: 9,
      creativeBriefCount: 4,
    } as any
    const strategy = {
      ...richStrategy,
      paidPlanning: {
        planningOnly: true,
        objective: 'Review qualified demo-message hypotheses before any launch.',
        audienceHypotheses: Array.from({ length: 3 }, (_, index) => ({
          name: `Audience ${index + 1}`,
          buyingSituation: [
            'Reviewing appointment intake before requesting a demo.',
            'Comparing follow-up ownership before replacing spreadsheets.',
            'Preparing an approval workflow for a growing clinic team.',
          ][index],
          targetingHypothesis: [
            'Clinic owners may respond to visible intake evidence.',
            'Operations managers may respond to follow-up accountability.',
            'Team leads may respond to approval-control evidence.',
          ][index],
          exclusions: 'Exclude roles outside the reviewed clinic audience.',
          validationNeeded: [
            'Validate owner fit from qualified intake-demo inquiries.',
            'Validate operations fit from follow-up questions.',
            'Validate team-lead fit from approval-control requests.',
          ][index],
        })),
        adAngles: Array.from({ length: 4 }, (_, index) => ({
          name: `Angle ${index + 1}`,
          audienceHypothesis: `Audience ${(index % 3) + 1}`,
          message: `Review workflow decision ${index + 1} with one distinct evidence frame.`,
          funnelStage: 'consideration',
          proofNeeded: 'Product workflow evidence and a verified demo destination.',
          testVariable: ['problem framing', 'workflow visibility', 'handoff clarity', 'approval control'][index],
          successSignal: `Qualified response signal ${index + 1}`,
          rejectionRule: `Stop angle ${index + 1} when qualified responses do not match its hypothesis.`,
        })),
        adCopyVariations: Array.from({ length: 9 }, (_, index) => ({
          id: String(index + 1),
          angle: `Angle ${(index % 4) + 1}`,
          headline: [
            'See the intake handoff', 'Make follow-up ownership visible', 'Review approval delays',
            'Replace scattered request notes', 'Trace the next patient step', 'Give managers one review view',
            'Prepare a safer demo decision', 'Compare the current workflow', 'Find the missing owner',
          ][index],
          primaryText: [
            'Review how an intake request moves from first contact to the assigned owner.',
            'See where follow-up responsibility can be documented before a workflow change.',
            'Map the approval step that slows a clinic request without claiming a performance gain.',
            'Compare scattered request notes with one reviewable operating path.',
            'Trace the next patient step and identify which role must confirm it.',
            'Give clinic managers one factual view of pending workflow decisions.',
            'Prepare the questions and evidence needed before requesting a product demo.',
            'Compare the current handoff against a documented review checklist.',
            'Identify the unassigned step before changing the clinic workflow.',
          ][index],
          cta: 'Request a demo',
          destination: 'Verified demo destination required before launch.',
          assumption: 'Message fit remains a hypothesis until real response data exists.',
        })),
        creativeBriefs: Array.from({ length: 4 }, (_, index) => ({
          name: `Creative ${index + 1}`,
          angle: `Angle ${index + 1}`,
          format: 'Static workflow comparison',
          visualDirection: [
            'Show a factual intake flow with the source screenshot as the focal evidence.',
            'Use an annotated follow-up queue with no customer or performance claim.',
            'Present an approval timeline using only verified interface states.',
            'Compare two documented workflow states with a neutral evidence caption.',
          ][index],
          requiredAssets: ['Verified product workflow screenshot'],
          assetStatus: 'user_upload_required',
          proofBoundary: 'Do not show unverified customer or outcome claims.',
          reviewGate: 'Approve message, proof, destination, and media before execution.',
        })),
        budgetFramework: 'Use only the reviewed planning envelope; no spend is authorized.',
        trackingChecklist: ['Confirm conversion destination and attribution event.'],
        launchBlockers: ['No launch until tracking, account readiness, and approval are confirmed.'],
      },
    }

    const report = validateCampaignStrategyContract(strategy, { expectedPaidPlanning })
    expect(report.valid).toBe(true)
    expect(report.weakFields).not.toContain('paidPlanning.adCopyVariations.operationalDepth')

    const duplicateIds = {
      ...strategy,
      paidPlanning: {
        ...strategy.paidPlanning,
        adCopyVariations: strategy.paidPlanning.adCopyVariations.map(item => ({ ...item, id: 'A' })),
      },
    }
    expect(validateCampaignStrategyContract(duplicateIds, { expectedPaidPlanning }).weakFields)
      .toContain('paidPlanning.adCopyVariations.ids')
  })

  it('rejects repetitive paid test cells and creative briefs with no asset truth status', () => {
    const expectedPaidPlanning = {
      audienceHypothesisCount: 3,
      paidAdAngleCount: 4,
      paidAdVariationCount: 9,
      creativeBriefCount: 4,
    } as any
    const base = validateCampaignStrategyContract(richStrategy)
    expect(base.valid).toBe(true)

    const repetitive = {
      ...richStrategy,
      paidPlanning: {
        planningOnly: true,
        objective: 'Review message hypotheses.',
        audienceHypotheses: Array.from({ length: 3 }, (_, index) => ({ name: `A${index}`, buyingSituation: 'Reviewing options.', targetingHypothesis: 'Same audience hypothesis.', exclusions: 'Outside scope.', validationNeeded: 'Same validation.' })),
        adAngles: Array.from({ length: 4 }, (_, index) => ({ name: `X${index}`, audienceHypothesis: 'A0', message: 'Same message.', funnelStage: 'consideration', proofNeeded: 'Proof.', testVariable: 'Same variable', successSignal: 'Same signal', rejectionRule: 'Same rule' })),
        adCopyVariations: Array.from({ length: 9 }, (_, index) => ({ id: `${index}`, angle: 'X0', headline: 'Same headline', primaryText: 'Same primary copy for every variation.', cta: 'Review', destination: 'Not enough data', assumption: 'Hypothesis' })),
        creativeBriefs: Array.from({ length: 4 }, (_, index) => ({ name: `C${index}`, angle: 'X0', format: 'Image', visualDirection: 'Same visual.', requiredAssets: ['Product image'], proofBoundary: 'No claims.', reviewGate: 'Review.' })),
        budgetFramework: 'Planning only.',
        trackingChecklist: ['Confirm tracking.'],
        launchBlockers: ['Approval required.'],
      },
    }
    const report = validateCampaignStrategyContract(repetitive, { expectedPaidPlanning })
    expect(report.valid).toBe(false)
    expect(report.weakFields).toEqual(expect.arrayContaining([
      'paidPlanning.audienceHypotheses.distinctTests',
      'paidPlanning.adAngles.distinctTests',
      'paidPlanning.adCopyVariations.distinctCopy',
      'paidPlanning.creativeBriefs.assetStatus',
    ]))
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

  it('rejects a vague success definition and an unlabeled diagnosis', () => {
    const vague = {
      ...richStrategy,
      businessObjective: {
        ...richStrategy.businessObjective,
        successIn30Days: 'Validate market interest and engagement.',
      },
      diagnosisDetails: {
        ...richStrategy.diagnosisDetails,
        basis: '',
        evidenceBasis: '',
      },
    }

    const report = validateCampaignStrategyContract(vague)
    expect(report.valid).toBe(false)
    expect(report.weakFields).toEqual(expect.arrayContaining([
      'businessObjective.measurableSuccessDefinition',
      'diagnosisDetails.truthBasis',
    ]))
  })

  it('accepts a reviewable Arabic success definition with evidence and a decision rule', () => {
    const strategy = {
      ...richStrategy,
      businessObjective: {
        ...richStrategy.businessObjective,
        successIn30Days: 'توثيق جودة استجابة الجمهور لإشارات نية الشراء خلال أول 30 يومًا، ثم نعدّل الرسالة إذا بقيت الاستفسارات غير مؤهلة.',
      },
    }

    const report = validateCampaignStrategyContract(strategy)
    expect(report.weakFields).not.toContain('businessObjective.measurableSuccessDefinition')
    expect(report.valid).toBe(true)
  })

  it('rejects strategy output that does not match the reviewed organic post-count promise', () => {
    const report = validateCampaignStrategyContract(richStrategy, { expectedOrganicPostCount: 7 })

    expect(report.valid).toBe(false)
    expect(report.countViolations).toEqual(['contentAnglesDetailed.count:4/7'])
    expect(() => assertCampaignStrategyContract(richStrategy, { expectedOrganicPostCount: 7 }))
      .toThrow(/count: .*contentAnglesDetailed\.count:4\/7/)
  })

  it('accepts exact organic post-count matches from content angles and weekly deliverables', () => {
    const report = validateCampaignStrategyContract(richStrategy, { expectedOrganicPostCount: 7 })

    expect(report.countViolations).toContain('contentAnglesDetailed.count:4/7')

    const expanded = {
      ...richStrategy,
      contentAnglesDetailed: [
        ...richStrategy.contentAnglesDetailed,
        { ...richStrategy.contentAnglesDetailed[0], title: 'Office objection reply' },
        { ...richStrategy.contentAnglesDetailed[1], title: 'Brew method FAQ' },
        { ...richStrategy.contentAnglesDetailed[2], title: 'Bundle choice guide' },
      ],
    }

    const exact = validateCampaignStrategyContract(expanded, { expectedOrganicPostCount: 7 })
    expect(exact.valid).toBe(true)
    expect(exact.countViolations).toEqual([])
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
        proofNeeded: '',
        responseHandoff: '',
        reviewPoint: '',
      })),
    }

    const report = validateCampaignStrategyContract(weakAngles)
    expect(report.valid).toBe(false)
    expect(report.weakFields).toContain('contentAnglesDetailed.operationalDepth')
  })

  it('rejects strategies with missing asset requirements', () => {
    const weak = { ...richStrategy }
    delete (weak as any).assetRequirements

    const report = validateCampaignStrategyContract(weak)
    expect(report.valid).toBe(false)
    expect(report.missingFields).toContain('assetRequirements')
  })

  it('rejects weekly execution plans missing assets, handoff notes, or review points', () => {
    const weak = {
      ...richStrategy,
      weeklyExecutionPlan: richStrategy.weeklyExecutionPlan.map((week) => ({
        ...week,
        assetsNeeded: [],
        executionNote: '',
        reviewPoints: [],
      })),
    }

    const report = validateCampaignStrategyContract(weak)
    expect(report.valid).toBe(false)
    expect(report.weakFields).toContain('weeklyExecutionPlan.countableDeliverables')
  })
})
