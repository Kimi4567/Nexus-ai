'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  LayoutGrid, Layers, Video, Megaphone,
  BarChart3, Eye, Settings, Plus
} from 'lucide-react';

const navItems = [
  { id: 'dashboard', label: 'لوحة التحكم', icon: LayoutGrid, href: '/dashboard', color: '#f59e0b' },
  { id: 'campaigns', label: 'الحملات', icon: Layers, href: '/campaigns', color: '#06b6d4' },
  { id: 'studio', label: 'استوديو NEX', icon: Video, href: '/studio', color: '#06b6d4' },
  { id: 'vex', label: 'مدير VEX', icon: Megaphone, href: '/vex', color: '#f59e0b' },
  { id: 'analytics', label: 'تحليلات PULSE', icon: BarChart3, href: '/analytics', color: '#10b981' },
  { id: 'sentinel', label: 'مراقب SENTINEL', icon: Eye, href: '/sentinel', color: '#f43f5e' },
  { id: 'settings', label: 'الإعدادات', icon: Settings, href: '/settings', color: '#94a3b8' },
];

const stats = [
  { title: 'حملات نشطة', value: '12', trend: '+23.5%', trendUp: true, color: '#f59e0b' },
  { title: 'فيديوهات مُنتجة', value: '156', trend: '+45.2%', trendUp: true, color: '#06b6d4' },
  { title: 'إنفاق إعلاني', value: '$12,450', trend: '-5.3%', trendUp: false, color: '#10b981' },
  { title: 'عائد الاستثمار', value: '287%', trend: '+12.8%', trendUp: true, color: '#f59e0b' },
];

const campaigns = [
  { id: 1, nameAr: 'إطلاق منتج صيفي', status: 'active', platforms: ['Instagram', 'TikTok'], budget: 500, spent: 320, roi: 3.2 },
  { id: 2, nameAr: 'تخفيضات نهاية الشهر', status: 'paused', platforms: ['TikTok'], budget: 800, spent: 150, roi: 1.8 },
  { id: 3, nameAr: 'حملة تسويقية جديدة', status: 'active', platforms: ['Facebook', 'Instagram', 'Google'], budget: 1200, spent: 890, roi: 4.5 },
  { id: 4, nameAr: 'إطلاق تطبيق جديد', status: 'active', platforms: ['Instagram', 'Snapchat'], budget: 600, spent: 420, roi: 2.9 },
];

const agents = [
  { id: 'nex', name: 'NEX', roleAr: 'مُنتج الفيديو', color: '#06b6d4', progress: 78, status: 'working' },
  { id: 'vex', name: 'VEX', roleAr: 'مُدير الإعلانات', color: '#f59e0b', progress: 0, status: 'idle' },
  { id: 'pulse', name: 'PULSE', roleAr: 'مُحلّل البيانات', color: '#10b981', progress: 45, status: 'working' },
  { id: 'sentinel', name: 'SENTINEL', roleAr: 'مُراقب المنافسة', color: '#f43f5e', progress: 92, status: 'working' },
];

export default function DashboardPage() {
  useEffect(() => {
    document.documentElement.dir = 'rtl';
    document.documentElement.lang = 'ar';
  }, []);

  return (
    <div className="flex min-h-screen bg-[#020204] text-[#f8fafc]">
      {/* Sidebar */}
      <aside className="fixed top-0 right-0 w-64 h-screen bg-[#0a0a12] border-l border-white/[0.08] z-50 flex flex-col">
        <div className="p-5 border-b border-white/[0.08] flex items-center gap-2.5">
          <div className="w-9 h-9 border-2 border-amber-500 rounded-lg grid place-items-center font-black text-amber-500 text-lg">N</div>
          <div>
            <div className="font-extrabold tracking-wider text-sm bg-gradient-to-br from-amber-400 via-cyan-400 to-violet-500 bg-clip-text text-transparent">NEXUS</div>
            <div className="text-[0.65rem] text-[#64748b] font-semibold">AI COMMAND</div>
          </div>
        </div>
        <nav className="flex-1 p-3 overflow-y-auto">
          {navItems.map((item) => (
            <Link key={item.id} href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all no-underline mb-1 ${item.id === 'dashboard' ? 'bg-white/5 text-[#f8fafc]' : 'text-[#94a3b8] hover:bg-white/5 hover:text-[#f8fafc]'}`}>
              <item.icon size={18} style={{ color: item.id === 'dashboard' ? item.color : 'currentColor' }} />
              <span className="flex-1 text-right">{item.label}</span>
              {item.id === 'dashboard' && <span className="w-1.5 h-1.5 rounded-full" style={{ background: item.color }} />}
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t border-white/[0.08]">
          <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] p-3 rounded-xl flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-500 to-violet-500 grid place-items-center font-bold text-xs text-black">RA</div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate">Raouf</div>
              <div className="text-xs text-[#64748b]">Pro Plan</div>
            </div>
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 mr-64">
        <header className="sticky top-0 z-40 px-6 py-4 bg-[rgba(10,10,18,0.8)] backdrop-blur-xl border-b border-white/[0.08] flex items-center justify-between">
          <h1 className="text-lg font-bold">لوحة التحكم</h1>
          <Link href="/campaigns/new" className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-br from-amber-500 to-amber-700 text-black font-bold text-sm rounded-xl hover:-translate-y-0.5 transition-transform no-underline">
            <Plus size={16} strokeWidth={3} /> حملة جديدة
          </Link>
        </header>

        <div className="p-6">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
            <h2 className="text-2xl font-extrabold mb-1">مرحباً بك في NEXUS 👋</h2>
            <p className="text-[#94a3b8] text-sm">فريق الذكاء الاصطناعي الخاص بك يعمل الآن</p>
          </motion.div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {stats.map((stat, i) => (
              <motion.div key={stat.title} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] p-5 rounded-2xl hover:bg-white/[0.05] transition-colors">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg" style={{ background: `${stat.color}15`, color: stat.color }}>
                    {stat.title[0]}
                  </div>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${stat.trendUp ? 'bg-green-500/10 text-green-400' : 'bg-rose-500/10 text-rose-400'}`}>{stat.trend}</span>
                </div>
                <div className="text-2xl font-black mb-1">{stat.value}</div>
                <div className="text-sm text-[#94a3b8]">{stat.title}</div>
              </motion.div>
            ))}
          </div>

          {/* Two Column */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
            {/* Campaigns */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
              className="lg:col-span-2 bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] p-6 rounded-2xl">
              <div className="flex justify-between items-center mb-5">
                <h3 className="text-base font-bold">الحملات الحديثة</h3>
                <Link href="/campaigns" className="text-xs text-cyan-400 no-underline hover:underline">عرض الكل →</Link>
              </div>
              <div className="space-y-2">
                {campaigns.map((c) => {
                  const statusColor = c.status === 'active' ? '#10b981' : c.status === 'paused' ? '#f59e0b' : '#64748b';
                  return (
                    <div key={c.id} className="flex items-center gap-3 p-3.5 rounded-xl bg-white/[0.02]">
                      <div className="w-0.5 h-10 rounded-full flex-shrink-0" style={{ background: statusColor }} />
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm truncate">{c.nameAr}</div>
                        <div className="text-xs text-[#64748b] mt-0.5">{c.platforms.join(' • ')} • ${c.budget}</div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-sm font-bold">${c.spent}</div>
                        <div className="text-xs text-green-400">ROI: {c.roi}x</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>

            {/* Agent Status */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
              className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] p-6 rounded-2xl">
              <h3 className="text-base font-bold mb-5">حالة الوكلاء</h3>
              <div className="space-y-4">
                {agents.map((a) => (
                  <div key={a.id}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2.5">
                        <span className={`w-2 h-2 rounded-full ${a.status === 'working' ? 'bg-green-500 animate-pulse' : 'bg-amber-500'}`} />
                        <div>
                          <div className="font-bold text-sm">{a.name}</div>
                          <div className="text-xs text-[#64748b]">{a.roleAr}</div>
                        </div>
                      </div>
                      <span className={`text-xs font-bold ${a.status === 'working' ? 'text-green-400' : 'text-amber-400'}`}>{a.status === 'working' ? 'يعمل' : 'في الانتظار'}</span>
                    </div>
                    <div className="h-1 rounded-full bg-white/5 overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${a.progress}%`, background: a.color }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-5 pt-5 border-t border-white/[0.08]">
                <div className="text-xs text-[#64748b] mb-3 font-semibold">نشاط اليوم</div>
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="p-3 bg-white/[0.03] rounded-xl text-center">
                    <div className="text-xl font-extrabold text-cyan-400">8</div>
                    <div className="text-xs text-[#64748b]">فيديوهات</div>
                  </div>
                  <div className="p-3 bg-white/[0.03] rounded-xl text-center">
                    <div className="text-xl font-extrabold text-amber-400">3</div>
                    <div className="text-xs text-[#64748b]">حملات</div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { icon: '🎬', title: 'إنشاء فيديو', desc: 'NEX يُنتج فيديو جديد', href: '/studio', color: '#06b6d4' },
              { icon: '🚀', title: 'إطلاق حملة', desc: 'VEX يُدير الإعلانات', href: '/campaigns/new', color: '#f59e0b' },
              { icon: '👁️', title: 'مراقبة المنافسين', desc: 'SENTINEL يُحلّل السوق', href: '/sentinel', color: '#f43f5e' },
            ].map((action, i) => (
              <motion.div key={action.title} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 + i * 0.1 }}>
                <Link href={action.href} className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] p-6 rounded-2xl text-center block transition-all hover:-translate-y-1 hover:bg-white/[0.05] no-underline text-[#f8fafc]">
                  <div className="w-14 h-14 rounded-2xl grid place-items-center text-2xl mx-auto mb-4" style={{ background: `${action.color}15`, color: action.color }}>{action.icon}</div>
                  <div className="font-bold mb-1">{action.title}</div>
                  <div className="text-xs text-[#94a3b8]">{action.desc}</div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
