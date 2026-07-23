import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import {
  buildContentDraftTruthPolicyPrompt,
  guardContentDraftText,
  guardContentDraftTruth,
} from '../contentDraftTruthGuard'

describe('contentDraftTruthGuard', () => {
  it('removes invented SaaS features and business outcomes not present in Brand Brain', () => {
    const context = {
      brandFacts: [
        'Unified lead-management system with quick setup, Arabic and English interfaces, and clear reports.',
        'Sales managers in UAE service businesses.',
      ],
      verifiedProof: [],
      hasConversionDestination: true,
    }
    const drafts = [
      'Do you know how to turn leads into sales? Watch how you can enhance your sales strategy today. #BusinessGrowth',
      'Looking for a system that integrates with your existing tools? Our solution offers seamless integration for a more efficient workflow. #SystemIntegration',
      'احصل على دعم فوري مع نظامنا! لا تقلق بشأن الدعم الفني، فنحن هنا لمساعدتك في أي وقت.',
      'Reduce your costs with our unified system! Discover how you can save on multiple systems.',
      'ارفع إنتاجيتك مع نظامنا الفعال! تخلص من التشتت وزد من كفاءة عملك.',
      'Expand your business with our system and scale your operations smoothly. #MarketGrowth',
      'احصل على تجربة مستخدم محسنة تلبي احتياجاتك وتجاوز توقعاتك.',
    ]

    const guarded = drafts.map(draft => guardContentDraftText(draft, context)).join(' ')
    expect(guarded).not.toMatch(/turn leads into sales|watch how|integrat|seamless|instant support|reduce your costs|save on|productiv|efficien|expand your business|scale your operations|marketgrowth|دعم فوري|الدعم الفني|إنتاجيتك|كفاءة عملك|تجربة مستخدم محسنة|تجاوز توقعاتك/i)
    expect(guarded).toContain('verify documented compatibility')
    expect(guarded).toContain('راجع قنوات الدعم')
    expect(guarded).toContain('Compare current tool costs')
    expect(guarded).toContain('راجع تجربة الاستخدام الفعلية')
  })

  it('keeps an integration capability when Brand Brain explicitly supplies it', () => {
    const draft = 'The system integrates with HubSpot for a connected workflow.'
    expect(guardContentDraftText(draft, {
      brandFacts: ['Native HubSpot integration is included.'],
    })).toBe(draft)
  })

  it('grounds setup-time precision and removes unsupported direct-response CTAs', () => {
    const out = guardContentDraftText(
      'ابدأ باستخدام النظام في دقائق معدودة! لن تحتاج لوقت طويل لإعداد الأنظمة الجديدة. استمتع بإعداد سريع وفعال. جرب النظام الآن!',
      { hasConversionDestination: false },
    )

    expect(out).toContain('ابدأ بخطوات إعداد بسيطة وواضحة')
    expect(out).toContain('مراجعة خطوات الإعداد دون تعقيد تقني')
    expect(out).toContain('إعداد سريع ومنظم')
    expect(out).toContain('تعرّف على طريقة عمل الحل')
    expect(out).not.toMatch(/دقائق معدودة|جرب النظام الآن|سريع وفعال/)
  })

  it('preserves a direct CTA only when the brand has a conversion destination', () => {
    expect(guardContentDraftText('جرب النظام الآن!', { hasConversionDestination: true }))
      .toContain('جرب النظام الآن')
  })

  it('removes shopping CTAs when no store or conversion destination is verified', () => {
    const joined = [
      'Shop the look.',
      'Browse our collection.',
      'Explore the collection.',
      'Add to cart.',
      'تسوق الآن.',
      'اكتشف المجموعة.',
    ].map(text => guardContentDraftText(text, { hasConversionDestination: false })).join(' ')

    expect(joined).not.toMatch(/shop the look|browse our collection|explore the collection|add to cart|تسوق الآن|اكتشف المجموعة/i)
    expect(joined).toContain('Review the product details')
    expect(joined).toContain('راجع تفاصيل المجموعة الموثقة')
  })

  it('marks unsupported fashion use contexts and product claims as unverified details', () => {
    const out = guardContentDraftText(
      'A comfortable work-ready abaya in premium fabrics for every occasion, inspired by cultural heritage.',
      { brandFacts: ['Modern abayas presented in Arabic and English.'] },
    )

    expect(out).not.toMatch(/comfortable|work-ready|premium fabrics|every occasion|cultural heritage/i)
    expect(out).toContain('product detail to verify')
    expect(out).toContain('use-case direction to validate')
    expect(out).toContain('a use occasion to validate')
    expect(out).toContain('cultural angle to validate')
  })

  it('grounds sales outcome copy and removes invented product UI from image directions', () => {
    const copy = guardContentDraftText(
      'نظام NEXUS يقدم لك خيار عملي! تابع عملاءك بسهولة وبدون تعقيد تقني. إدارة المبيعات أصبحت أسهل وأسرع. تعرف على كيفية تحسين مبيعاتك الآن! واجهة عربية مصممة خصيصًا لك.',
      { hasConversionDestination: false },
    )
    const image = guardContentDraftText(
      'رجل أعمال أمام حاسوب، يظهر على الشاشة واجهة إعداد نظام NEXUS بشكل بسيط، مع ساعة جدارية تشير إلى وقت قصير.',
    )

    expect(copy).toContain('يقدم مسارًا عمليًا')
    expect(copy).toContain('نظّم متابعة عملائك بخطوات واضحة')
    expect(copy).toContain('تنظيم متابعة المبيعات بخطوات أوضح')
    expect(copy).toContain('طريقة تنظيم متابعة المبيعات')
    expect(copy).not.toMatch(/تحسين مبيعاتك|أسهل وأسرع|مصممة خصيصًا لك/)
    expect(image).toContain('شاشة محايدة غير مقروءة')
    expect(image).toContain('دون إيحاء بزمن إعداد محدد')
    expect(image).not.toMatch(/واجهة إعداد نظام|وقت قصير/)
  })

  it('softens luxury and perfection claims in draft captions', () => {
    const luxury = guardContentDraftText('ensuring every coffee break is a moment of luxury')
    expect(luxury).toContain('helping make coffee breaks feel more considered and enjoyable')
    expect(luxury).not.toContain('ensuring every')

    const brew = guardContentDraftText('perfect brew every time')
    expect(brew).toContain('more consistent brew')
    expect(brew).not.toContain('perfect brew every time')
  })

  it('repairs unsupported interior-design journey and final-result assurances', () => {
    const out = guardContentDraftText(
      'نقدم مراحل محددة لضمان سير العمل بسلاسة. نحن هنا لنجعل الرحلة سهلة وممتعة. لا تقلق من عدم تطابق النتيجة مع التوقعات، فنحن نوفر لك رؤية واضحة للنتيجة النهائية قبل البدء.',
      { hasConversionDestination: true },
    )

    expect(out).toContain('لدعم وضوح سير العمل')
    expect(out).toContain('نشرح مراحل الرحلة ونقاط المراجعة بوضوح')
    expect(out).toContain('راجع مدى تطابق التصور المقترح مع توقعاتك')
    expect(out).toContain('نقدم تصورًا مقترحًا للمساحة قبل بدء التنفيذ')
    expect(out).not.toMatch(/لضمان سير العمل بسلاسة|نجعل الرحلة سهلة|لا تقلق من عدم تطابق|رؤية واضحة للنتيجة النهائية/i)
  })

  it('softens English perfection and superlative coffee claims', () => {
    const blend = guardContentDraftText('Discover the perfect blend for your morning routine.')
    expect(blend).toContain('balanced blend')
    expect(blend).not.toContain('perfect blend')

    const finest = guardContentDraftText('Try the finest coffee for small office teams.')
    expect(finest).toContain('carefully selected coffee')
    expect(finest).not.toContain('finest')

    const best = guardContentDraftText('Enjoy the best beans and premium coffee every time.')
    expect(best).toContain('carefully selected beans')
    expect(best).toContain('quality-focused coffee more consistently')
    expect(best).not.toContain('best beans')
    expect(best).not.toContain('premium coffee every time')
  })

  it('softens Perfect for urban life fit claims', () => {
    const out = guardContentDraftText('Perfect for the hustle and bustle of urban life.')

    expect(out).toContain('practical option')
    expect(out).toContain('busy urban routines')
    expect(out).not.toContain('Perfect for')
  })

  it('softens Perfect for those needing reliable coffee claims', () => {
    const out = guardContentDraftText('Perfect for those needing a reliable coffee experience.')

    expect(out).toContain('practical option')
    expect(out).toContain('consistent coffee routine')
    expect(out).not.toContain('Perfect for')
  })

  it('softens perfect choice fit claims', () => {
    const out = guardContentDraftText('The perfect choice for office coffee planning.')

    expect(out).toContain('practical choice for office coffee planning')
    expect(out.toLowerCase()).not.toContain('perfect choice')
  })

  it('grounds Arabic healthcare SaaS draft claims from operational QA', () => {
    const appointment = guardContentDraftText(
      'ClinicFlow AI هو الحل الأمثل لتنظيم المواعيد بشكل يضمن كفاءة وفعالية أكبر.',
    )
    expect(appointment).toContain('خيار عملي لتنظيم المواعيد')
    expect(appointment).toContain('وضوحًا أكبر في العمل اليومي')
    expect(appointment).not.toContain('الحل الأمثل')
    expect(appointment).not.toContain('يضمن')

    const operations = guardContentDraftText(
      'تحقيق النجاح يبدأ بتحسين العمليات وزيادة كفاءة فريقك.',
    )
    expect(operations).toContain('تحسين العمليات يبدأ بمراجعة خطوات العمل اليومية')
    expect(operations).toContain('مساعدة فريقك على متابعة المهام بوضوح')
    expect(operations).not.toContain('تحقيق النجاح')
    expect(operations).not.toContain('زيادة كفاءة فريقك')

    const care = guardContentDraftText(
      'تحسين تجربتك مع المرضى يساعد على توفير رعاية صحية متميزة. ابدأ الآن!',
    )
    expect(care).toContain('تنظيم متابعة المرضى إداريًا')
    expect(care).toContain('تنظيم تجربة إدارية أوضح حول مواعيد المرضى')
    expect(care).not.toContain('تحسين تجربتك مع المرضى')
    expect(care).not.toContain('رعاية صحية متميزة')
  })

  it('softens healthcare SaaS hype without changing safe operational Arabic', () => {
    const hype = guardContentDraftText(
      'يغير منظورك لإدارة العيادات. حلول ذكية تساعدك على إدارة عيادتك بشكل أكثر احترافية.',
    )
    expect(hype).toContain('يساعدك على مراجعة طريقة إدارة العيادة')
    expect(hype).toContain('أدوات عملية')
    expect(hype).toContain('إدارة عيادتك بخطوات أكثر تنظيمًا')
    expect(hype).not.toContain('يغير منظورك')
    expect(hype).not.toContain('حلول ذكية')
    expect(hype).not.toContain('أكثر احترافية')

    const safe = 'راجع مواعيد اليوم ورتّب مهام الفريق قبل بداية العيادة.'
    expect(guardContentDraftText(safe)).toBe(safe)
  })

  it('grounds regenerated clinic SaaS draft copy that still implies guarantees or patient satisfaction', () => {
    const post = guardContentDraftText(
      'تنظيم المواعيد في العيادات لم يكن أبداً بهذه السهولة! مع ClinicFlow AI، يمكنك ضمان مواعيد منظمة ومرضى راضين. تعرف على الحلول الذكية التي نقدمها لتحسين عملك.',
    )

    expect(post).toContain('يمكن تنظيمه بخطوات أوضح')
    expect(post).toContain('تنظيم المواعيد ومراجعة تجربة المرضى الإدارية بوضوح')
    expect(post).toContain('الأدوات العملية')
    expect(post).not.toContain('لم يكن أبداً بهذه السهولة')
    expect(post).not.toContain('ضمان')
    expect(post).not.toContain('مرضى راضين')
    expect(post).not.toContain('الحلول الذكية')
  })

  it('softens broad Arabic clinic efficiency and innovation wording', () => {
    const text = guardContentDraftText(
      'نحن نقدم لك الأدوات اللازمة لتعزيز وضوح العمليات وزيادة الكفاءة. شاهد كيف يمكن للتكنولوجيا أن تعزز الكفاءة وتوضح العمليات. اكتشف الابتكارات التي نقدمها.',
    )

    expect(text).toContain('زيادة وضوح سير العمل')
    expect(text).toContain('توضح سير العمل')
    expect(text).toContain('الميزات العملية التي نقدمها')
    expect(text).not.toContain('زيادة الكفاءة')
    expect(text).not.toContain('تعزز الكفاءة')
    expect(text).not.toContain('الابتكارات التي نقدمها')
  })

  it('removes patient-experience, clinic-growth, and broad operational-efficiency claims from clinic drafts', () => {
    const patient = guardContentDraftText(
      'تعرّف على كيف يمكنك تحسين تجربة مرضاك اليوم! #رعاية_المرضى',
    )
    expect(patient).toContain('تنظيم تجربة المرضى الإدارية')
    expect(patient).toContain('#متابعة_المرضى')
    expect(patient).not.toContain('تحسين تجربة مرضاك')
    expect(patient).not.toContain('#رعاية_المرضى')

    const operations = guardContentDraftText(
      'تعرف على كيف يعزز #ClinicFlowAI تنظيم عملك الطبي. شاهد كيف يعزز #ClinicFlowAI وضوح العمليات في العيادات. فيديو يوضح كيفية تحسين الكفاءة التشغيلية.',
    )
    expect(operations).toContain('يساعد على توضيح العمل الإداري للعيادة')
    expect(operations).toContain('يساعد على عرض العمليات اليومية في العيادات بوضوح')
    expect(operations).toContain('زيادة وضوح سير العمل التشغيلي')
    expect(operations).not.toContain('يعزز')
    expect(operations).not.toContain('تحسين الكفاءة التشغيلية')

    const growth = guardContentDraftText(
      'التحسين المستمر هو جزء من تنظيم العمل. يدعم ClinicFlow AI نمو عيادتك العضوي. إبدأ اليوم واستمتع بإدارة أكثر سهولة.',
    )
    expect(growth).toContain('مراجعة خطوات العمل داخل العيادة')
    expect(growth).toContain('ابدأ بالمراجعة')
    expect(growth).toContain('راجع طريقة إدارة المواعيد بوضوح أكبر')
    expect(growth).not.toContain('نمو عيادتك العضوي')
    expect(growth).not.toContain('استمتع بإدارة أكثر سهولة')
  })

  it('broadly grounds clinic efficiency, satisfaction, and digital-transformation escape hatches', () => {
    const copy = guardContentDraftText(
      'إليك الحل مع ClinicFlow AI. كيف يمكن لـ ClinicFlow AI تعزيز كفاءة العيادات وإدارة المواعيد؟ عندما يتعلق الأمر بتحسين المتابعة، ClinicFlow AI هو الأداة المناسبة لرفع وضوح العمليات اليومية لديك. انضم إلى رحلة التحول الرقمي. تعرف على كيف يمكن للتواصل ثنائي اللغة تحسين رضا المرضى.',
    )

    expect(copy).toContain('إليك خيارًا عمليًا')
    expect(copy).toContain('تنظيم عمل العيادات بوضوح')
    expect(copy).toContain('أداة عملية لمراجعة وضوح العمليات اليومية')
    expect(copy).toContain('مراجعة خطوات العمل الرقمية')
    expect(copy).toContain('تنظيم تجربة المرضى الإدارية')
    expect(copy).not.toContain('إليك الحل')
    expect(copy).not.toContain('تعزيز كفاءة العيادات')
    expect(copy).not.toContain('الأداة المناسبة لرفع وضوح العمليات اليومية')
    expect(copy).not.toContain('رحلة التحول الرقمي')
    expect(copy).not.toContain('تحسين رضا المرضى')
  })

  it('grounds current clinic draft escape hatches for time, results, service, and communication claims', () => {
    const copy = guardContentDraftText(
      'ClinicFlow AI يساعدك في تنظيم المواعيد وتحسين كفاءة العيادة. تعرف على كيفية تحسين متابعة المرضى. توفير الوقت وزيادة وضوح سير العمل هما في متناول يديك. تواصل فعال وسهل مع مرضاك لتحسين الخدمة. نظم فريقك وحقق نتائج أفضل اليوم! لكفاءة أكبر وتوفير للوقت. احصل على تجربة أكثر تنظيماً وكفاءة. الحلول العملية لتحقيق التوازن في عيادتك. #تواصل_فعال #فعالية',
    )

    expect(copy).toContain('تنظيم عمل العيادة بوضوح')
    expect(copy).toContain('تنظيم متابعة المرضى إداريًا')
    expect(copy).toContain('تنظيم الوقت الإداري')
    expect(copy).toContain('يمكن مراجعتها خطوة بخطوة')
    expect(copy).toContain('تواصل إداري أوضح')
    expect(copy).toContain('مراجعة الخدمة الإدارية')
    expect(copy).toContain('راجع نتائج العمل لاحقًا')
    expect(copy).toContain('وضوح أكبر في سير العمل')
    expect(copy).toContain('تجربة إدارية أكثر تنظيمًا ووضوحًا')
    expect(copy).toContain('الحلول العملية لمراجعة توزيع المهام داخل العيادة')
    expect(copy).toContain('#تواصل_إداري')
    expect(copy).toContain('#تنظيم_العمل')
    expect(copy).not.toContain('تحسين كفاءة')
    expect(copy).not.toContain('تحسين متابعة المرضى')
    expect(copy).not.toContain('توفير الوقت')
    expect(copy).not.toContain('تواصل فعال')
    expect(copy).not.toContain('تحسين الخدمة')
    expect(copy).not.toContain('نتائج أفضل')
    expect(copy).not.toContain('#فعالية')
  })

  it('repairs the exact bilingual clinic claims blocked by the production save gate', () => {
    const copy = guardContentDraftText(
      'ClinicFlow helps you save time in routine work. ClinicFlow يساعد على تحسين كفاءة العمليات اليومية.',
    )

    expect(copy).toContain('help organize routine work more clearly')
    expect(copy).toContain('زيادة وضوح سير العمل اليومية')
    expect(copy).not.toMatch(/save time/i)
    expect(copy).not.toContain('تحسين كفاءة')
  })

  it('removes unverified clinic security promises and repairs observed draft grammar', () => {
    const copy = guardContentDraftText(
      'review your clinic operations. احمِ بيانات عيادتك مع إدارة متكاملة وآمنة. اكتشف إجراءات الأمان لدينا لضمان حماية بياناتك. عزز كفاءة عيادتك. اكتشف كيف نزيد كفاءة عمليات العيادة.',
      { verifiedProof: [] },
    )

    expect(copy).toMatch(/^Review your clinic operations/)
    expect(copy).toContain('راجع وثائق الأمان وصلاحيات الوصول')
    expect(copy).toContain('نظّم سير عمل عيادتك بوضوح أكبر')
    expect(copy).toContain('ننظّم عمليات العيادة بوضوح أكبر')
    expect(copy).not.toMatch(/احمِ بيانات|إدارة متكاملة وآمنة|إجراءات الأمان لدينا|عزز كفاءة|كفاءة عمليات العيادة/)
  })

  it('repairs the exact quality defects found in the nine-post production audit', () => {
    const reviewed = [
      guardContentDraftText('احمِ بيانات عيادتك. #أمان_البيانات #إدارة_العيادات', { verifiedProof: [] }),
      guardContentDraftText('Book a demo to experience the transformation.'),
      guardContentDraftText('اكتشف كيف يمكن لـ #ClinicFlow زيادة وضوح سير العمل عمليات العيادة.'),
      guardContentDraftText('Enhance communication and streamline operations with ClinicFlow.'),
      guardContentDraftText('مع #ClinicFlow، يمكنك دمج جميع العمليات في منصة واحدة.'),
      guardContentDraftText('قل وداعًا للمهام اليدوية مع الأتمتة. عزز كفاءة عيادتك مع تقليل العمل اليدوي.'),
      guardContentDraftText("Operate seamlessly in both English and Arabic with ClinicFlow. Overcome language barriers and enhance your clinic's operations."),
      guardContentDraftText("Automate your clinic's reminders and follow-ups with ClinicFlow. أتمتة التذكيرات والمتابعات الخاصة بك."),
      guardContentDraftText('Break language barriers with our bilingual platform.'),
      guardContentDraftText('كيف يمكننا تبسيط عملك. #أتمتة_العيادات #كفاءة_العمل #كفاءة'),
    ]

    expect(reviewed[0]).toContain('#مراجعة_الأمان #إدارة_العيادات')
    expect(reviewed[0]).not.toContain('#مراجعة_الأمان_البيانات')
    expect(reviewed[1]).toBe('Book a demo to review the workflow.')
    expect(reviewed[1]).not.toMatch(/demo to review the workflow in a demo/i)
    expect(reviewed[2]).toContain('تنظيم عمليات العيادة بوضوح أكبر')
    expect(reviewed[3]).toMatch(/^Support bilingual communication/)
    expect(reviewed[4]).toContain('جمع العمليات الأساسية في مساحة عمل واحدة')
    expect(reviewed[4]).not.toContain('جميع العمليات')
    expect(reviewed[5]).toContain('راجع المهام اليدوية التي يمكن تنظيمها')
    expect(reviewed[5]).toContain('مراجعة المهام اليدوية المتكررة')
    expect(reviewed[6]).toMatch(/^Use English and Arabic workflows/)
    expect(reviewed[6]).not.toMatch(/seamlessly|overcome language barriers/i)
    expect(reviewed[7]).toContain("Organize your clinic's reminders and follow-ups")
    expect(reviewed[7]).toContain('تنظيم التذكيرات والمتابعات')
    expect(reviewed[8]).toContain('Review your English and Arabic workflows')
    expect(reviewed[8]).not.toMatch(/break language barriers/i)
    expect(reviewed[9]).toContain('كيف ننظّم سير العمل الحالي')
    expect(reviewed[9]).toContain('#تنظيم_العيادات #سير_العمل #تنظيم_العمل')
  })

  it('replaces an unverified security storyboard instead of leaving unsafe residual scenes', () => {
    const storyboard = guardContentDraftText(
      'Scene 1: A manager worried about data security. Scene 2: Secure data management. Scene 3: Protected patient information. Scene 4: Learn about our security measures.',
      { verifiedProof: [] },
    )

    expect(storyboard).toContain('security-review checklist')
    expect(storyboard).toContain('without certifications or protection claims')
    expect(storyboard).not.toMatch(/secure data management|protected patient information|our security measures/i)
  })

  it('softens perfectly roasted claims', () => {
    const out = guardContentDraftText('perfectly roasted beans')

    expect(out).toContain('carefully roasted beans')
    expect(out).not.toContain('perfectly roasted')
  })

  it('softens ensure and stock-planning absolute claims', () => {
    const out = guardContentDraftText(
      'Our convenient delivery service ensures you plan stock more reliably.',
    )

    expect(out).toContain('delivery service can support more reliable stock planning where available')
    expect(out).not.toContain('ensures')
  })

  it('bounds delivery wording to supported availability', () => {
    const doorstep = guardContentDraftText('Fresh coffee delivered to your doorstep.')
    expect(doorstep).toContain('delivery where available')
    expect(doorstep).not.toContain('delivered to your doorstep')

    const quick = guardContentDraftText('quick delivery guaranteed for your office')
    expect(quick).toContain('supported zones')
    expect(quick).not.toContain('guaranteed')
  })

  it('fixes awkward and unbounded delivery claims', () => {
    const awkward = guardContentDraftText('Freshly roasted and promptly delivery where available.')
    expect(awkward).toContain('delivery where available')
    expect(awkward).not.toContain('promptly delivery')

    const doorstep = guardContentDraftText('Coffee delivery to your doorstep.')
    expect(doorstep).toContain('delivery where available')
    expect(doorstep).not.toContain('to your doorstep')
  })

  it('softens always-stocked office claims', () => {
    const out = guardContentDraftText('Ensure your office is always stocked with premium coffee.')

    expect(out).toContain('Help keep your office better stocked with planning support')
    expect(out).not.toContain('Ensure')
    expect(out).not.toContain('always stocked')
  })

  it('softens English productivity and morale outcome claims', () => {
    const out = guardContentDraftText('premium blends can boost productivity and morale')

    expect(out).toContain('office coffee breaks')
    expect(out).not.toContain('boost productivity')
    expect(out).not.toContain('morale')
  })

  it('softens team performance outcome claims', () => {
    const out = guardContentDraftText('Improve team performance with better coffee')

    expect(out).toContain('team coffee planning')
    expect(out).not.toContain('team performance')
  })

  it('softens energy and focus outcome claims', () => {
    const out = guardContentDraftText('Boost energy and focus every morning')

    expect(out).toContain('coffee routine')
    expect(out).not.toContain('Boost energy')
    expect(out).not.toContain('focus')
  })

  it('softens Arabic productivity and morale outcome claims', () => {
    const out = guardContentDraftText('قهوة تساعد على زيادة الإنتاجية ورفع المعنويات')

    expect(out).toContain('روتين قهوة')
    expect(out).toContain('استراحات القهوة')
    expect(out).not.toContain('زيادة الإنتاجية')
    expect(out).not.toContain('رفع المعنويات')
  })

  it('softens Arabic focus and energy outcome claims', () => {
    const out = guardContentDraftText('طاقة مضمونة وتركيز أفضل للفريق')

    expect(out).toContain('تجربة قهوة أكثر انتظامًا')
    expect(out).toContain('روتين قهوة أوضح')
    expect(out).not.toContain('طاقة مضمونة')
    expect(out).not.toContain('تركيز أفضل')
  })

  it('preserves safe coffee planning copy', () => {
    const safe = 'Plan office coffee breaks more easily'

    expect(guardContentDraftText(safe)).toBe(safe)
  })

  it('preserves safe Arabic coffee planning copy', () => {
    const safe = 'خطط لاستراحات القهوة في المكتب بسهولة'

    expect(guardContentDraftText(safe)).toBe(safe)
  })

  it('does not let focus proof unlock productivity or morale claims', () => {
    const out = guardContentDraftText(
      'premium blends can boost productivity and morale',
      { verifiedProof: ['Customer feedback says the coffee helped with focus during morning routines.'] },
    )

    expect(out).toContain('coffee breaks')
    expect(out).not.toContain('boost productivity')
    expect(out).not.toContain('morale')
  })

  it('does not let morale proof unlock team performance claims', () => {
    const out = guardContentDraftText(
      'Improve team performance with better coffee',
      { verifiedProof: ['Employee survey mentioned better morale around coffee breaks.'] },
    )

    expect(out).toContain('team coffee planning')
    expect(out).not.toContain('team performance')
  })

  it('does not let energy proof unlock productivity claims', () => {
    const out = guardContentDraftText(
      'Boost productivity with premium coffee',
      { verifiedProof: ['Customer said the coffee felt energizing.'] },
    )

    expect(out).toContain('coffee break routine')
    expect(out).not.toContain('Boost productivity')
  })

  it('preserves supported productivity wording when exact productivity proof exists', () => {
    const out = guardContentDraftText(
      'Coffee routine may support improved productivity.',
      { verifiedProof: ['User-provided survey: 62% of office staff reported improved productivity after changing coffee routine.'] },
    )

    expect(out).toBe('Coffee routine may support improved productivity.')
    expect(out).not.toContain('guaranteed')
  })

  it('does not let Arabic focus proof unlock productivity or morale claims', () => {
    const out = guardContentDraftText(
      'قهوة تساعد على زيادة الإنتاجية ورفع المعنويات',
      { verifiedProof: ['تعليق عميل: ساعدت القهوة على التركيز في الصباح.'] },
    )

    expect(out).not.toContain('زيادة الإنتاجية')
    expect(out).not.toContain('رفع المعنويات')
    expect(out).toContain('روتين قهوة')
    expect(out).toContain('استراحات القهوة')
  })

  it('softens high-risk Arabic perfection, delivery, stock, and productivity claims', () => {
    const out = guardContentDraftText(
      'المشروب المثالي كل مرة مع توصيل مضمون وتوصيل سريع. المكتب مليان قهوة دائمًا ولا ينفد. طاقة مضمونة ونتائج فورية وإنتاجية مضمونة.',
    )

    expect(out).toContain('قهوة أكثر اتساقًا مع إرشادات أوضح')
    expect(out).toContain('التوصيل حسب المناطق المتاحة')
    expect(out).toContain('توقيت التوصيل يعتمد على الموقع')
    expect(out).toContain('تخطيط أوضح لمخزون القهوة')
    expect(out).toContain('يساعد على تقليل نفاد القهوة')
    expect(out).toContain('تجربة قهوة أكثر انتظامًا')
    expect(out).toContain('دعم روتين عمل أوضح للمراجعة')
    expect(out).not.toContain('المشروب المثالي كل مرة')
    expect(out).not.toContain('توصيل مضمون')
    expect(out).not.toContain('توصيل سريع')
    expect(out).not.toContain('المكتب مليان قهوة دائمًا')
    expect(out).not.toContain('طاقة مضمونة')
    expect(out).not.toContain('نتائج فورية')
    expect(out).not.toContain('إنتاجية مضمونة')
  })

  it('softens Arabic superlatives and doorstep delivery', () => {
    const beans = guardContentDraftText('أفضل حبوب القهوة لتجربة يومية.')
    expect(beans).toContain('حبوب قهوة مختارة بعناية')
    expect(beans).not.toContain('أفضل')

    const doorstep = guardContentDraftText('حبوب طازجة ومحمصة بعناية لتصلك إلى باب منزلك بكل سهولة.')
    expect(doorstep).toContain('التوصيل حسب المناطق المتاحة')
    expect(doorstep).not.toContain('باب منزلك')
  })

  it('removes residual Arabic best wording even for an unlisted noun', () => {
    const out = guardContentDraftText('اكتشف أفضل طريقة لتنظيم اشتراك القهوة، فهذا هو الخيار الأفضل.')

    expect(out).toContain('طريقة مناسبة')
    expect(out).toContain('خيار مناسب بعد مراجعة التفاصيل')
    expect(out).not.toContain('أفضل')
  })

  it('softens observed Arabic قهوة مثالية blocker wording', () => {
    const out = guardContentDraftText('اكتشف أسرار صنع قهوة مثالية في المنزل...')

    expect(out).toContain('قهوة متوازنة')
    expect(out).not.toContain('قهوة مثالية')
    expect(out).not.toContain('مثالية')
  })

  it('softens observed Arabic contextual morning coffee perfection wording', () => {
    const out = guardContentDraftText('هل تبحث عن توصيات لقهوة صباحية مثالية؟')

    expect(out).toContain('قهوة صباحية أكثر اتساقًا')
    expect(out).not.toContain('قهوة صباحية مثالية')
    expect(out).not.toContain('مثالية')
  })

  it('softens definite Arabic morning coffee perfection wording', () => {
    const out = guardContentDraftText('القهوة الصباحية المثالية تبدأ بخطوات بسيطة')

    expect(out).toContain('القهوة الصباحية الأكثر اتساقًا')
    expect(out).not.toContain('القهوة الصباحية المثالية')
    expect(out).not.toContain('المثالية')
  })

  it('softens Arabic daily coffee perfection wording', () => {
    const out = guardContentDraftText('قهوة يومية مثالية لروتينك')

    expect(out).toContain('قهوة يومية أكثر اتساقًا')
    expect(out).not.toContain('قهوة يومية مثالية')
    expect(out).not.toContain('مثالية')
  })

  it('softens definite Arabic home coffee perfection wording', () => {
    const out = guardContentDraftText('القهوة المنزلية المثالية تحتاج خطوات واضحة')

    expect(out).toContain('القهوة المنزلية الأكثر اتساقًا')
    expect(out).not.toContain('القهوة المنزلية المثالية')
    expect(out).not.toContain('المثالية')
  })

  it('softens Arabic coffee cup perfection wording', () => {
    const out = guardContentDraftText('كوب قهوة مثالي يبدأ باختيار الحبوب')

    expect(out).toContain('كوب قهوة متوازن')
    expect(out).not.toContain('كوب قهوة مثالي')
    expect(out).not.toContain('مثالي')
  })

  it('softens Arabic coffee finjan perfection wording', () => {
    const out = guardContentDraftText('فنجان قهوة مثالي لبدء اليوم')

    expect(out).toContain('فنجان قهوة متوازن')
    expect(out).not.toContain('فنجان قهوة مثالي')
    expect(out).not.toContain('مثالي')
  })

  it('softens Arabic تجربة قهوة مثالية wording', () => {
    const out = guardContentDraftText('استمتع بتجربة قهوة مثالية كل صباح')

    expect(out).toContain('تجربة قهوة أكثر اتساقًا')
    expect(out).not.toContain('مثالية')
  })

  it('softens Arabic نتائج مثالية wording', () => {
    const out = guardContentDraftText('اتبع هذه الخطوات للحصول على نتائج مثالية')

    expect(out).toContain('نتائج أكثر اتساقًا')
    expect(out).not.toContain('نتائج مثالية')
  })

  it('softens Arabic تحضير مثالي wording', () => {
    const out = guardContentDraftText('دليلك لتحضير مثالي للقهوة')

    expect(out).toContain('لتحضير عملي للقهوة')
    expect(out).not.toContain('تحضير مثالي')
  })

  it('softens Arabic خلطة مثالية wording', () => {
    const out = guardContentDraftText('خلطة مثالية لعشاق القهوة')

    expect(out).toContain('خلطة متوازنة لعشاق القهوة')
    expect(out).not.toContain('خلطة مثالية')
  })

  it('softens Arabic التجربة المثالية wording', () => {
    const out = guardContentDraftText('التجربة المثالية تبدأ بخطوات واضحة')

    expect(out).toContain('تجربة أكثر اتساقًا')
    expect(out).not.toContain('المثالية')
  })

  it('softens Arabic النتائج المثالية wording', () => {
    const out = guardContentDraftText('النتائج المثالية تحتاج إلى متابعة')

    expect(out).toContain('نتائج أكثر اتساقًا')
    expect(out).not.toContain('النتائج المثالية')
  })

  it('softens Arabic التحضير المثالي wording', () => {
    const out = guardContentDraftText('التحضير المثالي للقهوة يبدأ بخطوات بسيطة')

    expect(out).toContain('التحضير العملي للقهوة')
    expect(out).not.toContain('التحضير المثالي')
  })

  it('softens Arabic النكهة المثالية wording', () => {
    const out = guardContentDraftText('النكهة المثالية تحتاج إلى حبوب مختارة')

    expect(out).toContain('النكهة المتوازنة')
    expect(out).not.toContain('النكهة المثالية')
  })

  it('softens Arabic الكوب المثالي wording', () => {
    const out = guardContentDraftText('الكوب المثالي يبدأ باختيار القهوة المناسبة')

    expect(out).toContain('الكوب المتوازن')
    expect(out).not.toContain('الكوب المثالي')
  })

  it('softens observed Arabic أفضل نكهة blocker wording', () => {
    const out = guardContentDraftText('لتوفير أفضل نكهة لمحبي القهوة')

    expect(out).toContain('نكهة متوازنة')
    expect(out).not.toContain('أفضل نكهة')
    expect(out).not.toContain('أفضل')
  })

  it('softens observed Arabic أفضل الحبوب blocker wording', () => {
    const out = guardContentDraftText('دليلك البسيط لاختيار أفضل الحبوب')

    expect(out).toContain('حبوب مختارة بعناية')
    expect(out).not.toContain('أفضل الحبوب')
    expect(out).not.toContain('أفضل')
  })

  it('softens Arabic أفضل حبوب القهوة wording', () => {
    const out = guardContentDraftText('تعرف على أفضل حبوب القهوة لتحضيرك اليومي')

    expect(out).toContain('حبوب قهوة مختارة بعناية')
    expect(out).not.toContain('أفضل حبوب القهوة')
    expect(out).not.toContain('أفضل')
  })

  it('softens Arabic أفضل مذاق wording', () => {
    const out = guardContentDraftText('خطوات بسيطة للحصول على أفضل مذاق')

    expect(out).toContain('مذاق متوازن')
    expect(out).not.toContain('أفضل مذاق')
    expect(out).not.toContain('أفضل')
  })

  it('softens observed Arabic بجودة لا تقاوم blocker wording', () => {
    const out = guardContentDraftText('بجودة لا تقاوم')

    expect(out).toContain('بجودة مختارة بعناية')
    expect(out).not.toContain('لا تقاوم')
  })

  it('softens Arabic تجربة لا تقاوم wording', () => {
    const out = guardContentDraftText('استمتع بتجربة لا تقاوم')

    expect(out).toContain('تجربة أكثر اتساقًا')
    expect(out).not.toContain('لا تقاوم')
  })

  it('softens Arabic تجربة قهوة فريدة wording', () => {
    const out = guardContentDraftText('تجربة قهوة فريدة لمحبي القهوة')

    expect(out).toContain('تجربة قهوة أكثر اتساقًا')
    expect(out).not.toContain('فريدة')
  })

  it('softens English irresistible quality wording', () => {
    const out = guardContentDraftText('irresistible quality for coffee lovers')

    expect(out).toContain('carefully selected quality')
    expect(out).not.toContain('irresistible')
  })

  it('softens English extraordinary coffee experience wording', () => {
    const out = guardContentDraftText('an extraordinary coffee experience')

    expect(out).toContain('more consistent coffee experience')
    expect(out).not.toContain('extraordinary')
  })

  it('softens observed English premium experience wording', () => {
    const out = guardContentDraftText('premium experience')

    expect(out).toContain('more considered experience')
    expect(out).not.toContain('premium experience')
  })

  it('softens English premium coffee experience wording', () => {
    const out = guardContentDraftText('a premium coffee experience')

    expect(out).toContain('more considered coffee experience')
    expect(out).not.toContain('premium')
  })

  it('softens English best beans wording', () => {
    const out = guardContentDraftText('choose the best beans for your coffee routine')

    expect(out).toContain('carefully selected beans')
    expect(out).not.toContain('best beans')
  })

  it('softens English best coffee beans before generic best coffee wording', () => {
    const out = guardContentDraftText('choose the best coffee beans for your coffee routine')

    expect(out).toContain('carefully selected coffee beans')
    expect(out).not.toContain('best coffee beans')
    expect(out).not.toContain('best coffee')
    expect(out).not.toContain('better coffee routine beans')
  })

  it('softens English best coffee experience before generic best coffee wording', () => {
    const out = guardContentDraftText('the best coffee experience for daily routines')

    expect(out).toContain('more consistent coffee experience')
    expect(out).not.toContain('best coffee experience')
    expect(out).not.toContain('best coffee')
    expect(out).not.toContain('better coffee routine experience')
  })

  it('softens Arabic مثالية لمن fit claims', () => {
    const out = guardContentDraftText('مثالية لمن يحتاج قهوة موثوقة')

    expect(out).toContain('مناسبة')
    expect(out).toContain('تجربة قهوة أكثر اتساقًا')
    expect(out).not.toContain('مثالية')
  })

  it('softens Arabic الخيار المثالي fit claims', () => {
    const out = guardContentDraftText('الخيار المثالي للمكتب')

    expect(out).toContain('خيار عملي للمكتب')
    expect(out).not.toContain('الخيار المثالي')
  })

  it('softens Arabic no-tatweel مثالي للمكتب fit claims', () => {
    const out = guardContentDraftText('مثالي للمكتب')

    expect(out).toContain('مناسب للمكتب')
    expect(out).not.toContain('مثالي')
  })

  it('softens Arabic no-tatweel مثالية للعائلات fit claims', () => {
    const out = guardContentDraftText('مثالية للعائلات')

    expect(out).toContain('مناسبة للعائلات')
    expect(out).not.toContain('مثالية')
  })

  it('softens Arabic no-tatweel مثالي لروتين fit claims', () => {
    const out = guardContentDraftText('مثالي لروتين القهوة اليومي')

    expect(out).toContain('مناسب لروتين القهوة اليومي')
    expect(out).not.toContain('مثالي')
  })

  it('softens standalone Arabic الخيار المثالي claims', () => {
    const out = guardContentDraftText('الخيار المثالي')

    expect(out).toContain('خيار عملي')
    expect(out).not.toContain('الخيار المثالي')
  })

  it('softens Arabic guarantee and every-time perfection claims', () => {
    const out = guardContentDraftText('تضمن لك القهوة المثالية كل مرة.')

    expect(out).toContain('تساعد على')
    expect(out).toContain('قهوة أكثر اتساقًا')
    expect(out).not.toContain('تضمن')
    expect(out).not.toContain('المثالية كل مرة')
  })

  it('softens Arabic guarantee nouns observed in generated follow-up copy', () => {
    const out = guardContentDraftText('نرسل تحديثات أسبوعية لضمان راحة البال.')

    expect(out).toContain('لدعم وضوح المتابعة')
    expect(out).not.toContain('لضمان راحة البال')
  })

  it('grounds broad interior-design service assurances in reviewable scope', () => {
    const out = guardContentDraftText([
      'تجديد منزلك دون عناء المتابعة اليومية.',
      'نحن نهتم بكل التفاصيل، من الاستشارة إلى التنفيذ، لتتمتع براحة البال.',
      'تجنب المفاجآت المالية مع جدول تكلفة مفصل لكل مرحلة، لتكون على دراية تامة بكل خطوة.',
      'دعنا نهتم بكل التفاصيل من أجلك. نقدم إشرافًا كاملًا على التنفيذ لتجربة تصميم داخلي تساعد على الجودة والراحة.',
    ].join(' '))

    expect(out).toMatch(/مراحل متابعة موثقة|تفاصيل النطاق ونقاط المراجعة/)
    expect(out).toContain('راجع التكلفة والنطاق قبل التنفيذ')
    expect(out).toContain('إشرافًا على التنفيذ ضمن النطاق المتفق عليه')
    expect(out).not.toMatch(/دون عناء|نهتم بكل التفاصيل|راحة البال|المفاجآت المالية|دراية تامة|إشرافًا كاملًا|تساعد على الجودة والراحة/)
  })

  it('blocks paraphrased handle-everything promises and malformed comfort outcomes', () => {
    const out = guardContentDraftText(
      'دار سُكنى تمنحك تجربة تصميم داخلي مرتبة ومريحة، حيث نعتني بكل شيء من الاستشارة إلى الإشراف على التنفيذ. استرخِ واترك لنا التفاصيل. احجز جلسة اكتشاف الآن لتحظى بمنزل يعكس ذوقك ويحتوي على راحتك.',
    )

    expect(out).toContain('خطوات تصميم داخلي موثقة للمراجعة')
    expect(out).toContain('الإشراف على التنفيذ ضمن النطاق المتفق عليه')
    expect(out).toContain('راجع معنا تفاصيل النطاق قبل التنفيذ')
    expect(out).toContain('اطلب جلسة اكتشاف لمراجعة احتياجات المساحة والنطاق المقترح')
    expect(out).not.toMatch(/نعتني بكل شيء|اترك لنا التفاصيل|يحتوي على راحتك|مرتبة ومريحة/)
  })

  it('grounds second-order paraphrases from rewrite output', () => {
    const out = guardContentDraftText(
      'تجربة منظمة وهادئة تساعد على كل التفاصيل مع خطوات موثقة للمراجعة. اطمئن واترك لنا المشوار من الاستشارة إلى الإشراف. احجز الآن واجعل منزلك ملاذًا يعكس ذوقك ويحتوي راحتك.',
    )

    expect(out).toContain('توضح النطاق ونقاط المراجعة قبل التنفيذ')
    expect(out).toContain('راجع المراحل المشمولة من جلسة الاكتشاف إلى الإشراف ضمن النطاق المتفق عليه')
    expect(out).toContain('تصورًا للمساحة تراجع مدى ملاءمته لاحتياجاتك')
    expect(out).not.toMatch(/تساعد على كل التفاصيل|اطمئن واترك|اترك لنا المشوار|يحتوي راحتك/)
  })

  it('cleans grammar artifacts introduced by deterministic claim replacement', () => {
    const out = guardContentDraftText([
      'احجز جلسة اكتشاف الآن واجعل منزلك ملاذًا يعكس ذوقك ويحتوي راحتك.',
      'نقدم لك جدول تكلفة مفصل لكل مرحلة من مراحل التصميم الداخلي.',
      'نقدم إشرافًا كاملًا على التنفيذ ضمن النطاق المتفق عليه.',
      'تواصل معنا الآن لتجربة تصميم داخلي تساعد على الجودة والراحة.',
    ].join(' '))

    expect(out).toContain('واطلب جلسة اكتشاف لمراجعة تصور المساحة ومدى ملاءمته لاحتياجاتك')
    expect(out).toContain('تفاصيل التكلفة ومراحل التصميم الداخلي المتاحة للمراجعة')
    expect(out).not.toMatch(/واجعل تصورًا|المتاحة للمراجعة من مراحل|ضمن النطاق المتفق عليه ضمن النطاق المتفق عليه|الآن لخطوات/)
  })

  it('preserves safe Arabic كل مرة usage', () => {
    const safe = 'اسأل عن درجة الطحن كل مرة تطلب فيها'

    expect(guardContentDraftText(safe)).toBe(safe)
    expect(guardContentDraftText(safe)).not.toContain('بشكل أكثر اتساقًا تطلب فيها')
  })

  it('preserves safe Arabic دائمًا usage', () => {
    const safe = 'راجع درجة الطحن دائمًا قبل الطلب'

    expect(guardContentDraftText(safe)).toBe(safe)
    expect(guardContentDraftText(safe)).not.toContain('بشكل منتظم قبل الطلب')
  })

  it('preserves negative Arabic guarantee disclaimers', () => {
    const out = guardContentDraftText('لا تضمن هذه الخطة نتائج فورية')

    expect(out).toContain('لا تضمن')
    expect(out).not.toContain('لا تساعد على')
  })

  it('preserves negative Arabic تضمن لك disclaimers', () => {
    const out = guardContentDraftText('لا تضمن لك هذه الخطة نتائج فورية')

    expect(out).toContain('لا تضمن لك')
    expect(out).not.toContain('لا تساعد على')
  })

  it('preserves negative Arabic يضمن لك disclaimers', () => {
    const out = guardContentDraftText('لا يضمن لك هذا المحتوى نتائج فورية')

    expect(out).toContain('لا يضمن لك')
    expect(out).not.toContain('لا يساعد على')
  })

  it('still softens positive Arabic تضمن لك guarantee claims', () => {
    const out = guardContentDraftText('تضمن لك القهوة المثالية كل مرة')

    expect(out).toContain('تساعد على')
    expect(out).toContain('قهوة أكثر اتساقًا')
    expect(out).not.toContain('تضمن لك')
    expect(out).not.toContain('المثالية كل مرة')
  })

  it('softens first-person Arabic guarantees observed in a generated draft', () => {
    const out = guardContentDraftText(
      'في عالم يتطلب الثقة والتميز، نضمن لك خدمات عالية الجودة. اكتشف كيف نضمن الجودة في كل خطوة.',
    )

    expect(out).toContain('نسعى إلى تقديم خدمات عالية الجودة')
    expect(out).toContain('نسعى إلى دعم الجودة')
    expect(out).not.toContain('نضمن')
  })

  it('preserves negative and inclusion wording while softening guarantees', () => {
    const out = guardContentDraftText('لا نضمن النتائج. راجع ما يتضمنه العرض. نضمن لك المتابعة.')

    expect(out).toContain('لا نضمن النتائج')
    expect(out).toContain('ما يتضمنه العرض')
    expect(out).toContain('نسعى إلى تقديم المتابعة')
  })

  it('still softens risky Arabic stock absolutes', () => {
    const out = guardContentDraftText('المكتب مليان قهوة دائمًا')

    expect(out).toContain('تخطيط أوضح لمخزون القهوة')
    expect(out).not.toContain('مليان قهوة دائمًا')
  })

  it('bounds Arabic doorstep and next-day delivery wording', () => {
    const out = guardContentDraftText('توصيل لباب البيت وتوصيل في اليوم التالي.')

    expect(out).toContain('التوصيل حسب المناطق المتاحة')
    expect(out).toContain('التوصيل في اليوم التالي حيثما توفر')
    expect(out).not.toContain('توصيل لباب البيت')
    expect(out).not.toContain('توصيل في اليوم التالي.')
  })

  it('removes unsupported Arabic customer reactions and delivery-performance scenes', () => {
    const out = guardContentDraftText(
      'المشهد الأول: عرض أهمية توصيل القهوة في الوقت المناسب. المشهد الثاني: توصيل القهوة إلى المنزل. المشهد الثالث: ردود أفعال العملاء عند استلام القهوة في الوقت المحدد.',
      {
        brandFacts: [
          'Freshly roasted coffee subscription.',
          'Delivery is limited to Dubai within 48 hours.',
        ],
        verifiedProof: [],
      },
    )

    expect(out).toContain('تفاصيل نطاق ومدة توصيل القهوة الموثقة')
    expect(out).toContain('توصيل ضمن النطاق الموثق')
    expect(out).toContain('دون تصوير تجربة عميل غير موثقة')
    expect(out).not.toMatch(/الوقت المناسب|إلى المنزل|ردود أفعال العملاء|الوقت المحدد/)
  })

  it('does not infer freshness preservation from freshly roasted alone', () => {
    const out = guardContentDraftText(
      'توضيح كيف يتم الحفاظ على نضارة القهوة حتى تصل إلى العميل.',
      { brandFacts: ['The coffee is freshly roasted.'] },
    )

    expect(out).toContain('عرض تاريخ التحميص وتفاصيل المنتج المتاحة للمراجعة')
    expect(out).not.toMatch(/الحفاظ على نضارة القهوة/)
  })

  it('does not infer first-party roasting or a quality guarantee from freshly roasted alone', () => {
    const out = guardContentDraftText(
      'شاهد كيف يتم تحميص القهوة لدينا لضمان الجودة.',
      { brandFacts: ['The coffee is freshly roasted.'] },
    )

    expect(out).toContain('راجع تفاصيل تحميص القهوة المتاحة')
    expect(out).toContain('مع مراجعة تفاصيل الجودة المتاحة')
    expect(out).not.toMatch(/يتم تحميص القهوة لدينا|لضمان الجودة/)
  })

  it('repairs the observed malformed delivery CTA after bounding the claim', () => {
    const out = guardContentDraftText(
      'شاهد كيف نوفر لك توقيت التوصيل يعتمد على الموقع ضمن نطاق الخدمة.',
    )

    expect(out).toBe('راجع نطاق التوصيل والمدة الموثقة قبل الاشتراك.')
  })

  it('rewrites the observed awkward team-planning phrase', () => {
    const out = guardContentDraftText('Support more reliable team planning has access to great coffee.')

    expect(out).toBe('Help teams plan better office coffee routines.')
    expect(out).not.toContain('Support more reliable team planning has access')
  })

  it('preserves safe educational coffee guidance', () => {
    const safe = 'Choose the right grind size for your brewing method.'

    expect(guardContentDraftText(safe)).toBe(safe)
  })

  it('preserves safe Arabic educational coffee guidance', () => {
    const safe = 'اختر درجة الطحن المناسبة لطريقة التحضير'

    expect(guardContentDraftText(safe)).toBe(safe)
  })

  it('preserves safe Arabic educational fit wording', () => {
    const safe = 'اختر درجة الطحن المناسبة لطريقة التحضير'

    expect(guardContentDraftText(safe)).toBe(safe)
  })

  it('repairs observed production coffee filler into grounded, grammatical draft copy', () => {
    const freshness = guardContentDraftText(
      'Discover the secret to freshly roasted coffee in Dubai! Say goodbye to stale beans and hello to a vibrant coffee experience with NEXUS E2E Coffee. Our weekly roasting process helps that every cup is as fresh as it gets. Curious about how we do it? Learn more about our roasting process and taste the difference.',
    )
    const convenience = guardContentDraftText(
      "With NEXUS E2E Coffee, enjoy freshly roasted beans delivered right to your door. No more time wasted on sourcing quality coffee. See how easy it is to subscribe and have your coffee needs taken care of.",
    )
    const education = guardContentDraftText(
      "Master the art of brewing at home with our expert tips! Whether you're a novice or a seasoned coffee enthusiast, our brewing tutorials will elevate your coffee game. Watch our brewing tips and transform your home coffee experience.",
    )

    expect(freshness).toContain('Review the available roasting details')
    expect(freshness).toContain('Review the roast date and available weekly roasting details')
    expect(freshness).not.toMatch(/secret|vibrant|helps that|as fresh as it gets|taste the difference/i)
    expect(convenience).toContain('delivery where supported')
    expect(convenience).toContain('Compare the available coffee and delivery options')
    expect(convenience).toContain('Review the subscription terms and delivery zones')
    expect(convenience).not.toMatch(/right to your door|quality coffee|needs taken care of/i)
    expect(education).toContain('Record the grind size, dose, water, and brew time')
    expect(education).toContain('Save this checklist for your next brew')
    expect(education).not.toMatch(/expert tips|tutorials|elevate|transform/i)

    const alternateHype = guardContentDraftText(
      'Use these practical steps to elevate your brewing routine and transform your morning ritual.',
    )
    expect(alternateHype).toContain('refine your brewing routine')
    expect(alternateHype).toContain('review your morning ritual')
    expect(alternateHype).not.toMatch(/elevate your|transform your/i)
  })

  it('does not turn an unverified coffee freshness detail into draft copy', () => {
    const ungrounded = guardContentDraftText(
      'Freshly roasted coffee with fast and reliable delivery means you never run out.',
      {
        brandFacts: [
          'AED 149 for one kilogram each month.',
          'Delivery is limited to Dubai within 48 hours.',
          'No freshness guarantee is available.',
        ],
      },
    )
    expect(ungrounded).not.toMatch(/freshly roasted|reliable delivery|never run out/i)
    expect(ungrounded).toMatch(/details to verify|documented service window|plan stock more reliably/i)

    const supported = guardContentDraftText(
      'Freshly roasted coffee from our weekly roasting process.',
      { brandFacts: ['The coffee is freshly roasted every week.'] },
    )
    expect(supported).toBe('Freshly roasted coffee from our weekly roasting process.')
  })

  it('recursively guards generated post fields', () => {
    const guarded = guardContentDraftTruth({
      caption: 'Customer Testimonials: perfect brew every time and Perfect for busy teams with quick delivery guaranteed. هل تبحث عن توصيات لقهوة صباحية مثالية؟',
      creative: {
        imagePrompt: 'Show award-winning coffee delivered to your doorstep with perfectly roasted beans and premium experience. كوب قهوة مثالي.',
        videoPrompt: 'Feature the finest coffee, perfect choice for office coffee planning, best beans, and promptly delivery where available. فنجان قهوة مثالي.',
      },
    })
    const joined = JSON.stringify(guarded)

    expect(joined).toContain('Proof to collect')
    expect(joined).toContain('more consistent brew')
    expect(joined).toContain('supported zones')
    expect(joined).toContain('quality-focused')
    expect(joined).toContain('delivery where available')
    expect(joined).toContain('carefully selected coffee')
    expect(joined).toContain('carefully roasted beans')
    expect(joined).toContain('practical choice for office coffee planning')
    expect(joined).toContain('more considered experience')
    expect(joined).toContain('carefully selected beans')
    expect(joined).toContain('قهوة صباحية أكثر اتساقًا')
    expect(joined).toContain('كوب قهوة متوازن')
    expect(joined).toContain('فنجان قهوة متوازن')
    expect(joined).not.toContain('Customer Testimonials')
    expect(joined).not.toContain('Perfect for')
    expect(joined).not.toContain('quick delivery guaranteed')
    expect(joined).not.toContain('delivered to your doorstep')
    expect(joined).not.toContain('finest coffee')
    expect(joined).not.toContain('perfect choice')
    expect(joined).not.toContain('perfectly roasted')
    expect(joined).not.toContain('premium experience')
    expect(joined).not.toContain('best beans')
    expect(joined).not.toContain('promptly delivery')
    expect(joined).not.toContain('قهوة صباحية مثالية')
    expect(joined).not.toContain('كوب قهوة مثالي')
    expect(joined).not.toContain('فنجان قهوة مثالي')
  })

  it('repairs production-observed coffee quality and delivery-schedule claims', () => {
    const guarded = guardContentDraftTruth({
      caption: 'Experience freshly roasted coffee in Dubai. Watch how we Help quality in every bean.',
      deliveryCaption: 'Check how our monthly subscription fits your coffee routine with timely deliveries.',
      videoPrompt: "A person receives a package on the marked date. Overlay text: 'On-time deliveries every month.'",
    }, {
      brandFacts: [
        'The coffee is freshly roasted.',
        'Delivery is limited to Dubai within 48 hours.',
      ],
    })
    const serialized = JSON.stringify(guarded)

    expect(serialized).toContain('freshly roasted coffee subscription details')
    expect(serialized).toContain('delivery within the documented service window')
    expect(serialized).not.toMatch(/help quality|quality in every bean|timely deliveries|on-time deliveries|on the marked date/i)
  })

  it('repairs production-observed Arabic roasting, home-delivery, and fast-delivery wording', () => {
    const guarded = guardContentDraftTruth({
      caption: 'اكتشف كيف يتم تحميص قهوتنا الطازجة وتوصيلها إليك في دبي. تعرف على عملية تحميص القهوة. استمتع بجودة القهوة المحمصة حديثًا. #توصيل_سريع',
      videoPrompt: 'مشهد 1: استلام القهوة الطازجة في المنزل. مشهد 2: لقطات لعملية توصيل القهوة السريعة.',
    }, {
      brandFacts: [
        'القهوة محمصة حديثًا.',
        'التوصيل داخل دبي فقط خلال 48 ساعة.',
      ],
    })
    const serialized = JSON.stringify(guarded)

    expect(serialized).toContain('تفاصيل القهوة المحمصة')
    expect(serialized).toContain('نطاق ومدة توصيل القهوة')
    expect(serialized).toContain('#تفاصيل_التوصيل')
    expect(serialized).not.toMatch(/كيف يتم تحميص قهوتنا|عملية تحميص|استمتع بجودة|استلام القهوة.*المنزل|عملية توصيل القهوة السريعة|#توصيل_سريع/)
  })

  it('repairs the observed NEXUS workflow claims and malformed English before persistence', () => {
    const drafts = [
      'With NEXUS AI, you can trust that every marketing decision is backed by human approval.',
      'Gain confidence in your marketing spend with our transparent credit system.',
      'Centralize your operations and eliminate scattered efforts.',
      'Help consistent messaging across all platforms.',
      'See how collaboration enhances marketing strategies.',
      'See the full potential of an end-to-end marketing workflow with NEXUS AI. Achieve seamless operations.',
      'Help your brand voice remains consistent across all channels. Discover our brand consistency assurance.',
      'Optimize your resources with AI-driven management. Discover how NEXUS AI enhances resource utilization.',
      'Use NEXUS AI to eliminate scattered efforts across the marketing team.',
    ]

    const guarded = drafts.map(draft => guardContentDraftText(draft, {
      brandFacts: [
        'NEXUS AI prepares marketing strategy and content drafts for human review.',
        'Publishing and ad spend require approval.',
        'Metered AI actions display a credit cost before execution.',
      ],
      hasConversionDestination: true,
    })).join(' ')

    expect(guarded).toContain('approval before publishing or ad spend')
    expect(guarded).toContain('displayed credit cost')
    expect(guarded).not.toMatch(/trust that every|gain confidence|eliminate scattered|help consistent|enhances marketing strategies|full potential|seamless operations|brand voice remains|consistency assurance|optimize your resources|enhances resource utilization/i)
  })

  it('recursively repairs workflow overclaims in creative prompts as well as captions', () => {
    const guarded = guardContentDraftTruth({
      caption: 'Use the workspace to eliminate scattered efforts.',
      videoPrompt: 'Show how NEXUS AI eliminates scattered efforts and enhances resource utilization.',
    })
    const serialized = JSON.stringify(guarded)

    expect(serialized).not.toMatch(/eliminate(?:s)? scattered efforts|enhances resource utilization/i)
    expect(serialized).toMatch(/ownership clearer/i)
  })

  it('repairs the exact bilingual NEXUS drafts found by the post-save human audit', () => {
    const drafts = [
      'اكتشف كيف تعزز الرقابة البشرية التسويق بالذكاء الاصطناعي. مع نكسوس AI، يمكنك الوثوق في أن كل خطوة يتم الموافقة عليها من قبل البشر لضمان دقة وفعالية الاستراتيجيات.',
      'Understanding how NEXUS AI credits work can put your budget concerns to rest. Our credit system offers transparency and predictability, helping you know exactly where your marketing spend is going.',
      'اكتشف كيف تحافظ نكسوس AI على صوت علامتك التجارية متسقًا عبر جميع القنوات. ضمان الاتساق في الرسائل يساعد على من هوية علامتك التجارية.',
      "With our tools, limited resources won't hold you back from achieving marketing success.",
      'Discover the synergy between AI and human expertise at NEXUS AI. See how collaboration enhances marketing solutions.',
      'شاهد كيف يمكن لحلول نكسوس AI المتكاملة تحسين عملياتك التسويقية. اكتشف إمكانيات سير العمل المتكامل.',
      'Keep approved brand messaging available across the workflow. with NEXUS AI.',
      'Optimize your resource management with AI-driven solutions from NEXUS AI. Learn how to make the most of your resources.',
      'فهم نظام الائتمان لدينا يمنحك وضوحًا على نفقاتك التسويقية. مع نكسوس AI، يمكنك التحكم الكامل في إنفاقك.',
    ]
    const guarded = drafts.map(draft => guardContentDraftText(draft, {
      brandFacts: ['AI drafts require human review before publishing or ad spend.'],
    })).join(' ')

    expect(guarded).toContain('approval handoffs')
    expect(guarded).toContain('تكلفة الكريديت المعروضة')
    expect(guarded).not.toMatch(/الوثوق في أن كل خطوة|ضمان دقة وفعالية|budget concerns to rest|know exactly where|يساعد على من هوية|won't hold you back|marketing success|enhances marketing solutions|تحسين عملياتك التسويقية|make the most of your resources|التحكم الكامل/i)
    expect(guarded).not.toContain('. with NEXUS')
  })

  it('bounds NEXUS approval, credit, workflow, and Brand Brain claims across all draft fields', () => {
    const guarded = guardContentDraftTruth({
      caption: 'اكتشف كيف يمكن للإشراف البشري تعزيز التسويق بالذكاء الاصطناعي. نحن هنا لنوضح لك كيف تدعم عملية الموافقة البشرية أن تكون جهودك التسويقية مدروسة وآمنة.',
      imagePrompt: 'A clean and professional infographic illustrating the NEXUS AI credit system, showing steps and benefits of using credits for budget management.',
      nested: [
        {
          caption: 'Understand how NEXUS AI credits work to give you budget predictability. With our transparent credit system, you can manage your marketing spend effectively and confidently. Stay in control of your budget with NEXUS AI.',
          videoPrompt: 'Discover how NEXUS AI brings everything together in one streamlined workflow. Request a demo today to see it in action!',
        },
        {
          caption: 'اكتشف كيف يحافظ NEXUS AI على صوت علامتك التجارية. نحن نسعى إلى دعم أن تظل رسائلك متسقة عبر جميع القنوات.',
          videoPrompt: 'Our tools Help your campaigns are run smoothly and effectively. Explore our features today!',
        },
        {
          caption: "Streamline your marketing with NEXUS AI's governed workflow. See the full potential of an end-to-end marketing workflow.",
          videoPrompt: 'NEXUS AI offers a seamless, end-to-end workflow that integrates all your marketing needs into one platform. Discover the benefits today!',
        },
        {
          caption: 'Explore the synergy between AI and human expertise. Gain clarity on your marketing spend with our credit system.',
          imagePrompt: 'A creative illustration of a megaphone with various brand elements flowing out, symbolizing consistent brand messaging maintained by AI.',
          videoPrompt: 'Worried about AI replacing human jobs? At NEXUS AI, we believe in collaboration. NEXUS AI helps maintain your brand voice across all platforms. Learn how we Help unified communication for your brand.',
        },
        {
          imagePrompt: 'A clear and informative infographic showing the NEXUS AI credit system, highlighting transparency and budget control benefits.',
        },
      ],
    }, {
      brandFacts: [
        'Publishing and ad spend require approval.',
        'Metered AI actions display a credit cost and create a ledger entry.',
        'Brand Brain supplies approved messaging to campaign drafts.',
      ],
    })
    const serialized = JSON.stringify(guarded)

    expect(serialized).toContain('quoted cost')
    expect(serialized).toContain('Brand Brain')
    expect(serialized).not.toMatch(/مدروسة وآمنة|budget predictability|manage your marketing spend effectively|stay in control|steps and benefits|brings everything together|request a demo|Help your campaigns are|smoothly and effectively|full potential|seamless, end-to-end|integrates all your marketing needs|helps maintain your brand voice|Help unified communication|gain clarity on your marketing spend|governed workflow in NEXUS AI's governed workflow|synergy between AI and human|replacing human jobs|maintained by AI|budget control benefits/i)
  })

  it('canonicalizes new NEXUS claim variants instead of chasing exact sentences', () => {
    const guarded = guardContentDraftTruth({
      approval: 'مع NEXUS AI، يتم دمج الموافقة البشرية في كل خطوة لضمان نتائج موثوقة.',
      credit: 'Our credit system helps transparency and predictability, allowing you to manage your marketing spend with confidence.',
      creditVisual: 'A detailed guide illustration on the credit system with symbols of clarity, budget control, and financial insights.',
      demo: 'Request a demo session today!',
      resources: 'Explore our features that streamline your efforts and maximize your resources.',
      collaboration: "Worried about AI replacing human jobs? See how NEXUS AI collaborates with human expertise to enhance marketing strategies. It's about partnership, not replacement. Learn more about this synergy today.",
      workflow: 'Discover how our end-to-end solutions can streamline your operations, helping seamless marketing workflows.',
      brand: 'Learn how NEXUS AI helps your brand voice is unified across all platforms.',
      creditFollowup: 'Our transparent credit system gives you insights into your spending, helping budget control.',
      reliableOutcome: 'نحن نضيف الإشراف البشري لضمان نتائج موثوقة في NEXUS AI.',
      potential: 'Unlock the full potential of NEXUS AI for your marketing team.',
      effectiveSpend: 'The NEXUS AI credit system helps you manage your marketing spend effectively.',
      resourcesVariant: 'Use NEXUS AI to make the most of your resources across campaigns.',
    }, {
      brandFacts: ['NEXUS AI records metered actions in a credit ledger.'],
    })
    const serialized = JSON.stringify(guarded)

    expect(serialized).toContain('credit ledger')
    expect(serialized).toContain('Brand Brain')
    expect(serialized).toContain('يتطلب النشر والإنفاق الإعلاني موافقة')
    expect(serialized).not.toMatch(/كل خطوة|نتائج موثوقة|helps transparency|predictability|spend with confidence|manage your marketing spend effectively|budget control|financial insights|request a demo|streamline your efforts|maximize your resources|make the most of your resources|replacing human jobs|enhance marketing strategies|partnership, not replacement|seamless marketing|brand voice is unified|insights into your spending|full potential/i)
  })

  it('renders NEXUS captions and creative directions from a field-aware truth policy', () => {
    const guarded = guardContentDraftTruth([
      {
        caption: 'Amazing AI and human collaboration delivers incredible results.',
        imagePrompt: 'An illustration about human approval in NEXUS AI.',
      },
      {
        caption: 'Control your budget with the NEXUS AI credit system.',
        imagePrompt: 'An infographic about NEXUS AI credits and savings.',
      },
      {
        caption: 'Keep the NEXUS AI brand voice consistent everywhere.',
        videoPrompt: 'Show NEXUS AI brand consistency across every platform.',
      },
    ], {
      brandFacts: [
        'NEXUS AI drafts require human review.',
        'NEXUS AI records metered actions in a credit ledger.',
        'NEXUS AI Brand Brain supplies approved messaging.',
      ],
    })

    expect(guarded[0].caption).toContain('human review remains required')
    expect(guarded[0].imagePrompt).toContain('distinct human review')
    expect(guarded[1].caption).toContain('Monthly plan credits follow the billing cycle')
    expect(guarded[1].imagePrompt).toContain('three-step credit flow')
    expect(guarded[2].caption).toContain('Brand Brain carries approved positioning')
    expect(guarded[2].videoPrompt).toContain('channel-specific draft cards')
    expect(JSON.stringify(guarded)).not.toMatch(/amazing|incredible results|control your budget|consistent everywhere/i)
  })

  it('inherits the topic from sibling creative fields and preserves Date values', () => {
    const scheduledAt = new Date('2026-07-18T10:00:00.000Z')
    const [guarded] = guardContentDraftTruth([{
      caption: 'شاهد الإمكانيات الكاملة لعملية تسويق شاملة مع NEXUS AI.',
      videoPrompt: 'Show the NEXUS AI workflow from strategy to execution.',
      scheduledAt,
    }], {
      brandFacts: ['NEXUS AI records campaign workflow stages.'],
    })

    expect(guarded.caption).toContain('Brand Brain')
    expect(guarded.caption).toContain('القرار التالي')
    expect(guarded.videoPrompt).toContain('six distinct stages')
    expect(guarded.scheduledAt).toBe(scheduledAt)
    expect(guarded.scheduledAt).toBeInstanceOf(Date)
  })

  it('documents the draft-only content plan policy', () => {
    const prompt = buildContentDraftTruthPolicyPrompt()

    expect(prompt).toContain('draft content for review only')
    expect(prompt).toContain('Nothing is approved, scheduled, published, or active')
    expect(prompt).toContain('where available')
    expect(prompt).toContain('timely or on-time delivery')
    expect(prompt).toContain('first-party roasting')
    expect(prompt).toContain('عملية التحميص')
    expect(prompt).toContain('productivity, morale, focus, energy, team performance')
    expect(prompt).toContain('easier planning, more consistent coffee routines')
    expect(prompt).toContain('Perfect for...')
    expect(prompt).toContain('مثالي/مثالية')
    expect(prompt).toContain('إنتاجية')
    expect(prompt).toContain('أفضل نكهة')
    expect(prompt).toContain('أفضل الحبوب')
    expect(prompt).toContain('premium experience')
    expect(prompt).toContain('best beans')
    expect(prompt).toContain('قهوة صباحية مثالية')
    expect(prompt).toContain('كوب قهوة متوازن')
    expect(prompt).toContain('irresistible')
    expect(prompt).toContain('expert tips')
    expect(prompt).toContain('correctly formed')
    expect(prompt).toContain('Educational posts must teach something')
  })

  it('analytics insight copy no longer says ready to activate for draft campaigns', () => {
    const insightsRoute = readFileSync(
      path.join(process.cwd(), 'src/app/api/analytics/insights/route.ts'),
      'utf8',
    )

    expect(insightsRoute).not.toContain('ready to activate')
    expect(insightsRoute).toContain('review before scheduling')
  })
})
