'use client'

import Sidebar from '../components/Sidebar'
import Topbar from '../components/Topbar'
import ProtectedRoute from '../components/ProtectedRoute'

export const dynamic = 'force-dynamic'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <div className="min-h-screen flex" style={{ background: '#020204' }}>
        <Sidebar />
        <main className="main-with-sidebar flex-1 mr-0 lg:mr-64">
          <Topbar />
          <div className="p-6">
            {children}
          </div>
        </main>
      </div>
    </ProtectedRoute>
  )
}
