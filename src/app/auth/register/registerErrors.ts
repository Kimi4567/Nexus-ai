type RegisterErrorMetadata = {
  message: string
  status?: string | number
  code?: string
  name?: string
}

const REGISTER_ERROR_COPY = {
  duplicate: 'An account with this email may already exist. Try logging in instead.',
  invalidEmail: 'Enter a valid email address.',
  signupDisabled: 'Account creation is currently unavailable. Please contact support.',
  emailDelivery: 'We could not send the verification email. Please try again in a few minutes.',
  rateLimit: 'Too many signup attempts. Please wait a few minutes and try again.',
  redirectConfig: 'Signup configuration needs attention. Please contact support.',
  database: 'We could not finish creating your account. Please contact support if this continues.',
  weakPassword: 'Use a stronger password.',
  fallback: 'We could not create the account. Please try again or contact support.',
} as const

export function getRegisterErrorMetadata(err: unknown): RegisterErrorMetadata {
  if (err instanceof Error) {
    const detail = err as Error & {
      status?: string | number
      code?: string
    }

    return {
      message: err.message,
      status: detail.status,
      code: detail.code,
      name: err.name,
    }
  }

  return {
    message: typeof err === 'string' ? err : '',
  }
}

export function getRegisterErrorCopy(err: unknown): string {
  const metadata = getRegisterErrorMetadata(err)
  const haystack = `${metadata.message} ${metadata.code ?? ''} ${metadata.name ?? ''}`.toLowerCase()

  if (
    haystack.includes('already registered') ||
    haystack.includes('already exists') ||
    haystack.includes('user exists') ||
    haystack.includes('user_already_exists') ||
    haystack.includes('email_exists')
  ) {
    return REGISTER_ERROR_COPY.duplicate
  }

  if (haystack.includes('invalid email') || haystack.includes('email address is invalid')) {
    return REGISTER_ERROR_COPY.invalidEmail
  }

  if (
    (haystack.includes('signup') && haystack.includes('disabled')) ||
    haystack.includes('signups not allowed') ||
    haystack.includes('signup_disabled')
  ) {
    return REGISTER_ERROR_COPY.signupDisabled
  }

  if (
    haystack.includes('rate limit') ||
    haystack.includes('too many') ||
    haystack.includes('over_email_send_rate_limit') ||
    haystack.includes('over_request_rate_limit')
  ) {
    return REGISTER_ERROR_COPY.rateLimit
  }

  if (
    haystack.includes('smtp') ||
    haystack.includes('email provider') ||
    haystack.includes('email delivery') ||
    haystack.includes('error sending') ||
    haystack.includes('send email') ||
    haystack.includes('email not sent')
  ) {
    return REGISTER_ERROR_COPY.emailDelivery
  }

  if (
    haystack.includes('redirect') ||
    haystack.includes('redirect_to') ||
    haystack.includes('emailredirectto') ||
    haystack.includes('not allowed url')
  ) {
    return REGISTER_ERROR_COPY.redirectConfig
  }

  if (
    haystack.includes('database error') ||
    haystack.includes('saving new user') ||
    haystack.includes('db_error') ||
    haystack.includes('unexpected_failure')
  ) {
    return REGISTER_ERROR_COPY.database
  }

  if (
    haystack.includes('weak password') ||
    haystack.includes('password should') ||
    haystack.includes('password_strength') ||
    haystack.includes('weak_password')
  ) {
    return REGISTER_ERROR_COPY.weakPassword
  }

  return REGISTER_ERROR_COPY.fallback
}
