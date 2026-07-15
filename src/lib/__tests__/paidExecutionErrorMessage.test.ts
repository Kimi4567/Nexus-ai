import { describe, expect, it } from 'vitest'
import { paidExecutionErrorMessage } from '@/lib/paidExecutionErrorMessage'

describe('paid execution error messages', () => {
  it('turns server codes into ordinary-user guidance', () => {
    expect(paidExecutionErrorMessage('PAID_OR_FULL_STRATEGY_REQUIRED', 'en', 'Fallback'))
      .toContain('Organic only')
    expect(paidExecutionErrorMessage('PAID_AD_ACCOUNT_REQUIRED', 'ar', 'Fallback'))
      .toContain('حساباً إعلانياً')
    expect(paidExecutionErrorMessage('PAID_STRATEGY_REVISION_CHANGED', 'en', 'Fallback'))
      .toContain('newer revision')
    expect(paidExecutionErrorMessage('PAID_STRATEGY_SNAPSHOT_REQUIRED', 'ar', 'Fallback'))
      .toContain('إصدار استراتيجية')
    expect(paidExecutionErrorMessage('PAID_BUDGET_APPROVAL_REQUIRED', 'en', 'Fallback'))
      .toContain('recorded approval')
  })

  it('never exposes unknown internal codes', () => {
    expect(paidExecutionErrorMessage('INTERNAL_UNKNOWN_CODE', 'en', 'Please try again.'))
      .toBe('Please try again.')
  })
})
