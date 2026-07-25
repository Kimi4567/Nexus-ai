export interface DashboardActivityPresentation {
  actionAr: string
  actionEn: string
  agent: string
}

const DEFAULT_ARABIC_ACTIVITY = 'تم تسجيل إجراء جديد على الحملة'
const DEFAULT_ENGLISH_ACTIVITY = 'New campaign activity'

const CAMPAIGN_ACTIVITY_LABELS: Record<string, DashboardActivityPresentation> = {
  created: { actionAr: 'تم إنشاء حملة جديدة', actionEn: 'New campaign created', agent: 'NEX' },
  generated: { actionAr: 'تم توليد محتوى بالذكاء الاصطناعي', actionEn: 'AI content generated', agent: 'NEX' },
  updated: { actionAr: 'تم تحديث الحملة', actionEn: 'Campaign updated', agent: 'VEX' },
  published: { actionAr: 'تم نشر الحملة', actionEn: 'Campaign published', agent: 'VEX' },
  analyzed: { actionAr: 'تم تحليل الأداء', actionEn: 'Performance analyzed', agent: 'PULSE' },
  scheduled: { actionAr: 'تم جدولة المحتوى', actionEn: 'Content scheduled', agent: 'PULSE' },
  monitored: { actionAr: 'تم رصد المنافسين', actionEn: 'Competitors monitored', agent: 'Sentinel' },
  viewed: { actionAr: 'تم فتح الحملة للمراجعة', actionEn: 'Campaign opened for review', agent: 'NEX' },
  regenerated: { actionAr: 'تم تحديث مسودة المحتوى', actionEn: 'Content draft refreshed', agent: 'NEX' },
  exported: { actionAr: 'تم تصدير حزمة الحملة', actionEn: 'Campaign package exported', agent: 'NEX' },
  duplicated: { actionAr: 'تم إنشاء نسخة من الحملة', actionEn: 'Campaign duplicated', agent: 'NEX' },
  archived: { actionAr: 'تمت أرشفة الحملة', actionEn: 'Campaign archived', agent: 'NEX' },
  favorited: { actionAr: 'تم تحديث حالة الحملة المفضلة', actionEn: 'Campaign favorite status updated', agent: 'NEX' },
  engine_run: { actionAr: 'أعدّ محرك NEXUS حزمة الحملة', actionEn: 'NEXUS Engine prepared the campaign package', agent: 'NEX' },
  calendar_pushed: { actionAr: 'تمت إضافة عناصر الحملة إلى التقويم', actionEn: 'Campaign items added to the calendar', agent: 'PULSE' },
  autopilot_enabled: { actionAr: 'تم تفعيل مراقبة التنفيذ التلقائي', actionEn: 'Autopilot execution monitoring enabled', agent: 'PULSE' },
  draft_variant_selected: { actionAr: 'تم اختيار مسودة النص المفضلة', actionEn: 'Preferred copy draft selected', agent: 'NEX' },
  strategy_approved: { actionAr: 'تم اعتماد اتجاه الاستراتيجية لتخطيط المحتوى', actionEn: 'Strategy direction approved for content planning', agent: 'NEX' },
  strategy_approval_revoked: { actionAr: 'أُعيد فتح الاستراتيجية للمراجعة', actionEn: 'Strategy reopened for review', agent: 'NEX' },
  content_media_approved: { actionAr: 'تم اعتماد الوسائط النهائية بشكل منفصل عن النص والجدولة', actionEn: 'Final media approved separately from copy and scheduling', agent: 'NEX' },
  paid_budget_approved: { actionAr: 'تم اعتماد الميزانية ومسودة المنصة المتوقفة', actionEn: 'Budget and paused platform draft approved', agent: 'NEX' },
  paid_launch_approved: { actionAr: 'تم اعتماد تنفيذ الحملة المدفوعة والإنفاق', actionEn: 'Paid delivery and spend approved', agent: 'NEX' },
}

export function getDashboardActivityPresentation(
  type: string,
  description?: string | null,
): DashboardActivityPresentation {
  const known = CAMPAIGN_ACTIVITY_LABELS[type]
  if (known) return known

  const cleanDescription = description?.trim()
  return {
    actionAr: DEFAULT_ARABIC_ACTIVITY,
    actionEn: cleanDescription || DEFAULT_ENGLISH_ACTIVITY,
    agent: 'NEX',
  }
}

function arabicRelativeUnit(
  value: number,
  singular: string,
  dual: string,
  plural: string,
): string {
  if (value === 1) return singular
  if (value === 2) return dual
  if (value >= 3 && value <= 10) return `${value} ${plural}`
  return `${value} ${singular}`
}

export function getDashboardRelativeTimeAr(
  date: Date,
  nowMs = Date.now(),
): string {
  const seconds = Math.max(0, Math.floor((nowMs - date.getTime()) / 1000))
  if (seconds < 60) return 'منذ لحظات'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) {
    return `منذ ${arabicRelativeUnit(minutes, 'دقيقة', 'دقيقتين', 'دقائق')}`
  }
  const hours = Math.floor(minutes / 60)
  if (hours < 24) {
    return `منذ ${arabicRelativeUnit(hours, 'ساعة', 'ساعتين', 'ساعات')}`
  }
  const days = Math.floor(hours / 24)
  return `منذ ${arabicRelativeUnit(days, 'يوم', 'يومين', 'أيام')}`
}
