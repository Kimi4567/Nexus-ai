'use client'

import AppShell from '@/components/AppShell'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n-context'
import { Brain, ArrowLeft, TrendingUp, TrendingDown, Minus, Trophy, Target, Sparkles, ChevronRight } from 'lucide-react'

/* ═══════════════════════════════════════════════════════════════
   BRAND BRAIN MATURITY HISTORY — long-term depth over time
   ───────────────────────────────────────────────────────────────
   PR-N2: This page shows the *maturity* score trajectory. Maturity is a
   long-term DEPTH signal (saved setup + reviewed signals over time). It is
   explicitly NOT "memory completeness" and NOT organic readiness, so it can
   differ from the number of saved core identity fields. Light + calm theme to match the
   Brand Brain workspace. No score/snapshot math changed — display only.
   ═══════════════════════════════════════════════════════════════ */

interface Snapshot {
  score: number
  createdAt: string
}

interface BrainUpdate {
  id: string
  field: string
  displayName: string
  icon: string | null
  trigger: string
  proposed: unknown
  reason: string
  status: string
  updatedAt: string
}

/* ── Calm maturity palette (matches PR-L: low = slate, never alarmist red) ── */
const SLATE = '#64748b'
const AMBER = '#f59e0b'
const GREEN = '#10b981'
const VIOLET = '#8b5cf6'

const TEXT_MAIN = '#0f172a'
const TEXT_SUB = '#64748b'
const TEXT_FAINT = '#94a3b8'
const CARD_BG = '#ffffff'
const SURFACE = '#f8fafc'
const BORDER = '#e2e8f0'

function maturityColor(score: number): string {
  if (score >= 80) return GREEN
  if (score >= 50) return AMBER
  return SLATE
}

/** Stage label — consistent with the Brand Brain header chip (Early/Developing/Mature). */
function maturityStage(score: number, ar: boolean): string {
  if (score >= 80) return ar ? 'ناضجة' : 'Mature'
  if (score >= 50) return ar ? 'تتطوّر' : 'Developing'
  return ar ? 'مبكرة' : 'Early'
}

function changeCountLabel(count: number, ar: boolean): string {
  if (!ar) return `${count} ${count === 1 ? 'change' : 'changes'}`
  if (count === 0) return 'لا تغييرات'
  if (count === 1) return 'تغيير واحد'
  if (count === 2) return 'تغييران'
  if (count <= 10) return `${count} تغييرات`
  return `${count} تغييرًا`
}

function formatProposed(value: unknown): string {
  if (Array.isArray(value)) return value.filter(Boolean).slice(0, 4).join(' · ')
  if (typeof value === 'string') return value
  if (value && typeof value === 'object') return JSON.stringify(value).slice(0, 160)
  return String(value ?? '')
}

/* ── Light line chart ─────────────────────────────────────────── */
function ScoreChart({ snapshots, ar }: { snapshots: Snapshot[]; ar: boolean }) {
  if (snapshots.length < 2) return null

  const W = 800; const H = 240; const padX = 48; const padY = 24
  const scores = snapshots.map(s => s.score)
  const minScore = Math.max(0, Math.min(...scores) - 10)
  const maxScore = Math.min(100, Math.max(...scores) + 10)
  const range = Math.max(maxScore - minScore, 20)

  const toX = (i: number) => padX + (i / (snapshots.length - 1)) * (W - padX * 2)
  const toY = (v: number) => H - padY - ((v - minScore) / range) * (H - padY * 2)

  const pts = snapshots.map((s, i) => `${toX(i)},${toY(s.score)}`).join(' ')

  const firstX = toX(0); const lastX = toX(snapshots.length - 1); const bottomY = H - padY
  const areaPath = `M${firstX},${bottomY} L${firstX},${toY(snapshots[0].score)} ${snapshots.map((s, i) => `L${toX(i)},${toY(s.score)}`).join(' ')} L${lastX},${bottomY} Z`

  const gridLines = [25, 50, 75, 100].filter(v => v >= minScore && v <= maxScore)

  const lastScore = scores[scores.length - 1]
  const dotColor = maturityColor(lastScore)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" className="overflow-visible">
      <defs>
        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={dotColor} stopOpacity="0.18" />
          <stop offset="100%" stopColor={dotColor} stopOpacity="0" />
        </linearGradient>
        <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={VIOLET} />
          <stop offset="100%" stopColor={dotColor} />
        </linearGradient>
      </defs>

      {/* Grid lines */}
      {gridLines.map(v => (
        <g key={v}>
          <line
            x1={padX} y1={toY(v)} x2={W - padX} y2={toY(v)}
            stroke="rgba(100,116,139,0.16)" strokeWidth="1" strokeDasharray="4,4"
          />
          <text x={padX - 6} y={toY(v) + 4} textAnchor="end"
            fontSize="10" fill="rgba(100,116,139,0.55)" fontFamily="monospace">
            {v}
          </text>
        </g>
      ))}

      {/* Area fill */}
      <path d={areaPath} fill="url(#areaGrad)" />

      {/* Line */}
      <polyline points={pts} fill="none" stroke="url(#lineGrad)"
        strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />

      {/* Dots */}
      {snapshots.map((s, i) => {
        const c = maturityColor(s.score)
        const isLast = i === snapshots.length - 1
        return (
          <g key={i}>
            <circle cx={toX(i)} cy={toY(s.score)} r={isLast ? 5 : 3}
              fill={c} stroke="#ffffff" strokeWidth={isLast ? 2 : 1.5} />
            {isLast && (
              <circle cx={toX(i)} cy={toY(s.score)} r="9"
                fill="none" stroke={c} strokeWidth="1.5" opacity="0.4" />
            )}
          </g>
        )
      })}

      {/* Last score label */}
      {snapshots.length > 0 && (() => {
        const last = snapshots[snapshots.length - 1]
        const x = toX(snapshots.length - 1)
        const y = toY(last.score)
        const c = maturityColor(last.score)
        return (
          <text x={x} y={y - 14} textAnchor="middle"
            fontSize="11" fill={c} fontWeight="700" fontFamily="monospace">
            {last.score}
          </text>
        )
      })()}

      {/* X-axis date labels */}
      {[0, Math.floor((snapshots.length - 1) / 2), snapshots.length - 1]
        .filter((v, i, arr) => arr.indexOf(v) === i && v < snapshots.length)
        .map(i => (
          <text key={i} x={toX(i)} y={H - 4} textAnchor="middle"
            fontSize="9" fill="rgba(100,116,139,0.5)" fontFamily="monospace">
            {new Date(snapshots[i].createdAt).toLocaleDateString(ar ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric' })}
          </text>
        ))
      }
    </svg>
  )
}

/* ── Milestone row ────────────────────────────────────────────── */
function MilestoneBadge({ score, date, isFirst, ar }: { score: number; date: string; isFirst?: boolean; ar: boolean }) {
  const color = maturityColor(score)
  const label = isFirst
    ? (ar ? 'أول حفظ' : 'First save')
    : maturityStage(score, ar)
  return (
    <div className="flex items-center gap-3 py-3" style={{ borderBottom: `1px solid ${BORDER}` }}>
      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: `${color}14`, border: `1px solid ${color}33` }}>
        <span className="text-base font-black tabular-nums" style={{ color, fontSize: 13 }}>{score}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold" style={{ color: TEXT_MAIN }}>{label}</p>
        <p className="text-[10px] mt-0.5" style={{ color: TEXT_FAINT }}>
          {new Date(date).toLocaleDateString(ar ? 'ar-EG' : 'en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
      <div className="w-16 h-1 rounded-full overflow-hidden" style={{ background: BORDER }}>
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
      style={{ background: CARD_BG, border: `1px solid ${BORDER}`, boxShadow: '0 1px 2px rgba(15,23,42,0.04)' }}>
      <div className="w-8 h-8 rounded-xl flex items-center justify-center mb-3"
        style={{ background: `${color}12`, border: `1px solid ${color}25` }}>
        <span style={{ color }}>{icon}</span>
      </div>
      <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: TEXT_FAINT }}>{label}</p>
      <p className="text-2xl font-black tabular-nums" style={{ color }}>{value}</p>
      {sub && <p className="text-[10px] mt-1" style={{ color: TEXT_SUB }}>{sub}</p>}
    </div>
  )
}

/* ── Main Page ────────────────────────────────────────────────── */
export default function ScoreHistoryPage() {
  const router = useRouter()
  const { authHeader } = useAuth()
  const { locale } = useI18n()
  const ar = locale === 'ar'
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [updates, setUpdates] = useState<BrainUpdate[]>([])
  const [loading, setLoading] = useState(true)

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/brain/score-history', {
        headers: { Authorization: authHeader() },
      })
      if (!res.ok) return
      const data = await res.json()
      if (Array.isArray(data.snapshots)) setSnapshots(data.snapshots)
      if (Array.isArray(data.updates)) setUpdates(data.updates)
    } catch { /* silent */ } finally {
      setLoading(false)
    }
  }, [authHeader])

  useEffect(() => { fetchHistory() }, [fetchHistory])

  // ── Derived stats (math unchanged) ─────────────────────────────
  const scores = snapshots.map(s => s.score)
  const current  = scores[scores.length - 1] ?? 0
  const peak     = scores.length > 0 ? Math.max(...scores) : 0
  const first    = scores[0] ?? 0
  const growth   = current - first
  const trend    = scores.length >= 2 ? current - scores[scores.length - 2] : 0
  const saves    = snapshots.length

  const currentColor = maturityColor(current)
  const TrendIcon = trend > 0 ? TrendingUp : trend < 0 ? TrendingDown : Minus
  // Calm: gains in green, flat/dips in slate (maturity is not pass/fail)
  const trendColor = trend > 0 ? GREEN : SLATE

  const milestones = snapshots.filter((s, i) => {
    if (i === 0) return true
    return s.score !== snapshots[i - 1].score
  }).slice(-15).reverse()

  return (
    <AppShell>
      <div className="min-h-screen p-6" style={{ background: 'transparent' }}>
        <div className="max-w-3xl mx-auto">

          {/* ── Back ──────────────────────────────────────────────── */}
          <button onClick={() => router.push('/brand')}
            className="flex items-center gap-2 mb-6 text-sm font-semibold transition-all hover:opacity-80"
            style={{ color: TEXT_SUB }}>
            <ArrowLeft size={15} className="rtl:rotate-180" />
            {ar ? 'ذاكرة العلامة' : 'Brand Brain'}
          </button>

          {/* ── Header ────────────────────────────────────────────── */}
          <div className="rounded-2xl overflow-hidden mb-4"
            style={{ background: CARD_BG, border: `1px solid ${BORDER}`, boxShadow: '0 1px 3px rgba(15,23,42,0.06)' }}>
            <div className="h-0.5 w-full" style={{ background: 'linear-gradient(90deg, #f59e0b 0%, #8b5cf6 50%, #06b6d4 100%)' }} />
            <div className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-1 h-3.5 rounded-full" style={{ background: 'linear-gradient(180deg, #f59e0b, #f59e0b80)' }} />
                <span className="text-xs font-mono font-bold tracking-[0.2em] uppercase" style={{ color: 'rgba(245,158,11,0.85)' }}>
                  {ar ? 'ذاكرة العلامة من NEXUS' : 'NEXUS BRAND BRAIN'}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <h1 className="text-3xl font-black tracking-tight flex items-center gap-3" style={{ color: TEXT_MAIN }}>
                    <Brain size={28} style={{ color: AMBER }} />
                    {ar ? 'نضج ذاكرة العلامة' : 'Brand Brain maturity'}
                  </h1>
                  <p className="text-sm mt-1" style={{ color: TEXT_SUB }}>
                    {ar
                      ? 'كيف نما العمق طويل المدى لعلامتك بمرور الوقت'
                      : 'How your brand’s long-term depth has grown over time'}
                  </p>
                </div>
                {saves > 0 && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl"
                    style={{ background: `${trendColor}12`, border: `1px solid ${trendColor}30` }}>
                    <TrendIcon size={14} style={{ color: trendColor }} />
                    <span className="text-sm font-bold" style={{ color: trendColor }}>
                      {trend > 0 ? `+${trend}` : trend === 0 ? '±0' : trend} {ar ? 'آخر حفظ' : 'last save'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Maturity vs completeness explainer (always shown) ──── */}
          <div className="rounded-2xl p-4 mb-6"
            style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
            <p className="text-[11px] leading-relaxed" style={{ color: TEXT_SUB }}>
              <span className="font-bold" style={{ color: TEXT_MAIN }}>
                {ar ? 'ما معنى النضج؟ ' : 'What maturity means: '}
              </span>
              {ar
                ? 'النضج مؤشر عمق طويل المدى يعتمد على إعدادك المحفوظ وإشارات Brand Brain المراجَعة بمرور الوقت. إنه ليس عدد حقول الهوية المحفوظة وليس الجاهزية العضوية، لذلك قد يختلف عن اكتمال حقول الهوية الأساسية الثمانية. تعلّم الأداء لا يبدأ إلا بعد وصول تحليلات أو مقاييس منصة موثوقة.'
                : 'Maturity is a long-term depth signal based on your saved setup plus reviewed Brand Brain signals over time. It is not the count of saved identity fields and not organic readiness, so it can differ from completeness even when all eight core identity fields are saved. Performance learning starts only after trusted analytics or platform metrics exist.'}
            </p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-48">
              <div className="w-8 h-8 rounded-full border-2 animate-spin"
                style={{ borderColor: BORDER, borderTopColor: AMBER }} />
            </div>
          ) : snapshots.length === 0 ? (
            /* ── Empty state ──────────────────────────────────────── */
            <div className="rounded-2xl p-12 text-center"
              style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
                <Brain size={32} style={{ color: AMBER, opacity: 0.5 }} />
              </div>
              <p className="text-lg font-bold mb-2" style={{ color: TEXT_MAIN }}>
                {ar ? 'لا يوجد سجل بعد' : 'No history yet'}
              </p>
              <p className="text-sm mb-6" style={{ color: TEXT_SUB }}>
                {ar ? 'احفظ ذاكرة علامتك مرة واحدة على الأقل لبدء التتبّع' : 'Save your Brand Brain at least once to start tracking'}
              </p>
              <button onClick={() => router.push('/brand')}
                className="px-6 py-2.5 rounded-xl text-sm font-bold transition-all"
                style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#ffffff' }}>
                {ar ? 'فتح ذاكرة العلامة' : 'Open Brand Brain'}
              </button>
            </div>
          ) : (
            <>
              {/* ── Stats row ─────────────────────────────────────── */}
              <div className="flex gap-3 mb-6 flex-wrap">
                <StatCard
                  icon={<Brain size={16} />}
                  label={ar ? 'نضج ذاكرة العلامة' : 'Brand Brain maturity'}
                  value={`${current}`}
                  sub={maturityStage(current, ar)}
                  color={currentColor}
                />
                <StatCard
                  icon={<Trophy size={16} />}
                  label={ar ? 'أعلى نضج' : 'Peak maturity'}
                  value={`${peak}`}
                  sub={ar ? 'أعلى قيمة مسجّلة' : 'All-time high'}
                  color={AMBER}
                />
                <StatCard
                  icon={<TrendingUp size={16} />}
                  label={ar ? 'نمو النضج' : 'Maturity growth'}
                  value={growth >= 0 ? `+${growth}` : `${growth}`}
                  sub={ar ? `من ${first} ← ${current}` : `From ${first} → ${current}`}
                  color={growth >= 0 ? GREEN : SLATE}
                />
                <StatCard
                  icon={<Sparkles size={16} />}
                  label={ar ? 'مرات الحفظ' : 'Brain saves'}
                  value={`${saves}`}
                  sub={ar ? 'تحديثات محفوظة' : 'Saved updates'}
                  color={VIOLET}
                />
              </div>

              {/* ── Chart ─────────────────────────────────────────── */}
              <div className="rounded-2xl p-5 mb-6"
                style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-xs font-bold uppercase tracking-widest" style={{ color: TEXT_FAINT }}>
                    {ar ? 'النضج بمرور الوقت' : 'Maturity over time'}
                  </p>
                  <div className="flex items-center gap-4">
                    {[{ color: SLATE, label: ar ? 'مبكرة' : 'Early' }, { color: AMBER, label: ar ? 'تتطوّر' : 'Developing' }, { color: GREEN, label: ar ? 'ناضجة' : 'Mature' }].map(t => (
                      <div key={t.label} className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full" style={{ background: t.color }} />
                        <span className="text-[10px]" style={{ color: TEXT_SUB }}>{t.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <ScoreChart snapshots={snapshots} ar={ar} />
              </div>

              {/* ── Maturity milestones ───────────────────────────── */}
              {current < 100 && (
                <div className="rounded-2xl p-5 mb-6"
                  style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
                  <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: TEXT_FAINT }}>
                    {ar ? 'مراحل النضج التالية' : 'Next maturity milestones'}
                  </p>
                  <div className="flex flex-col gap-2">
                    {[
                      { target: 25, label: ar ? 'مبكرة' : 'Early', desc: ar ? 'حفظ أساس العلامة' : 'Core brand saved', color: SLATE },
                      { target: 50, label: ar ? 'تتطوّر' : 'Developing', desc: ar ? 'حفظ العرض والجمهور والصوت' : 'Offer, audience & voice saved', color: AMBER },
                      { target: 75, label: ar ? 'تنضج' : 'Maturing', desc: ar ? 'حفظ القنوات والمزايا ونقاط الألم' : 'Channels, advantages & pain points saved', color: '#06b6d4' },
                      { target: 100, label: ar ? 'ناضجة' : 'Mature', desc: ar ? 'إعداد عميق محفوظ + إشارات مراجَعة وتحليلات حقيقية عند توفرها' : 'Deep saved setup + reviewed signals and real analytics when available', color: GREEN },
                    ].filter(t => t.target > current).map(t => (
                      <div key={t.target} className="flex items-center gap-3 py-2 px-3 rounded-xl"
                        style={{ background: `${t.color}0a`, border: `1px solid ${t.color}22` }}>
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ background: `${t.color}14`, border: `1px solid ${t.color}30` }}>
                          <Target size={12} style={{ color: t.color }} />
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-bold" style={{ color: TEXT_MAIN }}>{t.target} — {t.label}</p>
                          <p className="text-[10px] mt-0.5" style={{ color: TEXT_SUB }}>{t.desc}</p>
                        </div>
                        <span className="text-xs font-black tabular-nums" style={{ color: t.color }}>+{t.target - current}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Save history ──────────────────────────────────── */}
              <div className="rounded-2xl p-5"
                style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-xs font-bold uppercase tracking-widest" style={{ color: TEXT_FAINT }}>
                    {ar ? 'سجل الحفظ' : 'Save history'}
                  </p>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                    style={{ background: `${VIOLET}12`, color: VIOLET, border: `1px solid ${VIOLET}28` }}>
                    {changeCountLabel(milestones.length, ar)}
                  </span>
                </div>
                <div>
                  {milestones.map((s, i) => (
                    <MilestoneBadge key={i} score={s.score} date={s.createdAt} isFirst={i === milestones.length - 1} ar={ar} />
                  ))}
                </div>
              </div>

              {/* ── CTA ───────────────────────────────────────────── */}
              {current < 80 && (
                <div className="mt-6 rounded-2xl p-5 flex items-center justify-between gap-4"
                  style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)' }}>
                  <div className="flex items-center gap-3">
                    <Sparkles size={18} style={{ color: AMBER }} className="flex-shrink-0" />
                    <div>
                      <p className="text-sm font-bold" style={{ color: TEXT_MAIN }}>
                        {ar ? 'واصِل بناء ذاكرة علامتك' : 'Keep building your Brand Brain'}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: TEXT_SUB }}>
                        {ar ? 'المزيد من الإعداد المحفوظ والنشاط الحقيقي يعمّق النضج بمرور الوقت' : 'More saved setup and real activity deepen maturity over time'}
                      </p>
                    </div>
                  </div>
                  <button onClick={() => router.push('/brand')}
                    className="flex-shrink-0 inline-flex items-center gap-1 px-5 py-2.5 rounded-xl text-sm font-bold transition-all"
                    style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#ffffff' }}>
                    {ar ? 'فتح ذاكرة العلامة' : 'Open Brand Brain'}
                    <ChevronRight size={15} className="rtl:rotate-180" />
                  </button>
                </div>
              )}
            </>
          )}

          {!loading && updates.length > 0 && (
            <div className="rounded-2xl p-5 mt-6"
              style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs font-bold uppercase tracking-widest" style={{ color: TEXT_FAINT }}>
                  {ar ? 'تحديثات ذاكرة العلامة' : 'Brand Brain updates'}
                </p>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                  style={{ background: `${GREEN}12`, color: GREEN, border: `1px solid ${GREEN}28` }}>
                  {updates.filter(u => u.status === 'accepted').length} {ar ? 'مقبولة' : 'accepted'}
                </span>
              </div>
              <div className="space-y-2">
                {updates.map(update => {
                  const accepted = update.status === 'accepted'
                  const color = accepted ? GREEN : SLATE
                  const statusLabel = accepted ? (ar ? 'مقبولة' : 'accepted') : (ar ? 'مُتجاهلة' : 'dismissed')
                  return (
                    <div key={update.id} className="rounded-xl p-3"
                      style={{ background: accepted ? 'rgba(16,185,129,0.05)' : SURFACE, border: `1px solid ${accepted ? 'rgba(16,185,129,0.2)' : BORDER}` }}>
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ background: `${color}14`, border: `1px solid ${color}30` }}>
                          <span className="text-sm">{update.icon || '🧠'}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-xs font-bold" style={{ color: TEXT_MAIN }}>
                              {update.displayName || update.field}
                            </p>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-md uppercase"
                              style={{ background: `${color}12`, color, border: `1px solid ${color}28` }}>
                              {statusLabel}
                            </span>
                            <span className="text-[10px]" style={{ color: TEXT_FAINT }}>
                              {update.trigger.replace(/_/g, ' ')}
                            </span>
                          </div>
                          <p className="text-xs mt-1 leading-relaxed" style={{ color: TEXT_SUB }}>
                            {formatProposed(update.proposed)}
                          </p>
                          <p className="text-[10px] mt-1 leading-relaxed" style={{ color: TEXT_FAINT }}>
                            {update.reason}
                          </p>
                        </div>
                        <span className="text-[10px] flex-shrink-0" style={{ color: TEXT_FAINT }}>
                          {new Date(update.updatedAt).toLocaleDateString(ar ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}
