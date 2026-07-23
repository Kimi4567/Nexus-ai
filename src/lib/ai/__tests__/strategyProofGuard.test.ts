import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import { buildProofPolicyPrompt, guardStrategyProof, guardStrategyProofText } from '../strategyProofGuard'

describe('strategyProofGuard', () => {
  it('repairs unsupported legacy positioning and awkward claim-softening leftovers', () => {
    const guarded = guardStrategyProof({
      positioning: 'Noura is the premium dental clinic for local professionals.',
      messages: [
        'pricing details to review before booking, just clear treatment plans.',
        'Our pricing details available to discuss ensures no surprises.',
        'Experience dental care without the stress.',
        'Clear communication in your preferred language.',
        'Dental care that caters to the whole family.',
        'Visit us for a tour',
      ],
    }, { verifiedProof: [], allowedClaimText: [] }) as Record<string, unknown>

    const joined = JSON.stringify(guarded)
    expect(joined).not.toMatch(/premium dental clinic/i)
    expect(joined).not.toMatch(/ensures no surprises/i)
    expect(joined).not.toMatch(/without the stress/i)
    expect(joined).not.toMatch(/preferred language/i)
    expect(joined).not.toMatch(/whole family/i)
    expect(joined).not.toMatch(/tour/i)
    expect(joined).toContain('Review pricing details and the proposed treatment plan before booking.')
  })

  it('keeps supported premium and language positioning from Brand Brain', () => {
    const guarded = guardStrategyProof({
      positioning: 'Noura is the premium dental clinic for local professionals.',
      message: 'Clear communication in your preferred language.',
    }, {
      verifiedProof: [],
      allowedClaimText: ['Premium positioning. Service is available in Arabic and English.'],
    }) as Record<string, unknown>

    expect(JSON.stringify(guarded)).toContain('premium dental clinic')
    expect(JSON.stringify(guarded)).toContain('preferred language')
  })

  it('softens unsupported coffee superlatives and repeated proof-collection suffixes', () => {
    const guarded = guardStrategyProof({
      keyMessage: 'Experience the freshest coffee with weekly roasted beans.',
      positioning: 'Access premium, freshly roasted coffee from high-quality beans.',
      valuePropositions: ['Fresh weekly roasting for optimal flavor.'],
      ctaVariations: ['See our quality promise'],
      contentPillars: ['customer stories to collect', 'customer story to collect to collect to collect visuals'],
      topHooks: [
        'Your perfect cup, delivered.',
        'The ultimate coffee routine.',
        'Unmatched flavor for subscribers.',
        'The finest beans for home brewing.',
      ],
    }, {
      verifiedProof: [],
      allowedClaimText: ['Specialty coffee with fresh weekly roasting.'],
    })

    const joined = JSON.stringify(guarded)
    expect(joined).toContain('freshly roasted coffee')
    expect(joined).toContain('Fresh weekly roasting.')
    expect(joined).toContain('See the product details')
    expect(joined).toContain('customer stories to collect')
    expect(joined).toContain('customer story to collect visuals')
    expect(joined).toContain('Your cup, delivered.')
    expect(joined).not.toMatch(/freshest|premium|high-quality|optimal|perfect|ultimate|unmatched|finest|to collect to collect/i)
  })

  it('preserves explicitly supplied premium and freshest positioning', () => {
    const text = 'The freshest premium coffee for local subscribers.'
    expect(guardStrategyProofText(text, {
      allowedClaimText: ['Brand positioning: freshest premium coffee.'],
    })).toBe(text)
  })

  it('turns unsupported quality, shopping experience, universal-fit, and no-compromise promises into review tasks', () => {
    const guarded = guardStrategyProof({
      positioning: 'NOORAYA offers modern modest abayas without compromising on style.',
      differentiation: 'تصميم عصري محتشم وتجربة شراء منظمة.',
      valuePropositions: ['ثقة في جودة المنتج', 'تجربة شراء مريحة'],
      hooks: [
        'جودة يمكنك الوثوق بها',
        'عبايات تلائم كل مناسبة',
        'تجربة شراء لا تُنسى',
      ],
    }, {
      verifiedProof: [],
      allowedClaimText: ['Modern modest abayas for women in the UAE.'],
    })
    const joined = JSON.stringify(guarded)

    expect(joined).not.toMatch(/without compromising|ثقة في جودة المنتج|جودة يمكنك الوثوق بها|تجربة شراء (?:منظمة|مريحة|لا تُنسى)|تلائم كل مناسبة/i)
    expect(joined).toContain('تفاصيل المنتج المطلوبة لتقييم الجودة')
    expect(joined).toContain('خطوات شراء يلزم توثيقها ومراجعتها')
    expect(joined).toContain('راجعي ملاءمة كل تصميم للمناسبة المحددة')
  })

  it('neutralizes standalone quality-assurance wording from a live run without corrupting safety disclaimers', () => {
    const guarded = guardStrategyProof({
      customerFacingClaims: [
        'Quality assurance for every monthly coffee delivery.',
        'Assured quality with each subscription.',
        'ضمان جودة المنتج مع كل اشتراك.',
        'No quality guarantee without reviewed evidence.',
      ],
    }, {
      verifiedProof: [],
      commercialClaimText: [],
      allowedClaimText: ['Monthly one-kilogram coffee subscription for AED 149.'],
    })
    const claims = guarded.customerFacingClaims

    expect(claims[0]).toContain('documented product details to review')
    expect(claims[1]).toContain('documented product details to review')
    expect(claims[2]).toContain('تفاصيل المنتج الموثقة المطلوب مراجعتها')
    expect(claims[3]).toBe('No quality guarantee without reviewed evidence.')
    expect(JSON.stringify(claims.slice(0, 3))).not.toMatch(/quality assurance|assured quality|ضمان جودة/i)
  })

  it('grounds live coffee freshness, reliability, and never-run-out claims in owner facts', () => {
    const ungrounded = guardStrategyProof({
      keyMessage: 'Enjoy freshly roasted coffee delivered monthly to your doorstep in Dubai.',
      positioning: 'A subscription for residents who need a predictable monthly delivery without running out of coffee.',
      angles: [
        'Highlight coffee freshness and the roasting process.',
        'Fast and reliable delivery.',
        'Reliable monthly coffee supply.',
        'تخيل عدم القلق بشأن نفاد القهوة مرة أخرى!',
      ],
      evidence: 'The business currently has no discounts, testimonials, or performance guarantees.',
      restriction: 'Do not use testimonials',
    }, {
      verifiedProof: [],
      allowedClaimText: [
        'AED 149 for one kilogram each month.',
        'Delivery is limited to Dubai within 48 hours.',
        'No freshness guarantee or customer proof is available.',
      ],
    })
    const joined = JSON.stringify(ungrounded)

    expect(joined).not.toMatch(/freshly roasted|coffee freshness|roasting process|never (?:want to )?run out|reliable (?:delivery|monthly coffee supply)|عدم القلق بشأن نفاد القهوة|doorstep/i)
    expect(joined).toMatch(/details to verify|more predictably|documented service window/i)
    expect(joined).toContain('no discounts, testimonials, or performance guarantees')
    expect(joined).toContain('Do not use unverified customer proof')

    const supported = guardStrategyProofText(
      'Freshly roasted coffee from our weekly roasting process.',
      { allowedClaimText: ['The coffee is freshly roasted every week.'] },
    )
    expect(supported).toBe('Freshly roasted coffee from our weekly roasting process.')
  })

  it('removes the remaining live checkout, sizing, comfort, and uniqueness promises without proof', () => {
    const guarded = guardStrategyProof({
      funnelMessage: 'Easy and secure buying process',
      sizingHook: 'اختاري المقاس المناسب بسهولة',
      comfortAngle: 'عبايات تجمع بين الأناقة والراحة',
      uniqueAngle: 'تميزي بتصاميم نورايا الفريدة',
    }, {
      verifiedProof: [],
      commercialClaimText: [],
      allowedClaimText: ['Modern modest abayas for women in the UAE.'],
    })
    const joined = JSON.stringify(guarded)

    expect(joined).not.toMatch(/easy\s+and\s+secure\s+buying\s+process|اختاري\s+المقاس\s+المناسب\s+بسهولة|تجمع\s+بين\s+الأناقة\s+والراحة|تصاميم\s+نورايا\s+الفريدة/i)
    expect(joined).toMatch(/document and review|المقاسات الموثقة|ملاءمة الارتداء|تفاصيل التصميم الموثقة/)
    expect(joined).not.toMatch(/تميزي\s+براجعي|ومميزة|عبايات\s+راجعي/)
  })

  it('preserves the same offer assurances when the owner supplied them as facts', () => {
    const text = 'Trusted product quality and an easy shopping experience for every occasion without compromising on style.'
    expect(guardStrategyProofText(text, {
      allowedClaimText: [text],
    })).toBe(text)
  })

  it('does not treat an avoid instruction as support for a quality claim', () => {
    expect(guardStrategyProofText('Premium coffee for local subscribers.', {
      allowedClaimText: ['Avoid premium wording in public copy.'],
    })).toBe('Coffee for local subscribers.')
  })

  it('does not invent value-for-money positioning when price evidence is missing', () => {
    expect(guardStrategyProofText('نظامنا يقدم قيمة ممتازة مقابل التكلفة', {
      allowedClaimText: ['واجهة ثنائية اللغة وتقارير واضحة'],
    })).toBe('تحقق من السعر وما يتضمنه العرض قبل الرد على اعتراض التكلفة')

    expect(guardStrategyProofText('Our service offers excellent value for money.', {
      allowedClaimText: ['Clear reporting'],
    })).toContain('pricing and included value to confirm')
  })

  it('states commercial objectives as goals instead of performance promises', () => {
    const guarded = guardStrategyProof({
      businessObjective: 'Increase sales through organic engagement.',
      message: 'Boost your revenue with better content.',
    }, { verifiedProof: [] })

    expect(guarded.businessObjective).toBe('Support sales goals through organic engagement.')
    expect(guarded.message).toBe('Support your revenue goals with better content.')
    expect(JSON.stringify(guarded)).not.toMatch(/increase sales|boost your revenue/i)
  })

  it('rewrites unsupported testimonial and customer-story language when verified proof is empty', () => {
    const strategy = {
      contentPillars: ['Education', 'Customer Testimonials'],
      topHooks: ['Hear from our satisfied customers about their coffee journey.'],
      ctaVariations: ['Read their stories'],
      weeklyExecutionPlan: [{ deliverables: ['1 customer testimonial video'] }],
      contentAnglesDetailed: [{ title: 'Customer stories', format: 'Testimonial' }],
    }

    const guarded = guardStrategyProof(strategy, { verifiedProof: [] })
    const joined = JSON.stringify(guarded)

    expect(joined).toContain('Proof to collect')
    expect(joined).toContain('Ask customers for feedback and stories')
    expect(joined).toContain('Collect customer stories for future use')
    expect(joined).toContain('customer feedback request or proof-collection video')
    expect(joined).not.toContain('Customer Testimonials')
    expect(joined).not.toContain('satisfied customers')
    expect(joined).not.toContain('Read their stories')
    expect(joined).not.toContain('customer testimonial video')
  })

  it('rewrites active stage to planning/review-safe wording', () => {
    const out = guardStrategyProofText('The campaign is in an active stage and ready for review.', {
      verifiedProof: [],
    })

    expect(out).toContain('planning/review stage')
    expect(out).not.toContain('active stage')
  })

  it('rewrites Arabic and English active campaign status wording', () => {
    const arabic = guardStrategyProofText('مرحلة العمل: active', { verifiedProof: [] })
    expect(arabic).toContain('مرحلة التخطيط/المراجعة')
    expect(arabic).not.toContain('active')

    const english = guardStrategyProofText('The campaign is active.', { verifiedProof: [] })
    expect(english).toContain('planning/review')
    expect(english).not.toContain('campaign is active')
    expect(english).not.toContain('published')
    expect(english).not.toContain('live')
  })

  it('rewrites structured active campaign status fields', () => {
    const arabic = guardStrategyProof({
      label: 'مرحلة العمل',
      value: 'active',
    }, { verifiedProof: [] })

    expect(arabic.value).toContain('مرحلة التخطيط/المراجعة')
    expect(JSON.stringify(arabic)).not.toContain('active')

    const english = guardStrategyProof({
      label: 'Campaign status',
      value: 'active',
    }, { verifiedProof: [] })

    expect(english.value).toContain('planning/review')
    expect(JSON.stringify(english)).not.toContain('active')
    expect(JSON.stringify(english)).not.toContain('live')
    expect(JSON.stringify(english)).not.toContain('published')
    expect(JSON.stringify(english)).not.toContain('scheduled')
  })

  it('distinguishes business operating status from campaign execution status', () => {
    const business = guardStrategyProof({
      label: 'Business status',
      value: 'active',
    }, { verifiedProof: [] })

    expect(business.value).toBe('business already operating')
    expect(JSON.stringify(business)).not.toContain('campaign active')
  })

  it('softens absolute ensure-style outcome wording', () => {
    const out = guardStrategyProofText('Ensure your office has the best coffee every day.', {
      verifiedProof: [],
    })

    expect(out).toBe('Help keep your office stocked with better coffee.')
    expect(out).not.toContain('Ensure')
    expect(out).not.toContain('best coffee every day')
  })

  it('softens broader ensure and always-stocked absolute claims', () => {
    const out = guardStrategyProofText('Ensure your office is always stocked with premium coffee.', {
      verifiedProof: [],
    })

    expect(out).toBe('Help keep your office stocked with better coffee.')
    expect(out).not.toContain('Ensure')
    expect(out).not.toContain('always stocked')
  })

  it('repairs the unsupported renovation assurances observed in a paid live run', () => {
    const guarded = guardStrategyProof({
      keyMessage: 'Experience a seamless renovation with clear phases and weekly updates.',
      headlines: [
        'Budget-Friendly Renovations',
        'Updates You Can Rely On',
      ],
      copy: [
        'Our clear project phases ensure you know exactly what to expect.',
        'Our phased approach ensures no surprises.',
        'Transparent costs for your peace of mind.',
        'Never miss a beat with our consistent project updates.',
        'Our structured approach ensures a smooth renovation journey.',
        'Our phased approach makes renovation simple and clear.',
        'Our structured timeline guarantees timely project completion.',
      ],
      whyNow: 'To capitalize on the growing interest in home renovations.',
      assumption: 'Engagement will lead to consultation requests.',
      malformed: [
        'Discover how we make renovations with clear next steps with clear phases.',
        'See how transparent costs can lead to a with clear next steps renovation.',
        'Ensure 3D renders are and aligned with client expectations.',
      ],
    }, {
      verifiedProof: ['Every project starts with a documented scope and phase plan.'],
      allowedClaimText: ['Weekly project updates and a scope review are included. Premium positioning.'],
      commercialClaimText: ['Every project starts with a documented scope and phase plan.'],
    })
    const joined = JSON.stringify(guarded)

    expect(joined).not.toMatch(/seamless renovation|budget-friendly|updates you can rely on|exactly what to expect|no surprises|peace of mind|never miss a beat|smooth renovation journey|makes renovation simple|guarantees timely project completion|growing interest|engagement will lead|with clear next steps with clear phases|a with clear next steps|are and aligned/i)
    expect(joined).toContain('Review the documented project phases before execution')
    expect(joined).toContain('Renovation budget review')
    expect(joined).toContain('Test whether engagement is associated with qualified inquiries')
    expect(joined).toContain('supports a clearer pre-execution timeline review')
  })

  it('preserves an on-time guarantee only when the user supplied that exact commercial claim', () => {
    const text = 'Our structured timeline guarantees timely project completion.'

    expect(guardStrategyProofText(text, {
      commercialClaimText: ['Our contract guarantees timely project completion.'],
    })).toBe(text)
  })

  it('softens unsupported service health, speed, absolute, and every-visit claims', () => {
    const guarded = guardStrategyProof({
      topHooks: [
        'اختر خيارات صديقة للبيئة لمنزل أكثر صحة.',
        'استمتع بجودة تنظيف متسقة في كل زيارة.',
      ],
      ctaVariations: [
        'احجز تنظيف منزلك في ثوانٍ عبر WhatsApp!',
        'لا مزيد من الإضافات المفاجئة!',
      ],
      englishExamples: [
        'Choose eco-friendly options for a healthier home.',
        'Book your cleaning in seconds via WhatsApp!',
        'No more surprise add-ons!',
        'Consistent cleaning quality for every visit.',
      ],
    }, { verifiedProof: [] })
    const joined = JSON.stringify(guarded)

    expect(joined).toContain('استفسر عن خيارات تنظيف صديقة للبيئة عند توفرها')
    expect(joined).toContain('ابدأ طلب تنظيف منزلك عبر WhatsApp بخطوة بسيطة')
    expect(joined).toContain('راجع الأسعار والتفاصيل بوضوح قبل الحجز')
    expect(joined).toContain('استهدف تجربة تنظيف أكثر اتساقًا مع كل حجز')
    expect(joined).toContain('Ask about eco-friendly options where available')
    expect(joined).toContain('Start a cleaning request via WhatsApp')
    expect(joined).toContain('Review pricing and add-ons before booking')
    expect(joined).toContain('more consistent cleaning experience across bookings')
    expect(joined).not.toContain('أكثر صحة')
    expect(joined).not.toContain('في ثوان')
    expect(joined).not.toContain('لا مزيد')
    expect(joined).not.toContain('في كل زيارة')
    expect(joined).not.toContain('healthier home')
    expect(joined).not.toContain('in seconds')
    expect(joined).not.toContain('No more')
    expect(joined).not.toContain('every visit')
  })

  it('removes unsupported service-policy claims that were not saved in Brand Brain', () => {
    const guarded = guardStrategyProof({
      positioning: 'Family-friendly bilingual care with transparent pricing and no hidden fees.',
      ctaVariations: ['Book a clinic tour', 'Choose pain-free care'],
      arabic: 'خدمة ثنائية اللغة مناسبة للعائلات بدون رسوم خفية. احجز جولة في العيادة.',
    }, {
      verifiedProof: [],
      allowedClaimText: ['Noura Dental Studio offers dental consultations and treatment planning.'],
    })
    const joined = JSON.stringify(guarded)

    expect(joined).not.toMatch(/family-friendly|bilingual care|transparent pricing|no hidden fees|clinic tour|pain-free/i)
    expect(joined).not.toMatch(/ثنائية اللغة|مناسبة للعائلات|بدون رسوم خفية|جولة في العيادة/i)
    expect(joined).toContain('pricing details')
    expect(joined).toContain('book a consultation')
  })

  it('preserves an explicit bilingual service fact from Brand Brain', () => {
    const text = 'Bilingual service is available in Arabic and English.'
    expect(guardStrategyProofText(text, {
      allowedClaimText: ['We provide bilingual dental service in Arabic and English.'],
    })).toBe(text)
  })

  it('rewrites team-always wording without leaving an awkward sentence fragment', () => {
    const out = guardStrategyProofText('Ensure your team always has access to great coffee.', {
      verifiedProof: [],
    })

    expect(out).toBe('Help teams plan better office coffee routines.')
    expect(out).not.toContain('Support more reliable team planning has access')
    expect(out).not.toContain('Ensure your team always')
  })

  it('removes unsupported budget assumptions even when mismatched budget context exists', () => {
    const assumed = guardStrategyProofText('Assumes $5000 USD budget is available for allocation.', {
      verifiedProof: [],
      budgetText: '15,000 EGP/month test budget',
    })
    expect(assumed).toContain('Paid budget needs user confirmation')
    expect(assumed).not.toContain('$5000')
    expect(assumed).not.toContain('USD budget is available')

    const allocated = guardStrategyProofText('Allocate $5000 to paid ads.', {
      verifiedProof: [],
      budgetText: '15,000 EGP/month test budget',
    })
    expect(allocated).toContain('Paid allocation needs confirmation')
    expect(allocated).not.toContain('$5000')

    const withBudget = guardStrategyProofText('Assumes $5000 USD budget is available for allocation.', {
      verifiedProof: [],
      budgetText: '$5000 USD test budget',
    })
    expect(withBudget).not.toContain('$5000')
    expect(withBudget).toContain('Paid budget needs user confirmation')
  })

  it('preserves exact user-provided budget context lines', () => {
    const out = guardStrategyProofText('User-provided budget context: $5000 USD test budget.', {
      verifiedProof: [],
      budgetText: '$5000 USD test budget',
    })

    expect(out).toBe('User-provided budget context: $5000 USD test budget.')
  })

  it('keeps harmless time-range numbers while scrubbing budget assumptions', () => {
    const out = guardStrategyProofText('Plan the first 30 days within a 90 days strategy. Allocate $5000 to paid ads.', {
      verifiedProof: [],
    })

    expect(out).toContain('first 30 days')
    expect(out).toContain('90 days')
    expect(out).not.toContain('$5000')
  })

  it('strategist prompt does not expose internal monthlyBudget as factual user budget', () => {
    const strategist = readFileSync(
      path.join(process.cwd(), 'src/lib/agents/strategist.ts'),
      'utf8',
    )

    expect(strategist).not.toContain('Monthly Budget: $${brief.monthlyBudget} USD')
    expect(strategist).toContain('User-provided budget context')
    expect(strategist).toContain('Monthly Budget: Not provided')
  })

  it('preserves legitimate testimonial wording when user-provided proof includes a testimonial', () => {
    const text = 'Customer Testimonials can include the verified testimonial from Sara.'
    const out = guardStrategyProofText(text, {
      verifiedProof: ['Verified testimonial from Sara: Cairo Bloom Coffee helped our office simplify coffee ordering.'],
    })

    expect(out).toBe(text)
  })

  it('does not let review proof preserve testimonial or customer-story language', () => {
    const strategy = {
      contentPillars: ['Customer Testimonials'],
      topHooks: ['Hear from our satisfied customers about their coffee journey.'],
      ctaVariations: ['Read their stories'],
      weeklyExecutionPlan: [{ deliverables: ['1 customer testimonial video'] }],
      reviewAngle: 'Customer reviews',
    }

    const guarded = guardStrategyProof(strategy, {
      verifiedProof: ['4.8 average review from 120 user-provided reviews'],
    })
    const joined = JSON.stringify(guarded)

    expect(joined).not.toContain('Customer Testimonials')
    expect(joined).not.toContain('satisfied customers')
    expect(joined).not.toContain('Read their stories')
    expect(joined).not.toContain('customer testimonial video')
    expect(joined).toContain('Customer reviews')
  })

  it('preserves customer-story wording only when customer-story proof is explicit', () => {
    const text = 'Read their stories in a customer story series.'

    expect(guardStrategyProofText(text, {
      verifiedProof: ['Verified customer story from Sara about office coffee ordering.'],
    })).toBe(text)

    const guarded = guardStrategyProofText(text, {
      verifiedProof: ['Verified testimonial from Sara about office coffee ordering.'],
    })
    expect(guarded).not.toContain('Read their stories')
    expect(guarded).toContain('Collect customer stories for future use')
  })

  it('softens client-story and before-after transformation pillars when proof/assets are missing', () => {
    const strategy = {
      contentPillars: ['Client Stories', 'Before and After Transformations'],
      weeklyExecutionPlan: [{ deliverables: ['Before/after transformation carousel'] }],
    }

    const guarded = guardStrategyProof(strategy, { verifiedProof: [] })
    const joined = JSON.stringify(guarded)

    expect(joined).toContain('client stories to collect')
    expect(joined).toContain('transformation planning walkthroughs')
    expect(joined).toContain('before/after assets to collect')
    expect(joined).not.toContain('Client Stories')
    expect(joined).not.toContain('Before and After Transformations')
  })

  it('neutralizes unsupported Arabic social proof and customer-success wording', () => {
    const guarded = guardStrategyProof({
      contentPillars: ['تجارب عملائنا', 'قصص نجاح العملاء', 'تقييمات زبائننا'],
      contentAnglesDetailed: [{ title: 'آراء العملاء في تجربة التصميم' }],
    }, { verifiedProof: [] })
    const joined = JSON.stringify(guarded)

    expect(joined).not.toMatch(/(?:آراء|تجارب)\s+(?:عملائنا|العملاء|زبائننا)/u)
    expect(joined).not.toMatch(/(?:قصص|نماذج)\s+نجاح\s+(?:عملائنا|العملاء|زبائننا)/u)
    expect(joined).toContain('مطلوب')
  })

  it('preserves review wording only when review proof is explicit', () => {
    expect(guardStrategyProofText('Customer reviews', {
      verifiedProof: ['4.8 average review from 120 user-provided reviews'],
    })).toBe('Customer reviews')

    expect(guardStrategyProofText('Customer reviews', { verifiedProof: [] }))
      .toBe('customer reviews to collect')
  })

  it('keeps awards and case studies separate', () => {
    const awardOnly = guardStrategyProofText('Award-winning case study angle', {
      verifiedProof: ['Verified local coffee award in 2025.'],
    })
    expect(awardOnly).toContain('Award-winning')
    expect(awardOnly).toContain('proof examples to collect')

    const caseStudyOnly = guardStrategyProofText('Award-winning case study angle', {
      verifiedProof: ['Verified case study from a Cairo office customer.'],
    })
    expect(caseStudyOnly).toContain('quality-focused')
    expect(caseStudyOnly).toContain('case study')
  })

  it('does not corrupt safe guarantee disclaimers but softens positive guarantee claims', () => {
    expect(guardStrategyProofText('No guaranteed results', { verifiedProof: [] }))
      .toBe('No guaranteed results')
    expect(guardStrategyProofText('Avoid guaranteed claims', { verifiedProof: [] }))
      .toBe('Avoid guaranteed claims')
    expect(guardStrategyProofText('Delivery cannot be guaranteed in unsupported zones.', { verifiedProof: [] }))
      .toBe('Delivery cannot be guaranteed in unsupported zones.')
    expect(guardStrategyProofText('Do not promise delivery where it cannot be guaranteed.', { verifiedProof: [] }))
      .toBe('Do not promise delivery where it cannot be guaranteed.')
    expect(guardStrategyProofText('No guaranteed delivery', { verifiedProof: [] }))
      .toBe('No guaranteed delivery')
    expect(guardStrategyProofText('Avoid guaranteed growth claims', { verifiedProof: [] }))
      .toBe('Avoid guaranteed growth claims')
    expect(guardStrategyProofText('Not guaranteed growth', { verifiedProof: [] }))
      .toBe('Not guaranteed growth')
    expect(guardStrategyProofText('Without guaranteed delivery', { verifiedProof: [] }))
      .toBe('Without guaranteed delivery')
    expect(guardStrategyProofText('Guaranteed results for every customer', { verifiedProof: [] }))
      .toBe('aimed-for results for every customer')
    expect(guardStrategyProofText('Guaranteed delivery in every area', { verifiedProof: [] }))
      .toBe('delivery goal in every area')
    expect(guardStrategyProofText('Guaranteed growth for every campaign', { verifiedProof: [] }))
      .toBe('planned growth goal for every campaign')
  })

  it('does not alter unrelated safe strategy text', () => {
    const safe = {
      keyMessage: 'Freshly roasted coffee with grind-size guidance for Cairo home brewers.',
      contentPillars: ['Brewing education', 'Office coffee routines'],
      nextBestAction: 'Review the strategy before generating a content plan.',
    }

    expect(guardStrategyProof(safe, {
      verifiedProof: [],
      allowedClaimText: ['The coffee is freshly roasted.'],
    })).toEqual(safe)
  })

  it('removes unprovided speed, prime-location, and trust claims from service strategy text', () => {
    const guarded = guardStrategyProof({
      hooks: [
        'احجز موعدك في دقائق مع العيادة.',
        'رعاية أسنان موثوقة ومريحة في قلب دبي.',
        'موقعنا المتميز في دبي.',
        'التعريف بموقع العيادة المتميز.',
      ],
    }, {
      verifiedProof: [],
      allowedClaimText: ['عيادة أسنان في دبي تقدم مواعيد مسائية.'],
    })
    const joined = JSON.stringify(guarded)

    expect(joined).not.toMatch(/في دقائق|في قلب دبي|موقعنا المتميز|موقع العيادة المتميز|موثوقة ومريحة/)
    expect(joined).toMatch(/احجز موعدك مع العيادة|رعاية أسنان بخطوات واضحة في دبي|موقع العيادة داخل المنطقة المحددة/)
  })

  it('removes invented free and fast offer claims while preserving the supplied service', () => {
    const guarded = guardStrategyProof([
      'احجز جلسة اكتشاف مجانية قبل بدء المشروع.',
      'المهنيون يريدون تجديدًا سريعًا وفعالًا.',
      'Book a free consultation for a quick renovation.',
    ], {
      allowedClaimText: ['The offer includes a discovery session and an organized renovation plan.'],
    })

    expect(guarded.join(' ')).not.toMatch(/مجانية|تجديدًا سريعًا|free consultation|quick renovation/i)
    expect(guarded.join(' ')).toMatch(/جلسة اكتشاف|تجديد منظم|consultation|organized renovation/i)
  })

  it('preserves those service claims when the user explicitly supplied them', () => {
    const text = 'احجز موعدك في دقائق من موقعنا المتميز في قلب دبي مع رعاية موثوقة.'

    expect(guardStrategyProofText(text, {
      allowedClaimText: ['حجز فوري في دقائق من موقعنا المتميز في قلب دبي مع رعاية موثوقة.'],
    })).toBe(text)
  })

  it('softens Arabic guarantee, medical-outcome, and unsupported channel assumptions', () => {
    const guarded = guardStrategyProof([
      'خطط علاج واضحة تضمن لك راحة البال.',
      'الفحوصات المنتظمة تحميك من مشاكل الأسنان الكبيرة.',
      'اختيار العيادة المناسبة يمكن أن يغير تجربتك الصحية بالكامل.',
      'المحتوى التوضيحي سيكون كافيًا لزيادة التفاعل.',
      'الجمهور المستهدف يستخدم Instagram بشكل نشط.',
      'عدم التركيز على منصات غير فعالة',
    ], { verifiedProof: [] })
    const joined = guarded.join(' ')

    expect(joined).not.toMatch(/تضمن لك|تحميك من|يغير تجربتك الصحية بالكامل|سيكون كافيًا|يستخدم Instagram بشكل نشط|منصات غير فعالة/)
    expect(joined).toMatch(/فهم الخطوات قبل البدء|فرضية تحتاج إلى بيانات فعلية|عدم توسيع القنوات/)
  })

  it('does not turn scoped execution supervision into a full-service quality guarantee', () => {
    const guarded = guardStrategyProofText(
      'نحن نقدم إشرافًا كاملاً على التنفيذ لضمان الجودة.',
      { allowedClaimText: ['تشمل الباقة إشرافًا على التنفيذ.'] },
    )

    expect(guarded).toContain('إشرافًا على التنفيذ ضمن النطاق المتفق عليه')
    expect(guarded).toContain('نقاط مراجعة للجودة')
    expect(guarded).not.toMatch(/كاملاً|لضمان الجودة/)
  })

  it('turns unsupported causal performance language into testable hypotheses', () => {
    const guarded = guardStrategyProof([
      'Visual content will drive trust and awareness.',
      'Engagement will lead to qualified inquiries.',
      'المحتوى المرئي سيزيد الثقة لدى الجمهور.',
      'التفاعل سيؤدي إلى استفسارات ومبيعات.',
    ], { verifiedProof: [] })
    const joined = guarded.join(' ')

    expect(joined).toContain('hypothesis to test')
    expect(joined).toContain('associated with qualified inquiries')
    expect(joined).toContain('فرضية تحتاج إلى اختبار')
    expect(joined).toContain('يرتبط باستفسارات مؤهلة')
    expect(joined).not.toMatch(/will drive trust|will lead to qualified inquiries|سيزيد الثقة|سيؤدي إلى استفسارات/)
  })

  it('softens standalone Arabic guarantees but preserves inclusion wording', () => {
    const guarded = guardStrategyProof([
      'هذه العملية تضمن نتائج أفضل.',
      'هذا النظام يضمن لك النجاح.',
      'نضمن لك نتائج أفضل.',
      'راجع ما يتضمنه العرض وما لا يتضمنه.',
    ], { verifiedProof: [] })

    expect(guarded[0]).toContain('تدعم نتائج أفضل')
    expect(guarded[1]).toContain('يدعم النجاح')
    expect(guarded[2]).toContain('نسعى إلى دعم نتائج أفضل')
    expect(guarded[3]).toBe('راجع ما يتضمنه العرض وما لا يتضمنه.')
  })

  it('builds explicit proof-policy prompt text', () => {
    const prompt = buildProofPolicyPrompt({ verifiedProof: [] })

    expect(prompt).toContain('PROOF POLICY')
    expect(prompt).toContain('No testimonial, customer-story, review, award, case-study')
    expect(prompt).toContain('recommend collecting proof')
  })

  it('replaces CTAs to assets that the user never supplied while preserving planned asset tasks', () => {
    const guarded = guardStrategyProof({
      ctaVariations: ['Download the guide', 'Register for our webinar', 'Book a demo'],
      weeklyExecutionPlan: [{
        cta: 'حمّل الدليل',
        assetsNeeded: ['Create and approve a downloadable guide'],
      }],
      assetRequirements: {
        nextToCreate: ['Produce a webinar and downloadable checklist'],
      },
    }, { verifiedProof: [], allowedClaimText: ['Consulting service'] })

    expect(guarded.ctaVariations.join(' ')).not.toMatch(/Download the guide|Register for our webinar|Book a demo/i)
    expect(guarded.weeklyExecutionPlan[0].cta).toContain('بعد إنشاء الأصل واعتماده')
    expect(guarded.weeklyExecutionPlan[0].assetsNeeded[0]).toContain('downloadable guide')
    expect(guarded.assetRequirements.nextToCreate[0]).toContain('webinar')
  })

  it('blocks descriptive guide, webinar, and explainer-video CTAs until those assets exist', () => {
    const guarded = guardStrategyProof({
      ctaVariations: [
        'Read our strategy guide',
        'Download our easy AI guide',
        'Register for our future trends webinar',
        'Watch our explainer video',
      ],
    }, { verifiedProof: [], allowedClaimText: ['AI marketing software'] })

    const joined = guarded.ctaVariations.join(' ')
    expect(joined).not.toMatch(/read our strategy guide|download our easy ai guide|register for our future trends webinar|watch our explainer video/i)
    expect(joined).toContain('Request details after the resource is created and approved')
    expect(joined).toContain('Request an update after the session is created and scheduled')
    expect(joined).toContain('Request an update after the video is created and approved')
  })

  it('labels generic video directions as unbuilt and removes watch CTAs until approval', () => {
    const guarded = guardStrategyProof({
      contentAngles: [
        {
          title: 'AI and Human Collaboration',
          format: 'Video',
          cta: 'Watch how AI and humans work together',
        },
        {
          title: 'Workflow',
          format: 'Explainer Video',
          cta: 'Watch our workflow in action',
        },
      ],
    })

    expect(guarded.contentAngles).toEqual([
      {
        title: 'AI and Human Collaboration',
        format: 'Proposed asset to create and approve — Video',
        cta: 'Request an update after this asset is created and approved',
      },
      {
        title: 'Workflow',
        format: 'Proposed asset to create and approve — Explainer Video',
        cta: 'Request an update after this asset is created and approved',
      },
    ])
  })

  it('labels reel and story directions as proposed assets until they are created', () => {
    const guarded = guardStrategyProof({
      contentAnglesDetailed: [
        { asset: 'Reel demonstrating the roasting process' },
        { asset: 'Story graphics highlighting the delivery window' },
      ],
    }, {
      allowedClaimText: ['Coffee is freshly roasted. Delivery is limited to Dubai within 48 hours.'],
    })

    expect(guarded.contentAnglesDetailed[0].asset).toContain('Proposed asset to create and approve')
    expect(guarded.contentAnglesDetailed[1].asset).toContain('Proposed asset to create and approve')
  })

  it('turns a causal cost-reduction promise into an explicit test', () => {
    const guarded = guardStrategyProofText('Credit transparency will reduce cost objections.', {
      verifiedProof: [],
    })

    expect(guarded).toBe('Test whether Credit transparency changes cost objections.')
    expect(guarded).not.toMatch(/will reduce cost/i)
  })

  it('keeps an asset CTA when the asset is explicitly present in Brand Brain truth', () => {
    const guarded = guardStrategyProof({ cta: 'Download the guide' }, {
      allowedClaimText: ['Primary offer includes a downloadable guide'],
    })
    expect(guarded.cta).toBe('Download the guide')
  })

  it('labels unprovided conversion assets as work to create instead of existing assets', () => {
    const guarded = guardStrategyProof({
      contentAnglesDetailed: [
        { title: 'Easy AI guide', format: 'Whitepaper' },
        { title: 'Live demo', format: 'Explainer video' },
      ],
      weeklyExecutionPlan: [{ deliverables: ['Webinar', 'Success stories'] }],
      paidPlanning: { creativeBriefs: [{ requiredAssets: ['Product tour'] }] },
    }, { verifiedProof: [], allowedClaimText: ['AI consulting service'] })

    const joined = JSON.stringify(guarded)
    expect(joined).toContain('Proposed asset to create and approve — Easy AI guide')
    expect(joined).toContain('Proposed asset to create and approve — Whitepaper')
    expect(joined).toContain('Proposed asset to create and approve — Live demo')
    expect(joined).toContain('Proposed asset to create and approve — Explainer video')
    expect(joined).toContain('Proposed asset to create and approve — Webinar')
    expect(joined).toContain('customer proof stories to collect and approve')
    expect(joined).toContain('Proposed asset to create and approve — Product tour')
  })

  it('does not relabel a conversion asset explicitly supplied by Brand Brain', () => {
    const guarded = guardStrategyProof({
      contentAnglesDetailed: [{ title: 'Easy AI guide', format: 'Whitepaper' }],
    }, { allowedClaimText: ['The approved asset library includes the Easy AI guide whitepaper.'] })

    expect(guarded.contentAnglesDetailed[0]).toEqual({ title: 'Easy AI guide', format: 'Whitepaper' })
  })

  it('requires explicit proof before treating commercial reassurance as an established fact', () => {
    const guarded = guardStrategyProof({
      valuePropositions: ['ثقة في جودة المنتج', 'تجربة شراء مريحة'],
      hooks: ['جودة يمكنك الوثوق بها', 'تسوقي بثقة', 'تجربة شراء لا تنسى'],
    }, {
      verifiedProof: [],
      commercialClaimText: [],
      allowedClaimText: [
        'AI-suggested advantage: ثقة في جودة المنتج',
        'Positioning draft: تجربة شراء مريحة',
      ],
    })

    const rendered = JSON.stringify(guarded)
    expect(rendered).not.toMatch(/ثقة في جودة المنتج|جودة يمكنك الوثوق بها|تسوقي بثقة|تجربة شراء (?:مريحة|لا تنسى)/)
    expect(rendered).toContain('تفاصيل المنتج المطلوبة لتقييم الجودة')
    expect(rendered).toContain('خطوات شراء يلزم توثيقها ومراجعتها')
    expect(rendered).toContain('راجعي خطوات الشراء المتاحة')
  })

  it('content-plan route includes proof-policy guard before generation', () => {
    const route = readFileSync(
      path.join(process.cwd(), 'src/app/api/campaigns/[id]/generate-content-plan/route.ts'),
      'utf8',
    )

    expect(route).toContain('buildProofPolicyPrompt')
    expect(route).toContain('guardStrategyProof')
    expect(route).toContain('If the saved strategy contains unsupported proof terms')
  })

  it('campaign room strategy display applies the proof guard before rendering saved output', () => {
    const page = readFileSync(
      path.join(process.cwd(), 'src/app/campaigns/[id]/page.tsx'),
      'utf8',
    )

    expect(page).toContain("import { guardStrategyProof } from '@/lib/ai/strategyProofGuard'")
    expect(page).toContain('const guardedAiOutput = guardStrategyProof(aiOutput || {}, proofContext) as any')
    expect(page).toContain('guardStrategyTruthContract(\n    guardedAiOutput?.strategy || {}')
    expect(page).toContain('const topHooks: string[] = strategy.topHooks || guardedAiOutput?.topHooks || []')
    expect(page).not.toContain('guardStrategyTruthContract(aiOutput?.strategy || {}')
  })
})
