type StrategyApprovalFailurePayload = {
  error?: unknown
  code?: unknown
  message?: unknown
}

export function strategyApprovalFailureMessage(
  data: StrategyApprovalFailurePayload,
  locale: string,
): string {
  const code = typeof data.code === 'string'
    ? data.code
    : typeof data.error === 'string'
      ? data.error
      : ''
  if (locale === 'ar') {
    if (code === 'STRATEGY_REVIEW_STALE') {
      return 'تغيّرت مراجعة الاستراتيجية منذ فتح الصفحة. حدّث الصفحة وراجع النسخة الحالية قبل الاعتماد.'
    }
    if (code === 'STRATEGY_APPROVAL_CONCURRENT_CHANGE') {
      return 'تغيّرت الاستراتيجية أثناء الاعتماد. حدّث الصفحة ثم راجع النسخة الحالية.'
    }
    if (code === 'STRATEGY_APPROVAL_BLOCKED') {
      return 'لا يمكن اعتماد الاستراتيجية حتى تُحل متطلبات الجودة والجاهزية الظاهرة في الصفحة.'
    }
    if (code === 'MARKETING_QUALITY_GATE_BLOCKED') {
      return 'الاستراتيجية معتمدة، لكن مراجعة Brand Brain ونطاق القنوات أوقفت إنشاء المحتوى قبل الخصم. راجع المتطلبات الظاهرة ثم أعد المحاولة.'
    }
    if (code === 'AI_PROVIDER_UNAVAILABLE') {
      return 'تم حفظ اعتماد الاستراتيجية، لكن مزود الذكاء غير متاح الآن. لم يبدأ إنشاء المحتوى ولم يُخصم كريديت.'
    }
    if (code === 'CONTENT_HANDOFF_FAILED') {
      return 'تم حفظ اعتماد الاستراتيجية، لكن تسليم مهمة المحتوى يحتاج إعادة محاولة آمنة.'
    }
    if (code === 'CREDIT_PRICE_CHANGED') {
      return 'تغيّرت تكلفة خطة المحتوى. راجع السعر الحالي قبل الموافقة من جديد.'
    }
    return typeof data.message === 'string'
      && /[\u0600-\u06FF]/.test(data.message)
      ? data.message
      : code || 'فشل الاعتماد، حاول مرة أخرى'
  }
  return typeof data.message === 'string'
    ? data.message
    : code || 'Approval failed, please try again'
}
