'use client'

import Sidebar from './Sidebar'

interface AppShellProps {
  children: React.ReactNode
}

/**
 * AppShell — wraps every authenticated page with the persistent sidebar.
 * Usage: replace <NavBar /> + outer div with <AppShell>...</AppShell>
 */
export default function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex">
      <Sidebar />
      {/* Main content area — offset by sidebar width */}
      <main className="flex-1 min-h-screen overflow-y-auto pl-56 transition-all duration-200">
        {children}
      </main>
    </div>
  )
}
