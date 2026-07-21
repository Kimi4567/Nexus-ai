import { describe, expect, it } from 'vitest'
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
})
