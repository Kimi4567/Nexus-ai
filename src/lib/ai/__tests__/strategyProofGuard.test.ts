import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import { buildProofPolicyPrompt, guardStrategyProof, guardStrategyProofText } from '../strategyProofGuard'

describe('strategyProofGuard', () => {
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

    expect(guardStrategyProof(safe, { verifiedProof: [] })).toEqual(safe)
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

  it('builds explicit proof-policy prompt text', () => {
    const prompt = buildProofPolicyPrompt({ verifiedProof: [] })

    expect(prompt).toContain('PROOF POLICY')
    expect(prompt).toContain('No testimonial, customer-story, review, award, case-study')
    expect(prompt).toContain('recommend collecting proof')
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
    expect(page).toContain('guardStrategyOutputContract(guardedAiOutput?.strategy || {}')
    expect(page).toContain('const topHooks: string[] = guardedAiOutput?.topHooks || strategy.topHooks || []')
    expect(page).not.toContain('guardStrategyOutputContract(aiOutput?.strategy || {}')
  })
})
