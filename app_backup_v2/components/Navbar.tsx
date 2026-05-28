'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '../hooks/useAuth'
import { Menu, X, Sparkles } from 'lucide-react'

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const { isAuth, logout } = useAuth()
  const router = useRouter()

  const navLinks = [
    { label: 'الرئيسية', href: '/' },
    { label: 'الأسعار', href: '/#pricing' },
    { label: 'الأسئلة', href: '/#faq' },
  ]

  const handleLogout = () => {
    logout()
    router.push('/')
  }

  return (
    <nav className="fixed top-0 right-0 left-0 z-50 glass" style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
      <div className="container-nexus flex items-center justify-between py-4 px-4">
        <Link href="/" className="flex items-center gap-2 text-xl font-bold gradient-text">
          <Sparkles className="w-6 h-6 text-amber" />
          NEXUS AI
        </Link>

        <div className="nav-desktop hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href} className="text-text-secondary hover:text-text-primary transition-colors text-sm font-medium">
              {link.label}
            </Link>
          ))}
        </div>

        <div className="nav-desktop hidden md:flex items-center gap-3">
          {isAuth ? (
            <>
              <Link href="/dashboard" className="btn-primary text-sm py-2 px-4">
                لوحة التحكم
              </Link>
              <button onClick={handleLogout} className="btn-secondary text-sm py-2 px-4">
                خروج
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="text-text-secondary hover:text-text-primary transition-colors text-sm font-medium">
                دخول
              </Link>
              <Link href="/register" className="btn-primary text-sm py-2 px-4">
                ابدأ الآن
              </Link>
            </>
          )}
        </div>

        <button className="nav-mobile-btn md:hidden" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="md:hidden px-4 pb-4 space-y-3">
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href} className="block text-text-secondary hover:text-text-primary py-2" onClick={() => setMobileOpen(false)}>
              {link.label}
            </Link>
          ))}
          {isAuth ? (
            <>
              <Link href="/dashboard" className="block btn-primary text-center text-sm py-2" onClick={() => setMobileOpen(false)}>
                لوحة التحكم
              </Link>
              <button onClick={() => { handleLogout(); setMobileOpen(false) }} className="block w-full btn-secondary text-sm py-2">
                خروج
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="block text-text-secondary hover:text-text-primary py-2" onClick={() => setMobileOpen(false)}>
                دخول
              </Link>
              <Link href="/register" className="block btn-primary text-center text-sm py-2" onClick={() => setMobileOpen(false)}>
                ابدأ الآن
              </Link>
            </>
          )}
        </div>
      )}
    </nav>
  )
}
