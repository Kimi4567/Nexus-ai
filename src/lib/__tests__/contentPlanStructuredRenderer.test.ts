import { describe, expect, it } from 'vitest'
import {
  isClinicOperationalSaasContent,
  isCustomerWorkflowSaasContent,
  renderContentPlanDraftCaption,
  renderContentPlanDraftImagePrompt,
  validateContentPlanDraftForSave,
  type ContentPlanRenderContext,
} from '@/lib/contentPlanStructuredRenderer'

const clinicCtx: ContentPlanRenderContext = {
  isArabic: true,
  brand: 'ClinicFlow AI',
  campaignName: 'ClinicFlow Arabic launch',
  keyMessage: 'تنظيم المواعيد والمتابعة والتواصل ثنائي اللغة للعيادات',
  targetAudience: 'عيادات صغيرة ومتوسطة',
  contentPillars: ['تنظيم المواعيد', 'متابعة المرضى', 'وضوح العمليات'],
  offer: 'Demo',
  platform: 'META',
  postIndex: 0,
  verifiedProof: [],
  brandFacts: ['ClinicFlow AI is a clinic management SaaS platform for appointment and administrative workflow review.'],
}

describe('contentPlanStructuredRenderer', () => {
  it('detects healthcare / clinic SaaS content from strategy context', () => {
    expect(isClinicOperationalSaasContent(clinicCtx, {})).toBe(true)
    expect(isClinicOperationalSaasContent({
      ...clinicCtx,
      brand: 'Roastly',
      campaignName: 'Office coffee routine',
      keyMessage: 'office coffee planning',
      targetAudience: 'office managers',
      contentPillars: ['coffee planning'],
      brandFacts: ['Roastly provides office coffee supplies and delivery where available.'],
    }, {})).toBe(false)
  })

  it('keeps a dental provider campaign as service marketing instead of clinic SaaS operations', () => {
    const providerCtx: ContentPlanRenderContext = {
      isArabic: false,
      brand: 'Noura Dental Studio',
      campaignName: 'Confident smile consultation',
      keyMessage: 'Clear dental consultation and treatment options',
      targetAudience: 'Adults looking for a trusted local dentist',
      contentPillars: ['dental education', 'consultation preparation', 'treatment options'],
      offer: 'Book a consultation',
      platform: 'META',
      postIndex: 0,
      verifiedProof: [],
    }

    const generated = {
      caption: 'Not sure what to ask at your first dental consultation? Save these three questions, then book a consultation with Noura Dental Studio to discuss your options.',
    }

    expect(isClinicOperationalSaasContent(providerCtx, generated)).toBe(false)
    expect(renderContentPlanDraftCaption(generated, providerCtx)).toBe(generated.caption)
    expect(renderContentPlanDraftCaption(generated, providerCtx)).not.toMatch(/front desk|handoff|leadership|team meeting/i)
  })

  it('does not let hallucinated generated software language reclassify a clinic provider as SaaS', () => {
    const providerCtx: ContentPlanRenderContext = {
      isArabic: false,
      brand: 'Noura Dental Studio',
      campaignName: 'Dental consultations',
      keyMessage: 'Clear treatment options',
      targetAudience: 'Adults looking for a dentist',
      contentPillars: ['dental education'],
      offer: 'Book a consultation',
      platform: 'META',
      postIndex: 0,
      verifiedProof: [],
      brandFacts: ['Noura Dental Studio is a local dental clinic offering consultations.'],
    }
    const generated = {
      caption: 'Use our clinic workflow software platform for a clearer front-desk handoff.',
    }

    expect(isClinicOperationalSaasContent(providerCtx, generated)).toBe(false)
  })

  it('renders Arabic clinic drafts from a conservative operational template instead of risky model copy', () => {
    const caption = renderContentPlanDraftCaption({
      caption: 'ClinicFlow AI يساعدك في تنظيم المواعيد وتحسين كفاءة العمليات. تواصل فعال وسهل مع مرضاك لتحسين الخدمة وزيادة رضاهم وثقتهم.',
    }, clinicCtx)

    expect(caption).toContain('تنظيم المواعيد')
    expect(caption).toContain('العمل الإداري')
    expect(caption).toMatch(/مراجع|راجع/)
    expect(caption).not.toContain('تحسين كفاءة')
    expect(caption).not.toContain('تواصل فعال')
    expect(caption).not.toContain('تحسين الخدمة')
    expect(caption).not.toContain('رضاهم')
    expect(caption).not.toContain('ثقتهم')
    expect(validateContentPlanDraftForSave({ caption }).ok).toBe(true)
  })

  it('renders follow-up and bilingual clinic topics without patient-outcome promises', () => {
    const followUp = renderContentPlanDraftCaption({
      caption: 'تعرف على كيفية تحسين متابعة المرضى وتوفير وقتك.',
    }, { ...clinicCtx, postIndex: 1 })
    expect(followUp).toContain('متابعة المرضى إداريًا')
    expect(followUp).not.toContain('تحسين متابعة المرضى')
    expect(followUp).not.toContain('توفير وقتك')

    const bilingual = renderContentPlanDraftCaption({
      caption: 'اكتشف كيف يعزز التواصل ثنائي اللغة رضا المرضى.',
    }, { ...clinicCtx, postIndex: 2 })
    expect(bilingual).toContain('التواصل الإداري ثنائي اللغة')
    expect(bilingual).not.toContain('رضا المرضى')
    expect(validateContentPlanDraftForSave({ caption: followUp }).ok).toBe(true)
    expect(validateContentPlanDraftForSave({ caption: bilingual }).ok).toBe(true)
  })

  it('renders a varied eight-post Arabic clinic sequence instead of repeating three generic templates', () => {
    const captions = Array.from({ length: 8 }, (_, postIndex) =>
      renderContentPlanDraftCaption({
        caption: 'ClinicFlow AI يساعدك في تنظيم المواعيد ومتابعة المرضى.',
      }, { ...clinicCtx, postIndex }),
    )

    expect(new Set(captions).size).toBe(8)
    expect(captions.join('\n')).toContain('فريق الاستقبال')
    expect(captions.join('\n')).toContain('العربية والإنجليزية')
    expect(captions.join('\n')).toContain('ديمو')
    expect(captions.join('\n')).not.toContain('تنظيم تنظيم')
    expect(captions.join('\n')).not.toContain('اجتماع الفريق أقصر')
    expect(captions.join('\n')).not.toContain('الأفضل')
    expect(captions.join('\n')).not.toContain('تحسين كفاءة')
    expect(captions.join('\n')).not.toContain('رضا')
    expect(captions.every(caption => validateContentPlanDraftForSave({ caption }).ok)).toBe(true)
  })

  it('uses YouTube Shorts wording and vertical background format for YouTube clinic slots', () => {
    const prompt = renderContentPlanDraftImagePrompt({
      imagePrompt: 'YouTube Shorts concept for appointment follow-up',
    }, { ...clinicCtx, platform: 'YOUTUBE', postIndex: 1 })

    expect(prompt).toContain('vertical 9:16 composition')
    expect(prompt).toContain('review-only background visual')
    expect(prompt).not.toContain('square 1:1 composition')
    expect(validateContentPlanDraftForSave({ imagePrompt: prompt }).ok).toBe(true)
  })

  it('renders clinic image prompts as review-only background visuals without fake product UI', () => {
    const prompt = renderContentPlanDraftImagePrompt({
      imagePrompt: 'صورة لواجهة تطبيق ClinicFlow AI على هاتف ذكي مع لوحة تحكم تعرض بيانات العيادة',
    }, clinicCtx)

    expect(prompt).toContain('review-only background visual')
    expect(prompt).toContain('No readable text')
    expect(prompt).toContain('no invented software visuals')
    expect(prompt).toContain('negative space')
    expect(prompt).not.toContain('واجهة تطبيق')
    expect(prompt).not.toContain('لوحة تحكم')
    expect(prompt).not.toContain('ClinicFlow AI على هاتف')
    expect(validateContentPlanDraftForSave({ imagePrompt: prompt }).ok).toBe(true)
  })

  it('save gate blocks observed unsafe regenerated clinic claims before SocialPost persistence', () => {
    const result = validateContentPlanDraftForSave({
      caption: 'وضوح العمليات في العيادة يساعد على من كفاءة العمل. اكتشف كيف يسهل ClinicFlow AI التواصل مع المرضى بلغتهم المفضلة، مما يساعد على من رضاهم وثقتهم.',
      imagePrompt: 'Clinic team celebrating guaranteed better patient satisfaction',
    })

    expect(result.ok).toBe(false)
    expect(result.issues.map(issue => issue.reason)).toContain('unsupported_clinic_outcome_claim')
    expect(result.issues.map(issue => issue.reason)).toContain('unsupported_absolute_claim')
  })

  it('save gate blocks first-person Arabic guarantees before persistence', () => {
    const result = validateContentPlanDraftForSave({
      caption: 'نضمن لك خدمات عالية الجودة، واكتشف كيف نضمن الجودة في كل خطوة.',
    })

    expect(result.ok).toBe(false)
    expect(result.issues.map(issue => issue.reason)).toContain('unsupported_absolute_claim')
  })

  it('save gate preserves Arabic inclusion wording', () => {
    const result = validateContentPlanDraftForSave({
      imagePrompt: 'تصميم يوضح ما يتضمنه العرض وما لا يتضمنه.',
    })

    expect(result.ok).toBe(true)
  })

  it('save gate blocks fake generated SaaS product screens before SocialPost persistence', () => {
    const result = validateContentPlanDraftForSave({
      caption: 'راجع تنظيم المواعيد في العيادة بخطوات أوضح.',
      imagePrompt: 'صورة لواجهة المستخدم في تطبيق ClinicFlow AI على شاشة تعرض لوحة تحكم المواعيد',
    })

    expect(result.ok).toBe(false)
    expect(result.issues.map(issue => issue.reason)).toContain('unsupported_fake_product_visual')
  })

  it('preserves non-clinic guarded copy instead of forcing the clinic template', () => {
    const caption = renderContentPlanDraftCaption({
      caption: 'Choose the right grind size for your brewing method.',
    }, {
      isArabic: false,
      brand: 'Roastly',
      keyMessage: 'coffee education',
      targetAudience: 'home brewers',
      contentPillars: ['education'],
      platform: 'META',
      postIndex: 0,
      verifiedProof: [],
    })

    expect(caption).toBe('Choose the right grind size for your brewing method.')
  })

  it('normalizes malformed multi-word brand hashtags and passes the save gate', () => {
    const caption = renderContentPlanDraftCaption({
      caption: 'Review the roast date before choosing your next bag. #FreshCoffee #NEXUSE2ECoffeeless',
    }, {
      isArabic: false,
      brand: 'NEXUS E2E Coffee',
      keyMessage: 'weekly roasting details',
      targetAudience: 'home brewers',
      contentPillars: ['coffee education'],
      platform: 'META',
      postIndex: 0,
      verifiedProof: [],
    })

    expect(caption).toContain('#FreshCoffee')
    expect(caption).toContain('#NEXUSE2ECoffee')
    expect(caption).not.toContain('#NEXUSE2ECoffeeless')
    expect(validateContentPlanDraftForSave({ caption }).ok).toBe(true)
  })

  it('blocks malformed or unsupported filler if it reaches persistence unchanged', () => {
    const result = validateContentPlanDraftForSave({
      caption: 'Our process helps that every cup is as fresh as it gets. Read our expert tips. #NEXUSE2ECoffeeless',
    })

    expect(result.ok).toBe(false)
    expect(result.issues.map(issue => issue.reason)).toContain('malformed_caption')
    expect(result.issues.map(issue => issue.reason)).toContain('unsupported_absolute_claim')
  })

  it('turns observed weak coffee drafts into self-contained, grounded posts', () => {
    const context: ContentPlanRenderContext = {
      isArabic: false,
      brand: 'NEXUS E2E Coffee',
      keyMessage: 'Fresh weekly roasting with origin details and flexible delivery options.',
      targetAudience: 'Busy home brewers in Dubai',
      contentPillars: ['freshness', 'subscription convenience', 'coffee education'],
      platform: 'META',
      postIndex: 0,
      verifiedProof: [],
      brandFacts: [
        'NEXUS E2E Coffee is a specialty coffee subscription for home brewers in Dubai.',
        'Beans are roasted weekly and origin details are provided.',
      ],
    }
    const observed = [
      "Review the available roasting details for this coffee subscription in Dubai. Say goodbye to stale beans and hello to a richer taste with NEXUS E2E's weekly roasting process. Curious about how we keep our coffee fresh?",
      "Too busy for coffee runs? We've got you covered. Enjoy freshly roasted coffee delivered straight to your door. See how easy it is to subscribe and enjoy hassle-free coffee moments.",
      "Master the art of brewing at home. Unlock the full potential of your coffee with our expert brewing tips. Our tutorials will refine your home brewing game. Watch our brewing tips and start your journey to a better cup of coffee.",
    ]
    const rendered = observed.map((caption, postIndex) =>
      renderContentPlanDraftCaption({ caption }, { ...context, postIndex }),
    )
    const prompts = observed.map((caption, postIndex) =>
      renderContentPlanDraftImagePrompt({
        caption,
        imagePrompt: postIndex === 0
          ? 'Fresh coffee beans inside a modern branded roastery in Dubai.'
          : postIndex === 1
            ? 'A package with the NEXUS E2E Coffee logo and a happy customer receiving delivery.'
            : 'An expert barista demonstrating a branded tutorial.',
      }, { ...context, postIndex }),
    )

    expect(rendered[0]).toContain('Roast date and origin details matter')
    expect(rendered[0]).toContain('beans are roasted weekly')
    expect(rendered[1]).toContain('compare the available coffee options')
    expect(rendered[1]).toContain('pause or cancellation terms')
    expect(rendered[2]).toContain('Match grind size to the brewing method')
    expect(rendered[2]).toContain('Save this checklist for your next brew')
    expect(rendered.join('\n')).not.toMatch(/richer taste|keep our coffee fresh|straight to your door|hassle-free|expert brewing tips|our tutorials|better cup of coffee/i)
    expect(rendered.every(caption => validateContentPlanDraftForSave({ caption }).ok)).toBe(true)
    expect(prompts[0]).toContain('blank roast-date card')
    expect(prompts[1]).toContain('blank comparison checklist')
    expect(prompts[2]).toContain('overhead home-brewing setup')
    expect(prompts.join('\n')).toContain('no logos')
    expect(prompts.join('\n')).not.toMatch(/NEXUS E2E Coffee logo|happy customer|branded roastery|expert barista/i)
    expect(prompts.every(imagePrompt => validateContentPlanDraftForSave({ imagePrompt }).ok)).toBe(true)
  })

  it('blocks positive logo and customer-satisfaction image prompts before save', () => {
    const result = validateContentPlanDraftForSave({
      imagePrompt: 'A package with the NEXUS E2E Coffee logo and a happy customer receiving delivery.',
    })

    expect(result.ok).toBe(false)
    expect(result.issues.map(issue => issue.reason)).toContain('unsupported_fake_product_visual')
  })

  it('renders explicit customer-workflow SaaS facts with safe captions and neutral visuals', () => {
    const ctx: ContentPlanRenderContext = {
      isArabic: true,
      brand: 'NEXUS Demo',
      keyMessage: 'تنظيم متابعة العملاء وفرص البيع',
      targetAudience: 'أصحاب الشركات الصغيرة',
      contentPillars: ['متابعة العملاء', 'وضوح العمل'],
      offer: 'نظام بسيط لإدارة طلبات العملاء',
      platform: 'LINKEDIN',
      postIndex: 2,
      verifiedProof: [],
      hasConversionDestination: false,
      brandFacts: [
        'منصة تساعد الشركات الصغيرة على تنظيم طلبات العملاء ومتابعة المبيعات',
        'إعداد سريع، واجهة عربية، ومتابعة واضحة دون تعقيد تقني',
      ],
    }

    expect(isCustomerWorkflowSaasContent(ctx)).toBe(true)
    const caption = renderContentPlanDraftCaption({
      caption: 'إدارة المبيعات أصبحت أسهل وأسرع. جرب النظام الآن.',
    }, ctx)
    const prompt = renderContentPlanDraftImagePrompt({
      imagePrompt: 'واجهة مستخدم لنظام إدارة مبيعات على الشاشة',
    }, ctx)

    expect(caption).toContain('الواجهة العربية')
    expect(caption).toContain('طلبات العملاء')
    expect(caption).not.toMatch(/أسهل وأسرع|جرب النظام الآن|زيادة فرص البيع/)
    expect(prompt).toContain('screens turned away')
    expect(prompt).toContain('no visible software UI')
    expect(prompt).not.toContain('واجهة مستخدم')
    expect(validateContentPlanDraftForSave({ caption, imagePrompt: prompt }).ok).toBe(true)
  })
})
