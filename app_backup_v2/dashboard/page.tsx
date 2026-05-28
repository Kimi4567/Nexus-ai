'use client'

import StatCard from '../components/StatCard'
import { Video, Megaphone, BarChart3, TrendingUp, Eye, MousePointer, DollarSign, Users } from 'lucide-react'

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">لوحة التحكم</h1>
        <p className="text-text-muted text-sm">نظرة عامة على أداء حملاتك</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="الفيديوهات" value="24" change="+12% هذا الشهر" changeType="positive" icon={<Video className="w-5 h-5" />} />
        <StatCard title="الحملات" value="8" change="+3 جديدة" changeType="positive" icon={<Megaphone className="w-5 h-5" />} />
        <StatCard title="المشاهدات" value="142K" change="+28% هذا الشهر" changeType="positive" icon={<Eye className="w-5 h-5" />} />
        <StatCard title="التفاعل" value="4.2%" change="-0.3%" changeType="negative" icon={<MousePointer className="w-5 h-5" />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass p-6" style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px' }}>
          <h3 className="text-lg font-bold mb-4">الإيرادات</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-text-secondary text-sm">الشهر الحالي</span>
              <span className="font-bold text-emerald-400">$12,450</span>
            </div>
            <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
              <div className="h-full w-[75%] bg-gradient-to-l from-emerald-500 to-emerald-400 rounded-full" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-text-secondary text-sm">الشهر الماضي</span>
              <span className="font-bold text-text-primary">$8,320</span>
            </div>
            <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
              <div className="h-full w-[50%] bg-white/10 rounded-full" />
            </div>
          </div>
        </div>

        <div className="glass p-6" style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px' }}>
          <h3 className="text-lg font-bold mb-4">آخر النشاطات</h3>
          <div className="space-y-3">
            {[
              { action: 'تم إنشاء فيديو جديد', agent: 'NEX', time: 'منذ 5 دقائق' },
              { action: 'تم إطلاق حملة جديدة', agent: 'VEX', time: 'منذ 2 ساعات' },
              { action: 'تم تحديث التحليلات', agent: 'PULSE', time: 'منذ 4 ساعات' },
              { action: 'تم اكتشاف فرصة جديدة', agent: 'Sentinel', time: 'منذ 6 ساعات' },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-white/5">
                <div>
                  <p className="text-sm font-medium">{item.action}</p>
                  <p className="text-xs text-text-muted">بواسطة {item.agent}</p>
                </div>
                <span className="text-xs text-text-muted">{item.time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
