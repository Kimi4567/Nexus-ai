'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabaseClient'
import { useI18n } from '@/lib/i18n-context'
import { useBillingStatus } from '@/lib/useBillingStatus'
import { getBillingDisplayTruth } from '@/lib/billingDisplayTruth'
import { getPlanDisplayName } from '@/lib/creditDisplay'
import React from 'react'

/* ═══════════════════════════════════════════════════════════════
   NEXUS SIDEBAR — premium operating-system navigation
   Design: dark navy rail, luminous active state, truth-safe billing card
   ═══════════════════════════════════════════════════════════════ */

interface SidebarProps {
  collapsed: boolean
  setCollapsed: (v: boolean | ((prev: boolean) => boolean)) => void
  onMobileClose?: () => void
}

interface NavConfigItem {
  href: string
  labelKey?: string
  labelAr?: string
  labelEn?: string
  icon: React.ReactNode
  badgeKey?: string
  badgeColor?: string
  dot?: string
}

interface NavGroupConfig {
  key: string
  labelAr?: string
  labelEn?: string
  separatorBefore?: boolean
  items: NavConfigItem[]
}

// ── Logo ───────────────────────────────────────────────────────
function NexusLogo() {
  return (
    <svg width="30" height="30" viewBox="0 0 30 30" fill="none" aria-hidden="true">
      <defs>
        <radialGradient id="logoGlow" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(15 15) rotate(90) scale(15)">
          <stop stopColor="#C7D2FE" />
          <stop offset="0.45" stopColor="#7C83FF" />
          <stop offset="1" stopColor="#111A4D" />
        </radialGradient>
        <linearGradient id="logoSpark" x1="5" y1="5" x2="25" y2="25" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#A5B4FC" />
        </linearGradient>
      </defs>
      <circle cx="15" cy="15" r="15" fill="url(#logoGlow)" opacity="0.95" />
      <path d="M15 4.5C16.45 10.95 19.05 13.55 25.5 15C19.05 16.45 16.45 19.05 15 25.5C13.55 19.05 10.95 16.45 4.5 15C10.95 13.55 13.55 10.95 15 4.5Z" fill="url(#logoSpark)" />
    </svg>
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
  const hrefPath = href.split(/[?#]/)[0] || href
  const isHashOrQueryLink = href.includes('#') || href.includes('?')
  const isActive = !isHashOrQueryLink && (pathname === hrefPath || (hrefPath !== '/dashboard' && hrefPath !== '/brand' && pathname.startsWith(hrefPath)))

  if (collapsed) {
    return (
      <Link href={href} title={label} onClick={onClick}
        className={`relative flex h-10 w-full items-center justify-center rounded-xl transition-all duration-150
          ${isActive ? 'text-white' : 'text-slate-400 hover:bg-white/10 hover:text-white'}`}
        style={isActive ? { background: 'linear-gradient(135deg, rgba(94,99,255,0.95), rgba(124,58,237,0.85))', boxShadow: '0 12px 28px rgba(94,99,255,0.25)' } : {}}
      >
        {icon}
        {dot && <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full" style={{ background: dot, boxShadow: `0 0 4px ${dot}` }} />}
      </Link>
    )
  }

  return (
    <Link href={href} onClick={onClick}
      aria-label={badge ? `${label} ${badge}` : label}
      className={`relative flex h-9 items-center gap-2.5 rounded-xl px-3 text-[13px] font-bold transition-all duration-150
        ${isActive ? 'text-white' : 'text-slate-300 hover:bg-white/10 hover:text-white'}`}
      style={isActive ? { background: 'linear-gradient(135deg, rgba(94,99,255,0.95), rgba(124,58,237,0.85))', boxShadow: '0 14px 34px rgba(94,99,255,0.24), inset 0 0 0 1px rgba(255,255,255,0.14)' } : {}}
    >
      {isActive && (
        <span className="absolute right-2 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-white/80 shadow-[0_0_14px_rgba(255,255,255,0.7)]" />
      )}
      <span className={`flex-shrink-0 transition-colors ${isActive ? 'text-white' : 'text-slate-400'}`}>
        {icon}
      </span>
      <span className="flex-1 leading-none truncate">{label}</span>
      {labelEn && !badge && <span className="font-mono text-[9px] text-slate-500 opacity-80">{labelEn}</span>}
      {badge && (
        <span className="text-[9px] px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wide"
          style={{ background: badgeColor ? `${badgeColor}24` : 'rgba(139,92,246,0.22)', color: badgeColor || '#A5B4FC' }}>
          {' '}{badge}
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
  strategy: (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="8" cy="8" r="6.5" />
      <circle cx="8" cy="8" r="3" />
      <circle cx="8" cy="8" r="0.6" fill="currentColor" stroke="none" />
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
  analytics: (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M2 12.5l3.5-4 3 2.5 3-5 2.5 2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M2 14.5h12" strokeLinecap="round"/>
    </svg>
  ),
  learning: (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M2.5 2.5h4.25c.7 0 1.25.55 1.25 1.25v9.75c0-.7-.55-1.25-1.25-1.25H2.5V2.5Z" strokeLinejoin="round" />
      <path d="M13.5 2.5H9.25C8.55 2.5 8 3.05 8 3.75v9.75c0-.7.55-1.25 1.25-1.25h4.25V2.5Z" strokeLinejoin="round" />
      <path d="M4.25 5.25h2M9.75 5.25h2M4.25 7.75h2M9.75 7.75h2" strokeLinecap="round" />
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
  const pendingFetchStartedAtRef = React.useRef(0)
  const pendingFetchInFlightRef = React.useRef(false)

  const displayName = user?.user_metadata?.name || user?.email?.split('@')[0] || 'Account'
  const email = user?.email || ''
  const initial = displayName.charAt(0).toUpperCase()

  const { status: billingStatus, creditsRemaining, creditsMax, isUnlimited, loading: billingLoading } = useBillingStatus()

  // Fetch the unified pending decision count for the sidebar badge.
  React.useEffect(() => {
    const fetchPending = async () => {
      const now = Date.now()
      if (pendingFetchInFlightRef.current || now - pendingFetchStartedAtRef.current < 60_000) return

      pendingFetchStartedAtRef.current = now
      pendingFetchInFlightRef.current = true
      try {
        const token = authHeader()
        if (!token) return
        const [brainResult, agentResult] = await Promise.allSettled([
          fetch('/api/brain/proposals?status=pending', { headers: { Authorization: token } }),
          fetch('/api/agents/suggestions?status=PENDING&limit=100', { headers: { Authorization: token } }),
        ])
        let count = 0
        if (brainResult.status === 'fulfilled' && brainResult.value.ok) {
          const data = await brainResult.value.json()
          count += typeof data.total === 'number' ? data.total : Array.isArray(data.proposals) ? data.proposals.length : 0
        }
        if (agentResult.status === 'fulfilled' && agentResult.value.ok) {
          const data = await agentResult.value.json()
          count += typeof data.total === 'number' ? data.total : Array.isArray(data.suggestions) ? data.suggestions.length : 0
        }
        setPendingProposals(count)
      } catch {
        // non-critical
      } finally {
        pendingFetchInFlightRef.current = false
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

  const billingTruth = getBillingDisplayTruth({
    plan: billingStatus?.plan,
    status: billingStatus?.status,
    hasActiveSubscription: billingStatus?.hasActiveSubscription,
    creditsRemaining: billingStatus?.credits?.remaining,
    creditsMax: billingStatus?.credits?.max,
    billingLoaded: !billingLoading,
    locale,
  })

  const isPaid = billingTruth.showManageSubscription
  const navGroups: NavGroupConfig[] = [
    {
      key: 'overview',
      labelAr: 'مساحة العمل',
      labelEn: 'Workspace',
      items: [
        { href: '/dashboard', labelAr: 'اليوم', labelEn: 'Today', icon: Icons.dashboard },
        { href: '/approvals', labelAr: 'الموافقات', labelEn: 'Approvals', icon: Icons.settings, badgeKey: pendingProposals > 0 ? `count:${pendingProposals}` : undefined, badgeColor: '#8B5CF6' },
      ],
    },
    {
      key: 'workflow',
      labelAr: 'مسار التسويق',
      labelEn: 'Marketing workflow',
      separatorBefore: true,
      items: [
        { href: '/brand', labelAr: 'Brand Brain', labelEn: 'Brand Brain', icon: Icons.brain },
        { href: '/strategy', labelAr: 'الاستراتيجية', labelEn: 'Strategy', icon: Icons.strategy },
        { href: '/campaigns', labelAr: 'الحملات', labelEn: 'Campaigns', icon: Icons.campaigns },
        { href: '/content-hub', labelAr: 'المحتوى', labelEn: 'Content', icon: Icons.media },
        { href: '/publish', labelAr: 'النشر', labelEn: 'Publish', icon: Icons.calendar },
        { href: '/analytics', labelAr: 'النتائج', labelEn: 'Results', icon: Icons.analytics },
      ],
    },
    {
      key: 'system',
      labelAr: 'النظام',
      labelEn: 'System',
      separatorBefore: true,
      items: [
        { href: '/automation', labelAr: 'الأتمتة', labelEn: 'Automation', icon: Icons.learning },
        { href: '/connections', labelAr: 'الربط', labelEn: 'Connections', icon: Icons.connections },
        { href: '/settings', labelAr: 'الإعدادات', labelEn: 'Settings', icon: Icons.settings },
      ],
    },
  ]

  return (
    <aside
      dir={dir}
      className={`h-full flex flex-col transition-all duration-200 ${collapsed ? 'w-16' : 'w-60'}`}
      style={{
        background:
          'radial-gradient(circle at 25% 4%, rgba(94,99,255,0.34), transparent 28%), linear-gradient(180deg, #050A1D 0%, #071126 52%, #020617 100%)',
        borderRight: '1px solid rgba(148,163,184,0.18)',
        boxShadow: '22px 0 70px rgba(2,6,23,0.22)',
      }}
    >

      {/* Logo */}
      <div className={`flex h-[74px] flex-shrink-0 items-center gap-3 px-4 ${collapsed ? 'justify-center px-0' : ''}`}
        style={{ borderBottom: '1px solid rgba(148,163,184,0.12)' }}>
        <NexusLogo />
        {!collapsed && (
          <div className="min-w-0">
            <div className="font-heading text-[20px] font-black leading-none tracking-[0.2em] text-white">
              NEXUS
            </div>
            <div className="mt-1 text-[8px] font-bold uppercase tracking-[0.24em] text-slate-500">
              AI MARKETING OS
            </div>
          </div>
        )}
      </div>

      {/* Scrollable nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-2" aria-label={t('sidebar.primaryNavigation')}>
        {navGroups.map((group) => (
          <div key={group.key} className="space-y-0.5">
            {group.separatorBefore && <div className="mx-2 my-2.5 h-px bg-white/10" />}
            {!collapsed && group.labelEn ? (
              <p className="px-3 pb-1.5 pt-1 text-[9px] font-black uppercase tracking-[0.16em] text-slate-500">
                {locale === 'ar' ? group.labelAr : group.labelEn}
              </p>
            ) : null}
            {group.items.map((item) => (
              <NavItem
                key={`${item.href}-${item.labelKey || item.labelEn || item.labelAr}`}
                href={item.href}
                label={item.labelKey ? t(item.labelKey) : (locale === 'ar' ? (item.labelAr || item.labelEn || '') : (item.labelEn || item.labelAr || ''))}
                icon={item.icon}
                badge={item.badgeKey?.startsWith('count:') ? item.badgeKey.slice('count:'.length) : item.badgeKey ? t(item.badgeKey) : undefined}
                badgeColor={item.badgeColor}
                dot={item.dot}
                {...sharedProps}
              />
            ))}
          </div>
        ))}

        {/* Legacy diagnostics stay out of primary navigation until they are real
            user-facing workflows: /sentinel, /vex, /brand/score-history. */}
      </nav>

      {/* Bottom section */}
      <div className="flex-shrink-0 space-y-1 px-3 pb-2.5"
        style={{ borderTop: '1px solid rgba(148,163,184,0.12)', paddingTop: '10px' }}>

        {/* Credits indicator / Upgrade CTA */}
        {!collapsed && billingLoading && (
          <Link href="/billing"
            data-ui="compact-billing-card"
            className="mb-1 flex flex-col gap-2 rounded-xl px-3 py-2.5 transition-all hover:bg-white/10"
            style={{
              background: 'linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0.055))',
              border: '1px solid rgba(148,163,184,0.20)',
              boxShadow: '0 10px 28px rgba(2,6,23,0.20)',
            }}>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black text-amber-200">{locale === 'ar' ? 'خطة NEXUS' : 'NEXUS Plan'}</span>
              <span className="rounded-md bg-white/10 px-2 py-0.5 text-[9px] font-black text-white">...</span>
            </div>
            <div className="flex items-center justify-between text-[10px] font-semibold text-slate-300">
              <span>{locale === 'ar' ? 'جار تحميل حالة الخطة' : 'Loading plan status'}</span>
              <span>{locale === 'ar' ? 'إدارة' : 'Manage'}</span>
            </div>
            <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
              <div className="h-full w-2/3 rounded-full bg-[linear-gradient(90deg,#7C83FF,#A78BFA)]" />
            </div>
          </Link>
        )}
        {!collapsed && !billingLoading && (
          <Link href="/billing"
            data-ui="compact-billing-card"
            className="mb-1 flex flex-col gap-2 rounded-xl px-3 py-2.5 transition-all hover:bg-white/10"
            style={{
              background: 'linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0.055))',
              border: '1px solid rgba(148,163,184,0.20)',
              boxShadow: '0 10px 28px rgba(2,6,23,0.20)',
            }}>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black text-amber-200">
                {isPaid ? getPlanDisplayName(billingStatus?.plan, locale) : (locale === 'ar' ? 'خطة NEXUS' : 'NEXUS Plan')}
              </span>
              {billingTruth.showUpgrade && !billingTruth.isUnknown && <span className="rounded-md bg-white/10 px-2 py-0.5 text-[9px] font-black text-white">Upgrade</span>}
            </div>
            <div className="flex items-center justify-between gap-3 text-[10px] font-semibold text-slate-300">
              <span className="truncate">
                {billingTruth.isUnknown
                  ? (locale === 'ar' ? 'حالة الخطة غير متاحة الآن' : 'Plan status unavailable')
                  : isUnlimited
                  ? (locale === 'ar' ? 'رصيد غير محدود' : 'Unlimited credits')
                  : billingTruth.isZeroCredits
                  ? (locale === 'ar' ? 'لا يوجد رصيد' : 'No credits left')
                  : (locale === 'ar' ? `${creditsRemaining} رصيد متبقٍ` : `${creditsRemaining} credits left`)}
              </span>
              <span className="shrink-0 font-black text-white">
                {isPaid ? (locale === 'ar' ? 'إدارة' : 'Manage') : (locale === 'ar' ? 'ترقية' : 'Upgrade')}
              </span>
            </div>
            {!isUnlimited && (
              <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.max(0, Math.min(100, (creditsRemaining / Math.max(creditsMax, 1)) * 100))}%`,
                    background: billingTruth.isZeroCredits ? '#EF4444' : billingTruth.isLowCredits ? '#F59E0B' : 'linear-gradient(90deg,#7C83FF,#A78BFA)',
                  }} />
              </div>
            )}
          </Link>
        )}

        {/* Collapse toggle */}
        <button onClick={() => setCollapsed(c => !c)}
          className="mt-0.5 flex h-8 w-full items-center justify-center rounded-lg text-slate-400 transition-all duration-150 hover:bg-white/10 hover:text-white"
          title={collapsed ? t('sidebar.expand') : t('sidebar.collapse')}>
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
            className={`transition-transform duration-200 ${collapsed ? 'rotate-180' : ''}`}>
            <path d="M9 2L4 7l5 5" />
          </svg>
        </button>

        {/* Language */}
        {!collapsed && (
          <button
            type="button"
            aria-label={locale === 'ar' ? 'Switch to English' : 'Switch to Arabic'}
            onClick={() => setLocale(locale === 'ar' ? 'en' : 'ar')}
            className="flex h-8 w-full items-center gap-2 rounded-lg px-3 text-[10px] font-bold text-slate-400 transition-all hover:bg-white/10 hover:text-white">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
            <span>{t('language.switchLabel')}</span>
          </button>
        )}

        {/* User menu */}
        <div className="relative mt-0.5">
          <button onClick={() => setUserMenuOpen(o => !o)}
            className={`flex h-9 w-full items-center gap-2.5 rounded-lg px-2 transition-all duration-150 hover:bg-white/10 ${collapsed ? 'justify-center' : ''}`}>
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-black"
              style={{ background: 'rgba(124,131,255,0.18)', border: '1px solid rgba(165,180,252,0.24)', color: '#C7D2FE' }}>
              {initial}
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <div className="truncate text-[11px] font-black text-white">{displayName}</div>
                <div className="truncate text-[9px] text-slate-500">{email}</div>
              </div>
            )}
          </button>

          {userMenuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
              <div className="absolute bottom-full left-0 z-50 mb-2 w-52 overflow-hidden rounded-[16px] border border-slate-200 bg-white shadow-[0_20px_50px_rgba(15,23,42,0.20)]">
                <div className="px-3 py-3" style={{ borderBottom: '1px solid rgba(15,23,42,0.08)' }}>
                  <div className="text-[12px] font-semibold truncate text-slate-950">{displayName}</div>
                  <div className="text-[11px] truncate text-slate-500">{email}</div>
                </div>
                <div className="py-1.5 px-1">
                  {[
                    { href: '/settings', label: t('sidebar.settings') },
                    { href: '/billing',  label: t('sidebar.billing') },
                  ].map(item => (
                    <Link key={item.href} href={item.href} onClick={() => { setUserMenuOpen(false); click() }}
                      className="flex items-center px-2.5 py-2 rounded-[8px] text-[12px] transition-all text-slate-600 hover:text-slate-950 hover:bg-slate-100">
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
