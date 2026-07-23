import { describe, expect, it } from 'vitest'
import { buildContentPlanTruthContext, reviewContentPlanForApproval } from '@/lib/contentPlanApprovalGuard'

const strategy = {
  keyMessage: 'Prepare for a clear dental consultation',
  primaryOffer: 'Book a dental consultation',
  contentPillars: ['dental education', 'consultation preparation'],
  contentAnglesDetailed: [
    { title: 'Questions for your dentist', cta: 'Save the consultation checklist' },
    { title: 'Understand treatment options', cta: 'Book a consultation' },
  ],
}

const facts = ['Noura Dental Studio', 'Dental consultations and treatment planning']

describe('contentPlanApprovalGuard', () => {
  it('blocks invented SaaS capabilities and outcomes that are absent from Brand Brain', () => {
    const review = reviewContentPlanForApproval([
      { caption: 'Our system offers seamless integration and instant support while reducing your costs.' },
    ], {}, ['Unified lead management with clear reports'])

    expect(review.ok).toBe(false)
    expect(review.issues.map(issue => issue.reason)).toContain('unverified_feature_or_outcome')
  })

  it('does not block a capability explicitly supplied by Brand Brain', () => {
    const review = reviewContentPlanForApproval([
      { caption: 'The system integrates with HubSpot for a connected workflow.' },
    ], {}, ['Native HubSpot integration is included.'])

    expect(review.issues.map(issue => issue.reason)).not.toContain('unverified_feature_or_outcome')
  })

  it('blocks the observed clinic-operations drift at approval time', () => {
    const review = reviewContentPlanForApproval([
      { contentPlanIndex: 1, caption: 'The front desk feels the handoff problem before leadership. Bring this workflow checklist to your team meeting.' },
      { contentPlanIndex: 2, caption: 'Use request, owner, last update, and next admin step for every appointment.' },
    ], strategy, facts)

    expect(review.ok).toBe(false)
    expect(review.issues.map(issue => issue.reason)).toContain('unexpected_operational_saas_drift')
  })

  it('does not let a stale clinic-software strategy override dental Brand Brain facts', () => {
    const staleStrategy = {
      positioning: 'A workflow platform for clinic front-desk teams',
      contentPillars: ['clinic workflow', 'bilingual administrative communication'],
      contentAnglesDetailed: [
        { title: 'Front-desk handoff', hook: 'Map the admin workflow' },
      ],
    }
    const review = reviewContentPlanForApproval([
      { contentPlanIndex: 1, caption: 'The front desk feels the handoff problem before leadership. Bring this workflow checklist to your team meeting.' },
    ], staleStrategy, [
      'Noura Dental Studio',
      'Dental clinic providing preventive, cosmetic, and restorative consultations',
    ])

    expect(review.ok).toBe(false)
    expect(review.issues.map(issue => issue.reason)).toContain('unexpected_operational_saas_drift')
  })

  it('blocks unsupported performance or guarantee claims even when vocabulary overlaps', () => {
    const review = reviewContentPlanForApproval([
      { contentPlanIndex: 1, caption: 'Save these dental consultation questions for guaranteed results.' },
      { contentPlanIndex: 2, caption: 'Understand treatment options, then book a dental consultation.' },
    ], strategy, facts)

    expect(review.ok).toBe(false)
    expect(review.issues.some(issue => issue.reason.includes('guarantee'))).toBe(true)
  })

  it('blocks generic legacy hook formulas before approval or publishing', () => {
    const review = reviewContentPlanForApproval([
      { contentPlanIndex: 1, caption: 'هل تعلم أن التسويق الذكي يمكن أن يغير مسار شركتك؟' },
      { contentPlanIndex: 2, caption: 'Did you know analytics can transform your business?' },
    ], strategy, facts)

    expect(review.ok).toBe(false)
    expect(review.issues.filter(issue => issue.reason === 'generic_hook_formula')).toHaveLength(2)
  })

  it('blocks shopping CTAs when Brand Brain has no verified conversion destination', () => {
    const review = reviewContentPlanForApproval([
      { contentPlanIndex: 1, caption: 'Shop the look and browse our collection.' },
      { contentPlanIndex: 2, caption: 'تسوق الآن واكتشف المجموعة.' },
    ], {
      keyMessage: 'Modern abayas for women in the UAE',
      contentAnglesDetailed: [
        { title: 'Modern abaya details' },
        { title: 'Product selection' },
      ],
    }, ['Modern abayas for women in the UAE'])

    expect(review.ok).toBe(false)
    expect(review.issues.map(issue => issue.reason)).toContain('unverified_feature_or_outcome')
  })

  it('blocks polished but non-specific analytics, quality, and help formulas', () => {
    const review = reviewContentPlanForApproval([
      { contentPlanIndex: 1, caption: 'التحليلات ليست مجرد أرقام، بل هي مفتاح النجاح!' },
      { contentPlanIndex: 2, caption: 'الجودة تبدأ من هنا: الموافقات البشرية.' },
      { contentPlanIndex: 3, caption: 'اكتشف كيف يمكننا مساعدتك في النمو.' },
      { contentPlanIndex: 4, caption: 'Analytics are more than just numbers; they are the key to success.' },
    ], strategy, facts)

    expect(review.ok).toBe(false)
    expect(review.issues.filter(issue => issue.reason === 'generic_hook_formula')).toHaveLength(4)
  })

  it('allows aligned, review-safe drafts', () => {
    const review = reviewContentPlanForApproval([
      { contentPlanIndex: 1, caption: 'Save three questions to ask your dentist during a dental consultation.' },
      { contentPlanIndex: 2, caption: 'Understand the treatment options and book a dental consultation to discuss next steps.' },
    ], strategy, facts)

    expect(review).toEqual({ ok: true, issues: [] })
  })

  it('allows grounded interior-design captions and text-free scene directions', () => {
    const review = reviewContentPlanForApproval([
      {
        contentPlanIndex: 1,
        caption: 'تجاوز الميزانية يبدأ غالبًا من غموض النطاق. في دار سُكنى نعرض مراحل المشروع ونقاط المراجعة ونطاق التكلفة قبل بدء التنفيذ. اطلب جلسة اكتشاف لمراجعة نطاق مشروعك. #دار_سُكنى #تصميم_داخلي',
        videoPrompt: 'فيديو عمودي قصير بلا نص داخل اللقطات: مصمم داخلي يراجع نموذج مساحة ولوحة مواد، ثم يرتب بطاقات مراحل فارغة وعينات خامات في تسلسل واضح، وينتهي بلقطة هادئة للنموذج. يظل العنوان والدعوة لاتخاذ الإجراء طبقات قابلة للتحرير خارج الفيديو.',
      },
      {
        contentPlanIndex: 2,
        caption: 'هل تبحث عن تصميم داخلي يعكس ذوقك؟ في دار سُكنى نعرض تصور المساحة ومراحل العمل ونقاط المراجعة، مع تحديثات أسبوعية بالعربية أو الإنجليزية وفق نطاق المشروع. اطلب جلسة اكتشاف لمراجعة التفاصيل. #دار_سُكنى #تصميم_داخلي',
        videoPrompt: 'فيديو عمودي قصير بلا نص داخل اللقطات: مساحة سكنية قبل التجديد، ثم فريق التصميم يراجع نموذجًا ثلاثي الأبعاد ولوحة مواد في اجتماع تحديث، ثم لقطة ختامية للتصور المقترح. يظل العنوان والدعوة لاتخاذ الإجراء طبقات قابلة للتحرير خارج الفيديو.',
      },
      {
        contentPlanIndex: 3,
        caption: 'راجع تصور المساحة قبل التنفيذ. تقدم دار سُكنى تصورًا ثلاثي الأبعاد للمراجعة ضمن مراحل التصميم المتفق عليها، حتى تناقش التفاصيل قبل بدء العمل. اطلب جلسة اكتشاف لمراجعة مشروعك. #دار_سُكنى #تصميم_داخلي',
        imagePrompt: 'تصور ثلاثي الأبعاد واقعي لغرفة معيشة حديثة بتفاصيل دقيقة وألوان دافئة وإضاءة طبيعية، بلا أي نص أو شعارات داخل الصورة، مع مساحة سالبة هادئة لإضافة عنوان قابل للتحرير لاحقًا.',
      },
    ], {
      keyMessage: 'تصميم داخلي واضح قبل التنفيذ',
      primaryOffer: 'باقة تصميم داخلي تشمل جلسة اكتشاف ومخططًا وتصورًا ثلاثي الأبعاد واختيار المواد والإشراف',
      contentPillars: ['وضوح نطاق المشروع', 'مراجعة التصور قبل التنفيذ'],
    }, [
      'دار سُكنى للتصميم الداخلي',
      'استوديو تصميم وتجديد في دبي يقدم الاستشارة والتصور ثلاثي الأبعاد والإشراف',
      'تبدأ المشاريع بنطاق مكتوب وخط زمني تتم مراجعتهما قبل التنفيذ',
      'تحديثات أسبوعية بالعربية أو الإنجليزية',
    ])

    expect(review).toEqual({ ok: true, issues: [] })
  })

  it('does not treat an owner-only social-proof entry as publishable evidence', () => {
    const truth = buildContentPlanTruthContext({
      brandName: 'Northstar',
      verifiedProof: ['Trusted by thousands of verified business customers'],
    })
    const review = reviewContentPlanForApproval([
      { caption: 'Trusted by thousands of verified business customers.' },
    ], { keyMessage: 'Verified business adoption' }, truth)

    expect(review.issues.map(issue => issue.reason)).toContain('unsupported_socialProof')
  })

  it('accepts exact social proof only when it is linked to an inspectable source', () => {
    const truth = buildContentPlanTruthContext({
      brandName: 'Northstar',
      verifiedProof: ['Trusted by thousands of verified business customers [Source: customer-report.pdf — Page 3]'],
    })
    const review = reviewContentPlanForApproval([
      { caption: 'Trusted by thousands of verified business customers.' },
    ], { keyMessage: 'Verified business adoption' }, truth)

    expect(review.issues.map(issue => issue.reason)).not.toContain('unsupported_socialProof')
    expect(review.issues.map(issue => issue.reason)).not.toContain('unverified_feature_or_outcome')
  })

  it('still blocks guarantees and provider-live status even when repeated in Brand Brain', () => {
    const truth = buildContentPlanTruthContext({
      verifiedProof: ['Guaranteed results', 'Campaign is live'],
    })
    const review = reviewContentPlanForApproval([
      { caption: 'Guaranteed results. Campaign is live.' },
    ], {}, truth)

    expect(review.issues.map(issue => issue.reason)).toEqual(expect.arrayContaining([
      'unsupported_guarantee',
      'unsupported_platformStatus',
    ]))
  })

  it('blocks production-observed first-party roasting and on-time delivery scenes at approval time', () => {
    const truth = buildContentPlanTruthContext({
      brandName: 'Luma Roast Lab Certification',
      primaryOffer: 'One kilogram of freshly roasted coffee monthly for AED 149',
      audienceLocation: 'Dubai',
      complianceNotes: 'Delivery is limited to Dubai within 48 hours. No testimonials or owned production visuals.',
    })
    const review = reviewContentPlanForApproval([
      {
        contentPlanIndex: 1,
        caption: 'Experience freshly roasted coffee in Dubai. Watch how we Help quality in every bean.',
        videoPrompt: "Show coffee beans being roasted and sealed in branded bags. A delivery van with 'Luma Roast Lab' branding drives through Dubai.",
      },
      {
        contentPlanIndex: 2,
        caption: 'Check how the monthly subscription fits your routine with timely deliveries.',
        videoPrompt: "A calendar shows a marked delivery date. A person receives a package on the marked date and enjoys a cup of coffee.",
      },
    ], {
      keyMessage: 'One kilogram monthly for AED 149 with delivery in Dubai within 48 hours',
      contentPillars: ['subscription routine', 'freshly roasted coffee', 'delivery details'],
    }, truth)

    expect(review.ok).toBe(false)
    expect(review.issues.map(issue => issue.reason)).toEqual(expect.arrayContaining([
      'malformed_caption',
      'unsupported_fake_product_visual',
      'unsupported_absolute_claim',
    ]))
  })
})
