'use client'

import { useState } from 'react'
import { generateAdCopy } from '@/services/openai'
import {
  Wand2, Loader2, Megaphone, Copy, CheckCircle, AlertTriangle, Info,
  Target, Globe, Zap, TrendingUp, DollarSign, BarChart3, Rocket,
  Crosshair, Layers, Sparkles, Star, Flame
} from 'lucide-react'

/* ═══════════════════════════════════════════════════════════════
   VEX COMMAND — Tactical Ad Operations Center
   Dominating the digital universe, one campaign at a time.
   ═══════════════════════════════════════════════════════════════ */

interface Campaign {
  id: string
  title: string
  status: 'active' | 'paused' | 'draft'
  platform: string
  budget: string
  spent: string
  ctr: string
  roas: string
  impressions: string
  conversions: number
}

const platforms = [
  { name: 'Meta', icon: 'M', color: '#1877F2', active: true },
  { name: 'TikTok', icon: 'T', color: '#FE2C55', active: true },
  { name: 'Google', icon: 'G', color: '#4285F4', active: true },
  { name: 'Snapchat', icon: 'S', color: '#FFFC00', active: false },
  { name: 'LinkedIn', icon: 'in', color: '#0A66C2', active: false },
  { name: 'X', icon: '𝕏', color: '#FFFFFF', active: false },
]

const goals = [
  { value: 'sales', label: 'مبيعات', icon: DollarSign, desc: 'زيادة المبيعات المباشرة' },
  { value: 'leads', label: 'قيادة', icon: Target, desc: 'جمع بيانات العملاء' },
  { value: 'awareness', label: 'وعي', icon: Globe, desc: 'زيادة الوعي بالعلامة' },
  { value: 'engagement', label: 'تفاعل', icon: Flame, desc: 'تفاعل أكبر مع المحتوى' },
]

const campaigns: Campaign[] = [
  { id: '1', title: 'حملة منتج X', status: 'active', platform: 'Meta', budget: '$500', spent: '$320', ctr: '2.4%', roas: '3.2x', impressions: '45K', conversions: 128 },
  { id: '2', title: 'ترويج تطبيق Y', status: 'paused', platform: 'TikTok', budget: '$300', spent: '$180', ctr: '1.8%', roas: '2.1x', impressions: '32K', conversions: 67 },
  { id: '3', title: 'وعي علامة Z', status: 'draft', platform: 'Google', budget: '$800', spent: '$0', ctr: '-', roas: '-', impressions: '-', conversions: 0 },
  { id: '4', title: 'حملة رمضان', status: 'active', platform: 'Meta', budget: '$1200', spent: '$890', ctr: '3.1%', roas: '4.5x', impressions: '120K', conversions: 342 },
]

const statusConfig: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  active: {
    label: 'نشطة',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/8 border-emerald-500/20',
    icon: CheckCircle,
  },
  paused: {
    label: 'معلّقة',
    color: 'text-amber-400',
    bg: 'bg-amber-500/8 border-amber-500/20',
    icon: AlertTriangle,
  },
  draft: {
    label: 'مسودة',
    color: 'text-text-muted',
    bg: 'bg-white/5 border-white/10',
    icon: Info,
  },
}

export default function VexPage() {
  const [product, setProduct] = useState('')
  const [goal, setGoal] = useState('sales')
  const [audience, setAudience] = useState('')
  const [copy, setCopy] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['Meta', 'TikTok'])

  const handleGenerate = async () => {
    if (!product || !audience) return
    setLoading(true)
    try {
      const result = await generateAdCopy(product, selectedPlatforms[0], goal)
      setCopy(result)
    } catch (e) {
      setCopy('حدث خطأ أثناء توليد النسخ. يرجى المحاولة مرة أخرى.')
    }
    setLoading(false)
  }

  const togglePlatform = (name: string) => {
    setSelectedPlatforms(prev =>
      prev.includes(name)
        ? prev.filter(p => p !== name)
        : [...prev, name]
    )
  }

  const totalBudget = campaigns.reduce((sum, c) => sum + parseInt(c.budget.replace('$', '')), 0)
  const totalSpent = campaigns.reduce((sum, c) => sum + parseInt(c.spent.replace('$', '')), 0)
  const activeCampaigns = campaigns.filter(c => c.status === 'active').length
  const totalConversions = campaigns.reduce((sum, c) => sum + c.conversions, 0)

  return (
    <div className="space-y-8 relative min-h-screen">
      {/* Ambient background glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
        <div
          className="absolute w-[500px] h-[500px] rounded-full opacity-10 blur-[100px]"
          style={{
            background: 'radial-gradient(circle, rgba(6,182,212,0.15), transparent 70%)',
            top: '20%',
            right: '0%',
            animation: 'float 8s ease-in-out infinite',
          }}
        />
        <div
          className="absolute w-[400px] h-[400px] rounded-full opacity-8 blur-[80px]"
          style={{
            background: 'radial-gradient(circle, rgba(245,158,11,0.1), transparent 70%)',
            bottom: '10%',
            left: '-5%',
            animation: 'float 10s ease-in-out infinite reverse',
          }}
        />
      </div>

      <div className="relative z-10">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan/20 to-blue/10 flex items-center justify-center">
              <Crosshair className="w-4 h-4 text-cyan" />
            </div>
            <span className="text-xs text-cyan/70 font-mono tracking-wider">VEX COMMAND CENTER</span>
          </div>
          <h1 className="text-3xl font-bold mb-2">مركز عمليات VEX</h1>
          <p className="text-text-muted text-sm">
            أدر حملاتك الإعلانية عبر كل المنصات من نقطة واحدة. VEX يُحسّن، يُعيد الاستهداف، ويزود العائد.
          </p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'الحملات النشطة', value: activeCampaigns, icon: Rocket, color: 'cyan' },
            { label: 'الميزانية الكلية', value: `$${totalBudget}`, icon: DollarSign, color: 'amber' },
            { label: 'المصروف', value: `$${totalSpent}`, icon: TrendingUp, color: 'emerald' },
            { label: 'التحويلات', value: totalConversions, icon: Target, color: 'purple' },
          ].map((stat) => {
            const Icon = stat.icon
            return (
              <div
                key={stat.label}
                className="p-5 corner-accent"
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: '16px',
                }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <Icon className={`w-4 h-4 text-${stat.color}-400`} />
                  <span className="text-xs text-text-muted">{stat.label}</span>
                </div>
                <p className="text-2xl font-bold">{stat.value}</p>
              </div>
            )
          })}
        </div>

        {/* Connected Platforms */}
        <div
          className="p-6 mb-8 corner-accent"
          style={{
            background: 'rgba(255,255,255,0.02)',
            backdropFilter: 'blur(30px)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '20px',
          }}
        >
          <div className="flex items-center gap-2 mb-4">
            <Globe className="w-5 h-5 text-cyan" />
            <h3 className="font-bold">المنصات المتصلة</h3>
          </div>
          <div className="flex flex-wrap gap-3">
            {platforms.map((platform) => {
              const isSelected = selectedPlatforms.includes(platform.name)
              return (
                <button
                  key={platform.name}
                  onClick={() => togglePlatform(platform.name)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all duration-300 ${
                    isSelected
                      ? 'border-white/15 bg-white/5 shadow-lg'
                      : 'border-white/5 bg-white/2 hover:bg-white/5'
                  }`}
                >
                  <span
                    className="w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold"
                    style={{ background: platform.color + '20', color: platform.color }}
                  >
                    {platform.icon}
                  </span>
                  {platform.name}
                  {isSelected && (
                    <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-emerald-400/50 shadow-sm" />
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Ad Copy Generator */}
        <div
          className="p-8 mb-8 corner-accent"
          style={{
            background: 'rgba(255,255,255,0.02)',
            backdropFilter: 'blur(30px)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '24px',
          }}
        >
          <div className="flex items-center gap-2 mb-6">
            <Sparkles className="w-5 h-5 text-amber" />
            <h3 className="text-xl font-bold">مولد النسخ الإعلانية الذكي</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                <Star className="w-4 h-4 text-amber" />
                اسم المنتج أو الخدمة
              </label>
              <input
                type="text"
                value={product}
                onChange={(e) => setProduct(e.target.value)}
                placeholder="مثال: تطبيق fitness للياقة البدنية"
                className="input-nexus"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                <Target className="w-4 h-4 text-cyan" />
                الجمهور المستهدف
              </label>
              <input
                type="text"
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                placeholder="مثال: شاب 18-25 مهتم بالرياضة والصحة"
                className="input-nexus"
              />
            </div>
          </div>

          {/* Goal Selection */}
          <div className="mb-8">
            <label className="block text-sm font-medium mb-3 flex items-center gap-2">
              <Zap className="w-4 h-4 text-purple-400" />
              الهدف التسويقي
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {goals.map((g) => {
                const Icon = g.icon
                const isSelected = goal === g.value
                return (
                  <button
                    key={g.value}
                    onClick={() => setGoal(g.value)}
                    className={`p-4 rounded-xl border text-center transition-all duration-300 ${
                      isSelected
                        ? 'border-amber/40 bg-amber/5 shadow-lg shadow-amber/5'
                        : 'border-white/8 bg-white/3 hover:bg-white/5 hover:border-white/15'
                    }`}
                  >
                    <Icon className={`w-5 h-5 mx-auto mb-2 ${isSelected ? 'text-amber' : 'text-text-muted'}`} />
                    <p className={`text-sm font-medium ${isSelected ? 'text-text-primary' : 'text-text-secondary'}`}>
                      {g.label}
                    </p>
                    <p className="text-[10px] text-text-muted mt-1">{g.desc}</p>
                  </button>
                )
              })}
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={loading || !product || !audience}
            className="btn-primary btn-3d text-lg px-8 py-4 w-full md:w-auto"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                VEX يُبدع النسخ...
              </>
            ) : (
              <>
                <Wand2 className="w-5 h-5" />
                توليد 3 نسخ إعلانية
                <Sparkles className="w-5 h-5" />
              </>
            )}
          </button>

          {copy && (
            <div
              className="mt-6 p-6 corner-accent energy-ring"
              style={{
                background: 'rgba(245,158,11,0.02)',
                border: '1px solid rgba(245,158,11,0.1)',
                borderRadius: '20px',
              }}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Megaphone className="w-5 h-5 text-amber" />
                  <span className="font-bold">النسخ الإعلانية المُولّدة</span>
                </div>
                <button
                  onClick={() => navigator.clipboard.writeText(copy)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 transition-all border border-white/10 text-sm"
                >
                  <Copy className="w-4 h-4" />
                  نسخ الكل
                </button>
              </div>
              <div className="p-5 rounded-xl bg-black/20 border border-white/5">
                <pre className="text-sm text-text-secondary whitespace-pre-wrap font-medium leading-relaxed">
                  {copy}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Campaigns Table */}
        <div
          className="p-8 corner-accent"
          style={{
            background: 'rgba(255,255,255,0.02)',
            backdropFilter: 'blur(30px)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '24px',
          }}
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-cyan" />
              <h3 className="text-xl font-bold">الحملات النشطة</h3>
            </div>
            <span className="text-xs text-text-muted font-mono">{campaigns.length} حملة</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-right py-3 px-4 text-text-muted font-medium text-xs uppercase tracking-wider">الحملة</th>
                  <th className="text-right py-3 px-4 text-text-muted font-medium text-xs uppercase tracking-wider">المنصة</th>
                  <th className="text-right py-3 px-4 text-text-muted font-medium text-xs uppercase tracking-wider">الميزانية</th>
                  <th className="text-right py-3 px-4 text-text-muted font-medium text-xs uppercase tracking-wider">المصروف</th>
                  <th className="text-right py-3 px-4 text-text-muted font-medium text-xs uppercase tracking-wider">CTR</th>
                  <th className="text-right py-3 px-4 text-text-muted font-medium text-xs uppercase tracking-wider">ROAS</th>
                  <th className="text-right py-3 px-4 text-text-muted font-medium text-xs uppercase tracking-wider">التحويلات</th>
                  <th className="text-right py-3 px-4 text-text-muted font-medium text-xs uppercase tracking-wider">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => {
                  const config = statusConfig[c.status]
                  const StatusIcon = config.icon
                  return (
                    <tr
                      key={c.id}
                      className="border-b border-white/5 hover:bg-white/3 transition-colors"
                    >
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
                            <Megaphone className="w-4 h-4 text-text-muted" />
                          </div>
                          <span className="font-medium">{c.title}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-text-secondary">{c.platform}</td>
                      <td className="py-4 px-4 text-text-secondary">{c.budget}</td>
                      <td className="py-4 px-4 text-text-secondary">{c.spent}</td>
                      <td className="py-4 px-4">
                        <span className={c.ctr !== '-' ? 'text-emerald-400' : 'text-text-muted'}>
                          {c.ctr}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <span className={c.roas !== '-' ? 'text-amber font-bold' : 'text-text-muted'}>
                          {c.roas}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <span className="font-medium">{c.conversions}</span>
                      </td>
                      <td className="py-4 px-4">
                        <span className={`text-xs px-3 py-1.5 rounded-full border flex items-center gap-1.5 ${config.bg} ${config.color}`}>
                          <StatusIcon className="w-3 h-3" />
                          {config.label}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
