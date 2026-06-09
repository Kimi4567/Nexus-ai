'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabaseClient'
import { useI18n } from '@/lib/i18n-context'
import { useBillingStatus } from '@/lib/useBillingStatus'
import React from 'react'

/* ═══════════════════════════════════════════════════════════════
   NEXUS SIDEBAR — Premium AI Command Center
   Design: var(--nx-surface) #0C0D24, violet #8B5CF6, orange #F97316
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
          <stop stopColor="#8B5CF6" />
          <stop offset="1" stopColor="#F97316" />
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
        style={isActive ? { background: 'rgba(139,92,246,0.15)', boxShadow: 'inset 0 1px 0 rgba(139,92,246,0.2)' } : {}}
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
      style={isActive ? { background: 'rgba(139,92,246,0.12)', boxShadow: 'inset 0 1px 0 rgba(139,92,246,0.15)' } : {}}
    >
      {isActive && (
        <span className="absolute right-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-l-full"
          style={{ background: '#8B5CF6' }} />
      )}
      <span className={`flex-shrink-0 transition-colors ${isActive ? 'text-accent-purple' : 'text-text-muted'}`}>
        {icon}
      </span>
      <span className="flex-1 leading-none truncate">{label}</span>
      {labelEn && !badge && <span className="text-[9px] text-text-muted font-mono opacity-60">{labelEn}</span>}
      {badge && (
        <span className="text-[9px] px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wide"
          style={{ background: badgeColor ? `${badgeColor}18` : 'rgba(139,92,246,0.15)', color: badgeColor || '#8B5CF6' }}>
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
  campaigns: (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M2 6v4h2l5 3V3L4 6H2z" strokeLinejoin="round" />
      <path d="M11.5 5.5c1 .5 1.5 1.5 1.5 2.5s-.5 2-1.5 2.5" strokeLinecap="round" />
      <path d="M13 3.5c2 1 2 7 0 9" strokeLinecap="round" />
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
  brain: (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M6 2.5C4 2.5 2.5 4 2.5 5.5c0 .8.3 1.5.8 2-.5.4-.8 1-.8 1.7 0 1.2.9 2.2 2 2.4V13h7v-1.4c1.1-.2 2-1.2 2-2.4 0-.7-.3-1.3-.8-1.7.5-.5.8-1.2.8-2C13.5 4 12 2.5 10 2.5c-.5 0-1 .1-1.4.3A2.5 2.5 0 0 0 6 2.5z" strokeLinejoin="round"/>
      <path d="M6 8.5h4M7 6.5h2" strokeLinecap="round"/>
    </svg>
  ),
  calendar: (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="1.5" y="2.5" width="13" height="12" rx="1.5" />
      <path d="M1.5 6.5h13M5 1.5v2M11 1.5v2" strokeLinecap="round" />
      <path d="M4.5 9h1.5M7.5 9h1.5M10.5 9h1.5M4.5 11.5h1.5M7.5 11.5h1.5" strokeLinecap="round" />
    </svg>
  ),
  media: (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="1.5" y="3.5" width="13" height="9" rx="1.5" />
      <circle cx="5.5" cy="7" r="1.2" />
      <path d="M1.5 12.5l3-3 2.5 2 2-2 4 3.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  studio: (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M2 3.5h12M2 3.5v9a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-9" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M6 6.5l4 2-4 2V6.5z" fill="currentColor" stroke="none"/>
    </svg>
  ),
  sentinel: (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M8 1.5L2 4v4c0 3.3 2.5 5.8 6 6.5 3.5-.7 6-3.2 6-6.5V4L8 1.5z" strokeLinejoin="round"/>
      <path d="M5.5 8l1.5 1.5L10.5 6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  analytics: (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M2 12.5l3.5-4 3 2.5 3-5 2.5 2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M2 14.5h12" strokeLinecap="round"/>
    </svg>
  ),
  vex: (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="1.5" y="2" width="13" height="9" rx="1.5"/>
      <path d="M5 13.5h6M8 11v2.5" strokeLinecap="round"/>
      <path d="M5 5.5l1.5 2L8 5M9.5 5.5h2M9.5 7.5h1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  schedule: (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="8" cy="8" r="6.5"/>
      <path d="M8 4.5V8l2.5 2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  paidAds: (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="1" y="3" width="14" height="10" rx="2"/>
      <path d="M5 8h2.5M8.5 6.5l2 1.5-2 1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M5 10h3" strokeLinecap="round"/>
    </svg>
  ),
  adAccounts: (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="8" cy="5" r="2.5"/>
      <path d="M2.5 13c0-2.5 2.5-4 5.5-4s5.5 1.5 5.5 4" strokeLinecap="round"/>
      <path d="M11.5 7.5l1 1 2-2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
}

// ── Main Sidebar ───────────────────────────────────────────────
export default function Sidebar({ collapsed, setCollapsed, onMobileClose }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, isAuthenticated, authHeader } = useAuth()
  const { locale, setLocale, t, dir } = useI18n()
  // locale is used for language toggle button logic
  const [userMenuOpen, setUserMenuOpen] = React.useState(false)
  const [pendingProposals, setPendingProposals] = React.useState(0)

  const displayName = user?.user_metadata?.name || user?.email?.split('@')[0] || 'Account'
  const email = user?.email || ''
  const initial = displayName.charAt(0).toUpperCase()

  const { creditsRemaining, creditsMax, isUnlimited, isPaid, isLow, isEmpty } = useBillingStatus()

  // Fetch pending Brain proposals count for sidebar dot
  React.useEffect(() => {
    const fetchPending = async () => {
      try {
        const token = authHeader()
        if (!token) return
        const res = await fetch('/api/brain/proposals?status=pending', {
          headers: { Authorization: token },
        })
        if (!res.ok) return
        const data = await res.json()
        const count = Array.isArray(data.proposals) ? data.proposals.length : 0
        setPendingProposals(count)
      } catch {
        // non-critical
      }
    }
    fetchPending()
    // Refresh every 60s so the dot appears without a page reload
    const interval = setInterval(fetchPending, 60_000)
    return () => clearInterval(interval)
  }, [authHeader])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const click = () => { if (onMobileClose) onMobileClose() }

  if (!isAuthenticated) return null

  const sharedProps = { pathname, collapsed, onClick: click }

  return (
    <aside dir={dir} className={`h-full flex flex-col transition-all duration-200 ${collapsed ? 'w-16' : 'w-56'}`}
      style={{ background: 'var(--nx-surface)', borderRight: '1px solid rgba(139,92,246,0.12)' }}>

      {/* Logo */}
      <div className={`flex items-center gap-2.5 px-4 py-5 flex-shrink-0 ${collapsed ? 'justify-center px-0' : ''}`}
        style={{ borderBottom: '1px solid rgba(139,92,246,0.08)' }}>
        <NexusLogo />
        {!collapsed && (
          <span className="font-bold text-white tracking-tight text-[15px] leading-none font-heading">
            Nexus<span style={{ color: '#8B5CF6' }}>.</span>
          </span>
        )}
      </div>

      {/* Scrollable nav */}
      <div className="flex-1 overflow-y-auto py-3 px-2">

        {/* Main */}
        <NavItem href="/dashboard" label={t('sidebar.home')}
          icon={Icons.dashboard} {...sharedProps} />
        <NavItem href="/brand" label={t('sidebar.brand')}
          icon={Icons.brain} dot={pendingProposals > 0 ? '#f59e0b' : undefined} {...sharedProps} />

        {/* Organic Content */}
        {!collapsed && <SectionLabel>{locale === 'ar' ? 'محتوى عضوي' : 'Organic Content'}</SectionLabel>}
        {collapsed && <div className="my-2 mx-2 h-px" style={{ background: 'rgba(139,92,246,0.1)' }} />}
        <NavItem href="/campaigns" label={locale === 'ar' ? 'توليد محتوى' : 'Generate Content'}
          icon={Icons.campaigns} {...sharedProps} />
        <NavItem href="/templates" label={locale === 'ar' ? 'القوالب' : 'Templates'}
          icon={<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="1" y="1" width="6" height="6" rx="1.5"/><rect x="9" y="1" width="6" height="6" rx="1.5"/><rect x="1" y="9" width="6" height="6" rx="1.5"/><rect x="9" y="9" width="6" height="6" rx="1.5"/></svg>}
          {...sharedProps} />
        <NavItem href="/content-hub" label={locale === 'ar' ? 'مركز المحتوى' : 'Content Hub'}
          icon={<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="1" y="3" width="14" height="10" rx="2"/><path d="M5 7h6M5 10h4"/></svg>}
          {...sharedProps} />
        <NavItem href="/calendar" label={locale === 'ar' ? 'التقويم' : 'Calendar'}
          icon={Icons.calendar} {...sharedProps} />
        <NavItem href="/media" label={t('sidebar.media')}
          icon={Icons.media} {...sharedProps} />

        {/* Agents */}
        {!collapsed && <SectionLabel>{locale === 'ar' ? 'الوكلاء' : 'Agents'}</SectionLabel>}
        {collapsed && <div className="my-2 mx-2 h-px" style={{ background: 'rgba(139,92,246,0.1)' }} />}
        <NavItem href="/studio" label={locale === 'ar' ? 'استوديو' : 'Studio'}
          icon={Icons.studio} {...sharedProps} />
        <NavItem href="/sentinel" label="Sentinel"
          icon={Icons.sentinel} badge="AI" badgeColor="#8B5CF6" {...sharedProps} />
        <NavItem href="/analytics" label={locale === 'ar' ? 'تحليلات' : 'Analytics'}
          icon={Icons.analytics} {...sharedProps} />
        <NavItem href="/vex" label="Vex"
          icon={Icons.vex} badge="AI" badgeColor="#F97316" {...sharedProps} />

        {/* Paid Ads */}
        {!collapsed && <SectionLabel>{locale === 'ar' ? 'إعلانات مدفوعة' : 'Paid Ads'}</SectionLabel>}
        {collapsed && <div className="my-2 mx-2 h-px" style={{ background: 'rgba(249,115,22,0.15)' }} />}
        <NavItem href="/paid-campaigns" label={locale === 'ar' ? 'الحملات المدفوعة' : 'Paid Campaigns'}
          icon={Icons.paidAds} badge="NEW" badgeColor="#F97316" {...sharedProps} />

        {/* Platform */}
        {!collapsed && <SectionLabel>{t('sidebar.sectionPlatforms')}</SectionLabel>}
        {collapsed && <div className="my-2 mx-2 h-px" style={{ background: 'rgba(139,92,246,0.1)' }} />}
        <NavItem href="/connections" label={t('sidebar.connect')}
          icon={Icons.connections} badge={t('sidebar.badgeSetup')} badgeColor="#10B981" {...sharedProps} />

      </div>

      {/* Bottom section */}
      <div className="flex-shrink-0 px-2 pb-3 space-y-0.5"
        style={{ borderTop: '1px solid rgba(139,92,246,0.08)', paddingTop: '12px' }}>

        {/* Credits indicator / Upgrade CTA */}
        {!collapsed && (
          <Link href="/billing"
            className="flex flex-col gap-1.5 px-3 py-2.5 rounded-[9px] mb-2 transition-all"
            style={{
              background: isEmpty ? 'rgba(239,68,68,0.08)' : isLow ? 'rgba(245,158,11,0.08)' : isPaid ? 'rgba(16,185,129,0.06)' : 'rgba(139,92,246,0.08)',
              border: isEmpty ? '1px solid rgba(239,68,68,0.3)' : isLow ? '1px solid rgba(245,158,11,0.3)' : isPaid ? '1px solid rgba(16,185,129,0.2)' : '1px solid rgba(139,92,246,0.2)',
            }}>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold" style={{ color: isEmpty ? '#EF4444' : isLow ? '#F59E0B' : isPaid ? '#10B981' : '#8B5CF6' }}>
                {isEmpty ? '⚠ No credits left' : isLow ? `⚠ ${creditsRemaining} credits left` : isPaid ? `✓ ${isUnlimited ? '∞' : creditsRemaining} credits` : `⚡ ${t('sidebar.upgradePro')}`}
              </span>
              {!isPaid && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: '#8B5CF6', color: 'white' }}>PRO</span>}
            </div>
            {!isUnlimited && (
              <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                <div className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(100, ((creditsMax - creditsRemaining) / Math.max(creditsMax, 1)) * 100)}%`,
                    background: isEmpty ? '#EF4444' : isLow ? '#F59E0B' : '#8B5CF6',
                  }} />
              </div>
            )}
            {!isPaid && (
              <div className="text-[10px] leading-none text-text-muted">{t('sidebar.unlockAll')}</div>
            )}
          </Link>
        )}

        <NavItem href="/settings" label={t('sidebar.settings')}
          icon={Icons.settings} {...sharedProps} />
        <NavItem href="/billing" label={t('sidebar.billing')}
          icon={Icons.billing} {...sharedProps} />

        {/* Collapse toggle */}
        <button onClick={() => setCollapsed(c => !c)}
          className="flex items-center justify-center w-full h-9 rounded-[9px] transition-all duration-150 mt-1 text-text-muted hover:text-text-secondary hover:bg-white/5"
          title={collapsed ? t('sidebar.expand') : t('sidebar.collapse')}>
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
            <span>{t('language.switchLabel')}</span>
          </button>
        )}

        {/* User menu */}
        <div className="relative mt-0.5">
          <button onClick={() => setUserMenuOpen(o => !o)}
            className={`w-full flex items-center gap-2.5 px-2 py-2 rounded-[9px] transition-all duration-150 hover:bg-white/5 ${collapsed ? 'justify-center' : ''}`}>
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
              style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', color: '#8B5CF6' }}>
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
                <div className="px-3 py-3" style={{ borderBottom: '1px solid rgba(139,92,246,0.1)' }}>
                  <div className="text-[12px] font-semibold truncate text-white">{displayName}</div>
                  <div className="text-[11px] truncate text-text-muted">{email}</div>
                </div>
                <div className="py-1.5 px-1">
                  {[
                    { href: '/settings', label: t('sidebar.settings') },
                    { href: '/billing',  label: t('sidebar.billing') },
                  ].map(item => (
                    <Link key={item.href} href={item.href} onClick={() => { setUserMenuOpen(false); click() }}
                      className="flex items-center px-2.5 py-2 rounded-[8px] text-[12px] transition-all text-text-secondary hover:text-white hover:bg-white/5">
                      {item.label}
                    </Link>
                  ))}
                  <button onClick={handleSignOut}
                    className="w-full flex items-center px-2.5 py-2 rounded-[8px] text-[12px] transition-all text-left hover:bg-rose-500/10"
                    style={{ color: '#f43f5e' }}>
                    {t('nav.logout')}
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
