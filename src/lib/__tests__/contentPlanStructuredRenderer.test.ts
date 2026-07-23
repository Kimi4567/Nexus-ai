import { describe, expect, it } from 'vitest'
import {
  isClinicOperationalSaasContent,
  isCustomerWorkflowSaasContent,
  renderContentPlanDraftCaption,
  renderContentPlanDraftImagePrompt,
  renderContentPlanDraftVideoPrompt,
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

  it('does not replace unsafe clinic copy with a second invented content template', () => {
    const caption = renderContentPlanDraftCaption({
      caption: 'ClinicFlow AI يساعدك في تنظيم المواعيد وتحسين كفاءة العمليات. تواصل فعال وسهل مع مرضاك لتحسين الخدمة وزيادة رضاهم وثقتهم.',
    }, clinicCtx)

    expect(caption).toContain('تنظيم المواعيد')
    expect(caption).not.toContain('فريق الاستقبال')
    expect(caption).not.toContain('قائمة تشغيل داخلية')
    expect(validateContentPlanDraftForSave({ caption }).ok).toBe(false)
  })

  it('fails unsafe follow-up and bilingual clinic claims instead of fabricating replacements', () => {
    const followUp = renderContentPlanDraftCaption({
      caption: 'تعرف على كيفية تحسين متابعة المرضى وتوفير وقتك.',
    }, { ...clinicCtx, postIndex: 1 })
    expect(followUp).toContain('متابعة المرضى إداريًا')
    expect(followUp).not.toContain('تحسين متابعة المرضى')
    expect(validateContentPlanDraftForSave({ caption: followUp }).ok).toBe(false)

    const bilingual = renderContentPlanDraftCaption({
      caption: 'اكتشف كيف يعزز التواصل ثنائي اللغة رضا المرضى.',
    }, { ...clinicCtx, postIndex: 2 })
    expect(bilingual).toContain('التواصل ثنائي اللغة')
    expect(bilingual).not.toContain('رضا المرضى')
    expect(validateContentPlanDraftForSave({ caption: bilingual }).ok).toBe(true)
  })

  it('never invents an eight-post sequence from one repeated model caption', () => {
    const captions = Array.from({ length: 8 }, (_, postIndex) =>
      renderContentPlanDraftCaption({
        caption: 'ClinicFlow AI يساعدك في تنظيم المواعيد ومتابعة المرضى.',
      }, { ...clinicCtx, postIndex }),
    )

    expect(new Set(captions).size).toBe(1)
    expect(captions.join('\n')).not.toContain('فريق الاستقبال')
    expect(captions.join('\n')).not.toContain('ديمو')
    expect(captions.every(caption => validateContentPlanDraftForSave({ caption }).ok)).toBe(true)
  })

  it('keeps an underspecified image direction unchanged instead of inventing a clinic scene', () => {
    const prompt = renderContentPlanDraftImagePrompt({
      imagePrompt: 'YouTube Shorts concept for appointment follow-up',
    }, { ...clinicCtx, platform: 'YOUTUBE', postIndex: 1 })

    expect(prompt).toBe('YouTube Shorts concept for appointment follow-up')
    expect(prompt).not.toContain('clinic reception desk')
    expect(validateContentPlanDraftForSave({ imagePrompt: prompt }).ok).toBe(true)
  })

  it('converts fake product UI evidence into a strategy-grounded conceptual direction', () => {
    const prompt = renderContentPlanDraftImagePrompt({
      imagePrompt: 'صورة لواجهة تطبيق ClinicFlow AI على هاتف ذكي مع لوحة تحكم تعرض بيانات العيادة',
    }, clinicCtx)

    expect(prompt).toContain('Editorial conceptual illustration')
    expect(prompt).toContain('عيادات صغيرة ومتوسطة')
    expect(prompt).not.toMatch(/واجهة تطبيق|لوحة تحكم/)
    expect(validateContentPlanDraftForSave({ imagePrompt: prompt }).ok).toBe(true)
  })

  it('converts a fabricated happy-customer video into a truth-safe editorial direction', () => {
    const context: ContentPlanRenderContext = {
      isArabic: false,
      brand: 'Luma Roast Lab Certification',
      campaignName: 'Monthly coffee subscription',
      keyMessage: 'One kilogram monthly coffee subscription for Dubai',
      targetAudience: 'Dubai residents buying coffee for home',
      contentPillars: ['subscription routine', 'delivery details'],
      offer: 'AED 149 for one kilogram monthly',
      platform: 'TIKTOK',
      postIndex: 2,
      verifiedProof: [],
      brandFacts: [
        'The subscription is AED 149 for one kilogram each month.',
        'Delivery is limited to Dubai within 48 hours.',
        'There are no customer testimonials available.',
      ],
    }
    const prompt = renderContentPlanDraftVideoPrompt({
      videoScript: 'Show a happy customer receiving a branded coffee box and smiling at the Luma Roast Lab logo.',
    }, context)

    expect(prompt).toContain('Short-form editorial video concept')
    expect(prompt).toContain('Dubai residents buying coffee for home')
    expect(prompt).not.toMatch(/happy customer|branded coffee box|Luma Roast Lab logo/i)
    expect(validateContentPlanDraftForSave({ videoPrompt: prompt }).ok).toBe(true)
  })

  it('converts Arabic customer reactions and a branded roasting scene into a truth-safe direction', () => {
    const context: ContentPlanRenderContext = {
      isArabic: true,
      brand: 'Luma Roast Lab Certification',
      campaignName: 'Monthly coffee subscription',
      keyMessage: 'Freshly roasted coffee delivered within Dubai in 48 hours',
      targetAudience: 'Dubai residents buying coffee for home',
      contentPillars: ['subscription routine', 'delivery details'],
      offer: 'AED 149 for one kilogram monthly',
      platform: 'INSTAGRAM',
      postIndex: 2,
      verifiedProof: [],
      brandFacts: [
        'The coffee is freshly roasted.',
        'Delivery is limited to Dubai within 48 hours.',
        'There are no customer testimonials available.',
      ],
    }
    const prompt = renderContentPlanDraftVideoPrompt({
      videoScript: 'عرض عملية تحميص حبوب القهوة في لاب روست لاب، ثم ردود أفعال العملاء عند استلام القهوة.',
    }, context)

    expect(prompt).toContain('Short-form editorial video concept')
    expect(prompt).not.toMatch(/عملية تحميص.*في لاب روست لاب|ردود أفعال العملاء/)
    expect(validateContentPlanDraftForSave({ videoPrompt: prompt }).ok).toBe(true)
  })

  it('neutralizes the exact production roasting, branded-vehicle, and on-time-delivery drafts', () => {
    const context: ContentPlanRenderContext = {
      isArabic: false,
      brand: 'Luma Roast Lab Certification',
      campaignName: 'Monthly coffee subscription',
      keyMessage: 'One kilogram of freshly roasted coffee monthly',
      targetAudience: 'Dubai residents buying coffee for home',
      contentPillars: ['subscription routine', 'freshly roasted coffee', 'delivery details'],
      offer: 'AED 149 for one kilogram monthly',
      platform: 'INSTAGRAM',
      postIndex: 1,
      verifiedProof: [],
      brandFacts: [
        'The coffee is freshly roasted.',
        'The subscription includes one kilogram monthly for AED 149.',
        'Delivery is limited to Dubai within 48 hours.',
        'There are no customer testimonials or owned production visuals.',
      ],
    }
    const unsafeRoastingPrompt = "Scene 1: Start with a shot of green coffee beans being roasted. Scene 2: Show the beans being packed and sealed in Luma Roast Lab bags. Scene 3: A delivery van with 'Luma Roast Lab' branding drives through Dubai."
    const unsafeDeliveryPrompt = "Scene 1: A calendar with a marked delivery date. Scene 2: A person receives a package labeled 'Luma Roast Lab' on the marked date. Scene 3: The person enjoys a cup of coffee. Overlay text: 'Timely deliveries, every month.'"
    const unsafeCaption = 'Experience freshly roasted coffee in Dubai. Watch how we Help quality in every bean.'
    const unsafeDeliveryCaption = 'Check how our monthly subscription fits your coffee routine with timely deliveries.'

    const roastingPrompt = renderContentPlanDraftVideoPrompt({ videoScript: unsafeRoastingPrompt }, context)
    const deliveryPrompt = renderContentPlanDraftVideoPrompt({ videoScript: unsafeDeliveryPrompt }, { ...context, postIndex: 2 })
    const caption = renderContentPlanDraftCaption({ caption: unsafeCaption }, context)
    const deliveryCaption = renderContentPlanDraftCaption({ caption: unsafeDeliveryCaption }, { ...context, postIndex: 2 })

    expect(roastingPrompt).toContain('Short-form editorial video concept')
    expect(deliveryPrompt).toContain('Short-form editorial video concept')
    expect(roastingPrompt).not.toMatch(/being roasted|Luma Roast Lab bags|delivery van|branding/i)
    expect(deliveryPrompt).not.toMatch(/marked delivery date|person receives|person enjoys|timely deliveries/i)
    expect(caption).not.toMatch(/help quality|quality in every bean/i)
    expect(deliveryCaption).toContain('delivery within the documented service window')
    expect(validateContentPlanDraftForSave({
      caption,
      videoPrompt: roastingPrompt,
    }).ok).toBe(true)
    expect(validateContentPlanDraftForSave({
      caption: deliveryCaption,
      videoPrompt: deliveryPrompt,
    }).ok).toBe(true)

    expect(validateContentPlanDraftForSave({
      caption: unsafeCaption,
      videoPrompt: unsafeRoastingPrompt,
    }).ok).toBe(false)
    expect(validateContentPlanDraftForSave({
      caption: unsafeDeliveryCaption,
      videoPrompt: unsafeDeliveryPrompt,
    }).ok).toBe(false)
  })

  it('neutralizes the exact Arabic production storyboards observed in production', () => {
    const context: ContentPlanRenderContext = {
      isArabic: true,
      brand: 'Luma Roast Lab Certification',
      campaignName: 'اشتراك القهوة الشهري',
      keyMessage: 'كيلوغرام واحد من القهوة المحمصة حديثًا شهريًا',
      targetAudience: 'سكان دبي الذين يشترون القهوة للمنزل',
      contentPillars: ['روتين الاشتراك', 'تفاصيل القهوة المحمصة', 'نطاق ومدة التوصيل'],
      offer: '149 درهمًا لكيلوغرام واحد شهريًا',
      platform: 'INSTAGRAM',
      postIndex: 1,
      verifiedProof: [],
      brandFacts: [
        'القهوة محمصة حديثًا.',
        'الاشتراك كيلوغرام واحد شهريًا مقابل 149 درهمًا.',
        'التوصيل داخل دبي فقط خلال 48 ساعة.',
        'لا توجد شهادات عملاء أو وسائط إنتاج مملوكة.',
      ],
    }
    const storyboards = [
      'مشهد 1: شخص يشعر بالإحباط عند نفاذ القهوة. مشهد 2: لقطات لعملية الاشتراك في خدمة القهوة الشهرية. مشهد 3: استلام القهوة الطازجة في المنزل.',
      'مشهد 1: لقطات لعملية تحميص القهوة. مشهد 2: تعبئة القهوة في أكياس. مشهد 3: توصيل ضمن النطاق الموثق.',
      'مشهد 1: شخص ينتظر القهوة بفارغ الصبر. مشهد 2: لقطات لعملية توصيل القهوة السريعة. مشهد 3: التوصيل ضمن النطاق والمدة الموثقين.',
      'مشهد 1: لقطات من تفاصيل القهوة المحمصة المتاحة في Luma Roast Lab. مشهد 2: تغليف القهوة بعناية. مشهد 3: توصيل القهوة إلى باب العميل. مشهد 4: العميل يفتح العبوة ويستمتع برائحة القهوة الطازجة.',
      'مشهد 1: لقطات تسلط الضوء على مدة التوصيل الموثقة من Luma Roast Lab. مشهد 2: توضيح نافذة التوصيل خلال 48 ساعة في دبي. مشهد 3: العميل يستلم القهوة في الوقت المحدد.',
    ]
    const prompts = storyboards.map((videoScript, postIndex) =>
      renderContentPlanDraftVideoPrompt({ videoScript }, { ...context, postIndex }),
    )
    const caption = renderContentPlanDraftCaption({
      caption: 'اكتشف كيف يتم تحميص قهوتنا الطازجة وتوصيلها إليك في دبي. تعرف على عملية تحميص القهوة. شاهد عملية التحميص وتأكد من جودة القهوة التي تصلك. استمتع بجودة القهوة المحمصة حديثًا. #قهوة #تحميص',
    }, context)
    const deliveryCaption = renderContentPlanDraftCaption({
      caption: 'هل تشعر بالقلق من تأخير توصيل القهوة؟ راجع مدى ملاءمة اشتراكنا الشهري لروتينك. #توصيل_سريع #قهوة',
    }, { ...context, postIndex: 2 })

    expect(prompts.every(prompt => prompt.includes('Short-form editorial video concept'))).toBe(true)
    expect(prompts.join('\n')).not.toMatch(/شخص|العميل|عملية الاشتراك|عملية تحميص|عملية التحميص|تعبئة القهوة|تغليف القهوة|استلام القهوة|عملية توصيل|باب العميل/)
    expect(caption).not.toMatch(/كيف يتم تحميص قهوتنا|عملية تحميص|عملية التحميص|تأكد من جودة|استمتع بجودة/)
    expect(deliveryCaption).toContain('#تفاصيل_التوصيل')
    expect(prompts.every(videoPrompt => validateContentPlanDraftForSave({ videoPrompt }).ok)).toBe(true)
    expect(validateContentPlanDraftForSave({ caption }).ok).toBe(true)
    expect(validateContentPlanDraftForSave({ caption: deliveryCaption }).ok).toBe(true)

    expect(storyboards.every(videoPrompt => !validateContentPlanDraftForSave({ videoPrompt }).ok)).toBe(true)
  })

  it('blocks and neutralizes the latest production Arabic delivery storyboard', () => {
    const context: ContentPlanRenderContext = {
      isArabic: true,
      brand: 'Luma Roast Lab Certification',
      campaignName: 'اشتراك القهوة الشهري',
      keyMessage: 'كيلوغرام واحد من القهوة المحمصة حديثًا شهريًا',
      targetAudience: 'سكان دبي الذين يشترون القهوة للمنزل',
      contentPillars: ['روتين الاشتراك', 'تفاصيل القهوة المحمصة', 'نطاق ومدة التوصيل'],
      offer: '149 درهمًا لكيلوغرام واحد شهريًا',
      platform: 'INSTAGRAM',
      postIndex: 2,
      verifiedProof: [],
      brandFacts: [
        'القهوة محمصة حديثًا.',
        'الاشتراك كيلوغرام واحد شهريًا مقابل 149 درهمًا.',
        'التوصيل داخل دبي فقط خلال 48 ساعة.',
        'لا توجد وسائط إنتاج أو توصيل مملوكة.',
      ],
    }
    const rawStoryboard = 'المشهد الأول: ساعة تشير إلى الوقت مع نص يوضح مدة التوصيل الموثقة. المشهد الثاني: لقطات لشاحنة التوصيل وهي تتحرك في شوارع دبي. المشهد الثالث: القهوة تصل إلى العميل في الوقت المحدد. النهاية: نص على الشاشة يدعو المشاهدين للاطلاع على التفاصيل الموثقة.'
    const videoPrompt = renderContentPlanDraftVideoPrompt({ videoScript: rawStoryboard }, context)

    expect(validateContentPlanDraftForSave({ videoPrompt: rawStoryboard }).ok).toBe(false)
    expect(videoPrompt).toContain('Short-form editorial video concept')
    expect(videoPrompt).not.toMatch(/نص|شاحنة|تصل إلى العميل|الوقت المحدد/)
    expect(validateContentPlanDraftForSave({ videoPrompt }).ok).toBe(true)
  })

  it('blocks prefixed Arabic guarantees and direct-to-home delivery', () => {
    const result = validateContentPlanDraftForSave({
      caption: 'اشترك الآن لتضمن حصولك على القهوة مع توصيل القهوة إلى منزلك.',
    })

    expect(result.ok).toBe(false)
    expect(result.issues.map(issue => issue.reason)).toContain('unsupported_absolute_claim')
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

  it('renders production-observed time and efficiency wording into save-gate-safe copy', () => {
    const caption = renderContentPlanDraftCaption({
      caption: 'ClinicFlow helps you save time. يساعد ClinicFlow على تحسين كفاءة العمليات اليومية.',
    }, clinicCtx)

    expect(caption).not.toMatch(/save time/i)
    expect(caption).not.toContain('تحسين كفاءة')
    expect(validateContentPlanDraftForSave({ caption }).ok).toBe(true)
  })

  it('blocks unsupported clinic security promises and renders them safely without proof', () => {
    const unsafe = validateContentPlanDraftForSave({
      caption: 'احمِ بيانات عيادتك مع إدارة متكاملة وآمنة وإجراءات الأمان لدينا.',
    })
    expect(unsafe.ok).toBe(false)
    expect(unsafe.issues.map(issue => issue.reason)).toContain('unsupported_security_claim')

    const caption = renderContentPlanDraftCaption({
      caption: 'احمِ بيانات عيادتك مع إدارة متكاملة وآمنة. اكتشف إجراءات الأمان لدينا.',
    }, clinicCtx)
    expect(caption).toContain('راجع وثائق الأمان وصلاحيات الوصول')
    expect(validateContentPlanDraftForSave({ caption }).ok).toBe(true)
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

  it('replaces Arabic storyboard instructions that request exact readable on-screen copy', () => {
    const context: ContentPlanRenderContext = {
      isArabic: true,
      brand: 'Luma Roast Lab Certification',
      campaignName: 'Monthly coffee subscription',
      keyMessage: 'One kilogram monthly coffee subscription for Dubai',
      targetAudience: 'Dubai residents buying coffee for home',
      contentPillars: ['roast details', 'delivery details'],
      offer: 'AED 149 for one kilogram monthly',
      platform: 'META',
      postIndex: 1,
      verifiedProof: [],
      brandFacts: [
        'The subscription is AED 149 for one kilogram each month.',
        'Delivery is limited to Dubai within 48 hours.',
      ],
    }
    const rawVideoScript = 'مشهد 1: لقطات من تفاصيل القهوة المحمصة المتاحة. مشهد 2: راجع تاريخ التحميص وتفاصيل المنتج. مشهد 3: نطاق التوصيل في دبي. مشهد 4: نص: \'اكتشف المزيد\' مع دعوة للتواصل.'

    const videoPrompt = renderContentPlanDraftVideoPrompt({
      videoScript: rawVideoScript,
    }, context)

    expect(validateContentPlanDraftForSave({ videoPrompt: rawVideoScript }).ok).toBe(false)
    expect(videoPrompt).toContain('Short-form editorial video concept')
    expect(videoPrompt).toContain('Use no screens, screenshots, readable text')
    expect(videoPrompt).not.toMatch(/نص\s*:|اكتشف المزيد/)
    expect(validateContentPlanDraftForSave({ videoPrompt }).ok).toBe(true)
  })

  it('repairs the observed production captions and normalizes fallback video topics', () => {
    const context: ContentPlanRenderContext = {
      isArabic: true,
      brand: 'Luma Roast Lab Certification',
      campaignName: 'Monthly coffee subscription',
      keyMessage: 'One kilogram monthly coffee subscription for Dubai',
      targetAudience: 'Dubai residents buying coffee for home',
      contentPillars: [
        'Monthly Subscription Benefits',
        'Coffee documented product details to review',
        'Delivery Efficiency',
      ],
      offer: 'AED 149 for one kilogram monthly',
      platform: 'META',
      postIndex: 1,
      verifiedProof: [],
      brandFacts: [
        'One kilogram of freshly roasted coffee is supplied monthly for AED 149.',
        'Delivery is limited to Dubai within 48 hours.',
      ],
    }
    const rawCaption = 'استمتع بتوصيل القهوة الطازجة ضمن نطاق التوصيل الموثق في دبي. راجع تفاصيل القهوة المحمصة المتاحة راجع تفاصيل القهوة والاشتراك المتاحة. #قهوة_طازجة #دبي'
    const rawVideoScript = 'مشهد 1: عملية تحميص القهوة. مشهد 2: نص: \'اكتشف المزيد\'.'

    const caption = renderContentPlanDraftCaption({ caption: rawCaption }, context)
    const productTopicPrompt = renderContentPlanDraftVideoPrompt({ videoScript: rawVideoScript }, context)
    const deliveryTopicPrompt = renderContentPlanDraftVideoPrompt(
      { videoScript: rawVideoScript },
      { ...context, postIndex: 2 },
    )

    expect(validateContentPlanDraftForSave({ caption: rawCaption }).ok).toBe(false)
    expect(caption).toContain('راجع توصيل القهوة المحمصة حديثًا ضمن النطاق الموثق في دبي')
    expect(caption).toContain('راجع تفاصيل القهوة المحمصة والاشتراك المتاحة')
    expect(validateContentPlanDraftForSave({ caption }).ok).toBe(true)
    expect(productTopicPrompt).toContain('about documented coffee product details.')
    expect(productTopicPrompt).not.toContain('Coffee documented product details to review')
    expect(deliveryTopicPrompt).toContain('about the documented coffee delivery scope and service window.')
    expect(deliveryTopicPrompt).not.toContain('..')
    expect(validateContentPlanDraftForSave({
      productTopicPrompt,
      deliveryTopicPrompt,
    }).ok).toBe(true)
  })

  it('save gate blocks the three observed Arabic production defects before persistence', () => {
    const defects = [
      'شاهد كيف يمكن للاشتراك الشهري لدينا أن ينظم احتياجك للقهوة بكل سهولة.',
      'راجع تفاصيل القهوة المحمصة المتاحة راجع تفاصيل القهوة والاشتراك المتاحة.',
      'اكتشف كيف يمكننا ضمان توقيت التوصيل يعتمد على الموقع وموثوق.',
    ]

    expect(defects.every(caption => !validateContentPlanDraftForSave({ caption }).ok)).toBe(true)
  })

  it('blocks malformed roasting-quality copy and delivery hooks that do not answer their question', () => {
    const defects = [
      'شاهد كيف نحرص على جودة التحميص لتصل إليك في حالاتها مناسب.',
      'هل تتساءل عن سرعة توصيل القهوة؟ راجع مدى ملاءمة اشتراكنا الشهري لروتين القهوة الخاص بك.',
    ]

    expect(defects.every(caption => !validateContentPlanDraftForSave({ caption }).ok)).toBe(true)
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

  it('softens residual Arabic always wording before the strict save gate', () => {
    const context: ContentPlanRenderContext = {
      isArabic: true,
      brand: 'Luma Roast Lab Certification',
      campaignName: 'Monthly coffee subscription',
      keyMessage: 'One kilogram monthly coffee subscription for Dubai',
      targetAudience: 'Dubai residents buying coffee for home',
      contentPillars: ['subscription routine', 'delivery details'],
      offer: 'AED 149 for one kilogram monthly',
      platform: 'TIKTOK',
      postIndex: 0,
      verifiedProof: [],
      brandFacts: [
        'The subscription is AED 149 for one kilogram each month.',
        'Delivery is limited to Dubai within 48 hours.',
      ],
    }

    const caption = renderContentPlanDraftCaption({
      caption: 'راجع درجة الطحن دائمًا قبل الطلب الشهري.',
    }, context)
    const videoPrompt = renderContentPlanDraftVideoPrompt({
      videoScript: 'اعرض تفاصيل قهوة محايدة دائمًا من دون شعار أو نص مقروء.',
    }, context)

    expect(caption).toContain('بشكل منتظم')
    expect(videoPrompt).toContain('بشكل منتظم')
    expect(caption).not.toMatch(/دائمًا|دائما/)
    expect(videoPrompt).not.toMatch(/دائمًا|دائما/)
    expect(validateContentPlanDraftForSave({ caption, videoPrompt }).ok).toBe(true)
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

  it('blocks the observed NEXUS workflow overclaims if the truth guard misses them', () => {
    const captions = [
      'Help consistent messaging across all platforms.',
      'Help your brand voice remains consistent across all channels.',
      'Centralize your operations and eliminate scattered efforts.',
      'Achieve seamless operations.',
      'Discover how NEXUS AI enhances resource utilization.',
      'With NEXUS AI, you can trust that every marketing decision is backed by human approval.',
      'Our system helps you know exactly where your marketing spend is going.',
      "Limited resources won't hold you back from achieving marketing success.",
      'See how collaboration enhances marketing solutions.',
      'Learn how to make the most of your resources.',
      'يمكنك الوثوق في كل خطوة لضمان دقة وفعالية الاستراتيجيات.',
      'مع نكسوس AI، يمكنك التحكم الكامل في إنفاقك.',
      'حلولنا تساعد على تحسين عملياتك التسويقية.',
    ]

    for (const caption of captions) {
      expect(validateContentPlanDraftForSave({ caption }).ok).toBe(false)
    }
  })

  it('rejects lowercase sentence starts without blocking valid title case', () => {
    expect(validateContentPlanDraftForSave({
      caption: 'Keep approved messaging in the workflow. with NEXUS AI.',
    }).ok).toBe(false)
    expect(validateContentPlanDraftForSave({
      caption: 'Keep approved messaging in the workflow. With NEXUS AI, review the next handoff.',
    }).ok).toBe(true)
  })

  it('rejects weak coffee drafts and invented imagery instead of substituting another campaign', () => {
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

    expect(rendered).toEqual(observed)
    expect(rendered.every(caption => !validateContentPlanDraftForSave({ caption }).ok)).toBe(true)
    expect(prompts.every(imagePrompt => validateContentPlanDraftForSave({ imagePrompt }).ok)).toBe(true)
    expect(prompts.join('\n')).not.toMatch(/branded roastery|happy customer|expert barista/i)
  })

  it('blocks positive logo and customer-satisfaction image prompts before save', () => {
    const result = validateContentPlanDraftForSave({
      imagePrompt: 'A package with the NEXUS E2E Coffee logo and a happy customer receiving delivery.',
    })

    expect(result.ok).toBe(false)
    expect(result.issues.map(issue => issue.reason)).toContain('unsupported_fake_product_visual')
  })

  it('keeps customer-workflow copy grounded and replaces a fake software screen with a conceptual brief', () => {
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

    expect(caption).toContain('يمكن تنظيم متابعة المبيعات')
    expect(caption).not.toMatch(/أسهل وأسرع|جرب النظام الآن|زيادة فرص البيع/)
    expect(prompt).toContain('Editorial conceptual illustration')
    expect(prompt).not.toContain('واجهة مستخدم')
    expect(validateContentPlanDraftForSave({ caption, imagePrompt: prompt }).ok).toBe(true)
  })
})
