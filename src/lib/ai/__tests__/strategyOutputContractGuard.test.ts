import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { formatStrategyPlatformLabel, guardStrategyOutputContract, selectStrategyCampaignPlatforms } from '../strategyOutputContractGuard'
import { validateCampaignStrategyContract } from '@/lib/campaignStrategyContract'

describe('guardStrategyOutputContract', () => {
  const allowed = ['INSTAGRAM', 'TIKTOK', 'FACEBOOK']

  function weeklyCount(plan: any[]): number {
    return plan.reduce((sum, week) => {
      return sum + week.deliverables.reduce((weekSum: number, deliverable: string) => {
        const match = deliverable.trim().match(/^(\d+)/)
        return weekSum + (match ? Number(match[1]) : 1)
      }, 0)
    }, 0)
  }

  it('removes unsupported channelMix platforms and keeps selected platforms only', () => {
    const out = guardStrategyOutputContract({
      channelMix: [
        { platform: 'Instagram', budgetPercent: 40, rationale: 'main feed', contentFrequency: '4x/week' },
        { platform: 'Pinterest', budgetPercent: 20, rationale: 'boards', contentFrequency: 'daily' },
        { platform: 'TikTok', budgetPercent: 40, rationale: 'video', contentFrequency: '3x/week' },
      ],
    }, { allowedPlatforms: allowed })

    expect(out.channelMix.map((c: any) => c.platform)).toEqual(['Instagram', 'TikTok'])
    expect(JSON.stringify(out)).not.toMatch(/Pinterest/i)
  })

  it('strips budgetPercent from organic-only channelMix and keeps effort share', () => {
    const out = guardStrategyOutputContract({
      channelMix: [
        { platform: 'Instagram', budgetPercent: 40, rationale: 'Organic education cadence', contentFrequency: '4x/week' },
        { platform: 'TikTok', effortSharePercent: 60, budgetPercent: 60, rationale: 'Short-form demos', contentFrequency: '3x/week' },
      ],
    }, { allowedPlatforms: allowed, strategyType: 'organic' })

    expect(out.channelMix.map((c: any) => c.platform)).toEqual(['Instagram', 'TikTok'])
    expect(out.channelMix[0].effortSharePercent).toBe(40)
    expect(out.channelMix[1].effortSharePercent).toBe(60)
    expect(JSON.stringify(out.channelMix)).not.toMatch(/budgetPercent/)
  })

  it('keeps budgetPercent available for paid planning mode', () => {
    const out = guardStrategyOutputContract({
      channelMix: [
        { platform: 'Instagram', budgetPercent: 40, rationale: 'Planning assumption', contentFrequency: '4x/week' },
      ],
    }, { allowedPlatforms: allowed, strategyType: 'paid' })

    expect(out.channelMix[0].budgetPercent).toBe(40)
    expect(JSON.stringify(out.channelMix)).not.toMatch(/effortSharePercent/)
  })

  it('rewrites unsupported platform text in angles and weekly deliverables', () => {
    const out = guardStrategyOutputContract({
      contentAnglesDetailed: [
        { title: 'Pinterest board for design ideas', platform: 'Pinterest', format: 'Blog Post', hook: 'Save this', cta: 'DM us' },
      ],
      weeklyExecutionPlan: [
        { week: 2, deliverables: ['Create Pinterest boards and blog posts'], platforms: ['Pinterest'] },
      ],
    }, { allowedPlatforms: allowed })

    expect(out.contentAnglesDetailed[0].platform).toBe('Instagram')
    expect(out.contentAnglesDetailed[0].format).toBe('Carousel or short social post')
    expect(JSON.stringify(out)).not.toMatch(/Pinterest|Blog Post/i)
    expect(out.weeklyExecutionPlan[0].platforms).toEqual(['Instagram'])
  })

  it('forces generated readiness checklist items to review-safe not-done states', () => {
    const out = guardStrategyOutputContract({
      readinessChecklist: [
        { label: 'Set up WhatsApp consultation process', done: true },
        { label: 'Create content assets', done: false },
      ],
    }, { allowedPlatforms: allowed })

    expect(out.readinessChecklist).toEqual([
      { label: 'Confirm WhatsApp consultation intake process', done: false },
      { label: 'Create content assets', done: false },
      { label: 'Confirm the conversion path, response owner, and handoff process before turning this strategy into execution.', done: false },
    ])
  })

  it('fills weak readiness checklists with concrete review-safe defaults before persistence', () => {
    const out = guardStrategyOutputContract({
      readinessChecklist: [
        { label: 'Confirm booking handoff', done: true },
      ],
    }, { allowedPlatforms: allowed })

    expect(out.readinessChecklist).toHaveLength(3)
    expect(out.readinessChecklist.every((item: any) => item.done === false)).toBe(true)
    expect(out.readinessChecklist.map((item: any) => item.label)).toEqual([
      'Confirm booking handoff',
      'Confirm the conversion path, response owner, and handoff process before turning this strategy into execution.',
      'Prepare or select real visual assets for the first Content Hub posts before approval or scheduling.',
    ])
  })

  it('fills missing Arabic readiness checklists in the selected strategy language', () => {
    const out = guardStrategyOutputContract({
      readinessChecklist: [],
    }, { allowedPlatforms: allowed, language: 'ar' })

    expect(out.readinessChecklist).toHaveLength(3)
    expect(out.readinessChecklist.every((item: any) => item.done === false)).toBe(true)
    expect(JSON.stringify(out.readinessChecklist)).toMatch(/تأكيد مسار التحويل/)
    expect(JSON.stringify(out.readinessChecklist)).toMatch(/أصول بصرية/)
    expect(JSON.stringify(out.readinessChecklist)).toMatch(/إثباتات موثّقة/)
  })

  it('guards saved strategy display against unsupported platforms and unsupported download CTAs', () => {
    const out = guardStrategyOutputContract({
      contentAnglesDetailed: [
        { title: 'Dashboard Insights', platform: 'LinkedIn', cta: 'Download now' },
      ],
      funnelStages: [
        {
          stage: 'conversion',
          userMindset: 'Ready to compare options',
          message: 'Review the workflow before committing',
          contentType: 'Carousel',
          platform: 'LinkedIn',
          cta: 'Download now',
          successMetric: 'Qualified interest needs a baseline',
          nextStep: 'Ask for workflow fit details',
          productArea: 'Conversion',
        },
        {
          stage: 'awareness',
          userMindset: 'Recognizes the problem',
          message: 'Understand the workflow gap',
          contentType: 'Short post',
          platform: 'LinkedIn',
          cta: 'Download now',
          successMetric: 'Engagement needs a baseline',
          nextStep: 'Review educational response quality',
          productArea: 'Education',
        },
        {
          stage: 'consideration',
          userMindset: 'Comparing workflow options',
          message: 'See a practical path',
          contentType: 'Carousel',
          platform: 'LinkedIn',
          cta: 'Download now',
          successMetric: 'Interest needs a baseline',
          nextStep: 'Qualify the request manually',
          productArea: 'Consideration',
        },
      ],
      channelMix: [
        { platform: 'LinkedIn', rationale: 'Professional audience' },
        { platform: 'Youtube_shorts', rationale: 'Video education' },
      ],
      weeklyExecutionPlan: [
        { week: 1, platforms: ['LinkedIn', 'youtube_shorts'], deliverables: ['1 LinkedIn post'] },
      ],
    }, { allowedPlatforms: ['FACEBOOK', 'INSTAGRAM', 'YOUTUBE_SHORTS'] })

    expect(JSON.stringify(out)).not.toMatch(/LinkedIn|Download now|Youtube_shorts/)
    expect(out.contentAnglesDetailed[0].platform).toBe('Facebook')
    expect(out.contentAnglesDetailed[0].cta).toBe('Request more information')
    expect(out.funnelStages[0].platform).toBe('Facebook')
    expect(out.funnelStages[0].cta).toBe('Request more information')
    expect(out.channelMix.map((c: any) => c.platform)).toEqual(['Facebook', 'YouTube Shorts'])
    expect(out.weeklyExecutionPlan[0].platforms).toEqual(['Facebook', 'YouTube Shorts'])
  })

  it('backfills weak Arabic funnel stages and KPIs with review-safe operating fields', () => {
    const strategy = {
      campaignName: 'استراتيجية نمو عضوي لـ ClinicFlow AI',
      goal: 'LEADS',
      positioning: 'ClinicFlow AI هي منصة تشغيل للعيادات الصغيرة التي تحتاج وضوحًا يوميًا بدون ادعاءات طبية.',
      keyMessage: 'تنظيم العمل اليومي يجعل المتابعة أوضح للفريق.',
      differentiation: 'دعم سير عمل ثنائي اللغة للعيادات الصغيرة والمتوسطة.',
      targetAudienceRefined: 'مديرو عيادات وفرق استقبال يحتاجون تنظيم الحجوزات والمتابعة.',
      diagnosis: 'العيادة لديها فرصة محتوى عضوي لكن تحتاج إثباتات موثقة قبل أي ادعاء أداء.',
      nextBestAction: 'راجع أول سبعة اتجاهات منشورات قبل إنشاء مسودات Content Hub.',
      estimatedResults: 'تحتاج النتائج إلى خط أساس بعد أول ٣٠ يومًا.',
      readyForPaidAdsReason: 'تشغيل الاستراتيجية عضوي فقط؛ التخطيط المدفوع يحتاج مراجعة منفصلة.',
      businessObjective: {
        primary: 'طلبات عروض توضيحية مؤهلة',
        marketing: 'شرح سير العمل',
        conversionAction: 'طلب عرض توضيحي',
        expectedUserAction: 'مراجعة العرض',
        whyNow: 'الفريق يحتاج وضوحًا تشغيليًا',
        successIn30Days: 'تحديد خط أساس للطلبات والتفاعل',
      },
      diagnosisDetails: {
        stage: 'early-stage',
        bottleneck: 'عدم وضوح سير المتابعة',
        trustGap: 'إثباتات موثقة غير مكتملة',
        offerClarity: 'clear',
        contentGap: 'لا توجد مكتبة أمثلة تشغيلية كافية',
        assetReadiness: 'تحتاج لقطات شاشة وأصول مراجعة',
        conversionReadiness: 'مسار العرض يحتاج تأكيد مسؤول الرد',
        readyForPaidAds: false,
        readyForPaidAdsReason: 'تشغيل الاستراتيجية عضوي فقط',
        mainRisk: 'استخدام ادعاءات طبية أو نتائج مضمونة',
      },
      confidenceReport: { overall: 'medium', byCapability: { contentStrategy: 'high' } },
      contentPillars: ['تنظيم الحجوزات', 'متابعة المرضى', 'وضوح الإدارة'],
      topHooks: ['هل تضيع المتابعة بين الفريق؟', 'كيف تبدأ العيادة يومها بوضوح؟', 'سير عمل أبسط قبل نهاية اليوم'],
      ctaVariations: ['اطلب عرضًا توضيحيًا', 'راجع سير العمل', 'شاهد المثال العملي'],
      audienceSegmentsDetailed: [
        {
          segment: 'مدير عيادة صغيرة',
          situation: 'يتابع الفريق يدويًا',
          pain: 'المهام تتشتت بين الأدوات',
          desiredOutcome: 'رؤية يومية أوضح',
          objection: 'لا يريد أداة معقدة',
          message: 'ابدأ بسير متابعة قابل للمراجعة',
          platform: 'LinkedIn',
          format: 'كاروسيل',
          cta: 'اطلب عرضًا توضيحيًا',
        },
        {
          segment: 'فريق استقبال',
          situation: 'يرسل تذكيرات ويتابع الردود',
          pain: 'التواصل غير موحد',
          desiredOutcome: 'قوالب عملية واضحة',
          objection: 'يخاف من تغيير workflow اليومي',
          message: 'التنظيم يساعد الفريق ولا يستبدله',
          platform: 'Instagram',
          format: 'ريل قصير',
          cta: 'راجع سير العمل',
        },
      ],
      contentAnglesDetailed: [
        { title: 'بداية يوم العيادة', hook: 'ماذا يحدث قبل أول موعد؟', pain: 'عدم وضوح اليوم', format: 'كاروسيل', platform: 'LinkedIn', cta: 'راجع سير العمل', asset: 'لقطة سير عمل', funnelStage: 'awareness' },
        { title: 'تذكيرات المواعيد', hook: 'التذكير ليس مجرد رسالة', pain: 'تأخر التذكير', format: 'ريل', platform: 'Instagram', cta: 'اطلب عرضًا', asset: 'خلفية عيادة', funnelStage: 'consideration' },
        { title: 'مسؤولية المتابعة', hook: 'من يتابع بعد الموعد؟', pain: 'تشتت المسؤولية', format: 'منشور', platform: 'LinkedIn', cta: 'شاهد المثال', asset: 'مخطط بسيط', funnelStage: 'consideration' },
        { title: 'عرض توضيحي عملي', hook: 'شاهد سير العمل قبل الالتزام', pain: 'غموض الخطوة التالية', format: 'منشور CTA', platform: 'LinkedIn', cta: 'احجز عرضًا', asset: 'سكرين mockup', funnelStage: 'conversion' },
      ],
      weeklyExecutionPlan: [
        { week: 1, objective: 'شرح المشكلة', keyMessage: 'وضوح اليوم يبدأ من سير العمل', deliverables: ['2 منشورات تعليمية عن بداية يوم العيادة'], platforms: ['LinkedIn'], cta: 'راجع سير العمل', successMetric: 'تفاعل يحتاج خط أساس' },
        { week: 2, objective: 'شرح الحل', keyMessage: 'التذكير والمتابعة عمل منظم', deliverables: ['2 منشورات عن التذكيرات والمتابعة'], platforms: ['Instagram'], cta: 'اطلب عرضًا', successMetric: 'طلبات اهتمام تحتاج خط أساس' },
        { week: 3, objective: 'تخفيف الاعتراض', keyMessage: 'الأداة لا تستبدل الفريق', deliverables: ['2 منشورات عن مسؤولية الفريق'], platforms: ['LinkedIn'], cta: 'شاهد المثال', successMetric: 'ردود تحتاج خط أساس' },
        { week: 4, objective: 'دعوة للعرض', keyMessage: 'راجع workflow قبل القرار', deliverables: ['1 منشور CTA لعرض توضيحي'], platforms: ['LinkedIn'], cta: 'احجز عرضًا', successMetric: 'طلبات عرض تحتاج خط أساس' },
      ],
      funnelStages: [
        { stage: 'awareness', message: 'ضعيف' },
      ],
      kpis: [],
      readinessChecklist: [
        { label: 'تأكيد مسؤول الرد قبل تحويل الطلبات إلى تنفيذ', done: false },
        { label: 'تجهيز أصول بصرية حقيقية قبل إنشاء المسودات', done: false },
        { label: 'جمع إثباتات موثقة قبل استخدام قصص العملاء', done: false },
      ],
      riskNotes: ['غياب الإثباتات الموثقة'],
      assumptions: ['لا توجد بيانات أداء تاريخية'],
      missingData: [],
    }

    const out = guardStrategyOutputContract(strategy, {
      allowedPlatforms: ['LINKEDIN', 'INSTAGRAM', 'YOUTUBE_SHORTS'],
      language: 'ar',
      strategyType: 'organic',
    })

    expect(out.kpis).toHaveLength(2)
    expect(JSON.stringify(out.kpis)).toMatch(/تحديد خط أساس/)
    expect(out.funnelStages).toHaveLength(4)
    expect(JSON.stringify(out.funnelStages)).toMatch(/عرض توضيحي/)
    expect(JSON.stringify(out)).not.toMatch(/Campaign active|published|scheduled|guaranteed|ROI|ROAS/)

    const report = validateCampaignStrategyContract(out, { language: 'ar' })
    expect(report.valid).toBe(true)
    expect(report.weakFields).not.toContain('funnelStages')
    expect(report.weakFields).not.toContain('kpis')
  })

  it('backfills real-world weak Arabic strategy output into an operating brief before persistence', () => {
    const out = guardStrategyOutputContract({
      campaignName: 'استراتيجية نمو عضوي لـ ClinicFlow AI',
      goal: 'LEADS',
      positioning: 'ClinicFlow AI هي منصة تشغيل للعيادات التي تحتاج وضوحًا يوميًا دون تعقيد.',
      keyMessage: 'ClinicFlow AI تجعل متابعة العمل اليومي أوضح للفريق.',
      differentiation: 'توحيد المواعيد والمتابعة في سير عمل قابل للمراجعة.',
      targetAudienceRefined: 'أصحاب العيادات ومديرو العمليات الذين يحتاجون تنظيم المواعيد والمتابعة.',
      diagnosis: 'الفرصة العضوية واضحة لكن الإثباتات ومسار الرد يحتاجان مراجعة قبل التوسع.',
      nextBestAction: 'راجع اتجاهات أول شهر وحدد مسؤول الرد على طلبات العرض.',
      estimatedResults: 'يمكن استخدام أول شهر لتحديد خط أساس للطلبات والتفاعل دون وعود أداء.',
      readyForPaidAdsReason: 'تشغيل الاستراتيجية عضوي فقط؛ التخطيط المدفوع يحتاج مدخلات منفصلة.',
      businessObjective: {
        primary: 'طلبات عروض توضيحية مؤهلة',
        marketing: 'شرح سير العمل',
        conversionAction: 'طلب عرض توضيحي',
        expectedUserAction: 'طلب مراجعة سير العمل',
        whyNow: 'الفريق يحتاج وضوحًا تشغيليًا',
        successIn30Days: 'تحديد خط أساس للطلبات المؤهلة',
      },
      diagnosisDetails: {
        stage: 'early-stage',
        bottleneck: 'عدم وضوح مسار المتابعة',
        trustGap: 'إثباتات موثقة غير مكتملة',
        offerClarity: 'partial',
        contentGap: 'لا توجد أمثلة تشغيلية كافية',
        assetReadiness: 'تحتاج لقطات شاشة وعرض توضيحي',
        conversionReadiness: 'مسؤول الرد يحتاج تأكيد',
        readyForPaidAds: false,
        readyForPaidAdsReason: 'تشغيل عضوي فقط',
        mainRisk: 'ادعاءات أداء غير مثبتة',
      },
      confidenceReport: { overall: 'medium', byCapability: { contentStrategy: 'high' } },
      contentPillars: ['تنظيم المواعيد', 'متابعة الفريق', 'وضوح الإدارة'],
      topHooks: ['هل تضيع المتابعة؟', 'كيف يبدأ يوم العيادة بوضوح؟', 'من يتابع بعد الموعد؟'],
      ctaVariations: ['اطلب عرض توضيحي', 'راجع سير العمل', 'شاهد المثال العملي'],
      audienceSegmentsDetailed: [
        { segment: 'صاحب عيادة', situation: 'يدير المواعيد يدويًا', pain: 'عدم وضوح اليوم', desiredOutcome: 'نظام متابعة أوضح', objection: 'لا يريد تعقيدًا إضافيًا', message: 'ابدأ بسير عمل قابل للمراجعة', platform: 'LinkedIn', format: 'Carousel or short social post', cta: 'اطلب عرض توضيحي' },
        { segment: 'مدير عمليات', situation: 'يتابع المهام بين الفريق', pain: 'تشتت المسؤولية', desiredOutcome: 'توزيع أوضح للمتابعة', objection: 'يخشى بطء التنفيذ', message: 'راجع مثال سير عمل قبل القرار', platform: 'Instagram', format: 'Video', cta: 'شاهد كيف يعمل' },
      ],
      contentAnglesDetailed: [
        { title: 'تنظيم المواعيد بفعالية', hook: 'هل تعاني من فوضى المواعيد؟', pain: 'فوضى في إدارة المواعيد', format: 'Reel', platform: 'Instagram', cta: 'اطلب عرض توضيحي', asset: '', funnelStage: 'awareness' },
        { title: 'تحسين المتابعة اليومية', hook: 'هل تجد صعوبة في متابعة المهام؟', pain: 'تكرار المهام اليدوية', format: 'Video', platform: 'YouTube Shorts', cta: 'شاهد كيف يعمل', asset: 'فيديو توضيحي', funnelStage: 'consideration' },
        { title: 'تواصل ثنائي اللغة', hook: 'هل تضيع الرسائل بين الفريق؟', pain: 'عدم وضوح التواصل', format: 'Carousel', platform: 'LinkedIn', cta: 'تعرف على المزيد', asset: 'لقطات شاشة', funnelStage: 'consideration' },
        { title: 'وضوح العمليات اليومية', hook: 'كيف تعرف ما حدث اليوم؟', pain: 'غياب رؤية يومية', format: 'Post', platform: 'LinkedIn', cta: 'اطلب عرضًا', asset: 'مخطط سير عمل', funnelStage: 'conversion' },
      ],
      weeklyExecutionPlan: [
        { week: 1, objective: 'زيادة الوعي', keyMessage: 'وضوح اليوم يبدأ من المواعيد', deliverables: ['2 Reels عن تنظيم المواعيد'], platforms: ['Instagram'], cta: 'اطلب عرض توضيحي', successMetric: 'طلبات تحتاج خط أساس' },
        { week: 2, objective: 'شرح المتابعة', keyMessage: 'المتابعة تحتاج مسؤولية واضحة', deliverables: ['1 Video عن المتابعة اليومية'], platforms: ['YouTube Shorts'], cta: 'شاهد كيف يعمل', successMetric: 'مشاهدات تحتاج خط أساس' },
        { week: 3, objective: 'تخفيف الاعتراض', keyMessage: 'التنظيم لا يزيد التعقيد', deliverables: ['1 Carousel عن التواصل الثنائي'], platforms: ['LinkedIn'], cta: 'تعرف على المزيد', successMetric: 'نقرات تحتاج خط أساس' },
        { week: 4, objective: 'دعوة للعرض', keyMessage: 'راجع سير العمل قبل القرار', deliverables: ['1 Post لدعوة عرض توضيحي'], platforms: ['LinkedIn'], cta: 'اطلب عرضًا', successMetric: 'طلبات عرض تحتاج خط أساس' },
      ],
      funnelStages: [
        { stage: 'awareness', userMindset: 'يعرف المشكلة', message: 'العمل يحتاج وضوحًا', contentType: 'فيديو قصير', platform: 'Instagram', cta: 'راجع سير العمل', successMetric: 'تفاعل يحتاج خط أساس', nextStep: 'إرسال مثال عملي للمهتم', productArea: 'تثقيف' },
        { stage: 'consideration', userMindset: 'يقارن الحلول', message: 'راجع سير العمل', contentType: 'كاروسيل', platform: 'LinkedIn', cta: 'اطلب عرض توضيحي', successMetric: 'طلبات تحتاج خط أساس', nextStep: 'تأهيل الطلب بسؤال عن حجم الفريق', productArea: 'شرح الحل' },
        { stage: 'conversion', userMindset: 'يريد الخطوة التالية', message: 'احجز مراجعة سير العمل', contentType: 'منشور CTA', platform: 'LinkedIn', cta: 'اطلب عرضًا', successMetric: 'طلبات عرض تحتاج خط أساس', nextStep: 'تحديد مسؤول الرد وموعد المتابعة', productArea: 'تحويل' },
      ],
      kpis: [
        { metric: 'طلبات عرض توضيحي', target: 'خط أساس بعد أول شهر', timeframe: 'أول 30 يومًا', isHypothesis: true },
        { metric: 'تفاعل مع شرح سير العمل', target: 'خط أساس بعد أول شهر', timeframe: 'أول 30 يومًا', isHypothesis: true },
      ],
      readinessChecklist: [
        { label: 'تأكيد مسؤول الرد قبل الإنتاج', done: false },
        { label: 'تجهيز لقطات شاشة حقيقية', done: false },
        { label: 'جمع إثباتات موثقة قبل ادعاءات الأداء', done: false },
      ],
      riskNotes: ['لا توجد إثباتات موثقة كافية'],
      assumptions: ['لا توجد بيانات أداء تاريخية'],
      missingData: [],
    }, {
      allowedPlatforms: ['INSTAGRAM', 'YOUTUBE_SHORTS', 'LINKEDIN'],
      language: 'ar',
      strategyType: 'organic',
      organicPostCount: 4,
    }) as any

    expect(out.assetRequirements.mustHave.length).toBeGreaterThan(0)
    expect(JSON.stringify(out)).not.toMatch(/Carousel or short social post|Short-form video|Video|Post/)
    expect(out.audienceSegmentsDetailed.map((segment: any) => segment.format)).toEqual([
      'كاروسيل أو منشور اجتماعي قصير',
      'فيديو قصير',
    ])
    expect(out.weeklyExecutionPlan.flatMap((week: any) => week.deliverables).join('\n')).not.toMatch(/Reels|Video|Carousel|Post/)
    expect(JSON.stringify(out.contentAnglesDetailed)).toMatch(/proofNeeded|responseHandoff|reviewPoint/)
    expect(out.weeklyExecutionPlan.every((week: any) => week.assetsNeeded?.length && week.executionNote && week.reviewPoints?.length)).toBe(true)

    const report = validateCampaignStrategyContract(out, { language: 'ar' })
    expect(report.valid).toBe(true)
    expect(report.weakFields).toEqual([])
    expect(report.missingFields).toEqual([])
  })

  it('aligns weekly deliverables to the paid exact organic post count', () => {
    const out = guardStrategyOutputContract({
      contentAnglesDetailed: [
        { title: 'تنظيم المواعيد بفعالية', format: 'Reel', platform: 'Instagram' },
        { title: 'تحسين المتابعة اليومية', format: 'Video', platform: 'YouTube Shorts' },
        { title: 'تواصل ثنائي اللغة فعال', format: 'Carousel', platform: 'LinkedIn' },
        { title: 'وضوح العمليات اليومية', format: 'Video', platform: 'YouTube Shorts' },
        { title: 'تجربة المستخدم في ClinicFlow AI', format: 'Reel', platform: 'Instagram' },
        { title: 'تجربة عملية ClinicFlow AI', format: 'Video', platform: 'YouTube Shorts' },
        { title: 'تواصل فعال مع المرضى', format: 'Carousel', platform: 'LinkedIn' },
      ],
      weeklyExecutionPlan: [
        { week: 1, objective: 'زيادة الوعي', deliverables: ['2 Reels عن تنظيم المواعيد', '1 فيديو توضيحي'], platforms: ['Instagram', 'YouTube Shorts'], cta: 'اطلب عرض توضيحي', successMetric: 'عدد المشاهدات' },
        { week: 2, objective: 'تحفيز الاهتمام', deliverables: ['1 مقال على LinkedIn', '1 فيديو قصير'], platforms: ['LinkedIn', 'YouTube Shorts'], cta: 'شاهد كيف يعمل', successMetric: 'عدد النقرات' },
        { week: 3, objective: 'تحفيز التحويلات', deliverables: ['1 فيديو توضيحي', '1 Reel'], platforms: ['YouTube Shorts', 'Instagram'], cta: 'تعرف على المزيد', successMetric: 'عدد الطلبات' },
        { week: 4, objective: 'تعزيز التحويلات', deliverables: ['1 مقال على LinkedIn', '1 فيديو قصير'], platforms: ['LinkedIn', 'YouTube Shorts'], cta: 'اطلب عرض توضيحي', successMetric: 'طلبات تجريبية' },
      ],
    }, {
      allowedPlatforms: ['INSTAGRAM', 'YOUTUBE_SHORTS', 'LINKEDIN'],
      language: 'ar',
      strategyType: 'organic',
      organicPostCount: 7,
    }) as any

    expect(out.contentAnglesDetailed).toHaveLength(7)
    expect(weeklyCount(out.weeklyExecutionPlan)).toBe(7)
    expect(out.weeklyExecutionPlan.flatMap((week: any) => week.deliverables)).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^1 /),
        expect.stringContaining('ClinicFlow AI'),
      ]),
    )
  })

  it('keeps Arabic paid-only planning briefs inside the Strategy OS contract without pretending organic posts were generated', () => {
    const paidDraft = {
      campaignName: 'ClinicFlow AI Paid Planning Brief',
      goal: 'LEADS',
      positioning: 'ClinicFlow AI هي منصة تشغيل للعيادات التي تحتاج وضوحًا في المواعيد والمتابعة بدون ادعاءات طبية.',
      keyMessage: 'التخطيط المدفوع هنا يراجع الرسالة والجاهزية فقط قبل أي إنفاق.',
      differentiation: 'تجربة تشغيل ثنائية اللغة وسير متابعة واضح للعيادات.',
      targetAudienceRefined: 'أصحاب العيادات ومديرو العمليات الذين يحتاجون وضوحًا في الطلبات والمتابعة.',
      diagnosis: 'العلامة جاهزة لمراجعة فرضيات مدفوعة، لكن الإطلاق يحتاج تتبعًا وموافقة صريحة.',
      nextBestAction: 'راجع هدف الحملة ومسار التحويل قبل أي اختبار مدفوع.',
      estimatedResults: 'تحتاج النتائج إلى بيانات فعلية وخط أساس قبل أي حكم أداء.',
      readyForPaidAdsReason: 'التخطيط المدفوع فقط؛ لا إطلاق ولا صرف ميزانية من هذا البريف.',
      businessObjective: {
        primary: 'طلبات عروض توضيحية مؤهلة',
        marketing: 'اختبار رسائل مدفوعة آمنة',
        conversionAction: 'طلب عرض توضيحي',
        expectedUserAction: 'مراجعة العرض وطلب تواصل',
        whyNow: 'الرسالة الأساسية تحتاج اختبارًا منضبطًا',
        successIn30Days: 'تحديد خط أساس لجودة الطلبات بعد بيانات حقيقية',
      },
      diagnosisDetails: {
        stage: 'early-stage',
        bottleneck: 'غياب خط أساس للتتبع',
        trustGap: 'إثباتات موثقة غير مكتملة',
        offerClarity: 'partial',
        contentGap: 'الحاجة إلى زوايا إعلان قابلة للمراجعة',
        assetReadiness: 'تحتاج أصولًا بصرية قبل الإنتاج',
        conversionReadiness: 'مسار التحويل يحتاج تأكيدًا',
        readyForPaidAds: false,
        readyForPaidAdsReason: 'يحتاج تتبعًا وموافقة صريحة',
        mainRisk: 'الإنفاق قبل وضوح التتبع',
      },
      audienceSegmentsDetailed: [
        {
          segment: 'مدير عيادة صغيرة',
          situation: 'يريد تنظيم المواعيد والمتابعة',
          pain: 'فوضى تشغيلية يومية',
          desiredOutcome: 'سير متابعة أوضح',
          objection: 'الخوف من تعقيد الأداة',
          message: 'راجع سير العمل قبل القرار',
          platform: 'LinkedIn',
          format: 'كاروسيل',
          cta: 'اطلب عرضًا توضيحيًا',
        },
        {
          segment: 'مالك عيادة',
          situation: 'يفكر في تحسين التشغيل',
          pain: 'عدم وضوح مصدر الطلبات',
          desiredOutcome: 'تأهيل طلبات أوضح',
          objection: 'هل سيظهر أثر الإعلانات؟',
          message: 'ابدأ بتتبع واضح قبل الإنفاق',
          platform: 'Instagram',
          format: 'فيديو قصير',
          cta: 'راجع مسار التحويل',
        },
      ],
      channelMix: [{ platform: 'LinkedIn', budgetPercent: 50, rationale: 'تخطيط فقط', contentFrequency: 'اختبار محدود بعد الموافقة' }],
      contentPillars: [],
      contentAnglesDetailed: [],
      topHooks: [],
      ctaVariations: [],
      weeklyExecutionPlan: [],
      funnelStages: [],
      kpis: [],
      readinessChecklist: [],
      riskNotes: ['لا يوجد إطلاق مدفوع بدون موافقة صريحة.'],
      assumptions: ['لا توجد بيانات أداء فعلية بعد.'],
      missingData: ['pixel / analytics'],
      confidenceReport: { overall: 'medium', byCapability: { paidPlanning: 'low' } },
      assetRequirements: {},
    }

    const out = guardStrategyOutputContract(paidDraft, {
      allowedPlatforms: ['LINKEDIN', 'INSTAGRAM'],
      language: 'ar',
      strategyType: 'paid',
    })

    expect(out.campaignName).toBe('بريف تخطيط مدفوع لـ ClinicFlow AI')
    expect(out.contentAnglesDetailed).toHaveLength(4)
    expect(out.weeklyExecutionPlan).toHaveLength(4)
    expect(JSON.stringify(out)).toMatch(/تخطيط مدفوع|لا إطلاق|لا صرف ميزانية/)
    expect(JSON.stringify(out)).not.toMatch(/Organic Content Hub content plan/i)

    const report = validateCampaignStrategyContract(out, { language: 'ar' })
    expect(report.valid).toBe(true)
    expect(report.languageViolations).toEqual([])
    expect(report.weakFields).toEqual([])
  })
})

describe('selectStrategyCampaignPlatforms', () => {
  it('prefers selected Brand Brain platforms over model-generated channelMix', () => {
    const platforms = selectStrategyCampaignPlatforms({
      channelMix: [{ platform: 'Pinterest' }, { platform: 'LinkedIn' }],
    }, ['INSTAGRAM', 'TIKTOK', 'FACEBOOK'])

    expect(platforms).toEqual(['Instagram', 'TikTok', 'Facebook'])
  })

  it('falls back to strategy channelMix when no selected platforms are available', () => {
    const platforms = selectStrategyCampaignPlatforms({
      channelMix: [{ platform: 'Instagram' }, { platform: 'TikTok' }],
    }, [])

    expect(platforms).toEqual(['Instagram', 'TikTok'])
  })
})

describe('formatStrategyPlatformLabel', () => {
  it('formats common YouTube Shorts variants for runtime display', () => {
    expect(formatStrategyPlatformLabel('youtube_shorts')).toBe('YouTube Shorts')
    expect(formatStrategyPlatformLabel('Youtube_shorts')).toBe('YouTube Shorts')
    expect(formatStrategyPlatformLabel('youtube shorts')).toBe('YouTube Shorts')
  })
})

describe('strategy runtime copy contract', () => {
  const repoFile = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

  it('does not imply strategy generation creates final content drafts', () => {
    const i18n = repoFile('src/lib/i18n-context.tsx')
    const modal = repoFile('src/components/RunFullStrategyModal.tsx')
    const orderDisplay = repoFile('src/lib/strategy/strategyOrderDisplay.ts')
    const runtimeCopy = `${i18n}\n${modal}\n${orderDisplay}`

    expect(runtimeCopy).not.toMatch(/strategy output and content will be generated/i)
    expect(runtimeCopy).not.toMatch(/الاستراتيجية والمحتوى بالكامل/)
    expect(runtimeCopy).not.toMatch(/Organic posts \/ month/i)
    expect(runtimeCopy).not.toMatch(/منشورات عضوية شهرياً/)

    expect(runtimeCopy).toMatch(/Choose strategy type, duration, content intensity, and output language before reviewing cost/i)
    expect(runtimeCopy).toMatch(/اختر نوع الاستراتيجية، المدة، كثافة المحتوى، ولغة المخرجات قبل مراجعة التكلفة/)
    expect(runtimeCopy).toMatch(/Organic post directions for the first 30 days/i)
    expect(runtimeCopy).toMatch(/اتجاهات منشورات عضوية لأول 30 يوم/)
    expect(runtimeCopy).toMatch(/Sets the paid planning brief depth only/)
    expect(runtimeCopy).toMatch(/يحدد مستوى تفصيل بريف التخطيط المدفوع فقط/)
  })

  it('discloses strategy credit cost before the first modal action can continue', () => {
    const i18n = repoFile('src/lib/i18n-context.tsx')
    const modal = repoFile('src/components/RunFullStrategyModal.tsx')
    const campaignPage = repoFile('src/app/campaigns/[id]/page.tsx')

    expect(i18n).toContain("langStartBtn: 'Continue to cost review'")
    expect(i18n).toContain("langStartBtn: 'متابعة لمراجعة التكلفة'")
    expect(i18n).toContain("langSelectTitle: 'Set up strategy request'")
    expect(i18n).toContain("langSelectTitle: 'إعداد طلب الاستراتيجية'")
    expect(i18n).not.toContain("langSelectTitle: 'Choose Strategy Language'")
    expect(modal).toContain('Strategy cost review')
    expect(modal).toContain('No credits are spent here. The next screen shows your balance and final confirmation before generation.')
    expect(modal).toContain('لا يتم خصم أي كريدت هنا')
    expect(modal).toContain('Review cost —')
    expect(modal).not.toContain('{rs.langStartBtn}')
    expect(campaignPage).toContain('guardStrategyOutputContract(guardedAiOutput?.strategy || {}, { allowedPlatforms: campaign.platforms, language: strategyLanguage, strategyType: strategyScope.type })')
  })

  it('starts strategy generation directly after final cost confirmation without a hidden media step', () => {
    const modal = repoFile('src/components/RunFullStrategyModal.tsx')

    expect(modal).toContain('Cost confirmation is the final user confirmation gate')
    expect(modal).toContain('starts here with no upload, attach, publish, schedule, or ad action')
    expect(modal).not.toContain("'media_check'")
    expect(modal).not.toContain("setPhase('media_check')")
  })
})
