import Sidebar from '@/components/ui/Sidebar'
import Topbar from '@/components/ui/Topbar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex" style={{ background: '#020204' }}>
      <Sidebar />
      <main className="main-with-sidebar flex-1 mr-0 lg:mr-64">
        <Topbar />
        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  )
}
