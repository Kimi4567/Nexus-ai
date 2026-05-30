'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabaseClient'
import { useI18n } from '@/lib/i18n-context'
import React from 'react'

/* ═══════════════════════════════════════════════════════════════
   NEXUS SIDEBAR — Premium AI Command Center
   Design: bg-sidebar #0F1430, accent-purple #6C63FF
   ═══════════════════════════════════════════════════════════════ */

interface SidebarProps {
  collapsed: boolean
  setCollapsed: (v: boolean | ((prev: boolean) => boolean)) => void
  onMobileClose?: () => void
}

// ── Logo ───────────────────────────────────────────────────────
function NexusLogo() {
  return (
    <svg width="26" height="26" viewBox="0 0 28 28" fill="none">
      <rect width="28" height="28" rx="7" fill="url(#logoGrad)" />
      <defs>
        <linearGradient id="logoGrad" x1="0" y1="0" x2="28" y2="28" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6C63FF" />
          <stop offset="1" stopColor="#00BFA6" />
        </linearGradient>
      </defs>
      <path d="M7 7L14 21L21 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 7H21" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}

// ── Section label ──────────────────────────────────────────────
function SectionLabel({ children }: { children: string }) {
  return (
    <div className="text-[9px] font-bold uppercase tracking-[0.15em] px-3 pt-4 pb-1.5 text-text-muted">
      {children}
    </div>
  )
}

// ── Nav item ──────────────────────────────────────────────────
interface NavItemProps {
  href: string
  label: string
  labelEn?: string
  icon: React.ReactNode
  badge?: string
  badgeColor?: string
  dot?: string
  pathname: string
  collapsed: boolean
  onClick?: () => void
}

function NavItem({ href, label, labelEn, icon, badge, badgeColor, dot, pathname, collapsed, onClick }: NavItemProps) {
  const isActive = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))

  if (collapsed) {
    return (
      <Link href={href} title={label} onClick={onClick}
        className={`flex items-center justify-center w-full h-9 rounded-[9px] transition-all duration-150 relative
          ${isActive ? 'text-white' : 'text-text-muted hover:text-text-secondary hover:bg-white/5'}`}
        style={isActive ? { background: 'rgba(108,99,255,0.15)', boxShadow: 'inset 0 1px 0 rgba(108,99,255,0.2)' } : {}}
      >
        {icon}
        {dot && <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full" style={{ background: dot, boxShadow: `0 0 4px ${dot}` }} />}
      </Link>
    )
  }

  return (
    <Link href={href} onClick={onClick}
      className={`relative flex items-center gap-2.5 px-3 py-2 rounded-[9px] text-[13px] font-medium transition-all duration-150
        ${isActive ? 'text-white' : 'text-text-muted hover:text-white hover:bg-white/5'}`}
      style={isActive ? { background: 'rgba(108,99,255,0.12)', boxShadow: 'inset 0 1px 0 rgba(108,99,255,0.15)' } : {}}
    >
      {isActive && (
        <span className="absolute right-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-l-full"
          style={{ background: '#6C63FF' }} />
      )}
      <span className={`flex-shrink-0 transition-colors ${isActive ? 'text-accent-purple' : 'text-text-muted'}`}>
        {icon}
      </span>
      <span className="flex-1 leading-none truncate">{label}</span>
      {labelEn && !badge && <span className="text-[9px] text-text-muted font-mono opacity-60">{labelEn}</span>}
      {badge && (
        <span className="text-[9px] px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wide"
          style={{ background: badgeColor ? `${badgeColor}18` : 'rgba(108,99,255,0.15)', color: badgeColor || '#6C63FF' }}>
          {badge}
        </span>
      )}
      {dot && <span className="w-1.5 h-1.5 rounded-full ml-auto" style={{ background: dot, boxShadow: `0 0 5px ${dot}` }} />}
    </Link>
  )
}

// ── Icons ─────────────────────────────────────────────────────
const Icons = {
  dashboard: (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
      <rect x="1" y="1" width="6" height="6" rx="1.5" />
      <rect x="9" y="1" width="6" height="6" rx="1.5" />
      <rect x="1" y="9" width="6" height="6" rx="1.5" />
      <rect x="9" y="9" width="6" height="6" rx="1.5" />
    </svg>
  ),
  connections: (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="3.5" cy="8" r="2" />
      <circle cx="12.5" cy="3.5" r="2" />
      <circle cx="12.5" cy="12.5" r="2" />
      <path d="M5.5 8h3.5M10.5 5l-1.5 3M10.5 11l-1.5-3" strokeLinecap="round" />
    </svg>
  ),
  film: (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="1.5" y="2.5" width="13" height="11" rx="1.5" />
      <path d="M1.5 5.5h13M1.5 10.5h13M4.5 2.5v3M8 2.5v3M11.5 2.5v3M4.5 10.5v3M8 10.5v3M11.5 10.5v3" strokeLinecap="round" />
    </svg>
  ),
  megaphone: (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M2 6v4h2l5 3V3L4 6H2z" strokeLinejoin="round" />
      <path d="M11.5 5.5c1 .5 1.5 1.5 1.5 2.5s-.5 2-1.5 2.5" strokeLinecap="round" />
      <path d="M13 3.5c2 1 2 7 0 9" strokeLinecap="round" />
    </svg>
  ),
  chart: (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M1.5 12.5h13M4 12.5V8.5M7.5 12.5V5M11 12.5V7.5M14.5 12.5V3.5" strokeLinecap="round" />
    </svg>
  ),
  shield: (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M8 1.5L13 3.5v4c0 3.5-2.5 6-5 7-2.5-1-5-3.5-5-7v-4l5-2z" strokeLinejoin="round" />
      <path d="M5.5 8l1.5 1.5 3-3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  settings: (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="8" cy="8" r="2" />
      <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.1 3.1l1.4 1.4M11.5 11.5l1.4 1.4M3.1 12.9l1.4-1.4M11.5 4.5l1.4-1.4" strokeLinecap="round" />
    </svg>
  ),
  billing: (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="1.5" y="4" width="13" height="9" rx="1.5" />
      <path d="M1.5 7h13M4.5 10.5h3" strokeLinecap="round" />
    </svg>
  ),
  demo: (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M8 1.5L10.5 6l5 .5-3.5 3.5 1 5L8 12.5 3 15l1-5L.5 6.5l5-.5L8 1.5z" strokeLinejoin="round" />
    </svg>
  ),
  brain: (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M6 2.5C4 2.5 2.5 4 2.5 5.5c0 .8.3 1.5.8 2-.5.4-.8 1-.8 1.7 0 1.2.9 2.2 2 2.4V13h7v-1.4c1.1-.2 2-1.2 2-2.4 0-.7-.3-1.3-.8-1.7.5-.5.8-1.2.8-2C13.5 4 12 2.5 10 2.5c-.5 0-1 .1-1.4.3A2.5 2.5 0 0 0 6 2.5z" strokeLinejoin="round"/>
      <path d="M6 8.5h4M7 6.5h2" strokeLinecap="round"/>
    </svg>
  ),
}

// ── Main Sidebar ───────────────────────────────────────────────
export default function Sidebar({ collapsed, setCollapsed, onMobileClose }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, isAuthenticated } = useAuth()
  const { locale, setLocale } = useI18n()
  const [userMenuOpen, setUserMenuOpen] = React.useState(false)

  const displayName = user?.user_metadata?.name || user?.email?.split('@')[0] || 'Account'
  const email = user?.email || ''
  const initial = displayName.charAt(0).toUpperCase()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const click = () => { if (onMobileClose) onMobileClose() }

  if (!isAuthenticated) return null

  const sharedProps = { pathname, collapsed, onClick: click }

  return (
    <aside dir="rtl" className={`h-full flex flex-col transition-all duration-200 ${collapsed ? 'w-16' : 'w-56'}`}
      style={{ background: '#0F1430', borderRight: '1px solid rgba(108,99,255,0.12)' }}>

      {/* Logo */}
      <div className={`flex items-center gap-2.5 px-4 py-5 flex-shrink-0 ${collapsed ? 'justify-center px-0' : ''}`}
        style={{ borderBottom: '1px solid rgba(108,99,255,0.08)' }}>
        <NexusLogo />
        {!collapsed && (
          <span className="font-bold text-white tracking-tight text-[15px] leading-none font-heading">
            Nexus<span style={{ color: '#6C63FF' }}>.</span>
          </span>
        )}
      </div>

      {/* Scrollable nav */}
      <div className="flex-1 overflow-y-auto py-3 px-2">

        {/* Main */}
        <NavItem href="/dashboard" label="الرئيسية" labelEn="Dashboard"
          icon={Icons.dashboard} {...sharedProps} />
        <NavItem href="/brand" label="Brand Brain" labelEn="Memory"
          icon={Icons.brain} dot="#00BFA6" {...sharedProps} />

        {/* Platform */}
        {!collapsed && <SectionLabel>المنصات</SectionLabel>}
        {collapsed && <div className="my-2 mx-2 h-px" style={{ background: 'rgba(108,99,255,0.1)' }} />}
        <NavItem href="/connections" label="ربط المنصات" labelEn="Connect"
          icon={Icons.connections} badge="مهم" badgeColor="#00BFA6" {...sharedProps} />

        {/* AI Agents */}
        {!collapsed && <SectionLabel>الوكلاء الذكيون</SectionLabel>}
        {collapsed && <div className="my-2 mx-2 h-px" style={{ background: 'rgba(108,99,255,0.1)' }} />}

        <NavItem href="/studio" label="NEX" labelEn="Studio"
          icon={Icons.film} dot="#00BFA6" {...sharedProps} />
        <NavItem href="/vex" label="VEX" labelEn="Ads"
          icon={Icons.megaphone} dot="#FF6B35" {...sharedProps} />
        <NavItem href="/analytics" label="PULSE" labelEn="Analytics"
          icon={Icons.chart} dot="#00D4FF" {...sharedProps} />
        <NavItem href="/sentinel" label="Sentinel" labelEn="Monitor"
          icon={Icons.shield} dot="#FFD700" {...sharedProps} />

        {/* Demo */}
        {!collapsed && <SectionLabel>عرض تجريبي</SectionLabel>}
        {collapsed && <div className="my-2 mx-2 h-px" style={{ background: 'rgba(108,99,255,0.1)' }} />}
        <NavItem href="/demo" label="نسخة تجريبية" labelEn="Demo"
          icon={Icons.demo} badge="جديد" badgeColor="#6C63FF" {...sharedProps} />

      </div>

      {/* Bottom section */}
      <div className="flex-shrink-0 px-2 pb-3 space-y-0.5"
        style={{ borderTop: '1px solid rgba(108,99,255,0.08)', paddingTop: '12px' }}>

        {/* Upgrade */}
        {!collapsed && pathname !== '/billing' && (
          <Link href="/billing"
            className="flex items-center gap-2 px-3 py-2 rounded-[9px] mb-2 transition-all"
            style={{ background: 'rgba(108,99,255,0.08)', border: '1px solid rgba(108,99,255,0.2)' }}>
            <span className="text-sm" style={{ color: '#6C63FF' }}>⚡</span>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-semibold leading-none mb-0.5" style={{ color: '#6C63FF' }}>ترقية للـ Pro</div>
              <div className="text-[10px] leading-none text-text-muted">افتح كل الإمكانيات</div>
            </div>
          </Link>
        )}

        <NavItem href="/settings" label="الإعدادات" labelEn="Settings"
          icon={Icons.settings} {...sharedProps} />
        <NavItem href="/billing" label="الفواتير" labelEn="Billing"
          icon={Icons.billing} {...sharedProps} />

        {/* Collapse toggle */}
        <button onClick={() => setCollapsed(c => !c)}
          className="flex items-center justify-center w-full h-9 rounded-[9px] transition-all duration-150 mt-1 text-text-muted hover:text-text-secondary hover:bg-white/5"
          title={collapsed ? 'Expand' : 'Collapse'}>
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
            className={`transition-transform duration-200 ${collapsed ? 'rotate-180' : ''}`}>
            <path d="M9 2L4 7l5 5" />
          </svg>
        </button>

        {/* Language */}
        {!collapsed && (
          <button onClick={() => setLocale(locale === 'ar' ? 'en' : 'ar')}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-[9px] text-[11px] font-medium transition-all hover:bg-white/5 text-text-muted hover:text-text-secondary">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
            <span>{locale === 'ar' ? 'English' : 'العربية'}</span>
          </button>
        )}

        {/* User menu */}
        <div className="relative mt-0.5">
          <button onClick={() => setUserMenuOpen(o => !o)}
            className={`w-full flex items-center gap-2.5 px-2 py-2 rounded-[9px] transition-all duration-150 hover:bg-white/5 ${collapsed ? 'justify-center' : ''}`}>
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
              style={{ background: 'rgba(108,99,255,0.15)', border: '1px solid rgba(108,99,255,0.3)', color: '#6C63FF' }}>
              {initial}
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-semibold truncate text-white">{displayName}</div>
                <div className="text-[10px] truncate text-text-muted">{email}</div>
              </div>
            )}
          </button>

          {userMenuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
              <div className="absolute bottom-full left-0 mb-2 w-52 z-50 rounded-[13px] overflow-hidden glass-panel">
                <div className="px-3 py-3" style={{ borderBottom: '1px solid rgba(108,99,255,0.1)' }}>
                  <div className="text-[12px] font-semibold truncate text-white">{displayName}</div>
                  <div className="text-[11px] truncate text-text-muted">{email}</div>
                </div>
                <div className="py-1.5 px-1">
                  {[
                    { href: '/settings', label: 'الإعدادات / Settings' },
                    { href: '/billing', label: 'الفواتير / Billing' },
                  ].map(item => (
                    <Link key={item.href} href={item.href} onClick={() => { setUserMenuOpen(false); click() }}
                      className="flex items-center px-2.5 py-2 rounded-[8px] text-[12px] transition-all text-text-secondary hover:text-white hover:bg-white/5">
                      {item.label}
                    </Link>
                  ))}
                  <button onClick={handleSignOut}
                    className="w-full flex items-center px-2.5 py-2 rounded-[8px] text-[12px] transition-all text-left hover:bg-rose-500/10"
                    style={{ color: '#f43f5e' }}>
                    تسجيل الخروج / Sign Out
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
