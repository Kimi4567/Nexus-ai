'use client'

import { useAuth } from '@/lib/auth-context'
import { Bell, Search } from 'lucide-react'
import Link from 'next/link'

export default function Topbar() {
  const { user } = useAuth()

  return (
    <header className="glass sticky top-0 z-30 px-6 py-4 flex items-center justify-between" style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
      <div className="flex items-center gap-4 flex-1">
        <div
          className="input-nexus relative flex min-h-10 max-w-md flex-1 items-center gap-2 pr-10 text-text-muted"
          aria-label="البحث غير متاح حالياً"
          title="البحث العام قيد الإعداد"
        >
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <span className="text-sm">البحث العام قيد الإعداد</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <Link href="/analytics" aria-label="فتح مركز التحليلات" className="relative p-2 rounded-xl hover:bg-white/5 transition-colors">
          <Bell className="w-5 h-5 text-text-secondary" />
          <span className="absolute top-1 left-1 w-2 h-2 bg-red-500 rounded-full" />
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber to-cyan flex items-center justify-center text-black font-bold text-sm">
            {(user?.email?.charAt(0).toUpperCase() || 'U')}
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-medium text-text-primary">{(user?.user_metadata?.name as string) || user?.email?.split('@')[0] || 'مستخدم'}</p>
            <p className="text-xs text-text-muted">Pro</p>
          </div>
        </div>
      </div>
    </header>
  )
}
