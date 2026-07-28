import { describe, it, expect } from 'vitest'
import {
  buildPaidPlanningRepairPrompt,
  buildPaidPlanningStructuredOutputSchema,
  buildGatewayJsonSystemPrompt,
  buildStrategistCountRepairPrompt,
  buildStrategistPrompts,
  buildStrategistQualityRepairPrompt,
  canUseFocusedPaidQualityRepair,
  getStrategistProviderConfig,
  parseStrategistJsonContent,
  type BusinessBrief,
  type StrategyOutput,
} from '@/lib/agents/strategist'
import { getStrategyDeliverables } from '@/lib/strategy/deliverablesContract'
import type { StrategyOrder, StrategyType, ContentIntensity, DurationPreset } from '@/lib/strategy/strategyOrder'

const order = (
  strategyType: StrategyType,
  contentIntensity: ContentIntensity,
  durationPreset: DurationPreset,
  durationDays?: number,
  customOrganicPostCount?: number,
): StrategyOrder => ({
  strategyType,
  contentIntensity,
  durationPreset,
  durationDays: durationDays ?? (durationPreset === 'custom' ? 45 : Number(durationPreset)),
  customOrganicPostCount: customOrganicPostCount ?? null,
  goal: 'leads',
  language: 'en',
})

/** Build a brief with the deterministic contract attached, the way the route does. */
const briefWith = (o: StrategyOrder, postsPerMonth?: number): BusinessBrief => {
  const d = getStrategyDeliverables(o, typeof postsPerMonth === 'number' ? { postsPerMonth } : undefined)
  return {
    companyName: 'NEXUS AI',
    businessType: 'SaaS',
    targetAudience: 'SME owners',
    monthlyBudget: 5000,
    primaryGoal: 'leads',
    language: 'en',
    strategyType: o.strategyType,
    strategyDuration: o.durationPreset,
    currentPlatforms: ['INSTAGRAM', 'TIKTOK', 'FACEBOOK'],
    strategyOrder: o,
    strategyDeliverables: d,
    generationInstructions: d.generationInstructions,
    organicPostCount: d.organicPostCount,
    detailedCalendarDays: d.detailedCalendarDays,
    roadmapMonths: d.roadmapMonths,
    planCapApplied: d.planCapApplied,
  }
}

describe('buildStrategistCountRepairPrompt', () => {
  it('binds the exact reviewed count without authorizing new facts', () => {
    const prompt = buildStrategistCountRepairPrompt({
      campaignName: 'Dental consultation plan',
      contentAnglesDetailed: [{ title: 'Consultation questions' }],
      weeklyExecutionPlan: [],
    } as unknown as StrategyOutput, 16, undefined, 'organic', [
      'businessObjective.measurableSuccessDefinition',
      'weeklyExecutionPlan.deliverableCount:1/16',
    ])

    expect(prompt).toContain('exactly 16 contentAnglesDetailed entries')
    expect(prompt).toContain('add up to exactly 16 countable organic post directions')
    expect(prompt).toContain('at least 2 distinct audienceSegmentsDetailed entries')
    expect(prompt).toContain('exactly 4 weeklyExecutionPlan entries')
    expect(prompt).toContain('Do not invent proof, services, prices, languages')
    expect(prompt).toContain('businessObjective.measurableSuccessDefinition')
    expect(prompt).toContain('observable baseline or signal plus a decision rule')
    expect(prompt).toContain('diagnosisDetails must label its basis')
    expect(prompt).toContain('Dental consultation plan')
  })
})

describe('buildStrategistQualityRepairPrompt', () => {
  it('binds the exact quality blockers to authoritative Brand Brain facts', () => {
    const brief = {
      ...briefWith(order('full', 'daily', '180'), 3),
      primaryOffer: 'Modular storage for compact homes',
      avoidWords: 'guaranteed, best',
    }
    const prompt = buildStrategistQualityRepairPrompt(
      {
        campaignName: 'Drifted plan',
        contentAnglesDetailed: [{ title: 'Best guaranteed result' }],
        weeklyExecutionPlan: [],
      } as unknown as StrategyOutput,
      brief,
      {
        stage: 'marketing_quality',
        issueCodes: ['unsupported_quality_superlative', 'platform_outside_reviewed_scope'],
        affectedPaths: ['strategy.contentAnglesDetailed[0]', 'strategy.platforms'],
      },
      'Brand: NEXUS AI\nAudience: SME owners\nOffer: Modular storage for compact homes',
    )

    expect(prompt).toContain('QUALITY-GATE REPAIR')
    expect(prompt).toContain('unsupported_quality_superlative')
    expect(prompt).toContain('path:strategy.contentAnglesDetailed[0]')
    expect(prompt).toContain('Allowed platforms only: INSTAGRAM, TIKTOK, FACEBOOK')
    expect(prompt).toContain('Authoritative Brand Brain context')
    expect(prompt).toContain('do not add facts outside it')
    expect(prompt).toContain('without weakening, deleting, or bypassing the reviewed delivery contract')
    expect(prompt).toContain('exactly 3 contentAnglesDetailed entries')
  })

  it('directs a destination-less repair across every public CTA surface', () => {
    const brief = briefWith(order('organic', 'light', '30'))
    const prompt = buildStrategistQualityRepairPrompt(
      {
        campaignName: 'Destination-less plan',
        ctaVariations: ['Book now'],
        contentAnglesDetailed: [{ title: 'Offer guide', cta: 'Browse the collection' }],
        weeklyExecutionPlan: [],
      } as unknown as StrategyOutput,
      brief,
      {
        stage: 'marketing_quality',
        issueCodes: ['conversion_cta_without_destination'],
        affectedPaths: ['strategy.cta'],
      },
    )

    expect(prompt).toContain('no verified conversion destination exists')
    expect(prompt).toContain('rewrite EVERY customer-facing CTA')
    expect(prompt).toContain('offerCTAStrategy, ctaVariations, audienceSegmentsDetailed')
    expect(prompt).toContain('Remove every direct-response instruction')
    expect(prompt).toContain('destination-free actions')
    expect(prompt).toContain('missing conversion path explicit as an unresolved readiness task')
  })

  it('constrains ungrounded context repairs to reviewed audience facts', () => {
    const prompt = buildStrategistQualityRepairPrompt(
      {
        campaignName: 'Audience-drifted plan',
        audienceSegmentsDetailed: [{ segment: 'Working women seeking office wear' }],
        weeklyExecutionPlan: [],
      } as unknown as StrategyOutput,
      briefWith(order('organic', 'light', '30')),
      {
        stage: 'marketing_quality',
        issueCodes: ['ungrounded_brand_context'],
        affectedPaths: ['strategy.audienceSegmentsDetailed[0].segment'],
        issueDetails: [
          'strategy.audienceSegmentsDetailed[0].segment: The strategy adds "office wear" without matching Brand Brain evidence.',
        ],
      },
      'Audience: UAE women aged 25-44 comparing versatile modest wardrobe pieces.',
    )

    expect(prompt).toContain('UNGROUNDED BRAND-CONTEXT REPAIR')
    expect(prompt).toContain('Exact validator findings')
    expect(prompt).toContain('The strategy adds "office wear"')
    expect(prompt).toContain('Do not add occupations, work/office/meeting use')
    expect(prompt).toContain('reuse the reviewed target-audience wording')
    expect(prompt).toContain('Do not invent a new demographic or use case')
  })
})

describe('focused paid-planning repair', () => {
  it('enforces the exact reviewed Paid Standard package through Structured Outputs', () => {
    const brief = briefWith(order('paid', 'standard', '90'))
    const deliverables = brief.strategyDeliverables!
    const responseFormat = buildPaidPlanningStructuredOutputSchema(deliverables) as any
    const paidProperties = responseFormat.json_schema.schema.properties.paidPlanning.properties
    const prompt = buildPaidPlanningRepairPrompt({
      campaignName: 'ClinicFlow paid plan',
      paidPlanning: {
        planningOnly: true,
        objective: 'Generate qualified demo interest',
        audienceHypotheses: [],
        adAngles: [],
        adCopyVariations: [],
        creativeBriefs: [],
        budgetFramework: 'Planning envelope only',
        trackingChecklist: ['Confirm destination'],
        launchBlockers: ['No approved tracking'],
      },
    } as unknown as StrategyOutput, brief, deliverables)

    expect(paidProperties.audienceHypotheses).toMatchObject({ minItems: 3, maxItems: 3 })
    expect(paidProperties.adAngles).toMatchObject({ minItems: 4, maxItems: 4 })
    expect(paidProperties.adCopyVariations).toMatchObject({ minItems: 9, maxItems: 9 })
    expect(paidProperties.creativeBriefs).toMatchObject({ minItems: 4, maxItems: 4 })
    expect(prompt).toContain('Repair ONLY the paidPlanning package')
    expect(prompt).toContain('9 ad copy variations')
    expect(prompt).toContain('A renamed segment with the same test is a duplicate')
    expect(prompt).toContain('Changing only the CTA, opening phrase, or a synonym is a duplicate')
    expect(prompt).toContain('Arabic records must also use genuinely different ideas')
    expect(prompt).toContain('Do not claim launch, spend, publishing')
  })

  it('uses a focused second repair when every final contract issue belongs to paidPlanning', () => {
    const paidBrief = briefWith(order('paid', 'standard', '90'))
    expect(canUseFocusedPaidQualityRepair(paidBrief, {
      stage: 'strategy_contract',
      issueCodes: ['weak:paidPlanning.adCopyVariations.distinctCopy'],
      affectedPaths: ['paidPlanning.adCopyVariations.distinctCopy'],
    })).toBe(true)

    expect(canUseFocusedPaidQualityRepair(paidBrief, {
      stage: 'strategy_contract',
      issueCodes: ['weak:paidPlanning.adCopyVariations.distinctCopy', 'weak:businessObjective.primary'],
      affectedPaths: ['paidPlanning.adCopyVariations.distinctCopy', 'businessObjective.primary'],
    })).toBe(false)

    expect(canUseFocusedPaidQualityRepair(paidBrief, {
      stage: 'marketing_quality',
      issueCodes: ['ungrounded_brand_context'],
      affectedPaths: ['strategy.paidPlanning.creativeBriefs[0].visualDirection'],
    })).toBe(true)
  })

  it('directs a focused paid quality repair to the exact grounded visual paths', () => {
    const paidBrief = briefWith(order('paid', 'standard', '90'))
    const prompt = buildPaidPlanningRepairPrompt(
      {
        campaignName: 'Paid planning',
        paidPlanning: {
          planningOnly: true,
          creativeBriefs: [{
            name: 'Office concept',
            angle: 'Trust',
            format: 'Static',
            visualDirection: 'A professional in an office',
            requiredAssets: ['Product image'],
            assetStatus: 'user_upload_required',
            proofBoundary: 'No proof supplied',
            reviewGate: 'User review',
          }],
        },
      } as unknown as StrategyOutput,
      paidBrief,
      paidBrief.strategyDeliverables!,
      {
        stage: 'marketing_quality',
        issueCodes: ['ungrounded_brand_context'],
        affectedPaths: ['strategy.paidPlanning.creativeBriefs[0].visualDirection'],
        issueDetails: ['The office setting is absent from Brand Brain.'],
      },
      'Audience: UAE women comparing modest wardrobe pieces.',
    )

    expect(prompt).toContain('Repair trigger: marketing_quality')
    expect(prompt).toContain('strategy.paidPlanning.creativeBriefs[0].visualDirection')
    expect(prompt).toContain('The office setting is absent from Brand Brain.')
    expect(prompt).toContain('Authoritative Brand Brain context')
    expect(prompt).toContain('must not invent a location, lifestyle, occupation')
    expect(prompt).toContain('use a neutral studio/layout direction')
  })
})

const sys = (b: BusinessBrief) => buildStrategistPrompts(b).systemPrompt
const user = (b: BusinessBrief) => buildStrategistPrompts(b).userPrompt

describe('strategist AI provider routing', () => {
  it('prefers Vercel OIDC and configures a gateway fallback model', () => {
    expect(getStrategistProviderConfig({
      VERCEL_OIDC_TOKEN: 'oidc-token',
      OPENAI_API_KEY: 'revoked-long-lived-key',
    })).toMatchObject({
      endpoint: 'https://ai-gateway.vercel.sh/v1/chat/completions',
      token: 'oidc-token',
      model: 'openai/gpt-4o',
      providerName: 'Vercel AI Gateway',
      supportsResponseFormat: false,
      fallbackModels: ['openai/gpt-4.1-mini'],
    })
  })

  it('retains direct OpenAI as a backwards-compatible fallback', () => {
    expect(getStrategistProviderConfig({
      OPENAI_API_KEY: 'active-openai-key',
    })).toMatchObject({
      endpoint: 'https://api.openai.com/v1/chat/completions',
      token: 'active-openai-key',
      model: 'gpt-4o',
      providerName: 'OpenAI',
      supportsResponseFormat: true,
      fallbackModels: [],
    })
  })

  it('injects structured-output schemas into the gateway prompt', () => {
    const prompt = buildGatewayJsonSystemPrompt('System', {
      type: 'json_schema',
      json_schema: {
        schema: {
          type: 'object',
          properties: { paidPlanning: { type: 'object' } },
          required: ['paidPlanning'],
        },
      },
    })

    expect(prompt).toContain('JSON OUTPUT CONTRACT (binding)')
    expect(prompt).toContain('"required":["paidPlanning"]')
    expect(prompt).toContain('Return raw JSON only')
  })

  it('accepts raw and fenced JSON from OpenAI-compatible providers', () => {
    expect(parseStrategistJsonContent('{"ok":true}')).toEqual({ ok: true })
    expect(parseStrategistJsonContent('```json\n{"ok":true}\n```')).toEqual({ ok: true })
  })
})

describe('buildStrategistPrompts — binding scope wiring', () => {
  it('includes the binding-scope header when generationInstructions is present', () => {
    const s = sys(briefWith(order('organic', 'standard', '90')))
    expect(s).toContain('BINDING GENERATION SCOPE')
    expect(s).toContain('The following scope is binding. Do not exceed it.')
    expect(s).toMatch(/label it as "not included"/i)
  })

  it('back-compat: NO binding block when generationInstructions is absent', () => {
    const b: BusinessBrief = {
      companyName: 'X', businessType: 'Y', targetAudience: 'Z', monthlyBudget: 1000, language: 'en',
    }
    const s = sys(b)
    expect(s).not.toContain('BINDING GENERATION SCOPE')
    // existing prompt still intact
    expect(s).toContain('expert marketing strategist')
  })

  it('keeps paid-only planning free of an organic content-angle instruction', () => {
    const b = briefWith(order('paid', 'standard', '90'))
    b.planTier = 'business'
    const prompt = sys(b)

    expect(prompt).toContain('Monthly post quota: 40 posts/month')
    expect(prompt).toContain('Organic content directions in this run: 0')
    expect(prompt).toContain('Do not create an organic publishing calendar')
    expect(prompt).not.toContain('Monthly post quota: 60 posts/month')
  })
})

describe('buildStrategistPrompts — 30 / 90 / 180 horizon', () => {
  it('3+4. 90-day: first-30-day execution outline + no day-by-day for the full 90-day horizon', () => {
    const s = sys(briefWith(order('organic', 'standard', '90')))
    expect(s).toMatch(/FIRST-30-DAY STRATEGY EXECUTION OUTLINE/i)
    expect(s).toMatch(/do NOT generate posts for every day of the full 90-day horizon/i)
    expect(s).toMatch(/does NOT create a saved Content Hub content calendar/i)
  })

  it('3+4. 180-day: first-30-day execution outline + no day-by-day for the full 180-day horizon', () => {
    const s = sys(briefWith(order('organic', 'standard', '180')))
    expect(s).toMatch(/FIRST-30-DAY STRATEGY EXECUTION OUTLINE/i)
    expect(s).toMatch(/do NOT generate posts for every day of the full 180-day horizon/i)
    expect(s).toContain('6-month roadmap')
  })

  it('5. never imply all days are scheduled/published (90/180)', () => {
    expect(sys(briefWith(order('organic', 'standard', '90')))).toMatch(/do NOT imply that all days .* are scheduled or published/i)
    expect(sys(briefWith(order('full', 'growth', '180')))).toMatch(/do NOT imply that all days .* are scheduled or published/i)
  })

  it('30-day: detailed full window, no multi-month roadmap sentence', () => {
    const s = sys(briefWith(order('organic', 'standard', '30')))
    expect(s).toMatch(/detailed strategy and execution outline for the full 30 days/i)
    expect(s).not.toMatch(/month roadmap\. Generate a DETAILED/i) // no multi-month block
  })
})

describe('buildStrategistPrompts — Paid enforcement', () => {
  const s = sys(briefWith(order('paid', 'standard', '90')))
  it('6. planning-only', () => {
    expect(s).toMatch(/PLANNING-ONLY/i)
  })
  it('7. no launch / spend / publish / activation', () => {
    expect(s).toMatch(/never describe how to launch\/activate ads/i)
    expect(s).toMatch(/never spend budget/i)
    expect(s).toMatch(/never publish/i)
    // generic binding safety line also asserts activation + publish
    expect(s).toMatch(/campaigns will be activated/i)
    expect(s).toMatch(/scheduled\/published/i)
  })
  it('8. no fake performance projections', () => {
    expect(s).toMatch(/never invent performance numbers/i)
    expect(s).toMatch(/Performance projections \/ invented metrics/i) // excluded list
  })
})

describe('buildStrategistPrompts — Full + Organic enforcement', () => {
  it('9. full: do not blindly double outputs', () => {
    expect(sys(briefWith(order('full', 'standard', '90')))).toMatch(/do NOT blindly double outputs/i)
  })

  it('10. organic excludes paid launch/spend', () => {
    const s = sys(briefWith(order('organic', 'standard', '90')))
    expect(s).toContain('Paid campaign plan') // listed under NOT included
    expect(s).toMatch(/ads will launch, budget will be spent/i)
  })

  it('organic channel mix uses effort share, not budget allocation', () => {
    const b = briefWith(order('organic', 'standard', '90'))
    expect(sys(b)).toMatch(/Organic-only mode is not paid planning/i)
    expect(sys(b)).toMatch(/effortSharePercent only/i)
    expect(user(b)).toContain('"effortSharePercent"')
    expect(user(b)).not.toContain('"budgetPercent"')
  })

  it('paid planning may still use budgetPercent as a planning assumption', () => {
    const b = briefWith(order('paid', 'standard', '90'))
    expect(user(b)).toContain('"budgetPercent"')
    expect(user(b)).toContain('planning assumption only')
  })
})

describe('buildStrategistPrompts — content intensity / plan cap', () => {
  it('11. includes the fixed organic direction count (Organic Standard 90 = 16)', () => {
    const s = sys(briefWith(order('organic', 'standard', '90')))
    expect(s).toMatch(/exactly 16 post directions/i)
    expect(s).toMatch(/return exactly 16 contentAnglesDetailed entries/i)
    expect(s).toMatch(/weeklyExecutionPlan\.deliverables add up to exactly 16/i)
  })

  it('11. a different intensity yields a different direction count (Organic Light 90 = 10)', () => {
    expect(sys(briefWith(order('organic', 'light', '90')))).toMatch(/exactly 10 post directions/i)
  })

  it('12. states the plan cap honestly when planCapApplied (growth 25 capped to 10)', () => {
    const s = sys(briefWith(order('organic', 'growth', '90'), 10))
    expect(s).toMatch(/capped by the plan quota 10/i)
    expect(s).toMatch(/exactly 10 post directions/i) // capped count, not requested 25
  })

  it('platform variants framed as adaptations', () => {
    expect(sys(briefWith(order('organic', 'standard', '90')))).toMatch(/Platform variants are ADAPTATIONS/i)
  })

  it('uses exact custom post count as the binding organic direction count', () => {
    const s = sys(briefWith(order('organic', 'daily', '90', undefined, 7)))
    expect(s).toMatch(/exact custom post count/)
    expect(s).toMatch(/exactly 7 post directions/)
    expect(s).toMatch(/return exactly 7 contentAnglesDetailed entries/i)
    expect(s).toMatch(/weeklyExecutionPlan\.deliverables add up to exactly 7/i)
    expect(s).not.toMatch(/exactly 30 post directions/)
  })

  it('binds execution fields to active platforms only', () => {
    const s = sys(briefWith(order('organic', 'standard', '90')))
    expect(s).toMatch(/Allowed content platforms from Brand Brain: INSTAGRAM, TIKTOK, FACEBOOK/)
    expect(s).toMatch(/Use ONLY these platforms in channelMix/)
    expect(s).toMatch(/Do not add Pinterest/)
  })

  it('blocks unsupported download CTAs unless a download asset is provided', () => {
    const s = sys(briefWith(order('organic', 'standard', '30')))
    expect(s).toMatch(/Do not use CTAs like "Download now"/)
    expect(s).toMatch(/Do not invent a downloadable asset/)
  })

  it('requires at least 3 concrete review-safe readiness checklist items', () => {
    const s = sys(briefWith(order('organic', 'standard', '30')))
    expect(s).toMatch(/readinessChecklist must contain at least 3 concrete/)
    expect(s).toMatch(/done=false/)
    expect(s).toMatch(/must not claim that assets, proof, tracking, publishing, scheduling, or platform setup are already complete/)
  })

  it('requires an agency-grade operating brief instead of generic strategy prose', () => {
    const b = briefWith(order('organic', 'standard', '30'))
    const { systemPrompt, userPrompt } = buildStrategistPrompts(b)

    expect(systemPrompt).toMatch(/PROFESSIONAL STRATEGY OPERATING BRIEF CONTRACT/)
    expect(systemPrompt).toMatch(/agency-grade operating brief for a real marketing team/)
    expect(systemPrompt).toMatch(/handoff after the CTA/)
    expect(systemPrompt).toMatch(/response\/follow-up handoff/)
    expect(systemPrompt).toMatch(/proof\/compliance boundaries/)
    expect(systemPrompt).toMatch(/Do not use theme-only deliverables/)
    expect(systemPrompt).toMatch(/meaningfully distinct/)
    expect(systemPrompt).toMatch(/desiredOutcome, objection, asset, proofNeeded, responseHandoff, and reviewPoint/)
    expect(systemPrompt).toMatch(/proofNeeded/)
    expect(systemPrompt).toMatch(/assetRequirements is required/)
    expect(systemPrompt).toMatch(/Do not shorten later weeks into partial objects/)
    expect(userPrompt).toMatch(/response owner\/follow-up handoff/)
    expect(userPrompt).toMatch(/what a marketer should check before repeating or scaling/)
    expect(userPrompt).toMatch(/"desiredOutcome"/)
    expect(userPrompt).toMatch(/"objection"/)
    expect(userPrompt).toMatch(/"proofNeeded"/)
    expect(userPrompt).toMatch(/"responseHandoff"/)
    expect(userPrompt).toMatch(/"reviewPoint"/)
    expect(userPrompt).toMatch(/"assetRequirements"/)
    expect(userPrompt).toMatch(/"assetsNeeded": \["string/)
    expect(userPrompt).toMatch(/"executionNote": "string"/)
  })

  it('adds an Arabic binding rule for Arabic strategy output', () => {
    const b = briefWith({ ...order('organic', 'standard', '30'), language: 'ar' })
    b.language = 'ar'
    const s = sys(b)
    expect(s).toMatch(/Arabic language is binding/)
    expect(s).toMatch(/ARABIC OUTPUT CONTRACT/)
    expect(s).toMatch(/Every user-facing JSON value must be written in natural Modern Standard Arabic/)
    expect(s).toMatch(/English Brand Context, source notes, field labels, and schema descriptions are source\/instruction text only/)
    expect(s).toMatch(/Do not output English fallback format labels/)
    expect(s).toMatch(/"Carousel or short social post"/)
    expect(s).toMatch(/"فيديو قصير"/)
    expect(s).toContain('استراتيجية نمو عضوي لـ BrightNest Home Care')
    expect(s).toContain('احجز خدمة التنظيف عبر WhatsApp بخطوة بسيطة')
    expect(s).toContain('تجهيز خطة اتجاهات المحتوى لأول 30 يومًا على Instagram وFacebook')
    expect(s).toMatch(/schema description below is in English/)
  })

  it('repeats the Arabic output contract before the JSON schema so English field descriptions are not copied', () => {
    const b = briefWith({ ...order('organic', 'standard', '30'), language: 'ar' })
    b.language = 'ar'
    const { userPrompt } = buildStrategistPrompts(b)
    const contractIndex = userPrompt.indexOf('ARABIC OUTPUT CONTRACT')
    const schemaIndex = userPrompt.indexOf('Return JSON with these exact fields')
    expect(contractIndex).toBeGreaterThan(-1)
    expect(schemaIndex).toBeGreaterThan(contractIndex)
    expect(userPrompt).toMatch(/If a schema description below is in English/)
    expect(userPrompt).toMatch(/Arabic label if Arabic output is selected/)
    expect(userPrompt).toMatch(/do not use English fallback labels in Arabic output/)
  })
})
