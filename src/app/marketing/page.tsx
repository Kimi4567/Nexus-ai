'use client'

import { useState, useEffect } from 'react'
import Navbar from '@/components/ui/Navbar'
import { useI18n } from '@/lib/i18n-context'
import {
  Video, Megaphone, BarChart3, Shield, Activity, TrendingUp,
  Users, MousePointer, Eye, Zap, Globe, ArrowUpRight,
  Clock, CheckCircle2, AlertCircle, Sparkles, Play, Pause,
  ChevronDown, ChevronUp, ExternalLink, Bot, Target,
  FileText, Image, Send, MessageSquare
} from 'lucide-react'

/* ═══════════════════════════════════════════════════════════════
   NEXUS AI MARKETING ITSELF — Live Meta-Marketing Dashboard
   The platform using its own 4 agents to market itself.
   ═══════════════════════════════════════════════════════════════ */

interface Campaign {
  id: string
  platform: string
  status: 'active' | 'paused' | 'completed'
  budget: number
  spent: number
  impressions: number
  clicks: number
  conversions: number
  ctr: number
  cpa: number
  aiAgent: string
  lastOptimized: string
}

interface ContentItem {
  id: string
  type: 'video' | 'ad_copy' | 'social_post' | 'script'
  title: string
  agent: string
  status: 'generating' | 'ready' | 'published'
  createdAt: string
  metrics?: { views?: number; engagement?: number }
}

interface Alert {
  id: string
  type: 'competitor' | 'opportunity' | 'warning' | 'insight'
  message: string
  agent: string
  severity: 'low' | 'medium' | 'high'
  time: string
}

interface Metric {
  label: string
  value: string
  change: number
  icon: any
  color: string
}

const DEMO_CAMPAIGNS: Campaign[] = [
  {
    id: 'vex-meta-001',
    platform: 'Meta (Facebook + Instagram)',
    status: 'active',
    budget: 500,
    spent: 347.50,
    impressions: 45200,
    clicks: 1356,
    conversions: 43,
    ctr: 3.0,
    cpa: 8.08,
    aiAgent: 'VEX',
    lastOptimized: 'منذ ٣ دقائق',
  },
  {
    id: 'vex-google-001',
    platform: 'Google Ads',
    status: 'active',
    budget: 300,
    spent: 189.20,
    impressions: 28400,
    clicks: 892,
    conversions: 28,
    ctr: 3.14,
    cpa: 6.76,
    aiAgent: 'VEX',
    lastOptimized: 'منذ ١٢ دقيقة',
  },
  {
    id: 'vex-tiktok-001',
    platform: 'TikTok Ads',
    status: 'active',
    budget: 200,
    spent: 156.80,
    impressions: 89100,
    clicks: 2673,
    conversions: 19,
    ctr: 3.0,
    cpa: 8.25,
    aiAgent: 'VEX',
    lastOptimized: 'منذ ٧ دقائق',
  },
]

const DEMO_CONTENT: ContentItem[] = [
  {
    id: 'nex-video-001',
    type: 'video',
    title: 'فيديو ترويجي: "٤ وكلاء ذكاء اصطناعي يُديرون تسويقك"',
    agent: 'NEX',
    status: 'published',
    createdAt: '٢٠٢٦-٠٥-٢٥',
    metrics: { views: 12800, engagement: 8.2 },
  },
  {
    id: 'nex-video-002',
    type: 'video',
    title: 'فيديو قصير: NEX — منتج الفيديو بالذكاء الاصطناعي',
    agent: 'NEX',
    status: 'published',
    createdAt: '٢٠٢٦-٠٥-٢٧',
    metrics: { views: 5400, engagement: 12.5 },
  },
  {
    id: 'nex-script-001',
    type: 'script',
    title: 'سكريبت فيديو: "كيف يعمل NEXUS AI"',
    agent: 'NEX',
    status: 'ready',
    createdAt: '٢٠٢٦-٠٥-٢٩',
  },
  {
    id: 'vex-copy-001',
    type: 'ad_copy',
    title: 'نسخ إعلانية Meta — مجموعة أ (٣ نسخ)',
    agent: 'VEX',
    status: 'published',
    createdAt: '٢٠٢٦-٠٥-٢٨',
  },
  {
    id: 'vex-copy-002',
    type: 'ad_copy',
    title: 'نسخ Google Ads — كلمات مفتاحية عربية',
    agent: 'VEX',
    status: 'published',
    createdAt: '٢٠٢٦-٠٥-٢٨',
  },
  {
    id: 'nex-social-001',
    type: 'social_post',
    title: 'منشور Instagram: "وفّر ٤٠ ساعة شهرياً مع NEXUS AI"',
    agent: 'NEX',
    status: 'published',
    createdAt: '٢٠٢٦-٠٥-٢٦',
    metrics: { views: 3200, engagement: 6.8 },
  },
]

const DEMO_ALERTS: Alert[] = [
  {
    id: 'sent-001',
    type: 'competitor',
    message: 'AdCreative.ai خفّض سعره من $٢٩ إلى $١٩/شهر. فرصة للرد بـ "Starter مجاني"',
    agent: 'Sentinel',
    severity: 'high',
    time: 'منذ ٢ ساعة',
  },
  {
    id: 'sent-002',
    type: 'opportunity',
    message: 'حملة TikTok تحقق تفاعلاً أعلى بنسبة ٤٠٪ من Meta — زد ميزانية TikTok بنسبة ٢٥٪',
    agent: 'Sentinel',
    severity: 'medium',
    time: 'منذ ٤ ساعات',
  },
  {
    id: 'pulse-001',
    type: 'insight',
    message: 'معدل الارتداد مرتفع (٤٥٪) على الصفحة الرئيسية — توصية: أضف فيديو توضيحي أعلى الصفحة',
    agent: 'PULSE',
    severity: 'medium',
    time: 'منذ ٦ ساعات',
  },
  {
    id: 'pulse-002',
    type: 'insight',
    message: 'كلمات البحث "تسويق AI" و "فريق ذكاء اصطناعي" تحقق أعلى تحويل في Google Ads',
    agent: 'PULSE',
    severity: 'low',
    time: 'منذ ١٢ ساعة',
  },
  {
    id: 'sent-003',
    type: 'opportunity',
    message: 'مراجعة سلبية على Jasper.ai: "الترجمة العربية ضعيفة" — فرصة لتمييز NEXUS AI بالعربية الاحترافية',
    agent: 'Sentinel',
    severity: 'medium',
    time: 'منذ يوم',
  },
]

const METRICS: Metric[] = [
  { label: 'زوار اليوم', value: '١,٢٤٧', change: 23.5, icon: Users, color: '#06b6d4' },
  { label: 'تسجيلات جديدة', value: '٤٣', change: 18.2, icon: Target, color: '#10b981' },
  { label: 'معدل التحويل', value: '٣.٤٪', change: 0.8, icon: TrendingUp, color: '#f59e0b' },
  { label: 'تكلفة التسجيل', value: '$٧.٨', change: -12.5, icon: Activity, color: '#8b5cf6' },
]

function StatusBadge({ status }: { status: Campaign['status'] }) {
  const styles = {
    active: { bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.15)', color: '#10b981', text: 'نشطة' },
    paused: { bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.15)', color: '#f59e0b', text: 'متوقفة' },
    completed: { bg: 'rgba(6,182,212,0.08)', border: 'rgba(6,182,212,0.15)', color: '#06b6d4', text: 'مكتملة' },
  }
  const s = styles[status]
  return (
    <span
      className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider"
      style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}
    >
      {s.text}
    </span>
  )
}

function ContentStatusBadge({ status }: { status: ContentItem['status'] }) {
  const styles = {
    generating: { bg: 'rgba(245,158,11,0.08)', color: '#f59e0b', text: 'يُنتج...' },
    ready: { bg: 'rgba(139,92,246,0.08)', color: '#8b5cf6', text: 'جاهز' },
    published: { bg: 'rgba(16,185,129,0.08)', color: '#10b981', text: 'منشور' },
  }
  const s = styles[status]
  return (
    <span
      className="text-[10px] px-2 py-0.5 rounded-full font-bold"
      style={{ background: s.bg, color: s.color }}
    >
      {s.text}
    </span>
  )
}

function AlertBadge({ severity }: { severity: Alert['severity'] }) {
  const styles = {
    low: { bg: 'rgba(6,182,212,0.08)', color: '#06b6d4', icon: CheckCircle2 },
    medium: { bg: 'rgba(245,158,11,0.08)', color: '#f59e0b', icon: AlertCircle },
    high: { bg: 'rgba(239,68,68,0.08)', color: '#ef4444', icon: AlertCircle },
  }
  const s = styles[severity]
  const Icon = s.icon
  return (
    <span
      className="text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1"
      style={{ background: s.bg, color: s.color }}
    >
      <Icon className="w-3 h-3" />
      {severity === 'high' ? 'عالي' : severity === 'medium' ? 'متوسط' : 'منخفض'}
    </span>
  )
}

function AgentAvatar({ agent, size = 'sm' }: { agent: string; size?: 'sm' | 'md' }) {
  const colors: Record<string, string> = {
    NEX: '#f59e0b',
    VEX: '#06b6d4',
    PULSE: '#8b5cf6',
    Sentinel: '#ef4444',
  }
  const initials: Record<string, string> = {
    NEX: 'N', VEX: 'V', PULSE: 'P', Sentinel: 'S',
  }
  const w = size === 'md' ? 'w-8 h-8 text-sm' : 'w-6 h-6 text-[10px]'
  return (
    <div
      className={`${w} rounded-lg flex items-center justify-center font-bold`}
      style={{ background: `${colors[agent]}15`, color: colors[agent], border: `1px solid ${colors[agent]}30` }}
    >
      {initials[agent]}
    </div>
  )
}

function GlassCard({ children, className = '', accentColor, style = {} }: { children: React.ReactNode; className?: string; accentColor?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`page-enter ${className}`}
      style={{
        background: 'rgba(255,255,255,0.015)',
        border: accentColor ? `1px solid ${accentColor}20` : '1px solid rgba(255,255,255,0.06)',
        borderRadius: '16px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.03)',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

export default function MarketingPage() {
  const { t, dir } = useI18n()
  const [activeTab, setActiveTab] = useState<'campaigns' | 'content' | 'analytics' | 'sentinel'>('campaigns')
  const [expandedAlert, setExpandedAlert] = useState<string | null>(null)
  const [animatedNumbers, setAnimatedNumbers] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setAnimatedNumbers(true), 500)
    return () => clearTimeout(t)
  }, [])

  const tabs = [
    { id: 'campaigns' as const, label: 'الحملات النشطة', icon: Megaphone, color: '#06b6d4', count: DEMO_CAMPAIGNS.filter(c => c.status === 'active').length },
    { id: 'content' as const, label: 'استوديو المحتوى', icon: Video, color: '#f59e0b', count: DEMO_CONTENT.length },
    { id: 'analytics' as const, label: 'التحليلات', icon: BarChart3, color: '#8b5cf6', count: null },
    { id: 'sentinel' as const, label: 'تنبيهات الحارس', icon: Shield, color: '#ef4444', count: DEMO_ALERTS.filter(a => a.severity === 'high').length },
  ]

  return (
    <div className="min-h-screen bg-[#020204] relative" dir={dir}>
      <Navbar />

      {/* Background atmosphere */}
      <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }}>
        <div
          className="absolute w-[600px] h-[600px] rounded-full opacity-8 blur-[120px]"
          style={{
            background: 'radial-gradient(circle, rgba(245,158,11,0.10), transparent 70%)',
            top: '5%',
            right: '10%',
            animation: 'float 12s ease-in-out infinite',
          }}
        />
        <div
          className="absolute w-[400px] h-[400px] rounded-full opacity-6 blur-[100px]"
          style={{
            background: 'radial-gradient(circle, rgba(6,182,212,0.08), transparent 70%)',
            bottom: '10%',
            left: '5%',
            animation: 'float 14s ease-in-out infinite reverse',
          }}
        />
        <div
          className="absolute w-[300px] h-[300px] rounded-full opacity-5 blur-[80px]"
          style={{
            background: 'radial-gradient(circle, rgba(139,92,246,0.08), transparent 70%)',
            top: '50%',
            left: '40%',
            animation: 'float 10s ease-in-out infinite',
          }}
        />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-6 py-8 pt-28">
        {/* ═══ HEADER ═══════════════════════════════════════ */}
        <div className="text-center mb-12 page-enter">
          <div className="inline-flex items-center gap-2 mb-4 px-4 py-2 rounded-full"
            style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.12)' }}
          >
            <Sparkles className="w-4 h-4 text-amber" />
            <span className="text-xs text-amber font-mono tracking-wider">LIVE META-MARKETING</span>
          </div>
          <h1 className="text-display mb-3">
            NEXUS AI
            <span className="gradient-text"> يسوّق نفسه</span>
          </h1>
          <p className="text-text-secondary text-sm max-w-2xl mx-auto leading-relaxed">
            شاهد كيف يستخدم NEXUS AI وكلاءه الأربعة لتسويق نفسه — في الوقت الفعلي.
            <br />
            NEX يُنتج المحتوى. VEX يُدير الإعلانات. PULSE يُحلل. Sentinel يُراقب.
          </p>
        </div>

        {/* ═══ AGENTS WORKING ═══════════════════════════════ */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10 page-enter">
          {[
            { name: 'NEX', role: 'يُنتج المحتوى', color: '#f59e0b', icon: Video, status: 'يُنتج فيديو...', progress: 78 },
            { name: 'VEX', role: 'يُدير الإعلانات', color: '#06b6d4', icon: Megaphone, status: 'يُحسّن الحملة', progress: 92 },
            { name: 'PULSE', role: 'يُحلل البيانات', color: '#8b5cf6', icon: BarChart3, status: 'تحديث لوحة التحليلات', progress: 65 },
            { name: 'Sentinel', role: 'يُراقب السوق', color: '#ef4444', icon: Shield, status: '٥ تنبيهات جديدة', progress: 100 },
          ].map((agent, i) => (
            <GlassCard key={agent.name} className="p-5" accentColor={agent.color}
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: `${agent.color}12`, border: `1px solid ${agent.color}25` }}
                >
                  <agent.icon className="w-5 h-5" style={{ color: agent.color }} />
                </div>
                <div>
                  <div className="font-bold text-sm text-text-primary">{agent.name}</div>
                  <div className="text-[11px] text-text-muted">{agent.role}</div>
                </div>
                <div className="mr-auto">
                  <div
                    className="w-2 h-2 rounded-full animate-pulse"
                    style={{ background: agent.color, boxShadow: `0 0 8px ${agent.color}` }}
                  />
                </div>
              </div>
              <div className="text-xs text-text-muted mb-2">{agent.status}</div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)' }}>
                <div
                  className="h-full rounded-full transition-all duration-1000 ease-out"
                  style={{
                    width: animatedNumbers ? `${agent.progress}%` : '0%',
                    background: `linear-gradient(90deg, ${agent.color}, ${agent.color}80)`,
                  }}
                />
              </div>
            </GlassCard>
          ))}
        </div>

        {/* ═══ KPI CARDS ════════════════════════════════════ */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10 page-enter">
          {METRICS.map((metric, i) => (
            <GlassCard key={metric.label} className="p-5" style={{ animationDelay: `${i * 100}ms` }}>
              <div className="flex items-center justify-between mb-3">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center"
                  style={{ background: `${metric.color}12` }}
                >
                  <metric.icon className="w-4.5 h-4.5" style={{ color: metric.color }} />
                </div>
                <span
                  className="text-[11px] font-bold flex items-center gap-0.5"
                  style={{ color: metric.change >= 0 ? '#10b981' : '#ef4444' }}
                >
                  {metric.change > 0 ? '+' : ''}{metric.change}%
                  <ArrowUpRight className={`w-3 h-3 ${metric.change < 0 ? 'rotate-90' : ''}`} />
                </span>
              </div>
              <div className="text-2xl font-bold text-text-primary mb-1">{metric.value}</div>
              <div className="text-[11px] text-text-muted">{metric.label}</div>
            </GlassCard>
          ))}
        </div>

        {/* ═══ TABS ═════════════════════════════════════════ */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2 page-enter">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                  isActive ? 'text-white' : 'text-text-muted hover:text-white'
                }`}
                style={{
                  background: isActive ? `${tab.color}10` : 'rgba(255,255,255,0.02)',
                  border: isActive ? `1px solid ${tab.color}25` : '1px solid rgba(255,255,255,0.04)',
                }}
              >
                <Icon className="w-4 h-4" style={{ color: isActive ? tab.color : undefined }} />
                <span>{tab.label}</span>
                {tab.count !== null && (
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded-full font-bold"
                    style={{ background: `${tab.color}20`, color: tab.color }}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* ═══ CAMPAIGNS TAB ════════════════════════════════ */}
        {activeTab === 'campaigns' && (
          <div className="space-y-4 page-enter">
            <GlassCard className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.2)' }}>
                    <Megaphone className="w-5 h-5 text-cyan-400" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold">الحملات النشطة</h2>
                    <p className="text-xs text-text-muted">VEX يُدير {DEMO_CAMPAIGNS.length} حملات على ٣ منصات</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-text-muted">الميزانية الإجمالية</div>
                  <div className="text-xl font-bold text-cyan-400">$١,٠٠٠/شهر</div>
                </div>
              </div>

              <div className="space-y-3">
                {DEMO_CAMPAIGNS.map((campaign) => (
                  <div
                    key={campaign.id}
                    className="p-4 rounded-xl transition-all hover:border-cyan-500/20"
                    style={{
                      background: 'rgba(255,255,255,0.01)',
                      border: '1px solid rgba(255,255,255,0.04)',
                    }}
                  >
                    <div className="flex flex-col md:flex-row md:items-center gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <AgentAvatar agent={campaign.aiAgent} />
                          <span className="font-semibold text-sm text-text-primary">{campaign.platform}</span>
                          <StatusBadge status={campaign.status} />
                        </div>
                        <div className="text-xs text-text-muted">
                          آخر تحسين: {campaign.lastOptimized}
                        </div>
                      </div>

                      <div className="grid grid-cols-4 gap-4 text-center">
                        <div>
                          <div className="text-sm font-bold text-text-primary">{campaign.impressions.toLocaleString('ar-SA')}</div>
                          <div className="text-[10px] text-text-muted">انطباعات</div>
                        </div>
                        <div>
                          <div className="text-sm font-bold text-text-primary">{campaign.clicks.toLocaleString('ar-SA')}</div>
                          <div className="text-[10px] text-text-muted">نقرات</div>
                        </div>
                        <div>
                          <div className="text-sm font-bold text-emerald-400">{campaign.conversions}</div>
                          <div className="text-[10px] text-text-muted">تحويلات</div>
                        </div>
                        <div>
                          <div className="text-sm font-bold text-amber">${campaign.cpa}</div>
                          <div className="text-[10px] text-text-muted">CPA</div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3">
                      <div className="flex items-center justify-between text-xs text-text-muted mb-1">
                        <span>الميزانية: ${campaign.spent.toFixed(2)} / ${campaign.budget}</span>
                        <span>{Math.round((campaign.spent / campaign.budget) * 100)}%</span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)' }}>
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${(campaign.spent / campaign.budget) * 100}%`,
                            background: campaign.spent / campaign.budget > 0.8
                              ? 'linear-gradient(90deg, #ef4444, #f59e0b)'
                              : 'linear-gradient(90deg, #06b6d4, #0891b2)',
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>
          </div>
        )}

        {/* ═══ CONTENT TAB ══════════════════════════════════ */}
        {activeTab === 'content' && (
          <div className="space-y-4 page-enter">
            <GlassCard className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}>
                  <Video className="w-5 h-5 text-amber" />
                </div>
                <div>
                  <h2 className="text-lg font-bold">استوديو المحتوى</h2>
                  <p className="text-xs text-text-muted">NEX يُنتج المحتوى التسويقي لـ NEXUS AI</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {DEMO_CONTENT.map((content) => (
                  <div
                    key={content.id}
                    className="p-4 rounded-xl transition-all"
                    style={{
                      background: 'rgba(255,255,255,0.01)',
                      border: '1px solid rgba(255,255,255,0.04)',
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">
                        {content.type === 'video' && <Video className="w-5 h-5 text-amber" />}
                        {content.type === 'ad_copy' && <FileText className="w-5 h-5 text-cyan-400" />}
                        {content.type === 'social_post' && <MessageSquare className="w-5 h-5 text-violet-400" />}
                        {content.type === 'script' && <FileText className="w-5 h-5 text-emerald-400" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <AgentAvatar agent={content.agent} />
                          <ContentStatusBadge status={content.status} />
                        </div>
                        <p className="text-sm text-text-primary font-medium mb-2">{content.title}</p>
                        <div className="flex items-center gap-3 text-[11px] text-text-muted">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {content.createdAt}
                          </span>
                          {content.metrics && (
                            <>
                              <span className="flex items-center gap-1">
                                <Eye className="w-3 h-3" /> {content.metrics.views?.toLocaleString('ar-SA')} مشاهدة
                              </span>
                              <span className="flex items-center gap-1">
                                <TrendingUp className="w-3 h-3" /> {content.metrics.engagement}% تفاعل
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>
          </div>
        )}

        {/* ═══ ANALYTICS TAB ════════════════════════════════ */}
        {activeTab === 'analytics' && (
          <div className="space-y-4 page-enter">
            <GlassCard className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)' }}>
                  <BarChart3 className="w-5 h-5 text-violet-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold">التحليلات</h2>
                  <p className="text-xs text-text-muted">PULSE يحلل الأداء ويقدم توصيات</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {[
                  { label: 'زوار الموقع', current: '١,٢٤٧', target: '٥,٠٠٠', pct: 24.9, color: '#06b6d4' },
                  { label: 'معدل التحويل', current: '٣.٤٪', target: '٥٪', pct: 68, color: '#10b981' },
                  { label: 'تكلفة التسجيل', current: '$٧.٨', target: '$٥', pct: 64, color: '#f59e0b', inverse: true },
                  { label: 'معدل الارتداد', current: '٤٥٪', target: '٣٥٪', pct: 77.7, color: '#ef4444', inverse: true },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="p-4 rounded-xl"
                    style={{
                      background: 'rgba(255,255,255,0.01)',
                      border: '1px solid rgba(255,255,255,0.04)',
                    }}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm text-text-secondary">{item.label}</span>
                      <span className="text-xs text-text-muted">الهدف: {item.target}</span>
                    </div>
                    <div className="text-2xl font-bold text-text-primary mb-2">{item.current}</div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)' }}>
                      <div
                        className="h-full rounded-full transition-all duration-1000"
                        style={{
                          width: animatedNumbers ? `${item.pct}%` : '0%',
                          background: item.inverse
                            ? `linear-gradient(90deg, ${item.color}, ${item.color}80)`
                            : `linear-gradient(90deg, ${item.color}, ${item.color}80)`,
                        }}
                      />
                    </div>
                    <div className="text-[11px] text-text-muted mt-1 text-left">
                      {item.inverse ? 'أقل أفضل' : 'أعلى أفضل'} · {Math.round(item.pct)}% من الهدف
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-4 rounded-xl" style={{ background: 'rgba(139,92,246,0.03)', border: '1px solid rgba(139,92,246,0.1)' }}>
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="w-4 h-4 text-violet-400" />
                  <span className="text-sm font-bold text-violet-400">توصيات PULSE الذكية</span>
                </div>
                <div className="space-y-2">
                  {[
                    'معدل الارتداد مرتفع (٤٥٪) — أضف فيديو توضيحي أعلى الصفحة الرئيسية',
                    'حملة TikTok تتفوّق بنسبة ٤٠٪ — زِد ميزانيتها ٢٥٪',
                    'كلمات البحث "تسويق AI" تحقق أعلى تحويل — ركّز الميزانية عليها',
                    'أغلب الزوار يغادرون عند خطوة الربط بـ Meta — بسّط العملية',
                  ].map((rec, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                      <span className="text-violet-400 mt-0.5">•</span>
                      <span>{rec}</span>
                    </div>
                  ))}
                </div>
              </div>
            </GlassCard>
          </div>
        )}

        {/* ═══ SENTINEL TAB ═══════════════════════════════ */}
        {activeTab === 'sentinel' && (
          <div className="space-y-4 page-enter">
            <GlassCard className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                  <Shield className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold">تنبيهات الحارس</h2>
                  <p className="text-xs text-text-muted">Sentinel يراقب المنافسين ويُنبّهك بالفرص والتهديدات</p>
                </div>
              </div>

              <div className="space-y-3">
                {DEMO_ALERTS.map((alert) => (
                  <div
                    key={alert.id}
                    className="rounded-xl overflow-hidden transition-all"
                    style={{
                      background: 'rgba(255,255,255,0.01)',
                      border: '1px solid rgba(255,255,255,0.04)',
                    }}
                  >
                    <button
                      onClick={() => setExpandedAlert(expandedAlert === alert.id ? null : alert.id)}
                      className="w-full flex items-center gap-3 p-4 text-right"
                    >
                      <AgentAvatar agent={alert.agent} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <AlertBadge severity={alert.severity} />
                          <span className="text-[11px] text-text-muted">{alert.time}</span>
                        </div>
                        <p className="text-sm text-text-primary">{alert.message}</p>
                      </div>
                      {expandedAlert === alert.id ? <ChevronUp className="w-4 h-4 text-text-muted" /> : <ChevronDown className="w-4 h-4 text-text-muted" />}
                    </button>

                    {expandedAlert === alert.id && (
                      <div className="px-4 pb-4">
                        <div className="p-3 rounded-lg text-sm"
                          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <Bot className="w-4 h-4 text-amber" />
                            <span className="text-xs font-bold text-amber">رد مقترح من Sentinel</span>
                          </div>
                          <p className="text-text-secondary">
                            {alert.type === 'competitor' && 'ردّ بعرض "Starter مجاني مدى الحياة" لأول ١٠٠ مستخدم. أو أطلق حملة "أسعارنا لا تتغير — ثبات هو القوة".'}
                            {alert.type === 'opportunity' && 'نفّذ التوصية فوراً: زِد ميزانية TikTok بنسبة ٢٥٪ وانقل ١٥٪ من ميزانية Meta.'}
                            {alert.type === 'insight' && 'أضف فيديو توضيحي ٣٠ ثانية أعلى الصفحة الرئيسية. جرّب A/B testing مع/بدون الفيديو.'}
                            {alert.type === 'warning' && 'راقب الموقف عن كثب. جهّز plan B في حال تدهور الوضع.'}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </GlassCard>
          </div>
        )}

        {/* ═══ CTA ════════════════════════════════════════ */}
        <div className="mt-12 text-center page-enter">
          <GlassCard className="p-8 max-w-2xl mx-auto" accentColor="#f59e0b">
            <Sparkles className="w-8 h-8 text-amber mx-auto mb-4" />
            <h2 className="text-headline mb-3">هل تريد فريقاً مثل هذا لعلامتك؟</h2>
            <p className="text-text-secondary text-sm mb-6 leading-relaxed">
              NEXUS AI لا يسوّق نفسه فقط — بل يُقدم لك نفس الأدوات لنمو علامتك التجارية.
              <br />
              ٤ وكلاء. هدف واحد: نجاحك.
            </p>
            <a
              href="/auth/register"
              className="btn-primary inline-flex items-center gap-2 text-base py-3 px-8"
            >
              <Zap className="w-5 h-5" />
              ابدأ مجاناً — شغّل فريقك
            </a>
            <p className="text-text-muted text-xs mt-4">لا حاجة لبطاقة ائتمان · تجربة Starter مجانية</p>
          </GlassCard>
        </div>
      </div>

      <style jsx>{`
        @keyframes float {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-20px) scale(1.02); }
        }
      `}</style>
    </div>
  )
}
