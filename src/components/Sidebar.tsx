'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabaseClient'
import { useState } from 'react'

interface NavItem {
  href: string
  label: string
  icon: React.ReactNode
  badge?: string
}

function NexusLogo() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="28" height="28" rx="7" fill="#6366f1" />
      <path d="M7 7L14 21L21 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 7H21" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))

  return (
    <Link
      href={item.href}
      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 group relative ${
        isActive
          ? 'bg-white/10 text-white'
          : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
      }`}
    >
      <span className={`text-base flex-shrink-0 transition-colors ${isActive ? 'opacity-100' : 'opacity-60 group-hover:opacity-90'}`}>
        {item.icon}
      </span>
      <span className="flex-1 leading-none">{item.label}</span>
      {item.badge && (
        <span className="text-[10px] px-1.5 py-0.5 bg-accent/20 text-accent rounded font-semibold">
          {item.badge}
        </span>
      )}
      {isActive && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-accent rounded-r" />
      )}
    </Link>
  )
}

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, isAuthenticated } = useAuth()
  const [collapsed, setCollapsed] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  const displayName = user?.user_metadata?.name || user?.email?.split('@')[0] || 'Account'
  const email = user?.email || ''
  const initial = displayName.charAt(0).toUpperCase()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const mainNav: NavItem[] = [
    {
      href: '/dashboard',
      label: 'Dashboard',
      icon: (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <rect x="1" y="1" width="6" height="6" rx="1.5" />
          <rect x="9" y="1" width="6" height="6" rx="1.5" />
          <rect x="1" y="9" width="6" height="6" rx="1.5" />
          <rect x="9" y="9" width="6" height="6" rx="1.5" />
        </svg>
      ),
    },
    {
      href: '/campaigns',
      label: 'Campaigns',
      icon: (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M2 4h12M2 8h8M2 12h5" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      href: '/campaign/new',
      label: 'New Campaign',
      icon: (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="8" cy="8" r="6.5" />
          <path d="M8 5v6M5 8h6" strokeLinecap="round" />
        </svg>
      ),
    },
  ]

  const workNav: NavItem[] = [
    {
      href: '/brand',
      label: 'Brand Intelligence',
      icon: (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M8 1.5a6.5 6.5 0 100 13A6.5 6.5 0 008 1.5z" />
          <path d="M8 5v3l2 2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
      badge: 'New',
    },
    {
      href: '/media',
      label: 'Media Library',
      icon: (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="1.5" y="1.5" width="13" height="13" rx="2" />
          <circle cx="5.5" cy="5.5" r="1.5" />
          <path d="M1.5 10.5l3.5-3 3 3 2.5-2.5L14.5 11" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      href: '/templates',
      label: 'Templates',
      icon: (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="1.5" y="1.5" width="5" height="5" rx="1" />
          <rect x="9.5" y="1.5" width="5" height="5" rx="1" />
          <rect x="1.5" y="9.5" width="13" height="5" rx="1" />
        </svg>
      ),
    },
  ]

  const bottomNav: NavItem[] = [
    {
      href: '/billing',
      label: 'Billing & Plans',
      icon: (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="1.5" y="4" width="13" height="9" rx="1.5" />
          <path d="M1.5 7h13" strokeLinecap="round" />
          <path d="M4.5 10.5h3" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      href: '/settings',
      label: 'Settings',
      icon: (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="8" cy="8" r="2" />
          <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.1 3.1l1.4 1.4M11.5 11.5l1.4 1.4M3.1 12.9l1.4-1.4M11.5 4.5l1.4-1.4" strokeLinecap="round" />
        </svg>
      ),
    },
  ]

  if (!isAuthenticated) return null

  return (
    <aside className={`fixed left-0 top-0 h-full z-30 flex flex-col transition-all duration-200 ${collapsed ? 'w-16' : 'w-56'}`}
      style={{ background: '#111111', borderRight: '1px solid #1f1f1f' }}
    >
      {/* Logo */}
      <div className={`flex items-center gap-3 px-4 py-5 border-b border-white/5 flex-shrink-0 ${collapsed ? 'justify-center px-2' : ''}`}>
        <NexusLogo />
        {!collapsed && (
          <span className="font-bold text-white tracking-tight text-base">Nexus</span>
        )}
      </div>

      {/* Scrollable nav area */}
      <div className="flex-1 overflow-y-auto py-4 px-2 space-y-6">

        {/* Main nav */}
        <div className="space-y-0.5">
          {mainNav.map(item => (
            collapsed ? (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                className={`flex items-center justify-center w-full h-9 rounded-lg text-base transition ${
                  pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
                    ? 'bg-white/10 text-white'
                    : 'text-gray-500 hover:text-white hover:bg-white/5'
                }`}
              >
                {item.icon}
              </Link>
            ) : (
              <NavLink key={item.href} item={item} pathname={pathname} />
            )
          ))}
        </div>

        {/* Work section */}
        {!collapsed && (
          <div>
            <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-widest px-3 mb-2">Intelligence</p>
            <div className="space-y-0.5">
              {workNav.map(item => (
                <NavLink key={item.href} item={item} pathname={pathname} />
              ))}
            </div>
          </div>
        )}

        {collapsed && (
          <div className="space-y-0.5">
            {workNav.map(item => (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                className={`flex items-center justify-center w-full h-9 rounded-lg text-base transition ${
                  pathname.startsWith(item.href) ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-white hover:bg-white/5'
                }`}
              >
                {item.icon}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Bottom section */}
      <div className="flex-shrink-0 px-2 pb-4 space-y-0.5 border-t border-white/5 pt-3">
        {/* Upgrade pill (only when not on billing page) */}
        {!collapsed && pathname !== '/billing' && (
          <Link
            href="/billing"
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-accent/10 hover:bg-accent/20 transition mb-2 group"
          >
            <span className="text-accent text-base">⚡</span>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-accent">Go Pro</div>
              <div className="text-[10px] text-gray-500 truncate">Unlock all features</div>
            </div>
          </Link>
        )}

        {bottomNav.map(item => (
          collapsed ? (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              className={`flex items-center justify-center w-full h-9 rounded-lg text-base transition ${
                pathname === item.href ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-white hover:bg-white/5'
              }`}
            >
              {item.icon}
            </Link>
          ) : (
            <NavLink key={item.href} item={item} pathname={pathname} />
          )
        ))}

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(c => !c)}
          className="flex items-center justify-center w-full h-9 rounded-lg text-gray-600 hover:text-gray-300 hover:bg-white/5 transition mt-1"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <svg
            width="14" height="14"
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            className={`transition-transform duration-200 ${collapsed ? 'rotate-180' : ''}`}
          >
            <path d="M9 2L4 7l5 5" />
          </svg>
        </button>

        {/* User */}
        <div className="relative mt-1">
          <button
            onClick={() => setUserMenuOpen(o => !o)}
            className={`w-full flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-white/5 transition ${collapsed ? 'justify-center' : ''}`}
          >
            <div className="w-7 h-7 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center text-accent text-xs font-bold flex-shrink-0">
              {initial}
            </div>
            {!collapsed && (
              <div className="flex-1 text-left min-w-0">
                <div className="text-xs font-semibold text-white truncate">{displayName}</div>
                <div className="text-[10px] text-gray-500 truncate">{email}</div>
              </div>
            )}
          </button>

          {userMenuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
              <div className="absolute bottom-full left-0 mb-2 w-48 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden">
                <div className="px-3 py-2.5 border-b border-white/5">
                  <div className="text-xs font-semibold text-white truncate">{displayName}</div>
                  <div className="text-[10px] text-gray-500 truncate">{email}</div>
                </div>
                <div className="py-1">
                  <Link href="/settings" onClick={() => setUserMenuOpen(false)}
                    className="block px-3 py-2 text-xs text-gray-300 hover:bg-white/5 hover:text-white transition">
                    Settings
                  </Link>
                  <Link href="/billing" onClick={() => setUserMenuOpen(false)}
                    className="block px-3 py-2 text-xs text-gray-300 hover:bg-white/5 hover:text-white transition">
                    Billing
                  </Link>
                </div>
                <div className="border-t border-white/5 py-1">
                  <button
                    onClick={handleSignOut}
                    className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-white/5 transition"
                  >
                    Sign out
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </aside>
  )
}
