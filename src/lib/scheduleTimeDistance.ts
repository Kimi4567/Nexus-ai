type ScheduleLocale = 'ar' | 'en' | string

function arabicUnit(value: number, unit: 'day' | 'hour' | 'minute'): string {
  const number = new Intl.NumberFormat('ar-EG').format(value)
  const forms = {
    day: { one: 'يوم واحد', two: 'يومان', few: 'أيام', many: 'يومًا' },
    hour: { one: 'ساعة واحدة', two: 'ساعتان', few: 'ساعات', many: 'ساعة' },
    minute: { one: 'دقيقة واحدة', two: 'دقيقتان', few: 'دقائق', many: 'دقيقة' },
  }[unit]
  if (value === 1) return forms.one
  if (value === 2) return forms.two
  if (value >= 3 && value <= 10) return `${number} ${forms.few}`
  return `${number} ${forms.many}`
}

function durationLabel(milliseconds: number, locale: ScheduleLocale): string {
  const totalMinutes = Math.max(1, Math.floor(milliseconds / 60_000))
  const days = Math.floor(totalMinutes / 1_440)
  const hours = Math.floor((totalMinutes % 1_440) / 60)
  const minutes = totalMinutes % 60

  if (locale === 'ar') {
    if (days > 0) {
      return hours > 0
        ? `${arabicUnit(days, 'day')} و${arabicUnit(hours, 'hour')}`
        : arabicUnit(days, 'day')
    }
    if (hours > 0) {
      return minutes > 0
        ? `${arabicUnit(hours, 'hour')} و${arabicUnit(minutes, 'minute')}`
        : arabicUnit(hours, 'hour')
    }
    return arabicUnit(minutes, 'minute')
  }

  if (days > 0) return `${days}d${hours > 0 ? ` ${hours}h` : ''}`
  if (hours > 0) return `${hours}h${minutes > 0 ? ` ${minutes}m` : ''}`
  return `${minutes}m`
}

/** Formats an exact saved schedule relative to a supplied clock without hiding overdue state. */
export function formatScheduledTimeDistance(
  iso: string,
  locale: ScheduleLocale,
  nowMs = Date.now(),
): string {
  const scheduledMs = new Date(iso).getTime()
  if (!Number.isFinite(scheduledMs)) return locale === 'ar' ? 'وقت غير صالح' : 'Invalid time'

  const difference = scheduledMs - nowMs
  if (Math.abs(difference) < 60_000) return locale === 'ar' ? 'الآن' : 'now'

  const duration = durationLabel(Math.abs(difference), locale)
  if (difference > 0) return locale === 'ar' ? `بعد ${duration}` : `in ${duration}`
  return locale === 'ar' ? `متأخر منذ ${duration}` : `${duration} overdue`
}
