'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'
import {
  Users, CreditCard, TrendingUp, RefreshCw,
  Plus, Minus, Search, ShieldAlert, X, Check,
  Crown, Zap, Building2,
} from 'lucide-react'

/* ─── Types ─────────────────────────────────── */
interface AdminUser {
  id: string
  email: string
  name: string | null
  role: string
  subscriptionStatus: string
  aiCredits: number
  stripeCustomerId: string | null
  createdAt: string
  lastLoginAt: string | null
  company: string | null
  _count: { workspaces: number }
}

interface PlanCount {
  subscriptionStatus: string
  _count: { _all: number }
}

/* ─── Helpers ────────────────────────────────── */
function planColor(status: string) {
  switch (status) {
    case 'ACTIVE':   return 'text-emerald-400 bg-emerald-400/10'
    case 'FREE':     return 'text-slate-400 bg-slate-400/10'
    case 'PAST_DUE': return 'text-amber-400 bg-amber-400/10'
    case 'CANCELLED':return 'text-red-400 bg-red-400/10'
    default:         return 'text-slate-400 bg-slate-400/10'
  }
}

function planIcon(status: string) {
  switch (status) {
    case 'ACTIVE':  return <Crown size={12} />
    case 'FREE':    return <Zap size={12} />
    default:        return <Building2 size={12} />
  }
}

function fmt(date: string | null) {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/* ─── Credits Modal ──────────────────────────── */
function CreditsModal({
  user,
  token,
  onClose,
  onSuccess,
}: {
  user: AdminUser
  token: string
  onClose: () => void
  onSuccess: (userId: string, newCredits: number) => void
}) {
  const [delta, setDelta] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit(sign: 1 | -1) {
    const n = parseInt(delta)
    if (!n || n <= 0) { setError('Enter a positive number'); return }
    setLoading(true); setError('')
    try {
      const res = await fetch(`/api/admin/users/${user.id}/credits`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ delta: sign * n }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      onSuccess(user.id, data.user.aiCredits)
      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#0F1332] border border-[rgba(139,92,246,0.2)] rounded-2xl w-full max-w-sm p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-heading text-[16px] font-bold text-white">Adjust Credits</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="mb-5 p-3 rounded-xl bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)]">
          <p className="text-[12px] text-slate-400">{user.email}</p>
          <p className="text-[20px] font-bold text-white mt-1">{user.aiCredits} <span className="text-[13px] font-normal text-slate-400">credits</span></p>
        </div>

        <input
          type="number"
          min="1"
          placeholder="Amount (e.g. 50)"
          value={delta}
          onChange={e => setDelta(e.target.value)}
          className="w-full bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-xl px-4 py-3 text-white text-[14px] placeholder:text-slate-500 focus:outline-none focus:border-[rgba(139,92,246,0.5)] mb-3"
        />

        {error && <p className="text-red-400 text-[12px] mb-3">{error}</p>}

        <div className="flex gap-3">
          <button
            onClick={() => submit(1)}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded-xl py-3 text-[13px] font-semibold transition-colors disabled:opacity-50">
            <Plus size={14} /> Grant
          </button>
          <button
            onClick={() => submit(-1)}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 rounded-xl py-3 text-[13px] font-semibold transition-colors disabled:opacity-50">
            <Minus size={14} /> Deduct
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── Main Page ──────────────────────────────── */
export default function AdminPage() {
  const { user, session, loading: authLoading } = useAuth()
  const router = useRouter()

  const [users, setUsers]           = useState<AdminUser[]>([])
  const [planCounts, setPlanCounts] = useState<PlanCount[]>([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState('')
  const [search, setSearch]         = useState('')
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null)

  const token = session?.access_token ?? ''

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/admin/users', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.status === 403) { router.push('/dashboard'); return }
      if (!res.ok) throw new Error('Failed to load')
      const data = await res.json()
      setUsers(data.users)
      setPlanCounts(data.planCounts)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error loading users')
    } finally {
      setLoading(false)
    }
  }, [token, router])

  useEffect(() => {
    if (!authLoading && !user) { router.push('/auth/login'); return }
    if (!authLoading && token) load()
  }, [authLoading, user, token, load, router])

  function handleCreditSuccess(userId: string, newCredits: number) {
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, aiCredits: newCredits } : u))
  }

  const filtered = users.filter(u =>
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    (u.name ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (u.company ?? '').toLowerCase().includes(search.toLowerCase())
  )

  // Summary stats
  const totalUsers   = users.length
  const paidUsers    = users.filter(u => u.subscriptionStatus === 'ACTIVE').length
  const freeUsers    = users.filter(u => u.subscriptionStatus === 'FREE').length
  const totalCredits = users.reduce((s, u) => s + u.aiCredits, 0)

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-[#0A0E27] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw size={22} className="text-accent-purple animate-spin" />
          <p className="text-[13px] text-slate-400">Loading admin data…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0A0E27] text-white">
      {/* Header */}
      <div className="border-b border-[rgba(255,255,255,0.06)] bg-[rgba(6,7,26,0.97)] backdrop-blur sticky top-0 z-20">
        <div className="max-w-[1400px] mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[rgba(139,92,246,0.2)] flex items-center justify-center">
              <ShieldAlert size={16} className="text-accent-purple" />
            </div>
            <div>
              <p className="font-heading text-[15px] font-bold text-white">Admin Dashboard</p>
              <p className="text-[11px] text-slate-500">NEXUS AI Operations</p>
            </div>
          </div>
          <button onClick={load} className="flex items-center gap-2 text-[12px] text-slate-400 hover:text-white transition-colors border border-[rgba(255,255,255,0.08)] hover:border-[rgba(255,255,255,0.2)] px-3 py-1.5 rounded-lg">
            <RefreshCw size={12} /> Refresh
          </button>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-6 py-8">

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-[13px]">{error}</div>
        )}

        {/* Summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { icon: Users,      label: 'Total Users',    value: totalUsers,   color: '#8B5CF6' },
            { icon: Crown,      label: 'Paid Users',     value: paidUsers,    color: '#10B981' },
            { icon: Zap,        label: 'Free Users',     value: freeUsers,    color: '#FFB800' },
            { icon: CreditCard, label: 'Total Credits',  value: totalCredits, color: '#00D4FF' },
          ].map(card => (
            <div key={card.label} className="rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${card.color}18` }}>
                  <card.icon size={16} style={{ color: card.color }} />
                </div>
                <p className="text-[12px] text-slate-400">{card.label}</p>
              </div>
              <p className="font-mono text-[28px] font-bold text-white">{card.value.toLocaleString()}</p>
            </div>
          ))}
        </div>

        {/* Plan breakdown */}
        <div className="mb-8 p-5 rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)]">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={15} className="text-accent-purple" />
            <p className="font-heading text-[14px] font-semibold text-white">Subscription Breakdown</p>
          </div>
          <div className="flex flex-wrap gap-3">
            {planCounts.map(pc => (
              <div key={pc.subscriptionStatus}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[12px] font-semibold border border-[rgba(255,255,255,0.06)] ${planColor(pc.subscriptionStatus)}`}>
                {planIcon(pc.subscriptionStatus)}
                {pc.subscriptionStatus} — {pc._count._all}
              </div>
            ))}
          </div>
        </div>

        {/* Search + Table */}
        <div className="rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] overflow-hidden">
          <div className="p-5 border-b border-[rgba(255,255,255,0.06)] flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Search users…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] rounded-xl pl-9 pr-4 py-2.5 text-[13px] text-white placeholder:text-slate-500 focus:outline-none focus:border-[rgba(139,92,246,0.4)]"
              />
            </div>
            <p className="text-[12px] text-slate-500 ml-auto">{filtered.length} users</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-[rgba(255,255,255,0.04)]">
                  {['User', 'Plan', 'Credits', 'Workspaces', 'Joined', 'Last Login', ''].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-[11px] font-mono uppercase tracking-wider text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((u, i) => (
                  <tr key={u.id}
                    className={`border-b border-[rgba(255,255,255,0.03)] hover:bg-[rgba(139,92,246,0.04)] transition-colors ${i % 2 === 0 ? '' : 'bg-[rgba(255,255,255,0.01)]'}`}>
                    <td className="px-5 py-4">
                      <p className="text-white font-medium">{u.name || '—'}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">{u.email}</p>
                      {u.company && <p className="text-[11px] text-slate-600 mt-0.5">{u.company}</p>}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${planColor(u.subscriptionStatus)}`}>
                        {planIcon(u.subscriptionStatus)} {u.subscriptionStatus}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="font-mono text-white font-bold">{u.aiCredits}</span>
                    </td>
                    <td className="px-5 py-4 text-slate-400">
                      {u._count.workspaces}
                    </td>
                    <td className="px-5 py-4 text-slate-400 whitespace-nowrap">
                      {fmt(u.createdAt)}
                    </td>
                    <td className="px-5 py-4 text-slate-400 whitespace-nowrap">
                      {fmt(u.lastLoginAt)}
                    </td>
                    <td className="px-5 py-4">
                      <button
                        onClick={() => setSelectedUser(u)}
                        className="flex items-center gap-1.5 text-[11px] font-semibold text-accent-purple hover:text-white transition-colors border border-[rgba(139,92,246,0.2)] hover:border-[rgba(139,92,246,0.5)] px-2.5 py-1.5 rounded-lg">
                        <CreditCard size={11} /> Credits
                      </button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center text-slate-500 text-[13px]">
                      No users found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Make yourself admin hint */}
        <p className="mt-6 text-[11px] text-slate-600 text-center">
          To grant admin access: <code className="bg-[rgba(255,255,255,0.05)] px-1.5 py-0.5 rounded text-slate-400">UPDATE "User" SET role = 'ADMIN' WHERE email = 'your@email.com';</code>
        </p>

      </div>

      {selectedUser && (
        <CreditsModal
          user={selectedUser}
          token={token}
          onClose={() => setSelectedUser(null)}
          onSuccess={handleCreditSuccess}
        />
      )}
    </div>
  )
}
