'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '../hooks/useAuth'
import { LayoutDashboard, Video, Megaphone, BarChart3, Shield, FolderKanban, Settings, LogOut } from 'lucide-react'

const navItems = [
  { label: 'الرئيسية', href: '/dashboard', icon: LayoutDashboard },
  { label: 'الاستوديو', href: '/studio', icon: Video },
  { label: 'VEX إعلانات', href: '/vex', icon: Megaphone },
  { label: 'تحليلات', href: '/analytics', icon: BarChart3 },
  { label: 'Sentinel', href: '/sentinel', icon: Shield },
  { label: 'حملات', href: '/campaigns', icon: FolderKanban },
  { label: 'إعدادات', href: '/settings', icon: Settings },
]

export default function Sidebar() {
  const pathname = usePathname()
  const { user, logout } = useAuth()

  return (
    <aside className="sidebar-desktop fixed right-0 top-0 h-screen w-64 z-40 glass-strong flex flex-col" style={{ background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(30px)', borderLeft: '1px solid rgba(255,255,255,0.08)' }}>
      <div className="p-6 border-b border-white/10">
        <Link href="/dashboard" className="flex items-center gap-2 text-lg font-bold gradient-text">
          <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber to-cyan flex items-center justify-center text-black text-sm font-bold">N</span>
          NEXUS AI
        </Link>
      </div>

      <nav className="flex-1 py-4 px-3 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? 'bg-amber/10 text-amber border border-amber/20'
                  : 'text-text-secondary hover:text-text-primary hover:bg-white/5'
              }`}
            >
              <Icon className="w-5 h-5" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="p-4 border-t border-white/10">
        <div className="mb-3 px-3 py-2 rounded-xl bg-white/5">
          <p className="text-xs text-text-muted">مسجل كـ</p>
          <p className="text-sm font-medium text-text-primary">{user?.name || 'مستخدم'}</p>
          <p className="text-xs text-amber">{user?.plan || 'Starter'}</p>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-red-400 hover:bg-red-500/10 transition-all"
        >
          <LogOut className="w-5 h-5" />
          خروج
        </button>
      </div>
    </aside>
  )
}
