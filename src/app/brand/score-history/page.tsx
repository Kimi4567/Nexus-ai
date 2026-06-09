'use client'

import AppShell from '@/components/AppShell'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { Brain, ArrowLeft, TrendingUp, TrendingDown, Minus, Zap, Trophy, Target, Sparkles } from 'lucide-react'

/* ═══════════════════════════════════════════════════════════════
   BRAIN SCORE HISTORY — Full Journey View
   ═══════════════════════════════════════════════════════════════ */

interface Snapshot {
  score: number
  createdAt: string
}

/* ── Full SVG Line Chart ──────────────────────────────────────── */
function ScoreChart({ snapshots }: { snapshots: Snapshot[] }) {
  if (snapshots.length < 2) return null

  const W = 800; const H = 240; const padX = 48; const padY = 24
  const scores = snapshots.map(s => s.score)
  const minScore = Math.max(0, Math.min(...scores) - 10)
  const maxScore = Math.min(100, Math.max(...scores) + 10)
  const range = Math.max(maxScore - minScore, 20)

  const toX = (i: number) => padX + (i / (snapshots.length - 1)) * (W - padX * 2)
  const toY = (v: number) => H - padY - ((v - minScore) / range) * (H - padY * 2)

  const pts = snapshots.map((s, i) => `${toX(i)},${toY(s.score)}`).join(' ')

  // Build filled area path
  const firstX = toX(0); const lastX = toX(snapshots.length - 1); const bottomY = H - padY
  const areaPath = `M${firstX},${bottomY} L${firstX},${toY(snapshots[0].score)} ${snapshots.map((s, i) => `L${toX(i)},${toY(s.score)}`).join(' ')} L${lastX},${bottomY} Z`

  // Grid lines at 25, 50, 75, 100
  const gridLines = [25, 50, 75, 100].filter(v => v >= minScore && v <= maxScore)

  const lastScore = scores[scores.length - 1]
  const dotColor = lastScore >= 80 ? '#10b981' : lastScore >= 50 ? '#f59e0b' : '#ef4444'

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" className="overflow-visible">
      <defs>
        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={dotColor} stopOpacity="0.25" />
          <stop offset="100%" stopColor={dotColor} stopOpacity="0" />
        </linearGradient>
        <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#8b5cf6" />
          <stop offset="100%" stopColor={dotColor} />
        </linearGradient>
      </defs>

      {/* Grid lines */}
      {gridLines.map(v => (
        <g key={v}>
          <line
            x1={padX} y1={toY(v)} x2={W - padX} y2={toY(v)}
            stroke="rgba(139,92,246,0.12)" strokeWidth="1" strokeDasharray="4,4"
          />
          <text x={padX - 6} y={toY(v) + 4} textAnchor="end"
            fontSize="10" fill="rgba(148,163,184,0.4)" fontFamily="monospace">
            {v}
          </text>
        </g>
      ))}

      {/* Area fill */}
      <path d={areaPath} fill="url(#areaGrad)" />

      {/* Line */}
      <polyline points={pts} fill="none" stroke="url(#lineGrad)"
        strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />

      {/* Dots at each point */}
      {snapshots.map((s, i) => {
        const c = s.score >= 80 ? '#10b981' : s.score >= 50 ? '#f59e0b' : '#ef4444'
        const isLast = i === snapshots.length - 1
        return (
          <g key={i}>
            <circle cx={toX(i)} cy={toY(s.score)} r={isLast ? 5 : 3}
              fill={c} stroke="rgba(10,11,28,0.8)" strokeWidth={isLast ? 2 : 1.5} />
            {isLast && (
              <circle cx={toX(i)} cy={toY(s.score)} r="9"
                fill="none" stroke={c} strokeWidth="1.5" opacity="0.4" />
            )}
          </g>
        )
      })}

      {/* Score label on last point */}
      {snapshots.length > 0 && (() => {
        const last = snapshots[snapshots.length - 1]
        const x = toX(snapshots.length - 1)
        const y = toY(last.score)
        const c = last.score >= 80 ? '#10b981' : last.score >= 50 ? '#f59e0b' : '#ef4444'
        return (
          <text x={x} y={y - 14} textAnchor="middle"
            fontSize="11" fill={c} fontWeight="700" fontFamily="monospace">
            {last.score}
          </text>
        )
      })()}

      {/* X-axis date labels — show first, middle, last */}
      {[0, Math.floor((snapshots.length - 1) / 2), snapshots.length - 1]
        .filter((v, i, arr) => arr.indexOf(v) === i && v < snapshots.length)
        .map(i => (
          <text key={i} x={toX(i)} y={H - 4} textAnchor="middle"
            fontSize="9" fill="rgba(148,163,184,0.35)" fontFamily="monospace">
            {new Date(snapshots[i].createdAt).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
          </text>
        ))
      }
    </svg>
  )
}

/* ── Milestone badge ──────────────────────────────────────────── */
function MilestoneBadge({ score, date, isFirst }: { score: number; date: string; isFirst?: boolean }) {
  const color = score >= 80 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444'
  const label = score >= 80 ? '🧠 Full Power' : score >= 75 ? '🚀 Advanced' : score >= 50 ? '📈 Building' : score >= 25 ? '🌱 Starting' : '⚡ First Save'
  return (
    <div className="flex items-center gap-3 py-3" style={{ borderBottom: '1px solid rgba(139,92,246,0.08)' }}>
      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: `${color}15`, border: `1px solid ${color}35` }}>
        <span className="text-base font-black tabular-nums" style={{ color, fontSize: 13 }}>{score}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold" style={{ color: '#e2e8f0' }}>{label}{isFirst ? ' — First Save' : ''}</p>
        <p className="text-[10px] mt-0.5" style={{ color: '#334155' }}>
          {new Date(date).toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
      <div className="w-16 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(139,92,246,0.08)' }}>
        <div className="h-full rounded-full" style={{ width: `${score}%`, background: color }} />
      </div>
    </div>
  )
}

/* ── Stat card ────────────────────────────────────────────────── */
function StatCard({ icon, label, value, sub, color }: {
  icon: React.ReactNode; label: string; value: string; sub?: string; color: string
}) {
  return (
    <div className="flex-1 min-w-[140px] rounded-2xl p-4"
      style={{ background: 'rgba(10,11,28,0.7)', border: `1px solid ${color}20`, backdropFilter: 'blur(12px)' }}>
      <div className="w-8 h-8 rounded-xl flex items-center justify-center mb-3"
        style={{ background: `${color}12`, border: `1px solid ${color}25` }}>
        <span style={{ color }}>{icon}</span>
      </div>
      <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: 'rgba(148,163,184,0.4)' }}>{label}</p>
      <p className="text-2xl font-black tabular-nums" style={{ color }}>{value}</p>
      {sub && <p className="text-[10px] mt-1" style={{ color: 'rgba(148,163,184,0.3)' }}>{sub}</p>}
    </div>
  )
}

/* ── Main Page ────────────────────────────────────────────────── */
export default function ScoreHistoryPage() {
  const router = useRouter()
  const { authHeader } = useAuth()
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [loading, setLoading] = useState(true)

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/brain/score-history', {
        headers: { Authorization: authHeader() },
      })
      if (!res.ok) return
      const data = await res.json()
      if (Array.isArray(data.snapshots)) {
        setSnapshots(data.snapshots)
      }
    } catch { /* silent */ } finally {
      setLoading(false)
    }
  }, [authHeader])

  useEffect(() => { fetchHistory() }, [fetchHistory])

  // ── Derived stats ──────────────────────────────────────────────
  const scores = snapshots.map(s => s.score)
  const current  = scores[scores.length - 1] ?? 0
  const peak     = scores.length > 0 ? Math.max(...scores) : 0
  const first    = scores[0] ?? 0
  const growth   = current - first
  const trend    = scores.length >= 2 ? current - scores[scores.length - 2] : 0
  const saves    = snapshots.length

  const currentColor = current >= 80 ? '#10b981' : current >= 50 ? '#f59e0b' : '#ef4444'
  const TrendIcon = trend > 0 ? TrendingUp : trend < 0 ? TrendingDown : Minus
  const trendColor = trend > 0 ? '#10b981' : trend < 0 ? '#ef4444' : '#64748b'

  // ── Milestone detection — find first time score crossed each tier
  const milestones = snapshots.filter((s, i) => {
    if (i === 0) return true
    return s.score !== snapshots[i - 1].score
  }).slice(-15).reverse() // show last 15 changes, newest first

  return (
    <AppShell>
      <div className="min-h-screen p-6" style={{ background: 'transparent' }}>
        <div className="max-w-3xl mx-auto">

          {/* ── Back button ───────────────────────────────────────── */}
          <button onClick={() => router.push('/brand')}
            className="flex items-center gap-2 mb-6 text-sm font-semibold transition-all hover:opacity-80"
            style={{ color: 'rgba(148,163,184,0.5)' }}>
            <ArrowLeft size={15} />
            Brand Brain
          </button>

          {/* ── Header ────────────────────────────────────────────── */}
          <div className="rounded-2xl overflow-hidden mb-6"
            style={{ background: 'rgba(10,11,28,0.85)', border: '1px solid rgba(139,92,246,0.2)', backdropFilter: 'blur(24px)', boxShadow: '0 4px 40px rgba(0,0,0,0.4)' }}>
            <div className="h-0.5 w-full" style={{ background: 'linear-gradient(90deg, #f59e0b 0%, #8b5cf6 50%, #06b6d4 100%)' }} />
            <div className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-1 h-3.5 rounded-full" style={{ background: 'linear-gradient(180deg, #f59e0b, #f59e0b80)' }} />
                <span className="text-xs font-mono font-bold tracking-[0.2em] uppercase" style={{ color: 'rgba(245,158,11,0.65)' }}>
                  NEXUS BRAND BRAIN
                </span>
              </div>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
                    <Brain size={28} className="text-amber-400" />
                    Brain Score Journey
                  </h1>
                  <p className="text-sm mt-1" style={{ color: '#475569' }}>
                    Every save trains the brain — watch it grow over time
                  </p>
                </div>
                {saves > 0 && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl"
                    style={{ background: `${currentColor}10`, border: `1px solid ${currentColor}30` }}>
                    <TrendIcon size={14} style={{ color: trendColor }} />
                    <span className="text-sm font-bold" style={{ color: trendColor }}>
                      {trend > 0 ? `+${trend}` : trend === 0 ? '±0' : trend} last save
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-48">
              <div className="w-8 h-8 rounded-full border-2 border-t-amber-400 animate-spin"
                style={{ borderColor: 'rgba(139,92,246,0.2)', borderTopColor: '#f59e0b' }} />
            </div>
          ) : snapshots.length === 0 ? (
            /* ── Empty state ──────────────────────────────────────── */
            <div className="rounded-2xl p-12 text-center"
              style={{ background: 'rgba(10,11,28,0.7)', border: '1px solid rgba(139,92,246,0.15)', backdropFilter: 'blur(12px)' }}>
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
                <Brain size={32} className="text-amber-400 opacity-40" />
              </div>
              <p className="text-lg font-bold text-white mb-2">No history yet</p>
              <p className="text-sm mb-6" style={{ color: '#475569' }}>Save your Brand Brain at least once to start tracking</p>
              <button onClick={() => router.push('/brand')}
                className="px-6 py-2.5 rounded-xl text-sm font-bold transition-all"
                style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#0a0a0a' }}>
                Go to Brand Brain
              </button>
            </div>
          ) : (
            <>
              {/* ── Stats row ─────────────────────────────────────── */}
              <div className="flex gap-3 mb-6 flex-wrap">
                <StatCard
                  icon={<Brain size={16} />}
                  label="Current Score"
                  value={`${current}`}
                  sub={current >= 80 ? 'Full Power 🧠' : current >= 50 ? 'Building 📈' : 'Needs Data ⚡'}
                  color={currentColor}
                />
                <StatCard
                  icon={<Trophy size={16} />}
                  label="Peak Score"
                  value={`${peak}`}
                  sub="All-time high"
                  color="#f59e0b"
                />
                <StatCard
                  icon={<TrendingUp size={16} />}
                  label="Total Growth"
                  value={growth >= 0 ? `+${growth}` : `${growth}`}
                  sub={`From ${first} → ${current}`}
                  color={growth >= 0 ? '#10b981' : '#ef4444'}
                />
                <StatCard
                  icon={<Sparkles size={16} />}
                  label="Brain Saves"
                  value={`${saves}`}
                  sub="Training sessions"
                  color="#8b5cf6"
                />
              </div>

              {/* ── Chart ─────────────────────────────────────────── */}
              <div className="rounded-2xl p-5 mb-6"
                style={{ background: 'rgba(10,11,28,0.7)', border: '1px solid rgba(139,92,246,0.15)', backdropFilter: 'blur(12px)' }}>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'rgba(148,163,184,0.4)' }}>Score over time</p>
                  <div className="flex items-center gap-4">
                    {[{ color: '#ef4444', label: '< 50' }, { color: '#f59e0b', label: '50–79' }, { color: '#10b981', label: '80+' }].map(t => (
                      <div key={t.label} className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full" style={{ background: t.color }} />
                        <span className="text-[10px]" style={{ color: 'rgba(148,163,184,0.35)' }}>{t.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <ScoreChart snapshots={snapshots} />
              </div>

              {/* ── Target zones ──────────────────────────────────── */}
              {current < 100 && (
                <div className="rounded-2xl p-5 mb-6"
                  style={{ background: 'rgba(10,11,28,0.7)', border: '1px solid rgba(139,92,246,0.15)', backdropFilter: 'blur(12px)' }}>
                  <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: 'rgba(148,163,184,0.4)' }}>Next targets</p>
                  <div className="flex flex-col gap-2">
                    {[
                      { target: 25, label: 'Starter Brain', desc: 'Brand name + industry + description', color: '#ef4444' },
                      { target: 50, label: 'Building Brain', desc: '+ offer + audience + tone', color: '#f59e0b' },
                      { target: 75, label: 'Advanced Brain', desc: '+ platforms + advantages + pain points', color: '#06b6d4' },
                      { target: 100, label: 'Full Power Brain', desc: 'All fields complete', color: '#10b981' },
                    ].filter(t => t.target > current).map(t => (
                      <div key={t.target} className="flex items-center gap-3 py-2 px-3 rounded-xl"
                        style={{ background: `${t.color}06`, border: `1px solid ${t.color}15` }}>
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ background: `${t.color}12`, border: `1px solid ${t.color}25` }}>
                          <Target size={12} style={{ color: t.color }} />
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-bold" style={{ color: t.color }}>{t.target} — {t.label}</p>
                          <p className="text-[10px] mt-0.5" style={{ color: 'rgba(148,163,184,0.3)' }}>{t.desc}</p>
                        </div>
                        <span className="text-xs font-black tabular-nums" style={{ color: `${t.color}80` }}>+{t.target - current}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── History log ───────────────────────────────────── */}
              <div className="rounded-2xl p-5"
                style={{ background: 'rgba(10,11,28,0.7)', border: '1px solid rgba(139,92,246,0.15)', backdropFilter: 'blur(12px)' }}>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'rgba(148,163,184,0.4)' }}>Save history</p>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                    style={{ background: 'rgba(139,92,246,0.1)', color: 'rgba(139,92,246,0.6)', border: '1px solid rgba(139,92,246,0.2)' }}>
                    {milestones.length} changes
                  </span>
                </div>
                <div>
                  {milestones.map((s, i) => (
                    <MilestoneBadge key={i} score={s.score} date={s.createdAt} isFirst={i === milestones.length - 1} />
                  ))}
                </div>
              </div>

              {/* ── CTA ───────────────────────────────────────────── */}
              {current < 80 && (
                <div className="mt-6 rounded-2xl p-5 flex items-center justify-between gap-4"
                  style={{ background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.15)' }}>
                  <div className="flex items-center gap-3">
                    <Zap size={18} className="text-amber-400 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-bold text-white">Reach 80 to unlock Full Power</p>
                      <p className="text-xs mt-0.5" style={{ color: '#475569' }}>More data = smarter AI for every campaign</p>
                    </div>
                  </div>
                  <button onClick={() => router.push('/brand')}
                    className="flex-shrink-0 px-5 py-2.5 rounded-xl text-sm font-bold transition-all"
                    style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#0a0a0a', boxShadow: '0 0 20px rgba(245,158,11,0.25)' }}>
                    Train Brain
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </AppShell>
  )
}
