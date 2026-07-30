import { describe, expect, it } from 'vitest'
import { strategyApprovalFailureMessage } from '@/lib/strategyApprovalFailureMessage'

describe('strategy approval failure copy', () => {
  it('does not leak an English content-gate message into the Arabic decision dialog', () => {
    expect(strategyApprovalFailureMessage({
      error: 'The approved strategy no longer passes the current Brand Brain review.',
      code: 'MARKETING_QUALITY_GATE_BLOCKED',
    }, 'ar')).toContain('أوقفت إنشاء المحتوى قبل الخصم')
  })

  it('keeps truthful approval and no-charge language when the provider is unavailable', () => {
    const message = strategyApprovalFailureMessage({
      code: 'AI_PROVIDER_UNAVAILABLE',
    }, 'ar')

    expect(message).toContain('تم حفظ اعتماد الاستراتيجية')
    expect(message).toContain('لم يُخصم كريديت')
  })

  it('preserves detailed English messages for English users', () => {
    expect(strategyApprovalFailureMessage({
      code: 'AI_PROVIDER_UNAVAILABLE',
      message: 'AI provider is temporarily unavailable.',
    }, 'en')).toBe('AI provider is temporarily unavailable.')
  })
})
