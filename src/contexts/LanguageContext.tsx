'use client'

import { createContext, useState, useEffect, ReactNode } from 'react'

export type Lang = 'en' | 'ar'

interface LanguageContextType {
  lang: Lang
  setLang: (lang: Lang) => void
  dir: 'ltr' | 'rtl'
}

export const LanguageContext = createContext<LanguageContextType>({
  lang: 'en',
  setLang: () => {},
  dir: 'ltr',
})

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en')

  useEffect(() => {
    const saved = localStorage.getItem('nexus-lang') as Lang | null
    if (saved === 'en' || saved === 'ar') {
      setLangState(saved)
      document.documentElement.dir = saved === 'ar' ? 'rtl' : 'ltr'
      document.documentElement.lang = saved
    } else {
      document.documentElement.dir = 'ltr'
      document.documentElement.lang = 'en'
    }
  }, [])

  const setLang = (l: Lang) => {
    setLangState(l)
    localStorage.setItem('nexus-lang', l)
    document.documentElement.dir = l === 'ar' ? 'rtl' : 'ltr'
    document.documentElement.lang = l
  }

  return (
    <LanguageContext.Provider value={{ lang, setLang, dir: lang === 'ar' ? 'rtl' : 'ltr' }}>
      {children}
    </LanguageContext.Provider>
  )
}
