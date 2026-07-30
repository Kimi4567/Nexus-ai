import { describe, expect, it } from 'vitest'
import { guardStrategyKpis } from '../strategyKpiGuard'
import { guardStrategyTruthContract } from '../strategyTruthContractGuard'

describe('guardStrategyTruthContract', () => {
  it('re-deduplicates directions after proof rewrites and rebuilds the weekly plan from them', () => {
    const guarded = guardStrategyTruthContract({
      contentAnglesDetailed: [
        { title: 'ثقة في جودة المنتج', hook: 'جودة يمكنك الوثوق بها', format: 'منشور', platform: 'Instagram' },
        { title: 'تفاصيل المنتج المطلوبة لتقييم الجودة', hook: 'تفاصيل المنتج التي يلزم مراجعتها قبل تقييم الجودة', format: 'منشور', platform: 'Instagram' },
        { title: 'تجربة شراء مميزة', hook: 'تجربة شراء لا تنسى', format: 'منشور', platform: 'Instagram' },
        { title: 'خطوات شراء يلزم توثيقها ومراجعتها', hook: 'راجعي خطوات الشراء المتاحة', format: 'منشور', platform: 'Instagram' },
      ],
      weeklyExecutionPlan: [{
        week: 1,
        deliverables: [
          '1 منشور: ثقة في جودة المنتج',
          '1 منشور: تفاصيل المنتج المطلوبة لتقييم الجودة',
          '1 منشور: تجربة شراء مميزة',
          '1 منشور: خطوات شراء يلزم توثيقها ومراجعتها',
        ],
      }],
    }, {
      verifiedProof: [],
      commercialClaimText: [],
      allowedClaimText: ['ثقة في جودة المنتج', 'تجربة شراء مميزة'],
    }, {
      allowedPlatforms: ['Instagram'],
      language: 'ar',
      strategyType: 'organic',
      organicPostCount: 4,
    })

    const titles = guarded.contentAnglesDetailed.map((item: any) => item.title)
    expect(titles).toHaveLength(4)
    expect(new Set(titles).size).toBe(4)

    const weeklyText = guarded.weeklyExecutionPlan
      .flatMap((week: any) => week.deliverables)
      .join(' ')
    expect(weeklyText).not.toMatch(/ثقة في جودة المنتج|تجربة شراء مميزة/)
    expect(guarded.weeklyExecutionPlan.flatMap((week: any) => week.deliverables)).toHaveLength(4)
    for (const title of titles) expect(weeklyText).toContain(title)
  })

  it('restores the exact reviewed business goal after scrubbing invented KPI figures', () => {
    const reviewedGoal = 'حجز 30 تجربة Demo مؤهلة خلال 90 يومًا وتحويل 20% منها إلى اشتراك مدفوع'
    const kpiGuarded = guardStrategyKpis({
      businessObjective: {
        primary: 'Increase qualified demo bookings',
        marketing: 'Increase conversions by 80%',
        successIn30Days: 'Increase leads by 60%',
      },
      kpis: [{
        metric: 'Demo bookings',
        target: 'Increase by 75%',
        timeframe: '30 days',
      }],
    }, [], { language: 'ar' })

    const guarded = guardStrategyTruthContract(kpiGuarded, {
      verifiedProof: [],
      commercialClaimText: [],
      allowedClaimText: [],
    }, {
      language: 'ar',
      strategyType: 'organic',
      goal: reviewedGoal,
    })

    expect(guarded.businessObjective.primary).toBe(reviewedGoal)
    expect(JSON.stringify(guarded.kpis)).not.toMatch(/75\s*%/)
    expect(guarded.businessObjective.successIn30Days).not.toMatch(/60\s*%/)
  })
})
