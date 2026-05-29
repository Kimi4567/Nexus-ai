'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useI18n } from '@/lib/i18n-context'
import LanguageSwitcher from '@/components/ui/LanguageSwitcher'

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const { t, isRTL } = useI18n()

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 50)
    window.addEventListener('scroll', h)
    return () => window.removeEventListener('scroll', h)
  }, [])

  const scrollTo = (id: string) => {
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: 'smooth' })
    setMenuOpen(false)
  }

  const navItems = [
    { label: t('agents.sectionLabel') as string, id: 'crew' },
    { label: t('howItWorks.sectionLabel') as string, id: 'how' },
    { label: t('nav.pricing') as string, id: 'pricing' },
    { label: t('nav.faq') as string, id: 'faq' },
    { label: 'كيف نسوق أنفسنا', href: '/marketing' },
  ]

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 px-4 py-4 transition-all duration-300 ${
        scrolled ? 'bg-[rgba(2,2,4,0.85)] backdrop-blur-xl border-b border-white/[0.08]' : ''
      }`}
    >
      <div className="max-w-[1200px] mx-auto flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 no-underline shrink-0">
          <div className="w-9 h-9 border-2 border-amber-500 rounded-lg grid place-items-center font-black text-amber-500 text-lg">
            N
          </div>
          <span className="text-xl md:text-2xl font-extrabold tracking-wider bg-gradient-to-br from-amber-400 via-cyan-400 to-violet-500 bg-clip-text text-transparent whitespace-nowrap">
            NEXUS AI
          </span>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => item.id && scrollTo(item.id)}
              className="text-[#94a3b8] hover:text-[#f8fafc] text-sm font-medium transition-colors relative group bg-transparent border-none cursor-pointer px-3 py-2"
            >
              {item.label}
              <span className="absolute -bottom-0.5 right-3 left-3 h-0.5 bg-amber-500 transition-all duration-300 scale-x-0 group-hover:scale-x-100 origin-center rounded-full" />
            </button>
          ))}
          <div className="w-px h-5 bg-white/10 mx-1" />
          <LanguageSwitcher />
          <Link
            href="/auth/login"
            className={`px-5 py-2 bg-gradient-to-br from-amber-500 to-amber-700 text-black font-bold rounded-xl text-sm hover:-translate-y-0.5 transition-transform no-underline inline-block ${
              isRTL ? 'mr-2' : 'ml-2'
            }`}
          >
            {t('nav.login')}
          </Link>
        </div>

        {/* Mobile Menu Button */}
        <div className="md:hidden flex items-center gap-2">
          <LanguageSwitcher />
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="text-[#f8fafc] text-2xl bg-transparent border-none cursor-pointer p-2"
          >
            {menuOpen ? '✕' : '☰'}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {menuOpen && (
        <div className="md:hidden fixed top-16 left-4 right-4 bg-[#0a0a12] border border-white/[0.08] rounded-2xl p-4 flex flex-col gap-1 z-50 shadow-2xl">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => item.id && scrollTo(item.id)}
              className="text-[#f8fafc] py-3 px-4 rounded-lg hover:bg-white/5 transition-colors bg-transparent border-none cursor-pointer text-base"
              style={{ textAlign: isRTL ? 'right' : 'left' }}
            >
              {item.label}
            </button>
          ))}
          <div className="mt-2 pt-2 border-t border-white/[0.08]">
            <Link
              href="/auth/login"
              className="block w-full text-center px-5 py-3 bg-gradient-to-br from-amber-500 to-amber-700 text-black font-bold rounded-xl text-sm no-underline"
            >
              {t('nav.login')}
            </Link>
          </div>
        </div>
      )}
    </nav>
  )
}
