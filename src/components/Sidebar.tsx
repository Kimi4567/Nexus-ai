'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabaseClient'
import React from 'react'

// ── Types ──────────────────────────────────────────────────────────────
interface NavItem {
  href: string
  label: string
  icon: React.ReactNode
  badge?: string
}

interface SidebarProps {
  collapsed: boolean
  setCollapsed: (v: boolean | ((prev: boolean) => boolean)) => void
  onMobileClose?: () => void
}

// ── Logo ───────────────────────────────────────────────────────────────
function NexusLogo() {
  return (
    <svg width="26" height="26" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="28" height="28" rx="7" fill="#FF9500" />
      <path d="M7 7L14 21L21 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 7H21" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}

// ── Nav link — expanded ────────────────────────────────────────────────
function NavLink({ item, pathname, onClick }: { item: NavItem; pathname: string; onClick?: () => void }) {
  const isActive = pathname === item.href ||
    (item.href !== '/dashboard' && pathname.startsWith(item.href))

  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={`relative flex items-center gap-2.5 px-3 py-2 rounded-[9px] text-[13px] font-medium transition-all duration-150 group
        ${isActive
          ? 'bg-white/8 text-white shadow-top-edge'
          : 'text-[#7070849] hover:text-white hover:bg-white/4'
        }`}
      style={isActive ? {
        background: 'rgba(255,255,255,0.07)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.07)',
      } : {}}
    >
      {/* Active left indicator */}
      {isActive && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-accent rounded-r-full" />
      )}
      <span className={`flex-shrink-0 transition-colors ${
        isActive ? 'text-white' : 'text-[#505060] group-hover:text-[#9090a8]'
      }`}>
        {item.icon}
      </span>
      <span className="flex-1 leading-none truncate">{item.label}</span>
      {item.badge && (
        <span className="text-[9px] px-1.5 py-0.5 bg-accent/15 text-accent rounded-md font-bold uppercase tracking-wide">
          {item.badge}
        </span>
      )}
    </Link>
  )
}

// ── Icon-only link — collapsed ─────────────────────────────────────────
function NavIcon({ item, pathname }: { item: NavItem; pathname: string }) {
  const isActive = pathname === item.href ||
    (item.href !== '/dashboard' && pathname.startsWith(item.href))

  return (
    <Link
      href={item.href}
      title={item.label}
      className={`flex items-center justify-center w-full h-9 rounded-[9px] transition-all duration-150
        ${isActive
          ? 'text-white'
          : 'text-[#464656] hover:text-[#9090a8] hover:bg-white/4'
        }`}
      style={isActive ? {
        background: 'rgba(255,255,255,0.07)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.07)',
      } : {}}
    >
      {item.icon}
    </Link>
  )
}

// ── Main component ─────────────────────────────────────────────────────
export default function Sidebar({ collapsed, setCollapsed, onMobileClose }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, isAuthenticated } = useAuth()
  const [userMenuOpen, setUserMenuOpen] = React.useState(false)

  const displayName = user?.user_metadata?.name || user?.email?.split('@')[0] || 'Account'
  const email = user?.email || ''
  const initial = displayName.charAt(0).toUpperCase()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const handleNavClick = () => {
    if (onMobileClose) onMobileClose()
  }

  const mainNav: NavItem[] = [
    {
      href: '/dashboard', label: 'Dashboard',
      icon: (
        <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
          <rect x="1" y="1" width="6" height="6" rx="1.5" />
          <rect x="9" y="1" width="6" height="6" rx="1.5" />
          <rect x="1" y="9" width="6" height="6" rx="1.5" />
          <rect x="9" y="9" width="6" height="6" rx="1.5" />
        </svg>
      ),
    },
    {
      href: '/campaigns', label: 'Campaigns',
      icon: (
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M2 4h12M2 8h8M2 12h5" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      href: '/campaign/new', label: 'New Campaign',
      icon: (
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="8" cy="8" r="6.5" />
          <path d="M8 5v6M5 8h6" strokeLinecap="round" />
        </svg>
      ),
    },
  ]

  const workNav: NavItem[] = [
    {
      href: '/strategy', label: 'Strategy', badge: 'New',
      icon: (
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M1.5 12.5L6 7l3 3 5-6.5" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="13" cy="3" r="1.5" fill="currentColor" stroke="none" />
        </svg>
      ),
    },
    {
      href: '/calendar', label: 'Calendar',
      icon: (
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="1.5" y="2.5" width="13" height="12" rx="1.5" />
          <path d="M1.5 6.5h13M5 1.5v2M11 1.5v2" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      href: '/analytics', label: 'Analytics',
      icon: (
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M1.5 12.5h13M4 12.5V8.5M7.5 12.5V5M11 12.5V7.5M14.5 12.5V3.5" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      href: '/schedule', label: 'Schedule',
      icon: (
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="8" cy="8" r="6.5" />
          <path d="M8 4.5v4l2.5 2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      href: '/templates', label: 'Templates',
      icon: (
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1" />
          <rect x="9" y="1.5" width="5.5" height="5.5" rx="1" />
          <rect x="1.5" y="9" width="5.5" height="5.5" rx="1" />
          <path d="M9 11.5h5.5M11.75 9v5" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      href: '/brand', label: 'Brand Intelligence',
      icon: (
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M8 1.5L10 5.5H14L11 8l1 4-4-2.5L4 12l1-4L2 5.5h4z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      href: '/media', label: 'Media Library',
      icon: (
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="1.5" y="1.5" width="13" height="13" rx="2" />
          <circle cx="5.5" cy="5.5" r="1.5" />
          <path d="M1.5 10.5l3.5-3 3 3 2.5-2.5L14.5 11" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
  ]

  const bottomNav: NavItem[] = [
    {
      href: '/billing', label: 'Billing & Plans',
      icon: (
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="1.5" y="4" width="13" height="9" rx="1.5" />
          <path d="M1.5 7h13M4.5 10.5h3" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      href: '/settings', label: 'Settings',
      icon: (
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="8" cy="8" r="2" />
          <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.1 3.1l1.4 1.4M11.5 11.5l1.4 1.4M3.1 12.9l1.4-1.4M11.5 4.5l1.4-1.4" strokeLinecap="round" />
        </svg>
      ),
    },
  ]

  if (!isAuthenticated) return null

  return (
    <aside
      className={`fixed left-0 top-0 h-full z-30 flex flex-col transition-all duration-200 bg-sidebar
        ${collapsed ? 'w-16' : 'w-56'}`}
    >
      {/* Logo */}
      <div className={`flex items-center gap-2.5 px-4 py-5 flex-shrink-0
        ${collapsed ? 'justify-center px-0' : ''}`}
        style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
      >
        <NexusLogo />
        {!collapsed && (
          <span className="font-bold text-white tracking-tight text-[15px] leading-none">Nexus</span>
        )}
      </div>

      {/* Scrollable nav */}
      <div className="flex-1 overflow-y-auto py-4 px-2 space-y-6">

        {/* Main nav */}
        <div className="space-y-0.5">
          {mainNav.map(item => collapsed
            ? <NavIcon key={item.href} item={item} pathname={pathname} />
            : <NavLink key={item.href} item={item} pathname={pathname} onClick={handleNavClick} />
          )}
        </div>

        {/* Intelligence section */}
        {!collapsed && (
          <div>
            <div className="text-[9px] font-bold uppercase tracking-[0.12em] px-3 mb-2"
              style={{ color: '#38383e' }}>
              Intelligence
            </div>
            <div className="space-y-0.5">
              {workNav.map(item => <NavLink key={item.href} item={item} pathname={pathname} onClick={handleNavClick} />)}
            </div>
          </div>
        )}
        {collapsed && (
          <div className="space-y-0.5">
            {workNav.map(item => <NavIcon key={item.href} item={item} pathname={pathname} />)}
          </div>
        )}
      </div>

      {/* Bottom section */}
      <div className="flex-shrink-0 px-2 pb-3 space-y-0.5"
        style={{ borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '12px' }}
      >
        {/* Upgrade pill */}
        {!collapsed && pathname !== '/billing' && (
          <Link href="/billing"
            className="flex items-center gap-2 px-3 py-2 rounded-[9px] mb-2 group transition-all duration-150"
            style={{
              background: 'rgba(255,149,0,0.08)',
              border: '1px solid rgba(255,149,0,0.18)',
              boxShadow: 'inset 0 1px 0 rgba(255,149,0,0.10)',
            }}
          >
            <span className="text-accent text-sm">⚡</span>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-semibold text-accent leading-none mb-0.5">Go Pro</div>
              <div className="text-[10px] leading-none" style={{ color: '#5a5a6e' }}>Unlock everything</div>
            </div>
          </Link>
        )}

        {/* Bottom nav links */}
        {bottomNav.map(item => collapsed
          ? <NavIcon key={item.href} item={item} pathname={pathname} />
          : <NavLink key={item.href} item={item} pathname={pathname} />
        )}

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(c => !c)}
          className="flex items-center justify-center w-full h-9 rounded-[9px] transition-all duration-150 mt-1"
          style={{ color: '#505060' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#9090a8')}
          onMouseLeave={e => (e.currentTarget.style.color = '#505060')}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor"
            strokeWidth="1.5" strokeLinecap="round"
            className={`transition-transform duration-200 ${collapsed ? 'rotate-180' : ''}`}>
            <path d="M9 2L4 7l5 5" />
          </svg>
        </button>

        {/* User menu */}
        <div className="relative mt-0.5">
          <button
            onClick={() => setUserMenuOpen(o => !o)}
            className={`w-full flex items-center gap-2.5 px-2 py-2 rounded-[9px] transition-all duration-150
              hover:bg-white/4 ${collapsed ? 'justify-center' : ''}`}
          >
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
              style={{
                background: 'rgba(255,149,0,0.12)',
                border: '1px solid rgba(255,149,0,0.22)',
                color: '#FF9500',
              }}>
              {initial}
            </div>
            {!collapsed && (
              <div className="flex-1 text-left min-w-0">
                <div className="text-[12px] font-semibold truncate" style={{ color: '#e0e0f0' }}>{displayName}</div>
                <div className="text-[10px] truncate" style={{ color: '#46464e' }}>{email}</div>
              </div>
            )}
          </button>

          {userMenuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
              <div className="absolute bottom-full left-0 mb-2 w-52 z-50 rounded-[13px] overflow-hidden"
                style={{
                  background: '#131312',
                  border: '1px solid #1f1f1d',
                  boxShadow: '0 4px 24px rgba(0,0,0,0.5), 0 24px 48px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
                  animation: 'slideDown 0.18s cubic-bezier(0.22,1,0.36,1) both',
                }}
              >
                <div className="px-3 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <div className="text-[12px] font-semibold truncate text-white">{displayName}</div>
                  <div className="text-[11px] truncate" style={{ color: '#46464e' }}>{email}</div>
                </div>
                <div className="py-1.5 px-1">
                  {[
                    { href: '/settings', label: 'Settings' },
                    { href: '/billing', label: 'Billing & Plans' },
                  ].map(item => (
                    <Link key={item.href} href={item.href} onClick={() => setUserMenuOpen(false)}
                      className="flex items-center px-2.5 py-2 rounded-[8px] text-[12px] transition-all duration-100"
                      style={{ color: '#9090a8' }}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'
                        ;(e.currentTarget as HTMLElement).style.color = '#ffffff'
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLElement).style.background = 'transparent'
                        ;(e.currentTarget as HTMLElement).style.color = '#9090a8'
                      }}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
                <div className="py-1.5 px-1" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  <button
                    onClick={handleSignOut}
                    className="w-full text-left flex items-center px-2.5 py-2 rounded-[8px] text-[12px] transition-all duration-100"
                    style={{ color: '#f87171' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(248,113,113,0.08)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
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
