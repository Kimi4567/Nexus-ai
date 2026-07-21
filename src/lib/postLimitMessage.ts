interface PostLimitMessageInput {
  locale: string
  limit: number
  current: number
  requested: number
  resetsAt?: string | null
}

function formatResetDate(locale: string, resetsAt?: string | null): string | null {
  if (!resetsAt) return null
  const date = new Date(resetsAt)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG' : 'en-US', {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(date)
}

export function postLimitReachedMessage(input: PostLimitMessageInput): string {
  const resetDate = formatResetDate(input.locale, input.resetsAt)
  if (input.locale === 'ar') {
    return [
      `حد الخطة الشهري ${input.limit} مسودة: استُخدم ${input.current}، وهذه الخطة تحتاج ${input.requested}.`,
      resetDate ? `يتجدد الحد في ${resetDate}.` : 'راجع موعد تجدد الحد في صفحة الباقة.',
      'لم يُخصم أي كريديت، ويمكنك الانتظار حتى التجدد من دون ترقية.',
    ].join(' ')
  }
  return [
    `Your monthly plan limit is ${input.limit} drafts: ${input.current} are used and this plan needs ${input.requested}.`,
    resetDate ? `The allowance resets on ${resetDate}.` : 'Review the allowance reset date on the billing page.',
    'No credits were charged, and you can wait for the reset without upgrading.',
  ].join(' ')
}
