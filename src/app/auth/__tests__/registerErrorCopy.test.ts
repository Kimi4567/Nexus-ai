import { describe, expect, it } from 'vitest'
import { getRegisterErrorCopy } from '../register/registerErrors'

describe('register error copy', () => {
  it('maps duplicate email errors', () => {
    expect(getRegisterErrorCopy(new Error('User already registered'))).toBe(
      'An account with this email may already exist. Try logging in instead.',
    )
  })

  it('maps invalid email errors', () => {
    expect(getRegisterErrorCopy(new Error('Invalid email address'))).toBe(
      'Enter a valid email address.',
    )
  })

  it('maps disabled signup errors', () => {
    expect(getRegisterErrorCopy(new Error('Signup is disabled'))).toBe(
      'Account creation is currently unavailable. Please contact support.',
    )
  })

  it('maps rate limit errors', () => {
    expect(getRegisterErrorCopy(new Error('Too many signup attempts'))).toBe(
      'Too many signup attempts. Please wait a few minutes and try again.',
    )
  })

  it('maps email delivery provider errors', () => {
    expect(getRegisterErrorCopy(new Error('SMTP provider could not send email'))).toBe(
      'We could not send the verification email. Please try again in a few minutes.',
    )
  })

  it('maps database errors while saving a new user', () => {
    expect(getRegisterErrorCopy(new Error('Database error saving new user'))).toBe(
      'We could not finish creating your account. Please contact support if this continues.',
    )
  })

  it('maps redirect URL configuration errors', () => {
    expect(getRegisterErrorCopy(new Error('Redirect URL is not allowed'))).toBe(
      'Signup configuration needs attention. Please contact support.',
    )
  })

  it('maps weak password errors', () => {
    expect(getRegisterErrorCopy(new Error('Weak password'))).toBe('Use a stronger password.')
  })

  it('keeps an actionable unknown fallback', () => {
    expect(getRegisterErrorCopy(new Error('Unexpected auth service failure'))).toBe(
      'We could not create the account. Please try again or contact support.',
    )
  })
})
