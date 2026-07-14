import { describe, expect, it } from 'vitest'
import { paidExecutionErrorMessage } from '@/lib/paidExecutionErrorMessage'

describe('paid execution error messages', () => {
  it('turns server codes into ordinary-user guidance', () => {
    expect(paidExecutionErrorMessage('PAID_OR_FULL_STRATEGY_REQUIRED', 'en', 'Fallback'))
      .toContain('Organic only')
    expect(paidExecutionErrorMessage('PAID_AD_ACCOUNT_REQUIRED', 'ar', 'Fallback'))
      .toContain('حساباً إعلانياً')
  })

  it('never exposes unknown internal codes', () => {
    expect(paidExecutionErrorMessage('INTERNAL_UNKNOWN_CODE', 'en', 'Please try again.'))
      .toBe('Please try again.')
  })
})
