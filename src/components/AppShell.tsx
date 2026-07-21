'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Sidebar from './Sidebar'
import { useI18n } from '@/lib/i18n-context'

interface AppShellProps {
  children: React.ReactNode
}

const SIDEBAR_PREFERENCE_KEY = 'nexus.sidebar.collapsed'
const MOBILE_SIDEBAR_BREAKPOINT = 768
// Keep labels visible on normal laptop screens. The previous 1680px threshold
// collapsed the navigation for almost every real user and reduced the entire
// product to an unexplained column of icons.
const COMPACT_SIDEBAR_BREAKPOINT = 1120

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
  // Start compact so the first authenticated paint never squeezes the
  // workspace before the real viewport and saved preference are available.
  const [collapsed, setCollapsed] = useState(true)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [mobileViewport, setMobileViewport] = useState(false)
  const [compactViewport, setCompactViewport] = useState(false)
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null)
  const mobileSidebarRef = useRef<HTMLDivElement>(null)
  const { dir, t } = useI18n()

  const closeMobileMenu = useCallback(() => {
    setMobileOpen(false)
    // Wait until React removes `inert` from the top bar before restoring the
    // keyboard user's focus to the control that opened the drawer.
    window.setTimeout(() => mobileMenuButtonRef.current?.focus({ preventScroll: true }), 50)
  }, [])

  useEffect(() => {
    let wasCompact = window.innerWidth < COMPACT_SIDEBAR_BREAKPOINT
    const applyResponsiveSidebar = (initial = false) => {
      const isCompact = window.innerWidth < COMPACT_SIDEBAR_BREAKPOINT
      setMobileViewport(window.innerWidth < MOBILE_SIDEBAR_BREAKPOINT)
      setCompactViewport(isCompact)

      if (isCompact) {
        // Collapse only when first entering compact mode. A resize that stays
        // inside the same breakpoint must not immediately undo the user's
        // explicit Expand action.
        if (initial || !wasCompact) setCollapsed(true)
        wasCompact = true
        return
      }

      const savedPreference = window.localStorage.getItem(SIDEBAR_PREFERENCE_KEY)
      setCollapsed(savedPreference === 'true')
      wasCompact = false
    }

    applyResponsiveSidebar(true)
    const onResize = () => applyResponsiveSidebar(false)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    if (!mobileViewport || !mobileOpen) return

    const drawer = mobileSidebarRef.current
    const focusableSelector = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
    window.requestAnimationFrame(() => {
      drawer?.querySelector<HTMLElement>(focusableSelector)?.focus()
    })

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeMobileMenu()
        return
      }
      if (event.key !== 'Tab' || !drawer) return

      const focusable = Array.from(drawer.querySelectorAll<HTMLElement>(focusableSelector))
        .filter(element => !element.hasAttribute('disabled') && element.getAttribute('aria-hidden') !== 'true')
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [closeMobileMenu, mobileOpen, mobileViewport])

  const setCollapsedWithPreference: typeof setCollapsed = (nextValue) => {
    setCollapsed((currentValue) => {
      const resolvedValue = typeof nextValue === 'function' ? nextValue(currentValue) : nextValue
      if (!compactViewport || resolvedValue) {
        window.localStorage.setItem(SIDEBAR_PREFERENCE_KEY, String(resolvedValue))
      }
      return resolvedValue
    })
  }

  const layoutSidebarCollapsed = collapsed || compactViewport
  const sidebarW = layoutSidebarCollapsed ? 'w-16' : 'w-60'
  const displayedSidebarCollapsed = mobileOpen ? false : collapsed

  return (
    <div dir="ltr" className="nx-os-shell flex min-h-screen">

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          aria-hidden="true"
          className="fixed inset-0 z-20 bg-slate-950/20 backdrop-blur-sm md:hidden"
          onClick={closeMobileMenu}
        />
      )}

      {/* On medium desktop widths the expanded sidebar behaves as a temporary
          drawer, so viewport breakpoints cannot squeeze workspace card grids. */}
      {compactViewport && !collapsed && !mobileOpen && (
        <button
          type="button"
          aria-label={t('sidebar.collapse')}
          className="fixed inset-0 z-20 hidden bg-slate-950/20 backdrop-blur-[1px] md:block"
          onClick={() => setCollapsedWithPreference(true)}
        />
      )}

      {/* Mobile top bar */}
      <div
        dir="ltr"
        aria-hidden={mobileOpen ? true : undefined}
        inert={mobileOpen ? true : undefined}
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
          ref={mobileMenuButtonRef}
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
      <div
        ref={mobileSidebarRef}
        role={mobileViewport ? 'dialog' : undefined}
        aria-modal={mobileViewport && mobileOpen ? true : undefined}
        aria-label={mobileViewport ? t('sidebar.primaryNavigation') : undefined}
        aria-hidden={mobileViewport && !mobileOpen ? true : undefined}
        inert={mobileViewport && !mobileOpen ? true : undefined}
        className={`
        fixed top-0 left-0 h-full z-30
        transition-transform duration-200
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <Sidebar
          collapsed={displayedSidebarCollapsed}
          setCollapsed={setCollapsedWithPreference}
          onMobileClose={() => {
            closeMobileMenu()
            if (compactViewport) setCollapsed(true)
          }}
        />
      </div>

      {/* ─── Flex spacer ────────────────────────────────────────────────────
          Invisible div that occupies sidebar width in flex flow on desktop.
          This is what pushes main content to the right — NOT padding or transform.
      ──────────────────────────────────────────────────────────────────── */}
      <div className={`hidden md:block flex-shrink-0 transition-all duration-200 ${sidebarW}`} />

      {/* Main content — dir driven by locale from useI18n() */}
      <main
        dir={dir}
        aria-hidden={mobileViewport && mobileOpen ? true : undefined}
        inert={mobileViewport && mobileOpen ? true : undefined}
        className="nx-os-main min-h-screen min-w-0 flex-1 overflow-y-visible pt-12 transition-all duration-200 md:pt-0"
      >
        {children}
      </main>
    </div>
  )
}
