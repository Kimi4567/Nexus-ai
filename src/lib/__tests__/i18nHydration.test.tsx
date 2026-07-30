// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { I18nProvider, useI18n } from '@/lib/i18n-context'

function LocaleProbe() {
  const { locale, localeReady } = useI18n()
  return <span>{localeReady ? `ready:${locale}` : `loading:${locale}`}</span>
}

describe('I18nProvider browser locale hydration', () => {
  const storedValues = new Map<string, string>()

  beforeEach(() => {
    storedValues.clear()
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        clear: () => storedValues.clear(),
        getItem: (key: string) => storedValues.get(key) ?? null,
        key: (index: number) => Array.from(storedValues.keys())[index] ?? null,
        get length() { return storedValues.size },
        removeItem: (key: string) => storedValues.delete(key),
        setItem: (key: string, value: string) => storedValues.set(key, value),
      } satisfies Storage,
    })
  })

  afterEach(() => {
    cleanup()
    storedValues.clear()
  })

  it('does not mark the locale ready until the saved English preference is restored', async () => {
    window.localStorage.setItem('nexus-lang', 'en')

    render(
      <I18nProvider>
        <LocaleProbe />
      </I18nProvider>,
    )

    await waitFor(() => expect(screen.getByText('ready:en')).toBeTruthy())
  })

  it('marks the English default ready when no preference exists', async () => {
    render(
      <I18nProvider>
        <LocaleProbe />
      </I18nProvider>,
    )

    await waitFor(() => expect(screen.getByText('ready:en')).toBeTruthy())
  })

  it('renders the server-selected Arabic locale on the first paint', () => {
    render(
      <I18nProvider initialLocale="ar">
        <LocaleProbe />
      </I18nProvider>,
    )

    expect(screen.getByText('ready:ar')).toBeTruthy()
  })

  it('migrates a legacy localStorage preference into the locale cookie', async () => {
    window.localStorage.setItem('nexus-lang', 'ar')

    render(
      <I18nProvider initialLocale="en">
        <LocaleProbe />
      </I18nProvider>,
    )

    await waitFor(() => expect(screen.getByText('ready:ar')).toBeTruthy())
    expect(document.cookie).toContain('nexus-locale=ar')
  })
})
