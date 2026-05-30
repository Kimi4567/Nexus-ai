'use client'

import { useState } from 'react'
import Sidebar from './Sidebar'

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

  const sidebarW = collapsed ? 'w-16' : 'w-56'

  return (
    <div dir="ltr" className="min-h-screen flex" style={{ background: '#030309' }}>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile top bar */}
      <div
        dir="ltr"
        className="fixed top-0 left-0 right-0 z-30 md:hidden h-12 flex items-center justify-between px-4 border-b border-[#191918]"
        style={{ background: 'rgba(8,8,7,0.92)', backdropFilter: 'blur(20px)' }}
      >
        <div className="flex items-center gap-2">
          <svg width="22" height="22" viewBox="0 0 28 28" fill="none">
            <rect width="28" height="28" rx="7" fill="#FF9500" />
            <path d="M7 7L14 21L21 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M7 7H21" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
          <span className="font-bold text-white text-[14px]">Nexus</span>
        </div>
        <button
          onClick={() => setMobileOpen(true)}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-white/5"
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

      {/* Main content — dir="rtl" so all pages inherit RTL regardless of AppShell being ltr */}
      <main dir="rtl" className="flex-1 min-h-screen overflow-y-auto transition-all duration-200 pt-12 md:pt-0">
        {children}
      </main>
    </div>
  )
}
