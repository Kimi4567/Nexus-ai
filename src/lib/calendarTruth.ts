export type CalendarTruthStatus = 'SCHEDULED' | 'PUBLISHED' | 'FAILED' | 'DRAFT' | 'APPROVED' | string | null | undefined

export interface CalendarTruthPost {
  status?: CalendarTruthStatus
  scheduledAt?: string | Date | null
  platform?: string | null
}

export interface CalendarMonthTruth {
  postsThisMonth: number
  scheduled: number
  published: number
  platforms: number
}

export const calendarTruthCopy = {
  subtitle: {
    en: 'Plan and schedule approved content across campaigns.',
    ar: 'خطط وجدول المحتوى المعتمد عبر الحملات.',
  },
  plannedTab: {
    en: 'Planned by strategy',
    ar: 'مخطط ضمن الاستراتيجية',
  },
  plannedHelper: {
    en: 'These are planning ideas, not scheduled posts.',
    ar: 'هذه أفكار تخطيطية وليست منشورات مجدولة.',
  },
  scheduledTab: {
    en: 'Scheduled posts',
    ar: 'المنشورات المجدولة',
  },
  scheduledEmpty: {
    en: 'No posts scheduled yet.',
    ar: 'لا توجد منشورات مجدولة بعد.',
  },
  noGeneratedPlan: {
    en: 'You have draft campaigns, but no generated content plan yet. Generate or review content before scheduling.',
    ar: 'لديك حملات مسودة، لكن لا توجد خطة محتوى مولدة بعد. أنشئ أو راجع المحتوى قبل الجدولة.',
  },
  legendPlanned: {
    en: 'Planned idea',
    ar: 'فكرة مخططة',
  },
  legendScheduled: {
    en: 'Scheduled post',
    ar: 'منشور مجدول',
  },
  legendPublished: {
    en: 'Published post',
    ar: 'منشور منشور',
  },
  dayHelper: {
    en: 'Click a day to review real scheduled or published posts. Strategy ideas are shown separately when available.',
    ar: 'اختر يومًا لمراجعة المنشورات المجدولة أو المنشورة فعليًا. تظهر أفكار الاستراتيجية بشكل منفصل عند توفرها.',
  },
  noGeneratedScheduled: {
    en: 'No generated posts are scheduled yet.',
    ar: 'لا توجد منشورات مولدة مجدولة بعد.',
  },
}

export function getCalendarTruthText(key: keyof typeof calendarTruthCopy, locale: string | null | undefined): string {
  return calendarTruthCopy[key][locale === 'ar' ? 'ar' : 'en']
}

export function isRealScheduledPost(post: CalendarTruthPost): boolean {
  return post.status === 'SCHEDULED' && Boolean(post.scheduledAt)
}

export function isRealPublishedPost(post: CalendarTruthPost): boolean {
  return post.status === 'PUBLISHED' && Boolean(post.scheduledAt)
}

export function isRealCalendarPost(post: CalendarTruthPost): boolean {
  return isRealScheduledPost(post) || isRealPublishedPost(post)
}

export function getCalendarMonthTruth(
  posts: CalendarTruthPost[],
  viewMonth: number,
  viewYear: number
): CalendarMonthTruth {
  const realRowsThisMonth = posts.filter(post => {
    if (!isRealCalendarPost(post)) return false
    const date = new Date(post.scheduledAt as any)
    if (Number.isNaN(date.getTime())) return false
    return date.getMonth() === viewMonth && date.getFullYear() === viewYear
  })

  return {
    postsThisMonth: realRowsThisMonth.length,
    scheduled: realRowsThisMonth.filter(isRealScheduledPost).length,
    published: realRowsThisMonth.filter(isRealPublishedPost).length,
    platforms: new Set(realRowsThisMonth.map(post => post.platform).filter(Boolean)).size,
  }
}
