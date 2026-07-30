export type Locale = 'ar' | 'en'

export const LOCALE_COOKIE_NAME = 'nexus-locale'

export function isSupportedLocale(value: unknown): value is Locale {
  return value === 'ar' || value === 'en'
}
