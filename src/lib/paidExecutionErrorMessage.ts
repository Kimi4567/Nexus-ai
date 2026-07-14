const MESSAGES: Record<string, { en: string; ar: string }> = {
  PAID_STRATEGY_REQUIRED: {
    en: 'Choose an approved Paid or Full strategy before starting paid execution.',
    ar: 'اختر استراتيجية Paid أو Full معتمدة قبل بدء التنفيذ المدفوع.',
  },
  PAID_STRATEGY_NOT_FOUND: {
    en: 'The selected strategy is unavailable in this workspace.',
    ar: 'الاستراتيجية المحددة غير متاحة داخل مساحة العمل.',
  },
  PAID_OR_FULL_STRATEGY_REQUIRED: {
    en: 'This strategy is Organic only. Create or choose a Paid or Full strategy.',
    ar: 'هذه الاستراتيجية Organic فقط. أنشئ أو اختر استراتيجية Paid أو Full.',
  },
  PAID_STRATEGY_APPROVAL_REQUIRED: {
    en: 'Review and approve the Paid or Full strategy before platform execution.',
    ar: 'راجع واعتمد استراتيجية Paid أو Full قبل تنفيذها على المنصة.',
  },
  PAID_STRATEGY_QUALITY_REVIEW_REQUIRED: {
    en: 'Complete the Strategy quality review and resolve its findings before paid execution.',
    ar: 'أكمل مراجعة جودة الاستراتيجية وعالج ملاحظاتها قبل التنفيذ المدفوع.',
  },
  PAID_OBJECTIVE_STRATEGY_MISMATCH: {
    en: 'The platform objective must match the approved strategy objective.',
    ar: 'يجب أن يطابق هدف المنصة الهدف المعتمد في الاستراتيجية.',
  },
  PAID_PLATFORM_OBJECTIVE_UNSUPPORTED: {
    en: 'This platform path cannot execute the approved objective. Choose a compatible platform without changing the strategy.',
    ar: 'مسار المنصة هذا لا ينفذ الهدف المعتمد. اختر منصة متوافقة بدون تغيير الاستراتيجية.',
  },
  PAID_NO_COMPATIBLE_ACCOUNT: {
    en: 'No connected account supports this approved objective in the current execution paths.',
    ar: 'لا يوجد حساب متصل يدعم الهدف المعتمد ضمن مسارات التنفيذ الحالية.',
  },
  PAID_BRAND_BRIEF_INCOMPLETE: {
    en: 'Complete the paid fields in Brand Brain before generating paid execution.',
    ar: 'أكمل حقول التسويق المدفوع في Brand Brain قبل إنشاء التنفيذ المدفوع.',
  },
  PAID_DRAFT_NOT_EDITABLE: {
    en: 'This execution is no longer a local draft. Create a reviewed revision instead of overwriting platform-linked work.',
    ar: 'هذا التنفيذ لم يعد مسودة محلية. أنشئ إصداراً جديداً للمراجعة بدلاً من تعديل عمل مرتبط بالمنصة.',
  },
  PAID_AD_ACCOUNT_REQUIRED: {
    en: 'Connect and select an active ad account before platform execution.',
    ar: 'اربط وحدد حساباً إعلانياً نشطاً قبل تنفيذ الحملة على المنصة.',
  },
  PAID_AD_ACCOUNT_NOT_ACTIVE: {
    en: 'The selected ad account is not active. Reconnect or choose another account.',
    ar: 'الحساب الإعلاني المحدد غير نشط. أعد الربط أو اختر حساباً آخر.',
  },
  AD_ACCOUNT_CURRENCY_MISMATCH: {
    en: 'Use the connected ad account currency for this execution draft.',
    ar: 'استخدم عملة الحساب الإعلاني المتصل داخل مسودة التنفيذ.',
  },
  PAID_BUDGET_REQUIRED: {
    en: 'Enter a positive planning budget before continuing.',
    ar: 'أدخل ميزانية تخطيطية موجبة قبل المتابعة.',
  },
  PAID_SCHEDULE_REQUIRED: {
    en: 'Enter valid start and end dates; the end must be after the start.',
    ar: 'أدخل تاريخ بدء وانتهاء صحيحين؛ يجب أن يكون الانتهاء بعد البدء.',
  },
  BRAND_BRAIN_REQUIRED: {
    en: 'Complete Brand Brain before creating paid execution.',
    ar: 'أكمل Brand Brain قبل إنشاء التنفيذ المدفوع.',
  },
  AI_EXECUTION_PLATFORM_NOT_CONNECTED: {
    en: 'The suggested platform is not connected. Review Connections and try again.',
    ar: 'المنصة المقترحة غير متصلة. راجع التكاملات وحاول مرة أخرى.',
  },
  AI_EXECUTION_SUGGESTION_INCOMPLETE: {
    en: 'The execution suggestion was incomplete. Nothing was saved; try again.',
    ar: 'اقتراح التنفيذ غير مكتمل. لم يتم حفظ شيء؛ حاول مرة أخرى.',
  },
}

export function paidExecutionErrorMessage(
  code: unknown,
  locale: 'ar' | 'en',
  fallback: string,
): string {
  if (typeof code !== 'string') return fallback
  return MESSAGES[code]?.[locale] ?? (code.includes('_') ? fallback : code)
}
