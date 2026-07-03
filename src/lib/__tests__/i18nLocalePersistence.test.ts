import { describe, expect, it } from 'vitest'
import { isSupportedLocale, readStoredLocale, writeStoredLocale } from '@/lib/i18n-context'

describe('i18n locale persistence', () => {
  it('recognizes only supported runtime locales', () => {
    expect(isSupportedLocale('ar')).toBe(true)
    expect(isSupportedLocale('en')).toBe(true)
    expect(isSupportedLocale('fr')).toBe(false)
    expect(isSupportedLocale(null)).toBe(false)
  })

  it('reads the current and legacy locale keys', () => {
    const storage = new Map<string, string>()

    expect(readStoredLocale({ getItem: (key) => storage.get(key) ?? null })).toBeNull()

    storage.set('nexus_locale', 'en')
    expect(readStoredLocale({ getItem: (key) => storage.get(key) ?? null })).toBe('en')

    storage.set('nexus-lang', 'ar')
    expect(readStoredLocale({ getItem: (key) => storage.get(key) ?? null })).toBe('ar')
  })

  it('writes both locale keys without throwing when storage is available', () => {
    const writes: Record<string, string> = {}
    const ok = writeStoredLocale({ setItem: (key, value) => { writes[key] = value } }, 'ar')

    expect(ok).toBe(true)
    expect(writes).toEqual({ 'nexus-lang': 'ar', nexus_locale: 'ar' })
  })

  it('fails closed when browser storage is unavailable', () => {
    expect(writeStoredLocale(null, 'en')).toBe(false)
    expect(readStoredLocale({
      getItem: () => {
        throw new Error('storage blocked')
      },
    })).toBeNull()
    expect(writeStoredLocale({
      setItem: () => {
        throw new Error('storage blocked')
      },
    }, 'en')).toBe(false)
  })
})
