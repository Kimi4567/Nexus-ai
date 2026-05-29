'use client'

import AppShell from '@/components/AppShell'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import {
  Shield, ShieldAlert, ShieldCheck, AlertTriangle, Eye, TrendingDown, Globe, Bell,
  Zap, Lock, Unlock, Radio, Radar, Siren, Skull, Target, Crosshair, ScanLine,
  Activity, Clock, ChevronRight, Sparkles
} from 'lucide-react'

/* ═══════════════════════════════════════════════════════════════
   SENTINEL WATCHTOWER — Guardian Station in the Void
   Watching the digital cosmos. Every threat spotted before it strikes.
   ═══════════════════════════════════════════════════════════════ */

interface Alert {
  id: string
  type: 'success' | 'warning' | 'error' | 'info' | 'critical'
  message: string
  source: string
  time: string
  read: boolean
  priority: number
}

interface Competitor {
  name: string
  activity: string
  threatLevel: 'low' | 'medium' | 'high' | 'critical'
  lastUpdate: string
  trend: 'up' | 'down' | 'stable'
  spendEstimate: string
}

interface SystemHealth {
  component: string
  status: 'healthy' | 'degraded' | 'critical'
  uptime: string
  lastCheck: string
}

// Radar sweep animation background
function RadarGrid() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
      {/* Subtle grid */}
      <div className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(6,182,212,0.3) 1px, transparent 1px),
            linear-gradient(90deg, rgba(6,182,212,0.3) 1px, transparent 1px)
          `,
          backgroundSize: '80px 80px',
        }}
      />
      
      {/* Radar sweep line */}
      <div className="absolute top-1/2 left-1/2 w-[150vw] h-[2px] origin-left"
        style={{
          background: 'linear-gradient(90deg, transparent, rgba(6,182,212,0.3), transparent)',
          animation: 'radarSweep 8s linear infinite',
          transformOrigin: 'left center',
        }}
      />
      
      {/* Circular radar rings */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{ width: '600px', height: '600px' }}
      >
        {[1, 2, 3].map((ring) => (
          <div
            key={ring}
            className="absolute rounded-full border border-cyan-500/10"
            style={{
              width: `${ring * 200}px`,
              height: `${ring * 200}px`,
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              animation: `radarPulse ${3 + ring}s ease-in-out infinite`,
            }}
          />
        ))}
      </div>
      
      <style jsx>{`
        @keyframes radarSweep {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes radarPulse {
          0%, 100% { opacity: 0.1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  )
}

export default function SentinelPage() {
  const { isAuthenticated, loading } = useAuth()
  const router = useRouter()
  useEffect(() => { if (!loading && !isAuthenticated) router.push('/auth/login') }, [loading, isAuthenticated, router])
  if (loading) return <div className="min-h-screen bg-dark flex items-center justify-center"><div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" /></div>
  if (!isAuthenticated) return null

  const [alerts, setAlerts] = useState<Alert[]>([
    { id: '1', type: 'critical', message: 'انخفاض حاد في CTR حملة "الصيف" - 2.1% فقط', source: 'VEX', time: 'منذ 3 دقائق', read: false, priority: 1 },
    { id: '2', type: 'warning', message: 'ميزانية حملة "صيف 2026" وصلت 85% من المخصص', source: 'Sentinel', time: 'منذ 25 دقيقة', read: false, priority: 2 },
    { id: '3', type: 'info', message: 'فرصة: زيادة الإنفاق على TikTok بنسبة 23% قد تحقق ROAS أعلى', source: 'PULSE', time: 'منذ ساعة', read: false, priority: 3 },
    { id: '4', type: 'error', message: 'فشل في تحديث حملة Google Ads - رمز API منتهي', source: 'VEX', time: 'منذ ساعتين', read: true, priority: 1 },
    { id: '5', type: 'warning', message: 'منافس جديد "شركة النخبة" زاد إنفاقه 45% على نفس الكلمات المستهدفة', source: 'Sentinel', time: 'منذ 4 ساعات', read: false, priority: 2 },
    { id: '6', type: 'success', message: 'أداء حملة "رمضان" تجاوز المستهدف بنسبة 32%', source: 'PULSE', time: 'منذ 6 ساعات', read: true, priority: 4 },
    { id: '7', type: 'info', message: 'NEX أنتج 5 فيديوهات جديدة جاهزة للمراجعة', source: 'NEX', time: 'منذ 8 ساعات', read: true, priority: 3 },
  ])

  const [competitors] = useState<Competitor[]>([
    { name: 'شركة النخبة', activity: 'زيادة الإنفاق 45% على نفس الكلمات', threatLevel: 'critical', lastUpdate: 'منذ ساعة', trend: 'up', spendEstimate: '$15K/شهر' },
    { name: 'BrandX', activity: 'إطلاق منتج منافس مباشر', threatLevel: 'high', lastUpdate: 'منذ 3 ساعات', trend: 'up', spendEstimate: '$8K/شهر' },
    { name: 'تطبيق الريادة', activity: 'حملة تسويقية كبيرة على TikTok', threatLevel: 'medium', lastUpdate: 'منذ يوم', trend: 'stable', spendEstimate: '$5K/شهر' },
    { name: 'منصة المنافس', activity: 'توقف إعلاناته على Google', threatLevel: 'low', lastUpdate: 'منذ يومين', trend: 'down', spendEstimate: '$2K/شهر' },
  ])

  const [systemHealth] = useState<SystemHealth[]>([
    { component: 'Meta API', status: 'healthy', uptime: '99.9%', lastCheck: 'منذ دقيقة' },
    { component: 'TikTok API', status: 'healthy', uptime: '99.7%', lastCheck: 'منذ دقيقة' },
    { component: 'Google Ads API', status: 'degraded', uptime: '94.2%', lastCheck: 'منذ 5 دقائق' },
    { component: 'OpenAI API', status: 'healthy', uptime: '99.8%', lastCheck: 'منذ دقيقة' },
    { component: 'Stripe', status: 'healthy', uptime: '99.99%', lastCheck: 'منذ دقيقة' },
  ])

  const [activeThreats, setActiveThreats] = useState(2)
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    setUnreadCount(alerts.filter(a => !a.read).length)
    setActiveThreats(competitors.filter(c => c.threatLevel === 'high' || c.threatLevel === 'critical').length)
  }, [alerts, competitors])

  const markRead = (id: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, read: true } : a))
  }

  const markAllRead = () => {
    setAlerts(prev => prev.map(a => ({ ...a, read: true })))
  }

  const alertConfig: Record<string, { icon: any; color: string; bg: string; border: string; label: string }> = {
    success: { icon: ShieldCheck, color: 'text-emerald-400', bg: 'bg-emerald-500/5', border: 'border-emerald-500/15', label: 'نجاح' },
    warning: { icon: AlertTriangle, color: 'text-amber', bg: 'bg-amber/5', border: 'border-amber/15', label: 'تحذير' },
    error: { icon: TrendingDown, color: 'text-red-400', bg: 'bg-red-500/5', border: 'border-red-500/15', label: 'خطأ' },
    info: { icon: Eye, color: 'text-cyan', bg: 'bg-cyan/5', border: 'border-cyan/15', label: 'معلومة' },
    critical: { icon: Siren, color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/25', label: 'حرج' },
  }

  const threatConfig: Record<string, { color: string; bg: string; border: string; icon: any; label: string }> = {
    critical: { color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/25', icon: Skull, label: 'حرج' },
    high: { color: 'text-red-400', bg: 'bg-red-500/5', border: 'border-red-400/20', icon: ShieldAlert, label: 'عالي' },
    medium: { color: 'text-amber', bg: 'bg-amber/5', border: 'border-amber/15', icon: AlertTriangle, label: 'متوسط' },
    low: { color: 'text-emerald-400', bg: 'bg-emerald-500/5', border: 'border-emerald-500/15', icon: ShieldCheck, label: 'منخفض' },
  }

  const healthConfig: Record<string, { color: string; bg: string; icon: any }> = {
    healthy: { color: 'text-emerald-400', bg: 'bg-emerald-500/8', icon: ShieldCheck },
    degraded: { color: 'text-amber', bg: 'bg-amber/8', icon: ShieldAlert },
    critical: { color: 'text-red-400', bg: 'bg-red-500/8', icon: Siren },
  }

  return (
    <AppShell>
    <div className="relative min-h-screen space-y-8">
      <RadarGrid />

      {/* Ambient glow */}
      <div className="fixed w-[500px] h-[500px] rounded-full opacity-10 blur-[120px] pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(16,185,129,0.15), transparent 70%)',
          top: '20%',
          right: '-10%',
        }}
      />
      <div className="fixed w-[400px] h-[400px] rounded-full opacity-8 blur-[100px] pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(6,182,212,0.1), transparent 70%)',
          bottom: '15%',
          left: '-5%',
        }}
      />

      <div className="relative z-10">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald/20 to-teal/10 flex items-center justify-center">
              <Radar className="w-4 h-4 text-emerald-400" />
            </div>
            <span className="text-xs text-emerald-400/70 font-mono tracking-wider">SENTINEL WATCHTOWER</span>
          </div>
          <h1 className="text-3xl font-bold mb-2">برج المراقبة</h1>
          <p className="text-text-muted text-sm">
            Sentinel يراقب كل شيء: الأداء، الميزانية، المنافسين، والتهديدات. لا شيء يفوته.
          </p>
        </div>

        {/* Demo data notice */}
        <div
          className="flex items-center gap-3 px-5 py-3 mb-8 rounded-xl"
          style={{
            background: 'rgba(6,182,212,0.05)',
            border: '1px solid rgba(6,182,212,0.2)',
          }}
        >
          <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
          <p className="text-sm text-cyan-300/80">
            <span className="font-bold text-cyan-400">بيانات توضيحية</span> — التنبيهات وبيانات المنافسين أدناه للعرض التجريبي فقط. ستتحول إلى بيانات حقيقية بعد ربط حساباتك.
          </p>
        </div>

        {/* System Status Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'التنبيهات الجديدة', value: unreadCount, icon: Bell, color: unreadCount > 0 ? 'amber' : 'emerald', status: unreadCount > 0 ? 'warning' : 'healthy' },
            { label: 'التهديدات النشطة', value: activeThreats, icon: ShieldAlert, color: activeThreats > 0 ? 'red' : 'emerald', status: activeThreats > 0 ? 'critical' : 'healthy' },
            { label: 'الأنظمة المتصلة', value: systemHealth.filter(s => s.status === 'healthy').length, icon: ShieldCheck, color: 'emerald', status: 'healthy' },
            { label: 'وقت الاستجابة', value: '< 1s', icon: Zap, color: 'cyan', status: 'healthy' },
          ].map((card) => {
            const Icon = card.icon
            const colorMap: Record<string, string> = {
              amber: '#f59e0b',
              red: '#ef4444',
              emerald: '#10b981',
              cyan: '#06b6d4',
            }
            const c = colorMap[card.color]
            return (
              <div
                key={card.label}
                className="p-5 corner-accent"
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  backdropFilter: 'blur(30px)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: '20px',
                }}
              >
                <div className="flex items-center justify-between mb-3">
                  <Icon className="w-5 h-5" style={{ color: c }} />
                  {card.status === 'warning' && (
                    <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: c, boxShadow: `0 0 8px ${c}` }} />
                  )}
                  {card.status === 'critical' && (
                    <span className="w-2 h-2 rounded-full animate-ping" style={{ background: c }} />
                  )}
                </div>
                <p className="text-3xl font-bold mb-1">{card.value}</p>
                <p className="text-xs text-text-muted">{card.label}</p>
              </div>
            )
          })}
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Alerts Feed */}
          <div
            className="p-6 corner-accent"
            style={{
              background: 'rgba(255,255,255,0.02)',
              backdropFilter: 'blur(30px)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '24px',
            }}
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Siren className="w-5 h-5 text-red-400" />
                <h3 className="text-lg font-bold">التنبيهات والإشعارات</h3>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 text-xs font-bold border border-red-500/20">
                    {unreadCount} جديد
                  </span>
                )}
              </div>
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-xs text-cyan hover:text-cyan-300 transition-colors flex items-center gap-1"
                >
                  <Eye className="w-3 h-3" />
                  تحديد الكل مقروء
                </button>
              )}
            </div>

            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
              {alerts.map((alert) => {
                const config = alertConfig[alert.type]
                const AlertIcon = config.icon
                return (
                  <div
                    key={alert.id}
                    onClick={() => markRead(alert.id)}
                    className={`p-4 rounded-xl border cursor-pointer transition-all hover:scale-[1.01] ${config.bg} ${config.border} ${
                      !alert.read ? 'border-l-2 border-l-current' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 ${config.color}`}>
                        <AlertIcon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${config.bg} ${config.color}`}>
                            {config.label}
                          </span>
                          <span className="text-xs text-text-muted">{alert.source}</span>
                        </div>
                        <p className="text-sm font-medium mb-1">{alert.message}</p>
                        <div className="flex items-center gap-2 text-xs text-text-muted">
                          <Clock className="w-3 h-3" />
                          {alert.time}
                        </div>
                      </div>
                      {!alert.read && (
                        <div className="w-2.5 h-2.5 rounded-full bg-amber shrink-0 mt-2 animate-pulse" style={{ boxShadow: '0 0 8px rgba(245,158,11,0.5)' }} />
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Competitor Intelligence */}
          <div className="space-y-6">
            <div
              className="p-6 corner-accent"
              style={{
                background: 'rgba(255,255,255,0.02)',
                backdropFilter: 'blur(30px)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '24px',
              }}
            >
              <div className="flex items-center gap-2 mb-6">
                <Crosshair className="w-5 h-5 text-red-400" />
                <h3 className="text-lg font-bold">استخبارات المنافسين</h3>
              </div>

              <div className="space-y-4">
                {competitors.map((comp) => {
                  const config = threatConfig[comp.threatLevel]
                  const ThreatIcon = config.icon
                  return (
                    <div
                      key={comp.name}
                      className="p-4 rounded-xl border transition-all hover:scale-[1.01]"
                      style={{
                        background: 'rgba(255,255,255,0.02)',
                        border: `1px solid ${comp.threatLevel === 'critical' ? 'rgba(239,68,68,0.15)' : comp.threatLevel === 'high' ? 'rgba(248,113,113,0.1)' : 'rgba(255,255,255,0.06)'}`,
                      }}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
                            <Globe className="w-5 h-5 text-text-muted" />
                          </div>
                          <div>
                            <p className="font-bold text-sm">{comp.name}</p>
                            <p className="text-xs text-text-muted">{comp.lastUpdate}</p>
                          </div>
                        </div>
                        <span className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border ${config.bg} ${config.color} ${config.border}`}>
                          <ThreatIcon className="w-3 h-3" />
                          {config.label}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-text-secondary">{comp.activity}</p>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-text-muted">إنفاق تقديري:</span>
                          <span className="font-bold text-amber">{comp.spendEstimate}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* System Health Monitor */}
            <div
              className="p-6 corner-accent"
              style={{
                background: 'rgba(255,255,255,0.02)',
                backdropFilter: 'blur(30px)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '24px',
              }}
            >
              <div className="flex items-center gap-2 mb-6">
                <Activity className="w-5 h-5 text-cyan" />
                <h3 className="text-lg font-bold">صحة الأنظمة</h3>
              </div>

              <div className="space-y-3">
                {systemHealth.map((system) => {
                  const config = healthConfig[system.status]
                  const HealthIcon = config.icon
                  return (
                    <div key={system.component} className="flex items-center justify-between p-3 rounded-xl bg-white/3 border border-transparent hover:border-white/5 transition-all">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${config.bg}`}>
                          <HealthIcon className={`w-4 h-4 ${config.color}`} />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{system.component}</p>
                          <p className="text-xs text-text-muted">آخر فحص: {system.lastCheck}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-bold ${config.color}`}>{system.uptime}</p>
                        <p className="text-[10px] text-text-muted">uptime</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    </AppShell>
  )
}
