'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'
import {
  Users, CreditCard, TrendingUp, RefreshCw, Plus, Minus,
  Search, ShieldAlert, X, Crown, Zap, Building2, Trash2,
  MoreVertical, Download, BarChart3, Activity, ChevronDown,
  Check, AlertTriangle, ExternalLink, Copy, Shield,
} from 'lucide-react'

/* ─── Types ──────────────────────────────────────────────── */
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
  campaignCount: number
  _count: { workspaces: number }
}

interface PlanCount {
  subscriptionStatus: string
  _count: { _all: number }
}

interface RecentSignup {
  createdAt: string
  subscriptionStatus: string
}

/* ─── Constants ──────────────────────────────────────────── */
const PLAN_PRICES: Record<string, number> = {
  ACTIVE: 49,
}

const SUBSCRIPTION_OPTIONS = ['FREE', 'ACTIVE', 'PAST_DUE', 'CANCELLED', 'EXPIRED']

/* ─── Helpers ────────────────────────────────────────────── */
function planColor(status: string) {
  switch (status) {
    case 'ACTIVE':    return 'text-emerald-400 bg-emerald-400/10 border-emerald-500/20'
    case 'FREE':      return 'text-slate-400 bg-slate-400/8 border-slate-500/15'
    case 'PAST_DUE':  return 'text-amber-400 bg-amber-400/10 border-amber-500/20'
    case 'CANCELLED': return 'text-red-400 bg-red-400/10 border-red-500/20'
    case 'EXPIRED':   return 'text-orange-400 bg-orange-400/10 border-orange-500/20'
    default:          return 'text-slate-400 bg-slate-400/8 border-slate-500/15'
  }
}

function planDot(status: string) {
  switch (status) {
    case 'ACTIVE':    return 'bg-emerald-400'
    case 'FREE':      return 'bg-slate-500'
    case 'PAST_DUE':  return 'bg-amber-400'
    case 'CANCELLED': return 'bg-red-400'
    default:          return 'bg-slate-500'
  }
}

function fmt(date: string | null) {
  if (!date) return '—'
  const d = new Date(date)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: diffDays > 365 ? 'numeric' : undefined })
}

function exportCSV(users: AdminUser[]) {
  const headers = ['Email', 'Name', 'Company', 'Plan', 'Credits', 'Workspaces', 'Campaigns', 'Joined', 'Last Login', 'Role']
  const rows = users.map(u => [
    u.email,
    u.name || '',
    u.company || '',
    u.subscriptionStatus,
    u.aiCredits,
    u._count.workspaces,
    u.campaignCount || 0,
    new Date(u.createdAt).toISOString().split('T')[0],
    u.lastLoginAt ? new Date(u.lastLoginAt).toISOString().split('T')[0] : '',
    u.role,
  ])
  const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `nexus-users-${new Date().toISOString().split('T')[0]}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

/* ─── Stat Card ──────────────────────────────────────────── */
function StatCard({ icon: Icon, label, value, sub, color, trend }: {
  icon: React.ElementType
  label: string
  value: string | number
  sub?: string
  color: string
  trend?: string
}) {
  return (
    <div className="rounded-2xl p-5 border"
      style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.06)' }}>
      <div className="flex items-center justify-between mb-4">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: `${color}18` }}>
          <Icon size={17} style={{ color }} />
        </div>
        {trend && (
          <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full">
            {trend}
          </span>
        )}
      </div>
      <p className="font-mono text-[30px] font-bold text-white leading-none mb-1">{value}</p>
      <p className="text-[12px] text-slate-400">{label}</p>
      {sub && <p className="text-[11px] text-slate-600 mt-0.5">{sub}</p>}
    </div>
  )
}

/* ─── Credits Modal ──────────────────────────────────────── */
function CreditsModal({ user, token, onClose, onSuccess }: {
  user: AdminUser; token: string
  onClose: () => void
  onSuccess: (userId: string, newCredits: number) => void
}) {
  const [delta, setDelta] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => { inputRef.current?.focus() }, [])

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
    } finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="rounded-2xl w-full max-w-sm p-6 shadow-2xl"
        style={{ background: '#0F1332', border: '1px solid rgba(139,92,246,0.25)' }}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-[16px] font-bold text-white">Adjust Credits</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">{user.email}</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/5 transition-all">
            <X size={15} />
          </button>
        </div>

        <div className="mb-5 p-4 rounded-xl flex items-center justify-between"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div>
            <p className="text-[11px] text-slate-500">Current balance</p>
            <p className="text-[28px] font-bold text-white font-mono">{user.aiCredits}</p>
          </div>
          <CreditCard size={28} className="text-purple-400 opacity-40" />
        </div>

        <input
          ref={inputRef}
          type="number" min="1" placeholder="Amount (e.g. 50)"
          value={delta} onChange={e => setDelta(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit(1)}
          className="w-full rounded-xl px-4 py-3 text-white text-[14px] placeholder:text-slate-500 focus:outline-none mb-3"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
        />

        {error && (
          <div className="flex items-center gap-2 text-red-400 text-[12px] mb-3 bg-red-400/10 rounded-lg px-3 py-2">
            <AlertTriangle size={12} /> {error}
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={() => submit(1)} disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl py-3 text-[13px] font-semibold transition-all disabled:opacity-50"
            style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', color: '#10B981' }}>
            <Plus size={14} /> Grant
          </button>
          <button onClick={() => submit(-1)} disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl py-3 text-[13px] font-semibold transition-all disabled:opacity-50"
            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#EF4444' }}>
            <Minus size={14} /> Deduct
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── Change Plan Modal ──────────────────────────────────── */
function ChangePlanModal({ user, token, onClose, onSuccess }: {
  user: AdminUser; token: string
  onClose: () => void
  onSuccess: (userId: string, newStatus: string) => void
}) {
  const [selected, setSelected] = useState(user.subscriptionStatus)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    if (selected === user.subscriptionStatus) { onClose(); return }
    setLoading(true); setError('')
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ subscriptionStatus: selected }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      onSuccess(user.id, data.user.subscriptionStatus)
      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="rounded-2xl w-full max-w-sm p-6 shadow-2xl"
        style={{ background: '#0F1332', border: '1px solid rgba(139,92,246,0.25)' }}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-[16px] font-bold text-white">Change Plan</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">{user.email}</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/5 transition-all">
            <X size={15} />
          </button>
        </div>

        <div className="space-y-2 mb-5">
          {SUBSCRIPTION_OPTIONS.map(opt => (
            <button key={opt} onClick={() => setSelected(opt)}
              className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-[13px] transition-all"
              style={{
                background: selected === opt ? 'rgba(139,92,246,0.12)' : 'rgba(255,255,255,0.03)',
                border: selected === opt ? '1px solid rgba(139,92,246,0.35)' : '1px solid rgba(255,255,255,0.06)',
              }}>
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${planDot(opt)}`} />
                <span className="font-semibold text-white">{opt}</span>
              </div>
              {selected === opt && <Check size={14} className="text-purple-400" />}
            </button>
          ))}
        </div>

        {error && (
          <div className="flex items-center gap-2 text-red-400 text-[12px] mb-3 bg-red-400/10 rounded-lg px-3 py-2">
            <AlertTriangle size={12} /> {error}
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl text-[13px] font-semibold text-slate-400 hover:text-white transition-colors"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
            Cancel
          </button>
          <button onClick={submit} disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[13px] font-bold transition-all disabled:opacity-50"
            style={{ background: 'rgba(139,92,246,0.2)', border: '1px solid rgba(139,92,246,0.4)', color: '#A78BFA' }}>
            {loading ? <RefreshCw size={13} className="animate-spin" /> : <Check size={13} />}
            Apply
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── Delete Confirm Modal ───────────────────────────────── */
function DeleteModal({ user, token, onClose, onSuccess }: {
  user: AdminUser; token: string
  onClose: () => void
  onSuccess: (userId: string) => void
}) {
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    if (confirm !== user.email) return
    setLoading(true); setError('')
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      onSuccess(user.id)
      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="rounded-2xl w-full max-w-sm p-6 shadow-2xl"
        style={{ background: '#1a0a0a', border: '1px solid rgba(239,68,68,0.3)' }}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-red-500/15 flex items-center justify-center flex-shrink-0">
            <Trash2 size={18} className="text-red-400" />
          </div>
          <div>
            <h3 className="text-[16px] font-bold text-white">Delete User</h3>
            <p className="text-[11px] text-red-400/70">This action is irreversible</p>
          </div>
        </div>

        <div className="mb-5 p-3 rounded-xl text-[12px] text-slate-400 leading-relaxed"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
          All workspaces, campaigns, media, and data for <span className="text-white font-semibold">{user.email}</span> will be permanently deleted.
        </div>

        <p className="text-[12px] text-slate-500 mb-2">Type the email to confirm:</p>
        <input
          type="text" placeholder={user.email} value={confirm}
          onChange={e => setConfirm(e.target.value)}
          className="w-full rounded-xl px-4 py-3 text-white text-[13px] placeholder:text-slate-600 focus:outline-none mb-4"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
        />

        {error && (
          <div className="flex items-center gap-2 text-red-400 text-[12px] mb-3 bg-red-400/10 rounded-lg px-3 py-2">
            <AlertTriangle size={12} /> {error}
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-3 rounded-xl text-[13px] font-semibold text-slate-400 hover:text-white transition-colors"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
            Cancel
          </button>
          <button onClick={submit} disabled={loading || confirm !== user.email}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[13px] font-bold transition-all disabled:opacity-30"
            style={{ background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.4)', color: '#F87171' }}>
            {loading ? <RefreshCw size={13} className="animate-spin" /> : <Trash2 size={13} />}
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── Row Action Menu ────────────────────────────────────── */
function RowMenu({ user, onCredits, onPlan, onDelete, onCopyId }: {
  user: AdminUser
  onCredits: () => void
  onPlan: () => void
  onDelete: () => void
  onCopyId: () => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(o => !o)}
        className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/5 transition-all">
        <MoreVertical size={14} />
      </button>
      {open && (
        <div className="absolute right-0 top-8 z-30 w-44 rounded-xl overflow-hidden shadow-2xl py-1"
          style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.1)' }}>
          {[
            { icon: CreditCard, label: 'Adjust Credits', action: onCredits, color: '#A78BFA' },
            { icon: Crown,      label: 'Change Plan',    action: onPlan,    color: '#10B981' },
            { icon: Copy,       label: 'Copy User ID',   action: onCopyId,  color: '#64748B' },
            { icon: Trash2,     label: 'Delete User',    action: onDelete,  color: '#EF4444' },
          ].map(item => (
            <button key={item.label}
              onClick={() => { item.action(); setOpen(false) }}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[12px] font-medium text-left hover:bg-white/5 transition-colors"
              style={{ color: item.color }}>
              <item.icon size={13} />
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/* ─── Growth Sparkline ───────────────────────────────────── */
function Sparkline({ data }: { data: number[] }) {
  if (!data.length) return null
  const max = Math.max(...data, 1)
  const w = 80, h = 30
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - (v / max) * (h - 4) - 2}`)
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="opacity-60">
      <polyline fill="none" stroke="#8B5CF6" strokeWidth="1.5" points={pts.join(' ')} />
    </svg>
  )
}

/* ─── Main Page ──────────────────────────────────────────── */
export default function AdminPage() {
  const { user, session, loading: authLoading } = useAuth()
  const router = useRouter()

  const [users, setUsers]             = useState<AdminUser[]>([])
  const [planCounts, setPlanCounts]   = useState<PlanCount[]>([])
  const [recentSignups, setRecentSignups] = useState<RecentSignup[]>([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState('')
  const [search, setSearch]           = useState('')
  const [planFilter, setPlanFilter]   = useState('ALL')
  const [sortBy, setSortBy]           = useState<'createdAt' | 'aiCredits' | 'campaignCount'>('createdAt')
  const [sortDir, setSortDir]         = useState<'asc' | 'desc'>('desc')
  const [activeTab, setActiveTab]     = useState<'users' | 'growth'>('users')
  const [toast, setToast]             = useState('')

  // Modals
  const [creditsUser, setCreditsUser] = useState<AdminUser | null>(null)
  const [planUser, setPlanUser]       = useState<AdminUser | null>(null)
  const [deleteUser, setDeleteUser]   = useState<AdminUser | null>(null)

  const token = session?.access_token ?? ''

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

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
      setRecentSignups(data.recentSignups || [])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error loading')
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
    showToast('Credits updated')
  }

  function handlePlanSuccess(userId: string, newStatus: string) {
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, subscriptionStatus: newStatus } : u))
    showToast('Plan updated')
  }

  function handleDeleteSuccess(userId: string) {
    setUsers(prev => prev.filter(u => u.id !== userId))
    showToast('User deleted')
  }

  function copyUserId(id: string) {
    navigator.clipboard.writeText(id).then(() => showToast('User ID copied'))
  }

  // Derived stats
  const totalUsers   = users.length
  const paidUsers    = users.filter(u => u.subscriptionStatus === 'ACTIVE').length
  const freeUsers    = users.filter(u => u.subscriptionStatus === 'FREE').length
  const totalCredits = users.reduce((s, u) => s + u.aiCredits, 0)
  const mrrEstimate  = paidUsers * (PLAN_PRICES.ACTIVE || 49)
  const conversionRate = totalUsers > 0 ? ((paidUsers / totalUsers) * 100).toFixed(1) : '0'

  // Monthly signup sparkline (last 6 months)
  const monthlySignups = (() => {
    const map: Record<string, number> = {}
    recentSignups.forEach(s => {
      const key = new Date(s.createdAt).toLocaleDateString('en-US', { month: 'short' })
      map[key] = (map[key] || 0) + 1
    })
    return Object.values(map).slice(-6)
  })()

  // Filter + sort
  const filtered = users
    .filter(u => {
      const q = search.toLowerCase()
      const matchesSearch = u.email.toLowerCase().includes(q) ||
        (u.name ?? '').toLowerCase().includes(q) ||
        (u.company ?? '').toLowerCase().includes(q)
      const matchesPlan = planFilter === 'ALL' || u.subscriptionStatus === planFilter
      return matchesSearch && matchesPlan
    })
    .sort((a, b) => {
      const mul = sortDir === 'desc' ? -1 : 1
      if (sortBy === 'createdAt') return mul * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      if (sortBy === 'aiCredits') return mul * (a.aiCredits - b.aiCredits)
      if (sortBy === 'campaignCount') return mul * ((a.campaignCount || 0) - (b.campaignCount || 0))
      return 0
    })

  function toggleSort(col: typeof sortBy) {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortBy(col); setSortDir('desc') }
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#060718' }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
            <RefreshCw size={18} className="text-purple-400 animate-spin" />
          </div>
          <p className="text-[13px] text-slate-400">Loading admin data…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen text-white" style={{ background: '#060718', fontFamily: 'var(--font-sans, system-ui)' }}>

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-[100] flex items-center gap-2 px-4 py-3 rounded-xl shadow-2xl text-[13px] font-semibold"
          style={{ background: '#111827', border: '1px solid rgba(139,92,246,0.4)', color: '#A78BFA' }}>
          <Check size={14} /> {toast}
        </div>
      )}

      {/* ── Header ── */}
      <div className="sticky top-0 z-20 border-b"
        style={{ background: 'rgba(6,7,24,0.97)', backdropFilter: 'blur(20px)', borderColor: 'rgba(255,255,255,0.06)' }}>
        <div className="max-w-[1400px] mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(139,92,246,0.2)', border: '1px solid rgba(139,92,246,0.3)' }}>
              <ShieldAlert size={17} style={{ color: '#A78BFA' }} />
            </div>
            <div>
              <p className="text-[16px] font-bold text-white">Admin Console</p>
              <p className="text-[11px] text-slate-500">NEXUS AI · Operations</p>
            </div>
            {/* Tabs */}
            <div className="hidden md:flex items-center gap-1 ml-6 p-1 rounded-lg"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              {[
                { id: 'users', icon: Users, label: 'Users' },
                { id: 'growth', icon: BarChart3, label: 'Growth' },
              ].map(tab => (
                <button key={tab.id}
                  onClick={() => setActiveTab(tab.id as 'users' | 'growth')}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all"
                  style={{
                    background: activeTab === tab.id ? 'rgba(139,92,246,0.15)' : 'transparent',
                    color: activeTab === tab.id ? '#A78BFA' : '#64748B',
                    border: activeTab === tab.id ? '1px solid rgba(139,92,246,0.25)' : '1px solid transparent',
                  }}>
                  <tab.icon size={13} /> {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => exportCSV(filtered)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all"
              style={{ color: '#64748B', border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}
              title="Export CSV">
              <Download size={13} />
              <span className="hidden sm:inline">Export</span>
            </button>
            <button onClick={load}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all"
              style={{ color: '#64748B', border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
              <RefreshCw size={13} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-6 py-8">

        {error && (
          <div className="mb-6 p-4 rounded-xl flex items-center gap-3 text-red-400 text-[13px]"
            style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <AlertTriangle size={15} /> {error}
          </div>
        )}

        {/* ── STATS GRID ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4 mb-8">
          <StatCard icon={Users}      label="Total Users"     value={totalUsers}        color="#8B5CF6" />
          <StatCard icon={Crown}      label="Paid"            value={paidUsers}          color="#10B981" sub={`${conversionRate}% conversion`} />
          <StatCard icon={Zap}        label="Free"            value={freeUsers}          color="#FFB800" />
          <StatCard icon={TrendingUp} label="MRR (est.)"      value={`$${mrrEstimate}`}  color="#00D4FF" sub="Active users × $49" />
          <StatCard icon={CreditCard} label="Total Credits"   value={totalCredits.toLocaleString()} color="#F59E0B" />
          <StatCard icon={Activity}   label="Campaigns"       value={users.reduce((s, u) => s + (u.campaignCount || 0), 0)} color="#EC4899" />
        </div>

        {/* ── TABS ── */}
        {activeTab === 'growth' && (
          <div className="space-y-6 mb-8">
            {/* Plan breakdown */}
            <div className="rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-center gap-2 mb-5">
                <BarChart3 size={15} className="text-purple-400" />
                <p className="text-[14px] font-bold text-white">Plan Breakdown</p>
              </div>
              <div className="space-y-3">
                {planCounts.map(pc => {
                  const pct = totalUsers > 0 ? Math.round((pc._count._all / totalUsers) * 100) : 0
                  return (
                    <div key={pc.subscriptionStatus}>
                      <div className="flex items-center justify-between text-[12px] mb-1.5">
                        <span className={`flex items-center gap-2 font-semibold ${planColor(pc.subscriptionStatus).split(' ')[0]}`}>
                          <span className={`w-2 h-2 rounded-full ${planDot(pc.subscriptionStatus)}`} />
                          {pc.subscriptionStatus}
                        </span>
                        <span className="text-slate-400">{pc._count._all} users · {pct}%</span>
                      </div>
                      <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                        <div className="h-full rounded-full transition-all"
                          style={{
                            width: `${pct}%`,
                            background: pc.subscriptionStatus === 'ACTIVE' ? '#10B981'
                              : pc.subscriptionStatus === 'PAST_DUE' ? '#F59E0B' : '#475569',
                          }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Signup trend */}
            <div className="rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <TrendingUp size={15} className="text-purple-400" />
                  <p className="text-[14px] font-bold text-white">Signups (Last 6 Months)</p>
                </div>
                <Sparkline data={monthlySignups} />
              </div>
              <div className="flex items-end gap-3">
                {monthlySignups.map((val, i) => {
                  const max = Math.max(...monthlySignups, 1)
                  const h = Math.max(4, (val / max) * 100)
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-2">
                      <p className="text-[11px] text-slate-500">{val}</p>
                      <div className="w-full rounded-lg transition-all"
                        style={{ height: `${h}px`, background: i === monthlySignups.length - 1 ? '#8B5CF6' : 'rgba(139,92,246,0.3)' }} />
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── USERS TABLE ── */}
        {activeTab === 'users' && (
          <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
            {/* Table toolbar */}
            <div className="p-5 border-b flex items-center gap-3 flex-wrap" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
              {/* Search */}
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input type="text" placeholder="Search users…" value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full rounded-xl pl-9 pr-4 py-2.5 text-[13px] text-white placeholder:text-slate-500 focus:outline-none"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                />
              </div>

              {/* Plan filter */}
              <div className="relative">
                <select value={planFilter} onChange={e => setPlanFilter(e.target.value)}
                  className="rounded-xl px-3 py-2.5 text-[12px] text-white focus:outline-none appearance-none pr-8"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <option value="ALL">All plans</option>
                  {SUBSCRIPTION_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
              </div>

              <p className="text-[12px] text-slate-500 ml-auto">
                {filtered.length} / {totalUsers} users
              </p>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    {[
                      { key: 'user',         label: 'User',        sortKey: null },
                      { key: 'plan',         label: 'Plan',        sortKey: null },
                      { key: 'aiCredits',    label: 'Credits',     sortKey: 'aiCredits' as const },
                      { key: 'workspaces',   label: 'Workspaces',  sortKey: null },
                      { key: 'campaignCount',label: 'Campaigns',   sortKey: 'campaignCount' as const },
                      { key: 'createdAt',    label: 'Joined',      sortKey: 'createdAt' as const },
                      { key: 'lastLoginAt',  label: 'Last Login',  sortKey: null },
                      { key: 'actions',      label: '',            sortKey: null },
                    ].map(col => (
                      <th key={col.key}
                        className={`text-left px-5 py-3 text-[11px] font-mono uppercase tracking-wider text-slate-500 select-none ${col.sortKey ? 'cursor-pointer hover:text-white transition-colors' : ''}`}
                        onClick={() => col.sortKey && toggleSort(col.sortKey)}>
                        {col.label}
                        {col.sortKey && sortBy === col.sortKey && (
                          <span className="ml-1 text-purple-400">{sortDir === 'desc' ? '↓' : '↑'}</span>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((u) => (
                    <tr key={u.id}
                      className="border-b transition-colors hover:bg-white/[0.02]"
                      style={{ borderColor: 'rgba(255,255,255,0.03)' }}>

                      {/* User */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center text-[12px] font-bold text-white"
                            style={{ background: `hsl(${u.email.charCodeAt(0) * 7 % 360}, 50%, 20%)`, border: '1px solid rgba(255,255,255,0.08)' }}>
                            {(u.name || u.email).slice(0, 1).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-white font-semibold truncate max-w-[160px]">{u.name || '—'}</p>
                            <p className="text-[11px] text-slate-500 truncate max-w-[160px]">{u.email}</p>
                            {u.company && <p className="text-[10px] text-slate-600 truncate max-w-[160px]">{u.company}</p>}
                          </div>
                        </div>
                      </td>

                      {/* Plan */}
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${planColor(u.subscriptionStatus)}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${planDot(u.subscriptionStatus)}`} />
                          {u.subscriptionStatus}
                        </span>
                        {u.role === 'ADMIN' && (
                          <span className="ml-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border"
                            style={{ background: 'rgba(139,92,246,0.1)', borderColor: 'rgba(139,92,246,0.3)', color: '#A78BFA' }}>
                            <Shield size={8} /> ADMIN
                          </span>
                        )}
                      </td>

                      {/* Credits */}
                      <td className="px-5 py-4">
                        <span className="font-mono text-[15px] font-bold"
                          style={{ color: u.aiCredits > 100 ? '#10B981' : u.aiCredits > 20 ? '#F59E0B' : '#EF4444' }}>
                          {u.aiCredits}
                        </span>
                      </td>

                      {/* Workspaces */}
                      <td className="px-5 py-4 text-slate-400 text-center">
                        {u._count.workspaces}
                      </td>

                      {/* Campaigns */}
                      <td className="px-5 py-4 text-slate-400 text-center">
                        {u.campaignCount || 0}
                      </td>

                      {/* Joined */}
                      <td className="px-5 py-4 text-slate-500 whitespace-nowrap text-[12px]">
                        {fmt(u.createdAt)}
                      </td>

                      {/* Last Login */}
                      <td className="px-5 py-4 whitespace-nowrap text-[12px]"
                        style={{ color: u.lastLoginAt && new Date(u.lastLoginAt) > new Date(Date.now() - 7 * 86400000) ? '#10B981' : '#475569' }}>
                        {fmt(u.lastLoginAt)}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4">
                        <RowMenu
                          user={u}
                          onCredits={() => setCreditsUser(u)}
                          onPlan={() => setPlanUser(u)}
                          onDelete={() => setDeleteUser(u)}
                          onCopyId={() => copyUserId(u.id)}
                        />
                      </td>
                    </tr>
                  ))}

                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-5 py-16 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <Users size={28} className="text-slate-700" />
                          <p className="text-slate-500 text-[13px]">No users found</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Grant admin hint */}
        <div className="mt-6 flex items-center gap-2 text-[11px] text-slate-600">
          <ExternalLink size={10} />
          <span>Grant admin: </span>
          <code className="px-1.5 py-0.5 rounded text-slate-500"
            style={{ background: 'rgba(255,255,255,0.04)' }}>
            UPDATE &quot;User&quot; SET role = &apos;ADMIN&apos; WHERE email = &apos;your@email.com&apos;;
          </code>
        </div>

      </div>

      {/* Modals */}
      {creditsUser && (
        <CreditsModal user={creditsUser} token={token}
          onClose={() => setCreditsUser(null)} onSuccess={handleCreditSuccess} />
      )}
      {planUser && (
        <ChangePlanModal user={planUser} token={token}
          onClose={() => setPlanUser(null)} onSuccess={handlePlanSuccess} />
      )}
      {deleteUser && (
        <DeleteModal user={deleteUser} token={token}
          onClose={() => setDeleteUser(null)} onSuccess={handleDeleteSuccess} />
      )}
    </div>
  )
}
