import { describe, expect, it } from 'vitest'
import {
  strategyIntensityHelperCopy,
  strategyIntensitySecondaryLabel,
  strategyIntensitySectionLabel,
  tierToPostsPerMonth,
} from '../strategyOrderDisplay'

describe('strategyOrderDisplay', () => {
  it('keeps paid-only planning depth copy separate from organic post counts', () => {
    expect(strategyIntensitySectionLabel('paid', 'ar')).toBe('عمق التخطيط')
    expect(strategyIntensitySectionLabel('paid', 'en')).toBe('Planning depth')

    expect(strategyIntensitySecondaryLabel('standard', 'paid', 'ar')).toBe('متوازن')
    expect(strategyIntensitySecondaryLabel('standard', 'paid', 'en')).toBe('Balanced')

    expect(strategyIntensityHelperCopy('paid', 'ar')).toContain('بريف التخطيط المدفوع')
    expect(strategyIntensityHelperCopy('paid', 'ar')).not.toMatch(/منشورات عضوية لأول 30 يوم/)
    expect(strategyIntensityHelperCopy('paid', 'en')).toContain('paid planning brief depth')
    expect(strategyIntensityHelperCopy('paid', 'en')).not.toMatch(/Organic post directions/)
  })

  it('keeps organic/full copy tied to organic post-direction scope', () => {
    expect(strategyIntensitySectionLabel('organic', 'ar')).toBe('كثافة المحتوى')
    expect(strategyIntensitySectionLabel('full', 'en')).toBe('Content intensity')

    expect(strategyIntensitySecondaryLabel('standard', 'organic', 'ar')).toBe('12–16')
    expect(strategyIntensitySecondaryLabel('growth', 'full', 'en')).toBe('20–25')

    expect(strategyIntensityHelperCopy('organic', 'ar')).toContain('اتجاهات منشورات عضوية')
    expect(strategyIntensityHelperCopy('full', 'en')).toContain('Organic post directions')
  })

  it('keeps the free strategy quota compatible with a four-week execution outline', () => {
    expect(tierToPostsPerMonth('free')).toBe(3)
  })
})
