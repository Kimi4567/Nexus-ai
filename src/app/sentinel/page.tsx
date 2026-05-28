'use client'

import { useState } from 'react'
import {
  Shield, ShieldAlert, ShieldCheck, AlertTriangle, Eye, TrendingDown, Globe, Bell,
} from 'lucide-react'

interface Alert {
  id: string
  type: 'success' | 'warning' | 'error' | 'info'
  message: string
  time: string
  read: boolean
}

interface Competitor {
  name: string
  activity: string
  threatLevel: 'low' | 'medium' | 'high'
  lastUpdate: string
}

export default function SentinelPage() {
  const [alerts, setAlerts] = useState<Alert[]>([
    { id: '1', type: 'success', message: 'أداء الحملات ضمن المعدلات المستهدفة', time: 'منذ 10 دقائق', read: true },
    { id: '2', type: 'warning', message: 'ميزانية حملة "صيف 2026" وصلت 80%', time: 'منذ 2 ساعات', read: false },
    { id: '3', type: 'info', message: 'فرصة جديدة: زيادة الإنفاق على TikTok بنسبة 15%', time: 'منذ 4 ساعات', read: false },
    { id: '4', type: 'error', message: 'انخفاض CTR في حملة Google Ads', time: 'منذ 6 ساعات', read: true },
    { id: '5', type: 'warning', message: 'منافس جديد بدأ حملة إعلانية مماثلة', time: 'منذ 12 ساعة', read: false },
  ])

  const competitors: Competitor[] = [
    { name: 'شركة النخبة', activity: 'زيادة الإنفاق 40%', threatLevel: 'high', lastUpdate: 'منذ ساعة' },
    { name: 'BrandX', activity: 'إطلاق منتج جديد', threatLevel: 'medium', lastUpdate: 'منذ 3 ساعات' },
    { name: 'تطبيق الريادة', activity: 'حملة تسويقية كبيرة', threatLevel: 'low', lastUpdate: 'منذ يوم' },
  ]

  const markRead = (id: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, read: true } : a))
  }

  const statusCards = [
    { label: 'الحالة العامة', value: 'صحي', status: 'healthy' },
    { label: 'الميزانية', value: '62% مستخدم', status: 'warning' },
    { label: 'الأداء', value: 'ممتاز', status: 'healthy' },
    { label: 'المنافسين', value: '3 نشطين', status: 'warning' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Sentinel - المراقبة</h1>
        <p className="text-text-muted text-sm">نظام المراقبة والتنبيهات الذكي</p>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statusCards.map((card) => (
          <div key={card.label} className="glass p-5" style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px' }}>
            <p className="text-text-muted text-sm mb-1">{card.label}</p>
            <div className="flex items-center gap-2">
              {card.status === 'healthy' ? (
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
              ) : (
                <ShieldAlert className="w-5 h-5 text-amber" />
              )}
              <span className="text-lg font-bold">{card.value}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Competitor Monitoring */}
      <div className="glass p-6" style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px' }}>
        <div className="flex items-center gap-2 mb-4">
          <Eye className="w-5 h-5 text-cyan" />
          <h3 className="text-lg font-bold">مراقبة المنافسين</h3>
        </div>
        <div className="space-y-3">
          {competitors.map((comp) => (
            <div key={comp.name} className="flex items-center gap-4 p-4 rounded-xl bg-white/5">
              <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center">
                <Globe className="w-5 h-5 text-text-muted" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-sm">{comp.name}</p>
                <p className="text-xs text-text-muted">{comp.activity} · {comp.lastUpdate}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                  comp.threatLevel === 'high' ? 'bg-red-500/10 text-red-400' :
                  comp.threatLevel === 'medium' ? 'bg-amber/10 text-amber' :
                  'bg-emerald-500/10 text-emerald-400'
                }`}>
                  {comp.threatLevel === 'high' ? 'خطر عالي' : comp.threatLevel === 'medium' ? 'خطر متوسط' : 'خطر منخفض'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Alerts Feed */}
      <div className="glass p-6" style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px' }}>
        <div className="flex items-center gap-2 mb-4">
          <Bell className="w-5 h-5 text-amber" />
          <h3 className="text-lg font-bold">التنبيهات</h3>
          <span className="px-2 py-0.5 rounded-full bg-amber/10 text-amber text-xs font-medium">
            {alerts.filter(a => !a.read).length} جديدة
          </span>
        </div>
        <div className="space-y-3">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              onClick={() => markRead(alert.id)}
              className={`p-4 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                alert.type === 'success' ? 'bg-emerald-500/5 border-emerald-500/20' :
                alert.type === 'warning' ? 'bg-amber/5 border-amber/20' :
                alert.type === 'error' ? 'bg-red-500/5 border-red-500/20' :
                'bg-cyan/5 border-cyan/20'
              } ${!alert.read ? 'border-l-2 border-l-current' : ''}`}
            >
              <div className="mt-0.5">
                {alert.type === 'success' && <ShieldCheck className="w-5 h-5 text-emerald-400" />}
                {alert.type === 'warning' && <AlertTriangle className="w-5 h-5 text-amber" />}
                {alert.type === 'error' && <TrendingDown className="w-5 h-5 text-red-400" />}
                {alert.type === 'info' && <Shield className="w-5 h-5 text-cyan" />}
              </div>
              <div className="flex-1">
                <p className="text-sm">{alert.message}</p>
                <p className="text-xs text-text-muted mt-1">{alert.time}</p>
              </div>
              {!alert.read && <div className="w-2 h-2 rounded-full bg-amber mt-2" />}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
