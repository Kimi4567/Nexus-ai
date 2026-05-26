'use client'

import { useState } from 'react'
import Sidebar from './Sidebar'

interface AppShellProps {
  children: React.ReactNode
}

/**
 * AppShell — atmospheric authenticated layout.
 * Owns sidebar collapse state so main content shifts correctly.
 */
export default function AppShell({ children }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="min-h-screen bg-atmospheric flex">
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
      <main
        className={`flex-1 min-h-screen overflow-y-auto transition-all duration-200 ${
          collapsed ? 'pl-16' : 'pl-56'
        }`}
      >
        {children}
      </main>
    </div>
  )
}
