'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import AppShell from '@/components/AppShell'
import { useAuth } from '@/lib/auth-context'

const GOAL_LABELS: Record<string, string> = {
  SALES: 'Sales', AWARENESS: 'Awareness', LEADS: 'Lead Gen',
  TRAFFIC: 'Traffic', ENGAGEMENT: 'Engagement', BRAND_BUILDING: 'Brand',
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-500/15 text-gray-400',
  GENERATING: 'bg-blue-500/15 text-blue-400',
  ACTIVE: 'bg-green-500/15 text-green-400',
  COMPLETED: 'bg-accent/15 text-accent',
  ARCHIVED: 'bg-gray-600/15 text-gray-500',
}

function timeSince(dateStr: string) {
  const d = new Date(dateStr)
  const diff = Date.now() - d.getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return `${Math.floor(days / 30)}mo ago`
}

export default function AgencyPage() {
  const { user, isAuthenticated, loading, authHeader } = useAuth()
  const router = useRouter()

  const [clients, setClients] = useState<any[]>([])
  const [fetching, setFetching] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [createError, setCreateError] = useState('')
  const [planStatus, setPlanStatus] = useState<string>('FREE')
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!loading && !isAuthenticated) router.push('/auth/login')
  }, [loading, isAuthenticated, router])

  useEffect(() => {
    if (!isAuthenticated) return
    const token = authHeader()
    // Fetch plan status
    fetch('/api/user/me', { headers: { Authorization: token } })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.subscriptionStatus) setPlanStatus(d.subscriptionStatus) })
      .catch(() => {})
    // Fetch clients
    fetch('/api/agency/clients', { headers: { Authorization: token } })
      .then(r => r.ok ? r.json() : [])
      .then(setClients)
      .catch(() => {})
      .finally(() => setFetching(false))
  }, [isAuthenticated])

  useEffect(() => {
    if (showCreate) setTimeout(() => nameRef.current?.focus(), 50)
  }, [showCreate])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) return
    setCreating(true)
    setCreateError('')
    try {
      const res = await fetch('/api/agency/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: authHeader() },
        body: JSON.stringify({ name: newName.trim(), description: newDesc.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { setCreateError(data.error || 'Failed to create client'); return }
      setClients(prev => [{ ...data, campaignCount: 0, projectCount: 0, lastCampaign: null }, ...prev])
      setShowCreate(false)
      setNewName('')
      setNewDesc('')
    } catch { setCreateError('Network error — please try again') }
    finally { setCreating(false) }
  }

  if (loading || !isAuthenticated) {
    return (
      <div className="min-h-screen bg-dark flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const isAgency = planStatus === 'ACTIVE' // In a real app, check plan=AGENCY specifically
  // For now, show upgrade gate if not on any paid plan (FREE users)
  const showUpgradeGate = planStatus === 'FREE'

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl sm:text-3xl font-bold">Agency Hub</h1>
              <span className="text-xs px-2 py-0.5 bg-accent/15 text-accent rounded-full font-bold uppercase tracking-wide">Agency</span>
            </div>
            <p className="text-gray-400 text-sm">Manage all your client campaigns from one place.</p>
          </div>
          {!showUpgradeGate && (
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-4 py-2 bg-accent text-dark text-sm font-bold rounded-xl hover:bg-accent-light transition whitespace-nowrap"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M8 3v10M3 8h10" strokeLinecap="round" />
              </svg>
              Add Client
            </button>
          )}
        </div>

        {/* Upgrade gate */}
        {showUpgradeGate && (
          <div className="bg-gradient-to-br from-accent/10 via-dark-secondary to-dark-secondary border border-accent/20 rounded-2xl p-8 text-center mb-8">
            <div className="w-14 h-14 bg-accent/10 border border-accent/20 rounded-2xl flex items-center justify-center mx-auto mb-5">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FF9500" strokeWidth="1.5">
                <path d="M3 21h18M5 21V9l7-6 7 6v12" strokeLinecap="round" strokeLinejoin="round" />
                <rect x="9" y="14" width="6" height="7" rx="1" />
              </svg>
            </div>
            <h2 className="text-xl font-bold mb-2">Agency tier unlocks client management</h2>
            <p className="text-gray-400 text-sm mb-6 max-w-md mx-auto">
              Run campaigns for unlimited clients, deliver branded reports, and manage everything from one workspace.
              Available on the Agency plan.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/billing"
                className="px-6 py-3 bg-accent text-dark font-bold rounded-xl hover:bg-accent-light transition text-sm"
              >
                Upgrade to Agency →
              </Link>
              <Link
                href="/dashboard"
                className="px-6 py-3 border border-dark-tertiary text-gray-400 font-semibold rounded-xl hover:border-accent/40 hover:text-white transition text-sm"
              >
                Back to Dashboard
              </Link>
            </div>
          </div>
        )}

        {/* Create client modal */}
        {showCreate && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-dark-secondary border border-dark-tertiary rounded-2xl p-6 w-full max-w-md shadow-2xl">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold">Add New Client</h2>
                <button onClick={() => setShowCreate(false)} className="text-gray-500 hover:text-white transition">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 4l12 12M16 4L4 16" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1.5">Client / Brand Name *</label>
                  <input
                    ref={nameRef}
                    type="text"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    placeholder="e.g. Acme Corp"
                    className="w-full bg-dark border border-dark-tertiary rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-accent/50 transition"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1.5">Notes (optional)</label>
                  <textarea
                    value={newDesc}
                    onChange={e => setNewDesc(e.target.value)}
                    placeholder="Industry, contact, retainer notes..."
                    rows={3}
                    className="w-full bg-dark border border-dark-tertiary rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-accent/50 transition resize-none"
                  />
                </div>
                {createError && (
                  <div className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{createError}</div>
                )}
                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowCreate(false)}
                    className="flex-1 py-2.5 border border-dark-tertiary text-gray-400 font-semibold rounded-xl hover:border-accent/30 hover:text-white transition text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creating || !newName.trim()}
                    className="flex-1 py-2.5 bg-accent text-dark font-bold rounded-xl hover:bg-accent-light transition text-sm disabled:opacity-50"
                  >
                    {creating ? 'Creating…' : 'Create Client'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Stats bar */}
        {!showUpgradeGate && !fetching && clients.length > 0 && (
          <div className="grid grid-cols-3 gap-4 mb-8">
            {[
              { label: 'Total Clients', value: clients.length },
              { label: 'Total Campaigns', value: clients.reduce((s, c) => s + c.campaignCount, 0) },
              { label: 'Active This Month', value: clients.filter(c => c.lastCampaign && new Date(c.lastCampaign.createdAt) > new Date(Date.now() - 30 * 86400000)).length },
            ].map(stat => (
              <div key={stat.label} className="bg-dark-secondary border border-dark-tertiary rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-accent">{stat.value}</div>
                <div className="text-xs text-gray-400 mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Loading */}
        {fetching && !showUpgradeGate && (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Empty state */}
        {!fetching && !showUpgradeGate && clients.length === 0 && (
          <div className="text-center py-16 border border-dashed border-dark-tertiary rounded-2xl">
            <div className="text-5xl mb-4">🏢</div>
            <h3 className="text-lg font-bold mb-2">No clients yet</h3>
            <p className="text-gray-400 text-sm mb-6">Add your first client workspace to start managing campaigns.</p>
            <button
              onClick={() => setShowCreate(true)}
              className="px-6 py-2.5 bg-accent text-dark font-bold rounded-xl hover:bg-accent-light transition text-sm"
            >
              Add First Client →
            </button>
          </div>
        )}

        {/* Client grid */}
        {!fetching && !showUpgradeGate && clients.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {clients.map(client => (
              <ClientCard key={client.id} client={client} />
            ))}

            {/* Add client card */}
            <button
              onClick={() => setShowCreate(true)}
              className="border border-dashed border-dark-tertiary rounded-2xl p-6 flex flex-col items-center justify-center gap-3 text-gray-500 hover:border-accent/40 hover:text-accent transition group min-h-[200px]"
            >
              <div className="w-10 h-10 rounded-xl bg-dark-secondary flex items-center justify-center group-hover:bg-accent/10 transition">
                <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M8 3v10M3 8h10" strokeLinecap="round" />
                </svg>
              </div>
              <span className="text-sm font-semibold">Add Client</span>
            </button>
          </div>
        )}

      </div>
    </AppShell>
  )
}

function ClientCard({ client }: { client: any }) {
  const [showReport, setShowReport] = useState(false)
  const [report, setReport] = useState<any>(null)
  const [loadingReport, setLoadingReport] = useState(false)

  const fetchReport = async () => {
    if (report) { setShowReport(true); return }
    setLoadingReport(true)
    try {
      const token = (() => {
        try {
          const raw = localStorage.getItem('sb-qabttahvjhgzwfzqnxew-auth-token') ||
            Object.entries(localStorage).find(([k]) => k.startsWith('sb-') && k.endsWith('-auth-token'))?.[1] || ''
          const session = raw ? JSON.parse(raw) : null
          return session?.access_token ? `Bearer ${session.access_token}` : ''
        } catch { return '' }
      })()
      const res = await fetch(`/api/agency/clients/${client.id}/report`, { headers: { Authorization: token } })
      if (res.ok) { setReport(await res.json()); setShowReport(true) }
    } finally { setLoadingReport(false) }
  }

  return (
    <>
      <div className="bg-dark-secondary border border-dark-tertiary rounded-2xl p-5 hover:border-accent/30 transition group flex flex-col">

        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent font-bold text-lg">
              {client.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="font-bold text-sm leading-tight">{client.name}</div>
              {client.description && (
                <div className="text-xs text-gray-500 mt-0.5 line-clamp-1">{client.description}</div>
              )}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="flex gap-4 mb-4">
          <div className="flex-1 bg-dark rounded-lg p-3 text-center">
            <div className="text-xl font-bold text-white">{client.campaignCount}</div>
            <div className="text-xs text-gray-500 mt-0.5">Campaigns</div>
          </div>
          <div className="flex-1 bg-dark rounded-lg p-3 text-center">
            <div className="text-xl font-bold text-white">{client.projectCount}</div>
            <div className="text-xs text-gray-500 mt-0.5">Projects</div>
          </div>
        </div>

        {/* Last campaign */}
        {client.lastCampaign ? (
          <div className="flex items-center gap-2 mb-5 px-3 py-2 bg-dark rounded-lg">
            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${STATUS_COLORS[client.lastCampaign.status] || 'bg-gray-500/15 text-gray-400'}`}>
              {client.lastCampaign.status}
            </span>
            <span className="text-xs text-gray-400 flex-1 truncate">{client.lastCampaign.name}</span>
            <span className="text-xs text-gray-600 flex-shrink-0">{timeSince(client.lastCampaign.createdAt)}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 mb-5 px-3 py-2 bg-dark rounded-lg">
            <span className="text-xs text-gray-600 italic">No campaigns yet</span>
          </div>
        )}

        {/* Actions */}
        <div className="mt-auto flex gap-2">
          <Link
            href={`/campaigns?workspace=${client.id}`}
            className="flex-1 py-2 text-center text-xs font-semibold bg-dark border border-dark-tertiary rounded-lg text-gray-400 hover:border-accent/40 hover:text-white transition"
          >
            View Campaigns
          </Link>
          <button
            onClick={fetchReport}
            disabled={loadingReport}
            className="flex-1 py-2 text-center text-xs font-bold bg-accent/10 border border-accent/20 rounded-lg text-accent hover:bg-accent hover:text-dark transition disabled:opacity-50"
          >
            {loadingReport ? '…' : 'Client Report'}
          </button>
        </div>
      </div>

      {/* Report modal */}
      {showReport && report && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-dark-secondary border border-dark-tertiary rounded-2xl w-full max-w-2xl my-8 shadow-2xl">

            {/* Modal header */}
            <div className="flex items-center justify-between p-6 border-b border-dark-tertiary">
              <div>
                <h2 className="text-lg font-bold">{report.client.name} — Campaign Report</h2>
                <p className="text-xs text-gray-400 mt-0.5">Client since {new Date(report.client.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
              </div>
              <button onClick={() => setShowReport(false)} className="text-gray-500 hover:text-white transition p-1">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 4l12 12M16 4L4 16" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {/* Summary stats */}
            <div className="grid grid-cols-3 gap-4 p-6 border-b border-dark-tertiary">
              <div className="text-center">
                <div className="text-2xl font-bold text-accent">{report.summary.totalCampaigns}</div>
                <div className="text-xs text-gray-400 mt-1">Campaigns</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-white">
                  {Object.values(report.summary.statusBreakdown as Record<string, number>).reduce((a: number, b) => a + b, 0)}
                </div>
                <div className="text-xs text-gray-400 mt-1">Total Output</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-white">
                  {Object.keys(report.summary.platformBreakdown).length}
                </div>
                <div className="text-xs text-gray-400 mt-1">Platforms</div>
              </div>
            </div>

            {/* Breakdowns */}
            <div className="grid grid-cols-2 gap-4 p-6 border-b border-dark-tertiary">
              <div>
                <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">By Goal</div>
                <div className="space-y-2">
                  {Object.entries(report.summary.goalBreakdown as Record<string, number>).map(([goal, count]) => (
                    <div key={goal} className="flex items-center justify-between">
                      <span className="text-sm text-gray-300">{GOAL_LABELS[goal] || goal}</span>
                      <span className="text-xs font-bold text-accent bg-accent/10 px-2 py-0.5 rounded-full">{count}</span>
                    </div>
                  ))}
                  {Object.keys(report.summary.goalBreakdown).length === 0 && (
                    <span className="text-xs text-gray-600">No data yet</span>
                  )}
                </div>
              </div>
              <div>
                <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">By Platform</div>
                <div className="space-y-2">
                  {Object.entries(report.summary.platformBreakdown as Record<string, number>).map(([platform, count]) => (
                    <div key={platform} className="flex items-center justify-between">
                      <span className="text-sm text-gray-300">{platform.replace('_', ' ')}</span>
                      <span className="text-xs font-bold text-white bg-dark-tertiary px-2 py-0.5 rounded-full">{count}</span>
                    </div>
                  ))}
                  {Object.keys(report.summary.platformBreakdown).length === 0 && (
                    <span className="text-xs text-gray-600">No data yet</span>
                  )}
                </div>
              </div>
            </div>

            {/* Recent campaigns */}
            <div className="p-6">
              <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Recent Campaigns</div>
              {report.recentCampaigns.length === 0 ? (
                <p className="text-sm text-gray-600 text-center py-4">No campaigns yet for this client.</p>
              ) : (
                <div className="space-y-2">
                  {report.recentCampaigns.map((c: any) => (
                    <div key={c.id} className="flex items-center gap-3 p-3 bg-dark rounded-xl">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold flex-shrink-0 ${STATUS_COLORS[c.status] || 'bg-gray-500/15 text-gray-400'}`}>
                        {c.status}
                      </span>
                      <span className="text-sm text-gray-200 flex-1 truncate">{c.name}</span>
                      <span className="text-xs text-gray-500 flex-shrink-0">{timeSince(c.createdAt)}</span>
                      {c.shareUrl && (
                        <a href={c.shareUrl} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-accent hover:underline flex-shrink-0" title="View shared campaign">
                          Share ↗
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 pb-6">
              <Link
                href={`/campaign/new?workspace=${report.client.id}`}
                className="w-full block py-2.5 text-center bg-accent text-dark font-bold rounded-xl hover:bg-accent-light transition text-sm"
              >
                + New Campaign for {report.client.name}
              </Link>
            </div>

          </div>
        </div>
      )}
    </>
  )
}
