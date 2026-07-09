'use client'

import { useState } from 'react'
import Sidebar from './Sidebar'
import { useI18n } from '@/lib/i18n-context'

interface AppShellProps {
  children: React.ReactNode
}

/**
 * AppShell — authenticated layout.
 *
 * Desktop: persistent sidebar via flex spacer pattern (no transform hack).
 *   - Sidebar wrapper: fixed top-0 left-0 h-full → always visible
 *   - Spacer div: hidden md:block flex-shrink-0 w-56/w-16 → reserves space in flex flow
 *   - Main: flex-1 → fills remaining space cleanly
 *
 * Mobile: hamburger drawer
 *   - Sidebar wrapper: translate-x-full when closed → off screen
 *   - translate-x-0 when open → slides in
 *   - NO md:static / md:translate tricks that break fixed positioning
 */
export default function AppShell({ children }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const { dir, t } = useI18n()

  const sidebarW = collapsed ? 'w-16' : 'w-60'

  return (
    <div dir="ltr" className="min-h-screen flex bg-[#F4F7FB]">

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          aria-hidden="true"
          className="fixed inset-0 z-20 bg-slate-950/20 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile top bar */}
      <div
        dir="ltr"
        className="fixed top-0 left-0 right-0 z-30 md:hidden h-12 flex items-center justify-between px-4"
        style={{
          background: 'rgba(255,255,255,0.92)',
          borderBottom: '1px solid var(--nx-border)',
          backdropFilter: 'blur(20px)',
        }}
      >
        <div className="flex items-center gap-2">
          <svg width="22" height="22" viewBox="0 0 30 30" fill="none">
            <defs>
              <radialGradient id="mobileLogoGlow" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(15 15) rotate(90) scale(15)">
                <stop stopColor="#C7D2FE" />
                <stop offset="0.45" stopColor="#7C83FF" />
                <stop offset="1" stopColor="#111A4D" />
              </radialGradient>
            </defs>
            <circle cx="15" cy="15" r="15" fill="url(#mobileLogoGlow)" />
            <path d="M15 4.5C16.45 10.95 19.05 13.55 25.5 15C19.05 16.45 16.45 19.05 15 25.5C13.55 19.05 10.95 16.45 4.5 15C10.95 13.55 13.55 10.95 15 4.5Z" fill="#fff" />
          </svg>
          <span className="font-bold tracking-[0.16em] text-slate-950 text-[14px]">NEXUS</span>
        </div>
        <button
          type="button"
          aria-label={t('sidebar.openNavigation')}
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen(true)}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-950 hover:bg-slate-100"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M2 4h12M2 8h12M2 12h12" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* ─── Sidebar wrapper ───────────────────────────────────────────────
          Always fixed to viewport — no md:static trick that breaks fixed children.
          Mobile: slides off-screen via -translate-x-full unless mobileOpen.
          Desktop: always visible (md:translate-x-0 overrides mobile default).
      ──────────────────────────────────────────────────────────────────── */}
      <div className={`
        fixed top-0 left-0 h-full z-30
        transition-transform duration-200
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <Sidebar
          collapsed={collapsed}
          setCollapsed={setCollapsed}
          onMobileClose={() => setMobileOpen(false)}
        />
      </div>

      {/* ─── Flex spacer ────────────────────────────────────────────────────
          Invisible div that occupies sidebar width in flex flow on desktop.
          This is what pushes main content to the right — NOT padding or transform.
      ──────────────────────────────────────────────────────────────────── */}
      <div className={`hidden md:block flex-shrink-0 transition-all duration-200 ${sidebarW}`} />

      {/* Main content — dir driven by locale from useI18n() */}
      <main dir={dir} className="min-w-0 flex-1 min-h-screen overflow-y-visible transition-all duration-200 pt-12 md:pt-0">
        {children}
      </main>
    </div>
  )
}
