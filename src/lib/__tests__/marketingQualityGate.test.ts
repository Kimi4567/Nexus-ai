import { describe, expect, it } from 'vitest'
import {
  isPersistedMarketingQualityGatePassed,
  reviewBrandTruthConsistency,
  reviewStrategyGrounding,
} from '@/lib/ai/marketingQualityGate'

const dentalBrand = {
  brandName: 'Noura Dental Studio',
  industry: 'Dental clinic',
  description: 'A local dental clinic offering consultations and treatment planning.',
  primaryOffer: 'Book a dental consultation',
  targetAudience: 'Adults aged 25-54 in Abu Dhabi who want clear treatment guidance.',
  audienceAge: '25-54',
  audiencePainPoints: ['Unclear treatment options'],
  audienceDesires: ['A confident consultation decision'],
  conversionDestination: 'https://example.test/book-consultation',
  topPlatforms: ['INSTAGRAM', 'FACEBOOK'],
  verifiedProof: [],
}

const groundedStrategy = {
  positioning: 'Clear dental consultation guidance for adults in Abu Dhabi.',
  keyMessage: 'Understand your dental treatment options before booking.',
  differentiation: 'A consultation-first dental experience with clear next steps.',
  targetAudienceRefined: 'Adults aged 25-54 in Abu Dhabi.',
  contentPillars: ['Dental education', 'Consultation preparation', 'Treatment options'],
  topHooks: ['Not sure what to ask your dentist?'],
  ctaVariations: ['Book a dental consultation'],
  contentAnglesDetailed: [{
    title: 'Questions for your dental consultation',
    hook: 'Bring these questions to your dentist.',
    pain: 'Treatment options can feel unclear.',
    desiredOutcome: 'A more informed consultation.',
    objection: 'I do not know where to begin.',
    platform: 'INSTAGRAM',
    cta: 'Book a dental consultation',
  }],
}

describe('marketingQualityGate', () => {
  it('blocks contradictory structured and narrative audience ages', () => {
    const report = reviewBrandTruthConsistency({
      ...dentalBrand,
      audienceAge: '45-54',
    }, '2026-07-14T00:00:00.000Z')

    expect(report.status).toBe('blocked')
    expect(report.blockers.map(item => item.code)).toContain('brand_age_range_conflict')
  })

  it('accepts a narrative age range covered by multiple reviewed age bands', () => {
    const report = reviewBrandTruthConsistency({
      ...dentalBrand,
      targetAudience: 'Adults aged 25-44 in Abu Dhabi who want clear treatment guidance.',
      audienceAge: '25-34, 35-44, 45-54',
    }, '2026-07-20T00:00:00.000Z')

    expect(report.blockers.map(item => item.code)).not.toContain('brand_age_range_conflict')
  })

  it('blocks strategy readiness when the saved industry conflicts with the business description', () => {
    const report = reviewBrandTruthConsistency({
      ...dentalBrand,
      industry: 'Health & Beauty',
    }, '2026-07-14T00:00:00.000Z')

    expect(report.status).toBe('blocked')
    expect(report.blockers.map(item => item.code)).toContain('brand_industry_too_broad_or_misaligned')
  })

  it('accepts vertical SaaS when customer-domain words also appear in the profile', () => {
    const report = reviewBrandTruthConsistency({
      brandName: 'ClinicFlow UAE',
      industry: 'Software & Tech',
      description: 'A B2B SaaS platform for private dental clinics that manages appointments and front-desk workflows.',
      primaryOffer: 'Monthly clinic operations software subscription.',
      targetAudience: 'Owners and managers of dental clinics in the UAE.',
      verifiedProof: [],
    }, '2026-07-16T00:00:00.000Z')

    expect(report.status).toBe('passed')
    expect(report.blockers.map(item => item.code)).not.toContain('brand_industry_too_broad_or_misaligned')
  })

  it('does not mistake ordinary property details in a home-service brief for real estate', () => {
    const report = reviewBrandTruthConsistency({
      brandName: 'TidyHarbor Home Care',
      industry: 'Home cleaning services',
      description: 'A cleaner confirms property details and home size before accepting a booking.',
      primaryOffer: 'A scoped home-cleaning booking.',
      targetAudience: 'Apartment and villa residents comparing cleaning services.',
    })

    expect(report.blockers.map(item => item.code)).not.toContain('brand_industry_too_broad_or_misaligned')
  })

  it('does not mistake Arabic home property details for an Arabic real-estate business', () => {
    const report = reviewBrandTruthConsistency({
      brandName: 'بيت مرتب',
      industry: 'خدمات تنظيف المنازل',
      description: 'خدمة تنظيف تؤكد تفاصيل العقار وحجم المنزل قبل قبول الحجز.',
      primaryOffer: 'حجز تنظيف منزلي محدد النطاق.',
      targetAudience: 'سكان الشقق والفلل ممن يقارنون خدمات التنظيف.',
    })

    expect(report.blockers.map(item => item.code)).not.toContain('brand_industry_too_broad_or_misaligned')
  })

  it('allows missing proof as a visible limitation rather than inventing it', () => {
    const report = reviewStrategyGrounding({
      strategy: groundedStrategy,
      brand: dentalBrand,
      allowedPlatforms: ['INSTAGRAM', 'FACEBOOK'],
      checkedAt: '2026-07-14T00:00:00.000Z',
    })

    expect(report.status).toBe('passed')
    expect(report.warnings.map(item => item.code)).toContain('verified_proof_missing')
    expect(isPersistedMarketingQualityGatePassed(report)).toBe(true)
  })

  it('blocks customer-facing internal workflow copy for a dental provider', () => {
    const report = reviewStrategyGrounding({
      strategy: {
        ...groundedStrategy,
        contentAnglesDetailed: [{
          ...groundedStrategy.contentAnglesDetailed[0],
          title: 'Fix the front desk handoff',
          hook: 'Leadership sees the handoff problem at the team meeting.',
          cta: 'Compare the current workflow and save this idea for review.',
        }],
      },
      brand: dentalBrand,
      allowedPlatforms: ['INSTAGRAM'],
      checkedAt: '2026-07-14T00:00:00.000Z',
    })

    expect(report.status).toBe('blocked')
    expect(report.blockers.map(item => item.code)).toContain('customer_copy_drifted_to_internal_operations')
  })

  it('blocks audience expansion and channels that were never reviewed', () => {
    const report = reviewStrategyGrounding({
      strategy: {
        ...groundedStrategy,
        targetAudienceRefined: 'Families with children who recently moved to Abu Dhabi.',
        contentAnglesDetailed: [{
          ...groundedStrategy.contentAnglesDetailed[0],
          platform: 'LINKEDIN',
        }],
      },
      brand: dentalBrand,
      allowedPlatforms: ['INSTAGRAM'],
      checkedAt: '2026-07-14T00:00:00.000Z',
    })

    expect(report.status).toBe('blocked')
    expect(report.blockers.map(item => item.code)).toContain('ungrounded_audience_expansion')
    expect(report.blockers.map(item => item.code)).toContain('platform_outside_reviewed_scope')
  })

  it('does not mistake أسرع for an unsupported family audience', () => {
    const report = reviewStrategyGrounding({
      strategy: {
        ...groundedStrategy,
        positioning: 'قرارات أسرع لأصحاب الشركات عند مراجعة التدفق النقدي.',
        keyMessage: 'راجع الفواتير والتدفق النقدي لاتخاذ قرار أسرع.',
      },
      brand: {
        ...dentalBrand,
        brandName: 'ميزان فلو',
        industry: 'برمجيات إدارة التدفق النقدي',
        description: 'منصة تساعد أصحاب الشركات على مراجعة الفواتير والتدفق النقدي.',
        primaryOffer: 'تجربة مجانية لمدة 14 يومًا مع الإعداد.',
        targetAudience: 'أصحاب الشركات والمديرون الماليون في شركات الخدمات والتقنية.',
      },
      allowedPlatforms: ['INSTAGRAM'],
      checkedAt: '2026-07-30T00:00:00.000Z',
    })

    expect(report.blockers.map(item => item.code)).not.toContain('ungrounded_audience_expansion')
  })

  it('blocks a strategy that contradicts the reviewed conversion path, goal, or response owner', () => {
    const report = reviewStrategyGrounding({
      strategy: {
        ...groundedStrategy,
        businessObjective: {
          primary: 'Increase demo bookings',
          marketing: 'Increase awareness',
          conversionAction: 'The conversion destination is not set yet.',
          expectedUserAction: 'Confirm the destination before execution.',
        },
        contentAnglesDetailed: [{
          ...groundedStrategy.contentAnglesDetailed[0],
          responseHandoff: 'Customer success follows the saved process.',
        }],
        riskNotes: ['Funnel risk with missing conversion destination.'],
        funnelStages: [{
          nextStep: 'Sales team engages with article readers.',
        }],
      },
      brand: {
        ...dentalBrand,
        businessGoal: 'Book 30 qualified demos in 90 days and convert 20% to paid subscriptions.',
        conversionDestination: 'Bilingual landing page with a demo form and WhatsApp handoff.',
        leadHandling: 'Customer success qualifies each request and books the setup session.',
      },
      goal: 'leads',
      allowedPlatforms: ['INSTAGRAM'],
      checkedAt: '2026-07-30T00:00:00.000Z',
    })

    const codes = report.blockers.map(item => item.code)
    expect(codes).toContain('known_conversion_destination_marked_missing')
    expect(report.blockers.some(item => item.path === 'strategy.riskNotes[0]')).toBe(true)
    expect(codes).toContain('business_goal_drift')
    expect(codes).toContain('lead_handoff_conflicts_with_brand')
  })

  it('still blocks أسر as an explicit unsupported family audience', () => {
    const report = reviewStrategyGrounding({
      strategy: {
        ...groundedStrategy,
        targetAudienceRefined: 'أسر في أبوظبي تبحث عن إرشاد علاجي واضح.',
      },
      brand: dentalBrand,
      allowedPlatforms: ['INSTAGRAM'],
      checkedAt: '2026-07-30T00:00:00.000Z',
    })

    expect(report.blockers.map(item => item.code)).toContain('ungrounded_audience_expansion')
  })

  it('blocks a reviewed platform that disappears from the strategy plan', () => {
    const report = reviewStrategyGrounding({
      strategy: groundedStrategy,
      brand: dentalBrand,
      allowedPlatforms: ['INSTAGRAM', 'PINTEREST'],
      requireAllReviewedPlatforms: true,
      checkedAt: '2026-07-18T00:00:00.000Z',
    })

    expect(report.status).toBe('blocked')
    expect(report.blockers.map(item => item.code)).toContain('reviewed_platform_missing_from_strategy')
  })

  it('does not falsely reject a grounded English strategy translated from Arabic Brand Brain', () => {
    const report = reviewStrategyGrounding({
      strategy: {
        ...groundedStrategy,
        positioning: 'Interior-design planning for homeowners reviewing how their space should work before execution.',
        keyMessage: 'Review the proposed space, materials, and next decision before implementation.',
        differentiation: 'A design-first review process shaped around the room and the homeowner brief.',
        targetAudienceRefined: 'Homeowners in the UAE planning an interior-design project.',
        contentPillars: ['Space planning', 'Material decisions', 'Design review'],
        topHooks: ['What should you review before approving an interior concept?'],
        ctaVariations: ['Review the design brief'],
        contentAnglesDetailed: [{
          title: 'Review the room before implementation',
          hook: 'Start with the space and the decisions it needs.',
          pain: 'Homeowners may struggle to visualize the plan before execution.',
          desiredOutcome: 'A clearer design review.',
          objection: 'I am not sure where to start.',
          platform: 'INSTAGRAM',
          cta: 'Review the design brief',
        }],
      },
      brand: {
        brandName: 'دار سُكنى',
        industry: 'التصميم الداخلي',
        description: 'استوديو تصميم داخلي يساعد أصحاب المنازل على مراجعة تصور المساحة قبل التنفيذ.',
        primaryOffer: 'تصميم داخلي وتخطيط المساحات للمنازل.',
        targetAudience: 'أصحاب المنازل في الإمارات الذين يخططون لمشروع تصميم داخلي.',
        audiencePainPoints: ['صعوبة تصور المساحة قبل التنفيذ'],
        audienceDesires: ['قرار تصميم أوضح قبل بدء التنفيذ'],
        topPlatforms: ['INSTAGRAM'],
        verifiedProof: [],
      },
      allowedPlatforms: ['INSTAGRAM'],
      checkedAt: '2026-07-22T00:00:00.000Z',
    })

    expect(report.blockers.map(item => item.code)).not.toContain('strategy_missing_brand_relevance')
    expect(report.warnings.map(item => item.code)).toContain('cross_language_relevance_requires_review')
  })

  it('still blocks an unrelated strategy when Brand Brain and output use the same language', () => {
    const report = reviewStrategyGrounding({
      strategy: {
        ...groundedStrategy,
        positioning: 'Monthly roasted-bean deliveries for workplace kitchens.',
        keyMessage: 'Choose a roast and receive recurring deliveries.',
        differentiation: 'Curated beans delivered on a monthly cadence.',
        targetAudienceRefined: 'Workplace managers buying roasted beans.',
        contentPillars: ['Roast profiles', 'Bean delivery'],
        topHooks: ['Which roast fits the workplace kitchen?'],
        ctaVariations: ['Explore roast profiles'],
        contentAnglesDetailed: [{
          title: 'Coffee roast selection',
          hook: 'Review the roast before subscribing.',
          pain: 'Roast profiles feel confusing.',
          desiredOutcome: 'A simpler recurring delivery.',
          objection: 'We do not know which roast to choose.',
          platform: 'INSTAGRAM',
          cta: 'Explore roast profiles',
        }],
      },
      brand: dentalBrand,
      allowedPlatforms: ['INSTAGRAM'],
      checkedAt: '2026-07-22T00:00:00.000Z',
    })

    expect(report.blockers.map(item => item.code)).toContain('strategy_missing_brand_relevance')
  })

  it('blocks unsourced platform-growth claims and allows an explicit validation hypothesis', () => {
    const unsourced = reviewStrategyGrounding({
      strategy: {
        ...groundedStrategy,
        channelMix: [{
          platform: 'INSTAGRAM',
          rationale: 'Instagram is the highest-engagement and most effective platform for this category.',
          contentFrequency: 'Review after evidence exists',
        }],
      },
      brand: dentalBrand,
      allowedPlatforms: ['INSTAGRAM'],
      checkedAt: '2026-07-18T00:00:00.000Z',
    })
    expect(unsourced.blockers.map(item => item.code)).toContain('unsourced_channel_market_claim')

    const hypothesis = reviewStrategyGrounding({
      strategy: {
        ...groundedStrategy,
        channelMix: [{
          platform: 'INSTAGRAM',
          rationale: 'Planning hypothesis to validate: Instagram may be a high-engagement review surface for the saved audience.',
          contentFrequency: 'Review after evidence exists',
        }],
      },
      brand: dentalBrand,
      allowedPlatforms: ['INSTAGRAM'],
      checkedAt: '2026-07-18T00:00:00.000Z',
    })
    expect(hypothesis.blockers.map(item => item.code)).not.toContain('unsourced_channel_market_claim')
  })

  it('blocks unsupported quality facts but treats unreviewed premium positioning as a warning', () => {
    const report = reviewStrategyGrounding({
      strategy: {
        ...groundedStrategy,
        keyMessage: 'Experience the freshest premium care in Abu Dhabi.',
      },
      brand: dentalBrand,
      allowedPlatforms: ['INSTAGRAM'],
      checkedAt: '2026-07-14T00:00:00.000Z',
    })

    expect(report.status).toBe('blocked')
    expect(report.blockers.filter(item => item.code === 'unsupported_quality_superlative')).toHaveLength(1)
    expect(report.warnings.filter(item => item.code === 'unverified_premium_positioning')).toHaveLength(1)
  })

  it('preserves a user-supplied premium position', () => {
    const report = reviewStrategyGrounding({
      strategy: { ...groundedStrategy, positioning: 'Premium consultation guidance for adults.' },
      brand: { ...dentalBrand, description: 'A premium dental consultation studio.' },
      allowedPlatforms: ['INSTAGRAM'],
      checkedAt: '2026-07-14T00:00:00.000Z',
    })

    expect(report.blockers.map(item => item.code)).not.toContain('unsupported_quality_superlative')
    expect(report.warnings.map(item => item.code)).not.toContain('unverified_premium_positioning')
  })

  it('preserves reviewed price positioning and visual style as approved brand context', () => {
    const report = reviewStrategyGrounding({
      strategy: {
        ...groundedStrategy,
        positioning: 'Premium consultation guidance with a visual direction that feels فاخرة.',
      },
      brand: {
        ...dentalBrand,
        pricePoint: 'premium',
        visualStyle: 'فاخرة',
      },
      allowedPlatforms: ['INSTAGRAM'],
      checkedAt: '2026-07-20T00:00:00.000Z',
    })

    expect(report.blockers.map(item => item.code)).not.toContain('unsupported_quality_superlative')
    expect(report.warnings.map(item => item.code)).not.toContain('unverified_premium_positioning')
  })

  it('does not treat an explicit do-not-use instruction as customer-facing superiority', () => {
    const report = reviewStrategyGrounding({
      strategy: {
        ...groundedStrategy,
        keyMessage: 'عدم استخدام كلمات مثل الأفضل أو مثالية بدون دليل.',
      },
      brand: dentalBrand,
      allowedPlatforms: ['INSTAGRAM'],
      checkedAt: '2026-07-22T00:00:00.000Z',
    })

    expect(report.blockers.map(item => item.code)).not.toContain('unsupported_quality_superlative')
  })

  it('reviews customer-facing paid copy while excluding paid planning safeguards', () => {
    const report = reviewStrategyGrounding({
      strategy: {
        ...groundedStrategy,
        paidPlanning: {
          launchBlockers: ['لا تدعي أننا الأفضل قبل توثيق الدليل.'],
          creativeBriefs: [{
            visualDirection: 'استخدمي عبارة الأفضل في أبوظبي داخل التصميم.',
            proofBoundary: 'عدم استخدام نتائج مضمونة.',
          }],
          adCopyVariations: [{
            headline: 'Premium consultation support',
            primaryText: 'Prepare for a clear dental consultation.',
            cta: 'Book a dental consultation',
          }],
        },
      },
      brand: dentalBrand,
      allowedPlatforms: ['INSTAGRAM'],
      checkedAt: '2026-07-22T00:00:00.000Z',
    })

    expect(report.blockers.map(item => item.path)).toContain(
      'strategy.paidPlanning.creativeBriefs[0].visualDirection',
    )
    expect(report.blockers.map(item => item.path)).not.toContain(
      'strategy.paidPlanning.launchBlockers[0]',
    )
    expect(report.warnings.map(item => item.code)).toContain('unverified_premium_positioning')
  })

  it('blocks the audited Luma semantic drifts with exact customer-copy paths', () => {
    const lumaBrand = {
      brandName: 'Luma Roast Lab',
      industry: 'اشتراك قهوة مختصة',
      description: 'اشتراك شهري في قهوة محمصة حديثًا داخل دبي.',
      primaryOffer: 'اشتراك 1 كجم شهريًا مقابل 149 درهمًا مع التوصيل خلال 48 ساعة.',
      targetAudience: 'سكان دبي الذين يشترون القهوة المختصة للمنزل.',
      audiencePainPoints: ['صعوبة اختيار نوع القهوة المناسب للذوق'],
      audienceDesires: ['اختيار أوضح واشتراك شهري بسيط'],
      conversionDestination: 'https://example.test/luma-subscription',
      businessGoal: 'طلبات اشتراك مؤهلة داخل دبي.',
      topPlatforms: ['INSTAGRAM'],
      verifiedProof: [],
    }
    const report = reviewStrategyGrounding({
      strategy: {
        ...groundedStrategy,
        positioning: 'اشتراك قهوة مختصة لسكان دبي.',
        keyMessage: 'قهوتك تُحمص مباشرة قبل التوصيل.',
        differentiation: 'اشتراك شهري بوزن 1 كجم مقابل 149 درهمًا.',
        targetAudienceRefined: 'سكان دبي الذين يشترون القهوة المختصة للمنزل.',
        contentPillars: ['اختيار القهوة', 'قصص نجاح عملائنا', 'تفاصيل الاشتراك'],
        topHooks: ['اكتشف الفرق في فنجانك اليوم.'],
        ctaVariations: ['راجع تفاصيل الاشتراك'],
        businessObjective: {
          primary: 'زيادة الحصة السوقية في دبي.',
          marketing: 'توليد طلبات اشتراك مؤهلة.',
          conversionAction: 'مراجعة الاشتراك.',
          expectedUserAction: 'فتح صفحة الاشتراك.',
        },
        contentAnglesDetailed: [{
          title: 'قهوة تساعد على تحسين التركيز في المكتب',
          hook: 'استمع إلى تجارب عملائنا.',
          pain: 'عدم معرفة تاريخ التحميص قبل الطلب.',
          desiredOutcome: 'اختيار قهوة للمنزل.',
          objection: 'هل يناسبني الاشتراك؟',
          platform: 'INSTAGRAM',
          cta: 'راجع تفاصيل الاشتراك',
        }],
      },
      brand: lumaBrand,
      allowedPlatforms: ['INSTAGRAM'],
      checkedAt: '2026-07-22T00:00:00.000Z',
    })

    const blockerPaths = report.blockers.map(item => item.path)
    expect(blockerPaths).toContain('strategy.keyMessage')
    expect(blockerPaths).toContain('strategy.contentPillars')
    expect(blockerPaths).toContain('strategy.businessObjective.primary')
    expect(blockerPaths).toContain('strategy.contentAnglesDetailed[0].title')
    expect(blockerPaths).toContain('strategy.contentAnglesDetailed[0].hook')
    expect(blockerPaths).toContain('strategy.contentAnglesDetailed[0].pain')
    expect(report.blockers.map(item => item.code)).toContain('unsupported_social_proof')
    expect(report.warnings.map(item => item.code)).toContain('unverified_comparative_positioning')
  })

  it('does not mistake ordinary comfort language for an unsupported fabric claim', () => {
    const report = reviewStrategyGrounding({
      strategy: {
        ...groundedStrategy,
        positioning: 'شموع منزلية مصنوعة يدويًا للحظات يومية أكثر هدوءًا.',
        keyMessage: 'اصنع مساحة تمنحك الراحة بعد يوم طويل.',
      },
      brand: {
        brandName: 'بيت نور',
        industry: 'Home fragrance',
        description: 'شموع منزلية مصنوعة يدويًا وروائح للمنزل.',
        primaryOffer: 'شموع وروائح منزلية',
        targetAudience: 'بالغون من 25-44 في الإمارات.',
        audienceAge: '25-34, 35-44',
        topPlatforms: ['INSTAGRAM'],
        verifiedProof: [],
      },
      allowedPlatforms: ['INSTAGRAM'],
      checkedAt: '2026-07-20T00:00:00.000Z',
    })

    expect(report.blockers.map(item => item.code)).not.toContain('ungrounded_brand_context')
  })

  it('treats the saved writing style and tone keywords as grounded brand context', () => {
    const report = reviewStrategyGrounding({
      strategy: {
        ...groundedStrategy,
        positioning: 'Modern modest fashion presented in a culturally respectful way.',
      },
      brand: {
        brandName: 'NOORAYA',
        industry: 'Fashion',
        description: 'Modern abayas for women in the UAE.',
        primaryOffer: 'A reviewed selection of abayas.',
        targetAudience: 'Women aged 25-34 in the UAE.',
        writingStyle: 'Elegant, calm, concise, and culturally respectful.',
        toneKeywords: ['culturally respectful', 'elegant'],
        topPlatforms: ['INSTAGRAM'],
        verifiedProof: [],
      },
      allowedPlatforms: ['INSTAGRAM'],
      checkedAt: '2026-07-21T00:00:00.000Z',
    })

    expect(report.blockers.map(item => item.code)).not.toContain('ungrounded_brand_context')
  })

  it('blocks shopping CTAs when no conversion destination exists', () => {
    const report = reviewStrategyGrounding({
      strategy: {
        ...groundedStrategy,
        ctaVariations: ['Shop the look', 'Browse our collection'],
      },
      brand: {
        brandName: 'NOORAYA',
        industry: 'Fashion',
        description: 'Modern abayas for women in the UAE.',
        primaryOffer: 'A reviewed selection of abayas.',
        targetAudience: 'Women aged 25-34 in the UAE.',
        topPlatforms: ['INSTAGRAM'],
        verifiedProof: [],
      },
      allowedPlatforms: ['INSTAGRAM'],
      checkedAt: '2026-07-18T00:00:00.000Z',
    })

    expect(report.status).toBe('blocked')
    expect(report.blockers.map(item => item.code)).toContain('conversion_cta_without_destination')
    expect(
      report.blockers
        .filter(item => item.code === 'conversion_cta_without_destination')
        .map(item => item.path),
    ).toEqual(expect.arrayContaining([
      'strategy.ctaVariations',
      'strategy.contentAnglesDetailed[0].cta',
    ]))
    expect(
      report.blockers.find(item => item.code === 'conversion_cta_without_destination')?.message,
    ).toContain('"Shop the look"')
  })

  it('blocks unsupported fashion use, culture, collection, and material claims', () => {
    const report = reviewStrategyGrounding({
      strategy: {
        positioning: 'Modern abayas for women in the UAE.',
        targetAudienceRefined: 'Style-conscious professionals seeking office wear.',
        contentPillars: ['Cultural heritage', 'A varied collection for every occasion'],
        ctaVariations: ['Review the documented details'],
        contentAnglesDetailed: [{
          title: 'Comfortable premium fabrics for meetings',
          platform: 'INSTAGRAM',
          cta: 'Review the documented details',
        }],
      },
      brand: {
        brandName: 'NOORAYA',
        industry: 'Fashion',
        description: 'Modern abayas for women in the UAE.',
        primaryOffer: 'A reviewed selection of abayas.',
        targetAudience: 'Women aged 25-34 in the UAE.',
        topPlatforms: ['INSTAGRAM'],
        verifiedProof: [],
      },
      allowedPlatforms: ['INSTAGRAM'],
      checkedAt: '2026-07-18T00:00:00.000Z',
    })

    expect(report.status).toBe('blocked')
    expect(report.blockers.filter(item => item.code === 'ungrounded_brand_context')).toHaveLength(4)
  })

  it('does not let a limited simple-occasion audience note justify universal fit or quality and shopping assurances', () => {
    const report = reviewStrategyGrounding({
      strategy: {
        ...groundedStrategy,
        positioning: 'Modern modest abayas without compromising on style.',
        contentPillars: ['ثقة في جودة المنتج', 'تجربة شراء مميزة'],
        topHooks: ['عبايات تلائم كل مناسبة', 'جودة يمكنك الوثوق بها'],
      },
      brand: {
        brandName: 'NOORAYA',
        industry: 'Fashion',
        description: 'Modern modest abayas for women in the UAE.',
        primaryOffer: 'A reviewed selection of abayas.',
        targetAudience: 'Women who want abayas for daily use and simple occasions.',
        topPlatforms: ['INSTAGRAM'],
        verifiedProof: [],
      },
      allowedPlatforms: ['INSTAGRAM'],
      checkedAt: '2026-07-21T00:00:00.000Z',
    })

    expect(report.status).toBe('blocked')
    expect(report.blockers.map(item => item.code)).toContain('unsupported_offer_assurance')
    expect(report.blockers.map(item => item.code)).toContain('ungrounded_brand_context')
  })

  it('blocks the exact unverified quality claims observed in a live strategy run', () => {
    const report = reviewStrategyGrounding({
      strategy: {
        ...groundedStrategy,
        contentAnglesDetailed: [
          {
            ...groundedStrategy.contentAnglesDetailed[0],
            hook: 'راجعي خطوات الشراء المتاحة مع ضمان جودة نورايا.',
          },
          {
            ...groundedStrategy.contentAnglesDetailed[0],
            title: 'تعرفي على جودة عبايات نورايا.',
            hook: 'راجعي التفاصيل قبل الاختيار.',
          },
        ],
      },
      brand: {
        brandName: 'NOORAYA',
        industry: 'Fashion',
        description: 'Modern modest abayas for women in the UAE.',
        primaryOffer: 'A reviewed selection of abayas.',
        targetAudience: 'Women who are concerned about product quality.',
        audiencePainPoints: ['قلق من جودة المنتج'],
        topPlatforms: ['INSTAGRAM'],
        verifiedProof: [],
      },
      allowedPlatforms: ['INSTAGRAM'],
      checkedAt: '2026-07-21T00:00:00.000Z',
    })

    expect(report.status).toBe('blocked')
    expect(report.blockers.map(item => item.code)).toContain('unsupported_offer_assurance')
  })

  it('blocks unverified shopping-safety and sizing promises observed in the follow-up live run', () => {
    const report = reviewStrategyGrounding({
      strategy: {
        ...groundedStrategy,
        audienceSegmentsDetailed: [{
          segment: 'نساء يتسوقن عبر الإنترنت',
          message: 'نحن نقدم تفاصيل دقيقة للمقاسات لتسهيل اختيارك.',
          pain: 'القلق من اختيار المقاس',
        }],
        contentAnglesDetailed: [{
          ...groundedStrategy.contentAnglesDetailed[0],
          title: 'تجربة شراء آمنة',
          hook: 'استمتعي بتجربة شراء سلسة.',
        }],
      },
      brand: {
        brandName: 'NOORAYA',
        industry: 'Fashion',
        description: 'Modern modest abayas for women in the UAE.',
        primaryOffer: 'A reviewed selection of abayas.',
        targetAudience: 'Women who are concerned about online shopping and sizing.',
        audiencePainPoints: ['قلق من المقاس وعملية الشراء عبر الإنترنت'],
        topPlatforms: ['INSTAGRAM'],
        verifiedProof: [],
      },
      allowedPlatforms: ['INSTAGRAM'],
      checkedAt: '2026-07-21T00:00:00.000Z',
    })

    expect(report.status).toBe('blocked')
    expect(report.blockers.filter(item => item.code === 'unsupported_offer_assurance').length).toBeGreaterThanOrEqual(2)
  })

  it('treats a not-connected product page as missing and blocks the remaining live promises', () => {
    const report = reviewStrategyGrounding({
      strategy: {
        ...groundedStrategy,
        ctaVariations: ['تسوقي الآن'],
        funnelStages: [{
          stage: 'Conversion',
          message: 'Easy and secure buying process',
          cta: 'Shop now',
          platform: 'PINTEREST',
        }],
        contentAnglesDetailed: [{
          ...groundedStrategy.contentAnglesDetailed[0],
          hook: 'اختاري المقاس المناسب بسهولة',
        }],
        contentPillars: ['عبايات تجمع بين الأناقة والراحة', 'تصاميم فريدة'],
      },
      brand: {
        brandName: 'NOORAYA',
        industry: 'Fashion',
        description: 'Modern modest abayas for women in the UAE.',
        primaryOffer: 'A reviewed selection of abayas.',
        targetAudience: 'Women who are concerned about online shopping and sizing.',
        topPlatforms: ['INSTAGRAM', 'PINTEREST'],
        conversionDestination: 'Product page and online checkout; actual store URL is not connected yet.',
        verifiedProof: [],
      },
      allowedPlatforms: ['INSTAGRAM', 'PINTEREST'],
      goal: 'SALES',
      checkedAt: '2026-07-21T00:00:00.000Z',
    })

    expect(report.status).toBe('blocked')
    expect(report.blockers.map(item => item.code)).toContain('conversion_cta_without_destination')
    expect(report.blockers.filter(item => item.code === 'unsupported_offer_assurance').length).toBeGreaterThanOrEqual(4)
  })

  it('blocks duplicate quoted content directions even when their total count is correct', () => {
    const report = reviewStrategyGrounding({
      strategy: {
        ...groundedStrategy,
        contentAnglesDetailed: [
          { title: 'Offer details', hook: 'Review the documented offer', platform: 'INSTAGRAM', cta: 'Review details' },
          { title: 'Offer details', hook: 'Review the documented offer', platform: 'INSTAGRAM', cta: 'Review details' },
        ],
      },
      brand: dentalBrand,
      allowedPlatforms: ['INSTAGRAM'],
      checkedAt: '2026-07-21T00:00:00.000Z',
    })

    expect(report.blockers.map(item => item.code)).toContain('duplicate_content_direction')
  })

  it('blocks safe fallback placeholders from counting as delivered content directions', () => {
    const report = reviewStrategyGrounding({
      strategy: {
        ...groundedStrategy,
        contentAnglesDetailed: [
          ...groundedStrategy.contentAnglesDetailed,
          {
            title: 'فرضية اتجاه المحتوى 2',
            hook: 'ما الرسالة التي يجب التحقق منها في اتجاه المحتوى 2؟',
            platform: 'INSTAGRAM',
            cta: 'راجع ملاءمة الرسالة',
          },
        ],
      },
      brand: dentalBrand,
      allowedPlatforms: ['INSTAGRAM'],
      checkedAt: '2026-07-21T00:00:00.000Z',
    })

    expect(report.blockers.map(item => item.code)).toContain('placeholder_content_direction')
  })

  it('does not treat a negated premium statement as approved positioning', () => {
    const report = reviewStrategyGrounding({
      strategy: { ...groundedStrategy, positioning: 'Premium consultation guidance for adults.' },
      brand: { ...dentalBrand, description: 'A local clinic, not premium positioning.' },
      allowedPlatforms: ['INSTAGRAM'],
      checkedAt: '2026-07-14T00:00:00.000Z',
    })

    expect(report.warnings.map(item => item.code)).toContain('unverified_premium_positioning')
  })

  it('allows workflow language when the saved offer is operations software', () => {
    const report = reviewStrategyGrounding({
      strategy: {
        ...groundedStrategy,
        positioning: 'Clinic workflow software for front desk teams.',
        keyMessage: 'Give every clinic handoff a clear owner.',
        differentiation: 'A shared clinic operations dashboard.',
        targetAudienceRefined: 'Clinic operations managers.',
        contentPillars: ['Workflow visibility', 'Front desk handoff', 'Clinic operations'],
        topHooks: ['Who owns the next handoff?'],
        ctaVariations: ['Request a software demo'],
        contentAnglesDetailed: [{
          title: 'Front desk handoff checklist',
          hook: 'Give the workflow one visible owner.',
          pain: 'Internal requests get lost.',
          desiredOutcome: 'Clearer team ownership.',
          objection: 'We already use spreadsheets.',
          platform: 'LINKEDIN',
          cta: 'Request a software demo',
        }],
      },
      brand: {
        brandName: 'ClinicFlow',
        industry: 'SaaS',
        description: 'Clinic management software for front desk operations.',
        primaryOffer: 'A clinic workflow platform',
        targetAudience: 'Clinic operations managers',
        topPlatforms: ['LINKEDIN'],
        verifiedProof: [],
      },
      allowedPlatforms: ['LINKEDIN'],
      checkedAt: '2026-07-14T00:00:00.000Z',
    })

    expect(report.status).toBe('passed')
  })

  it('treats an operating system as an operations product and YouTube Shorts as the reviewed YouTube channel', () => {
    const report = reviewStrategyGrounding({
      strategy: {
        ...groundedStrategy,
        positioning: 'An AI marketing operating system for a reviewable workflow.',
        keyMessage: 'Give the marketing workflow a clear owner and next step.',
        differentiation: 'One operating system for strategy, approval, and learning.',
        targetAudienceRefined: 'Founders and lean marketing leads at growing businesses.',
        contentPillars: ['Workflow clarity', 'Approval control', 'Measured learning'],
        topHooks: ['Who owns the next marketing decision?'],
        ctaVariations: ['Review the workflow'],
        contentAnglesDetailed: [{
          title: 'Marketing workflow review',
          hook: 'Give every marketing decision a reviewable next step.',
          pain: 'Marketing work is scattered across tools and people.',
          desiredOutcome: 'A governed marketing workflow.',
          objection: 'We already use several tools.',
          platform: 'YouTube Shorts',
          cta: 'Review the workflow',
        }],
      },
      brand: {
        brandName: 'NEXUS AI',
        industry: 'Tech & Apps',
        description: 'An AI marketing operating system for growing businesses.',
        primaryOffer: 'A governed marketing operating system subscription.',
        targetAudience: 'Founders and lean marketing leads at growing businesses.',
        audiencePainPoints: ['Marketing work is scattered across tools and people'],
        topPlatforms: ['YOUTUBE'],
        verifiedProof: [],
      },
      allowedPlatforms: ['YOUTUBE'],
      checkedAt: '2026-07-15T00:00:00.000Z',
    })

    expect(report.status).toBe('passed')
    expect(report.blockers).toEqual([])
  })
})
