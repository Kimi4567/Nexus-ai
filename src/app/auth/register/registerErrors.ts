type RegisterErrorMetadata = {
  message: string
  status?: string | number
  code?: string
  name?: string
}

export type RegisterErrorLocale = 'en' | 'ar'

export type RegisterErrorReason =
  | 'duplicate'
  | 'invalidEmail'
  | 'signupDisabled'
  | 'emailDelivery'
  | 'rateLimit'
  | 'redirectConfig'
  | 'database'
  | 'weakPassword'
  | 'fallback'

const REGISTER_ERROR_COPY: Record<RegisterErrorLocale, Record<RegisterErrorReason, string>> = {
  en: {
    duplicate: 'An account with this email may already exist. Try logging in instead.',
    invalidEmail: 'Use a real, deliverable email address. Reserved or test-only domains may be rejected by the email provider.',
    signupDisabled: 'Account creation is currently unavailable. Please contact support.',
    emailDelivery: 'We could not send the verification email. Please try again in a few minutes.',
    rateLimit: 'Too many signup attempts. Please wait a few minutes and try again.',
    redirectConfig: 'Signup configuration needs attention. Please contact support.',
    database: 'We could not finish creating your account. Please contact support if this continues.',
    weakPassword: 'Use a stronger password.',
    fallback: 'We could not create the account. Please try again or contact support.',
  },
  ar: {
    duplicate: 'قد يكون هناك حساب بهذا البريد. جرّب تسجيل الدخول.',
    invalidEmail: 'استخدم بريدًا حقيقيًا يمكنه استقبال الرسائل؛ قد يرفض مزود البريد النطاقات المحجوزة أو المخصصة للاختبار.',
    signupDisabled: 'إنشاء الحسابات غير متاح حاليًا. تواصل مع الدعم.',
    emailDelivery: 'لم نتمكن من إرسال رسالة التحقق. حاول مرة أخرى بعد دقائق.',
    rateLimit: 'محاولات التسجيل كثيرة جدًا. انتظر بضع دقائق ثم حاول مرة أخرى.',
    redirectConfig: 'إعدادات التسجيل تحتاج مراجعة. تواصل مع الدعم.',
    database: 'لم نتمكن من إكمال إنشاء حسابك. تواصل مع الدعم إذا استمرت المشكلة.',
    weakPassword: 'استخدم كلمة مرور أقوى.',
    fallback: 'لم نتمكن من إنشاء الحساب. حاول مرة أخرى أو تواصل مع الدعم.',
  },
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

export function getRegisterErrorReason(err: unknown): RegisterErrorReason {
  const metadata = getRegisterErrorMetadata(err)
  const haystack = `${metadata.message} ${metadata.code ?? ''} ${metadata.name ?? ''}`.toLowerCase()

  if (
    haystack.includes('already registered') ||
    haystack.includes('already exists') ||
    haystack.includes('user exists') ||
    haystack.includes('user_already_exists') ||
    haystack.includes('email_exists')
  ) {
    return 'duplicate'
  }

  if (haystack.includes('invalid email') || haystack.includes('email address is invalid')) {
    return 'invalidEmail'
  }

  if (
    (haystack.includes('signup') && haystack.includes('disabled')) ||
    haystack.includes('signups not allowed') ||
    haystack.includes('signup_disabled')
  ) {
    return 'signupDisabled'
  }

  if (
    haystack.includes('rate limit') ||
    haystack.includes('too many') ||
    haystack.includes('over_email_send_rate_limit') ||
    haystack.includes('over_request_rate_limit')
  ) {
    return 'rateLimit'
  }

  if (
    haystack.includes('smtp') ||
    haystack.includes('email provider') ||
    haystack.includes('email delivery') ||
    haystack.includes('error sending') ||
    haystack.includes('send email') ||
    haystack.includes('email not sent')
  ) {
    return 'emailDelivery'
  }

  if (
    haystack.includes('redirect') ||
    haystack.includes('redirect_to') ||
    haystack.includes('emailredirectto') ||
    haystack.includes('not allowed url')
  ) {
    return 'redirectConfig'
  }

  if (
    haystack.includes('database error') ||
    haystack.includes('saving new user') ||
    haystack.includes('db_error') ||
    haystack.includes('unexpected_failure')
  ) {
    return 'database'
  }

  if (
    haystack.includes('weak password') ||
    haystack.includes('password should') ||
    haystack.includes('password_strength') ||
    haystack.includes('weak_password')
  ) {
    return 'weakPassword'
  }

  return 'fallback'
}

export function getRegisterErrorCopy(err: unknown, locale: RegisterErrorLocale = 'en'): string {
  return REGISTER_ERROR_COPY[locale][getRegisterErrorReason(err)]
}
