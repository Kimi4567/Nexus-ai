'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

interface NavBarProps {
  /** Override the default nav links (useful for campaign wizard pages) */
  minimal?: boolean
}

export default function NavBar({ minimal = false }: NavBarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, isAuthenticated } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)

  const displayName = user?.user_metadata?.name || user?.email?.split('@')[0] || 'Account'
  const initial = displayName.charAt(0).toUpperCase()

  const navLinks = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/campaign/new', label: 'New Campaign' },
    { href: '/media', label: 'Media' },
    { href: '/billing', label: 'Billing' },
    { href: '/settings', label: 'Settings' },
  ]

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <nav className="border-b border-dark-tertiary bg-dark/50 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">

        {/* Logo */}
        <Link href="/dashboard">
          <span className="text-2xl font-bold text-accent">NEXUS</span>
        </Link>

        {/* Desktop Links */}
        {!minimal && isAuthenticated && (
          <div className="hidden md:flex gap-6 text-sm">
            {navLinks.map(link => (
              <Link
                key={link.href}
                href={link.href}
                className={`transition ${
                  pathname === link.href
                    ? 'text-accent font-semibold'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>
        )}

        {/* Right side */}
        <div className="flex items-center gap-3">
          {minimal && (
            <Link href="/dashboard" className="text-sm text-gray-400 hover:text-white transition">
              ← Dashboard
            </Link>
          )}

          {isAuthenticated && (
            <div className="relative">
              <button
                onClick={() => setMenuOpen(o => !o)}
                className="w-9 h-9 rounded-full bg-accent/20 border border-accent/40 flex items-center justify-center text-accent font-bold text-sm hover:bg-accent/30 transition"
              >
                {initial}
              </button>

              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 top-12 w-56 bg-dark-secondary border border-dark-tertiary rounded-xl shadow-2xl z-20 overflow-hidden">
                    <div className="px-4 py-3 border-b border-dark-tertiary">
                      <div className="font-semibold text-sm truncate">{displayName}</div>
                      <div className="text-xs text-gray-500 truncate">{user?.email}</div>
                    </div>
                    <div className="py-1">
                      {navLinks.map(link => (
                        <Link
                          key={link.href}
                          href={link.href}
                          onClick={() => setMenuOpen(false)}
                          className={`block px-4 py-2 text-sm transition hover:bg-dark ${
                            pathname === link.href ? 'text-accent' : 'text-gray-300'
                          }`}
                        >
                          {link.label}
                        </Link>
                      ))}
                    </div>
                    <div className="border-t border-dark-tertiary py-1">
                      <button
                        onClick={handleSignOut}
                        className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-dark transition"
                      >
                        Sign Out
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}
